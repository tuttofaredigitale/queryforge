// backend/utils/abuseProtectionService.js

// Safe logger import
let logger;
try {
  logger = require('./logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[WARN]', msg, data || ''),
    error: (msg, data) => console.error('[ERROR]', msg, data || '')
  };
}

// =====================================================
// SECURE CONFIGURATION MANAGEMENT
// =====================================================
class AbuseConfig {
  constructor() {
    // Account limits
    this.limits = {
      accountCreation: {
        max: parseInt(process.env.ACCOUNT_CREATION_LIMIT) || 1,
        windowMs: (parseInt(process.env.ABUSE_TIME_WINDOW_HOURS) || 24) * 60 * 60 * 1000
      },
      accountDeletion: {
        max: parseInt(process.env.ACCOUNT_DELETION_LIMIT) || 1,
        windowMs: (parseInt(process.env.ABUSE_TIME_WINDOW_HOURS) || 24) * 60 * 60 * 1000
      },
      passwordReset: {
        max: parseInt(process.env.PASSWORD_RESET_LIMIT) || 5,
        windowMs: (parseInt(process.env.ABUSE_TIME_WINDOW_HOURS) || 24) * 60 * 60 * 1000
      },
      databaseQuery: {
        max: parseInt(process.env.DATABASE_QUERY_LIMIT) || 60,
        windowMs: (parseInt(process.env.DATABASE_QUERY_TIME_WINDOW_MINUTES) || 1) * 60 * 1000
      },
      databaseReset: {
        max: parseInt(process.env.DATABASE_RESET_LIMIT) || 5,
        windowMs: (parseInt(process.env.DATABASE_RESET_TIME_WINDOW_HOURS) || 1) * 60 * 60 * 1000
      }
    };
    
    // Memory management
    this.maxEntries = parseInt(process.env.ABUSE_MAX_ENTRIES) || 10000; // Prevent memory exhaustion
    this.cleanupInterval = parseInt(process.env.ABUSE_CLEANUP_INTERVAL) || 5 * 60 * 1000; // 5 minutes
    
    this.logConfig();
  }
  
  logConfig() {
    logger.info('Abuse protection initialized:', {
      limits: Object.keys(this.limits).map(key => ({
        operation: key,
        max: this.limits[key].max,
        windowMinutes: Math.round(this.limits[key].windowMs / 60000)
      })),
      maxEntries: this.maxEntries,
      cleanupIntervalMinutes: Math.round(this.cleanupInterval / 60000)
    });
  }
  
  getLimit(operation) {
    const limit = this.limits[operation];
    if (!limit) {
      throw new Error(`Unknown operation: ${operation}`);
    }
    return limit;
  }
}

const config = new AbuseConfig();

// =====================================================
// EFFICIENT MEMORY STORAGE WITH BOUNDS
// =====================================================
class BoundedMemoryStore {
  constructor(maxSize = 10000) {
    this.data = new Map();
    this.maxSize = maxSize;
  }
  
  set(key, value) {
    // Evict oldest entries if approaching limit
    if (this.data.size >= this.maxSize) {
      const oldestKey = this.data.keys().next().value;
      this.data.delete(oldestKey);
      logger.warn('Memory store evicted oldest entry due to size limit', {
        evictedKey: oldestKey,
        currentSize: this.data.size
      });
    }
    
    this.data.set(key, value);
  }
  
  get(key) {
    return this.data.get(key);
  }
  
  delete(key) {
    return this.data.delete(key);
  }
  
  entries() {
    return this.data.entries();
  }
  
  size() {
    return this.data.size;
  }
  
  clear() {
    this.data.clear();
  }
}

// Stores with memory bounds
const ipStore = new BoundedMemoryStore(config.maxEntries);
const userStore = new BoundedMemoryStore(config.maxEntries);

// =====================================================
// INPUT VALIDATION & SANITIZATION
// =====================================================
const validator = {
  ip: (ip) => {
    if (!ip || typeof ip !== 'string') return null;
    
    // Basic IP validation (IPv4 and IPv6)
    const cleaned = ip.trim();
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-f0-9:]+:+)+[a-f0-9]+$/i.test(cleaned)) {
      return null;
    }
    
    return cleaned;
  },
  
  userId: (userId) => {
    if (!userId) return null;
    
    // Convert to string and sanitize
    const cleaned = String(userId).trim();
    if (cleaned.length === 0 || cleaned.length > 50) return null;
    
    return cleaned;
  },
  
  operation: (operation) => {
    const validOps = ['accountCreation', 'accountDeletion', 'passwordReset', 'databaseQuery', 'databaseReset'];
    return validOps.includes(operation) ? operation : null;
  }
};

// =====================================================
// CORE ABUSE TRACKING ENGINE
// =====================================================
class AbuseTracker {
  constructor() {
    this.metrics = {
      totalChecks: 0,
      blocked: 0,
      allowed: 0,
      cleanupRuns: 0,
      entriesEvicted: 0
    };
    
    this.startCleanupScheduler();
  }
  
  // Single unified tracking method
  track(identifier, identifierType, operation) {
    const validatedId = identifierType === 'ip' ? 
      validator.ip(identifier) : 
      validator.userId(identifier);
    
    if (!validatedId) {
      logger.warn('Invalid identifier for abuse tracking', {
        identifier,
        identifierType,
        operation
      });
      return false;
    }
    
    const validatedOp = validator.operation(operation);
    if (!validatedOp) {
      logger.warn('Invalid operation for abuse tracking', { operation });
      return false;
    }
    
    const store = identifierType === 'ip' ? ipStore : userStore;
    const key = `${validatedId}:${validatedOp}`;
    const now = Date.now();
    const limit = config.getLimit(validatedOp);
    
    const record = store.get(key) || { count: 0, firstSeen: now };
    
    // Reset if window expired
    if (now - record.firstSeen > limit.windowMs) {
      record.count = 1;
      record.firstSeen = now;
    } else {
      record.count++;
    }
    
    store.set(key, record);
    
    // Log tracking info
    logger.info('Operation tracked', {
      identifier: validatedId,
      type: identifierType,
      operation: validatedOp,
      count: record.count,
      limit: limit.max,
      windowMs: limit.windowMs
    });
    
    return record.count;
  }
  
  // Single unified checking method
  isBlocked(identifier, identifierType, operation) {
    this.metrics.totalChecks++;
    
    const validatedId = identifierType === 'ip' ? 
      validator.ip(identifier) : 
      validator.userId(identifier);
    
    if (!validatedId) return false; // Invalid = not blocked
    
    const validatedOp = validator.operation(operation);
    if (!validatedOp) return false;
    
    const store = identifierType === 'ip' ? ipStore : userStore;
    const key = `${validatedId}:${validatedOp}`;
    const record = store.get(key);
    
    if (!record) {
      this.metrics.allowed++;
      return false;
    }
    
    const limit = config.getLimit(validatedOp);
    const now = Date.now();
    
    // Check if window expired
    if (now - record.firstSeen > limit.windowMs) {
      this.metrics.allowed++;
      return false;
    }
    
    // Check if limit exceeded
    const isBlocked = record.count >= limit.max;
    
    if (isBlocked) {
      this.metrics.blocked++;
      logger.warn('Request blocked by abuse protection', {
        identifier: validatedId,
        type: identifierType,
        operation: validatedOp,
        count: record.count,
        limit: limit.max
      });
    } else {
      this.metrics.allowed++;
    }
    
    return isBlocked;
  }
  
  // Efficient cleanup with batching
  cleanup() {
    const startTime = Date.now();
    let totalEvicted = 0;
    
    try {
      // Cleanup IP store
      totalEvicted += this.cleanupStore(ipStore, 'ip');
      
      // Cleanup user store  
      totalEvicted += this.cleanupStore(userStore, 'user');
      
      this.metrics.cleanupRuns++;
      this.metrics.entriesEvicted += totalEvicted;
      
      const duration = Date.now() - startTime;
      
      logger.info('Abuse protection cleanup completed', {
        duration: `${duration}ms`,
        entriesEvicted: totalEvicted,
        remainingEntries: {
          ip: ipStore.size(),
          user: userStore.size()
        }
      });
      
    } catch (error) {
      logger.error('Cleanup failed:', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  cleanupStore(store, storeType) {
    const now = Date.now();
    let evicted = 0;
    const toDelete = [];
    
    // Batch collection of expired entries
    for (const [key, record] of store.entries()) {
      const operation = key.split(':')[1];
      const limit = config.limits[operation];
      
      if (limit && now - record.firstSeen > limit.windowMs) {
        toDelete.push(key);
      }
    }
    
    // Batch deletion
    for (const key of toDelete) {
      store.delete(key);
      evicted++;
    }
    
    return evicted;
  }
  
  startCleanupScheduler() {
    setInterval(() => {
      this.cleanup();
    }, config.cleanupInterval);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      memoryUsage: {
        ipStore: ipStore.size(),
        userStore: userStore.size(),
        maxEntries: config.maxEntries
      }
    };
  }
}

const tracker = new AbuseTracker();

// =====================================================
// MIDDLEWARE FACTORY
// =====================================================
function createLimiter(operation) {
  return (req, res, next) => {
    const ip = validator.ip(req.ip || req.connection?.remoteAddress);
    const userId = validator.userId(req.user?.id);
    
    // Check IP limits (always)
    if (ip && tracker.isBlocked(ip, 'ip', operation)) {
      const limit = config.getLimit(operation);
      const windowHours = Math.round(limit.windowMs / (60 * 60 * 1000));
      const windowMinutes = Math.round(limit.windowMs / (60 * 1000));
      const timeDisplay = windowHours >= 1 ? `${windowHours} ora/e` : `${windowMinutes} minuti`;
      
      return res.status(429).json({
        success: false,
        message: `Limite di ${limit.max} operazioni raggiunto in ${timeDisplay}. Riprova più tardi.`,
        retryAfter: Math.ceil(limit.windowMs / 1000)
      });
    }
    
    // Check user limits (if authenticated)
    if (userId && tracker.isBlocked(userId, 'user', operation)) {
      const limit = config.getLimit(operation);
      const windowHours = Math.round(limit.windowMs / (60 * 60 * 1000));
      const windowMinutes = Math.round(limit.windowMs / (60 * 1000));
      const timeDisplay = windowHours >= 1 ? `${windowHours} ora/e` : `${windowMinutes} minuti`;
      
      return res.status(429).json({
        success: false,
        message: `Limite personale di ${limit.max} operazioni raggiunto in ${timeDisplay}. Riprova più tardi.`,
        retryAfter: Math.ceil(limit.windowMs / 1000)
      });
    }
    
    next();
  };
}

// =====================================================
// TRACKING FUNCTIONS
// =====================================================
function trackOperation(userId, ip, operation) {
  let tracked = false;
  
  // Track by IP
  if (ip) {
    tracker.track(ip, 'ip', operation);
    tracked = true;
  }
  
  // Track by user ID
  if (userId) {
    tracker.track(userId, 'user', operation);
    tracked = true;
  }
  
  if (!tracked) {
    logger.warn('No valid identifier for tracking operation', { userId, ip, operation });
  }
}

// =====================================================
// HEALTH & MONITORING
// =====================================================
function getHealthStatus() {
  const metrics = tracker.getMetrics();
  const memoryUsage = process.memoryUsage();
  
  return {
    status: 'healthy',
    metrics,
    systemMemory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) // MB
    },
    config: {
      maxEntries: config.maxEntries,
      cleanupIntervalMinutes: Math.round(config.cleanupInterval / 60000)
    }
  };
}

// Reset function for testing/admin
function resetLimits(identifier, identifierType) {
  const store = identifierType === 'ip' ? ipStore : userStore;
  let cleared = 0;
  
  if (identifier) {
    // Reset specific identifier
    for (const [key] of store.entries()) {
      if (key.startsWith(`${identifier}:`)) {
        store.delete(key);
        cleared++;
      }
    }
  } else {
    // Reset all
    cleared = store.size();
    store.clear();
  }
  
  logger.info('Abuse protection limits reset', {
    identifier,
    identifierType,
    entriesCleared: cleared
  });
  
  return cleared;
}

// =====================================================
// EXPORTS
// =====================================================
module.exports = {
  // Middleware
  accountCreationLimiter: createLimiter('accountCreation'),
  accountDeletionLimiter: createLimiter('accountDeletion'),
  passwordResetLimiter: createLimiter('passwordReset'),
  databaseQueryLimiter: createLimiter('databaseQuery'),
  databaseResetLimiter: createLimiter('databaseReset'),
  
  // Tracking functions
  trackAccountCreation: (ip) => trackOperation(null, ip, 'accountCreation'),
  trackAccountDeletion: (ip) => trackOperation(null, ip, 'accountDeletion'),
  trackPasswordReset: (ip) => trackOperation(null, ip, 'passwordReset'),
  trackDatabaseQuery: (userId, ip) => trackOperation(userId, ip, 'databaseQuery'),
  trackDatabaseReset: (userId, ip) => trackOperation(userId, ip, 'databaseReset'),
  
  // Health & admin
  getHealthStatus,
  resetLimits,
  getMetrics: () => tracker.getMetrics()
};