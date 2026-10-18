// backend/utils/db.js - VERSIONE AGGIORNATA PER TIDB SERVERLESS
const mysql = require('mysql2/promise');
const os = require('os');

// Safe logger import
let logger;
try {
  logger = require('./logger');
} catch (error) {
  logger = {
    info: (msg, data) => console.log('[DB INFO]', msg, data || ''),
    warn: (msg, data) => console.warn('[DB WARN]', msg, data || ''),
    error: (msg, data) => console.error('[DB ERROR]', msg, data || '')
  };
}

// =====================================================
// INTELLIGENT POOL SIZING
// =====================================================
const cpuCount = os.cpus().length;
const estimatedConcurrentUsers = parseInt(process.env.ESTIMATED_CONCURRENT_USERS) || 20;
const calculatedPoolSize = Math.max(10, (cpuCount * 2) + estimatedConcurrentUsers);

// =====================================================
// SECURE & OPTIMIZED POOL CONFIGURATION  
// =====================================================
const basePoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password',
  
  // Intelligent sizing
  connectionLimit: calculatedPoolSize,
  waitForConnections: true,
  queueLimit: 0,
  
  // Performance optimizations
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  dateStrings: true,
  
  // Security & reliability
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: true
  } : false
};

// =====================================================
// POOL INSTANCES
// =====================================================

let authPool;
let templatePool;
let rootPool = null; // Usato solo in sviluppo per creare i DB
const userPools = {};

if (process.env.NODE_ENV === 'production') {
    // =====================================================
    // CONFIGURAZIONE DI PRODUZIONE - TIDB SERVERLESS
    // =====================================================
    logger.info(`Modalità PRODUZIONE: Configurazione pool per TiDB Serverless.`);
    
    // TiDB Serverless richiede:
    // - Porta 4000 (non 3306)
    // - SSL obbligatorio con TLS 1.2+
    // - Username con prefisso cluster (es. xxxxxxxxxxxxxxx.root)
    
    const tidbConfig = {
        host: process.env.DB_HOST,           // gateway01.eu-central-1.prod.aws.tidbcloud.com
        port: parseInt(process.env.DB_PORT) || 4000,  // TiDB usa porta 4000
        user: process.env.DB_USER,           // Prefisso.username (es. xxxxxxxxxxxxxxx.root)
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,       // Nome database (es. test)
        
        // SSL OBBLIGATORIO per TiDB Serverless
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        },
        
        // Pool settings
        connectionLimit: calculatedPoolSize,
        waitForConnections: true,
        queueLimit: 0,
        
        // Performance
        connectTimeout: 15000,  // TiDB cloud potrebbe essere leggermente più lento
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
        dateStrings: true,
        
        // IMPORTANTE: multipleStatements per le operazioni batch
        multipleStatements: true
    };
    
    // Validazione configurazione
    if (!tidbConfig.host || !tidbConfig.user || !tidbConfig.password || !tidbConfig.database) {
        logger.error('ERRORE CRITICO: Variabili ambiente TiDB mancanti!', {
            hasHost: !!tidbConfig.host,
            hasUser: !!tidbConfig.user,
            hasPassword: !!tidbConfig.password,
            hasDatabase: !!tidbConfig.database
        });
        throw new Error('Configurazione TiDB incompleta. Verifica le variabili DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    }
    
    authPool = mysql.createPool(tidbConfig);
    templatePool = authPool; // In produzione usiamo un singolo pool (multi-tenancy a livello di tabelle)
    
    logger.info("Pool TiDB Serverless creato con successo.", {
        host: tidbConfig.host,
        port: tidbConfig.port,
        database: tidbConfig.database,
        connectionLimit: tidbConfig.connectionLimit
    });

} else {
    // =====================================================
    // CONFIGURAZIONE DI SVILUPPO (Docker/Locale)
    // =====================================================
    logger.info(`Modalità SVILUPPO: Configurazione pool per Docker.`);
    const devConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD || 'app_password',
        connectionLimit: calculatedPoolSize,
        waitForConnections: true,
        queueLimit: 0,
        connectTimeout: 10000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
        dateStrings: true,
        multipleStatements: true
    };
    
    // In sviluppo, creiamo due pool separati
    authPool = mysql.createPool({ ...devConfig, database: 'sql_auth' });
    templatePool = mysql.createPool({ ...devConfig, database: 'sql_template' });

    // Funzione per ottenere connessione root (solo sviluppo)
    function getRootPool() {
        if (!rootPool) {
            rootPool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 3307,
                user: 'root',
                password: process.env.MYSQL_ROOT_PASSWORD || 'rootpassword',
                multipleStatements: true,
                connectTimeout: 10000,
                waitForConnections: true,
                connectionLimit: 5
            });
        }
        return rootPool;
    }
}

// =====================================================
// INPUT VALIDATION & SANITIZATION
// =====================================================
const validator = {
  userId: (userId) => {
    if (!userId) return null;
    const cleaned = String(userId).replace(/[^a-zA-Z0-9_]/g, '');
    return cleaned.length > 0 && cleaned.length <= 50 ? cleaned : null;
  },
  
  query: (query) => {
    if (!query || typeof query !== 'string') return null;
    return query.trim().length > 0 ? query.trim() : null;
  },
  
  params: (params) => {
    if (!Array.isArray(params)) return [];
    return params.slice(0, 100); // Limit params to prevent abuse
  }
};

// =====================================================
// CORE DATABASE FUNCTIONS
// =====================================================

/**
 * Execute query on main template database
 */
async function execute(query, params = []) {
  const cleanQuery = validator.query(query);
  const cleanParams = validator.params(params);
  
  if (!cleanQuery) {
    throw new Error('Invalid query provided');
  }
  
  try {
    const [rows, fields] = await templatePool.execute(cleanQuery, cleanParams);
    
    logger.info('Template database query executed', {
      queryType: getQueryType(cleanQuery),
      affectedRows: rows.affectedRows || rows.length || 0,
      duration: fields?.executionTime || 'unknown'
    });
    
    return [rows, fields];
  } catch (error) {
    logger.error('Template database query failed', {
      error: error.message,
      code: error.code,
      queryType: getQueryType(cleanQuery)
    });
    throw error;
  }
}

/**
 * Execute query on auth database
 */
async function executeAuth(query, params = []) {
  const cleanQuery = validator.query(query);
  const cleanParams = validator.params(params);
  
  if (!cleanQuery) {
    throw new Error('Invalid query provided');
  }
  
  try {
    const [rows, fields] = await authPool.execute(cleanQuery, cleanParams);
    
    logger.info('Auth database query executed', {
      queryType: getQueryType(cleanQuery),
      affectedRows: rows.affectedRows || rows.length || 0
    });
    
    return [rows, fields];
  } catch (error) {
    logger.error('Auth database query failed', {
      error: error.message,
      code: error.code,
      queryType: getQueryType(cleanQuery)
    });
    throw error;
  }
}

/**
 * Get direct connection to template database
 */
async function getConnection() {
  try {
    const connection = await templatePool.getConnection();
    return connection;
  } catch (error) {
    logger.error('Failed to get template connection', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get direct connection to auth database
 */
async function getAuthConnection() {
  try {
    const connection = await authPool.getConnection();
    return connection;
  } catch (error) {
    logger.error('Failed to get auth connection', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Ottiene una connessione specifica per il database di un utente.
 * - In PRODUZIONE, restituisce una connessione dal pool principale (multi-tenancy a livello di tabelle).
 * - In SVILUPPO, crea/recupera un pool di connessioni dedicato per il database isolato dell'utente.
 * 
 * @param {string|number} userId L'ID dell'utente.
 * @returns {Promise<mysql.PoolConnection>} Una connessione al database.
 */
async function createUserDbConnection(userId) {
    const cleanUserId = validator.userId(userId);
    if (!cleanUserId) {
        throw new Error('ID utente non valido fornito a createUserDbConnection');
    }

    if (process.env.NODE_ENV === 'production') {
        // --- Logica di Produzione: Semplice ---
        logger.info(`[Prod] Fornisco connessione dal pool principale per utente ${cleanUserId}`);
        return authPool.getConnection();

    } else {
        // --- Logica di Sviluppo ---
        const dbName = `sql_template_user_${cleanUserId}`;

        if (userPools[dbName]) {
            logger.info(`[Dev] Ritorno pool esistente per il database ${dbName}`);
            return userPools[dbName].getConnection();
        }

        logger.info(`[Dev] Pool per ${dbName} non trovato. Inizio creazione...`);
        
        const root = getRootPool();
        await root.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        logger.info(`[Dev] Database ${dbName} creato o già esistente.`);

        const dbUser = process.env.DB_USER || 'app_user';
        await root.execute(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'`);
        await root.execute('FLUSH PRIVILEGES');
        logger.info(`[Dev] Permessi concessi a '${dbUser}' sul database ${dbName}.`);

        const userPool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 3307,
            user: dbUser,
            password: process.env.DB_PASSWORD || 'app_password',
            database: dbName,
            connectionLimit: 5,
            waitForConnections: true,
            queueLimit: 0,
            multipleStatements: true
        });

        userPools[dbName] = userPool;
        logger.info(`[Dev] Pool per ${dbName} creato e memorizzato.`);

        const tempConn = await userPool.getConnection();
        try {
            const [tables] = await tempConn.query('SHOW TABLES');
            if (tables.length === 0) {
                logger.info(`[Dev] Il database ${dbName} è vuoto. Inizializzazione schema...`);
                const fs = require('fs');
                const path = require('path');
                const schemaPath = path.join(__dirname, '../db/schema/template_schema.sql'); 
                const templateSchema = fs.readFileSync(schemaPath, 'utf8');
                await tempConn.query(templateSchema);
                logger.info(`[Dev] Schema per ${dbName} inizializzato con successo.`);
            }
        } finally {
            tempConn.release();
        }

        return userPool.getConnection();
    }
}

/**
 * Resetta il database di un utente allo stato iniziale.
 * 
 * IMPORTANTE PER TIDB:
 * TiDB ha DDL auto-commit, quindi CREATE TABLE e DROP TABLE NON possono 
 * essere eseguiti dentro una transazione. La logica è stata modificata per:
 * 1. Eseguire i DDL (DROP/CREATE) FUORI dalla transazione
 * 2. Usare la transazione SOLO per gli INSERT dei dati
 * 
 * @param {string|number} userId L'ID dell'utente da resettare.
 * @returns {Promise<boolean>} Restituisce true se il reset ha avuto successo.
 */
async function resetUserDatabase(userId) {
    const cleanUserId = validator.userId(userId);
    if (!cleanUserId) {
        throw new Error('ID utente non valido fornito a resetUserDatabase');
    }

    if (process.env.NODE_ENV === 'production') {
        // =====================================================
        // LOGICA DI PRODUZIONE - COMPATIBILE CON TIDB
        // =====================================================
        logger.info(`[Prod] Inizio reset tabelle per utente ${cleanUserId}...`);
        
        const connection = await authPool.getConnection();
        
        try {
            // Sanitizza l'userId (solo numeri per sicurezza)
            const safeUserId = String(cleanUserId).replace(/[^0-9]/g, '');
            if (!safeUserId) {
                throw new Error('ID utente non valido per il reset');
            }
            
            // =====================================================
            // FASE 1: DDL - DROP TABLES (FUORI dalla transazione)
            // In TiDB i DDL sono auto-commit, non possono stare in transazione
            // =====================================================
            
            const showTablesQuery = `SHOW TABLES LIKE 'user\\_${safeUserId}\\_%'`;
            logger.info(`[Prod Reset] Ricerca tabelle utente: ${showTablesQuery}`);
            
            const [tables] = await connection.query(showTablesQuery);
            const tableNames = tables.map(t => Object.values(t)[0]);
            
            logger.info(`[Prod Reset] Trovate ${tableNames.length} tabelle per utente ${safeUserId}: ${tableNames.join(', ')}`);

            // Drop delle tabelle esistenti (DDL, fuori transazione)
            if (tableNames.length > 0) {
                await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
                
                for (const tableName of tableNames) {
                    if (tableName.startsWith(`user_${safeUserId}_`)) {
                        logger.info(`[Prod Reset] DROP tabella: ${tableName}`);
                        await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
                    } else {
                        logger.warn(`[Prod Reset] Tabella ${tableName} non corrisponde al pattern, SALTATA!`);
                    }
                }
                
                await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');
                logger.info(`[Prod Reset] ${tableNames.length} tabelle eliminate.`);
            }
            
            // =====================================================
            // FASE 2: DDL - CREATE TABLES (FUORI dalla transazione)
            // =====================================================
            
            const templateTables = await getTemplateTables(connection);
            logger.info(`[Prod Reset] Trovati ${templateTables.length} template: ${templateTables.join(', ')}`);
            
            for (const templateTable of templateTables) {
                const baseTableName = templateTable.replace(/^template_/, '');
                const userTableName = `user_${safeUserId}_${baseTableName}`;
                
                logger.info(`[Prod Reset] CREATE tabella: ${userTableName} da ${templateTable}`);
                await connection.execute(`CREATE TABLE IF NOT EXISTS \`${userTableName}\` LIKE \`${templateTable}\`;`);
            }
            
            logger.info(`[Prod Reset] ${templateTables.length} tabelle create.`);
            
            // =====================================================
            // FASE 3: DML - INSERT DATA (DENTRO transazione)
            // Solo gli INSERT possono stare in transazione
            // =====================================================
            
            await connection.beginTransaction();
            
            try {
                for (const templateTable of templateTables) {
                    const baseTableName = templateTable.replace(/^template_/, '');
                    const userTableName = `user_${safeUserId}_${baseTableName}`;
                    
                    logger.info(`[Prod Reset] INSERT dati in: ${userTableName}`);
                    await connection.execute(
                        `INSERT INTO \`${userTableName}\` SELECT * FROM \`${templateTable}\`;`
                    );
                }
                
                await connection.commit();
                logger.info(`[Prod Reset] Dati inseriti con successo.`);
                
            } catch (insertError) {
                await connection.rollback();
                logger.error(`[Prod Reset] Errore durante INSERT, rollback effettuato: ${insertError.message}`);
                throw insertError;
            }

            logger.info(`[Prod Reset] Reset completato con successo per utente ${safeUserId}`);
            return true;
            
        } catch (error) {
            logger.error(`[Prod Reset] Fallimento reset per utente ${cleanUserId}: ${error.message}`, {
                stack: error.stack
            });
            throw error;
        } finally {
            if (connection) connection.release();
        }

    } else {
        // =====================================================
        // LOGICA DI SVILUPPO (invariata)
        // =====================================================
        logger.info(`[Dev] Inizio reset database per utente ${cleanUserId}...`);
        const dbName = `sql_template_user_${cleanUserId}`;
        const root = getRootPool();

        try {
            await root.execute(`DROP DATABASE IF EXISTS \`${dbName}\``);
            await root.execute(`CREATE DATABASE \`${dbName}\``);
            
            if (userPools[dbName]) {
                await userPools[dbName].end();
                delete userPools[dbName];
            }
            
            logger.info(`[Dev] Database ${dbName} resettato. Verrà reinizializzato alla prossima connessione.`);
            return true;
        } catch (error) {
            logger.error(`[Dev] Fallimento reset per utente ${cleanUserId}: ${error.message}`);
            return false;
        }
    }
}

// =====================================================
// POOL STATUS & MONITORING
// =====================================================

async function getPoolStatus() {
  try {
    const status = {};
    
    if (authPool) {
      const pool = authPool.pool || authPool;
      
      const authPoolStats = {
        active: pool._allConnections?.length || 0,
        idle: pool._freeConnections?.length || 0,
        queue: pool._connectionQueue?.length || 0,
        total: pool.config?.connectionLimit || 132
      };
      
      authPoolStats.active = authPoolStats.active - authPoolStats.idle;
      
      authPoolStats.utilizationPercentage = authPoolStats.total > 0 
        ? ((authPoolStats.active / authPoolStats.total) * 100).toFixed(2) + '%'
        : '0%';
        
      status.authPool = authPoolStats;
    }
    
    if (templatePool) {
      const pool = templatePool.pool || templatePool;
      
      const templatePoolStats = {
        active: pool._allConnections?.length || 0,
        idle: pool._freeConnections?.length || 0,
        queue: pool._connectionQueue?.length || 0,
        total: pool.config?.connectionLimit || 132
      };
      
      templatePoolStats.active = templatePoolStats.active - templatePoolStats.idle;
      
      templatePoolStats.utilizationPercentage = templatePoolStats.total > 0
        ? ((templatePoolStats.active / templatePoolStats.total) * 100).toFixed(2) + '%'
        : '0%';
        
      status.mainPool = templatePoolStats;
      status.templatePool = templatePoolStats;
    }
    
    return status;
  } catch (error) {
    logger.error('Error getting pool status:', error);
    return {
      authPool: { active: 0, idle: 0, queue: 0, total: 0, utilizationPercentage: '0%' },
      mainPool: { active: 0, idle: 0, queue: 0, total: 0, utilizationPercentage: '0%' }
    };
  }
}

async function getTemplateConnection() {
  if (!templatePool) {
    throw new Error('Template pool not initialized');
  }
  return templatePool.getConnection();
}

function getPoolStatsEfficient(pool, dbName) {
  try {
    const poolObj = pool.pool;
    const config = pool.config || {};
    
    const allObjects = poolObj?._allObjects?.length || 0;
    const freeObjects = poolObj?._freeObjects?.length || 0;
    const pendingAcquires = poolObj?._pendingAcquires?.length || 0;
    
    const active = Math.max(0, allObjects - freeObjects);
    const total = allObjects;
    const idle = freeObjects;
    const queue = pendingAcquires;
    const connectionLimit = config.connectionLimit || calculatedPoolSize;
    
    const utilizationPercentage = connectionLimit > 0 ? 
      ((active / connectionLimit) * 100).toFixed(2) : '0.00';
    
    return {
      database: dbName,
      active,
      idle,
      total,
      queue,
      connectionLimit,
      utilizationPercentage: parseFloat(utilizationPercentage)
    };
  } catch (error) {
    logger.warn(`Failed to get efficient stats for ${dbName}`, {
      error: error.message
    });
    
    return {
      database: dbName,
      active: 0,
      idle: 0,
      total: 0,
      queue: 0,
      connectionLimit: calculatedPoolSize,
      utilizationPercentage: 0,
      error: error.message
    };
  }
}

async function getDetailedPoolStatus() {
  try {
    const timestamp = new Date().toISOString();
    
    const authStats = await getPoolStatsDetailed(authPool, process.env.DB_NAME || 'sql_auth');
    const templateStats = await getPoolStatsDetailed(templatePool, process.env.DB_NAME || 'sql_template');
    
    return {
      timestamp,
      authPool: authStats,
      templatePool: templateStats,
      mainPool: templateStats,
      system: {
        cpuCount,
        estimatedConcurrentUsers,
        calculatedPoolSize
      }
    };
  } catch (error) {
    logger.error('Detailed pool status check failed', {
      error: error.message
    });
    
    return getPoolStatus();
  }
}

async function getPoolStatsDetailed(pool, dbName) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(`
      SELECT 
        COUNT(*) as total_connections,
        SUM(CASE WHEN COMMAND = 'Sleep' THEN 1 ELSE 0 END) as idle_connections,
        SUM(CASE WHEN COMMAND != 'Sleep' THEN 1 ELSE 0 END) as active_connections
      FROM information_schema.processlist
      WHERE db = ? OR db IS NULL
    `, [dbName]);
    
    const stats = rows[0];
    const poolObj = pool.pool;
    const queue = poolObj?._pendingAcquires?.length || 0;
    
    return {
      database: dbName,
      active: parseInt(stats.active_connections) || 0,
      idle: parseInt(stats.idle_connections) || 0,
      total: parseInt(stats.total_connections) || 0,
      queue,
      connectionLimit: calculatedPoolSize,
      utilizationPercentage: calculatedPoolSize > 0 ? 
        ((parseInt(stats.active_connections) || 0) / calculatedPoolSize * 100).toFixed(2) : '0.00'
    };
  } catch (error) {
    logger.warn(`Failed to get detailed stats for ${dbName}`, {
      error: error.message
    });
    
    return getPoolStatsEfficient(pool, dbName);
  } finally {
    if (connection) connection.release();
  }
}

// =====================================================
// HEALTH CHECKS
// =====================================================

async function checkHealth() {
  const results = {
    auth: { healthy: false, error: null },
    template: { healthy: false, error: null },
    root: { healthy: false, error: null }
  };
  
  try {
    const authConn = await authPool.getConnection();
    await authConn.ping();
    authConn.release();
    results.auth.healthy = true;
  } catch (error) {
    results.auth.error = error.message;
    logger.error('Auth pool health check failed', { error: error.message });
  }
  
  try {
    const templateConn = await templatePool.getConnection();
    await templateConn.ping();
    templateConn.release();
    results.template.healthy = true;
  } catch (error) {
    results.template.error = error.message;
    logger.error('Template pool health check failed', { error: error.message });
  }
  
  try {
    if (rootPool) {
      const rootConn = await rootPool.getConnection();
      await rootConn.ping();
      rootConn.release();
      results.root.healthy = true;
    } else {
      results.root.healthy = true;
    }
  } catch (error) {
    results.root.error = error.message;
    logger.error('Root pool health check failed', { error: error.message });
  }
  
  return results;
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function closePools() {
  const errors = [];
  
  logger.info('Starting graceful database shutdown...');
  
  try {
    const closePromises = [
      authPool.end().catch(err => errors.push({ pool: 'auth', error: err })),
      templatePool.end().catch(err => errors.push({ pool: 'template', error: err }))
    ];
    
    if (rootPool) {
      closePromises.push(
        rootPool.end().catch(err => errors.push({ pool: 'root', error: err }))
      );
      rootPool = null;
    }
    
    await Promise.all(closePromises);
    
    if (errors.length === 0) {
      logger.info('All database pools closed successfully');
    } else {
      logger.warn('Some database pools had errors during closure', {
        errors: errors.map(e => ({ pool: e.pool, error: e.error.message }))
      });
    }
    
  } catch (error) {
    logger.error('Critical error during database shutdown', {
      error: error.message
    });
    errors.push({ pool: 'shutdown', error });
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function getQueryType(query) {
  if (!query) return 'UNKNOWN';
  
  const upperQuery = query.toUpperCase().trim();
  if (upperQuery.startsWith('SELECT')) return 'SELECT';
  if (upperQuery.startsWith('INSERT')) return 'INSERT';
  if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
  if (upperQuery.startsWith('DELETE')) return 'DELETE';
  if (upperQuery.startsWith('CREATE')) return 'CREATE';
  if (upperQuery.startsWith('ALTER')) return 'ALTER';
  if (upperQuery.startsWith('DROP')) return 'DROP';
  if (upperQuery.startsWith('SHOW')) return 'SHOW';
  
  return 'OTHER';
}

async function getTemplateTables(connection) {
  const conn = connection || await getAuthConnection();
  try {
    const [rows] = await conn.query("SHOW TABLES LIKE 'template_%'");
    return rows.map(row => Object.values(row)[0]);
  } finally {
    if (!connection && conn) conn.release();
  }
}

// =====================================================
// ERROR HANDLERS
// =====================================================

authPool.on('error', (error) => {
  logger.error('Auth pool error', {
    error: error.message,
    code: error.code
  });
});

templatePool.on('error', (error) => {
  logger.error('Template pool error', {
    error: error.message,
    code: error.code
  });
});

// =====================================================
// GRACEFUL SHUTDOWN HANDLERS
// =====================================================

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connections...');
  await closePools();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connections...');
  await closePools();
  process.exit(0);
});

// =====================================================
// INITIALIZATION LOGGING
// =====================================================

if (process.env.NODE_ENV !== 'production') {
  logger.info('Database pools initialized', {
    poolSize: calculatedPoolSize,
    cpuCount,
    estimatedUsers: estimatedConcurrentUsers,
    databases: ['sql_auth', 'sql_template']
  });
}

module.exports = {
  // Pool instances
  authPool,
  templatePool,
  
  // Legacy aliases
  mainPool: templatePool,
  
  // Core functions
  execute,
  executeAuth,
  getConnection,
  getAuthConnection,
  createUserDbConnection,
  resetUserDatabase,
  
  // Monitoring & health
  getPoolStatus,
  getDetailedPoolStatus,
  getTemplateConnection,
  checkHealth,
  
  // Shutdown
  closePools,
  
  // Utilities
  getQueryType,
  validator,
  getTemplateTables
};