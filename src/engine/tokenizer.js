// File: src/engine/tokenizer.js
// Scompone il testo SQL in token seguendo le regole lessicali di MySQL:
// stringhe con escape tramite backslash, commenti con # e "-- ",
// identificatori tra backtick, stringhe anche tra doppi apici.

const WORD_CHAR = /[A-Za-z0-9_$\u0080-￿]/;
const SPACE = /\s/;
const DIGIT = /[0-9]/;
const HEX = /[0-9A-Fa-f]/;

// Sequenze di escape riconosciute da MySQL nelle stringhe.
// \% e \_ restano invariati (servono nei pattern di LIKE).
const ESCAPES = {
  '0': '\0',
  "'": "'",
  '"': '"',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
  '\\': '\\',
  '%': '\\%',
  _: '\\_'
};

const THREE_CHAR_OPS = ['<=>', '->>'];
const TWO_CHAR_OPS = ['<=', '>=', '<>', '!=', '||', '&&', ':=', '->', '<<', '>>'];
const PUNCT = new Set(['(', ')', ',', '.', ';']);

/**
 * Restituisce l'elenco dei token. Ogni token ha:
 * type: ws | comment | string | qident | number | variable | word | op | punct | param
 * text: il testo originale, start/end: posizione nel testo.
 * Le stringhe hanno anche `value` (contenuto senza apici ed escape),
 * le parole hanno `upper` (testo in maiuscolo).
 */
export function tokenize(sql) {
  const tokens = [];
  const n = sql.length;
  let i = 0;

  const push = (type, start, end, extra = {}) => {
    const token = { type, text: sql.slice(start, end), start, end, ...extra };
    tokens.push(token);
    return token;
  };

  while (i < n) {
    const c = sql[i];
    const start = i;

    // Spazi
    if (SPACE.test(c)) {
      while (i < n && SPACE.test(sql[i])) i++;
      push('ws', start, i);
      continue;
    }

    // Commenti fino a fine riga: # oppure "-- " (MySQL richiede lo spazio dopo --)
    if (c === '#' || (c === '-' && sql[i + 1] === '-' && (i + 2 >= n || SPACE.test(sql[i + 2])))) {
      while (i < n && sql[i] !== '\n') i++;
      push('comment', start, i);
      continue;
    }

    // Commenti /* ... */ (anche quelli eseguibili /*! ... */, che ignoriamo)
    if (c === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      push('comment', start, i, { unterminated: close === -1 });
      continue;
    }

    // Stringhe tra apici singoli o doppi
    if (c === "'" || c === '"') {
      const quote = c;
      let value = '';
      let closed = false;
      i++;
      while (i < n) {
        const ch = sql[i];
        if (ch === '\\' && i + 1 < n) {
          const next = sql[i + 1];
          value += Object.prototype.hasOwnProperty.call(ESCAPES, next) ? ESCAPES[next] : next;
          i += 2;
          continue;
        }
        if (ch === quote) {
          if (sql[i + 1] === quote) {
            value += quote;
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        value += ch;
        i++;
      }
      push('string', start, i, { value, quote, unterminated: !closed });
      continue;
    }

    // Identificatori tra backtick
    if (c === '`') {
      let value = '';
      let closed = false;
      i++;
      while (i < n) {
        if (sql[i] === '`') {
          if (sql[i + 1] === '`') {
            value += '`';
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        value += sql[i];
        i++;
      }
      push('qident', start, i, { value, unterminated: !closed });
      continue;
    }

    // Numeri (decimali, esponenziali, esadecimali 0x..)
    if (DIGIT.test(c) || (c === '.' && DIGIT.test(sql[i + 1] || '') && !isWordEnd(tokens))) {
      if (c === '0' && (sql[i + 1] === 'x' || sql[i + 1] === 'X') && HEX.test(sql[i + 2] || '')) {
        i += 2;
        while (i < n && HEX.test(sql[i])) i++;
      } else {
        while (i < n && DIGIT.test(sql[i])) i++;
        if (sql[i] === '.' && DIGIT.test(sql[i + 1] || '')) {
          i++;
          while (i < n && DIGIT.test(sql[i])) i++;
        } else if (sql[i] === '.' && !WORD_CHAR.test(sql[i + 1] || '')) {
          i++;
        }
        if ((sql[i] === 'e' || sql[i] === 'E') && (DIGIT.test(sql[i + 1] || '') || ((sql[i + 1] === '+' || sql[i + 1] === '-') && DIGIT.test(sql[i + 2] || '')))) {
          i += 2;
          while (i < n && DIGIT.test(sql[i])) i++;
        }
      }
      // In MySQL un identificatore può iniziare con cifre (es. 1abc)
      if (i < n && WORD_CHAR.test(sql[i]) && sql[i] !== '.') {
        while (i < n && WORD_CHAR.test(sql[i])) i++;
        const text = sql.slice(start, i);
        push('word', start, i, { upper: text.toUpperCase() });
        continue;
      }
      push('number', start, i);
      continue;
    }

    // Variabili utente (@nome) e di sistema (@@nome)
    if (c === '@') {
      i++;
      if (sql[i] === '@') i++;
      while (i < n && (WORD_CHAR.test(sql[i]) || sql[i] === '.')) i++;
      push('variable', start, i);
      continue;
    }

    // Parole: parole chiave, identificatori, nomi di funzione
    if (WORD_CHAR.test(c)) {
      while (i < n && WORD_CHAR.test(sql[i])) i++;
      const text = sql.slice(start, i);
      // Letterali esadecimali e binari X'..' / B'..' e stringhe N'..'
      if (/^[xXbBnN]$/.test(text) && sql[i] === "'") {
        const close = sql.indexOf("'", i + 1);
        const end = close === -1 ? n : close + 1;
        const body = sql.slice(i + 1, close === -1 ? n : close);
        i = end;
        if (/^[nN]$/.test(text)) {
          push('string', start, i, { value: body, quote: "'", unterminated: close === -1 });
        } else {
          push('number', start, i, { literal: text.toUpperCase(), body });
        }
        continue;
      }
      push('word', start, i, { upper: text.toUpperCase() });
      continue;
    }

    // Segnaposto
    if (c === '?') {
      i++;
      push('param', start, i);
      continue;
    }

    // Operatori
    const three = sql.substr(i, 3);
    if (THREE_CHAR_OPS.includes(three)) {
      i += 3;
      push('op', start, i);
      continue;
    }
    const two = sql.substr(i, 2);
    if (TWO_CHAR_OPS.includes(two)) {
      i += 2;
      push('op', start, i);
      continue;
    }
    i++;
    push(PUNCT.has(c) ? 'punct' : 'op', start, i);
  }

  return tokens;
}

// Evita di leggere ".5" come numero subito dopo un identificatore (es. t.5colonna)
function isWordEnd(tokens) {
  const last = tokens[tokens.length - 1];
  return Boolean(last && (last.type === 'word' || last.type === 'qident'));
}

export function isSignificant(token) {
  return token.type !== 'ws' && token.type !== 'comment';
}

/**
 * Indice del prossimo token significativo a partire da `from` (incluso), oppure -1.
 */
export function nextSig(tokens, from, to = tokens.length) {
  for (let i = from; i < to; i++) {
    if (isSignificant(tokens[i])) return i;
  }
  return -1;
}

/**
 * Indice del token significativo precedente a `from` (escluso), oppure -1.
 */
export function prevSig(tokens, from, min = 0) {
  for (let i = from - 1; i >= min; i--) {
    if (isSignificant(tokens[i])) return i;
  }
  return -1;
}

/**
 * Data la posizione di una parentesi aperta, restituisce la posizione
 * della parentesi chiusa corrispondente (o -1 se manca).
 */
export function matchParen(tokens, openIndex, to = tokens.length) {
  let depth = 0;
  for (let i = openIndex; i < to; i++) {
    const t = tokens[i];
    if (t.type !== 'punct') continue;
    if (t.text === '(') depth++;
    else if (t.text === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Divide l'intervallo [from, to) in parti separate da virgole di primo livello.
 * Restituisce coppie [inizio, fine).
 */
export function splitTopLevel(tokens, from, to, separator = ',') {
  const parts = [];
  let depth = 0;
  let partStart = from;
  for (let i = from; i < to; i++) {
    const t = tokens[i];
    if (t.type === 'punct') {
      if (t.text === '(') depth++;
      else if (t.text === ')') depth--;
      else if (t.text === separator && depth === 0) {
        parts.push([partStart, i]);
        partStart = i + 1;
      }
    }
  }
  parts.push([partStart, to]);
  return parts;
}

/**
 * Cerca, a profondità zero, la prima parola fra quelle indicate.
 */
export function findTopLevelWord(tokens, from, to, words) {
  const set = new Set(words);
  let depth = 0;
  for (let i = from; i < to; i++) {
    const t = tokens[i];
    if (t.type === 'punct') {
      if (t.text === '(') depth++;
      else if (t.text === ')') depth--;
    } else if (depth === 0 && t.type === 'word' && set.has(t.upper)) {
      return i;
    }
  }
  return -1;
}

/**
 * Divide il testo in istruzioni separate da punto e virgola.
 * Restituisce un array di { text, tokens } senza le istruzioni vuote.
 */
export function splitStatements(sql) {
  const tokens = tokenize(sql);
  const statements = [];
  let current = [];
  const flush = () => {
    if (current.some(isSignificant)) {
      const first = current[0].start;
      const last = current[current.length - 1].end;
      statements.push({ text: sql.slice(first, last).trim(), tokens: current });
    }
    current = [];
  };
  for (const t of tokens) {
    if (t.type === 'punct' && t.text === ';') {
      flush();
    } else {
      current.push(t);
    }
  }
  flush();
  return statements;
}
