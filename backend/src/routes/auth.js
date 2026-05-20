const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { generateAccessToken, generateRefreshToken, authenticate } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const logger = require('../config/logger');

const router = express.Router();

// ─── POST /api/auth/login ────────────────────────────────────────
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const { username, password } = req.body;

      const result = await query(
        `SELECT id, username, email, full_name, role, password_hash, is_active, specializations, avatar_url
         FROM users WHERE username = $1 OR email = $1`,
        [username.toLowerCase()]
      );

      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is deactivated. Contact admin.' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        logger.warn('Failed login attempt', { username, ip: req.ip });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token
      await query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) 
         VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [user.id, refreshToken]
      );

      // Update last_login
      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      logger.info('User logged in', { userId: user.id, username: user.username });

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          specializations: user.specializations,
          avatarUrl: user.avatar_url,
        }
      });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ─── POST /api/auth/refresh ───────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION');
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const result = await query(
      `SELECT rt.*, u.role, u.is_active FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    if (!result.rows[0].is_active) {
      return res.status(401).json({ error: 'Account deactivated' });
    }

    const newAccessToken = generateAccessToken(decoded.userId, result.rows[0].role);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token = $1 AND user_id = $2', [refreshToken, req.user.id]);
  }
  res.json({ message: 'Logged out successfully' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    `SELECT id, username, email, full_name, role, is_active, specializations,
            avatar_url, phone, notes, permissions, last_login, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json(result.rows[0]);
});

// ─── PUT /api/auth/change-password ───────────────────────────────
router.put('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  ],
  auditLog('change_password', 'user'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    // Invalidate all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({ message: 'Password changed successfully. Please log in again.' });
  }
);

module.exports = router;
