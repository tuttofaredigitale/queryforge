// File: src/engine/translator.js
// Traduce le istruzioni MySQL in istruzioni SQLite eseguibili da sql.js.
// Ogni istruzione diventa un "piano": una lista di passi SQL o di funzioni
// che lavorano direttamente sul database (per i comandi da emulare).

import { isSignificant, nextSig, prevSig, matchParen, splitTopLevel, findTopLevelWord } from './tokenizer.js';
import { CompatError, MSG } from './errors.js';

export const INTERVAL_UNITS = new Set([
  'MICROSECOND', 'SECOND', 'MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR',
  'SECOND_MICROSECOND', 'MINUTE_MICROSECOND', 'MINUTE_SECOND', 'HOUR_MICROSECOND', 'HOUR_SECOND',
  'HOUR_MINUTE', 'DAY_MICROSECOND', 'DAY_SECOND', 'DAY_MINUTE', 'DAY_HOUR', 'YEAR_MONTH'
]);

const COMPARISON = new Set(['=', '<>', '!=', '<', '>', '<=', '>=']);
const TABLE_CONTEXT = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'REFERENCES', 'DESCRIBE', 'DESC']);
const SYSTEM_SCHEMAS = new Set(['INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'MYSQL', 'SYS']);

// Funzioni MySQL che in SQLite hanno un altro nome (o che registriamo con un altro nome)
const RENAMED_FUNCTIONS = {
  LENGTH: 'OCTET_LENGTH',
  CHAR_LENGTH: 'LENGTH',
  CHARACTER_LENGTH: 'LENGTH',
  ISNULL: 'MYSQL_ISNULL',
  LAST_INSERT_ID: 'LAST_INSERT_ROWID',
  ROW_COUNT: 'CHANGES',
  JSON_ARRAYAGG: 'JSON_GROUP_ARRAY',
  JSON_OBJECTAGG: 'JSON_GROUP_OBJECT',
  SCHEMA: 'DATABASE',
  SESSION_USER: 'USER',
  SYSTEM_USER: 'USER',
  CURRENT_USER: 'USER',
  CURRENT_TIMESTAMP: 'NOW',
  LOCALTIME: 'NOW',
  LOCALTIMESTAMP: 'NOW',
  CURRENT_DATE: 'CURDATE',
  CURRENT_TIME: 'CURTIME'
};

// Parole chiave che MySQL accetta anche senza parentesi
const KEYWORD_VALUES = {
  CURRENT_TIMESTAMP: 'NOW()',
  LOCALTIME: 'NOW()',
  LOCALTIMESTAMP: 'NOW()',
  CURRENT_DATE: 'CURDATE()',
  CURRENT_TIME: 'CURTIME()',
  CURRENT_USER: 'USER()',
  UTC_TIMESTAMP: 'UTC_TIMESTAMP()',
  UTC_DATE: 'UTC_DATE()',
  UTC_TIME: 'UTC_TIME()'
};

const DROPPED_MODIFIERS = new Set([
  'SQL_CALC_FOUND_ROWS', 'SQL_NO_CACHE', 'SQL_CACHE', 'HIGH_PRIORITY', 'LOW_PRIORITY',
  'DELAYED', 'QUICK', 'SQL_SMALL_RESULT', 'SQL_BIG_RESULT', 'SQL_BUFFER_RESULT'
]);
const MODIFIER_CONTEXT = new Set(['SELECT', 'INSERT', 'REPLACE', 'UPDATE', 'DELETE', 'DISTINCT', 'ALL', 'IGNORE', 'STRAIGHT_JOIN', ...DROPPED_MODIFIERS]);
const SELECT_MODIFIERS = new Set(['DISTINCT', 'ALL', 'DISTINCTROW', 'STRAIGHT_JOIN', ...DROPPED_MODIFIERS]);
const SELECT_LIST_END = ['FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'UNION', 'INTO', 'WINDOW', 'FOR', 'LOCK', 'EXCEPT', 'INTERSECT'];

// Parole che non possono essere un alias implicito di colonna
const NOT_ALIAS_WORDS = new Set(['END', 'NULL', 'TRUE', 'FALSE', 'UNKNOWN', 'ASC', 'DESC']);
const OPERAND_KEYWORDS = new Set([
  'AND', 'OR', 'NOT', 'XOR', 'IS', 'LIKE', 'REGEXP', 'RLIKE', 'IN', 'BETWEEN', 'DISTINCT', 'SELECT', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'INTERVAL', 'BINARY', 'ESCAPE', 'DIV', 'MOD', 'ALL', 'ANY', 'SOME', 'EXISTS'
]);

// ---------------------------------------------------------------------------
// Utilità sui letterali
// ---------------------------------------------------------------------------

export function sqliteString(value) {
  return `'${String(value).replace(/\0/g, '').replace(/'/g, "''")}'`;
}

export function quoteIdent(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

function numberLiteral(token) {
  if (token.literal === 'B') return String(parseInt(token.body || '0', 2));
  return token.text;
}

export function identName(token) {
  if (!token) return null;
  if (token.type === 'qident') return token.value;
  if (token.type === 'word') return token.text;
  if (token.type === 'string') return token.value;
  return null;
}

export function originalText(tokens, from, to) {
  return tokens.slice(from, to).filter((t) => t.type !== 'comment').map((t) => t.text).join('').trim();
}

const normalizeWs = (text) => text.replace(/\s+/g, ' ').trim();

export function createContext(options = {}) {
  return { uid: 0, upsert: false, upsertAlias: null, likeEscapeAt: -1, ...options };
}

// ---------------------------------------------------------------------------
// Traduzione delle espressioni
// I token vengono trasformati in "pezzi" (chunk). Tenere traccia del tipo di
// ogni pezzo permette di riscrivere costrutti che dipendono dall'operando a
// sinistra, come "data + INTERVAL 1 DAY" o "prezzo > ALL (SELECT ...)".
// ---------------------------------------------------------------------------

function chunk(text, kind, extra) {
  return { text, kind, ...extra };
}

function lastNonWs(out) {
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].kind !== 'ws') return out[i];
  }
  return null;
}

function popWs(out) {
  while (out.length && out[out.length - 1].kind === 'ws') out.pop();
}

// Rimuove dall'output l'ultimo operando (letterale, colonna anche qualificata, chiamata o gruppo)
function popOperand(out) {
  popWs(out);
  if (!out.length) return null;
  const last = out[out.length - 1];
  if (!['primary', 'word', 'group'].includes(last.kind)) return null;
  const parts = [out.pop()];
  while (out.length >= 2 && out[out.length - 1].kind === 'dot' && ['primary', 'word'].includes(out[out.length - 2].kind)) {
    parts.unshift(out.pop());
    parts.unshift(out.pop());
  }
  return parts.map((p) => p.text).join('');
}

// Fine di un operando semplice a partire da `start`
function operandEnd(tokens, start, to) {
  if (start === -1) return -1;
  const t = tokens[start];
  if (t.type === 'punct' && t.text === '(') {
    const close = matchParen(tokens, start, to);
    return close === -1 ? to : close + 1;
  }
  let end = start + 1;
  const k = nextSig(tokens, end, to);
  if ((t.type === 'word' || t.type === 'qident') && k !== -1 && tokens[k].text === '(') {
    const close = matchParen(tokens, k, to);
    return close === -1 ? to : close + 1;
  }
  while (true) {
    const dot = nextSig(tokens, end, to);
    if (dot === -1 || tokens[dot].text !== '.') break;
    const after = nextSig(tokens, dot + 1, to);
    if (after === -1) break;
    end = after + 1;
  }
  return end;
}

/**
 * Traduce i token [from, to) in SQL per SQLite.
 */
export function emit(tokens, from, to, ctx) {
  const out = [];
  let i = from;
  while (i < to) {
    i = emitToken(tokens, i, to, out, ctx);
  }
  return out.map((c) => c.text).join('');
}

function emitToken(tokens, i, to, out, ctx) {
  const t = tokens[i];
  switch (t.type) {
    case 'ws':
      out.push(chunk(t.text, 'ws'));
      return i + 1;
    case 'comment':
      out.push(chunk(' ', 'ws'));
      return i + 1;
    case 'string': {
      out.push(chunk(sqliteString(t.value), 'primary'));
      if (ctx.likeEscapeAt === i) {
        ctx.likeEscapeAt = -1;
        const k = nextSig(tokens, i + 1, to);
        if (k === -1 || tokens[k].upper !== 'ESCAPE') out.push(chunk(" ESCAPE '\\'", 'word'));
      }
      return i + 1;
    }
    case 'qident':
      return emitIdentifier(tokens, i, to, out, ctx, quoteIdent(t.value));
    case 'number':
      out.push(chunk(numberLiteral(t), 'primary'));
      return i + 1;
    case 'variable':
      throw new CompatError(MSG.variables);
    case 'param':
      throw new CompatError('Sostituisci i punti di domanda (?) con i valori veri, ad esempio: VALUES (\'Mario\', 25).');
    case 'op':
      return emitOperator(tokens, i, out);
    case 'punct':
      return emitPunct(tokens, i, to, out, ctx);
    case 'word':
      return emitWord(tokens, i, to, out, ctx);
    default:
      out.push(chunk(t.text, 'primary'));
      return i + 1;
  }
}

// Nomi qualificati con il database (negozio.clienti): togliamo il database
function skipSchemaQualifier(tokens, i, to) {
  const prevIdx = prevSig(tokens, i);
  const prev = prevIdx === -1 ? null : tokens[prevIdx];
  if (!prev || prev.type !== 'word' || !TABLE_CONTEXT.has(prev.upper)) return -1;
  const dot = nextSig(tokens, i + 1, to);
  if (dot === -1 || tokens[dot].text !== '.') return -1;
  const after = nextSig(tokens, dot + 1, to);
  if (after === -1 || (tokens[after].type !== 'word' && tokens[after].type !== 'qident')) return -1;
  const name = identName(tokens[i]).toUpperCase();
  if (SYSTEM_SCHEMAS.has(name)) throw new CompatError(MSG.informationSchema);
  if (name === 'MAIN' || name === 'TEMP') return -1;
  return dot + 1;
}

function emitIdentifier(tokens, i, to, out, ctx, text) {
  const skip = skipSchemaQualifier(tokens, i, to);
  if (skip !== -1) return skip;
  if (ctx.upsertAlias && identName(tokens[i]).toLowerCase() === ctx.upsertAlias) {
    const dot = nextSig(tokens, i + 1, to);
    if (dot !== -1 && tokens[dot].text === '.') {
      out.push(chunk('excluded', 'word'));
      return i + 1;
    }
  }
  out.push(chunk(text, 'primary'));
  return i + 1;
}

function emitOperator(tokens, i, out) {
  const op = tokens[i].text;
  switch (op) {
    case '<=>':
      out.push(chunk(' IS ', 'op', { op: 'IS' }));
      break;
    case '&&':
      out.push(chunk(' AND ', 'op', { op: 'AND' }));
      break;
    case '||':
      out.push(chunk(' OR ', 'op', { op: 'OR' }));
      break;
    case '!':
      out.push(chunk(' NOT ', 'op', { op: 'NOT' }));
      break;
    case ':=':
      throw new CompatError(MSG.variables);
    case '/':
      // In MySQL la divisione restituisce sempre un decimale (5/2 = 2.5)
      out.push(chunk(' * 1.0 / ', 'op', { op: '/' }));
      break;
    default:
      out.push(chunk(op, 'op', { op, cmp: COMPARISON.has(op) }));
  }
  return i + 1;
}

function emitPunct(tokens, i, to, out, ctx) {
  const t = tokens[i];
  if (t.text === '(') {
    const close = matchParen(tokens, i, to);
    if (close === -1) {
      out.push(chunk('(', 'punct'));
      return i + 1;
    }
    const first = nextSig(tokens, i + 1, close);
    const inner = first !== -1 && tokens[first].upper === 'SELECT'
      ? emitSelect(tokens, i + 1, close, ctx)
      : emit(tokens, i + 1, close, ctx);
    out.push(chunk(`(${inner})`, 'group'));
    return close + 1;
  }
  if (t.text === '.') {
    out.push(chunk('.', 'dot'));
    return i + 1;
  }
  if (t.text === ',') {
    out.push(chunk(',', 'comma'));
    return i + 1;
  }
  out.push(chunk(t.text, 'punct'));
  return i + 1;
}

function isTableName(tokens, i) {
  const p = prevSig(tokens, i);
  return p !== -1 && tokens[p].type === 'word' && TABLE_CONTEXT.has(tokens[p].upper);
}

function emitWord(tokens, i, to, out, ctx) {
  const t = tokens[i];
  const word = t.upper;
  const k = nextSig(tokens, i + 1, to);
  const next = k === -1 ? null : tokens[k];
  const prevIdx = prevSig(tokens, i);
  const prev = prevIdx === -1 ? null : tokens[prevIdx];
  const followedByParen = Boolean(next && next.type === 'punct' && next.text === '(');

  const skip = skipSchemaQualifier(tokens, i, to);
  if (skip !== -1) return skip;
  if (word === 'INFORMATION_SCHEMA' && next && next.text === '.') throw new CompatError(MSG.informationSchema);

  // Costrutti che vanno gestiti prima delle chiamate di funzione
  if (word === 'INTERVAL') {
    const r = emitInterval(tokens, i, to, out, ctx);
    if (r !== null) return r;
  }
  if (word === 'ALL' || word === 'ANY' || word === 'SOME') {
    const r = emitQuantified(tokens, i, to, out, ctx, word, k);
    if (r !== null) return r;
  }

  if (followedByParen && !isTableName(tokens, i)) {
    const close = matchParen(tokens, k, to);
    if (close !== -1) {
      const special = SPECIAL_CALLS[word];
      if (special) {
        out.push(chunk(special(tokens, k, close, ctx, word), 'primary'));
        return close + 1;
      }
      const name = RENAMED_FUNCTIONS[word] || t.text;
      const first = nextSig(tokens, k + 1, close);
      const inner = first !== -1 && tokens[first].upper === 'SELECT'
        ? emitSelect(tokens, k + 1, close, ctx)
        : emit(tokens, k + 1, close, ctx);
      out.push(chunk(`${name}(${inner})`, 'primary'));
      return close + 1;
    }
  }

  switch (word) {
    case 'RLIKE':
      out.push(chunk('REGEXP', 'word'));
      return i + 1;
    case 'DIV':
      out.push(chunk('/', 'op', { op: '/' }));
      return i + 1;
    case 'LIKE':
      if (next && next.type === 'string' && next.value.includes('\\')) ctx.likeEscapeAt = k;
      break;
    case 'FROM':
      if (next && next.type === 'word' && next.upper === 'DUAL') return k + 1;
      break;
    case 'DATE':
    case 'TIME':
    case 'TIMESTAMP':
      // letterali tipizzati: DATE '2024-01-31'
      if (next && next.type === 'string') return i + 1;
      break;
    case 'DISTINCTROW':
      out.push(chunk('DISTINCT', 'word'));
      return i + 1;
    case 'STRAIGHT_JOIN':
      if (prev && prev.type === 'word' && MODIFIER_CONTEXT.has(prev.upper)) return i + 1;
      out.push(chunk('JOIN', 'word'));
      return i + 1;
    case 'WITH':
      if (next && next.upper === 'ROLLUP') throw new CompatError(MSG.rollup);
      break;
    case 'COLLATE':
      if (next) {
        out.push(chunk(`COLLATE ${mapCollation(identName(next))}`, 'word'));
        return k + 1;
      }
      break;
    case 'USE':
    case 'FORCE':
    case 'IGNORE':
      // suggerimenti sugli indici: USE INDEX (idx), FORCE KEY (...)
      if (next && next.type === 'word' && (next.upper === 'INDEX' || next.upper === 'KEY')) {
        const open = tokens.findIndex((tok, idx) => idx > k && tok.type === 'punct' && tok.text === '(');
        if (open !== -1 && open < to) {
          const close = matchParen(tokens, open, to);
          if (close !== -1) return close + 1;
        }
      }
      break;
    case 'LOCK':
      // LOCK IN SHARE MODE
      if (next && next.upper === 'IN') {
        let j = k;
        for (let n = 0; n < 3 && j !== -1; n++) j = nextSig(tokens, j + 1, to);
        return j === -1 ? to : j;
      }
      break;
    case 'FOR':
      // FOR UPDATE / FOR SHARE [NOWAIT | SKIP LOCKED]
      if (next && (next.upper === 'UPDATE' || next.upper === 'SHARE')) {
        let j = k + 1;
        let n = nextSig(tokens, j, to);
        while (n !== -1 && ['NOWAIT', 'SKIP', 'LOCKED'].includes(tokens[n].upper)) {
          j = n + 1;
          n = nextSig(tokens, j, to);
        }
        return j;
      }
      break;
    case 'BINARY':
      // BINARY 'abc' = ... : in SQLite il confronto è già sensibile alle maiuscole
      if (next && ['word', 'qident', 'string', 'number'].includes(next.type)) return i + 1;
      break;
    case 'MATCH':
      throw new CompatError(MSG.fulltext);
    default:
      break;
  }

  if (KEYWORD_VALUES[word]) {
    out.push(chunk(KEYWORD_VALUES[word], 'primary'));
    return i + 1;
  }
  if (DROPPED_MODIFIERS.has(word) && prev && prev.type === 'word' && MODIFIER_CONTEXT.has(prev.upper)) return i + 1;
  // introduttori di set di caratteri: _utf8mb4'testo'
  if (/^_[A-Z0-9]+$/.test(word) && next && next.type === 'string' && k === i + 1) return i + 1;

  if (ctx.upsertAlias && t.text.toLowerCase() === ctx.upsertAlias && next && next.text === '.') {
    out.push(chunk('excluded', 'word'));
    return i + 1;
  }

  out.push(chunk(t.text, 'word'));
  return i + 1;
}

export function mapCollation(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'binary' || n.endsWith('_bin') || n.endsWith('_cs')) return 'BINARY';
  if (n === 'nocase' || n === 'rtrim') return n.toUpperCase();
  return 'NOCASE';
}

// data + INTERVAL 1 DAY, DATE_ADD(data, INTERVAL 1 DAY), INTERVAL 1 DAY + data
function emitInterval(tokens, i, to, out, ctx) {
  let depth = 0;
  let unitIdx = -1;
  for (let j = i + 1; j < to; j++) {
    const tj = tokens[j];
    if (tj.type === 'punct') {
      if (tj.text === '(') depth++;
      else if (tj.text === ')') {
        if (depth === 0) break;
        depth--;
      } else if (tj.text === ',' && depth === 0) break;
    } else if (depth === 0 && tj.type === 'word' && INTERVAL_UNITS.has(tj.upper)) {
      unitIdx = j;
      break;
    }
  }
  if (unitIdx === -1 || nextSig(tokens, i + 1, unitIdx) === -1) return null;
  const amount = emit(tokens, i + 1, unitIdx, ctx).trim();
  const unit = tokens[unitIdx].upper;
  const prevChunk = lastNonWs(out);

  if (prevChunk && prevChunk.kind === 'comma') {
    out.push(chunk(` (${amount}), '${unit}'`, 'primary'));
    return unitIdx + 1;
  }
  if (prevChunk && prevChunk.kind === 'op' && (prevChunk.op === '+' || prevChunk.op === '-')) {
    popWs(out);
    out.pop();
    const left = popOperand(out);
    if (left === null) {
      throw new CompatError('Non riesco a interpretare l\'espressione con INTERVAL: prova con DATE_ADD(data, INTERVAL n unità).');
    }
    const fn = prevChunk.op === '+' ? 'DATE_ADD' : 'DATE_SUB';
    out.push(chunk(` ${fn}(${left.trim()}, (${amount}), '${unit}')`, 'primary'));
    return unitIdx + 1;
  }
  const plus = nextSig(tokens, unitIdx + 1, to);
  if (plus !== -1 && tokens[plus].type === 'op' && tokens[plus].text === '+') {
    const start = nextSig(tokens, plus + 1, to);
    const end = operandEnd(tokens, start, to);
    if (start !== -1 && end !== -1) {
      const right = emit(tokens, start, end, ctx).trim();
      out.push(chunk(`DATE_ADD(${right}, (${amount}), '${unit}')`, 'primary'));
      return end;
    }
  }
  return null;
}

// prezzo > ALL (SELECT ...) / prezzo = ANY (SELECT ...): SQLite non li supporta
function emitQuantified(tokens, i, to, out, ctx, word, k) {
  const prevChunk = lastNonWs(out);
  if (!prevChunk || prevChunk.kind !== 'op' || !prevChunk.cmp) return null;
  if (k === -1 || tokens[k].text !== '(') return null;
  const close = matchParen(tokens, k, to);
  if (close === -1) return null;
  const first = nextSig(tokens, k + 1, close);
  if (first === -1 || !['SELECT', 'WITH'].includes(tokens[first].upper)) return null;
  popWs(out);
  const opChunk = out.pop();
  const left = popOperand(out);
  if (left === null) throw new CompatError(`Non riesco a interpretare l'operando a sinistra di ${word}.`);
  const sub = emit(tokens, k + 1, close, ctx).trim();
  const name = `qf_q${++ctx.uid}`;
  const op = opChunk.op === '!=' ? '<>' : opChunk.op;
  const l = left.trim();
  const text = word === 'ALL'
    ? `NOT EXISTS (WITH ${name}(v) AS (${sub}) SELECT 1 FROM ${name} WHERE NOT (${l} ${op} ${name}.v) OR ${name}.v IS NULL OR ${l} IS NULL)`
    : `EXISTS (WITH ${name}(v) AS (${sub}) SELECT 1 FROM ${name} WHERE ${l} ${op} ${name}.v)`;
  out.push(chunk(` ${text}`, 'primary'));
  return close + 1;
}

// ---------------------------------------------------------------------------
// Funzioni con una sintassi particolare
// ---------------------------------------------------------------------------

function sigTokens(tokens, from, to) {
  return tokens.slice(from, to).filter(isSignificant);
}

export function castExpression(expr, typeToks) {
  const words = typeToks.filter((t) => t.type === 'word').map((t) => t.upper);
  const nums = typeToks.filter((t) => t.type === 'number').map((t) => Number(t.text));
  switch (words[0] || '') {
    case 'SIGNED':
    case 'UNSIGNED':
    case 'INT':
    case 'INTEGER':
    case 'BIGINT':
      // MySQL arrotonda i numeri (CAST(3.7 AS SIGNED) = 4) e tronca le stringhe
      return `MYSQL_TO_SIGNED(${expr})`;
    case 'DECIMAL':
    case 'DEC':
    case 'NUMERIC':
    case 'FIXED': {
      const scale = nums.length >= 2 ? nums[1] : 0;
      return scale > 0 ? `ROUND(CAST(${expr} AS REAL), ${scale})` : `CAST(ROUND(CAST(${expr} AS REAL), 0) AS INTEGER)`;
    }
    case 'CHAR':
    case 'NCHAR':
    case 'VARCHAR':
    case 'TEXT':
      return nums.length ? `SUBSTR(CAST(${expr} AS TEXT), 1, ${nums[0]})` : `CAST(${expr} AS TEXT)`;
    case 'DATE':
      return `DATE(${expr})`;
    case 'DATETIME':
    case 'TIMESTAMP':
      return `DATE_FORMAT(${expr}, '%Y-%m-%d %H:%i:%s')`;
    case 'TIME':
      return `TIME(${expr})`;
    case 'YEAR':
      return `YEAR(${expr})`;
    case 'DOUBLE':
    case 'FLOAT':
    case 'REAL':
      return `CAST(${expr} AS REAL)`;
    case 'BINARY':
      return `CAST(${expr} AS BLOB)`;
    case 'JSON':
      return `(${expr})`;
    default:
      return `CAST(${expr} AS ${typeToks.map((t) => t.text).join(' ')})`;
  }
}

const SPECIAL_CALLS = {
  CAST(tokens, open, close, ctx) {
    const as = findTopLevelWord(tokens, open + 1, close, ['AS']);
    if (as === -1) return `CAST(${emit(tokens, open + 1, close, ctx)})`;
    return castExpression(emit(tokens, open + 1, as, ctx).trim(), sigTokens(tokens, as + 1, close));
  },
  CONVERT(tokens, open, close, ctx) {
    const using = findTopLevelWord(tokens, open + 1, close, ['USING']);
    if (using !== -1) return `(${emit(tokens, open + 1, using, ctx).trim()})`;
    const parts = splitTopLevel(tokens, open + 1, close);
    if (parts.length === 2) {
      return castExpression(emit(tokens, parts[0][0], parts[0][1], ctx).trim(), sigTokens(tokens, parts[1][0], parts[1][1]));
    }
    return `CONVERT(${emit(tokens, open + 1, close, ctx)})`;
  },
  EXTRACT(tokens, open, close, ctx) {
    const from = findTopLevelWord(tokens, open + 1, close, ['FROM']);
    const unitIdx = nextSig(tokens, open + 1, close);
    if (from === -1 || unitIdx === -1 || tokens[unitIdx].type !== 'word') return `EXTRACT(${emit(tokens, open + 1, close, ctx)})`;
    return `EXTRACT('${tokens[unitIdx].upper}', ${emit(tokens, from + 1, close, ctx).trim()})`;
  },
  POSITION(tokens, open, close, ctx) {
    const inIdx = findTopLevelWord(tokens, open + 1, close, ['IN']);
    if (inIdx === -1) return `POSITION(${emit(tokens, open + 1, close, ctx)})`;
    return `LOCATE(${emit(tokens, open + 1, inIdx, ctx).trim()}, ${emit(tokens, inIdx + 1, close, ctx).trim()})`;
  },
  SUBSTRING: substringCall,
  SUBSTR: substringCall,
  MID: substringCall,
  TRIM(tokens, open, close, ctx) {
    const from = findTopLevelWord(tokens, open + 1, close, ['FROM']);
    if (from === -1) return `TRIM(${emit(tokens, open + 1, close, ctx)})`;
    let start = nextSig(tokens, open + 1, from);
    let mode = 'BOTH';
    if (start !== -1 && ['BOTH', 'LEADING', 'TRAILING'].includes(tokens[start].upper)) {
      mode = tokens[start].upper;
      start += 1;
    }
    const remove = start === -1 ? '' : emit(tokens, start, from, ctx).trim();
    return `MYSQL_TRIM(${emit(tokens, from + 1, close, ctx).trim()}, ${remove || "' '"}, '${mode}')`;
  },
  GROUP_CONCAT(tokens, open, close, ctx) {
    let start = nextSig(tokens, open + 1, close);
    let distinct = false;
    if (start !== -1 && tokens[start].upper === 'DISTINCT') {
      distinct = true;
      start += 1;
    }
    if (start === -1) return 'GROUP_CONCAT()';
    const orderIdx = findTopLevelWord(tokens, start, close, ['ORDER']);
    const sepIdx = findTopLevelWord(tokens, start, close, ['SEPARATOR']);
    const exprEnd = [orderIdx, sepIdx, close].filter((x) => x !== -1).reduce((a, b) => Math.min(a, b));
    const exprs = splitTopLevel(tokens, start, exprEnd).map(([a, b]) => emit(tokens, a, b, ctx).trim()).filter(Boolean);
    const value = exprs.length > 1 ? `CONCAT(${exprs.join(', ')})` : exprs[0];
    const orderEnd = sepIdx !== -1 && sepIdx > orderIdx ? sepIdx : close;
    const orderBy = orderIdx !== -1 ? ` ${emit(tokens, orderIdx, orderEnd, ctx).trim()}` : '';
    let separator = "','";
    if (sepIdx !== -1) separator = emit(tokens, sepIdx + 1, close, ctx).trim();
    if (distinct) {
      const base = `GROUP_CONCAT(DISTINCT ${value}${orderBy})`;
      return separator === "','" ? base : `REPLACE(${base}, ',', ${separator})`;
    }
    return `GROUP_CONCAT(${value}, ${separator}${orderBy})`;
  },
  TIMESTAMPDIFF: unitFirstCall,
  TIMESTAMPADD: unitFirstCall,
  CHAR(tokens, open, close, ctx) {
    const using = findTopLevelWord(tokens, open + 1, close, ['USING']);
    return `CHAR(${emit(tokens, open + 1, using === -1 ? close : using, ctx).trim()})`;
  },
  VALUES(tokens, open, close, ctx) {
    const inner = emit(tokens, open + 1, close, ctx).trim();
    return ctx.upsert ? `excluded.${inner}` : `VALUES(${inner})`;
  },
  MATCH() {
    throw new CompatError(MSG.fulltext);
  }
};

function substringCall(tokens, open, close, ctx, word) {
  const from = findTopLevelWord(tokens, open + 1, close, ['FROM']);
  if (from === -1) return `${word}(${emit(tokens, open + 1, close, ctx)})`;
  const forIdx = findTopLevelWord(tokens, from + 1, close, ['FOR']);
  const str = emit(tokens, open + 1, from, ctx).trim();
  const pos = emit(tokens, from + 1, forIdx === -1 ? close : forIdx, ctx).trim();
  const len = forIdx === -1 ? '' : `, ${emit(tokens, forIdx + 1, close, ctx).trim()}`;
  return `SUBSTRING(${str}, ${pos}${len})`;
}

function unitFirstCall(tokens, open, close, ctx, word) {
  const args = splitTopLevel(tokens, open + 1, close).map(([a, b], index) => {
    if (index === 0) {
      const s = nextSig(tokens, a, b);
      const unit = s !== -1 && tokens[s].type === 'word' ? tokens[s].upper.replace(/^SQL_TSI_/, '') : null;
      if (unit && INTERVAL_UNITS.has(unit)) return `'${unit}'`;
    }
    return emit(tokens, a, b, ctx).trim();
  });
  return `${word}(${args.join(', ')})`;
}

// ---------------------------------------------------------------------------
// SELECT: alias automatici per avere gli stessi nomi di colonna di MySQL
// ---------------------------------------------------------------------------

/**
 * Traduce una SELECT. Le colonne senza alias la cui espressione cambia nella
 * traduzione ricevono come alias il testo originale, perché MySQL usa
 * l'espressione scritta dall'utente come nome della colonna.
 */
export function emitSelect(tokens, from, to, ctx) {
  const selIdx = findTopLevelWord(tokens, from, to, ['SELECT']);
  if (selIdx === -1) return emit(tokens, from, to, ctx);
  let listStart = selIdx + 1;
  for (;;) {
    const s = nextSig(tokens, listStart, to);
    if (s !== -1 && tokens[s].type === 'word' && SELECT_MODIFIERS.has(tokens[s].upper)) listStart = s + 1;
    else break;
  }
  let listEnd = findTopLevelWord(tokens, listStart, to, SELECT_LIST_END);
  if (listEnd === -1) listEnd = to;
  let sql = emit(tokens, from, listStart, ctx);
  splitTopLevel(tokens, listStart, listEnd).forEach(([a, b], n) => {
    if (n > 0) sql += ',';
    sql += emitSelectItem(tokens, a, b, ctx);
  });
  return sql + emit(tokens, listEnd, to, ctx);
}

function emitSelectItem(tokens, a, b, ctx) {
  const sig = [];
  for (let i = a; i < b; i++) if (isSignificant(tokens[i])) sig.push(i);
  const translated = emit(tokens, a, b, ctx);
  if (!sig.length || hasAlias(tokens, sig)) return translated;
  const last = tokens[sig[sig.length - 1]];
  if (last.type === 'op' && last.text === '*') return translated;
  if (sig.length === 1 && tokens[sig[0]].type === 'string') {
    return translated.replace(/\s*$/, (ws) => ` AS ${quoteIdent(tokens[sig[0]].value)}${ws}`);
  }
  const original = originalText(tokens, a, b);
  if (normalizeWs(translated) === normalizeWs(original)) return translated;
  return translated.replace(/\s*$/, (ws) => ` AS ${quoteIdent(original)}${ws}`);
}

function hasAlias(tokens, sig) {
  let depth = 0;
  for (const i of sig) {
    const t = tokens[i];
    if (t.type === 'punct' && t.text === '(') depth++;
    else if (t.type === 'punct' && t.text === ')') depth--;
    else if (depth === 0 && t.type === 'word' && t.upper === 'AS') return true;
  }
  if (sig.length < 2) return false;
  const last = tokens[sig[sig.length - 1]];
  const before = tokens[sig[sig.length - 2]];
  if (!['word', 'qident', 'string'].includes(last.type)) return false;
  if (last.type === 'word' && (NOT_ALIAS_WORDS.has(last.upper) || OPERAND_KEYWORDS.has(last.upper) || INTERVAL_UNITS.has(last.upper))) return false;
  if (before.type === 'op' || (before.type === 'punct' && (before.text === '.' || before.text === ',' || before.text === '('))) return false;
  if (before.type === 'word' && OPERAND_KEYWORDS.has(before.upper)) return false;
  return true;
}
