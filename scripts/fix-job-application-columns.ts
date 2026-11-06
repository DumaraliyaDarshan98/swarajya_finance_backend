/**
 * Adds hiring profile columns to job_applications if missing.
 *   npm run fix:job-application-columns
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'designation', ddl: 'varchar(150) NULL' },
  { name: 'department', ddl: 'varchar(150) NULL' },
  { name: 'location', ddl: 'varchar(150) NULL' },
  { name: 'city', ddl: 'varchar(100) NULL' },
  { name: 'state', ddl: 'varchar(100) NULL' },
  { name: 'pincode', ddl: 'varchar(12) NULL' },
  { name: 'full_address', ddl: 'text NULL' },
];

async function main() {
  const ds = new DataSource({
    type: (process.env.DB_TYPE as any) ?? 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'swarajya_finance',
    connectorPackage: 'mysql2',
    namingStrategy: new SnakeNamingStrategy(),
  });

  await ds.initialize();

  for (const col of COLUMNS) {
    const rows = await ds.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'job_applications'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (Number(rows[0]?.c ?? 0) > 0) {
      console.log(`OK  job_applications.${col.name} already exists`);
      continue;
    }
    await ds.query(
      `ALTER TABLE job_applications ADD COLUMN \`${col.name}\` ${col.ddl}`,
    );
    console.log(`ADD job_applications.${col.name}`);
  }

  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
