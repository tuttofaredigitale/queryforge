// backend/config/config.js
// Carica le variabili dal file .env nella root del backend
require('dotenv').config();

// Logica per assicurarsi che le variabili essenziali siano caricate
const requiredEnvVars = [
  'DB_ADMIN_USER',
  'DB_ADMIN_PASSWORD',
  'DB_AUTH_DATABASE',
  'DB_HOST',
  'DB_PORT'
];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.warn(`ATTENZIONE: La variabile d'ambiente ${varName} non è definita nel file .env. La configurazione della CLI potrebbe non funzionare.`);
  }
});

module.exports = {
  // Configurazione per l'ambiente di sviluppo (usato da `db:migrate` di default)
  development: {
    username: process.env.DB_ADMIN_USER,   // Utente con permessi per ALTER TABLE ecc.
    password: process.env.DB_ADMIN_PASSWORD, // Password dell'utente admin
    database: process.env.DB_AUTH_DATABASE,  // Database dove si trova la tabella 'users'
    host: process.env.DB_HOST,               // Host del database (es. 'localhost')
    port: parseInt(process.env.DB_PORT, 10), // Porta del database (assicurati sia numero)
    dialect: 'mysql'                         // Specifica che usi MySQL
    // dialectOptions: { // Opzioni specifiche MySQL (decommenta se necessario)
    //   connectTimeout: 60000
    // }
  },
  // Configurazione per l'ambiente di test (adattala se fai test automatici)
  test: {
    username: process.env.CI_DB_USER || 'test_user', // Usa variabili CI se disponibili
    password: process.env.CI_DB_PASSWORD || null,
    database: process.env.CI_DB_NAME || 'test_db_auth', // Database di test
    host: process.env.CI_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.CI_DB_PORT || 3306, 10),
    dialect: 'mysql'
  },
  // Configurazione per l'ambiente di produzione
  production: {
    // !!! Usa un metodo sicuro per gestire le credenziali in produzione !!!
    // (es. variabili d'ambiente del server, secret manager)
    username: process.env.PROD_DB_ADMIN_USER, // Utente admin per migrazioni in prod
    password: process.env.PROD_DB_ADMIN_PASSWORD,
    database: process.env.PROD_DB_AUTH_DATABASE, // Database di produzione per auth
    host: process.env.PROD_DB_HOST,
    port: parseInt(process.env.PROD_DB_PORT || 3306, 10),
    dialect: 'mysql',
    // dialectOptions: { // Esempio per SSL in produzione
    //   ssl: { require: true, rejectUnauthorized: true }
    // }
  }
};