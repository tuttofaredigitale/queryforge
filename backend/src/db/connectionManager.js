const userConnections = new Map();

async function getUserConnection(userId) {
  // Se esiste già una connessione attiva, la riutilizziamo
  if (userConnections.has(userId)) {
    return userConnections.get(userId);
  }
  
  // Altrimenti otteniamo le credenziali dell'utente MySQL dal nostro storage sicuro
  const userCredentials = await getUserDatabaseCredentials(userId);
  
  // Creiamo una connessione dedicata con le credenziali dell'utente
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: userCredentials.username,
    password: userCredentials.password,
    database: userCredentials.database,
    // Impostazioni aggiuntive per la sicurezza
    multipleStatements: false,  // Disabilita query multiple
    debug: false                // Disabilita il debug per evitare info leak
  });
  
  // Memorizziamo la connessione per riutilizzarla
  userConnections.set(userId, connection);
  
  return connection;
}