// Modulo auth per Vuex - gestisce lo stato dell'autenticazione
import api from '../../services/api';

// Funzione per decodificare il payload di un JWT
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (error) {
    console.error('Errore nel parsing del token:', error);
    return null;
  }
};

// Funzione per verificare se un token sta per scadere (entro 5 minuti)
const isTokenExpiringSoon = (token, thresholdMinutes = 5) => {
  if (!token) return true;
  
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) return true;
  
  const expiryTime = decoded.exp * 1000; // Converti in millisecondi
  const currentTime = Date.now();
  const timeUntilExpiry = expiryTime - currentTime;
  
  return timeUntilExpiry < (thresholdMinutes * 60 * 1000);
};

export default {
  namespaced: true,
  
  state: {
    token: localStorage.getItem('token') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    user: JSON.parse(localStorage.getItem('user')) || null
  },
  
  getters: {
    token: state => state.token,
    refreshToken: state => state.refreshToken,
    isAuthenticated: state => !!state.token,
    user: state => state.user,
    // Nuovo getter per verificare se il token sta per scadere
    isTokenExpiringSoon: state => isTokenExpiringSoon(state.token)
  },
  
  mutations: {
    SET_TOKEN(state, token) {
      console.log('Mutation SET_TOKEN:', token ? 'token presente' : 'token assente');
      state.token = token;
      localStorage.setItem('token', token);
      // Se il token è nullo, rimuovilo da localStorage
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    },
    
    SET_REFRESH_TOKEN(state, refreshToken) {
      console.log('Mutation SET_REFRESH_TOKEN:', refreshToken ? 'refresh token presente' : 'refresh token assente');
      state.refreshToken = refreshToken;
      
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      } else {
        localStorage.removeItem('refreshToken');
      }
    },
    
    SET_USER(state, user) {
      console.log('Mutation SET_USER:', user);
      state.user = user;
      
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
    }
  },
  
  actions: {
    async login({ commit, dispatch }, credentials) {
      try {
        console.log('Tentativo di login con:', credentials.email);
        
        // Usa l'istanza API personalizzata invece di axios direttamente
        const response = await api.post('/auth/login', credentials);
        
        console.log('Risposta login ricevuta:', response.data);
        
        if (!response.data.accessToken) {
          throw new Error('Token non trovato nella risposta');
        }
        
        // Salva sia access token che refresh token
        commit('SET_TOKEN', response.data.accessToken);
        commit('SET_REFRESH_TOKEN', response.data.refreshToken);
        commit('SET_USER', response.data.user);
        
        try {
          console.log("Dispatching azioni user/fetchProfile  post-login...");
          // Usiamo Promise.all per eseguirle in parallelo (se possibile e desiderato)
          await Promise.all([
              dispatch('user/fetchProfile', null, { root: true }), // Carica profilo completo
          ]);
          console.log("Profilo e limiti caricati con successo dopo il login.");
        } catch (fetchError) {
          // Se il caricamento fallisce qui, il login è comunque avvenuto,
          // ma l'utente potrebbe non vedere i dati corretti. Logga l'errore.
          console.error("Errore nel caricare profilo/limiti dopo il login (l'utente è loggato ma i dati potrebbero mancare):", fetchError);
          // Considera se mostrare un messaggio all'utente qui.
        }
        // ================================================================

        // 3. Login completato
        return response.data;
      } catch (error) {
        console.error('Errore durante il login:', error);
        throw error;
      }
    },
    
    // Aggiornato per supportare l'accettazione dei termini e condizioni
    async register({ commit, dispatch }, userData) {
      try {
        console.log('Tentativo di registrazione con:', userData.email);
        
        // userData ora include anche termsAccepted (boolean)
        if (userData.termsAccepted !== true) {
          throw new Error('È necessario accettare i termini e condizioni per registrarsi');
        }
        
        // Usa l'istanza API personalizzata
        const response = await api.post('/auth/register', userData);
        
        console.log('Risposta registrazione ricevuta:', response.data);
        
        if (response.data.accessToken) {
          commit('SET_TOKEN', response.data.accessToken);
          commit('SET_REFRESH_TOKEN', response.data.refreshToken);
          commit('SET_USER', response.data.user);
          // ====> CARICA DATI UTENTE ANCHE DOPO LA REGISTRAZIONE <====
          try {
            console.log("Dispatching azioni user/fetchProfile post-register...");
            await Promise.all([
                dispatch('user/fetchProfile', null, { root: true }),
            ]);
            console.log("Profilo e limiti caricati con successo dopo la registrazione.");
        } catch (fetchError) {
            console.error("Errore nel caricare profilo/limiti dopo la registrazione:", fetchError);
        }
        }
        
        return response.data;
      } catch (error) {
        console.error('Errore durante la registrazione:', error);
         // Non fare logout qui, l'utente non era loggato
         commit('SET_TOKEN', null);
         commit('SET_REFRESH_TOKEN', null);
         commit('SET_USER', null);
        throw error;
      }
    },
    
    async refreshToken({ commit, state }) {
      try {
        console.log('Tentativo di refresh token');
        
        if (!state.refreshToken) {
          throw new Error('Refresh token non disponibile');
        }
        
        const response = await api.post('/auth/refresh-token', {
          refreshToken: state.refreshToken
        });
        
        console.log('Risposta refresh token ricevuta:', response.data);
        
        if (!response.data.accessToken || !response.data.refreshToken) {
          throw new Error('Token non trovati nella risposta');
        }
        
        // Aggiorna i token
        commit('SET_TOKEN', response.data.accessToken);
        commit('SET_REFRESH_TOKEN', response.data.refreshToken);
        
        return response.data;
      } catch (error) {
        console.error('Errore durante il refresh del token:', error);
        // In caso di errore, esegui logout per sicurezza
        commit('SET_TOKEN', null);
        commit('SET_REFRESH_TOKEN', null);
        commit('SET_USER', null);
        
        throw error;
      }
    },
    
    async logout({ commit, state }) {
      const refreshToken = state.refreshToken;
      try {
        if (refreshToken) {
          await api.post('/auth/logout', { refreshToken: refreshToken });
          console.log('Logout server completato.');
        }
      } catch (error) {
        console.warn('Errore durante il logout sul server (ignoro e continuo logout locale):', error);
      } finally {
        console.log('Pulizia stato locale per logout...');
        
        // Pulisci lo stato di autenticazione
        commit('SET_TOKEN', null);
        commit('SET_REFRESH_TOKEN', null);
        commit('SET_USER', null);

        // Pulisci l'intero profilo utente. Questo è tutto ciò che serve!
        commit('user/SET_PROFILE', null, { root: true });

        console.log('Stato locale pulito.');
      }
    },
    
    // Azione per verificare se il token sta per scadere e rinnovarlo se necessario
    async checkTokenExpiration({ dispatch, getters }) {
      if (getters.isAuthenticated && getters.isTokenExpiringSoon) {
        console.log('Token in scadenza, tentativo di refresh automatico');
        return dispatch('refreshToken');
      }
      return Promise.resolve();
    },
    
    async checkInitialAuth({ commit, dispatch, getters }) {
      const token = getters.token; // Legge dallo stato, che legge da localStorage all'init
      const refreshToken = getters.refreshToken;

      if (!token) {
        return false; // Nessun token, non autenticato
      }

      // Opzionale: controllo scadenza rapida prima di fare chiamata API
      if (isTokenExpiringSoon(token, 1)) { // Controlla se scade tra 1 min
         console.log("Token accesso vicino alla scadenza o scaduto, tentativo di refresh...");
         try {
           await dispatch('refreshToken');
           // Se il refresh ha successo, il nuovo token è nello store
           console.log("Refresh token all'avvio riuscito.");
           // Procedi a caricare i dati con il nuovo token
         } catch (refreshError) {
            console.error("Refresh token all'avvio fallito:", refreshError);
            await dispatch('logout'); // Logout se il refresh fallisce
            return false; // Non autenticato
         }
      }

      // A questo punto dovremmo avere un token di accesso (originale o rinnovato) valido
      // Tentiamo di caricare i dati utente per confermare l'autenticazione
      try {
        // console.log("Token presente, tentativo di caricare dati utente (profilo/limiti)...");
        // Imposta l'header per le prossime chiamate (se non già fatto globalmente dal service api)
        // api.defaults.headers.common['Authorization'] = `Bearer ${getters.token}`;

        // Carica dati in parallelo
        await dispatch('user/fetchProfile', null, { root: true });
        // console.log("Autenticazione iniziale verificata, dati utente caricati.");
        // Assicurati che SET_USER sia stato chiamato da fetchProfile o altrove
        // Se fetchProfile non imposta user in auth.state, fallo qui:
        // commit('SET_USER', store.state.user.profile); // Esempio se user.profile è aggiornato
        return true; // Autenticato con successo

      } catch (error) {
        // Se fetchProfile fallise (es. 401 per token comunque invalido)
        console.error("Token iniziale non valido (fetchProfile fallito):", error);
        await dispatch('logout'); // Effettua il logout
        return false; // Non autenticato
      }
    }
  }
};