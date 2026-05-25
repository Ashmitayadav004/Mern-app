const { Pool } = require('pg');
const p = new Pool({ host: 'localhost', port: 5432, database: 'recoverlab_crm', user: 'postgres', password: 'Harsh@2607' });

(async () => {
  // Let's get the user engineer and senior_engineer
  const users = await p.query("SELECT id, username, email, role, permissions FROM users WHERE username IN ('engineer', 'john_eng')");
  for (const user of users.rows) {
    console.log(`\n=== USER: ${user.username} (role: ${user.role}) ===`);
    console.log('Custom Permissions column:', user.permissions);

    // Let's resolve the role's permissions
    // Wait, where are custom roles stored? platform_settings key = 'settings_roles'
    const settingsRolesResult = await p.query("SELECT value FROM platform_settings WHERE key = 'settings_roles'");
    const roles = settingsRolesResult.rows[0]?.value || [];
    console.log('Available custom roles keys:', roles.map(r => r.key));

    const matchedRole = roles.find(r => r.key === user.role);
    console.log('Matched Role Permissions from settings_roles:', matchedRole ? matchedRole.permissions : 'NONE');

    // How the backend currently resolves permissions in auth.js:
    let role_permissions = null;
    try {
      const q = await p.query(
        `SELECT r.permissions FROM admin_permissions r WHERE r.key = $1`,
        [user.role]
      );
      role_permissions = q.rows[0]?.permissions;
    } catch (e) {
      console.log('Query with key failed:', e.message);
    }
  }

  await p.end();
})().catch(console.error);
