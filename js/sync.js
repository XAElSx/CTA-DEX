// Sync between devices via a private GitHub Gist, plus manual export/import.
// Merge rule: per record id, the newer `updated` wins.
import { getAllRecords, putRecords } from './db.js';

// Old app name, kept on purpose: the existing gist and devices on older versions use it.
const GIST_FILE = 'cta-dex.json';
const FILE_APP = 'cta-dex';
const FILE_APPS = [FILE_APP, 'mydex']; // accepted on import
const GIST_DESC = 'MyDex sync data';
const GH_API = 'https://api.github.com';
const SYNC_DELAY = 3000; // ms after the last change

const syncStatusEl = document.getElementById('sync-status');
const tokenEl = document.getElementById('gist-token');
let syncTimer = null;
let syncRunning = false;
let syncAgain = false;

const isRecord = r =>
  r && typeof r.id === 'string' && r.id.includes(':') &&
  ['none', 'caught', 'shiny'].includes(r.state) && Number.isFinite(r.updated);

const toFile = records =>
  JSON.stringify({ app: FILE_APP, version: 2, records }, null, 0);

function fromFile(text) {
  const data = JSON.parse(text);
  if (!data || !FILE_APPS.includes(data.app) || !Array.isArray(data.records)) {
    throw new Error('Not a MyDex file');
  }
  return data.records.filter(isRecord);
}

// Returns records the local DB must take, and whether the remote copy is out of date.
function mergeRecords(local, remote) {
  const merged = new Map(local.map(r => [r.id, r]));
  const toLocal = [];
  remote.forEach(r => {
    const l = merged.get(r.id);
    if (!l || r.updated > l.updated) {
      merged.set(r.id, r);
      toLocal.push(r);
    }
  });
  const remoteMap = new Map(remote.map(r => [r.id, r]));
  const remoteStale = [...merged.values()].some(r => remoteMap.get(r.id)?.updated !== r.updated);
  return { merged: [...merged.values()], toLocal, remoteStale };
}

async function applyMerge(remote) {
  const { merged, toLocal, remoteStale } = mergeRecords(await getAllRecords(), remote);
  if (toLocal.length) {
    await putRecords(toLocal);
    document.dispatchEvent(new Event('dex-synced'));
  }
  return { merged, toLocal, remoteStale };
}

/* ---------- Gist ---------- */

const token = () => localStorage.getItem('gistToken');

async function gh(path, options = {}) {
  const res = await fetch(GH_API + path, {
    ...options,
    cache: 'no-store', // never use a stale copy, or we could overwrite newer data
    headers: {
      Authorization: 'Bearer ' + token(),
      Accept: 'application/vnd.github+json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (res.status === 401) throw new Error('token rejected');
  if (!res.ok) throw new Error('GitHub error ' + res.status);
  return res.json();
}

// Find the MyDex gist on this account (by file name), or create one.
async function findGist() {
  const saved = localStorage.getItem('gistId');
  if (saved) return saved;

  for (let page = 1; page <= 10; page++) {
    const gists = await gh(`/gists?per_page=100&page=${page}`);
    const hit = gists.find(g => g.files && g.files[GIST_FILE]);
    if (hit) return rememberGist(hit.id);
    if (gists.length < 100) break;
  }
  const created = await gh('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: { [GIST_FILE]: { content: toFile(await getAllRecords()) } }
    })
  });
  return rememberGist(created.id);
}

function rememberGist(id) {
  localStorage.setItem('gistId', id);
  return id;
}

async function readGist(id) {
  const gist = await gh('/gists/' + id);
  const file = gist.files[GIST_FILE];
  if (!file) return [];
  const text = file.truncated
    ? await (await fetch(file.raw_url, { cache: 'no-store' })).text()
    : file.content;
  return fromFile(text);
}

async function syncNow() {
  clearTimeout(syncTimer);
  syncTimer = null;
  if (!token()) return showSync('Not connected');
  if (syncRunning) { syncAgain = true; return; }

  syncRunning = true;
  showSync('Syncing…');
  try {
    const id = await findGist();
    const { merged, remoteStale } = await applyMerge(await readGist(id));
    if (remoteStale) {
      await gh('/gists/' + id, {
        method: 'PATCH',
        body: JSON.stringify({ description: GIST_DESC, files: { [GIST_FILE]: { content: toFile(merged) } } })
      });
    }
    showSync('Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  } catch (err) {
    if (err.message === 'GitHub error 404') localStorage.removeItem('gistId'); // gist deleted
    showSync('Sync error: ' + err.message);
  } finally {
    syncRunning = false;
    if (syncAgain) { syncAgain = false; syncNow(); }
  }
}

// Called by app.js after each change.
export function scheduleSync() {
  if (!token()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, SYNC_DELAY);
}

function showSync(text) {
  syncStatusEl.textContent = text;
}

/* ---------- Export / import ---------- */

export async function exportFile() {
  const blob = new Blob([toFile(await getAllRecords())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const now = new Date();
  const day = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); // local date
  a.download = `mydex-backup-${day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  localStorage.setItem('lastExport', Date.now());
  document.dispatchEvent(new Event('dex-exported'));
}

async function importFile(file) {
  try {
    const { toLocal } = await applyMerge(fromFile(await file.text()));
    showSync(`Imported ${toLocal.length} change${toLocal.length === 1 ? '' : 's'}`);
    scheduleSync();
  } catch (err) {
    showSync('Import failed: ' + err.message);
  }
}

/* ---------- UI ---------- */

function showConnected() {
  const on = !!token();
  document.getElementById('sync-panel').classList.toggle('connected', on);
  tokenEl.value = '';
  tokenEl.placeholder = on ? 'Connected — paste a new token to replace' : 'GitHub token (gist scope)';
}

document.getElementById('gist-save').addEventListener('click', () => {
  const value = tokenEl.value.trim();
  if (!value) return;
  localStorage.setItem('gistToken', value);
  localStorage.removeItem('gistId');
  showConnected();
  syncNow();
});

document.getElementById('gist-disconnect').addEventListener('click', () => {
  localStorage.removeItem('gistToken');
  localStorage.removeItem('gistId');
  showConnected();
  showSync('Not connected');
});

document.getElementById('sync-now').addEventListener('click', syncNow);
document.getElementById('export').addEventListener('click', exportFile);
document.getElementById('import').addEventListener('change', e => {
  if (e.target.files[0]) importFile(e.target.files[0]);
  e.target.value = '';
});

// Sync when the app opens, comes back to the front, or goes online again.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncNow();
  else if (syncTimer) syncNow(); // flush pending changes before leaving
});
window.addEventListener('online', syncNow);

showConnected();
syncNow();
