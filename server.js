require('dotenv').config();

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const { GMAIL_USER, GMAIL_APP_PASSWORD, RECIPIENT_EMAIL } = process.env;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !RECIPIENT_EMAIL) {
  console.error(
    'Brak konfiguracji. Skopiuj .env.example do .env i uzupełnij ' +
      'GMAIL_USER, GMAIL_APP_PASSWORD oraz RECIPIENT_EMAIL.'
  );
  process.exit(1);
}

// Zdjęcie trzymane w pamięci — trafia prosto do maila, nie zapisujemy na dysku
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // limit Gmaila to 25 MB na całą wiadomość
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Dozwolone są tylko pliki graficzne (JPG, PNG, GIF, WEBP...).'));
    }
  },
});

const transporter = nodemailer.createTransport({
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
});

app.use(express.static(path.join(__dirname, 'public')));

// Frontend pokazuje użytkownikowi, dokąd pójdzie mail
app.get('/api/config', (req, res) => {
  res.json({ recipient: RECIPIENT_EMAIL, sender: GMAIL_USER });
});

app.post('/api/send', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Zdjęcie jest za duże — maksymalny rozmiar to 15 MB.'
          : err.message;
      return res.status(400).json({ error: message });
    }

    const title = (req.body.title || '').trim();
    const message = (req.body.message || '').trim();

    if (!title) {
      return res.status(400).json({ error: 'Podaj tytuł wiadomości.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Załącz zdjęcie.' });
    }

    try {
      await transporter.sendMail({
        from: `"Gmail Photo Sender" <${GMAIL_USER}>`,
        to: RECIPIENT_EMAIL,
        subject: title,
        text: message || title,
        attachments: [
          {
            filename: req.file.originalname || 'zdjecie',
            content: req.file.buffer,
            contentType: req.file.mimetype,
          },
        ],
      });

      res.json({ ok: true, recipient: RECIPIENT_EMAIL });
    } catch (mailErr) {
      console.error('Błąd wysyłki:', mailErr.message);
      let hint = 'Nie udało się wysłać maila. Spróbuj ponownie za chwilę.';
      if (mailErr.code === 'EAUTH') {
        hint = 'Błąd logowania do Gmaila — sprawdź GMAIL_USER i GMAIL_APP_PASSWORD w pliku .env.';
      } else if (mailErr.code === 'ETIMEDOUT' || mailErr.code === 'ESOCKET' || mailErr.code === 'ECONNECTION') {
        hint = 'Brak połączenia z serwerem Gmaila — sprawdź internet lub zaporę sieciową.';
      }
      res.status(502).json({ error: hint });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Aplikacja działa: http://localhost:${PORT}`);
  console.log(`Maile będą wysyłane z ${GMAIL_USER} do ${RECIPIENT_EMAIL}`);
});
