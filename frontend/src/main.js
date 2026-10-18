import { inject } from '@vercel/analytics';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store'; // Il tuo store Vuex configurato con i moduli
import axios from 'axios'; // Importa axios base
import './assets/css/tailwind.css'; 
// import tokenChecker from './plugins/tokenChecker'; // Valuta se ti serve ancora dopo aver aggiunto checkInitialAuth

// Configurazione globale di axios base (OK)
axios.defaults.baseURL = '/api';
axios.defaults.headers.common['Content-Type'] = 'application/json';

import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';

inject();

// ====> 1. AGGIUNTA INTERCEPTOR PER IL TOKEN JWT <====
// Questo interceptor viene eseguito PRIMA di ogni richiesta Axios
axios.interceptors.request.use(
  config => {
    // Recupera il token dallo store Vuex (assumendo che sia già inizializzato da localStorage)
    const token = store.getters['auth/token']; // Usa il getter che abbiamo definito
    console.log('[Axios Request Interceptor] Token:', token ? 'Presente' : 'Assente');

    // Log di Debug (puoi rimuoverlo in produzione)
    console.log('[Axios Request Interceptor] Token:', token ? 'Presente' : 'Assente', '- URL:', config.url);

    // Se esiste un token, aggiungilo all'header Authorization per le API protette
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('[Axios Request Interceptor] Header Authorization impostato.');
    } else {
       console.log('[Axios Request Interceptor] Header Authorization NON impostato (no token).');
      // Non è necessario rimuovere l'header se non c'è token,
      // ma assicurati che non ci siano token vecchi se usi un wrapper API più complesso.
    }

    // Log richiesta in uscita (come prima, ma logga anche gli header per verifica)
    console.log('Richiesta in uscita (Axios):', {
      url: config.url,
      method: config.method,
      headers: config.headers // Controlla se Authorization è presente qui
    });

    return config; // Continua con la richiesta (modificata o meno)
  },
  error => {
    // Gestisce errori nella configurazione della richiesta
    console.error('Errore nell\'interceptor di richiesta Axios:', error);
    return Promise.reject(error);
  }
);

// Interceptor di Risposta (invariato, per ora solo logging)
// Qui potresti aggiungere logica per gestire errori 401 globalmente in futuro (es. refresh token)
axios.interceptors.response.use(
  response => {
    console.log('Risposta ricevuta (Axios):', { /* ... log ... */ });
    return response;
  },
  error => {
    console.error('Errore nella risposta (Axios):', { /* ... log ... */ });
     // Esempio gestione 401 qui (opzionale, potresti volerlo fare a livello di chiamata API)
     // if (error.response && error.response.status === 401) {
     //   console.warn("Errore 401 rilevato globalmente! Potrebbe essere necessario il logout.");
     //   // Non chiamare logout direttamente qui per evitare loop, gestisci nel componente/azione che ha fallito
     // }
    return Promise.reject(error); // Rilancia sempre l'errore
  }
);

// Crea l'applicazione Vue (invariato)
const app = createApp(App);

// Usa i plugin (invariato)
app.use(store);
app.use(router);

app.use(Toast, {
  position: 'top-right',
  timeout: 3000
});

// Chiama l'azione 'checkInitialAuth' che abbiamo definito nel modulo 'auth.js'
store.dispatch('auth/checkInitialAuth')
  .then((isAuthenticated) => {
    // Questa parte viene eseguita DOPO che checkInitialAuth ha finito
    // (e potenzialmente caricato profilo e limiti se l'utente era autenticato)
    // console.log(`[main.js] Check iniziale auth completato. Utente autenticato: ${isAuthenticated}`);

    // Ora che lo store è (potenzialmente) aggiornato, MONTA L'APP
    app.mount('#app');
    //console.log('[main.js] Applicazione Vue montata.');

  })
  .catch(err => {
    // Questo catch gestisce solo errori critici nell'esecuzione di checkInitialAuth stesso
    // (molto improbabile se l'azione gestisce i propri errori interni).
    console.error("[main.js] Errore critico durante il check auth iniziale (impossibile continuare?):", err);

    // Decidi se montare comunque l'app (probabilmente sì, per mostrare almeno la pagina di login)
    console.warn('[main.js] Montaggio dell\'app nonostante errore nel check auth.');
    app.mount('#app');
  });