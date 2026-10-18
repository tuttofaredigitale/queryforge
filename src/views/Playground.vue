<template>
  <div class="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-200">
    <!-- Toast container -->
    <!-- i toast lasciano passare i clic, così non bloccano i pulsanti sottostanti -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <transition-group name="toast">
        <div 
          v-for="toast in toasts" 
          :key="toast.id" 
          class="flex items-center max-w-md py-3 px-4 shadow-lg rounded-md transform transition-all duration-300"
          :class="[
            toast.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : '',
            toast.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' : '',
            toast.type === 'info' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' : '',
            toast.type === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : ''
          ]"
        >
          <!-- Icona per success -->
          <svg v-if="toast.type === 'success'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <!-- Icona per error -->
          <svg v-else-if="toast.type === 'error'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <!-- Icona per info -->
          <svg v-else-if="toast.type === 'info'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <!-- Icona per warning -->
          <svg v-else-if="toast.type === 'warning'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          
          <div class="flex-grow pr-1">{{ toast.message }}</div>
          
          <button
            @click="removeToast(toast.id)"
            class="ml-2 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors pointer-events-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </transition-group>
    </div>

    <!-- Header -->
    <AppHeader
      :is-resetting="isResetting"
      @request-reset="showResetDialog = true"
    />

    <!-- Main content -->
    <div class="flex flex-grow overflow-hidden">
      <!-- Toggle button for sidebar on mobile -->
      <button 
        @click="isDbSidebarOpen = !isDbSidebarOpen"
        class="fixed left-0 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-r-md z-10 md:hidden"
        aria-label="Toggle database sidebar"
      >
        <ChevronRightIcon v-if="!isDbSidebarOpen" class="h-5 w-5" />
        <ChevronLeftIcon v-else class="h-5 w-5" />
      </button>

      <!-- Left sidebar with responsive behavior -->
      <div 
        :class="[
          'bg-white shadow-md overflow-y-auto dark:bg-gray-800 dark:text-gray-200 dark:border-r dark:border-gray-700 transition-all duration-300 flex-shrink-0',
          isDbSidebarOpen ? 'w-64 absolute md:relative z-20 h-full' : 'w-0 md:w-64 md:relative'
        ]"
      >
        <div class="p-4" v-if="isDbSidebarOpen || !isMobile">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="font-bold text-gray-700 dark:text-gray-200">Database</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400" title="SQLite nel browser, con sintassi MySQL">queryforge · nel tuo browser</p>
            </div>
            <!-- Pulsante di refresh -->
            <div class="flex items-center">
              <button
                @click="loadDatabaseStructure" 
                :disabled="isLoading"
                class="p-1 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Aggiorna struttura database"
              >
                <RefreshIcon class="h-4 w-4" :class="{'animate-spin': isLoading}" />
              </button>
              <!-- Close button solo su mobile -->
              <button 
                @click="isDbSidebarOpen = false"
                class="p-1 ml-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors md:hidden"
                title="Chiudi sidebar"
              >
                <XIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div v-if="isLoading" class="text-sm text-gray-600">
            Caricamento struttura...
          </div>
          <div v-else-if="error" class="text-sm text-red-600">
            {{ error }}
            <button 
              @click="loadDatabaseStructure" 
              class="mt-2 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Riprova
            </button>
          </div>
          <div v-else-if="databaseStructure.length === 0" class="text-sm text-gray-600">
            Nessuna tabella trovata nel database.
          </div>
          <div v-else>
            <div v-for="table in databaseStructure" :key="table.name" class="mb-3">
              <div class="font-medium text-gray-700 flex items-center dark:text-gray-200">
                <span>{{ table.name }}</span>
                <button 
                  @click="insertQueryTemplate('select', table.name); isDbSidebarOpen = isMobile ? false : isDbSidebarOpen;"
                  class="ml-1 text-xs text-indigo-600 hover:text-indigo-800"
                  title="SELECT query"
                >
                  <DocumentSearchIcon class="h-3 w-3" />
                </button>
              </div>
              <ul class="ml-4 mt-1">
                <li 
                  v-for="column in table.columns" 
                  :key="column.name" 
                  class="text-xs text-gray-600 flex items-center dark:text-gray-300"
                >
                  <span>{{ column.name }} ({{ column.type }})</span>
                  <span v-if="column.key === 'PRI'" class="ml-1 text-yellow-500" title="Primary Key">🔑</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Main area -->
      <div class="flex-grow flex flex-col overflow-hidden">
        <!-- Tabs responsive con icone centrate e altezza fissa -->
        <div class="bg-white border-b sticky top-0 z-10 h-14 flex items-center justify-center dark:bg-gray-800 dark:border-b dark:border-gray-700">
          <div class="w-full flex justify-around items-center px-2">
            <button
              @click="activeTab = 'editor'"
              class="h-full flex-1 flex flex-col items-center justify-center py-1 relative"
              :class="[
                activeTab === 'editor' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              ]"
              aria-label="Editor SQL"
            >
              <TerminalIcon class="h-6 w-6" />
              <span class="text-xs mt-1 hidden sm:block">Editor SQL</span>
              <div v-if="activeTab === 'editor'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>
            </button>
            
            <button
              @click="activeTab = 'history'"
              class="h-full flex-1 flex flex-col items-center justify-center py-1 relative"
              :class="[
                activeTab === 'history' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              ]"
              aria-label="Cronologia query"
            >
              <ClockIcon class="h-6 w-6" />
              <span class="text-xs mt-1 hidden sm:block">Cronologia</span>
              <div v-if="activeTab === 'history'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>
            </button>
            
            <button
              @click="activeTab = 'relations'"
              class="h-full flex-1 flex flex-col items-center justify-center py-1 relative transition-opacity duration-200"
              :class="[
                  activeTab === 'relations' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              ]" aria-label="Relazioni DB"
              >
              <TableIcon class="h-6 w-6" />
              <span class="text-xs mt-1 hidden sm:block">Relazioni DB</span>
              <div v-if="activeTab === 'relations'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>
            </button>

            <button
                @click="isExercisePanelOpen = !isExercisePanelOpen"
                class="h-full flex-1 flex flex-col items-center justify-center py-1 relative transition-opacity duration-200"
                :class="[
                    isExercisePanelOpen ? 'text-teal-600 dark:text-teal-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                ]"
                title="Apri/Chiudi Esercizi"
            >
                <AcademicCapIcon class="h-6 w-6" />
                <span class="text-xs mt-1 hidden sm:block">Studio</span>
                <div v-if="isExercisePanelOpen" class="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500"></div>
            </button>

          </div>
        </div>
        
        <!-- Editor e pannello esercizi: affiancati su schermi grandi, sovrapposti su quelli piccoli -->
        <div class="flex-grow flex overflow-hidden min-h-0 relative">

        <!-- Content container con dimensioni stabilizzate -->
        <div class="flex-grow flex flex-col overflow-hidden min-h-0 min-w-0">
          <!-- Wrapper con layout responsive -->
          <div class="h-full p-2 sm:p-4 bg-gray-50 overflow-y-auto relative dark:bg-gray-900" ref="mainContentRef">
            <!-- Contenuto con larghezza adattiva -->
            <div class="w-full mx-auto">
              <!-- Contenuto con transizioni -->
              <Transition name="fade" mode="out-in">
                <div :key="activeTab" class="h-full tab-content w-full">
                  <!-- Vista Editor SQL -->
                  <div v-if="activeTab === 'editor'" class="h-full flex flex-col">
                    <!-- Query Helper Collassabile con icona specifica per mobile -->
                    <div class="bg-white rounded-md shadow-sm mb-4 w-full dark:bg-gray-800 dark:border dark:border-gray-700">
                      <div 
                        class="border-b px-3 sm:px-4 py-2 bg-gray-50 flex justify-between items-center cursor-pointer dark:bg-gray-700 dark:border-gray-600"
                        @click="toggleQueryHelper"
                      >
                        <div class="flex items-center">
                          <!-- Icona visibile solo su mobile -->
                          <DocumentTextIcon class="h-4 w-4 mr-2 text-indigo-500 sm:hidden" />
                          <h3 class="font-medium text-gray-700 dark:text-gray-200 text-sm sm:text-base">Query Comuni</h3>
                        </div>
                        <div class="flex items-center text-gray-500 dark:text-gray-400">
                          <span class="text-xs mr-2 hidden sm:inline">{{ showQueryHelper ? 'Nascondi' : 'Mostra' }}</span>
                          <ChevronDownIcon v-if="!showQueryHelper" class="h-4 w-4" />
                          <ChevronUpIcon v-else class="h-4 w-4" />
                        </div>
                      </div>
                      
                      <transition
                        enter-active-class="transition-all duration-300 ease-out"
                        leave-active-class="transition-all duration-200 ease-in"
                        enter-from-class="opacity-0 max-h-0 overflow-hidden"
                        enter-to-class="opacity-100 max-h-36 overflow-hidden"
                        leave-from-class="opacity-100 max-h-36 overflow-hidden"
                        leave-to-class="opacity-0 max-h-0 overflow-hidden"
                      >
                        <div v-if="showQueryHelper" class="p-2 sm:p-3">
                          <div class="flex flex-wrap gap-1 sm:gap-2">
                            <button 
                              v-for="template in queryTemplates" 
                              :key="template.name" 
                              @click="insertQueryTemplate(template.type, null)"
                              class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 dark:bg-gray-600 dark:border-gray-600 dark:text-gray-300"
                            >
                              {{ template.name }}
                            </button>
                          </div>
                        </div>
                      </transition>
                    </div>
                  
                    <!-- Editor -->
                    <div class="bg-white rounded-md shadow-sm mb-4 w-full dark:bg-gray-800 dark:border dark:border-gray-700">
                      <!-- Intestazione unificata con controlli dimensione font -->
                      <div class="border-b px-3 py-2 bg-gray-50 flex justify-between items-center dark:bg-gray-700 dark:border-gray-600">
                        <h3 class="text-lg sm:text-xl font-medium text-gray-700 text-sm sm:text-base dark:text-gray-200">Editor SQL</h3>
                        
                        <!-- Controlli dimensione font -->
                        <div class="flex items-center">
                          <span class="text-xs text-gray-500 mr-2 dark:text-gray-200 hidden sm:inline">Dimensione:</span>
                          <div class="flex border rounded overflow-hidden">
                            <button 
                              @click="decreaseFontSize" 
                              class="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 border-r dark:border-gray-300 dark:hover:bg-gray-800 dark:bg-gray-600 dark:border-gray-600 dark:text-gray-300"
                              title="Riduci dimensione"
                            >
                              <span class="text-xs">A-</span>
                            </button>
                            
                            <button 
                              @click="resetFontSize" 
                              class="px-2 py-1 bg-white text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-600 dark:border-gray-600 dark:text-gray-300"
                              title="Dimensione predefinita"
                            >
                              <span>{{ fontSizeLabel }}</span>
                            </button>
                            
                            <button 
                              @click="increaseFontSize" 
                              class="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 border-l dark:border-gray-300 dark:hover:bg-gray-800 dark:bg-gray-600 dark:border-gray-600 dark:text-gray-300"
                              title="Aumenta dimensione"
                            >
                              <span class="text-base">A+</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div class="p-3 sm:p-4">
                        <textarea
                          v-model="query"
                          :readonly="isExecuting" 
                          :class="[
                            'w-full h-32 sm:h-40 p-3 sm:p-4 font-mono border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200',
                            fontSizeClass,
                            isExecuting ? 'bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed' : '' // NUOVO: Stile visivo quando bloccato
                          ]"
                          placeholder="Scrivi la tua query SQL qui..."
                          @input="analyzeQueryOnInput"
                          @keydown="handleKeyboardShortcuts"
                        ></textarea>
                        <div class="mt-4 flex flex-col sm:flex-row sm:justify-between space-y-2 sm:space-y-0">
                          <div class="flex flex-wrap space-x-2">
                            <!-- Pulsanti di azione  -->
                            <button
                              @click="loadDatabaseStructure"
                              :disabled="isLoading"
                              class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md flex items-center space-x-1 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-xs sm:text-sm mb-2 sm:mb-0"
                            >
                              <RefreshIcon class="h-4 w-4" :class="{'animate-spin': isLoading}" />
                              <span class="hidden sm:inline">Aggiorna DB</span>
                            </button>
                            
                            <button
                              @click="clearEditor"
                              class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md flex items-center space-x-1 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-xs sm:text-sm mb-2 sm:mb-0"
                            >
                              <TrashIcon class="h-4 w-4" />
                              <span class="hidden sm:inline">Pulisci</span>
                            </button>
                          </div>
                                                   
                          <!-- Contenitore per raggruppare pulsante Esegui e scorciatoia -->
                          <div class="flex items-center">
                            <span class="mr-2 text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                              <b>Ctrl + Invio</b> o 
                            </span>
                            <button
                              @click="executeQuery"
                              :disabled="isExecuting"
                              class="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center justify-center space-x-2 hover:bg-indigo-700 disabled:bg-indigo-400 text-sm"
                            >
                              <PlayIcon class="h-4 w-4" />
                              <span>{{ isExecuting ? 'Esecuzione...' : 'Esegui' }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Security Warning -->
                    <div v-if="securityIssues.length > 0" class="bg-yellow-50 border border-yellow-200 rounded-md shadow-sm mb-4 w-full">
                      <!-- Security warning contents rimangono invariati -->
                      <div class="border-b border-yellow-200 px-4 py-2 bg-yellow-100">
                        <h3 class="font-medium text-yellow-800 flex items-center">
                          <ExclamationIcon class="h-5 w-5 mr-2 text-yellow-600" />
                          Avviso di Sicurezza
                        </h3>
                      </div>
                      <div class="p-4">
                        <ul class="space-y-2">
                          <li v-for="(issue, index) in securityIssues" :key="index" class="flex items-start"
                              :class="{'text-red-700': issue.level === 'critical', 'text-yellow-700': issue.level === 'warning'}">
                            
                            <span v-if="issue.level === 'critical'" class="inline-block mr-2 mt-0.5 flex-shrink-0">
                              <ShieldExclamationIcon class="h-5 w-5 text-red-500" />
                            </span>
                            <span v-else class="inline-block mr-2 mt-0.5 flex-shrink-0">
                              <ExclamationCircleIcon class="h-5 w-5 text-yellow-500" />
                            </span>
                            
                            <!-- Logica per mostrare testo e link -->
                            <span class="text-sm">
                              {{ issue.message.text }}
                              <a 
                                v-if="issue.message.showLink" 
                                href="#" 
                                @click.prevent="isSecurityModalOpen = true" 
                                class="ml-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                Scopri perché.
                              </a>
                            </span>
                          </li>
                        </ul>
                        
                        <div v-if="isQueryBlocked" class="mt-4 p-3 bg-red-50 border border-red-100 rounded">
                          <p class="font-medium text-red-800 mb-2">Questa query non può essere eseguita</p>
                          <p class="text-red-700 mb-3 text-sm">
                            La query contiene operazioni non consentite per motivi di sicurezza.
                          </p>
                        </div>
                        
                        <div v-else-if="requiresConfirmation" class="mt-4 p-3 bg-red-50 border border-red-100 rounded">
                          <p class="font-medium text-red-800 mb-2">Questa query richiede conferma</p>
                          <p class="text-red-700 mb-3 text-sm">
                            La query contiene operazioni potenzialmente pericolose. Sei sicuro di voler procedere?
                          </p>
                          <div class="flex space-x-3">
                            <button
                              @click="cancelExecution"
                              class="px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                            >
                              Annulla
                            </button>
                            <button
                              @click="confirmAndExecute"
                              class="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Confermo, Esegui
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Results con scrolling orizzontale migliorato -->
                    <div class="relative bg-white rounded-md shadow-sm w-full dark:bg-gray-800 dark:border dark:border-gray-700">

                      <div v-if="isExecuting" class="absolute inset-0 bg-gray-100/70 dark:bg-gray-900/80 rounded-md flex flex-col items-center justify-center z-20 backdrop-blur-sm transition-opacity duration-300">
                        <svg class="animate-spin h-8 w-8 text-indigo-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p class="text-gray-600 dark:text-gray-300 font-medium">Esecuzione query in corso...</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Potrebbe richiedere alcuni secondi</p>
                      </div>

                      <!-- Header dei risultati (invariato) -->
                      <div class="border-b px-3 py-2 bg-gray-50 flex justify-between items-center dark:bg-gray-700 dark:border-gray-600">
                        <div class="flex items-center">
                          <h3 class="font-medium text-gray-700 text-sm sm:text-base dark:text-gray-200">Risultati</h3>
                          <span v-if="queryResults && queryResults.rows && queryResults.rows.length > 0" class="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full dark:bg-gray-600 dark:text-gray-200">
                            {{ queryResults.rows.length }}{{ queryResults.truncated ? '+' : '' }} righe
                          </span>
                        </div>
                        <div class="flex items-center space-x-2">
                          <!-- Pulsante copia (invariato) -->
                          <button v-if="hasResultsToCopy" @click="copyResultsToClipboard" class="text-xs px-2 py-1 flex items-center space-x-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded transition-colors dark:bg-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-700">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            <span class="hidden sm:inline">Copia negli appunti</span>
                            <span class="sm:hidden">Copia</span>
                          </button>
                          
                          <!-- Pulsante esporta con dropdown (Ora Gratuito per tutti) -->
                          <div v-if="hasResultsToCopy" class="relative">
                            <!-- Unico pulsante attivo per tutti (rimosso v-if="isProUser") -->
                            <button ref="exportMenuButton" @click="isExportMenuOpen = !isExportMenuOpen" class="export-menu-button text-xs px-2 py-1 flex items-center space-x-1 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors dark:bg-green-800 dark:text-green-200 dark:hover:bg-green-700">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              <span class="hidden sm:inline">Esporta</span>
                              <span class="sm:hidden">Esporta</span>
                            </button>
                            
                            <!-- Dropdown menu (rimosso check && isProUser) -->
                            <div 
                              v-if="isExportMenuOpen" 
                              ref="exportMenuDropdown"
                              class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 export-menu-dropdown dark:bg-gray-800 dark:text-gray-200"
                            >
                              <!-- CSV -->
                              <button 
                                @click="exportToCSV(); isExportMenuOpen = false;"
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                <span class="w-5 h-5 mr-2 text-gray-400 dark:text-gray-500">
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                  </svg>
                                </span>
                                Esporta come CSV
                              </button>
                              
                              <!-- JSON -->
                              <button 
                                @click="exportToJSON(); isExportMenuOpen = false;"
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                <span class="w-5 h-5 mr-2 text-gray-400 dark:text-gray-500">
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                                  </svg>
                                </span>
                                Esporta come JSON
                              </button>
                              
                              <!-- Excel -->
                              <button 
                                @click="exportToExcel(); isExportMenuOpen = false;"
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                <span class="w-5 h-5 mr-2 text-gray-400 dark:text-gray-500">
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                  </svg>
                                </span>
                                Esporta come Excel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Contenuti risultati adattati per mobile -->
                      <div class="p-3 sm:p-4">
                        <div v-if="queryError" class="text-red-500 py-4">
                          <p class="font-medium">Errore:</p>
                          <p class="whitespace-pre-wrap">{{ queryError }}</p>            
                                
                        </div>
                        <div v-else-if="!queryResults" class="text-gray-500 text-center py-8 dark:text-gray-300">
                          I risultati della query verranno mostrati qui.
                        </div>
                        <div v-else-if="queryResults.rows && queryResults.rows.length === 0" class="text-gray-500 text-center py-8">
                          La query non ha restituito risultati.
                        </div>
                        <div v-else-if="queryResults.rows" class="w-full overflow-x-auto" style="overscroll-behavior-x: contain;">
                          <div class="inline-block min-w-full">
                            <table class="min-w-full border-collapse border border-gray-300 dark:bg-gray-600 dark:border-gray-700 table-fixed">
                              <thead>
                                <tr class="bg-gray-100 dark:bg-gray-700">
                                  <th v-for="column in resultColumns" :key="column" class="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 truncate dark:border-gray-600 dark:text-gray-200" style="min-width: 120px; max-width: 200px;">
                                    {{ column }}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="(row, index) in queryResults.rows" :key="index" class="border-b dark:border-gray-700">
                                  <td v-for="column in resultColumns" :key="column" class="border border-gray-300 px-3 py-2 text-sm text-gray-700 truncate dark:border-gray-500 dark:text-gray-200" style="min-width: 120px; max-width: 200px;">
                                    <div class="truncate" :title="row[column]">{{ row[column] }}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <!-- Risultati troncati -->
                          <div v-if="queryResults.truncated" class="text-xs text-amber-700 mt-2 dark:text-amber-300">
                            Sono mostrate solo le prime {{ queryResults.rows.length }} righe: aggiungi un LIMIT o un filtro WHERE per restringere i risultati.
                          </div>
                          <!-- Avviso di scrolling orizzontale su mobile -->
                          <div class="text-xs text-gray-500 mt-2 text-center sm:hidden">
                            <span>👉 Scorri orizzontalmente per visualizzare tutti i dati</span>
                          </div>
                        </div>
                        <!-- In caso di operazioni non SELECT (INSERT, UPDATE, ecc.) -->
                        <div v-else-if="queryResults.affectedRows !== undefined" class="text-gray-700 p-3 sm:p-4 dark:text-gray-200">
                          <p><span class="font-medium">Operazione completata con successo</span></p>
                          <p v-if="queryResults.message">{{ queryResults.message }}</p>
                          <p v-if="queryResults.affectedRows !== undefined">Righe interessate: {{ queryResults.affectedRows }}</p>
                          <p v-if="queryResults.insertId !== undefined">ID inserito: {{ queryResults.insertId }}</p>
                          <p v-if="queryResults.statements > 1" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Eseguite {{ queryResults.statements }} istruzioni: qui vedi il risultato dell'ultima.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Altre viste rimangono invariate ma con larghezza responsiva -->
                  <div v-else-if="activeTab === 'history'" class="h-full">
                    <QueryHistoryComponent 
                      :refresh-trigger="historyRefreshTrigger"
                      @load-query="loadQueryFromHistory"
                      @run-query="runQueryFromHistory"
                      @show-toast="(message, type) => toast[type](message)"
                      class="w-full"
                    />
                  </div>
                  
                  <div v-else-if="activeTab === 'relations'" class="h-full">
                    <DatabaseRelations 
                      :database-structure="databaseStructure" 
                      :is-loading="isLoading"
                      @refresh="loadDatabaseStructure"
                      class="w-full"
                    />
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Pannello esercizi -->
        <div
          v-show="isExercisePanelOpen"
          class="absolute inset-0 z-30 bg-white shadow-md overflow-hidden dark:bg-gray-800 lg:static lg:w-1/2 lg:flex-shrink-0 lg:border-l lg:border-gray-200 dark:lg:border-gray-700"
        >
          <ExercisePanel
            @close="isExercisePanelOpen = false"
            @loadQuery="loadQueryFromExercise"
          />
        </div>
        </div>
      </div>
    </div>

    <!-- Modale di conferma reset database -->
    <div v-if="showResetDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-4 dark:bg-gray-800 dark:text-gray-200">
        <h3 class="text-lg font-bold text-gray-900 mb-4 dark:text-gray-200">Conferma Reset Database</h3>
        <p class="text-gray-700 mb-2 dark:text-gray-300">
          Sei sicuro di voler ripristinare il database? Tutti i dati verranno riportati allo stato iniziale.
        </p>
        <p class="text-gray-700 mb-4 font-medium dark:text-gray-300">
          Questa operazione non può essere annullata.
        </p>
        <div class="flex justify-end space-x-3">
          <button 
            @click="showResetDialog = false"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Annulla
          </button>
          <button 
            @click="resetDatabase"
            :disabled="isResetting"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:bg-red-400 flex items-center"
          >
            <span v-if="isResetting">Resetting...</span>
            <span v-else>Conferma Reset</span>
          </button>
        </div>
      </div>
    </div>

    <SecurityGuidelinesModal :show="isSecurityModalOpen" @close="isSecurityModalOpen = false" />
  </div>
</template>

<style scoped>
/* Assicura che i componenti figli rispettino l'altezza del contenitore */
.h-full {
  height: 100%;
}

/* Nascondi le scrollbar senza perdere la funzionalità di scorrimento */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari and Opera */
}

/* Personalizza scrollbar per risultati della query */
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background-color: rgba(229, 231, 235, 0.3);
}

/* Aggiungi una transizione fluida quando i contenuti cambiano */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
  width: 100%;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  width: 100%;
}

/* Transizioni per i menu e sidebar */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

/* Assicura che tutte le celle abbiano un comportamento coerente con i contenuti lunghi */
table td, table th {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Variazione degli scrollbar in dark mode */
.dark .overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.7);
}

.dark .overflow-x-auto::-webkit-scrollbar-track {
  background-color: rgba(31, 41, 55, 0.3);
}

/* Migliora l'interazione con il pulsante tema */
.theme-icon {
  transition: transform 0.5s ease;
}

.theme-icon.rotate {
  transform: rotate(360deg);
}

/* Feedback visivo per operazioni di copia */
.copy-feedback {
  transition: opacity 0.3s ease-in-out;
}

.copy-feedback.opacity-0 {
  opacity: 0;
}

/* Ombreggiatura per elementi fluttuanti come sidebar mobile */
.floating-sidebar {
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
}

/* Animazioni per i toast */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.ai-response-content {
  /* Stili generali */
  line-height: 1.6;
}

/* Migliora i blocchi di codice */
.ai-response-content :deep(pre) {
  background-color: #f8f9fa;
  border-radius: 6px;
  padding: 16px;
  margin: 16px 0;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
}

.ai-response-content :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.05);
}

.ai-response-content :deep(pre code) {
  padding: 0;
  background-color: transparent;
}

/* Migliora tabelle */
.ai-response-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.ai-response-content :deep(th),
.ai-response-content :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
}

.ai-response-content :deep(th) {
  background-color: #f8f9fa;
  font-weight: 600;
}

/* Stili dark mode (Tailwind gestisce la classe .dark globalmente) */
.dark .ai-response-content :deep(pre) {
  background-color: #2d3748;
  border-color: #4a5568;
}

.dark .ai-response-content :deep(code) {
  background-color: rgba(255, 255, 255, 0.1);
}

.dark .ai-response-content :deep(th),
.dark .ai-response-content :deep(td) {
  border-color: #4a5568;
}

.dark .ai-response-content :deep(th) {
  background-color: #2d3748;
}

/* Stili aggiuntivi per migliore leggibilità */
.ai-response-content :deep(h1),
.ai-response-content :deep(h2),
.ai-response-content :deep(h3),
.ai-response-content :deep(h4),
.ai-response-content :deep(h5),
.ai-response-content :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  font-weight: 600;
}

.ai-response-content :deep(h1) { font-size: 1.5rem; }
.ai-response-content :deep(h2) { font-size: 1.25rem; }
.ai-response-content :deep(h3) { font-size: 1.125rem; }

.ai-response-content :deep(ul),
.ai-response-content :deep(ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
}

.ai-response-content :deep(li) {
  margin-bottom: 0.5rem;
}

.ai-response-content :deep(blockquote) {
  border-left: 4px solid #e2e8f0;
  padding-left: 1rem;
  margin-left: 0;
  color: #4a5568;
}

.dark .ai-response-content :deep(blockquote) {
  border-left-color: #4a5568;
  color: #a0aec0;
}
</style>

<script>
import { usePersistentState } from '@/composables/usePersistentState.js';
import { useSqlEditor } from '@/composables/useSqlEditor.js';
import { useToasts } from '@/composables/useToasts.js';
import { ref, onMounted, computed, onUnmounted } from "vue";
import { useDatabaseManager } from '@/composables/useDatabaseManager.js';
import { useQueryExecution } from '@/composables/useQueryExecution.js';
import { ensureReady } from '@/engine/client.js';
import SecurityGuidelinesModal from '../components/common/SecurityGuidelinesModal.vue';
import QueryHistoryComponent from '../components/playground/QueryHistoryComponent.vue';
import DatabaseRelations from '../components/playground/DatabaseRelations.vue';
import ExercisePanel from '../components/playground/ExercisePanel.vue';

import {
  LockClosedIcon, 
  DatabaseIcon, 
  PlayIcon, 
  ExclamationIcon, 
  ShieldExclamationIcon, 
  ExclamationCircleIcon,
  DocumentSearchIcon,
  RefreshIcon,
  InformationCircleIcon,
  TrashIcon,
  ClockIcon,
  HeartIcon,
  XIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  TerminalIcon,
  TableIcon,
  AcademicCapIcon
} from "@heroicons/vue/outline";
import AppHeader from '../components/common/AppHeader.vue';

// Query templates predefinite
const QUERY_TEMPLATES = [
  { name: "SELECT", type: "select" },
  { name: "INSERT", type: "insert" },
  { name: "UPDATE", type: "update" },
  { name: "DELETE", type: "delete" },
  { name: "CREATE TABLE", type: "create" },
  { name: "ALTER TABLE", type: "alter" },
  { name: "JOIN", type: "join" },
  { name: "GROUP BY", type: "group" },
  { name: "ORDER BY", type: "order" }
];

export default {
  components: {
    AppHeader,
    SecurityGuidelinesModal,
    LockClosedIcon,
    DatabaseIcon, 
    PlayIcon, 
    ExclamationIcon, 
    ShieldExclamationIcon, 
    ExclamationCircleIcon,
    DocumentSearchIcon,
    RefreshIcon,
    InformationCircleIcon,
    TrashIcon,
    DatabaseRelations,
    QueryHistoryComponent,
    ClockIcon,
    HeartIcon,
    XIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    DocumentTextIcon,
    TerminalIcon,
    TableIcon,
    ExercisePanel,
    AcademicCapIcon
  },
  setup() {
    const { toasts, removeToast, toast } = useToasts();
    const query = usePersistentState('sql-playground-query', '');
    const isSecurityModalOpen = ref(false);

    const {
        databaseStructure,
        isLoading, 
        error,     
        isResetting,
        loadDatabaseStructure,
        resetDatabase: executeDbReset // Rinominiamo la funzione interna del composable
    } = useDatabaseManager();

    const {
        queryResults,
        queryError,
        isExecuting,
        lastQuery,
        queryExecutionCount,
        securityIssues,
        requiresConfirmation,
        isQueryBlocked,
        analyzeSecurity,
        resetSecurityState,
        executeQuery: executeQueryFromComposable, // Rinominiamo
        confirmAndExecute: confirmAndExecuteFromComposable, // Rinominiamo
        clearResults,
        shouldShowRefresh, // Ora proviene dal composable
        changedSchema
    } = useQueryExecution();

    // Colonne nell'ordine della query (le chiavi di un oggetto non sempre lo rispettano)
    const resultColumns = computed(() => {
      const results = queryResults.value;
      if (!results || !results.rows || results.rows.length === 0) return [];
      return results.columns || Object.keys(results.rows[0]);
    });

    const activeTab = ref('editor');

    const showQueryHelper = ref(true);
    const isExportMenuOpen = ref(false);
    
    // State per il reset database
    const showResetDialog = ref(false);

    // State per responsive
    const isDbSidebarOpen = ref(false);
    const isExercisePanelOpen = ref(false);
    const isMobile = ref(false);

    const exportMenuButton    = ref(null)
    const exportMenuDropdown  = ref(null)


    // Funzione per gestire le scorciatoie da tastiera
    const handleKeyboardShortcuts = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        // I controlli sono ridondanti (già fatti nel composable) ma utili per feedback immediato
        if (!query.value.trim() || isQueryBlocked.value || requiresConfirmation.value) {
          return;
        }
        executeQuery(); // Chiama la funzione orchestratrice
      }
    };

    // Font size manager
    const fontSizes = [
      { label: 'XS', class: 'text-xs' },
      { label: 'S', class: 'text-sm' },
      { label: 'M', class: 'text-base' },
      { label: 'L', class: 'text-lg' },
      { label: 'XL', class: 'text-xl' },
      { label: '2XL', class: 'text-2xl' }
    ];

    const toggleQueryHelper = () => {
      showQueryHelper.value = !showQueryHelper.value;
      // Salva la preferenza dell'utente
      localStorage.setItem('showQueryHelper', showQueryHelper.value.toString());
    };
    
    let debounceTimer = null;
    const analyzeQueryOnInput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        analyzeSecurity(query.value); // Chiama il composable
      }, 500);
    };
    
    // Annulla l'esecuzione della query che richiede conferma
    const cancelExecution = () => {
        resetSecurityState(); // Chiama il composable
    };

    // Dopo CREATE, ALTER, DROP... la barra laterale si aggiorna da sola
    const refreshStructureIfNeeded = () => {
        if (changedSchema.value) loadDatabaseStructure();
    };

    const confirmAndExecute = async () => {
        // La logica di esecuzione e i toast di successo/errore sono nel composable
        await confirmAndExecuteFromComposable(query.value);
        refreshStructureIfNeeded();
    };

    const executeQuery = async () => {
        await executeQueryFromComposable(query.value);
        refreshStructureIfNeeded();
    };


    // Funzione per resettare il database
    const resetDatabase = async () => {
      const success = await executeDbReset();
      if (success) {
          showResetDialog.value = false;
          // Usa clearResults dal nuovo composable
          clearResults();
      }
    };

    // Funzioni per interagire con la cronologia
    const loadQueryFromHistory = (queryText) => {
      query.value = queryText;
      activeTab.value = 'editor';
      analyzeSecurity(query.value); // Chiama il composable
    };

    const loadQueryFromExercise = (queryText) => {
        loadQueryFromHistory(queryText);
        // su schermi piccoli il pannello copre l'editor: lo chiudiamo
        if (window.innerWidth < 1024) isExercisePanelOpen.value = false;
    };

    const runQueryFromHistory = (queryText) => {
      query.value = queryText;
      activeTab.value = 'editor';
      analyzeSecurity(query.value); // Chiama il composable
      executeQuery(); // Chiama la funzione orchestratrice
    };

    // Carica la struttura del database all'inizializzazione
    onMounted(() => {
      // inizializzazioni
      loadDatabaseStructure();
      analyzeSecurity(query.value);

      // avvisi sul database del browser
      ensureReady()
        .then(({ restored, persistent }) => {
          if (!persistent) {
            toast.warning('Il browser non permette di salvare il database: le modifiche andranno perse chiudendo la pagina.');
          } else if (!restored) {
            toast.info('Database di esempio pronto: le tue modifiche restano salvate in questo browser.');
          }
        })
        .catch(() => toast.error('Impossibile avviare il database nel browser. Ricarica la pagina.'));

      // listener document click per chiudere dropdown
      const clickOutsideHandler = (event) => {
        if (isExportMenuOpen.value
            && exportMenuDropdown.value
            && exportMenuButton.value
            && !exportMenuDropdown.value.contains(event.target)
            && !exportMenuButton.value.contains(event.target)) {
          isExportMenuOpen.value = false;
        }
      };
      document.addEventListener('click', clickOutsideHandler);

      // resize handler sul container
      const resizeHandler = debounce(() => {
        checkMobile();
      }, 200);
      window.addEventListener('resize', resizeHandler);

      // cleanup in onUnmounted
      onUnmounted(() => {
        document.removeEventListener('click', clickOutsideHandler);
        window.removeEventListener('resize', resizeHandler);
      });
    });

    // Monitora e fissa la larghezza delle schede
    const mainContentRef = ref(null);

    // Calcola larghezza fissa per tutte le schede
    const tabWidth = ref(800); // Larghezza predefinita

    // Funzione per impostare la larghezza iniziale
    const setInitialTabWidth = () => {
      // Ottieni la larghezza del contenitore, meno un po' di padding
      if (mainContentRef.value) {
        // Imposta larghezza fissa in base al contenitore, meno 40px di padding
        const containerWidth = mainContentRef.value.clientWidth - 40;
        tabWidth.value = containerWidth;
      }
    };

    const contentWidth = ref(0);

    // Funzione per aggiornare la larghezza
    const updateContentWidth = () => {
      if (mainContentRef.value) {
        contentWidth.value = mainContentRef.value.offsetWidth;
      }
    };

    // Funzione di debounce per evitare troppi calcoli durante il ridimensionamento
    function debounce(fn, delay) {
      let timer = null;
      return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          fn.apply(this, args);
        }, delay);
      };
    }

    // Check per rilevare device mobile
    const checkMobile = () => {
      isMobile.value = window.innerWidth < 768; // 768px è il breakpoint md di Tailwind
      
      // Chiudi automaticamente la sidebar su mobile se aperta e stiamo passando da desktop a mobile
      if (isMobile.value && isDbSidebarOpen.value) {
        isDbSidebarOpen.value = false;
      }
      
      // Apri automaticamente la sidebar su desktop se chiusa e stiamo passando da mobile a desktop
      if (!isMobile.value && !isDbSidebarOpen.value) {
        isDbSidebarOpen.value = true;
      }
    };

    // Funzione modificata per chiudere il menu mobile quando si naviga
    const setActiveTab = (tab) => {
      activeTab.value = tab;
      };

    // Funzione per copiare i risultati nella clipboard
    const copyResultsToClipboard = () => {
      if (!queryResults.value || !queryResults.value.rows || queryResults.value.rows.length === 0) {
        return;
      }
      
      const rows = queryResults.value.rows;
      const headers = resultColumns.value;
      
      // Crea un array di righe a partire dall'intestazione e dai dati
      let csvContent = [];
      
      // Aggiungi l'intestazione
      csvContent.push(headers.map(formatCsvValue).join(','));
      
      // Aggiungi le righe di dati
      rows.forEach(row => {
        const rowValues = headers.map(header => formatCsvValue(row[header]));
        csvContent.push(rowValues.join(','));
      });
      
      // Unisci tutte le righe con un newline
      const csvString = csvContent.join('\n');
      
      // Copia nella clipboard
      navigator.clipboard.writeText(csvString)
        .then(() => {
          // Usa il toast invece di showCopyFeedback
          toast.success('Tabella copiata negli appunti');
        })
        .catch(err => {
          console.error('Errore durante la copia:', err);
          toast.error('Errore durante la copia');
        });
    };

    // Formatta correttamente i valori per CSV (gestisce valori con virgole, newline, ecc.)
    const formatCsvValue = (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      
      const stringValue = String(value);
      
      // Se contiene virgole, newline, o virgolette, racchiudilo tra virgolette
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        // Sostituisci eventuali virgolette con due virgolette (per l'escape in CSV)
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    };    

    // Aggiungi questa proprietà per verificare se ci sono risultati da copiare
    const hasResultsToCopy = computed(() => {
      return queryResults.value && 
            queryResults.value.rows && 
            queryResults.value.rows.length > 0;
    });

    // Funzione per esportare in CSV
    const exportToCSV = () => {
      if (!hasResultsToCopy.value) {
        toast.error('Nessun risultato da esportare');
        return;
      }
      
      const rows = queryResults.value.rows;
      const headers = resultColumns.value;
      
      // Crea un array di righe a partire dall'intestazione e dai dati
      let csvContent = [];
      
      // Aggiungi l'intestazione
      csvContent.push(headers.map(formatCsvValue).join(','));
      
      // Aggiungi le righe di dati
      rows.forEach(row => {
        const rowValues = headers.map(header => formatCsvValue(row[header]));
        csvContent.push(rowValues.join(','));
      });
      
      const csvString = csvContent.join('\n');
      
      // Crea un blob e genera il download
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Nome file con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.setAttribute('href', url);
      link.setAttribute('download', `sql-result-${timestamp}.csv`);
      
      // Esegui il download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Esportazione CSV completata');
    };

    // Funzione per esportare in JSON
    const exportToJSON = () => {
      if (!hasResultsToCopy.value) {
        toast.error('Nessun risultato da esportare');
        return;
      }
      
      // Prepara i dati JSON
      const jsonData = JSON.stringify(queryResults.value.rows, null, 2);
      
      // Crea un blob e genera il download
      const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Nome file con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.setAttribute('href', url);
      link.setAttribute('download', `sql-result-${timestamp}.json`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Esportazione JSON completata');
    };

    // Funzione per esportare in Excel (usando xlsx)
    const exportToExcel = async () => {
      if (!hasResultsToCopy.value) {
        toast.error('Nessun risultato da esportare');
        return;
      }
      
      try {
        // Carica dinamicamente la libreria xlsx
        const XLSX = await import('xlsx');
        
        // Converti i dati in un formato per xlsx
        const worksheet = XLSX.utils.json_to_sheet(queryResults.value.rows, { header: resultColumns.value });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Query Results");
        
        // Genera il file Excel e avvia il download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        XLSX.writeFile(workbook, `sql-result-${timestamp}.xlsx`);
        
        toast.success('Esportazione Excel completata');
      } catch (error) {
        console.error('Errore durante l\'esportazione in Excel:', error);
        toast.error('Errore durante l\'esportazione in Excel');
      }
    };

    const {
      fontSizeClass,
      fontSizeLabel,
      increaseFontSize,
      decreaseFontSize,
      resetFontSize,
      queryTemplates,
      insertQueryTemplate,
      clearEditor: clearEditorContent, // Rinominiamo per evitare conflitti se ne avessimo
    } = useSqlEditor(query, databaseStructure);
    
    // Funzione 'clearEditor' nel componente padre che ora fa più cose
    const clearEditor = () => {
      clearEditorContent(); // Da useSqlEditor
      resetSecurityState(); // Da useQueryExecution
    };

    // Modifica la funzione 'insertQueryTemplate' del componente per aggiungere logica extra
    const insertAndAnalyzeQueryTemplate = (type, tableName) => {
      insertQueryTemplate(type, tableName);
      analyzeSecurity(query.value); // Da useQueryExecution
      
      // logica mobile sidebar
      if (isMobile.value && isDbSidebarOpen.value) {
         isDbSidebarOpen.value = false;
      }
    };

    return {
      isSecurityModalOpen,
      query,
      resultColumns,
      
      queryExecutionCount,
      isExecuting,
      queryError,
      queryResults,
      securityIssues,
      requiresConfirmation,
      isQueryBlocked,
      lastQuery,
      shouldShowRefresh,

      executeQuery,
      confirmAndExecute,
      cancelExecution,
      analyzeQueryOnInput,

      databaseStructure,
      isLoading,
      error,
      isResetting,
      loadDatabaseStructure,
      handleKeyboardShortcuts,
      activeTab,
      showResetDialog,
      resetDatabase,
      isQueryBlocked,
      queryTemplates,
      
      historyRefreshTrigger: queryExecutionCount,

      loadQueryFromHistory,
      runQueryFromHistory,

      insertQueryTemplate: insertAndAnalyzeQueryTemplate,
      clearEditor,

      isExercisePanelOpen,
      loadQueryFromHistory,
      loadQueryFromExercise,

      fontSizeClass,
      fontSizeLabel,
      increaseFontSize,
      decreaseFontSize,
      resetFontSize,
      contentWidth,
      tabWidth,
      mainContentRef,
      copyResultsToClipboard,
      hasResultsToCopy,
      isDbSidebarOpen,
      isMobile,
      showQueryHelper,
      toggleQueryHelper,
      toast,
      toasts,
      removeToast,
      exportToCSV,
      exportToJSON,
      exportToExcel,
      isExportMenuOpen,
      exportMenuButton,
      exportMenuDropdown,
    };
  },
};
</script>