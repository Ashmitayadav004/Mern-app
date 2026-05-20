// Migration: Add new inventory fields
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'data_recovery_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔧 Running inventory schema migration…');

    const columns = [
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS stock_number VARCHAR(100)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS company VARCHAR(100)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS brand VARCHAR(100)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS model VARCHAR(200)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS firmware VARCHAR(100)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS site_code VARCHAR(100)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS date_code VARCHAR(50)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS head_map VARCHAR(200)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS family VARCHAR(100)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS capacity VARCHAR(50)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS interface VARCHAR(50)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS form_factor VARCHAR(50)",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'available'",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS source_case_id INTEGER",
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
      // Update existing rows to have default tenant_id=1 and stock_number from sku
      "UPDATE inventory_items SET tenant_id=1 WHERE tenant_id IS NULL",
      "UPDATE inventory_items SET stock_number=sku WHERE stock_number IS NULL",
      "UPDATE inventory_items SET status='available' WHERE status IS NULL",
      // Create index for faster searches
      "CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id)",
      "CREATE INDEX IF NOT EXISTS idx_inventory_stock_number ON inventory_items(stock_number)",
      "CREATE INDEX IF NOT EXISTS idx_inventory_pcb ON inventory_items(pcb_number)",
      "CREATE INDEX IF NOT EXISTS idx_inventory_serial ON inventory_items(serial_number)",
    ];

    for (const sql of columns) {
      try {
        await client.query(sql);
        console.log('  ✅', sql.substring(0, 60) + '…');
      } catch (err) {
        console.log('  ⚠️  Skipped (may already exist):', err.message.substring(0, 80));
      }
    }

    console.log('\n✅ Inventory migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error('❌ Migration failed:', err.message); process.exit(1); });
