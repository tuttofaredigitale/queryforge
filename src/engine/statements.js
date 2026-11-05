// File: src/engine/statements.js
// Riconosce il tipo di istruzione MySQL e produce il piano di esecuzione.
// Un piano è { steps: [...] } dove ogni passo è { sql } oppure { run(rt) }.

import { isSignificant, nextSig, matchParen, splitTopLevel, findTopLevelWord } from './tokenizer.js';
import { emit, emitSelect, createContext, quoteIdent, identName } from './translator.js';
import { translateCreateTable, translateCreateIndex, translateDropIndex, translateAlterTable } from './ddl.js';
import { describeColumns, listTables, findTable, tableSql, showIndexes } from './catalog.js';
import { syncRoundingTriggers } from './numeric.js';
import { CompatError, MSG } from './errors.js';

const JOIN_WORDS = new Set(['JOIN', 'INNER', 'CROSS', 'STRAIGHT_JOIN', 'LEFT', 'RIGHT', 'NATURAL', 'OUTER', 'FULL']);
const TABLE_REF_END = new Set(['ON', 'USING', 'SET', 'WHERE', ...JOIN_WORDS]);

const plan = (steps) => ({ steps });
const message = (text) => ({ affectedRows: 0, message: text });
const noop = (text) => plan([{ run: () => message(text) }]);

function table(columns, objects) {
  return { columns, rows: objects.map((o) => columns.map((c) => (o[c] === undefined ? null : o[c]))) };
}

function likeToRegex(pattern) {
  const body = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${body}$`, 'i');
}

function sigIndexes(tokens) {
  const s = [];
  tokens.forEach((t, i) => {
    if (isSignificant(t)) s.push(i);
  });
  return s;
}

function afterIndex(s, tokenIndex) {
  const p = s.findIndex((i) => i > tokenIndex);
  return p === -1 ? s.length : p;
}

// Nome di tabella eventualmente qualificato con il database: restituisce [nome, posizione successiva]
function readTableName(tokens, s, p) {
  if (tokens[s[p + 1]] && tokens[s[p + 1]].text === '.') return [identName(tokens[s[p + 2]]), p + 3];
  return [identName(tokens[s[p]]), p + 1];
}

/**
 * Traduce una singola istruzione (già separata dalle altre).
 */
export function translateStatement(statement) {
  const { tokens } = statement;
  const s = sigIndexes(tokens);
  const w = (n) => (s[n] !== undefined && tokens[s[n]].type === 'word' ? tokens[s[n]].upper : null);
  const first = tokens[s[0]];

  if (first.type === 'punct' && first.text === '(') return selectPlan(tokens, s, w);

  switch (w(0)) {
    case 'SELECT':
    case 'WITH':
    case 'VALUES':
    case 'TABLE':
      return selectPlan(tokens, s, w);
    case 'INSERT':
    case 'REPLACE':
      return insertPlan(tokens, s, w);
    case 'UPDATE':
      return updatePlan(tokens, s, w);
    case 'DELETE':
      return deletePlan(tokens, s, w);
    case 'CREATE':
      return createPlan(tokens, s, w);
    case 'ALTER':
      return alterPlan(tokens, s, w);
    case 'DROP':
      return dropPlan(tokens, s, w);
    case 'TRUNCATE':
      return truncatePlan(tokens, s, w);
    case 'RENAME':
      return renamePlan(tokens, s);
    case 'SHOW':
      return showPlan(tokens, s, w);
    case 'DESCRIBE':
    case 'DESC':
    case 'EXPLAIN':
      return describePlan(tokens, s, w, statement);
    case 'USE':
      return noop('Database in uso: queryforge. Nel browser c\'è un solo database e tutte le tabelle stanno qui.');
    case 'SET':
      return setPlan(tokens, s, w);
    case 'START':
    case 'BEGIN':
      return plan([{
        run: (rt) => {
          if (rt.inTransaction()) rt.exec('COMMIT');
          rt.exec('BEGIN');
          return message('Transazione avviata. Conferma con COMMIT o annulla con ROLLBACK.');
        }
      }]);
    case 'COMMIT':
      return plan([{
        run: (rt) => {
          if (rt.inTransaction()) rt.exec('COMMIT');
          return message('Transazione confermata (COMMIT).');
        }
      }]);
    case 'ROLLBACK': {
      const toIdx = s.findIndex((i) => tokens[i].upper === 'TO');
      if (toIdx !== -1) {
        const name = identName(tokens[s[toIdx + 1]].upper === 'SAVEPOINT' ? tokens[s[toIdx + 2]] : tokens[s[toIdx + 1]]);
        return plan([{ sql: `ROLLBACK TO ${quoteIdent(name)}`, message: 'Annullate le modifiche fino al punto di salvataggio.' }]);
      }
      return plan([{
        run: (rt) => {
          if (rt.inTransaction()) rt.exec('ROLLBACK');
          return message('Transazione annullata (ROLLBACK).');
        }
      }]);
    }
    case 'SAVEPOINT':
      return plan([{ sql: `SAVEPOINT ${quoteIdent(identName(tokens[s[1]]))}`, message: 'Punto di salvataggio creato.' }]);
    case 'RELEASE':
      return plan([{ sql: `RELEASE ${quoteIdent(identName(tokens[s[w(1) === 'SAVEPOINT' ? 2 : 1]]))}`, message: 'Punto di salvataggio rilasciato.' }]);
    case 'LOCK':
    case 'UNLOCK':
      return noop('Comando accettato: nel browser c\'è un solo utente, quindi i lock non servono.');
    case 'ANALYZE':
    case 'OPTIMIZE':
    case 'CHECK':
    case 'REPAIR':
      return maintenancePlan(tokens, s, w);
    case 'DELIMITER':
      throw new CompatError(MSG.delimiter);
    case 'CALL':
      throw new CompatError(MSG.routines);
    case 'GRANT':
    case 'REVOKE':
    case 'FLUSH':
      throw new CompatError(MSG.users);
    case 'LOAD':
      throw new CompatError(MSG.files);
    case 'PRAGMA':
      return plan([{ sql: emit(tokens, 0, tokens.length, createContext()).trim() }]);
    default:
      throw new CompatError(`Comando non riconosciuto: ${first.text}. Controlla l'ortografia del comando.`);
  }
}

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------

function selectPlan(tokens, s, w) {
  const intoIdx = findTopLevelWord(tokens, 0, tokens.length, ['INTO']);
  if (intoIdx !== -1) {
    const next = tokens[nextSig(tokens, intoIdx + 1)];
    throw new CompatError(next && next.type === 'variable' ? MSG.variables : MSG.files);
  }
  if (w(0) === 'TABLE') {
    const [name] = readTableName(tokens, s, 1);
    return plan([{ sql: `SELECT * FROM ${quoteIdent(name)}` }]);
  }
  return plan([{ sql: emitSelect(tokens, 0, tokens.length, createContext()).trim() }]);
}

// ---------------------------------------------------------------------------
// INSERT / REPLACE
// ---------------------------------------------------------------------------

function findOnDuplicate(tokens, from) {
  let depth = 0;
  for (let i = from; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'punct' && t.text === '(') depth++;
    else if (t.type === 'punct' && t.text === ')') depth--;
    else if (depth === 0 && t.upper === 'ON') {
      const a = nextSig(tokens, i + 1);
      if (a !== -1 && tokens[a].upper === 'DUPLICATE') return i;
    }
  }
  return -1;
}

function insertPlan(tokens, s, w) {
  const ctx = createContext();
  const isReplace = w(0) === 'REPLACE';
  let p = 1;
  let ignore = false;
  while (['LOW_PRIORITY', 'DELAYED', 'HIGH_PRIORITY', 'IGNORE'].includes(w(p))) {
    if (w(p) === 'IGNORE') ignore = true;
    p++;
  }
  if (w(p) === 'INTO') p++;
  const [tableName, afterName] = readTableName(tokens, s, p);
  if (!tableName) throw new CompatError('INSERT: manca il nome della tabella.');
  p = afterName;
  if (w(p) === 'PARTITION') p = afterIndex(s, matchParen(tokens, s[p + 1], tokens.length));

  let columnNames = null;
  if (tokens[s[p]] && tokens[s[p]].text === '(' && !['SELECT', 'WITH'].includes(w(p + 1))) {
    const close = matchParen(tokens, s[p], tokens.length);
    columnNames = splitTopLevel(tokens, s[p] + 1, close).map(([a, b]) => identName(tokens[nextSig(tokens, a, b)]));
    p = afterIndex(s, close);
  }
  if (p >= s.length) throw new CompatError('INSERT incompleta: mancano i valori (VALUES ...).');

  const dupIdx = findOnDuplicate(tokens, s[p]);
  const sourceEnd = dupIdx === -1 ? tokens.length : dupIdx;
  let source;
  let alias = null;
  let hasDefault = false;
  const head = w(p);

  if (head === 'SET') {
    // INSERT INTO t SET a = 1, b = 2
    const assignments = splitTopLevel(tokens, s[p] + 1, sourceEnd).map(([a, b]) => parseAssignment(tokens, a, b, ctx));
    columnNames = assignments.map((x) => x.column);
    source = `VALUES (${assignments.map((x) => x.value).join(', ')})`;
  } else if (head === 'VALUES' || head === 'VALUE') {
    let valuesEnd = sourceEnd;
    const asIdx = findTopLevelWord(tokens, s[p] + 1, sourceEnd, ['AS']);
    if (asIdx !== -1) {
      alias = identName(tokens[nextSig(tokens, asIdx + 1)]).toLowerCase();
      valuesEnd = asIdx;
    }
    const rows = splitTopLevel(tokens, s[p] + 1, valuesEnd).map(([a, b]) => {
      let open = nextSig(tokens, a, b);
      if (open !== -1 && tokens[open].upper === 'ROW') open = nextSig(tokens, open + 1, b);
      if (open === -1 || tokens[open].text !== '(') throw new CompatError('VALUES: ogni riga va scritta tra parentesi, ad esempio VALUES (1, \'Mario\').');
      const close = matchParen(tokens, open, b);
      const values = splitTopLevel(tokens, open + 1, close).map(([x, y], index) => {
        const v = nextSig(tokens, x, y);
        if (v !== -1 && tokens[v].upper === 'DEFAULT' && nextSig(tokens, v + 1, y) === -1) {
          hasDefault = true;
          return `__QF_DEFAULT_${index}__`;
        }
        return emit(tokens, x, y, ctx).trim();
      });
      return `(${values.join(', ')})`;
    });
    source = `VALUES ${rows.join(', ')}`;
  } else {
    source = emitSelect(tokens, s[p], sourceEnd, ctx).trim();
    if (dupIdx !== -1 && findTopLevelWord(tokens, s[p], sourceEnd, ['WHERE', 'GROUP', 'ORDER', 'LIMIT', 'HAVING']) === -1) {
      // evita un'ambiguità del parser di SQLite con ON CONFLICT
      source += ' WHERE true';
    }
  }

  let upsert = '';
  if (dupIdx !== -1) {
    let u = nextSig(tokens, dupIdx + 1);
    while (u !== -1 && ['DUPLICATE', 'KEY', 'UPDATE'].includes(tokens[u].upper)) u = nextSig(tokens, u + 1);
    ctx.upsert = true;
    ctx.upsertAlias = alias;
    const assignments = splitTopLevel(tokens, u, tokens.length).map(([a, b]) => parseAssignment(tokens, a, b, ctx));
    upsert = ` ON CONFLICT DO UPDATE SET ${assignments.map((x) => `${quoteIdent(x.column)} = ${x.value}`).join(', ')}`;
  }

  const verb = isReplace ? 'REPLACE' : ignore ? 'INSERT OR IGNORE' : 'INSERT';
  const columnsSql = columnNames ? ` (${columnNames.map(quoteIdent).join(', ')})` : '';
  const sql = `${verb} INTO ${quoteIdent(tableName)}${columnsSql} ${source}${upsert}`;

  if (!hasDefault) return plan([{ sql, dml: true, insert: true }]);
  return plan([{
    run: (rt) => {
      const info = rt.query('SELECT name, dflt_value FROM pragma_table_info(?)', [tableName]);
      if (!info.length) throw new Error(`no such table: ${tableName}`);
      const targets = columnNames || info.map((c) => c.name);
      const resolved = sql.replace(/__QF_DEFAULT_(\d+)__/g, (m, index) => {
        const column = info.find((c) => c.name.toLowerCase() === String(targets[Number(index)]).toLowerCase());
        return column && column.dflt_value !== null ? column.dflt_value : 'NULL';
      });
      return rt.runSql(resolved, { dml: true, insert: true });
    }
  }]);
}

// col = valore oppure t.col = valore
function parseAssignment(tokens, a, b, ctx) {
  let eq = -1;
  let depth = 0;
  for (let i = a; i < b; i++) {
    const t = tokens[i];
    if (t.type === 'punct' && t.text === '(') depth++;
    else if (t.type === 'punct' && t.text === ')') depth--;
    else if (depth === 0 && t.type === 'op' && (t.text === '=' || t.text === ':=')) {
      eq = i;
      break;
    }
  }
  if (eq === -1) throw new CompatError('Assegnazione non valida: usa la forma colonna = valore.');
  const target = [];
  for (let i = a; i < eq; i++) if (isSignificant(tokens[i])) target.push(tokens[i]);
  const names = target.filter((t) => t.type === 'word' || t.type === 'qident');
  return {
    column: identName(names[names.length - 1]),
    qualifier: names.length > 1 ? identName(names[names.length - 2]) : null,
    value: emit(tokens, eq + 1, b, ctx).trim()
  };
}

// ---------------------------------------------------------------------------
// Riferimenti a tabelle con JOIN (per UPDATE e DELETE su più tabelle)
// ---------------------------------------------------------------------------

function parseTableRefs(tokens, from, to, statementKind) {
  const refs = [];
  let i = nextSig(tokens, from, to);
  while (i !== -1 && i < to) {
    let name = identName(tokens[i]);
    let k = nextSig(tokens, i + 1, to);
    if (k !== -1 && tokens[k].text === '.') {
      name = identName(tokens[nextSig(tokens, k + 1, to)]);
      k = nextSig(tokens, nextSig(tokens, k + 1, to) + 1, to);
    }
    const ref = { table: name, alias: null, on: null };
    if (k !== -1 && tokens[k].upper === 'AS') k = nextSig(tokens, k + 1, to);
    if (k !== -1 && (tokens[k].type === 'word' || tokens[k].type === 'qident') && !TABLE_REF_END.has(tokens[k].upper)) {
      ref.alias = identName(tokens[k]);
      k = nextSig(tokens, k + 1, to);
    }
    if (k !== -1 && tokens[k].upper === 'USING') {
      throw new CompatError(statementKind === 'UPDATE' ? MSG.multiTableUpdate : MSG.multiTableDelete);
    }
    if (k !== -1 && tokens[k].upper === 'ON') {
      let end = k + 1;
      let depth = 0;
      for (; end < to; end++) {
        const t = tokens[end];
        if (t.type === 'punct' && t.text === '(') depth++;
        else if (t.type === 'punct' && t.text === ')') depth--;
        else if (depth === 0 && ((t.type === 'word' && JOIN_WORDS.has(t.upper)) || (t.type === 'punct' && t.text === ','))) break;
      }
      ref.on = [k + 1, end];
      k = nextSig(tokens, end, to);
    }
    refs.push(ref);
    if (k === -1 || k >= to) break;
    if (tokens[k].text === ',') {
      i = nextSig(tokens, k + 1, to);
      continue;
    }
    if (['LEFT', 'RIGHT', 'NATURAL', 'FULL', 'OUTER'].includes(tokens[k].upper)) {
      throw new CompatError(statementKind === 'UPDATE' ? MSG.multiTableUpdate : MSG.multiTableDelete);
    }
    while (k !== -1 && k < to && ['INNER', 'CROSS', 'JOIN', 'STRAIGHT_JOIN'].includes(tokens[k].upper)) k = nextSig(tokens, k + 1, to);
    i = k;
  }
  return refs;
}

function firstOf(...indexes) {
  const valid = indexes.filter((x) => x !== -1 && x !== undefined);
  return valid.length ? Math.min(...valid) : -1;
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

function updatePlan(tokens, s, w) {
  const ctx = createContext();
  let p = 1;
  let ignore = false;
  while (['LOW_PRIORITY', 'IGNORE'].includes(w(p))) {
    if (w(p) === 'IGNORE') ignore = true;
    p++;
  }
  const setIdx = findTopLevelWord(tokens, s[p], tokens.length, ['SET']);
  if (setIdx === -1) throw new CompatError('UPDATE: manca SET con le colonne da modificare.');
  const whereIdx = findTopLevelWord(tokens, setIdx + 1, tokens.length, ['WHERE']);
  const orderIdx = findTopLevelWord(tokens, setIdx + 1, tokens.length, ['ORDER']);
  const limitIdx = findTopLevelWord(tokens, setIdx + 1, tokens.length, ['LIMIT']);
  const setEnd = firstOf(whereIdx, orderIdx, limitIdx, tokens.length);
  const tailStart = firstOf(orderIdx, limitIdx);
  const refs = parseTableRefs(tokens, s[p], setIdx, 'UPDATE');
  const assignments = splitTopLevel(tokens, setIdx + 1, setEnd).map(([a, b]) => parseAssignment(tokens, a, b, ctx));
  const whereSql = whereIdx === -1 ? '' : emit(tokens, whereIdx + 1, tailStart === -1 ? tokens.length : tailStart, ctx).trim();
  const verb = `UPDATE ${ignore ? 'OR IGNORE ' : ''}`;

  if (refs.length === 1) {
    const { table: name, alias } = refs[0];
    const target = `${quoteIdent(name)}${alias ? ` AS ${quoteIdent(alias)}` : ''}`;
    const setSql = assignments.map((x) => `${quoteIdent(x.column)} = ${x.value}`).join(', ');
    let where = whereSql ? `WHERE ${whereSql}` : '';
    if (tailStart !== -1) {
      // UPDATE ... ORDER BY ... LIMIT n: SQLite non lo supporta, si passa dal rowid
      const tail = emit(tokens, tailStart, tokens.length, ctx).trim();
      where = `WHERE rowid IN (SELECT ${alias ? `${quoteIdent(alias)}.` : ''}rowid FROM ${target} ${where} ${tail})`;
    }
    return plan([{ sql: `${verb}${target} SET ${setSql} ${where}`.trim(), dml: true }]);
  }

  // UPDATE con più tabelle: UPDATE a JOIN b ON ... SET a.x = b.y WHERE ...
  if (tailStart !== -1) throw new CompatError(MSG.multiTableUpdate);
  const matches = (ref, qualifier) => qualifier && [ref.alias, ref.table].filter(Boolean).some((n) => n.toLowerCase() === qualifier.toLowerCase());
  const qualifiers = [...new Set(assignments.map((x) => (x.qualifier ? x.qualifier.toLowerCase() : null)))];
  let targetRef = refs[0];
  if (qualifiers.some(Boolean)) {
    const named = qualifiers.filter(Boolean);
    const candidates = refs.filter((r) => named.some((q) => matches(r, q)));
    if (candidates.length !== 1) {
      throw new CompatError('In un UPDATE con più tabelle puoi modificare le colonne di una sola tabella alla volta.');
    }
    targetRef = candidates[0];
  }
  const others = refs.filter((r) => r !== targetRef);
  const conditions = refs.filter((r) => r.on).map((r) => `(${emit(tokens, r.on[0], r.on[1], ctx).trim()})`);
  if (whereSql) conditions.push(`(${whereSql})`);
  const target = `${quoteIdent(targetRef.table)}${targetRef.alias ? ` AS ${quoteIdent(targetRef.alias)}` : ''}`;
  const from = others.map((r) => `${quoteIdent(r.table)}${r.alias ? ` AS ${quoteIdent(r.alias)}` : ''}`).join(', ');
  const setSql = assignments.map((x) => `${quoteIdent(x.column)} = ${x.value}`).join(', ');
  return plan([{ sql: `${verb}${target} SET ${setSql} FROM ${from}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`, dml: true }]);
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

function deletePlan(tokens, s, w) {
  const ctx = createContext();
  let p = 1;
  while (['LOW_PRIORITY', 'QUICK', 'IGNORE'].includes(w(p))) p++;

  if (w(p) === 'FROM') {
    const usingIdx = findTopLevelWord(tokens, s[p] + 1, tokens.length, ['USING']);
    if (usingIdx === -1) {
      const [name, q] = readTableName(tokens, s, p + 1);
      let alias = null;
      let next = q;
      if (w(next) === 'AS') next++;
      if (tokens[s[next]] && (tokens[s[next]].type === 'word' || tokens[s[next]].type === 'qident') && !['WHERE', 'ORDER', 'LIMIT', 'PARTITION'].includes(w(next))) {
        alias = identName(tokens[s[next]]);
        next++;
      }
      const start = s[next] === undefined ? tokens.length : s[next];
      const whereIdx = findTopLevelWord(tokens, start, tokens.length, ['WHERE']);
      const tailStart = firstOf(findTopLevelWord(tokens, start, tokens.length, ['ORDER']), findTopLevelWord(tokens, start, tokens.length, ['LIMIT']));
      const target = `${quoteIdent(name)}${alias ? ` AS ${quoteIdent(alias)}` : ''}`;
      let where = whereIdx === -1 ? '' : `WHERE ${emit(tokens, whereIdx + 1, tailStart === -1 ? tokens.length : tailStart, ctx).trim()}`;
      if (tailStart !== -1) {
        const tail = emit(tokens, tailStart, tokens.length, ctx).trim();
        where = `WHERE rowid IN (SELECT ${alias ? `${quoteIdent(alias)}.` : ''}rowid FROM ${target} ${where} ${tail})`;
      }
      return plan([{ sql: `DELETE FROM ${target} ${where}`.trim(), dml: true }]);
    }
    // DELETE FROM t1 USING t1 JOIN t2 ...
    return multiDelete(tokens, s[p] + 1, usingIdx, usingIdx + 1, ctx);
  }
  // DELETE t1 FROM t1 JOIN t2 ON ... WHERE ...
  const fromIdx = findTopLevelWord(tokens, s[p], tokens.length, ['FROM']);
  if (fromIdx === -1) throw new CompatError('DELETE: manca FROM.');
  return multiDelete(tokens, s[p], fromIdx, fromIdx + 1, ctx);
}

function multiDelete(tokens, targetsFrom, targetsTo, refsFrom, ctx) {
  const targets = splitTopLevel(tokens, targetsFrom, targetsTo)
    .map(([a, b]) => {
      const names = tokens.slice(a, b).filter((t) => t.type === 'word' || t.type === 'qident');
      return names.length ? identName(names[0]) : null;
    })
    .filter(Boolean);
  if (targets.length !== 1) throw new CompatError(MSG.multiTableDelete);
  const whereIdx = findTopLevelWord(tokens, refsFrom, tokens.length, ['WHERE']);
  const refsTo = whereIdx === -1 ? tokens.length : whereIdx;
  const refs = parseTableRefs(tokens, refsFrom, refsTo, 'DELETE');
  const wanted = targets[0].toLowerCase();
  const ref = refs.find((r) => (r.alias && r.alias.toLowerCase() === wanted)) || refs.find((r) => r.table.toLowerCase() === wanted);
  if (!ref) throw new CompatError(`DELETE: la tabella ${targets[0]} non compare nel FROM.`);
  const qualifier = quoteIdent(ref.alias || ref.table);
  const fromSql = emit(tokens, refsFrom, refsTo, ctx).trim();
  const whereSql = whereIdx === -1 ? '' : ` ${emit(tokens, whereIdx, tokens.length, ctx).trim()}`;
  return plan([{ sql: `DELETE FROM ${quoteIdent(ref.table)} WHERE rowid IN (SELECT ${qualifier}.rowid FROM ${fromSql}${whereSql})`, dml: true }]);
}

// ---------------------------------------------------------------------------
// CREATE / ALTER / DROP / TRUNCATE / RENAME
// ---------------------------------------------------------------------------

function objectKind(tokens, s, kinds, max = 10) {
  for (let n = 1; n < Math.min(s.length, max); n++) {
    const t = tokens[s[n]];
    if (t.type === 'word' && kinds.includes(t.upper)) return { kind: t.upper, index: n };
  }
  return { kind: null, index: -1 };
}

function createPlan(tokens, s, w) {
  const { kind, index } = objectKind(tokens, s, ['TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'USER', 'ROLE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT']);
  switch (kind) {
    case 'TABLE':
      return plan(translateCreateTable(tokens, s));
    case 'INDEX':
      return plan(translateCreateIndex(tokens, s));
    case 'VIEW':
      return viewPlan(tokens, s, index, w(1) === 'OR');
    case 'DATABASE':
    case 'SCHEMA':
      return noop('In QueryForge c\'è un solo database (queryforge): le tabelle che crei verranno salvate lì.');
    case 'USER':
    case 'ROLE':
      throw new CompatError(MSG.users);
    case 'PROCEDURE':
    case 'FUNCTION':
    case 'TRIGGER':
    case 'EVENT':
      throw new CompatError(MSG.routines);
    default:
      throw new CompatError('CREATE: indica cosa creare (TABLE, INDEX, VIEW...).');
  }
}

function viewPlan(tokens, s, viewPos, replace) {
  const ctx = createContext();
  const [name, q] = readTableName(tokens, s, viewPos + 1);
  let columns = '';
  let p = q;
  if (tokens[s[p]] && tokens[s[p]].text === '(') {
    const close = matchParen(tokens, s[p], tokens.length);
    columns = ` (${splitTopLevel(tokens, s[p] + 1, close).map(([a, b]) => quoteIdent(identName(tokens[nextSig(tokens, a, b)]))).join(', ')})`;
    p = afterIndex(s, close);
  }
  if (!tokens[s[p]] || tokens[s[p]].upper !== 'AS') throw new CompatError('CREATE VIEW: manca AS SELECT ...');
  let end = tokens.length;
  const withIdx = findTopLevelWord(tokens, s[p] + 1, tokens.length, ['WITH']);
  if (withIdx !== -1) {
    const next = nextSig(tokens, withIdx + 1);
    if (next !== -1 && ['CHECK', 'CASCADED', 'LOCAL'].includes(tokens[next].upper)) end = withIdx;
  }
  const sql = `CREATE VIEW ${quoteIdent(name)}${columns} AS ${emitSelect(tokens, s[p] + 1, end, ctx).trim()}`;
  const steps = [];
  if (replace) steps.push({ sql: `DROP VIEW IF EXISTS ${quoteIdent(name)}`, silent: true });
  steps.push({ sql, message: 'Vista creata.' });
  return plan(steps);
}

function alterPlan(tokens, s, w) {
  const { kind, index } = objectKind(tokens, s, ['TABLE', 'VIEW', 'DATABASE', 'SCHEMA', 'USER', 'EVENT', 'PROCEDURE', 'FUNCTION'], 4);
  if (kind === 'TABLE') return plan(translateAlterTable(tokens, s));
  if (kind === 'VIEW') return viewPlan(tokens, s, index, true);
  if (kind === 'DATABASE' || kind === 'SCHEMA') return noop('Impostazione del database accettata (nessun effetto nel browser).');
  if (kind === 'USER') throw new CompatError(MSG.users);
  throw new CompatError(MSG.routines);
}

// Tabelle che hanno una chiave esterna verso `name`
function referencingTables(rt, name) {
  const lower = name.toLowerCase();
  return listTables(rt)
    .filter((t) => t.type === 'table' && t.name.toLowerCase() !== lower)
    .filter((t) => rt.query('SELECT "table" AS ref FROM pragma_foreign_key_list(?)', [t.name]).some((fk) => fk.ref.toLowerCase() === lower))
    .map((t) => t.name);
}

function dropPlan(tokens, s, w) {
  const { kind, index } = objectKind(tokens, s, ['TABLE', 'TABLES', 'VIEW', 'INDEX', 'DATABASE', 'SCHEMA', 'USER', 'ROLE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT'], 4);
  switch (kind) {
    case 'TABLE':
    case 'TABLES':
    case 'VIEW': {
      let p = index + 1;
      let ifExists = false;
      if (w(p) === 'IF') {
        ifExists = true;
        p += 2;
      }
      const isView = kind === 'VIEW';
      if (s[p] === undefined) throw new CompatError(`DROP ${kind}: manca il nome da eliminare.`);
      const names = splitTopLevel(tokens, s[p], tokens.length).map(([a, b]) => {
        const parts = tokens.slice(a, b).filter((t) => t.type === 'word' || t.type === 'qident').filter((t) => !['RESTRICT', 'CASCADE'].includes(t.upper));
        return parts.length ? identName(parts[parts.length - 1]) : null;
      }).filter(Boolean);
      return plan(names.map((name) => ({
        run: (rt) => {
          const found = findTable(rt, name);
          if (!found) {
            if (ifExists) return message(`${isView ? 'La vista' : 'La tabella'} ${name} non esiste: nessuna modifica.`);
            throw new Error(`no such table: ${name}`);
          }
          if (!isView && rt.foreignKeysEnabled()) {
            const children = referencingTables(rt, found.name);
            if (children.length) {
              throw new CompatError(`Non puoi eliminare la tabella ${found.name}: la tabella ${children.join(', ')} ha una chiave esterna che la usa. Elimina prima ${children.length > 1 ? 'quelle tabelle' : 'quella tabella'} oppure il vincolo.`);
            }
          }
          rt.exec(`DROP ${found.type === 'view' ? 'VIEW' : 'TABLE'} ${quoteIdent(found.name)}`);
          return message(found.type === 'view' ? 'Vista eliminata.' : 'Tabella eliminata.');
        }
      })));
    }
    case 'INDEX':
      return plan(translateDropIndex(tokens, s));
    case 'DATABASE':
    case 'SCHEMA':
      throw new CompatError(MSG.oneDatabase);
    case 'USER':
    case 'ROLE':
      throw new CompatError(MSG.users);
    case 'PROCEDURE':
    case 'FUNCTION':
    case 'TRIGGER':
    case 'EVENT':
      throw new CompatError(MSG.routines);
    default:
      throw new CompatError('DROP: indica cosa eliminare (TABLE, INDEX, VIEW...).');
  }
}

function truncatePlan(tokens, s, w) {
  const [name] = readTableName(tokens, s, w(1) === 'TABLE' ? 2 : 1);
  return plan([{
    run: (rt) => {
      const found = findTable(rt, name);
      if (!found || found.type !== 'table') throw new Error(`no such table: ${name}`);
      if (rt.foreignKeysEnabled()) {
        const children = referencingTables(rt, found.name);
        if (children.length) {
          throw new CompatError(`Non puoi svuotare con TRUNCATE la tabella ${found.name}: è collegata con una chiave esterna alla tabella ${children.join(', ')}. Usa DELETE FROM ${found.name} oppure svuota prima le tabelle collegate.`);
        }
      }
      rt.exec(`DELETE FROM ${quoteIdent(found.name)}`);
      if (rt.query("SELECT 1 AS x FROM sqlite_master WHERE name = 'sqlite_sequence'").length) {
        rt.query('DELETE FROM sqlite_sequence WHERE name = ?', [found.name]);
      }
      return message('Tabella svuotata.');
    }
  }]);
}

function renamePlan(tokens, s) {
  // RENAME TABLE a TO b, c TO d
  const start = s[1] !== undefined && tokens[s[1]].upper === 'TABLE' ? s[2] : s[1];
  const steps = splitTopLevel(tokens, start, tokens.length).flatMap(([a, b]) => {
    const names = tokens.slice(a, b).filter((t) => (t.type === 'word' && t.upper !== 'TO') || t.type === 'qident');
    if (names.length < 2) throw new CompatError('RENAME TABLE: usa la forma RENAME TABLE vecchio TO nuovo.');
    const to = identName(names[names.length - 1]);
    return [
      { sql: `ALTER TABLE ${quoteIdent(identName(names[names.length - 2]))} RENAME TO ${quoteIdent(to)}`, message: 'Tabella rinominata.' },
      // i trigger di arrotondamento prendono il nome della tabella nuova
      { run: (rt) => syncRoundingTriggers(rt, to), silent: true }
    ];
  });
  return plan(steps);
}

function maintenancePlan(tokens, s, w) {
  const op = w(0).toLowerCase();
  const p = w(1) === 'TABLE' || w(1) === 'TABLES' ? 2 : 1;
  const names = splitTopLevel(tokens, s[p] === undefined ? tokens.length : s[p], tokens.length)
    .map(([a, b]) => tokens.slice(a, b).filter((t) => t.type === 'word' || t.type === 'qident'))
    .filter((parts) => parts.length)
    .map((parts) => identName(parts[parts.length - 1]));
  return plan([{
    run: (rt) => {
      if (op === 'analyze') rt.exec('ANALYZE');
      return table(['Table', 'Op', 'Msg_type', 'Msg_text'], names.map((n) => ({ Table: `queryforge.${n}`, Op: op, Msg_type: 'status', Msg_text: findTable(rt, n) ? 'OK' : 'Table does not exist' })));
    }
  }]);
}

// ---------------------------------------------------------------------------
// SHOW, DESCRIBE, EXPLAIN
// ---------------------------------------------------------------------------

function likeFilter(tokens, s, from) {
  const likePos = s.findIndex((i, n) => n >= from && tokens[i].upper === 'LIKE');
  if (likePos === -1) return () => true;
  const pattern = tokens[s[likePos + 1]];
  const re = likeToRegex(pattern ? pattern.value : '%');
  return (value) => re.test(value);
}

function showPlan(tokens, s, w) {
  let p = 1;
  let full = false;
  while (['FULL', 'GLOBAL', 'SESSION', 'EXTENDED'].includes(w(p))) {
    if (w(p) === 'FULL') full = true;
    p++;
  }
  const what = w(p);
  switch (what) {
    case 'TABLES': {
      const filter = likeFilter(tokens, s, p);
      return plan([{
        run: (rt) => {
          const tables = listTables(rt).filter((t) => filter(t.name));
          const columns = full ? ['Tables_in_queryforge', 'Table_type'] : ['Tables_in_queryforge'];
          return table(columns, tables.map((t) => ({ Tables_in_queryforge: t.name, Table_type: t.type === 'view' ? 'VIEW' : 'BASE TABLE' })));
        }
      }]);
    }
    case 'DATABASES':
    case 'SCHEMAS':
      return plan([{ run: () => table(['Database'], [{ Database: 'queryforge' }]) }]);
    case 'COLUMNS':
    case 'FIELDS': {
      const [name] = readTableName(tokens, s, p + 2);
      const filter = likeFilter(tokens, s, p + 2);
      return plan([{ run: (rt) => describeResult(rt, name, filter) }]);
    }
    case 'CREATE': {
      const objectType = w(p + 1);
      const [name] = readTableName(tokens, s, p + 2);
      if (objectType === 'DATABASE' || objectType === 'SCHEMA') {
        return plan([{ run: () => table(['Database', 'Create Database'], [{ Database: 'queryforge', 'Create Database': 'CREATE DATABASE `queryforge`' }]) }]);
      }
      return plan([{
        run: (rt) => {
          const found = findTable(rt, name);
          if (!found) throw new Error(`no such table: ${name}`);
          const sql = tableSql(rt, found.name);
          return found.type === 'view'
            ? table(['View', 'Create View'], [{ View: found.name, 'Create View': sql }])
            : table(['Table', 'Create Table'], [{ Table: found.name, 'Create Table': sql }]);
        }
      }]);
    }
    case 'INDEX':
    case 'INDEXES':
    case 'KEYS': {
      const [name] = readTableName(tokens, s, p + 2);
      return plan([{
        run: (rt) => {
          const found = findTable(rt, name);
          if (!found) throw new Error(`no such table: ${name}`);
          return table(['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name', 'Index_type'], showIndexes(rt, found.name));
        }
      }]);
    }
    case 'TABLE':
      return plan([{
        run: (rt) => table(['Name', 'Engine', 'Rows'], listTables(rt).filter((t) => t.type === 'table').map((t) => ({
          Name: t.name,
          Engine: 'SQLite',
          Rows: rt.query(`SELECT COUNT(*) AS n FROM ${quoteIdent(t.name)}`)[0].n
        })))
      }]);
    case 'WARNINGS':
    case 'ERRORS':
      return plan([{ run: () => table(['Level', 'Code', 'Message'], []) }]);
    case 'VARIABLES': {
      const filter = likeFilter(tokens, s, p);
      return plan([{
        run: (rt) => {
          const version = rt.query('SELECT sqlite_version() AS v')[0].v;
          const vars = [
            { Variable_name: 'version', Value: `8.0 (compatibile) - SQLite ${version}` },
            { Variable_name: 'version_comment', Value: 'QueryForge - database nel browser' },
            { Variable_name: 'foreign_key_checks', Value: rt.foreignKeysEnabled() ? 'ON' : 'OFF' },
            { Variable_name: 'autocommit', Value: 'ON' }
          ];
          return table(['Variable_name', 'Value'], vars.filter((v) => filter(v.Variable_name)));
        }
      }]);
    }
    case 'STATUS':
    case 'TRIGGERS':
    case 'EVENTS':
    case 'PROCEDURE':
    case 'FUNCTION':
      return plan([{ run: () => table(['Name'], []) }]);
    case 'ENGINES':
      return plan([{ run: () => table(['Engine', 'Support', 'Comment'], [{ Engine: 'SQLite', Support: 'DEFAULT', Comment: 'Database nel browser (sql.js)' }]) }]);
    case 'PROCESSLIST':
      return plan([{ run: () => table(['Id', 'User', 'db', 'Command', 'Info'], [{ Id: 1, User: 'studente', db: 'queryforge', Command: 'Query', Info: 'SHOW PROCESSLIST' }]) }]);
    case 'GRANTS':
      return plan([{ run: () => table(['Grants for studente@localhost'], [{ 'Grants for studente@localhost': 'GRANT ALL PRIVILEGES ON `queryforge`.* TO `studente`@`localhost`' }]) }]);
    default:
      throw new CompatError(`SHOW ${tokens[s[p]] ? tokens[s[p]].text : ''} non è disponibile nella versione browser. Prova SHOW TABLES, SHOW COLUMNS FROM tabella o SHOW CREATE TABLE tabella.`);
  }
}

function describeResult(rt, name, filter = () => true) {
  const found = findTable(rt, name);
  if (!found) throw new Error(`no such table: ${name}`);
  const rows = describeColumns(rt, found.name).filter((c) => filter(c.Field));
  return table(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'], rows);
}

function describePlan(tokens, s, w, statement) {
  let p = 1;
  if (w(p) === 'ANALYZE' || w(p) === 'EXTENDED' || w(p) === 'PARTITIONS') p++;
  if (w(p) === 'FORMAT') p += 3;
  const target = w(p);
  if (['SELECT', 'WITH', 'INSERT', 'REPLACE', 'UPDATE', 'DELETE', 'TABLE'].includes(target) || (tokens[s[p]] && tokens[s[p]].text === '(')) {
    const inner = { text: statement.text, tokens: tokens.slice(s[p]) };
    const innerPlan = translateStatement(inner);
    const sqlStep = innerPlan.steps.find((step) => step.sql);
    if (!sqlStep || innerPlan.steps.length !== 1) throw new CompatError('EXPLAIN è disponibile solo per le query semplici.');
    return plan([{ sql: `EXPLAIN QUERY PLAN ${sqlStep.sql}` }]);
  }
  const [name, q] = readTableName(tokens, s, p);
  const column = tokens[s[q]] ? identName(tokens[s[q]]) : null;
  const filter = column ? (field) => field.toLowerCase() === column.toLowerCase() || likeToRegex(column).test(field) : () => true;
  return plan([{ run: (rt) => describeResult(rt, name, filter) }]);
}

// ---------------------------------------------------------------------------
// SET
// ---------------------------------------------------------------------------

function setPlan(tokens, s, w) {
  let p = 1;
  while (['GLOBAL', 'SESSION', 'LOCAL', 'PERSIST', 'PERSIST_ONLY'].includes(w(p))) p++;
  const t = tokens[s[p]];
  if (!t) throw new CompatError('SET incompleto.');
  if (t.type === 'variable' && !t.text.startsWith('@@')) throw new CompatError(MSG.variables);
  const name = (t.type === 'variable' ? t.text.replace(/^@@(session\.|global\.|local\.)?/i, '') : t.text).toUpperCase();
  if (name === 'PASSWORD') throw new CompatError(MSG.users);
  if (name === 'FOREIGN_KEY_CHECKS') {
    const valueTok = tokens[s[p + 2]];
    const value = valueTok ? valueTok.text.toUpperCase() : '';
    const on = !['0', 'OFF', 'FALSE'].includes(value);
    return plan([{
      run: (rt) => {
        rt.setForeignKeys(on);
        return message(on ? 'Controllo delle chiavi esterne attivato.' : 'Controllo delle chiavi esterne disattivato. Ricordati di riattivarlo con SET FOREIGN_KEY_CHECKS = 1.');
      }
    }]);
  }
  if (name === 'AUTOCOMMIT') {
    return noop('In QueryForge ogni comando viene confermato subito. Per lavorare in una transazione usa START TRANSACTION ... COMMIT.');
  }
  return noop('Impostazione accettata (non serve nel database del browser).');
}
