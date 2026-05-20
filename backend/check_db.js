const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const p = new Pool({ host: 'localhost', port: 5432, database: 'recoverlab_crm', user: 'postgres', password: 'postgres' });

(async () => {
  // Find the super admin user - check both username and email
  const res = await p.query("SELECT id, username, email, role::text, is_active, password_hash FROM users WHERE username = 'superadmin' OR email = 'superadmin@recoverylab.com'");
  
  if (res.rows.length === 0) {
    console.log('User not found! Creating...');
    const hash = await bcrypt.hash('SuperAdmin@123', 12);
    await p.query(
      "INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES ('superadmin', 'superadmin@recoverylab.com', $1, 'Platform Super Admin', 'super_admin', true)",
      [hash]
    );
    console.log('Created user superadmin');
  } else {
    const user = res.rows[0];
    console.log('Found user:', JSON.stringify({ id: user.id, username: user.username, email: user.email, role: user.role, is_active: user.is_active }));
    
    // Test password
    const pwMatch = await bcrypt.compare('SuperAdmin@123', user.password_hash);
    console.log('Password match (SuperAdmin@123):', pwMatch);
    
    if (!pwMatch) {
      // Reset password
      const hash = await bcrypt.hash('SuperAdmin@123', 12);
      await p.query("UPDATE users SET password_hash=$1, is_active=true WHERE id=$2", [hash, user.id]);
      console.log('Password reset to SuperAdmin@123');
    }
    
    if (!user.is_active) {
      await p.query("UPDATE users SET is_active=true WHERE id=$1", [user.id]);
      console.log('User activated');
    }
  }
  
  // Also check if there's a tenant required for the super admin
  const tenants = await p.query("SELECT COUNT(*) as cnt FROM tenants");
  console.log('Tenant count:', tenants.rows[0].cnt);
  
  await p.end();
  console.log('Done.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
