const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '72.61.246.66',
    user: process.env.DB_USERNAME || 'swarajya_user',
    password: process.env.DB_PASSWORD || 'Swarajya@123',
    database: process.env.DB_NAME || 'swarajya_finance',
  });
  const [rows] = await conn.query(`
    SELECT title, url, state
    FROM portals
    WHERE title LIKE '%GST%'
       OR title LIKE '%Who%'
       OR title LIKE '%pincode%'
       OR title LIKE '%PIN%'
       OR title LIKE '%Postal%'
       OR url LIKE '%knowyourgst%'
       OR url LIKE '%who.is%'
       OR url LIKE '%whois%'
       OR url LIKE '%postalpincode%'
       OR url LIKE '%gst.gov%'
    ORDER BY title
    LIMIT 40
  `);
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
