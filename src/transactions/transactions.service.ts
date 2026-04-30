import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction, TransactionType } from './transaction.entity';
import { Attendance } from '../attendance/attendance.entity';
import { Shift } from '../shifts/shift.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Shift)
    private shiftsRepository: Repository<Shift>,
  ) {}

  async findAll() {
    const items = await this.transactionsRepository.find({
      order: { date: 'ASC', id: 'ASC' },
    });
    return { data: items.map((item) => this.toResponse(item)) };
  }

  async create(body: CreateTransactionDto) {
    this.validateDate(body.date);
    this.validateAmountByType(body.type, body.amount);

    const period = body.period ?? null;
    this.validatePeriodByType(body.type, period);

    const created = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        date: body.date,
        amount: body.amount,
        type: body.type,
        period,
        title: body.title?.trim() || null,
        note: body.note?.trim() || null,
      }),
    );

    return { data: this.toResponse(created) };
  }

  async update(id: string, body: UpdateTransactionDto) {
    const numericId = this.parseTransactionId(id);
    const existing = await this.transactionsRepository.findOneBy({ id: numericId });
    if (!existing) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    const nextType = body.type ?? existing.type;
    const nextDate = body.date ?? existing.date;
    const nextAmount = body.amount ?? existing.amount;
    const nextPeriod =
      body.period !== undefined
        ? body.period
        : nextType === 'payment'
          ? null
          : nextDate.slice(0, 7);

    this.validateDate(nextDate);
    this.validateAmountByType(nextType, nextAmount);
    this.validatePeriodByType(nextType, nextPeriod ?? null);

    existing.type = nextType;
    existing.date = nextDate;
    existing.amount = nextAmount;
    existing.period = nextPeriod ?? null;

    if (body.title !== undefined) {
      existing.title = this.normalizeNullableText(body.title);
    }
    if (body.note !== undefined) {
      existing.note = this.normalizeNullableText(body.note);
    }

    const saved = await this.transactionsRepository.save(existing);
    return { data: this.toResponse(saved) };
  }

  async remove(id: string) {
    const numericId = this.parseTransactionId(id);
    const existing = await this.transactionsRepository.findOneBy({ id: numericId });
    if (!existing) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }
    await this.transactionsRepository.delete(numericId);
    return { data: { id } };
  }

  async getSummary(period: string) {
    this.validatePeriod(period);

    const dbTxs = await this.transactionsRepository.find({
      order: { date: 'ASC', id: 'ASC' },
    });
    const txs = await this.withDerivedAttendanceTransactions(dbTxs);

    const lifetimeSalary = txs
      .filter((tx) => tx.type !== 'payment')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const byPeriod = new Map<string, { earned: number; periodPayment: number }>();
    let fifoPool = 0;

    for (const tx of txs) {
      if (tx.type === 'payment') {
        if (tx.period === null) {
          fifoPool += Math.abs(tx.amount);
          continue;
        }
        const bucket = this.getOrInitPeriodBucket(byPeriod, tx.period);
        bucket.periodPayment += Math.abs(tx.amount);
        continue;
      }

      if (!tx.period) {
        continue;
      }
      const bucket = this.getOrInitPeriodBucket(byPeriod, tx.period);
      bucket.earned += tx.amount;
    }

    const periods = Array.from(byPeriod.keys()).sort();
    const monthlyBreakdown: Array<{ period: string; earned: number; paidTotal: number; unpaid: number }> = [];
    const allocatedByPeriod = new Map<string, number>();
    let fifoRemaining = fifoPool;

    for (const p of periods) {
      const bucket = byPeriod.get(p)!;
      const remainingBeforeFifo = bucket.earned - bucket.periodPayment;
      const need = Math.max(remainingBeforeFifo, 0);
      const allocated = Math.min(need, fifoRemaining);
      fifoRemaining -= allocated;
      allocatedByPeriod.set(p, allocated);

      const paidTotal = bucket.periodPayment + allocated;
      const unpaid = remainingBeforeFifo - allocated;

      monthlyBreakdown.push({
        period: p,
        earned: bucket.earned,
        paidTotal,
        unpaid,
      });
    }

    const selected = byPeriod.get(period) ?? { earned: 0, periodPayment: 0 };
    const allocatedPayment = allocatedByPeriod.get(period) ?? 0;
    const attendance = this.sumTypeByPeriod(txs, period, 'attendance');
    const bonus = this.sumTypeByPeriod(txs, period, 'bonus');
    const advance = this.sumTypeByPeriod(txs, period, 'advance');
    const penalty = this.sumTypeByPeriod(txs, period, 'penalty');
    const earned = attendance + bonus + advance + penalty;
    const periodPayment = selected.periodPayment;
    const paidTotal = periodPayment + allocatedPayment;
    const unpaid = earned - paidTotal;

    const globalUnpaid = monthlyBreakdown.reduce((sum, row) => sum + row.unpaid, 0);
    const paymentHistory = txs
      .filter((tx) => tx.type === 'payment')
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .map((tx) => this.toResponse(tx));

    return {
      data: {
        lifetimeSalary,
        globalUnpaid,
        monthly: {
          period,
          attendance,
          bonus,
          advance,
          penalty,
          earned,
          periodPayment,
          allocatedPayment,
          paidTotal,
          unpaid,
        },
        monthlyBreakdown,
        paymentHistory,
      },
    };
  }

  private validateAmountByType(type: TransactionType, amount: number) {
    const positiveTypes: TransactionType[] = ['attendance', 'bonus'];
    const negativeTypes: TransactionType[] = ['advance', 'penalty', 'payment'];

    if (positiveTypes.includes(type) && amount < 0) {
      throw new BadRequestException(`${type} amount must be >= 0`);
    }

    if (negativeTypes.includes(type) && amount > 0) {
      throw new BadRequestException(`${type} amount must be <= 0`);
    }
  }

  private validatePeriodByType(type: TransactionType, period: string | null) {
    if (type === 'payment' && period !== null) {
      throw new BadRequestException('payment transaction requires period = null');
    }

    if (type !== 'payment' && period === null) {
      throw new BadRequestException(`${type} transaction requires period`);
    }
  }

  private validatePeriod(period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('period must match format YYYY-MM');
    }
  }

  private validateDate(date: string) {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('date is invalid');
    }
  }

  private parseTransactionId(id: string): number {
    const normalized = id.startsWith('tx_') ? id.slice(3) : id;
    const numericId = Number(normalized);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException('id is invalid');
    }

    return numericId;
  }

  private normalizeNullableText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toResponse(transaction: Transaction) {
    return {
      id: `tx_${transaction.id}`,
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      period: transaction.period,
      title: transaction.title,
      note: transaction.note,
    };
  }

  private getOrInitPeriodBucket(
    map: Map<string, { earned: number; periodPayment: number }>,
    period: string,
  ) {
    const existing = map.get(period);
    if (existing) {
      return existing;
    }
    const created = { earned: 0, periodPayment: 0 };
    map.set(period, created);
    return created;
  }

  private sumTypeByPeriod(txs: Transaction[], period: string, type: TransactionType) {
    return txs
      .filter((tx) => tx.period === period && tx.type === type)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  private async withDerivedAttendanceTransactions(txs: Transaction[]) {
    const attendanceDates = new Set(
      txs.filter((tx) => tx.type === 'attendance').map((tx) => tx.date),
    );

    const attendanceRows = await this.attendanceRepository.find({
      order: { date: 'ASC', id: 'ASC' },
    });
    const missingRows = attendanceRows.filter(
      (row) => row.shiftIds.length > 0 && !attendanceDates.has(row.date),
    );
    if (missingRows.length === 0) {
      return txs;
    }

    const shiftIds = Array.from(
      new Set(missingRows.flatMap((row) => row.shiftIds)),
    );
    const shifts =
      shiftIds.length > 0
        ? await this.shiftsRepository.findBy({ id: In(shiftIds) })
        : [];
    const salaryByShiftId = new Map(shifts.map((shift) => [shift.id, shift.salary]));

    const derived = missingRows.map((row, idx) => {
      const amount = row.shiftIds.reduce(
        (sum, shiftId) => sum + (salaryByShiftId.get(shiftId) ?? 0),
        0,
      );
      return {
        id: -1 - idx,
        date: row.date,
        amount,
        type: 'attendance' as const,
        period: row.date.slice(0, 7),
      } as Transaction;
    });

    return [...txs, ...derived].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id - b.id,
    );
  }
}
