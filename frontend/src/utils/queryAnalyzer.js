// File: src/utils/queryAnalyzer.js

// Definizione dei comandi SQL potenzialmente pericolosi
const DANGEROUS_PATTERNS = [
  // Pattern di manipolazione dati distruttivi
  { pattern: /DROP\s+(?:DATABASE|TABLE|INDEX|USER)/i, level: 'critical', message: 'Tentativo di eliminare oggetti del database', showLink: true },
  { pattern: /TRUNCATE\s+TABLE/i, level: 'critical', message: 'Tentativo di svuotare una tabella', showLink: true },
  { pattern: /DELETE\s+FROM\s+(?!.+WHERE)/i, level: 'critical', message: 'DELETE senza clausola WHERE (eliminerebbe tutti i dati)', showLink: true },
  { pattern: /UPDATE\s+(?!.+WHERE)/i, level: 'critical', message: 'UPDATE senza clausola WHERE (modificherebbe tutti i dati)', showLink: true },
  { pattern: /ALTER\s+TABLE/i, level: 'critical', message: 'Tentativo di modificare la struttura di una tabella', showLink: true },
  
  // Pattern di accesso a metadati e tabelle di sistema
  { pattern: /FROM\s+(information_schema|mysql|performance_schema|sys)\./i, level: 'critical', message: 'Tentativo di accesso a tabelle di sistema', showLink: true },
  { pattern: /SHOW\s+(DATABASES|SCHEMAS)/i, level: 'warning', message: 'Il comando SHOW DATABASES verrà bloccato dal sistema per motivi di sicurezza', showLink: true },
  { pattern: /SELECT\s+(?:.*\s+)?schema_name\s+FROM\s+information_schema\.schemata/i, level: 'critical', message: 'Tentativo di enumerare i database', showLink: true },
  { pattern: /SELECT\s+(?:.*\s+)?table_name\s+FROM\s+information_schema\.tables/i, level: 'critical', message: 'Tentativo di enumerare le tabelle', showLink: true },
  { pattern: /SELECT\s+(?:.*\s+)?column_name\s+FROM\s+information_schema\.columns/i, level: 'critical', message: 'Tentativo di enumerare le colonne', showLink: true },
  
  // Pattern di iniezione SQL comuni
  { pattern: /\bOR\s+(['"]?).*\1\s*=\s*\1.*\1/i, level: 'warning', message: 'Possibile iniezione SQL con operatore OR' },
  { pattern: /\bOR\s+\d+\s*=\s*\d+/i, level: 'warning', message: 'Possibile iniezione SQL con operatore OR (numerico)' },
  { pattern: /\bUNION\s+(?:ALL\s+)?SELECT\b/i, level: 'warning', message: 'Tentativo di utilizzo di UNION SELECT' },
  { pattern: /\bSLEEP\s*\(/i, level: 'warning', message: 'Tentativo di utilizzo della funzione SLEEP (possibile time-based injection)' },
  { pattern: /\bBENCHMARK\s*\(/i, level: 'warning', message: 'Tentativo di utilizzo della funzione BENCHMARK (possibile time-based injection)' },
  { pattern: /\/\*!.*\*\//i, level: 'warning', message: 'Utilizzo di commenti con codice eseguibile' },
  
  // Comandi amministrativi
  { pattern: /GRANT\s+/i, level: 'critical', message: 'Tentativo di assegnare privilegi', showLink: true },
  { pattern: /REVOKE\s+/i, level: 'critical', message: 'Tentativo di revocare privilegi', showLink: true },
  { pattern: /CREATE\s+(USER|DATABASE|SCHEMA)/i, level: 'critical', message: 'Tentativo di creare utenti o database' },
  
  // Accesso al filesystem
  { pattern: /INTO\s+(OUTFILE|DUMPFILE)/i, level: 'critical', message: 'Tentativo di scrivere sul filesystem' },
  { pattern: /LOAD\s+DATA\s+(?:LOCAL\s+)?INFILE/i, level: 'critical', message: 'Tentativo di leggere dal filesystem' },
  { pattern: /LOAD_FILE\s*\(/i, level: 'critical', message: 'Tentativo di leggere dal filesystem' }
];

// Funzione helper (non esportata) per controllare comandi multipli
const hasMultipleQueries = (query) => {
  const withoutComments = query.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const queryParts = withoutComments.split(';').map(part => part.trim()).filter(part => part.length > 0);
  return queryParts.length > 1;
};

/**
 * Analizza una stringa di query SQL per rilevare problemi di sicurezza.
 * @param {string} query - La query SQL da analizzare.
 * @returns {{isSafe: boolean, issues: Array, requiresConfirmation: boolean, blockedCompletely: boolean}} - Un oggetto con i risultati dell'analisi.
 */
export function analyzeSQLQuery(query) {
  const issues = [];

  if (/\brename\s+table\b/i.test(query)) {
    return {
      isSafe: false,
      issues: [{
        type: 'blocked_command',
        level: 'critical',
        message: { 
          text: 'Il comando RENAME TABLE è disabilitato per motivi di sicurezza.', 
          showLink: true 
        },
        requiresConfirmation: false
      }],
      requiresConfirmation: false,
      blockedCompletely: true
    };
  }

  if (hasMultipleQueries(query)) {
    issues.push({
      type: 'multiple_queries',
      level: 'critical',
      message: 'La query contiene più comandi (separati da punto e virgola). Per motivi di sicurezza, è consentita una sola query alla volta.',
      requiresConfirmation: true
    });
  }

  if (/^\s*SHOW\s+TABLES\s*;?\s*$/i.test(query)) {
    return { isSafe: true, issues: [], requiresConfirmation: false, blockedCompletely: false };
  }

  if (/^\s*SHOW\s+(DATABASES|SCHEMAS)\s*;?\s*$/i.test(query)) {
    issues.push({
      type: 'info',
      level: 'warning',
      message: 'Il comando SHOW DATABASES verrà bloccato dal sistema per motivi di sicurezza',
      requiresConfirmation: false
    });
    return { isSafe: true, issues, requiresConfirmation: false, blockedCompletely: false };
  }

  DANGEROUS_PATTERNS.forEach(({ pattern, level, message }) => {
    if (pattern.test(query)) {
      issues.push({
        type: 'dangerous_pattern',
        level,
        message,
        requiresConfirmation: level === 'critical'
      });
    }
  });

  const blockedCompletely = issues.some(issue => 
    issue.level === 'critical' && issue.requiresConfirmation === false
  );

  return {
    isSafe: issues.length === 0,
    issues,
    requiresConfirmation: issues.some(issue => issue.requiresConfirmation),
    blockedCompletely
  };
}