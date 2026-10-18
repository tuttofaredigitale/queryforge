// routes/queryHistory.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { rateLimiter } = require('../middlewares/loggerMiddleware');
const logger = require('../utils/logger');
const database = require('../db/database');

// Rate limiters specifici per cronologia query
const historyViewLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 30, // max 30 visualizzazioni cronologia per minuto
  keyPrefix: 'history_view:'
});

const historyModifyLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 30, // max 30 modifiche cronologia per minuto
  keyPrefix: 'history_modify:'
});

const historyClearLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 5, // max 5 cancellazioni complete per 15 min
  keyPrefix: 'history_clear:'
});

// Validazione parametri paginazione
const validatePaginationParams = (req, res, next) => {
  let limit = parseInt(req.query.limit) || 20;
  let offset = parseInt(req.query.offset) || 0;
  
  // Sanitizzazione parametri
  limit = Math.max(1, Math.min(limit, 100)); // Tra 1 e 100
  offset = Math.max(0, offset); // Minimo 0
  
  req.query.limit = limit;
  req.query.offset = offset;
  
  next();
};

// Validazione ID query
const validateQueryId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
    logger.warn(`ID query non valido: ${id} da utente ${req.user?.id}`);
    return res.status(400).json({
      success: false,
      message: 'ID query non valido'
    });
  }
  
  req.params.id = parseInt(id);
  next();
};

// Applica l'autenticazione a tutte le route
router.use(authenticate);

// --- Endpoint ordinati alfabeticamente ---

// Elimina tutta la cronologia dell'utente
router.delete('/', 
  historyClearLimit,
  async (req, res) => {
    let connection;
    try {
      const userId = req.user.id;
      
      logger.warn(`ELIMINAZIONE COMPLETA cronologia per utente ${userId}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100)
      });
      
      // Otteniamo una connessione dal metodo getAuthConnection
      connection = await database.getAuthConnection();
      const [result] = await connection.execute(
        'DELETE FROM query_history WHERE user_id = ?',
        [userId]
      );
      
      logger.info(`Cronologia eliminata per utente ${userId}`, {
        deletedCount: result.affectedRows
      });
      
      res.json({ 
        success: true,
        message: 'Cronologia cancellata',
        count: result.affectedRows
      });
    } catch (err) {
      logger.error(`Errore cancellazione cronologia per utente ${req.user?.id}:`, {
        error: err.message,
        userId: req.user?.id
      });
      res.status(500).json({ 
        success: false,
        message: 'Errore nel cancellare la cronologia', 
        error: err.message 
      });
    } finally {
      if (connection) connection.release();
    }
  });

// Elimina una query dalla cronologia
router.delete('/:id', 
  historyModifyLimit,
  validateQueryId,
  async (req, res) => {
    let connection;
    try {
      const queryId = req.params.id;
      const userId = req.user.id;
      
      logger.info(`Eliminazione query ${queryId} da cronologia utente ${userId}`);
      
      // Otteniamo una connessione dal metodo getAuthConnection
      connection = await database.getAuthConnection();
      const [result] = await connection.execute(
        'DELETE FROM query_history WHERE id = ? AND user_id = ?',
        [queryId, userId]
      );
      
      if (result.affectedRows === 0) {
        logger.warn(`Query ${queryId} non trovata o non autorizzata per utente ${userId}`);
        return res.status(404).json({ 
          success: false,
          message: 'Query non trovata o non autorizzata' 
        });
      }
      
      logger.info(`Query ${queryId} eliminata dalla cronologia utente ${userId}`);
      
      res.json({ 
        success: true,
        message: 'Query eliminata dalla cronologia' 
      });
    } catch (err) {
      logger.error(`Errore eliminazione query ${req.params.id} per utente ${req.user?.id}:`, {
        error: err.message,
        queryId: req.params.id,
        userId: req.user?.id
      });
      res.status(500).json({ 
        success: false,
        message: 'Errore nell\'eliminare la query', 
        error: err.message 
      });
    } finally {
      if (connection) connection.release();
    }
  });

// Ottieni la cronologia query dell'utente
router.get('/', 
  historyViewLimit,
  validatePaginationParams,
  async (req, res) => {
    let connection;
    try {
      const limit = req.query.limit;
      const offset = req.query.offset;
      const userId = req.user.id;
      
      logger.info(`Richiesta cronologia query da utente ${userId}`, {
        limit,
        offset,
        page: Math.floor(offset / limit) + 1
      });
      
      // Otteniamo una connessione dal metodo getAuthConnection
      connection = await database.getAuthConnection();
      const [rows] = await connection.execute(
        `SELECT id, user_id, query, executed_at, error FROM query_history WHERE user_id = ? ORDER BY executed_at DESC LIMIT ${limit} OFFSET ${offset}`,
        [userId]
      );
      
      logger.info(`Cronologia restituita per utente ${userId}`, {
        resultCount: rows.length,
        limit,
        offset
      });
      
      res.json(rows);
    } catch (err) {
      logger.error(`Errore recupero cronologia query per utente ${req.user?.id}:`, {
        error: err.message,
        userId: req.user?.id,
        limit: req.query.limit,
        offset: req.query.offset
      });
      res.status(500).json({ 
        success: false,
        message: 'Errore nel recuperare la cronologia', 
        error: err.message 
      });
    } finally {
      if (connection) connection.release();
    }
  });

// Salva una nuova query nella cronologia
router.post('/', 
  historyModifyLimit,
  async (req, res) => {
    let connection;
    try {
      const { query, error = null } = req.body;
      const userId = req.user.id;
      
      if (!query) {
        logger.warn(`Tentativo salvataggio query vuota da utente ${userId}`);
        return res.status(400).json({ 
          success: false,
          message: 'La query è obbligatoria' 
        });
      }
      
      // Sanitizzazione query (mantieni la logica originale)
      const sanitizedQuery = typeof query === 'string' ? query.trim() : String(query).trim();
      
      if (sanitizedQuery.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La query non può essere vuota'
        });
      }
      
      if (sanitizedQuery.length > 10000) {
        return res.status(400).json({
          success: false,
          message: 'Query troppo lunga (max 10000 caratteri)'
        });
      }
      
      logger.info(`Salvataggio query nella cronologia per utente ${userId}`, {
        queryLength: sanitizedQuery.length,
        hasError: !!error
      });
      
      // Otteniamo una connessione dal metodo getAuthConnection
      connection = await database.getAuthConnection();
      const [result] = await connection.execute(
        'INSERT INTO query_history (user_id, query, executed_at, error) VALUES (?, ?, NOW(), ?)',
        [userId, sanitizedQuery, error]
      );
      
      logger.info(`Query salvata in cronologia per utente ${userId}`, {
        historyId: result.insertId
      });
      
      res.status(201).json({ 
        success: true,
        message: 'Query salvata nella cronologia',
        id: result.insertId
      });
    } catch (err) {
      logger.error(`Errore salvataggio query cronologia per utente ${req.user?.id}:`, {
        error: err.message,
        userId: req.user?.id,
        queryLength: req.body.query?.length || 0
      });
      res.status(500).json({ 
        success: false,
        message: 'Errore nel salvare la query', 
        error: err.message 
      });
    } finally {
      if (connection) connection.release();
    }
  });

// Error handler specifico per query history routes
router.use((error, req, res, next) => {
  logger.error('Errore nelle query history routes:', {
    error: error.message,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  });

  // Errori specifici cronologia query
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Query già presente nella cronologia',
      error_type: 'duplicate_query'
    });
  }

  if (error.code === 'ER_DATA_TOO_LONG') {
    return res.status(400).json({
      success: false,
      message: 'Query troppo lunga per essere salvata',
      error_type: 'query_too_long'
    });
  }

  // Errore generico
  res.status(500).json({
    success: false,
    message: 'Errore interno nella gestione della cronologia query',
    error_type: 'history_error'
  });
});

module.exports = router;