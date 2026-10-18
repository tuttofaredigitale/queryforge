// routes/queryRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { rateLimiter } = require('../middlewares/loggerMiddleware');
const { validateSQLQuery } = require('../middleware/sql-safety-middleware');
const { 
  getUserConnection, 
  queryAccessesProtectedDatabases, 
  PROTECTED_DATABASES 
} = require('../services/userDatabaseManager');
const logger = require('../utils/logger');

// Rate limiters specifici per query operations
const queryExecutionLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 40, // max 40 esecuzioni query per minuto
  keyPrefix: 'query_exec:'
});

const queryAnalysisLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 60, // max 60 analisi per minuto (più permissivo)
  keyPrefix: 'query_analysis:'
});

const structureViewLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 30, // max 30 richieste struttura per minuto
  keyPrefix: 'query_struct:'
});

// Validazione input query
const validateQueryInput = (req, res, next) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string') {
    logger.warn(`Query mancante o non valida da utente ${req.user?.id}`);
    return res.status(400).json({
      success: false,
      message: 'La query è richiesta'
    });
  }
  
  // Sanitizzazione base
  req.body.query = query.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  
  if (req.body.query.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Query SQL non può essere vuota'
    });
  }
  
  if (req.body.query.length > 15000) {
    return res.status(400).json({
      success: false,
      message: 'Query SQL troppo lunga (max 15000 caratteri)'
    });
  }
  
  next();
};

// Middleware di autenticazione
router.use(authMiddleware.authenticate);

// Middleware per proteggere da tentativi di accesso a database non autorizzati
const protectSensitiveDatabases = (req, res, next) => {
  const { query } = req.body;
  const userId = req.user?.id;
  
  if (!query) {
    logger.warn(`Tentativo accesso database senza query da utente ${userId}`);
    return res.status(400).json({ 
      success: false,
      message: 'La query è richiesta' 
    });
  }
  
  // Blocca tentativi di accesso a database protetti
  if (queryAccessesProtectedDatabases(query)) {
    logger.warn(`Tentativo accesso database protetti da utente ${userId}`, {
      queryPreview: query.substring(0, 100) + '...',
      protectedDatabases: PROTECTED_DATABASES
    });
    
    return res.status(403).json({
      success: false,
      status: 'blocked',
      message: `Accesso negato. Questa query tenta di accedere a database protetti (${PROTECTED_DATABASES.join(', ')}).`,
      error: 'access_denied'
    });
  }
  
  next();
};

// Route per analizzare una query senza eseguirla
router.post('/analyze', 
  queryAnalysisLimit,
  validateQueryInput,
  protectSensitiveDatabases, 
  async (req, res) => {
    try {
      const { query } = req.body;
      const userId = req.user.id;
      
      logger.info(`Analisi query da utente ${userId}`, {
        queryLength: query.length,
        queryType: query.trim().split(' ')[0].toUpperCase()
      });
      
      // Utilizziamo il middleware di sicurezza SQL per analizzare la query
      const { analyzeSQLQuery } = require('../middleware/sql-safety-middleware');
      const securityAnalysis = analyzeSQLQuery(query);
      
      logger.info(`Analisi completata per utente ${userId}`, {
        riskLevel: securityAnalysis.riskLevel || 'unknown',
        issuesFound: securityAnalysis.issues?.length || 0
      });
      
      res.json({
        success: true,
        status: 'success',
        analysis: securityAnalysis
      });
    } catch (error) {
      logger.error(`Errore analisi query per utente ${req.user?.id}:`, {
        error: error.message,
        userId: req.user?.id,
        queryLength: req.body.query?.length || 0
      });
      
      res.status(500).json({ 
        success: false,
        message: 'Errore nell\'analisi della query',
        error_type: 'analysis_error'
      });
    }
  });

// Esegui una query SQL con protezione rafforzata
router.post('/execute', 
  queryExecutionLimit,
  validateQueryInput,
  protectSensitiveDatabases, 
  validateSQLQuery, 
  async (req, res) => {
    const userId = req.user.id;
    const { query } = req.body;
    let connection;
    const startTime = Date.now();
    
    try {
      logger.info(`Esecuzione query da utente ${userId}`, {
        queryLength: query.length,
        queryType: query.trim().split(' ')[0].toUpperCase(),
        queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : '')
      });
      
      // Ottieni una connessione al database dell'utente (con privilegi limitati)
      connection = await getUserConnection(userId);
      
      // Esegui la query (i privilegi sono già limitati a livello MySQL)
      const [results, fields] = await connection.execute(query);
      const executionTime = Date.now() - startTime;
      
      logger.info(`Query completata per utente ${userId}`, {
        executionTime: `${executionTime}ms`,
        rowCount: Array.isArray(results) ? results.length : results.affectedRows || 0,
        success: true
      });
      
      // Prepara i risultati per la risposta (mantieni formato originale)
      res.json({ 
        success: true,
        rows: results, 
        fields: fields ? fields.map(f => ({ 
          name: f.name,
          type: f.type
        })) : [],
        executionTime: `${executionTime}ms`
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Errore esecuzione query per utente ${userId}:`, {
        error: error.message,
        executionTime: `${executionTime}ms`,
        queryPreview: query.substring(0, 100) + '...'
      });
      
      res.status(500).json({ 
        success: false,
        message: 'Errore nell\'esecuzione della query',
        error_type: 'execution_error',
        executionTime: `${executionTime}ms`
      });
    } finally {
      // Rilascia sempre la connessione al pool
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          logger.error(`Errore rilascio connessione per utente ${userId}:`, releaseError);
        }
      }
    }
  });

// Route per ottenere la struttura del database dell'utente corrente
router.get('/structure', 
  structureViewLimit,
  async (req, res) => {
    try {
      const userId = req.user.id;
      let connection;
      const startTime = Date.now();
      
      logger.info(`Richiesta struttura database da utente ${userId}`);
      
      try {
        // Ottieni una connessione al database dell'utente
        connection = await getUserConnection(userId);
        
        // Query per ottenere tutte le tabelle nel database dell'utente
        const [tables] = await connection.query('SHOW TABLES');
        
        const structure = [];
        
        // Per ogni tabella, ottieni le colonne
        for (const tableObj of tables) {
          const tableName = Object.values(tableObj)[0];
          
          // Query per ottenere la struttura della tabella
          const [columns] = await connection.query(`
            DESCRIBE \`${tableName}\`
          `);
          
          // Trasforma i risultati nel formato richiesto (mantieni formato originale)
          structure.push({
            name: tableName,
            columns: columns.map(col => ({
              name: col.Field,
              type: col.Type,
              nullable: col.Null === 'YES',
              key: col.Key
            }))
          });
        }
        
        const executionTime = Date.now() - startTime;
        
        logger.info(`Struttura database restituita per utente ${userId}`, {
          tableCount: structure.length,
          totalColumns: structure.reduce((acc, table) => acc + table.columns.length, 0),
          executionTime: `${executionTime}ms`
        });
        
        res.json({
          success: true,
          structure,
          summary: {
            tableCount: structure.length,
            totalColumns: structure.reduce((acc, table) => acc + table.columns.length, 0)
          },
          executionTime: `${executionTime}ms`
        });
      } finally {
        if (connection) {
          connection.release();
        }
      }
    } catch (error) {
      logger.error(`Errore recupero struttura database per utente ${req.user?.id}:`, {
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({ 
        success: false,
        message: 'Errore nel recupero della struttura del database',
        error_type: 'structure_retrieval_error'
      });
    }
  });

// Error handler specifico per query routes
router.use((error, req, res, next) => {
  logger.error('Errore nelle query routes:', {
    error: error.message,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  });

  // Errori specifici query
  if (error.code === 'ER_PARSE_ERROR') {
    return res.status(400).json({
      success: false,
      message: 'Errore di sintassi nella query SQL',
      error_type: 'sql_syntax_error'
    });
  }

  if (error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(404).json({
      success: false,
      message: 'Tabella non trovata nel database',
      error_type: 'table_not_found'
    });
  }

  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(403).json({
      success: false,
      message: 'Accesso negato alla risorsa richiesta',
      error_type: 'access_denied'
    });
  }

  if (error.code === 'ER_CON_COUNT_ERROR') {
    return res.status(503).json({
      success: false,
      message: 'Troppe connessioni al database. Riprova tra poco.',
      error_type: 'connection_limit'
    });
  }

  // Errore generico
  res.status(500).json({
    success: false,
    message: 'Errore interno nelle operazioni query',
    error_type: 'query_error'
  });
});

module.exports = router;