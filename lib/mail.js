const nodemailer = require('nodemailer');

const { GMAIL_USER, GMAIL_APP_PASSWORD, RECIPIENT_EMAIL } = process.env;

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
