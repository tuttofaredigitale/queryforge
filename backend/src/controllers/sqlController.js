// utils/sqlMonitor.js - Enterprise SQL Analytics & Monitoring

const logger = require('./logger');

// =====================================================
// CONSTANTS & CONFIGURATION
// =====================================================
const CONFIG = {
  MONITORING: {
    MAX_USER_ENTRIES: parseInt(process.env.SQL_MONITOR_MAX_USERS) || 10000,
    CLEANUP_INTERVAL: parseInt(process.env.SQL_MONITOR_CLEANUP_INTERVAL) || 300000, // 5 minutes
    STATS_RETENTION_HOURS: parseInt(process.env.SQL_MONITOR_RETENTION_HOURS) || 24,
    SUSPICIOUS_THRESHOLD: parseInt(process.env.SQL_MONITOR_SUSPICIOUS_THRESHOLD) || 100
  },
  RATE_LIMITING: {
    QUERIES_PER_MINUTE: parseInt(process.env.SQL_MONITOR_QPM_LIMIT) || 60,
    QUERIES_PER_HOUR: parseInt(process.env.SQL_MONITOR_QPH_LIMIT) || 1000,
    BURST_THRESHOLD: parseInt(process.env.SQL_MONITOR_BURST_THRESHOLD) || 10
  },
  ANALYTICS: {
    TIME_WINDOWS: [1, 5, 15, 60], // minutes for time-based analytics
    QUERY_COMPLEXITY_THRESHOLD: parseInt(process.env.SQL_QUERY_COMPLEXITY_THRESHOLD) || 1000
  },
  ALERTS: {
    ENABLED: process.env.SQL_MONITOR_ALERTS_ENABLED === 'true',
    ERROR_RATE_THRESHOLD: parseFloat(process.env.SQL_MONITOR_ERROR_RATE_THRESHOLD) || 0.1, // 10%
    UNUSUAL_ACTIVITY_MULTIPLIER: parseFloat(process.env.SQL_MONITOR_UNUSUAL_MULTIPLIER) || 3.0
  }
};

// =====================================================
// SQL MONITOR CLASS
// =====================================================
class SqlMonitor {
  constructor() {
    this.initializeMonitoring();
    this.startBackgroundTasks();
    
    logger.info('SQL Monitor initialized', {
      maxUsers: CONFIG.MONITORING.MAX_USER_ENTRIES,
      retentionHours: CONFIG.MONITORING.STATS_RETENTION_HOURS,
      operation: 'sql_monitor_init'
    });
  }
  
  /**
   * Initializes monitoring data structures
   */
  initializeMonitoring() {
    // Global statistics
    this.queryStats = {
      total: 0,
      select: 0,
      insert: 0,
      update: 0,
      delete: 0,
      create: 0,
      alter: 0,
      drop: 0,
      other: 0,
      suspiciousCount: 0,
      errorCount: 0,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    // User-specific tracking
    this.userQueries = new Map(); // userId -> UserQueryData
    this.userSessions = new Map(); // sessionId -> SessionData
    this.ipTracking = new Map(); // ip -> IpData
    
    // Time-based analytics
    this.timeWindows = new Map(); // windowSize -> TimeWindowData
    CONFIG.ANALYTICS.TIME_WINDOWS.forEach(window => {
      this.timeWindows.set(window, {
        queries: [],
        maxSize: window * 60 // entries per window (assuming 1 entry per second)
      });
    });
    
    // Suspicious activity patterns
    this.suspiciousPatterns = [
      { pattern: /union\s+select/i, severity: 'high', description: 'SQL Injection - UNION SELECT' },
      { pattern: /'\s*or\s*'1'\s*=\s*'1/i, severity: 'high', description: 'SQL Injection - OR 1=1' },
      { pattern: /;\s*drop\s+table/i, severity: 'critical', description: 'Destructive Operation - DROP TABLE' },
      { pattern: /;\s*delete\s+from/i, severity: 'high', description: 'Destructive Operation - DELETE FROM' },
      { pattern: /load_file\s*\(/i, severity: 'medium', description: 'File System Access' },
      { pattern: /into\s+outfile/i, severity: 'medium', description: 'File System Write' },
      { pattern: /benchmark\s*\(/i, severity: 'medium', description: 'Performance Attack' },
      { pattern: /sleep\s*\(/i, severity: 'medium', description: 'Timing Attack' },
      { pattern: /@@version/i, severity: 'low', description: 'Information Gathering' }
    ];
    
    // Alert state
    this.alertState = {
      lastAlertTime: 0,
      alertCooldown: 300000, // 5 minutes
      consecutiveAnomalies: 0
    };
  }
  
  /**
   * Starts background monitoring tasks
   */
  startBackgroundTasks() {
    // Periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, CONFIG.MONITORING.CLEANUP_INTERVAL);
    
    // Periodic analytics computation
    this.analyticsInterval = setInterval(() => {
      this.computeAnalytics();
    }, 60000); // Every minute
    
    logger.debug('SQL Monitor background tasks started');
  }
  
  /**
   * Monitors and analyzes SQL query with comprehensive tracking
   */
  monitorQuery(query, userId = 'anonymous', ip = 'unknown', sessionId = 'unknown', metadata = {}) {
    if (!query || typeof query !== 'string') {
      logger.warn('Attempted to monitor empty or invalid query', {
        userId,
        ip,
        sessionId,
        operation: 'sql_monitor_invalid_query'
      });
      return { suspicious: false, blocked: false };
    }
    
    const startTime = Date.now();
    
    try {
      // Basic query analysis
      const analysis = this.analyzeQuery(query);
      
      // Update global statistics
      this.updateGlobalStats(analysis);
      
      // Update user-specific tracking
      const userActivity = this.updateUserTracking(userId, analysis, ip, sessionId);
      
      // Update session tracking
      this.updateSessionTracking(sessionId, userId, analysis);
      
      // Update IP tracking
      this.updateIpTracking(ip, userId, analysis);
      
      // Update time-based analytics
      this.updateTimeBasedAnalytics(analysis);
      
      // Perform security analysis
      const securityAnalysis = this.performSecurityAnalysis(query, userId, ip);
      
      // Check for rate limiting violations
      const rateLimitAnalysis = this.checkRateLimits(userId, ip);
      
      // Detect anomalies
      const anomalyAnalysis = this.detectAnomalies(userId, analysis);
      
      // Combine all analysis results
      const result = {
        suspicious: securityAnalysis.suspicious || anomalyAnalysis.suspicious,
        blocked: rateLimitAnalysis.blocked,
        warnings: [
          ...securityAnalysis.warnings,
          ...rateLimitAnalysis.warnings,
          ...anomalyAnalysis.warnings
        ],
        analysis: {
          queryType: analysis.type,
          complexity: analysis.complexity,
          executionTime: Date.now() - startTime,
          riskLevel: securityAnalysis.riskLevel
        },
        userActivity: {
          totalQueries: userActivity.totalQueries,
          queriesThisMinute: userActivity.queriesThisMinute,
          queriesThisHour: userActivity.queriesThisHour
        }
      };
      
      // Log the monitoring result
      if (result.suspicious || result.blocked) {
        logger.warn('Suspicious or blocked SQL activity detected', {
          userId,
          ip,
          sessionId,
          queryType: analysis.type,
          queryPreview: query.substring(0, 100) + '...',
          riskLevel: securityAnalysis.riskLevel,
          warnings: result.warnings,
          operation: 'sql_monitor_security_alert'
        });
        
        this.queryStats.suspiciousCount++;
        this.triggerSecurityAlert(userId, ip, result);
      } else {
        logger.debug('SQL query monitored successfully', {
          userId,
          queryType: analysis.type,
          complexity: analysis.complexity,
          operation: 'sql_monitor_success'
        });
      }
      
      this.queryStats.lastActivity = Date.now();
      
      return result;
      
    } catch (error) {
      logger.error('Error in SQL monitoring', {
        userId,
        ip,
        sessionId,
        error: error.message,
        stack: error.stack,
        operation: 'sql_monitor_error'
      });
      
      this.queryStats.errorCount++;
      
      return { 
        suspicious: false, 
        blocked: false, 
        error: true,
        message: 'Error in query monitoring'
      };
    }
  }
  
  /**
   * Analyzes query structure and characteristics
   */
  analyzeQuery(query) {
    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    const type = this.determineQueryType(upperQuery);
    
    // Calculate complexity score
    const complexity = this.calculateQueryComplexity(query);
    
    // Extract table names
    const tables = this.extractTableNames(upperQuery);
    
    // Detect query patterns
    const patterns = this.detectQueryPatterns(upperQuery);
    
    return {
      type,
      complexity,
      length: query.length,
      tables,
      patterns,
      hasSubqueries: /\(\s*select/i.test(query),
      hasJoins: /\b(inner|left|right|full|cross)\s+join\b/i.test(upperQuery),
      hasAggregates: /\b(count|sum|avg|min|max|group\s+by)\b/i.test(upperQuery),
      timestamp: Date.now()
    };
  }
  
  /**
   * Determines the primary type of SQL query
   */
  determineQueryType(upperQuery) {
    const typeMap = {
      'SELECT': 'SELECT',
      'INSERT': 'INSERT', 
      'UPDATE': 'UPDATE',
      'DELETE': 'DELETE',
      'CREATE': 'CREATE',
      'ALTER': 'ALTER',
      'DROP': 'DROP',
      'SHOW': 'SELECT', // Treat SHOW as SELECT for statistics
      'DESCRIBE': 'SELECT',
      'EXPLAIN': 'SELECT',
      'TRUNCATE': 'DELETE', // Treat TRUNCATE as DELETE for statistics
      'REPLACE': 'INSERT' // Treat REPLACE as INSERT for statistics
    };
    
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (upperQuery.startsWith(keyword)) {
        return type;
      }
    }
    
    return 'OTHER';
  }
  
  /**
   * Calculates query complexity score
   */
  calculateQueryComplexity(query) {
    let score = 1;
    
    // Base complexity from length
    score += Math.floor(query.length / 100);
    
    // Add complexity for various SQL features
    const complexityFactors = [
      { pattern: /\bsubquery\b|\(\s*select/gi, weight: 3 },
      { pattern: /\bjoin\b/gi, weight: 2 },
      { pattern: /\bunion\b/gi, weight: 2 },
      { pattern: /\bgroup\s+by\b/gi, weight: 2 },
      { pattern: /\border\s+by\b/gi, weight: 1 },
      { pattern: /\bhaving\b/gi, weight: 2 },
      { pattern: /\bcase\s+when\b/gi, weight: 1 },
      { pattern: /\bexists\b/gi, weight: 2 },
      { pattern: /\bin\s*\(/gi, weight: 1 }
    ];
    
    complexityFactors.forEach(factor => {
      const matches = query.match(factor.pattern);
      if (matches) {
        score += matches.length * factor.weight;
      }
    });
    
    return Math.min(score, 100); // Cap at 100
  }
  
  /**
   * Extracts table names from query
   */
  extractTableNames(upperQuery) {
    const tables = new Set();
    
    // Simple regex patterns for common table references
    const patterns = [
      /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /join\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /update\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(upperQuery)) !== null) {
        if (match[1] && !['SELECT', 'WHERE', 'AND', 'OR'].includes(match[1])) {
          tables.add(match[1].toLowerCase());
        }
      }
    });
    
    return Array.from(tables);
  }
  
  /**
   * Detects specific query patterns
   */
  detectQueryPatterns(upperQuery) {
    const patterns = {
      wildcard: /select\s+\*/i.test(upperQuery),
      limitPresent: /\blimit\b/i.test(upperQuery),
      whereClause: /\bwhere\b/i.test(upperQuery),
      multipleStatements: /;\s*\w+/g.test(upperQuery)
    };
    
    return patterns;
  }
  
  /**
   * Updates global query statistics
   */
  updateGlobalStats(analysis) {
    this.queryStats.total++;
    
    switch (analysis.type) {
      case 'SELECT': this.queryStats.select++; break;
      case 'INSERT': this.queryStats.insert++; break;
      case 'UPDATE': this.queryStats.update++; break;
      case 'DELETE': this.queryStats.delete++; break;
      case 'CREATE': this.queryStats.create++; break;
      case 'ALTER': this.queryStats.alter++; break;
      case 'DROP': this.queryStats.drop++; break;
      default: this.queryStats.other++; break;
    }
  }
  
  /**
   * Updates user-specific activity tracking
   */
  updateUserTracking(userId, analysis, ip, sessionId) {
    if (!this.userQueries.has(userId)) {
      this.userQueries.set(userId, {
        totalQueries: 0,
        queryTypes: {},
        firstQuery: Date.now(),
        lastQuery: Date.now(),
        queries: [],
        ips: new Set(),
        sessions: new Set(),
        suspicious: 0,
        riskScore: 0
      });
    }
    
    const userData = this.userQueries.get(userId);
    userData.totalQueries++;
    userData.lastQuery = Date.now();
    userData.ips.add(ip);
    userData.sessions.add(sessionId);
    
    // Update query type counts
    if (!userData.queryTypes[analysis.type]) {
      userData.queryTypes[analysis.type] = 0;
    }
    userData.queryTypes[analysis.type]++;
    
    // Keep recent queries for rate limiting (last hour)
    const oneHourAgo = Date.now() - 3600000;
    userData.queries = userData.queries.filter(q => q.timestamp > oneHourAgo);
    userData.queries.push({
      timestamp: Date.now(),
      type: analysis.type,
      complexity: analysis.complexity
    });
    
    // Calculate rate limiting metrics
    const oneMinuteAgo = Date.now() - 60000;
    const queriesThisMinute = userData.queries.filter(q => q.timestamp > oneMinuteAgo).length;
    const queriesThisHour = userData.queries.length;
    
    return {
      totalQueries: userData.totalQueries,
      queriesThisMinute,
      queriesThisHour
    };
  }
  
  /**
   * Updates session-specific tracking
   */
  updateSessionTracking(sessionId, userId, analysis) {
    if (!this.userSessions.has(sessionId)) {
      this.userSessions.set(sessionId, {
        userId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        queryCount: 0,
        queryTypes: {}
      });
    }
    
    const sessionData = this.userSessions.get(sessionId);
    sessionData.lastActivity = Date.now();
    sessionData.queryCount++;
    
    if (!sessionData.queryTypes[analysis.type]) {
      sessionData.queryTypes[analysis.type] = 0;
    }
    sessionData.queryTypes[analysis.type]++;
  }
  
  /**
   * Updates IP-based tracking
   */
  updateIpTracking(ip, userId, analysis) {
    if (!this.ipTracking.has(ip)) {
      this.ipTracking.set(ip, {
        users: new Set(),
        queryCount: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        suspicious: 0
      });
    }
    
    const ipData = this.ipTracking.get(ip);
    ipData.users.add(userId);
    ipData.queryCount++;
    ipData.lastSeen = Date.now();
  }
  
  /**
   * Updates time-based analytics windows
   */
  updateTimeBasedAnalytics(analysis) {
    const now = Date.now();
    
    this.timeWindows.forEach((windowData, windowSize) => {
      const cutoffTime = now - (windowSize * 60 * 1000);
      
      // Remove old entries
      windowData.queries = windowData.queries.filter(q => q.timestamp > cutoffTime);
      
      // Add new entry
      windowData.queries.push({
        timestamp: now,
        type: analysis.type,
        complexity: analysis.complexity
      });
      
      // Maintain size limit
      if (windowData.queries.length > windowData.maxSize) {
        windowData.queries = windowData.queries.slice(-windowData.maxSize);
      }
    });
  }
  
  /**
   * Performs security analysis on the query
   */
  performSecurityAnalysis(query, userId, ip) {
    const warnings = [];
    let riskLevel = 'low';
    let suspicious = false;
    
    // Check against suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.pattern.test(query)) {
        warnings.push({
          type: 'suspicious_pattern',
          severity: pattern.severity,
          description: pattern.description,
          pattern: pattern.pattern.toString()
        });
        
        if (pattern.severity === 'critical' || pattern.severity === 'high') {
          suspicious = true;
          riskLevel = pattern.severity;
        }
      }
    }
    
    return { suspicious, warnings, riskLevel };
  }
  
  /**
   * Checks for rate limiting violations
   */
  checkRateLimits(userId, ip) {
    const warnings = [];
    let blocked = false;
    
    const userData = this.userQueries.get(userId);
    if (userData) {
      const oneMinuteAgo = Date.now() - 60000;
      const queriesThisMinute = userData.queries.filter(q => q.timestamp > oneMinuteAgo).length;
      const queriesThisHour = userData.queries.length;
      
      if (queriesThisMinute > CONFIG.RATE_LIMITING.QUERIES_PER_MINUTE) {
        warnings.push({
          type: 'rate_limit_minute',
          severity: 'medium',
          description: `Exceeded queries per minute limit (${queriesThisMinute}/${CONFIG.RATE_LIMITING.QUERIES_PER_MINUTE})`
        });
        blocked = true;
      }
      
      if (queriesThisHour > CONFIG.RATE_LIMITING.QUERIES_PER_HOUR) {
        warnings.push({
          type: 'rate_limit_hour',
          severity: 'high',
          description: `Exceeded queries per hour limit (${queriesThisHour}/${CONFIG.RATE_LIMITING.QUERIES_PER_HOUR})`
        });
        blocked = true;
      }
    }
    
    return { blocked, warnings };
  }
  
  /**
   * Detects anomalous user behavior
   */
  detectAnomalies(userId, analysis) {
    const warnings = [];
    let suspicious = false;
    
    const userData = this.userQueries.get(userId);
    if (userData && userData.totalQueries > 10) { // Only check after some baseline
      // Check for unusual query complexity
      const avgComplexity = userData.queries.reduce((sum, q) => sum + q.complexity, 0) / userData.queries.length;
      if (analysis.complexity > avgComplexity * CONFIG.ALERTS.UNUSUAL_ACTIVITY_MULTIPLIER) {
        warnings.push({
          type: 'unusual_complexity',
          severity: 'medium',
          description: `Query complexity (${analysis.complexity}) significantly higher than user average (${avgComplexity.toFixed(2)})`
        });
        suspicious = true;
      }
    }
    
    return { suspicious, warnings };
  }
  
  /**
   * Triggers security alerts for suspicious activity
   */
  triggerSecurityAlert(userId, ip, result) {
    const now = Date.now();
    
    // Implement alert cooldown to prevent spam
    if (now - this.alertState.lastAlertTime < this.alertState.alertCooldown) {
      return;
    }
    
    if (CONFIG.ALERTS.ENABLED) {
      logger.warn('Security alert triggered', {
        userId,
        ip,
        riskLevel: result.analysis.riskLevel,
        warnings: result.warnings,
        blocked: result.blocked,
        operation: 'sql_monitor_security_alert'
      });
      
      this.alertState.lastAlertTime = now;
      this.alertState.consecutiveAnomalies++;
      
      // Here you could integrate with external alerting systems
      // like Slack, email, or monitoring services
    }
  }
  
  /**
   * Performs periodic cleanup to prevent memory leaks
   */
  performCleanup() {
    const now = Date.now();
    const retentionTime = CONFIG.MONITORING.STATS_RETENTION_HOURS * 3600000;
    const cutoffTime = now - retentionTime;
    
    let cleanedUsers = 0;
    let cleanedSessions = 0;
    let cleanedIPs = 0;
    
    // Cleanup user data
    for (const [userId, userData] of this.userQueries.entries()) {
      if (userData.lastQuery < cutoffTime) {
        this.userQueries.delete(userId);
        cleanedUsers++;
      } else {
        // Clean old queries within active users
        userData.queries = userData.queries.filter(q => q.timestamp > cutoffTime);
      }
    }
    
    // Cleanup session data
    for (const [sessionId, sessionData] of this.userSessions.entries()) {
      if (sessionData.lastActivity < cutoffTime) {
        this.userSessions.delete(sessionId);
        cleanedSessions++;
      }
    }
    
    // Cleanup IP data
    for (const [ip, ipData] of this.ipTracking.entries()) {
      if (ipData.lastSeen < cutoffTime) {
        this.ipTracking.delete(ip);
        cleanedIPs++;
      }
    }
    
    // Respect maximum entries limit
    if (this.userQueries.size > CONFIG.MONITORING.MAX_USER_ENTRIES) {
      const sortedUsers = Array.from(this.userQueries.entries())
        .sort((a, b) => a[1].lastQuery - b[1].lastQuery)
        .slice(0, this.userQueries.size - CONFIG.MONITORING.MAX_USER_ENTRIES);
      
      sortedUsers.forEach(([userId]) => {
        this.userQueries.delete(userId);
        cleanedUsers++;
      });
    }
    
    if (cleanedUsers > 0 || cleanedSessions > 0 || cleanedIPs > 0) {
      logger.info('SQL Monitor cleanup completed', {
        cleanedUsers,
        cleanedSessions,
        cleanedIPs,
        remainingUsers: this.userQueries.size,
        remainingSessions: this.userSessions.size,
        remainingIPs: this.ipTracking.size,
        operation: 'sql_monitor_cleanup'
      });
    }
  }
  
  /**
   * Computes and logs analytics
   */
  computeAnalytics() {
    try {
      const analytics = this.getAdvancedAnalytics();
      
      // Log analytics for monitoring
      logger.info('SQL Monitor Analytics', {
        ...analytics.summary,
        operation: 'sql_monitor_analytics'
      });
      
      // Check for anomalies in system behavior
      this.checkSystemAnomalies(analytics);
      
    } catch (error) {
      logger.error('Error computing SQL analytics', {
        error: error.message,
        operation: 'sql_monitor_analytics_error'
      });
    }
  }
  
  /**
   * Checks for system-wide anomalies
   */
  checkSystemAnomalies(analytics) {
    const { summary } = analytics;
    
    // Check error rate
    if (summary.errorRate > CONFIG.ALERTS.ERROR_RATE_THRESHOLD) {
      logger.warn('High error rate detected in SQL monitoring', {
        errorRate: summary.errorRate,
        threshold: CONFIG.ALERTS.ERROR_RATE_THRESHOLD,
        operation: 'sql_monitor_high_error_rate'
      });
    }
    
    // Check for unusual activity patterns
    if (summary.queriesPerMinute > 0) {
      const expectedQPM = summary.averageQPM || 1;
      if (summary.queriesPerMinute > expectedQPM * CONFIG.ALERTS.UNUSUAL_ACTIVITY_MULTIPLIER) {
        logger.warn('Unusual query activity detected', {
          currentQPM: summary.queriesPerMinute,
          expectedQPM,
          multiplier: CONFIG.ALERTS.UNUSUAL_ACTIVITY_MULTIPLIER,
          operation: 'sql_monitor_unusual_activity'
        });
      }
    }
  }
  
  /**
   * Gets basic statistics for backward compatibility
   */
  getStats() {
    try {
      const now = Date.now();
      const runtimeMinutes = (now - this.queryStats.startTime) / 60000;
      
      return {
        ...this.queryStats,
        activeUsers: this.userQueries.size,
        activeSessions: this.userSessions.size,
        trackedIPs: this.ipTracking.size,
        runtimeMinutes: runtimeMinutes.toFixed(2),
        queriesPerMinute: (this.queryStats.total / Math.max(runtimeMinutes, 0.1)).toFixed(2),
        errorRate: this.queryStats.total > 0 ? (this.queryStats.errorCount / this.queryStats.total) : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting SQL Monitor stats', {
        error: error.message,
        operation: 'sql_monitor_get_stats_error'
      });
      
      return {
        total: 0,
        select: 0,
        insert: 0,
        update: 0,
        delete: 0,
        create: 0,
        alter: 0,
        drop: 0,
        other: 0,
        suspiciousCount: 0,
        errorCount: 0,
        activeUsers: 0,
        activeSessions: 0,
        trackedIPs: 0,
        runtimeMinutes: '0.00',
        queriesPerMinute: '0.00',
        errorRate: 0,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Gets advanced analytics and insights
   */
  getAdvancedAnalytics() {
    const basicStats = this.getStats();
    const now = Date.now();
    
    // Time-based analytics
    const timeAnalytics = {};
    this.timeWindows.forEach((windowData, windowSize) => {
      const queries = windowData.queries;
      timeAnalytics[`${windowSize}min`] = {
        totalQueries: queries.length,
        queryTypes: this.groupBy(queries, 'type'),
        averageComplexity: queries.length > 0 ? 
          queries.reduce((sum, q) => sum + q.complexity, 0) / queries.length : 0,
        queryRate: queries.length / windowSize // queries per minute
      };
    });
    
    // Top users analysis
    const topUsers = Array.from(this.userQueries.entries())
      .sort((a, b) => b[1].totalQueries - a[1].totalQueries)
      .slice(0, 10)
      .map(([userId, data]) => ({
        userId,
        totalQueries: data.totalQueries,
        queryTypes: data.queryTypes,
        riskScore: data.riskScore,
        uniqueIPs: data.ips.size,
        uniqueSessions: data.sessions.size
      }));
    
    // IP analysis
    const topIPs = Array.from(this.ipTracking.entries())
      .sort((a, b) => b[1].queryCount - a[1].queryCount)
      .slice(0, 10)
      .map(([ip, data]) => ({
        ip,
        queryCount: data.queryCount,
        uniqueUsers: data.users.size,
        suspicious: data.suspicious,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen
      }));
    
    return {
      summary: basicStats,
      timeWindows: timeAnalytics,
      topUsers,
      topIPs,
      patterns: {
        mostCommonQueryType: this.getMostCommonQueryType(),
        averageComplexity: this.getAverageComplexity(),
        peakHours: this.getPeakHours()
      },
      security: {
        suspiciousActivities: this.queryStats.suspiciousCount,
        riskDistribution: this.getRiskDistribution(),
        blockedQueries: this.getBlockedQueriesCount()
      }
    };
  }
  
  /**
   * Helper method to group array by property
   */
  groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }
  
  /**
   * Gets the most common query type
   */
  getMostCommonQueryType() {
    const types = ['select', 'insert', 'update', 'delete', 'create', 'alter', 'drop', 'other'];
    let maxType = 'select';
    let maxCount = this.queryStats.select;
    
    types.forEach(type => {
      if (this.queryStats[type] > maxCount) {
        maxCount = this.queryStats[type];
        maxType = type;
      }
    });
    
    return { type: maxType.toUpperCase(), count: maxCount };
  }
  
  /**
   * Gets average query complexity across all users
   */
  getAverageComplexity() {
    let totalComplexity = 0;
    let queryCount = 0;
    
    for (const userData of this.userQueries.values()) {
      for (const query of userData.queries) {
        totalComplexity += query.complexity;
        queryCount++;
      }
    }
    
    return queryCount > 0 ? totalComplexity / queryCount : 0;
  }
  
  /**
   * Identifies peak usage hours (simplified)
   */
  getPeakHours() {
    // This would typically analyze historical data
    // For now, return current hour as peak
    return {
      hour: new Date().getHours(),
      queriesInHour: this.timeWindows.get(60)?.queries.length || 0
    };
  }
  
  /**
   * Gets risk distribution across users
   */
  getRiskDistribution() {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    
    for (const userData of this.userQueries.values()) {
      if (userData.suspicious === 0) distribution.low++;
      else if (userData.suspicious <= 2) distribution.medium++;
      else if (userData.suspicious <= 5) distribution.high++;
      else distribution.critical++;
    }
    
    return distribution;
  }
  
  /**
   * Gets count of blocked queries
   */
  getBlockedQueriesCount() {
    // This would need to be tracked separately in the monitoring
    // For now, estimate based on suspicious count
    return Math.floor(this.queryStats.suspiciousCount * 0.8);
  }
  
  /**
   * Exports analytics data for external analysis
   */
  exportAnalytics(format = 'json') {
    const analytics = this.getAdvancedAnalytics();
    
    if (format === 'csv') {
      // Convert to CSV format for external tools
      const rows = [];
      rows.push(['Metric', 'Value']);
      rows.push(['Total Queries', analytics.summary.total]);
      rows.push(['Active Users', analytics.summary.activeUsers]);
      rows.push(['Error Rate', analytics.summary.errorRate]);
      rows.push(['Suspicious Count', analytics.summary.suspiciousCount]);
      
      return rows.map(row => row.join(',')).join('\n');
    }
    
    return analytics;
  }
  
  /**
   * Safely shuts down the monitor
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    
    logger.info('SQL Monitor shutdown completed', {
      totalQueries: this.queryStats.total,
      runtime: ((Date.now() - this.queryStats.startTime) / 60000).toFixed(2) + ' minutes',
      operation: 'sql_monitor_shutdown'
    });
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

// Export singleton instance
const sqlMonitor = new SqlMonitor();

// Graceful shutdown handlers
process.on('SIGTERM', () => sqlMonitor.shutdown());
process.on('SIGINT', () => sqlMonitor.shutdown());

module.exports = sqlMonitor;