import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreatePaymentAdjustmentDto } from './dto/create-payment-adjustment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { DebtCustomersService } from './debt-customers.service';
import {
  debtStatus,
  moneyGreater,
  moneyNum,
  moneyStr,
  toDateOnlyString,
} from './debt.utils';
import { DebtPaymentAdjustment } from './entities/payment-adjustment.entity';
import { DebtPaymentAllocation } from './entities/payment-allocation.entity';
import { DebtPayment } from './entities/payment.entity';
import { DebtTransaction } from './entities/transaction.entity';
import { DebtSnapshotsService } from './debt-snapshots.service';

const EPS = 0.0001;

function effectiveTxDate(tx: DebtTransaction): string {
  if (tx.transactionDate) return tx.transactionDate;
  return tx.createdAt instanceof Date
    ? tx.createdAt.toISOString().slice(0, 10)
    : String(tx.createdAt).slice(0, 10);
}

function sortOpenTransactions(txs: DebtTransaction[]): DebtTransaction[] {
  return [...txs].sort((a, b) => {
    const c = effectiveTxDate(a).localeCompare(effectiveTxDate(b));
    if (c !== 0) return c;
    const ta =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : new Date(a.createdAt).getTime();
    const tb =
      b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : new Date(b.createdAt).getTime();
    return ta - tb;
  });
}

export type PaymentListRow = DebtPayment & {
  actualAmount: string;
  adjustments: DebtPaymentAdjustment[];
};

@Injectable()
export class DebtPaymentsService {
  constructor(
    @InjectRepository(DebtPayment)
    private readonly payRepo: Repository<DebtPayment>,
    @InjectRepository(DebtPaymentAllocation)
    private readonly allocRepo: Repository<DebtPaymentAllocation>,
    @InjectRepository(DebtTransaction)
    private readonly txRepo: Repository<DebtTransaction>,
    @InjectRepository(DebtPaymentAdjustment)
    private readonly adjRepo: Repository<DebtPaymentAdjustment>,
    private readonly customers: DebtCustomersService,
    private readonly dataSource: DataSource,
    private readonly snapshots: DebtSnapshotsService,
  ) {}

  async computeActualAmount(
    manager: EntityManager,
    paymentId: string,
  ): Promise<number> {
    const pay = await manager
      .getRepository(DebtPayment)
      .findOne({ where: { id: paymentId } });
    if (!pay) return 0;
    const raw = await manager
      .getRepository(DebtPaymentAdjustment)
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.amountAdjustment), 0)', 's')
      .where('a.paymentId = :id', { id: paymentId })
      .getRawOne<{ s: string }>();
    const adjSum = moneyNum(raw?.s ?? '0');
    return moneyNum(pay.amount) + adjSum;
  }

  private async sumAllocations(
    manager: EntityManager,
    paymentId: string,
  ): Promise<number> {
    const raw = await manager
      .getRepository(DebtPaymentAllocation)
      .createQueryBuilder('x')
      .select('COALESCE(SUM(x.amount), 0)', 's')
      .where('x.paymentId = :id', { id: paymentId })
      .getRawOne<{ s: string }>();
    return moneyNum(raw?.s ?? '0');
  }

  private async allocateAmount(
    manager: EntityManager,
    customerId: string,
    paymentId: string,
    budget: number,
  ): Promise<void> {
    if (budget <= EPS) return;
    const txRepo = manager.getRepository(DebtTransaction);
    const allocRepo = manager.getRepository(DebtPaymentAllocation);

    const open = await txRepo
      .createQueryBuilder('t')
      .where('t.customerId = :cid', { cid: customerId })
      .andWhere('t.status != :paid', { paid: 'PAID' })
      .getMany();

    let remaining = budget;
    const ordered = sortOpenTransactions(open);

    for (const tx of ordered) {
      if (remaining <= EPS) break;
      const total = moneyNum(tx.totalAmount);
      const paid = moneyNum(tx.paidAmount);
      const owed = Math.max(0, total - paid);
      if (owed <= EPS) continue;

      const take = Math.min(remaining, owed);
      if (take <= EPS) continue;

      const alloc = allocRepo.create({
        paymentId,
        transactionId: tx.id,
        amount: moneyStr(take),
      });
      await allocRepo.save(alloc);

      const newPaid = paid + take;
      await txRepo.update(
        { id: tx.id },
        { paidAmount: moneyStr(newPaid), status: debtStatus(total, newPaid) },
      );

      remaining -= take;
    }
  }

  /**
   * Match total allocated amount to effective payment amount (after adjustments).
   */
  private async reconcileAllocations(
    manager: EntityManager,
    paymentId: string,
  ): Promise<void> {
    const payRepo = manager.getRepository(DebtPayment);
    const allocRepo = manager.getRepository(DebtPaymentAllocation);
    const txRepo = manager.getRepository(DebtTransaction);

    const payment = await payRepo.findOne({ where: { id: paymentId } });
    if (!payment) return;

    const target = await this.computeActualAmount(manager, paymentId);
    if (target < -EPS) {
      throw new BadRequestException(
        'Số tiền hiệu lực thanh toán không được âm',
      );
    }

    let allocated = await this.sumAllocations(manager, paymentId);

    // Unwind LIFO if over-allocated
    if (moneyGreater(allocated, target)) {
      let excess = allocated - target;
      const allocs = await allocRepo.find({
        where: { paymentId },
        order: { createdAt: 'DESC', id: 'DESC' },
      });

      for (const alloc of allocs) {
        if (excess <= EPS) break;
        const amt = moneyNum(alloc.amount);
        if (amt <= EPS) continue;

        const cut = Math.min(amt, excess);
        const newAllocAmt = amt - cut;

        const tx = await txRepo.findOne({ where: { id: alloc.transactionId } });
        if (!tx) continue;

        const newPaid = Math.max(0, moneyNum(tx.paidAmount) - cut);
        await txRepo.update(
          { id: tx.id },
          {
            paidAmount: moneyStr(newPaid),
            status: debtStatus(moneyNum(tx.totalAmount), newPaid),
          },
        );

        if (newAllocAmt <= EPS) {
          await allocRepo.delete({ id: alloc.id });
        } else {
          await allocRepo.update(
            { id: alloc.id },
            { amount: moneyStr(newAllocAmt) },
          );
        }

        excess -= cut;
      }

      allocated = await this.sumAllocations(manager, paymentId);
    }

    // Allocate extra if under-allocated
    if (moneyGreater(target, allocated)) {
      const add = target - allocated;
      await this.allocateAmount(manager, payment.customerId, paymentId, add);
    }
  }

  async findAll(customerId?: string): Promise<{ data: PaymentListRow[] }> {
    const qb = this.payRepo
      .createQueryBuilder('p')
      .orderBy('p.paymentDate', 'DESC')
      .addOrderBy('p.createdAt', 'DESC');
    if (customerId) {
      qb.where('p.customerId = :customerId', { customerId });
    }
    const payments = await qb.getMany();
    if (payments.length === 0) return { data: [] };

    const ids = payments.map((p) => p.id);
    const adjs = await this.adjRepo
      .createQueryBuilder('a')
      .where('a.paymentId IN (:...ids)', { ids })
      .orderBy('a.createdAt', 'ASC')
      .getMany();

    const byPay = new Map<string, DebtPaymentAdjustment[]>();
    for (const a of adjs) {
      const arr = byPay.get(a.paymentId) ?? [];
      arr.push(a);
      byPay.set(a.paymentId, arr);
    }

    const data: PaymentListRow[] = payments.map((p) => {
      const adjustments = byPay.get(p.id) ?? [];
      const adjSum = adjustments.reduce(
        (s, a) => s + moneyNum(a.amountAdjustment),
        0,
      );
      const actual = moneyNum(p.amount) + adjSum;
      return {
        ...p,
        adjustments,
        actualAmount: moneyStr(actual),
      };
    });

    return { data };
  }

  async findOneWithAllocations(id: string) {
    const payment = await this.payRepo.findOne({ where: { id } });
    if (!payment) return null;
    const allocations = await this.allocRepo.find({
      where: { paymentId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const adjustments = await this.adjRepo.find({
      where: { paymentId: id },
      order: { createdAt: 'ASC' },
    });
    const adjSum = adjustments.reduce(
      (s, a) => s + moneyNum(a.amountAdjustment),
      0,
    );
    const actualAmount = moneyStr(moneyNum(payment.amount) + adjSum);
    return { ...payment, allocations, adjustments, actualAmount };
  }

  async create(dto: CreatePaymentDto) {
    const customer = await this.customers.assertExists(dto.customerId);
    const amount = dto.amount;
    const paymentDate = dto.paymentDate?.trim() || toDateOnlyString();

    const saved = await this.dataSource.transaction(async (manager) => {
      const payRepo = manager.getRepository(DebtPayment);
      const txRepo = manager.getRepository(DebtTransaction);
      const allocRepo = manager.getRepository(DebtPaymentAllocation);

      const payment = payRepo.create({
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        amount: moneyStr(amount),
        note: dto.note?.trim() || null,
        paymentDate,
      });
      const savedPayment = await payRepo.save(payment);

      const open = await txRepo
        .createQueryBuilder('t')
        .where('t.customerId = :cid', { cid: customer.id })
        .andWhere('t.status != :paid', { paid: 'PAID' })
        .getMany();

      let remaining = amount;
      const ordered = sortOpenTransactions(open);

      for (const tx of ordered) {
        if (remaining <= EPS) break;
        const total = moneyNum(tx.totalAmount);
        const paid = moneyNum(tx.paidAmount);
        const owed = Math.max(0, total - paid);
        if (owed <= EPS) continue;

        const take = Math.min(remaining, owed);
        if (take <= EPS) continue;

        const alloc = allocRepo.create({
          paymentId: savedPayment.id,
          transactionId: tx.id,
          amount: moneyStr(take),
        });
        await allocRepo.save(alloc);

        const newPaid = paid + take;
        await txRepo.update(
          { id: tx.id },
          { paidAmount: moneyStr(newPaid), status: debtStatus(total, newPaid) },
        );

        remaining -= take;
      }

      return savedPayment;
    });

    await this.snapshots.refreshForCustomer(customer.id);

    const full = await this.findOneWithAllocations(saved.id);
    return { data: full };
  }

  async addAdjustment(paymentId: string, dto: CreatePaymentAdjustmentDto) {
    const payment = await this.payRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán');

    const delta = dto.amountAdjustment;
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('Số điều chỉnh phải khác 0');
    }

    await this.dataSource.transaction(async (manager) => {
      const base = moneyNum(payment.amount);
      const rawBefore = await manager
        .getRepository(DebtPaymentAdjustment)
        .createQueryBuilder('a')
        .select('COALESCE(SUM(a.amountAdjustment), 0)', 's')
        .where('a.paymentId = :id', { id: paymentId })
        .getRawOne<{ s: string }>();
      const currentActual = base + moneyNum(rawBefore?.s ?? '0');
      const newTarget = currentActual + delta;
      if (newTarget < -EPS) {
        throw new BadRequestException('Điều chỉnh làm số tiền hiệu lực âm');
      }

      const adj = manager.getRepository(DebtPaymentAdjustment).create({
        paymentId,
        amountAdjustment: moneyStr(delta),
        note: dto.note?.trim() || null,
      });
      await manager.getRepository(DebtPaymentAdjustment).save(adj);

      await this.reconcileAllocations(manager, paymentId);
    });

    await this.snapshots.refreshForCustomer(payment.customerId);

    const full = await this.findOneWithAllocations(paymentId);
    return { data: full };
  }
}
