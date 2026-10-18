// controllers/queryController.js

const mysql = require('mysql2/promise');
const { authPool } = require('../utils/db');
const logger = require('../utils/logger');

// =====================================================
// CONSTANTS & CONFIGURATION
// =====================================================
const CONFIG = {
  DATABASE: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT) || 3307,
    USER: process.env.DB_USER || 'app_user',
    PASSWORD: process.env.DB_PASSWORD || 'app_password'
  },
  CONNECTION: {
    LIMIT: parseInt(process.env.QUERY_CONNECTION_LIMIT) || 3,
    QUEUE_LIMIT: parseInt(process.env.QUERY_QUEUE_LIMIT) || 10,
    TIMEOUT: parseInt(process.env.QUERY_TIMEOUT) || 30000,
    ACQUIRE_TIMEOUT: parseInt(process.env.QUERY_ACQUIRE_TIMEOUT) || 60000
  },
  QUERY: {
    MAX_LENGTH: parseInt(process.env.MAX_QUERY_LENGTH) || 50000,
    MAX_RESULTS: parseInt(process.env.MAX_QUERY_RESULTS) || 1000,
    TIMEOUT: parseInt(process.env.QUERY_EXECUTION_TIMEOUT) || 30000,
    HISTORY_LIMIT: parseInt(process.env.QUERY_HISTORY_LIMIT) || 100
  },
  SECURITY: {
    DISALLOWED_COMMANDS: [
      'RENAME',
      'DROP DATABASE', 'CREATE DATABASE', 'ALTER USER', 'GRANT', 'REVOKE',
      'USE', 'SET PASSWORD', 'CREATE USER', 'DELETE FROM mysql',
      'UPDATE mysql', 'FLUSH PRIVILEGES', 'SHUTDOWN', 'KILL'
    ],
    DANGEROUS_PATTERNS: [
      /\bRENAME\s+TABLE\b/i,               
      /;\s*(DROP|DELETE|UPDATE|INSERT)\s+/i,  
      /LOAD_FILE\s*\(/i,                      
      /INTO\s+OUTFILE/i,                      
      /@@\w+/,                                
      /BENCHMARK\s*\(/i,                      
      /SLEEP\s*\(/i,
      /\b(PREPARE|EXECUTE|DEALLOCATE\s+PREPARE|HANDLER|DELIMITER)\b/i,
      /@\w+\s*:=/i,
      /\bFROM\s+(information_schema|mysql|performance_schema|sys)\./i,
      /\bJOIN\s+(information_schema|mysql|performance_schema|sys)\./i,
      /\bSHOW\s+(DATABASES|SCHEMAS)\b/i,
      /\bSELECT\s+.*\bschema_name\b\s+FROM\s+information_schema\.schemata/i,
      /\bSELECT\s+.*\btable_name\b\s+FROM\s+information_schema\.tables/i,
      /\bSELECT\s+.*\bcolumn_name\b\s+FROM\s+information_schema\.columns/i,
      /(\/\*[\s\S]*?\*\/|--\s|#)/,
    ]
  },
  SAVED_QUERIES: {
    MAX_NAME_LENGTH: 100,
    MAX_PER_USER: parseInt(process.env.MAX_SAVED_QUERIES_PER_USER) || 50
  }
};

// =====================================================
// CONNECTION POOL MANAGEMENT
// =====================================================

// Cache for user database connection pools
const userDbPools = new Map();

/**
 * Creates or retrieves connection pool for user database
 */
const getUserDbPool = (userDbName) => {
  if (!userDbName || typeof userDbName !== 'string') {
    throw new Error('Invalid database name provided');
  }
  
  // Return existing pool if available
  if (userDbPools.has(userDbName)) {
    const poolInfo = userDbPools.get(userDbName);
    
    // Check if pool is still valid (not older than 30 minutes)
    if (Date.now() - poolInfo.created < 1800000) {
      return poolInfo.pool;
    } else {
      // Close old pool and remove from cache
      poolInfo.pool.end().catch(err => 
        logger.warn(`Error closing old query pool: ${err.message}`)
      );
      userDbPools.delete(userDbName);
    }
  }
  
  // Create new pool with query-optimized settings
  const pool = mysql.createPool({
    host: CONFIG.DATABASE.HOST,
    port: CONFIG.DATABASE.PORT,
    user: CONFIG.DATABASE.USER,
    password: CONFIG.DATABASE.PASSWORD,
    database: userDbName,
    waitForConnections: true,
    connectionLimit: CONFIG.CONNECTION.LIMIT,
    queueLimit: CONFIG.CONNECTION.QUEUE_LIMIT,
    connectTimeout: CONFIG.CONNECTION.TIMEOUT,     
    acquireTimeout: CONFIG.CONNECTION.ACQUIRE_TIMEOUT,
    multipleStatements: false,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    enableKeepAlive: true,           
    keepAliveInitialDelay: 0         
  });
  
  // Cache the pool
  userDbPools.set(userDbName, {
    pool,
    created: Date.now()
  });
  
  return pool;
};

/**
 * Cleanup function to close all cached pools
 */
const cleanupQueryPools = async () => {
  const closePromises = [];
  
  for (const [dbName, poolInfo] of userDbPools.entries()) {
    closePromises.push(
      poolInfo.pool.end().catch(err => 
        logger.warn(`Error closing query pool for ${dbName}: ${err.message}`)
      )
    );
  }
  
  await Promise.allSettled(closePromises);
  userDbPools.clear();
  
  logger.info('All query connection pools closed');
};

// Graceful shutdown handler
process.on('SIGTERM', cleanupQueryPools);
process.on('SIGINT', cleanupQueryPools);

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates query input with comprehensive security checks
 */
const validateQuery = (query) => {
  if (!query || typeof query !== 'string') {
    const error = new Error('Query is required and must be a string');
    error.statusCode = 400;
    throw error;
  }
  
  const trimmedQuery = query.trim();
  
  if (trimmedQuery.length === 0) {
    const error = new Error('Empty query not allowed');
    error.statusCode = 400;
    throw error;
  }
  
  if (trimmedQuery.length > CONFIG.QUERY.MAX_LENGTH) {
    const error = new Error(`Query too long. Maximum ${CONFIG.QUERY.MAX_LENGTH} characters allowed`);
    error.statusCode = 400;
    throw error;
  }
  
  return trimmedQuery;
};

/**
 * Analyzes query type and characteristics
 */
const analyzeQuery = (query) => {
  const upperQuery = query.toUpperCase().trim();
  const firstWord = upperQuery.split(/\s+/)[0];
  
  const isSelect = upperQuery.startsWith('SELECT') || upperQuery.startsWith('SHOW') || upperQuery.startsWith('DESCRIBE');
  const isModifying = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'].some(cmd => upperQuery.startsWith(cmd));
  const isTransaction = ['START', 'BEGIN', 'COMMIT', 'ROLLBACK'].some(cmd => upperQuery.startsWith(cmd));
  
  return {
    type: firstWord,
    isSelect,
    isModifying,
    isTransaction,
    estimatedComplexity: query.length > 1000 ? 'high' : query.length > 200 ? 'medium' : 'low'
  };
};

/**
 * Executes query with timeout and result limiting
 */
const executeQuerySafely = async (pool, query, userId) => {
  const startTime = Date.now();
  const analysis = analyzeQuery(query) || {};
  const baseTimeoutMs = Number(CONFIG?.QUERY?.TIMEOUT) || 30000;
  const maxResults = Number(CONFIG?.QUERY?.MAX_RESULTS) || 1000;

  // Raddoppia il timeout se la query è stimata "high"
  const timeoutMs = analysis.estimatedComplexity === 'high'
    ? baseTimeoutMs * 2
    : baseTimeoutMs;

  logger.debug('Executing user query', {
    userId,
    queryType: analysis.type,
    complexity: analysis.estimatedComplexity,
    timeout: `${timeoutMs}ms`,
    operation: 'query_execution_start'
  });

  const connection = await pool.getConnection();
  try {
    // Imposta limiti di sessione lato server (tutti in millisecondi dove richiesto)
    await connection.query(
      `SET SESSION 
         max_execution_time = ?, 
         sql_select_limit   = ?, 
         sql_safe_updates   = 1`,
      [timeoutMs, maxResults]
    );

    // Esecuzione con timeout nativo del driver (ms)
    const [rows, fields] = await connection.query({ sql: query, timeout: timeoutMs });

    const executionTime = Date.now() - startTime;

    // Limita i risultati solo se è un resultset (SELECT)
    let results = rows;
    let wasLimited = false;
    if (Array.isArray(rows) && rows.length > maxResults) {
      results = rows.slice(0, maxResults);
      wasLimited = true;

      logger.info('Query results limited', {
        userId,
        originalCount: rows.length,
        limitedTo: maxResults,
        operation: 'query_result_limit'
      });
    }

    logger.info('Query executed successfully', {
      userId,
      queryType: analysis.type,
      executionTime: `${executionTime}ms`,
      resultCount: Array.isArray(results) ? results.length : 1,
      wasLimited,
      operation: 'query_execution_success'
    });

    return {
      results,
      fields,
      executionTime,
      wasLimited,
      analysis
    };
  } catch (error) {
  const executionTime = Date.now() - startTime;
    logger.error('Query execution failed', {
      userId,
      queryType: analysis.type,
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      executionTime: `${executionTime}ms`,
      operation: 'query_execution_error'
    });

    throw error; // qui NON si risponde al client: ci pensa executeQuery
  } finally {
    connection.release();
  }
};


/**
 * Saves query to history with metadata
 */
const saveToHistory = async (userId, query, success, error = null, metadata = {}) => {
  try {
    await authPool.execute(
      `INSERT INTO query_history 
       (user_id, query, executed_at, error, metadata) 
       VALUES (?, ?, NOW(), ?, ?)`,
      [
        userId, 
        query.length > 10000 ? query.substring(0, 10000) + '...' : query,
        error,
        JSON.stringify({
          success,
          ...metadata,
          queryLength: query.length,
          timestamp: new Date().toISOString()
        })
      ]
    );
  } catch (historyError) {
    logger.warn('Failed to save query to history', {
      userId,
      error: historyError.message,
      operation: 'query_history_save_error'
    });
  }
};

/**
 * Formats query results for frontend response
 */
const formatQueryResults = (results, fields, executionTime, wasLimited, analysis) => {
  const columns = fields ? fields.map(field => ({
    name: field.name,
    type: field.type,
    length: field.length,
    nullable: !field.notNull
  })) : [];
  
  const response = {
    success: true,
    data: {
      columns,
      rows: results,
      rowCount: Array.isArray(results) ? results.length : (results.affectedRows || 0),
      executionTime: `${executionTime}ms`
    },
    metadata: {
      queryType: String(analysis.type || 'UNKNOWN').toLowerCase(),
      isSelect: !!analysis.isSelect,
      isModifying: !!analysis.isModifying,
      complexity: analysis.estimatedComplexity || 'low',
      wasLimited,
      ...(wasLimited && { limitedTo: CONFIG.QUERY.MAX_RESULTS })
    },
    message: 'Query executed successfully'
  };
  
  return response;
};

/**
 * Validates saved query input
 */
const validateSavedQuery = async (userId, name, query) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    const error = new Error('Query name is required');
    error.statusCode = 400;
    throw error;
  }
  
  if (name.length > CONFIG.SAVED_QUERIES.MAX_NAME_LENGTH) {
    const error = new Error(`Query name too long. Maximum ${CONFIG.SAVED_QUERIES.MAX_NAME_LENGTH} characters allowed`);
    error.statusCode = 400;
    throw error;
  }
  
  // Check if name already exists for this user
  const [existing] = await authPool.execute(
    'SELECT id FROM saved_queries WHERE user_id = ? AND name = ?',
    [userId, name.trim()]
  );
  
  if (existing.length > 0) {
    const error = new Error('A query with this name already exists');
    error.statusCode = 409;
    throw error;
  }
  
  // Check user's saved query limit
  const [countResult] = await authPool.execute(
    'SELECT COUNT(*) as count FROM saved_queries WHERE user_id = ?',
    [userId]
  );
  
  if (countResult[0].count >= CONFIG.SAVED_QUERIES.MAX_PER_USER) {
    const error = new Error(`Maximum saved queries limit reached (${CONFIG.SAVED_QUERIES.MAX_PER_USER})`);
    error.statusCode = 409;
    throw error;
  }
  
  // Validate the query itself
  validateQuery(query);
  
  return { name: name.trim(), query };
};

// =====================================================
// SECURITY HELPERS (unificati)
// =====================================================
const TOPLEVEL_CTRL = /^\s*(IF|CASE|WHILE|REPEAT|LOOP|LEAVE|ITERATE|OPEN|FETCH|CLOSE)\b/i;
const FORBIDDEN_TOKENS = /\b(PREPARE|EXECUTE|DEALLOCATE\s+PREPARE|HANDLER|DELIMITER|LOAD\s+DATA|INTO\s+OUTFILE|INTO\s+DUMPFILE|TRIGGER|PROCEDURE|FUNCTION|EVENT|GRANT|REVOKE|CREATE\s+USER|ALTER\s+USER|SHUTDOWN|KILL)\b/i;

const SQL_COMMENTS = /(\/\*[\s\S]*?\*\/|--.*?$|#.*?$)/gm;
const SQL_STRINGS  = /('([^'\\]|\\.)*'|"([^"\\]|\\.)*")/g;

function stripComments(sql) {
  return sql.replace(SQL_COMMENTS, ' ');
}
function stripNoise(sql) {
  return sql.replace(SQL_COMMENTS, ' ').replace(SQL_STRINGS, ' ');
}

// Cross-user robusto: blocca QUALSIASI token user_<id>_* anche se la query è malformata
function denyCrossUserReference(sql, userId) {
  const q = stripNoise(sql).toLowerCase();
  const re = /\buser_(\d+)_([a-z0-9_]+)\b/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    if (Number(m[1]) !== Number(userId)) {
      const err = new Error(`Accesso a risorsa di un altro utente: user_${m[1]}_${m[2]}`);
      err.statusCode = 403; throw err;
    }
  }
}

// Scope via keyword (FROM/JOIN/UPDATE/INTO/DELETE FROM)
function enforceUserScopeOrThrow(sql, userId) {
  const q = stripComments(sql).toLowerCase();
  const targets = [];
  const rx = /\b(?:from|join|update|into|delete\s+from)\s+`?([a-z0-9_]+)`?/gi;
  let m; while ((m = rx.exec(q)) !== null) targets.push(m[1]);

  const allow = new RegExp(`^user_${userId}_[a-z0-9_]+$`);
  for (const t of targets) {
    if (!allow.test(t)) {
      const err = new Error(`Accesso alla tabella "${t}" non consentito`);
      err.statusCode = 403; throw err;
    }
  }
}

function performSecurityChecks(sql, userId) {
  // Cross-user sempre, anche con query malformate
  denyCrossUserReference(sql, userId);

  // Normalizzazione per controlli sintattici
  const s = stripNoise(sql);

  // Comandi esplicitamente vietati 
  for (const cmd of CONFIG.SECURITY.DISALLOWED_COMMANDS) {
    const re = new RegExp(`\\b${cmd.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(s)) {
      const err = new Error(`Operation not permitted: ${cmd} is not allowed`);
      err.statusCode = 403; throw err;
    }
  }

  // Pattern pericolosi 
  for (const pattern of CONFIG.SECURITY.DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) { // qui usiamo la query “grezza” per cogliere anche casi complessi
      const err = new Error('Query contains potentially dangerous patterns');
      err.statusCode = 403; throw err;
    }
  }

  // Costrutti di controllo top-level (IF THEN etc.)
  if (TOPLEVEL_CTRL.test(s)) {
    const err = new Error('Costrutti di controllo top-level non consentiti');
    err.statusCode = 403; throw err;
  }

  // Token amministrativi/di esecuzione
  if (FORBIDDEN_TOKENS.test(s)) {
    const err = new Error('Comando non consentito in questo ambiente');
    err.statusCode = 403; throw err;
  }

  // Multi-statement
  const semiCount = (s.match(/;/g) || []).length;
  if (semiCount > 1 || (semiCount === 1 && !/;\s*$/.test(s))) {
    const err = new Error('Sono consentite una sola istruzione per volta');
    err.statusCode = 403; throw err;
  }

  // Scope per tabelle
  enforceUserScopeOrThrow(sql, userId);

  return true;
}

exports.executeQuery = async (req, res) => {
  const startTime = Date.now();
  let queryData = null;
  
  try {
    const { query } = req.body;
    const userId = req.user.id;
    const userDbName = req.userDbName;
    
    // Validate query input
    const validatedQuery = validateQuery(query);
    
    // Perform security checks
    performSecurityChecks(validatedQuery, userId);
    
    logger.info('Query execution request started', {
      userId,
      userDbName,
      queryLength: validatedQuery.length,
      userIP: req.ip,
      operation: 'query_request'
    });
    
    // Get user database pool
    const userDbPool = getUserDbPool(userDbName);
    
    // Execute query safely
    queryData = await executeQuerySafely(userDbPool, validatedQuery, userId);
    
    const totalTime = Date.now() - startTime;
    
    // Save successful execution to history
    await saveToHistory(userId, validatedQuery, true, null, {
      executionTime: queryData.executionTime,
      resultCount: Array.isArray(queryData.results) ? queryData.results.length : 1,
      queryType: queryData.analysis.type,
      wasLimited: queryData.wasLimited
    });
    
    // Format and return response
    const response = formatQueryResults(
      queryData.results,
      queryData.fields,
      queryData.executionTime,
      queryData.wasLimited,
      queryData.analysis
    );
    
    logger.info('Query execution completed successfully', {
      userId,
      totalTime: `${totalTime}ms`,
      executionTime: `${queryData.executionTime}ms`,
      resultCount: response.data.rowCount,
      operation: 'query_complete'
    });
    
    res.json(response);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // Save failed execution to history
    if (req.body.query && req.user) {
      await saveToHistory(req.user.id, req.body.query, false, error.message, {
        errorCode: error.code,
        sqlState: error.sqlState,
        totalTime
      });
    }
    
    logger.error('Query execution failed', {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      totalTime: `${totalTime}ms`,
      operation: 'query_error'
    });
    
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: status < 500 ? error.message : 'Error executing query',
      ...(status < 500 ? { error: error.message } : {}),
      executionTime: `${totalTime}ms`
    });
  }
};

/**
 * Saves a query with validation and duplicate checking
 */
exports.saveQuery = async (req, res) => {
  try {
    const { name, query } = req.body;
    const userId = req.user.id;
    
    // Validate input
    const validated = await validateSavedQuery(userId, name, query);
    
    logger.info('Saving query for user', {
      userId,
      queryName: validated.name,
      queryLength: validated.query.length,
      operation: 'save_query'
    });
    
    // Save query
    const [result] = await authPool.execute(
      `INSERT INTO saved_queries 
       (user_id, name, query, created_at, metadata) 
       VALUES (?, ?, ?, NOW(), ?)`,
      [
        userId, 
        validated.name, 
        validated.query,
        JSON.stringify({
          queryLength: validated.query.length,
          createdFrom: req.ip,
          version: '1.0'
        })
      ]
    );
    
    logger.info('Query saved successfully', {
      userId,
      queryId: result.insertId,
      queryName: validated.name,
      operation: 'save_query_success'
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name: validated.name,
        query: validated.query,
        created_at: new Date().toISOString()
      },
      message: 'Query saved successfully'
    });
    
  } catch (error) {
    logger.error('Error saving query', {
      userId: req.user?.id,
      error: error.message,
      operation: 'save_query_error'
    });
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error saving query'
    });
  }
};

/**
 * Retrieves user's saved queries with pagination
 */
exports.getSavedQueries = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    
    logger.debug('Retrieving saved queries', {
      userId,
      page,
      limit,
      operation: 'get_saved_queries'
    });
    
    // Get saved queries with pagination
    const [queries] = await authPool.execute(
      `SELECT id, name, query, created_at, metadata 
       FROM saved_queries 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    );
    
    // Get total count
    const [countResult] = await authPool.execute(
      'SELECT COUNT(*) as total FROM saved_queries WHERE user_id = ?',
      [userId]
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    const formattedQueries = queries.map(q => ({
      id: q.id,
      name: q.name,
      query: q.query,
      created_at: q.created_at,
      metadata: q.metadata ? JSON.parse(q.metadata) : {}
    }));
    
    res.json({
      success: true,
      data: formattedQueries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    logger.error('Error retrieving saved queries', {
      userId: req.user?.id,
      error: error.message,
      operation: 'get_saved_queries_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving saved queries'
    });
  }
};

/**
 * Retrieves user's query history with filtering
 */
exports.getQueryHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), CONFIG.QUERY.HISTORY_LIMIT);
    const offset = (page - 1) * limit;
    const successOnly = req.query.success === 'true';
    const errorOnly = req.query.error === 'true';
    
    logger.debug('Retrieving query history', {
      userId,
      page,
      limit,
      successOnly,
      errorOnly,
      operation: 'get_query_history'
    });
    
    // Build WHERE clause based on filters
    let whereClause = 'WHERE user_id = ?';
    const params = [userId];
    
    if (successOnly) {
      whereClause += ' AND error IS NULL';
    } else if (errorOnly) {
      whereClause += ' AND error IS NOT NULL';
    }
    
    // Get query history
    const [queries] = await authPool.execute(
      `SELECT id, query, executed_at, error, metadata 
       FROM query_history 
       ${whereClause} 
       ORDER BY executed_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    
    // Get total count
    const [countResult] = await authPool.execute(
      `SELECT COUNT(*) as total FROM query_history ${whereClause}`,
      params
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    const formattedQueries = queries.map(q => ({
      id: q.id,
      query: q.query,
      timestamp: q.executed_at,
      success: !q.error,
      error: q.error,
      metadata: q.metadata ? JSON.parse(q.metadata) : {}
    }));
    
    res.json({
      success: true,
      data: formattedQueries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        successOnly,
        errorOnly
      }
    });
    
  } catch (error) {
    logger.error('Error retrieving query history', {
      userId: req.user?.id,
      error: error.message,
      operation: 'get_query_history_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving query history'
    });
  }
};

/**
 * Deletes a saved query
 */
exports.deleteSavedQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query ID'
      });
    }
    
    logger.info('Deleting saved query', {
      userId,
      queryId: id,
      operation: 'delete_saved_query'
    });
    
    const [result] = await authPool.execute(
      'DELETE FROM saved_queries WHERE id = ? AND user_id = ?',
      [parseInt(id), userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Query not found or access denied'
      });
    }
    
    logger.info('Saved query deleted successfully', {
      userId,
      queryId: id,
      operation: 'delete_saved_query_success'
    });
    
    res.json({
      success: true,
      message: 'Query deleted successfully'
    });
    
  } catch (error) {
    logger.error('Error deleting saved query', {
      userId: req.user?.id,
      queryId: req.params.id,
      error: error.message,
      operation: 'delete_saved_query_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error deleting query'
    });
  }
};

// Export cleanup function
exports.cleanupQueryPools = cleanupQueryPools;