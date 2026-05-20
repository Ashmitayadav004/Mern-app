const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// ─── Verify JWT Token ───────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Validate user still exists and is active
    const result = await query(
      'SELECT id, username, email, full_name, role, is_active, specializations FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User account is inactive or deleted' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ─── Role-Based Access Control ──────────────────────────────────
const ROLE_HIERARCHY = {
  super_admin: 100, // Platform-level owner
  admin: 4,         // Per-tenant account owner
  senior_engineer: 3,
  junior_engineer: 2,
  staff: 1,
};

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({
      error: 'Insufficient permissions',
      required: roles,
      current: req.user.role
    });
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel >= requiredLevel) return next();
    return res.status(403).json({
      error: 'Insufficient permissions',
      requiredMinRole: minRole,
      current: req.user.role
    });
  };
}

// ─── Super Admin Only (platform-level) ──────────────────────────────
function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Super Admin access required',
      hint: 'Only platform super administrators can perform this action.',
    });
  }
  return next();
}

// ─── Owner (per-tenant admin) Only ──────────────────────────────────
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Account owner access required',
      hint: 'Only the account owner (Admin) can perform subscription changes.',
    });
  }
  return next();
}

// ─── Token Generation ───────────────────────────────────────────
function generateAccessToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = {
  authenticate,
  requireRole,
  requireMinRole,
  requireSuperAdmin,
  requireOwner,
  generateAccessToken,
  generateRefreshToken,
  JWT_SECRET,
};
