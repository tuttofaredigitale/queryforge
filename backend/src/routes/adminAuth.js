// backend/routes/adminAuth.js - ADMIN AUTHENTICATION API
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Import our optimized database
const { executeAuth } = require('../utils/db');

// Safe logger import
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[ADMIN AUTH INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[ADMIN AUTH WARN]', msg, data || ''),
    error: (msg, data) => console.error('[ADMIN AUTH ERROR]', msg, data || '')
  };
}

// =====================================================
// CONFIGURATION
// =====================================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// In-memory storage for active sessions (in production, use Redis)
const activeSessions = new Map();

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Generate device fingerprint from request
function generateDeviceFingerprint(req) {
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  
  return {
    userAgent,
    acceptLanguage,
    acceptEncoding,
    ip: req.ip,
    platform: detectPlatform(userAgent),
    screenSize: 'unknown' // Frontend can send this via custom header
  };
}

function detectPlatform(userAgent) {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Unknown';
}

// Generate tokens
function generateTokens(user, deviceInfo) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: ACCESS_TOKEN_EXPIRY 
  });
  
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' }, 
    JWT_REFRESH_SECRET, 
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  
  // Store session
  const sessionId = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session = {
    id: sessionId,
    userId: user.id,
    refreshToken,
    deviceInfo,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    lastUsed: new Date()
  };
  
  activeSessions.set(refreshToken, session);
  
  return { accessToken, refreshToken, session };
}

// Verify JWT token middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid access token'
    });
  }
}

// =====================================================
// ADMIN LOGIN ENDPOINT
// =====================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    logger.info('Admin login attempt', {
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Find user in database
    const [users] = await executeAuth(
      'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "active"',
      [email, email]
    );
    
    if (users.length === 0) {
      logger.warn('Admin login failed - user not found', {
        email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    
    // Check if user is admin
    if (user.role !== 'admin') {
      logger.warn('Non-admin user attempted admin login', {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      logger.warn('Admin login failed - invalid password', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate device fingerprint
    const deviceInfo = generateDeviceFingerprint(req);
    
    // Generate tokens
    const { accessToken, refreshToken, session } = generateTokens(user, deviceInfo);
    
    // Update last login
    await executeAuth(
      'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = ?',
      [user.id]
    );
    
    logger.info('Admin login successful', {
      userId: user.id,
      email: user.email,
      sessionId: session.id,
      ip: req.ip
    });
    
    // Return user info (without password)
    const { password: _, ...userInfo } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: userInfo,
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    });
    
  } catch (error) {
    logger.error('Admin login error', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// =====================================================
// REFRESH TOKEN ENDPOINT
// =====================================================
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    // Check if session exists
    const session = activeSessions.get(refreshToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Check if session expired
    if (session.expiresAt < new Date()) {
      activeSessions.delete(refreshToken);
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
      });
    }
    
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      
      // Get fresh user data
      const [users] = await executeAuth(
        'SELECT * FROM users WHERE id = ? AND status = "active" AND role = "admin"',
        [decoded.id]
      );
      
      if (users.length === 0) {
        activeSessions.delete(refreshToken);
        return res.status(401).json({
          success: false,
          message: 'User not found or not admin'
        });
      }
      
      const user = users[0];
      
      // Generate new tokens
      const deviceInfo = session.deviceInfo;
      const { accessToken, refreshToken: newRefreshToken, session: newSession } = generateTokens(user, deviceInfo);
      
      // Remove old session
      activeSessions.delete(refreshToken);
      
      // Update last used
      session.lastUsed = new Date();
      
      logger.info('Token refreshed successfully', {
        userId: user.id,
        oldSessionId: session.id,
        newSessionId: newSession.id,
        ip: req.ip
      });
      
      res.json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken,
        session: {
          id: newSession.id,
          expiresAt: newSession.expiresAt
        }
      });
      
    } catch (jwtError) {
      activeSessions.delete(refreshToken);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
  } catch (error) {
    logger.error('Token refresh error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh'
    });
  }
});

// =====================================================
// LOGOUT ENDPOINT
// =====================================================
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken && activeSessions.has(refreshToken)) {
      const session = activeSessions.get(refreshToken);
      activeSessions.delete(refreshToken);
      
      logger.info('User logged out', {
        userId: req.user.id,
        sessionId: session.id,
        ip: req.ip
      });
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
});

// =====================================================
// GET ACTIVE SESSIONS
// =====================================================
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all sessions for this user
    const userSessions = [];
    
    for (const [refreshToken, session] of activeSessions.entries()) {
      if (session.userId === userId) {
        // Don't send the actual refresh token, just a preview
        const tokenPreview = refreshToken.substring(0, 8);
        
        userSessions.push({
          id: session.id,
          token_preview: tokenPreview,
          device_info: session.deviceInfo,
          created_at: session.createdAt,
          expires_at: session.expiresAt,
          last_used: session.lastUsed
        });
      }
    }
    
    // Sort by creation date (newest first)
    userSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({
      success: true,
      sessions: userSessions
    });
    
  } catch (error) {
    logger.error('Error fetching sessions', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
});

// =====================================================
// REVOKE SESSION
// =====================================================
router.post('/revoke-session', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID required'
      });
    }
    
    // Find and remove the session
    let sessionFound = false;
    
    for (const [refreshToken, session] of activeSessions.entries()) {
      if (session.id === sessionId && session.userId === userId) {
        activeSessions.delete(refreshToken);
        sessionFound = true;
        
        logger.info('Session revoked', {
          userId,
          sessionId,
          revokedBy: req.user.id,
          ip: req.ip
        });
        
        break;
      }
    }
    
    if (!sessionFound) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
    
  } catch (error) {
    logger.error('Error revoking session', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to revoke session'
    });
  }
});

// =====================================================
// CLEANUP EXPIRED SESSIONS (periodic task)
// =====================================================
function cleanupExpiredSessions() {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [refreshToken, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(refreshToken);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info('Cleaned up expired sessions', {
      count: cleanedCount,
      remainingSessions: activeSessions.size
    });
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Export the router and middleware
module.exports = {
  router,
  verifyToken,
  activeSessions
};