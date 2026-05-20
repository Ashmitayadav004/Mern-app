require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./database');

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('Columns of users table:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
  } catch (err) {
    console.error('Error querying columns:', err);
  } finally {
    client.release();
    pool.end();
  }
}

check();
