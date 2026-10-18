// File: src/engine/ddl.js
// Traduzione di CREATE TABLE, ALTER TABLE e degli indici da MySQL a SQLite.

import { tokenize, isSignificant, nextSig, matchParen, splitTopLevel, findTopLevelWord } from './tokenizer.js';
import { emit, emitSelect, sqliteString, quoteIdent, identName, mapCollation, createContext } from './translator.js';
import { CompatError, MSG } from './errors.js';
import { findTable, tableSql } from './catalog.js';

const TEXT_TYPES = new Set(['CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'NCHAR', 'NVARCHAR', 'CHARACTER', 'NATIONAL', 'ENUM', 'SET']);
const NUMERIC_TYPES = new Set(['INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL', 'DEC', 'NUMERIC', 'FIXED', 'FLOAT', 'DOUBLE', 'REAL', 'BIT', 'BOOL', 'BOOLEAN', 'SERIAL', 'YEAR']);
const TYPE_SUFFIXES = new Set(['UNSIGNED', 'SIGNED', 'ZEROFILL', 'PRECISION', 'VARYING']);
const TABLE_ITEM_START = new Set(['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'KEY', 'INDEX', 'FULLTEXT', 'SPATIAL', 'FOREIGN', 'CHECK']);

const NOW_DEFAULT = "(datetime('now','localtime'))";
const TODAY_DEFAULT = "(date('now','localtime'))";
const TIME_DEFAULT = "(time('now','localtime'))";

/** Rimuove gli apici da un nome (`nome`, "nome", [nome]). */
export function unquote(name) {
  const text = String(name).trim();
  if ((text.startsWith('`') && text.endsWith('`')) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1).replace(/``/g, '`').replace(/""/g, '"');
  }
  if (text.startsWith('[') && text.endsWith(']')) return text.slice(1, -1);
  return text;
}

function sig(tokens, from, to) {
  const out = [];
  for (let i = from; i < to; i++) if (isSignificant(tokens[i])) out.push(i);
  return out;
}

// Elenco di colonne di un indice: (a, b(10) DESC) -> `a`, `b` DESC
function indexColumns(tokens, open, close) {
  return splitTopLevel(tokens, open + 1, close).map(([a, b]) => {
    const s = sig(tokens, a, b);
    if (!s.length) return '';
    const first = tokens[s[0]];
    if (first.type === 'punct' && first.text === '(') {
      // indice su espressione: ((espressione))
      return emit(tokens, a, b, createContext()).trim();
    }
    const name = quoteIdent(identName(first));
    const order = s.map((i) => tokens[i]).find((t) => t.type === 'word' && (t.upper === 'ASC' || t.upper === 'DESC'));
    return order ? `${name} ${order.upper}` : name;
  }).filter(Boolean);
}

function columnNamesOf(tokens, open, close) {
  return splitTopLevel(tokens, open + 1, close).map(([a, b]) => {
    const s = sig(tokens, a, b);
    return s.length ? identName(tokens[s[0]]) : null;
  }).filter(Boolean);
}

// Primo gruppo tra parentesi a partire da `from`
function findGroup(tokens, from, to) {
  for (let i = from; i < to; i++) {
    if (tokens[i].type === 'punct' && tokens[i].text === '(') {
      const close = matchParen(tokens, i, to);
      return close === -1 ? null : { open: i, close };
    }
  }
  return null;
}

function implicitDefault(typeUpper, enumFirst) {
  if (enumFirst) return enumFirst;
  if (NUMERIC_TYPES.has(typeUpper)) return '0';
  if (typeUpper === 'DATE') return "'0000-00-00'";
  if (typeUpper === 'DATETIME' || typeUpper === 'TIMESTAMP') return "'0000-00-00 00:00:00'";
  if (typeUpper === 'TIME') return "'00:00:00'";
  return "''";
}

// ---------------------------------------------------------------------------
// Definizione di colonna
// ---------------------------------------------------------------------------

/**
 * Traduce la definizione di una colonna MySQL. `name` può essere fornito
 * esternamente (MODIFY/CHANGE), altrimenti è il primo token.
 */
export function translateColumnDef(tokens, from, to, { table } = {}) {
  const ctx = createContext();
  const s = sig(tokens, from, to);
  if (s.length < 2) throw new CompatError('Definizione di colonna incompleta: indica nome e tipo, ad esempio: nome VARCHAR(50).');
  const nameToken = tokens[s[0]];
  const name = identName(nameToken);
  let p = 1;

  // Tipo di dato
  const typeToken = tokens[s[p]];
  if (typeToken.type !== 'word') throw new CompatError(`Tipo di dato mancante per la colonna ${name}.`);
  let typeUpper = typeToken.upper;
  let typeText = typeToken.text.toUpperCase();
  p++;
  let enumList = null;
  if (s[p] !== undefined && tokens[s[p]].text === '(') {
    const close = matchParen(tokens, s[p], to);
    if (typeUpper === 'ENUM' || typeUpper === 'SET') {
      enumList = splitTopLevel(tokens, s[p] + 1, close)
        .map(([a, b]) => sig(tokens, a, b).map((i) => tokens[i]).find((t) => t.type === 'string'))
        .filter(Boolean)
        .map((t) => sqliteString(t.value));
    } else {
      typeText += '(' + sig(tokens, s[p] + 1, close).map((i) => tokens[i].text).join(' ').replace(/\s*,\s*/g, ',') + ')';
    }
    p = s.findIndex((i) => i > close);
    if (p === -1) p = s.length;
  }
  while (p < s.length && tokens[s[p]].type === 'word' && TYPE_SUFFIXES.has(tokens[s[p]].upper)) {
    typeText += ' ' + tokens[s[p]].upper;
    p++;
  }
  if (typeUpper === 'CHARACTER' && typeText.includes('VARYING')) typeUpper = 'VARCHAR';

  const def = {
    name,
    typeUpper,
    typeText,
    enumList,
    textual: TEXT_TYPES.has(typeUpper),
    collation: null,
    autoIncrement: typeUpper === 'SERIAL',
    primaryKey: false,
    unique: typeUpper === 'SERIAL',
    notNull: typeUpper === 'SERIAL',
    nullExplicit: false,
    defaultSql: null,
    onUpdateNow: false,
    checks: [],
    references: null,
    generated: null
  };
  if (typeUpper === 'SERIAL') def.typeText = 'BIGINT UNSIGNED';

  while (p < s.length) {
    const t = tokens[s[p]];
    const w = t.type === 'word' ? t.upper : t.text;
    const nextW = s[p + 1] !== undefined && tokens[s[p + 1]].type === 'word' ? tokens[s[p + 1]].upper : null;
    if (w === 'NOT' && nextW === 'NULL') {
      def.notNull = true;
      p += 2;
    } else if (w === 'NULL') {
      def.nullExplicit = true;
      p += 1;
    } else if (w === 'DEFAULT') {
      p = parseDefault(tokens, s, p + 1, to, def, ctx);
    } else if (w === 'AUTO_INCREMENT') {
      def.autoIncrement = true;
      p += 1;
    } else if (w === 'UNIQUE') {
      def.unique = true;
      p += nextW === 'KEY' ? 2 : 1;
    } else if (w === 'PRIMARY') {
      def.primaryKey = true;
      p += nextW === 'KEY' ? 2 : 1;
    } else if (w === 'KEY') {
      // in una colonna "KEY" da solo significa PRIMARY KEY
      def.primaryKey = true;
      p += 1;
    } else if (w === 'COMMENT') {
      p += 2;
    } else if (w === 'COLLATE') {
      def.collation = mapCollation(identName(tokens[s[p + 1]]));
      p += 2;
    } else if (w === 'CHARACTER' && nextW === 'SET') {
      p += 3;
    } else if (w === 'CHARSET') {
      p += 2;
    } else if (w === 'BINARY') {
      def.collation = 'BINARY';
      p += 1;
    } else if (w === 'VISIBLE' || w === 'INVISIBLE') {
      p += 1;
    } else if (w === 'COLUMN_FORMAT' || w === 'STORAGE' || w === 'SRID') {
      p += 2;
    } else if (w === 'ENGINE_ATTRIBUTE' || w === 'SECONDARY_ENGINE_ATTRIBUTE') {
      p += tokens[s[p + 1]] && tokens[s[p + 1]].text === '=' ? 3 : 2;
    } else if (w === 'ON' && nextW === 'UPDATE') {
      const value = tokens[s[p + 2]];
      if (value && ['CURRENT_TIMESTAMP', 'NOW', 'LOCALTIMESTAMP', 'LOCALTIME'].includes(value.upper)) def.onUpdateNow = true;
      p += 3;
      if (s[p] !== undefined && tokens[s[p]].text === '(') {
        const close = matchParen(tokens, s[p], to);
        p = s.findIndex((i) => i > close);
        if (p === -1) p = s.length;
      }
    } else if (w === 'REFERENCES') {
      // il riferimento prosegue fino a un eventuale CHECK
      const end = findTopLevelWord(tokens, s[p] + 1, to, ['CHECK', 'CONSTRAINT']);
      def.references = emit(tokens, s[p], end === -1 ? to : end, ctx).trim();
      if (end === -1) p = s.length;
      else p = s.indexOf(end);
    } else if (w === 'CONSTRAINT' || w === 'CHECK') {
      let q = p;
      let label = '';
      if (w === 'CONSTRAINT') {
        if (nextW !== 'CHECK') {
          label = `CONSTRAINT ${quoteIdent(identName(tokens[s[p + 1]]))} `;
          q = p + 2;
        } else {
          q = p + 1;
        }
      }
      const group = findGroup(tokens, s[q], to);
      if (!group) throw new CompatError('Vincolo CHECK senza condizione tra parentesi.');
      let after = s.findIndex((i) => i > group.close);
      if (after === -1) after = s.length;
      // CHECK (...) NOT ENFORCED: MySQL non lo applica, quindi lo ignoriamo
      const enforcedNot = tokens[s[after]] && tokens[s[after]].upper === 'NOT' && tokens[s[after + 1]] && tokens[s[after + 1]].upper === 'ENFORCED';
      if (!enforcedNot) def.checks.push(`${label}CHECK (${emit(tokens, group.open + 1, group.close, ctx).trim()})`);
      p = after;
      if (tokens[s[p]] && tokens[s[p]].upper === 'NOT') p += 2;
      else if (tokens[s[p]] && tokens[s[p]].upper === 'ENFORCED') p += 1;
    } else if (w === 'GENERATED' || w === 'AS') {
      const group = findGroup(tokens, s[p], to);
      if (!group) throw new CompatError('Colonna generata senza espressione tra parentesi.');
      let after = s.findIndex((i) => i > group.close);
      if (after === -1) after = s.length;
      let kind = 'VIRTUAL';
      if (tokens[s[after]] && (tokens[s[after]].upper === 'STORED' || tokens[s[after]].upper === 'VIRTUAL')) {
        kind = tokens[s[after]].upper;
        after++;
      }
      def.generated = `GENERATED ALWAYS AS (${emit(tokens, group.open + 1, group.close, ctx).trim()}) ${kind}`;
      p = after;
    } else {
      throw new CompatError(`Non riconosco "${t.text}" nella definizione della colonna ${name}.`);
    }
  }
  return def;
}

function parseDefault(tokens, s, p, to, def, ctx) {
  const t = tokens[s[p]];
  if (!t) throw new CompatError(`Manca il valore di DEFAULT per la colonna ${def.name}.`);
  const skipCall = (q) => {
    if (s[q] !== undefined && tokens[s[q]].text === '(') {
      const close = matchParen(tokens, s[q], to);
      const after = s.findIndex((i) => i > close);
      return after === -1 ? s.length : after;
    }
    return q;
  };
  const upper = t.type === 'word' ? t.upper : null;
  if (['CURRENT_TIMESTAMP', 'NOW', 'LOCALTIMESTAMP', 'LOCALTIME'].includes(upper)) {
    def.defaultSql = NOW_DEFAULT;
    return skipCall(p + 1);
  }
  if (['CURRENT_DATE', 'CURDATE'].includes(upper)) {
    def.defaultSql = TODAY_DEFAULT;
    return skipCall(p + 1);
  }
  if (['CURRENT_TIME', 'CURTIME'].includes(upper)) {
    def.defaultSql = TIME_DEFAULT;
    return skipCall(p + 1);
  }
  if (t.type === 'punct' && t.text === '(') {
    const close = matchParen(tokens, s[p], to);
    const inner = emit(tokens, s[p] + 1, close, ctx).trim();
    def.defaultSql = /^NOW\(\)$/i.test(inner) ? NOW_DEFAULT : /^CURDATE\(\)$/i.test(inner) ? TODAY_DEFAULT : `(${inner})`;
    const after = s.findIndex((i) => i > close);
    return after === -1 ? s.length : after;
  }
  if (t.type === 'op' && (t.text === '-' || t.text === '+')) {
    def.defaultSql = t.text + tokens[s[p + 1]].text;
    return p + 2;
  }
  if (t.type === 'string') {
    def.defaultSql = sqliteString(t.value);
    return p + 1;
  }
  if (t.type === 'number') {
    def.defaultSql = t.literal === 'B' ? String(parseInt(t.body || '0', 2)) : t.text;
    return p + 1;
  }
  if (upper === 'TRUE') def.defaultSql = '1';
  else if (upper === 'FALSE') def.defaultSql = '0';
  else def.defaultSql = t.text;
  return p + 1;
}

/**
 * Converte la definizione in SQL per SQLite.
 */
export function columnSql(def, { inlinePrimaryKey = def.primaryKey, autoIncrement = def.autoIncrement } = {}) {
  const parts = [quoteIdent(def.name)];
  const isAutoPk = autoIncrement && inlinePrimaryKey;
  if (isAutoPk) parts.push('INTEGER PRIMARY KEY AUTOINCREMENT');
  else parts.push(def.enumList || def.typeUpper === 'SET' ? 'TEXT' : def.typeText);
  if (def.textual || def.collation) parts.push(`COLLATE ${def.collation || 'NOCASE'}`);
  if (def.notNull) parts.push('NOT NULL');
  if (inlinePrimaryKey && !isAutoPk) parts.push('PRIMARY KEY');
  if (def.unique) parts.push('UNIQUE');
  if (def.defaultSql !== null) parts.push(`DEFAULT ${def.defaultSql}`);
  if (def.generated) parts.push(def.generated);
  if (def.enumList && def.typeUpper === 'ENUM') parts.push(`CHECK (${quoteIdent(def.name)} IN (${def.enumList.join(', ')}))`);
  for (const check of def.checks) parts.push(check);
  if (def.references) parts.push(def.references);
  return parts.join(' ');
}

function onUpdateTriggerSql(table, column) {
  const t = quoteIdent(table);
  const c = quoteIdent(column);
  return `CREATE TRIGGER ${quoteIdent(`qf_onupdate_${table}_${column}`)} AFTER UPDATE ON ${t} FOR EACH ROW WHEN NEW.${c} IS OLD.${c} BEGIN UPDATE ${t} SET ${c} = datetime('now','localtime') WHERE rowid = NEW.rowid; END`;
}

// ---------------------------------------------------------------------------
// Vincoli e indici a livello di tabella
// ---------------------------------------------------------------------------

/**
 * Traduce un elemento di tabella che non è una colonna.
 * Restituisce { kind, sql?, columns?, index? }.
 */
function translateTableItem(tokens, from, to, table) {
  const ctx = createContext();
  const s = sig(tokens, from, to);
  let p = 0;
  let constraintName = null;
  if (tokens[s[p]].upper === 'CONSTRAINT') {
    const next = tokens[s[p + 1]];
    if (next && !['PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK'].includes(next.upper)) {
      constraintName = identName(next);
      p += 2;
    } else {
      p += 1;
    }
  }
  const head = tokens[s[p]].upper;
  const label = constraintName ? `CONSTRAINT ${quoteIdent(constraintName)} ` : '';
  const group = findGroup(tokens, s[p], to);

  if (head === 'PRIMARY') {
    if (!group) throw new CompatError('PRIMARY KEY senza colonne tra parentesi.');
    return { kind: 'primary', columns: columnNamesOf(tokens, group.open, group.close), sql: `${label}PRIMARY KEY (${indexColumns(tokens, group.open, group.close).join(', ')})` };
  }
  if (head === 'UNIQUE' || head === 'KEY' || head === 'INDEX') {
    if (!group) throw new CompatError(`${head} senza colonne tra parentesi.`);
    // nome facoltativo tra la parola chiave e le parentesi
    const nameIdx = s.slice(p + 1).find((i) => i < group.open && tokens[i].type !== 'punct' && !['KEY', 'INDEX', 'USING', 'BTREE', 'HASH'].includes(tokens[i].upper));
    const columns = columnNamesOf(tokens, group.open, group.close);
    const indexName = constraintName || (nameIdx !== undefined ? identName(tokens[nameIdx]) : `${table}_${columns[0]}`);
    return {
      kind: 'index',
      unique: head === 'UNIQUE',
      columns,
      name: indexName,
      sql: `CREATE ${head === 'UNIQUE' ? 'UNIQUE ' : ''}INDEX ${quoteIdent(indexName)} ON ${quoteIdent(table)} (${indexColumns(tokens, group.open, group.close).join(', ')})`
    };
  }
  if (head === 'FULLTEXT' || head === 'SPATIAL') {
    return { kind: 'ignored' };
  }
  if (head === 'FOREIGN') {
    if (!group) throw new CompatError('FOREIGN KEY senza colonne tra parentesi.');
    const refIdx = findTopLevelWord(tokens, group.close + 1, to, ['REFERENCES']);
    if (refIdx === -1) throw new CompatError('FOREIGN KEY senza REFERENCES.');
    return {
      kind: 'foreign',
      name: constraintName,
      columns: columnNamesOf(tokens, group.open, group.close),
      sql: `${label}FOREIGN KEY (${indexColumns(tokens, group.open, group.close).join(', ')}) ${emit(tokens, refIdx, to, ctx).trim()}`
    };
  }
  if (head === 'CHECK') {
    if (!group) throw new CompatError('CHECK senza condizione tra parentesi.');
    const after = nextSig(tokens, group.close + 1, to);
    if (after !== -1 && tokens[after].upper === 'NOT') return { kind: 'ignored' };
    return { kind: 'check', name: constraintName, sql: `${label}CHECK (${emit(tokens, group.open + 1, group.close, ctx).trim()})` };
  }
  throw new CompatError(`Elemento non riconosciuto nella tabella: ${tokens[s[p]].text}`);
}

function isTableItem(tokens, from, to) {
  const first = nextSig(tokens, from, to);
  return first !== -1 && tokens[first].type === 'word' && TABLE_ITEM_START.has(tokens[first].upper);
}

// ---------------------------------------------------------------------------
// CREATE TABLE
// ---------------------------------------------------------------------------

/**
 * Traduce CREATE TABLE. `s` sono gli indici dei token significativi.
 */
export function translateCreateTable(tokens, s) {
  let p = 1;
  let temporary = false;
  if (tokens[s[p]].upper === 'TEMPORARY') {
    temporary = true;
    p++;
  }
  p++; // TABLE
  let ifNotExists = false;
  if (tokens[s[p]] && tokens[s[p]].upper === 'IF') {
    ifNotExists = true;
    p += 3;
  }
  // nome eventualmente qualificato: negozio.clienti
  if (tokens[s[p + 1]] && tokens[s[p + 1]].text === '.') p += 2;
  const table = identName(tokens[s[p]]);
  if (!table) throw new CompatError('Manca il nome della tabella.');
  p++;
  const head = `CREATE ${temporary ? 'TEMP ' : ''}TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}${quoteIdent(table)}`;
  const next = tokens[s[p]];

  if (!next) throw new CompatError(`Indica le colonne della tabella ${table} tra parentesi.`);

  if (next.upper === 'LIKE' || (next.text === '(' && tokens[s[p + 1]] && tokens[s[p + 1]].upper === 'LIKE')) {
    const srcTok = next.upper === 'LIKE' ? tokens[s[p + 1]] : tokens[s[p + 2]];
    const source = identName(srcTok);
    return [{ run: (rt) => createTableLike(rt, table, source, ifNotExists), message: 'Tabella creata.' }];
  }

  if (next.upper === 'AS' || next.upper === 'SELECT' || (next.text === '(' && tokens[s[p + 1]] && tokens[s[p + 1]].upper === 'SELECT')) {
    let start = next.upper === 'AS' ? s[p] + 1 : s[p];
    let end = tokens.length;
    // CREATE TABLE t AS (SELECT ...): SQLite non accetta la SELECT tra parentesi
    const first = nextSig(tokens, start, end);
    if (first !== -1 && tokens[first].text === '(') {
      const close = matchParen(tokens, first, end);
      if (close !== -1 && nextSig(tokens, close + 1, end) === -1) {
        start = first + 1;
        end = close;
      }
    }
    return [{ sql: `${head} AS ${emitSelect(tokens, start, end, createContext()).trim()}`, message: 'Tabella creata.' }];
  }

  if (next.text !== '(') throw new CompatError(`Dopo il nome della tabella ${table} servono le colonne tra parentesi.`);
  const close = matchParen(tokens, s[p], tokens.length);
  if (close === -1) throw new CompatError('Manca la parentesi di chiusura della CREATE TABLE.');
  const after = nextSig(tokens, close + 1, tokens.length);
  if (after !== -1 && findTopLevelWord(tokens, close + 1, tokens.length, ['SELECT', 'AS']) !== -1) {
    throw new CompatError('CREATE TABLE con colonne e SELECT insieme non è supportato: crea prima la tabella, poi usa INSERT INTO ... SELECT.');
  }

  const columns = [];
  const items = [];
  const extra = [];
  for (const [a, b] of splitTopLevel(tokens, s[p] + 1, close)) {
    if (nextSig(tokens, a, b) === -1) continue;
    if (isTableItem(tokens, a, b)) {
      const item = translateTableItem(tokens, a, b, table);
      if (item.kind === 'index') extra.push(item.sql);
      else if (item.kind !== 'ignored') items.push(item);
    } else {
      columns.push(translateColumnDef(tokens, a, b, { table }));
    }
  }
  return [{ sql: buildCreateTable(head, table, columns, items, extra), message: 'Tabella creata.', multi: true }];
}

/**
 * Compone il CREATE TABLE per SQLite gestendo AUTO_INCREMENT e PRIMARY KEY.
 */
function buildCreateTable(head, table, columns, items, extra) {
  const pkItem = items.find((it) => it.kind === 'primary');
  const lines = [];
  let skipPkItem = false;
  for (const col of columns) {
    let inlinePrimaryKey = col.primaryKey;
    let autoIncrement = col.autoIncrement;
    if (autoIncrement && !inlinePrimaryKey) {
      if (pkItem && pkItem.columns.length === 1 && pkItem.columns[0].toLowerCase() === col.name.toLowerCase()) {
        inlinePrimaryKey = true;
        skipPkItem = true;
      } else if (!pkItem && !columns.some((c) => c.primaryKey)) {
        inlinePrimaryKey = true;
      } else {
        autoIncrement = false;
      }
    }
    if (inlinePrimaryKey && pkItem && !skipPkItem) {
      throw new CompatError(`La tabella ${table} ha più di una chiave primaria.`);
    }
    lines.push(columnSql(col, { inlinePrimaryKey, autoIncrement }));
  }
  for (const item of items) {
    if (item.kind === 'primary' && skipPkItem) continue;
    lines.push(item.sql);
  }
  const statements = [`${head} (\n  ${lines.join(',\n  ')}\n)`, ...extra];
  for (const col of columns) if (col.onUpdateNow) statements.push(onUpdateTriggerSql(table, col.name));
  return statements.join(';\n');
}

function createTableLike(rt, table, source, ifNotExists) {
  const src = findTable(rt, source);
  if (!src || src.type !== 'table') throw new CompatError(`La tabella '${source}' non esiste.`);
  if (findTable(rt, table)) {
    if (ifNotExists) return { affectedRows: 0, message: 'La tabella esiste già.' };
    throw new Error(`table ${table} already exists`);
  }
  const sql = tableSql(rt, src.name).replace(/^CREATE\s+TABLE\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\S+)/i, `CREATE TABLE ${quoteIdent(table)}`);
  rt.exec(sql);
  for (const idx of rt.query("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL", [src.name])) {
    const indexSql = rewriteIndexSql(idx.sql, `${table}_${idx.name}`, table);
    rt.exec(indexSql);
  }
  return { affectedRows: 0, message: 'Tabella creata.' };
}

function rewriteIndexSql(sql, newName, newTable) {
  const tokens = tokenize(sql);
  const s = sig(tokens, 0, tokens.length);
  const onIdx = s.find((i) => tokens[i].upper === 'ON');
  const nameIdx = s[s.indexOf(onIdx) - 1];
  const tableIdx = s[s.indexOf(onIdx) + 1];
  return tokens.map((t, i) => (i === nameIdx ? quoteIdent(newName) : i === tableIdx ? quoteIdent(newTable) : t.text)).join('');
}

// ---------------------------------------------------------------------------
// Indici
// ---------------------------------------------------------------------------

export function translateCreateIndex(tokens, s) {
  let p = 1;
  let unique = false;
  const kind = tokens[s[p]].upper;
  if (kind === 'UNIQUE') {
    unique = true;
    p++;
  } else if (kind === 'FULLTEXT' || kind === 'SPATIAL') {
    throw new CompatError(MSG.fulltext);
  }
  p++; // INDEX
  let ifNotExists = false;
  if (tokens[s[p]] && tokens[s[p]].upper === 'IF') {
    ifNotExists = true;
    p += 3;
  }
  const name = identName(tokens[s[p]]);
  const onPos = s.findIndex((i) => tokens[i].upper === 'ON');
  if (onPos === -1) throw new CompatError('CREATE INDEX: manca ON nome_tabella.');
  let t = onPos + 1;
  if (tokens[s[t + 1]] && tokens[s[t + 1]].text === '.') t += 2;
  const table = identName(tokens[s[t]]);
  const group = findGroup(tokens, s[t], tokens.length);
  if (!group) throw new CompatError('CREATE INDEX: indica le colonne tra parentesi.');
  return [{
    sql: `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${ifNotExists ? 'IF NOT EXISTS ' : ''}${quoteIdent(name)} ON ${quoteIdent(table)} (${indexColumns(tokens, group.open, group.close).join(', ')})`,
    message: 'Indice creato.'
  }];
}

function resolveIndexName(rt, name, table) {
  const candidates = table ? [name, `${table}_${name}`] : [name];
  for (const candidate of candidates) {
    const row = rt.query("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name = ? COLLATE NOCASE", [candidate])[0];
    if (row) return row;
  }
  return null;
}

export function translateDropIndex(tokens, s) {
  let p = 2;
  let ifExists = false;
  if (tokens[s[p]] && tokens[s[p]].upper === 'IF') {
    ifExists = true;
    p += 2;
  }
  const name = identName(tokens[s[p]]);
  const onPos = s.findIndex((i) => tokens[i].upper === 'ON');
  const table = onPos === -1 ? null : identName(tokens[s[onPos + 1]]);
  return [{
    run: (rt) => {
      if (name && name.toUpperCase() === 'PRIMARY' && table) {
        alterTable(rt, table, [{ type: 'dropPrimaryKey' }]);
        return { affectedRows: 0, message: 'Chiave primaria eliminata.' };
      }
      const found = resolveIndexName(rt, name, table);
      if (!found) {
        if (table && dropUniqueConstraint(rt, table, name)) return { affectedRows: 0, message: 'Indice eliminato.' };
        if (ifExists) return { affectedRows: 0, message: 'L\'indice non esiste.' };
        throw new Error(`no such index: ${name}`);
      }
      rt.exec(`DROP INDEX ${quoteIdent(found.name)}`);
      return { affectedRows: 0, message: 'Indice eliminato.' };
    }
  }];
}

// UNIQUE dichiarato nella colonna o come vincolo: si toglie ricostruendo la tabella
function dropUniqueConstraint(rt, table, name) {
  const model = loadModel(rt, table);
  const lower = name.toLowerCase();
  const col = model.columns.find((c) => c.name.toLowerCase() === lower && /\bUNIQUE\b/i.test(c.rest));
  if (col) {
    col.rest = col.rest.replace(/\s*\bUNIQUE\b/i, '');
    rebuildTable(rt, model);
    return true;
  }
  const item = model.constraints.find((c) => c.kind === 'unique' && c.name && c.name.toLowerCase() === lower);
  if (item) {
    model.constraints = model.constraints.filter((c) => c !== item);
    rebuildTable(rt, model);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// ALTER TABLE
// ---------------------------------------------------------------------------

/**
 * Analizza le azioni di ALTER TABLE (la sintassi) e restituisce un passo che
 * le applica sul database.
 */
export function translateAlterTable(tokens, s) {
  let p = 1;
  if (tokens[s[p]].upper === 'IGNORE' || tokens[s[p]].upper === 'ONLINE') p++;
  p++; // TABLE
  if (tokens[s[p + 1]] && tokens[s[p + 1]].text === '.') p += 2;
  const table = identName(tokens[s[p]]);
  const start = s[p] + 1;
  const actions = [];
  for (const [a, b] of splitTopLevel(tokens, start, tokens.length)) {
    if (nextSig(tokens, a, b) !== -1) actions.push(...[].concat(parseAlterAction(tokens, a, b, table)));
  }
  return [{ run: (rt) => alterTable(rt, table, actions.filter(Boolean)) }];
}

function parseAlterAction(tokens, from, to, table) {
  const s = sig(tokens, from, to);
  const w = (n) => (tokens[s[n]] && tokens[s[n]].type === 'word' ? tokens[s[n]].upper : null);
  const position = (defEnd) => {
    // FIRST | AFTER colonna alla fine della definizione
    const firstIdx = findTopLevelWord(tokens, from, to, ['FIRST', 'AFTER']);
    if (firstIdx === -1) return { end: defEnd, position: null };
    const word = tokens[firstIdx].upper;
    if (word === 'FIRST') return { end: firstIdx, position: { first: true } };
    return { end: firstIdx, position: { after: identName(tokens[nextSig(tokens, firstIdx + 1, to)]) } };
  };

  switch (w(0)) {
    case 'ADD': {
      let n = 1;
      if (w(1) === 'COLUMN') n = 2;
      const next = tokens[s[n]];
      if (next && next.text === '(' && w(1) === 'COLUMN') {
        const close = matchParen(tokens, s[n], to);
        return splitTopLevel(tokens, s[n] + 1, close).map(([a, b]) => ({ type: 'addColumn', def: translateColumnDef(tokens, a, b, { table }) }));
      }
      if (n === 1 && isTableItem(tokens, s[1], to)) {
        const item = translateTableItem(tokens, s[1], to, table);
        if (item.kind === 'ignored') return null;
        return { type: 'addItem', item };
      }
      const { end, position: pos } = position(to);
      return { type: 'addColumn', def: translateColumnDef(tokens, s[n], end, { table }), position: pos };
    }
    case 'MODIFY': {
      const n = w(1) === 'COLUMN' ? 2 : 1;
      const { end, position: pos } = position(to);
      const def = translateColumnDef(tokens, s[n], end, { table });
      return { type: 'modifyColumn', from: def.name, def, position: pos };
    }
    case 'CHANGE': {
      const n = w(1) === 'COLUMN' ? 2 : 1;
      const oldName = identName(tokens[s[n]]);
      const { end, position: pos } = position(to);
      const def = translateColumnDef(tokens, s[n + 1], end, { table });
      return { type: 'modifyColumn', from: oldName, def, position: pos };
    }
    case 'ALTER': {
      const n = w(1) === 'COLUMN' ? 2 : 1;
      const column = identName(tokens[s[n]]);
      if (w(n + 1) === 'SET' && w(n + 2) === 'DEFAULT') {
        const def = { name: column, defaultSql: null };
        parseDefault(tokens, s, n + 3, to, def, createContext());
        return { type: 'setDefault', column, value: def.defaultSql };
      }
      if (w(n + 1) === 'DROP' && w(n + 2) === 'DEFAULT') return { type: 'setDefault', column, value: null };
      return null;
    }
    case 'DROP': {
      if (w(1) === 'PRIMARY') return { type: 'dropPrimaryKey' };
      if (w(1) === 'FOREIGN') return { type: 'dropConstraint', kind: 'foreign', name: identName(tokens[s[3]]) };
      if (w(1) === 'INDEX' || w(1) === 'KEY') return { type: 'dropIndex', name: identName(tokens[s[2]]) };
      if (w(1) === 'CHECK' || w(1) === 'CONSTRAINT') return { type: 'dropConstraint', kind: null, name: identName(tokens[s[2]]) };
      const n = w(1) === 'COLUMN' ? 2 : 1;
      return { type: 'dropColumn', column: identName(tokens[s[n]]) };
    }
    case 'RENAME': {
      if (w(1) === 'COLUMN') return { type: 'renameColumn', from: identName(tokens[s[2]]), to: identName(tokens[s[4]]) };
      if (w(1) === 'INDEX' || w(1) === 'KEY') return { type: 'renameIndex', from: identName(tokens[s[2]]), to: identName(tokens[s[4]]) };
      const n = w(1) === 'TO' || w(1) === 'AS' ? 2 : 1;
      if (tokens[s[n + 1]] && tokens[s[n + 1]].text === '.') return { type: 'renameTable', to: identName(tokens[s[n + 2]]) };
      return { type: 'renameTable', to: identName(tokens[s[n]]) };
    }
    // Opzioni senza effetto nel browser
    case 'ENGINE':
    case 'AUTO_INCREMENT':
    case 'CONVERT':
    case 'DEFAULT':
    case 'CHARACTER':
    case 'CHARSET':
    case 'COLLATE':
    case 'COMMENT':
    case 'ALGORITHM':
    case 'LOCK':
    case 'FORCE':
    case 'ORDER':
    case 'ROW_FORMAT':
      return null;
    default:
      throw new CompatError(`ALTER TABLE: operazione non supportata (${tokens[s[0]].text}).`);
  }
}

/**
 * Modello della tabella ricavato dal suo CREATE TABLE in SQLite.
 */
export function loadModel(rt, table) {
  const found = findTable(rt, table);
  if (!found || found.type !== 'table') throw new Error(`no such table: ${table}`);
  const sql = tableSql(rt, found.name);
  const tokens = tokenize(sql);
  const open = tokens.findIndex((t) => t.type === 'punct' && t.text === '(');
  const close = matchParen(tokens, open, tokens.length);
  const columns = [];
  const constraints = [];
  for (const [a, b] of splitTopLevel(tokens, open + 1, close)) {
    const s = sig(tokens, a, b);
    if (!s.length) continue;
    const text = tokens.slice(s[0], s[s.length - 1] + 1).map((t) => t.text).join('');
    const first = tokens[s[0]];
    if (first.type === 'word' && ['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'CHECK', 'FOREIGN'].includes(first.upper)) {
      let name = null;
      let headIdx = 0;
      if (first.upper === 'CONSTRAINT') {
        name = identName(tokens[s[1]]);
        headIdx = 2;
      }
      const head = tokens[s[headIdx]] ? tokens[s[headIdx]].upper : '';
      const kind = head === 'PRIMARY' ? 'primary' : head === 'UNIQUE' ? 'unique' : head === 'FOREIGN' ? 'foreign' : 'check';
      const group = findGroup(tokens, s[headIdx], b);
      const cols = group && kind !== 'check' ? columnNamesOf(tokens, group.open, group.close) : [];
      constraints.push({ kind, name, columns: cols, sql: text });
    } else {
      const name = identName(first);
      const rest = tokens.slice(s[0] + 1, s[s.length - 1] + 1).map((t) => t.text).join('').trim();
      columns.push({ name, rest, copyFrom: name });
    }
  }
  const indexes = rt.query("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL", [found.name]);
  const triggers = rt.query("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?", [found.name]);
  return { table: found.name, columns, constraints, indexes, triggers, addedDefaults: new Map() };
}

function findColumn(model, name) {
  const lower = String(name).toLowerCase();
  const col = model.columns.find((c) => c.name.toLowerCase() === lower);
  if (!col) throw new Error(`no such column: ${name}`);
  return col;
}

function placeColumn(model, column, position) {
  if (!position) {
    model.columns.push(column);
    return;
  }
  if (position.first) {
    model.columns.unshift(column);
    return;
  }
  const index = model.columns.findIndex((c) => c.name.toLowerCase() === String(position.after).toLowerCase());
  if (index === -1) throw new Error(`no such column: ${position.after}`);
  model.columns.splice(index + 1, 0, column);
}

function hasPrimaryKey(model) {
  return model.constraints.some((c) => c.kind === 'primary') || model.columns.some((c) => /\bPRIMARY\s+KEY\b/i.test(c.rest));
}

// Testo della colonna senza il nome, a partire dalla definizione tradotta
function columnRest(def, options) {
  return columnSql(def, options).slice(quoteIdent(def.name).length).trim();
}

function columnUses(sqlText, column) {
  const re = new RegExp(`(^|[^A-Za-z0-9_])[\`"\\[]?${column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\`"\\]]?([^A-Za-z0-9_]|$)`, 'i');
  return re.test(sqlText);
}

/**
 * Applica le azioni di ALTER TABLE. Le rinominazioni usano i comandi nativi
 * di SQLite, il resto ricostruisce la tabella.
 */
export function alterTable(rt, table, actions) {
  if (!actions.length) return { affectedRows: 0, message: 'Nessuna modifica necessaria.' };
  if (!findTable(rt, table)) throw new Error(`no such table: ${table}`);
  // In MySQL i comandi DDL chiudono la transazione aperta
  if (rt.inTransaction()) rt.exec('COMMIT');

  const native = actions.every((a) => ['renameColumn', 'renameTable', 'addItemIndex', 'dropIndex', 'renameIndex'].includes(a.type) || (a.type === 'addItem' && a.item.kind === 'index'));
  let current = table;
  if (native) {
    for (const action of actions) current = applyNative(rt, current, action);
    return { affectedRows: 0, message: 'Tabella modificata.' };
  }

  const model = loadModel(rt, table);
  const after = [];
  for (const action of actions) {
    switch (action.type) {
      case 'addColumn': {
        const def = action.def;
        if ((def.primaryKey || def.autoIncrement) && hasPrimaryKey(model)) {
          throw new CompatError(`La tabella ${table} ha già una chiave primaria.`);
        }
        const column = { name: def.name, rest: columnRest(def, { inlinePrimaryKey: def.primaryKey || def.autoIncrement }), copyFrom: null };
        if (def.notNull && def.defaultSql === null && !def.primaryKey && !def.autoIncrement && !def.generated) {
          column.fill = implicitDefault(def.typeUpper, def.enumList && def.enumList[0]);
        }
        placeColumn(model, column, action.position);
        if (def.onUpdateNow) after.push(onUpdateTriggerSql(model.table, def.name));
        break;
      }
      case 'modifyColumn': {
        const old = findColumn(model, action.from);
        const def = action.def;
        const keepPk = /\bPRIMARY\s+KEY\b/i.test(old.rest) && !def.primaryKey;
        const keepAuto = /\bAUTOINCREMENT\b/i.test(old.rest);
        const replacement = {
          name: def.name,
          rest: columnRest(def, { inlinePrimaryKey: def.primaryKey || keepPk, autoIncrement: def.autoIncrement || (keepAuto && keepPk) }),
          copyFrom: old.copyFrom
        };
        const index = model.columns.indexOf(old);
        model.columns.splice(index, 1);
        if (action.position) placeColumn(model, replacement, action.position);
        else model.columns.splice(index, 0, replacement);
        if (old.name.toLowerCase() !== def.name.toLowerCase()) renameInModel(model, old.name, def.name);
        if (def.onUpdateNow) after.push(onUpdateTriggerSql(model.table, def.name));
        break;
      }
      case 'setDefault': {
        const col = findColumn(model, action.column);
        col.rest = col.rest.replace(/\s*\bDEFAULT\s+(\([^)]*\)+|'(?:[^']|'')*'|[-+]?[^\s,]+)/i, '');
        if (action.value !== null) col.rest += ` DEFAULT ${action.value}`;
        break;
      }
      case 'dropColumn': {
        const col = findColumn(model, action.column);
        const blocking = model.constraints.find((c) => (c.kind === 'foreign' && c.columns.some((x) => x.toLowerCase() === col.name.toLowerCase())) || (c.kind === 'check' && columnUses(c.sql, col.name)));
        if (blocking) {
          throw new CompatError(`Non posso eliminare la colonna ${col.name}: è usata in un vincolo (${blocking.kind === 'foreign' ? 'FOREIGN KEY' : 'CHECK'}). Elimina prima il vincolo.`);
        }
        model.columns = model.columns.filter((c) => c !== col);
        for (const c of model.constraints) {
          if (c.kind === 'primary' || c.kind === 'unique') c.columns = c.columns.filter((x) => x.toLowerCase() !== col.name.toLowerCase());
        }
        model.constraints = model.constraints
          .filter((c) => !((c.kind === 'primary' || c.kind === 'unique') && c.columns.length === 0))
          .map((c) => ((c.kind === 'primary' || c.kind === 'unique') ? { ...c, sql: `${c.name ? `CONSTRAINT ${quoteIdent(c.name)} ` : ''}${c.kind === 'primary' ? 'PRIMARY KEY' : 'UNIQUE'} (${c.columns.map(quoteIdent).join(', ')})` } : c));
        model.indexes = model.indexes.filter((idx) => !columnUses(idx.sql.slice(idx.sql.indexOf('(')), col.name));
        model.triggers = model.triggers.filter((trg) => !columnUses(trg.sql, col.name));
        break;
      }
      case 'renameColumn': {
        const col = findColumn(model, action.from);
        col.name = action.to;
        renameInModel(model, action.from, action.to);
        break;
      }
      case 'addItem': {
        const item = action.item;
        if (item.kind === 'index') {
          after.push(item.sql);
        } else if (item.kind === 'primary') {
          if (hasPrimaryKey(model)) throw new CompatError(`La tabella ${table} ha già una chiave primaria.`);
          model.constraints.push({ kind: 'primary', name: null, columns: item.columns, sql: item.sql });
        } else {
          model.constraints.push({ kind: item.kind, name: item.name || null, columns: item.columns || [], sql: item.sql });
        }
        break;
      }
      case 'dropPrimaryKey': {
        model.constraints = model.constraints.filter((c) => c.kind !== 'primary');
        for (const col of model.columns) {
          col.rest = col.rest.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/i, 'INT').replace(/\s*\bPRIMARY\s+KEY\b(\s+AUTOINCREMENT\b)?/i, '');
        }
        break;
      }
      case 'dropConstraint': {
        const lower = String(action.name).toLowerCase();
        let index = model.constraints.findIndex((c) => c.name && c.name.toLowerCase() === lower && (!action.kind || c.kind === action.kind));
        if (index === -1 && action.kind === 'foreign') {
          // nomi automatici di MySQL: tabella_ibfk_1, tabella_ibfk_2...
          const m = lower.match(/_ibfk_(\d+)$/);
          const foreign = model.constraints.filter((c) => c.kind === 'foreign');
          if (m && foreign[Number(m[1]) - 1]) index = model.constraints.indexOf(foreign[Number(m[1]) - 1]);
        }
        if (index === -1) throw new CompatError(`Il vincolo '${action.name}' non esiste.`);
        model.constraints.splice(index, 1);
        break;
      }
      case 'dropIndex': {
        const lower = action.name.toLowerCase();
        const before = model.indexes.length;
        model.indexes = model.indexes.filter((idx) => idx.name.toLowerCase() !== lower && idx.name.toLowerCase() !== `${model.table}_${action.name}`.toLowerCase());
        if (model.indexes.length === before) {
          const col = model.columns.find((c) => c.name.toLowerCase() === lower && /\bUNIQUE\b/i.test(c.rest));
          const constraint = model.constraints.find((c) => c.kind === 'unique' && ((c.name && c.name.toLowerCase() === lower) || (c.columns[0] && c.columns[0].toLowerCase() === lower)));
          if (col) col.rest = col.rest.replace(/\s*\bUNIQUE\b/i, '');
          else if (constraint) model.constraints = model.constraints.filter((c) => c !== constraint);
          else throw new Error(`no such index: ${action.name}`);
        }
        break;
      }
      case 'renameIndex':
      case 'renameTable':
        after.push(action);
        break;
      default:
        break;
    }
  }
  rebuildTable(rt, model);
  let currentName = model.table;
  for (const step of after) {
    if (typeof step === 'string') rt.exec(step);
    else currentName = applyNative(rt, currentName, step);
  }
  return { affectedRows: 0, message: 'Tabella modificata.' };
}

function renameInModel(model, from, to) {
  const re = new RegExp(`([\`"\\[]?)\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b([\`"\\]]?)`, 'gi');
  const replace = (text) => text.replace(re, () => quoteIdent(to));
  for (const c of model.constraints) {
    c.sql = c.kind === 'foreign'
      ? c.sql.replace(/^(.*?FOREIGN\s+KEY\s*\()([^)]*)(\))/is, (m, a, cols, b) => a + replace(cols) + b)
      : replace(c.sql);
    c.columns = c.columns.map((x) => (x.toLowerCase() === from.toLowerCase() ? to : x));
  }
  model.indexes = model.indexes.map((idx) => ({ ...idx, sql: idx.sql.slice(0, idx.sql.indexOf('(')) + replace(idx.sql.slice(idx.sql.indexOf('('))) }));
  model.triggers = model.triggers.filter((trg) => !columnUses(trg.sql, from) || trg.name.startsWith('qf_onupdate_'))
    .map((trg) => (trg.name.startsWith('qf_onupdate_') && columnUses(trg.sql, from)
      ? { name: `qf_onupdate_${model.table}_${to}`, sql: onUpdateTriggerSql(model.table, to) }
      : trg));
}

function applyNative(rt, table, action) {
  switch (action.type) {
    case 'renameColumn':
      rt.exec(`ALTER TABLE ${quoteIdent(table)} RENAME COLUMN ${quoteIdent(action.from)} TO ${quoteIdent(action.to)}`);
      return table;
    case 'renameTable':
      rt.exec(`ALTER TABLE ${quoteIdent(table)} RENAME TO ${quoteIdent(action.to)}`);
      return action.to;
    case 'addItem':
      rt.exec(action.item.sql);
      return table;
    case 'dropIndex': {
      const found = resolveIndexName(rt, action.name, table);
      if (found) {
        rt.exec(`DROP INDEX ${quoteIdent(found.name)}`);
      } else if (!dropUniqueConstraint(rt, table, action.name)) {
        throw new Error(`no such index: ${action.name}`);
      }
      return table;
    }
    case 'renameIndex': {
      const found = resolveIndexName(rt, action.from, table);
      if (!found) throw new Error(`no such index: ${action.from}`);
      const sql = rt.query("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?", [found.name])[0].sql;
      rt.exec(`DROP INDEX ${quoteIdent(found.name)}`);
      rt.exec(rewriteIndexSql(sql, action.to, table));
      return table;
    }
    default:
      return table;
  }
}

/**
 * Ricostruisce la tabella secondo il modello (procedura consigliata da SQLite):
 * nuova tabella, copia dei dati, eliminazione della vecchia, rinomina.
 */
export function rebuildTable(rt, model) {
  const fkWasOn = rt.foreignKeysEnabled();
  const tmp = `qf_rebuild_${model.table}`;
  const items = [...model.columns.map((c) => `${quoteIdent(c.name)} ${c.rest}`.trim()), ...model.constraints.map((c) => c.sql)];
  const targets = [];
  const sources = [];
  for (const col of model.columns) {
    if (col.copyFrom) {
      targets.push(quoteIdent(col.name));
      sources.push(quoteIdent(col.copyFrom));
    } else if (col.fill !== undefined) {
      targets.push(quoteIdent(col.name));
      sources.push(col.fill);
    }
  }
  if (rt.inTransaction()) rt.exec('COMMIT');
  if (fkWasOn) rt.exec('PRAGMA foreign_keys = OFF');
  rt.exec('PRAGMA legacy_alter_table = ON');
  rt.exec('BEGIN');
  try {
    rt.exec(`CREATE TABLE ${quoteIdent(tmp)} (\n  ${items.join(',\n  ')}\n)`);
    if (targets.length) {
      rt.exec(`INSERT INTO ${quoteIdent(tmp)} (${targets.join(', ')}) SELECT ${sources.join(', ')} FROM ${quoteIdent(model.table)}`);
    }
    rt.exec(`DROP TABLE ${quoteIdent(model.table)}`);
    rt.exec(`ALTER TABLE ${quoteIdent(tmp)} RENAME TO ${quoteIdent(model.table)}`);
    for (const idx of model.indexes) rt.exec(idx.sql);
    for (const trg of model.triggers) rt.exec(trg.sql);
    if (fkWasOn) {
      const problems = rt.query(`SELECT * FROM pragma_foreign_key_check(${sqliteString(model.table)})`);
      if (problems.length) throw new Error('FOREIGN KEY constraint failed');
    }
    rt.exec('COMMIT');
  } catch (error) {
    try {
      rt.exec('ROLLBACK');
    } catch (e) {
      // la transazione potrebbe essere già stata chiusa
    }
    throw error;
  } finally {
    rt.exec('PRAGMA legacy_alter_table = OFF');
    if (fkWasOn) rt.exec('PRAGMA foreign_keys = ON');
  }
}
