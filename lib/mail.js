const nodemailer = require('nodemailer');

const GMAIL_USER = (process.env.GMAIL_USER || '').trim();
// Google pokazuje hasło aplikacji ze spacjami (xxxx xxxx xxxx xxxx) — usuwamy je,
// żeby działało niezależnie od tego, jak zostało wklejone
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const RECIPIENT_EMAIL = (process.env.RECIPIENT_EMAIL || '').trim();

const isConfigured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD && RECIPIENT_EMAIL);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 60_000,
    })
  : null;

async function sendPhotoMail({ title, message, file }) {
  await transporter.sendMail({
    from: `"Gmail Photo Sender" <${GMAIL_USER}>`,
    to: RECIPIENT_EMAIL,
    subject: title,
    text: message || title,
    attachments: [
      {
        filename: file.filename || 'zdjecie',
        content: file.buffer,
        contentType: file.mimeType,
      },
    ],
  });
}

module.exports = { isConfigured, GMAIL_USER, RECIPIENT_EMAIL, sendPhotoMail };
