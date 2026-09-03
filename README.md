# Gmail Photo Sender

Minimalistyczna aplikacja webowa do automatycznego wysyłania maili przez Gmaila,
gotowa do wdrożenia na **Vercel**. Załączasz zdjęcie, podajesz tytuł — mail wysyła
się sam na stałego, skonfigurowanego adresata.

## Jak to działa

Aplikacja ma dwie zakładki:

- **Wyślij** — formularz maila ze zdjęciem.
- **Scal zdjęcia** — łączenie kilku zdjęć w jeden poziomy pasek, z pobraniem wyniku
  albo przekazaniem go od razu do formularza wysyłki. Scalanie dzieje się w całości
  w przeglądarce (canvas), więc nic nie leci na serwer.

Pod spodem:

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

## Scalanie zdjęć

W zakładce **Scal zdjęcia** wybierasz od 2 do 10 zdjęć, ustawiasz ich kolejność
strzałkami ◀ ▶ i klikasz **Scal zdjęcia**. Wszystkie są skalowane do wspólnej wysokości
i sklejane w poziomy pasek — np. trzy zdjęcia 1000 × 1333 px dają wynik 3000 × 1333 px.
Gotowy obraz zapisujesz przyciskiem **Pobierz** (JPEG, zawsze pod nazwą `pro1.jpg`)
albo wstawiasz go do formularza maila przyciskiem **Użyj w mailu**.

### Nadpisywanie pliku

Strona nadaje plikowi nazwę `pro1.jpg`, ale o tym, co zrobić z już istniejącym plikiem,
decyduje przeglądarka — Chrome domyślnie dokłada `pro1 (1).jpg`, `pro1 (2).jpg` itd.
Strona nie ma nad tym żadnej kontroli. Realnie nadpisać plik można na dwa sposoby:

- **Ręcznie:** przycisk **Zapisz i nadpisz** — za pierwszym razem wybierasz miejsce
  zapisu, każdy kolejny zapis nadpisuje dokładnie ten sam plik. Wymaga przeglądarki
  z File System Access API (Chrome, Edge); tam, gdzie go nie ma, przycisk się nie pokazuje.
- **W automacie:** blok **Handle Download** w Automie, pole *File name* = `pro1.jpg`
  i *On conflict* = **overwrite**.

## Sterowanie automatem (Automa)

Zakładka scalania jest przygotowana pod automatyzację — bez losowych identyfikatorów,
które psują workflow.

### Stałe selektory

Każdy element ma atrybut `data-automa`, niezależny od wyglądu strony:

| Selektor | Element |
|---|---|
| `[data-automa="tab-merge"]` / `[data-automa="tab-send"]` | przełączniki zakładek |
| `[data-automa="merge-input"]` | pole na zdjęcia (blok **Upload file**) |
| `[data-automa="merge-run"]` | przycisk „Scal zdjęcia" |
| `[data-automa="merge-clear"]` | przycisk „Wyczyść" |
| `[data-automa="merge-download"]` | przycisk „Pobierz" (plik `pro1.jpg`) |
| `[data-automa="merge-save"]` | przycisk „Zapisz i nadpisz" |
| `[data-automa="merge-to-mail"]` | przycisk „Użyj w mailu" |
| `[data-automa="merge-status"]` | komunikat tekstowy |
| `[data-automa="title"]`, `[data-automa="photo"]`, `[data-automa="send"]` | formularz maila |

### Stan czytelny maszynowo

Zamiast zgadywać, kiedy praca się skończyła, poczekaj na atrybut (blok **Element exists**
z selektorem):

- `#panel-merge[data-state="idle"]` — czeka na zdjęcia
- `#panel-merge[data-state="merging"]` — scalanie w toku
- `#panel-merge[data-state="done"]` — gotowe
- `#panel-merge[data-state="error"]` — błąd, treść w `data-error`
- dodatkowo: `data-photos` (liczba zdjęć), `data-ready` (`true`, gdy można scalać)
- po scaleniu na `#merge-result`: `data-width`, `data-height`, `data-size` (bajty)

### Sterowanie adresem URL

- `https://twoja-strona.vercel.app/#merge` — otwiera od razu zakładkę scalania
- `?automerge=1` — scala samo, gdy tylko trafią tam co najmniej 2 zdjęcia
- `?autodownload=1` — pobiera wynik od razu po scaleniu

Najprostszy workflow to więc: **New tab** na
`https://twoja-strona.vercel.app/?automerge=1&autodownload=1#merge` → **Upload file**
na `[data-automa="merge-input"]` → **Element exists** na `#panel-merge[data-state="done"]`.
Żadnego klikania.

### API w JavaScript

W bloku **JavaScript Code** dostępny jest `window.photoMerge`:

```javascript
// scal i oddaj wynik do kolejnego bloku
const state = await window.photoMerge.merge();
automaNextBlock({ ok: state.state === 'done', ...state.result });
```

Dostępne metody: `open()`, `addFiles(files)`, `merge()`, `download()`, `save()`,
`useInMail()`, `clear()`, `state()` oraz `dataUrl()` (zwraca scalone zdjęcie jako base64);
pole `fileName` zawiera nazwę pliku (`pro1.jpg`).

Pole na zdjęcia działa też wtedy, gdy automat podstawi pliki bez zdarzenia `change` —
strona sprawdza je dodatkowo co pół sekundy.

## Limity

- Maksymalny rozmiar zdjęcia w mailu: **4 MB** — Vercel odrzuca żądania do funkcji
  serverless większe niż 4,5 MB. Scalanie nie podlega temu limitowi (dzieje się
  lokalnie), ale wynik powyżej 4 MB nada się już tylko do pobrania.
- Scalanie: maksymalnie 10 zdjęć, wynik nie szerszy niż 16000 px (szersze są
  proporcjonalnie zmniejszane).
- Akceptowane są tylko pliki graficzne (JPG, PNG, GIF, WEBP itd.). Scalanie obsługuje
  formaty, które potrafi wyświetlić przeglądarka — HEIC z iPhone'a zadziała w Safari,
  ale nie w Chrome.

## Bezpieczeństwo

- Plik `.env` z hasłem jest w `.gitignore` — nigdy nie trafi do repozytorium.
  Na Vercelu hasło trzymane jest w zmiennych środowiskowych projektu.
- Hasło aplikacji można w każdej chwili odwołać w ustawieniach konta Google,
  bez zmiany głównego hasła.
- **Uwaga:** wdrożona strona jest publiczna — każdy, kto zna adres, może wysłać
  maila na skonfigurowanego adresata. Jeśli chcesz ją chronić, włącz na Vercelu
  ochronę wdrożenia (Settings → Deployment Protection).
