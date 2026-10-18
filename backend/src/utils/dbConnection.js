const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

const createConnection = async (database = process.env.DB_TEMPLATE) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database
    });
    
    logger.info(`Connessione al database ${database} stabilita`);
    return connection;
  } catch (error) {
    logger.error(`Errore di connessione al database ${database}: ${error.message}`);
    throw error;
  }
};

module.exports = { createConnection };