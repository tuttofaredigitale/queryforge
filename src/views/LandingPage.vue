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
          <RouterLink
            to="/playground"
            class="px-4 py-2 bg-white text-indigo-800 rounded-lg hover:bg-gray-200 transition font-medium">
            Apri il Playground
          </RouterLink>
        </div>
        <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden p-2 focus:outline-none">
          <MenuIcon v-if="!mobileMenuOpen" class="h-6 w-6 text-white" />
          <XIcon v-else class="h-6 w-6 text-white" />
        </button>
      </div>

      <!-- Mobile Menu -->
      <div v-if="mobileMenuOpen"
           class="absolute top-full left-0 right-0 z-30 md:hidden bg-white dark:bg-gray-800 px-6 py-4 space-y-2 shadow-lg">

        <RouterLink
            to="/playground"
            @click="closeMobileMenu"
            class="block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
            Apri il Playground
        </RouterLink>
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
            QueryForge è il playground gratuito per fare pratica con SQL: un database di esempio già pronto, 31 esercizi guidati e un editor dove sperimentare senza paura. Tutto nel tuo browser, senza installare niente.
          </p>
          <div class="mt-8">
            <RouterLink
              to="/playground"
              class="inline-block px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition font-semibold">
              Inizia a Forgiare (Gratis)
            </RouterLink>
            <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Niente registrazione, nessun limite di query.</p>
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
                QueryForge ora è gratuito per tutti e open source!
              </h3>
              <p class="text-emerald-100 text-sm md:text-base">
                Niente più account né limiti di query: il database gira direttamente nel tuo browser e il codice è libero, con licenza MIT.
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="scrollToHowItWorks"
            class="inline-flex items-center px-5 py-2.5 bg-white text-emerald-700 rounded-lg shadow hover:shadow-lg transform hover:-translate-y-0.5 transition font-semibold text-sm whitespace-nowrap"
          >
            <span>Scopri come funziona</span>
            <ArrowDownIcon class="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>
    </section>

    <!-- Il playground -->
    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
          Tutto in una schermata
        </h2>
        <p class="text-lg text-center text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto">
          Le tabelle a sinistra, l'editor al centro, gli esercizi accanto. Scrivi la query, premi Esegui e vedi subito il risultato.
        </p>
        <img
          :src="playgroundImage"
          width="2432"
          height="1600"
          loading="lazy"
          alt="Il playground di QueryForge: le tabelle del database, una query con JOIN e GROUP BY, i risultati e un esercizio guidato"
          class="w-full h-auto max-w-6xl mx-auto rounded-xl shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10"
        />
      </div>
    </section>

    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
          Per chi vuole imparare SQL facendo pratica
        </h2>
        <p class="text-lg text-center text-gray-600 dark:text-gray-400 mb-16 max-w-3xl mx-auto">
          Che tu stia preparando un esame, seguendo un corso o ripassando prima di un colloquio, QueryForge è la tua palestra SQL.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <AcademicCapIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Studenti
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Per preparare esami e verifiche mettendo subito in pratica la teoria, una query alla volta.
              </p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <BookOpenIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Chi parte da zero
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Per chi impara da solo o sta cambiando lavoro: ogni esempio di un libro, un video o un corso lo provi su un database vero, già pronto.
              </p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <CodeIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Sviluppatori
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Per ripassare JOIN, GROUP BY e subquery prima di un colloquio o di un progetto, senza installare un server.
              </p>
            </div>
          </div>

          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 mt-1">
              <UserGroupIcon class="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Docenti e formatori
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Per far esercitare una classe senza installazioni né account: basta condividere un link.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100">
          Tutto quello che serve<br />
          per <span class="text-indigo-600">fare pratica</span>
        </h2>
        <div class="mt-12 grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="group bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center shadow-md hover:shadow-xl transition"
          >
            <component :is="feature.icon" class="mx-auto h-12 w-12 text-indigo-600 group-hover:animate-bounce" />
            <h3 class="mt-6 text-xl font-semibold text-gray-900 dark:text-gray-100">{{ feature.title }}</h3>
            <p class="mt-3 text-gray-600 dark:text-gray-300">{{ feature.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Come funziona: SQLite nel browser, sintassi MySQL -->
    <section id="come-funziona" class="scroll-mt-20 py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6 max-w-5xl">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
          Come funziona
        </h2>
        <p class="text-lg text-center text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto">
          Per funzionare senza server, QueryForge usa <strong class="text-gray-900 dark:text-gray-100">SQLite</strong>, un vero database relazionale che gira direttamente nel browser. Tu però scrivi le query con la sintassi di <strong class="text-gray-900 dark:text-gray-100">MySQL</strong>: QueryForge le traduce al volo.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 text-center">
          <div>
            <div class="inline-flex bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full mb-3">
              <GlobeIcon class="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">Niente da installare</h3>
            <p class="text-gray-600 dark:text-gray-400">Apri la pagina e il database è già lì, anche su tablet e telefono.</p>
          </div>
          <div>
            <div class="inline-flex bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full mb-3">
              <LockClosedIcon class="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">I tuoi dati restano con te</h3>
            <p class="text-gray-600 dark:text-gray-400">Database e cronologia sono salvati nel tuo browser, non su un server.</p>
          </div>
          <div>
            <div class="inline-flex bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full mb-3">
              <CodeIcon class="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">Scrivi come in MySQL</h3>
            <p class="text-gray-600 dark:text-gray-400">DATE_FORMAT, AUTO_INCREMENT, ENUM e LIMIT funzionano come te li aspetti.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Funziona come in MySQL</h3>
            <ul class="space-y-2 text-gray-700 dark:text-gray-300">
              <li v-for="item in supported" :key="item" class="flex items-start">
                <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Non disponibile nel browser</h3>
            <ul class="space-y-2 text-gray-700 dark:text-gray-300">
              <li v-for="item in unsupported" :key="item" class="flex items-start">
                <XIcon class="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-8 bg-indigo-50 dark:bg-indigo-900/40 border-l-4 border-indigo-600 rounded-r-xl p-6">
          <p class="text-gray-800 dark:text-gray-200 leading-relaxed">
            <strong>Per imparare le basi di SQL è l'ideale.</strong> Le query che impari a scrivere qui sono le stesse che userai con MySQL. Quando ti serviranno procedure, trigger o la gestione degli utenti, sarà il momento di passare a un server MySQL vero.
          </p>
        </div>
      </div>
    </section>

    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-6">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-16">
          Inizia in 3 passi
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 text-center">
          <div class="flex flex-col items-center">
            <div class="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full mb-4">
              <LightningBoltIcon class="h-10 w-10 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              1. Apri il Playground
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Nessuna registrazione e niente da installare: il database di esempio si crea nel tuo browser.
            </p>
          </div>

          <div class="flex flex-col items-center">
            <div class="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full mb-4">
              <CodeIcon class="h-10 w-10 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              2. Scrivi ed esegui query
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Parti da un esercizio o da una query pronta, modificala e guarda subito il risultato.
            </p>
          </div>

          <div class="flex flex-col items-center">
            <div class="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-full mb-4">
              <ChartBarIcon class="h-10 w-10 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              3. Sbaglia, correggi, impara
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Leggi l'errore, sistema la query e riprova. Se qualcosa va storto, Reset Database ti riporta al punto di partenza.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
          Gratuito e open source
        </h2>
        <p class="mt-4 text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
          QueryForge è gratis per tutti: niente account, niente abbonamenti, nessun limite di query.
        </p>
        <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Il codice è pubblico su <a href="https://github.com/tuttofaredigitale/queryforge" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">GitHub</a>, con licenza MIT.
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
              <span>31 esercizi guidati con soluzioni</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Query illimitate</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Database di esempio, ripristinabile in un clic</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Cronologia ed esportazione dei risultati</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Nessun account: i tuoi dati restano nel tuo browser</span>
            </li>
            <li class="flex items-start">
              <CheckIcon class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1"/>
              <span>Codice open source con licenza MIT</span>
            </li>
          </ul>

          <div class="mt-8">
            <RouterLink
              to="/playground"
              class="block w-full text-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-lg shadow-md hover:shadow-lg transition font-medium"
            >
              Apri il Playground
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-6 max-w-3xl">
        <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">
          Domande Frequenti (FAQ)
        </h2>

        <div class="space-y-4">
          <details class="group bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">È davvero gratis?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Sì. Non ci sono account, abbonamenti o limiti di query: apri il playground e inizi. QueryForge non ha un server da mantenere, ed è anche per questo che può essere gratuito per tutti.
              </p>
            </div>
          </details>

          <details class="group bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Perché usa SQLite e non MySQL?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Per esigenze tecniche: SQLite può girare direttamente nel browser, mentre MySQL ha bisogno di un server. Tu però scrivi le query con la sintassi di <strong>MySQL 8</strong>, che QueryForge traduce automaticamente: SELECT, JOIN, subquery, funzioni su date e stringhe, CREATE e ALTER TABLE funzionano come in MySQL. Mancano solo alcune funzioni avanzate, come variabili, procedure e trigger.
              </p>
            </div>
          </details>

          <details class="group bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">QueryForge è adatto ai principianti?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Sì. Il database è già pronto e gli esercizi partono da zero: ognuno ha la spiegazione del concetto, un suggerimento e la soluzione. Non devi configurare nulla.
              </p>
            </div>
          </details>

          <details class="group bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Dove vengono salvati i miei dati?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Solo nel tuo browser. Non ci sono account né server: il database e la cronologia delle query restano su questo dispositivo. Se usi un altro browser o cancelli i dati del sito ripartirai dal database di esempio, che puoi ripristinare in qualsiasi momento con «Reset Database».
              </p>
            </div>
          </details>

          <details class="group bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Posso usarlo con i miei studenti?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Certo. Non servono account né installazioni: basta condividere il link e ognuno lavora nel proprio browser, con la propria copia del database.
              </p>
            </div>
          </details>

          <details class="group bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <summary class="flex justify-between items-center p-4 cursor-pointer list-none">
              <span class="font-medium text-gray-900 dark:text-gray-100">Posso usarlo sul mio computer?</span>
              <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p class="text-gray-600 dark:text-gray-400">
                Sì. QueryForge è open source (licenza MIT): scarica il codice da <a href="https://github.com/tuttofaredigitale/queryforge" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline">GitHub</a>, esegui <code>npm install</code> e <code>npm run dev</code> e si apre nel browser. Non serve installare MySQL.
              </p>
            </div>
          </details>

        </div>
      </div>
    </section>

    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="container mx-auto px-6">
        <div class="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-12 md:p-14 text-center shadow-xl">
          <h2 class="text-3xl md:text-4xl font-bold text-white">
            La pratica rende perfetti
          </h2>
          <p class="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
            Il database ti aspetta: apri il playground e scrivi la tua prima query. È gratis e non devi registrarti.
          </p>
          <RouterLink
            to="/playground"
            class="mt-8 inline-block px-8 py-4 bg-white text-indigo-700 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition font-semibold">
            Apri il Playground
          </RouterLink>
        </div>

        <!-- Iscrizione alle novità: il modulo è ospitato da Brevo, sul sito c'è solo il link -->
        <div class="max-w-4xl mx-auto mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div class="flex-shrink-0 bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
            <MailIcon class="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div class="flex-grow">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Resta aggiornato</h3>
            <p class="mt-1 text-gray-600 dark:text-gray-400">
              Ti scrivo solo quando aggiungo nuovi esercizi o novità a QueryForge, poche volte l'anno.
            </p>
          </div>
          <a
            :href="newsletterUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-shrink-0 inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-semibold whitespace-nowrap"
          >
            Iscriviti alle novità
            <ExternalLinkIcon class="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useMeta } from '@/composables/useMeta.js';

import {
  CheckIcon, XIcon, MenuIcon, ArrowDownIcon, ChevronDownIcon,
  LightningBoltIcon, CodeIcon, ChartBarIcon,
  AcademicCapIcon, BookOpenIcon, UserGroupIcon,
  DatabaseIcon, ChatAltIcon, ShareIcon, ShieldCheckIcon, DownloadIcon,
  GlobeIcon, LockClosedIcon, MailIcon, ExternalLinkIcon
} from '@heroicons/vue/outline';

// Importa le immagini
import heroImage from '@/assets/images/hero-queryforge-nano.png';
import playgroundImage from '@/assets/images/playground.webp';
import LogoQueryForge from '@/assets/images/logoQueryForge.svg';

// Setup Meta e SEO
const baseUrl = import.meta.env.PROD
  ? 'https://queryforge.io'
  : window.location.origin;

// L'immagine per l'anteprima sui social è in public/, così ha un indirizzo fisso
const socialImageUrl = `${baseUrl}/social-preview.png`;

useMeta({
  title: 'QueryForge - Il playground SQL gratuito nel browser',
  description: 'Fai pratica con SQL gratis nel browser: database di esempio pronto, 31 esercizi guidati e sintassi MySQL. Niente da installare, nessuna registrazione.',
  image: socialImageUrl,
});

// Modulo di iscrizione alle novità, ospitato da Brevo
const newsletterUrl = 'https://0efb3274.sibforms.com/serve/MUIFAKla9UyqE1I4DlecrTGw_xA0U8kelUD4_nOi-zMYiUFZvAEuh6hMvrwJmE2erJD6Nea6AOOvIRHX0u41iNex_3tAsrEzEgoA2gXg0deVzMIZqDOZ6I9JTuGOdZe9pWmT-LTjGdnUPrQ1R05h4gO6ptTsiSShpvZCGoefVTom7Te3kZgRuFddIzF32VWovLnA2GHRLu8ZpX_YhQ==';

const features = [
  {
    icon: DatabaseIcon,
    title: 'Un database pronto all\'uso',
    text: 'Un piccolo e-commerce con clienti, prodotti, categorie e ordini: dati realistici su cui provare subito ogni query.'
  },
  {
    icon: AcademicCapIcon,
    title: '31 esercizi guidati',
    text: 'Sei capitoli, da SELECT e WHERE fino a JOIN e subquery. Ogni esercizio ha la spiegazione del concetto, un suggerimento e la soluzione.'
  },
  {
    icon: ChatAltIcon,
    title: 'Errori spiegati in italiano',
    text: 'Se la query non funziona, il messaggio ti dice cosa correggere: una colonna che non esiste, un valore duplicato, una subquery che restituisce troppe colonne.'
  },
  {
    icon: ShareIcon,
    title: 'Lo schema a colpo d\'occhio',
    text: 'Le tabelle e le loro relazioni in un diagramma: capisci come sono collegati i dati prima di scrivere una JOIN.'
  },
  {
    icon: ShieldCheckIcon,
    title: 'Sbagliare non costa niente',
    text: 'Prima di comandi come DROP TABLE o di un DELETE senza WHERE ti chiede conferma. E con Reset Database torni ai dati di partenza.'
  },
  {
    icon: DownloadIcon,
    title: 'Cronologia ed esportazione',
    text: 'Ritrovi le query già eseguite per rilanciarle e scarichi i risultati in CSV, JSON o Excel.'
  }
];

const supported = [
  'SELECT con WHERE, ORDER BY e LIMIT',
  'JOIN, subquery, UNION e CTE',
  'GROUP BY, HAVING e funzioni di aggregazione',
  'Funzioni su testi, numeri e date (CONCAT, ROUND, DATE_FORMAT…)',
  'INSERT, UPDATE e DELETE',
  'CREATE e ALTER TABLE, con AUTO_INCREMENT, ENUM e chiavi esterne'
];

const unsupported = [
  'Variabili (@nome)',
  'Stored procedure, funzioni, trigger ed eventi',
  'Utenti e permessi (CREATE USER, GRANT)',
  'Lettura e scrittura di file (LOAD DATA, INTO OUTFILE)',
  'information_schema, FULLTEXT e WITH ROLLUP'
];

// Stato reattivo
const mobileMenuOpen = ref(false);

// Chiude il menu mobile
const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
};

// Porta alla sezione "Come funziona" (il margine in alto lascia spazio alla barra fissa)
const scrollToHowItWorks = () => {
  document.getElementById('come-funziona')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
