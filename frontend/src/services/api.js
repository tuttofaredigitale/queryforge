import axios from 'axios';
import store from '../store';

// 1. Determiniamo il baseURL corretto in base all'ambiente
const getBaseURL = () => {
 if (import.meta.env.DEV) {
  return '/api';
 } else {
  return `${import.meta.env.VITE_API_URL}/api`;
 }
};

const baseURL = getBaseURL();

console.log(`[API Service] Ambiente: ${import.meta.env.MODE}. URL Base API: ${baseURL}`);

const api = axios.create({
 baseURL: baseURL
});

// Variabili per gestire il refresh del token
let isRefreshing = false;
let failedQueue = [];

// Funzione per processare la coda di richieste fallite
const processQueue = (error, token = null) => {
 failedQueue.forEach(prom => {
  if (error) {
   prom.reject(error);
  } else {
   prom.resolve(token);
  }
 });
 failedQueue = [];
};

// Interceptor RICHIESTA (per aggiungere il token)
api.interceptors.request.use(
 (config) => {
  const token = localStorage.getItem('token'); 

  if (token) {
   config.headers.Authorization = `Bearer ${token}`;
      // Impostiamo Content-Type di default se non specificato
   if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
   }
  } 
  return config;
 },
 (error) => {
  console.error('Errore nell\'interceptor della richiesta (api.js):', error);
  return Promise.reject(error);
 }
);


// Interceptor RISPOSTA (Gestisce Successi, Errori e Refresh Token)

api.interceptors.response.use(
  // Gestione SUCCESSO 
 (response) => {
  // Cerca negli header
  const raw = response.headers['authorization'] || response.headers['Authorization'];
  let token = null;
  if (raw && raw.startsWith('Bearer ')) {
   token = raw.slice(7);
  }

  // Se non c'è nell'header, guarda il body (utile per login/register)
  if (!token && response.data?.accessToken) {
   token = response.data.accessToken;
  }

  // Se trovato, salva e aggiorna default headers
  if (token) {
   localStorage.setItem('token', token);
   store.commit('auth/SET_TOKEN', token);
   api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
  return response;
 },

  // Gestione ERRORE (Gestisce 401 e Refresh Token) ---
 async (error) => {
  const originalRequest = error.config;
    
    // Assicuriamoci che originalRequest esista prima di procedere
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Se l'errore è 401 e proviene dal login, non tentare il refresh, passa l'errore al componente.
    if (error.response && error.response.status === 401 && originalRequest.url && originalRequest.url.includes('/auth/login')) {
      console.log('Errore 401 rilevato durante il login. Ignoro refresh.');
      return Promise.reject(error);
    }
  
  // Non ritentare se è una richiesta di refresh token o è già stata ritentata
  if (originalRequest._retry || (originalRequest.url && originalRequest.url.includes('/auth/refresh-token'))) {
   return Promise.reject(error);
  }
  
  // Gestisci errori 401 (token scaduto) per tutti gli altri endpoint
  if (error.response && error.response.status === 401) {
   console.log('Errore 401 rilevato (non login), tentativo di refresh token');
   
   // Se stiamo già facendo refresh, aggiungi questa richiesta alla coda
   if (isRefreshing) {
    return new Promise((resolve, reject) => {
     failedQueue.push({ resolve, reject });
    })
    .then(token => {
     originalRequest.headers['Authorization'] = `Bearer ${token}`;
     return api(originalRequest);
    })
    .catch(err => Promise.reject(err));
   }
   
   // Imposta flag per indicare che stiamo facendo refresh
   originalRequest._retry = true;
   isRefreshing = true;
   
   try {
    // Tenta di rinnovare il token
    await store.dispatch('auth/refreshToken');
    const newToken = localStorage.getItem('token');
    processQueue(null, newToken);
    isRefreshing = false;
    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
    return api(originalRequest);
   } catch (refreshError) {
    // Se il refresh fallisce
    isRefreshing = false;
    processQueue(refreshError, null);
    
    // Esegui logout e reindirizza
    store.dispatch('auth/logout');
    
    // Reindirizza al login
    if (window.router) {
     window.router.push('/login');
    } else {
     window.location.href = '/login';
    }
    
    return Promise.reject(refreshError);
   }
  }
  
  // Per altri errori, ritorna il reject normale
  return Promise.reject(error);
 }
);

// Metodi API specifici 
const apiService = {
 // Metodi per il database
 getDatabaseStructure: () => api.get('/database/structure'),
 
 // Metodo modificato per eseguire query e salvare nella cronologia
 executeQuery: async (query, confirmed = false) => {
  try {
   const response = await api.post('/database/execute', { query, confirmed });
   
   // Salva la query nella cronologia dopo l'esecuzione riuscita
   try {
    await api.post('/query-history', { query });
   } catch (historyError) {
    console.error('Errore nel salvare la query nella cronologia:', historyError);
   }
   
   return response.data;
  } catch (error) {
   // Se c'è un errore nell'esecuzione, salvalo nella cronologia con l'errore
   if (error.response && error.response.status !== 401) { // Non salvare errori di autenticazione
    try {
     const errorMessage = error.response?.data?.message || error.message;
     await api.post('/query-history', { 
      query,
      error: errorMessage
     });
    } catch (historyError) {
     console.error('Errore nel salvare la query con errore nella cronologia:', historyError);
    }
   }
   
   throw error;
  }
 },
 
 resetDatabase: () => api.post('/database/reset'),
 
 // Nuovi metodi per la gestione della cronologia query
 getQueryHistory: (limit = 20, offset = 0) => 
  api.get(`/query-history?limit=${limit}&offset=${offset}`),
 
 deleteQueryFromHistory: (queryId) => 
  api.delete(`/query-history/${queryId}`),
 
 clearQueryHistory: () => 
  api.delete('/query-history')
};

export default api;
export { apiService };