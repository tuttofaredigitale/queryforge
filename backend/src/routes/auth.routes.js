// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const db = require('../db/database');
const { getAuthConnection } = db;
const logger = require('../utils/logger');
const { rateLimiter } = require('../middlewares/loggerMiddleware');
const { accountCreationLimiter, trackPasswordReset, trackAccountCreation } = require('../utils/abuseProtectionService');
const { 
  sendPasswordResetEmail, 
  sendPasswordChangedEmail, 
  sendRegistrationConfirmationEmail,
  sendEmailVerificationEmail // Nuova funzione
} = require('../utils/emailService');
const userDatabaseManager = require('../db/prodDatabaseManager');

// Secret keys
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'sql-playground-secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'sql-playground-refresh-secret';

// Configurazione verifica email
const EMAIL_VERIFICATION_CONFIG = {
  TOKEN_EXPIRES_HOURS: parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS) || 24,
  REQUIRE_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION !== 'false' // Default: true
};

// Rate limiters specifici per auth
const loginRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 5, // max 5 tentativi di login per 15 min
  keyPrefix: 'login:'
});

const passwordResetRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 ora
  maxRequests: 3, // max 3 richieste di reset per ora
  keyPrefix: 'reset:'
});

const tokenRefreshRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 10, // max 10 refresh per minuto
  keyPrefix: 'refresh:'
});

const resendVerificationRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 ora
  maxRequests: 3, // max 3 richieste di reinvio per ora
  keyPrefix: 'resend-verify:'
});

// Middleware di autenticazione
const authMiddleware = (req, res, next) => {
  try {
    // Ottieni il token dall'header Authorization
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token di accesso non fornito'
      });
    }

    // Verifica il token
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Errore autenticazione:', error);
    return res.status(401).json({
      success: false,
      message: 'Token non valido o scaduto'
    });
  }
};

// Validazione input per auth
const validateAuthInput = (req, res, next) => {
  const { email, password, username } = req.body;
  
  // Sanitizzazione base
  if (email && typeof email === 'string') {
    req.body.email = email.trim().toLowerCase();
  }
  if (username && typeof username === 'string') {
    req.body.username = username.trim();
  }
  if (password && typeof password === 'string') {
    req.body.password = password.trim();
  }
  
  next();
};

// Genera access token
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email,
      role: user.role || 'user'
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' } // Ridotto a 15 minuti per sicurezza
  );
};

// Genera refresh token
const generateRefreshToken = async (user, deviceInfo = {}) => {
  let connection;
  try {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    // Calcola la data di scadenza (7 giorni)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Serializza le informazioni sul dispositivo in modo sicuro
    const deviceInfoJson = JSON.stringify(deviceInfo);
    
    // Salva il refresh token nel database
    connection = await getAuthConnection();
    
    // Verifica se esiste già un token attivo con lo stesso device_info (anti-duplicazione)
    if (Object.keys(deviceInfo).length > 0) {
      const [existingTokens] = await connection.execute(
        'SELECT * FROM refresh_tokens WHERE user_id = ? AND device_info = ? AND is_revoked = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [user.id, deviceInfoJson]
      );
      
      // Se esiste un token recente (meno di 10 secondi fa) dallo stesso dispositivo, riutilizzalo
      if (existingTokens.length > 0) {
        const existingToken = existingTokens[0];
        const tokenAge = (new Date() - new Date(existingToken.created_at)) / 1000; // in secondi
        
        if (tokenAge < 10) {
          logger.debug(`Riutilizzo refresh token esistente per utente ${user.id}`);
          return existingToken.token;
        }
      }
    }
    
    // Inserisci il nuovo refresh token con device_info
    await connection.execute(
      'INSERT INTO refresh_tokens (user_id, token, expires_at, device_info) VALUES (?, ?, ?, ?)',
      [user.id, refreshToken, expiresAt, deviceInfoJson]
    );
    
    logger.debug(`Nuovo refresh token generato per utente ${user.id}`);
    return refreshToken;
  } catch (error) {
    logger.error('Errore generazione refresh token:', error);
    throw error;
  } finally {
    if (connection) connection.release(); // Rilascia sempre la connessione
  }
};

/**
 * Genera token di verifica email
 */
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Calcola data scadenza token verifica
 */
const getEmailVerificationExpiry = () => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + EMAIL_VERIFICATION_CONFIG.TOKEN_EXPIRES_HOURS);
  return expiry;
};

// --- Password Reset Flow ---

/**
 * Richiesta di reset password
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', passwordResetRateLimit, validateAuthInput, async (req, res) => {
  let connection;
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email valida richiesta'
      });
    }
    
    connection = await getAuthConnection();
    
    // Controlla se l'email è associata a un account
    const [users] = await connection.execute(
      'SELECT id, username, email FROM users WHERE email = ?',
      [email]
    );
    
    // Non rivelare se l'email esiste o meno (per sicurezza)
    if (users.length === 0) {
      logger.info(`Richiesta reset password per email inesistente: ${email}`);
      return res.json({
        success: true,
        message: 'Se l\'indirizzo email è associato a un account, riceverai un\'email con le istruzioni per reimpostare la password.'
      });
    }
    
    const user = users[0];
    
    // Genera un token casuale
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 ora
    
    // Salva il token nel database
    await connection.execute(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, resetTokenExpiry, user.id]
    );
    
    // Costruisci il link di reset
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    // Invia l'email
    await sendPasswordResetEmail(user.email, user.username, resetUrl);
    
    // Traccia l'operazione per la protezione anti-abuso
    const ip = req.ip || req.connection?.remoteAddress;
    trackPasswordReset(ip);
    
    logger.info(`Reset password richiesto per utente: ${user.id}`);
    
    res.json({
      success: true,
      message: 'Se l\'indirizzo email è associato a un account, riceverai un\'email con le istruzioni per reimpostare la password.'
    });
  } catch (error) {
    logger.error('Errore nella richiesta di reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Si è verificato un errore nella richiesta di reset password'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Login route - Supporta sia username che email
router.post('/login', loginRateLimit, validateAuthInput, async (req, res) => {
  try {
    // Estrai email/username, password e deviceInfo
    const { email, password, deviceInfo = {} } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Username e password sono obbligatori'
      });
    }

    // Controlla se email contiene @; se sì, cerca per email, altrimenti per username
    const isEmail = email.includes('@');
    const field = isEmail ? 'email' : 'username';

    const query = `SELECT * FROM users WHERE ${field} = ?`;
    try {
      const [rows] = await db.executeAuth(query, [email]);

      if (!rows || rows.length === 0) {
        logger.warn(`Tentativo di login fallito per ${field}: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Credenziali non valide'
        });
      }

      const user = rows[0];
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        logger.warn(`Password errata per utente: ${user.id}`);
        return res.status(401).json({
          success: false,
          message: 'Credenziali non valide'
        });
      }

      // =====================================================
      // NUOVO: Verifica se l'email è stata confermata
      // =====================================================
      if (EMAIL_VERIFICATION_CONFIG.REQUIRE_VERIFICATION && !user.email_verified) {
        logger.info(`Login bloccato per utente ${user.id}: email non verificata`);
        return res.status(403).json({
          success: false,
          message: 'Devi verificare la tua email prima di accedere. Controlla la tua casella di posta.',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email // Per permettere il reinvio
        });
      }
      // =====================================================

      // Verificare se il campo role esiste, altrimenti usa 'user' come default
      const userRole = user.role || 'user';
      
      // Genera access token (durata ridotta)
      const accessToken = generateAccessToken(user);
      
      // Genera refresh token con informazioni dispositivo
      const refreshToken = await generateRefreshToken(user, deviceInfo);

      logger.info(`Login riuscito per utente: ${user.id} (${user.username})`);

      return res.status(200).json({
        success: true,
        message: 'Login effettuato con successo',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: userRole,
          email_verified: !!user.email_verified
        }
      });
    } catch (dbError) {
      logger.error('ERRORE QUERY DATABASE:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Errore del server durante la ricerca dell\'utente'
      });
    }
  } catch (error) {
    logger.error('ERRORE GENERICO LOGIN:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore del server durante il login'
    });
  }
});

// Logout route con supporto device info
router.post('/logout', authMiddleware, async (req, res) => {
  const { refreshToken, deviceInfo = {} } = req.body;
  const userId = req.user.id;
  let connection;
  
  try {
    connection = await getAuthConnection();
    
    // Aggiorna la data di ultimo logout nella tabella users
    await connection.execute(
      'UPDATE users SET last_logout = NOW() WHERE id = ?',
      [userId]
    );
    
    if (refreshToken) {
      // Registra informazioni dispositivo (se presenti)
      if (Object.keys(deviceInfo).length > 0) {
        const deviceInfoJson = JSON.stringify(deviceInfo);
        await connection.execute(
          'UPDATE refresh_tokens SET device_info = JSON_MERGE_PATCH(device_info, ?) WHERE user_id = ? AND token = ? AND is_revoked = FALSE',
          [deviceInfoJson, userId, refreshToken]
        );
      }
      
      // Revoca solo il token specifico
      await connection.execute(
        'UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ? AND token = ?',
        [userId, refreshToken]
      );
    } else {
      // Revoca tutti i token dell'utente
      await connection.execute(
        'UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?',
        [userId]
      );
    }
    
    logger.info(`Logout effettuato per utente: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Logout effettuato con successo'
    });
  } catch (error) {
    logger.error('Errore logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante il logout'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Rotta protetta per informazioni utente
router.get('/profile', authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
});

router.post('/refresh-token', tokenRefreshRateLimit, async (req, res) => {
  const { refreshToken, deviceInfo = {} } = req.body;
  let connection;
  
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token non fornito'
    });
  }
  
  try {
    connection = await getAuthConnection();
    
    // 1. Verifica il token
    const [tokens] = await connection.execute(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW() AND is_revoked = FALSE',
      [refreshToken]
    );
    
    if (!tokens || tokens.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token non valido o scaduto'
      });
    }
    
    const tokenData = tokens[0];
    
    // 2. Ottieni dati utente
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [tokenData.user_id]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }
    
    const user = users[0];
    
    // 3. Revoca il token corrente
    await connection.execute(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = ?',
      [tokenData.id]
    );
    
    // 4. Limita a massimo 3 token attivi per utente (incluso quello nuovo)
    await connection.execute(`
      UPDATE refresh_tokens 
      SET is_revoked = TRUE 
      WHERE user_id = ? 
        AND is_revoked = FALSE 
        AND id NOT IN (
          SELECT id FROM (
            SELECT id FROM refresh_tokens 
            WHERE user_id = ? AND is_revoked = FALSE 
            ORDER BY created_at DESC LIMIT 2
          ) AS recent_tokens
        )`,
      [user.id, user.id]
    );
    
    // 5. Genera nuovi token
    const newAccessToken = generateAccessToken(user);
    // Rilascio temporaneo per evitare deadlock durante generateRefreshToken
    connection.release();
    connection = null;
    
    // Gestione robusta delle informazioni del dispositivo
    let oldDeviceInfo = {};
    if (tokenData.device_info) {
      try {
        // Se è già un oggetto, usalo direttamente
        if (typeof tokenData.device_info === 'object' && tokenData.device_info !== null) {
          oldDeviceInfo = tokenData.device_info;
        } 
        // Se è una stringa, prova a parsarla come JSON
        else if (typeof tokenData.device_info === 'string') {
          // Ignora la stringa "[object Object]" e trattala come un oggetto vuoto
          if (tokenData.device_info === "[object Object]") {
            oldDeviceInfo = {};
          } else {
            oldDeviceInfo = JSON.parse(tokenData.device_info);
          }
        }
      } catch (e) {
        logger.error('Errore parsing device_info:', e, 'Valore:', tokenData.device_info);
        oldDeviceInfo = {}; // In caso di errore, usa un oggetto vuoto
      }
    }
    
    // Aggiorna device_info con i dati attuali se disponibili
    if (Object.keys(deviceInfo).length > 0) {
      // Unisci le informazioni precedenti con quelle nuove
      const mergedDeviceInfo = { ...oldDeviceInfo, ...deviceInfo };
      const newRefreshToken = await generateRefreshToken(user, mergedDeviceInfo);
      
      return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    } else {
      // Mantieni le informazioni precedenti
      const newRefreshToken = await generateRefreshToken(user, oldDeviceInfo);
      
      return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    }
  } catch (error) {
    logger.error('Errore refresh token:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore del server durante il refresh del token'
    });
  } finally {
    if (connection) connection.release();
  }
});

// =====================================================
// REGISTRAZIONE CON VERIFICA EMAIL
// =====================================================
router.post('/register', accountCreationLimiter, validateAuthInput, async (req, res) => {
  let connection;
  
  try {
    const { username, password, email, deviceInfo = {}, termsAccepted, privacyAccepted } = req.body;

    // Verifica campi
    if (!username || !password || !email || !termsAccepted || !privacyAccepted) {
      return res.status(400).json({ success: false, message: 'Tutti i campi, inclusa l\'accettazione dei termini e della privacy, sono obbligatori' });
    }
    
    // Validazione email
    if (!email.includes('@') || email.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Email non valida'
      });
    }
    
    // Validazione username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Username deve essere tra 3 e 20 caratteri'
      });
    }
    
    // Validazione password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password deve essere almeno 8 caratteri'
      });
    }
    
    // Verifica accettazione termini
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: 'È necessario accettare i termini e condizioni per registrarsi'
      });
    }

    if (!privacyAccepted) {
      return res.status(400).json({
        success: false,
        message: 'È necessario accettare la Privacy Policy per registrarsi'
      });
    }

    // Logica creazione
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // =====================================================
    // NUOVO: Genera token di verifica email
    // =====================================================
    const emailVerificationToken = generateEmailVerificationToken();
    const emailVerificationExpires = getEmailVerificationExpiry();
    // =====================================================

    // Inserisci utente
    connection = await getAuthConnection();
    
    await connection.beginTransaction();

    // 1. Inserisci il nuovo utente CON token di verifica
    const [result] = await connection.execute(
      `INSERT INTO users (
        username, email, password, role, 
        terms_accepted, terms_accepted_date, 
        privacy_policy_accepted, privacy_policy_accepted_date,
        email_verified, email_verification_token, email_verification_expires
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username, email, hashedPassword, 'user', 
        1, currentDate, 
        1, currentDate,
        0, // email_verified = false
        emailVerificationToken,
        emailVerificationExpires
      ]
    );
    const userId = result.insertId;

    logger.info(`[Register] Utente ${userId} inserito, avvio creazione tabelle...`);
    
    // 2. Chiama il manager per creare le tabelle con prefisso
    const creationResult = await userDatabaseManager.createUserTables(userId, connection);

    if (!creationResult.success) {
      await connection.rollback(); 
      logger.error('Creazione tabelle utente fallita durante la registrazione.', { userId, error: creationResult.error });
      return res.status(500).json({ success: false, message: 'Errore durante la configurazione iniziale dell\'account.' });
    }

    // 3. Conferma la transazione
    await connection.commit();
    logger.info(`[Register] Transazione completata per utente ${userId}.`);

    const ip = req.ip || req.connection?.remoteAddress;
    trackAccountCreation(ip);

    // =====================================================
    // NUOVO: Invia email di verifica invece di conferma semplice
    // =====================================================
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${emailVerificationToken}`;
    
    try {
      await sendEmailVerificationEmail(email, username, verificationUrl);
      logger.info(`Email di verifica inviata a ${email} per utente ${userId}`);
    } catch (emailError) {
      logger.error('Errore (non-fatale) invio email di verifica:', emailError);
      // Non blocchiamo la registrazione se l'email fallisce
    }
    // =====================================================

    logger.info(`Nuovo utente registrato: ${userId} (${username}) - In attesa di verifica email`);

    // =====================================================
    // MODIFICATO: NON restituire token di accesso
    // L'utente deve prima verificare l'email
    // =====================================================
    res.status(201).json({
      success: true,
      message: 'Registrazione completata! Controlla la tua email per verificare l\'account.',
      requiresEmailVerification: true,
      email: email // Per mostrare all'utente quale email controllare
    });

  } catch (error) {
    // Gestione errori con rollback
    if (connection) {
      try { await connection.rollback(); } catch (rbError) { logger.error('Fallito rollback dopo errore principale:', rbError); }
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username o email già esistenti.' });
    }
    
    logger.error('Errore critico durante la registrazione:', error);
    res.status(500).json({ success: false, message: 'Errore del server durante la registrazione.' });
  } finally {
    if (connection) connection.release();
  }
});

// =====================================================
// NUOVA ROUTE: Verifica Email
// GET /api/auth/verify-email?token=xxx
// =====================================================
router.get('/verify-email', async (req, res) => {
  let connection;
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token di verifica mancante'
      });
    }
    
    connection = await getAuthConnection();
    
    // Cerca l'utente con il token valido e non scaduto
    const [users] = await connection.execute(
      `SELECT id, username, email, email_verified 
       FROM users 
       WHERE email_verification_token = ? 
       AND email_verification_expires > NOW()`,
      [token]
    );
    
    if (users.length === 0) {
      logger.warn(`Tentativo di verifica email con token non valido o scaduto: ${token.substring(0, 8)}...`);
      return res.status(400).json({
        success: false,
        message: 'Il link di verifica non è valido o è scaduto. Richiedi un nuovo link.',
        code: 'INVALID_OR_EXPIRED_TOKEN'
      });
    }
    
    const user = users[0];
    
    // Controlla se già verificato
    if (user.email_verified) {
      logger.info(`Email già verificata per utente ${user.id}`);
      return res.json({
        success: true,
        message: 'La tua email è già stata verificata. Puoi effettuare il login.',
        alreadyVerified: true
      });
    }
    
    // Aggiorna lo stato di verifica
    await connection.execute(
      `UPDATE users 
       SET email_verified = 1, 
           email_verification_token = NULL, 
           email_verification_expires = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [user.id]
    );
    
    logger.info(`Email verificata con successo per utente ${user.id} (${user.email})`);
    
    // Invia email di benvenuto dopo la verifica
    try {
      await sendRegistrationConfirmationEmail(user.email, user.username);
    } catch (emailError) {
      logger.warn('Errore invio email di benvenuto post-verifica:', emailError.message);
    }
    
    res.json({
      success: true,
      message: 'Email verificata con successo! Ora puoi effettuare il login.',
      verified: true
    });
    
  } catch (error) {
    logger.error('Errore nella verifica email:', error);
    res.status(500).json({
      success: false,
      message: 'Si è verificato un errore durante la verifica dell\'email'
    });
  } finally {
    if (connection) connection.release();
  }
});

// =====================================================
// NUOVA ROUTE: Reinvia Email di Verifica
// POST /api/auth/resend-verification
// =====================================================
router.post('/resend-verification', resendVerificationRateLimit, validateAuthInput, async (req, res) => {
  let connection;
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email valida richiesta'
      });
    }
    
    connection = await getAuthConnection();
    
    // Cerca l'utente
    const [users] = await connection.execute(
      'SELECT id, username, email, email_verified FROM users WHERE email = ?',
      [email]
    );
    
    // Per sicurezza, rispondi sempre con successo (non rivelare se email esiste)
    if (users.length === 0) {
      logger.info(`Richiesta reinvio verifica per email inesistente: ${email}`);
      return res.json({
        success: true,
        message: 'Se l\'indirizzo email è associato a un account non verificato, riceverai una nuova email di verifica.'
      });
    }
    
    const user = users[0];
    
    // Se già verificato
    if (user.email_verified) {
      return res.json({
        success: true,
        message: 'Questo account è già verificato. Puoi effettuare il login.',
        alreadyVerified: true
      });
    }
    
    // Genera nuovo token
    const newToken = generateEmailVerificationToken();
    const newExpiry = getEmailVerificationExpiry();
    
    // Aggiorna nel database
    await connection.execute(
      `UPDATE users 
       SET email_verification_token = ?, 
           email_verification_expires = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newToken, newExpiry, user.id]
    );
    
    // Costruisci URL e invia email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${newToken}`;
    
    try {
      await sendEmailVerificationEmail(user.email, user.username, verificationUrl);
      logger.info(`Nuova email di verifica inviata a ${user.email} per utente ${user.id}`);
    } catch (emailError) {
      logger.error('Errore invio nuova email di verifica:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Errore durante l\'invio dell\'email. Riprova più tardi.'
      });
    }
    
    res.json({
      success: true,
      message: 'Se l\'indirizzo email è associato a un account non verificato, riceverai una nuova email di verifica.'
    });
    
  } catch (error) {
    logger.error('Errore nel reinvio email di verifica:', error);
    res.status(500).json({
      success: false,
      message: 'Si è verificato un errore. Riprova più tardi.'
    });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Reset password con token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', validateAuthInput, async (req, res) => {
  let connection;
  try {
    const { token, newPassword } = req.body;
    
    // Verifica che token e password siano stati forniti
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token e nuova password richiesti'
      });
    }
    
    // Verifica che la nuova password soddisfi i requisiti minimi di sicurezza
    const passwordRegex = {
      minLength: 8,
      hasUppercase: /[A-Z]/,
      hasLowercase: /[a-z]/,
      hasNumber: /[0-9]/,
      hasSpecial: /[^A-Za-z0-9]/
    };
    
    const passwordErrors = [];
    
    if (newPassword.length < passwordRegex.minLength) {
      passwordErrors.push(`La password deve contenere almeno ${passwordRegex.minLength} caratteri`);
    }
    
    if (!passwordRegex.hasUppercase.test(newPassword)) {
      passwordErrors.push('La password deve contenere almeno una lettera maiuscola');
    }
    
    if (!passwordRegex.hasLowercase.test(newPassword)) {
      passwordErrors.push('La password deve contenere almeno una lettera minuscola');
    }
    
    if (!passwordRegex.hasNumber.test(newPassword)) {
      passwordErrors.push('La password deve contenere almeno un numero');
    }
    
    if (!passwordRegex.hasSpecial.test(newPassword)) {
      passwordErrors.push('La password deve contenere almeno un carattere speciale');
    }
    
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'La password non soddisfa i requisiti di sicurezza',
        errors: passwordErrors
      });
    }
    
    connection = await getAuthConnection();
    
    // Cerca l'utente con il token valido e non scaduto
    const [users] = await connection.execute(
      'SELECT id, username, email FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token non valido o scaduto'
      });
    }
    
    const user = users[0];
    
    // Genera l'hash della nuova password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Aggiorna la password e resetta i token
    await connection.execute(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW() WHERE id = ?',
      [passwordHash, user.id]
    );
    
    // Invia una notifica via email
    try {
      await sendPasswordChangedEmail(user.email, user.username);
    } catch (emailError) {
      logger.error('Errore nell\'invio dell\'email di conferma reset password:', emailError);
      // Non blocchiamo il flusso per un errore nell'invio email
    }
    
    logger.info(`Password resettata per utente: ${user.id}`);
    
    res.json({
      success: true,
      message: 'Password aggiornata con successo'
    });
  } catch (error) {
    logger.error('Errore nel reset della password:', error);
    res.status(500).json({
      success: false,
      message: 'Si è verificato un errore nel reset della password'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Rotta per revocare una sessione specifica
router.post('/revoke-session', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'ID sessione non fornito'
      });
    }
    
    connection = await getAuthConnection();
    const [result] = await connection.execute(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sessione non trovata o non autorizzata'
      });
    }
    
    logger.info(`Sessione revocata: ${sessionId} per utente: ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Sessione revocata con successo'
    });
  } catch (error) {
    logger.error('Errore revoca sessione:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante la revoca della sessione'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Rotta per elencare le sessioni attive dell'utente
router.get('/sessions', authMiddleware, async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    
    connection = await getAuthConnection();
    const [sessions] = await connection.execute(
      `SELECT 
        id, 
        created_at, 
        expires_at, 
        device_info,
        SUBSTRING(token, 1, 8) as token_preview
      FROM 
        refresh_tokens 
      WHERE 
        user_id = ? 
        AND is_revoked = FALSE 
        AND expires_at > NOW()
      ORDER BY 
        created_at DESC`,
      [userId]
    );
    
    // Trasforma le informazioni sui dispositivi in oggetti JSON sicuri
    const formattedSessions = sessions.map(session => {
      let parsedDeviceInfo = {};
      
      // Gestisci i vari formati possibili di device_info
      if (session.device_info) {
        try {
          // Se è già un oggetto, usalo direttamente
          if (typeof session.device_info === 'object' && session.device_info !== null) {
            parsedDeviceInfo = session.device_info;
          } 
          // Se è una stringa, prova a parsarla come JSON
          else if (typeof session.device_info === 'string') {
            // Ignora la stringa "[object Object]" e trattala come un oggetto vuoto
            if (session.device_info === "[object Object]") {
              parsedDeviceInfo = {};
            } else {
              parsedDeviceInfo = JSON.parse(session.device_info);
            }
          }
        } catch (e) {
          logger.error('Errore parsing device_info:', e, 'Valore:', session.device_info);
          parsedDeviceInfo = {}; // In caso di errore, usa un oggetto vuoto
        }
      }
      
      return {
        ...session,
        device_info: parsedDeviceInfo,
        created_at: new Date(session.created_at).toISOString(),
        expires_at: new Date(session.expires_at).toISOString()
      };
    });
    
    return res.status(200).json({
      success: true,
      sessions: formattedSessions
    });
  } catch (error) {
    logger.error('Errore recupero sessioni:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante il recupero delle sessioni'
    });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Validazione token di reset
 * GET /api/auth/validate-reset-token/:token
 */
router.get('/validate-reset-token/:token', async (req, res) => {
  let connection;
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Token mancante'
      });
    }
    
    connection = await getAuthConnection();
    
    // Controlla se il token è valido e non scaduto
    const [users] = await connection.execute(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );
    
    if (users.length === 0) {
      return res.json({
        success: false,
        valid: false,
        message: 'Token non valido o scaduto'
      });
    }
    
    res.json({
      success: true,
      valid: true
    });
  } catch (error) {
    logger.error('Errore nella validazione del token di reset:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Si è verificato un errore nella validazione del token'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Funzione di pulizia dei token migliorata
async function cleanupTokens() {
  let connection;
  try {
    connection = await getAuthConnection();
    
    // 1. Segna come revocati tutti i token scaduti
    const [expiredResult] = await connection.execute(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE expires_at < NOW() AND is_revoked = FALSE'
    );
    
    // 2. Elimina token revocati più vecchi di 15 giorni per mantenere una cronologia
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    const [revokedResult] = await connection.execute(
      'DELETE FROM refresh_tokens WHERE is_revoked = TRUE AND created_at < ?',
      [fifteenDaysAgo]
    );
    
    // 3. Pulisci token di verifica email scaduti
    await connection.execute(
      `UPDATE users 
       SET email_verification_token = NULL, email_verification_expires = NULL 
       WHERE email_verification_expires < NOW() AND email_verified = 0`
    );
    
    // 4. Statistiche sul database
    const [tokenStats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_tokens,
        SUM(CASE WHEN is_revoked = FALSE AND expires_at > NOW() THEN 1 ELSE 0 END) as active_tokens,
        SUM(CASE WHEN is_revoked = TRUE THEN 1 ELSE 0 END) as revoked_tokens,
        SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired_tokens
      FROM refresh_tokens`
    );
    
    logger.info(`Token cleanup: ${expiredResult.affectedRows} scaduti, ${revokedResult.affectedRows} eliminati`);
    logger.info(`Stato tokens: ${tokenStats[0].total_tokens} totali, ${tokenStats[0].active_tokens} attivi, ${tokenStats[0].revoked_tokens} revocati, ${tokenStats[0].expired_tokens} scaduti`);
    
  } catch (error) {
    logger.error('Errore durante la pulizia dei token:', error);
  } finally {
    if (connection) connection.release();
  }
}

// Avvia la pulizia periodica (ogni 24 ore)
setInterval(cleanupTokens, 24 * 60 * 60 * 1000);

// Esegui una pulizia all'avvio
cleanupTokens();

module.exports = router;