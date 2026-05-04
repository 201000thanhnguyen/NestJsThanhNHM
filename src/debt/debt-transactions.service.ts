import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CreateDebtTransactionDto } from './dto/create-debt-transaction.dto';
import { DebtTransactionItem } from './entities/transaction-item.entity';
import { DebtTransaction } from './entities/transaction.entity';
import { DebtCustomersService } from './debt-customers.service';
import { DebtProductsService } from './debt-products.service';
import { debtStatus, moneyNum, moneyStr, toDateOnlyString } from './debt.utils';
import { DebtSnapshotsService } from './debt-snapshots.service';

@Injectable()
export class DebtTransactionsService {
  constructor(
    @InjectRepository(DebtTransaction)
    private readonly txRepo: Repository<DebtTransaction>,
    @InjectRepository(DebtTransactionItem)
    private readonly itemRepo: Repository<DebtTransactionItem>,
    private readonly customers: DebtCustomersService,
    private readonly products: DebtProductsService,
    private readonly snapshots: DebtSnapshotsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateDebtTransactionDto) {
    const customer = await this.customers.assertExists(dto.customerId);

    const itemsToSave: Array<{
      productId: string | null;
      productNameSnapshot: string;
      priceSnapshot: string;
      originalProductPrice: string | null;
      quantity: number;
      subtotal: string;
    }> = [];

    let total = 0;

    for (const it of dto.items) {
      let originalProductPrice: string | null = null;
      if (it.productId) {
        const p = await this.products.findActiveById(it.productId);
        if (!p) {
          throw new NotFoundException(`Sản phẩm không hợp lệ: ${it.productId}`);
        }
        originalProductPrice =
          it.originalProductPrice !== undefined
            ? moneyStr(it.originalProductPrice)
            : p.defaultPrice;
      }

      const price = moneyStr(it.priceSnapshot);
      const sub = moneyNum(price) * it.quantity;
      total += sub;

      itemsToSave.push({
        productId: it.productId ?? null,
        productNameSnapshot: it.productNameSnapshot.trim(),
        priceSnapshot: price,
        originalProductPrice,
        quantity: it.quantity,
        subtotal: moneyStr(sub),
      });
    }

    const transactionDate = dto.transactionDate?.trim() || toDateOnlyString();
    const prepaid = dto.prepaidAmount ?? 0;
    if (!Number.isFinite(prepaid) || prepaid < 0) {
      throw new BadRequestException('Số tiền trả trước không hợp lệ');
    }
    if (prepaid - total > 0.0001) {
      throw new BadRequestException('Số tiền trả trước không được lớn hơn tổng tiền');
    }

    const savedTx = await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(DebtTransaction);
      const itemRepo = manager.getRepository(DebtTransactionItem);

      const transaction = txRepo.create({
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        totalAmount: moneyStr(total),
        prepaidAmount: moneyStr(prepaid),
        paidAmount: moneyStr(prepaid),
        status: debtStatus(total, prepaid),
        note: dto.note?.trim() || null,
        transactionDate,
      });

      const saved = await txRepo.save(transaction);

      const rows = itemsToSave.map((row) =>
        itemRepo.create({
          ...row,
          transactionId: saved.id,
        }),
      );
      await itemRepo.save(rows);

      if (prepaid > 0.0001) {
        // Create a payment record at the same created_at as the transaction so reports can treat it as "paid at that time".
        const paymentId = randomUUID();
        await manager.query(
          `
          INSERT INTO thanh_toan (id, customer_id, customer_name_snapshot, amount, note, payment_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            paymentId,
            customer.id,
            customer.name,
            moneyStr(prepaid),
            'Trả trước khi ghi nợ',
            transactionDate,
            saved.createdAt,
          ],
        );

        const allocId = randomUUID();
        await manager.query(
          `
          INSERT INTO phan_bo_thanh_toan (id, payment_id, transaction_id, amount, created_at)
          VALUES (?, ?, ?, ?, ?)
          `,
          [allocId, paymentId, saved.id, moneyStr(prepaid), saved.createdAt],
        );
      }

      return saved;
    });

    await this.snapshots.refreshForCustomer(customer.id);

    return this.findOne(savedTx.id);
  }

  async findAll(customerId?: string) {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .orderBy('t.transactionDate', 'DESC')
      .addOrderBy('t.createdAt', 'DESC');
    if (customerId) {
      qb.where('t.customerId = :customerId', { customerId });
    }
    const list = await qb.getMany();
    if (list.length === 0) {
      return { data: [] };
    }
    const ids = list.map((t) => t.id);
    const items = await this.itemRepo.find({
      where: { transactionId: In(ids) },
      order: { id: 'ASC' },
    });
    const byTx = new Map<string, DebtTransactionItem[]>();
    for (const it of items) {
      const arr = byTx.get(it.transactionId) ?? [];
      arr.push(it);
      byTx.set(it.transactionId, arr);
    }
    const data = list.map((t) => ({
      ...t,
      items: byTx.get(t.id) ?? [],
    }));
    return { data };
  }

  async findOne(id: string) {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Không tìm thấy giao dịch');

    const items = await this.itemRepo.find({
      where: { transactionId: id },
      order: { id: 'ASC' },
    });

    return { data: { ...tx, items } };
  }

}
