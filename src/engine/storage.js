// File: src/engine/storage.js
// Salvataggio del database nel browser (IndexedDB).
// Se IndexedDB non è disponibile (es. navigazione privata in alcuni browser)
// le funzioni lanciano un errore e il database resta solo in memoria.

const DB_NAME = 'queryforge';
const STORE = 'files';
const KEY = 'database';

function openStore() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponibile'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(mode, action) {
  return openStore().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }));
}

export async function loadDatabase() {
  const data = await withStore('readonly', (store) => store.get(KEY));
  return data ? new Uint8Array(data) : null;
}

export function saveDatabase(bytes) {
  return withStore('readwrite', (store) => store.put(bytes, KEY));
}

export function clearDatabase() {
  return withStore('readwrite', (store) => store.delete(KEY));
}
