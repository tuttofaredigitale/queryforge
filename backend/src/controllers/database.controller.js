// controllers/database.controller.js

const logger = require('../utils/logger');
const sqlMonitor = require('../utils/sqlMonitor');

// =====================================================
// CONSTANTS & CONFIGURATION
// =====================================================
const CONFIG = {
  QUERY: {
    MAX_LENGTH: parseInt(process.env.MAX_QUERY_LENGTH) || 10000,
    TIMEOUT_MS: parseInt(process.env.QUERY_TIMEOUT_MS) || 30000,
    MAX_RESULT_ROWS: parseInt(process.env.MAX_RESULT_ROWS) || 1000
  },
  SQL: {
    SELECT_TYPES: ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'],
    MODIFY_TYPES: ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'],
    DANGEROUS_KEYWORDS: [
      'DROP TABLE', 'DROP DATABASE', 'TRUNCATE', 'DELETE FROM users',
      'UPDATE users SET', 'ALTER TABLE users', 'CREATE USER', 'GRANT'
    ]
  },
  SIMULATION: {
    DEFAULT_ROWS: [
      { id: 1, name: 'Sample Record 1', created_at: new Date().toISOString() },
      { id: 2, name: 'Sample Record 2', created_at: new Date().toISOString() }
    ],
    DATABASES: ['playground_db', 'sample_db', 'test_db', 'sql_auth'],
    TABLES: ['users', 'orders', 'products', 'categories']
  }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates query input and structure
 */
const validateQuery = (query) => {
  if (!query || typeof query !== 'string') {
    const error = new Error('Query not specified or invalid format');
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
 * Determines query type and characteristics
 */
const analyzeQuery = (query) => {
  const upperQuery = query.toUpperCase().trim();
  const firstWord = upperQuery.split(/\s+/)[0];
  
  const isSelect = CONFIG.SQL.SELECT_TYPES.some(type => upperQuery.startsWith(type));
  const isModify = CONFIG.SQL.MODIFY_TYPES.some(type => upperQuery.startsWith(type));
  const isDangerous = CONFIG.SQL.DANGEROUS_KEYWORDS.some(keyword => upperQuery.includes(keyword));
  
  return {
    type: firstWord,
    isSelect,
    isModify,
    isDangerous,
    firstWord,
    length: query.length
  };
};

/**
 * Performs security checks on query
 */
const performSecurityChecks = (query, req) => {
  const analysis = analyzeQuery(query);
  const userId = req.user?.id || 'anonymous';
  const userIP = req.ip;
  const sessionId = req.sessionID || 'unknown';
  
  // Monitor query with sqlMonitor
  const monitorResult = sqlMonitor.monitorQuery(query, userId, userIP, sessionId);
  
  // Check for suspicious patterns
  const isSuspicious = (monitorResult && monitorResult.suspicious) ||
                      (req.logSqlOperation && req.logSqlOperation(query, 0)) ||
                      analysis.isDangerous;
  
  if (isSuspicious) {
    // Log security event
    if (req.logSecurityEvent) {
      req.logSecurityEvent('SUSPICIOUS_QUERY', {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        reason: 'Potential SQL injection or dangerous operation detected',
        analysis,
        monitorResult
      });
    }
    
    logger.warn('Suspicious query blocked', {
      userId,
      userIP,
      queryType: analysis.type,
      queryLength: analysis.length,
      isDangerous: analysis.isDangerous,
      monitorSuspicious: monitorResult?.suspicious,
      operation: 'security_check'
    });
    
    const error = new Error('Invalid query. Potential SQL injection or dangerous operation detected');
    error.statusCode = 403;
    throw error;
  }
  
  return { analysis, monitorResult };
};

/**
 * Simulates query execution with realistic results
 */
const simulateQueryExecution = async (query, analysis) => {
  // Simulate execution delay based on query complexity
  const simulatedDelay = Math.min(50 + (query.length / 100), 500);
  await new Promise(resolve => setTimeout(resolve, simulatedDelay));
  
  let result = {
    rows: [],
    rowCount: 0,
    affectedRows: 0
  };
  
  if (analysis.isSelect) {
    // Simulate SELECT results
    const rowCount = Math.floor(Math.random() * 5) + 1; // 1-5 rows
    result.rows = Array.from({ length: Math.min(rowCount, CONFIG.QUERY.MAX_RESULT_ROWS) }, (_, i) => ({
      id: i + 1,
      name: `Sample Record ${i + 1}`,
      value: Math.floor(Math.random() * 1000),
      created_at: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(), // Random date within 30 days
      status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)]
    }));
    result.rowCount = result.rows.length;
  } else if (analysis.isModify) {
    // Simulate INSERT/UPDATE/DELETE results
    result.affectedRows = Math.floor(Math.random() * 3) + 1; // 1-3 affected rows
    result.rowCount = result.affectedRows;
  } else {
    // Other query types
    result.rows = [{ message: `${analysis.type} command executed successfully` }];
    result.rowCount = 1;
  }
  
  return result;
};

/**
 * Logs query execution with appropriate detail level
 */
const logQueryExecution = (query, result, executionTime, req, success = true) => {
  const userId = req.user?.id || 'anonymous';
  const queryPreview = query.length > 100 ? query.substring(0, 100) + '...' : query;
  
  const logData = {
    userId,
    userIP: req.ip,
    queryPreview,
    queryLength: query.length,
    executionTime: `${executionTime}ms`,
    rowCount: result?.rowCount || 0,
    affectedRows: result?.affectedRows || 0,
    success,
    operation: 'query_execution'
  };
  
  if (success) {
    logger.info('SQL query executed successfully', logData);
    
    // Use middleware logging if available
    if (req.logSqlOperation) {
      req.logSqlOperation(query, result?.rowCount || 0);
    }
  } else {
    logger.error('SQL query execution failed', logData);
  }
};

/**
 * Handles query execution errors with appropriate responses
 */
const handleQueryError = (error, query, executionTime, req) => {
  const userId = req.user?.id || 'anonymous';
  const errorContext = {
    userId,
    userIP: req.ip,
    queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    executionTime: `${executionTime}ms`,
    error: error.message,
    operation: 'query_error'
  };
  
  logger.error('SQL query execution error', errorContext);
  
  // Log security event for suspicious errors
  const suspiciousErrors = ['syntax error', 'permission denied', 'access denied', 'unauthorized'];
  if (req.logSecurityEvent && 
      suspiciousErrors.some(pattern => error.message.toLowerCase().includes(pattern))) {
    req.logSecurityEvent('SQL_ERROR', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      error: error.message,
      executionTime: `${executionTime}ms`
    });
  }
  
  return {
    success: false,
    error: error.message,
    executionTime: `${executionTime}ms`
  };
};

/**
 * Builds success response with performance metrics
 */
const buildSuccessResponse = (result, executionTime, analysis) => {
  return {
    success: true,
    data: result.rows,
    rowCount: result.rowCount,
    affectedRows: result.affectedRows,
    executionTime: `${executionTime}ms`,
    queryType: analysis.type.toLowerCase(),
    metadata: {
      isSelect: analysis.isSelect,
      isModify: analysis.isModify,
      resultTruncated: result.rows.length >= CONFIG.QUERY.MAX_RESULT_ROWS
    }
  };
};

// =====================================================
// CONTROLLER FUNCTIONS
// =====================================================

/**
 * Executes SQL query with security checks and monitoring
 */
const executeQuery = async (req, res) => {
  const startTime = Date.now();
  let query = '';
  let analysis = null;
  
  try {
    // Validate and extract query
    query = validateQuery(req.body.query);
    
    logger.info('Processing SQL query request', {
      userId: req.user?.id || 'anonymous',
      userIP: req.ip,
      queryLength: query.length,
      operation: 'query_start'
    });
    
    // Perform security analysis
    const securityCheck = performSecurityChecks(query, req);
    analysis = securityCheck.analysis;
    
    // Execute query (simulated)
    const result = await simulateQueryExecution(query, analysis);
    
    const executionTime = Date.now() - startTime;
    
    // Log successful execution
    logQueryExecution(query, result, executionTime, req, true);
    
    // Build and return response
    const response = buildSuccessResponse(result, executionTime, analysis);
    
    res.json(response);
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    // Handle and log error
    const errorResponse = handleQueryError(error, query, executionTime, req);
    
    res.status(error.statusCode || 500).json(errorResponse);
  }
};

/**
 * Gets list of available databases
 */
const getDatabases = (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    
    logger.info('Database list requested', {
      userId,
      userIP: req.ip,
      operation: 'get_databases'
    });
    
    // Monitor this operation
    sqlMonitor.monitorQuery(
      'SHOW DATABASES',
      userId,
      req.ip,
      req.sessionID || 'unknown'
    );
    
    // Return simulated database list
    const response = {
      success: true,
      data: CONFIG.SIMULATION.DATABASES.map(db => ({
        name: db,
        type: 'MySQL',
        size: `${Math.floor(Math.random() * 100) + 10}MB`,
        tables: Math.floor(Math.random() * 10) + 3
      })),
      count: CONFIG.SIMULATION.DATABASES.length
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Error retrieving database list', {
      userId: req.user?.id || 'anonymous',
      error: error.message,
      operation: 'get_databases'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database list'
    });
  }
};

/**
 * Gets list of tables for a specific database
 */
const getTables = (req, res) => {
  try {
    const { database } = req.params;
    const userId = req.user?.id || 'anonymous';
    
    // Validate database parameter
    if (!database || typeof database !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Database name is required'
      });
    }
    
    logger.info('Table list requested', {
      userId,
      userIP: req.ip,
      database,
      operation: 'get_tables'
    });
    
    // Monitor this operation
    sqlMonitor.monitorQuery(
      `SHOW TABLES FROM ${database}`,
      userId,
      req.ip,
      req.sessionID || 'unknown'
    );
    
    // Check if database exists in our simulation
    if (!CONFIG.SIMULATION.DATABASES.includes(database)) {
      return res.status(404).json({
        success: false,
        error: `Database '${database}' not found`
      });
    }
    
    // Return simulated table list
    const response = {
      success: true,
      database,
      data: CONFIG.SIMULATION.TABLES.map(table => ({
        name: table,
        type: 'TABLE',
        rows: Math.floor(Math.random() * 10000) + 100,
        size: `${Math.floor(Math.random() * 50) + 5}KB`,
        created: new Date(Date.now() - Math.random() * 86400000 * 365).toISOString()
      })),
      count: CONFIG.SIMULATION.TABLES.length
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Error retrieving table list', {
      userId: req.user?.id || 'anonymous',
      database: req.params.database,
      error: error.message,
      operation: 'get_tables'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve table list'
    });
  }
};

/**
 * Gets database schema information
 */
const getDatabaseSchema = (req, res) => {
  try {
    const { database } = req.params;
    const userId = req.user?.id || 'anonymous';
    
    if (!database || typeof database !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Database name is required'
      });
    }
    
    logger.info('Database schema requested', {
      userId,
      userIP: req.ip,
      database,
      operation: 'get_schema'
    });
    
    // Check if database exists
    if (!CONFIG.SIMULATION.DATABASES.includes(database)) {
      return res.status(404).json({
        success: false,
        error: `Database '${database}' not found`
      });
    }
    
    // Return simulated schema
    const schema = {
      success: true,
      database,
      schema: {
        tables: CONFIG.SIMULATION.TABLES.map(table => ({
          name: table,
          columns: [
            { name: 'id', type: 'INT', nullable: false, key: 'PRIMARY' },
            { name: 'name', type: 'VARCHAR(255)', nullable: false, key: '' },
            { name: 'created_at', type: 'TIMESTAMP', nullable: false, key: '' },
            { name: 'updated_at', type: 'TIMESTAMP', nullable: true, key: '' }
          ],
          indexes: [
            { name: 'PRIMARY', columns: ['id'], unique: true }
          ]
        })),
        views: [],
        procedures: [],
        functions: []
      }
    };
    
    res.json(schema);
    
  } catch (error) {
    logger.error('Error retrieving database schema', {
      userId: req.user?.id || 'anonymous',
      database: req.params.database,
      error: error.message,
      operation: 'get_schema'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database schema'
    });
  }
};

module.exports = {
  executeQuery,
  getDatabases,
  getTables,
  getDatabaseSchema
};