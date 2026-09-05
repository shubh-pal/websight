/**
 * Manual outreach send — Zoho Mail via SMTP (app password), nodemailer.
 *
 * This is deliberately the "click Send on one lead" path, not a bulk sender:
 * the admin reviews/edits the drafted subject+body in the UI, then this
 * fires a single message with the proposal PDF attached. Bulk/marketing
 * sends are a separate, later concern (HubSpot), not this module.
 */
const nodemailer = require('nodemailer');
const gcs = require('../gcsStorage');

const isEnabled = !!(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASS);

let transporter = null;
function getTransporter() {
  if (!isEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
      port: Number(process.env.ZOHO_SMTP_PORT || 465),
      secure: true,
      auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Send one outreach email with the proposal PDF attached.
 * @returns {Promise<{messageId: string}>}
 */
async function sendMail({ to, subject, body, fromName, replyTo, attachmentKey, attachmentName }) {
  const t = getTransporter();
  if (!t) throw new Error('Zoho SMTP not configured (ZOHO_SMTP_USER / ZOHO_SMTP_PASS missing)');
  if (!to) throw new Error('recipient email required');

  const attachments = [];
  if (attachmentKey && gcs.isEnabled) {
    const buf = await gcs.downloadBuffer(attachmentKey);
    if (buf) attachments.push({ filename: attachmentName || 'proposal.pdf', content: buf, contentType: 'application/pdf' });
  }

  const from = fromName ? `"${fromName}" <${process.env.ZOHO_SMTP_USER}>` : process.env.ZOHO_SMTP_USER;
  const info = await t.sendMail({
    from, to, subject,
    text: body,
    replyTo: replyTo || undefined,
    attachments,
  });
  return { messageId: info.messageId };
}

module.exports = { isEnabled, sendMail };
