const db = require('./backend/db/database');

async function checkDatabase() {
  try {
    console.log('Controllo connessione al database...');
    
    // Verifica che il database sia connesso
    const [tables] = await db.execute('SHOW TABLES');
    console.log('Tabelle presenti nel database:', tables);
    
    // Verifica se la tabella users esiste
    const usersTableExists = tables.some(row => Object.values(row)[0] === 'users');
    
    if (!usersTableExists) {
      console.log('La tabella users non esiste, la sto creando...');
      
      // Crea la tabella users
      await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('Tabella users creata!');
      
      // Crea un utente di test
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      
      console.log('Password hashata:', hashedPassword);
      
      await db.execute(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        ['admin', 'admin@example.com', hashedPassword]
      );
      
      console.log('Utente di test creato!');
    } else {
      console.log('La tabella users esiste, controllo se ci sono utenti...');
      
      // Controlla se ci sono utenti
      const [users] = await db.execute('SELECT * FROM users');
      console.log(`Trovati ${users.length} utenti nel database.`);
      
      if (users.length === 0) {
        console.log('Nessun utente trovato, creo un utente di test...');
        
        // Crea un utente di test
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);
        
        console.log('Password hashata:', hashedPassword);
        
        await db.execute(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          ['admin', 'admin@example.com', hashedPassword]
        );
        
        console.log('Utente di test creato!');
      } else {
        console.log('Utenti già presenti nel database.');
      }
    }
    
    // Visualizza gli utenti attuali
    const [allUsers] = await db.execute('SELECT id, username, email FROM users');
    console.log('Utenti nel database:');
    console.table(allUsers);
    
    console.log('Verifica del database completata con successo!');
  } catch (error) {
    console.error('ERRORE durante la verifica del database:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabase();