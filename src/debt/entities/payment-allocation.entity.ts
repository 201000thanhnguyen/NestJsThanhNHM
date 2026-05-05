import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('phan_bo_thanh_toan')
@Index('IDX_PBTT_PAYMENT', ['paymentId'])
@Index('IDX_PBTT_TRANSACTION', ['transactionId'])
export class DebtPaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'payment_id' })
  paymentId: string;

  @Column({ type: 'varchar', length: 36, name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
