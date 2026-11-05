// File: src/engine/numeric.js
// In MySQL le colonne DECIMAL(p,s) e intere arrotondano il valore quando lo salvano:
// 879.989 in una DECIMAL(10,2) diventa 879.99, 37.5 in una INT diventa 38.
// SQLite invece salva il numero così com'è. Due trigger interni per tabella
// (qf_round_ins_... e qf_round_upd_...) fanno lo stesso arrotondamento dopo
// ogni INSERT e UPDATE, con la ROUND compatibile con MySQL di functions.js.

import { quoteIdent, sqliteString } from './translator.js';

const PREFIX = 'qf_round_';
const INTERNAL_TABLE = /^(sqlite_|qf_)/i;

/**
 * Cifre decimali che MySQL conserva per il tipo dichiarato, oppure null
 * se il tipo non arrotonda (FLOAT, DOUBLE, testi, date...).
 */
export function columnScale(type) {
  const t = String(type || '').trim().toUpperCase();
  let m = t.match(/^(?:DECIMAL|DEC|NUMERIC|FIXED)\b\s*(?:\(\s*\d+\s*(?:,\s*(\d+)\s*)?\))?/);
  // DECIMAL senza scala vale DECIMAL(10,0), come in MySQL
  if (m) return m[1] ? Number(m[1]) : 0;
  m = t.match(/^(?:FLOAT|DOUBLE(?:\s+PRECISION)?|REAL)\s*\(\s*\d+\s*,\s*(\d+)\s*\)/);
  if (m) return Number(m[1]);
  if (/^(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|BOOL|BOOLEAN|SERIAL)\b/.test(t)) return 0;
  return null;
}

function unquote(name) {
  if (/^`.*`$/.test(name)) return name.slice(1, -1).replace(/``/g, '`');
  if (/^".*"$/.test(name)) return name.slice(1, -1).replace(/""/g, '"');
  return name;
}

// Nome esatto e schema della tabella (le tabelle TEMPORARY stanno in temp)
function resolve(rt, table) {
  for (const [schema, master] of [['main', 'sqlite_master'], ['temp', 'sqlite_temp_master']]) {
    const row = rt.query(`SELECT name FROM ${master} WHERE type = 'table' AND name = ? COLLATE NOCASE`, [table])[0];
    if (row) return { name: row.name, schema, master, ref: `${schema === 'temp' ? 'temp.' : ''}${quoteIdent(row.name)}` };
  }
  return null;
}

// Le chiavi primarie restano fuori: un INTEGER PRIMARY KEY non accetta comunque decimali
function roundingColumns(rt, t) {
  return rt.query(`SELECT name, type, pk FROM pragma_table_info(${sqliteString(t.name)}, ${sqliteString(t.schema)})`)
    .map((c) => ({ name: c.name, scale: columnScale(c.type), pk: c.pk }))
    .filter((c) => c.scale !== null && !c.pk);
}

// Colonne con ON UPDATE CURRENT_TIMESTAMP (trigger qf_onupdate_... di ddl.js)
function onUpdateColumns(rt, t) {
  return rt.query(`SELECT sql FROM ${t.master} WHERE type = 'trigger' AND tbl_name = ? AND name LIKE 'qf!_onupdate!_%' ESCAPE '!'`, [t.name])
    .map((r) => r.sql.match(/WHEN\s+NEW\.(`(?:[^`]|``)+`|"(?:[^"]|"")+"|[A-Za-z0-9_]+)\s+IS\s+OLD\./i))
    .filter(Boolean)
    .map((m) => unquote(m[1]));
}

function needsRounding(cols, ref) {
  return cols.map((c) => {
    const v = `${ref}${quoteIdent(c.name)}`;
    return `(typeof(${v}) = 'real' AND ${v} <> round(${v}, ${c.scale}))`;
  }).join(' OR ');
}

function roundedAssignments(cols) {
  return cols.map((c) => {
    const q = quoteIdent(c.name);
    return `${q} = CASE WHEN typeof(${q}) = 'real' THEN round(${q}, ${c.scale}) ELSE ${q} END`;
  }).join(', ');
}

function triggerStatements(t, cols, onUpdate) {
  if (!cols.length) return [];
  const table = quoteIdent(t.name);
  const create = t.schema === 'temp' ? 'CREATE TEMP TRIGGER' : 'CREATE TRIGGER';
  const fix = `UPDATE ${table} SET ${roundedAssignments(cols)} WHERE rowid = NEW.rowid;`;
  // L'UPDATE di arrotondamento fa scattare anche ON UPDATE CURRENT_TIMESTAMP:
  // qui si rimette il valore che la colonna deve avere davvero
  const keep = (condition) => onUpdate.map((c) => {
    const q = quoteIdent(c);
    return ` UPDATE ${table} SET ${q} = NEW.${q} WHERE rowid = NEW.rowid AND ${condition(q)};`;
  }).join('');
  const when = needsRounding(cols, 'NEW.');
  const ins = `${PREFIX}ins_${t.name}`;
  const upd = `${PREFIX}upd_${t.name}`;
  return [
    { name: ins, sql: `${create} ${quoteIdent(ins)} AFTER INSERT ON ${table} FOR EACH ROW WHEN ${when} BEGIN ${fix}${keep((q) => `${q} IS NOT NEW.${q}`)} END` },
    { name: upd, sql: `${create} ${quoteIdent(upd)} AFTER UPDATE OF ${cols.map((c) => quoteIdent(c.name)).join(', ')} ON ${table} FOR EACH ROW WHEN ${when} BEGIN ${fix}${keep((q) => `NEW.${q} IS NOT OLD.${q}`)} END` }
  ];
}

/**
 * Crea o aggiorna i trigger di arrotondamento della tabella secondo le sue
 * colonne attuali. Va chiamata dopo ogni CREATE TABLE, ALTER TABLE e rinomina.
 */
export function syncRoundingTriggers(rt, table) {
  const t = resolve(rt, table);
  if (!t) return;
  const wanted = triggerStatements(t, roundingColumns(rt, t), onUpdateColumns(rt, t));
  const existing = rt.query(`SELECT name, sql FROM ${t.master} WHERE type = 'trigger' AND tbl_name = ? AND name LIKE 'qf!_round!_%' ESCAPE '!'`, [t.name]);
  const unchanged = existing.length === wanted.length && wanted.every((w) => existing.some((e) => e.name === w.name && e.sql === w.sql));
  if (unchanged) return;
  const schema = t.schema === 'temp' ? 'temp.' : '';
  for (const e of existing) rt.exec(`DROP TRIGGER ${schema}${quoteIdent(e.name)}`);
  for (const w of wanted) {
    // un trigger con lo stesso nome può essere rimasto a una tabella rinominata
    rt.exec(`DROP TRIGGER IF EXISTS ${schema}${quoteIdent(w.name)}`);
    rt.exec(w.sql);
  }
}

/**
 * Arrotonda i valori già salvati, come fa MySQL quando cambia il tipo di una
 * colonna. Chi la chiama deve evitare che scattino altri trigger della tabella.
 */
export function roundStoredValues(rt, table) {
  const t = resolve(rt, table);
  if (!t) return;
  const cols = roundingColumns(rt, t);
  if (!cols.length) return;
  rt.exec(`UPDATE ${t.ref} SET ${roundedAssignments(cols)} WHERE ${needsRounding(cols, '')}`);
}

/**
 * Aggiorna un database salvato prima dell'arrotondamento: corregge i valori
 * con troppi decimali e aggiunge i trigger mancanti.
 */
export function upgradeRounding(rt) {
  const tables = rt.query("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name).filter((n) => !INTERNAL_TABLE.test(n));
  for (const name of tables) {
    const t = resolve(rt, name);
    const cols = roundingColumns(rt, t);
    if (cols.length && rt.query(`SELECT 1 AS x FROM ${t.ref} WHERE ${needsRounding(cols, '')} LIMIT 1`).length) {
      // durante la correzione non deve scattare ON UPDATE CURRENT_TIMESTAMP
      const others = rt.query("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? AND name NOT LIKE 'qf!_round!_%' ESCAPE '!'", [t.name]);
      rt.exec('BEGIN');
      try {
        for (const trg of others) rt.exec(`DROP TRIGGER ${quoteIdent(trg.name)}`);
        roundStoredValues(rt, t.name);
        for (const trg of others) rt.exec(trg.sql);
        rt.exec('COMMIT');
      } catch (error) {
        rt.exec('ROLLBACK');
        throw error;
      }
    }
    syncRoundingTriggers(rt, t.name);
  }
}
