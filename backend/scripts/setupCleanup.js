/**
 * Script per la pulizia automatica dei database inattivi
 */

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Pulisce i database inattivi oltre il numero di giorni specificato
 * @param {number} inactivityDays - Giorni di inattività dopo i quali eliminare
 * @param {boolean} dryRun - Se true, mostra solo cosa verrebbe eliminato
 */
async function cleanupInactiveDatabases(inactivityDays = 7, dryRun = false) {
  const startTime = Date.now();
  let deletedCount = 0;
  let freedSpace = 0;
  
  try {
    const dbDir = path.join(__dirname, '..', 'user_databases');
    
    // Verifica che la directory esista
    try {
      await fs.access(dbDir);
    } catch (error) {
      logger.warn(`[Cleanup] Directory database non trovata: ${dbDir}`);
      return { deletedCount: 0, freedSpace: 0, errors: 0 };
    }

    const files = await fs.readdir(dbDir);
    const cutoffDate = Date.now() - (inactivityDays * 24 * 60 * 60 * 1000);
    
    logger.info(`[Cleanup] Scansione ${files.length} file nella directory database...`);
    
    for (const file of files) {
      if (!file.endsWith('.db')) continue;
      
      const filePath = path.join(dbDir, file);
      
      try {
        const stats = await fs.stat(filePath);
        const lastAccess = Math.max(stats.atime.getTime(), stats.mtime.getTime());
        
        if (lastAccess < cutoffDate) {
          const fileSize = stats.size;
          const ageInDays = Math.floor((Date.now() - lastAccess) / (24 * 60 * 60 * 1000));
          
          if (dryRun) {
            logger.info(`[Cleanup] [DRY RUN] Eliminerebbe: ${file} (${(fileSize / 1024).toFixed(2)} KB, inattivo da ${ageInDays} giorni)`);
          } else {
            await fs.unlink(filePath);
            logger.info(`[Cleanup] Eliminato: ${file} (${(fileSize / 1024).toFixed(2)} KB, inattivo da ${ageInDays} giorni)`);
          }
          
          deletedCount++;
          freedSpace += fileSize;
        }
      } catch (error) {
        logger.error(`[Cleanup] Errore nel processare ${file}:`, error.message);
      }
    }
    
    const duration = Date.now() - startTime;
    const result = {
      deletedCount,
      freedSpace: Math.round(freedSpace / 1024), // KB
      duration,
      dryRun
    };
    
    logger.info(`[Cleanup] Completato in ${duration}ms: ${deletedCount} file ${dryRun ? 'da eliminare' : 'eliminati'}, ${result.freedSpace} KB liberati`);
    
    return result;
    
  } catch (error) {
    logger.error('[Cleanup] Errore durante la pulizia:', error);
    throw error;
  }
}

/**
 * Pulizia dei file di log vecchi
 */
async function cleanupOldLogs(retentionDays = 30) {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    const files = await fs.readdir(logDir);
    const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    let deletedLogs = 0;
    
    for (const file of files) {
      if (!file.includes('.log')) continue;
      
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime.getTime() < cutoffDate) {
        await fs.unlink(filePath);
        deletedLogs++;
        logger.info(`[Cleanup] Log eliminato: ${file}`);
      }
    }
    
    logger.info(`[Cleanup] Eliminati ${deletedLogs} file di log vecchi`);
    return deletedLogs;
  } catch (error) {
    logger.error('[Cleanup] Errore pulizia log:', error);
  }
}

/**
 * Imposta i job cron per la pulizia automatica
 */
function setupDatabaseCleanup() {
  // Pulizia database ogni giorno alle 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Cleanup] Avvio pulizia database inattivi...');
    try {
      const result = await cleanupInactiveDatabases(7);
      logger.info('[Cleanup] Pulizia database completata:', result);
    } catch (error) {
      logger.error('[Cleanup] Errore durante la pulizia database:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Rome"
  });

  // Pulizia log ogni domenica alle 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    logger.info('[Cleanup] Avvio pulizia log vecchi...');
    try {
      await cleanupOldLogs(30);
    } catch (error) {
      logger.error('[Cleanup] Errore durante la pulizia log:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Rome"
  });
  
  logger.info('[Cleanup] Pianificata pulizia automatica database e log');
}

/**
 * Comando manuale per test
 */
async function runManualCleanup(options = {}) {
  const { dryRun = true, inactivityDays = 7 } = options;
  
  logger.info(`[Cleanup] Esecuzione manuale ${dryRun ? '(DRY RUN)' : ''}...`);
  
  const dbResult = await cleanupInactiveDatabases(inactivityDays, dryRun);
  
  if (!dryRun) {
    await cleanupOldLogs(30);
  }
  
  return dbResult;
}

// Export principale per compatibilità con il server.js esistente
module.exports = setupDatabaseCleanup;

// Export aggiuntivi per uso diretto
module.exports.setupDatabaseCleanup = setupDatabaseCleanup;
module.exports.cleanupInactiveDatabases = cleanupInactiveDatabases;
module.exports.cleanupOldLogs = cleanupOldLogs;
module.exports.runManualCleanup = runManualCleanup;