import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DebtTransactionStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

@Entity('giao_dich')
@Index('IDX_GD_CUSTOMER', ['customerId'])
@Index('IDX_GD_STATUS', ['status'])
export class DebtTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 255, name: 'customer_name_snapshot' })
  customerNameSnapshot: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_amount' })
  totalAmount: string;

  /** Amount paid immediately at creation time (recorded as a payment too). */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    name: 'prepaid_amount',
  })
  prepaidAmount: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    name: 'paid_amount',
  })
  paidAmount: string;

  @Column({ type: 'varchar', length: 20 })
  status: DebtTransactionStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Business date chosen by user (not the same as createdAt). */
  @Column({ type: 'date', name: 'transaction_date', nullable: true })
  transactionDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
