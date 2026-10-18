// backend/utils/logger.js - OPTIMIZED & SECURE LOGGING
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// =====================================================
// SECURE CONFIGURATION
// =====================================================
class LoggerConfig {
  constructor() {
    this.logDir = process.env.LOG_DIR || 'logs';
    this.maxFileSize = parseInt(process.env.LOG_MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.maxFiles = parseInt(process.env.LOG_MAX_FILES) || 5;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Custom levels with priority
    this.levels = {
      fatal: 0,
      error: 1,
      warn: 2,
      info: 3,
      debug: 4
    };
    
    this.colors = {
      fatal: 'magenta bold',
      error: 'red',
      warn: 'yellow',
      info: 'green',
      debug: 'blue'
    };
    
    // Security patterns to filter from logs
    this.sensitivePatterns = [
      /password["\s]*[:=]["\s]*[^"\s,}]+/gi,
      /token["\s]*[:=]["\s]*[^"\s,}]+/gi,
      /api[_-]?key["\s]*[:=]["\s]*[^"\s,}]+/gi,
      /secret["\s]*[:=]["\s]*[^"\s,}]+/gi,
      /authorization["\s]*[:=]["\s]*[^"\s,}]+/gi
    ];
  }
  
  getLogLevel() {
    if (this.isProduction) {
      return process.env.LOG_LEVEL || 'info';
    }
    return process.env.LOG_LEVEL || 'debug';
  }
}

const config = new LoggerConfig();

// =====================================================
// LOG DIRECTORY SETUP (ASYNC)
// =====================================================
async function ensureLogDirectory() {
  try {
    await fs.mkdir(config.logDir, { recursive: true });
    return true;
  } catch (error) {
    // Fallback: try sync operation
    try {
      if (!fsSync.existsSync(config.logDir)) {
        fsSync.mkdirSync(config.logDir, { recursive: true });
      }
      return true;
    } catch (syncError) {
      console.error('Failed to create log directory:', syncError.message);
      return false;
    }
  }
}

// =====================================================
// SECURE LOG FORMATTING
// =====================================================

// Security filter to remove sensitive data
function filterSensitiveData(obj) {
  if (typeof obj === 'string') {
    let filtered = obj;
    config.sensitivePatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, (match) => {
        const parts = match.split(/[:=]/);
        if (parts.length > 1) {
          return `${parts[0]}:***REDACTED***`;
        }
        return '***REDACTED***';
      });
    });
    return filtered;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const filtered = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('key')) {
        filtered[key] = '***REDACTED***';
      } else if (typeof value === 'object') {
        filtered[key] = filterSensitiveData(value);
      } else {
        filtered[key] = filterSensitiveData(value);
      }
    }
    return filtered;
  }
  
  return obj;
}

// Enhanced formatter with structured data support
const enhancedFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    // Filter sensitive data
    const safeMessage = filterSensitiveData(info.message);
    const safeMeta = info.meta ? filterSensitiveData(info.meta) : {};
    
    // Base log entry
    let logEntry = `${info.timestamp} ${info.level}: ${safeMessage}`;
    
    // Add metadata if present (excluding standard winston fields)
    const metadata = { ...safeMeta };
    delete metadata.timestamp;
    delete metadata.level;
    delete metadata.message;
    
    if (Object.keys(metadata).length > 0) {
      logEntry += ` | ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace for errors
    if (info.stack) {
      logEntry += `\n${info.stack}`;
    }
    
    return logEntry;
  })
);

// Console formatter with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ 
    colors: config.colors,
    all: true
  }),
  enhancedFormat
);

// =====================================================
// TRANSPORT CONFIGURATION
// =====================================================

function createTransports() {
  const transports = [];
  
  // Console transport (always present)
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );
  
  // File transports (only if log directory exists)
  try {
    // Error logs with rotation
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'error.log'),
        level: 'error',
        format: enhancedFormat,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles,
        handleExceptions: true
      })
    );
    
    // Security logs (warnings and above for security events)
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'security.log'),
        level: 'warn',
        format: enhancedFormat,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles
      })
    );
    
    // Combined logs with rotation
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'combined.log'),
        format: enhancedFormat,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles
      })
    );
    
    // Fatal logs (critical errors only)
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, 'fatal.log'),
        level: 'fatal',
        format: enhancedFormat,
        maxsize: config.maxFileSize,
        maxFiles: config.maxFiles
      })
    );
    
  } catch (error) {
    console.warn('File logging disabled - could not access log directory:', error.message);
  }
  
  return transports;
}

// =====================================================
// LOGGER INSTANCE CREATION
// =====================================================

// Create logger with enhanced configuration
const logger = winston.createLogger({
  levels: config.levels,
  level: config.getLogLevel(),
  format: enhancedFormat,
  transports: createTransports(),
  exitOnError: false, // Don't exit on handled exceptions
  
  // Exception handling
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  
  // Promise rejection handling
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Add custom colors
winston.addColors(config.colors);

// =====================================================
// ENHANCED LOGGING METHODS
// =====================================================

// Performance timing utility
const timers = new Map();

logger.startTimer = (label) => {
  timers.set(label, Date.now());
  return label;
};

logger.endTimer = (label, message = 'Operation completed') => {
  const startTime = timers.get(label);
  if (startTime) {
    const duration = Date.now() - startTime;
    timers.delete(label);
    logger.info(`${message} (${duration}ms)`, { 
      operation: label,
      duration: `${duration}ms`
    });
    return duration;
  } else {
    logger.warn(`Timer '${label}' not found`);
    return null;
  }
};

// Security-specific logging
logger.security = (message, meta = {}) => {
  logger.warn(`[SECURITY] ${message}`, {
    ...meta,
    type: 'security_event',
    timestamp: new Date().toISOString()
  });
};

// Performance logging
logger.performance = (message, meta = {}) => {
  logger.info(`[PERFORMANCE] ${message}`, {
    ...meta,
    type: 'performance_metric'
  });
};

// Business event logging
logger.business = (message, meta = {}) => {
  logger.info(`[BUSINESS] ${message}`, {
    ...meta,
    type: 'business_event'
  });
};

// Database logging
logger.database = (message, meta = {}) => {
  logger.info(`[DATABASE] ${message}`, {
    ...meta,
    type: 'database_operation'
  });
};

// Enhanced error logging with context
logger.errorWithContext = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    type: error.constructor.name,
    ...context
  };
  
  logger.error('Error occurred', errorInfo);
};

// =====================================================
// HEALTH & MONITORING
// =====================================================

logger.getStats = () => {
  return {
    level: logger.level,
    transports: logger.transports.length,
    activeTimers: timers.size,
    logDirectory: config.logDir,
    isProduction: config.isProduction,
    config: {
      maxFileSize: config.maxFileSize,
      maxFiles: config.maxFiles
    }
  };
};

logger.getHealthStatus = () => {
  const stats = logger.getStats();
  
  return {
    status: 'healthy',
    logging: {
      level: stats.level,
      transports: stats.transports,
      fileLogging: stats.transports > 1, // Console + file transports
      directory: config.logDir
    },
    performance: {
      activeTimers: stats.activeTimers
    }
  };
};

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

logger.shutdown = async () => new Promise(resolve => {
  timers.clear();

  // ultimo log prima di zittire tutto
  logger.info('Logger shutdown completed');
  logger.silent = true;     

  const donePromises = logger.transports.map(t => new Promise(res => {
    const done = () => res();
    t.once('finish', done);
    t.once('closed', done);
    // fallback timeout per sicurezza
    setTimeout(done, 1000);

    if (typeof t.flush === 'function') t.flush();
    if (typeof t.end === 'function')  t.end();
    else                              t.close();
  }));

  Promise.all(donePromises).finally(resolve);
});



// =====================================================
// INITIALIZATION
// =====================================================

// Initialize log directory asynchronously (non-blocking)
ensureLogDirectory().then(success => {
  if (!success) {
    console.warn('Logger initialized with console-only mode due to directory access issues');
  } else if (!config.isProduction) {
    logger.info('Logger initialized successfully', {
      level: config.getLogLevel(),
      logDir: config.logDir,
      transports: logger.transports.length
    });
  }
}).catch(error => {
  console.error('Logger initialization warning:', error.message);
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await logger.shutdown();
});

process.on('SIGINT', async () => {
  await logger.shutdown();
});

// Export enhanced logger
module.exports = logger;