// File: src/engine/client.js
// Interfaccia verso il database del browser usata dai componenti Vue.
// Se una query supera il tempo massimo il worker viene chiuso e riaperto:
// il database riparte dall'ultimo salvataggio.

const QUERY_TIMEOUT = 15000;
const INIT_TIMEOUT = 60000;

let worker = null;
let ready = null;
let nextId = 1;
const pending = new Map();

function rejectAll(error) {
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(error);
  }
  pending.clear();
}

function stopWorker() {
  if (worker) worker.terminate();
  worker = null;
  ready = null;
}

function send(type, payload, timeout, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      const error = new Error(timeoutMessage);
      error.name = 'TimeoutError';
      reject(error);
      stopWorker();
      rejectAll(new Error('Il database è stato riavviato. Riprova.'));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, payload });
  });
}

function startWorker() {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    if (ok) {
      entry.resolve(result);
    } else {
      const err = new Error(error.message);
      err.name = error.name || 'SqlError';
      entry.reject(err);
    }
  };
  worker.onerror = () => {
    stopWorker();
    rejectAll(new Error('Il motore SQL si è interrotto in modo imprevisto. Ricarica la pagina.'));
  };
  ready = send('init', null, INIT_TIMEOUT, 'Il caricamento del database sta richiedendo troppo tempo. Controlla la connessione e ricarica la pagina.');
  ready.catch(() => stopWorker());
}

/**
 * Avvia il database (se necessario). Restituisce { restored, persistent }.
 */
export function ensureReady() {
  if (!worker) startWorker();
  return ready;
}

async function call(type, payload, timeout = QUERY_TIMEOUT, timeoutMessage = 'L\'operazione ha richiesto troppo tempo.') {
  await ensureReady();
  return send(type, payload, timeout, timeoutMessage);
}

export function executeQuery(query) {
  return call(
    'execute',
    { query },
    QUERY_TIMEOUT,
    `La query ha superato ${QUERY_TIMEOUT / 1000} secondi ed è stata interrotta. Il database è stato riaperto dall'ultimo salvataggio.`
  );
}

export function getDatabaseStructure() {
  return call('structure');
}

export function resetDatabase() {
  return call('reset', null, 30000);
}

export function exportDatabase() {
  return call('export');
}
