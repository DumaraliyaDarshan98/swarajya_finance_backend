/**
 * Enable all RCU rows for OCR:
 * - rcu_triggers: is_active = true, used_in_ocr = true
 * - rcu_document_types: is_active = true, used_in_ocr = true
 * - rcu_categories: is_active = true, used_in_ocr = true
 *
 * Document types / categories are included so OCR lookup can match
 * and return the enabled triggers.
 *
 * Run: npm run enable:rcu-ocr
 *   or: npx ts-node -r tsconfig-paths/register scripts/enable-rcu-ocr-flags.ts
 */

import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

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

async function enableFlags(
  ds: DataSource,
  table: string,
): Promise<{ affected: number }> {
  const hasActive = await columnExists(ds, table, 'is_active');
  const hasOcr = await columnExists(ds, table, 'used_in_ocr');

  if (!hasActive && !hasOcr) {
    console.log(`Skip ${table}: missing is_active / used_in_ocr columns.`);
    return { affected: 0 };
  }

  const sets: string[] = [];
  if (hasActive) sets.push('`is_active` = 1');
  if (hasOcr) sets.push('`used_in_ocr` = 1');

  const result = await ds.query(`UPDATE \`${table}\` SET ${sets.join(', ')}`);
  // mysql2 returns ResultSetHeader; affectedRows may be on result or result[0]
  const affected =
    Number(
      (result as { affectedRows?: number })?.affectedRows ??
        (Array.isArray(result)
          ? (result[0] as { affectedRows?: number })?.affectedRows
          : 0) ??
        0,
    ) || 0;

  const countRows = await ds.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
  const total = Number(countRows?.[0]?.cnt ?? 0);

  console.log(
    `${table}: set is_active=true, used_in_ocr=true (${total} row(s)).`,
  );
  return { affected };
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
    console.log('Enabling all RCU categories / document types / triggers for OCR...\n');

    for (const table of [
      'rcu_categories',
      'rcu_document_types',
      'rcu_triggers',
    ] as const) {
      if (!(await tableExists(ds, table))) {
        console.log(`Skip ${table}: table not found.`);
        continue;
      }
      await enableFlags(ds, table);
    }

    console.log('\nDone. All existing RCU triggers are active and OCR-enabled.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}

run();
