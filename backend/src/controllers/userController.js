// controllers/userController.js - Enterprise SaaS User Management

const { authPool } = require('../utils/db'); 
const { createUserDatabase } = require('../utils/userDatabaseManager'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const planManager = require('../utils/planManager');

// =====================================================
// CONSTANTS & CONFIGURATION
// =====================================================
const CONFIG = {
  SECURITY: {
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    PASSWORD_RESET_EXPIRES_HOURS: parseInt(process.env.PASSWORD_RESET_EXPIRES_HOURS) || 1,
    EMAIL_VERIFICATION_EXPIRES_HOURS: parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS) || 24
  },
  VALIDATION: {
    MIN_PASSWORD_LENGTH: parseInt(process.env.MIN_PASSWORD_LENGTH) || 8,
    MAX_PASSWORD_LENGTH: parseInt(process.env.MAX_PASSWORD_LENGTH) || 128,
    MIN_USERNAME_LENGTH: parseInt(process.env.MIN_USERNAME_LENGTH) || 3,
    MAX_USERNAME_LENGTH: parseInt(process.env.MAX_USERNAME_LENGTH) || 30,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    USERNAME_REGEX: /^[a-zA-Z0-9_-]+$/
  },
  RATE_LIMITING: {
    LOGIN_ATTEMPTS_WINDOW: parseInt(process.env.LOGIN_ATTEMPTS_WINDOW) || 900000, // 15 minutes
    MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    REGISTRATION_ATTEMPTS_WINDOW: parseInt(process.env.REGISTRATION_ATTEMPTS_WINDOW) || 3600000, // 1 hour
    MAX_REGISTRATION_ATTEMPTS: parseInt(process.env.MAX_REGISTRATION_ATTEMPTS) || 3
  },
  BUSINESS: {
    DEFAULT_PLAN: process.env.DEFAULT_USER_PLAN || 'free',
    REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    ENABLE_ANALYTICS: process.env.ENABLE_USER_ANALYTICS !== 'false'
  },
  APP: {
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    COMPANY_NAME: process.env.COMPANY_NAME || 'QueryForge'
  }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates email format and domain
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required and must be a string');
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!CONFIG.VALIDATION.EMAIL_REGEX.test(trimmedEmail)) {
    throw new Error('Invalid email format');
  }
  
  if (trimmedEmail.length > 254) { // RFC 5321 limit
    throw new Error('Email address too long');
  }
  
  // Check for disposable email domains (basic list)
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com'
  ];
  
  const domain = trimmedEmail.split('@')[1];
  if (disposableDomains.includes(domain)) {
    throw new Error('Disposable email addresses are not allowed');
  }
  
  return trimmedEmail;
};

/**
 * Validates password strength
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required and must be a string');
  }
  
  if (password.length < CONFIG.VALIDATION.MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} characters long`);
  }
  
  if (password.length > CONFIG.VALIDATION.MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be no more than ${CONFIG.VALIDATION.MAX_PASSWORD_LENGTH} characters long`);
  }
  
  // Check password complexity
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const complexityScore = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  
  if (complexityScore < 3) {
    throw new Error('Password must include at least 3 of: lowercase letters, uppercase letters, numbers, and special characters');
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'dragon'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    throw new Error('Password is too common and easily guessable');
  }
  
  return password;
};

/**
 * Validates username
 */
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required and must be a string');
  }
  
  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length < CONFIG.VALIDATION.MIN_USERNAME_LENGTH) {
    throw new Error(`Username must be at least ${CONFIG.VALIDATION.MIN_USERNAME_LENGTH} characters long`);
  }
  
  if (trimmedUsername.length > CONFIG.VALIDATION.MAX_USERNAME_LENGTH) {
    throw new Error(`Username must be no more than ${CONFIG.VALIDATION.MAX_USERNAME_LENGTH} characters long`);
  }
  
  if (!CONFIG.VALIDATION.USERNAME_REGEX.test(trimmedUsername)) {
    throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
  }
  
  // Check for reserved usernames
  const reservedUsernames = [
    'admin', 'root', 'api', 'www', 'mail', 'support', 'help', 'info', 'contact',
    'billing', 'sales', 'marketing', 'legal', 'privacy', 'terms', 'about'
  ];
  
  if (reservedUsernames.includes(trimmedUsername.toLowerCase())) {
    throw new Error('This username is reserved and cannot be used');
  }
  
  return trimmedUsername;
};

/**
 * Generates secure random token
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Creates JWT tokens (access + refresh)
 */
const createTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    plan: user.plan || CONFIG.BUSINESS.DEFAULT_PLAN
  };
  
  const accessToken = jwt.sign(
    payload,
    CONFIG.SECURITY.JWT_SECRET,
    { expiresIn: CONFIG.SECURITY.JWT_EXPIRES_IN }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    CONFIG.SECURITY.JWT_SECRET,
    { expiresIn: CONFIG.SECURITY.REFRESH_TOKEN_EXPIRES_IN }
  );
  
  return { accessToken, refreshToken };
};

/**
 * Checks if user exists by email or username
 */
const checkUserExists = async (email, username = null) => {
  let query = 'SELECT id, email, username FROM users WHERE email = ?';
  let params = [email];
  
  if (username) {
    query += ' OR username = ?';
    params.push(username);
  }
  
  const [existingUsers] = await authPool.execute(query, params);
  
  if (existingUsers.length > 0) {
    const existing = existingUsers[0];
    if (existing.email === email) {
      throw new Error('Email address is already in use');
    }
    if (existing.username === username) {
      throw new Error('Username is already taken');
    }
  }
  
  return false;
};

/**
 * Tracks user authentication events for analytics
 */
const trackAuthEvent = async (userId, event, metadata = {}) => {
  if (!CONFIG.BUSINESS.ENABLE_ANALYTICS) return;
  
  try {
    await authPool.execute(
      `INSERT INTO user_analytics 
       (user_id, event_type, event_data, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [userId, event, JSON.stringify(metadata)]
    );
  } catch (error) {
    logger.warn('Failed to track auth event', {
      userId,
      event,
      error: error.message,
      operation: 'track_auth_event'
    });
  }
};

/**
 * Generates username from email if not provided
 */
const generateUsernameFromEmail = async (email) => {
  let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Ensure minimum length
  if (baseUsername.length < CONFIG.VALIDATION.MIN_USERNAME_LENGTH) {
    baseUsername += Math.random().toString(36).substring(2, 8);
  }
  
  // Check if username is available
  let username = baseUsername;
  let counter = 1;
  
  while (true) {
    try {
      const [existing] = await authPool.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      
      if (existing.length === 0) {
        return username;
      }
      
      username = `${baseUsername}${counter}`;
      counter++;
      
      if (counter > 100) { // Prevent infinite loop
        username = baseUsername + Math.random().toString(36).substring(2, 8);
        break;
      }
    } catch (error) {
      logger.error('Error checking username availability', {
        username,
        error: error.message,
        operation: 'generate_username'
      });
      break;
    }
  }
  
  return username;
};

/**
 * Handles user database creation with error recovery
 */
const handleUserDatabaseCreation = async (userId) => {
  try {
    const userDbName = await createUserDatabase(userId);
    
    logger.info('User database created successfully', {
      userId,
      userDbName,
      operation: 'create_user_database'
    });
    
    return userDbName;
  } catch (error) {
    logger.error('Failed to create user database', {
      userId,
      error: error.message,
      stack: error.stack,
      operation: 'create_user_database_error'
    });
    
    // Don't fail registration if database creation fails
    // User can still login and we can retry database creation later
    return null;
  }
};

/**
 * Sends welcome email to new user
 */
const sendWelcomeEmail = async (user) => {
  try {
    await emailService.sendRegistrationConfirmationEmail(user.email, user.username);
    
    logger.info('Welcome email sent successfully', {
      userId: user.id,
      email: user.email,
      operation: 'send_welcome_email'
    });
  } catch (error) {
    logger.error('Failed to send welcome email', {
      userId: user.id,
      email: user.email,
      error: error.message,
      operation: 'send_welcome_email_error'
    });
    
    // Don't fail registration if email fails
  }
};

// =====================================================
// CONTROLLER FUNCTIONS
// =====================================================

/**
 * Registers a new user with comprehensive validation and security
 */
exports.register = async (req, res) => {
  const startTime = Date.now();
  let userId = null;
  
  try {
    const { email, password, username } = req.body;
    const userIP = req.ip;
    const userAgent = req.get('User-Agent');
    
    logger.info('User registration attempt started', {
      email: email?.substring(0, 3) + '***', // Partial email for privacy
      username,
      userIP,
      userAgent,
      operation: 'user_registration_start'
    });
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    const validatedUsername = username ? 
      validateUsername(username) : 
      await generateUsernameFromEmail(validatedEmail);
    
    // Check if user already exists
    await checkUserExists(validatedEmail, validatedUsername);
    
    // Hash password
    logger.debug('Hashing password', {
      email: validatedEmail,
      operation: 'password_hashing'
    });
    
    const hashedPassword = await bcrypt.hash(validatedPassword, CONFIG.SECURITY.BCRYPT_ROUNDS);
    
    // Create user record
    logger.debug('Creating user record', {
      email: validatedEmail,
      username: validatedUsername,
      operation: 'user_creation'
    });
    
    const [result] = await authPool.execute(
      `INSERT INTO users 
       (email, password, username, plan, created_at, updated_at, registration_ip, user_agent) 
       VALUES (?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
      [
        validatedEmail,
        hashedPassword,
        validatedUsername,
        CONFIG.BUSINESS.DEFAULT_PLAN,
        userIP,
        userAgent
      ]
    );
    
    userId = result.insertId;
    
    logger.info('User created successfully', {
      userId,
      email: validatedEmail,
      username: validatedUsername,
      plan: CONFIG.BUSINESS.DEFAULT_PLAN,
      operation: 'user_creation_success'
    });
    
    // Initialize user plan
    try {
      await planManager.initializeUserPlan(userId, CONFIG.BUSINESS.DEFAULT_PLAN);
    } catch (planError) {
      logger.warn('Failed to initialize user plan', {
        userId,
        error: planError.message,
        operation: 'plan_initialization_error'
      });
    }
    
    // Create user database
    const userDbName = await handleUserDatabaseCreation(userId);
    
    // Generate tokens
    const user = {
      id: userId,
      email: validatedEmail,
      username: validatedUsername,
      plan: CONFIG.BUSINESS.DEFAULT_PLAN
    };
    
    const { accessToken, refreshToken } = createTokens(user);
    
    // Send welcome email
    await sendWelcomeEmail(user);
    
    // Track registration event
    await trackAuthEvent(userId, 'registration', {
      userIP,
      userAgent,
      plan: CONFIG.BUSINESS.DEFAULT_PLAN,
      userDbCreated: !!userDbName
    });
    
    const executionTime = Date.now() - startTime;
    
    logger.info('User registration completed successfully', {
      userId,
      email: validatedEmail,
      username: validatedUsername,
      executionTime: `${executionTime}ms`,
      userDbName,
      operation: 'user_registration_complete'
    });
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          email: validatedEmail,
          username: validatedUsername,
          plan: CONFIG.BUSINESS.DEFAULT_PLAN,
          created_at: new Date().toISOString()
        }
      },
      executionTime: `${executionTime}ms`
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('User registration failed', {
      userId,
      email: req.body?.email,
      username: req.body?.username,
      error: error.message,
      stack: error.stack,
      executionTime: `${executionTime}ms`,
      operation: 'user_registration_error'
    });
    
    // Clean up partial user creation if needed
    if (userId) {
      try {
        await authPool.execute('DELETE FROM users WHERE id = ?', [userId]);
        logger.info('Cleaned up partial user creation', {
          userId,
          operation: 'registration_cleanup'
        });
      } catch (cleanupError) {
        logger.error('Failed to cleanup partial user creation', {
          userId,
          error: cleanupError.message,
          operation: 'registration_cleanup_error'
        });
      }
    }
    
    // Return appropriate error response
    const isValidationError = error.message.includes('Email') || 
                             error.message.includes('Password') || 
                             error.message.includes('Username');
    
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: isValidationError ? error.message : 'Registration failed. Please try again.',
      executionTime: `${executionTime}ms`
    });
  }
};

/**
 * Authenticates user login with security measures
 */
exports.login = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, password } = req.body;
    const userIP = req.ip;
    const userAgent = req.get('User-Agent');
    
    logger.info('User login attempt started', {
      email: email?.substring(0, 3) + '***',
      userIP,
      userAgent,
      operation: 'user_login_start'
    });
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const validatedEmail = validateEmail(email);
    
    // Find user
    const [users] = await authPool.execute(
      'SELECT id, email, username, password, plan, email_verified, is_active, last_login FROM users WHERE email = ?',
      [validatedEmail]
    );
    
    if (users.length === 0) {
      logger.warn('Login attempt with non-existent email', {
        email: validatedEmail,
        userIP,
        operation: 'login_invalid_email'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = users[0];
    
    // Check if account is active
    if (!user.is_active) {
      logger.warn('Login attempt with inactive account', {
        userId: user.id,
        email: validatedEmail,
        userIP,
        operation: 'login_inactive_account'
      });
      
      return res.status(403).json({
        success: false,
        message: 'Account is suspended. Please contact support.'
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      logger.warn('Login attempt with invalid password', {
        userId: user.id,
        email: validatedEmail,
        userIP,
        operation: 'login_invalid_password'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Update last login
    await authPool.execute(
      'UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );
    
    // Generate tokens
    const { accessToken, refreshToken } = createTokens(user);
    
    // Track login event
    await trackAuthEvent(user.id, 'login', {
      userIP,
      userAgent,
      plan: user.plan
    });
    
    const executionTime = Date.now() - startTime;
    
    logger.info('User login completed successfully', {
      userId: user.id,
      email: validatedEmail,
      username: user.username,
      plan: user.plan,
      executionTime: `${executionTime}ms`,
      operation: 'user_login_complete'
    });
    
    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          plan: user.plan,
          email_verified: user.email_verified,
          last_login: user.last_login
        }
      },
      executionTime: `${executionTime}ms`
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('User login failed', {
      email: req.body?.email,
      error: error.message,
      stack: error.stack,
      executionTime: `${executionTime}ms`,
      operation: 'user_login_error'
    });
    
    const isValidationError = error.message.includes('Email') || error.message.includes('Password');
    
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: isValidationError ? error.message : 'Login failed. Please try again.',
      executionTime: `${executionTime}ms`
    });
  }
};

/**
 * Refreshes access token using refresh token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, CONFIG.SECURITY.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Get user
    const [users] = await authPool.execute(
      'SELECT id, email, username, plan, is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    
    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    const user = users[0];
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = createTokens(user);
    
    logger.info('Token refreshed successfully', {
      userId: user.id,
      operation: 'token_refresh'
    });
    
    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken
      }
    });
    
  } catch (error) {
    logger.error('Token refresh failed', {
      error: error.message,
      operation: 'token_refresh_error'
    });
    
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

/**
 * Gets user profile information
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [users] = await authPool.execute(
      `SELECT id, email, username, plan, email_verified, created_at, 
              last_login, login_count, subscription_status, subscription_end_date
       FROM users WHERE id = ?`,
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = users[0];
    
    // Get usage statistics
    const [stats] = await authPool.execute(
      `SELECT 
         COUNT(*) as total_queries,
         COUNT(CASE WHEN error IS NULL THEN 1 END) as successful_queries,
         COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as queries_last_month
       FROM query_history WHERE user_id = ?`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          plan: user.plan,
          email_verified: user.email_verified,
          created_at: user.created_at,
          last_login: user.last_login,
          login_count: user.login_count,
          subscription_status: user.subscription_status,
          subscription_end_date: user.subscription_end_date
        },
        usage: {
          total_queries: stats[0]?.total_queries || 0,
          successful_queries: stats[0]?.successful_queries || 0,
          queries_last_month: stats[0]?.queries_last_month || 0,
          success_rate: stats[0]?.total_queries > 0 ? 
            Math.round((stats[0].successful_queries / stats[0].total_queries) * 100) : 0
        }
      }
    });
    
  } catch (error) {
    logger.error('Error getting user profile', {
      userId: req.user?.id,
      error: error.message,
      operation: 'get_profile_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving profile'
    });
  }
};

/**
 * Updates user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;
    
    if (!username && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (username or email) is required'
      });
    }
    
    const updates = [];
    const values = [];
    
    if (username) {
      const validatedUsername = validateUsername(username);
      
      // Check if username is already taken
      const [existing] = await authPool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [validatedUsername, userId]
      );
      
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      
      updates.push('username = ?');
      values.push(validatedUsername);
    }
    
    if (email) {
      const validatedEmail = validateEmail(email);
      
      // Check if email is already taken
      const [existing] = await authPool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [validatedEmail, userId]
      );
      
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email address is already in use'
        });
      }
      
      updates.push('email = ?');
      values.push(validatedEmail);
      
      // Reset email verification if email changed
      updates.push('email_verified = FALSE');
    }
    
    updates.push('updated_at = NOW()');
    values.push(userId);
    
    await authPool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    logger.info('User profile updated successfully', {
      userId,
      updatedFields: updates.filter(u => !u.includes('updated_at')),
      operation: 'update_profile'
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    logger.error('Error updating user profile', {
      userId: req.user?.id,
      error: error.message,
      operation: 'update_profile_error'
    });
    
    const isValidationError = error.message.includes('Email') || error.message.includes('Username');
    
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: isValidationError ? error.message : 'Error updating profile'
    });
  }
};

/**
 * Changes user password
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    // Get current password hash
    const [users] = await authPool.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, users[0].password);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Validate new password
    const validatedPassword = validatePassword(newPassword);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedPassword, CONFIG.SECURITY.BCRYPT_ROUNDS);
    
    // Update password
    await authPool.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, userId]
    );
    
    // Send confirmation email
    try {
      const userEmail = req.user.email;
      const username = req.user.username;
      await emailService.sendPasswordChangedEmail(userEmail, username);
    } catch (emailError) {
      logger.warn('Failed to send password change confirmation email', {
        userId,
        error: emailError.message,
        operation: 'password_change_email_error'
      });
    }
    
    // Track password change event
    await trackAuthEvent(userId, 'password_change', {
      userIP: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    logger.info('Password changed successfully', {
      userId,
      userIP: req.ip,
      operation: 'change_password'
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    logger.error('Error changing password', {
      userId: req.user?.id,
      error: error.message,
      operation: 'change_password_error'
    });
    
    const isValidationError = error.message.includes('Password');
    
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: isValidationError ? error.message : 'Error changing password'
    });
  }
};

/**
 * Deletes user account
 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, confirmation } = req.body;
    
    if (!password || confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation (type "DELETE") are required'
      });
    }
    
    // Verify password
    const [users] = await authPool.execute(
      'SELECT password, email, username FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, users[0].password);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }
    
    const user = users[0];
    
    // Start transaction for account deletion
    await authPool.execute('START TRANSACTION');
    
    try {
      // Delete user data
      await authPool.execute('DELETE FROM query_history WHERE user_id = ?', [userId]);
      await authPool.execute('DELETE FROM saved_queries WHERE user_id = ?', [userId]);
      await authPool.execute('DELETE FROM user_analytics WHERE user_id = ?', [userId]);
      await authPool.execute('DELETE FROM user_backups WHERE user_id = ?', [userId]);
      
      // Delete user account
      await authPool.execute('DELETE FROM users WHERE id = ?', [userId]);
      
      await authPool.execute('COMMIT');
      
      // Send account deletion confirmation email
      try {
        await emailService.sendAccountDeletionConfirmation(user.email, user.username);
      } catch (emailError) {
        logger.warn('Failed to send account deletion confirmation email', {
          userId,
          error: emailError.message,
          operation: 'account_deletion_email_error'
        });
      }
      
      logger.info('User account deleted successfully', {
        userId,
        email: user.email,
        username: user.username,
        userIP: req.ip,
        operation: 'delete_account'
      });
      
      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
      
    } catch (error) {
      await authPool.execute('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    logger.error('Error deleting user account', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      operation: 'delete_account_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error deleting account. Please try again.'
    });
  }
};

/**
 * Logs out user (invalidates tokens - client-side primarily)
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Track logout event
    await trackAuthEvent(userId, 'logout', {
      userIP: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    logger.info('User logged out successfully', {
      userId,
      operation: 'logout'
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Error during logout', {
      userId: req.user?.id,
      error: error.message,
      operation: 'logout_error'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
};