const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lista dei database sensibili/protetti
const PROTECTED_DATABASES = ['sql_auth', 'mysql', 'information_schema', 'performance_schema', 'sys'];

// Configurazione per operazioni amministrative (es. CREATE DATABASE)
const adminDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3307, // Usa 3307 se definito
  user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'root',
  password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || 'rootpassword'
};

// Credenziali utente MySQL per database isolati
const userMySQLCredentials = new Map();

// Pool di connessioni per ogni database utente
const userPools = {};
// Registro dei timestamp dell'ultima attività
const lastActivityMap = {};

// Leggi lo schema template da file
const templateSchema = fs.readFileSync(
  path.join(__dirname, 'schema', 'template_schema.sql'),
  'utf8'
);

/**
 * Crea un utente MySQL dedicato per un utente dell'applicazione con privilegi limitati.
 * Questo garantisce che ogni utente possa accedere SOLO al proprio database.
 */
async function createIsolatedMySQLUser(userId, dbName) {
  // Se abbiamo già le credenziali per questo utente, le riutilizziamo
  if (userMySQLCredentials.has(userId)) {
    return userMySQLCredentials.get(userId);
  }
  
  try {
    // Genera un nome utente MySQL basato sull'ID utente (senza timestamp per riutilizzo)
    const mysqlUsername = `user_${userId}`;
    const mysqlPassword = crypto.randomBytes(16).toString('hex');
    
    const adminConnection = await mysql.createConnection(adminDbConfig);
    
    try {
      // 1. Elimina l'utente se esiste (per un reset completo)
      try {
        await adminConnection.execute(`DROP USER IF EXISTS '${mysqlUsername}'@'%'`);
      } catch (dropError) {
        console.log(`Nota: utente ${mysqlUsername} non esistente o non eliminabile`);
      }
      
      // 2. Crea l'utente MySQL dedicato
      await adminConnection.execute(
        `CREATE USER '${mysqlUsername}'@'%' IDENTIFIED BY '${mysqlPassword}'`
      );
      
      // 3. Privilegi MOLTO specifici solo sul database dell'utente
      // Invece di concedere e poi revocare, concediamo SOLO ciò che è necessario
      await adminConnection.execute(`
        GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER 
        ON \`${dbName}\`.* TO '${mysqlUsername}'@'%'
      `);
      
      // 4. Applica le modifiche ai privilegi
      await adminConnection.execute('FLUSH PRIVILEGES');
      
      // Salva le credenziali
      const credentials = {
        username: mysqlUsername,
        password: mysqlPassword,
        database: dbName
      };
      
      userMySQLCredentials.set(userId, credentials);
      
      return credentials;
    } finally {
      await adminConnection.end();
    }
  } catch (error) {
    console.error(`Errore nella creazione dell'utente MySQL isolato per l'utente ${userId}:`, error);
    throw error;
  }
}

/**
 * Crea o recupera un database per un utente specifico.
 * Usa la configurazione admin per creare il database se non esiste.
 * Inoltre, crea un utente MySQL dedicato con privilegi limitati.
 */
async function getUserDatabase(userId) {
  try {
    const dbName = `sql_template_user_${userId}`;
    
    // Aggiorna timestamp attività
    lastActivityMap[userId] = Date.now();
    
    // Se il pool esiste già, restituiscilo
    if (userPools[userId]) {
      return userPools[userId];
    }
    
    // Crea una connessione temporanea come admin per creare il database se necessario
    const adminConnection = await mysql.createConnection(adminDbConfig);
    
    // Crea il database se non esiste
    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    
    // Chiudi la connessione admin
    await adminConnection.end();
    
    // Crea un utente MySQL isolato per questo utente
    const userCredentials = await createIsolatedMySQLUser(userId, dbName);
    
    // Crea un pool per il database utente usando le credenziali dedicate dell'utente
    const userPool = mysql.createPool({
      host: adminDbConfig.host,
      port: adminDbConfig.port,
      user: userCredentials.username,
      password: userCredentials.password,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      // Impostazioni di sicurezza aggiuntive
      multipleStatements: false // Previene l'esecuzione di query multiple
    });
    
    // Memorizza il pool per uso futuro
    userPools[userId] = userPool;
    
    // Verifica se il database necessita di inizializzazione usando la stessa connessione admin
    const adminDbConnection = await mysql.createConnection({
      ...adminDbConfig,
      database: dbName
    });
    
    try {
      const [tables] = await adminDbConnection.query('SHOW TABLES');
      if (tables.length === 0) {
        // Inizializza con la connessione admin (ha tutti i privilegi necessari)
        await initializeUserDatabase(adminDbConnection);
      }
    } finally {
      await adminDbConnection.end();
    }
    
    // Ora verifichiamo la connessione dell'utente con una semplice query di prova
    try {
      const connection = await userPool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      console.log(`Connessione al database per l'utente ${userId} verificata con successo`);
    } catch (error) {
      console.error(`Errore nella verifica della connessione per l'utente ${userId}:`, error);
      throw new Error(`Impossibile connettersi al database come utente ${userCredentials.username}: ${error.message}`);
    }
    
    return userPool;
  } catch (error) {
    console.error(`Errore nella creazione/recupero database utente ${userId}:`, error);
    throw error;
  }
}

/**
 * Inizializza un database utente con lo schema template.
 */
async function initializeUserDatabase(connection) {
  try {
    // Divide lo script in comandi individuali ed esegui ciascuno
    const statements = templateSchema
      .split(';')
      .filter(stmt => stmt.trim().length > 0);
    
    for (const stmt of statements) {
      await connection.query(stmt);
    }
    
    console.log('Database utente inizializzato con successo');
  } catch (error) {
    console.error('Errore nell\'inizializzazione database:', error);
    throw error;
  }
}

/**
 * Resetta il database di un utente specifico.
 */
async function resetUserDatabase(userId) {
  try {
    // Crea una connessione amministrativa per resettare il database
    const dbName = `sql_template_user_${userId}`;
    const adminConnection = await mysql.createConnection({
      ...adminDbConfig,
      database: dbName
    });
    
    try {
      // Elenca tutte le tabelle esistenti
      const [tables] = await adminConnection.query('SHOW TABLES');
      
      // Disabilita temporaneamente i vincoli di chiave esterna
      await adminConnection.query('SET FOREIGN_KEY_CHECKS = 0');
      
      for (const tableObj of tables) {
        const tableName = Object.values(tableObj)[0];
        await adminConnection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
      
      // Riabilita i vincoli di chiave esterna
      await adminConnection.query('SET FOREIGN_KEY_CHECKS = 1');
      
      // Reinizializza il database con lo schema template
      await initializeUserDatabase(adminConnection);
      
      console.log(`Database utente ${userId} resettato con successo`);
      return true;
    } finally {
      await adminConnection.end();
    }
  } catch (error) {
    console.error(`Errore nel reset del database utente ${userId}:`, error);
    return false;
  }
}

/**
 * Funzione per pulire i database inattivi
 */
async function cleanupInactiveDatabases(inactivityDays = 7) {
  const now = Date.now();
  const inactivityThreshold = inactivityDays * 24 * 60 * 60 * 1000; // giorni in ms
  
  for (const [userId, lastActivity] of Object.entries(lastActivityMap)) {
    if (now - lastActivity > inactivityThreshold) {
      console.log(`Resetting inactive database for user ${userId}`);
      await resetUserDatabase(userId);
    }
  }
}

/**
 * Verifica se una query accede a database protetti.
 * Utile per il middleware di sicurezza.
 */
function queryAccessesProtectedDatabases(query) {
  const lowerQuery = query.toLowerCase();
  
  // Controlla ogni database protetto
  for (const db of PROTECTED_DATABASES) {
    // Cerca diverse forme di accesso al database
    if (
      lowerQuery.includes(`use ${db}`) ||
      lowerQuery.includes(`from ${db}.`) ||
      lowerQuery.includes(`join ${db}.`) ||
      lowerQuery.includes(`into ${db}.`) ||
      lowerQuery.includes(`update ${db}.`) ||
      lowerQuery.includes(`select schema_name`) || // Tentativi di enumerare i database
      lowerQuery.includes(`show databases`) ||
      lowerQuery.includes(`information_schema.schemata`)
    ) {
      return true;
    }
  }
  
  return false;
}

const suspiciousActivityMap = {};

function trackSuspiciousActivity(userId, query) {
  if (!suspiciousActivityMap[userId]) {
    suspiciousActivityMap[userId] = {
      count: 0,
      lastAttempt: null,
      blocked: false
    };
  }
  
  const user = suspiciousActivityMap[userId];
  const now = Date.now();
  
  // Reset del conteggio dopo un periodo di inattività
  if (user.lastAttempt && (now - user.lastAttempt > 60000)) {
    user.count = 0;
  }
  
  user.count++;
  user.lastAttempt = now;
  
  // Blocco temporaneo dopo troppi tentativi sospetti
  if (user.count > 5) {
    user.blocked = true;
    setTimeout(() => {
      user.blocked = false;
      user.count = 0;
    }, 300000); // Blocco di 5 minuti
    
    return true; // Utente bloccato
  }
  
  return false; // Utente non bloccato
}

function sanitizeSQLQuery(query) {
  const sanitized = query
    .replace(/information_schema/gi, 'blocked_schema')
    .replace(/performance_schema/gi, 'blocked_schema')
    .replace(/show\s+databases/gi, '-- blocked: show databases');
  
  // Se la query è stata modificata, è stata bloccata
  if (sanitized !== query) {
    throw new Error('Query contiene operazioni non consentite');
  }
  
  return query;
}

/**
 * Ottiene una connessione al database dell'utente per eseguire query
 */
async function getUserConnection(userId) {
  const pool = await getUserDatabase(userId);
  const connection = await pool.getConnection();
  
  // Override del metodo query per aggiungere il sanitizer
  const originalQuery = connection.query;
  connection.query = function(sql, ...args) {
    const sanitizedSql = sanitizeSQLQuery(sql);
    return originalQuery.call(this, sanitizedSql, ...args);
  };
  
  return connection;
}

async function testUserIsolation(userId) {
  try {
    const credentials = userMySQLCredentials.get(userId);
    if (!credentials) {
      return "Utente non trovato";
    }
    
    // Crea una connessione di test con le credenziali dell'utente
    const testConn = await mysql.createConnection({
      host: adminDbConfig.host,
      port: adminDbConfig.port,
      user: credentials.username,
      password: credentials.password,
      database: credentials.database
    });
    
    try {
      // Prova ad accedere a information_schema
      await testConn.query('SELECT * FROM information_schema.tables LIMIT 1');
      return "ATTENZIONE: Accesso a information_schema possibile!";
    } catch (error) {
      return "OK: Accesso a information_schema negato come previsto";
    } finally {
      await testConn.end();
    }
  } catch (error) {
    return `Errore nel test: ${error.message}`;
  }
}

module.exports = {
  getUserDatabase,
  resetUserDatabase,
  cleanupInactiveDatabases,
  queryAccessesProtectedDatabases,
  getUserConnection,
  trackSuspiciousActivity,
  testUserIsolation,
  PROTECTED_DATABASES
};