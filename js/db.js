const DB_NAME = 'mydex';
const DB_VERSION = 1;
const OLD_DB_NAME = 'cta-dex'; // name before the rename; copied once, then kept as a backup
const STORE = 'status';

// Records: { id: '<game>:<speciesId>', state, updated }
// 'none' is kept as a record (tombstone) so un-marking also syncs.
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        if (e.oldVersion < 1) req.result.createObjectStore(STORE, { keyPath: 'id' });
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

function readAll(db, range) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function writeAll(db, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    records.forEach(r => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Public ---------- */

const keyFor = (game, id) => `${game}:${id}`;

async function getAllStatus(game) {
  const records = await readAll(await openDB(), IDBKeyRange.bound(`${game}:`, `${game}:￿`));
  const map = {};
  records.forEach(r => {
    if (r.state !== 'none') map[Number(r.id.split(':')[1])] = r.state;
  });
  return map;
}

async function setStatus(game, id, state) {
  return putRecords([{ id: keyFor(game, id), state, updated: Date.now() }]);
}

// All records incl. tombstones — used by sync and export.
async function getAllRecords() {
  return readAll(await openDB());
}

async function putRecords(records) {
  return writeAll(await openDB(), records);
}
