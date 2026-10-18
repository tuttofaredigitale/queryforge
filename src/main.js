import { inject } from '@vercel/analytics';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/css/tailwind.css';

// Statistiche anonime di Vercel (funzionano solo quando il sito è pubblicato su Vercel)
if (import.meta.env.PROD) {
  inject();
}

const app = createApp(App);
app.use(router);
app.mount('#app');
