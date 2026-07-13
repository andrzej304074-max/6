const busboy = require('busboy');
const { isConfigured, RECIPIENT_EMAIL, sendPhotoMail } = require('../lib/mail');

// Vercel odrzuca żądania powyżej 4,5 MB, więc zdjęcie ograniczamy do 4 MB
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function parseForm(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = busboy({
        headers: req.headers,
        limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 10 },
      });
    } catch {
      const err = new Error('Nieprawidłowe żądanie — oczekiwano formularza z plikiem.');
      err.status = 400;
      return reject(err);
    }

    const fields = {};
    let file = null;
    let fileTooLarge = false;
    let badFileType = false;

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('file', (name, stream, info) => {
      if (name !== 'photo' || !info.mimeType.startsWith('image/')) {
        badFileType = true;
        stream.resume();
        return;
      }
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        fileTooLarge = true;
      });
      stream.on('close', () => {
        if (!fileTooLarge) {
          file = {
            filename: info.filename,
            mimeType: info.mimeType,
            buffer: Buffer.concat(chunks),
          };
        }
      });
    });

    bb.on('error', reject);
    bb.on('close', () => resolve({ fields, file, fileTooLarge, badFileType }));

    req.pipe(bb);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Dozwolona jest tylko metoda POST.' });
  }

  if (!isConfigured) {
    return res.status(500).json({
      error:
        'Serwer nie jest skonfigurowany — ustaw zmienne środowiskowe ' +
        'GMAIL_USER, GMAIL_APP_PASSWORD i RECIPIENT_EMAIL.',
    });
  }

  let parsed;
  try {
    parsed = await parseForm(req);
  } catch (err) {
    return res
      .status(err.status || 400)
      .json({ error: err.message || 'Nie udało się odczytać formularza.' });
  }

  const title = (parsed.fields.title || '').trim();
  const message = (parsed.fields.message || '').trim();

  if (!title) {
    return res.status(400).json({ error: 'Podaj tytuł wiadomości.' });
  }
  if (parsed.fileTooLarge) {
    return res.status(400).json({ error: 'Zdjęcie jest za duże — maksymalny rozmiar to 4 MB.' });
  }
  if (parsed.badFileType) {
    return res
      .status(400)
      .json({ error: 'Dozwolone są tylko pliki graficzne (JPG, PNG, GIF, WEBP...).' });
  }
  if (!parsed.file) {
    return res.status(400).json({ error: 'Załącz zdjęcie.' });
  }

  try {
    await sendPhotoMail({ title, message, file: parsed.file });
    res.status(200).json({ ok: true, recipient: RECIPIENT_EMAIL });
  } catch (mailErr) {
    console.error('Błąd wysyłki:', mailErr.message);
    let hint = 'Nie udało się wysłać maila. Spróbuj ponownie za chwilę.';
    if (mailErr.code === 'EAUTH') {
      hint = 'Błąd logowania do Gmaila — sprawdź zmienne GMAIL_USER i GMAIL_APP_PASSWORD.';
    } else if (
      mailErr.code === 'ETIMEDOUT' ||
      mailErr.code === 'ESOCKET' ||
      mailErr.code === 'ECONNECTION'
    ) {
      hint = 'Brak połączenia z serwerem Gmaila — spróbuj ponownie za chwilę.';
    }
    res.status(502).json({ error: hint });
  }
};
