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
    const conditions = [`ii.tenant_id = $1`];
    const params = [req.user.tenant_id];
    let pi = 2;

    if (category) { conditions.push(`ii.category = $${pi++}`); params.push(category); }
    if (is_available !== undefined) { conditions.push(`ii.is_available = $${pi++}`); params.push(is_available === 'true'); }
    if (storage_model_id) { conditions.push(`ii.storage_model_id = $${pi++}`); params.push(storage_model_id); }
    if (search) {
      conditions.push(`(
        ii.name ILIKE $${pi} OR ii.sku ILIKE $${pi} OR ii.stock_number ILIKE $${pi}
        OR ii.serial_number ILIKE $${pi} OR ii.pcb_number ILIKE $${pi}
        OR ii.model ILIKE $${pi} OR ii.company ILIKE $${pi} OR ii.brand ILIKE $${pi}
        OR ii.firmware ILIKE $${pi} OR ii.site_code ILIKE $${pi}
      )`);
      params.push(`%${search}%`);
      pi++;
    }

    const where = 'WHERE ' + conditions.join(' AND ');
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
      stock_number, name, category, company, brand, model,
      serial_number, pcb_number, firmware, site_code, date_code, head_map, family,
      capacity, interface: iface, form_factor,
      description, quantity, min_quantity, unit_cost, location,
      condition, status, notes, source_case_id,
      // legacy fields
      firmware_version, storage_model_id,
    } = req.body;

    // Auto-generate SKU if not provided
    const skuResult = await query('SELECT COUNT(*) FROM inventory_items WHERE tenant_id=$1', [req.user.tenant_id]);
    const sku = `INV-${String(parseInt(skuResult.rows[0].count)+1).padStart(5,'0')}`;
    const stockNo = stock_number || sku;
    const itemName = name || [company||brand, model].filter(Boolean).join(' ') || stockNo;

    let result;
    try {
      result = await query(
        `INSERT INTO inventory_items (
          tenant_id, sku, stock_number, name, category, company, brand, model,
          serial_number, pcb_number, firmware, site_code, date_code, head_map, family,
          capacity, interface, form_factor,
          storage_model_id, description, quantity, min_quantity, unit_cost, location,
          condition, status, notes, source_case_id, added_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
        RETURNING *`,
        [
          req.user.tenant_id, sku, stockNo, itemName, category||'others_35',
          company||null, brand||company||null, model||null,
          serial_number||null, pcb_number||null,
          firmware||firmware_version||null, site_code||null, date_code||null,
          head_map||null, family||null, capacity||null, iface||null, form_factor||null,
          storage_model_id||null, description||notes||null,
          parseInt(quantity)||1, parseInt(min_quantity)||1,
          unit_cost||null, location||null,
          condition||'used', status||'available', notes||null,
          source_case_id||null, req.user.id
        ]
      );
    } catch (colErr) {
      // Fallback if new columns don't exist yet in DB (graceful degradation)
      result = await query(
        `INSERT INTO inventory_items (tenant_id, sku, name, category, serial_number, pcb_number, notes, quantity, min_quantity, location, condition, added_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.user.tenant_id, sku, itemName, category||'others_35', serial_number||null, pcb_number||null, notes||description||null, parseInt(quantity)||1, parseInt(min_quantity)||1, location||null, condition||'used', req.user.id]
      );
    }

    if ((parseInt(quantity)||0) > 0) {
      try {
        await query(
          `INSERT INTO inventory_transactions (item_id, type, quantity, notes, performed_by) VALUES ($1,'in',$2,'Initial stock',$3)`,
          [result.rows[0].id, parseInt(quantity)||1, req.user.id]
        );
      } catch {}
    }

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/inventory/:id ──────────────────────────────────────────────────
router.put('/:id', requireMinRole('junior_engineer'), auditLog('update_inventory', 'inventory'), async (req, res) => {
  try {
    const {
      stock_number, name, category, company, brand, model,
      serial_number, pcb_number, firmware, site_code, date_code, head_map, family,
      capacity, interface: iface, form_factor,
      quantity, min_quantity, unit_cost, location, condition, status, notes,
    } = req.body;

    let result;
    try {
      result = await query(
        `UPDATE inventory_items SET
          stock_number=COALESCE($1,stock_number), name=COALESCE($2,name), category=COALESCE($3,category),
          company=$4, brand=$5, model=$6,
          serial_number=$7, pcb_number=$8, firmware=$9, site_code=$10, date_code=$11,
          head_map=$12, family=$13, capacity=$14, interface=$15, form_factor=$16,
          quantity=COALESCE($17,quantity), min_quantity=COALESCE($18,min_quantity),
          unit_cost=$19, location=$20, condition=COALESCE($21,condition),
          status=COALESCE($22,status), notes=$23, updated_at=NOW()
         WHERE id=$24 AND tenant_id=$25 RETURNING *`,
        [
          stock_number||null, name||null, category||null,
          company||null, brand||null, model||null,
          serial_number||null, pcb_number||null, firmware||null,
          site_code||null, date_code||null, head_map||null, family||null,
          capacity||null, iface||null, form_factor||null,
          quantity != null ? parseInt(quantity) : null,
          min_quantity != null ? parseInt(min_quantity) : null,
          unit_cost||null, location||null,
          condition||null, status||null, notes||null,
          req.params.id, req.user.tenant_id
        ]
      );
    } catch {
      result = await query(
        `UPDATE inventory_items SET name=COALESCE($1,name), category=COALESCE($2,category), quantity=COALESCE($3,quantity), notes=$4, updated_at=NOW()
         WHERE id=$5 AND tenant_id=$6 RETURNING *`,
        [name||null, category||null, quantity!=null?parseInt(quantity):null, notes||null, req.params.id, req.user.tenant_id]
      );
    }

    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PATCH /api/inventory/:id/quantity ──────────────────────────────────────
router.patch('/:id/quantity', requireMinRole('junior_engineer'), auditLog('adjust_inventory', 'inventory'), async (req, res) => {
  try {
    const { type, quantity, case_id, notes } = req.body;
    const item = await query('SELECT * FROM inventory_items WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
    if (!item.rows.length) return res.status(404).json({ error: 'Item not found' });

    let newQty = item.rows[0].quantity;
    if (type === 'in') newQty += parseInt(quantity);
    else if (['out','reserved','disposed'].includes(type)) newQty -= parseInt(quantity);
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient stock' });

    await query(`UPDATE inventory_items SET quantity=$1, is_available=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [newQty, newQty > 0, newQty > 0 ? 'available' : 'used', req.params.id]);

    try {
      await query(`INSERT INTO inventory_transactions (item_id, case_id, type, quantity, notes, performed_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.id, case_id||null, type, parseInt(quantity), notes||null, req.user.id]);
    } catch {}

    res.json({ id: req.params.id, newQuantity: newQty });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/inventory/import ─────────────────────────────────────────────
router.post('/import', requireMinRole('admin'), async (req, res) => {
  try {
    const { data = [], mode = 'append' } = req.body;
    if (!Array.isArray(data) || !data.length) return res.status(400).json({ error: 'No data provided' });

    let imported = 0, skipped = 0;

    for (const row of data) {
      if (!row.stock_number && !row.serial_number && !row.model) { skipped++; continue; }

      const skuResult = await query('SELECT COUNT(*) FROM inventory_items WHERE tenant_id=$1', [req.user.tenant_id]);
      const sku = row.sku || `INV-${String(parseInt(skuResult.rows[0].count)+imported+1).padStart(5,'0')}`;
      const stock_number = row.stock_number || sku;
      const itemName = row.name || [row.company||row.brand, row.model].filter(Boolean).join(' ') || stock_number;

      if (mode === 'overwrite' && row.stock_number) {
        // Try update first
        const existing = await query('SELECT id FROM inventory_items WHERE tenant_id=$1 AND stock_number=$2', [req.user.tenant_id, row.stock_number]);
        if (existing.rows.length) {
          try {
            await query(
              `UPDATE inventory_items SET name=$1, category=$2, company=$3, brand=$4, model=$5,
               serial_number=$6, pcb_number=$7, firmware=$8, site_code=$9, date_code=$10,
               capacity=$11, interface=$12, condition=$13, status=$14, quantity=$15,
               unit_cost=$16, location=$17, notes=$18, updated_at=NOW()
               WHERE id=$19`,
              [
                itemName, row.category||'others_35', row.company||null, row.brand||null, row.model||null,
                row.serial_number||null, row.pcb_number||null, row.firmware||null,
                row.site_code||null, row.date_code||null, row.capacity||null, row.interface||null,
                row.condition||'used', row.status||'available',
                parseInt(row.quantity)||1, row.unit_cost||null, row.location||null, row.notes||null,
                existing.rows[0].id
              ]
            );
            imported++; continue;
          } catch {}
        }
      }

      // Insert new
      try {
        await query(
          `INSERT INTO inventory_items (tenant_id, sku, stock_number, name, category, company, brand, model,
           serial_number, pcb_number, firmware, site_code, date_code, capacity, interface, form_factor,
           condition, status, quantity, min_quantity, unit_cost, location, notes, added_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           ON CONFLICT DO NOTHING`,
          [
            req.user.tenant_id, sku, stock_number, itemName,
            row.category||'others_35', row.company||null, row.brand||null, row.model||null,
            row.serial_number||null, row.pcb_number||null, row.firmware||null,
            row.site_code||null, row.date_code||null, row.capacity||null, row.interface||null, row.form_factor||null,
            row.condition||'used', row.status||'available',
            parseInt(row.quantity)||1, parseInt(row.min_quantity)||1,
            row.unit_cost||null, row.location||null, row.notes||null, req.user.id
          ]
        );
        imported++;
      } catch { skipped++; }
    }

    res.json({ imported, skipped, total: data.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/inventory/donors ──────────────────────────────────────────────
router.get('/donors', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM inventory_items WHERE tenant_id=$1 AND status='available' AND quantity > 0 ORDER BY created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/inventory/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM inventory_items WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
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
