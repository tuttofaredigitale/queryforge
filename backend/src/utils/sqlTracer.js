// backend/utils/sqlTracer.js - OPTIMIZED SECURITY EVENT TRACER
// Safe logger import
let logger;
try {
  logger = require('./logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[TRACER INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[TRACER WARN]', msg, data || ''),
    error: (msg, data) => console.error('[TRACER ERROR]', msg, data || '')
  };
}

// =====================================================
// SECURE CONFIGURATION
// =====================================================
class TracerConfig {
  constructor() {
    this.maxEvents = parseInt(process.env.TRACER_MAX_EVENTS) || 200;
    this.maxUsers = parseInt(process.env.TRACER_MAX_USERS) || 1000;
    this.cleanupInterval = parseInt(process.env.TRACER_CLEANUP_MINUTES) * 60 * 1000 || 30 * 60 * 1000; // 30 min
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Enhanced security patterns (more comprehensive than original)
    this.suspiciousPatterns = [
      { pattern: /union\s+select/i, severity: 'high', description: 'SQL Union injection attempt' },
      { pattern: /select.*from.*information_schema/i, severity: 'medium', description: 'Schema reconnaissance' },
      { pattern: /-{2,}/i, severity: 'low', description: 'SQL comment injection' },
      { pattern: /\/\*.*\*\//i, severity: 'low', description: 'Multi-line comment injection' },
      { pattern: /drop\s+(table|database|schema)/i, severity: 'critical', description: 'Destructive SQL operation' },
      { pattern: /truncate\s+table/i, severity: 'high', description: 'Data deletion attempt' },
      { pattern: /delete\s+from.*where\s+1\s*=\s*1/i, severity: 'critical', description: 'Mass deletion attempt' },
      { pattern: /sleep\s*\(/i, severity: 'medium', description: 'Time-based injection test' },
      { pattern: /benchmark\s*\(/i, severity: 'medium', description: 'Performance DoS attempt' },
      { pattern: /into\s+(outfile|dumpfile)/i, severity: 'critical', description: 'File system access attempt' },
      { pattern: /load_file\s*\(/i, severity: 'critical', description: 'File reading attempt' },
      { pattern: /exec\s*\(/i, severity: 'critical', description: 'Command execution attempt' },
      { pattern: /script\s*:/i, severity: 'high', description: 'Script injection attempt' },
      { pattern: /javascript\s*:/i, severity: 'high', description: 'JavaScript injection attempt' }
    ];
    
    logger.info('SQL Tracer configured', {
      maxEvents: this.maxEvents,
      maxUsers: this.maxUsers,
      patterns: this.suspiciousPatterns.length,
      cleanupIntervalMinutes: Math.round(this.cleanupInterval / 60000)
    });
  }
}

const config = new TracerConfig();

// =====================================================
// BOUNDED MEMORY STORAGE
// =====================================================
class BoundedArray {
  constructor(maxSize) {
    this.data = [];
    this.maxSize = maxSize;
  }
  
  push(item) {
    this.data.unshift(item); // Add to beginning (newest first)
    if (this.data.length > this.maxSize) {
      this.data.pop(); // Remove oldest
    }
  }
  
  getRecent(count = 10) {
    return this.data.slice(0, count);
  }
  
  getAll() {
    return [...this.data]; // Return copy
  }
  
  clear() {
    this.data = [];
  }
  
  size() {
    return this.data.length;
  }
  
  filter(predicate) {
    return this.data.filter(predicate);
  }
}

class BoundedSet {
  constructor(maxSize) {
    this.data = new Set();
    this.accessOrder = [];
    this.maxSize = maxSize;
  }
  
  add(item) {
    if (this.data.has(item)) {
      // Update access order
      this.accessOrder = this.accessOrder.filter(x => x !== item);
      this.accessOrder.push(item);
      return;
    }
    
    // Evict oldest if at capacity
    if (this.data.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      this.data.delete(oldest);
    }
    
    this.data.add(item);
    this.accessOrder.push(item);
  }
  
  has(item) {
    return this.data.has(item);
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
// SECURE STORAGE INSTANCES
// =====================================================
const securityEvents = new BoundedArray(config.maxEvents);
const trackedUsers = new BoundedSet(config.maxUsers);

// Statistics with memory bounds
let stats = {
  total: 0,
  select: 0,
  insert: 0,
  update: 0,
  delete: 0,
  other: 0,
  suspiciousCount: 0,
  startTime: Date.now(),
  lastReset: Date.now()
};

// =====================================================
// INPUT VALIDATION
// =====================================================
const validator = {
  query: (query) => {
    if (!query || typeof query !== 'string') return null;
    const trimmed = query.trim();
    if (trimmed.length === 0) return null;
    // Limit query length for security logging
    return trimmed.length > 500 ? trimmed.substring(0, 500) + '...[TRUNCATED]' : trimmed;
  },
  
  userId: (userId) => {
    if (!userId) return 'anonymous';
    const cleaned = String(userId).trim();
    return cleaned.length > 0 && cleaned.length <= 50 ? cleaned : 'invalid_user';
  },
  
  ipAddress: (ip) => {
    if (!ip || typeof ip !== 'string') return 'unknown';
    const cleaned = ip.trim();
    return cleaned.length > 0 && cleaned.length <= 45 ? cleaned : 'invalid_ip';
  }
};

// =====================================================
// CORE TRACING FUNCTIONS
// =====================================================

/**
 * Trace SQL query with security analysis
 */
function traceQuery(query, userId) {
  const cleanQuery = validator.query(query);
  const cleanUserId = validator.userId(userId);
  
  if (!cleanQuery) {
    logger.warn('Invalid query received for tracing', { userId: cleanUserId });
    return false;
  }
  
  // Update statistics
  stats.total++;
  trackedUsers.add(cleanUserId);
  
  // Determine query type and update counters
  const queryType = determineQueryType(cleanQuery);
  updateQueryTypeStats(queryType);
  
  // Security analysis
  const suspiciousResult = analyzeSuspiciousPatterns(cleanQuery, cleanUserId);
  
  // Conditional logging (performance optimization)
  if (!config.isProduction) {
    logger.info('SQL query traced', {
      type: queryType,
      user: cleanUserId,
      suspicious: suspiciousResult.suspicious,
      severity: suspiciousResult.severity,
      queryPreview: cleanQuery.substring(0, 50) + '...'
    });
  }
  
  return {
    suspicious: suspiciousResult.suspicious,
    severity: suspiciousResult.severity,
    patterns: suspiciousResult.patterns
  };
}

/**
 * Determine query type efficiently
 */
function determineQueryType(query) {
  const upperQuery = query.toUpperCase().trim();
  
  if (upperQuery.startsWith('SELECT') || upperQuery.startsWith('SHOW')) {
    return 'SELECT';
  }
  if (upperQuery.startsWith('INSERT')) return 'INSERT';
  if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
  if (upperQuery.startsWith('DELETE')) return 'DELETE';
  
  return 'OTHER';
}

/**
 * Update query type statistics
 */
function updateQueryTypeStats(queryType) {
  switch(queryType) {
    case 'SELECT': stats.select++; break;
    case 'INSERT': stats.insert++; break;
    case 'UPDATE': stats.update++; break;
    case 'DELETE': stats.delete++; break;
    default: stats.other++; break;
  }
}

/**
 * Analyze query for suspicious patterns
 */
function analyzeSuspiciousPatterns(query, userId) {
  const result = {
    suspicious: false,
    severity: 'none',
    patterns: []
  };
  
  let highestSeverity = 'none';
  const severityLevels = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
  
  for (const { pattern, severity, description } of config.suspiciousPatterns) {
    if (pattern.test(query)) {
      result.suspicious = true;
      result.patterns.push(description);
      
      // Track highest severity
      if (severityLevels[severity] > severityLevels[highestSeverity]) {
        highestSeverity = severity;
      }
      
      // Record security event
      addSecurityEvent('SUSPICIOUS_QUERY', userId, description, {
        severity,
        queryPreview: query.substring(0, 100),
        pattern: pattern.source
      });
    }
  }
  
  if (result.suspicious) {
    stats.suspiciousCount++;
    result.severity = highestSeverity;
  }
  
  return result;
}

/**
 * Add security event with enhanced context
 */
function addSecurityEvent(eventType, userId, details, metadata = {}) {
  const event = {
    id: generateEventId(),
    type: eventType,
    timestamp: new Date().toISOString(),
    userId: validator.userId(userId),
    details,
    severity: metadata.severity || 'medium',
    metadata: {
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      queryPreview: metadata.queryPreview,
      pattern: metadata.pattern,
      endpoint: metadata.endpoint
    }
  };
  
  securityEvents.push(event);
  
  // Log based on severity
  const logMethod = event.severity === 'critical' ? 'error' : 
                   event.severity === 'high' ? 'warn' : 'info';
  
  logger[logMethod]('Security event detected', {
    eventId: event.id,
    type: eventType,
    userId: event.userId,
    severity: event.severity,
    details
  });
  
  return event;
}

/**
 * Generate unique event ID
 */
function generateEventId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =====================================================
// SPECIALIZED TRACING FUNCTIONS
// =====================================================

/**
 * Trace authentication events
 */
function traceLogin(userId, success, ipAddress, userAgent = '') {
  const eventType = success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE';
  const severity = success ? 'low' : 'medium';
  
  addSecurityEvent(eventType, userId, 
    success ? 'Successful authentication' : 'Failed authentication attempt', 
    {
      severity,
      ipAddress: validator.ipAddress(ipAddress),
      userAgent
    }
  );
}

/**
 * Trace rate limiting violations
 */
function traceRateLimitExceeded(userId, endpoint, requestCount, ipAddress = '') {
  addSecurityEvent('RATE_LIMIT_EXCEEDED', userId,
    `Rate limit exceeded: ${requestCount} requests to ${endpoint}`,
    {
      severity: 'medium',
      endpoint,
      requestCount,
      ipAddress: validator.ipAddress(ipAddress)
    }
  );
}

/**
 * Trace unauthorized access attempts
 */
function traceUnauthorizedAccess(userId, resource, action, ipAddress = '') {
  addSecurityEvent('UNAUTHORIZED_ACCESS', userId,
    `Unauthorized ${action} attempt on ${resource}`,
    {
      severity: 'high',
      resource,
      action,
      ipAddress: validator.ipAddress(ipAddress)
    }
  );
}

// =====================================================
// STATISTICS & REPORTING
// =====================================================

/**
 * Get current statistics
 */
function getStats() {
  const now = Date.now();
  const runtimeMinutes = (now - stats.startTime) / 60000;
  const resetMinutes = (now - stats.lastReset) / 60000;
  
  return {
    queries: {
      total: stats.total,
      select: stats.select,
      insert: stats.insert,
      update: stats.update,
      delete: stats.delete,
      other: stats.other,
      suspicious: stats.suspiciousCount
    },
    users: {
      active: trackedUsers.size(),
      maxTracked: config.maxUsers
    },
    performance: {
      runtimeMinutes: runtimeMinutes.toFixed(2),
      resetMinutes: resetMinutes.toFixed(2),
      queriesPerMinute: (stats.total / Math.max(runtimeMinutes, 0.1)).toFixed(2),
      suspiciousRate: stats.total > 0 ? ((stats.suspiciousCount / stats.total) * 100).toFixed(2) + '%' : '0%'
    },
    memory: {
      eventsStored: securityEvents.size(),
      maxEvents: config.maxEvents
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Get security events with filtering
 */
function getSecurityEvents(options = {}) {
  const {
    type = null,
    severity = null,
    userId = null,
    limit = 20,
    since = null
  } = options;
  
  let events = securityEvents.getAll();
  
  // Apply filters
  if (type) {
    events = events.filter(e => e.type === type);
  }
  
  if (severity) {
    events = events.filter(e => e.severity === severity);
  }
  
  if (userId) {
    events = events.filter(e => e.userId === userId);
  }
  
  if (since) {
    const sinceDate = new Date(since);
    events = events.filter(e => new Date(e.timestamp) > sinceDate);
  }
  
  // Limit results
  events = events.slice(0, limit);
  
  return {
    total: securityEvents.size(),
    filtered: events.length,
    events,
    summary: {
      suspicious_queries: securityEvents.filter(e => e.type === 'SUSPICIOUS_QUERY').length,
      login_failures: securityEvents.filter(e => e.type === 'LOGIN_FAILURE').length,
      rate_limit_exceeded: securityEvents.filter(e => e.type === 'RATE_LIMIT_EXCEEDED').length,
      unauthorized_access: securityEvents.filter(e => e.type === 'UNAUTHORIZED_ACCESS').length
    }
  };
}

/**
 * Get threat intelligence summary
 */
function getThreatSummary() {
  const recentEvents = securityEvents.getRecent(50);
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  
  const recentThreats = recentEvents.filter(e => 
    new Date(e.timestamp).getTime() > hourAgo
  );
  
  const threatsByType = {};
  const threatsBySeverity = {};
  
  recentThreats.forEach(event => {
    threatsByType[event.type] = (threatsByType[event.type] || 0) + 1;
    threatsBySeverity[event.severity] = (threatsBySeverity[event.severity] || 0) + 1;
  });
  
  return {
    period: 'last_hour',
    totalThreats: recentThreats.length,
    threatsByType,
    threatsBySeverity,
    topThreats: Object.entries(threatsByType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))
  };
}

// =====================================================
// MAINTENANCE & CLEANUP
// =====================================================

/**
 * Reset statistics (keep security events)
 */
function resetStats() {
  const previousTotal = stats.total;
  
  stats = {
    total: 0,
    select: 0,
    insert: 0,
    update: 0,
    delete: 0,
    other: 0,
    suspiciousCount: 0,
    startTime: Date.now(),
    lastReset: Date.now()
  };
  
  // Clear user tracking but keep capacity
  trackedUsers.clear();
  
  logger.info('SQL Tracer statistics reset', {
    previousTotal,
    resetTime: new Date().toISOString()
  });
}

/**
 * Periodic cleanup (not needed with bounded storage, but useful for metrics)
 */
function performMaintenance() {
  const stats = getStats();
  
  logger.info('SQL Tracer maintenance completed', {
    events: stats.memory.eventsStored,
    users: stats.users.active,
    queries: stats.queries.total,
    suspicious: stats.queries.suspicious
  });
}

// =====================================================
// INITIALIZATION & SCHEDULING
// =====================================================

// Start maintenance scheduler
setInterval(performMaintenance, config.cleanupInterval);

// Export functions
module.exports = {
  // Core tracing
  traceQuery,
  
  // Specialized events
  traceLogin,
  traceRateLimitExceeded,
  traceUnauthorizedAccess,
  addSecurityEvent,
  
  // Statistics & reporting
  getStats,
  getSecurityEvents,
  getThreatSummary,
  
  // Maintenance
  resetStats,
  
  // Configuration access
  getConfig: () => ({
    maxEvents: config.maxEvents,
    maxUsers: config.maxUsers,
    patterns: config.suspiciousPatterns.length
  })
};