// backend/routes/index.js - MONITORING SYSTEM INTEGRATION
const express = require('express');
const path = require('path');

// Safe logger import
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[ROUTES INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[ROUTES WARN]', msg, data || ''),
    error: (msg, data) => console.error('[ROUTES ERROR]', msg, data || '')
  };
}

function setupMonitoringRoutes(app) {
  // =====================================================
  // IMPORT ROUTE MODULES
  // =====================================================
  
  // Import admin auth routes
  const { router: adminAuthRouter, verifyToken } = require('./adminAuth');
  
  // Import monitoring routes  
  const monitoringRouter = require('./monitoring');
  
  // =====================================================
  // STATIC FILE SERVING
  // =====================================================
  
  // Serve static files from public directory
  // FIXED: Correct path from src/routes/ to public/
  const publicPath = path.join(__dirname, '../../public');
  app.use(express.static(publicPath, {
    // Cache static files for better performance
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
  }));
  
  logger.info('Static file serving configured', {
    publicPath,
    cacheMaxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
  });
  
  // =====================================================
  // MONITORING PAGE ROUTES
  // =====================================================
  
  // Serve monitoring dashboard (requires admin auth via frontend JS)
  app.get('/monitoring', (req, res) => {
    const monitoringPath = path.join(publicPath, 'monitoring.html');
    
    logger.info('Monitoring dashboard requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.sendFile(monitoringPath, (err) => {
      if (err) {
        logger.error('Failed to serve monitoring dashboard', {
          error: err.message,
          path: monitoringPath
        });
        res.status(404).send('Monitoring dashboard not found');
      }
    });
  });
  
  // Serve admin login page
  app.get('/admin/login', (req, res) => {
    const loginPath = path.join(publicPath, 'login.html');
    
    res.sendFile(loginPath, (err) => {
      if (err) {
        logger.error('Failed to serve admin login page', {
          error: err.message,
          path: loginPath
        });
        res.status(404).send('Login page not found');
      }
    });
  });
  
  // Redirect /admin to login page
  app.get('/admin', (req, res) => {
    res.redirect('/admin/login');
  });
  
  // =====================================================
  // API ROUTES
  // =====================================================
  
  // Admin authentication routes
  app.use('/api/auth', adminAuthRouter);
  
  // Monitoring API routes (protected by admin auth)
  app.use('/api/monitoring', verifyToken, monitoringRouter);
  
  // =====================================================
  // FALLBACK ROUTES
  // =====================================================
  
  // Health check endpoint (no auth required)
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });
  
  // API 404 handler
  app.use('/api/*', (req, res) => {
    logger.warn('API endpoint not found', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip
    });
    
    res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      path: req.originalUrl
    });
  });
  
  logger.info('Monitoring routes configured successfully', {
    routes: [
      'GET /monitoring',
      'GET /admin/login', 
      'GET /admin',
      'POST /api/auth/login',
      'POST /api/auth/refresh-token',
      'POST /api/auth/logout',
      'GET /api/auth/sessions',
      'POST /api/auth/revoke-session',
      'GET /api/monitoring/stats',
      'GET /api/monitoring/security',
      'GET /api/monitoring/pool',
      'GET /api/monitoring/health',
      'GET /api/monitoring/system'
    ]
  });
}

// =====================================================
// MIDDLEWARE HELPERS
// =====================================================

// Request logging middleware for monitoring routes
function monitoringRequestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    if (req.originalUrl.startsWith('/api/monitoring') || req.originalUrl === '/monitoring') {
      logger.info('Monitoring request completed', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100)
      });
    }
  });
  
  next();
}

// Security headers for monitoring pages
function securityHeaders(req, res, next) {
  // Add security headers for monitoring pages
  if (req.originalUrl.startsWith('/monitoring') || req.originalUrl.startsWith('/admin')) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  }
  
  next();
}

// Rate limiting for monitoring endpoints
function createMonitoringRateLimit() {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests to monitoring endpoints'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.originalUrl === '/health';
    }
  });
}

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

module.exports = {
  setupMonitoringRoutes,
  monitoringRequestLogger,
  securityHeaders,
  createMonitoringRateLimit
};