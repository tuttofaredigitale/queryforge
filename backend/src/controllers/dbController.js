// controllers/dbController.js

const mysql = require('mysql2/promise');
const { templatePool } = require('../utils/db');
const logger = require('../utils/logger');

// =====================================================
// CONSTANTS & CONFIGURATION
// =====================================================
const CONFIG = {
  DATABASE: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT) || 3307,
    USER: process.env.DB_USER || 'app_user',
    PASSWORD: process.env.DB_PASSWORD || 'app_password',
    ROOT_PASSWORD: process.env.MYSQL_ROOT_PASSWORD || 'rootpassword',
    TEMPLATE_NAME: 'sql_template'
  },
  CONNECTION: {
    TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT) || 5,
    QUEUE_LIMIT: parseInt(process.env.DB_QUEUE_LIMIT) || 10,
    ACQUIRE_TIMEOUT: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000
  },
  LIMITS: {
    MAX_TABLES_PER_DB: parseInt(process.env.MAX_TABLES_PER_DB) || 50,
    MAX_COLUMNS_PER_TABLE: parseInt(process.env.MAX_COLUMNS_PER_TABLE) || 100,
    MAX_ROWS_PER_COPY: parseInt(process.env.MAX_ROWS_PER_COPY) || 10000
  }
};

// =====================================================
// CONNECTION POOL MANAGEMENT
// =====================================================

// Cache for user database connection pools
const userDbPools = new Map();

/**
 * Creates or retrieves a connection pool for user database
 */
const getUserDbPool = (userDbName) => {
  if (!userDbName || typeof userDbName !== 'string') {
    throw new Error('Invalid database name provided');
  }
  
  // Return existing pool if available
  if (userDbPools.has(userDbName)) {
    const poolInfo = userDbPools.get(userDbName);
    
    // Check if pool is still valid (not older than 1 hour)
    if (Date.now() - poolInfo.created < 3600000) {
      return poolInfo.pool;
    } else {
      // Close old pool and remove from cache
      poolInfo.pool.end().catch(err => 
        logger.warn(`Error closing old database pool: ${err.message}`)
      );
      userDbPools.delete(userDbName);
    }
  }
  
  // Create new pool
  const pool = mysql.createPool({
    host: CONFIG.DATABASE.HOST,
    port: CONFIG.DATABASE.PORT,
    user: CONFIG.DATABASE.USER,
    password: CONFIG.DATABASE.PASSWORD,
    database: userDbName,
    waitForConnections: true,
    connectionLimit: CONFIG.CONNECTION.LIMIT,
    queueLimit: CONFIG.CONNECTION.QUEUE_LIMIT,
    acquireTimeout: CONFIG.CONNECTION.ACQUIRE_TIMEOUT,
    timeout: CONFIG.CONNECTION.TIMEOUT,
    reconnect: true,
    idleTimeout: 300000, // 5 minutes
    enableKeepAlive: true
  });
  
  // Cache the pool with creation timestamp
  userDbPools.set(userDbName, {
    pool,
    created: Date.now()
  });
  
  return pool;
};

/**
 * Creates root connection pool for administrative operations
 */
const createRootPool = () => {
  return mysql.createPool({
    host: CONFIG.DATABASE.HOST,
    port: CONFIG.DATABASE.PORT,
    user: 'root',
    password: CONFIG.DATABASE.ROOT_PASSWORD,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 3, // Fewer connections for admin operations
    queueLimit: CONFIG.CONNECTION.QUEUE_LIMIT,
    acquireTimeout: CONFIG.CONNECTION.ACQUIRE_TIMEOUT,
    timeout: CONFIG.CONNECTION.TIMEOUT * 2, // Longer timeout for admin ops
    reconnect: true
  });
};

/**
 * Cleanup function to close all cached pools
 */
const cleanupPools = async () => {
  const closePromises = [];
  
  for (const [dbName, poolInfo] of userDbPools.entries()) {
    closePromises.push(
      poolInfo.pool.end().catch(err => 
        logger.warn(`Error closing pool for ${dbName}: ${err.message}`)
      )
    );
  }
  
  await Promise.allSettled(closePromises);
  userDbPools.clear();
  
  logger.info('All database connection pools closed');
};

// Graceful shutdown handler
process.on('SIGTERM', cleanupPools);
process.on('SIGINT', cleanupPools);

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates database name format and security
 */
const validateDatabaseName = (dbName) => {
  if (!dbName || typeof dbName !== 'string') {
    const error = new Error('Database name is required and must be a string');
    error.statusCode = 400;
    throw error;
  }
  
  // Check for SQL injection patterns
  const dangerousPatterns = [
    /[';"\-\-\/\*]/,  // SQL injection characters
    /\b(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER)\b/i,  // SQL keywords
    /\.\./,  // Path traversal
    /[<>]/   // XSS characters
  ];
  
  if (dangerousPatterns.some(pattern => pattern.test(dbName))) {
    const error = new Error('Database name contains invalid characters');
    error.statusCode = 400;
    throw error;
  }
  
  // Check length and format
  if (dbName.length > 64 || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
    const error = new Error('Database name must be alphanumeric with underscores only, max 64 characters');
    error.statusCode = 400;
    throw error;
  }
  
  return true;
};

/**
 * Safely executes query with error handling and logging
 */
const executeQuerySafely = async (pool, query, params = [], context = '') => {
  const startTime = Date.now();
  
  try {
    const [result] = await pool.execute(query, params);
    const executionTime = Date.now() - startTime;
    
    logger.debug('Database query executed successfully', {
      context,
      executionTime: `${executionTime}ms`,
      resultCount: Array.isArray(result) ? result.length : 1,
      operation: 'db_query'
    });
    
    return result;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Database query failed', {
      context,
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      executionTime: `${executionTime}ms`,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      operation: 'db_query_error'
    });
    
    throw error;
  }
};

/**
 * Normalizes column information across different MySQL versions
 */
const normalizeColumnInfo = (column) => {
  return {
    name: column.column_name || column.COLUMN_NAME,
    type: column.data_type || column.DATA_TYPE,
    isPrimary: (column.column_key || column.COLUMN_KEY) === 'PRI',
    isNullable: (column.is_nullable || column.IS_NULLABLE) === 'YES',
    defaultValue: column.column_default || column.COLUMN_DEFAULT,
    extra: column.extra || column.EXTRA
  };
};

/**
 * Normalizes table information
 */
const normalizeTableInfo = (table) => {
  return {
    name: table.table_name || table.TABLE_NAME,
    type: table.table_type || table.TABLE_TYPE || 'BASE TABLE'
  };
};

/**
 * Gets database structure with enhanced metadata
 */
const getDatabaseStructureData = async (userDbName) => {
  const userDbPool = getUserDbPool(userDbName);
  const dbStructure = {
    tables: {},
    views: {},
    metadata: {
      database: userDbName,
      retrieved: new Date().toISOString(),
      tableCount: 0,
      viewCount: 0
    }
  };
  
  try {
    // Get all tables and views
    const tables = await executeQuerySafely(
      userDbPool,
      `SELECT table_name, table_type 
       FROM information_schema.tables 
       WHERE table_schema = ?
       ORDER BY table_name`,
      [userDbName],
      'get_tables_and_views'
    );
    
    if (tables.length > CONFIG.LIMITS.MAX_TABLES_PER_DB) {
      logger.warn(`Database ${userDbName} has ${tables.length} tables, exceeding limit of ${CONFIG.LIMITS.MAX_TABLES_PER_DB}`);
    }
    
    // Process each table/view
    for (const table of tables) {
      const tableInfo = normalizeTableInfo(table);
      const tableName = tableInfo.name;
      const isView = tableInfo.type === 'VIEW';
      
      // Get columns for this table/view
      const columns = await executeQuerySafely(
        userDbPool,
        `SELECT column_name, data_type, column_key, is_nullable, 
                column_default, extra, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [userDbName, tableName],
        `get_columns_for_${tableName}`
      );
      
      if (columns.length > CONFIG.LIMITS.MAX_COLUMNS_PER_TABLE) {
        logger.warn(`Table ${tableName} has ${columns.length} columns, exceeding limit of ${CONFIG.LIMITS.MAX_COLUMNS_PER_TABLE}`);
      }
      
      const formattedColumns = columns.map(normalizeColumnInfo);
      
      // Get additional metadata for tables (not views)
      let additionalInfo = {};
      if (!isView) {
        try {
          // Get row count and table size
          const [tableStats] = await executeQuerySafely(
            userDbPool,
            `SELECT table_rows, data_length, index_length,
                    create_time, update_time
             FROM information_schema.tables
             WHERE table_schema = ? AND table_name = ?`,
            [userDbName, tableName],
            `get_table_stats_${tableName}`
          );
          
          if (tableStats) {
            additionalInfo = {
              rowCount: tableStats.table_rows || tableStats.TABLE_ROWS || 0,
              dataSize: tableStats.data_length || tableStats.DATA_LENGTH || 0,
              indexSize: tableStats.index_length || tableStats.INDEX_LENGTH || 0,
              created: tableStats.create_time || tableStats.CREATE_TIME,
              updated: tableStats.update_time || tableStats.UPDATE_TIME
            };
          }
        } catch (error) {
          logger.warn(`Failed to get stats for table ${tableName}: ${error.message}`);
        }
      }
      
      const tableData = {
        columns: formattedColumns,
        type: isView ? 'view' : 'table',
        ...additionalInfo
      };
      
      if (isView) {
        dbStructure.views[tableName] = tableData;
        dbStructure.metadata.viewCount++;
      } else {
        dbStructure.tables[tableName] = tableData;
        dbStructure.metadata.tableCount++;
      }
    }
    
    return dbStructure;
    
  } catch (error) {
    logger.error(`Error getting database structure for ${userDbName}:`, {
      error: error.message,
      code: error.code,
      operation: 'get_database_structure'
    });
    throw error;
  }
};

/**
 * Copies data from template to user database with batch processing
 */
const copyTableData = async (rootPool, templateTableName, userDbName, userTableName) => {
  try {
    // Get total row count
    const [countResult] = await executeQuerySafely(
      templatePool,
      `SELECT COUNT(*) as total FROM ${templateTableName}`,
      [],
      `count_template_${templateTableName}`
    );
    
    const totalRows = countResult.total;
    
    if (totalRows === 0) {
      logger.debug(`No data to copy from template table ${templateTableName}`);
      return;
    }
    
    if (totalRows > CONFIG.LIMITS.MAX_ROWS_PER_COPY) {
      logger.warn(`Template table ${templateTableName} has ${totalRows} rows, exceeding copy limit of ${CONFIG.LIMITS.MAX_ROWS_PER_COPY}`);
    }
    
    // Get column names
    const [sampleRow] = await executeQuerySafely(
      templatePool,
      `SELECT * FROM ${templateTableName} LIMIT 1`,
      [],
      `sample_${templateTableName}`
    );
    
    if (sampleRow.length === 0) return;
    
    const columns = Object.keys(sampleRow[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO ${userDbName}.${userTableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    // Process data in batches
    const batchSize = 1000;
    let offset = 0;
    let copiedRows = 0;
    
    while (offset < Math.min(totalRows, CONFIG.LIMITS.MAX_ROWS_PER_COPY)) {
      const currentBatchSize = Math.min(batchSize, totalRows - offset);
      
      const rows = await executeQuerySafely(
        templatePool,
        `SELECT * FROM ${templateTableName} LIMIT ? OFFSET ?`,
        [currentBatchSize, offset],
        `batch_${templateTableName}_${offset}`
      );
      
      // Insert batch
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        await executeQuerySafely(
          rootPool,
          insertQuery,
          values,
          `insert_${userTableName}_row`
        );
        copiedRows++;
      }
      
      offset += currentBatchSize;
    }
    
    logger.info(`Copied ${copiedRows} rows from ${templateTableName} to ${userDbName}.${userTableName}`);
    
  } catch (error) {
    logger.error(`Error copying data from ${templateTableName}:`, {
      error: error.message,
      code: error.code,
      operation: 'copy_table_data'
    });
    throw error;
  }
};

// =====================================================
// CONTROLLER FUNCTIONS
// =====================================================

/**
 * Gets the structure of user's database with enhanced metadata
 */
exports.getDatabaseStructure = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userDbName = req.userDbName;
    const userId = req.user?.id || 'anonymous';
    
    // Validate database name
    validateDatabaseName(userDbName);
    
    logger.info('Database structure request started', {
      userId,
      userDbName,
      userIP: req.ip,
      operation: 'get_database_structure'
    });
    
    // Get database structure
    const dbStructure = await getDatabaseStructureData(userDbName);
    
    const executionTime = Date.now() - startTime;
    
    logger.info('Database structure retrieved successfully', {
      userId,
      userDbName,
      tableCount: dbStructure.metadata.tableCount,
      viewCount: dbStructure.metadata.viewCount,
      executionTime: `${executionTime}ms`,
      operation: 'get_database_structure_complete'
    });
    
    res.json({
      success: true,
      data: dbStructure,
      executionTime: `${executionTime}ms`
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Error retrieving database structure:', {
      userId: req.user?.id || 'anonymous',
      userDbName: req.userDbName,
      error: error.message,
      code: error.code,
      executionTime: `${executionTime}ms`,
      operation: 'get_database_structure_error'
    });
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error retrieving database structure',
      executionTime: `${executionTime}ms`
    });
  }
};

/**
 * Resets user's database to template state with transaction safety
 */
exports.resetDatabase = async (req, res) => {
  const startTime = Date.now();
  let rootPool = null;
  
  try {
    const userDbName = req.userDbName;
    const userId = req.user?.id || 'anonymous';
    
    // Validate database name
    validateDatabaseName(userDbName);
    
    logger.info('Database reset request started', {
      userId,
      userDbName,
      userIP: req.ip,
      operation: 'reset_database'
    });
    
    // Create root connection pool
    rootPool = createRootPool();
    
    // Start transaction for atomic operations
    const connection = await rootPool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get existing tables in user database
      const existingTables = await executeQuerySafely(
        connection,
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = ?`,
        [userDbName],
        'get_existing_tables'
      );
      
      // Drop existing tables if any
      if (existingTables.length > 0) {
        logger.info(`Dropping ${existingTables.length} existing tables from ${userDbName}`);
        
        // Disable foreign key checks for clean drop
        await executeQuerySafely(
          connection,
          'SET FOREIGN_KEY_CHECKS = 0',
          [],
          'disable_foreign_keys'
        );
        
        // Drop tables
        for (const table of existingTables) {
          const tableName = table.table_name || table.TABLE_NAME;
          await executeQuerySafely(
            connection,
            `DROP TABLE IF EXISTS ${userDbName}.${tableName}`,
            [],
            `drop_table_${tableName}`
          );
        }
        
        // Re-enable foreign key checks
        await executeQuerySafely(
          connection,
          'SET FOREIGN_KEY_CHECKS = 1',
          [],
          'enable_foreign_keys'
        );
      }
      
      // Get template tables
      const templateTables = await executeQuerySafely(
        templatePool,
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = ?
         ORDER BY table_name`,
        [CONFIG.DATABASE.TEMPLATE_NAME],
        'get_template_tables'
      );
      
      if (templateTables.length === 0) {
        throw new Error('No template tables found to copy');
      }
      
      logger.info(`Copying ${templateTables.length} tables from template to ${userDbName}`);
      
      // Copy each template table
      for (const table of templateTables) {
        const tableName = table.table_name || table.TABLE_NAME;
        
        // Get table creation statement
        const [createTableResult] = await executeQuerySafely(
          templatePool,
          `SHOW CREATE TABLE ${tableName}`,
          [],
          `get_create_statement_${tableName}`
        );
        
        const createTableSql = createTableResult['Create Table'];
        
        // Extract table definition (everything after table name)
        const tableDefStart = createTableSql.indexOf('(');
        if (tableDefStart === -1) {
          throw new Error(`Invalid CREATE TABLE statement for ${tableName}`);
        }
        
        const tableDef = createTableSql.substring(tableDefStart);
        
        // Create table in user database
        await executeQuerySafely(
          connection,
          `CREATE TABLE ${userDbName}.${tableName} ${tableDef}`,
          [],
          `create_table_${tableName}`
        );
        
        // Copy data from template
        await copyTableData(connection, tableName, userDbName, tableName);
      }
      
      // Commit transaction
      await connection.commit();
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Database reset completed successfully', {
        userId,
        userDbName,
        tablesCreated: templateTables.length,
        executionTime: `${executionTime}ms`,
        operation: 'reset_database_complete'
      });
      
      res.json({
        success: true,
        message: 'Database reset successfully',
        tablesCreated: templateTables.length,
        executionTime: `${executionTime}ms`
      });
      
    } catch (transactionError) {
      // Rollback transaction on error
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Error resetting database:', {
      userId: req.user?.id || 'anonymous',
      userDbName: req.userDbName,
      error: error.message,
      code: error.code,
      executionTime: `${executionTime}ms`,
      operation: 'reset_database_error'
    });
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error resetting database',
      executionTime: `${executionTime}ms`
    });
    
  } finally {
    // Clean up root pool
    if (rootPool) {
      await rootPool.end().catch(err => 
        logger.warn(`Error closing root pool: ${err.message}`)
      );
    }
  }
};

// Export cleanup function for testing
exports.cleanupPools = cleanupPools;