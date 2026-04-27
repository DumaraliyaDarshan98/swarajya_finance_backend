import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Align `super_admin_settings` table schema with the current entity:
 * - key/value based rows (generic settings).
 *
 * The initial migration created a different schema; since this project uses
 * `synchronize: true` as well, we still add an explicit migration so new
 * environments are consistent and seed defaults.
 */
export class FixSuperAdminSettingsSchemaAndSeed1731792001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('super_admin_settings');

    // If table doesn't exist, create it in the expected schema.
    if (!table) {
      await queryRunner.createTable(
        new Table({
          name: 'super_admin_settings',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'key', type: 'varchar', length: '100', isUnique: true },
            { name: 'value', type: 'varchar', length: '255' },
            {
              name: 'description',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'category',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            { name: 'status', type: 'boolean', default: true },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
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
    } else {
      // If the old schema exists (max_client_users columns etc.), replace it.
      const hasKeyColumn = table.columns.some((c) => c.name === 'key');
      if (!hasKeyColumn) {
        await queryRunner.dropTable('super_admin_settings', true);
        await queryRunner.createTable(
          new Table({
            name: 'super_admin_settings',
            columns: [
              {
                name: 'id',
                type: 'int',
                isPrimary: true,
                isGenerated: true,
                generationStrategy: 'increment',
              },
              { name: 'key', type: 'varchar', length: '100', isUnique: true },
              { name: 'value', type: 'varchar', length: '255' },
              {
                name: 'description',
                type: 'varchar',
                length: '255',
                isNullable: true,
              },
              {
                name: 'category',
                type: 'varchar',
                length: '100',
                isNullable: true,
              },
              { name: 'status', type: 'boolean', default: true },
              {
                name: 'created_at',
                type: 'timestamp',
                default: 'CURRENT_TIMESTAMP',
              },
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
      }
    }

    // Seed defaults if missing.
    await queryRunner.query(
      `
      INSERT INTO super_admin_settings (\`key\`, \`value\`, \`description\`, \`category\`, \`status\`)
      SELECT 'PHYSICAL_VERIFICATION_PRICE', '50', 'Physical verification request price (INR)', 'Verification', true
      WHERE NOT EXISTS (SELECT 1 FROM super_admin_settings WHERE \`key\` = 'PHYSICAL_VERIFICATION_PRICE');
    `,
    );
    await queryRunner.query(
      `
      INSERT INTO super_admin_settings (\`key\`, \`value\`, \`description\`, \`category\`, \`status\`)
      SELECT 'MAX_CLIENT_USERS', '', 'Maximum client users allowed per client (blank = unlimited)', 'System', false
      WHERE NOT EXISTS (SELECT 1 FROM super_admin_settings WHERE \`key\` = 'MAX_CLIENT_USERS');
    `,
    );
    await queryRunner.query(
      `
      INSERT INTO super_admin_settings (\`key\`, \`value\`, \`description\`, \`category\`, \`status\`)
      SELECT 'SEND_EMAIL_NOTIFICATIONS', 'false', 'Send system notifications via email', 'Notification', false
      WHERE NOT EXISTS (SELECT 1 FROM super_admin_settings WHERE \`key\` = 'SEND_EMAIL_NOTIFICATIONS');
    `,
    );
    await queryRunner.query(
      `
      INSERT INTO super_admin_settings (\`key\`, \`value\`, \`description\`, \`category\`, \`status\`)
      SELECT 'SEND_SMS_NOTIFICATIONS', 'false', 'Send system notifications via SMS', 'Notification', false
      WHERE NOT EXISTS (SELECT 1 FROM super_admin_settings WHERE \`key\` = 'SEND_SMS_NOTIFICATIONS');
    `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep it simple: remove only the seeded price key.
    await queryRunner.query(
      `DELETE FROM super_admin_settings WHERE \`key\` IN ('PHYSICAL_VERIFICATION_PRICE')`,
    );
  }
}

