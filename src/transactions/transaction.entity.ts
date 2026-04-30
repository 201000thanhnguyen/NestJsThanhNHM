import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TransactionType =
  | 'attendance'
  | 'bonus'
  | 'advance'
  | 'penalty'
  | 'payment';

@Entity('transactions')
@Index('IDX_TRANSACTIONS_PERIOD', ['period'])
@Index('IDX_TRANSACTIONS_DATE', ['date'])
@Index('IDX_TRANSACTIONS_TYPE', ['type'])
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  type: TransactionType;

  @Column({ type: 'varchar', length: 7, nullable: true })
  period: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
