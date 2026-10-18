// File: src/engine/catalog.js
// Lettura della struttura del database in un formato simile a MySQL:
// tipi minuscoli, chiavi PRI/UNI/MUL, ENUM ricostruiti dai vincoli CHECK.

// Tabelle interne che l'utente non deve vedere
const INTERNAL_TABLE = /^(sqlite_|qf_)/i;

export function listTables(rt) {
  return rt
    .query("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name")
    .filter((r) => !INTERNAL_TABLE.test(r.name));
}

export function findTable(rt, name) {
  const lower = String(name).toLowerCase();
  return listTables(rt).find((t) => t.name.toLowerCase() === lower) || null;
}

export function tableSql(rt, name) {
  const row = rt.query("SELECT sql FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? COLLATE NOCASE", [name])[0];
  return row ? row.sql : null;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Cerca nel CREATE TABLE il vincolo CHECK (col IN (...)) generato per le colonne ENUM
function enumValues(sql, column) {
  if (!sql) return null;
  const name = escapeRegex(column);
  const re = new RegExp(`CHECK\\s*\\(\\s*[\`"]?${name}[\`"]?\\s+IN\\s*\\(((?:'(?:[^']|'')*'\\s*,?\\s*)+)\\)\\s*\\)`, 'i');
  const m = sql.match(re);
  if (!m) return null;
  return m[1].match(/'(?:[^']|'')*'/g);
}

/**
 * Tipo di una colonna nello stile di DESCRIBE di MySQL.
 */
export function displayType(declared, column, sql, isAutoIncrement) {
  const values = enumValues(sql, column);
  if (values) return `enum(${values.join(',')})`;
  let type = String(declared || '').trim().toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')');
  if (isAutoIncrement && type === 'integer') type = 'int';
  return type;
}

function displayDefault(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  while (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim();
  if (/^datetime\('now'\s*,\s*'localtime'\)$/i.test(text) || /^current_timestamp$/i.test(text)) return 'CURRENT_TIMESTAMP';
  if (/^date\('now'\s*,\s*'localtime'\)$/i.test(text) || /^current_date$/i.test(text)) return 'CURRENT_DATE';
  if (/^time\('now'\s*,\s*'localtime'\)$/i.test(text) || /^current_time$/i.test(text)) return 'CURRENT_TIME';
  if (/^'.*'$/s.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^null$/i.test(text)) return null;
  return text;
}

/**
 * Chiave di ogni colonna (PRI, UNI, MUL) come nella colonna Key di DESCRIBE.
 */
export function columnKeys(rt, table) {
  const keys = new Map();
  const info = rt.query('SELECT name, pk FROM pragma_table_info(?)', [table]);
  for (const col of info) if (col.pk > 0) keys.set(col.name.toLowerCase(), 'PRI');
  const setIfEmpty = (name, key) => {
    const k = name.toLowerCase();
    if (!keys.has(k)) keys.set(k, key);
  };
  const indexes = rt.query('SELECT name, "unique" AS is_unique, origin FROM pragma_index_list(?)', [table]);
  for (const idx of indexes) {
    if (idx.origin === 'pk') continue;
    const cols = rt.query('SELECT name FROM pragma_index_info(?) ORDER BY seqno', [idx.name]).filter((c) => c.name !== null);
    if (!cols.length) continue;
    if (idx.is_unique && cols.length === 1) setIfEmpty(cols[0].name, 'UNI');
    else setIfEmpty(cols[0].name, 'MUL');
  }
  for (const fk of rt.query('SELECT "from" AS col FROM pragma_foreign_key_list(?)', [table])) setIfEmpty(fk.col, 'MUL');
  return keys;
}

function isAutoIncrementColumn(sql, col, pkCount) {
  return col.pk === 1 && pkCount === 1 && /^integer$/i.test(String(col.type).trim()) && /AUTOINCREMENT/i.test(sql || '');
}

/**
 * Colonne di una tabella con nome, tipo, null, chiave, default ed extra.
 */
export function describeColumns(rt, table) {
  const sql = tableSql(rt, table);
  const info = rt.query('SELECT name, type, "notnull" AS not_null, dflt_value, pk FROM pragma_table_info(?)', [table]);
  const keys = columnKeys(rt, table);
  const pkCount = info.filter((c) => c.pk > 0).length;
  return info.map((col) => {
    const autoIncrement = isAutoIncrementColumn(sql, col, pkCount);
    const def = displayDefault(col.dflt_value);
    let extra = '';
    if (autoIncrement) extra = 'auto_increment';
    else if (def === 'CURRENT_TIMESTAMP' || def === 'CURRENT_DATE' || def === 'CURRENT_TIME') extra = 'DEFAULT_GENERATED';
    const onUpdate = rt.query("SELECT 1 AS x FROM sqlite_master WHERE type = 'trigger' AND name = ?", [`qf_onupdate_${table}_${col.name}`]).length > 0;
    if (onUpdate) extra = (extra ? extra + ' ' : '') + 'on update CURRENT_TIMESTAMP';
    return {
      Field: col.name,
      Type: displayType(col.type, col.name, sql, autoIncrement),
      Null: col.not_null || col.pk > 0 ? 'NO' : 'YES',
      Key: keys.get(col.name.toLowerCase()) || '',
      Default: def,
      Extra: extra
    };
  });
}

/**
 * Struttura completa per la barra laterale e il diagramma delle relazioni.
 */
export function getStructure(rt) {
  return listTables(rt).map((table) => ({
    name: table.name,
    type: table.type,
    columns: describeColumns(rt, table.name).map((c) => ({
      name: c.Field,
      type: c.Type,
      nullable: c.Null === 'YES',
      key: c.Key
    }))
  }));
}

export function showIndexes(rt, table) {
  const rows = [];
  const info = rt.query('SELECT name, pk FROM pragma_table_info(?)', [table]);
  const pkCols = info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  pkCols.forEach((c, n) => rows.push({ Table: table, Non_unique: 0, Key_name: 'PRIMARY', Seq_in_index: n + 1, Column_name: c.name, Index_type: 'BTREE' }));
  for (const idx of rt.query('SELECT name, "unique" AS is_unique, origin FROM pragma_index_list(?)', [table])) {
    if (idx.origin === 'pk') continue;
    const cols = rt.query('SELECT name FROM pragma_index_info(?) ORDER BY seqno', [idx.name]);
    const keyName = idx.name.startsWith('sqlite_autoindex_') ? (cols[0] && cols[0].name) || idx.name : idx.name;
    cols.forEach((c, n) => rows.push({ Table: table, Non_unique: idx.is_unique ? 0 : 1, Key_name: keyName, Seq_in_index: n + 1, Column_name: c.name, Index_type: 'BTREE' }));
  }
  return rows;
}
