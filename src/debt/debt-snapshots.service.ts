import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtSnapshot } from './entities/debt-snapshot.entity';
import { moneyStr } from './debt.utils';

@Injectable()
export class DebtSnapshotsService {
  constructor(
    @InjectRepository(DebtSnapshot)
    private readonly snapRepo: Repository<DebtSnapshot>,
  ) {}

  async refreshForCustomer(customerId: string) {
    const rows = await this.snapRepo.manager.query(
      `
      SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS debt
      FROM giao_dich
      WHERE customer_id = ?
      `,
      [customerId],
    ) as Array<{ debt: string }>;

    const debt = Number(rows[0]?.debt ?? 0);
    await this.snapRepo.upsert(
      { customerId, totalDebt: moneyStr(debt) },
      ['customerId'],
    );
  }
}
