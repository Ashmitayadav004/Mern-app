/**
 * Razorpay Service
 * Handles order creation, payment verification, and webhook signature validation.
 */

const crypto = require('crypto');
const logger = require('../config/logger');

// Lazy-init Razorpay so the server starts even without credentials
let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }
    const Razorpay = require('razorpay');
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

/**
 * Create a Razorpay order.
 * @param {object} opts
 * @param {number}  opts.amount      - Amount in rupees (will be converted to paise)
 * @param {string}  opts.currency    - e.g. 'INR'
 * @param {string}  opts.receipt     - Internal reference (purchase UUID)
 * @param {object}  opts.notes       - Arbitrary key-value metadata
 * @returns {Promise<object>}         - Razorpay order object
 */
async function createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  try {
    const order = await getRazorpay().orders.create({
      amount:   Math.round(amount * 100), // convert ₹ → paise
      currency,
      receipt,
      notes,
    });
    logger.info('Razorpay order created', { orderId: order.id, amount });
    return order;
  } catch (err) {
    logger.error('Razorpay createOrder error', { error: err.message });
    throw err;
  }
}

/**
 * Verify payment signature after client-side Razorpay checkout.
 * Returns true if valid.
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const body      = `${orderId}|${paymentId}`;
  const expected  = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  const valid = crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
  if (!valid) logger.warn('Razorpay signature mismatch', { orderId, paymentId });
  return valid;
}

/**
 * Verify incoming webhook signature.
 * rawBody must be the raw Buffer from express.raw()
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret   = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

/**
 * Fetch a Razorpay order's details (for reconciliation).
 */
async function fetchOrder(orderId) {
  return getRazorpay().orders.fetch(orderId);
}

/**
 * Fetch payment details.
 */
async function fetchPayment(paymentId) {
  return getRazorpay().payments.fetch(paymentId);
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchOrder,
  fetchPayment,
};
