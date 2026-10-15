const DB_NAME = 'mydex';
const DB_VERSION = 2;
const OLD_DB_NAME = 'cta-dex'; // name before the rename; copied once, then kept as a backup
const STORE = 'status';
const CACHE = 'api'; // PokéAPI responses: { url, data }

// Records: { id: '<game>:<speciesId>', state, origin?, updated }
// 'none' is kept as a record (tombstone) so un-marking also syncs.
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        if (e.oldVersion < 1) req.result.createObjectStore(STORE, { keyPath: 'id' });
        if (e.oldVersion < 2) req.result.createObjectStore(CACHE, { keyPath: 'url' });
      };
      req.onblocked = () => alert('Close other MyDex tabs to finish the update.');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).then(async db => {
      await migrateOldDB(db);
      return db;
    });
  }
  return dbPromise;
}

/* ---------- One-time copy from the old 'cta-dex' database ---------- */

async function migrateOldDB(db) {
  if (localStorage.getItem('dbMigrated')) return;
  const old = await openOldDB();
  if (old) {
    const records = old.objectStoreNames.contains(STORE) ? await readAll(old) : [];
    old.close();
    const mine = new Map((await readAll(db)).map(r => [r.id, r]));
    const newer = records
      .map(r => (typeof r.id === 'number' ? { ...r, id: `national:${r.id}` } : r)) // v1 ids
      .filter(r => !mine.has(r.id) || r.updated > mine.get(r.id).updated);
    await writeAll(db, newer);
  }
  localStorage.setItem('dbMigrated', '1');
}

// Opens the old database only if it exists: opening a missing name would create it.
function openOldDB() {
  return new Promise(resolve => {
    const req = indexedDB.open(OLD_DB_NAME);
    req.onupgradeneeded = () => req.transaction.abort(); // did not exist
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => { e.preventDefault(); resolve(null); };
  });
}

function readAll(db, range, store = STORE) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function writeAll(db, records, name = STORE) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    records.forEach(r => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Public ---------- */

const keyFor = (game, id) => `${game}:${id}`;

// Records of one dex: { speciesId: { state, origin } }. Plain tombstones are left out.
export async function getDexRecords(game) {
  const records = await readAll(await openDB(), IDBKeyRange.bound(`${game}:`, `${game}:￿`));
  const map = {};
  records.forEach(r => {
    if (r.state !== 'none' || r.origin) {
      map[Number(r.id.split(':')[1])] = { state: r.state, origin: r.origin || null };
    }
  });
  return map;
}

// Read-modify-write, so changing the state keeps the origin and the other way round.
export async function updateRecord(game, id, patch) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const key = keyFor(game, id);
    const req = store.get(key);
    req.onsuccess = () => {
      store.put({ state: 'none', ...req.result, ...patch, id: key, updated: Date.now() });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// All records incl. tombstones — used by sync and export.
export async function getAllRecords() {
  return readAll(await openDB());
}

export async function putRecords(records) {
  return writeAll(await openDB(), records);
}

/* ---------- PokéAPI cache ---------- */

export async function cacheGet(url) {
  const [hit] = await readAll(await openDB(), url, CACHE);
  return hit?.data;
}

export async function cachePut(url, data) {
  return writeAll(await openDB(), [{ url, data }], CACHE);
}
