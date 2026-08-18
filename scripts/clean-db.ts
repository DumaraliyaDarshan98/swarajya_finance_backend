/**
 * Wipe every table in the configured database.
 * Run from backend root: npm run db:clean
 *
 * Recreates tables on next `npm run start:dev` when TypeORM synchronize is on.
 */

import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

async function run() {
  const database = process.env.DB_NAME || 'swarajya_finance';
  const host = process.env.DB_HOST || 'localhost';

  const ds = new DataSource({
    type: (process.env.DB_TYPE as 'mysql') || 'mysql',
    connectorPackage: 'mysql2',
    host,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
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
    console.log(`Connected to ${database} @ ${host}`);

    const objects: Array<Record<string, string>> = await ds.query(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type
       FROM information_schema.tables
       WHERE table_schema = DATABASE()`,
    );

    if (!objects.length) {
      console.log('Database is already empty.');
      return;
    }

    await ds.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const row of objects) {
      const name = row.name ?? row.NAME ?? row.table_name ?? row.TABLE_NAME;
      const type = row.type ?? row.TYPE ?? row.table_type ?? row.TABLE_TYPE;
      if (!name) {
        console.warn('Skipped a row with no table name:', row);
        continue;
      }
      const isView = String(type).toUpperCase() === 'VIEW';
      if (isView) {
        await ds.query(`DROP VIEW IF EXISTS \`${name}\``);
        console.log(`Dropped view  ${name}`);
      } else {
        await ds.query(`DROP TABLE IF EXISTS \`${name}\``);
        console.log(`Dropped table ${name}`);
      }
    }

    await ds.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`Cleaned ${objects.length} object(s) from ${database}.`);
  } catch (err) {
    console.error('DB clean failed:', err);
    process.exitCode = 1;
  } finally {
    if (ds.isInitialized) await ds.destroy();
  } 
}

run();
