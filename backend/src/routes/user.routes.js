// routes/user.routes.js - Course Lab Edition
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { getAuthConnection } = require('../db/database');
const userDatabaseManager = require('../db/devDatabaseManager');
const { sendAccountDeletionConfirmation, sendPasswordResetConfirmation } = require('../utils/emailService');
const { accountDeletionLimiter, trackAccountDeletion, passwordResetLimiter } = require('../utils/abuseProtectionService');
const { rateLimiter } = require('../middlewares/loggerMiddleware');
const logger = require('../utils/logger');
const queryLimiter = require('../utils/queryLimiter');

// Importo il middleware di autenticazione
const { authenticate } = require('../middlewares/auth');

// Rate limiters specifici per operazioni utente
const userProfileLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 30, // max 30 richieste profilo per minuto
  keyPrefix: 'user_profile:'
});

const userOperationsLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 10, // max 10 operazioni critiche per 15 min
  keyPrefix: 'user_ops:'
});

const userValidationLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 15, // max 15 validazioni password per minuto
  keyPrefix: 'user_valid:'
});

const exportDataLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 3, // max 3 export dati per 15 min
  keyPrefix: 'user_export:'
});

// Validazione input password
const validatePasswordInput = (req, res, next) => {
  const { password, currentPassword, newPassword } = req.body;
  
  // Sanitizzazione base (rimuovi caratteri di controllo)
  if (password && typeof password === 'string') {
    req.body.password = password.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  if (currentPassword && typeof currentPassword === 'string') {
    req.body.currentPassword = currentPassword.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  if (newPassword && typeof newPassword === 'string') {
    req.body.newPassword = newPassword.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  next();
};

// Validazione formato export
const validateExportFormat = (req, res, next) => {
  const format = req.query.format || 'json';
  
  if (!['json', 'html'].includes(format.toLowerCase())) {
    logger.warn(`Formato export non valido: ${format} da utente ${req.user?.id}`);
    return res.status(400).json({
      success: false,
      message: 'Formato non valido. Usa "json" o "html".'
    });
  }
  
  req.query.format = format.toLowerCase();
  next();
};

/**
 * Elimina l'account utente
 * DELETE /api/user/account
 */
router.delete('/account', [authenticate, userOperationsLimit, accountDeletionLimiter], validatePasswordInput, async (req, res) => {
  let connection;
  try {
    const { password } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password richiesta per la conferma' });
    }

    logger.warn(`INIZIO ELIMINAZIONE ACCOUNT per utente ${userId} (${username})`, { ip: req.ip });
    connection = await getAuthConnection();

    // Validazione Password 
    const [users] = await connection.execute('SELECT password, email FROM users WHERE id = ?', [userId]);

    if (users.length === 0) return res.status(404).json({ success: false, message: 'Utente non trovato' });
    
    const userEmail = users[0].email;
    const isValid = await bcrypt.compare(password, users[0].password);
    if (!isValid) return res.status(401).json({ success: false, message: 'Password non corretta' });

    // Cancellazione Transazionale (DB Auth) 
    await connection.beginTransaction();
    try {
      logger.info(`[Delete] Fase 1: Inizio transazione Auth DB per utente ${userId}`);

      // Elimina dipendenze nell'ordine corretto (tabelle figlie)
      // Course Lab Edition: rimosse tabelle ai_prompt_usage, billing_history, user_backups
      await connection.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      await connection.execute('DELETE FROM query_history WHERE user_id = ?', [userId]);
      await connection.execute('DELETE FROM query_usage WHERE user_id = ?', [userId]);
      await connection.execute('DELETE FROM saved_queries WHERE user_id = ?', [userId]);
      
      // Elimina il record utente principale (tabella genitore)
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
      
      await connection.commit();
      logger.info(`[Delete] Fase 1 (Auth DB) completata per utente ${userId}. Record utente rimosso.`);

    } catch (transactionError) {
      await connection.rollback();
      logger.error(`[Delete] Fase 1 (Auth DB) fallita per utente ${userId}. Rollback eseguito.`);
      throw transactionError;
    }

    // Pulizia risorse playground (specifica per ambiente)
    try {
      if (process.env.NODE_ENV === 'production') {
        logger.info(`[Delete Prod] Fase 2: Pulizia tabelle playground per utente ${userId}`);

        const userTablePrefix = `user_${userId}_%`;
        const [tables] = await connection.query("SHOW TABLES LIKE ?", [userTablePrefix]);
        if (tables.length > 0) {
          const tableNames = tables.map(t => Object.values(t)[0]);
          for (const tableName of tableNames) {
            await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
          }
          logger.info(`[Delete Prod] ${tableNames.length} tabelle personali eliminate.`);
        }
      } else {
        logger.info(`[Delete Dev] Fase 2: Pulizia database playground per utente ${userId}`);
        let adminConnection = null;
        try {
          adminConnection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 3307,
            user: process.env.DB_ADMIN_USER || process.env.MYSQL_USER || 'root',
            password: process.env.DB_ADMIN_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'rootpassword'
          });
          const userDbName = `sql_template_user_${userId}`;
          await adminConnection.execute(`DROP DATABASE IF EXISTS \`${userDbName}\``);
          logger.info(`[Delete Dev] Database ${userDbName} eliminato.`);
          
          if (userDatabaseManager.userPools && userDatabaseManager.userPools[userId]) {
            delete userDatabaseManager.userPools[userId];
          }
          if (userDatabaseManager.userMySQLCredentials && userDatabaseManager.userMySQLCredentials.delete) {
            userDatabaseManager.userMySQLCredentials.delete(userId);
          }
        } finally {
          if (adminConnection) await adminConnection.end();
        }
      }
    } catch (cleanupError) {
      logger.error(`[Delete] CRITICO: Fallita pulizia risorse playground (Fase 2) per utente ${userId}. Richiesto intervento manuale.`, { error: cleanupError.message });
    }

    // Conferma finale
    await sendAccountDeletionConfirmation(userEmail, username);
    trackAccountDeletion(req.ip);
    logger.info(`Account eliminato con successo per utente ${userId} (${username})`);
    res.json({ success: true, message: 'Account eliminato con successo' });

  } catch (error) {
    console.error('=============== DETAILED ACCOUNT DELETION ERROR ===============');
    console.error('Timestamp:', new Date().toISOString());
    console.error('User ID to delete:', req.user?.id);
    console.error('Error Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('===========================================================');
    logger.error(`Errore GRAVE eliminazione account per utente ${req.user?.id}:`, { error: error.message });

    if (error.code === 'ER_ROW_IS_REFERENCED_2' || (error.message && error.message.includes('foreign key constraint fails'))) {
      res.status(500).json({ success: false, message: 'Impossibile eliminare l\'account a causa di dati collegati (Integrità DB).' });
    } else {
      res.status(500).json({ success: false, message: 'Errore nell\'eliminazione dell\'account' });
    }
  } finally {
    if (connection) connection.release();
  }
});


/**
 * Esporta tutti i dati dell'utente in formato JSON o HTML
 * GET /api/user/export-data
 */
router.get('/export-data', 
  authenticate,
  exportDataLimit,
  validateExportFormat,
  async (req, res) => {
    let connection;
    try {
      const userId = req.user.id;
      const format = req.query.format || 'json';
      
      logger.info(`Export dati richiesto da utente ${userId}`, {
        format,
        userId
      });
      
      connection = await getAuthConnection();
      
      // Recupero dati profilo
      const [userRows] = await connection.execute(`
        SELECT id, username, email, created_at, role, 
               terms_accepted, terms_accepted_date, privacy_policy_accepted, 
               privacy_policy_accepted_date, last_logout
        FROM users WHERE id = ?
      `, [userId]);
      
      if (userRows.length === 0) {
        logger.error(`Utente ${userId} non trovato durante export dati`);
        return res.status(404).json({ 
          success: false,
          message: 'Utente non trovato' 
        });
      }
      
      // Costruisci l'oggetto dati utente con i campi necessari
      const userData = {
        profile: {
          username: userRows[0].username,
          email: userRows[0].email,
          created_at: userRows[0].created_at,
          terms_accepted: userRows[0].terms_accepted,
          terms_accepted_at: userRows[0].terms_accepted_date,
          privacy_accepted: userRows[0].privacy_policy_accepted,
          privacy_accepted_at: userRows[0].privacy_policy_accepted_date,
          last_logout: userRows[0].last_logout
        }
      };
      
      // Recupero cronologia query
      const [queryRows] = await connection.execute(`
        SELECT id, user_id, query, executed_at, error
        FROM query_history WHERE user_id = ?
        ORDER BY executed_at DESC
      `, [userId]);
      
      // Mappa le query in un array di oggetti
      userData.queryHistory = queryRows.map(row => ({
        query: row.query,
        executed_at: row.executed_at,
        error: row.error
      }));
      
      // Aggiungi la data di esportazione
      userData.exportInfo = {
        exportDate: new Date(),
        exportedBy: userRows[0].username,
        application: "QueryForge Course Lab"
      };
      
      logger.info(`Export completato per utente ${userId}`, {
        format,
        queryCount: queryRows.length,
        userId
      });
      
      // Restituisci i dati nel formato richiesto
      if (format === 'html') {
        const html = generateHTML(userData);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename=dati_utente_${userData.profile.username}_${new Date().toISOString().split('T')[0]}.html`);
        return res.send(html);
      } else {
        return res.json({
          success: true,
          userData: userData
        });
      }
    } catch (error) {
      logger.error(`Errore export dati per utente ${req.user?.id}:`, {
        error: error.message,
        format: req.query.format,
        userId: req.user?.id
      });
      res.status(500).json({ 
        success: false,
        message: 'Errore nell\'esportazione dei dati',
        error_type: 'export_error'
      });
    } finally {
      if (connection) connection.release();
    }
  });

/**
 * Ottiene i dati del profilo utente
 * GET /api/user/profile
 * Course Lab Edition: piano unico, no distinzione Free/Pro
 */
router.get('/profile', 
  authenticate,
  userProfileLimit,
  async (req, res) => {
    let connection;
    try {
      const userId = req.user.id;
      logger.info(`Richiesta profilo da utente ${userId}`);

      connection = await getAuthConnection();
      
      // Recupera dati utente base inclusi consensi GDPR
      const [userRows] = await connection.execute(`
        SELECT id, username, email, role, created_at,
               terms_accepted, terms_accepted_date,
               privacy_policy_accepted, privacy_policy_accepted_date
        FROM users WHERE id = ?
      `, [userId]);

      if (userRows.length === 0) {
        logger.error(`Profilo non trovato per utente ${userId}`);
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      const user = userRows[0];
      
      // Recupera statistiche query usando queryLimiter
      const queryStats = await queryLimiter.getUsageStats(userId);

      // Costruisci risposta profilo - Course Lab Edition
      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        plan: 'course-lab', // Piano unico Course Lab
        // Consensi GDPR
        terms_accepted: user.terms_accepted || false,
        terms_accepted_date: user.terms_accepted_date,
        privacy_accepted: user.privacy_policy_accepted || false,
        privacy_accepted_date: user.privacy_policy_accepted_date,
        // Statistiche query
        queryUsage: {
          used: queryStats.used,
          limit: queryStats.limit,
          remaining: queryStats.remaining,
          resetTime: queryStats.resetTime
        },
        // AI disabilitata in Course Lab Edition
        aiCredits: {
          used: 0,
          limit: 0,
          remaining: 0,
          enabled: false
        }
      };

      logger.info(`Profilo restituito per utente ${userId} (course-lab)`);

      res.json({
        success: true,
        user: userResponse
      });
      
    } catch (error) {
      logger.error(`Errore recupero profilo per utente ${req.user?.id}:`, {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Errore nel recupero del profilo',
        error_type: 'profile_retrieval_error'
      });
    } finally {
      if (connection) connection.release();
    }
  });
  
/**
 * Reset della password dell'utente
 * POST /api/user/reset-password
 */
router.post('/reset-password', 
  [authenticate, passwordResetLimiter],
  validatePasswordInput,
  async (req, res) => {
    let connection;
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      
      if (!currentPassword || !newPassword) {
        logger.warn(`Reset password con dati mancanti da utente ${userId}`);
        return res.status(400).json({
          success: false,
          message: 'Password attuale e nuova password richieste'
        });
      }
      
      logger.info(`Reset password richiesto da utente ${userId}`);
      
      // Verifica requisiti password
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
        logger.warn(`Password non conforme ai requisiti da utente ${userId}`, {
          errorCount: passwordErrors.length
        });
        return res.status(400).json({
          success: false,
          message: 'La password non soddisfa i requisiti di sicurezza',
          errors: passwordErrors
        });
      }
      
      connection = await getAuthConnection();
      
      const [users] = await connection.execute(
        'SELECT username, password, email FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        logger.error(`Utente ${userId} non trovato durante reset password`);
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }
      
      const user = users[0];
      
      const isValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isValid) {
        logger.warn(`Password attuale errata durante reset per utente ${userId}`);
        return res.status(401).json({
          success: false,
          message: 'La password attuale non è corretta'
        });
      }
      
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      
      await connection.execute(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [passwordHash, userId]
      );
      
      try {
        if (typeof sendPasswordResetConfirmation === 'function') {
          await sendPasswordResetConfirmation(user.email, user.username);
        }
      } catch (emailError) {
        logger.error(`Errore invio email conferma reset password per utente ${userId}: ${emailError.message}`);
      }
      
      logger.info(`Password aggiornata con successo per utente ${userId}`);
      
      res.json({
        success: true,
        message: 'Password aggiornata con successo'
      });
    } catch (error) {
      logger.error(`Errore reset password per utente ${req.user?.id}:`, {
        error: error.message,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Errore nell\'aggiornamento della password',
        error_type: 'password_reset_error'
      });
    } finally {
      if (connection) connection.release();
    }
  });

/**
 * Valida la password dell'utente
 * POST /api/user/validate-password
 */
router.post('/validate-password', 
  authenticate,
  userValidationLimit,
  validatePasswordInput,
  async (req, res) => {
    let connection;
    try {
      const { password } = req.body;
      const userId = req.user.id;
      
      if (!password) {
        logger.warn(`Validazione password senza password da utente ${userId}`);
        return res.status(400).json({ 
          success: false,
          message: 'Password richiesta' 
        });
      }
      
      logger.info(`Validazione password richiesta da utente ${userId}`);
      
      connection = await getAuthConnection();
      
      const [users] = await connection.execute(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        logger.error(`Utente ${userId} non trovato durante validazione password`);
        return res.status(404).json({ 
          success: false,
          message: 'Utente non trovato' 
        });
      }
      
      const user = users[0];
      
      const isValid = await bcrypt.compare(password, user.password);
      
      logger.info(`Validazione password completata per utente ${userId}`, {
        isValid
      });
      
      res.json({ 
        success: true,
        valid: isValid 
      });
    } catch (error) {
      logger.error(`Errore validazione password per utente ${req.user?.id}:`, {
        error: error.message,
        userId: req.user?.id
      });
      res.status(500).json({ 
        success: false,
        message: 'Errore nella validazione della password',
        error_type: 'password_validation_error'
      });
    } finally {
      if (connection) connection.release();
    }
  });

/**
 * Genera una versione HTML leggibile dei dati utente
 * @param {Object} userData - Dati dell'utente strutturati
 * @returns {string} Documento HTML completo
 */
function generateHTML(userData) {
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Dati utente ${userData.profile.username} - QueryForge Course Lab</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
      h1, h2, h3 { color: #2c5282; margin-top: 30px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; font-weight: bold; }
      tr:nth-child(even) { background-color: #f9f9f9; }
      .container { margin-bottom: 30px; }
      .timestamp { color: #666; font-size: 0.9em; }
      pre { background-color: #f8f8f8; padding: 8px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; }
      .info { background-color: #e6f7ff; border-left: 4px solid #1890ff; padding: 10px; margin: 10px 0; }
      .error { color: #f56c6c; }
    </style>
  </head>
  <body>
    <h1>Dati utente: ${userData.profile.username}</h1>
    
    <div class="container">
      <h2>Informazioni Profilo</h2>
      <table>
        <tr><th>Campo</th><th>Valore</th></tr>
        <tr><td>Username</td><td>${userData.profile.username}</td></tr>
        <tr><td>Email</td><td>${userData.profile.email}</td></tr>
        <tr><td>Data registrazione</td><td>${new Date(userData.profile.created_at).toLocaleString('it-IT')}</td></tr>
        <tr><td>Ultimo logout</td><td>${userData.profile.last_logout ? new Date(userData.profile.last_logout).toLocaleString('it-IT') : 'N/A'}</td></tr>
        <tr><td>Termini accettati</td><td>${userData.profile.terms_accepted ? 'Sì' : 'No'}</td></tr>
        <tr><td>Data accettazione termini</td><td>${userData.profile.terms_accepted_at ? new Date(userData.profile.terms_accepted_at).toLocaleString('it-IT') : 'N/A'}</td></tr>
        <tr><td>Privacy accettata</td><td>${userData.profile.privacy_accepted ? 'Sì' : 'No'}</td></tr>
        <tr><td>Data accettazione privacy</td><td>${userData.profile.privacy_accepted_at ? new Date(userData.profile.privacy_accepted_at).toLocaleString('it-IT') : 'N/A'}</td></tr>
      </table>
    </div>`;
    
  if (userData.queryHistory && userData.queryHistory.length > 0) {
    html += `
    <div class="container">
      <h2>Cronologia Query (${userData.queryHistory.length} query)</h2>
      <p class="info">Le query più recenti appaiono per prime</p>
      <table>
        <tr>
          <th>Query SQL</th>
          <th>Data esecuzione</th>
          <th>Stato</th>
        </tr>`;
        
    userData.queryHistory.forEach(query => {
      html += `
        <tr>
          <td><pre>${query.query}</pre></td>
          <td>${new Date(query.executed_at).toLocaleString('it-IT')}</td>
          <td>${query.error ? `<span class="error">${query.error}</span>` : 'Eseguita correttamente'}</td>
        </tr>`;
    });
    
    html += `
      </table>
    </div>`;
  }
  
  html += `
    <div class="container">
      <h2>Informazioni sull'esportazione</h2>
      <p>Esportazione richiesta da: ${userData.exportInfo.exportedBy}</p>
      <p>Data e ora: ${new Date(userData.exportInfo.exportDate).toLocaleString('it-IT')}</p>
    </div>
    <hr>
    <p class="timestamp">Documento generato automaticamente da QueryForge Course Lab Edition</p>
  </body>
  </html>`;
  
  return html;
}

// Error handler specifico per user routes
router.use((error, req, res, next) => {
  logger.error('Errore nelle user routes:', {
    error: error.message,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  });

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Username o email già esistenti',
      error_type: 'duplicate_user'
    });
  }

  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Servizio database temporaneamente non disponibile',
      error_type: 'database_unavailable'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Errore interno nelle operazioni utente',
    error_type: 'user_error'
  });
});

module.exports = router;