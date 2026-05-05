import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('thanh_toan')
@Index('IDX_TT_CUSTOMER', ['customerId'])
export class DebtPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 255, name: 'customer_name_snapshot' })
  customerNameSnapshot: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Business date chosen by user. */
  @Column({ type: 'date', name: 'payment_date', nullable: true })
  paymentDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
