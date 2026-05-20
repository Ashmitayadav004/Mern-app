const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', requireMinRole('senior_engineer'), async (req, res) => {
  try {
    const result = await query(`SELECT id, username, email, full_name, role, is_active, specializations, phone, permissions, last_login, created_at FROM users ORDER BY role, full_name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireRole('admin', 'super_admin'), auditLog('create_user', 'user'), async (req, res) => {
  try {
    const { username, email, password, full_name, role, phone, specializations, notes, permissions } = req.body;
    if (!password || password.length < 8) return res.status(422).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone, specializations, notes, permissions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username.toLowerCase(), email.toLowerCase(), hash, full_name, role||'junior_engineer', phone||null, specializations||[], notes||null, permissions ? JSON.stringify(permissions) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.constraint?.includes('unique')) return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireMinRole('senior_engineer'), auditLog('update_user', 'user'), async (req, res) => {
  try {
    const { full_name, phone, specializations, notes, is_active, role, permissions } = req.body;
    // Only admin can change roles
    if (role && req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only admin can change roles' });
    const result = await query(
      `UPDATE users SET full_name=COALESCE($1,full_name), phone=COALESCE($2,phone), specializations=COALESCE($3,specializations), notes=COALESCE($4,notes), is_active=COALESCE($5,is_active), role=COALESCE($6,role), permissions=COALESCE($7,permissions), updated_at=NOW() WHERE id=$8 RETURNING id, username, full_name, role, is_active`,
      [full_name, phone, specializations, notes, is_active, role, permissions ? JSON.stringify(permissions) : null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireMinRole('senior_engineer'), auditLog('update_user', 'user'), async (req, res) => {
  try {
    const { full_name, phone, specializations, notes, is_active, role, permissions } = req.body;
    if (role && req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only admin can change roles' });
    const result = await query(
      `UPDATE users SET full_name=COALESCE($1,full_name), phone=COALESCE($2,phone), specializations=COALESCE($3,specializations), notes=COALESCE($4,notes), is_active=COALESCE($5,is_active), role=COALESCE($6,role), permissions=COALESCE($7,permissions), updated_at=NOW() WHERE id=$8 RETURNING id, username, full_name, role, is_active`,
      [full_name, phone, specializations, notes, is_active, role, permissions ? JSON.stringify(permissions) : null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/deactivate', requireRole('admin', 'super_admin'), auditLog('toggle_user_status', 'user'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id=$1 RETURNING id, username, full_name, role, is_active`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/audit-logs', requireRole('admin'), async (req, res) => {
  try {
    const { page=1, limit=50, user_id, action, resource_type } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const conditions = [], params = [];
    let pi = 1;
    if (user_id) { conditions.push(`al.user_id = $${pi++}`); params.push(user_id); }
    if (action) { conditions.push(`al.action ILIKE $${pi++}`); params.push(`%${action}%`); }
    if (resource_type) { conditions.push(`al.resource_type = $${pi++}`); params.push(resource_type); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(
      `SELECT al.*, u.username, u.full_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ${where} ORDER BY al.created_at DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), offset]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
