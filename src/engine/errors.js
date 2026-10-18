// File: src/engine/errors.js
// Errori di compatibilità e traduzione in italiano dei messaggi di SQLite.

/**
 * Errore sollevato quando un comando MySQL non è disponibile nel browser.
 * Il messaggio è già pensato per l'utente.
 */
export class CompatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CompatError';
  }
}

export const MSG = {
  variables: 'Le variabili (@nome) non sono disponibili in QueryForge: il database gira nel browser. Puoi usare una subquery o una CTE (WITH ...) al posto della variabile.',
  oneDatabase: 'In QueryForge c\'è un solo database (queryforge): non puoi crearne o eliminarne altri. Per ripartire dai dati iniziali usa «Reset Database».',
  users: 'Utenti e permessi (CREATE USER, GRANT, REVOKE...) non esistono nel database del browser: sei l\'unico utente.',
  routines: 'Procedure, funzioni, trigger ed eventi non sono disponibili nella versione browser di QueryForge.',
  delimiter: 'Il comando DELIMITER serve solo nel client mysql e non è necessario qui: separa le istruzioni con il punto e virgola.',
  files: 'Leggere o scrivere file sul disco (INTO OUTFILE, LOAD DATA...) non è possibile dal browser.',
  informationSchema: 'information_schema non è disponibile nel browser. Per vedere tabelle e colonne usa SHOW TABLES, DESCRIBE nome_tabella oppure SHOW CREATE TABLE nome_tabella.',
  rollup: 'WITH ROLLUP non è supportato nella versione browser. Puoi ottenere i totali con una seconda query unita con UNION ALL.',
  fulltext: 'La ricerca FULLTEXT (MATCH ... AGAINST) non è supportata nella versione browser: usa LIKE.',
  locks: 'LOCK TABLES non serve nel browser: c\'è un solo utente.',
  multiTableUpdate: 'Questa forma di UPDATE con più tabelle non è supportata. Riscrivila con una subquery, ad esempio: UPDATE t SET col = (SELECT ...) WHERE id IN (SELECT ...).',
  multiTableDelete: 'Questa forma di DELETE con più tabelle non è supportata. Riscrivila con una subquery, ad esempio: DELETE FROM t WHERE id IN (SELECT ...).',
  alterInTransaction: 'Le modifiche alla struttura (ALTER TABLE) chiudono la transazione aperta: esegui prima COMMIT o ROLLBACK.'
};

// Traduzioni dei messaggi più comuni di SQLite. Il dettaglio tecnico
// originale viene comunque mostrato tra parentesi.
const TRANSLATIONS = [
  [/^no such table: (?:main\.)?(.+)$/, m => `La tabella '${m[1]}' non esiste. Controlla il nome nell'elenco delle tabelle a sinistra.`],
  [/^no such column: (.+)$/, m => `La colonna '${m[1]}' non esiste. Controlla il nome (e l'alias della tabella, se lo usi).`],
  [/^ambiguous column name: (.+)$/, m => `Il nome di colonna '${m[1]}' è ambiguo: è presente in più tabelle. Indica la tabella, ad esempio t.${m[1].split('.').pop()}.`],
  [/^near "(.+)": syntax error$/, m => `Errore di sintassi vicino a "${m[1]}".`],
  [/^incomplete input$/, () => 'La query sembra incompleta: manca qualcosa alla fine (una parentesi, un apice o una parte del comando).'],
  [/^unrecognized token: "(.+)"$/, m => `Simbolo non riconosciuto: ${m[1]}. Controlla apici e parentesi.`],
  [/^UNIQUE constraint failed: (.+)$/, m => `Valore duplicato: '${m[1]}' deve essere unico e il valore inserito esiste già.`],
  [/^NOT NULL constraint failed: (.+)$/, m => `La colonna '${m[1]}' non può essere vuota (NULL).`],
  [/^FOREIGN KEY constraint failed$/, () => 'Vincolo di chiave esterna violato: il valore non esiste nella tabella collegata, oppure ci sono righe in altre tabelle che dipendono da questa.'],
  [/^CHECK constraint failed: (.+)$/, m => `Valore non ammesso per il vincolo ${m[1]} (per le colonne ENUM, il valore deve essere uno di quelli previsti).`],
  [/^table (.+) already exists$/, m => `La tabella ${m[1]} esiste già.`],
  [/^index (.+) already exists$/, m => `L'indice ${m[1]} esiste già.`],
  [/^no such index: (.+)$/, m => `L'indice '${m[1]}' non esiste.`],
  [/^no such function: (.+)$/, m => `La funzione ${m[1]}() non è disponibile. Il database del browser è SQLite: quasi tutte le funzioni MySQL sono supportate, ma non questa.`],
  [/^wrong number of arguments to function (.+)\(\)$/, m => `Numero di argomenti errato per la funzione ${m[1]}().`],
  [/^misuse of aggregate(?: function)?:? (.+)$/, m => `Uso non valido della funzione di aggregazione ${m[1]}: le funzioni come COUNT, SUM e AVG non si possono usare nel WHERE (usa HAVING).`],
  [/^misuse of aggregate.*$/, () => 'Uso non valido di una funzione di aggregazione: le funzioni come COUNT, SUM e AVG non si possono usare nel WHERE (usa HAVING).'],
  [/^(\d+) values for (\d+) columns$/, m => `Hai indicato ${m[1]} valori ma le colonne sono ${m[2]}.`],
  [/^table (.+) has (\d+) columns but (\d+) values were supplied$/, m => `La tabella ${m[1]} ha ${m[2]} colonne ma hai indicato ${m[3]} valori.`],
  [/^duplicate column name: (.+)$/, m => `La colonna '${m[1]}' esiste già.`],
  [/^cannot start a transaction within a transaction$/, () => 'C\'è già una transazione aperta: chiudila con COMMIT o ROLLBACK prima di iniziarne un\'altra.'],
  [/^cannot commit - no transaction is active$/, () => 'Non c\'è nessuna transazione aperta da confermare (COMMIT).'],
  [/^cannot rollback - no transaction is active$/, () => 'Non c\'è nessuna transazione aperta da annullare (ROLLBACK).'],
  [/^sub-select returns (\d+) columns - expected 1$/, m => `La subquery restituisce ${m[1]} colonne, ma qui ne serve una sola.`],
  [/^SELECTs to the left and right of (.+) do not have the same number of result columns$/, m => `Le SELECT unite con ${m[1]} devono avere lo stesso numero di colonne.`],
  [/^a GROUP BY clause is required before HAVING$/, () => 'HAVING si usa insieme a GROUP BY.'],
  [/^view (.+) may not be modified$/, m => `La vista ${m[1]} non si può modificare direttamente.`],
  [/^cannot drop column "(.+)": (.+)$/, m => `Non posso eliminare la colonna '${m[1]}': ${m[2]}.`],
  [/^datatype mismatch$/, () => 'Tipo di dato non compatibile con la colonna.'],
  [/^too many terms in compound SELECT$/, () => 'Troppe SELECT unite insieme.'],
  [/^interrupted$/, () => 'La query è stata interrotta.']
];

/**
 * Converte un errore di SQLite in un messaggio comprensibile, in italiano.
 */
export function translateSqliteError(error) {
  if (error instanceof CompatError) return error.message;
  const original = String(error && error.message ? error.message : error).trim();
  for (const [pattern, build] of TRANSLATIONS) {
    const match = original.match(pattern);
    if (match) return `${build(match)}\n(dettaglio tecnico: ${original})`;
  }
  return `Errore del database: ${original}`;
}
