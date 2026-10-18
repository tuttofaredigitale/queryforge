// File: src/utils/queryAnalyzer.js
// Segnala le operazioni che non si possono annullare, così l'utente
// le conferma prima di eseguirle. Il database è solo nel browser
// dell'utente: non ci sono comandi da bloccare per sicurezza.

import { splitStatements, isSignificant, findTopLevelWord } from '@/engine/tokenizer.js';

const LINK = true;

function issue(text, showLink = LINK) {
  return {
    type: 'dangerous_pattern',
    level: 'critical',
    message: { text, showLink },
    requiresConfirmation: true
  };
}

function words(tokens) {
  return tokens.filter(isSignificant).filter((t) => t.type === 'word').map((t) => t.upper);
}

/**
 * Analizza la query e restituisce gli avvisi.
 * @param {string} query - Il testo SQL (anche con più istruzioni).
 * @returns {{isSafe: boolean, issues: Array, requiresConfirmation: boolean, blockedCompletely: boolean}}
 */
export function analyzeSQLQuery(query) {
  const issues = [];
  let statements = [];
  try {
    statements = splitStatements(query);
  } catch (error) {
    statements = [];
  }

  for (const { tokens } of statements) {
    const w = words(tokens);
    const first = w[0];
    if (first === 'DROP' && ['TABLE', 'TABLES', 'VIEW', 'INDEX', 'TEMPORARY'].includes(w[1])) {
      issues.push(issue('Stai per eliminare un oggetto del database (DROP): l\'operazione è definitiva.'));
    } else if (first === 'TRUNCATE') {
      issues.push(issue('Stai per svuotare una tabella (TRUNCATE): tutte le righe verranno eliminate.'));
    } else if (first === 'DELETE' && findTopLevelWord(tokens, 0, tokens.length, ['WHERE']) === -1) {
      issues.push(issue('DELETE senza clausola WHERE: eliminerebbe tutte le righe della tabella.'));
    } else if (first === 'UPDATE' && findTopLevelWord(tokens, 0, tokens.length, ['WHERE']) === -1) {
      issues.push(issue('UPDATE senza clausola WHERE: modificherebbe tutte le righe della tabella.'));
    } else if (first === 'ALTER' && w[1] === 'TABLE') {
      issues.push(issue('Stai per modificare la struttura di una tabella (ALTER TABLE).'));
    }
  }

  // Un avviso per tipo è sufficiente
  const unique = issues.filter((item, index) => issues.findIndex((other) => other.message.text === item.message.text) === index);

  return {
    isSafe: unique.length === 0,
    issues: unique,
    requiresConfirmation: unique.some((item) => item.requiresConfirmation),
    blockedCompletely: false
  };
}
