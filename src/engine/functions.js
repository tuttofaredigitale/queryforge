// File: src/engine/functions.js
// Funzioni MySQL registrate dentro SQLite (sql.js), così le query scritte
// per MySQL funzionano anche nel database del browser.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Date e orari
// Le date sono gestite come "orari locali senza fuso": i calcoli usano UTC
// solo come aritmetica, così non ci sono sorprese con l'ora legale.
// ---------------------------------------------------------------------------

const pad = (value, width = 2) => String(Math.trunc(Math.abs(value))).padStart(width, '0');

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Millisecondi "UTC" di una data locale; setUTCFullYear gestisce anche gli anni < 100
function utcMs(y, mo, d, h = 0, mi = 0, s = 0, ms = 0) {
  const date = new Date(Date.UTC(2000, 0, 1, h, mi, s, ms));
  date.setUTCFullYear(y, mo - 1, d);
  return date.getTime();
}

function fromMs(ms, hasTime = true) {
  const date = new Date(ms);
  return {
    y: date.getUTCFullYear(),
    mo: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    h: date.getUTCHours(),
    mi: date.getUTCMinutes(),
    s: date.getUTCSeconds(),
    us: date.getUTCMilliseconds() * 1000,
    hasTime
  };
}

function toMs(p) {
  return utcMs(p.y, p.mo, p.d, p.h, p.mi, p.s, Math.floor((p.us || 0) / 1000));
}

/**
 * Interpreta una data o data/ora nei formati accettati da MySQL.
 * Restituisce null se il valore non è una data valida.
 */
export function parseDateTime(value) {
  if (value === null || value === undefined) return null;
  let text;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    text = String(Math.trunc(value));
    if (text.length === 8) text = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    else if (text.length === 14) text = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:${text.slice(10, 12)}:${text.slice(12, 14)}`;
    else return null;
  } else {
    text = String(value).trim();
  }
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,6}))?)?)?$/);
  if (!m) {
    const compact = text.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?$/);
    if (compact) m = [compact[0], compact[1], compact[2], compact[3], compact[4], compact[5], compact[6], undefined];
  }
  if (!m) return null;
  const p = {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: m[4] !== undefined ? Number(m[4]) : 0,
    mi: m[5] !== undefined ? Number(m[5]) : 0,
    s: m[6] !== undefined ? Number(m[6]) : 0,
    us: m[7] !== undefined ? Number(m[7].padEnd(6, '0')) : 0,
    hasTime: m[4] !== undefined
  };
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > monthLength(p.y, p.mo)) return null;
  if (p.h > 23 || p.mi > 59 || p.s > 59) return null;
  return p;
}

function monthLength(year, month) {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Interpreta un orario (anche oltre le 24 ore o negativo), oppure la parte
 * oraria di una data/ora. Restituisce i secondi totali (con decimali).
 */
function parseTimeSeconds(value) {
  if (value === null || value === undefined) return null;
  const dt = parseDateTime(value);
  if (dt && dt.hasTime) return dt.h * 3600 + dt.mi * 60 + dt.s + dt.us / 1e6;
  if (typeof value === 'number') {
    const sign = value < 0 ? -1 : 1;
    const v = Math.abs(Math.trunc(value));
    return sign * (Math.floor(v / 10000) * 3600 + (Math.floor(v / 100) % 100) * 60 + (v % 100));
  }
  const m = String(value).trim().match(/^(-)?(?:(\d+) )?(\d{1,3}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,6}))?)?$/);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const total = (Number(m[2] || 0) * 24 + Number(m[3])) * 3600 + Number(m[4]) * 60 + Number(m[5] || 0) + (m[6] ? Number(m[6].padEnd(6, '0')) / 1e6 : 0);
  return sign * total;
}

function formatTimeSeconds(total) {
  if (total === null) return null;
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const whole = Math.floor(abs + 1e-9);
  const h = Math.floor(whole / 3600);
  const mi = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const frac = Math.round((abs - whole) * 1e6);
  return `${sign}${pad(h)}:${pad(mi)}:${pad(s)}${frac ? '.' + String(frac).padStart(6, '0') : ''}`;
}

export function formatDate(p) {
  return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}`;
}

export function formatDateTime(p) {
  return `${formatDate(p)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${p.us ? '.' + String(p.us).padStart(6, '0') : ''}`;
}

export function localNow() {
  const now = new Date();
  return {
    y: now.getFullYear(),
    mo: now.getMonth() + 1,
    d: now.getDate(),
    h: now.getHours(),
    mi: now.getMinutes(),
    s: now.getSeconds(),
    us: 0,
    hasTime: true
  };
}

function utcNow() {
  return fromMs(Date.now() - (Date.now() % 1000));
}

function dayOfWeek(p) {
  // 0 = domenica
  return new Date(toMs({ ...p, h: 0, mi: 0, s: 0, us: 0 })).getUTCDay();
}

function dayOfYear(p) {
  return Math.round((toMs({ ...p, h: 0, mi: 0, s: 0, us: 0 }) - utcMs(p.y, 1, 1)) / MS_PER_DAY) + 1;
}

// Calcolo della settimana secondo le modalità di WEEK() in MySQL
function weekNumber(p, mode = 0) {
  mode = Number(mode) & 7;
  const mondayFirst = (mode & 1) === 1;
  const range1to53 = (mode & 2) === 2;
  const fourDays = mode === 1 || mode === 3 || mode === 4 || mode === 6;
  const compute = (year, doy) => {
    const jan1 = dayOfWeek({ y: year, mo: 1, d: 1 });
    // giorno della settimana con inizio scelto (0 = primo giorno della settimana)
    const jan1Index = mondayFirst ? (jan1 + 6) % 7 : jan1;
    let firstWeekStart;
    if (fourDays) {
      // la settimana 1 è la prima con almeno 4 giorni nell'anno
      firstWeekStart = jan1Index <= 3 ? 1 - jan1Index : 8 - jan1Index;
    } else {
      // la settimana 1 è la prima che contiene il primo giorno della settimana
      firstWeekStart = jan1Index === 0 ? 1 : 8 - jan1Index;
    }
    if (doy < firstWeekStart) return { week: 0, year };
    return { week: Math.floor((doy - firstWeekStart) / 7) + 1, year };
  };
  let { week, year } = compute(p.y, dayOfYear(p));
  if (week === 0 && range1to53) {
    const prev = { y: p.y - 1, mo: 12, d: 31 };
    week = compute(prev.y, dayOfYear(prev)).week;
    year = p.y - 1;
  }
  if (range1to53 && week === 53 && fourDays) {
    // la settimana 53 potrebbe essere la settimana 1 dell'anno successivo
    const nextJan1 = dayOfWeek({ y: p.y + 1, mo: 1, d: 1 });
    const idx = mondayFirst ? (nextJan1 + 6) % 7 : nextJan1;
    if (idx <= 3) {
      week = 1;
      year = p.y + 1;
    }
  }
  return { week, year };
}

function addMonths(p, months) {
  const total = p.y * 12 + (p.mo - 1) + months;
  const y = Math.floor(total / 12);
  const mo = (total % 12 + 12) % 12 + 1;
  const d = Math.min(p.d, monthLength(y, mo));
  return { ...p, y, mo, d };
}

const DATE_UNITS = new Set(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'YEAR_MONTH']);

function splitIntervalValue(value, count) {
  const text = String(value).trim();
  const negative = text.startsWith('-');
  const parts = text.replace(/^[-+]/, '').split(/[^0-9.]+/).filter(Boolean).map(Number);
  while (parts.length < count) parts.unshift(0);
  return { parts: parts.slice(-count), sign: negative ? -1 : 1 };
}

/**
 * Somma un intervallo a una data. `unit` è un'unità MySQL (DAY, MONTH, HOUR_MINUTE...).
 */
export function addInterval(value, amount, unit) {
  const p = parseDateTime(value);
  if (!p || amount === null || amount === undefined) return null;
  unit = String(unit).toUpperCase();
  let months = 0;
  let ms = 0;
  const num = Number(amount);
  switch (unit) {
    case 'MICROSECOND': ms = num / 1000; break;
    case 'SECOND': ms = num * 1000; break;
    case 'MINUTE': ms = num * 60000; break;
    case 'HOUR': ms = num * 3600000; break;
    case 'DAY': ms = num * MS_PER_DAY; break;
    case 'WEEK': ms = num * 7 * MS_PER_DAY; break;
    case 'MONTH': months = Math.trunc(num); break;
    case 'QUARTER': months = Math.trunc(num) * 3; break;
    case 'YEAR': months = Math.trunc(num) * 12; break;
    case 'YEAR_MONTH': {
      const { parts, sign } = splitIntervalValue(amount, 2);
      months = sign * (parts[0] * 12 + parts[1]);
      break;
    }
    case 'DAY_HOUR': {
      const { parts, sign } = splitIntervalValue(amount, 2);
      ms = sign * (parts[0] * MS_PER_DAY + parts[1] * 3600000);
      break;
    }
    case 'DAY_MINUTE': {
      const { parts, sign } = splitIntervalValue(amount, 3);
      ms = sign * (parts[0] * MS_PER_DAY + parts[1] * 3600000 + parts[2] * 60000);
      break;
    }
    case 'DAY_SECOND': {
      const { parts, sign } = splitIntervalValue(amount, 4);
      ms = sign * (parts[0] * MS_PER_DAY + parts[1] * 3600000 + parts[2] * 60000 + parts[3] * 1000);
      break;
    }
    case 'HOUR_MINUTE': {
      const { parts, sign } = splitIntervalValue(amount, 2);
      ms = sign * (parts[0] * 3600000 + parts[1] * 60000);
      break;
    }
    case 'HOUR_SECOND': {
      const { parts, sign } = splitIntervalValue(amount, 3);
      ms = sign * (parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000);
      break;
    }
    case 'MINUTE_SECOND': {
      const { parts, sign } = splitIntervalValue(amount, 2);
      ms = sign * (parts[0] * 60000 + parts[1] * 1000);
      break;
    }
    default:
      throw new Error(`Unità di intervallo non supportata: ${unit}`);
  }
  let result = months ? addMonths(p, months) : p;
  if (ms) result = fromMs(toMs(result) + ms, true);
  const keepDate = !p.hasTime && DATE_UNITS.has(unit);
  return keepDate ? formatDate(result) : formatDateTime({ ...result, us: result.us || 0 });
}

function monthDiff(a, b) {
  // mesi interi da a a b, come TIMESTAMPDIFF(MONTH, a, b)
  let months = (b.y - a.y) * 12 + (b.mo - a.mo);
  const aRest = ((a.d * 24 + a.h) * 60 + a.mi) * 60 + a.s;
  const bRest = ((b.d * 24 + b.h) * 60 + b.mi) * 60 + b.s;
  if (months > 0 && bRest < aRest) months--;
  if (months < 0 && bRest > aRest) months++;
  return months;
}

function timestampDiff(unit, a, b) {
  const pa = parseDateTime(a);
  const pb = parseDateTime(b);
  if (!pa || !pb) return null;
  const diffMs = toMs(pb) - toMs(pa);
  const trunc = (x) => Math.trunc(x + (x > 0 ? 1e-9 : -1e-9));
  switch (String(unit).toUpperCase()) {
    case 'MICROSECOND': return trunc(diffMs * 1000);
    case 'SECOND': return trunc(diffMs / 1000);
    case 'MINUTE': return trunc(diffMs / 60000);
    case 'HOUR': return trunc(diffMs / 3600000);
    case 'DAY': return trunc(diffMs / MS_PER_DAY);
    case 'WEEK': return trunc(diffMs / (7 * MS_PER_DAY));
    case 'MONTH': return monthDiff(pa, pb);
    case 'QUARTER': return Math.trunc(monthDiff(pa, pb) / 3);
    case 'YEAR': return Math.trunc(monthDiff(pa, pb) / 12);
    default: throw new Error(`Unità non supportata in TIMESTAMPDIFF: ${unit}`);
  }
}

function extract(unit, value) {
  const p = parseDateTime(value);
  const u = String(unit).toUpperCase();
  if (!p) {
    const seconds = parseTimeSeconds(value);
    if (seconds === null) return null;
    const abs = Math.abs(seconds);
    const sign = seconds < 0 ? -1 : 1;
    if (u === 'HOUR') return sign * Math.floor(abs / 3600);
    if (u === 'MINUTE') return sign * Math.floor((abs % 3600) / 60);
    if (u === 'SECOND') return sign * Math.floor(abs % 60);
    return null;
  }
  switch (u) {
    case 'YEAR': return p.y;
    case 'QUARTER': return Math.floor((p.mo - 1) / 3) + 1;
    case 'MONTH': return p.mo;
    case 'WEEK': return weekNumber(p, 0).week;
    case 'DAY': return p.d;
    case 'HOUR': return p.h;
    case 'MINUTE': return p.mi;
    case 'SECOND': return p.s;
    case 'MICROSECOND': return p.us;
    case 'YEAR_MONTH': return p.y * 100 + p.mo;
    case 'DAY_HOUR': return p.d * 100 + p.h;
    case 'DAY_MINUTE': return (p.d * 100 + p.h) * 100 + p.mi;
    case 'DAY_SECOND': return ((p.d * 100 + p.h) * 100 + p.mi) * 100 + p.s;
    case 'HOUR_MINUTE': return p.h * 100 + p.mi;
    case 'HOUR_SECOND': return (p.h * 100 + p.mi) * 100 + p.s;
    case 'MINUTE_SECOND': return p.mi * 100 + p.s;
    default: throw new Error(`Unità non supportata in EXTRACT: ${unit}`);
  }
}

function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

/**
 * DATE_FORMAT con gli specificatori di MySQL.
 */
export function dateFormat(value, format) {
  const p = parseDateTime(value);
  if (!p || format === null) return null;
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return String(format).replace(/%(.)/g, (all, spec) => {
    switch (spec) {
      case 'a': return DAY_NAMES[dayOfWeek(p)].slice(0, 3);
      case 'b': return MONTH_NAMES[p.mo - 1].slice(0, 3);
      case 'c': return String(p.mo);
      case 'D': return p.d + ordinalSuffix(p.d);
      case 'd': return pad(p.d);
      case 'e': return String(p.d);
      case 'f': return String(p.us).padStart(6, '0');
      case 'H': return pad(p.h);
      case 'h':
      case 'I': return pad(h12);
      case 'i': return pad(p.mi);
      case 'j': return pad(dayOfYear(p), 3);
      case 'k': return String(p.h);
      case 'l': return String(h12);
      case 'M': return MONTH_NAMES[p.mo - 1];
      case 'm': return pad(p.mo);
      case 'p': return p.h < 12 ? 'AM' : 'PM';
      case 'r': return `${pad(h12)}:${pad(p.mi)}:${pad(p.s)} ${p.h < 12 ? 'AM' : 'PM'}`;
      case 'S':
      case 's': return pad(p.s);
      case 'T': return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
      case 'U': return pad(weekNumber(p, 0).week);
      case 'u': return pad(weekNumber(p, 1).week);
      case 'V': return pad(weekNumber(p, 2).week);
      case 'v': return pad(weekNumber(p, 3).week);
      case 'W': return DAY_NAMES[dayOfWeek(p)];
      case 'w': return String(dayOfWeek(p));
      case 'X': return pad(weekNumber(p, 2).year, 4);
      case 'x': return pad(weekNumber(p, 3).year, 4);
      case 'Y': return pad(p.y, 4);
      case 'y': return pad(p.y % 100);
      case '%': return '%';
      default: return spec;
    }
  });
}

function timeFormat(value, format) {
  const seconds = parseTimeSeconds(value);
  if (seconds === null || format === null) return null;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const mi = Math.floor((abs % 3600) / 60);
  const s = Math.floor(abs % 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return (seconds < 0 ? '-' : '') + String(format).replace(/%(.)/g, (all, spec) => {
    switch (spec) {
      case 'H': return pad(h);
      case 'k': return String(h);
      case 'h':
      case 'I': return pad(h12);
      case 'l': return String(h12);
      case 'i': return pad(mi);
      case 'S':
      case 's': return pad(s);
      case 'p': return h % 24 < 12 ? 'AM' : 'PM';
      case 'r': return `${pad(h12)}:${pad(mi)}:${pad(s)} ${h % 24 < 12 ? 'AM' : 'PM'}`;
      case 'T': return `${pad(h)}:${pad(mi)}:${pad(s)}`;
      case 'f': return '000000';
      case '%': return '%';
      default: return spec;
    }
  });
}

/**
 * STR_TO_DATE: interpreta una stringa secondo il formato indicato.
 */
function strToDate(text, format) {
  if (text === null || format === null) return null;
  const str = String(text);
  const fmt = String(format);
  const p = { y: 0, mo: 1, d: 1, h: 0, mi: 0, s: 0, us: 0 };
  let hasTime = false;
  let hasDate = false;
  let pm = null;
  let pos = 0;
  const readNumber = (maxLen) => {
    const m = str.slice(pos).match(new RegExp(`^\\d{1,${maxLen}}`));
    if (!m) throw new Error('nomatch');
    pos += m[0].length;
    return Number(m[0]);
  };
  const readName = (names, abbreviated) => {
    const rest = str.slice(pos).toLowerCase();
    for (let i = 0; i < names.length; i++) {
      const name = abbreviated ? names[i].slice(0, 3) : names[i];
      if (rest.startsWith(name.toLowerCase())) {
        pos += name.length;
        return i;
      }
    }
    throw new Error('nomatch');
  };
  try {
    for (let i = 0; i < fmt.length; i++) {
      const ch = fmt[i];
      if (ch !== '%') {
        if (str[pos] !== ch) {
          if (/\s/.test(ch) && /\s/.test(str[pos] || '')) {
            while (/\s/.test(str[pos] || '')) pos++;
            continue;
          }
          return null;
        }
        pos++;
        continue;
      }
      const spec = fmt[++i];
      switch (spec) {
        case 'd': case 'e': p.d = readNumber(2); hasDate = true; break;
        case 'm': case 'c': p.mo = readNumber(2); hasDate = true; break;
        case 'Y': p.y = readNumber(4); hasDate = true; break;
        case 'y': { const y = readNumber(2); p.y = y < 70 ? 2000 + y : 1900 + y; hasDate = true; break; }
        case 'M': p.mo = readName(MONTH_NAMES, false) + 1; hasDate = true; break;
        case 'b': p.mo = readName(MONTH_NAMES, true) + 1; hasDate = true; break;
        case 'W': readName(DAY_NAMES, false); break;
        case 'a': readName(DAY_NAMES, true); break;
        case 'H': case 'k': p.h = readNumber(2); hasTime = true; break;
        case 'h': case 'I': case 'l': p.h = readNumber(2); hasTime = true; break;
        case 'i': p.mi = readNumber(2); hasTime = true; break;
        case 's': case 'S': p.s = readNumber(2); hasTime = true; break;
        case 'f': { const m = str.slice(pos).match(/^\d{1,6}/); if (!m) return null; p.us = Number(m[0].padEnd(6, '0')); pos += m[0].length; hasTime = true; break; }
        case 'p': {
          const rest = str.slice(pos, pos + 2).toUpperCase();
          if (rest !== 'AM' && rest !== 'PM') return null;
          pm = rest === 'PM';
          pos += 2;
          break;
        }
        case 'T': {
          p.h = readNumber(2); if (str[pos++] !== ':') return null;
          p.mi = readNumber(2); if (str[pos++] !== ':') return null;
          p.s = readNumber(2); hasTime = true; break;
        }
        case 'r': {
          p.h = readNumber(2); if (str[pos++] !== ':') return null;
          p.mi = readNumber(2); if (str[pos++] !== ':') return null;
          p.s = readNumber(2);
          while (str[pos] === ' ') pos++;
          const rest = str.slice(pos, pos + 2).toUpperCase();
          if (rest === 'AM' || rest === 'PM') { pm = rest === 'PM'; pos += 2; }
          hasTime = true;
          break;
        }
        case 'j': {
          const doy = readNumber(3);
          const date = fromMs(utcMs(p.y || 2000, 1, 1) + (doy - 1) * MS_PER_DAY);
          p.mo = date.mo;
          p.d = date.d;
          hasDate = true;
          break;
        }
        case '%': if (str[pos++] !== '%') return null; break;
        default: if (str[pos++] !== spec) return null;
      }
    }
  } catch (e) {
    return null;
  }
  if (pm !== null) {
    if (pm && p.h < 12) p.h += 12;
    if (!pm && p.h === 12) p.h = 0;
  }
  if (!hasDate && hasTime) return formatTimeSeconds(p.h * 3600 + p.mi * 60 + p.s);
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > monthLength(p.y, p.mo)) return null;
  return hasTime ? formatDateTime(p) : formatDate(p);
}

const TO_DAYS_2000 = 730485; // TO_DAYS('2000-01-01')

function toDays(value) {
  const p = parseDateTime(value);
  if (!p) return null;
  return TO_DAYS_2000 + Math.round((utcMs(p.y, p.mo, p.d) - utcMs(2000, 1, 1)) / MS_PER_DAY);
}

function fromDays(n) {
  if (n === null) return null;
  return formatDate(fromMs(utcMs(2000, 1, 1) + (Number(n) - TO_DAYS_2000) * MS_PER_DAY));
}

// ---------------------------------------------------------------------------
// Stringhe e numeri
// ---------------------------------------------------------------------------

const isNull = (v) => v === null || v === undefined;
const anyNull = (args) => args.some(isNull);

function toText(value) {
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  return String(value);
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const m = String(value).trim().match(/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/);
  return m ? Number(m[0]) : 0;
}

// SUBSTRING con le regole di MySQL (posizione 0 = stringa vuota, negativa = dalla fine)
function mysqlSubstring(str, pos, len) {
  if (isNull(str) || isNull(pos)) return null;
  const chars = Array.from(toText(str));
  let start = Math.trunc(toNumber(pos));
  if (start === 0) return '';
  if (start < 0) start = chars.length + start;
  else start -= 1;
  if (start < 0 || start >= chars.length) return '';
  if (len === undefined) return chars.slice(start).join('');
  if (isNull(len)) return null;
  const count = Math.trunc(toNumber(len));
  if (count <= 0) return '';
  return chars.slice(start, start + count).join('');
}

// Arrotondamento "per eccesso dalla metà", come ROUND() sui DECIMAL di MySQL.
// La piccola correzione evita errori di rappresentazione (1.005 * 100 = 100.4999...).
function roundHalfAwayFromZero(value, digits) {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, Math.trunc(digits));
  const shifted = Math.abs(value) * factor;
  const rounded = Math.round(shifted + shifted * Number.EPSILON * 4) / factor;
  return value < 0 ? -rounded : rounded;
}

// Posizione (da 1) di `needle` in `haystack` a partire da `start`, senza distinguere maiuscole
function locate(needle, haystack, start = 1) {
  const chars = Array.from(toText(haystack).toLowerCase());
  const sub = Array.from(toText(needle).toLowerCase());
  const from = Math.trunc(toNumber(start));
  if (from < 1 || from > chars.length + 1) return 0;
  for (let i = from - 1; i + sub.length <= chars.length; i++) {
    let found = true;
    for (let j = 0; j < sub.length; j++) {
      if (chars[i + j] !== sub[j]) {
        found = false;
        break;
      }
    }
    if (found) return i + 1;
  }
  return 0;
}

function formatNumber(value, decimals, locale) {
  if (isNull(value) || isNull(decimals)) return null;
  const d = Math.max(0, Math.min(30, Math.trunc(toNumber(decimals))));
  const num = roundHalfAwayFromZero(toNumber(value), d);
  const [intPart, decPart] = Math.abs(num).toFixed(d).split('.');
  const european = locale && /^(it|de|es|pt|nl|da|id|tr)_/i.test(String(locale));
  const thousands = european ? '.' : ',';
  const decimalSep = european ? ',' : '.';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return (num < 0 ? '-' : '') + grouped + (d > 0 ? decimalSep + decPart : '');
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

function toHex(value) {
  if (isNull(value)) return null;
  if (typeof value === 'number') {
    return Math.trunc(value) >= 0
      ? Math.trunc(value).toString(16).toUpperCase()
      : (BigInt.asUintN(64, BigInt(Math.trunc(value)))).toString(16).toUpperCase();
  }
  const bytes = value instanceof Uint8Array ? value : utf8Bytes(String(value));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function soundex(value) {
  if (isNull(value)) return null;
  const codes = { B: 1, F: 1, P: 1, V: 1, C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2, D: 3, T: 3, L: 4, M: 5, N: 5, R: 6 };
  const letters = toText(value).toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return '';
  let result = letters[0];
  let last = codes[letters[0]] || 0;
  for (let i = 1; i < letters.length; i++) {
    const ch = letters[i];
    const code = codes[ch] || 0;
    if (code && code !== last) result += code;
    if (ch !== 'H' && ch !== 'W') last = code;
  }
  return result.padEnd(4, '0');
}

function likeRegex(pattern, flags) {
  return new RegExp(String(pattern), flags);
}

function regexFlags(matchType) {
  let flags = 'i';
  if (!isNull(matchType)) {
    for (const ch of String(matchType)) {
      if (ch === 'c') flags = flags.replace('i', '');
      if (ch === 'i' && !flags.includes('i')) flags += 'i';
      if (ch === 'm' && !flags.includes('m')) flags += 'm';
      if (ch === 'n' && !flags.includes('s')) flags += 's';
    }
  }
  return flags;
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = toText(a).toLowerCase();
  const sb = toText(b).toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function mysqlTrim(str, remove, mode) {
  if (isNull(str) || isNull(remove)) return null;
  let text = toText(str);
  const rem = toText(remove);
  if (!rem) return text;
  const m = String(mode || 'BOTH').toUpperCase();
  if (m === 'BOTH' || m === 'LEADING') {
    while (text.startsWith(rem)) text = text.slice(rem.length);
  }
  if (m === 'BOTH' || m === 'TRAILING') {
    while (text.endsWith(rem)) text = text.slice(0, text.length - rem.length);
  }
  return text;
}

// Hash usati spesso negli esempi dei corsi (MD5, SHA1, SHA2)
function md5(input) {
  const bytes = utf8Bytes(input);
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const length = bytes.length;
  const padded = new Uint8Array(((length + 8) >> 6) * 64 + 64);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (length * 8) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor((length * 8) / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let offset = 0; offset < padded.length; offset += 64) {
    const m = new Uint32Array(16);
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(offset + i * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + k[i] + m[g]) >>> 0;
      b = (b + ((sum << s[i]) | (sum >>> (32 - s[i])))) >>> 0;
      a = temp;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
  return Array.from(new Uint8Array(out.buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function shaCore(input, variant) {
  const bytes = utf8Bytes(input);
  const length = bytes.length;
  const padded = new Uint8Array(((length + 8) >> 6) * 64 + 64);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  if (variant === 1) {
    let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    const w = new Uint32Array(80);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let [a, b, c, d, e] = h;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
        e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = temp;
      }
      h = [(h[0] + a) >>> 0, (h[1] + b) >>> 0, (h[2] + c) >>> 0, (h[3] + d) >>> 0, (h[4] + e) >>> 0];
    }
    return h.map((v) => v.toString(16).padStart(8, '0')).join('');
  }
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let h = variant === 224
    ? [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]
    : [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map((v) => v >>> 0);
  }
  const words = variant === 224 ? h.slice(0, 7) : h;
  return words.map((v) => v.toString(16).padStart(8, '0')).join('');
}

function randomUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function seededRandom(seed) {
  let t = (Math.trunc(Number(seed)) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Registrazione
// ---------------------------------------------------------------------------

/**
 * sql.js registra le funzioni per nome (una sola arità per nome) e usa
 * fn.length come numero di argomenti. SQLite però non distingue maiuscole e
 * minuscole: registrando varianti del nome con arità diverse otteniamo più
 * "overload" della stessa funzione. Con length = -1 la funzione è variadica.
 */
function createRegistrar(db) {
  const used = new Map();
  const variantFor = (name, index) => {
    const lower = name.toLowerCase();
    if (index === 0) return lower;
    if (index === 1) return lower.toUpperCase();
    // alterna maiuscole e minuscole secondo i bit dell'indice
    return Array.from(lower, (ch, i) => ((index >> (i % 16)) & 1 ? ch.toUpperCase() : ch)).join('');
  };
  const nextKey = (name) => {
    const lower = name.toLowerCase();
    const keys = used.get(lower) || new Set();
    let index = 0;
    let key = variantFor(name, index);
    while (keys.has(key)) key = variantFor(name, ++index);
    keys.add(key);
    used.set(lower, keys);
    return key;
  };
  const scalar = (name, arities, impl) => {
    for (const arity of [].concat(arities)) {
      const fn = (...args) => impl(...args);
      Object.defineProperty(fn, 'length', { value: arity });
      db.create_function(nextKey(name), fn);
    }
  };
  const aggregate = (name, spec) => {
    db.create_aggregate(nextKey(name), spec);
  };
  return { scalar, aggregate };
}

function variance(values, sample) {
  const n = values.length;
  if (n === 0 || (sample && n < 2)) return null;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sum = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return sum / (sample ? n - 1 : n);
}

/**
 * Registra tutte le funzioni MySQL sulla connessione.
 * Va richiamata ogni volta che il database viene aperto o riaperto.
 */
export function registerMysqlFunctions(db, { sqliteVersion = '' } = {}) {
  const { scalar, aggregate } = createRegistrar(db);
  const nullSafe = (fn) => (...args) => (anyNull(args) ? null : fn(...args));
  const dateOf = (fn) => (value, ...rest) => {
    const p = parseDateTime(value);
    return p ? fn(p, ...rest) : null;
  };

  // --- data e ora correnti
  scalar('NOW', [0, 1], () => formatDateTime(localNow()));
  scalar('SYSDATE', [0, 1], () => formatDateTime(localNow()));
  scalar('CURDATE', 0, () => formatDate(localNow()));
  scalar('CURTIME', [0, 1], () => {
    const p = localNow();
    return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
  });
  scalar('UTC_TIMESTAMP', [0, 1], () => formatDateTime(utcNow()));
  scalar('UTC_DATE', 0, () => formatDate(utcNow()));
  scalar('UTC_TIME', [0, 1], () => {
    const p = utcNow();
    return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
  });

  // --- parti di una data
  scalar('YEAR', 1, dateOf((p) => p.y));
  scalar('MONTH', 1, dateOf((p) => p.mo));
  scalar('DAY', 1, dateOf((p) => p.d));
  scalar('DAYOFMONTH', 1, dateOf((p) => p.d));
  scalar('QUARTER', 1, dateOf((p) => Math.floor((p.mo - 1) / 3) + 1));
  scalar('DAYOFYEAR', 1, dateOf((p) => dayOfYear(p)));
  scalar('DAYOFWEEK', 1, dateOf((p) => dayOfWeek(p) + 1));
  scalar('WEEKDAY', 1, dateOf((p) => (dayOfWeek(p) + 6) % 7));
  scalar('WEEK', [1, 2], (value, mode = 0) => {
    const p = parseDateTime(value);
    return p ? weekNumber(p, mode === null ? 0 : mode).week : null;
  });
  scalar('WEEKOFYEAR', 1, dateOf((p) => weekNumber(p, 3).week));
  scalar('YEARWEEK', [1, 2], (value, mode = 0) => {
    const p = parseDateTime(value);
    if (!p) return null;
    const r = weekNumber(p, (Number(mode) & 7) | 2);
    return r.year * 100 + r.week;
  });
  scalar('DAYNAME', 1, dateOf((p) => DAY_NAMES[dayOfWeek(p)]));
  scalar('MONTHNAME', 1, dateOf((p) => MONTH_NAMES[p.mo - 1]));
  scalar('HOUR', 1, (v) => extract('HOUR', v));
  scalar('MINUTE', 1, (v) => extract('MINUTE', v));
  scalar('SECOND', 1, (v) => extract('SECOND', v));
  scalar('MICROSECOND', 1, (v) => extract('MICROSECOND', v));
  scalar('LAST_DAY', 1, dateOf((p) => formatDate({ ...p, d: monthLength(p.y, p.mo) })));
  // DATE() e TIME() con un solo argomento accettano anche date non zero-padded
  scalar('DATE', 1, dateOf((p) => formatDate(p)));
  scalar('TIME', 1, (v) => {
    const seconds = parseTimeSeconds(v);
    return seconds === null ? null : formatTimeSeconds(seconds);
  });
  scalar('EXTRACT', 2, nullSafe((unit, v) => extract(unit, v)));

  // --- formattazione e conversione
  scalar('DATE_FORMAT', 2, dateFormat);
  scalar('TIME_FORMAT', 2, timeFormat);
  scalar('STR_TO_DATE', 2, strToDate);
  scalar('MAKEDATE', 2, nullSafe((year, doy) => (Number(doy) < 1 ? null : formatDate(fromMs(utcMs(Number(year), 1, 1) + (Math.trunc(Number(doy)) - 1) * MS_PER_DAY)))));
  scalar('MAKETIME', 3, nullSafe((h, m, s) => formatTimeSeconds(Number(h) * 3600 + Number(m) * 60 + Number(s))));
  scalar('TO_DAYS', 1, toDays);
  scalar('FROM_DAYS', 1, fromDays);
  scalar('UNIX_TIMESTAMP', [0, 1], (value) => {
    if (value === undefined) return Math.floor(Date.now() / 1000);
    const p = parseDateTime(value);
    if (!p) return null;
    return Math.floor(new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s).getTime() / 1000);
  });
  scalar('FROM_UNIXTIME', [1, 2], (ts, format) => {
    if (isNull(ts)) return null;
    const date = new Date(Number(ts) * 1000);
    const p = { y: date.getFullYear(), mo: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds(), us: 0, hasTime: true };
    return format === undefined ? formatDateTime(p) : dateFormat(formatDateTime(p), format);
  });
  scalar('SEC_TO_TIME', 1, nullSafe((s) => formatTimeSeconds(Number(s))));
  scalar('TIME_TO_SEC', 1, (v) => {
    const seconds = parseTimeSeconds(v);
    return seconds === null ? null : Math.trunc(seconds);
  });

  // --- aritmetica con le date
  scalar('DATEDIFF', 2, (a, b) => {
    const da = toDays(a);
    const db2 = toDays(b);
    return da === null || db2 === null ? null : da - db2;
  });
  scalar('TIMEDIFF', 2, (a, b) => {
    const pa = parseDateTime(a);
    const pb = parseDateTime(b);
    if (pa && pb) return formatTimeSeconds((toMs(pa) - toMs(pb)) / 1000);
    const sa = parseTimeSeconds(a);
    const sb = parseTimeSeconds(b);
    return sa === null || sb === null ? null : formatTimeSeconds(sa - sb);
  });
  scalar('TIMESTAMPDIFF', 3, (unit, a, b) => (anyNull([unit, a, b]) ? null : timestampDiff(unit, a, b)));
  scalar('TIMESTAMPADD', 3, (unit, n, v) => (anyNull([unit, n, v]) ? null : addInterval(v, n, unit)));
  scalar('DATE_ADD', 3, (v, n, unit) => (anyNull([v, n, unit]) ? null : addInterval(v, n, unit)));
  scalar('DATE_SUB', 3, (v, n, unit) => (anyNull([v, n, unit]) ? null : addInterval(v, negateAmount(n), unit)));
  scalar('ADDDATE', [2, 3], (v, n, unit = 'DAY') => (anyNull([v, n, unit]) ? null : addInterval(v, n, unit)));
  scalar('SUBDATE', [2, 3], (v, n, unit = 'DAY') => (anyNull([v, n, unit]) ? null : addInterval(v, negateAmount(n), unit)));
  scalar('ADDTIME', 2, (v, t) => {
    const delta = parseTimeSeconds(t);
    if (isNull(v) || delta === null) return null;
    const p = parseDateTime(v);
    if (p && p.hasTime) return formatDateTime(fromMs(toMs(p) + delta * 1000));
    const base = parseTimeSeconds(v);
    return base === null ? null : formatTimeSeconds(base + delta);
  });
  scalar('SUBTIME', 2, (v, t) => {
    const delta = parseTimeSeconds(t);
    if (isNull(v) || delta === null) return null;
    const p = parseDateTime(v);
    if (p && p.hasTime) return formatDateTime(fromMs(toMs(p) - delta * 1000));
    const base = parseTimeSeconds(v);
    return base === null ? null : formatTimeSeconds(base - delta);
  });

  // --- stringhe
  const concat = (...args) => (anyNull(args) ? null : args.map(toText).join(''));
  scalar('CONCAT', -1, concat);
  scalar('MYSQL_ISNULL', 1, (v) => (isNull(v) ? 1 : 0));
  scalar('LEFT', 2, nullSafe((s, n) => Array.from(toText(s)).slice(0, Math.max(0, Math.trunc(toNumber(n)))).join('')));
  scalar('RIGHT', 2, nullSafe((s, n) => {
    const chars = Array.from(toText(s));
    const count = Math.max(0, Math.trunc(toNumber(n)));
    return count === 0 ? '' : chars.slice(-count).join('');
  }));
  scalar('SUBSTRING', [2, 3], mysqlSubstring);
  scalar('SUBSTR', [2, 3], mysqlSubstring);
  scalar('MID', [2, 3], mysqlSubstring);
  scalar('SUBSTRING_INDEX', 3, nullSafe((s, delim, count) => {
    const text = toText(s);
    const d = toText(delim);
    const c = Math.trunc(toNumber(count));
    if (!d || c === 0) return '';
    const parts = text.split(d);
    return c > 0 ? parts.slice(0, c).join(d) : parts.slice(c).join(d);
  }));
  scalar('LOCATE', [2, 3], (sub, s, pos = 1) => (anyNull([sub, s, pos]) ? null : locate(sub, s, pos)));
  scalar('INSTR', 2, nullSafe((s, sub) => locate(sub, s)));
  scalar('LPAD', 3, nullSafe((s, len, padStr) => {
    const chars = Array.from(toText(s));
    const n = Math.trunc(toNumber(len));
    if (n < 0) return null;
    if (chars.length >= n) return chars.slice(0, n).join('');
    const p = toText(padStr);
    if (!p) return null;
    let fill = '';
    while (Array.from(fill).length < n - chars.length) fill += p;
    return Array.from(fill).slice(0, n - chars.length).join('') + chars.join('');
  }));
  scalar('RPAD', 3, nullSafe((s, len, padStr) => {
    const chars = Array.from(toText(s));
    const n = Math.trunc(toNumber(len));
    if (n < 0) return null;
    if (chars.length >= n) return chars.slice(0, n).join('');
    const p = toText(padStr);
    if (!p) return null;
    let fill = '';
    while (Array.from(fill).length < n - chars.length) fill += p;
    return chars.join('') + Array.from(fill).slice(0, n - chars.length).join('');
  }));
  scalar('REPEAT', 2, nullSafe((s, n) => toText(s).repeat(Math.max(0, Math.trunc(toNumber(n))))));
  scalar('SPACE', 1, nullSafe((n) => ' '.repeat(Math.max(0, Math.trunc(toNumber(n))))));
  scalar('REVERSE', 1, nullSafe((s) => Array.from(toText(s)).reverse().join('')));
  scalar('UPPER', 1, nullSafe((s) => toText(s).toUpperCase()));
  scalar('LOWER', 1, nullSafe((s) => toText(s).toLowerCase()));
  scalar('UCASE', 1, nullSafe((s) => toText(s).toUpperCase()));
  scalar('LCASE', 1, nullSafe((s) => toText(s).toLowerCase()));
  scalar('MYSQL_TRIM', 3, mysqlTrim);
  scalar('ASCII', 1, nullSafe((s) => {
    const bytes = utf8Bytes(toText(s));
    return bytes.length ? bytes[0] : 0;
  }));
  scalar('ORD', 1, nullSafe((s) => {
    const ch = Array.from(toText(s))[0];
    if (!ch) return 0;
    const bytes = utf8Bytes(ch);
    return bytes.reduce((acc, b) => acc * 256 + b, 0);
  }));
  scalar('HEX', 1, toHex);
  scalar('UNHEX', 1, nullSafe((s) => {
    const text = toText(s);
    if (!/^[0-9A-Fa-f]*$/.test(text)) return null;
    const bytes = new Uint8Array(Math.ceil(text.length / 2));
    const padded = text.length % 2 ? '0' + text : text;
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
    return new TextDecoder().decode(bytes);
  }));
  scalar('BIN', 1, nullSafe((n) => Math.trunc(toNumber(n)).toString(2)));
  scalar('OCT', 1, nullSafe((n) => Math.trunc(toNumber(n)).toString(8)));
  scalar('CONV', 3, nullSafe((n, from, to) => {
    const value = parseInt(toText(n), Number(from));
    return Number.isNaN(value) ? '0' : value.toString(Math.abs(Number(to))).toUpperCase();
  }));
  scalar('STRCMP', 2, nullSafe((a, b) => Math.sign(compareValues(toText(a), toText(b)))));
  scalar('FIELD', -1, (needle, ...list) => {
    if (isNull(needle)) return 0;
    const index = list.findIndex((item) => !isNull(item) && compareValues(needle, item) === 0);
    return index + 1;
  });
  scalar('FIND_IN_SET', 2, nullSafe((needle, list) => {
    const items = toText(list).split(',');
    const index = items.findIndex((item) => item.toLowerCase() === toText(needle).toLowerCase());
    return index + 1;
  }));
  scalar('ELT', -1, (n, ...list) => {
    if (isNull(n)) return null;
    const index = Math.trunc(toNumber(n));
    return index >= 1 && index <= list.length ? list[index - 1] : null;
  });
  scalar('FORMAT', [2, 3], (value, decimals, locale) => formatNumber(value, decimals, locale));
  scalar('SOUNDEX', 1, soundex);
  scalar('BIT_LENGTH', 1, nullSafe((s) => utf8Bytes(toText(s)).length * 8));
  scalar('MD5', 1, nullSafe((s) => md5(toText(s))));
  scalar('SHA1', 1, nullSafe((s) => shaCore(toText(s), 1)));
  scalar('SHA', 1, nullSafe((s) => shaCore(toText(s), 1)));
  scalar('SHA2', 2, nullSafe((s, bits) => {
    const b = Number(bits);
    if (b === 224) return shaCore(toText(s), 224);
    if (b === 256 || b === 0) return shaCore(toText(s), 256);
    return null;
  }));
  scalar('UUID', 0, () => randomUuid());

  // --- espressioni regolari (REGEXP usa la funzione regexp(pattern, testo))
  scalar('REGEXP', 2, (pattern, s) => (anyNull([pattern, s]) ? null : (likeRegex(pattern, 'i').test(toText(s)) ? 1 : 0)));
  scalar('REGEXP_LIKE', [2, 3], (s, pattern, flags) => (anyNull([s, pattern]) ? null : (likeRegex(pattern, regexFlags(flags)).test(toText(s)) ? 1 : 0)));
  scalar('REGEXP_REPLACE', [3, 4, 5, 6], (s, pattern, replacement, pos, occurrence, flags) => {
    if (anyNull([s, pattern, replacement])) return null;
    const re = likeRegex(pattern, regexFlags(flags) + (occurrence ? '' : 'g'));
    return toText(s).replace(re, toText(replacement).replace(/\\(\d)/g, '$$$1'));
  });
  scalar('REGEXP_SUBSTR', [2, 3, 4, 5], (s, pattern, pos, occurrence, flags) => {
    if (anyNull([s, pattern])) return null;
    const matches = toText(s).match(likeRegex(pattern, regexFlags(flags) + 'g'));
    const index = occurrence ? Number(occurrence) - 1 : 0;
    return matches && matches[index] !== undefined ? matches[index] : null;
  });
  scalar('REGEXP_INSTR', [2, 3, 4, 5, 6], (s, pattern, pos, occurrence, returnOption, flags) => {
    if (anyNull([s, pattern])) return null;
    const m = likeRegex(pattern, regexFlags(flags)).exec(toText(s));
    return m ? m.index + 1 : 0;
  });

  // --- numeri
  scalar('POW', 2, nullSafe((a, b) => Math.pow(toNumber(a), toNumber(b))));
  scalar('MOD', 2, nullSafe((a, b) => (toNumber(b) === 0 ? null : toNumber(a) % toNumber(b))));
  scalar('LN', 1, nullSafe((x) => (toNumber(x) <= 0 ? null : Math.log(toNumber(x)))));
  scalar('LOG', 2, nullSafe((base, x) => (toNumber(x) <= 0 || toNumber(base) <= 0 || toNumber(base) === 1 ? null : Math.log(toNumber(x)) / Math.log(toNumber(base)))));
  scalar('LOG2', 1, nullSafe((x) => (toNumber(x) <= 0 ? null : Math.log2(toNumber(x)))));
  scalar('CEILING', 1, nullSafe((x) => Math.ceil(toNumber(x))));
  scalar('MYSQL_TO_SIGNED', 1, nullSafe((v) => {
    if (typeof v === 'number') return v < 0 ? -Math.round(-v) : Math.round(v);
    const m = toText(v).trim().match(/^[-+]?\d+/);
    return m ? Number(m[0]) : 0;
  }));
  scalar('TRUNCATE', 2, nullSafe((x, d) => {
    const digits = Math.trunc(toNumber(d));
    const factor = Math.pow(10, digits);
    return Math.trunc(toNumber(x) * factor + (toNumber(x) >= 0 ? 1e-9 : -1e-9)) / factor;
  }));
  scalar('ROUND', 2, nullSafe((x, d) => roundHalfAwayFromZero(toNumber(x), toNumber(d))));
  scalar('RAND', [0, 1], (seed) => (seed === undefined || seed === null ? Math.random() : seededRandom(seed)));
  scalar('GREATEST', -1, (...args) => {
    if (args.length < 2) throw new Error('GREATEST richiede almeno due argomenti');
    if (anyNull(args)) return null;
    return args.reduce((best, v) => (compareValues(v, best) > 0 ? v : best));
  });
  scalar('LEAST', -1, (...args) => {
    if (args.length < 2) throw new Error('LEAST richiede almeno due argomenti');
    if (anyNull(args)) return null;
    return args.reduce((best, v) => (compareValues(v, best) < 0 ? v : best));
  });
  scalar('CRC32', 1, nullSafe((s) => {
    let crc = 0xffffffff;
    for (const byte of utf8Bytes(toText(s))) {
      crc ^= byte;
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }));

  // --- informazioni e varie
  scalar('DATABASE', 0, () => 'queryforge');
  scalar('USER', 0, () => 'studente@localhost');
  scalar('VERSION', 0, () => `8.0 (compatibile) - SQLite ${sqliteVersion}`.trim());
  scalar('CONNECTION_ID', 0, () => 1);
  scalar('SLEEP', 1, () => 0);
  scalar('JSON_UNQUOTE', 1, nullSafe((s) => {
    const text = toText(s);
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }
    return text;
  }));

  // --- aggregazioni
  const collector = (finalize) => ({
    init: () => [],
    step: (state, value) => {
      if (!isNull(value)) state.push(toNumber(value));
      return state;
    },
    finalize
  });
  aggregate('STD', collector((s) => (s && s.length ? Math.sqrt(variance(s, false)) : null)));
  aggregate('STDDEV', collector((s) => (s && s.length ? Math.sqrt(variance(s, false)) : null)));
  aggregate('STDDEV_POP', collector((s) => (s && s.length ? Math.sqrt(variance(s, false)) : null)));
  aggregate('STDDEV_SAMP', collector((s) => (s && s.length > 1 ? Math.sqrt(variance(s, true)) : null)));
  aggregate('VARIANCE', collector((s) => (s && s.length ? variance(s, false) : null)));
  aggregate('VAR_POP', collector((s) => (s && s.length ? variance(s, false) : null)));
  aggregate('VAR_SAMP', collector((s) => (s && s.length > 1 ? variance(s, true) : null)));
  aggregate('BIT_AND', {
    init: () => null,
    step: (state, v) => (isNull(v) ? state : state === null ? BigInt.asUintN(64, BigInt(Math.trunc(toNumber(v)))) : state & BigInt.asUintN(64, BigInt(Math.trunc(toNumber(v))))),
    finalize: (state) => (state === null ? 18446744073709551615 : Number(state))
  });
  aggregate('BIT_OR', {
    init: () => 0,
    step: (state, v) => (isNull(v) ? state : state | Math.trunc(toNumber(v))),
    finalize: (state) => state || 0
  });
  aggregate('BIT_XOR', {
    init: () => 0,
    step: (state, v) => (isNull(v) ? state : state ^ Math.trunc(toNumber(v))),
    finalize: (state) => state || 0
  });
  aggregate('ANY_VALUE', {
    init: () => ({ set: false, value: null }),
    step: (state, v) => (state.set ? state : { set: true, value: v }),
    finalize: (state) => (state ? state.value : null)
  });
}

// Cambia segno a una quantità di intervallo, numerica o composta ('1:30')
function negateAmount(n) {
  if (typeof n === 'number') return -n;
  const text = String(n).trim();
  return text.startsWith('-') ? text.slice(1) : '-' + text;
}
