<template>
  <div class="max-w-4xl mx-auto px-4 py-8 sm:py-12">
    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">Termini e Condizioni di Servizio</h1>

    <div class="text-center mb-8">
      <router-link to="/" class="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium inline-flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Torna alla Home
      </router-link>
    </div>

    <div class="prose dark:prose-invert max-w-none">

      <p class="lead text-lg text-gray-600 dark:text-gray-400">Benvenuto su QueryForge! Questi Termini e Condizioni ("Termini") regolano l'uso del sito queryforge.io e dell'ambiente per fare pratica con SQL che offre ("Servizio"), messo a disposizione da Alessio Ferrari ("noi"). Usando il Servizio accetti questi Termini: se non sei d'accordo, ti chiediamo di non utilizzarlo.</p>

      <h2 id="definizione-servizio">1. Il Servizio</h2>
      <p>QueryForge è uno strumento gratuito per imparare e fare pratica con il linguaggio SQL usando la sintassi di MySQL. Offre un editor SQL, un database di esempio, una serie di esercizi e la cronologia delle query eseguite.</p>
      <p>Il database viene creato ed eseguito direttamente nel tuo browser (SQLite, tramite WebAssembly): le query vengono tradotte ed eseguite sul tuo dispositivo, senza passare da un server.</p>
      <p>QueryForge ha scopo didattico e non è pensato per l'uso in produzione. La compatibilità con MySQL non è completa: alcune funzioni, come variabili, procedure e trigger, non sono disponibili, e in qualche caso i risultati possono differire da quelli di un server MySQL.</p>

      <h2 id="accesso-gratuito">2. Accesso Gratuito</h2>
      <p>Il Servizio è gratuito e non richiede registrazione: non serve creare un account e non ci sono limiti al numero di query.</p>

      <h2 id="dati-browser">3. Dati Salvati nel Browser</h2>
      <p>Il database, le query che scrivi e la loro cronologia vengono salvati solo nel browser che stai usando. Non vengono inviati a noi né a terzi: non possiamo vederli né recuperarli.</p>
      <ul>
        <li>Se cancelli i dati di navigazione, usi la navigazione privata o cambi browser o dispositivo, il database e la cronologia possono andare persi.</li>
        <li>Il pulsante <strong>Reset Database</strong> riporta i dati di esempio allo stato iniziale.</li>
        <li>Ti consigliamo di non inserire dati personali reali o informazioni riservate: restano salvati nel browser senza cifratura.</li>
      </ul>

      <h2 id="open-source">4. Codice Open Source</h2>
      <p>Il codice sorgente di QueryForge è pubblicato su <a href="https://github.com/tuttofaredigitale/queryforge" target="_blank" rel="noopener noreferrer">GitHub</a> con licenza MIT: puoi usarlo, studiarlo, modificarlo e ridistribuirlo alle condizioni di quella licenza. La licenza MIT regola l'uso del codice, questi Termini regolano l'uso del sito queryforge.io.</p>
      <p>Il nome QueryForge e il logo identificano questo sito: chi pubblica una versione modificata non deve presentarla come il sito ufficiale.</p>

      <h2 id="uso-accettabile">5. Uso Consentito</h2>
      <p>Puoi usare il Servizio liberamente per imparare, fare pratica e insegnare SQL. Non è consentito usarlo per attività illecite, né tentare di comprometterne il funzionamento o la sicurezza.</p>

      <h2 id="limitazione-responsabilita">6. Garanzie e Limitazione di Responsabilità</h2>
      <p>Il Servizio è fornito "così com'è" e "come disponibile", senza garanzie di alcun tipo, esplicite o implicite. Non garantiamo che sia sempre disponibile o privo di errori, né che i risultati delle query coincidano con quelli di MySQL.</p>
      <p>Nei limiti consentiti dalla legge, non siamo responsabili dei danni, diretti o indiretti, derivanti dall'uso del Servizio o dall'impossibilità di usarlo, compresa la perdita dei dati salvati nel browser. Restano salvi i diritti che la legge riconosce ai consumatori.</p>

      <h2 id="privacy-protezione-dati">7. Privacy e Cookie</h2>
      <p>Per usare QueryForge non devi fornirci dati personali. I dati eventualmente raccolti durante la navigazione, per esempio a fini statistici, sono trattati secondo il Regolamento (UE) 2016/679 (GDPR) e sono descritti nella <a href="https://www.iubenda.com/privacy-policy/57193797" target="_blank" rel="noopener noreferrer">Privacy Policy</a> e nella <a href="https://www.iubenda.com/privacy-policy/57193797/cookie-policy" target="_blank" rel="noopener noreferrer">Cookie Policy</a>, che fanno parte di questi Termini.</p>

      <h2 id="modifiche-termini">8. Modifiche ai Termini</h2>
      <p>Possiamo aggiornare questi Termini, per esempio quando il Servizio cambia. La versione in vigore è quella pubblicata su questa pagina, con la data dell'ultimo aggiornamento indicata in fondo. Se continui a usare il Servizio dopo una modifica, accetti i nuovi Termini.</p>

      <h2 id="legge-foro">9. Legge Applicabile e Foro Competente</h2>
      <p>Questi Termini sono regolati dalla legge italiana.</p>
      <ul>
        <li>Per i consumatori, il foro competente è quello del luogo di residenza o domicilio dell'utente.</li>
        <li>Per i professionisti e le aziende, il foro competente esclusivo è quello di Verona.</li>
      </ul>

      <h2 id="contatti">10. Contatti</h2>
      <p>Per domande su questi Termini o sul Servizio puoi scriverci:</p>
      <ul>
        <li>Email: <a href="mailto:info&#64;queryforge&#46;io">info&#64;queryforge&#46;io</a></li>
        <li>Indirizzo: Alessio Ferrari, Via Roma 34/A, 37028 Roverè Veronese (VR), Italia</li>
        <li>P.IVA: 05180750233</li>
      </ul>

      <p class="text-sm text-gray-500 mt-10 pt-4 border-t border-gray-200 dark:border-gray-700/50">
        Ultimo aggiornamento: 18 ottobre 2026
      </p>

      <div class="text-center mt-8">
        <router-link to="/" class="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Torna alla Home
        </router-link>
      </div>

    </div>
  </div>
</template>

<script>
export default {
  name: 'TermsAndConditions'
}
</script>

<style scoped>
.prose h2 {
  @apply text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-8 mb-4;
}

.prose p {
  @apply leading-relaxed mb-4;
}

.prose ul {
  @apply list-disc list-inside space-y-2 mb-4 pl-2;
}

.prose ul li {
  @apply ml-4;
}

.prose a {
  @apply text-indigo-600 dark:text-indigo-400 hover:underline;
}

.prose strong {
  @apply font-semibold text-gray-800 dark:text-gray-200;
}
</style>
