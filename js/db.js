const DB_NAME = 'cta-dex';
const DB_VERSION = 2;
const STORE = 'status';

// Records: { id: '<game>:<speciesId>', state, updated }
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = req.result;
        const tx = req.transaction;

        if (e.oldVersion < 1) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }

        // v2: numeric ids → 'national:<id>' (per-game tracking)
        if (e.oldVersion < 2) {
          const store = tx.objectStore(STORE);
          const all = store.getAll();
          all.onsuccess = () => {
            all.result.forEach(r => {
              if (typeof r.id !== 'number') return;
              store.delete(r.id);
              store.put({ ...r, id: `national:${r.id}` });
            });
          };
        }
      };
      req.onblocked = () => alert('Close other CTA Dex tabs to finish the update.');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const keyFor = (game, id) => `${game}:${id}`;

async function getAllStatus(game) {
  const db = await openDB();
  const range = IDBKeyRange.bound(`${game}:`, `${game}:￿`);
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll(range);
    req.onsuccess = () => {
      const map = {};
      req.result.forEach(r => (map[Number(r.id.split(':')[1])] = r.state));
      resolve(map);
    };
    req.onerror = () => reject(req.error);
  });
}

async function setStatus(game, id, state) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const key = keyFor(game, id);
    if (state === 'none') store.delete(key);
    else store.put({ id: key, state, updated: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
