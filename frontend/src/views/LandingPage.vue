<template>
  <div class="min-h-screen flex flex-col">
    <nav class="sticky top-0 z-40 bg-gradient-to-r from-zinc-800 via-indigo-600 to-indigo-700 text-white shadow-lg">
      <div class="container mx-auto px-6 py-4 flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <LogoQueryForge class="h-10 w-10" alt="QueryForge Logo" />
          <span
            class="text-xl font-bold tracking-wide"
            style="font-family: 'Montserrat', sans-serif;"
          >
            QueryForge
          </span>
        </div>
        <!-- Desktop Menu -->
        <div class="hidden md:flex space-x-4">

          <!-- Se autenticato -->
          <RouterLink
            v-if="isAuthenticated"
            to="/playground"
            class="px-4 py-2 bg-white text-indigo-800 rounded-lg hover:bg-gray-200 transition font-medium">
            Vai al Playground
          </RouterLink>

          <!-- Se non autenticato -->
          <template v-else>
            <RouterLink
              to="/login"
              class="px-4 py-2 border border-white rounded-lg hover:bg-white hover:text-indigo-800 transition font-medium">
              Accedi
            </RouterLink>
            <RouterLink
              to="/register"
              class="px-4 py-2 bg-white text-indigo-800 rounded-lg hover:bg-indigo-900 hover:text-white transition font-medium">
              Crea Account
            </RouterLink>
          </template>
        </div>
        <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden p-2 focus:outline-none">
          <MenuIcon v-if="!mobileMenuOpen" class="h-6 w-6 text-white" />
          <XIcon v-else class="h-6 w-6 text-white" />
        </button>
      </div>

      <!-- Mobile Menu -->
      <div v-if="mobileMenuOpen"
           class="absolute top-full left-0 right-0 z-30 md:hidden bg-white dark:bg-gray-800 px-6 py-4 space-y-2 shadow-lg">
        
        <!-- Se autenticato -->
        <RouterLink
            v-if="isAuthenticated"
            to="/playground"
            @click="closeMobileMenu"
            class="block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
            Vai al Playground
        </RouterLink>

        <!-- Se non autenticato -->
        <template v-else>
          <RouterLink
            to="/login"
            @click="closeMobileMenu"
            class="block px-4 py-2 text-indigo-800 dark:text-gray-100 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            Accedi
          </RouterLink>
          <RouterLink
            to="/register"
            @click="closeMobileMenu"
            class="block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
            Crea Account
          </RouterLink>
        </template>
      </div>
    </nav>

    <header class="relative flex-grow flex items-center bg-gray-50 dark:bg-gray-900">
      <div class="absolute inset-0 overflow-hidden">
        <svg class="absolute top-0 left-1/2 transform -translate-x-1/2 opacity-10 w-[120%] h-full fill-indigo-200 dark:fill-indigo-700" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
          <circle cx="400" cy="300" r="400" />
        </svg>
      </div>
      <div class="container mx-auto px-6 py-20 relative z-10 flex flex-col-reverse md:flex-row items-center">
        <div class="w-full md:w-1/2 text-center md:text-left">
          <h1 class="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            <span class="text-indigo-600">SQL</span> è Difficile solo se non hai il Posto Giusto per Fare Pratica.
          </h1>
          <p class="mt-4 text-lg text-gray-700 dark:text-gray-300">
            Database personale e un editor intelligente per sperimentare senza paura. Forgia query complesse, visualizza schemi e impara dai tuoi errori in un ambiente sicuro.
          </p>
          <div class="mt-8">
            <RouterLink
              :to="isAuthenticated ? '/playground' : '/register'"
              class="inline-block px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition font-semibold">
              Inizia a Forgiare (Gratis)
            </RouterLink>
          </div>
        </div>
        <div class="w-full md:w-1/2 mb-12 md:mb-0 flex justify-center">
          <img
            :src="heroImage"
            alt="QueryForge"
            class="w-3/4 max-w-md drop-shadow-2xl hover:scale-105 transition-transform duration-500"
          />
        </div>
      </div>
    </header>

    <!-- Sezione Novità -->
    <section class="bg-gradient-to-r from-emerald-500 to-teal-600 py-6">
      <div class="container mx-auto px-6">
        <div class="flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left">
          <div class="flex items-center space-x-3">
            <span class="text-3xl">🎉</span>
            <div>
              <h3 class="text-white font-bold text-lg md:text-xl">
                QueryForge diventa gratuito!
              </h3>
              <p class="text-emerald-100 text-sm md:text-base">
                Ora è la <strong class="text-white">Course Lab Edition</strong> - lo strumento di pratica SQL ufficiale dell'<strong class="text-white">AF Cloud Academy</strong>. Nessun piano a pagamento, 50 query al giorno per esercitarti liberamente.
              </p>
            </div>
          </div>
          <a 
            href="https://alessioferrari.net/academy/" 
            target="_blank" 
            rel="noopener noreferrer"
            class="inline-flex items-center px-5 py-2.5 bg-white text-emerald-700 rounded-lg shadow hover:shadow-lg transform hover:-translate-y-0.5 transition font-semibold text-sm whitespace-nowrap"
          >
            <span>🚀 Scopri i corsi AWS</span>
            <svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </section>

    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
          Costruito per Te, che tu sia Studente o Professionista.
        </h2>
        <p class="text-lg text-center text-gray-600 dark:text-gray-400 mb-16 max-w-3xl mx-auto">
          Che tu stia preparando un esame o debuggando una query complessa per il lavoro, QueryForge è la tua palestra SQL personale.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <AcademicCapIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Studenti e Neolaureati
              </h4>
              <p class="text-gray-600 dark:text-gray-400">
                Per fare pratica mirata, consolidare la teoria, superare esami e costruire un portfolio di competenze SQL.
              </p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <CodeIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Sviluppatori Software/Web
              </h4>
              <p class="text-gray-600 dark:text-gray-400">
                Per testare query, migliorare l'interazione con i database, ottimizzare performance e debuggare codice SQL.
              </p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <ChartPieIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Analisti Dati e Professionisti BI
              </h4>
              <p class="text-gray-600 dark:text-gray-400">
                Per esplorare dataset, validare query complesse prima dell'uso in produzione e affinare tecniche di estrazione dati.
              </p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <BriefcaseIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Professionisti in Aggiornamento
              </h4>
              <p class="text-gray-600 dark:text-gray-400">
                Per aggiungere rapidamente SQL alle proprie competenze (reskilling) o restare aggiornati sulle best practice (upskilling).
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100">
          Le nostre funzionalità<br />
          <span class="text-indigo-600">Potenziano</span> il tuo apprendimento
        </h2>
        <div class="mt-12 grid gap-10 grid-cols-1 md:grid-cols-2">
          <div class="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center shadow-md hover:shadow-xl transition">
            <TerminalIcon class="mx-auto h-14 w-14 text-indigo-600 group-hover:animate-bounce" />
            <h3 class="mt-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Un Editor che Lavora con Te</h3>
            <p class="mt-3 text-gray-600 dark:text-gray-300">
              Non solo per scrivere codice. Il nostro editor ti aiuta a formattare, completare e analizzare le tue query, permettendoti di concentrarti sulla logica, non sulla sintassi.
            </p>
          </div>
          <div class="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center shadow-md hover:shadow-xl transition">
            <TableIcon class="mx-auto h-14 w-14 text-indigo-600 group-hover:animate-bounce" />
            <h3 class="mt-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Domina il Database, non solo le Query</h3>
            <p class="mt-3 text-gray-600 dark:text-gray-300">
              Non scrivere alla cieca. Il nostro explorer visuale ti permette di navigare tra tabelle e relazioni, per capire davvero la struttura dei dati con cui stai lavorando.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-16">
          Inizia in 3 Semplici Passi
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 text-center">
          <div class="flex flex-col items-center">
            <div class="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full mb-4">
              <UserAddIcon class="h-10 w-10 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              1. Crea il Tuo Account
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Registrati in pochi secondi e ottieni subito accesso al tuo ambiente SQL personale.
            </p>
          </div>

          <div class="flex flex-col items-center">
            <div class="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full mb-4">
              <CodeIcon class="h-10 w-10 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              2. Scrivi ed Esegui Query
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Usa l'editor per dare vita alle tue idee. Testa, sperimenta e vedi i risultati delle tue query in tempo reale.
            </p>
          </div>

          <div class="flex flex-col items-center">
            <div class="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full mb-4">
              <ChartBarIcon class="h-10 w-10 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              3. Analizza e Impara
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Visualizza i dati, comprendi i risultati e affina le tue competenze a ogni query eseguita. La pratica rende perfetti.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-6 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
          Un solo piano...gratuito
        </h2>
        <p class="mt-4 text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
          Esercitati senza pensieri.
        </p>
        <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Nessuna carta di credito richiesta. Nessun costo nascosto.
        </div>
      </div>
      <div class="container mx-auto px-6 mt-10 max-w-lg">
        <div class="relative bg-indigo-50 dark:bg-indigo-900/50 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition border-2 border-indigo-600">

          <h3 class="text-2xl font-semibold text-indigo-700 dark:text-indigo-200">Gratuito</h3>
          <p class="mt-4 text-4xl font-extrabold text-gray-900 dark:text-gray-100">
            €0<span class="text-lg font-medium">/per sempre</span>
          </p>

          <ul class="mt-6 space-y-3 text-gray-700 dark:text-gray-300 text-left">
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Accesso all'Editor SQL</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>50 query al giorno</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Cronologia query</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Database esempio preimpostato</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Sessione database privata</span>
            </li>
          </ul>
          
          <div class="mt-8">
            <RouterLink 
              :to="isAuthenticated ? '/playground' : '/register'" 
              class="block w-full text-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-lg shadow-md hover:shadow-lg transition font-medium"
            >
              {{ isAuthenticated ? 'Vai al Playground' : 'Registrati e inizia gratis' }}
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6 max-w-3xl">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">
          Domande Frequenti (FAQ)
        </h2>

        <div class="space-y-4">
          <details class="group bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Che dialetti SQL sono supportati?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Attualmente, QueryForge si basa esclusivamente su <strong>MySQL</strong> (utilizziamo la versione 8.x). Puoi scrivere ed eseguire query utilizzando la sintassi standard e le funzionalità specifiche di MySQL. Per il momento, ci concentriamo su MySQL per garantire un'esperienza utente stabile e un ambiente di apprendimento coerente.
              </p>
            </div>
          </details>

          <details class="group bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Cosa succede se supero il limite giornaliero?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Se raggiungi il limite giornaliero di 50 query, non potrai eseguirne altre fino alla mezzanotte (ora italiana). Il contatore si resetta automaticamente ogni giorno.
              </p>
            </div>
          </details>

          <details class="group bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Posso cancellare il mio account?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Certamente. Puoi cancellare il tuo account in qualsiasi momento dalla pagina del tuo profilo. Tutti i tuoi dati verranno eliminati in modo permanente.
              </p>
            </div>
          </details>

          <details class="group bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">QueryForge è adatto ai principianti?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Assolutamente sì! QueryForge è pensato come strumento di pratica per i corsi SQL. Troverai un database esempio già pronto per iniziare subito a fare esperimenti senza dover configurare nulla.
              </p>
            </div>
          </details>

        </div>
      </div>
    </section>

    <!-- Sezione AF Cloud Academy -->
    <section class="py-16 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500">
      <div class="container mx-auto px-6">
        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 text-center">
          <div class="flex justify-center mb-4">
            <div class="bg-white/20 p-4 rounded-full">
              <CloudIcon class="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 class="text-2xl md:text-3xl font-bold text-white mb-4">
            Dall'autore di QueryForge
          </h2>
          <p class="text-white/90 text-lg mb-6 max-w-2xl mx-auto">
            Hai imparato SQL? Porta le tue competenze nel Cloud! Sto preparando corsi completi per le <strong>certificazioni AWS</strong>. Inizia il tuo percorso verso il cloud computing.
          </p>
          <a 
            href="https://alessioferrari.net/academy/" 
            target="_blank" 
            rel="noopener noreferrer"
            class="inline-flex items-center px-8 py-4 bg-white text-orange-600 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition font-semibold"
          >
            <span>Scopri AF Cloud Academy</span>
            <svg class="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useMeta } from '@/composables/useMeta.js';
import { useStore } from 'vuex';

import { 
  TerminalIcon, TableIcon, CheckIcon, XIcon, MenuIcon,
  UserAddIcon, CodeIcon, ChartBarIcon,
  AcademicCapIcon, ChartPieIcon, BriefcaseIcon,
  ChevronDownIcon, CloudIcon 
} from '@heroicons/vue/outline';

// Importa l'immagine
import heroImage from '@/assets/images/hero-queryforge-nano.png';
import LogoQueryForge from '@/assets/images/logoQueryForge.svg';

// Setup Meta e SEO 
const baseUrl = import.meta.env.PROD
  ? 'https://queryforge.io'
  : window.location.origin; 

const socialImageUrl = `${baseUrl}/assets/queryforge-social-preview.jpg`;

useMeta({
  title: 'QueryForge - Il Playground SQL per la Pratica Reale',
  description: 'Smetti di studiare solo la teoria. Con QueryForge hai un ambiente SQL personale per fare pratica, sperimentare senza paura e imparare dai tuoi errori. Inizia gratis.',
  image: socialImageUrl,
});

// Accesso allo store e controllo autenticazione
const store = useStore();
const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);

// Stato reattivo
const mobileMenuOpen = ref(false);

// Chiude il menu mobile
const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
};
</script>

<style scoped>
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.group:hover .group-hover\:animate-bounce {
  animation: bounce 1s infinite;
}
</style>