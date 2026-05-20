/**
 * Invoice Service
 * Generates PDF invoices via pdfkit and sends them via Nodemailer.
 */

const path      = require('path');
const fs        = require('fs');
const PDFDoc    = require('pdfkit');
const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const logger    = require('../config/logger');

// ─── Ensure invoices directory exists ──────────────────────────
const INVOICES_DIR = path.join(process.cwd(), 'uploads', 'invoices');
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

// ─── Nodemailer transport ───────────────────────────────────────
function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Generate a sequential invoice number string.
 */
async function generateInvoiceNumber() {
  const result = await query(
    `SELECT COUNT(*) AS cnt FROM saas_purchases WHERE invoice_number IS NOT NULL`
  );
  const seq    = parseInt(result.rows[0].cnt) + 1;
  const prefix = process.env.INVOICE_PREFIX || 'RCL-INV';
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Build PDF invoice into a file and return its path.
 * @param {object} purchase  - Row from saas_purchases joined with user data
 * @returns {Promise<string>} - Absolute file path of the generated PDF
 */
async function generatePDF(purchase) {
  const invoiceNumber  = purchase.invoice_number;
  const fileName       = `${invoiceNumber}.pdf`;
  const filePath       = path.join(INVOICES_DIR, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDoc({ margin: 50, size: 'A4' });
    const ws  = fs.createWriteStream(filePath);

    doc.pipe(ws);
    ws.on('finish', () => resolve(filePath));
    ws.on('error',  reject);

    // ── Header ──────────────────────────────────────────────────
    doc
      .fontSize(22).font('Helvetica-Bold')
      .text('RecoverLab CRM', 50, 50)
      .fontSize(10).font('Helvetica')
      .fillColor('#666')
      .text('Professional Data Recovery Platform', 50, 78)
      .fillColor('#000');

    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#dddddd').stroke();

    // ── Invoice Label ───────────────────────────────────────────
    doc
      .fontSize(28).font('Helvetica-Bold').fillColor('#1a1a2e')
      .text('INVOICE', 350, 50)
      .fontSize(11).font('Helvetica').fillColor('#444')
      .text(`Invoice No: ${invoiceNumber}`, 350, 90)
      .text(`Date: ${new Date(purchase.paid_at || purchase.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 350, 106);

    // ── Bill To ─────────────────────────────────────────────────
    doc
      .fontSize(11).font('Helvetica-Bold').fillColor('#000')
      .text('Billed To:', 50, 130)
      .font('Helvetica').fillColor('#333')
      .text(purchase.full_name  || purchase.username || 'Customer', 50, 147)
      .text(purchase.email,                                          50, 163)
      .text(purchase.city       || '',                               50, 179);

    // ── Summary Box ─────────────────────────────────────────────
    doc.roundedRect(50, 220, 495, 90, 6).fillColor('#f8faff').fill();
    doc.fillColor('#000');

    const baseAmount   = parseFloat(purchase.amount || 0);
    const discount     = parseFloat(purchase.discount_amount || 0);
    const gstPct       = 18;
    const taxable      = baseAmount - discount;
    const gstAmount    = Math.round(taxable * gstPct / 100);
    const totalAmount  = taxable + gstAmount;

    const col1 = 60;
    const col2 = 350;
    let   y    = 232;

    const row = (label, value, bold = false) => {
      doc.fontSize(10)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, col1, y)
        .text(value, col2, y, { width: 180, align: 'right' });
      y += 18;
    };

    row('Plan', `${purchase.plan_label || purchase.plan_key} × ${purchase.months || 1} month(s)`);
    row('Subtotal', `₹${baseAmount.toLocaleString('en-IN')}`);
    if (discount > 0) row('Discount', `- ₹${discount.toLocaleString('en-IN')}`);
    row(`GST (${gstPct}%)`, `₹${gstAmount.toLocaleString('en-IN')}`);
    doc.moveTo(50, y + 2).lineTo(545, y + 2).strokeColor('#cccccc').stroke();
    y += 8;
    row('Total Paid', `₹${totalAmount.toLocaleString('en-IN')}`, true);

    // ── Payment Info ────────────────────────────────────────────
    y += 20;
    doc
      .fontSize(9).fillColor('#888')
      .text(`Razorpay Payment ID: ${purchase.razorpay_payment_id || 'N/A'}`, 50, y)
      .text(`Order ID: ${purchase.razorpay_order_id || 'N/A'}`, 50, y + 14)
      .text(`Status: PAID`, 50, y + 28);

    // ── Footer ──────────────────────────────────────────────────
    doc
      .fontSize(8).fillColor('#aaa')
      .text('This is a system-generated invoice.', 50, 760, { align: 'center', width: 495 })
      .text('support@recoverlab.in  |  recoverlab.in', 50, 773, { align: 'center', width: 495 });

    doc.end();
  });
}

/**
 * Full pipeline: generate invoice number → PDF → send email → update DB.
 * @param {string} purchaseId - UUID from saas_purchases
 */
async function processInvoice(purchaseId) {
  try {
    // Fetch purchase + user details
    const result = await query(
      `SELECT sp.*, u.full_name, u.email, u.username, u.phone
       FROM saas_purchases sp
       JOIN users u ON sp.tenant_user_id = u.id
       WHERE sp.id = $1`,
      [purchaseId]
    );
    if (!result.rows.length) throw new Error(`Purchase ${purchaseId} not found`);
    const purchase = result.rows[0];

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    await query(
      'UPDATE saas_purchases SET invoice_number = $1 WHERE id = $2',
      [invoiceNumber, purchaseId]
    );
    purchase.invoice_number = invoiceNumber;

    // Generate PDF
    const pdfPath = await generatePDF(purchase);
    await query(
      'UPDATE saas_purchases SET invoice_pdf_path = $1 WHERE id = $2',
      [pdfPath, purchaseId]
    );

    // Send email
    await sendEmail(purchase, pdfPath, invoiceNumber);

    await query(
      'UPDATE saas_purchases SET invoice_sent_at = NOW() WHERE id = $1',
      [purchaseId]
    );

    logger.info('Invoice processed', { purchaseId, invoiceNumber });
    return { invoiceNumber, pdfPath };
  } catch (err) {
    logger.error('Invoice processing failed', { purchaseId, error: err.message });
    throw err;
  }
}

/**
 * Send invoice email with PDF attachment.
 */
async function sendEmail(purchase, pdfPath, invoiceNumber) {
  if (!process.env.SMTP_USER) {
    logger.warn('SMTP not configured — skipping invoice email');
    return;
  }

  const transport = getTransport();
  const fromName  = process.env.SMTP_FROM_NAME  || 'RecoverLab Billing';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 30px;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a2e; margin: 0; font-size: 24px;">💾 RecoverLab</h1>
          <p style="color: #666; margin-top: 6px; font-size: 14px;">Your subscription is now active!</p>
        </div>

        <p style="color: #333; font-size: 15px;">Hi <strong>${purchase.full_name || 'there'}</strong>,</p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Thank you for subscribing to the <strong>${purchase.plan_label || purchase.plan_key}</strong> plan.
          Your account has been activated and your invoice is attached to this email.
        </p>

        <div style="background: #f0f4ff; border-radius: 8px; padding: 18px 22px; margin: 24px 0;">
          <table style="width: 100%; font-size: 13px; color: #444;">
            <tr><td>Invoice Number</td><td style="text-align:right; font-weight:700; color:#1a1a2e;">${invoiceNumber}</td></tr>
            <tr><td>Plan</td><td style="text-align:right;">${purchase.plan_label || purchase.plan_key}</td></tr>
            <tr><td>Amount Paid</td><td style="text-align:right; font-weight:700;">₹${parseFloat(purchase.amount).toLocaleString('en-IN')}</td></tr>
            <tr><td>Payment ID</td><td style="text-align:right; font-family:monospace; font-size:12px;">${purchase.razorpay_payment_id || 'N/A'}</td></tr>
          </table>
        </div>

        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
          Need help? Email us at <a href="mailto:support@recoverlab.in" style="color:#3b82f6;">support@recoverlab.in</a>
        </p>
      </div>
    </body>
    </html>
  `;

  await transport.sendMail({
    from:        `"${fromName}" <${fromEmail}>`,
    to:          purchase.email,
    subject:     `Your ${purchase.plan_label || purchase.plan_key} Invoice — ${invoiceNumber}`,
    html,
    attachments: [{
      filename:    `${invoiceNumber}.pdf`,
      path:        pdfPath,
      contentType: 'application/pdf',
    }],
  });

  logger.info('Invoice email sent', { to: purchase.email, invoiceNumber });
}

module.exports = { processInvoice, generatePDF, generateInvoiceNumber };
