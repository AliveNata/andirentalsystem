const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const FROM = '"Andi Rental Mobil" <noreply@andirentalmobil.com>';

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
}

function isDryRun() {
  return process.env.EMAIL_DRY_RUN === '1';
}

// Dry-run writes the message to EMAIL_DRY_RUN_DIR and never opens an SMTP connection.
async function writeDryRun({ kind, transactionId, to, subject, html, text, attachments }) {
  const dir = process.env.EMAIL_DRY_RUN_DIR;
  if (!dir) throw new Error('EMAIL_DRY_RUN_DIR belum diisi');
  await fs.promises.mkdir(dir, { recursive: true });
  const createdAt = new Date().toISOString();
  const base = path.join(dir, `${createdAt.replace(/:/g, '-')}-${kind}-${transactionId}`);
  await fs.promises.writeFile(`${base}.html`, html, 'utf8');
  if (text) await fs.promises.writeFile(`${base}.txt`, text, 'utf8');
  await fs.promises.writeFile(`${base}.json`, JSON.stringify({
    kind,
    transaction_id: transactionId,
    to,
    subject,
    attachments: (attachments || []).map((a) => a.filename),
    created_at: createdAt,
  }, null, 2), 'utf8');
}

async function deliverEmail({ kind, transactionId, to, subject, html, text, attachments = [] }) {
  if (isDryRun()) {
    await writeDryRun({ kind, transactionId, to, subject, html, text, attachments });
    return { dryRun: true };
  }
  const message = { from: FROM, to, subject, html, attachments };
  if (text) message.text = text;
  await getTransporter().sendMail(message);
  return { dryRun: false };
}

module.exports = { deliverEmail, isDryRun };
