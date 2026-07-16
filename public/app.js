const MAX_FILE_SIZE = 4 * 1024 * 1024; // limit żądania na Vercelu to 4,5 MB

const form = document.getElementById('form');
const titleInput = document.getElementById('title');
const messageInput = document.getElementById('message');
const photoInput = document.getElementById('photo');
const dropzone = document.getElementById('dropzone');
const dropzoneText = document.getElementById('dropzone-text');
const preview = document.getElementById('preview');
const sendButton = document.getElementById('send');
const statusEl = document.getElementById('status');

// --- Domyślne tytuły (zapisywane w przeglądarce) ---

const PRESETS_KEY = 'titlePresets';
const MAX_PRESETS = 10;
const presetsEl = document.getElementById('presets');

function loadPresets() {
  try {
    const arr = JSON.parse(localStorage.getItem(PRESETS_KEY));
    return Array.isArray(arr) ? arr.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function renderPresets() {
  const presets = loadPresets();
  presetsEl.innerHTML = '';

  presets.forEach((title) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = title;
    chip.title = 'Kliknij, aby wstawić ten tytuł';

    const x = document.createElement('span');
    x.className = 'chip-x';
    x.textContent = '×';
    x.title = 'Usuń ten tytuł';
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      savePresets(loadPresets().filter((t) => t !== title));
      renderPresets();
    });
    chip.appendChild(x);

    chip.addEventListener('click', () => {
      titleInput.value = title;
      titleInput.focus();
      setStatus('');
    });

    presetsEl.appendChild(chip);
  });

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'chip chip-add';
  add.textContent = '+ Zapisz tytuł';
  add.title = 'Zapisz wpisany wyżej tytuł jako domyślny';
  add.addEventListener('click', () => {
    const title = titleInput.value.trim();
    if (!title) {
      setStatus('Najpierw wpisz tytuł, który chcesz zapisać.', 'err');
      return;
    }
    const current = loadPresets();
    if (current.includes(title)) {
      setStatus('Ten tytuł jest już zapisany.', 'err');
      return;
    }
    if (current.length >= MAX_PRESETS) {
      setStatus('Możesz zapisać maksymalnie ' + MAX_PRESETS + ' tytułów — usuń któryś (×).', 'err');
      return;
    }
    savePresets([...current, title]);
    renderPresets();
    setStatus('Zapisano tytuł domyślny ✓', 'ok');
  });
  presetsEl.appendChild(add);
}

renderPresets();

// --- Konfiguracja i wysyłka ---

fetch('/api/config')
  .then((res) => res.json())
  .then((cfg) => {
    document.getElementById('recipient').textContent = cfg.recipient;
  })
  .catch(() => {
    document.getElementById('recipient').textContent = 'błąd konfiguracji';
  });

function showPreview(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  dropzoneText.textContent = file.name;
}

photoInput.addEventListener('change', () => showPreview(photoInput.files[0]));

['dragover', 'dragleave', 'drop'].forEach((type) => {
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.toggle('dragover', type === 'dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    photoInput.files = dt.files;
    showPreview(file);
  }
});

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!titleInput.value.trim()) {
    setStatus('Podaj tytuł wiadomości.', 'err');
    return;
  }
  if (!photoInput.files[0]) {
    setStatus('Załącz zdjęcie.', 'err');
    return;
  }
  if (photoInput.files[0].size > MAX_FILE_SIZE) {
    setStatus('Zdjęcie jest za duże — maksymalny rozmiar to 4 MB.', 'err');
    return;
  }

  const data = new FormData();
  data.append('title', titleInput.value.trim());
  data.append('message', messageInput.value.trim());
  data.append('photo', photoInput.files[0]);

  sendButton.disabled = true;
  setStatus('Wysyłanie…');

  try {
    const res = await fetch('/api/send', { method: 'POST', body: data });
    let body = null;
    try {
      body = await res.json();
    } catch {
      // Vercel przy zbyt dużym żądaniu (413) zwraca odpowiedź bez JSON-a
    }

    if (res.ok) {
      setStatus('Wysłano do ' + body.recipient + ' ✓', 'ok');
      form.reset();
      titleInput.value = '';
      messageInput.value = '';
      photoInput.value = '';
      preview.hidden = true;
      preview.src = '';
      dropzoneText.textContent = 'Kliknij lub upuść zdjęcie tutaj';
      titleInput.focus();
    } else if (res.status === 413) {
      setStatus('Zdjęcie jest za duże — maksymalny rozmiar to 4 MB.', 'err');
    } else {
      setStatus((body && body.error) || 'Coś poszło nie tak.', 'err');
    }
  } catch {
    setStatus('Brak połączenia z serwerem.', 'err');
  } finally {
    sendButton.disabled = false;
  }
});
