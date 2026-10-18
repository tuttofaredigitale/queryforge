import store from '../store';

// Intervallo per il controllo del token (5 minuti)
const CHECK_INTERVAL = 5 * 60 * 1000;
// Tempo minimo tra i refresh consecutivi (10 secondi)
const MIN_REFRESH_INTERVAL = 10 * 1000;

export default {
  install(app) {
    let tokenCheckInterval = null;
    let lastRefreshAttempt = 0;
    
    // Funzione per verificare il token
    const checkToken = async () => {
      if (store.getters['auth/isAuthenticated']) {
        try {
          const now = Date.now();
          // Previeni refresh troppo frequenti
          if (now - lastRefreshAttempt < MIN_REFRESH_INTERVAL) {
            console.log('Refresh saltato - tentativo troppo recente');
            return;
          }
          
          lastRefreshAttempt = now;
          // Verifica se il token sta per scadere e, se necessario, rinnovalo
          await store.dispatch('auth/checkTokenExpiration');
        } catch (error) {
          console.error('Errore durante il controllo/refresh del token:', error);
          
          // Se l'errore è critico (es. refresh token non valido), effettua il logout
          if (error.response && 
              (error.response.status === 401 || error.response.status === 403)) {
            console.warn('Sessione non valida, logout forzato');
            store.dispatch('auth/logout');
          }
        }
      }
    };
    
    // Avvia il controllo periodico
    const startTokenCheck = () => {
      // Pulisci eventuali intervalli precedenti
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
      }
      
      // Esegui un controllo immediato
      checkToken();
      
      // Imposta l'intervallo per i controlli successivi
      tokenCheckInterval = setInterval(checkToken, CHECK_INTERVAL);
      console.log('Controllo periodico token avviato');
    };
    
    // Ferma il controllo periodico
    const stopTokenCheck = () => {
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
        tokenCheckInterval = null;
        console.log('Controllo periodico token fermato');
      }
    };
    
    // Riavvia il controllo (utile dopo lunghi periodi di inattività)
    const restartTokenCheck = () => {
      stopTokenCheck();
      startTokenCheck();
    };
    
    // Gestione degli eventi di visibilità della pagina
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // L'utente è tornato alla pagina, controlla subito il token
        console.log('Pagina tornata visibile, controllo token');
        checkToken();
      }
    });
    
    // Avvia il controllo all'inizializzazione dell'app
    startTokenCheck();
    
    // Aggiungi metodi all'istanza dell'app
    app.config.globalProperties.$tokenChecker = {
      check: checkToken,
      start: startTokenCheck,
      stop: stopTokenCheck,
      restart: restartTokenCheck
    };
    
    // Pulisci quando l'app viene smontata
    const originalUnmount = app.unmount;
    app.unmount = function() {
      stopTokenCheck();
      document.removeEventListener('visibilitychange', checkToken);
      return originalUnmount.call(this);
    };
  }
};