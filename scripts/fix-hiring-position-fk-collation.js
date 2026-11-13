require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await c.query(`
    ALTER TABLE hiring_positions
      MODIFY COLUMN department_id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
      MODIFY COLUMN designation_id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL
  `);

  const [rows] = await c.query(`
    SELECT COLUMN_NAME, COLLATION_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hiring_positions'
      AND COLUMN_NAME IN ('id', 'department_id', 'designation_id')
  `);
  console.table(rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
