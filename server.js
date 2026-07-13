// Lokalny serwer deweloperski. Na Vercelu frontend serwowany jest z public/,
// a funkcje z api/ — ten plik używa dokładnie tych samych handlerów.
require('dotenv').config();

const express = require('express');
const path = require('path');

const configHandler = require('./api/config');
const sendHandler = require('./api/send');
const { isConfigured, GMAIL_USER, RECIPIENT_EMAIL } = require('./lib/mail');

if (!isConfigured) {
  console.error(
    'Brak konfiguracji. Skopiuj .env.example do .env i uzupełnij ' +
      'GMAIL_USER, GMAIL_APP_PASSWORD oraz RECIPIENT_EMAIL.'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/config', configHandler);
app.post('/api/send', sendHandler);

app.listen(PORT, () => {
  console.log(`Aplikacja działa: http://localhost:${PORT}`);
  console.log(`Maile będą wysyłane z ${GMAIL_USER} do ${RECIPIENT_EMAIL}`);
});
