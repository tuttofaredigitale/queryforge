<template>
  <div class="w-full tab-content-wrapper">
    <div class="bg-white rounded-md shadow-sm mb-4 dark:bg-gray-800 dark:border dark:border-gray-700">
      <div class="border-b px-3 sm:px-4 py-2 bg-gray-50 flex justify-between items-center dark:bg-gray-700 dark:border-gray-600">
        <h3 class="text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-200 text-sm sm:text-base">Cronologia Query</h3>
        <div class="flex space-x-2">
          <!-- Pulsante aggiorna: solo icona su mobile, icona + testo su desktop -->
          <button
            @click="refreshHistory"
            class="p-1.5 sm:px-2 sm:py-1 flex items-center text-indigo-600 hover:bg-indigo-50 rounded-md sm:rounded transition-colors dark:text-indigo-400 dark:hover:bg-gray-600"
            title="Aggiorna cronologia"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="hidden sm:inline ml-1 text-xs">Aggiorna</span>
          </button>

          <!-- Pulsante cancella: solo icona su mobile, icona + testo su desktop -->
          <button
            @click="confirmClearHistory"
            :disabled="queryHistory.length === 0"
            class="p-1.5 sm:px-2 sm:py-1 flex items-center text-red-600 hover:bg-red-50 rounded-md sm:rounded transition-colors dark:text-red-400 dark:hover:bg-red-900/30"
            title="Cancella tutta la cronologia"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span class="hidden sm:inline ml-1 text-xs">Cancella</span>
          </button>

          <!-- Modal di conferma cancellazione ottimizzato per mobile -->
          <div v-if="showClearConfirmation" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full dark:bg-gray-800 dark:text-gray-200">
              <h3 class="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 dark:text-gray-200">Conferma cancellazione</h3>
              <p class="text-sm text-gray-700 mb-4 dark:text-gray-300">
                Sei sicuro di voler cancellare tutta la cronologia delle query? Questa operazione non può essere annullata.
              </p>
              <div class="flex justify-end space-x-3">
                <button
                  @click="showClearConfirmation = false"
                  class="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Annulla
                </button>
                <button
                  @click="clearHistory"
                  class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition flex items-center text-sm"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="p-3 sm:p-4">
        <!-- Nessuna query nella cronologia -->
        <div v-if="queryHistory.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Nessuna query nella cronologia.</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">Esegui qualche query nell'editor per vederla qui.</p>
        </div>

        <!-- Lista cronologia query -->
        <div v-else class="space-y-2 max-h-[70dvh] overflow-y-auto">
          <div
            v-for="item in queryHistory"
            :key="item.id"
            class="border rounded-md p-2 sm:p-3 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700/50"
            :class="{
              'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30': item.error,
              'dark:border-gray-700': !item.error
            }"
          >
            <!-- Header con data e pulsanti -->
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatDateShort(item.executed_at) }}
              </span>
              <div class="flex space-x-1 sm:space-x-2">
                <!-- Pulsanti di azione con icone più grandi su mobile -->
                <button
                  @click="loadQuery(item.query)"
                  class="p-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-800/70"
                  title="Carica nell'editor"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  @click="runQuery(item.query)"
                  class="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-800/70"
                  title="Esegui query"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Query content -->
            <div class="text-xs sm:text-sm font-mono bg-gray-100 p-2 rounded-md overflow-x-auto dark:bg-gray-700 dark:text-gray-200">
              {{ truncateQuery(item.query) }}
            </div>

            <!-- Messaggi di errore -->
            <div v-if="item.error" class="mt-2 text-xs text-red-600 dark:text-red-400">
              <span class="font-medium">Errore:</span> {{ truncateError(item.error) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { getQueryHistory, clearQueryHistory } from '@/services/queryHistory.js';

export default {
  props: {
    refreshTrigger: {
      type: Number,
      default: 0
    }
  },
  emits: ['load-query', 'run-query', 'show-toast'],
  setup(props, { emit }) {
    const queryHistory = ref([]);

    // La cronologia è salvata nel browser
    const refreshHistory = () => {
      queryHistory.value = getQueryHistory();
    };

    // Formatta la data - versione breve per mobile
    const formatDateShort = (dateString) => {
      try {
        const date = new Date(dateString);
        // Formattazione più compatta per mobile
        return date.toLocaleString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (err) {
        return dateString || 'N/A';
      }
    };

    // Tronca la query se troppo lunga - più breve su mobile
    const truncateQuery = (query) => {
      if (!query) return 'Query non disponibile';

      // Rileva se siamo su mobile (approssimazione)
      const isMobile = window.innerWidth < 640;
      const maxLength = isMobile ? 100 : 150;

      if (query.length > maxLength) {
        return query.substring(0, maxLength) + '...';
      }
      return query;
    };

    // Tronca l'errore se troppo lungo (mostra solo la prima riga)
    const truncateError = (errorText) => {
      if (!errorText) return '';
      const firstLine = errorText.split('\n')[0];

      // Rileva se siamo su mobile (approssimazione)
      const isMobile = window.innerWidth < 640;
      const maxLength = isMobile ? 60 : 100;

      if (firstLine.length > maxLength) {
        return firstLine.substring(0, maxLength) + '...';
      }
      return firstLine;
    };

    // Carica la query nell'editor
    const loadQuery = (queryText) => {
      emit('load-query', queryText);
      emit('show-toast', 'Query caricata nell\'editor', 'info');
    };

    // Esegui la query
    const runQuery = (queryText) => {
      emit('run-query', queryText);
      emit('show-toast', 'Esecuzione query in corso...', 'info');
    };

    onMounted(refreshHistory);
    watch(() => props.refreshTrigger, refreshHistory);

    const showClearConfirmation = ref(false);

    // Funzione per mostrare la conferma di cancellazione
    const confirmClearHistory = () => {
      showClearConfirmation.value = true;
    };

    // Funzione per cancellare tutta la cronologia
    const clearHistory = () => {
      clearQueryHistory();
      queryHistory.value = [];
      showClearConfirmation.value = false;
      emit('show-toast', 'Cronologia cancellata con successo', 'success');
    };

    return {
      queryHistory,
      refreshHistory,
      formatDateShort,
      truncateQuery,
      truncateError,
      loadQuery,
      runQuery,
      showClearConfirmation,
      confirmClearHistory,
      clearHistory
    };
  }
}
</script>

<style>
/* Migliora la visualizzazione della scrollbar su mobile */
.overflow-x-auto::-webkit-scrollbar {
  height: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}

@media (max-width: 640px) {
  .max-h-96 {
    max-height: 80vh; /* Aumenta l'altezza massima su mobile per una migliore usabilità */
  }
}
</style>
