const { Pool } = require('pg');
const fs = require('fs');

const p = new Pool({ host: 'localhost', port: 5432, database: 'recoverlab_crm', user: 'postgres', password: 'postgres' });

(async () => {
  // Read and split schema by semicolons — run each statement individually
  const sql = fs.readFileSync('src/db/schema.sql', 'utf8');
  
  // Split by semicolons but preserve function bodies by tracking $$ blocks
  const statements = [];
  let current = '';
  let inDollarBlock = false;
  
  for (let i = 0; i < sql.length; i++) {
    current += sql[i];
    if (sql.substring(i, i+2) === '$$') {
      inDollarBlock = !inDollarBlock;
    }
    if (!inDollarBlock && sql[i] === ';') {
      const stmt = current.trim();
      if (stmt.length > 1) statements.push(stmt);
      current = '';
    }
  }
  
  let ok = 0, skipped = 0, failed = 0;
  for (const stmt of statements) {
    try {
      await p.query(stmt);
      ok++;
    } catch (e) {
      const msg = e.message;
      if (msg.includes('already exists') || msg.includes('does not exist')) {
        skipped++;
      } else {
        console.log('FAIL:', msg.substring(0, 80));
        failed++;
      }
    }
  }
  
  console.log(`Schema: ${ok} ok, ${skipped} skipped (already exists), ${failed} failed`);
  
  // Check what tables now exist
  const tables = await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));
  
  // Check tenants table
  try {
    const t = await p.query('SELECT COUNT(*) as cnt FROM tenants');
    console.log('Tenants count:', t.rows[0].cnt);
  } catch(e) {
    console.log('Tenants table error:', e.message);
  }
  
  await p.end();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
