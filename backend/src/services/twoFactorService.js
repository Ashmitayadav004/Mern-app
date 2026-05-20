/**
 * Two-Factor Authentication Service (TOTP)
 * Uses speakeasy for TOTP generation/verification and qrcode for QR rendering.
 */

const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const bcrypt    = require('bcryptjs');
const { query } = require('../config/database');
const logger    = require('../config/logger');

const APP_NAME = process.env.APP_NAME || 'RecoverLab';

/**
 * Generate a new TOTP secret and QR code for a user.
 * Saves the secret (unverified) to two_factor_auth table.
 * @returns {{ secret, qrCodeDataUrl, manualEntryCode }}
 */
async function generateSecret(userId, userEmail) {
  const secret = speakeasy.generateSecret({
    name:   `${APP_NAME} (${userEmail})`,
    length: 32,
  });

  // Upsert into two_factor_auth — not yet enabled (user must verify first)
  await query(
    `INSERT INTO two_factor_auth (user_id, secret, is_enabled)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id) DO UPDATE SET secret = $2, is_enabled = false`,
    [userId, secret.base32]
  );

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  logger.info('2FA secret generated', { userId });

  return {
    secret:          secret.base32,
    qrCodeDataUrl,
    manualEntryCode: secret.base32,
  };
}

/**
 * Verify a TOTP token and enable 2FA for the user if valid.
 * @returns {boolean} - true if verified and enabled
 */
async function verifyAndEnable(userId, token) {
  const result = await query(
    'SELECT secret FROM two_factor_auth WHERE user_id = $1',
    [userId]
  );
  if (!result.rows.length) throw new Error('2FA not set up for this user');

  const secret = result.rows[0].secret;
  const valid  = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window:   1,   // allow ±30 seconds drift
  });

  if (!valid) return false;

  // Generate hashed backup codes (8 codes, one-time use)
  const rawCodes   = Array.from({ length: 8 }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );
  const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

  await query(
    `UPDATE two_factor_auth
     SET is_enabled = true, enabled_at = NOW(), backup_codes = $2
     WHERE user_id = $1`,
    [userId, hashedCodes]
  );

  await query(
    'UPDATE users SET two_fa_enabled = true WHERE id = $1',
    [userId]
  );

  logger.info('2FA enabled', { userId });
  return { valid: true, backupCodes: rawCodes };
}

/**
 * Validate a TOTP token (during login 2FA challenge).
 */
async function validateToken(userId, token) {
  const result = await query(
    'SELECT secret, backup_codes FROM two_factor_auth WHERE user_id = $1 AND is_enabled = true',
    [userId]
  );
  if (!result.rows.length) throw new Error('2FA not enabled for this user');

  const { secret, backup_codes } = result.rows[0];

  // Check TOTP first
  const valid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window:   1,
  });
  if (valid) return true;

  // Check backup codes (one-time use)
  if (backup_codes && backup_codes.length) {
    for (let i = 0; i < backup_codes.length; i++) {
      const match = await bcrypt.compare(token, backup_codes[i]);
      if (match) {
        // Remove used backup code
        const updated = backup_codes.filter((_, idx) => idx !== i);
        await query(
          'UPDATE two_factor_auth SET backup_codes = $2 WHERE user_id = $1',
          [userId, updated]
        );
        logger.info('2FA backup code used', { userId });
        return true;
      }
    }
  }

  return false;
}

/**
 * Disable 2FA for a user.
 */
async function disable(userId) {
  await query(
    `UPDATE two_factor_auth SET is_enabled = false, backup_codes = NULL WHERE user_id = $1`,
    [userId]
  );
  await query('UPDATE users SET two_fa_enabled = false WHERE id = $1', [userId]);
  logger.info('2FA disabled', { userId });
}

/**
 * Toggle 2FA enforcement for all admin-level users.
 */
async function setGlobalEnforcement(enforced) {
  await query(
    `UPDATE users SET two_fa_enforced = $1 WHERE role IN ('admin', 'super_admin')`,
    [enforced]
  );
  logger.info('2FA global enforcement updated', { enforced });
}

module.exports = {
  generateSecret,
  verifyAndEnable,
  validateToken,
  disable,
  setGlobalEnforcement,
};
