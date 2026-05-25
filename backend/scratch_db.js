const { Pool } = require('pg');
const p = new Pool({ host: 'localhost', port: 5432, database: 'recoverlab_crm', user: 'postgres', password: 'Harsh@2607' });

(async () => {
  const users = await p.query("SELECT id, username, email, role, is_active, permissions FROM users");
  console.log('--- USERS ---');
  console.log(JSON.stringify(users.rows, null, 2));

  try {
    const admin_perms = await p.query("SELECT * FROM admin_permissions");
    console.log('--- ADMIN PERMISSIONS ---');
    console.log(JSON.stringify(admin_perms.rows, null, 2));
  } catch (e) {
    console.log('Error reading admin_permissions:', e.message);
  }

  await p.end();
})().catch(console.error);
