const harFileInput = document.getElementById('harFile');
const searchInput = document.getElementById('search');
const summaryEl = document.getElementById('summary');
const entryListEl = document.getElementById('entryList');
const detailTitleEl = document.getElementById('detailTitle');
const detailsEl = document.getElementById('details');
const entryTemplate = document.getElementById('entryTemplate');

/** @type {Array<any>} */
let allEntries = [];
/** @type {Array<any>} */
let filteredEntries = [];
let selectedIndex = -1;

harFileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const entries = parsed?.log?.entries;
    if (!Array.isArray(entries)) {
      throw new Error('Invalid HAR format. Missing log.entries array.');
    }

    allEntries = entries;
    filteredEntries = entries;
    selectedIndex = -1;
    searchInput.disabled = false;
    searchInput.value = '';

    summaryEl.innerHTML = [
      `<strong>File:</strong> ${escapeHtml(file.name)}`,
      `<strong>Entries:</strong> ${entries.length}`,
      `<strong>Creator:</strong> ${escapeHtml(parsed?.log?.creator?.name || 'Unknown')}`
    ].join('<br/>');

    renderEntryList();
    clearDetails('Select an entry to inspect content.');
  } catch (error) {
    allEntries = [];
    filteredEntries = [];
    selectedIndex = -1;
    searchInput.disabled = true;
    entryListEl.className = 'entry-list empty';
    entryListEl.textContent = 'Unable to load HAR file.';
    clearDetails(error.message || 'Failed to parse HAR file.');
  }
});

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  filteredEntries = allEntries.filter((entry) => {
    const method = entry?.request?.method || '';
    const url = entry?.request?.url || '';
    const status = String(entry?.response?.status ?? '');
    const mime = entry?.response?.content?.mimeType || '';

    return `${method} ${url} ${status} ${mime}`.toLowerCase().includes(query);
  });

  selectedIndex = -1;
  renderEntryList();
  clearDetails(filteredEntries.length ? 'Select an entry to inspect content.' : 'No entries match the current filter.');
});

function renderEntryList() {
  entryListEl.className = 'entry-list';
  entryListEl.innerHTML = '';

  if (!filteredEntries.length) {
    entryListEl.className = 'entry-list empty';
    entryListEl.textContent = allEntries.length ? 'No entries match current filter.' : 'Load a HAR file to view entries.';
    return;
  }

  filteredEntries.forEach((entry, index) => {
    const item = entryTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector('.method').textContent = entry?.request?.method || '—';
    item.querySelector('.status').textContent = String(entry?.response?.status ?? '—');
    item.querySelector('.mime').textContent = entry?.response?.content?.mimeType || 'unknown';
    item.querySelector('.url').textContent = entry?.request?.url || 'Unknown URL';

    item.addEventListener('click', () => {
      selectedIndex = index;
      renderEntryListSelection();
      renderDetails(entry);
    });

    entryListEl.appendChild(item);
  });

  renderEntryListSelection();
}

function renderEntryListSelection() {
  [...entryListEl.querySelectorAll('.entry-item')].forEach((button, idx) => {
    button.classList.toggle('active', idx === selectedIndex);
  });
}

function clearDetails(message) {
  detailTitleEl.textContent = 'Entry details';
  detailsEl.className = 'details empty';
  detailsEl.textContent = message;
}

function renderDetails(entry) {
  const request = entry?.request || {};
  const response = entry?.response || {};
  const content = response?.content || {};
  const mime = content?.mimeType || 'application/octet-stream';

  detailTitleEl.textContent = request.url || 'Entry details';
  detailsEl.className = 'details';
  detailsEl.innerHTML = '';

  const overview = document.createElement('div');
  overview.className = 'kv';
  overview.innerHTML = [
    kv('Method', request.method || '—'),
    kv('Status', String(response.status ?? '—')),
    kv('MIME', mime),
    kv('Size (bytes)', String(content.size ?? response.bodySize ?? 'Unknown')),
    kv('Time (ms)', String(entry.time ?? 'Unknown')),
    kv('Started', entry.startedDateTime || 'Unknown')
  ].join('');
  detailsEl.appendChild(overview);

  const decoded = decodeContent(content);

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'download';
  downloadBtn.textContent = 'Download response body';
  downloadBtn.disabled = !decoded;
  downloadBtn.addEventListener('click', () => {
    if (!decoded) return;
    const blob = new Blob([decoded.bytes], { type: mime });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = buildFilename(request.url, mime);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  });
  detailsEl.appendChild(downloadBtn);

  if (!decoded) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No response content found for this entry.';
    detailsEl.appendChild(empty);
    return;
  }

  const preview = buildPreview(mime, decoded);
  detailsEl.appendChild(preview);

  const headers = document.createElement('pre');
  headers.textContent = formatHeaders('Request Headers', request.headers) + '\n\n' + formatHeaders('Response Headers', response.headers);
  detailsEl.appendChild(headers);
}

function decodeContent(content) {
  if (!content || typeof content.text !== 'string') {
    return null;
  }

  if (content.encoding === 'base64') {
    const binary = atob(content.text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const text = new TextDecoder().decode(bytes);
    return { bytes, text };
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(content.text);
  return { bytes, text: content.text };
}

function buildPreview(mimeType, decoded) {
  const mime = mimeType.toLowerCase();

  if (mime.startsWith('image/')) {
    const image = document.createElement('img');
    image.className = 'preview-image';
    image.alt = 'Response image preview';
    image.src = URL.createObjectURL(new Blob([decoded.bytes], { type: mimeType }));
    return image;
  }

  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    const media = document.createElement(mime.startsWith('audio/') ? 'audio' : 'video');
    media.className = 'preview-media';
    media.controls = true;
    media.src = URL.createObjectURL(new Blob([decoded.bytes], { type: mimeType }));
    return media;
  }

  const pre = document.createElement('pre');
  if (mime.includes('json')) {
    try {
      pre.textContent = JSON.stringify(JSON.parse(decoded.text), null, 2);
    } catch {
      pre.textContent = decoded.text;
    }
    return pre;
  }

  pre.textContent = decoded.text;
  return pre;
}

function kv(key, value) {
  return `<span class="key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span>`;
}

function formatHeaders(title, headers) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const lines = safeHeaders.map((header) => `${header.name}: ${header.value}`);
  return `${title}\n${'-'.repeat(title.length)}\n${lines.join('\n') || 'None'}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildFilename(url, mime) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').filter(Boolean).pop();
    if (name) return name;
  } catch {
    // ignore invalid URL
  }

  const extension = mime.split('/')[1]?.split(';')[0] || 'bin';
  return `har-response.${extension}`;
}
