# Gmail Photo Sender

Minimalistyczna aplikacja webowa do automatycznego wysyłania maili przez Gmaila.
Załączasz zdjęcie, podajesz tytuł — mail wysyła się sam na stałego, skonfigurowanego adresata.

## Jak to działa

- **Frontend** — czysty HTML/CSS/JS (`public/`): formularz z tytułem, opcjonalną treścią
  i polem na zdjęcie (klik lub przeciągnij i upuść, z podglądem).
- **Backend** — Node.js + Express (`server.js`): przyjmuje formularz, waliduje dane
  i wysyła maila przez SMTP Gmaila (Nodemailer). Zdjęcie nie jest zapisywane na dysku —
  trafia z pamięci prosto do załącznika.
- **Stały adresat** — ustawiany raz w pliku `.env`, frontend tylko go wyświetla.

## Uruchomienie

### 1. Wygeneruj hasło aplikacji Google

Gmail nie pozwala logować się zwykłym hasłem z aplikacji zewnętrznych. Potrzebujesz
**hasła aplikacji**:

1. Włącz weryfikację dwuetapową na koncie Google (jeśli jeszcze nie masz):
   https://myaccount.google.com/security
2. Wejdź na https://myaccount.google.com/apppasswords
3. Utwórz nowe hasło aplikacji (np. o nazwie „Photo Sender") i skopiuj 16-znakowy kod.

### 2. Skonfiguruj aplikację

```bash
cp .env.example .env
```

Otwórz `.env` i uzupełnij:

```
GMAIL_USER=twoj.adres@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
RECIPIENT_EMAIL=adresat@example.com
```

### 3. Zainstaluj zależności i wystartuj

```bash
npm install
npm start
```

Aplikacja działa pod adresem http://localhost:3000

## Limity

- Maksymalny rozmiar zdjęcia: **15 MB** (limit Gmaila na całą wiadomość to 25 MB).
- Akceptowane są tylko pliki graficzne (JPG, PNG, GIF, WEBP itd.).

## Bezpieczeństwo

- Plik `.env` z hasłem jest w `.gitignore` — nigdy nie trafi do repozytorium.
- Hasło aplikacji można w każdej chwili odwołać w ustawieniach konta Google,
  bez zmiany głównego hasła.
