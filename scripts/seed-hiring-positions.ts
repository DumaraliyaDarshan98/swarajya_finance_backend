/**
 * Creates hiring_positions + job_applications.hiring_position_id if missing.
 *   npm run seed:hiring-positions
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

async function columnExists(ds: DataSource, table: string, column: string) {
  const rows = await ds.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function tableExists(ds: DataSource, table: string) {
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
  console.log(`DB ${process.env.DB_NAME}`);

  if (!(await tableExists(ds, 'hiring_positions'))) {
    await ds.query(`
      CREATE TABLE hiring_positions (
        id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        title varchar(200) NOT NULL,
        department_id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
        designation_id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
        department_name varchar(150) NOT NULL,
        designation_name varchar(150) NOT NULL,
        description varchar(500) NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_hp_is_active (is_active),
        KEY idx_hp_department_id (department_id),
        KEY idx_hp_designation_id (designation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('CREATE hiring_positions');
  } else {
    console.log('OK hiring_positions exists');
  }

  if (await tableExists(ds, 'job_applications')) {
    if (!(await columnExists(ds, 'job_applications', 'hiring_position_id'))) {
      await ds.query(`
        ALTER TABLE job_applications
          ADD COLUMN hiring_position_id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
          ADD KEY idx_ja_hiring_position_id (hiring_position_id)
      `);
      console.log('ADD job_applications.hiring_position_id');
    } else {
      console.log('OK job_applications.hiring_position_id exists');
    }
  }

  await ds.destroy();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
