// Zakładki + scalanie zdjęć w poziomie. Wszystko dzieje się w przeglądarce
// (canvas), więc nic nie jest wysyłane na serwer i nie dotyczą tego limity Vercela.
//
// Sekcja jest przygotowana pod automatyzację (Automa i podobne):
//  - stałe selektory [data-automa="..."] — nie zmieniają się przy zmianach wyglądu,
//  - stan czytelny maszynowo: #panel-merge[data-state] = idle|merging|done|error,
//    plus data-photos, data-ready, a po scaleniu data-width/height/size na #merge-result,
//  - sterowanie adresem URL: #merge (otwiera zakładkę), ?automerge=1, ?autodownload=1,
//  - API w window.photoMerge (open, addFiles, merge, download, clear, state, dataUrl).
(() => {
  const card = document.getElementById('card');
  const tabButtons = [...document.querySelectorAll('.tab')];

  function openTab(name) {
    const target = document.querySelector('.tab[data-panel="panel-' + name + '"]');
    if (!target) return false;
    tabButtons.forEach((t) => {
      const active = t === target;
      t.classList.toggle('active', active);
      document.getElementById(t.dataset.panel).hidden = !active;
    });
    card.classList.toggle('wide', name === 'merge');
    history.replaceState(null, '', '#' + name);
    return true;
  }

  tabButtons.forEach((tab) => {
    tab.addEventListener('click', () => openTab(tab.dataset.panel.replace('panel-', '')));
  });

  // --- Scalanie ---

  const MAX_PHOTOS = 10;
  const MAX_CANVAS_WIDTH = 16000; // powyżej tego przeglądarki przestają rysować
  const MAIL_LIMIT = 4 * 1024 * 1024;

  const panel = document.getElementById('panel-merge');
  const input = document.getElementById('merge-input');
  const dropzone = document.getElementById('merge-dropzone');
  const dropzoneText = document.getElementById('merge-dropzone-text');
  const thumbsEl = document.getElementById('merge-thumbs');
  const runButton = document.getElementById('merge-run');
  const clearButton = document.getElementById('merge-clear');
  const resultEl = document.getElementById('merge-result');
  const previewEl = document.getElementById('merge-preview');
  const metaEl = document.getElementById('merge-meta');
  const downloadEl = document.getElementById('merge-download');
  const toMailButton = document.getElementById('merge-to-mail');
  const statusEl = document.getElementById('merge-status');

  const params = new URLSearchParams(location.search);
  const autoMerge = params.get('automerge') === '1';
  const autoDownload = params.get('autodownload') === '1';

  let items = [];
  let resultUrl = null;
  let resultBlob = null;
  let resultInfo = null;
  let busy = false;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  // Stan wystawiony w atrybutach — automatyzacja czeka na #panel-merge[data-state="done"]
  function setState(state, error) {
    panel.dataset.state = state;
    panel.dataset.photos = items.length;
    panel.dataset.ready = items.length >= 2 ? 'true' : 'false';
    if (error) {
      panel.dataset.error = error;
    } else {
      delete panel.dataset.error;
    }
  }

  function fail(message) {
    setStatus(message, 'err');
    setState('error', message);
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
    resultInfo = null;
    previewEl.removeAttribute('src');
    downloadEl.removeAttribute('href');
    ['width', 'height', 'size'].forEach((key) => delete resultEl.dataset[key]);
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
      thumb.dataset.automa = 'thumb';
      thumb.dataset.index = index + 1;

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
      left.dataset.automa = 'thumb-left';
      left.disabled = index === 0;
      left.addEventListener('click', () => move(index, -1));

      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = index + 1;

      const right = document.createElement('button');
      right.type = 'button';
      right.textContent = '▶';
      right.title = 'Przesuń w prawo';
      right.dataset.automa = 'thumb-right';
      right.disabled = index === items.length - 1;
      right.addEventListener('click', () => move(index, 1));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = 'Usuń';
      remove.dataset.automa = 'thumb-remove';
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(items[index].img.src);
        items.splice(index, 1);
        clearResult();
        render();
        setState('idle');
      });

      bar.append(left, pos, right, remove);
      thumb.appendChild(bar);
      thumbsEl.appendChild(thumb);
    });

    runButton.disabled = items.length < 2 || busy;
    clearButton.hidden = items.length === 0;
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
    setState('idle');
  }

  function clearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.img.src));
    items = [];
    clearResult();
    render();
    setState('idle');
    setStatus('');
    return state();
  }

  async function addFiles(fileList) {
    const images = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      fail('Wybierz pliki graficzne.');
      return state();
    }

    const room = MAX_PHOTOS - items.length;
    if (room <= 0) {
      fail('Możesz scalić maksymalnie ' + MAX_PHOTOS + ' zdjęć.');
      return state();
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
      fail('Nie udało się wczytać: ' + failed.join(', '));
    } else if (images.length > room) {
      fail('Dodano ' + room + ' zdjęć — limit to ' + MAX_PHOTOS + '.');
    } else {
      setStatus('');
      setState('idle');
    }

    if (autoMerge && items.length >= 2 && !failed.length) return merge();
    return state();
  }

  function merge() {
    if (busy) return Promise.resolve(state());
    if (items.length < 2) {
      fail('Dodaj co najmniej 2 zdjęcia.');
      return Promise.resolve(state());
    }

    busy = true;
    runButton.disabled = true;
    setStatus('Scalanie…');
    setState('merging');

    return new Promise((resolve) => {
      // oddajemy klatkę przeglądarce, żeby zdążyła pokazać stan „merging"
      setTimeout(() => {
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
            busy = false;
            render();

            if (!blob) {
              fail('Nie udało się przygotować pliku — spróbuj z mniejszą liczbą zdjęć.');
              resolve(state());
              return;
            }

            clearResult();
            resultBlob = blob;
            resultUrl = URL.createObjectURL(blob);
            resultInfo = { width, height, size: blob.size };

            previewEl.src = resultUrl;
            downloadEl.href = resultUrl;
            resultEl.dataset.width = width;
            resultEl.dataset.height = height;
            resultEl.dataset.size = blob.size;
            resultEl.hidden = false;

            metaEl.textContent =
              width + ' × ' + height + ' px · ' + formatSize(blob.size) +
              (blob.size > MAIL_LIMIT ? ' · za duże do wysyłki mailem (limit 4 MB)' : '');

            setStatus(scaled ? 'Scalono — obraz zmniejszono, bo był za szeroki.' : 'Scalono ✓', 'ok');
            setState('done');

            if (autoDownload) download();
            resolve(state());
          },
          'image/jpeg',
          0.92
        );
      }, 0);
    });
  }

  function download() {
    if (!resultBlob) return null;
    downloadEl.click();
    return downloadEl.getAttribute('download');
  }

  function useInMail() {
    if (!resultBlob) return false;
    if (resultBlob.size > MAIL_LIMIT) {
      fail('Scalone zdjęcie ma ponad 4 MB — mailem się nie wyśle, ale możesz je pobrać.');
      return false;
    }

    const photoInput = document.getElementById('photo');
    const transfer = new DataTransfer();
    transfer.items.add(new File([resultBlob], 'scalone.jpg', { type: 'image/jpeg' }));
    photoInput.files = transfer.files;
    photoInput.dispatchEvent(new Event('change'));

    openTab('send');
    return true;
  }

  function state() {
    return {
      state: panel.dataset.state,
      photos: items.length,
      ready: items.length >= 2,
      error: panel.dataset.error || null,
      result: resultInfo,
    };
  }

  // --- Zdarzenia interfejsu ---

  function takeFiles() {
    if (!input.files || !input.files.length) return;
    // FileList jest żywy — kopiujemy go, zanim czyszczenie pola go opróżni
    const files = [...input.files];
    input.value = '';
    addFiles(files);
  }

  input.addEventListener('change', takeFiles);
  input.addEventListener('input', takeFiles);
  // zapasowo, gdyby automatyzacja podstawiła pliki bez zdarzenia change
  setInterval(takeFiles, 500);

  ['dragover', 'dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.toggle('dragover', type === 'dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  runButton.addEventListener('click', () => merge());
  clearButton.addEventListener('click', clearAll);
  toMailButton.addEventListener('click', useInMail);

  // --- Start ---

  render();
  setState('idle');

  const wanted = (location.hash.replace('#', '') || params.get('tab') || '').toLowerCase();
  if (wanted === 'merge' || wanted === 'scal') openTab('merge');

  // API dla automatyzacji (blok „JavaScript Code" w Automie)
  window.photoMerge = {
    version: 1,
    open: () => openTab('merge'),
    addFiles,
    merge,
    download,
    useInMail,
    clear: clearAll,
    state,
    dataUrl: () =>
      new Promise((resolve, reject) => {
        if (!resultBlob) return reject(new Error('Brak scalonego zdjęcia'));
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
        reader.readAsDataURL(resultBlob);
      }),
  };
})();
