import api from './api'

// Flag per prevenire richieste multiple di refresh
let isRefreshing = false;
let refreshSubscribers = [];

// Funzione per risolvere le richieste in attesa dopo un refresh riuscito
const onRefreshSuccess = (newToken) => {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
};

// Funzione per rifiutare le richieste in attesa dopo un refresh fallito
const onRefreshFailure = (error) => {
  refreshSubscribers.forEach(callback => callback(Promise.reject(error)));
  refreshSubscribers = [];
};

export default {
  // Metodi esistenti
  login(credentials) {
    // Raccogli informazioni sul dispositivo
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenSize: `${window.screen.width}x${window.screen.height}`
    };

    return api.post('/auth/login', { ...credentials, deviceInfo })
      .then(response => {
        const data = response.data;
        if (data.accessToken && data.refreshToken) {
          // Salva i token nel localStorage
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('tokenTimestamp', Date.now().toString());
        }
        return data;
      });
  },
  
  register(userData) {
    // Raccogli informazioni sul dispositivo
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenSize: `${window.screen.width}x${window.screen.height}`
    };

    return api.post('/auth/register', { ...userData, deviceInfo })
      .then(response => {
        const data = response.data;
        if (data.accessToken && data.refreshToken) {
          // Salva i token nel localStorage
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('tokenTimestamp', Date.now().toString());
        }
        return data;
      });
  },
  
  // Metodo migliorato per refresh token con protezione anti-duplicazione
  refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      return Promise.reject('Refresh token non disponibile');
    }
    
    // Se c'è già un refresh in corso, aggiungi questa richiesta alla coda
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshSubscribers.push(token => {
          if (token) {
            resolve({ accessToken: token });
          } else {
            reject('Refresh token fallito');
          }
        });
      });
    }
    
    // Verifica se c'è stato un refresh recente
    if (this.hasRecentRefresh()) {
      console.log('Refresh token richiesto troppo presto, saltato');
      return Promise.resolve({
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: refreshToken
      });
    }
    
    isRefreshing = true;
    
    // Raccogli informazioni sul dispositivo per il logging
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    };
    
    return api.post('/auth/refresh-token', { refreshToken, deviceInfo })
      .then(response => {
        const data = response.data;
        if (data.accessToken && data.refreshToken) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('tokenTimestamp', Date.now().toString());
          onRefreshSuccess(data.accessToken);
        }
        return data;
      })
      .catch(error => {
        onRefreshFailure(error);
        throw error;
      })
      .finally(() => {
        isRefreshing = false;
      });
  },
  
  logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
    
    const promise = refreshToken 
      ? api.post('/auth/logout', { refreshToken, deviceInfo })
      : Promise.resolve();
    
    return promise.finally(() => {
      // Rimuovi sempre i token, indipendentemente dalla risposta del server
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tokenTimestamp');
    });
  },
  
  // Recupera le sessioni attive dell'utente
  getSessions() {
    return api.get('/auth/sessions');
  },
  
  // Revoca una sessione specifica
  revokeSession(sessionId) {
    return api.post('/auth/revoke-session', { sessionId });
  },
  
  // Metodi utility per i token
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  getAccessToken() {
    return localStorage.getItem('accessToken');
  },
  
  isAuthenticated() {
    return !!this.getAccessToken();
  },
  
  // Decodifica il payload del token JWT
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(window.atob(base64));
    } catch (e) {
      return null;
    }
  },
  
  // Verifica se il token sta per scadere (meno di 5 minuti)
  isTokenExpiringSoon() {
    const token = this.getAccessToken();
    if (!token) return true;
    
    const decoded = this.parseJwt(token);
    if (!decoded || !decoded.exp) return true;
    
    // Calcola il tempo rimanente in millisecondi
    const expiryTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;
    
    // Considera in scadenza se mancano meno di 5 minuti
    return timeUntilExpiry < 5 * 60 * 1000;
  },
  
  // Verifica se l'ultimo refresh è recente
  hasRecentRefresh(thresholdMs = 10000) {
    const timestamp = localStorage.getItem('tokenTimestamp');
    if (!timestamp) return false;
    
    const lastRefresh = parseInt(timestamp, 10);
    return Date.now() - lastRefresh < thresholdMs;
  }
}