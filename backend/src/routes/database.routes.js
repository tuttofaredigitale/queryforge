const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const db = require('../utils/db'); // o qualunque sia il percorso corretto al tuo nuovo db.js
const databaseQueryLimiter = require('../middlewares/databaseQueryLimiter');
const { analyzeSQLQuery } = require('../middlewares/sql-safety-middleware');
const sqlTracer = require('../utils/sqlTracer');
const logger = require('../utils/logger');
const sqlMonitor = require('../utils/sqlMonitor');

// --- Rotte Specifiche ---

router.post('/execute',
  databaseQueryLimiter, // Limite di query specifico per l'utente
  async (req, res) => {
    let connection = null;
    const userId = req.user.id;
    try {
      const db = require('../utils/db'); 
      connection = await db.createUserDbConnection(userId); 
      let { query, confirmed } = req.body;

      if (process.env.NODE_ENV === 'production') {
            const userPrefix = `user_${userId}_`;
            
            // Regex per trovare tutti i nomi di tabella che NON sono già prefissati
            // Cerca FROM, JOIN, UPDATE, INTO seguito da una parola che non inizia con 'user_'
            const tableRegex = /(\b(?:FROM|JOIN|UPDATE|INTO)\s+`?)(?!user_)([\w$]+)(`?)/gi;
            
            query = query.replace(tableRegex, (match, keyword, tableName, closingQuote) => {
                // Sostituisce 'categorie' con 'user_6_categorie'
                const newTableName = `${userPrefix}${tableName}`;
                logger.info(`[Query Translator] Traduzione tabella: '${tableName}' -> '${newTableName}'`);
                return `${keyword}${newTableName}${closingQuote}`;
            });

            // Gestisce anche CREATE TABLE e ALTER TABLE
            const ddlRegex = /(\b(?:TABLE)\s+`?)(?!user_)([\w$]+)(`?)/gi;
            query = query.replace(ddlRegex, (match, keyword, tableName, closingQuote) => {
                const newTableName = `${userPrefix}${tableName}`;
                logger.info(`[Query Translator] Traduzione DDL: '${tableName}' -> '${newTableName}'`);
                return `${keyword}${newTableName}${closingQuote}`;
            });
        }

        const securityAnalysis = analyzeSQLQuery(query);
        
        if (securityAnalysis.blockedCompletely) {
            // Estrai il primo messaggio di errore per essere più specifico
            const firstIssue = securityAnalysis.issues[0] || { message: 'Query bloccata per motivi di sicurezza.' };
            // Invia una risposta che il frontend può interpretare come "informativa"
            return res.status(403).json({
                message: firstIssue.message,
                code: 'QUERY_BLOCKED', // Usiamo il codice che il frontend già riconosce
                issues: securityAnalysis.issues
            });
        }

        if (securityAnalysis.requiresConfirmation && !confirmed) {
            // Rispondi che è richiesta la conferma
            return res.status(400).json({
                success: false,
                message: 'Query contiene operazioni critiche e richiede conferma',
                issues: securityAnalysis.issues.filter(issue => issue.requiresConfirmation),
                code: 'CONFIRMATION_REQUIRED',
                requiresConfirmation: true
            });
        }

      // --- Definizione Inline di executeQueryWithTimeout (versione Promise) ---
      const executeQueryWithTimeout = (queryToExecute, defaultTimeout = 15000) => {
        const effectiveTimeout = defaultTimeout;
          // Aggiungere qui eventuali altre eccezioni per timeout diversi

          return new Promise((resolve, reject) => {
            let timer = null;

            const cleanup = (err = null) => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                // Non distruggere la connessione qui, verrà rilasciata nel finally dell'handler principale
                if (err) reject(err);
            };

            timer = setTimeout(() => {
                const timeoutError = new Error(`Query timeout: la query è stata interrotta dopo ${effectiveTimeout / 1000} secondi (Attenzione: l'esecuzione sul DB potrebbe non essere stata interrotta).`);
                timeoutError.code = 'QUERY_TIMEOUT';
                logger.warn(timeoutError.message, { 
                  query: queryToExecute.substring(0, 200) + (queryToExecute.length > 200 ? '...' : ''), // Logga solo inizio query
                  userId: userId,
                  timeout: effectiveTimeout 
              }); 
                cleanup(timeoutError);
            }, effectiveTimeout);

            // Esegue la query usando la connessione esterna
            // Assumendo che connection sia da mysql2/promise
            connection.query(queryToExecute)
              .then(([results, fields]) => { // Destruttura per ottenere results e fields
                if (!timer) return; // Già scaduto/gestito
                cleanup(); // Pulisci il timer
                resolve([results, fields]); // Risolvi con entrambi
              })
              .catch(dbError => {
                if (!timer) return; // Già scaduto/gestito
                logger.error(`Errore DB durante connection.query: ${dbError.code || 'N/A'} - ${dbError.message}`, { 
                  query: queryToExecute.substring(0, 200) + (queryToExecute.length > 200 ? '...' : ''),
                  userId: userId,
                  sqlState: dbError.sqlState,
                  sqlMessage: dbError.sqlMessage
              }); 
                cleanup(dbError); // Rigetta con l'errore del DB
              });
          });
      };

      // Traccia la query per il monitoraggio
      sqlTracer.traceQuery(query, userId);

      // Traccia la query per il monitoraggio
      sqlTracer.traceQuery(query, userId);
      
      // Monitora anche con sqlMonitor
      const monitorResult = sqlMonitor.monitorQuery(
        query, 
        userId, 
        req.ip || req.connection?.remoteAddress || 'unknown',
        req.sessionID || 'no-session'
      );
      
      // Se la query è bloccata per troppi tentativi sospetti
      if (monitorResult.action === 'blocked') {
        logger.warn('Query bloccata per attività sospetta', { 
          userId, 
          patterns: monitorResult.patterns 
        });
        return res.status(403).json({
          message: 'Accesso temporaneamente bloccato per attività sospetta',
          error_type: 'suspicious_activity_blocked',
          ...(req.queryUsage && { usage: req.queryUsage })
        });
      }

      // Esegui la query usando la funzione definita inline
      const [result, fields] = await executeQueryWithTimeout(query); // Chiama la funzione locale

      // Course Lab Edition: incrementa sempre il contatore query
      // Il middleware databaseQueryLimiter ha già verificato il limite
      if (req.incrementQueryCount) {
        await req.incrementQueryCount();
      }

// Usa i dati di utilizzo dal middleware
const updatedUsage = req.queryUsage || { limit: 50, used: 0, remaining: 50 };
      // Ora abbiamo sempre 'updatedUsage' con i dati corretti
      if (Array.isArray(result)) {
        res.json({
          rows: result,
          fields: fields ? fields.map(f => ({ name: f.name, type: f.columnType })) : [],
          usage: updatedUsage // <-- Includiamo sempre i dati di utilizzo aggiornati
        });
      } else {
        const trimmedQuery = query.trim().toLowerCase();
        if (trimmedQuery.startsWith('use ')) {
          res.json({
            message: 'Database cambiato con successo',
            usage: updatedUsage
          });
        } else {
          res.json({
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            message: `Query eseguita con successo. Righe interessate: ${result.affectedRows}`,
            usage: updatedUsage
          });
        }
      }

    } catch (error) {
        if (error.message.includes('Comando non consentito') || error.message.includes('Accesso non consentito')) {
          return res.status(403).json({
              message: error.message,
              error_type: 'forbidden_query' 
          });
      }
      logger.error( // Logga il messaggio principale dell'errore
        `Errore nell'handler /execute per utente ${req.user?.id || 'sconosciuto'}: ${error.message}`,
        { // Passa solo metadati specifici e sicuri (primitivi)
            userId: req.user?.id,
            errorCode: error.code,     // Codice errore (es. 'ER_PARSE_ERROR')
            sqlState: error.sqlState,  // Stato SQL (es. '42000')
            // Non includere 'stack: error.stack' o 'error: error' qui dentro
            // per evitare problemi di serializzazione o I/O asincrono nel logger.
            // Lo stack trace completo sarà comunque loggato dall'handler generico
            // di app.js se necessario, o puoi loggarlo separatamente sulla console se serve.
        }
    );

        let errorMessage = 'Errore nell\'esecuzione della query';
        let statusCode = 500;
        let errorType = 'query_execution_error';

        if (error.code === 'QUERY_TIMEOUT' || error.message.includes('timeout')) {
            errorMessage = 'La query è stata interrotta per timeout.';
            statusCode = 408;
            errorType = 'query_timeout';
        } else if (error.sqlState?.startsWith('42')) { // La classificazione usa error.sqlState, che è sicuro
          errorMessage = 'Errore di sintassi SQL o accesso non valido a tabella/colonna.';
          statusCode = 400;
          errorType = 'db_syntax_error';
        } else if (error.code === 'ER_DBACCESS_DENIED_ERROR' || error.code === 'ER_TABLEACCESS_DENIED_ERROR' || error.code === 'ER_SPECIFIC_ACCESS_DENIED_ERROR') {
            errorMessage = `Accesso negato: permessi insufficienti per questa operazione.`;
            statusCode = 403;
            errorType = 'db_permission_error';
        } else if (error.sqlMessage) {
             if (error.sqlState && error.sqlState.startsWith('23')) {
                 errorMessage = 'Violazione di vincolo di integrità (es. duplicato, chiave esterna)';
                 statusCode = 409;
                 errorType = 'db_constraint_violation';
             } else if (error.sqlState && error.sqlState.startsWith('42')) {
                 errorMessage = 'Errore di sintassi SQL o accesso non valido a tabella/colonna.';
                 statusCode = 400;
                 errorType = 'db_syntax_error';
            } else {
                 errorMessage = 'Errore database durante l\'esecuzione della query.';
                 errorType = 'db_generic_error';
            }
        } else {
             errorType = 'internal_server_error';
        }

        res.status(statusCode).json({
          message: errorMessage,
          error_type: errorType,
          ...(process.env.NODE_ENV !== 'production' && {
              details: { code: error.code, sqlState: error.sqlState, originalMsg: error.sqlMessage || error.message }
          })
        });
    } finally {
      // Rilascio connessione
      if (connection) {
        try {
          await connection.release();
        } catch (releaseError) {
          logger.error(`Errore fatale nel rilascio della connessione DB per utente ${userId}: ${releaseError.message}`, { 
            userId: userId, 
            stack: releaseError.stack 
         });
        }
      }
    }
  });

/**
 * Rotta per ottenere la struttura del database utente.
 * Nota: questa rotta non incrementa il contatore delle query
 */
router.get('/structure', async (req, res) => {
    let connection = null;
    const userId = req.user.id;

    try {
        const db = require('../utils/db');
        connection = await db.createUserDbConnection(userId);

        let tables;
        if (process.env.NODE_ENV === 'production') {
            // FIX: Non usare placeholder ? con SHOW TABLES LIKE
            // Sanitizza userId per prevenire SQL injection
            const safeUserId = String(userId).replace(/[^0-9]/g, '');
            if (!safeUserId) {
                throw new Error('ID utente non valido');
            }
            
            // Usa interpolazione sicura (userId è già sanitizzato a soli numeri)
            // IMPORTANTE: In SQL LIKE, _ è un wildcard! Dobbiamo escaparlo con \_ 
            // per matchare solo le tabelle dell'utente specifico
            const query = `SHOW TABLES LIKE 'user\\_${safeUserId}\\_%'`;
            logger.info(`[Structure] Esecuzione query: ${query}`);
            [tables] = await connection.query(query);
        } else {
            const dbName = `sql_template_user_${userId}`;
            [tables] = await connection.query(
                `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
                [dbName]
            );
        }

        // Estraiamo i nomi delle tabelle in un array pulito
        const tableNames = tables.map(t => Object.values(t)[0]);
        
        logger.info(`[Structure] Trovate ${tableNames.length} tabelle per utente ${userId}`);

        // Per ogni tabella, otteniamo la struttura delle colonne
        const structure = await Promise.all(tableNames.map(async (tableName) => {
            const [columns] = await connection.query(
                `DESCRIBE \`${tableName}\``
            );

            // Rimuovi il prefisso user_{id}_ per la visualizzazione
            const displayTableName = tableName.replace(new RegExp(`^user_${userId}_`), '');
            
            return {
                name: displayTableName,
                columns: columns.map(col => ({
                    name: col.Field,
                    type: col.Type,
                    nullable: col.Null === 'YES',
                    key: col.Key
                }))
            };
        }));

        res.json(structure);

    } catch (error) {
        logger.error(`Errore nel recupero struttura DB per utente ${userId}: ${error.message}`, {
            userId: userId,
            stack: error.stack
        });
        res.status(500).json({
            message: 'Errore nel recupero della struttura del database.',
            error: 'structure_retrieval_failed',
            ...(process.env.NODE_ENV !== 'production' && { details: error.message })
        });
    } finally {
        if (connection) {
            try {
                await connection.release();
            } catch (e) {
                logger.error(`Errore nel rilascio della connessione in /structure per utente ${userId}`, e);
            }
        }
    }
});

/**
 * Rotta per resettare il database dell'utente allo stato iniziale.
 * Chiama la funzione di reset unificata in db.js.
 */
router.post('/reset', async (req, res) => {
    const userId = req.user.id;
    try {
        const db = require('../utils/db');
        
        logger.info(`Richiesta reset DB per utente ${userId}`);
        
        const success = await db.resetUserDatabase(userId);

        if (success) {
            res.json({ message: 'Database resettato con successo.' });
        } else {
            logger.error(`resetUserDatabase ha restituito false per utente ${userId}`);
            res.status(500).json({
                message: 'Reset del database non riuscito.',
                error: 'reset_failed'
            });
        }
    } catch (error) {
        logger.error(`Errore nel reset DB per utente ${userId}: ${error.message}`, {
            userId: userId,
            stack: error.stack
        });
        res.status(500).json({
            message: 'Errore durante il reset del database.',
            error: 'reset_exception',
            ...(process.env.NODE_ENV !== 'production' && { details: error.message })
        });
    }
});

module.exports = router;