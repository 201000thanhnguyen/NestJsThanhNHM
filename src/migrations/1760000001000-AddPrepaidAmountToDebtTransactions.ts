import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPrepaidAmountToDebtTransactions1760000001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('giao_dich');
    if (!table) return;
    const has = table.columns.some((c) => c.name === 'prepaid_amount');
    if (has) return;

    await queryRunner.addColumn(
      'giao_dich',
      new TableColumn({
        name: 'prepaid_amount',
        type: 'decimal',
        precision: 14,
        scale: 2,
        isNullable: false,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('giao_dich');
    if (!table) return;
    const has = table.columns.some((c) => c.name === 'prepaid_amount');
    if (!has) return;
    await queryRunner.dropColumn('giao_dich', 'prepaid_amount');
  }
}
