import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('debt_payment_adjustment')
@Index('IDX_DPA_PAYMENT', ['paymentId'])
export class DebtPaymentAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'payment_id' })
  paymentId: string;

  /** Positive = customer pays more; negative = clawback / refund portion. */
  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'amount_adjustment' })
  amountAdjustment: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
