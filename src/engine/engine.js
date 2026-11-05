// File: src/engine/engine.js
// Il database SQL del browser: SQLite (sql.js) con traduzione da MySQL.
// Non dipende dal DOM, così funziona sia nel Web Worker sia nei test con Node.

import { splitStatements } from './tokenizer.js';
import { translateStatement } from './statements.js';
import { registerMysqlFunctions } from './functions.js';
import { getStructure } from './catalog.js';
import { CompatError, translateSqliteError } from './errors.js';
import { upgradeRounding } from './numeric.js';

// Righe massime restituite all'interfaccia per una SELECT
export const MAX_ROWS = 1000;

function dedupeColumns(columns) {
  const seen = new Map();
  return columns.map((name) => {
    const key = String(name).toLowerCase();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}

function formatValue(value) {
  if (typeof value === 'number' && !Number.isInteger(value) && Number.isFinite(value)) {
    // toglie il "rumore" dei numeri in virgola mobile (139.98000000000002 -> 139.98)
    return Number(value.toPrecision(15));
  }
  if (value instanceof Uint8Array) {
    if (value.length > 64) return `[BLOB ${value.length} byte]`;
    return '0x' + Array.from(value, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return value;
}

export class Engine {
  constructor(SQL, bytes = null) {
    this.SQL = SQL;
    this.db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    this.sqliteVersion = this.db.exec('SELECT sqlite_version()')[0].values[0][0];
    this.foreignKeys = true;
    this.setupConnection();
    this.rt = this.createRuntime();
    this.savedMarker = this.changeMarker();
    // Database salvati prima dell'arrotondamento di DECIMAL e INT: si aggiornano
    // all'apertura e risultano modificati, così il worker li salva
    if (bytes) {
      try {
        upgradeRounding(this.rt);
      } catch (error) {
        // se l'aggiornamento non riesce il database resta comunque utilizzabile
      }
    }
  }

  /**
   * Crea un database nuovo eseguendo lo script SQL (in sintassi MySQL).
   */
  static fromScript(SQL, script) {
    const engine = new Engine(SQL);
    engine.execute(script);
    return engine;
  }

  // Va ripetuto ogni volta che sql.js riapre il database (export)
  setupConnection() {
    registerMysqlFunctions(this.db, { sqliteVersion: this.sqliteVersion });
    this.db.run(`PRAGMA foreign_keys = ${this.foreignKeys ? 'ON' : 'OFF'}`);
  }

  // Funzioni a disposizione dei comandi emulati (SHOW, ALTER TABLE...)
  createRuntime() {
    return {
      query: (sql, params = []) => {
        const stmt = this.db.prepare(sql);
        try {
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally {
          stmt.free();
        }
      },
      exec: (sql) => {
        this.db.run(sql);
      },
      runSql: (sql, options) => this.runSql(sql, options),
      inTransaction: () => this.inTransaction(),
      foreignKeysEnabled: () => this.db.exec('PRAGMA foreign_keys')[0].values[0][0] === 1,
      setForeignKeys: (on) => {
        this.db.run(`PRAGMA foreign_keys = ${on ? 'ON' : 'OFF'}`);
        this.foreignKeys = on;
      }
    };
  }

  // In SQLite BEGIN fallisce solo se una transazione è già aperta
  inTransaction() {
    try {
      this.db.run('BEGIN');
    } catch (e) {
      return true;
    }
    this.db.run('ROLLBACK');
    return false;
  }

  runSql(sql, options = {}) {
    if (options.multi) {
      this.db.run(sql);
      return { affectedRows: 0, message: options.message };
    }
    const stmt = this.db.prepare(sql);
    try {
      const columns = stmt.getColumnNames();
      if (columns.length) {
        const max = options.maxRows === undefined ? MAX_ROWS : options.maxRows;
        const rows = [];
        let truncated = false;
        while (stmt.step()) {
          if (rows.length >= max) {
            truncated = true;
            break;
          }
          rows.push(stmt.get());
        }
        return { columns, rows, truncated };
      }
      stmt.step();
    } finally {
      stmt.free();
    }
    if (options.dml) {
      const affectedRows = this.db.getRowsModified();
      const result = { affectedRows };
      if (options.insert && affectedRows > 0) result.insertId = this.db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      return result;
    }
    return { affectedRows: 0, message: options.message || 'Comando eseguito.' };
  }

  /**
   * Esegue una o più istruzioni MySQL separate da punto e virgola.
   * Restituisce il risultato da mostrare: l'ultima SELECT, o l'ultimo comando.
   */
  execute(text, { maxRows = MAX_ROWS } = {}) {
    const statements = splitStatements(text);
    if (!statements.length) throw new CompatError('La query è vuota.');
    const results = [];
    statements.forEach((statement, index) => {
      try {
        const { steps } = translateStatement(statement);
        let result = null;
        for (const step of steps) {
          const r = step.run ? step.run(this.rt) : this.runSql(step.sql, { ...step, maxRows });
          if (!step.silent) result = r;
        }
        results.push(result);
      } catch (error) {
        let prefix = '';
        if (statements.length > 1) {
          prefix = `Errore nell'istruzione ${index + 1} di ${statements.length}${index > 0 ? ' (quelle precedenti sono state eseguite)' : ''}:\n`;
        }
        const wrapped = new Error(prefix + translateSqliteError(error));
        wrapped.name = error instanceof CompatError ? 'CompatError' : 'SqlError';
        throw wrapped;
      }
    });
    const withRows = [...results].reverse().find((r) => r && r.columns);
    return this.formatResult(withRows || results[results.length - 1], statements.length);
  }

  formatResult(result, statements) {
    if (result && result.columns) {
      const names = dedupeColumns(result.columns);
      const rows = result.rows.map((row) => {
        const obj = {};
        names.forEach((name, i) => {
          obj[name] = formatValue(row[i]);
        });
        return obj;
      });
      return { columns: names, rows, truncated: Boolean(result.truncated), statements };
    }
    const out = { affectedRows: result && result.affectedRows !== undefined ? result.affectedRows : 0, statements };
    if (result && result.insertId !== undefined) out.insertId = result.insertId;
    if (result && result.message) out.message = result.message;
    return out;
  }

  structure() {
    return getStructure(this.rt);
  }

  // Serve per capire se ci sono modifiche da salvare
  changeMarker() {
    const row = this.db.exec('SELECT total_changes(), (SELECT schema_version FROM pragma_schema_version)')[0].values[0];
    return `${row[0]}|${row[1]}`;
  }

  isDirty() {
    return this.changeMarker() !== this.savedMarker;
  }

  /**
   * Restituisce il contenuto del database. sql.js riapre la connessione,
   * quindi vanno registrate di nuovo le funzioni.
   */
  export() {
    const bytes = this.db.export();
    this.setupConnection();
    this.savedMarker = this.changeMarker();
    return bytes;
  }

  reset(script) {
    this.db.close();
    this.db = new this.SQL.Database();
    this.foreignKeys = true;
    this.setupConnection();
    this.execute(script);
  }
}
