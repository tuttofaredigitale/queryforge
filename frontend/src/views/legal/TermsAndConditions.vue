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

      <p class="lead text-lg text-gray-600 dark:text-gray-400">Benvenuto su QueryForge! Prima di iniziare il tuo percorso per diventare un maestro di SQL, ti preghiamo di leggere attentamente questi Termini e Condizioni ("Termini"). Utilizzando il nostro sito web e i nostri servizi ("Servizio"), accetti di essere vincolato da questi Termini. Se non sei d'accordo, non potrai utilizzare il Servizio.</p>
      
      <h2 id="definizione-servizio">1. Definizione del Servizio</h2>
      <p>QueryForge fornisce una piattaforma online gratuita per l'apprendimento e la pratica del linguaggio SQL (dialetto MySQL). Ogni utente registrato riceve un ambiente di database personale e isolato, pre-caricato con dati di esempio. Il Servizio permette di eseguire query, visualizzare risultati e esplorare lo schema del database.</p>
      <p>QueryForge è lo strumento ufficiale di pratica SQL dell'<a href="https://alessioferrari.net/academy/" target="_blank" rel="noopener noreferrer">AF Cloud Academy</a> e non è destinato all'uso in produzione.</p>

      <h2 id="registrazione-account">2. Registrazione e Gestione dell'Account</h2>
      <p>Per accedere al Servizio, è necessario creare un account fornendo un indirizzo email valido, un username e una password. Sei l'unico responsabile della sicurezza della tua password e di tutte le attività svolte tramite il tuo account.</p>
      <p>Accetti di fornire informazioni accurate e aggiornate durante la registrazione e di aggiornare tempestivamente tali informazioni in caso di modifiche.</p>
      <p>Accetti di notificarci immediatamente qualsiasi uso non autorizzato del tuo account.</p>
      <p>Creando un account, dichiari di avere l'età legale per stipulare un contratto vincolante.</p>

      <h2 id="piano-servizio">3. Piano del Servizio</h2>
      <p>QueryForge è un servizio completamente gratuito. Il piano include:</p>
      <ul>
        <li>Accesso all'editor SQL</li>
        <li>Database personale con dati di esempio</li>
        <li>Cronologia delle query eseguite</li>
        <li>Limite di 50 query giornaliere (reset a mezzanotte)</li>
      </ul>
      <p>I limiti possono essere modificati a nostra discrezione, previa comunicazione agli utenti.</p>

      <h2 id="uso-accettabile">4. Uso Accettabile e Limitazioni</h2>
      <p>Il Servizio è fornito esclusivamente per scopi di apprendimento, pratica e test. È severamente vietato:</p>
      <ul>
        <li>Utilizzare il Servizio per ospitare dati di produzione, dati sensibili, personali o illegali.</li>
        <li>Eseguire query dannose (es. query infinite, uso eccessivo di risorse, tentativi di exploit).</li>
        <li>Accedere a database o dati di altri utenti.</li>
        <li>Tentare di aggirare i limiti di utilizzo del Servizio.</li>
        <li>Utilizzare il Servizio per scopi commerciali non autorizzati.</li>
      </ul>
      <p>Ci riserviamo il diritto di monitorare l'uso e sospendere/chiudere gli account che violino i Termini.</p>

      <h2 id="proprieta-intellettuale">5. Proprietà Intellettuale</h2>
      <p>La piattaforma QueryForge, logo, interfaccia, testi e codice ("Contenuto della Piattaforma") sono di proprietà esclusiva di Alessio Ferrari e protetti da copyright.</p>
      <p>Le query SQL e i dati inseriti dagli utenti ("Contenuto Utente") restano di proprietà dell'utente. Tuttavia, concedi a QueryForge una licenza non esclusiva per memorizzare, elaborare e analizzare (in forma aggregata e anonima) il Contenuto Utente, al fine di migliorare il Servizio.</p>
      <p>È vietato copiare, modificare, distribuire o creare opere derivate dal Contenuto della Piattaforma senza autorizzazione scritta.</p>
      <p>L'utente garantisce di avere i diritti sul Contenuto Utente e si impegna a manlevare QueryForge da qualsiasi reclamo di terzi derivante dall'uso illecito o dalla violazione di diritti.</p>
      
      <h2 id="limitazione-responsabilita">6. Limitazione di Responsabilità e Garanzie</h2>
      <p>Il Servizio è fornito "COSÌ COM'È" e "COME DISPONIBILE", senza garanzie di alcun tipo, esplicite o implicite.</p>
      <p>Non garantiamo che il Servizio sia sempre disponibile, sicuro o privo di errori, né che i dati siano immuni da perdita o attacchi di terzi.</p>
      <p>In nessun caso QueryForge o il suo proprietario potranno essere ritenuti responsabili per danni diretti, indiretti, incidentali o consequenziali derivanti dall'uso o dall'impossibilità di usare il Servizio.</p>
      <p>Essendo un servizio gratuito fornito a scopo didattico, l'utente accetta che non vi sia alcuna aspettativa di disponibilità continua o supporto garantito.</p>

      <h2 id="eliminazione-account">7. Eliminazione dell'Account</h2>
      <p>Puoi richiedere l'eliminazione del tuo account in qualsiasi momento dalla pagina del tuo profilo. L'eliminazione è un'azione PERMANENTE e IRREVERSIBILE: verranno cancellati database, cronologia query e dati personali.</p>
      <p>Ci riserviamo inoltre il diritto di eliminare account inattivi da più di 12 mesi, previa comunicazione via email.</p>

      <h2 id="modifiche-termini">8. Modifiche ai Termini</h2>
      <p>Possiamo modificare i Termini in qualsiasi momento. Le modifiche sostanziali verranno comunicate via email o con avviso in piattaforma con almeno 30 giorni di preavviso.</p>
      <p>L'uso continuato del Servizio dopo la data di efficacia delle modifiche costituisce accettazione dei nuovi Termini. Se non accetti le modifiche, devi cessare l'uso del Servizio e, se desideri, eliminare il tuo account.</p> 

      <h2 id="legge-foro">9. Legge Applicabile e Foro Competente</h2>
      <p>Questi Termini sono regolati dalla legge italiana.</p>
      <ul>
        <li>Per i consumatori: foro competente sarà quello di residenza o domicilio dell'utente.</li>
        <li>Per utenti professionali/aziende: foro esclusivo sarà quello di Verona.</li>
      </ul>

      <h2 id="privacy-protezione-dati">10. Privacy e Protezione Dati</h2>
      <p>Il trattamento dei dati personali avviene in conformità al Regolamento (UE) 2016/679 (GDPR).</p>
      <p>Per maggiori informazioni consulta la nostra <router-link to="/privacy-policy">Privacy Policy</router-link>, parte integrante dei presenti Termini.</p> 

      <h2 id="contatti">11. Contatti</h2>
      <p>Per qualsiasi domanda o richiesta di assistenza fare riferimento:</p>
      <ul>
        <li>Email: <a href="mailto:info&#64;queryforge&#46;io">info&#64;queryforge&#46;io</a></li>
        <li>Indirizzo: Alessio Ferrari, Via Roma 34A, 37128 Roveré Veronese (VR), Italia</li>
      </ul>

      <p class="text-sm text-gray-500 mt-10 pt-4 border-t border-gray-200 dark:border-gray-700/50">
        Ultimo aggiornamento: 30 Dicembre 2025
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