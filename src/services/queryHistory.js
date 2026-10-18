// File: src/services/queryHistory.js
// Cronologia delle query salvata nel browser (localStorage).

const STORAGE_KEY = 'queryforge-history';
const MAX_ITEMS = 100;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    // spazio esaurito o localStorage non disponibile: la cronologia resta vuota
  }
}

export function getQueryHistory(limit = MAX_ITEMS) {
  return read().slice(0, limit);
}

export function addToQueryHistory(query, error = null) {
  const items = read();
  items.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query,
    error,
    executed_at: new Date().toISOString()
  });
  write(items.slice(0, MAX_ITEMS));
}

export function clearQueryHistory() {
  write([]);
}
