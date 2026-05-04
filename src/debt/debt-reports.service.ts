import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { moneyNum } from './debt.utils';

export type CustomerDebtRow = {
  customerId: string;
  customerNameSnapshot: string;
  debt: string;
};

export type TimelineEntry =
  | {
      kind: 'transaction';
      id: string;
      transactionDate: string;
      createdAt: string;
      totalAmount: string;
      paidAmount: string;
      status: string;
      note: string | null;
      runningDebt: string;
    }
  | {
      kind: 'payment';
      id: string;
      paymentDate: string;
      createdAt: string;
      amount: string;
      actualAmount: string;
      note: string | null;
      runningDebt: string;
    };

@Injectable()
export class DebtReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async report(fromDate?: string, toDate?: string): Promise<{
    data: Array<{
      transactionId: string;
      transactionDate: string;
      createdAt: string;
      customerId: string;
      customerName: string;
      totalAmount: string;
      paidAmountAtThatTime: string;
      remainingDebt: string;
      items: Array<{
        id: string;
        productNameSnapshot: string;
        quantity: number;
        priceSnapshot: string;
        subtotal: string;
      }>;
    }>;
  }> {
    const where: string[] = [];
    const params: Array<string> = [];

    if (fromDate?.trim()) {
      where.push('COALESCE(t.transaction_date, DATE(t.created_at)) >= ?');
      params.push(fromDate.trim());
    }
    if (toDate?.trim()) {
      where.push('COALESCE(t.transaction_date, DATE(t.created_at)) <= ?');
      params.push(toDate.trim());
    }

    const txs = (await this.dataSource.query(
      `
      SELECT
        t.id AS transactionId,
        COALESCE(t.transaction_date, DATE(t.created_at)) AS transactionDate,
        t.created_at AS createdAt,
        t.customer_id AS customerId,
        t.customer_name_snapshot AS customerName,
        (
          SELECT COALESCE(SUM(CAST(p.amount AS DECIMAL(14,2))), 0)
          FROM thanh_toan p
          WHERE p.customer_id = t.customer_id
            AND p.created_at <= t.created_at
        ) AS paidAmountAtThatTime,
        (
          SELECT COALESCE(SUM(CAST(i.subtotal AS DECIMAL(14,2))), 0)
          FROM giao_dich_san_pham i
          WHERE i.transaction_id = t.id
        ) AS totalAmount
      FROM giao_dich t
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(t.transaction_date, DATE(t.created_at)) ASC, t.created_at ASC
      `,
      params,
    )) as Array<{
      transactionId: string;
      transactionDate: Date | string;
      createdAt: Date;
      customerId: string;
      customerName: string;
      totalAmount: string;
      paidAmountAtThatTime: string;
    }>;

    const ids = txs.map((t) => t.transactionId);

    const items = ids.length
      ? ((await this.dataSource.query(
          `
          SELECT
            id,
            transaction_id AS transactionId,
            product_name_snapshot AS productNameSnapshot,
            quantity,
            price_snapshot AS priceSnapshot,
            subtotal
          FROM giao_dich_san_pham
          WHERE transaction_id IN (?)
          ORDER BY transaction_id ASC, id ASC
          `,
          [ids],
        )) as Array<{
          id: string;
          transactionId: string;
          productNameSnapshot: string;
          quantity: number;
          priceSnapshot: string;
          subtotal: string;
        }>)
      : [];

    const byTx = new Map<string, typeof items>();
    for (const it of items) {
      const arr = byTx.get(it.transactionId) ?? [];
      arr.push(it);
      byTx.set(it.transactionId, arr);
    }

    const toYmd = (v: Date | string) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).slice(0, 10);
    };
    const toIso = (v: Date) => (v instanceof Date ? v : new Date(v)).toISOString();

    const data = txs.map((t) => {
      const total = moneyNum(t.totalAmount);
      const paid = moneyNum(t.paidAmountAtThatTime);
      const remainingDebt = total - paid;
      return {
        transactionId: t.transactionId,
        transactionDate: toYmd(t.transactionDate),
        createdAt: toIso(t.createdAt),
        customerId: t.customerId,
        customerName: t.customerName,
        totalAmount: total.toFixed(2),
        paidAmountAtThatTime: paid.toFixed(2),
        remainingDebt: remainingDebt.toFixed(2),
        items: (byTx.get(t.transactionId) ?? []).map((it) => ({
          id: it.id,
          productNameSnapshot: it.productNameSnapshot,
          quantity: it.quantity,
          priceSnapshot: moneyNum(it.priceSnapshot).toFixed(2),
          subtotal: moneyNum(it.subtotal).toFixed(2),
        })),
      };
    });

    return { data };
  }

  async customerDebts(): Promise<{ data: CustomerDebtRow[] }> {
    const rows = await this.dataSource.query(
      `
      SELECT
        customer_id AS customerId,
        MAX(customer_name_snapshot) AS customerNameSnapshot,
        SUM(total_amount - paid_amount) AS debt
      FROM giao_dich
      GROUP BY customer_id
      HAVING SUM(total_amount - paid_amount) > 0.0001
      ORDER BY SUM(total_amount - paid_amount) DESC
      `,
    ) as CustomerDebtRow[];

    const normalized = rows.map((r) => ({
      ...r,
      debt: moneyNum(String(r.debt)).toFixed(2),
    }));

    return { data: normalized };
  }

  async timeline(customerId: string): Promise<{ data: TimelineEntry[] }> {
    const txs = (await this.dataSource.query(
      `
      SELECT id,
        COALESCE(transaction_date, DATE(created_at)) AS transactionDate,
        created_at AS createdAt,
        total_amount AS totalAmount,
        paid_amount AS paidAmount,
        status,
        note
      FROM giao_dich
      WHERE customer_id = ?
      ORDER BY COALESCE(transaction_date, DATE(created_at)) DESC, created_at DESC
      `,
      [customerId],
    )) as Array<{
      id: string;
      transactionDate: Date | string;
      createdAt: Date;
      totalAmount: string;
      paidAmount: string;
      status: string;
      note: string | null;
    }>;

    const pays = (await this.dataSource.query(
      `
      SELECT p.id,
        COALESCE(p.payment_date, DATE(p.created_at)) AS paymentDate,
        p.created_at AS createdAt,
        p.amount AS amount,
        (CAST(p.amount AS DECIMAL(14,2)) + COALESCE((
          SELECT SUM(CAST(a.amount_adjustment AS DECIMAL(14,2)))
          FROM debt_payment_adjustment a
          WHERE a.payment_id = p.id
        ), 0)) AS actualAmount,
        p.note AS note
      FROM thanh_toan p
      WHERE p.customer_id = ?
      ORDER BY COALESCE(p.payment_date, DATE(p.created_at)) DESC, p.created_at DESC
      `,
      [customerId],
    )) as Array<{
      id: string;
      paymentDate: Date | string;
      createdAt: Date;
      amount: string;
      actualAmount: string;
      note: string | null;
    }>;

    const toYmd = (v: Date | string) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).slice(0, 10);
    };

    const toIso = (v: Date) => (v instanceof Date ? v : new Date(v)).toISOString();

    type Ev =
      | { kind: 'transaction'; row: (typeof txs)[0] }
      | { kind: 'payment'; row: (typeof pays)[0] };

    const evs: Ev[] = [
      ...txs.map((row) => ({ kind: 'transaction' as const, row })),
      ...pays.map((row) => ({ kind: 'payment' as const, row })),
    ];

    evs.sort((a, b) => {
      const da = a.kind === 'transaction' ? toYmd(a.row.transactionDate) : toYmd(a.row.paymentDate);
      const db = b.kind === 'transaction' ? toYmd(b.row.transactionDate) : toYmd(b.row.paymentDate);
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      const ta = new Date(a.row.createdAt).getTime();
      const tb = new Date(b.row.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      if (a.kind === b.kind) return 0;
      return a.kind === 'transaction' ? -1 : 1;
    });

    let running = 0;
    const out: TimelineEntry[] = [];

    for (const e of evs) {
      if (e.kind === 'transaction') {
        running += moneyNum(e.row.totalAmount);
        out.push({
          kind: 'transaction',
          id: e.row.id,
          transactionDate: toYmd(e.row.transactionDate),
          createdAt: toIso(e.row.createdAt),
          totalAmount: moneyNum(e.row.totalAmount).toFixed(2),
          paidAmount: moneyNum(e.row.paidAmount).toFixed(2),
          status: e.row.status,
          note: e.row.note,
          runningDebt: running.toFixed(2),
        });
      } else {
        const act = moneyNum(e.row.actualAmount);
        running -= act;
        out.push({
          kind: 'payment',
          id: e.row.id,
          paymentDate: toYmd(e.row.paymentDate),
          createdAt: toIso(e.row.createdAt),
          amount: moneyNum(e.row.amount).toFixed(2),
          actualAmount: act.toFixed(2),
          note: e.row.note,
          runningDebt: running.toFixed(2),
        });
      }
    }

    return { data: [...out].reverse() };
  }
}
