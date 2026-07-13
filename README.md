# Gmail Photo Sender

Minimalistyczna aplikacja webowa do automatycznego wysyłania maili przez Gmaila,
gotowa do wdrożenia na **Vercel**. Załączasz zdjęcie, podajesz tytuł — mail wysyła
się sam na stałego, skonfigurowanego adresata.

## Jak to działa

- **Frontend** — czysty HTML/CSS/JS (`public/`): formularz z tytułem, opcjonalną treścią
  i polem na zdjęcie (klik lub przeciągnij i upuść, z podglądem). Na Vercelu serwowany
  jako pliki statyczne.
- **Backend** — funkcje serverless (`api/config.js`, `api/send.js`): przyjmują formularz,
  walidują dane i wysyłają maila przez SMTP Gmaila (Nodemailer). Zdjęcie nie jest
  zapisywane na dysku — z pamięci trafia prosto do załącznika.
- **Stały adresat** — ustawiany raz w zmiennych środowiskowych, frontend tylko go wyświetla.

## Wdrożenie na Vercel

### 1. Wygeneruj hasło aplikacji Google

Gmail nie pozwala logować się zwykłym hasłem z aplikacji zewnętrznych. Potrzebujesz
**hasła aplikacji**:

1. Włącz weryfikację dwuetapową na koncie Google (jeśli jeszcze nie masz):
   https://myaccount.google.com/security
2. Wejdź na https://myaccount.google.com/apppasswords
3. Utwórz nowe hasło aplikacji (np. o nazwie „Photo Sender") i skopiuj 16-znakowy kod.

### 2. Wdróż projekt

**Przez stronę Vercela (najprościej):**

1. Wejdź na https://vercel.com/new i zaimportuj to repozytorium z GitHuba.
2. Przed kliknięciem „Deploy" rozwiń sekcję **Environment Variables** i dodaj:

   | Nazwa | Wartość |
   |---|---|
   | `GMAIL_USER` | twój adres Gmail, np. `twoj.adres@gmail.com` |
   | `GMAIL_APP_PASSWORD` | 16-znakowe hasło aplikacji z kroku 1 |
   | `RECIPIENT_EMAIL` | stały adresat, np. `adresat@example.com` |

3. Kliknij **Deploy** — po chwili dostaniesz adres `https://twoj-projekt.vercel.app`.

**Albo przez CLI:**

```bash
npm i -g vercel
vercel
vercel env add GMAIL_USER
vercel env add GMAIL_APP_PASSWORD
vercel env add RECIPIENT_EMAIL
vercel --prod
```

Zmienne środowiskowe możesz później zmienić w panelu Vercela:
**Settings → Environment Variables** (po zmianie zrób redeploy).

## Uruchomienie lokalne

```bash
cp .env.example .env   # uzupełnij GMAIL_USER, GMAIL_APP_PASSWORD, RECIPIENT_EMAIL
npm install
npm start              # http://localhost:3000
```

Lokalny serwer (`server.js`) używa dokładnie tych samych handlerów co funkcje na Vercelu.
Możesz też użyć `vercel dev`, jeśli wolisz środowisko identyczne z produkcją.

## Limity

- Maksymalny rozmiar zdjęcia: **4 MB** — Vercel odrzuca żądania do funkcji serverless
  większe niż 4,5 MB.
- Akceptowane są tylko pliki graficzne (JPG, PNG, GIF, WEBP itd.).

## Bezpieczeństwo

- Plik `.env` z hasłem jest w `.gitignore` — nigdy nie trafi do repozytorium.
  Na Vercelu hasło trzymane jest w zmiennych środowiskowych projektu.
- Hasło aplikacji można w każdej chwili odwołać w ustawieniach konta Google,
  bez zmiany głównego hasła.
- **Uwaga:** wdrożona strona jest publiczna — każdy, kto zna adres, może wysłać
  maila na skonfigurowanego adresata. Jeśli chcesz ją chronić, włącz na Vercelu
  ochronę wdrożenia (Settings → Deployment Protection).
