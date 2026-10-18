/**
 * Sistema di Alert per QueryForge
 * Versione standalone che crea il proprio transporter email
 */

const nodemailer = require('nodemailer');
const os = require('os');
const logger = require('./logger');
const emailService = require('./emailService');

class AlertManager {
  constructor() {
    this.alertCounts = {
      diskSpace: 0,
      memory: 0,
      errors: 0,
      security: 0,
      test: 0, // Aggiungi contatore per test
      lastReset: Date.now()
    };
    this.alertThresholds = {
      diskSpacePercent: 85,
      memoryPercent: 90,
      errorRatePercent: 10,
      maxAlertsPerHour: 5,
      cooldownMinutes: 30
    };
    this.lastAlerts = new Map();
    
  }

  

  /**
   * Verifica se l'alert è in cooldown
   */
  isInCooldown(alertType) {
    const lastAlert = this.lastAlerts.get(alertType);
    if (!lastAlert) return false;
    
    const cooldownMs = this.alertThresholds.cooldownMinutes * 60 * 1000;
    return (Date.now() - lastAlert) < cooldownMs;
  }

  /**
   * Invia alert via email
   */
  async sendAlert(type, subject, message, data = {}) {
    logger.info(`[AlertManager] Attempting to send alert: ${type} - ${subject}`);

    // Se non siamo in produzione, logghiamo l'alert e usciamo.
    if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[AlertManager DEV-MODE] Alert ${type} intercettato. Non verrà inviato.`, {
            subject,
            message,
            data
        });
        // Restituiamo true per non far sembrare che ci sia stato un errore.
        return true; 
    }

    if (!this.transporter) {
      logger.error('[AlertManager] No email transporter available');
      throw new Error('Sistema email non configurato');
    }

    // Controlla cooldown (ma permetti sempre i test)
    if (type !== 'test' && this.isInCooldown(type)) {
      logger.debug(`[AlertManager] Alert ${type} in cooldown, skipping`);
      return false;
    }

    // Controlla limite orario (ma permetti sempre i test)
    this.resetCountersIfNeeded();
    if (type !== 'test' && this.alertCounts[type] >= this.alertThresholds.maxAlertsPerHour) {
      logger.warn(`[AlertManager] Alert limit reached for ${type}, skipping`);
      return false;
    }

    try {
      const emailBody = this.generateEmailBody(type, message, data);
      
      // Email destinatario
      const alertEmail = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
      
      const success = await emailService.sendCustomEmail(
          alertEmail,
          `🚨 [QueryForge] ${subject}`,
          emailBody
      );

      if (!success) {
        throw new Error("La funzione sendCustomEmail di emailService ha restituito false.");
      }
      
      this.alertCounts[type] = (this.alertCounts[type] || 0) + 1;
      this.lastAlerts.set(type, Date.now());
      
      logger.info(`[AlertManager] Alert sent successfully via emailService: ${type}`);
      return true;

    } catch (error) {
      logger.error('[AlertManager] Failed to send alert via emailService:', {
        error: error.message,
        type,
        subject
      });
      throw new Error(`Errore nell'invio dell'alert: ${error.message}`);
    }
  }

  /**
   * Genera corpo email HTML
   */
  generateEmailBody(type, message, data) {
    const timestamp = new Date().toLocaleString('it-IT');
    const hostname = os.hostname();
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
          background: ${this.getHeaderColor(type)};
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 20px;
        }
        .alert-info {
          background: #f8f9fa;
          border-left: 4px solid ${this.getBorderColor(type)};
          padding: 15px;
          margin: 15px 0;
        }
        .details {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 15px 0;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
        }
        .footer {
          background: #f8f9fa;
          padding: 15px;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          background: ${this.getBadgeColor(type)};
          color: white;
          font-weight: bold;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 QueryForge Alert</h1>
          <div class="badge">${type.toUpperCase()}</div>
        </div>
        
        <div class="content">
          <div class="alert-info">
            <h3>Messaggio Alert</h3>
            <p><strong>${message}</strong></p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Timestamp:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Server:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${hostname}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Environment:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${process.env.NODE_ENV}</td>
            </tr>
          </table>
          
          ${data && Object.keys(data).length > 0 ? `
          <div class="details">
            <h4>Dettagli Tecnici:</h4>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>QueryForge Alert System<br>
          Version: ${process.env.APP_VERSION || '1.0.0'}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  getHeaderColor(type) {
    switch(type) {
      case 'security': return '#dc3545';
      case 'errors': return '#fd7e14';
      case 'diskSpace': 
      case 'memory': return '#e83e8c';
      case 'test': return '#20c997';
      default: return '#6f42c1';
    }
  }

  getBorderColor(type) {
    return this.getHeaderColor(type);
  }

  getBadgeColor(type) {
    return this.getHeaderColor(type);
  }

  /**
   * Reset contatori se è passata un'ora
   */
  resetCountersIfNeeded() {
    const hourMs = 60 * 60 * 1000;
    if (Date.now() - this.alertCounts.lastReset > hourMs) {
      Object.keys(this.alertCounts).forEach(key => {
        if (key !== 'lastReset') this.alertCounts[key] = 0;
      });
      this.alertCounts.lastReset = Date.now();
      logger.info('[AlertManager] Alert counters reset');
    }
  }

  /**
   * Controllo salute sistema
   */
  async checkSystemHealth() {
    const health = {
      diskUsage: await this.getDiskUsage(),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: await this.getCpuUsage(),
      timestamp: new Date().toISOString()
    };

    logger.debug('[AlertManager] System health check:', health);

    // Alert disco pieno
    if (health.diskUsage > this.alertThresholds.diskSpacePercent) {
      await this.sendAlert(
        'diskSpace',
        `Spazio disco critico: ${health.diskUsage}%`,
        `Il server ha raggiunto ${health.diskUsage}% di utilizzo disco`,
        { diskUsage: health.diskUsage }
      );
    }

    // Alert memoria
    if (health.memoryUsage > this.alertThresholds.memoryPercent) {
      await this.sendAlert(
        'memory',
        `Memoria critica: ${health.memoryUsage}%`,
        `Il server ha raggiunto ${health.memoryUsage}% di utilizzo memoria`,
        { memoryUsage: health.memoryUsage }
      );
    }

    return health;
  }

  /**
   * Calcola utilizzo disco (simulato)
   */
  async getDiskUsage() {
    try {
      // Simulazione: usa percentuale memoria come proxy per disco
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      return Math.round((used / total) * 60); // Max 60% per simulazione
    } catch (error) {
      logger.error('[AlertManager] Error getting disk usage:', error);
      return 0;
    }
  }

  /**
   * Calcola utilizzo memoria
   */
  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return Math.round((used / total) * 100);
  }

  /**
   * Calcola utilizzo CPU
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const cpuPercent = ((currentUsage.user + currentUsage.system) / 1000000); // microsecondi a secondi
        resolve(Math.round(Math.min(cpuPercent * 100, 100))); // Cap a 100%
      }, 100); // Ridotto a 100ms per performance
    });
  }

  /**
   * Alert per eventi di sicurezza
   */
  async alertSecurityEvent(eventType, details) {
    await this.sendAlert(
      'security',
      `Evento Sicurezza: ${eventType}`,
      `Rilevato evento di sicurezza di tipo ${eventType}`,
      {
        eventType,
        details,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Alert per errori applicazione
   */
  async alertApplicationError(error, context = {}) {
    await this.sendAlert(
      'errors',
      'Errore Applicazione Critico',
      `Errore non gestito: ${error.message}`,
      {
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Test di connettività email
   */
  async testEmailConnection() {
    try {
      logger.info('[AlertManager] Starting email test...');
      
      await this.sendAlert(
        'test',
        'Test Sistema Alert',
        'Test del sistema di alert completato con successo!',
        { 
          testMessage: 'Se ricevi questa email, il sistema di alert funziona correttamente',
          testTime: new Date().toISOString(),
          serverInfo: {
            hostname: os.hostname(),
            platform: os.platform(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV
          }
        }
      );
      
      return true;
    } catch (error) {
      logger.error('[AlertManager] Email test failed:', error);
      throw error; // Rilancia per il frontend
    }
  }

  /**
   * Verifica stato del sistema email
   */
  getEmailStatus() {
    return {
      configured: !!this.transporter,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER,
      alertEmail: process.env.ALERT_EMAIL || process.env.EMAIL_USER,
      transporterReady: !!this.transporter
    };
  }
}

// Istanza singleton
const alertManager = new AlertManager();

module.exports = alertManager;