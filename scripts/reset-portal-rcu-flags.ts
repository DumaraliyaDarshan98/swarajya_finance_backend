/**
 * Reset flag defaults on existing portal / RCU rows.
 * - portals.used_in_digital_report = false
 * - rcu_document_types.used_in_ocr = false
 * - rcu_triggers.used_in_ocr = false
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/reset-portal-rcu-flags.ts
 */

import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

async function columnExists(
  ds: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await ds.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function run() {
  const ds = new DataSource({
    type: (process.env.DB_TYPE as any) || 'mysql',
    connectorPackage: 'mysql2',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swarajya_finance',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
    ssl:
      process.env.DB_SSL === 'false'
        ? undefined
        : { rejectUnauthorized: false },
  } as any);

  try {
    await ds.initialize();
    console.log('Database connected.');

    if (await tableExists(ds, 'portals')) {
      if (!(await columnExists(ds, 'portals', 'used_in_digital_report'))) {
        await ds.query(
          `ALTER TABLE \`portals\`
           ADD COLUMN \`used_in_digital_report\` tinyint NOT NULL DEFAULT 0`,
        );
        console.log('Added portals.used_in_digital_report');
      }
      await ds.query('UPDATE `portals` SET `used_in_digital_report` = 0');
      console.log('Portals Digital Report flag reset to false.');
    }

    if (await tableExists(ds, 'portal_categories')) {
      if (!(await columnExists(ds, 'portal_categories', 'used_in_digital_report'))) {
        await ds.query(
          `ALTER TABLE \`portal_categories\`
           ADD COLUMN \`used_in_digital_report\` tinyint NOT NULL DEFAULT 0`,
        );
        console.log('Added portal_categories.used_in_digital_report');
      }
      await ds.query(
        'UPDATE `portal_categories` SET `used_in_digital_report` = 0',
      );
      console.log('Portal categories Digital Report flag reset to false.');
    }

    if (await tableExists(ds, 'rcu_document_types')) {
      await ds.query('UPDATE `rcu_document_types` SET `used_in_ocr` = 0');
      console.log('RCU document types usedInOcr reset to false.');
    }

    if (await tableExists(ds, 'rcu_triggers')) {
      await ds.query('UPDATE `rcu_triggers` SET `used_in_ocr` = 0');
      console.log('RCU triggers usedInOcr reset to false.');
    }

    if (await tableExists(ds, 'rcu_categories')) {
      if (!(await columnExists(ds, 'rcu_categories', 'used_in_ocr'))) {
        await ds.query(
          `ALTER TABLE \`rcu_categories\`
           ADD COLUMN \`used_in_ocr\` tinyint NOT NULL DEFAULT 0`,
        );
        console.log('Added rcu_categories.used_in_ocr');
      }
      await ds.query('UPDATE `rcu_categories` SET `used_in_ocr` = 0');
      console.log('RCU categories usedInOcr reset to false.');
    }

    console.log('Done.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}

run();
