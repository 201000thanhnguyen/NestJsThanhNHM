import type { DebtTransactionStatus } from './entities/transaction.entity';

export function moneyStr(value: number): string {
  return value.toFixed(2);
}

export function moneyNum(value: string | number): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function debtStatus(total: number, paid: number): DebtTransactionStatus {
  if (paid <= 0) return 'UNPAID';
  if (paid < total) return 'PARTIAL';
  return 'PAID';
}

const EPS = 0.0001;

export function moneyGreater(a: number, b: number): boolean {
  return a - b > EPS;
}

export function moneyLess(a: number, b: number): boolean {
  return b - a > EPS;
}

export function toDateOnlyString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
