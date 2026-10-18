// File: src/engine/worker.js
// Web Worker che ospita il database: le query girano fuori dal thread
// dell'interfaccia, così una query lenta non blocca la pagina e può
// essere interrotta chiudendo il worker.

import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import template from './template_schema.sql?raw';
import { Engine } from './engine.js';
import { loadDatabase, saveDatabase } from './storage.js';

let engine = null;
let initPromise = null;
let persistent = true;

async function init() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  let restored = false;
  try {
    const bytes = await loadDatabase();
    if (bytes) {
      engine = new Engine(SQL, bytes);
      engine.structure(); // verifica che il file salvato sia leggibile
      restored = true;
    }
  } catch (error) {
    engine = null;
  }
  if (!engine) {
    engine = Engine.fromScript(SQL, template);
    await persist(true);
  }
  return { restored, persistent };
}

// Salva solo se ci sono modifiche e nessuna transazione è aperta
async function persist(force = false) {
  if (!engine || !persistent) return;
  if (!force && (!engine.isDirty() || engine.inTransaction())) return;
  try {
    await saveDatabase(engine.export());
  } catch (error) {
    persistent = false;
  }
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  try {
    if (!initPromise) initPromise = init();
    const info = await initPromise;
    let result;
    switch (type) {
      case 'init':
        result = info;
        break;
      case 'execute':
        try {
          result = engine.execute(payload.query);
        } finally {
          await persist();
        }
        break;
      case 'structure':
        result = engine.structure();
        break;
      case 'reset':
        engine.reset(template);
        await persist(true);
        result = { persistent };
        break;
      case 'export':
        result = engine.export();
        break;
      default:
        throw new Error(`Richiesta sconosciuta: ${type}`);
    }
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: { message: error.message, name: error.name } });
  }
};
