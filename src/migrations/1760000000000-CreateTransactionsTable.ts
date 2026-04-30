import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTransactionsTable1760000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('transactions');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'transactions',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'date',
              type: 'varchar',
              length: '10',
              isNullable: false,
            },
            {
              name: 'amount',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'type',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'period',
              type: 'varchar',
              length: '7',
              isNullable: true,
            },
          ],
        }),
      );
    }

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_PERIOD',
        columnNames: ['period'],
      }),
    );
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_DATE',
        columnNames: ['date'],
      }),
    );
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_TYPE',
        columnNames: ['type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_TYPE');
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_DATE');
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_PERIOD');
    await queryRunner.dropTable('transactions', true);
  }
}
