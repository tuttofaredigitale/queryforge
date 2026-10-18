// backend/routes/monitoring.js - MONITORING API ENDPOINTS
const express = require('express');
const router = express.Router();

// Import our optimized utils
const sqlMonitor = require('../utils/sqlMonitor');
const sqlTracer = require('../utils/sqlTracer');
const { getPoolStatus, checkHealth } = require('../utils/db');
const abuseProtection = require('../utils/abuseProtectionService');

// Safe logger import
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[MONITORING INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[MONITORING WARN]', msg, data || ''),
    error: (msg, data) => console.error('[MONITORING ERROR]', msg, data || '')
  };
}

// =====================================================
// MIDDLEWARE - ADMIN AUTHENTICATION
// =====================================================
function requireAdmin(req, res, next) {
  try {
    // Check if user is authenticated and is admin
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (req.user.role !== 'admin') {
      logger.warn('Non-admin user attempted to access monitoring', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin role required'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Admin authentication middleware error', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
}

// =====================================================
// STATS ENDPOINT - SQL MONITORING
// =====================================================
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    logger.info('Monitoring stats requested', {
      userId: req.user.id,
      ip: req.ip
    });
    
    // Get stats from both monitoring systems
    const sqlMonitorStats = sqlMonitor.getStats();
    const sqlTracerStats = sqlTracer.getStats();
    
    // Combine stats from both systems for comprehensive view
    const combinedStats = {
      // Query statistics
      total: Math.max(sqlMonitorStats.queries?.total || 0, sqlTracerStats.queries?.total || 0),
      select: Math.max(sqlMonitorStats.queries?.select || 0, sqlTracerStats.queries?.select || 0),
      insert: Math.max(sqlMonitorStats.queries?.insert || 0, sqlTracerStats.queries?.insert || 0),
      update: Math.max(sqlMonitorStats.queries?.update || 0, sqlTracerStats.queries?.update || 0),
      delete: Math.max(sqlMonitorStats.queries?.delete || 0, sqlTracerStats.queries?.delete || 0),
      other: Math.max(sqlMonitorStats.queries?.other || 0, sqlTracerStats.queries?.other || 0),
      
      // Security statistics
      suspiciousCount: Math.max(
        sqlMonitorStats.queries?.suspicious || 0, 
        sqlTracerStats.queries?.suspicious || 0
      ),
      
      // Performance statistics
      activeUsers: Math.max(
        sqlMonitorStats.queries?.activeUsers || 0,
        sqlTracerStats.users?.active || 0
      ),
      queriesPerMinute: sqlMonitorStats.queries?.queriesPerMinute || sqlTracerStats.performance?.queriesPerMinute || '0.00',
      
      // Runtime information
      runtimeMinutes: sqlMonitorStats.queries?.runtimeMinutes || sqlTracerStats.performance?.runtimeMinutes || '0.00',
      
      // Timestamp
      timestamp: new Date().toISOString(),
      
      // Source information
      sources: {
        sqlMonitor: !!sqlMonitorStats.queries,
        sqlTracer: !!sqlTracerStats.queries
      }
    };
    
    res.json({
      success: true,
      stats: combinedStats,
      metadata: {
        generatedAt: new Date().toISOString(),
        sources: ['sqlMonitor', 'sqlTracer']
      }
    });
    
  } catch (error) {
    logger.error('Error fetching monitoring stats', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// SECURITY EVENTS ENDPOINT
// =====================================================
router.get('/security', requireAdmin, async (req, res) => {
  try {
    logger.info('Security events requested', {
      userId: req.user.id,
      ip: req.ip
    });
    
    // Get query parameters for filtering
    const {
      type,
      severity,
      userId: filterUserId,
      limit = 20,
      since
    } = req.query;
    
    // Get security events from tracer
    const securityEvents = sqlTracer.getSecurityEvents({
      type,
      severity,
      userId: filterUserId,
      limit: parseInt(limit),
      since
    });
    
    // Get threat summary
    const threatSummary = sqlTracer.getThreatSummary();
    
    res.json({
      success: true,
      securityEvents: securityEvents,
      threatSummary: threatSummary,
      metadata: {
        generatedAt: new Date().toISOString(),
        filters: { type, severity, userId: filterUserId, limit, since }
      }
    });
    
  } catch (error) {
    logger.error('Error fetching security events', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// POOL METRICS ENDPOINT
// =====================================================
router.get('/pool', requireAdmin, async (req, res) => {
  try {
    logger.info('Pool metrics requested', {
      userId: req.user.id,
      ip: req.ip
    });
    
    // Get pool status from our optimized db.js
    const poolStatus = await getPoolStatus();
    
    // Get health check
    const healthCheck = await checkHealth();
    
    // Get pool metrics from SQL monitor
    const sqlMonitorStats = sqlMonitor.getStats();
    const poolMetrics = sqlMonitor.getPoolMetrics();
    
    // Generate recommendations based on pool status
    const recommendations = generatePoolRecommendations(poolStatus, healthCheck);
    
    res.json({
      success: true,
      data: {
        poolStatus,
        poolMetrics,
        healthCheck,
        recommendations,
        sqlMonitorStats: sqlMonitorStats.pool || null
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'optimized_db_module'
      }
    });
    
  } catch (error) {
    logger.error('Error fetching pool metrics', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pool metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// HEALTH CHECK ENDPOINT
// =====================================================
router.get('/health', requireAdmin, async (req, res) => {
  try {
    // Get health status from all systems
    const dbHealth = await checkHealth();
    const abuseHealth = abuseProtection.getHealthStatus ? abuseProtection.getHealthStatus() : { status: 'unknown' };
    const sqlMonitorHealth = sqlMonitor.getStats();
    const sqlTracerHealth = sqlTracer.getStats();
    
    const overallHealth = {
      status: 'healthy',
      components: {
        database: {
          status: (dbHealth.auth.healthy && dbHealth.template.healthy) ? 'healthy' : 'unhealthy',
          details: dbHealth
        },
        abuseProtection: {
          status: abuseHealth.status || 'unknown',
          details: abuseHealth
        },
        sqlMonitor: {
          status: sqlMonitorHealth.health?.isHealthy !== false ? 'healthy' : 'unhealthy',
          details: {
            isHealthy: sqlMonitorHealth.health?.isHealthy,
            consecutiveErrors: sqlMonitorHealth.health?.consecutiveErrors,
            lastCheck: sqlMonitorHealth.health?.lastCheck
          }
        },
        sqlTracer: {
          status: 'healthy', // SQL tracer doesn't have explicit health check
          details: {
            totalQueries: sqlTracerHealth.queries?.total || 0,
            suspiciousQueries: sqlTracerHealth.queries?.suspicious || 0
          }
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Determine overall status
    const componentStatuses = Object.values(overallHealth.components).map(c => c.status);
    if (componentStatuses.includes('unhealthy')) {
      overallHealth.status = 'degraded';
    }
    
    res.json({
      success: true,
      health: overallHealth
    });
    
  } catch (error) {
    logger.error('Error fetching health status', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health status',
      health: {
        status: 'error',
        error: error.message
      }
    });
  }
});

// =====================================================
// SYSTEM INFO ENDPOINT
// =====================================================
router.get('/system', requireAdmin, async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const systemInfo = {
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: uptime,
        uptimeFormatted: formatUptime(uptime)
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT || 3000
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      system: systemInfo
    });
    
  } catch (error) {
    logger.error('Error fetching system info', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system information'
    });
  }
});

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function generatePoolRecommendations(poolStatus, healthCheck) {
  const recommendations = [];
  
  try {
    // Check auth pool
    if (poolStatus.authPool) {
      const authUtilization = parseFloat(poolStatus.authPool.utilizationPercentage);
      if (authUtilization > 80) {
        recommendations.push('Auth pool utilization is high (>80%). Consider increasing connection limit.');
      } else if (authUtilization > 60) {
        recommendations.push('Auth pool utilization is moderate (>60%). Monitor for potential scaling needs.');
      }
      
      if (poolStatus.authPool.queue > 0) {
        recommendations.push(`Auth pool has ${poolStatus.authPool.queue} queued connections. Consider optimizing query performance.`);
      }
    }
    
    // Check template pool
    if (poolStatus.templatePool || poolStatus.mainPool) {
      const templatePool = poolStatus.templatePool || poolStatus.mainPool;
      const templateUtilization = parseFloat(templatePool.utilizationPercentage);
      
      if (templateUtilization > 80) {
        recommendations.push('Template pool utilization is high (>80%). Consider increasing connection limit.');
      } else if (templateUtilization > 60) {
        recommendations.push('Template pool utilization is moderate (>60%). Monitor for potential scaling needs.');
      }
      
      if (templatePool.queue > 0) {
        recommendations.push(`Template pool has ${templatePool.queue} queued connections. Consider optimizing query performance.`);
      }
    }
    
    // Check health
    if (healthCheck) {
      if (!healthCheck.auth?.healthy) {
        recommendations.push('Auth database connection is unhealthy. Check database server status.');
      }
      
      if (!healthCheck.template?.healthy) {
        recommendations.push('Template database connection is unhealthy. Check database server status.');
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All database pools are operating within normal parameters.');
    }
    
  } catch (error) {
    logger.warn('Error generating pool recommendations', {
      error: error.message
    });
    recommendations.push('Unable to generate recommendations due to data parsing error.');
  }
  
  return recommendations;
}

function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0) formatted += `${hours}h `;
  formatted += `${minutes}m`;
  
  return formatted.trim();
}

module.exports = router;