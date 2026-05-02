import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('so_du_cong_no')
export class DebtSnapshot {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'customer_id' })
  customerId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_debt' })
  totalDebt: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
