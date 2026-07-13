const { isConfigured, GMAIL_USER, RECIPIENT_EMAIL } = require('../lib/mail');

module.exports = (req, res) => {
  if (!isConfigured) {
    return res.status(500).json({
      error:
        'Serwer nie jest skonfigurowany — ustaw zmienne środowiskowe ' +
        'GMAIL_USER, GMAIL_APP_PASSWORD i RECIPIENT_EMAIL.',
    });
  }
  res.status(200).json({ recipient: RECIPIENT_EMAIL, sender: GMAIL_USER });
};
