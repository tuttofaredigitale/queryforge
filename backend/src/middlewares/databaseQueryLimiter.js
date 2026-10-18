// backend/src/middlewares/databaseQueryLimiter.js
// Course Lab Edition - Limite fisso 50 query/giorno per tutti gli utenti

const db = require('../db/database');
const logger = require('../utils/logger');

// Limite fisso per Course Lab Edition (no distinzione Free/Pro)
const DAILY_QUERY_LIMIT = parseInt(process.env.FREE_QUERY_DAILY_LIMIT) || 50;

/**
 * Middleware per limitare il numero di query SQL giornaliere.
 * Course Lab Edition: tutti gli utenti hanno lo stesso limite.
 */
async function databaseQueryLimiter(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ 
      success: false, 
      message: 'Utente non autenticato' 
    });
  }

  const today = new Date().toISOString().split('T')[0];
  let connection;

  try {
    connection = await db.getAuthConnection();

    // Recupera o crea il record di utilizzo per oggi
    const [usageRows] = await connection.execute(
      'SELECT count FROM query_usage WHERE user_id = ? AND usage_date = ?',
      [req.user.id, today]
    );

    let currentCount = 0;
    if (usageRows.length === 0) {
      // Prima query del giorno: crea il record
      await connection.execute(
        'INSERT INTO query_usage (user_id, usage_date, count) VALUES (?, ?, 0)',
        [req.user.id, today]
      );
    } else {
      currentCount = usageRows[0].count;
    }

    // Controlla se il limite è stato raggiunto
    if (currentCount >= DAILY_QUERY_LIMIT) {
      const resetAt = new Date();
      resetAt.setDate(resetAt.getDate() + 1);
      resetAt.setHours(0, 0, 0, 0);
      
      logger.info(`Limite query raggiunto per utente ${req.user.id}: ${currentCount}/${DAILY_QUERY_LIMIT}`);
      
      return res.status(429).json({
        success: false,
        message: `Hai raggiunto il limite giornaliero di ${DAILY_QUERY_LIMIT} query. Riprova domani!`,
        code: 'QUERY_LIMIT_EXCEEDED',
        usage: {
          limit: DAILY_QUERY_LIMIT,
          used: currentCount,
          remaining: 0
        },
        resetAt: resetAt.toISOString()
      });
    }

    // Imposta i dati di utilizzo nella request
    req.queryUsage = {
      limit: DAILY_QUERY_LIMIT,
      used: currentCount,
      remaining: DAILY_QUERY_LIMIT - currentCount
    };

    // Funzione per incrementare il contatore dopo l'esecuzione della query
    req.incrementQueryCount = async () => {
      let incrementConn;
      try {
        incrementConn = await db.getAuthConnection();
        
        await incrementConn.execute(
          'UPDATE query_usage SET count = count + 1, updated_at = NOW() WHERE user_id = ? AND usage_date = ?',
          [req.user.id, today]
        );
        
        // Aggiorna contatori locali
        req.queryUsage.used += 1;
        req.queryUsage.remaining -= 1;
        
        logger.debug(`Query count aggiornato: ${req.queryUsage.used}/${DAILY_QUERY_LIMIT} per utente ${req.user.id}`);
        
      } catch (err) {
        logger.error(`Errore incremento query count per utente ${req.user.id}: ${err.message}`);
        // Non rilanciare per non bloccare la risposta
      } finally {
        if (incrementConn) {
          try { 
            await incrementConn.release(); 
          } catch (releaseErr) {
            logger.error('Errore rilascio connessione increment:', releaseErr.message);
          }
        }
      }
    };

    next();

  } catch (err) {
    logger.error(`databaseQueryLimiter error: ${err.message}`, {
      userId: req.user.id,
      path: req.path
    });
    return res.status(500).json({
      success: false,
      message: 'Errore interno nel controllo limiti query'
    });
  } finally {
    if (connection) {
      try { 
        await connection.release(); 
      } catch (releaseErr) {
        logger.error('Errore rilascio connessione principale:', releaseErr.message);
      }
    }
  }
}

module.exports = databaseQueryLimiter;