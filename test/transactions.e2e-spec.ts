import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { TransactionsController } from '../src/transactions/transactions.controller';
import { Transaction } from '../src/transactions/transaction.entity';
import { TransactionsService } from '../src/transactions/transactions.service';

describe('Transactions API (e2e)', () => {
  let app: INestApplication<App>;
  let data: Transaction[] = [];
  let seq = 1;

  beforeEach(async () => {
    data = [];
    seq = 1;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(
              async ({
                order,
              }: {
                order?: { date?: 'ASC' | 'DESC'; id?: 'ASC' | 'DESC' };
              } = {}) => {
                const rows = [...data];
                if (order?.date === 'ASC') {
                  rows.sort(
                    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
                  );
                }
                return rows;
              },
            ),
            create: jest.fn((input: Partial<Transaction>) => input),
            save: jest.fn(async (input: Partial<Transaction>) => {
              const row = { ...(input as Transaction), id: seq++ };
              data.push(row);
              return row;
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/transactions', async () => {
    data.push({
      id: 1,
      date: '2026-04-01',
      amount: 1350000,
      type: 'attendance',
      period: '2026-04',
    });

    await request(app.getHttpServer())
      .get('/api/transactions')
      .expect(200)
      .expect({
        data: [
          {
            id: 'tx_1',
            date: '2026-04-01',
            amount: 1350000,
            type: 'attendance',
            period: '2026-04',
          },
        ],
      });
  });

  it('POST /api/transactions', async () => {
    await request(app.getHttpServer())
      .post('/api/transactions')
      .send({
        date: '2026-04-30',
        amount: -2000000,
        type: 'payment',
        period: null,
      })
      .expect(201)
      .expect({
        data: {
          id: 'tx_1',
          date: '2026-04-30',
          amount: -2000000,
          type: 'payment',
          period: null,
        },
      });
  });

  it('GET /api/transactions/summary', async () => {
    data.push(
      {
        id: 1,
        date: '2026-03-10',
        amount: 1000000,
        type: 'attendance',
        period: '2026-03',
      },
      {
        id: 2,
        date: '2026-04-10',
        amount: 1500000,
        type: 'attendance',
        period: '2026-04',
      },
      {
        id: 3,
        date: '2026-04-30',
        amount: -1200000,
        type: 'payment',
        period: null,
      },
    );

    const response = await request(app.getHttpServer())
      .get('/api/transactions/summary?period=2026-04')
      .expect(200);

    expect(response.body.data.monthly.period).toBe('2026-04');
    expect(response.body.data.monthly.allocatedPayment).toBe(200000);
    expect(response.body.data.globalUnpaid).toBe(1300000);
  });
});
