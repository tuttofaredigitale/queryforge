const logger = require('./logger');

/**
 * Inizializza lo scheduler (DISABILITATO)
 * Le funzioni di notifica abbonamento sono state rimosse
 * dopo la conversione a Course Lab Edition.
 */
function init() {
    logger.info('[Scheduler] Notifiche abbonamento DISABILITATE (Course Lab Edition)');
    // Non avviare nessun cron job
}

module.exports = { init };