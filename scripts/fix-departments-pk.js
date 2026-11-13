/**
 * Repairs departments/designations after TypeORM synchronize dropped `id`.
 * Keep DB_SYNCHRONIZE=false.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { randomUUID } = require('crypto');
const mysql = require('mysql2/promise');

async function rebuild(c, table) {
  console.log(`\n=== ${table} ===`);
  const [cols] = await c.query(`SHOW COLUMNS FROM \`${table}\``);
  const colNames = cols.map((x) => x.Field);
  console.log('before:', colNames.join(', '));

  const [data] = await c.query(
    `SELECT name, description, is_active, created_at, updated_at FROM \`${table}\``,
  );
  console.log(`rows: ${data.length}`);

  await c.query(`DROP TABLE IF EXISTS \`${table}\``);
  await c.query(`
    CREATE TABLE \`${table}\` (
      id char(36) NOT NULL,
      name varchar(150) NOT NULL,
      description varchar(255) NULL,
      is_active tinyint NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_${table}_name (name),
      KEY idx_${table}_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const row of data) {
    await c.query(
      `INSERT INTO \`${table}\` (id, name, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        row.name,
        row.description,
        row.is_active == null ? 1 : row.is_active,
        row.created_at || new Date(),
        row.updated_at || new Date(),
      ],
    );
  }

  // Seed defaults if empty
  if (data.length === 0) {
    const defaults =
      table === 'departments'
        ? [
            ['Operations', 'Field and operations teams'],
            ['Engineering', 'Software and product engineering'],
            ['Human Resources', 'People and recruitment'],
            ['Finance', 'Accounts and finance'],
            ['Sales', 'Business development and sales'],
            ['Compliance', 'Risk and compliance'],
          ]
        : [
            ['Field Executive', 'On-ground verification executive'],
            ['Field Agent', 'Field agent role'],
            ['Software Engineer', 'Backend / frontend engineer'],
            ['Senior Software Engineer', 'Senior engineering role'],
            ['Team Lead', 'Team leadership'],
            ['Operations Manager', 'Operations leadership'],
            ['HR Executive', 'HR operations'],
            ['Business Analyst', 'Analysis and reporting'],
          ];
    for (const [name, description] of defaults) {
      await c.query(
        `INSERT INTO \`${table}\` (id, name, description, is_active) VALUES (?, ?, ?, 1)`,
        [randomUUID(), name, description],
      );
    }
    console.log(`seeded ${defaults.length} default rows`);
  } else {
    console.log(`restored ${data.length} rows with new UUIDs`);
  }

  const [after] = await c.query(`SHOW COLUMNS FROM \`${table}\``);
  console.log(
    'after:',
    after.map((x) => `${x.Field}${x.Key ? '(' + x.Key + ')' : ''}`).join(', '),
  );
}

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  console.log(`DB ${process.env.DB_HOST}/${process.env.DB_NAME}`);
  await rebuild(c, 'departments');
  await rebuild(c, 'designations');
  await c.end();
  console.log('\nDone. Restart backend with DB_SYNCHRONIZE=false.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
