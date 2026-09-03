// Zakładki + scalanie zdjęć w poziomie. Wszystko dzieje się w przeglądarce
// (canvas), więc nic nie jest wysyłane na serwer i nie dotyczą tego limity Vercela.
(() => {
  const card = document.getElementById('card');
  const tabButtons = [...document.querySelectorAll('.tab')];

  tabButtons.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabButtons.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        document.getElementById(t.dataset.panel).hidden = !active;
      });
      card.classList.toggle('wide', tab.dataset.panel === 'panel-merge');
    });
  });

  // --- Scalanie ---

  const MAX_PHOTOS = 10;
  const MAX_CANVAS_WIDTH = 16000; // powyżej tego przeglądarki przestają rysować
  const MAIL_LIMIT = 4 * 1024 * 1024;

  const input = document.getElementById('merge-input');
  const dropzone = document.getElementById('merge-dropzone');
  const dropzoneText = document.getElementById('merge-dropzone-text');
  const thumbsEl = document.getElementById('merge-thumbs');
  const runButton = document.getElementById('merge-run');
  const resultEl = document.getElementById('merge-result');
  const previewEl = document.getElementById('merge-preview');
  const metaEl = document.getElementById('merge-meta');
  const downloadEl = document.getElementById('merge-download');
  const toMailButton = document.getElementById('merge-to-mail');
  const statusEl = document.getElementById('merge-status');

  let items = [];
  let resultUrl = null;
  let resultBlob = null;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024
      ? Math.round(bytes / 1024) + ' KB'
      : (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    resultBlob = null;
    previewEl.removeAttribute('src');
    downloadEl.removeAttribute('href');
    resultEl.hidden = true;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Nie można wczytać'));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function render() {
    thumbsEl.innerHTML = '';

    items.forEach((item, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'thumb';

      const img = document.createElement('img');
      img.src = item.img.src;
      img.alt = item.file.name;
      thumb.appendChild(img);

      const bar = document.createElement('div');
      bar.className = 'thumb-bar';

      const left = document.createElement('button');
      left.type = 'button';
      left.textContent = '◀';
      left.title = 'Przesuń w lewo';
      left.disabled = index === 0;
      left.addEventListener('click', () => move(index, -1));

      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = index + 1;

      const right = document.createElement('button');
      right.type = 'button';
      right.textContent = '▶';
      right.title = 'Przesuń w prawo';
      right.disabled = index === items.length - 1;
      right.addEventListener('click', () => move(index, 1));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = 'Usuń';
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(items[index].img.src);
        items.splice(index, 1);
        clearResult();
        render();
      });

      bar.append(left, pos, right, remove);
      thumb.appendChild(bar);
      thumbsEl.appendChild(thumb);
    });

    runButton.disabled = items.length < 2;
    dropzoneText.textContent = items.length
      ? 'Dodaj kolejne zdjęcia (' + items.length + '/' + MAX_PHOTOS + ')'
      : 'Kliknij lub upuść zdjęcia tutaj';
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    clearResult();
    render();
  }

  async function addFiles(fileList) {
    const images = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      setStatus('Wybierz pliki graficzne.', 'err');
      return;
    }

    const room = MAX_PHOTOS - items.length;
    if (room <= 0) {
      setStatus('Możesz scalić maksymalnie ' + MAX_PHOTOS + ' zdjęć.', 'err');
      return;
    }

    const failed = [];
    for (const file of images.slice(0, room)) {
      try {
        items.push({ file, img: await loadImage(file) });
      } catch {
        failed.push(file.name);
      }
    }

    clearResult();
    render();

    if (failed.length) {
      setStatus('Nie udało się wczytać: ' + failed.join(', '), 'err');
    } else if (images.length > room) {
      setStatus('Dodano ' + room + ' zdjęć — limit to ' + MAX_PHOTOS + '.', 'err');
    } else {
      setStatus('');
    }
  }

  function merge() {
    // wszystkie zdjęcia skalujemy do wspólnej wysokości, żeby pasek był równy
    const targetHeight = Math.max(...items.map((i) => i.img.naturalHeight));
    let height = targetHeight;
    let widths = items.map((i) =>
      Math.max(1, Math.round(i.img.naturalWidth * (targetHeight / i.img.naturalHeight)))
    );
    let width = widths.reduce((a, b) => a + b, 0);

    let scaled = false;
    if (width > MAX_CANVAS_WIDTH) {
      const factor = MAX_CANVAS_WIDTH / width;
      height = Math.round(height * factor);
      widths = widths.map((w) => Math.max(1, Math.round(w * factor)));
      width = widths.reduce((a, b) => a + b, 0);
      scaled = true;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    let x = 0;
    items.forEach((item, index) => {
      ctx.drawImage(item.img, x, 0, widths[index], height);
      x += widths[index];
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus('Nie udało się przygotować pliku — spróbuj z mniejszą liczbą zdjęć.', 'err');
          runButton.disabled = false;
          return;
        }

        clearResult();
        resultBlob = blob;
        resultUrl = URL.createObjectURL(blob);
        previewEl.src = resultUrl;
        downloadEl.href = resultUrl;
        metaEl.textContent =
          width + ' × ' + height + ' px · ' + formatSize(blob.size) +
          (blob.size > MAIL_LIMIT ? ' · za duże do wysyłki mailem (limit 4 MB)' : '');
        resultEl.hidden = false;
        runButton.disabled = false;
        setStatus(scaled ? 'Scalono — obraz zmniejszono, bo był za szeroki.' : 'Scalono ✓', 'ok');
      },
      'image/jpeg',
      0.92
    );
  }

  input.addEventListener('change', () => {
    addFiles(input.files);
    input.value = '';
  });

  ['dragover', 'dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.toggle('dragover', type === 'dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  runButton.addEventListener('click', () => {
    if (items.length < 2) return;
    runButton.disabled = true;
    setStatus('Scalanie…');
    // oddajemy klatkę przeglądarce, żeby zdążyła pokazać komunikat
    setTimeout(merge, 0);
  });

  toMailButton.addEventListener('click', () => {
    if (!resultBlob) return;
    if (resultBlob.size > MAIL_LIMIT) {
      setStatus('Scalone zdjęcie ma ponad 4 MB — mailem się nie wyśle, ale możesz je pobrać.', 'err');
      return;
    }

    const photoInput = document.getElementById('photo');
    const transfer = new DataTransfer();
    transfer.items.add(new File([resultBlob], 'scalone.jpg', { type: 'image/jpeg' }));
    photoInput.files = transfer.files;
    photoInput.dispatchEvent(new Event('change'));

    document.querySelector('.tab[data-panel="panel-send"]').click();
  });

  render();
})();
