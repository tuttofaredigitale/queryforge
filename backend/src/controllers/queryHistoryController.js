// controllers/queryHistoryController.js

const pool = require('../config/database').sql_auth;
const logger = require('../utils/logger');

// =====================================================
// CONSTANTS & CONFIGURATION
// =====================================================
const CONFIG = {
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1
  },
  QUERY: {
    MAX_QUERY_LENGTH: parseInt(process.env.MAX_HISTORY_QUERY_LENGTH) || 10000,
    MAX_ERROR_LENGTH: parseInt(process.env.MAX_ERROR_LENGTH) || 2000,
    DEFAULT_RETENTION_DAYS: parseInt(process.env.QUERY_HISTORY_RETENTION_DAYS) || 90
  },
  SEARCH: {
    MIN_SEARCH_LENGTH: 3,
    MAX_SEARCH_LENGTH: 100
  },
  EXPORT: {
    MAX_EXPORT_RECORDS: parseInt(process.env.MAX_EXPORT_RECORDS) || 1000
  }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates pagination parameters
 */
const validatePagination = (query) => {
  const limit = Math.min(
    Math.max(parseInt(query.limit) || CONFIG.PAGINATION.DEFAULT_LIMIT, CONFIG.PAGINATION.MIN_LIMIT),
    CONFIG.PAGINATION.MAX_LIMIT
  );
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  const page = Math.max(parseInt(query.page) || 1, 1);
  
  // If page is provided, calculate offset from page
  const calculatedOffset = query.page ? (page - 1) * limit : offset;
  
  return { limit, offset: calculatedOffset, page };
};

/**
 * Validates and sanitizes search parameters
 */
const validateSearchParams = (query) => {
  const filters = {
    search: null,
    success: null,
    error: null,
    dateFrom: null,
    dateTo: null,
    queryType: null
  };
  
  // Search term validation
  if (query.search && typeof query.search === 'string') {
    const searchTerm = query.search.trim();
    if (searchTerm.length >= CONFIG.SEARCH.MIN_SEARCH_LENGTH && 
        searchTerm.length <= CONFIG.SEARCH.MAX_SEARCH_LENGTH) {
      filters.search = searchTerm;
    }
  }
  
  // Success/Error filter
  if (query.success === 'true') filters.success = true;
  if (query.success === 'false' || query.error === 'true') filters.success = false;
  
  // Date range validation
  if (query.dateFrom) {
    const fromDate = new Date(query.dateFrom);
    if (!isNaN(fromDate.getTime())) {
      filters.dateFrom = fromDate;
    }
  }
  
  if (query.dateTo) {
    const toDate = new Date(query.dateTo);
    if (!isNaN(toDate.getTime())) {
      filters.dateTo = toDate;
    }
  }
  
  // Query type filter
  if (query.queryType && typeof query.queryType === 'string') {
    const allowedTypes = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'SHOW'];
    const upperType = query.queryType.toUpperCase();
    if (allowedTypes.includes(upperType)) {
      filters.queryType = upperType;
    }
  }
  
  return filters;
};

/**
 * Builds SQL WHERE clause based on filters
 */
const buildWhereClause = (userId, filters) => {
  let whereClause = 'WHERE user_id = ?';
  const params = [userId];
  
  if (filters.search) {
    whereClause += ' AND query LIKE ?';
    params.push(`%${filters.search}%`);
  }
  
  if (filters.success === true) {
    whereClause += ' AND error IS NULL';
  } else if (filters.success === false) {
    whereClause += ' AND error IS NOT NULL';
  }
  
  if (filters.dateFrom) {
    whereClause += ' AND executed_at >= ?';
    params.push(filters.dateFrom.toISOString().slice(0, 19).replace('T', ' '));
  }
  
  if (filters.dateTo) {
    whereClause += ' AND executed_at <= ?';
    params.push(filters.dateTo.toISOString().slice(0, 19).replace('T', ' '));
  }
  
  if (filters.queryType) {
    whereClause += ' AND UPPER(TRIM(query)) LIKE ?';
    params.push(`${filters.queryType}%`);
  }
  
  return { whereClause, params };
};

/**
 * Formats query history records for response
 */
const formatHistoryRecords = (records) => {
  return records.map(record => ({
    id: record.id,
    query: record.query,
    timestamp: record.executed_at,
    success: !record.error,
    error: record.error,
    queryType: record.query ? record.query.trim().split(/\s+/)[0].toUpperCase() : null,
    queryLength: record.query ? record.query.length : 0,
    metadata: record.metadata ? JSON.parse(record.metadata) : {}
  }));
};

/**
 * Safely executes database operations with connection management
 */
const executeWithConnection = async (operation, context = '') => {
  let connection = null;
  
  try {
    connection = await pool.getConnection();
    const result = await operation(connection);
    return result;
  } catch (error) {
    logger.error(`Database operation failed: ${context}`, {
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      operation: context
    });
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Validates query history entry input
 */
const validateQueryInput = (query, error = null) => {
  if (!query || typeof query !== 'string') {
    const err = new Error('Query is required and must be a string');
    err.statusCode = 400;
    throw err;
  }
  
  if (query.length > CONFIG.QUERY.MAX_QUERY_LENGTH) {
    const err = new Error(`Query too long. Maximum ${CONFIG.QUERY.MAX_QUERY_LENGTH} characters allowed`);
    err.statusCode = 400;
    throw err;
  }
  
  if (error && typeof error === 'string' && error.length > CONFIG.QUERY.MAX_ERROR_LENGTH) {
    error = error.substring(0, CONFIG.QUERY.MAX_ERROR_LENGTH) + '...';
  }
  
  return { 
    query: query.trim(), 
    error: error && typeof error === 'string' ? error.trim() : null 
  };
};

/**
 * Gets query history statistics for user
 */
const getHistoryStats = async (userId) => {
  return executeWithConnection(async (connection) => {
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as failed,
        MIN(executed_at) as oldest_query,
        MAX(executed_at) as latest_query
      FROM query_history 
      WHERE user_id = ?
    `, [userId]);
    
    return stats[0];
  }, 'get_history_stats');
};

// =====================================================
// CONTROLLER FUNCTIONS
// =====================================================

/**
 * Gets query history with advanced filtering and pagination
 */
const getQueryHistory = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const pagination = validatePagination(req.query);
    const filters = validateSearchParams(req.query);
    const includeStats = req.query.includeStats === 'true';
    
    logger.debug('Query history request', {
      userId,
      pagination,
      filters,
      includeStats,
      operation: 'get_query_history'
    });
    
    const { whereClause, params } = buildWhereClause(userId, filters);
    
    const result = await executeWithConnection(async (connection) => {
      // Get paginated records
      const [records] = await connection.execute(`
        SELECT id, query, executed_at, error, metadata
        FROM query_history 
        ${whereClause}
        ORDER BY executed_at DESC 
        LIMIT ? OFFSET ?
      `, [...params, pagination.limit, pagination.offset]);
      
      // Get total count for pagination
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as total 
        FROM query_history 
        ${whereClause}
      `, params);
      
      return {
        records,
        total: countResult[0].total
      };
    }, 'get_query_history');
    
    const formattedRecords = formatHistoryRecords(result.records);
    const totalPages = Math.ceil(result.total / pagination.limit);
    
    const response = {
      success: true,
      data: formattedRecords,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        offset: pagination.offset,
        total: result.total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1
      },
      filters,
      executionTime: `${Date.now() - startTime}ms`
    };
    
    // Include statistics if requested
    if (includeStats) {
      response.statistics = await getHistoryStats(userId);
    }
    
    logger.info('Query history retrieved successfully', {
      userId,
      recordCount: formattedRecords.length,
      totalRecords: result.total,
      executionTime: response.executionTime,
      operation: 'get_query_history_success'
    });
    
    res.json(response);
    
  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.error('Error retrieving query history', {
      userId: req.user?.id,
      error: error.message,
      executionTime,
      operation: 'get_query_history_error'
    });
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error retrieving query history',
      error: error.message,
      executionTime
    });
  }
};

/**
 * Saves a query to history with metadata
 */
const saveQuery = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const { query, error = null, metadata = {} } = req.body;
    
    // Validate input
    const validated = validateQueryInput(query, error);
    
    logger.debug('Saving query to history', {
      userId,
      queryLength: validated.query.length,
      hasError: !!validated.error,
      operation: 'save_query_history'
    });
    
    const result = await executeWithConnection(async (connection) => {
      const [result] = await connection.execute(`
        INSERT INTO query_history 
        (user_id, query, executed_at, error, metadata) 
        VALUES (?, ?, NOW(), ?, ?)
      `, [
        userId, 
        validated.query, 
        validated.error,
        JSON.stringify({
          ...metadata,
          queryLength: validated.query.length,
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        })
      ]);
      
      return result;
    }, 'save_query_history');
    
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.info('Query saved to history successfully', {
      userId,
      historyId: result.insertId,
      hasError: !!validated.error,
      executionTime,
      operation: 'save_query_history_success'
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        query: validated.query,
        error: validated.error,
        timestamp: new Date().toISOString()
      },
      message: 'Query saved to history successfully',
      executionTime
    });
    
  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.error('Error saving query to history', {
      userId: req.user?.id,
      error: error.message,
      executionTime,
      operation: 'save_query_history_error'
    });
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error saving query to history',
      error: error.message,
      executionTime
    });
  }
};

/**
 * Deletes a specific query from history
 */
const deleteQuery = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const queryId = req.params.id;
    
    if (!queryId || isNaN(parseInt(queryId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query ID provided'
      });
    }
    
    logger.info('Deleting query from history', {
      userId,
      queryHistoryId: queryId,
      operation: 'delete_query_history'
    });
    
    const result = await executeWithConnection(async (connection) => {
      const [result] = await connection.execute(
        'DELETE FROM query_history WHERE id = ? AND user_id = ?',
        [parseInt(queryId), userId]
      );
      
      return result;
    }, 'delete_query_history');
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Query not found or access denied'
      });
    }
    
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.info('Query deleted from history successfully', {
      userId,
      queryHistoryId: queryId,
      executionTime,
      operation: 'delete_query_history_success'
    });
    
    res.json({
      success: true,
      message: 'Query deleted from history successfully',
      executionTime
    });
    
  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.error('Error deleting query from history', {
      userId: req.user?.id,
      queryHistoryId: req.params.id,
      error: error.message,
      executionTime,
      operation: 'delete_query_history_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error deleting query from history',
      error: error.message,
      executionTime
    });
  }
};

/**
 * Clears all query history for user with optional filtering
 */
const clearHistory = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const { olderThan, errorsOnly = false } = req.body;
    
    let whereClause = 'WHERE user_id = ?';
    const params = [userId];
    
    // Add date filter if specified
    if (olderThan) {
      const cutoffDate = new Date(olderThan);
      if (!isNaN(cutoffDate.getTime())) {
        whereClause += ' AND executed_at < ?';
        params.push(cutoffDate.toISOString().slice(0, 19).replace('T', ' '));
      }
    }
    
    // Add error filter if specified
    if (errorsOnly) {
      whereClause += ' AND error IS NOT NULL';
    }
    
    logger.info('Clearing query history', {
      userId,
      olderThan,
      errorsOnly,
      operation: 'clear_query_history'
    });
    
    const result = await executeWithConnection(async (connection) => {
      const [result] = await connection.execute(
        `DELETE FROM query_history ${whereClause}`,
        params
      );
      
      return result;
    }, 'clear_query_history');
    
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.info('Query history cleared successfully', {
      userId,
      deletedCount: result.affectedRows,
      olderThan,
      errorsOnly,
      executionTime,
      operation: 'clear_query_history_success'
    });
    
    res.json({
      success: true,
      message: 'Query history cleared successfully',
      data: {
        deletedCount: result.affectedRows,
        filter: {
          olderThan,
          errorsOnly
        }
      },
      executionTime
    });
    
  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.error('Error clearing query history', {
      userId: req.user?.id,
      error: error.message,
      executionTime,
      operation: 'clear_query_history_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error clearing query history',
      error: error.message,
      executionTime
    });
  }
};

/**
 * Gets query history statistics
 */
const getHistoryStatistics = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    
    logger.debug('Getting query history statistics', {
      userId,
      operation: 'get_history_statistics'
    });
    
    const stats = await getHistoryStats(userId);
    
    // Get query type distribution
    const typeStats = await executeWithConnection(async (connection) => {
      const [types] = await connection.execute(`
        SELECT 
          UPPER(TRIM(SUBSTRING_INDEX(TRIM(query), ' ', 1))) as query_type,
          COUNT(*) as count
        FROM query_history 
        WHERE user_id = ?
        GROUP BY query_type
        ORDER BY count DESC
        LIMIT 10
      `, [userId]);
      
      return types;
    }, 'get_query_type_stats');
    
    // Get recent activity (last 7 days)
    const recentActivity = await executeWithConnection(async (connection) => {
      const [activity] = await connection.execute(`
        SELECT 
          DATE(executed_at) as date,
          COUNT(*) as query_count,
          SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) as successful_count
        FROM query_history 
        WHERE user_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(executed_at)
        ORDER BY date DESC
      `, [userId]);
      
      return activity;
    }, 'get_recent_activity');
    
    const executionTime = `${Date.now() - startTime}ms`;
    
    const response = {
      success: true,
      data: {
        overall: {
          totalQueries: stats.total,
          successfulQueries: stats.successful,
          failedQueries: stats.failed,
          successRate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0,
          oldestQuery: stats.oldest_query,
          latestQuery: stats.latest_query
        },
        queryTypes: typeStats,
        recentActivity: recentActivity.map(day => ({
          date: day.date,
          totalQueries: day.query_count,
          successfulQueries: day.successful_count,
          failedQueries: day.query_count - day.successful_count,
          successRate: Math.round((day.successful_count / day.query_count) * 100)
        }))
      },
      executionTime
    };
    
    logger.info('Query history statistics retrieved successfully', {
      userId,
      totalQueries: stats.total,
      executionTime,
      operation: 'get_history_statistics_success'
    });
    
    res.json(response);
    
  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.error('Error getting query history statistics', {
      userId: req.user?.id,
      error: error.message,
      executionTime,
      operation: 'get_history_statistics_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error getting query history statistics',
      error: error.message,
      executionTime
    });
  }
};

/**
 * Exports query history in various formats
 */
const exportHistory = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const format = req.query.format || 'json';
    const filters = validateSearchParams(req.query);
    const limit = Math.min(parseInt(req.query.limit) || CONFIG.EXPORT.MAX_EXPORT_RECORDS, CONFIG.EXPORT.MAX_EXPORT_RECORDS);
    
    logger.info('Exporting query history', {
      userId,
      format,
      filters,
      limit,
      operation: 'export_history'
    });
    
    const { whereClause, params } = buildWhereClause(userId, filters);
    
    const records = await executeWithConnection(async (connection) => {
      const [records] = await connection.execute(`
        SELECT id, query, executed_at, error, metadata
        FROM query_history 
        ${whereClause}
        ORDER BY executed_at DESC 
        LIMIT ?
      `, [...params, limit]);
      
      return records;
    }, 'export_history');
    
    const formattedRecords = formatHistoryRecords(records);
    const executionTime = `${Date.now() - startTime}ms`;
    
    if (format === 'csv') {
      const csv = [
        'ID,Query,Timestamp,Success,Error,Query Type',
        ...formattedRecords.map(record => 
          `${record.id},"${record.query.replace(/"/g, '""')}",${record.timestamp},${record.success},"${(record.error || '').replace(/"/g, '""')}",${record.queryType || ''}`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="query_history_${userId}_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } else {
      // Default JSON format
      res.json({
        success: true,
        data: formattedRecords,
        metadata: {
          exportedAt: new Date().toISOString(),
          totalRecords: formattedRecords.length,
          filters,
          format
        },
        executionTime
      });
    }
    
    logger.info('Query history exported successfully', {
      userId,
      recordCount: formattedRecords.length,
      format,
      executionTime,
      operation: 'export_history_success'
    });
    
  } catch (error) {
    const executionTime = `${Date.now() - startTime}ms`;
    
    logger.error('Error exporting query history', {
      userId: req.user?.id,
      error: error.message,
      executionTime,
      operation: 'export_history_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error exporting query history',
      error: error.message,
      executionTime
    });
  }
};

module.exports = {
  getQueryHistory,
  saveQuery,
  deleteQuery,
  clearHistory,
  getHistoryStatistics,
  exportHistory
};