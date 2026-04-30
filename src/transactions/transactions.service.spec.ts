import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { TransactionsService } from './transactions.service';
import { Attendance } from '../attendance/attendance.entity';
import { Shift } from '../shifts/shift.entity';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let data: Transaction[];
  let seq: number;

  beforeEach(async () => {
    data = [];
    seq = 1;

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(async () => [...data]),
            create: jest.fn((input: Partial<Transaction>) => input),
            save: jest.fn(async (input: Partial<Transaction>) => {
              if (!input.id) {
                const tx = { ...input, id: seq++ } as Transaction;
                data.push(tx);
                return tx;
              }
              const idx = data.findIndex((item) => item.id === input.id);
              if (idx >= 0) {
                data[idx] = { ...data[idx], ...input } as Transaction;
                return data[idx];
              }
              const tx = input as Transaction;
              data.push(tx);
              return tx;
            }),
          },
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: {
            find: jest.fn(async () => []),
          },
        },
        {
          provide: getRepositoryToken(Shift),
          useValue: {
            findBy: jest.fn(async () => []),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TransactionsService);
  });

  it('validates POST payment sign', async () => {
    await expect(
      service.create({
        date: '2026-04-30',
        amount: 2000000,
        type: 'payment',
        period: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates monthly summary', async () => {
    data.push(
      { id: 1, date: '2026-04-01', amount: 1000000, type: 'attendance', period: '2026-04' },
      { id: 2, date: '2026-04-02', amount: 200000, type: 'bonus', period: '2026-04' },
      { id: 3, date: '2026-04-03', amount: -100000, type: 'penalty', period: '2026-04' },
      { id: 4, date: '2026-04-30', amount: -500000, type: 'payment', period: '2026-04' },
    );

    const result = await service.getSummary('2026-04');
    expect(result.data.monthly.earned).toBe(1100000);
    expect(result.data.monthly.periodPayment).toBe(500000);
    expect(result.data.monthly.unpaid).toBe(600000);
  });

  it('applies FIFO across multiple months', async () => {
    data.push(
      { id: 1, date: '2026-03-10', amount: 1000000, type: 'attendance', period: '2026-03' },
      { id: 2, date: '2026-04-10', amount: 1500000, type: 'attendance', period: '2026-04' },
      { id: 3, date: '2026-04-30', amount: -1200000, type: 'payment', period: null },
    );

    const mar = await service.getSummary('2026-03');
    const apr = await service.getSummary('2026-04');

    expect(mar.data.monthly.allocatedPayment).toBe(1000000);
    expect(mar.data.monthly.unpaid).toBe(0);
    expect(apr.data.monthly.allocatedPayment).toBe(200000);
    expect(apr.data.monthly.unpaid).toBe(1300000);
  });

  it('handles overpayment', async () => {
    data.push(
      { id: 1, date: '2026-03-10', amount: 500000, type: 'attendance', period: '2026-03' },
      { id: 2, date: '2026-03-30', amount: -1000000, type: 'payment', period: null },
    );

    const result = await service.getSummary('2026-03');
    expect(result.data.monthly.unpaid).toBe(0);
    expect(result.data.globalUnpaid).toBe(0);
  });
});
