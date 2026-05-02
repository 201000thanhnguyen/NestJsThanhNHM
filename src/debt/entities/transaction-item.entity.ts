import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('giao_dich_san_pham')
@Index('IDX_GDSP_TRANSACTION', ['transactionId'])
export class DebtTransactionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'product_id' })
  productId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'product_name_snapshot' })
  productNameSnapshot: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'price_snapshot' })
  priceSnapshot: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    name: 'original_product_price',
  })
  originalProductPrice: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  subtotal: string;
}
