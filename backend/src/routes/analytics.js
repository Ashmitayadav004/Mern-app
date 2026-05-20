const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/analytics/dashboard ────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [casesStats, revenueStats, engineerStats, failureStats, recentCases, stageCounts] = await Promise.all([
      // Cases overview
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE stage NOT IN ('completed','delivered','failed')) as active,
        COUNT(*) FILTER (WHERE stage = 'completed' OR stage = 'delivered') as completed,
        COUNT(*) FILTER (WHERE stage = 'failed') as failed,
        COUNT(*) FILTER (WHERE priority = 1) as critical,
        COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '30 days') as this_month
        FROM cases`),

      // Revenue this month
      query(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'), 0) as revenue_month,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_revenue,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count
        FROM payments`),

      // Engineer performance
      query(`SELECT u.id, u.full_name, u.role,
        COUNT(c.id) as total_cases,
        COUNT(c.id) FILTER (WHERE c.stage IN ('completed','delivered')) as completed_cases,
        AVG(EXTRACT(EPOCH FROM (c.completed_at - c.received_at))/3600) FILTER (WHERE c.completed_at IS NOT NULL) as avg_hours,
        ROUND(COUNT(c.id) FILTER (WHERE c.stage IN ('completed','delivered'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as success_rate
        FROM users u
        LEFT JOIN cases c ON c.assigned_engineer = u.id
        WHERE u.role IN ('senior_engineer','junior_engineer') AND u.is_active = true
        GROUP BY u.id ORDER BY completed_cases DESC LIMIT 10`),

      // Top failure types
      query(`SELECT failure_type, device_brand,
        COUNT(*) as count,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - received_at))/3600) FILTER (WHERE completed_at IS NOT NULL), 1) as avg_recovery_hours
        FROM cases
        WHERE received_at >= NOW() - INTERVAL '90 days'
        GROUP BY failure_type, device_brand
        ORDER BY count DESC LIMIT 10`),

      // Recent cases
      query(`SELECT c.id, c.case_number, c.stage, c.priority, c.failure_type, c.device_brand, c.device_model,
        c.ai_risk_level, c.created_at,
        cl.first_name, cl.last_name,
        u.full_name as engineer_name
        FROM cases c
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN users u ON c.assigned_engineer = u.id
        ORDER BY c.created_at DESC LIMIT 10`),

      // Stage distribution
      query(`SELECT stage, COUNT(*) as count FROM cases GROUP BY stage ORDER BY count DESC`),
    ]);

    res.json({
      cases: casesStats.rows[0],
      revenue: revenueStats.rows[0],
      engineers: engineerStats.rows,
      failureAnalytics: failureStats.rows,
      recentCases: recentCases.rows,
      stageDistribution: stageCounts.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/analytics/failure-trends ───────────────────────────
router.get('/failure-trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await query(
      `SELECT
        DATE_TRUNC('day', received_at) as date,
        failure_type,
        device_brand,
        COUNT(*) as count
       FROM cases
       WHERE received_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE_TRUNC('day', received_at), failure_type, device_brand
       ORDER BY date DESC`,
      [parseInt(days)]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/analytics/model-failures ───────────────────────────
router.get('/model-failures', async (req, res) => {
  try {
    const result = await query(
      `SELECT sm.model_number, sb.name as brand,
        COUNT(c.id) as total_cases,
        COUNT(c.id) FILTER (WHERE c.stage IN ('completed','delivered')) as recovered,
        COUNT(c.id) FILTER (WHERE c.stage = 'failed') as failed,
        ROUND(COUNT(c.id) FILTER (WHERE c.stage IN ('completed','delivered'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as recovery_rate,
        MODE() WITHIN GROUP (ORDER BY c.failure_type) as common_failure
       FROM storage_models sm
       JOIN storage_brands sb ON sm.brand_id = sb.id
       JOIN cases c ON c.storage_model_id = sm.id
       GROUP BY sm.id, sm.model_number, sb.name
       HAVING COUNT(c.id) > 0
       ORDER BY total_cases DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/analytics/revenue-trend ────────────────────────────
router.get('/revenue-trend', async (req, res) => {
  try {
    const result = await query(
      `SELECT DATE_TRUNC('month', paid_at) as month,
        COALESCE(SUM(amount),0) as revenue,
        COUNT(*) as payment_count
       FROM payments WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', paid_at) ORDER BY month`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
