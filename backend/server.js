// backend/server.js - VERSIONE CORRETTA
require('dotenv').config();

const app = require('./app'); 
const logger = require('./src/utils/logger');
const setupDatabaseCleanup = require('./scripts/setupCleanup'); 
// RIMOSSO: setupSubscriptionTasks (sistema abbonamenti disabilitato)

// NOTA: Non importare più da routes/index perché le route di monitoring
// sono già gestite in app.js

const PORT = process.env.PORT || 3000;

// Variabili d'ambiente per debug
logger.info('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PORT}`,
  PORT: PORT
});

// Avvia il server
const server = app.listen(PORT, () => {
  logger.info(`Server avviato sulla porta ${PORT} in modalità ${process.env.NODE_ENV}`);
  logger.info(`CORS configurato per: ${process.env.FRONTEND_URL || 'localhost'}`);
  
  logger.info('Inizializzazione task schedulati...');
  setupDatabaseCleanup();       // scheduler esistente per la pulizia DB
  // RIMOSSO: setupSubscriptionTasks (sistema abbonamenti disabilitato)
  
  logger.info('Server pronto per ricevere richieste');
  logger.info(`Login disponibile su: http://localhost:${PORT}/login`);
  logger.info(`Monitoring disponibile su: http://localhost:${PORT}/monitoring`);
});

// Gestione graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM ricevuto, chiusura server...');
  server.close(() => {
    logger.info('Server HTTP chiuso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT ricevuto, chiusura server...');
  server.close(() => {
    logger.info('Server HTTP chiuso');
    process.exit(0);
  });
});