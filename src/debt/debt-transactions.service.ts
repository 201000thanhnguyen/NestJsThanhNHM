import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateDebtTransactionDto } from './dto/create-debt-transaction.dto';
import { DebtTransactionItem } from './entities/transaction-item.entity';
import { DebtTransaction } from './entities/transaction.entity';
import { DebtCustomersService } from './debt-customers.service';
import { DebtProductsService } from './debt-products.service';
import { moneyNum, moneyStr, toDateOnlyString } from './debt.utils';
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

    const transaction = this.txRepo.create({
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      totalAmount: moneyStr(total),
      paidAmount: moneyStr(0),
      status: 'UNPAID',
      note: dto.note?.trim() || null,
      transactionDate,
    });

    const savedTx = await this.txRepo.save(transaction);

    const rows = itemsToSave.map((row) =>
      this.itemRepo.create({
        ...row,
        transactionId: savedTx.id,
      }),
    );
    await this.itemRepo.save(rows);

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
