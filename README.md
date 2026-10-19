# QueryForge

Un playground per fare pratica con SQL, che gira interamente nel browser.
Scrivi query con la sintassi di **MySQL 8**, esegui gli esercizi guidati ed esplora un database di esempio (clienti, prodotti, ordini), senza installare MySQL e senza creare account.

Versione online: [queryforge.io](https://queryforge.io)

## Usarlo sul tuo computer

Serve [Node.js](https://nodejs.org/) 18 o successivo.

```bash
npm install
npm run dev
```

Poi apri http://localhost:5173 nel browser.

Altri comandi:

| Comando | Cosa fa |
| --- | --- |
| `npm run build` | crea il sito statico nella cartella `dist/` |
| `npm run preview` | serve in locale il contenuto di `dist/` |
| `npm test` | esegue i test del motore SQL |

## Come funziona

- Il database è [SQLite](https://sqlite.org/) compilato in WebAssembly ([sql.js](https://sql.js.org/)) e gira in un Web Worker, quindi una query lenta non blocca la pagina. Dopo 15 secondi la query viene interrotta.
- Le query vengono tradotte da MySQL a SQLite prima di essere eseguite (cartella `src/engine/`).
- Il database viene salvato nel browser (IndexedDB) e la cronologia delle query in `localStorage`. Nessun dato lascia il computer dell'utente.
- **Reset Database** ricrea il database di esempio da `src/engine/template_schema.sql`.

## Compatibilità con MySQL

Funzionano come in MySQL:

- `SELECT` con `JOIN`, `GROUP BY`, `HAVING`, subquery (anche con `ANY`/`ALL`), `UNION`, CTE e funzioni finestra;
- `LIMIT offset, n`, `DIV`, `<=>`, `REGEXP`, `GROUP_CONCAT(... SEPARATOR ...)`;
- funzioni su date (`DATE_FORMAT`, `DATE_ADD(... INTERVAL ...)`, `DATEDIFF`, `TIMESTAMPDIFF`, `WEEK`...), stringhe (`CONCAT`, `SUBSTRING_INDEX`, `LPAD`, `LOCATE`...) e numeri (`ROUND`, `TRUNCATE`, `MOD`...);
- `CREATE TABLE` con `AUTO_INCREMENT`, `ENUM`, `DEFAULT CURRENT_TIMESTAMP`, `ON UPDATE CURRENT_TIMESTAMP`, chiavi esterne, `ENGINE=...`;
- `ALTER TABLE` (`ADD`, `MODIFY`, `CHANGE`, `DROP`, `RENAME`, indici e chiavi esterne);
- `INSERT ... SET`, `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, `UPDATE`/`DELETE` con `ORDER BY ... LIMIT` e con `JOIN`;
- `SHOW TABLES`, `DESCRIBE`, `SHOW CREATE TABLE`, `SHOW INDEX`, transazioni, `SET FOREIGN_KEY_CHECKS`.

Come in MySQL, i confronti tra testi non distinguono maiuscole e minuscole e la divisione restituisce sempre un decimale.

Non sono disponibili nel browser:

- variabili (`@nome`);
- procedure, funzioni, trigger ed eventi;
- utenti e permessi;
- `information_schema`;
- `FULLTEXT`;
- `WITH ROLLUP`;
- lettura e scrittura di file.

Per questi comandi viene mostrato un messaggio che spiega l'alternativa. I messaggi di errore sono tradotti in italiano e riportano anche il dettaglio originale di SQLite.

## Esercizi e database di esempio

- Gli esercizi sono in `src/data/sql_exercises.json`, divisi in capitoli. Ogni lezione ha `id`, `title`, `concept`, `description`, `hint` (facoltativo) e `solution`.
- Il database di esempio è in `src/engine/template_schema.sql`, in sintassi MySQL.

I test (`npm test`) controllano che tutte le soluzioni degli esercizi funzionino.

## Pubblicare il sito

Dopo `npm run build` la cartella `dist/` è un sito statico: si può pubblicare su qualsiasi hosting statico.

Su Vercel il file `vercel.json` gestisce i link diretti alle pagine (es. `/playground`). Due variabili facoltative attivano il banner cookie e le statistiche (vedi `.env.example`):

- `VITE_GA_ID`: Google Analytics 4;
- `VITE_IUBENDA_WIDGET_ID`: banner cookie di iubenda.

Senza queste variabili il sito non carica script di terze parti. Se sono impostate tutte e due, Google Analytics parte solo dopo che il visitatore ha accettato la "Misurazione" nel banner: prima non viene caricato e non invia nulla.

## Versione precedente

Fino al 2026 QueryForge usava un server Node.js con un database MySQL per ogni utente. Quel codice è nel primo commit di questo repository.

## Licenza

[MIT](LICENSE)
