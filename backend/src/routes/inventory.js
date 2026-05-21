const express = require('express');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticate, requireMinRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/inventory ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page=1, limit=40, category, search, is_available, storage_model_id } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const conditions = [];
    const params = [];
    let pi = 1;

    if (category) { conditions.push(`ii.category = $${pi++}`); params.push(category); }
    if (is_available !== undefined) { conditions.push(`ii.is_available = $${pi++}`); params.push(is_available === 'true'); }
    if (storage_model_id) { conditions.push(`ii.storage_model_id = $${pi++}`); params.push(storage_model_id); }
    if (search) {
      conditions.push(`(
        ii.name ILIKE $${pi} OR ii.sku ILIKE $${pi}
        OR ii.serial_number ILIKE $${pi} OR ii.pcb_number ILIKE $${pi}
        OR ii.description ILIKE $${pi}
      )`);
      params.push(`%${search}%`);
      pi++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const count = await query(`SELECT COUNT(*) FROM inventory_items ii ${where}`, params);
    const result = await query(
      `SELECT ii.* FROM inventory_items ii ${where} ORDER BY ii.created_at DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), offset]
    );

    const lowStock = result.rows.filter(i => i.quantity <= (i.min_quantity || 1));

    res.json({
      items: result.rows,
      lowStockAlerts: lowStock.length,
      pagination: {
        total: parseInt(count.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(count.rows[0].count) / parseInt(limit)),
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/inventory ─────────────────────────────────────────────────────
router.post('/', requireMinRole('junior_engineer'), auditLog('create_inventory', 'inventory'), async (req, res) => {
  try {
    const {
      name, category, serial_number, pcb_number, head_map,
      description, quantity, min_quantity, unit_cost, location,
      condition, notes, reserved_for_case, storage_model_id,
      firmware_version,
    } = req.body;

    // Map frontend categories to valid enum values
    const categoryMap = {
      'wd_35': 'donor_drive', 'wd_25': 'donor_drive',
      'seagate_35': 'donor_drive', 'seagate_25': 'donor_drive',
      'others_35': 'donor_drive', 'others_25': 'donor_drive',
      'ssd': 'donor_drive', 'pcb': 'spare_part', 'phone': 'spare_part',
    };
    const mappedCategory = categoryMap[category] || 'spare_part';

    // Auto-generate SKU if not provided
    const skuResult = await query('SELECT COUNT(*) FROM inventory_items', []);
    const sku = `INV-${String(parseInt(skuResult.rows[0].count)+1).padStart(5,'0')}`;
    const itemName = name || `Item ${sku}`;

    const result = await query(
      `INSERT INTO inventory_items (
        sku, name, category, serial_number, pcb_number, head_map,
        storage_model_id, description, quantity, min_quantity, unit_cost, location,
        condition, notes, reserved_for_case, firmware_version, added_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        sku, itemName, mappedCategory,
        serial_number||null, pcb_number||null, head_map||null,
        storage_model_id||null, description||null,
        parseInt(quantity)||0, parseInt(min_quantity)||1,
        unit_cost||null, location||null,
        condition||'used', notes||null,
        reserved_for_case||null, firmware_version||null, req.user.id
      ]
    );

    if ((parseInt(quantity)||0) > 0) {
      try {
        await query(
          `INSERT INTO inventory_transactions (item_id, type, quantity, notes, performed_by) VALUES ($1,'in',$2,'Initial stock',$3)`,
          [result.rows[0].id, parseInt(quantity)||0, req.user.id]
        );
      } catch (err) {
        console.log('Transaction insert failed (non-blocking):', err.message);
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/inventory/:id ──────────────────────────────────────────────────
router.put('/:id', requireMinRole('junior_engineer'), auditLog('update_inventory', 'inventory'), async (req, res) => {
  try {
    const {
      name, category, serial_number, pcb_number, head_map,
      quantity, min_quantity, unit_cost, location, condition, notes, storage_model_id,
      reserved_for_case, firmware_version,
    } = req.body;

    // Map frontend categories to valid enum values
    const categoryMap = {
      'wd_35': 'donor_drive', 'wd_25': 'donor_drive',
      'seagate_35': 'donor_drive', 'seagate_25': 'donor_drive',
      'others_35': 'donor_drive', 'others_25': 'donor_drive',
      'ssd': 'donor_drive', 'pcb': 'spare_part', 'phone': 'spare_part',
    };
    const mappedCategory = category ? (categoryMap[category] || category) : null;

    const result = await query(
      `UPDATE inventory_items SET
        name=COALESCE($1,name), category=COALESCE($2,category),
        serial_number=$3, pcb_number=$4, head_map=$5,
        quantity=COALESCE($6,quantity), min_quantity=COALESCE($7,min_quantity),
        unit_cost=$8, location=$9, condition=COALESCE($10,condition),
        notes=$11, storage_model_id=$12, reserved_for_case=$13,
        firmware_version=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        name||null, mappedCategory,
        serial_number||null, pcb_number||null, head_map||null,
        quantity != null ? parseInt(quantity) : null,
        min_quantity != null ? parseInt(min_quantity) : null,
        unit_cost||null, location||null,
        condition||null, notes||null, storage_model_id||null,
        reserved_for_case||null, firmware_version||null,
        req.params.id
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PATCH /api/inventory/:id/quantity ──────────────────────────────────────
router.patch('/:id/quantity', requireMinRole('junior_engineer'), auditLog('adjust_inventory', 'inventory'), async (req, res) => {
  try {
    const { type, quantity, case_id, notes } = req.body;
    const item = await query('SELECT * FROM inventory_items WHERE id=$1', [req.params.id]);
    if (!item.rows.length) return res.status(404).json({ error: 'Item not found' });

    let newQty = item.rows[0].quantity;
    if (type === 'in') newQty += parseInt(quantity);
    else if (['out','reserved','disposed'].includes(type)) newQty -= parseInt(quantity);
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient stock' });

    await query(`UPDATE inventory_items SET quantity=$1, is_available=$2, updated_at=NOW() WHERE id=$3`,
      [newQty, newQty > 0, req.params.id]);

    try {
      await query(`INSERT INTO inventory_transactions (item_id, case_id, type, quantity, notes, performed_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.id, case_id||null, type, parseInt(quantity), notes||null, req.user.id]);
    } catch (err) {
      console.log('Transaction insert failed (non-blocking):', err.message);
    }

    res.json({ id: req.params.id, newQuantity: newQty });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/inventory/import ─────────────────────────────────────────────
router.post('/import', requireMinRole('admin'), async (req, res) => {
  try {
    const { data = [], mode = 'append' } = req.body;
    if (!Array.isArray(data) || !data.length) return res.status(400).json({ error: 'No data provided' });

    // Map frontend categories to valid enum values
    const categoryMap = {
      'wd_35': 'donor_drive', 'wd_25': 'donor_drive',
      'seagate_35': 'donor_drive', 'seagate_25': 'donor_drive',
      'others_35': 'donor_drive', 'others_25': 'donor_drive',
      'ssd': 'donor_drive', 'pcb': 'spare_part', 'phone': 'spare_part',
    };

    let imported = 0, skipped = 0;

    for (const row of data) {
      if (!row.serial_number && !row.name) { skipped++; continue; }

      const skuResult = await query('SELECT COUNT(*) FROM inventory_items', []);
      const sku = row.sku || `INV-${String(parseInt(skuResult.rows[0].count)+imported+1).padStart(5,'0')}`;
      const itemName = row.name || sku;
      const mappedCategory = categoryMap[row.category] || row.category || 'spare_part';

      if (mode === 'overwrite' && row.sku) {
        // Try update first
        const existing = await query('SELECT id FROM inventory_items WHERE sku=$1', [row.sku]);
        if (existing.rows.length) {
          try {
            await query(
              `UPDATE inventory_items SET name=$1, category=$2, serial_number=$3, pcb_number=$4,
               firmware_version=$5, condition=$6, quantity=$7,
               unit_cost=$8, location=$9, notes=$10, storage_model_id=$11, updated_at=NOW()
               WHERE id=$12`,
              [
                itemName, mappedCategory, row.serial_number||null, row.pcb_number||null,
                row.firmware_version||null, row.condition||'used',
                parseInt(row.quantity)||0, row.unit_cost||null, row.location||null, row.notes||null,
                row.storage_model_id||null, existing.rows[0].id
              ]
            );
            imported++; continue;
          } catch (err) {
            console.log('Update failed, will try insert:', err.message);
          }
        }
      }

      // Insert new
      try {
        await query(
          `INSERT INTO inventory_items (sku, name, category, serial_number, pcb_number,
           firmware_version, condition, quantity, min_quantity, unit_cost, location, notes, storage_model_id, added_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT DO NOTHING`,
          [
            sku, itemName, mappedCategory, row.serial_number||null, row.pcb_number||null,
            row.firmware_version||null, row.condition||'used',
            parseInt(row.quantity)||0, parseInt(row.min_quantity)||1,
            row.unit_cost||null, row.location||null, row.notes||null, row.storage_model_id||null, req.user.id
          ]
        );
        imported++;
      } catch (err) { 
        console.log('Insert failed:', err.message);
        skipped++; 
      }
    }

    res.json({ imported, skipped, total: data.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/inventory/donors ──────────────────────────────────────────────
router.get('/donors', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM inventory_items WHERE status='available' AND quantity > 0 ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/inventory/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM inventory_items WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/inventory/:id/images ──────────────────────────────────────────
router.get('/:id/images', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, mime_type, data, size, created_at FROM inventory_images WHERE item_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ images: result.rows.map(r => ({ id: r.id, name: r.name, mimeType: r.mime_type, data: r.data, size: r.size })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/inventory/:id/images (JSON base64 upload) ────────────────────
router.post('/:id/images', requireMinRole('junior_engineer'), async (req, res) => {
  try {
    const { name, data, size, mimeType } = req.body;
    if (!data) return res.status(400).json({ error: 'No image data' });
    const r = await query(
      `INSERT INTO inventory_images (item_id, name, mime_type, data, size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, mime_type, data, size`,
      [req.params.id, name||'photo', mimeType||'image/jpeg', data, size||0, req.user.id]
    );
    res.status(201).json({ id: r.rows[0].id, name: r.rows[0].name, mimeType: r.rows[0].mime_type, data: r.rows[0].data, size: r.rows[0].size });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/inventory/:id/images/:imgId ────────────────────────────────
router.delete('/:id/images/:imgId', requireMinRole('junior_engineer'), async (req, res) => {
  try {
    const result = await query('DELETE FROM inventory_images WHERE id=$1 AND item_id=$2 RETURNING id', [req.params.imgId, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Image not found' });
    res.json({ message: 'Image deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
