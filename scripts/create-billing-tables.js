const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const sqlPath = path.join(__dirname, 'sql', 'create-billing-tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swarajya_1',
    multipleStatements: true,
  });
  await c.query(sql);
  console.log('billing_rate_configs table ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
