import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePhysicalVerificationAndWalletTables1731792002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add field agent auth columns to field_assistants
    const fa = await queryRunner.getTable('field_assistants');
    if (fa && !fa.columns.some((c) => c.name === 'login_email')) {
      await queryRunner.query(
        `ALTER TABLE field_assistants ADD COLUMN login_email varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE field_assistants ADD UNIQUE INDEX IDX_field_assistants_login_email (login_email)`,
      );
    }
    if (fa && !fa.columns.some((c) => c.name === 'password')) {
      await queryRunner.query(
        `ALTER TABLE field_assistants ADD COLUMN password varchar(255) NULL`,
      );
    }

    // physical_verification_requests
    const pvr = await queryRunner.getTable('physical_verification_requests');
    if (!pvr) {
      await queryRunner.createTable(
        new Table({
          name: 'physical_verification_requests',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'verification_request_id', type: 'uuid' },
            { name: 'client_id', type: 'uuid' },
            { name: 'assigned_field_assistant_id', type: 'uuid', isNullable: true },
            { name: 'status', type: 'varchar', length: '20', default: `'PENDING'` },
            { name: 'price_paise', type: 'int', default: 0 },
            { name: 'current_location', type: 'json', isNullable: true },
            { name: 'agent_comment', type: 'text', isNullable: true },
            { name: 'admin_comment', type: 'text', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'physical_verification_requests',
        new TableIndex({
          name: 'IDX_pvr_verification_request_id_unique',
          columnNames: ['verification_request_id'],
          isUnique: true,
        }),
      );
      await queryRunner.createIndex(
        'physical_verification_requests',
        new TableIndex({
          name: 'IDX_pvr_client_id',
          columnNames: ['client_id'],
        }),
      );
      await queryRunner.createIndex(
        'physical_verification_requests',
        new TableIndex({
          name: 'IDX_pvr_assigned_field_assistant_id',
          columnNames: ['assigned_field_assistant_id'],
        }),
      );
    }

    // physical_verification_status_history
    const hist = await queryRunner.getTable('physical_verification_status_history');
    if (!hist) {
      await queryRunner.createTable(
        new Table({
          name: 'physical_verification_status_history',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'request_id', type: 'uuid' },
            { name: 'from_status', type: 'varchar', length: '20', isNullable: true },
            { name: 'to_status', type: 'varchar', length: '20' },
            { name: 'comment', type: 'text', isNullable: true },
            { name: 'changed_by_role', type: 'varchar', length: '30' },
            { name: 'changed_by_id', type: 'uuid', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'physical_verification_status_history',
        new TableIndex({
          name: 'IDX_pvsh_request_id',
          columnNames: ['request_id'],
        }),
      );
    }

    // physical_verification_selfies
    const selfies = await queryRunner.getTable('physical_verification_selfies');
    if (!selfies) {
      await queryRunner.createTable(
        new Table({
          name: 'physical_verification_selfies',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'request_id', type: 'uuid' },
            { name: 'url', type: 'varchar', length: '500' },
            { name: 'file_name', type: 'varchar', length: '255', isNullable: true },
            { name: 'mime', type: 'varchar', length: '100', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'physical_verification_selfies',
        new TableIndex({ name: 'IDX_pvs_request_id', columnNames: ['request_id'] }),
      );
    }

    // field_agent_wallets
    const wallets = await queryRunner.getTable('field_agent_wallets');
    if (!wallets) {
      await queryRunner.createTable(
        new Table({
          name: 'field_agent_wallets',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'field_assistant_id', type: 'uuid' },
            { name: 'balance_paise', type: 'int', default: 0 },
            { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'field_agent_wallets',
        new TableIndex({
          name: 'IDX_faw_field_assistant_id_unique',
          columnNames: ['field_assistant_id'],
          isUnique: true,
        }),
      );
    }

    // field_agent_wallet_transactions
    const txns = await queryRunner.getTable('field_agent_wallet_transactions');
    if (!txns) {
      await queryRunner.createTable(
        new Table({
          name: 'field_agent_wallet_transactions',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'wallet_id', type: 'uuid' },
            { name: 'field_assistant_id', type: 'uuid' },
            { name: 'type', type: 'varchar', length: '10' },
            { name: 'amount_paise', type: 'int' },
            { name: 'reference_type', type: 'varchar', length: '30', isNullable: true },
            { name: 'reference_id', type: 'uuid', isNullable: true },
            { name: 'note', type: 'varchar', length: '255', isNullable: true },
            { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'field_agent_wallet_transactions',
        new TableIndex({ name: 'IDX_fawt_wallet_id', columnNames: ['wallet_id'] }),
      );
      await queryRunner.createIndex(
        'field_agent_wallet_transactions',
        new TableIndex({
          name: 'IDX_fawt_field_assistant_id',
          columnNames: ['field_assistant_id'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('field_agent_wallet_transactions', true);
    await queryRunner.dropTable('field_agent_wallets', true);
    await queryRunner.dropTable('physical_verification_selfies', true);
    await queryRunner.dropTable('physical_verification_status_history', true);
    await queryRunner.dropTable('physical_verification_requests', true);
  }
}

