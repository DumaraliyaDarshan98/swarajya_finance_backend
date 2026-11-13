/**
 * Adds clients.subscription_plan_id if missing (login/joins fail without it).
 *   npm run fix:clients-subscription-plan
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

async function columnExists(
  ds: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await ds.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

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
  console.log(`DB: ${process.env.DB_NAME ?? 'swarajya_finance'}`);

  if (!(await tableExists(ds, 'clients'))) {
    throw new Error('Table clients does not exist');
  }

  if (await columnExists(ds, 'clients', 'subscription_plan_id')) {
    console.log('OK  clients.subscription_plan_id already exists');
  } else {
    await ds.query(`
      ALTER TABLE clients
        ADD COLUMN subscription_plan_id char(36) NULL
    `);
    console.log('ADD clients.subscription_plan_id');

    if (await tableExists(ds, 'subscription_plans')) {
      // Best-effort FK; ignore if plans table uses a different engine/id type.
      try {
        await ds.query(`
          ALTER TABLE clients
            ADD CONSTRAINT fk_clients_subscription_plan
            FOREIGN KEY (subscription_plan_id)
            REFERENCES subscription_plans(id)
            ON DELETE SET NULL
        `);
        console.log('ADD FK clients.subscription_plan_id -> subscription_plans.id');
      } catch (err: any) {
        console.warn(
          `Skip FK (non-fatal): ${err?.sqlMessage || err?.message || err}`,
        );
      }
    } else {
      console.warn('subscription_plans table missing — column added without FK');
    }
  }

  await ds.destroy();
  console.log('Done. Restart the backend and try login again.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
