const logger = require('../utils/logger');
const crypto = require('crypto');
const Redis = require('ioredis');

const requestLogger = (req, res, next) => {
  req._startTime = Date.now();
  req._requestId = crypto.randomBytes(8).toString('hex');
  
  logger.info(`→ ${req.method} ${req.originalUrl}`, {
    requestId: req._requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent')?.substring(0, 100)
  });

  // Hook sicuro per loggare la risposta
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req._startTime;
    logger.info(`← ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      requestId: req._requestId,
      userId: req.user?.id || 'anonymous',
      duration,
      statusCode: res.statusCode
    });
    return originalSend.call(this, data);
  };

  next();
};


// Rate limiter con fallback in-memory ma scalabile
const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 30;
  const keyPrefix = options.keyPrefix || 'rl:';
  
  let store;
  let isRedis = false;

  // --- LOGICA AGGIORNATA ---
  // Usa Redis solo se siamo in produzione E se la variabile d'ambiente REDIS_URL è definita.
  if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
    try {
      store = new Redis(process.env.REDIS_URL, {
        retryStrategy: times => Math.min(times * 50, 2000), // Riprova con un backoff
        lazyConnect: true // Non connetterti finché non serve
      });
      isRedis = true;
      logger.info('Rate limiter configurato per usare Redis in produzione.');
    } catch (err) {
      logger.error('Errore durante la configurazione di Redis, fallback su in-memory store.', { error: err.message });
      store = new Map();
      isRedis = false;
    }
  } else {
    // In tutti gli altri casi (sviluppo o produzione senza Redis), usa la memoria.
    store = new Map();
    isRedis = false;
    if (process.env.NODE_ENV === 'production') {
        logger.warn('ATTENZIONE: Rate limiter in esecuzione in modalità in-memory in produzione. Non è scalabile.');
    } else {
        logger.info('Rate limiter in esecuzione in modalità in-memory per lo sviluppo.');
    }

    // Cleanup periodico per evitare memory leak
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of store.entries()) {
        if (now - value.timestamp > windowMs) {
          store.delete(key);
        }
      }
    }, windowMs);
  }

  return async (req, res, next) => {
    const userId = req.user?.id || req.ip; // Usa l'IP come fallback per utenti non loggati
    const key = `${keyPrefix}${userId}`;
    
    try {
      let count;
      let ttl;
      
      if (isRedis) {
        // Implementazione Redis
        try {
            const pipeline = store.pipeline();
            pipeline.incr(key);
            pipeline.expire(key, Math.ceil(windowMs / 1000));
            pipeline.ttl(key);
            
            const results = await pipeline.exec();
            
            if (results[0][0] || results[1][0] || results[2][0]) {
              // Se c'è un errore nella pipeline, passa oltre
              logger.warn('Errore nella pipeline Redis del rate limiter, richiesta permessa.');
              return next();
            }
            
            count = results[0][1];
            ttl = results[2][1];

        } catch (redisError) {
            logger.error('Errore Redis nel rate limiter, richiesta permessa.', { error: redisError.message });
            return next(); // In caso di errore Redis, non bloccare l'utente
        }

      } else {
        // Implementazione Map in memoria
        const now = Date.now();
        const record = store.get(key);
        
        if (!record || now - record.timestamp > windowMs) {
          store.set(key, { count: 1, timestamp: now });
          count = 1;
        } else {
          record.count += 1;
          count = record.count;
        }
        
        ttl = Math.ceil((windowMs - (now - (record?.timestamp || now))) / 1000);
      }
      
      if (count > maxRequests) {
        logger.warn(`Rate limit exceeded`, {
          userId: req.user?.id || 'anonymous',
          ip: req.ip,
          path: req.originalUrl,
          count,
          limit: maxRequests,
        });
        
        res.setHeader('Retry-After', ttl);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.floor((Date.now() + ttl * 1000) / 1000));

        const minutes = Math.ceil(ttl / 60);
        
        return res.status(429).json({
          success: false,
          message: `Troppe richieste. Riprova tra ${minutes} minut${minutes === 1 ? 'o' : 'i'}.`,
          retryAfter: ttl  
        });
      }
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
      
      next();
      
    } catch (err) {
      logger.error(`Errore critico nel rate limiter: ${err.message}`, { userId: req.user?.id, ip: req.ip });
      // In caso di errore, permetti la richiesta per non bloccare il servizio
      next();
    }
  };
};

// Middleware per statistiche SQL (versione sicura, ripristinata dal tuo codice)
const sqlStatsMiddleware = (req, res) => {
  try {
    const sqlTracer = require('../utils/sqlTracer');
    const stats = sqlTracer.getStats();
 
  // Aggiungi informazioni di sistema
  const systemStats = {
    ...stats,
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }
  };

  logger.debug('SQL stats requested', { requestedBy: req.user?.id });

  res.json({
    success: true,
    stats: systemStats
  });
  } catch (error) {
    logger.error('Error retrieving SQL stats:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle statistiche',
      stats: {
        total: 0,
        activeUsers: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
};


module.exports = {
  requestLogger,
  rateLimiter: createRateLimiter,
  sqlStatsMiddleware
};
