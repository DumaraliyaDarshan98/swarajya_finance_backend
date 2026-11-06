/**
 * Creates departments / designations tables (if missing) and seeds defaults.
 *   npm run seed:hiring-masters
 *   npm run seed:hiring-masters -- --force
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const force = process.argv.includes('--force');

async function main() {
  const ds = new DataSource({
    type: (process.env.DB_TYPE as any) ?? 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'swarajya_finance',
    namingStrategy: new SnakeNamingStrategy(),
  });

  await ds.initialize();

  await ds.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id char(36) NOT NULL,
      name varchar(150) NOT NULL,
      description varchar(255) NULL,
      is_active tinyint NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_departments_name (name),
      KEY idx_departments_is_active (is_active)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS designations (
      id char(36) NOT NULL,
      name varchar(150) NOT NULL,
      description varchar(255) NULL,
      is_active tinyint NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_designations_name (name),
      KEY idx_designations_is_active (is_active)
    )
  `);

  // Drop legacy columns if an older seed/migration created them.
  for (const table of ['departments', 'designations']) {
    for (const col of ['code', 'sort_order']) {
      const rows = await ds.query(
        `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col],
      );
      if (Number(rows[0]?.c ?? 0) > 0) {
        await ds.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${col}\``);
        console.log(`Dropped ${table}.${col}`);
      }
    }
  }

  const deptCount = await ds.query(`SELECT COUNT(*) AS c FROM departments`);
  const desigCount = await ds.query(`SELECT COUNT(*) AS c FROM designations`);
  const hasDept = Number(deptCount[0]?.c ?? 0) > 0;
  const hasDesig = Number(desigCount[0]?.c ?? 0) > 0;

  if (force) {
    await ds.query(`DELETE FROM departments`);
    await ds.query(`DELETE FROM designations`);
  }

  if (force || !hasDept) {
    const departments = [
      ['Operations', 'Field and operations teams'],
      ['Engineering', 'Software and product engineering'],
      ['Human Resources', 'People and recruitment'],
      ['Finance', 'Accounts and finance'],
      ['Sales', 'Business development and sales'],
      ['Compliance', 'Risk and compliance'],
    ] as const;
    for (const [name, description] of departments) {
      await ds.query(
        `INSERT INTO departments (id, name, description, is_active)
         VALUES (?, ?, ?, 1)`,
        [randomUUID(), name, description],
      );
    }
    console.log(`Seeded ${departments.length} departments`);
  } else {
    console.log('Departments already present (pass --force to reseed)');
  }

  if (force || !hasDesig) {
    const designations = [
      ['Field Executive', 'On-ground verification executive'],
      ['Field Agent', 'Field agent role'],
      ['Software Engineer', 'Backend / frontend engineer'],
      ['Senior Software Engineer', 'Senior engineering role'],
      ['Team Lead', 'Team leadership'],
      ['Operations Manager', 'Operations leadership'],
      ['HR Executive', 'HR operations'],
      ['Business Analyst', 'Analysis and reporting'],
    ] as const;
    for (const [name, description] of designations) {
      await ds.query(
        `INSERT INTO designations (id, name, description, is_active)
         VALUES (?, ?, ?, 1)`,
        [randomUUID(), name, description],
      );
    }
    console.log(`Seeded ${designations.length} designations`);
  } else {
    console.log('Designations already present (pass --force to reseed)');
  }

  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
