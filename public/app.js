const form = document.getElementById('form');
const titleInput = document.getElementById('title');
const messageInput = document.getElementById('message');
const photoInput = document.getElementById('photo');
const dropzone = document.getElementById('dropzone');
const dropzoneText = document.getElementById('dropzone-text');
const preview = document.getElementById('preview');
const sendButton = document.getElementById('send');
const statusEl = document.getElementById('status');

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

  const data = new FormData();
  data.append('title', titleInput.value.trim());
  data.append('message', messageInput.value.trim());
  data.append('photo', photoInput.files[0]);

  sendButton.disabled = true;
  setStatus('Wysyłanie…');

  try {
    const res = await fetch('/api/send', { method: 'POST', body: data });
    const body = await res.json();

    if (res.ok) {
      setStatus('Wysłano do ' + body.recipient + ' ✓', 'ok');
      form.reset();
      preview.hidden = true;
      preview.src = '';
      dropzoneText.textContent = 'Kliknij lub upuść zdjęcie tutaj';
    } else {
      setStatus(body.error || 'Coś poszło nie tak.', 'err');
    }
  } catch {
    setStatus('Brak połączenia z serwerem.', 'err');
  } finally {
    sendButton.disabled = false;
  }
});
