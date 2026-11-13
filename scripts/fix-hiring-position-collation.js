/**
 * Align UUID column collations so job_applications ⋈ hiring_positions joins work.
 *   node scripts/fix-hiring-position-collation.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  const [before] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME, COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND (
        (TABLE_NAME = 'job_applications' AND COLUMN_NAME IN ('id', 'hiring_position_id'))
        OR (TABLE_NAME = 'hiring_positions' AND COLUMN_NAME IN ('id', 'department_id', 'designation_id'))
        OR (TABLE_NAME = 'departments' AND COLUMN_NAME = 'id')
        OR (TABLE_NAME = 'designations' AND COLUMN_NAME = 'id')
      )
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log('Before:');
  console.table(before);

  // Prefer unicode_ci (used by older app tables); convert hiring_positions + FK to match job_applications.
  const target =
    before.find(
      (r) =>
        r.TABLE_NAME === 'job_applications' && r.COLUMN_NAME === 'hiring_position_id',
    )?.COLLATION_NAME ||
    before.find(
      (r) => r.TABLE_NAME === 'job_applications' && r.COLUMN_NAME === 'id',
    )?.COLLATION_NAME ||
    'utf8mb4_unicode_ci';

  console.log('Target collation:', target);

  // Drop FK if present so ALTER can change char collation.
  const [fks] = await conn.query(`
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'job_applications'
      AND COLUMN_NAME = 'hiring_position_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  for (const fk of fks) {
    await conn.query(
      `ALTER TABLE job_applications DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
    );
    console.log('Dropped FK', fk.CONSTRAINT_NAME);
  }

  // Keep department_id / designation_id on utf8mb4_0900_ai_ci to match departments/designations.
  await conn.query(`
    ALTER TABLE hiring_positions
      MODIFY COLUMN id char(36) CHARACTER SET utf8mb4 COLLATE ${target} NOT NULL
  `);
  console.log('Altered hiring_positions.id');

  await conn.query(`
    ALTER TABLE job_applications
      MODIFY COLUMN hiring_position_id char(36) CHARACTER SET utf8mb4 COLLATE ${target} NULL
  `);
  console.log('Altered job_applications.hiring_position_id');

  // Re-add FK if departments/designations match; hiring_position FK optional.
  try {
    await conn.query(`
      ALTER TABLE job_applications
        ADD CONSTRAINT fk_job_applications_hiring_position
        FOREIGN KEY (hiring_position_id) REFERENCES hiring_positions(id)
        ON DELETE SET NULL
    `);
    console.log('Re-added FK fk_job_applications_hiring_position');
  } catch (e) {
    console.warn('Skip FK recreate:', e.message);
  }

  const [after] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME, COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND (
        (TABLE_NAME = 'job_applications' AND COLUMN_NAME IN ('id', 'hiring_position_id'))
        OR (TABLE_NAME = 'hiring_positions' AND COLUMN_NAME IN ('id', 'department_id', 'designation_id'))
      )
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log('After:');
  console.table(after);

  await conn.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
