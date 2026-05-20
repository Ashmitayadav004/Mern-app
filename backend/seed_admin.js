  require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'recoverlab_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
  try {
    const password = 'Admin@1234';
    const hash = await bcrypt.hash(password, 12);

    // Upsert admin user
    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active)
       VALUES ('admin', 'admin@recoverlab.com', $1, 'System Administrator', 'admin', true)
       ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_active = true`,
      [hash]
    );
    console.log('✅ Admin user ready — username: admin / password: Admin@1234');

    // Fix superadmin password
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE username = 'superadmin' RETURNING username`,
      [hash]
    );
    if (result.rowCount > 0) {
      console.log('✅ Superadmin password reset — username: superadmin / password: Admin@1234');
    }

    // List all users
    const users = await pool.query('SELECT username, email, role, is_active FROM users ORDER BY created_at');
    console.log('\n--- All Users ---');
    users.rows.forEach(u => console.log(`  ${u.username} (${u.role}) — active: ${u.is_active}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
