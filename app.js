const state = {
  entries: [],
  filteredEntries: [],
  activeIndex: null,
  focusedIndex: null,
  selectedEntryIds: new Set(),
};

const harInput = document.getElementById('harInput');
const entrySearch = document.getElementById('entrySearch');
const statusFilter = document.getElementById('statusFilter');
const mimeFilter = document.getElementById('mimeFilter');
const selectAllVisible = document.getElementById('selectAllVisible');
const downloadSelectedResponsesBtn = document.getElementById('downloadSelectedResponsesBtn');
const downloadSelectedRequestsBtn = document.getElementById('downloadSelectedRequestsBtn');

const entryList = document.getElementById('entryList');
const entryTemplate = document.getElementById('entryTemplate');
const entryCount = document.getElementById('entryCount');
const details = document.getElementById('details');
const detailsEmpty = document.getElementById('detailsEmpty');
const requestSummary = document.getElementById('requestSummary');
const responseMeta = document.getElementById('responseMeta');
const requestMeta = document.getElementById('requestMeta');
const responsePreview = document.getElementById('responsePreview');
const requestPreview = document.getElementById('requestPreview');
const requestHeaders = document.getElementById('requestHeaders');
const responseHeaders = document.getElementById('responseHeaders');
const downloadResponseBtn = document.getElementById('downloadResponseBtn');
const downloadRequestBtn = document.getElementById('downloadRequestBtn');

harInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const entries = data?.log?.entries;

    if (!Array.isArray(entries)) {
      throw new Error('HAR file missing log.entries array.');
    }

    state.entries = entries.map((entry, index) => ({ ...entry, __entryId: `entry-${index}` }));
    state.selectedEntryIds.clear();
    state.activeIndex = null;
    state.focusedIndex = state.entries.length ? 0 : null;

    entrySearch.value = '';
    statusFilter.value = '';
    mimeFilter.value = '';

    applyFilters();
    showEmptyDetails();
    focusEntryButton(state.focusedIndex);
  } catch (error) {
    alert(`Failed to parse HAR file: ${error.message}`);
  }
});

entrySearch.addEventListener('input', () => {
  applyFilters();
  if (state.activeIndex === null) {
    showEmptyDetails();
  }
});
statusFilter.addEventListener('input', applyFilters);
mimeFilter.addEventListener('input', applyFilters);

selectAllVisible.addEventListener('change', () => {
  for (const entry of state.filteredEntries) {
    if (selectAllVisible.checked) {
      state.selectedEntryIds.add(entry.__entryId);
    } else {
      state.selectedEntryIds.delete(entry.__entryId);
    }
  }
  renderEntryList();
});

downloadSelectedResponsesBtn.addEventListener('click', () => {
  const selected = getSelectedEntries();
  if (!selected.length) {
    alert('No selected entries to download.');
    return;
  }

  selected.forEach((entry, idx) => {
    const content = entry?.response?.content ?? {};
    downloadBody(content.text, content.encoding, content.mimeType, `response-${idx + 1}`);
  });
});

downloadSelectedRequestsBtn.addEventListener('click', () => {
  const selected = getSelectedEntries();
  if (!selected.length) {
    alert('No selected entries to download.');
    return;
  }

  selected.forEach((entry, idx) => {
    const post = entry?.request?.postData ?? {};
    downloadBody(post.text, undefined, post.mimeType, `request-${idx + 1}`);
  });
});

document.querySelectorAll('.tab-btn').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    const tab = tabBtn.dataset.tab;

    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

function applyFilters() {
  const query = entrySearch.value.trim().toLowerCase();
  const status = statusFilter.value.trim();
  const mime = mimeFilter.value.trim().toLowerCase();

  state.filteredEntries = state.entries.filter((entry) => {
    const method = entry?.request?.method ?? '';
    const url = entry?.request?.url ?? '';
    const responseStatus = String(entry?.response?.status ?? '');
    const mediaType = (entry?.response?.content?.mimeType ?? '').toLowerCase();

    const queryMatch = `${method} ${url} ${responseStatus}`.toLowerCase().includes(query);
    const statusMatch = !status || responseStatus === status;
    const mimeMatch = !mime || mediaType.includes(mime);

    return queryMatch && statusMatch && mimeMatch;
  });

  if (state.activeIndex !== null && state.activeIndex >= state.filteredEntries.length) {
    state.activeIndex = null;
  }

  if (state.focusedIndex !== null && state.focusedIndex >= state.filteredEntries.length) {
    state.focusedIndex = state.filteredEntries.length ? 0 : null;
  }

  renderEntryList();
  focusEntryButton(state.focusedIndex, false);
}

function renderEntryList() {
  entryList.innerHTML = '';

  if (!state.filteredEntries.length) {
    const li = document.createElement('li');
    li.textContent = 'No entries match the filter.';
    li.className = 'empty';
    entryList.appendChild(li);
    entryCount.textContent = state.entries.length ? '0 shown after filtering' : 'No entries loaded';
    selectAllVisible.checked = false;
    return;
  }

  entryCount.textContent = `${state.filteredEntries.length} shown / ${state.entries.length} total`;

  state.filteredEntries.forEach((entry, index) => {
    const method = entry?.request?.method ?? 'UNKNOWN';
    const url = entry?.request?.url ?? 'Unknown URL';
    const status = entry?.response?.status ?? 0;
    const type = entry?.response?.content?.mimeType ?? 'unknown';

    const fragment = entryTemplate.content.cloneNode(true);
    const button = fragment.querySelector('.entry-button');
    const checkbox = fragment.querySelector('.entry-select');
    const main = fragment.querySelector('.entry-main');
    const sub = fragment.querySelector('.entry-sub');

    main.textContent = `${method} ${url}`;
    const bucket = status ? Math.floor(status / 100) : 0;
    const statusClass = bucket >= 2 && bucket <= 5 ? `status-${bucket}` : '';
    sub.innerHTML = `${status ? `<span class="status-pill ${statusClass}">${status}</span>` : ''}${type}`;

    checkbox.checked = state.selectedEntryIds.has(entry.__entryId);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedEntryIds.add(entry.__entryId);
      } else {
        state.selectedEntryIds.delete(entry.__entryId);
      }
      syncSelectAllVisible();
    });

    button.dataset.index = String(index);
    button.tabIndex = state.focusedIndex === index ? 0 : -1;

    if (index === state.activeIndex) {
      button.classList.add('active');
    }

    button.addEventListener('focus', () => {
      state.focusedIndex = index;
      updateRovingFocus();
    });

    button.addEventListener('click', () => {
      selectEntry(index);
    });

    button.addEventListener('keydown', (event) => {
      handleEntryKeydown(event, index);
    });

    entryList.appendChild(fragment);
  });

  updateRovingFocus();
  syncSelectAllVisible();
}

function syncSelectAllVisible() {
  if (!state.filteredEntries.length) {
    selectAllVisible.checked = false;
    return;
  }

  selectAllVisible.checked = state.filteredEntries.every((entry) => state.selectedEntryIds.has(entry.__entryId));
}

function getSelectedEntries() {
  return state.entries.filter((entry) => state.selectedEntryIds.has(entry.__entryId));
}

function showEmptyDetails() {
  details.hidden = true;
  detailsEmpty.hidden = false;
}

function selectEntry(index) {
  const entry = state.filteredEntries[index];
  if (!entry) return;

  state.activeIndex = index;
  state.focusedIndex = index;
  renderEntryList();
  renderDetails(entry);

  focusEntryButton(index);
}

function isSelectKey(key) {
  return key === 'Enter' || key === ' ' || key === 'Space' || key === 'Spacebar';
}

function handleEntryKeydown(event, index) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFocus(index + 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocus(index - 1);
    return;
  }

  if (isSelectKey(event.key)) {
    event.preventDefault();
    selectEntry(index);
  }
}

function moveFocus(nextIndex) {
  if (!state.filteredEntries.length) return;

  const safeIndex = Math.max(0, Math.min(nextIndex, state.filteredEntries.length - 1));
  state.focusedIndex = safeIndex;
  updateRovingFocus();
  focusEntryButton(safeIndex);
}

function focusEntryButton(index, shouldFocus = true) {
  if (index === null || index === undefined) return;

  const button = entryList.querySelector(`.entry-button[data-index="${index}"]`);
  if (button) {
    if (shouldFocus) {
      button.focus();
    }
    button.scrollIntoView({ block: 'nearest' });
  }
}

function updateRovingFocus() {
  entryList.querySelectorAll('.entry-button').forEach((button) => {
    const idx = Number(button.dataset.index);
    button.tabIndex = idx === state.focusedIndex ? 0 : -1;
  });
}

function renderDetails(entry) {
  details.hidden = false;
  detailsEmpty.hidden = true;

  const request = entry.request ?? {};
  const response = entry.response ?? {};
  const content = response.content ?? {};

  requestSummary.textContent = `${request.method ?? 'UNKNOWN'} ${request.url ?? 'Unknown URL'}`;
  responseMeta.textContent = `${response.status ?? ''} ${response.statusText ?? ''} • MIME: ${content.mimeType ?? 'unknown'} • Size: ${formatBytes(content.size ?? 0)}`;

  const requestSize = request.bodySize ?? (request.postData?.text?.length ?? 0);
  requestMeta.textContent = `Payload size: ${formatBytes(requestSize)} • HTTP version: ${request.httpVersion ?? 'n/a'}`;

  requestHeaders.textContent = headersToText(request.headers);
  responseHeaders.textContent = headersToText(response.headers);

  renderBodyPreview(responsePreview, content.text, content.encoding, content.mimeType, 'response');
  renderBodyPreview(requestPreview, request.postData?.text, undefined, request.postData?.mimeType, 'request');

  downloadResponseBtn.onclick = () => downloadBody(content.text, content.encoding, content.mimeType, 'response');
  downloadRequestBtn.onclick = () => downloadBody(request.postData?.text, undefined, request.postData?.mimeType, 'request');
}

function headersToText(headers = []) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return 'No headers available.';
  }
  return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

function renderBodyPreview(container, text, encoding, mimeType = '', label = 'content') {
  container.innerHTML = '';
  if (!text) {
    container.textContent = `No ${label} body available.`;
    return;
  }

  const normalizedMime = (mimeType || '').toLowerCase();
  const base64Data = encoding === 'base64' ? text : toBase64(text);

  if (normalizedMime.startsWith('image/')) {
    const image = document.createElement('img');
    image.alt = `${label} preview image`;
    image.src = `data:${normalizedMime};base64,${base64Data}`;
    container.appendChild(image);
    return;
  }

  if (normalizedMime.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = `data:${normalizedMime};base64,${base64Data}`;
    container.appendChild(video);
    return;
  }

  if (normalizedMime.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = `data:${normalizedMime};base64,${base64Data}`;
    container.appendChild(audio);
    return;
  }

  const decoded = encoding === 'base64' ? decodeBase64(text) : text;

  if (normalizedMime.includes('json')) {
    try {
      const json = JSON.parse(decoded);
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(json, null, 2);
      container.appendChild(pre);
      return;
    } catch {
      // fall through to plain text
    }
  }

  const pre = document.createElement('pre');
  pre.textContent = decoded;
  container.appendChild(pre);
}

function downloadBody(text, encoding, mimeType = '', prefix = 'payload') {
  if (!text) {
    return;
  }

  let blob;
  if (encoding === 'base64') {
    const bytes = Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
    blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  } else {
    blob = new Blob([text], { type: mimeType || 'text/plain;charset=utf-8' });
  }

  const ext = mimeToExt(mimeType);
  const fileName = `${prefix}-${Date.now()}.${ext}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(text) {
  try {
    return decodeURIComponent(escape(atob(text)));
  } catch {
    return atob(text);
  }
}

function mimeToExt(mime = '') {
  const main = mime.split(';')[0].trim().toLowerCase();
  const map = {
    'application/json': 'json',
    'text/html': 'html',
    'text/plain': 'txt',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'audio/mpeg': 'mp3',
    'video/mp4': 'mp4',
  };
  return map[main] ?? (main.split('/')[1] || 'bin');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 2)} ${units[exp]}`;
}
