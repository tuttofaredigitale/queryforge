// backend/utils/emailService.js
// EMERGENCY VERSION - Minimal but BULLETPROOF
const nodemailer = require('nodemailer');

// Safe logger fallback (in case logger import fails)
let logger;
try {
  logger = require('./logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[WARN]', msg, data || ''),
    error: (msg, data) => console.error('[ERROR]', msg, data || ''),
    debug: (msg, data) => console.log('[DEBUG]', msg, data || '')
  };
}

// Simple configuration with safe defaults
const config = {
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.EMAIL_HOST,
  smtp: {
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    fromName: process.env.EMAIL_FROM_NAME || 'QueryForge',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@sqlplayground.com'
  }
};

// Global transporter variable
let transporter = null;
let isInitialized = false;

// SAFE transporter creation - NEVER throws errors
function createTransporter() {
  try {
    // Force simulation mode if missing config or in development
    if (config.isDevelopment || !config.smtp.host || !config.smtp.user || !config.smtp.password) {
      logger.info('Email service: SIMULATION MODE', {
        reason: config.isDevelopment ? 'development_mode' : 'missing_credentials',
        hasHost: !!config.smtp.host,
        hasUser: !!config.smtp.user,
        hasPassword: !!config.smtp.password
      });
      
      return {
        type: 'simulation',
        sendMail: async (mailOptions) => {
          logger.info('📧 EMAIL SIMULATED', {
            to: mailOptions.to,
            subject: mailOptions.subject
          });
          
          if (process.env.DEBUG_EMAIL === 'true') {
            console.log('\n=== SIMULATED EMAIL ===');
            console.log('To:', mailOptions.to);
            console.log('Subject:', mailOptions.subject);
            console.log('========================\n');
          }
          
          return {
            messageId: 'sim-' + Date.now(),
            accepted: [mailOptions.to],
            rejected: []
          };
        },
        verify: async () => true
      };
    }
    
    // Real SMTP transporter creation
    logger.info('Email service: SMTP MODE - Creating transporter', {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      user: config.smtp.user ? config.smtp.user.replace(/@.*/, '@***') : 'missing'
    });
    
    const transporterConfig = {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
            user: config.smtp.user,
            pass: config.smtp.password
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        socketTimeout: 10000
    };
    
    // 1. Crea il vero transporter di Nodemailer
    const realTransporter = nodemailer.createTransport(transporterConfig);

    logger.info('Email service: SMTP transporter object created successfully');

    // 2. Aggiungi la nostra proprietà custom 'type' direttamente all'oggetto
    realTransporter.type = 'smtp';

    // 3. Restituisci l'oggetto transporter REALE, non una sua copia "piatta"
    return realTransporter;
    
  } catch (error) {
    // FORCED DETAILED LOGGING - this error should be visible!
    console.error('=============== TRANSPORTER CREATION ERROR ===============');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error.constructor.name);
    console.error('Full error object:', error);
    console.error('Stack trace:', error.stack);
    console.error('Config being used:', {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      user: config.smtp.user ? 'SET' : 'MISSING',
      password: config.smtp.password ? 'SET' : 'MISSING'
    });
    console.error('======================================================');
    
    logger.error('CRITICAL: Unexpected error during transporter creation:', {
      message: error.message,
      stack: error.stack,
      type: typeof error,
      code: error.code,
      name: error.name,
      constructor: error.constructor.name
    });
    
    // Ultimate fallback
    return {
      type: 'fallback',
      sendMail: async (mailOptions) => {
        logger.info('📧 EMAIL FALLBACK (creation failed)', {
          to: mailOptions.to,
          subject: mailOptions.subject
        });
        return { messageId: 'fallback-' + Date.now(), accepted: [mailOptions.to] };
      },
      verify: async () => true
    };
  }
}

// SAFE initialization - NEVER throws
async function initializeEmailService() {
  try {
    if (isInitialized) return true;
    
    transporter = createTransporter();
    
    // Only test SMTP connection for real SMTP transporters
    if (transporter.type === 'smtp') {
      try {
        logger.info('Testing SMTP connection...');
        await transporter.verify();
        logger.info('Email service: SMTP connection verified successfully');
      } catch (verifyError) {
        logger.error('SMTP verification failed - switching to simulation mode:', {
          error: verifyError.message,
          code: verifyError.code,
          errno: verifyError.errno,
          syscall: verifyError.syscall,
          hostname: verifyError.hostname,
          host: config.smtp.host,
          port: config.smtp.port
        });
        
        // Replace failed SMTP transporter with simulation
        logger.warn('Replacing failed SMTP transporter with simulation mode');
        transporter = {
          type: 'simulation_fallback',
          sendMail: async (mailOptions) => {
            logger.info('📧 EMAIL SIMULATION (SMTP failed)', {
              to: mailOptions.to,
              subject: mailOptions.subject
            });
            return { messageId: 'smtp-fallback-' + Date.now(), accepted: [mailOptions.to] };
          },
          verify: async () => true
        };
      }
    } else if (transporter.type === 'simulation') {
      logger.info('Email service: Using simulation mode (no SMTP verification needed)');
    } else if (transporter.type === 'fallback') {
      logger.warn('Email service: Using emergency fallback mode');
    }
    
    isInitialized = true;
    logger.info('Email service initialized successfully', {
      mode: transporter.type || 'unknown'
    });
    return true;
    
  } catch (error) {
    logger.error('Email service initialization error (non-fatal):', {
      error: error.message,
      stack: error.stack
    });
    
    // Create emergency fallback transporter
    transporter = {
      type: 'emergency',
      sendMail: async (mailOptions) => {
        logger.info('📧 EMERGENCY EMAIL FALLBACK', {
          to: mailOptions.to,
          subject: mailOptions.subject
        });
        return { messageId: 'emergency-' + Date.now(), accepted: [mailOptions.to] };
      }
    };
    
    isInitialized = true;
    return false;
  }
}

async function sendCustomEmail(to, subject, html) {
  logger.debug('[sendCustomEmail] Inizio invio email.', { to, subject });
  try {
    if (!isInitialized) {
      logger.warn('[sendCustomEmail] Servizio email non inizializzato, avvio ora...')
      await initializeEmailService();
    }
    
    if (!transporter) {
      throw new Error('Trasporto email non disponibile. Impossibile inviare.');
    }

    logger.debug(`[sendCustomEmail] Utilizzo transporter di tipo: ${transporter.type}`);
    
    const mailOptions = {
      from: `"${config.smtp.fromName}" <${config.smtp.fromAddress}>`,
      to: to,
      subject: subject,
      html: html
    };

    // Log delle opzioni email prima dell'invio
    logger.debug('[sendCustomEmail] Opzioni email preparate:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
    });
    
    const result = await transporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully', {
      to: to,
      subject: subject,
      messageId: result.messageId,
      response: result.response
    });
    
    return true;
    
  } catch (error) {
    console.error('===========================================================');
    console.error('===      ERRORE DETTAGLIATO INVIO EMAIL (sendMail)      ===');
    console.error('===========================================================');
    console.error('TIMESTAMP:', new Date().toISOString());
    console.error('--- ERRORE RICEVUTO ---');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Response:', error.response);
    console.error('Response Code:', error.responseCode);
    console.error('Command:', error.command);
    console.error('--- OGGETTO ERRORE COMPLETO ---');
    console.error(error);
    console.error('--- CONFIGURAZIONE IN USO AL MOMENTO DELL\'ERRORE ---');
    console.error('Transporter Type:', transporter?.type);
    console.error('SMTP Config:', {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        user: config.smtp.user,
        fromAddress: config.smtp.fromAddress,
        fromName: config.smtp.fromName
    });
    console.error('===========================================================');

    logger.error('Email send failed (non-fatal):', {
      to: to,
      subject: subject,
      error: error.message
    });
    
    // Don't throw - just return false
    return false;
  }
}

// Simple HTML template
function createEmailHTML(title, content, showSecurityNote = false) {
  const securityNote = showSecurityNote ? `
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-weight: bold; color: #92400e;">⚠️ Sicurezza:</p>
      <p style="margin: 10px 0 0 0; color: #92400e;">
        Se non hai richiesto questa azione, contattaci immediatamente.
      </p>
    </div>
  ` : '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0;">${config.smtp.fromName}</h1>
    </div>
    <div style="padding: 20px;">
      <h2 style="color: #374151;">${title}</h2>
      ${content}
      ${securityNote}
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          Cordiali saluti,<br>
          <strong>Il team ${config.smtp.fromName}</strong>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// =====================================================
// EMAIL FUNCTIONS - All SAFE (never throw)
// =====================================================

/**
 * Invia email di verifica per nuove registrazioni
 * @param {string} email - Email dell'utente
 * @param {string} username - Username dell'utente
 * @param {string} verificationUrl - URL per verificare l'email
 * @returns {Promise<boolean>}
 */
async function sendEmailVerificationEmail(email, username, verificationUrl) {
  const html = createEmailHTML(
    'Verifica la tua email',
    `
      <p>Ciao <strong>${username}</strong>,</p>
      <p>Grazie per esserti registrato su QueryForge!</p>
      <p>Per completare la registrazione e attivare il tuo account, clicca sul pulsante qui sotto:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          ✓ Verifica Email
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Oppure copia e incolla questo link nel tuo browser:<br>
        <a href="${verificationUrl}" style="color: #4f46e5; word-break: break-all;">${verificationUrl}</a>
      </p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;">
          <strong>⏰ Importante:</strong> Questo link scadrà tra 24 ore.
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Se non hai creato un account su QueryForge, puoi ignorare questa email.
      </p>
    `
  );
  
  return await sendCustomEmail(email, 'Verifica la tua email - QueryForge', html);
}

async function sendRegistrationConfirmationEmail(email, username) {
  const html = createEmailHTML(
    'Benvenuto in QueryForge!',
    `
      <p>Benvenuto/a <strong>${username}</strong>!</p>
      <p>La tua email è stata verificata con successo e il tuo account è ora attivo.</p>
      <p>Puoi ora accedere a tutte le funzionalità della piattaforma.</p>
      <div style="background-color: #e0f2fe; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: bold; color: #0277bd;">🚀 Inizia subito:</p>
        <ul style="color: #0277bd;">
          <li>Accedi con le tue credenziali</li>
          <li>Esplora le funzionalità SQL</li>
          <li>Crea le tue queries in libertà</li>
        </ul>
      </div>
    `
  );
  
  return await sendCustomEmail(email, `Benvenuto in ${config.smtp.fromName}!`, html);
}

async function sendPasswordResetEmail(email, username, resetUrl) {
  const html = createEmailHTML(
    'Reimposta la tua password',
    `
      <p>Ciao <strong>${username}</strong>,</p>
      <p>Hai richiesto di reimpostare la password del tuo account.</p>
      <p>Clicca sul link qui sotto per procedere:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reimposta Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Link alternativo: <a href="${resetUrl}">${resetUrl}</a>
      </p>
    `,
    true
  );
  
  return await sendCustomEmail(email, 'Reimposta la tua password', html);
}

async function sendPasswordChangedEmail(email, username) {
  const now = new Date();
  const html = createEmailHTML(
    'Password aggiornata',
    `
      <p>Ciao <strong>${username}</strong>,</p>
      <p>La password del tuo account è stata modificata con successo il ${now.toLocaleDateString('it-IT')} alle ${now.toLocaleTimeString('it-IT')}.</p>
      <p>Se sei stato tu, non è necessaria alcuna azione.</p>
    `,
    true
  );
  
  return await sendCustomEmail(email, 'Password aggiornata con successo', html);
}

async function sendAccountDeletionConfirmation(email, username) {
  const now = new Date();
  const html = createEmailHTML(
    'Account eliminato',
    `
      <p>Ciao <strong>${username}</strong>,</p>
      <p>Il tuo account è stato eliminato il ${now.toLocaleDateString('it-IT')} alle ${now.toLocaleTimeString('it-IT')}.</p>
      <p>Tutti i dati sono stati rimossi dai nostri server.</p>
      <p>Ci dispiace vederti andare via! Saremo qui per te se vorrai tornare.</p>
    `
  );
  
  return await sendCustomEmail(email, 'Conferma eliminazione account', html);
}

/**
 * Invia email di benvenuto al piano Pro.
 * @param {string} email - Email dell'utente.
 * @param {string} username - Username dell'utente.
 * @returns {Promise<boolean>}
 */
async function sendProOnboardingEmail(email, username) {
  const title = '🚀 Benvenuto in QueryForge Pro!';
  const content = `
    <p>Ciao <strong>${username}</strong>,</p>
    <p>Congratulazioni! Il tuo abbonamento a QueryForge Pro è ora attivo. Sei pronto a sbloccare tutto il potenziale della nostra piattaforma.</p>
    <p>Ecco le funzionalità esclusive che hai appena sbloccato:</p>
    <div style="background-color: #f3f4f6; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        <li style="margin-bottom: 10px;"><strong>Query Illimitate:</strong> esegui tutte le analisi che desideri, senza limiti giornalieri.</li>
        <li style="margin-bottom: 10px;"><strong>100 Domande all'IA:</strong> sfrutta il nostro AI Tutor per ottimizzare query, generare dati e imparare più velocemente.</li>
        <li style="margin-bottom: 10px;"><strong>Backup:</strong> i tuoi database sono al sicuro con backup che puoi ripristinare in qualsiasi momento.</li>
        <li style="margin-bottom: 10px;"><strong>Supporto Prioritario:</strong> le tue richieste di assistenza avranno la massima priorità.</li>
      </ul>
    </div>
    <p>Siamo entusiasti di averti a bordo! Esplora subito le nuove funzionalità.</p>
  `;
  const html = createEmailHTML(title, content);
  return await sendCustomEmail(email, title, html);
}

/**
 * Invia email di avviso 7 giorni prima della scadenza.
 * @param {string} email - Email dell'utente.
 * @param {string} username - Username dell'utente.
 * @param {Date} expirationDate - Data di scadenza.
 * @returns {Promise<boolean>}
 */
async function sendSubscriptionPreExpirationEmail(email, username, expirationDate) {
  const dateObject = new Date(expirationDate);

  const formattedDate = dateObject.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const title = '⏰ Il tuo abbonamento QueryForge Pro sta per scadere';
  const content = `
    <p>Ciao <strong>${username}</strong>,</p>
    <p>Ti avvisiamo che il tuo abbonamento a QueryForge Pro scadrà tra 7 giorni, il <strong>${formattedDate}</strong>.</p>
    <p>Se non rinnovi, al termine del periodo Pro succederà questo:</p>
    <ul style="color: #4b5563;">
      <li>Le tue query saranno limitate al piano Free.</li>
      <li>L'accesso al tutor AI verrà disabilitato.</li>
      <li>I backup verranno interrotti.</li>
    </ul>
    <p>Non perdere l'accesso a queste funzionalità essenziali! Rinnova ora per continuare a lavorare senza interruzioni.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/account/billing" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Rinnova il tuo abbonamento
      </a>
    </div>
    <p>Se hai già rinnovato, puoi ignorare questa email.</p>
  `;
  const html = createEmailHTML(title, content);
  return await sendCustomEmail(email, title, html);
}

/**
 * Invia email di notifica quando le funzionalità Pro sono state sospese.
 * @param {string} email - Email dell'utente.
 * @param {string} username - Username dell'utente.
 * @returns {Promise<boolean>}
 */
async function sendSubscriptionExpiredEmail(email, username) {
  const title = '🔒 Le tue funzionalità Pro sono state sospese';
  const content = `
    <p>Ciao <strong>${username}</strong>,</p>
    <p>Il tuo abbonamento a QueryForge Pro è scaduto e le funzionalità esclusive sono state disattivate. Il tuo account è stato convertito al piano Free.</p>
    <p>Cosa è cambiato:</p>
    <ul style="color: #4b5563;">
      <li><strong>Query Limitate:</strong> ora hai un limite giornaliero di query.</li>
      <li><strong>AI Tutor Disabilitato:</strong> non puoi più utilizzare l'assistente IA.</li>
      <li><strong>Backup Sospesi:</strong> i nuovi backup non verranno creati.</li>
      <li><strong>Export Limitato:</strong> le opzioni di export Pro non sono disponibili.</li>
    </ul>
    <p>È facile riattivare il tuo piano Pro e recuperare subito tutte le funzionalità. Clicca qui sotto per tornare a Pro in pochi istanti.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/account/billing" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Riattiva il piano Pro
      </a>
    </div>
    <p>Speriamo di rivederti presto tra gli utenti Pro!</p>
  `;
  const html = createEmailHTML(title, content);
  return await sendCustomEmail(email, title, html);
}

// Health check
async function getEmailServiceHealth() {
  try {
    if (!isInitialized) {
      await initializeEmailService();
    }
    
    return {
      status: isInitialized ? 'healthy' : 'degraded',
      mode: config.isDevelopment ? 'simulation' : 'smtp',
      config: {
        host: config.smtp.host || 'not_set',
        port: config.smtp.port,
        hasCredentials: !!(config.smtp.user && config.smtp.password)
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Test connection
async function testConnection() {
  try {
    if (!isInitialized) {
      await initializeEmailService();
    }
    
    if (config.isDevelopment) {
      return true; // Simulation always works
    }
    
    if (transporter && transporter.verify) {
      await transporter.verify();
      return true;
    }
    
    return false;
  } catch (error) {
    logger.warn('Connection test failed:', error.message);
    return false;
  }
}

// SAFE initialization on module load
initializeEmailService().catch(error => {
  logger.error('Module initialization failed (non-fatal):', error.message);
});

// Exports - Backward compatible
module.exports = {
  // Main functions
  sendEmailVerificationEmail,  // NUOVA FUNZIONE
  sendRegistrationConfirmationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeletionConfirmation,
  sendProOnboardingEmail,
  sendSubscriptionPreExpirationEmail,
  sendSubscriptionExpiredEmail,
  sendCustomEmail,
  
  // Aliases for compatibility
  sendPasswordResetConfirmation: sendPasswordChangedEmail,
  
  // Health & monitoring
  getEmailServiceHealth,
  testConnection
};