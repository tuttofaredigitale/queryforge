/**
 * Script di analisi dei log di QueryForge
 * Uso: node logAnalyzer.js [data] [--format=json|text]
 * Es:  node logAnalyzer.js 2025-03-10 --format=json
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Directory e file dei log
const LOG_DIR = path.join(__dirname, '..', 'logs');
const COMBINED_LOG = path.join(LOG_DIR, 'combined.log');
const SQL_LOG = path.join(LOG_DIR, 'sql_queries.log');

// Controllo argomenti
const args = process.argv.slice(2);
let targetDate = new Date().toISOString().split('T')[0]; // Default: oggi
let outputFormat = 'text'; // Default: text

// Parsing argomenti
args.forEach(arg => {
  if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
    targetDate = arg;
  } else if (arg.startsWith('--format=')) {
    outputFormat = arg.split('=')[1];
  }
});

// Statistiche
const stats = {
  date: targetDate,
  timestamp: new Date().toISOString(),
  general: {
    totalRequests: 0,
    uniqueUsers: new Set(),
    uniqueIPs: new Set(),
    errorCount: 0,
    warningCount: 0,
    securityEvents: 0
  },
  sqlQueries: {
    total: 0,
    select: 0,
    insert: 0,
    update: 0,
    delete: 0,
    other: 0,
    suspicious: 0,
    byUser: {}
  },
  endpoints: {},
  securityEvents: [],
  topUsers: [],
  topEndpoints: []
};

// Estrae timestamp dalla riga di log
function extractTimestamp(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : null;
}

// Controlla se la riga appartiene alla data target
function isMatchingDate(line) {
  const timestamp = extractTimestamp(line);
  return timestamp && timestamp.startsWith(targetDate);
}

// Analizza log generali
async function analyzeGeneralLogs() {
  console.log(`Analisi log generali per la data ${targetDate}...`);
  
  const fileStream = fs.createReadStream(COMBINED_LOG);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    // Controlla se la riga appartiene alla data target
    if (!isMatchingDate(line)) continue;
    
    // Conta per livello di log
    if (line.includes(' error: ')) stats.general.errorCount++;
    if (line.includes(' warn: ')) stats.general.warningCount++;
    
    // Estrai info richieste HTTP
    const httpMatch = line.match(/HTTP ([A-Z]+) (\/[^\s]*) (\d+) - (\d+)ms \[User: ([^\]]+)\]/i);
    if (httpMatch) {
      const [_, method, endpoint, statusCode, duration, userId] = httpMatch;
      
      stats.general.totalRequests++;
      stats.general.uniqueUsers.add(userId);
      
      // Traccia endpoint
      const endpointKey = `${method} ${endpoint.split('?')[0]}`; // Rimuovi query params
      if (!stats.endpoints[endpointKey]) {
        stats.endpoints[endpointKey] = {
          count: 0,
          totalDuration: 0,
          errors: 0
        };
      }
      
      stats.endpoints[endpointKey].count++;
      stats.endpoints[endpointKey].totalDuration += parseInt(duration, 10);
      
      if (parseInt(statusCode, 10) >= 400) {
        stats.endpoints[endpointKey].errors++;
      }
      
      // Traccia IP (se presente)
      const ipMatch = line.match(/\[IP: ([^\]]+)\]/);
      if (ipMatch) {
        stats.general.uniqueIPs.add(ipMatch[1]);
      }
    }
    
    // Traccia eventi di sicurezza
    if (line.includes('Evento sicurezza:')) {
      stats.general.securityEvents++;
      
      // Aggiungi dettagli dell'evento di sicurezza
      const eventMatch = line.match(/Evento sicurezza: ([^\s\[]+)/);
      if (eventMatch) {
        stats.securityEvents.push({
          type: eventMatch[1],
          timestamp: extractTimestamp(line),
          rawLog: line
        });
      }
    }
  }
  
  // Converti Set in numeri
  stats.general.uniqueUsers = stats.general.uniqueUsers.size;
  stats.general.uniqueIPs = stats.general.uniqueIPs.size;
}

// Analizza log delle query SQL
async function analyzeSqlLogs() {
  console.log(`Analisi log SQL per la data ${targetDate}...`);
  
  // Verifica se il file di log SQL esiste
  if (!fs.existsSync(SQL_LOG)) {
    console.warn('File di log SQL non trovato. L\'analisi SQL sarà incompleta.');
    return;
  }
  
  const fileStream = fs.createReadStream(SQL_LOG);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      
      // Controlla se l'entry appartiene alla data target
      if (!entry.timestamp || !entry.timestamp.startsWith(targetDate)) continue;
      
      // Incrementa statistiche per tipo di query
      stats.sqlQueries.total++;
      
      if (entry.queryType) {
        const type = entry.queryType.toLowerCase();
        if (type === 'select') stats.sqlQueries.select++;
        else if (type === 'insert') stats.sqlQueries.insert++;
        else if (type === 'update') stats.sqlQueries.update++;
        else if (type === 'delete') stats.sqlQueries.delete++;
        else stats.sqlQueries.other++;
      }
      
      // Traccia query sospette
      if (entry.suspicious) {
        stats.sqlQueries.suspicious++;
      }
      
      // Traccia per utente
      if (entry.userId) {
        if (!stats.sqlQueries.byUser[entry.userId]) {
          stats.sqlQueries.byUser[entry.userId] = {
            total: 0,
            suspicious: 0
          };
        }
        
        stats.sqlQueries.byUser[entry.userId].total++;
        
        if (entry.suspicious) {
          stats.sqlQueries.byUser[entry.userId].suspicious++;
        }
      }
    } catch (err) {
      // Ignora errori di parsing
    }
  }
  
  // Calcola top users
  stats.topUsers = Object.entries(stats.sqlQueries.byUser)
    .map(([userId, data]) => ({
      userId,
      queryCount: data.total,
      suspiciousCount: data.suspicious
    }))
    .sort((a, b) => b.queryCount - a.queryCount)
    .slice(0, 10);
  
  // Calcola top endpoints
  stats.topEndpoints = Object.entries(stats.endpoints)
    .map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      avgDuration: data.totalDuration / data.count,
      errorRate: (data.errors / data.count) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// Output formattato in base al tipo selezionato
function outputResults() {
  if (outputFormat === 'json') {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  
  // Output come testo
  console.log('\n==================================================');
  console.log(`REPORT ANALISI LOG - ${targetDate}`);
  console.log('==================================================\n');
  
  console.log('STATISTICHE GENERALI:');
  console.log(`- Richieste totali: ${stats.general.totalRequests}`);
  console.log(`- Utenti unici: ${stats.general.uniqueUsers}`);
  console.log(`- IP unici: ${stats.general.uniqueIPs}`);
  console.log(`- Errori: ${stats.general.errorCount}`);
  console.log(`- Warning: ${stats.general.warningCount}`);
  console.log(`- Eventi di sicurezza: ${stats.general.securityEvents}`);
  
  console.log('\nSTATISTICHE SQL:');
  console.log(`- Query totali: ${stats.sqlQueries.total}`);
  console.log(`- SELECT: ${stats.sqlQueries.select}`);
  console.log(`- INSERT: ${stats.sqlQueries.insert}`);
  console.log(`- UPDATE: ${stats.sqlQueries.update}`);
  console.log(`- DELETE: ${stats.sqlQueries.delete}`);
  console.log(`- Altre: ${stats.sqlQueries.other}`);
  console.log(`- Query sospette: ${stats.sqlQueries.suspicious}`);
  
  console.log('\nTOP 10 UTENTI:');
  stats.topUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.userId}: ${user.queryCount} query (${user.suspiciousCount} sospette)`);
  });
  
  console.log('\nTOP 10 ENDPOINT:');
  stats.topEndpoints.forEach((endpoint, index) => {
    console.log(`${index + 1}. ${endpoint.endpoint}: ${endpoint.count} chiamate (tempo medio: ${endpoint.avgDuration.toFixed(2)}ms)`);
  });
  
  console.log('\nEVENTI DI SICUREZZA:');
  if (stats.securityEvents.length === 0) {
    console.log('Nessun evento di sicurezza rilevato.');
  } else {
    stats.securityEvents.slice(0, 10).forEach((event, index) => {
      console.log(`${index + 1}. [${event.timestamp}] ${event.type}`);
    });
    
    if (stats.securityEvents.length > 10) {
      console.log(`...e altri ${stats.securityEvents.length - 10} eventi.`);
    }
  }
  
  console.log('\n==================================================\n');
}

// Funzione principale
async function main() {
  try {
    await analyzeGeneralLogs();
    await analyzeSqlLogs();
    outputResults();
  } catch (err) {
    console.error('Errore durante l\'analisi dei log:', err);
  }
}

main();