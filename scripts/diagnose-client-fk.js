const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '72.61.246.66',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'swarajya_user',
    password: process.env.DB_PASSWORD || 'Swarajya@123',
    database: process.env.DB_NAME || 'swarajya_finance',
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map((t) => Object.values(t)[0]);
  console.log('TABLES:', tableNames.join(', '));

  const [fks] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME = 'clients'
  `);
  console.log('EXISTING_FKS:', JSON.stringify(fks, null, 2));

  const [cols] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'client_id'
    ORDER BY TABLE_NAME
  `);
  console.log('CLIENT_ID_COLS:', JSON.stringify(cols, null, 2));

  const [cc] = await conn.query('SELECT COUNT(*) AS c FROM clients');
  console.log('CLIENTS_TOTAL:', cc[0].c);

  for (const row of cols) {
    const table = row.TABLE_NAME;
    try {
      const [orphans] = await conn.query(`
        SELECT t.client_id, COUNT(*) AS cnt
        FROM \`${table}\` t
        LEFT JOIN clients c ON c.id = t.client_id
        WHERE t.client_id IS NOT NULL AND c.id IS NULL
        GROUP BY t.client_id
      `);
      const [total] = await conn.query(
        `SELECT COUNT(*) AS c FROM \`${table}\` WHERE client_id IS NOT NULL`,
      );
      console.log(
        `ORPHANS ${table}: total_with_client_id=${total[0].c} orphan_groups=${orphans.length}`,
        orphans.length ? JSON.stringify(orphans) : '',
      );
    } catch (e) {
      console.log(`SKIP ${table}:`, e.message);
    }
  }

  // Also look for pending FK name from error
  const [named] = await conn.query(`
    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = 'FK_dd673d32984313ed775d00684ba'
  `);
  console.log('NAMED_CONSTRAINT:', JSON.stringify(named));

  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
