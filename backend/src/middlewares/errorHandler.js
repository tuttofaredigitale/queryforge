const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const requestId = req._requestId || 'unknown';
  const userId = req.user?.id || 'anonymous';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log completo dell'errore con context
  logger.error(`Error in request ${requestId}`, {
    error: err.message,
    stack: err.stack,
    userId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    // Log body solo se non contiene password o dati sensibili
    body: req.body && !req.body.password ? 
      JSON.stringify(req.body).substring(0, 1000) : '[REDACTED]'
  });

  // Risposta base
  const errorResponse = {
    success: false,
    requestId,
    timestamp: new Date().toISOString()
  };

  // Errori specifici del database MySQL
  if (err.code && err.code.startsWith('ER_')) {
    return res.status(400).json({
      ...errorResponse,
      message: 'Errore database',
      code: 'DATABASE_ERROR',
      details: isProduction ? 
        'Si è verificato un errore con il database' : 
        `MySQL Error: ${err.code} - ${err.sqlMessage || err.message}`
    });
  }

  // Errori JWT/Auth
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
    return res.status(401).json({
      ...errorResponse,
      message: 'Token di autenticazione non valido',
      code: 'AUTH_ERROR',
      details: err.name === 'TokenExpiredError' ? 'Token scaduto' : 'Token malformato'
    });
  }

  // Errori di validazione (Joi, express-validator, etc.)
  if (err.name === 'ValidationError' || err.isJoi) {
    return res.status(400).json({
      ...errorResponse,
      message: 'Dati di input non validi',
      code: 'VALIDATION_ERROR',
      details: err.details ? err.details.map(d => d.message) : err.message
    });
  }

  // Errori di timeout
  if (err.code === 'ETIMEDOUT' || err.code === 'QUERY_TIMEOUT') {
    return res.status(408).json({
      ...errorResponse,
      message: 'Richiesta scaduta per timeout',
      code: 'TIMEOUT_ERROR',
      details: 'La richiesta ha impiegato troppo tempo'
    });
  }

  // Errori di connessione database
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      ...errorResponse,
      message: 'Servizio temporaneamente non disponibile',
      code: 'SERVICE_UNAVAILABLE',
      details: isProduction ? 'Riprova più tardi' : err.message
    });
  }

  // Errori di rate limiting (se arrivano qui)
  if (err.status === 429) {
    return res.status(429).json({
      ...errorResponse,
      message: 'Troppe richieste',
      code: 'RATE_LIMIT_EXCEEDED',
      details: 'Attendi prima di effettuare nuove richieste'
    });
  }

  // Errore generico
  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    ...errorResponse,
    message: isProduction ? 'Errore interno del server' : err.message,
    code: 'INTERNAL_ERROR',
    ...(isProduction ? {} : { 
      stack: err.stack,
      details: err.message 
    })
  });
};

// Middleware per gestire rotte non trovate
const notFoundHandler = (req, res) => {
  const requestId = req._requestId || 'unknown';
  
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    message: 'Endpoint non trovato',
    code: 'NOT_FOUND',
    requestId,
    path: req.originalUrl,
    method: req.method
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};