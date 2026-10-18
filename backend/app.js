// app.js - QueryForge Course Lab Edition
// Sistema di monitoraggio, dashboard e SQL playground - PRODUCTION READY
// SAASECTOMY COMPLETATA: Rimossi tutti i riferimenti a pagamenti, AI, backup S3

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
const os = require('os');
const compression = require('compression');

// Import Routes
const alertManager = require('./src/utils/alertManager');
const databaseRoutes = require('./src/routes/database.routes');
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const queryHistoryRoutes = require('./src/routes/queryHistory.routes');
const exerciseRoutes = require('./src/routes/exercise.routes');

// Import Middlewares
const { authenticate, requireAdmin } = require('./src/middlewares/auth');
const { requestLogger, rateLimiter } = require('./src/middlewares/loggerMiddleware');

// Import Utilities
const database = require('./src/utils/db');
const logger = require('./src/utils/logger');
const sqlMonitor = require('./src/utils/sqlMonitor');
const sqlTracer = require('./src/utils/sqlTracer');
const notificationScheduler = require('./src/utils/notificationScheduler');
const queryLimiter = require('./src/utils/queryLimiter');

const rateLimit = require('express-rate-limit');

const app = express();

// --- Configurazione Environment ---
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Variabili richieste in TUTTI gli ambienti
const baseRequiredVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'SESSION_SECRET'
];

// Variabili richieste SOLO in produzione (TiDB Serverless)
const productionOnlyVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
];

// Variabili richieste SOLO in sviluppo
const developmentOnlyVars = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD'
];

let requiredEnvVars = [...baseRequiredVars];

if (process.env.NODE_ENV === 'production') {
    requiredEnvVars.push(...productionOnlyVars);
    logger.info("Controllo variabili d'ambiente per l'ambiente di PRODUZIONE.");
} else {
    requiredEnvVars.push(...developmentOnlyVars);
    logger.info("Controllo variabili d'ambiente per l'ambiente di SVILUPPO.");
}

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    logger.fatal(`Variabili d'ambiente obbligatorie mancanti: ${missingVars.join(', ')}`);
    process.exit(1);
}

logger.info('Tutte le variabili d\'ambiente obbligatorie sono presenti. Avvio applicazione...');

// --- Configurazione Middleware Essenziali ---
logger.info('Configurazione middleware essenziali...');

if (isProduction) {
  app.set('trust proxy', 1);
  app.use(compression());
}

// Helmet con CSP configurato per produzione
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], 
        scriptSrc: [
          "'self'", 
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          "'unsafe-inline'",
          "'unsafe-eval'"
        ],
        scriptSrcAttr: [
          "'unsafe-inline'"
        ],
        styleSrc: [
          "'self'", 
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          "'unsafe-inline'"
        ],
        styleSrcAttr: [
          "'unsafe-inline'"
        ],
        connectSrc: [
          "'self'",
          process.env.FRONTEND_URL || 'http://localhost:5173',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://analytics.google.com'
        ], 
        imgSrc: ["'self'", "data:", "https:"], 
        fontSrc: [
          "'self'", 
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "data:"
        ], 
        objectSrc: ["'none'"], 
        baseUri: ["'self'"], 
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      },
    },
    hsts: isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    frameGuard: isProduction ? { action: 'deny' } : false
  })
);

// CORS configurato in modo sicuro
const corsOptions = {
  origin: function (origin, callback) {
    if (isProduction) { 
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL?.replace('://', '://www.'),
      ].filter(Boolean);

      const vercelPreviewRegex = /^https:\/\/queryforge-.*\.vercel\.app$/;

      if (!origin || allowedOrigins.includes(origin) || vercelPreviewRegex.test(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin in production: ${origin}`);
        callback(new Error('Non autorizzato da CORS'));
      }

    } else {
      const devOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
        undefined
      ];
      
      if (!origin || devOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS warning in dev - anomalo origin: ${origin}`);
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// --- Servizio File Statici per Monitoring ---
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') && !isProduction) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Request logging
app.use(requestLogger);

// --- SQL Monitoring Middleware ---
logger.info('Configurazione SQL monitoring middleware...');

app.use('/api/database', (req, res, next) => {
  if (req.body && req.body.query) {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        const query = req.body.query;
        const userId = req.user?.id || 'anonymous';
        const userEmail = req.user?.email || 'unknown';
        const ip = req.ip || req.connection.remoteAddress;
        const sessionId = req.sessionID || 'no-session';
        
        const monitorResult = sqlMonitor.monitorQuery(query, userId, ip, sessionId);
        const traceResult = sqlTracer.traceQuery(query, userId);
        
        if (monitorResult.suspicious || traceResult.suspicious || !isProduction) {
          logger.info('SQL query monitored', {
            userId,
            userEmail,
            ip,
            queryType: sqlMonitor.determineQueryType(query),
            suspicious: monitorResult.suspicious || traceResult.suspicious,
            patterns: monitorResult.patterns || traceResult.patterns,
            severity: traceResult.severity
          });
        }
        
        if ((monitorResult.suspicious || traceResult.suspicious) && data) {
          data.warning = {
            message: 'Query sospetta rilevata',
            patterns: monitorResult.patterns || traceResult.patterns,
            severity: traceResult.severity || 'medium'
          };
        }
        
        if (monitorResult.action === 'blocked') {
          logger.warn('User blocked for too many suspicious queries', {
            userId,
            userEmail,
            ip
          });
          
          return originalJson.call(this, {
            success: false,
            error: 'Accesso temporaneamente bloccato per attività sospetta',
            code: 'SUSPICIOUS_ACTIVITY_BLOCKED'
          });
        }
      } catch (error) {
        logger.error('Error in SQL monitoring middleware:', {
          error: error.message,
          userId: req.user?.id
        });
      }
      
      return originalJson.call(this, data);
    };
  }
  
  next();
});

// Middleware per tracciare eventi di sicurezza
app.use((req, res, next) => {
  if (res.statusCode === 403 || res.statusCode === 401) {
    const originalSend = res.send;
    const originalJson = res.json;
    
    const trackUnauthorized = () => {
      if (req.user) {
        sqlTracer.traceUnauthorizedAccess(
          req.user.id,
          req.originalUrl,
          req.method,
          req.ip
        );
      }
    };
    
    res.send = function(data) {
      trackUnauthorized();
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      trackUnauthorized();
      return originalJson.call(this, data);
    };
  }
  
  next();
});

// Traccia login eventi
app.use('/api/auth/login', (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    if (data && req.body && req.body.email) {
      const success = data.success === true;
      const userId = data.user?.id || req.body.email;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      
      sqlTracer.traceLogin(userId, success, ip, userAgent);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
});

// Traccia rate limit exceeded
app.use((req, res, next) => {
  if (res.statusCode === 429) {
    const userId = req.user?.id || 'anonymous';
    const endpoint = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    
    sqlTracer.traceRateLimitExceeded(userId, endpoint, 'unknown', ip);
  }
  
  next();
});

logger.info('SQL monitoring middleware configurato con successo');

// Route per login page
app.get('/login', (req, res) => {
  const loginPath = path.join(__dirname, 'public', 'login.html');
  res.sendFile(loginPath, (err) => {
    if (err) {
      logger.error('Failed to serve login page', { error: err.message });
      res.status(404).send('Login page not found');
    }
  });
});

// Redirect da /admin a /login
app.get('/admin', (req, res) => {
  res.redirect('/login');
});

// Route per monitoring dashboard
app.get('/monitoring', (req, res) => {
  const monitoringPath = path.join(__dirname, 'public', 'monitoring.html');
  res.sendFile(monitoringPath, (err) => {
    if (err) {
      logger.error('Failed to serve monitoring dashboard', { error: err.message });
      res.status(404).send('Monitoring dashboard not found');
    }
  });
});

// Check file richiesti all'avvio
const checkRequiredFiles = () => {
  const requiredFiles = [
    path.join(__dirname, 'public', 'login.html'),
    path.join(__dirname, 'public', 'monitoring.html'),
    path.join(__dirname, 'public', 'js', 'auth-init.js'),
    path.join(__dirname, 'public', 'js', 'login-logic.js'),
    path.join(__dirname, 'public', 'js', 'dashboard-main.js')
  ];

  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      logger.warn(`File mancante: ${file}`);
    } else {
      logger.info(`File verificato: ${path.basename(file)}`);
    }
  });
};

checkRequiredFiles();

// Rate limiting per login
const loginLimiter = rateLimiter({ windowMs: 60_000, maxRequests: 10 });
app.use('/api/auth/login', loginLimiter);

// Body parser con limiti ragionevoli
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: {
    success: false,
    message: 'Troppe richieste da questo IP, riprova più tardi.',
    code: 'RATE_LIMIT_GLOBAL'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Global rate limit exceeded`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      message: 'Troppe richieste da questo IP, riprova più tardi.',
      code: 'RATE_LIMIT_GLOBAL',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});
app.use('/api', globalRateLimiter);

// Auth routes con rate limiting
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
    edition: 'course-lab' // Identifica la versione Course Lab
  });
});

// --- Definizione e Montaggio Rotte API ---
logger.info('Montaggio rotte API...');

// Rotte autenticate
app.use('/api/user', authenticate, userRoutes);
app.use('/api/query-history', authenticate, queryHistoryRoutes);
app.use('/api/database', authenticate, databaseRoutes);
app.use('/api/sql', rateLimiter({ maxRequests: 20, windowMs: 60000 }));
app.use('/api/exercises', exerciseRoutes);

// --- Endpoint per ottenere i limiti correnti dell'utente ---
// Course Lab Edition: limite fisso 50 query/giorno, no AI, no backup
app.get('/api/user/limits', authenticate, async (req, res) => {
  try {
    const stats = await queryLimiter.getUsageStats(req.user.id);
    
    res.json({
      success: true,
      limits: {
        plan: stats.plan,
        queryLimit: stats.limit,
        queryUsage: stats.used,
        queryRemaining: stats.remaining,
        // AI e backup disabilitati nella Course Lab Edition
        aiLimit: 0,
        aiUsage: 0,
        aiRemaining: 0
      }
    });
  } catch (error) {
    logger.error(`Errore nel recupero dei limiti utente: ${error.message}`, { 
      userId: req.user.id
    });
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero dei limiti utente'
    });
  }
});

if (!database.checkHealth) {
  database.checkHealth = async function() {
    logger.warn('database.checkHealth non implementato, usando mock');
    return {
      auth: { healthy: true },
      template: { healthy: true }
    };
  };
}

// --- Endpoint API per Monitoraggio (Solo Admin) ---
const monitoringEnabled = !isProduction || process.env.ENABLE_MONITORING === 'true';
logger.info(`Monitoring routes enabled: ${monitoringEnabled} (Production: ${isProduction}, ENABLE_MONITORING: ${process.env.ENABLE_MONITORING})`);

const enableTestRoutes = !isProduction || process.env.ENABLE_MONITORING_TEST === 'true';

if (monitoringEnabled) {
  logger.info('Registrazione rotte API di monitoraggio...');
  
  // Stats endpoint
  app.get('/api/monitoring/stats', authenticate, requireAdmin, async (req, res) => {
    try {
      logger.info(`Richiesta statistiche da utente admin ${req.user.id}`);
      
      const stats = sqlMonitor.getStats();
            
      res.json({
        success: true,
        stats: {
          total: stats.queries?.total || 0,
          select: stats.queries?.select || 0,
          insert: stats.queries?.insert || 0,
          update: stats.queries?.update || 0,
          delete: stats.queries?.delete || 0,
          other: stats.queries?.other || 0,
          suspiciousCount: stats.queries?.suspicious || 0,
          activeUsers: stats.queries?.activeUsers || stats.memory?.userQueries || 0,
          queriesPerMinute: stats.queries?.queriesPerMinute || '0.00',
          runtimeMinutes: stats.queries?.runtimeMinutes || '0.00',
          suspiciousUsers: stats.queries?.suspiciousUsers || 0,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Errore nel recupero statistiche: ${error.message}`, {
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero delle statistiche'
      });
    }
  });

  // Security endpoint
  app.get('/api/monitoring/security', authenticate, requireAdmin, (req, res) => {
    try {
      logger.info(`Richiesta eventi di sicurezza da utente admin ${req.user.id}`);
      
      const securityEvents = sqlTracer.getSecurityEvents();
      const threatSummary = sqlTracer.getThreatSummary ? sqlTracer.getThreatSummary() : {
        totalEvents: securityEvents.length,
        sqlInjectionAttempts: securityEvents.filter(e => e.type === 'sql_injection').length,
        suspiciousQueries: securityEvents.filter(e => e.type === 'suspicious_query').length
      };
      
      res.json({ 
        success: true, 
        securityEvents,
        threatSummary
      });
    } catch (error) {
      logger.error(`Errore nel recupero eventi sicurezza: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero degli eventi di sicurezza'
      });
    }
  });

  // Pool metrics endpoint
  app.get('/api/monitoring/pool', authenticate, requireAdmin, async (req, res) => {
    try {
      logger.info(`Richiesta metriche pool da utente admin ${req.user.id}`);
      
      const poolMetrics = sqlMonitor.getPoolMetrics();
      const poolStatus = await database.getPoolStatus();
      const healthCheck = await database.checkHealth();
      
      const recommendations = [];
      
      if (poolStatus?.authPool) {
        const authUtil = parseFloat(poolStatus.authPool.utilizationPercentage || 0);
        if (authUtil > 80) {
          recommendations.push(`Pool auth: Utilizzo alto (${authUtil}%). Considera aumento connectionLimit.`);
        }
        if (poolStatus.authPool.queue > 0) {
          recommendations.push(`Pool auth: ${poolStatus.authPool.queue} connessioni in coda.`);
        }
      }
      
      if (poolStatus?.mainPool) {
        const mainUtil = parseFloat(poolStatus.mainPool.utilizationPercentage || 0);
        if (mainUtil > 80) {
          recommendations.push(`Pool principale: Utilizzo alto (${mainUtil}%). Considera aumento connectionLimit.`);
        }
        if (poolStatus.mainPool.queue > 0) {
          recommendations.push(`Pool principale: ${poolStatus.mainPool.queue} connessioni in coda.`);
        }
      }
      
      if (recommendations.length === 0) {
        recommendations.push('Tutti i pool database operano entro parametri normali.');
      }

      res.json({
        success: true,
        data: {
          poolMetrics,
          poolStatus,
          healthCheck,
          recommendations,
          systemInfo: {
            cpuCount: os.cpus().length,
            platform: os.platform(),
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: process.memoryUsage()
          }
        }
      });
    } catch (error) {
      logger.error(`Errore nel recupero statistiche pool: ${error.message}`, {
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: 'Impossibile recuperare statistiche del pool',
        error: isDevelopment ? error.message : undefined
      });
    }
  });

  // User statistics endpoint - Course Lab Edition (sostituisce plans endpoint)
  app.get('/api/monitoring/plans', authenticate, requireAdmin, async (req, res) => {
    try {
      const connection = await database.getAuthConnection();
      try {
        // Course Lab: tutti gli utenti sono "course-lab", non più free/pro
        const [totalUsers] = await connection.execute(
          'SELECT COUNT(*) as count FROM users'
        );
        const [activeToday] = await connection.execute(`
          SELECT COUNT(DISTINCT user_id) as count 
          FROM query_usage 
          WHERE usage_date = CURRENT_DATE()
        `);
        const [avgQueryUsage] = await connection.execute(`
          SELECT AVG(count) as avg_usage 
          FROM query_usage 
          WHERE usage_date = CURRENT_DATE()
        `);
        const [totalQueriesToday] = await connection.execute(`
          SELECT SUM(count) as total 
          FROM query_usage 
          WHERE usage_date = CURRENT_DATE()
        `);
        
        res.json({
          success: true,
          stats: {
            totalUsers: totalUsers[0].count,
            activeUsersToday: activeToday[0].count,
            avgQueryUsageToday: Math.round(avgQueryUsage[0].avg_usage || 0),
            totalQueriesToday: totalQueriesToday[0].total || 0,
            plan: 'course-lab'
          }
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error(`Errore nel recupero statistiche utenti: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Impossibile recuperare statistiche utenti'
      });
    }
  });

  // Route admin per reset monitoring (SOLO DEVELOPMENT/TEST)
  if (enableTestRoutes) {
    app.post('/api/monitoring/reset', authenticate, requireAdmin, (req, res) => {
      try {
        logger.info('Reset monitoring data requested by admin', {
          userId: req.user.id,
          ip: req.ip
        });
        
        if (sqlMonitor.stats) {
          sqlMonitor.stats.suspicious = 0;
          sqlMonitor.stats.blocked = 0;
        }
        
        if (sqlMonitor.suspiciousUsers) {
          sqlMonitor.suspiciousUsers.clear();
        }
        
        if (sqlTracer && sqlTracer.resetStats) {
          sqlTracer.resetStats();
        }
        
        res.json({
          success: true,
          message: 'Monitoring data reset successfully',
          newStats: sqlMonitor.getStats()
        });
        
      } catch (error) {
        logger.error('Error resetting monitoring data:', error);
        res.status(500).json({
          success: false,
          message: 'Error resetting monitoring data'
        });
      }
    });
    
    // Route per sbloccare uno specifico utente
    app.post('/api/monitoring/unblock-user', authenticate, requireAdmin, (req, res) => {
      try {
        const { userId } = req.body;
        
        if (!userId) {
          return res.status(400).json({
            success: false,
            message: 'userId required'
          });
        }
        
        if (sqlMonitor.suspiciousUsers && sqlMonitor.suspiciousUsers.data) {
          sqlMonitor.suspiciousUsers.data.delete(userId);
        }
        
        logger.info('User unblocked', {
          unblockedUserId: userId,
          adminId: req.user.id
        });
        
        res.json({
          success: true,
          message: `User ${userId} unblocked successfully`
        });
        
      } catch (error) {
        logger.error('Error unblocking user:', error);
        res.status(500).json({
          success: false,
          message: 'Error unblocking user'
        });
      }
    });
  }

  if (enableTestRoutes) {
    // Route di test per verificare le metriche del pool
    app.get('/api/monitoring/pool-test', authenticate, requireAdmin, async (req, res) => {
      try {
        const directPoolInfo = {
          authPool: null,
          templatePool: null
        };
        
        if (database.authPool) {
          const pool = database.authPool;
          directPoolInfo.authPool = {
            exists: true,
            type: typeof pool,
            hasPool: !!pool.pool,
            properties: Object.keys(pool).filter(k => !k.startsWith('_')),
            _allConnections: pool._allConnections?.length || 'N/A',
            _freeConnections: pool._freeConnections?.length || 'N/A',
            _connectionQueue: pool._connectionQueue?.length || 'N/A',
            poolProperties: pool.pool ? {
              _allConnections: pool.pool._allConnections?.length || 'N/A',
              _freeConnections: pool.pool._freeConnections?.length || 'N/A',
              _connectionQueue: pool.pool._connectionQueue?.length || 'N/A',
            } : null
          };
        }
        
        if (database.templatePool) {
          const pool = database.templatePool;
          directPoolInfo.templatePool = {
            exists: true,
            type: typeof pool,
            hasPool: !!pool.pool,
            properties: Object.keys(pool).filter(k => !k.startsWith('_')),
            _allConnections: pool._allConnections?.length || 'N/A',
            _freeConnections: pool._freeConnections?.length || 'N/A',
            _connectionQueue: pool._connectionQueue?.length || 'N/A',
            poolProperties: pool.pool ? {
              _allConnections: pool.pool._allConnections?.length || 'N/A',
              _freeConnections: pool.pool._freeConnections?.length || 'N/A',
              _connectionQueue: pool.pool._connectionQueue?.length || 'N/A',
            } : null
          };
        }
        
        const poolStatus = await database.getPoolStatus();
        const sqlMonitorMetrics = sqlMonitor.getPoolMetrics();
        
        res.json({
          success: true,
          debug: {
            directPoolInfo,
            poolStatus,
            sqlMonitorMetrics,
            timestamp: new Date().toISOString()
          }
        });
        
      } catch (error) {
        logger.error('Pool test error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Route per forzare un check del pool
    app.post('/api/monitoring/force-pool-check', authenticate, requireAdmin, async (req, res) => {
      try {
        await sqlMonitor.checkPoolStatus();
        const metrics = sqlMonitor.getPoolMetrics();
        
        res.json({
          success: true,
          message: 'Pool check forced',
          metrics
        });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  if (enableTestRoutes) {
    // Route per simulare carico sul database
    app.post('/api/monitoring/simulate-load', authenticate, requireAdmin, async (req, res) => {
      try {
        const { connections = 5, duration = 5000 } = req.body;
        
        logger.info(`Simulating database load: ${connections} connections for ${duration}ms`);
        
        const activeConnections = [];
        
        for (let i = 0; i < connections; i++) {
          database.templatePool.getConnection() 
            .then(conn => {
              activeConnections.push(conn);
              return conn.query('SELECT SLEEP(0.1)');
            })
            .then(() => {
              setTimeout(() => {
                const conn = activeConnections.shift();
                if (conn) conn.release();
              }, duration);
            })
            .catch(err => {
              logger.error('Error in load simulation:', err);
            });
        }
        
        setTimeout(async () => {
          const poolStatus = await database.getPoolStatus();
          const metrics = sqlMonitor.getPoolMetrics();
          
          res.json({
            success: true,
            message: `Load simulation started: ${connections} connections`,
            currentStatus: poolStatus,
            metrics: metrics.current
          });
        }, 500);
        
      } catch (error) {
        logger.error('Load simulation error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  logger.info('Route di test monitoring aggiunte:', {
      routes: [
        'POST /api/monitoring/reset',
        'POST /api/monitoring/unblock-user',
        'GET /api/monitoring/pool-test',
        'POST /api/monitoring/force-pool-check',
        'POST /api/monitoring/simulate-load'
      ]
    });
  
  logger.info('Route di monitoring registrate con successo:', {
    routes: [
      'GET /api/monitoring/stats',
      'GET /api/monitoring/security',
      'GET /api/monitoring/pool',
      'GET /api/monitoring/plans',
      ...(isProduction ? [] : [
        'POST /api/monitoring/reset',
        'POST /api/monitoring/unblock-user',
        'GET /api/monitoring/pool-test',
        'POST /api/monitoring/force-pool-check',
        'POST /api/monitoring/simulate-load'
      ])
    ]
  });

  app.get('/api/monitoring/alert-status', authenticate, requireAdmin, async (req, res) => {
    try {
      logger.info(`Richiesta stato alert da utente admin ${req.user.id}`);
      
      const health = await alertManager.checkSystemHealth();
      
      res.json({
        success: true,
        health,
        alertCounts: alertManager.alertCounts,
        thresholds: alertManager.alertThresholds,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Errore nel recupero stato alert: ${error.message}`, {
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero dello stato alert'
      });
    }
  });

  // Test Alert endpoint
  app.post('/api/monitoring/test-alert', authenticate, requireAdmin, async (req, res) => {
    try {
      logger.info(`Test alert richiesto da utente admin ${req.user.id}`);
      
      const success = await alertManager.testEmailConnection();
      
      res.json({
        success,
        message: success ? 'Alert test inviato con successo' : 'Errore nell\'invio del test'
      });
    } catch (error) {
      logger.error(`Errore nel test alert: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Errore nel test alert',
        error: error.message
      });
    }
  });

  // Force Health Check endpoint
  app.post('/api/monitoring/force-health-check', authenticate, requireAdmin, async (req, res) => {
    try {
      logger.info(`Health check forzato da utente admin ${req.user.id}`);
      
      const health = await alertManager.checkSystemHealth();
      
      res.json({
        success: true,
        message: 'Health check eseguito',
        health
      });
    } catch (error) {
      logger.error(`Errore durante health check forzato: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Errore durante health check',
        error: error.message
      });
    }
  });
} else {
  logger.warn('Route di monitoring NON registrate (Production mode senza ENABLE_MONITORING=true)');
}

// --- Servizio File Statici ---
if (enableTestRoutes) {
  logger.info('Configurazione servizio file statici per development...');
  app.use(express.static(path.join(__dirname, 'public')));
  
  app.get('/monitoring', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitoring.html'));
  });
}

// --- Gestione Errori API (404 Not Found) ---
app.use('/api', (req, res, next) => {
  logger.warn(`API non trovata (404): ${req.method} ${req.url}`);
  res.status(404).json({
    status: 'error',
    message: 'Endpoint API non trovato.',
    error: 'not_found'
  });
});

// --- Gestione Errori Generici (500 Internal Server Error) ---
app.use((err, req, res, next) => {
  if (isDevelopment) {
    logger.error(`Errore interno del server: ${err.message}`, {
      error: err,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.error(`Errore 500: ${req.method} ${req.originalUrl} - ${err.message}`);
  }

  const errorMessage = isProduction ? 'Errore interno del server.' : err.message;
  const errorDetails = isProduction ? {} : { stack: err.stack };

  res.status(err.status || 500).json({
    status: 'error',
    message: errorMessage,
    error: 'internal_server_error',
    ...(isDevelopment && { details: errorDetails })
  });
});

// --- Gestione Errori a Livello di Processo ---
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception:', error);
  gracefulShutdown(1);
});

// --- Funzione Graceful Shutdown ---
async function gracefulShutdown(exitCode = 0) {
  logger.info('Avvio procedura di chiusura controllata...');
  
  const shutdownTimeout = setTimeout(() => {
    logger.error('Chiusura forzata dopo timeout');
    process.exit(exitCode);
  }, 30000);
  
  try {
    if (sqlMonitor && typeof sqlMonitor.shutdown === 'function') {
      await sqlMonitor.shutdown();
      logger.info('Monitor SQL fermato.');
    }

    if (database.closePools && typeof database.closePools === 'function') {
      logger.info('Chiusura pool database...');
      await database.closePools();
    }

    clearTimeout(shutdownTimeout);
    logger.info('Chiusura completata con successo.');
    process.exit(exitCode);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error('Errore durante la chiusura controllata:', error);
    process.exit(1);
  }
}

// --- Gestione segnali di chiusura ---
process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));

// --- Inizializzazione ---
logger.info(`Applicazione QueryForge Course Lab Edition avviata in modalità ${process.env.NODE_ENV}`);

notificationScheduler.init();

// Health check periodico ogni 5 minuti
const cron = require('node-cron');

cron.schedule('*/5 * * * *', async () => {
  try {
    await alertManager.checkSystemHealth();
  } catch (error) {
    logger.error('[HealthCheck] Errore durante health check:', error);
  }
}, {
  scheduled: true,
  timezone: "Europe/Rome"
});

logger.info('[HealthCheck] Pianificato controllo salute sistema ogni 5 minuti');

// Health check iniziale dopo 30 secondi dall'avvio
setTimeout(async () => {
  try {
    logger.info('[HealthCheck] Esecuzione controllo salute iniziale...');
    const health = await alertManager.checkSystemHealth();
    logger.info('[HealthCheck] Sistema operativo correttamente:', health);
  } catch (error) {
    logger.error('[HealthCheck] Errore durante controllo iniziale:', error);
  }
}, 30000);

module.exports = app;