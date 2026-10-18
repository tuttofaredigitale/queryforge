<!-- File: src/components/common/SecurityGuidelinesModal.vue -->
<template>
  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="transform opacity-0 scale-95"
    enter-to-class="transform opacity-100 scale-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="transform opacity-100 scale-100"
    leave-to-class="transform opacity-0 scale-95"
  >
    <div v-if="show" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
      <div 
        class="bg-white rounded-lg shadow-xl max-w-2xl w-full dark:bg-gray-800 dark:text-gray-200 flex flex-col" 
        style="max-height: 90vh;"
      >
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Comandi da usare con attenzione</span>
          </h3>
          <button @click="$emit('close')" class="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="p-6 flex-grow overflow-y-auto prose prose-sm sm:prose-base dark:prose-invert max-w-none">
          <p>
            Il database di QueryForge gira nel tuo browser: è solo tuo e nessuna query può danneggiare altri utenti.
            Alcune operazioni però non si possono annullare, quindi ti chiediamo una conferma prima di eseguirle.
          </p>
          <br>
          <h4><strong>⚠️ COMANDI CHE RICHIEDONO CONFERMA</strong></h4>
          <ul>
            <li><strong>DROP TABLE / DROP VIEW:</strong> l'eliminazione di una tabella è definitiva.</li>
            <li><strong>TRUNCATE:</strong> svuota la tabella in un colpo solo.</li>
            <li><strong>DELETE senza WHERE:</strong> cancellerebbe tutte le righe della tabella.</li>
            <li><strong>UPDATE senza WHERE:</strong> modificherebbe tutte le righe della tabella.</li>
            <li><strong>ALTER TABLE:</strong> cambiare la struttura di una tabella può far perdere dati.</li>
          </ul>
          <br>
          <h4><strong>🚫 NON DISPONIBILI NEL BROWSER</strong></h4>
          <ul>
            <li><strong>Variabili</strong> (<code>@nome</code>), <strong>procedure, funzioni e trigger</strong>.</li>
            <li><strong>Utenti e permessi</strong> (<code>CREATE USER</code>, <code>GRANT</code>): sei l'unico utente.</li>
            <li><strong>information_schema</strong>: usa <code>SHOW TABLES</code> e <code>DESCRIBE tabella</code>.</li>
            <li><strong>Lettura e scrittura di file</strong> (<code>LOAD DATA</code>, <code>INTO OUTFILE</code>).</li>
          </ul>
          <br>
          <h4><strong>💡 CONSIGLIO</strong></h4>
          <p>
            Usa sempre la clausola <strong>WHERE</strong> con <code>UPDATE</code> e <code>DELETE</code>.
            Se qualcosa va storto, il pulsante <strong>Reset Database</strong> riporta i dati di esempio allo stato iniziale.
          </p>
        </div>

        <div class="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button @click="$emit('close')" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Ho capito
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  props: {
    show: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['close'],
};
</script>