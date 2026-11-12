const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '72.61.246.66',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'swarajya_user',
    password: process.env.DB_PASSWORD || 'Swarajya@123',
    database: process.env.DB_NAME || 'swarajya_finance',
  });

  const [clients] = await conn.query(
    'SELECT id, company_name, email FROM clients ORDER BY created_at ASC',
  );
  console.log('CLIENTS:', JSON.stringify(clients, null, 2));

  const [bad] = await conn.query(`
    SELECT id, client_id, status, created_at, customer_name
    FROM physical_verifications
    WHERE client_id IS NULL OR TRIM(client_id) = ''
       OR client_id NOT IN (SELECT id FROM clients)
  `);
  console.log('BAD_ROWS:', JSON.stringify(bad, null, 2));

  if (!clients.length) {
    console.error('No clients exist — cannot repair FK.');
    await conn.end();
    process.exit(1);
  }

  // Rows are from 2026-08-18 (same day as HDFC client). Use earliest client.
  const fallbackClientId = clients[0].id;
  console.log(
    `Assigning orphan rows → ${fallbackClientId} (${clients[0].company_name})`,
  );

  const [result] = await conn.query(
    `
    UPDATE physical_verifications
    SET client_id = ?
    WHERE client_id IS NULL OR TRIM(client_id) = ''
       OR client_id NOT IN (SELECT id FROM clients)
  `,
    [fallbackClientId],
  );
  console.log('UPDATED_ROWS:', result.affectedRows);

  const [orphans] = await conn.query(`
    SELECT t.id, t.client_id
    FROM physical_verifications t
    LEFT JOIN clients c ON c.id = t.client_id
    WHERE c.id IS NULL
  `);
  console.log('REMAINING_ORPHANS:', orphans.length, JSON.stringify(orphans));
  if (orphans.length) {
    await conn.end();
    process.exit(1);
  }

  const [existingFk] = await conn.query(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'physical_verifications'
      AND COLUMN_NAME = 'client_id'
      AND REFERENCED_TABLE_NAME = 'clients'
  `);
  console.log('EXISTING_PV_CLIENT_FK:', JSON.stringify(existingFk));

  if (!existingFk.length) {
    try {
      await conn.query(`
        ALTER TABLE physical_verifications
        ADD CONSTRAINT FK_dd673d32984313ed775d00684ba
        FOREIGN KEY (client_id) REFERENCES clients(id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
      `);
      console.log('FK_ADDED: FK_dd673d32984313ed775d00684ba');
    } catch (e) {
      console.log('FK_ADD_PRIMARY_FAILED:', e.code || '', e.message);
      await conn.query(`
        ALTER TABLE physical_verifications
        ADD CONSTRAINT fk_physical_verifications_client_id
        FOREIGN KEY (client_id) REFERENCES clients(id)
      `);
      console.log('FK_ADDED: fk_physical_verifications_client_id');
    }
  } else {
    console.log('FK already present — OK');
  }

  await conn.end();
  console.log('DONE — restart backend now (pm2 restart backend)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
