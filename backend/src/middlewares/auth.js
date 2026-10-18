// backend/src/middlewares/auth.js
const jwt = require('jsonwebtoken');
// Assicurati che dotenv sia caricato all'inizio dell'app (es. in server.js o app.js)
require('dotenv').config(); // Non serve qui se già caricato all'avvio

const JWT_SECRET = process.env.JWT_SECRET; // Leggi dal .env

// Funzione middleware di autenticazione con logging aggiunto
const authenticate = (req, res, next) => {
  try {
    // Estrai l'header Authorization
    const authHeader = req.headers.authorization;

    // Verifica presenza e formato header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {

      return res.status(401).json({
        message: 'Autenticazione richiesta. Header Authorization mancante o non valido.'
      });
    }

    // Estrai il token
    const token = authHeader.split(' ')[1];

    // Verifica se il token è stato estratto correttamente
    if (!token) {
      return res.status(401).json({
        message: 'Token di autenticazione mancante'
      });
    }

    // Verifica se JWT_SECRET è definito nell'ambiente
    if (!JWT_SECRET) {
         // Non inviare dettagli interni al client
         return res.status(500).json({ message: 'Errore di configurazione interna del server.' });
    }

    // Verifica e decodifica il token usando il secret dall'ambiente
    const decoded = jwt.verify(token, JWT_SECRET);

    // Aggiungi l'utente decodificato (il payload del token) alla richiesta
    // Il payload di solito contiene { id: ..., role: ..., iat: ..., exp: ... }
    req.user = decoded;

    // Passa alla prossima funzione middleware o al gestore della rotta
    next();

  } catch (error) {
    // Gestisci specifici errori JWT in modo più informativo
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Il token JWT è scaduto.' });
    } else if (error.name === 'JsonWebTokenError') {
      // Questo cattura errori come 'invalid signature', 'jwt malformed', ecc.
      // Il messaggio dell'errore stesso è spesso utile qui
      return res.status(401).json({ message: `Token JWT non valido (${error.message})` });
    } else {
      // Gestisci altri errori imprevisti durante l'autenticazione
      return res.status(401).json({
        message: 'Autenticazione fallita (errore generico).',
        // Mostra il messaggio di errore solo in sviluppo
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

// La funzione requireAdmin rimane invariata
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Accesso negato: è richiesto un ruolo amministrativo'
    });
  }
  next();
};

module.exports = {
  authenticate,
  requireAdmin
};