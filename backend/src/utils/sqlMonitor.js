// backend/utils/sqlMonitor.js
const { authPool, templatePool } = require('./db'); // Use our optimized db.js
const logger = require('./logger');

// =====================================================
// SECURE CONFIGURATION
// =====================================================
class MonitorConfig {
  constructor() {
    this.poolCheck = {
      intervalMs: parseInt(process.env.POOL_CHECK_INTERVAL_MINUTES || '1') * 60 * 1000, // 1min intervals
      maxHistoryEntries: parseInt(process.env.POOL_HISTORY_MAX) || 288, // 24h  
      alertThresholds: {
        utilization: parseInt(process.env.POOL_ALERT_UTILIZATION) || 80,
        queueSize: parseInt(process.env.POOL_ALERT_QUEUE) || 5
      }
    };
    
    this.queryLimits = {
      maxUserHistory: parseInt(process.env.SQL_MONITOR_MAX_USERS) || 1000,
      maxQueryLength: parseInt(process.env.SQL_MONITOR_MAX_QUERY_LENGTH) || 1000,
      cleanupIntervalMs: parseInt(process.env.SQL_MONITOR_CLEANUP_MINUTES) * 60 * 1000 || 30 * 60 * 1000 // 30 minutes
    };
    
    this.suspicious = {
      patterns: [
        /\brename\s+table/i,
        /union\s+select/i,
        /;\s*drop\s+/i,
        /;\s*delete\s+from/i,
        /;\s*update\s+.*set/i,
        /;\s*insert\s+into/i,
        /xp_cmdshell/i,
        /sp_executesql/i,
        /exec\s*\(/i,
        /script.*src/i,
        /<script/i,
        /javascript:/i
      ],
      maxViolationsPerUser: 5
    };
    
    logger.info('SQL Monitor configured:', {
      poolCheckMinutes: Math.round(this.poolCheck.intervalMs / 60000),
      maxHistoryEntries: this.poolCheck.maxHistoryEntries,
      maxUserHistory: this.queryLimits.maxUserHistory
    });
  }
}

const config = new MonitorConfig();

// =====================================================
// BOUNDED MEMORY STORES
// =====================================================
class BoundedMap {
  constructor(maxSize) {
    this.data = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }
  
  set(key, value) {
    // Remove if exists to update access order
    if (this.data.has(key)) {
      this.data.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    
    // Evict oldest if at capacity
    if (this.data.size >= this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      this.data.delete(oldestKey);
    }
    
    this.data.set(key, value);
    this.accessOrder.push(key);
  }
  
  get(key) {
    if (this.data.has(key)) {
      // Update access order (LRU)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return this.data.get(key);
    }
    return undefined;
  }
  
  has(key) {
    return this.data.has(key);
  }
  
  size() {
    return this.data.size;
  }
  
  clear() {
    this.data.clear();
    this.accessOrder = [];
  }
}

// =====================================================
// INPUT VALIDATION & SANITIZATION
// =====================================================
const validator = {
  query: (query) => {
    if (!query || typeof query !== 'string') return null;
    
    const trimmed = query.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > config.queryLimits.maxQueryLength) {
      return trimmed.substring(0, config.queryLimits.maxQueryLength) + '... [TRUNCATED]';
    }
    
    return trimmed;
  },
  
  userId: (userId) => {
    if (!userId) return 'anonymous';
    const cleaned = String(userId).trim();
    return cleaned.length > 0 && cleaned.length <= 50 ? cleaned : 'invalid_user';
  },
  
  ip: (ip) => {
    if (!ip || typeof ip !== 'string') return 'unknown';
    const cleaned = ip.trim();
    return cleaned.length > 0 && cleaned.length <= 45 ? cleaned : 'invalid_ip'; // IPv6 max length
  }
};

// =====================================================
// CORE SQL MONITORING ENGINE
// =====================================================
class SqlMonitor {
  constructor() {
    // Query statistics
    this.stats = {
      total: 0,
      select: 0,
      insert: 0,
      update: 0,
      delete: 0,
      rename: 0,
      other: 0,
      suspicious: 0,
      blocked: 0,
      startTime: Date.now()
    };
    
    // User tracking with bounds
    this.userQueries = new BoundedMap(config.queryLimits.maxUserHistory);
    this.suspiciousUsers = new BoundedMap(500); // Track suspicious activity
    
    // Pool monitoring
    this.poolMetrics = {
      history: [],
      lastCheck: null,
      isHealthy: true,
      consecutiveErrors: 0
    };
    
    // Start monitoring
    this.startPoolMonitoring();
    logger.info('Pool monitoring configured', {
  checkIntervalMinutes: config.poolCheck.intervalMs / 60000,
  maxHistoryEntries: config.poolCheck.maxHistoryEntries
});
    this.startCleanup();
    
    logger.info('SQL Monitor initialized with bounded memory protection');
  }
  
  // ==================== QUERY MONITORING ====================
  monitorQuery(query, userId, ip, sessionId) {
    try {
      // Validate and sanitize inputs
      const cleanQuery = validator.query(query);
      const cleanUserId = validator.userId(userId);
      const cleanIp = validator.ip(ip);
      
      if (!cleanQuery) {
        logger.warn('Invalid query received', { userId: cleanUserId, ip: cleanIp });
        return { suspicious: false, error: 'Invalid query' };
      }
      
      // Update statistics
      this.stats.total++;
      const queryType = this.determineQueryType(cleanQuery);
      this.updateQueryTypeStats(queryType);
      
      // Update user tracking
      this.trackUserActivity(cleanUserId, queryType);
      
      // Check for suspicious patterns
      const suspiciousResult = this.checkSuspiciousPatterns(cleanQuery, cleanUserId, cleanIp);
      
      // Log query (truncated for performance)
      logger.info('SQL query monitored', {
        type: queryType,
        user: cleanUserId,
        ip: cleanIp,
        suspicious: suspiciousResult.suspicious,
        queryPreview: cleanQuery.substring(0, 100) + (cleanQuery.length > 100 ? '...' : '')
      });
      
      return {
        suspicious: suspiciousResult.suspicious,
        patterns: suspiciousResult.patterns,
        action: suspiciousResult.action
      };
      
    } catch (error) {
      logger.error('Error in query monitoring:', {
        error: error.message,
        userId,
        ip
      });
      
      return { suspicious: false, error: 'Monitoring error' };
    }
  }
  
  updateQueryTypeStats(queryType) {
    switch(queryType) {
      case 'SELECT': this.stats.select++; break;
      case 'INSERT': this.stats.insert++; break;
      case 'UPDATE': this.stats.update++; break;
      case 'DELETE': this.stats.delete++; break;
      case 'RENAME': this.stats.rename++; break;
      default: this.stats.other++; break;
    }
  }
  
  trackUserActivity(userId, queryType) {
    const userStats = this.userQueries.get(userId) || {
      total: 0,
      types: {},
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      suspicious: 0
    };
    
    userStats.total++;
    userStats.types[queryType] = (userStats.types[queryType] || 0) + 1;
    userStats.lastSeen = Date.now();
    
    this.userQueries.set(userId, userStats);
  }
  
  checkSuspiciousPatterns(query, userId, ip) {
    const result = {
      suspicious: false,
      patterns: [],
      action: 'allowed'
    };
    
    // Check against suspicious patterns
    for (const pattern of config.suspicious.patterns) {
      if (pattern.test(query)) {
        result.suspicious = true;
        result.patterns.push(pattern.source);
      }
    }
    
    if (result.suspicious) {
      this.stats.suspicious++;
      this.handleSuspiciousActivity(userId, ip, result.patterns);
      
      // Check if user should be blocked
      const userViolations = this.getUserViolations(userId);
      if (userViolations >= config.suspicious.maxViolationsPerUser) {
        result.action = 'blocked';
        this.stats.blocked++;
      } else {
        result.action = 'warned';
      }
    }
    
    return result;
  }
  
  handleSuspiciousActivity(userId, ip, patterns) {
    const suspiciousRecord = this.suspiciousUsers.get(userId) || {
      violations: 0,
      patterns: new Set(),
      firstViolation: Date.now(),
      lastViolation: Date.now(),
      ip: ip
    };
    
    suspiciousRecord.violations++;
    suspiciousRecord.lastViolation = Date.now();
    patterns.forEach(pattern => suspiciousRecord.patterns.add(pattern));
    
    this.suspiciousUsers.set(userId, suspiciousRecord);
    
    logger.warn('Suspicious SQL activity detected', {
      userId,
      ip,
      violations: suspiciousRecord.violations,
      patterns,
      totalViolations: this.stats.suspicious
    });
  }
  
  getUserViolations(userId) {
    const record = this.suspiciousUsers.get(userId);
    return record ? record.violations : 0;
  }
  
  // ==================== POOL MONITORING ====================
  async startPoolMonitoring() {
    try {
      // Initial check
      await this.checkPoolStatus();
      
      // Schedule periodic checks
      this.poolInterval = setInterval(async () => {
        try {
          await this.checkPoolStatus();
        } catch (error) {
          logger.error('Pool monitoring check failed:', error.message);
        }
      }, config.poolCheck.intervalMs);
      
    } catch (error) {
      logger.error('Failed to start pool monitoring:', error.message);
    }
  }
  
  async checkPoolStatus() {
    try {
      const timestamp = Date.now();
      
      // Usa i pool importati direttamente
      const authStats = this.getPoolStats(authPool, 'auth');
      const templateStats = this.getPoolStats(templatePool, 'template');
      
      const snapshot = {
        timestamp,
        auth: authStats,
        template: templateStats
      };
      
      // Log per debug (rimuovi dopo aver verificato)
      if (!this.poolMetrics.lastCheck) {
        logger.info('Pool monitoring started', {
          authPool: authStats,
          templatePool: templateStats
        });
      }
      
      this.poolMetrics.history.push(snapshot);
      if (this.poolMetrics.history.length > config.poolCheck.maxHistoryEntries) {
        this.poolMetrics.history.shift();
      }
      
      this.poolMetrics.lastCheck = new Date();
      this.poolMetrics.consecutiveErrors = 0;
      this.poolMetrics.isHealthy = true;
      
      this.checkPoolAlerts(snapshot);
      
    } catch (error) {
      this.poolMetrics.consecutiveErrors++;
      this.poolMetrics.isHealthy = this.poolMetrics.consecutiveErrors < 3;
      
      logger.error('Pool status check failed:', {
        error: error.message,
        consecutiveErrors: this.poolMetrics.consecutiveErrors
      });
    }
  }
  
  getPoolStats(pool, poolName) {
    try {
      if (!pool) {
        return {
          name: poolName,
          active: 0,
          idle: 0,
          total: 0,
          queue: 0,
          connectionLimit: 0,
          utilizationPercentage: '0.00',
          error: 'Pool not initialized'
        };
      }
      
      // Per mysql2, i pool hanno questa struttura:
      let active = 0;
      let idle = 0;
      let total = 0;
      let queue = 0;
      let connectionLimit = 10;
      
      // Prova diversi modi di accedere alle proprietà del pool
      if (pool.pool) {
        // mysql2/promise pool structure
        active = pool.pool._allConnections?.length || 0;
        idle = pool.pool._freeConnections?.length || 0;
        queue = pool.pool._connectionQueue?.length || 0;
        total = active + idle;
        connectionLimit = pool.pool.config?.connectionLimit || 10;
      } else if (pool._allConnections) {
        // mysql2 direct pool
        active = pool._allConnections.length - (pool._freeConnections?.length || 0);
        idle = pool._freeConnections?.length || 0;
        queue = pool._connectionQueue?.length || 0;
        total = pool._allConnections.length;
        connectionLimit = pool.config?.connectionLimit || 10;
      }
      
      const utilizationPercentage = connectionLimit > 0 
        ? ((active / connectionLimit) * 100).toFixed(2)
        : '0.00';
      
      return {
        name: poolName,
        active,
        idle,
        total,
        queue,
        connectionLimit,
        utilizationPercentage
      };
    } catch (error) {
      logger.warn(`Failed to get ${poolName} pool stats:`, error.message);
      return {
        name: poolName,
        active: 0,
        idle: 0,
        total: 0,
        queue: 0,
        connectionLimit: 10,
        utilizationPercentage: '0.00',
        error: error.message
      };
    }
  }
  
  checkPoolAlerts(snapshot) {
    const { auth, template } = snapshot;
    const threshold = config.poolCheck.alertThresholds;
    
    // Check utilization alerts
    if (parseFloat(auth.utilizationPercentage) > threshold.utilization) {
      logger.warn('Auth pool high utilization alert', {
        utilization: auth.utilizationPercentage + '%',
        threshold: threshold.utilization + '%'
      });
    }
    
    if (parseFloat(template.utilizationPercentage) > threshold.utilization) {
      logger.warn('Template pool high utilization alert', {
        utilization: template.utilizationPercentage + '%',
        threshold: threshold.utilization + '%'
      });
    }
    
    // Check queue alerts
    if (auth.queue > threshold.queueSize) {
      logger.warn('Auth pool queue alert', {
        queueSize: auth.queue,
        threshold: threshold.queueSize
      });
    }
    
    if (template.queue > threshold.queueSize) {
      logger.warn('Template pool queue alert', {
        queueSize: template.queue,
        threshold: threshold.queueSize
      });
    }
  }
  
  // ==================== UTILITY METHODS ====================
  determineQueryType(query) {
    const upperQuery = query.toUpperCase().trim();
    
    if (upperQuery.startsWith('SELECT') || upperQuery.startsWith('SHOW') || upperQuery.startsWith('DESCRIBE')) {
      return 'SELECT';
    }
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    if (upperQuery.startsWith('CREATE')) return 'CREATE';
    if (upperQuery.startsWith('ALTER')) return 'ALTER';
    if (upperQuery.startsWith('DROP')) return 'DROP';
    if (upperQuery.startsWith('RENAME')) return 'RENAME';
    
    return 'OTHER';
  }
  
  startCleanup() {
    // Periodic cleanup of old data
    this.cleanupInterval = setInterval(() => {
      try {
        this.performCleanup();
      } catch (error) {
        logger.error('Cleanup failed:', error.message);
      }
    }, config.queryLimits.cleanupIntervalMs);
  }
  
  performCleanup() {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;
    
    // Clean old suspicious user records
    for (const [userId, record] of this.suspiciousUsers.data.entries()) {
      if (now - record.lastViolation > cleanupThreshold) {
        this.suspiciousUsers.data.delete(userId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info('SQL Monitor cleanup completed', {
        suspiciousRecordsCleaned: cleaned,
        memoryUsage: this.getMemoryUsage()
      });
    }
  }
  
  // ==================== REPORTING & HEALTH ====================
  getStats() {
    const now = Date.now();
    const runtimeMinutes = (now - this.stats.startTime) / 60000;
    
    return {
      queries: {
        ...this.stats,
        activeUsers: this.userQueries.size(),
        suspiciousUsers: this.suspiciousUsers.size(),
        runtimeMinutes: runtimeMinutes.toFixed(2),
        queriesPerMinute: (this.stats.total / Math.max(runtimeMinutes, 0.1)).toFixed(2)
      },
      pool: this.getPoolMetrics(),
      memory: this.getMemoryUsage(),
      health: {
        isHealthy: this.poolMetrics.isHealthy,
        consecutiveErrors: this.poolMetrics.consecutiveErrors,
        lastCheck: this.poolMetrics.lastCheck
      },
      timestamp: new Date().toISOString(),
    };
  }

  
  
  getPoolMetrics() {
    if (this.poolMetrics.history.length === 0) {
      return { current: null, history: [], trends: null };
    }
    
    const current = this.poolMetrics.history[this.poolMetrics.history.length - 1];
    const trends = this.calculateTrends();
    
    return {
      current,
      trends,
      historyLength: this.poolMetrics.history.length,
      lastCheck: this.poolMetrics.lastCheck
    };
  }
  
  calculateTrends() {
    if (this.poolMetrics.history.length < 5) {
      return { auth: 'insufficient_data', template: 'insufficient_data' };
    }
    
    const recent = this.poolMetrics.history.slice(-5);
    
    const authValues = recent.map(h => parseFloat(h.auth.utilizationPercentage));
    const templateValues = recent.map(h => parseFloat(h.template.utilizationPercentage));
    
    return {
      auth: this.calculateTrend(authValues),
      template: this.calculateTrend(templateValues)
    };
  }
  
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const avgChange = values.slice(1).reduce((sum, val, idx) => {
      return sum + (val - values[idx]);
    }, 0) / (values.length - 1);
    
    if (avgChange > 2) return 'increasing';
    if (avgChange < -2) return 'decreasing';
    return 'stable';
  }
  
  getMemoryUsage() {
    return {
      userQueries: this.userQueries.size(),
      suspiciousUsers: this.suspiciousUsers.size(),
      poolHistory: this.poolMetrics.history.length,
      maxUserQueries: config.queryLimits.maxUserHistory,
      maxPoolHistory: config.poolCheck.maxHistoryEntries
    };
  }
  
  getSuspiciousActivity() {
    const suspicious = [];
    
    for (const [userId, record] of this.suspiciousUsers.data.entries()) {
      suspicious.push({
        userId,
        violations: record.violations,
        patterns: Array.from(record.patterns),
        firstViolation: new Date(record.firstViolation).toISOString(),
        lastViolation: new Date(record.lastViolation).toISOString(),
        ip: record.ip
      });
    }
    
    return suspicious.sort((a, b) => b.violations - a.violations);
  }
  
  // ==================== CLEANUP ====================
  shutdown() {
    if (this.poolInterval) {
      clearInterval(this.poolInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    logger.info('SQL Monitor shutdown completed');
  }
}

// Export singleton instance
const sqlMonitor = new SqlMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
  sqlMonitor.shutdown();
});

process.on('SIGINT', () => {
  sqlMonitor.shutdown();
});

module.exports = sqlMonitor;