<template>
  <div class="bg-gray-50 dark:bg-slate-900/50 min-h-screen">
    <!-- 1. Header Moderno -->
    <header class="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 text-white shadow-lg">
      <div class="container mx-auto px-6 py-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
              <UserIcon class="w-6 h-6" />
            </div>
            <div>
              <h1 class="text-2xl font-bold">Il mio profilo</h1>
              <p class="text-blue-200 text-sm">Gestisci il tuo account</p>
            </div>
          </div>
          <router-link to="/playground" class="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-medium flex items-center space-x-2 transition-colors duration-300">
            <ArrowLeftIcon class="w-4 h-4" />
            <span>Torna al Playground</span>
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-6 py-8">
      
      <!-- Stati di Caricamento e Errore -->
      <div v-if="isLoading" class="py-16 flex justify-center">
        <svg class="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
        <ExclamationCircleIcon class="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p class="text-red-700 dark:text-red-400 font-medium">{{ error }}</p>
        <button @click="loadAllData" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm dark:bg-indigo-700 hover:bg-indigo-800">
          Riprova
        </button>
      </div>

      <div v-else-if="userData" class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

        <!-- Card Principale (Utente) - Full Width -->
        <div class="lg:col-span-2 bg-gradient-to-br from-zinc-800 via-indigo-600 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-2xl flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between mb-6">
              <div class="flex items-center space-x-4">
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl sm:text-4xl font-bold backdrop-blur-sm shrink-0">
                  <template v-if="userInitials">{{ userInitials }}</template>
                  <UserIcon v-else class="w-8 h-8 text-white opacity-80" />
                </div>
                <div>
                  <h2 class="text-2xl sm:text-3xl font-bold">{{ userData.username }}</h2>
                  <p class="text-indigo-200 text-sm sm:text-base">{{ userData.email }}</p>
                  <p class="text-indigo-300 text-xs sm:text-sm mt-1">Registrato il {{ formatDate(userData.created_at, { dateStyle: 'long' }) }}</p>
                </div>
              </div>
            </div>
          </div>
          <!-- Badge Course Lab -->
          <div class="mt-4 pt-6 border-t border-white/20">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-y-2">
              <div>
                <h3 class="text-lg sm:text-xl font-semibold">Course Lab Edition</h3>
                <p class="text-indigo-200 text-sm">Playground SQL dell'AF Cloud Academy</p>
              </div>
              <span class="inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full text-sm sm:text-base font-semibold shadow-lg">
                <span class="relative flex h-3 w-3 mr-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                Attivo
              </span>
            </div>
          </div>
        </div>

        <!-- Card Query Usage -->
        <div class="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center">
          <h3 class="text-lg sm:text-xl font-semibold text-white flex items-center mb-2">
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            Query Giornaliere
          </h3>
          <div class="flex items-end justify-between mb-3">
            <div class="text-4xl sm:text-5xl font-bold text-white">{{ queryRemaining }}</div>
            <div class="text-emerald-200 text-sm mb-1">/ {{ queryLimit }} rimanenti</div>
          </div>
          <div class="relative bg-white/20 rounded-full h-3 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700 ease-out" 
                 :class="queryBarClass"
                 :style="{ width: queryPercentage + '%' }"></div>
          </div>
          <p class="text-xs text-emerald-300 mt-2">
            Reset automatico a mezzanotte
          </p>
        </div>

        <!-- Card Azioni Rapide -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Azioni Rapide</h3>
          <div class="space-y-3">
            <!-- Bottone Modifica Password -->
            <button @click="showResetPasswordModal = true" class="w-full text-left flex items-center space-x-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                <KeyIcon class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p class="font-medium text-gray-900 dark:text-gray-100">Modifica password</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">Aggiorna le tue credenziali</p>
              </div>
            </button>
            <!-- Bottone Scarica Dati -->
            <div class="relative">
              <button ref="exportButton" @click="toggleExportOptions" class="w-full text-left flex items-center space-x-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <DownloadIcon class="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-gray-100">Scarica i miei dati</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Export in JSON o HTML</p>
                </div>
              </button>
              <div v-if="showExportOptions" ref="exportMenu" class="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 dark:bg-gray-700 dark:ring-gray-600" role="menu">
                <div class="py-1" role="none">
                  <button @click.prevent="handleExportClick('json')" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem">JSON</button>
                  <button @click.prevent="handleExportClick('html')" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600" role="menuitem">HTML</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card Dettagli e Consensi -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Dettagli e Consensi</h3>
          <div class="space-y-4">
            <!-- Dettagli Account -->
            <dl class="space-y-3">
              <div class="flex justify-between items-center">
                <dt class="text-sm text-gray-600 dark:text-gray-400">Username</dt>
                <dd class="font-medium text-sm text-gray-800 dark:text-gray-200">{{ userData.username }}</dd>
              </div>
              <div class="flex justify-between items-center">
                <dt class="text-sm text-gray-600 dark:text-gray-400">Email</dt>
                <dd class="font-medium text-sm text-gray-800 dark:text-gray-200">{{ userData.email }}</dd>
              </div>
              <div class="flex justify-between items-center">
                <dt class="text-sm text-gray-600 dark:text-gray-400">Piano</dt>
                <dd class="font-medium text-sm text-gray-800 dark:text-gray-200">Course Lab</dd>
              </div>
            </dl>
            <!-- Consensi GDPR -->
            <div class="space-y-3 border-t pt-4 border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 dark:text-gray-300">Termini e Condizioni</span>
                <div v-if="userData.terms_accepted" class="flex items-center space-x-1.5">
                  <CheckCircleIcon class="w-5 h-5 text-green-500" />
                  <span class="text-sm text-green-600 dark:text-green-400 font-medium">Accettati</span>
                </div>
                <div v-else class="flex items-center space-x-1.5">
                  <XCircleIcon class="w-5 h-5 text-red-500" />
                  <span class="text-sm text-red-600 dark:text-red-400 font-medium">Non accettati</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 dark:text-gray-300">Privacy Policy</span>
                <div v-if="userData.privacy_accepted" class="flex items-center space-x-1.5">
                  <CheckCircleIcon class="w-5 h-5 text-green-500" />
                  <span class="text-sm text-green-600 dark:text-green-400 font-medium">Accettata</span>
                </div>
                <div v-else class="flex items-center space-x-1.5">
                  <XCircleIcon class="w-5 h-5 text-red-500" />
                  <span class="text-sm text-red-600 dark:text-red-400 font-medium">Non accettata</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card AF Cloud Academy -->
        <div class="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div class="flex items-start space-x-3 mb-4">
              <div class="bg-white/20 p-2 rounded-full flex-shrink-0">
                <CloudIcon class="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-white">AF Cloud Academy</h3>
                <p class="text-white/80 text-sm">Porta le tue skill nel Cloud</p>
              </div>
            </div>
            <p class="text-white/90 text-sm mb-4">
              Hai imparato SQL? Scopri i miei corsi per le certificazioni AWS e inizia il tuo percorso nel cloud computing!
            </p>
          </div>
          <a 
            href="https://alessioferrari.net/academy/" 
            target="_blank" 
            rel="noopener noreferrer"
            class="inline-flex items-center w-full justify-center px-4 py-2.5 bg-white text-orange-600 rounded-xl shadow hover:shadow-lg transform hover:-translate-y-0.5 transition font-semibold text-sm"
          >
            <span>Visita l'Academy</span>
            <svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <!-- Zona Pericolosa - Full Width -->
        <div class="lg:col-span-2 bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold text-red-800 dark:text-red-300">Zona Pericolosa</h3>
              <p class="text-sm text-red-700 dark:text-red-400 mt-1">L'eliminazione del tuo account è un'azione permanente e irreversibile.</p>
            </div>
            <button
              @click="showDeleteConfirm = true"
              :disabled="isDeleting"
              class="w-full sm:w-auto flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Elimina il mio account
            </button>
          </div>
        </div>

      </div>
    </main>
    
    <!-- Modale Reset Password -->
    <div v-if="showResetPasswordModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full dark:bg-gray-800 dark:border dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-indigo-600 dark:text-indigo-400">Modifica password</h3>
        </div>
        
        <div class="px-6 py-4">
          <form @submit.prevent="resetPassword" id="reset-password-form">
            <!-- Password corrente -->
            <div class="mb-4">
              <label for="current-password" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Password attuale</label>
              <input 
                type="password" 
                id="current-password"
                v-model="passwordForm.currentPassword"
                required
                placeholder="Inserisci la tua password attuale" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
              />
            </div>
            
            <!-- Nuova password -->
            <div class="mb-4">
              <label for="new-password" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Nuova password</label>
              <input 
                type="password" 
                id="new-password"
                v-model="passwordForm.newPassword"
                required
                @input="checkPasswordStrength"
                placeholder="Inserisci la nuova password" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
              />
              
              <!-- Indicatore forza password -->
              <div class="mt-2">
                <div class="flex items-center mb-1">
                  <div class="text-sm text-gray-700 mr-2 dark:text-gray-300">Forza:</div>
                  <div class="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-600">
                    <div 
                      class="h-2 rounded-full transition-all duration-300"
                      :class="passwordStrengthClass"
                      :style="{ width: `${passwordStrength}%` }"
                    ></div>
                  </div>
                  <div class="ml-2 text-sm" :class="passwordStrengthTextClass">
                    {{ passwordStrengthText }}
                  </div>
                </div>
                <ul class="text-xs text-gray-600 mt-1 space-y-1 dark:text-gray-400">
                  <li :class="{'text-green-600 dark:text-green-400': passwordChecks.length >= 8}">
                    <span v-if="passwordChecks.length >= 8">✓</span>
                    <span v-else>•</span>
                    Almeno 8 caratteri
                  </li>
                  <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasUppercase}">
                    <span v-if="passwordChecks.hasUppercase">✓</span>
                    <span v-else>•</span>
                    Almeno una lettera maiuscola
                  </li>
                  <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasLowercase}">
                    <span v-if="passwordChecks.hasLowercase">✓</span>
                    <span v-else>•</span>
                    Almeno una lettera minuscola
                  </li>
                  <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasNumber}">
                    <span v-if="passwordChecks.hasNumber">✓</span>
                    <span v-else>•</span>
                    Almeno un numero
                  </li>
                  <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasSpecial}">
                    <span v-if="passwordChecks.hasSpecial">✓</span>
                    <span v-else>•</span>
                    Almeno un carattere speciale
                  </li>
                </ul>
              </div>
            </div>
            
            <!-- Conferma nuova password -->
            <div class="mb-4">
              <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Conferma nuova password</label>
              <input 
                type="password" 
                id="confirm-password"
                v-model="passwordForm.confirmPassword"
                required
                placeholder="Conferma la nuova password" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
              />
              <p v-if="passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword" 
                 class="mt-1 text-xs text-red-600 dark:text-red-400">
                Le password non corrispondono
              </p>
            </div>
            
            <!-- Errore -->
            <div v-if="passwordResetError" class="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md dark:bg-red-900/30 dark:text-red-400 dark:border dark:border-red-800">
              {{ passwordResetError }}
            </div>
            
            <!-- Successo -->
            <div v-if="passwordResetSuccess" class="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md dark:bg-green-900/30 dark:text-green-400 dark:border dark:border-green-800">
              {{ passwordResetSuccess }}
            </div>
          </form>
        </div>
        
        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg dark:bg-gray-700">
          <button 
            @click="closePasswordModal" 
            class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Annulla
          </button>
          <button 
            type="submit"
            form="reset-password-form"
            :disabled="!isPasswordFormValid || isPasswordResetting"
            class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center dark:bg-indigo-700 dark:hover:bg-indigo-800 dark:disabled:bg-indigo-900/50"
          >
            <template v-if="isPasswordResetting">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Aggiornamento...
            </template>
            <template v-else>
              Aggiorna password
            </template>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Modale conferma eliminazione account - Prima fase -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full dark:bg-gray-800 dark:border dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-red-600 dark:text-red-500">Conferma eliminazione account</h3>
        </div>
        
        <div class="px-6 py-4">
          <div class="flex items-start mb-4">
            <ExclamationIcon class="h-6 w-6 text-red-500 mr-3 flex-shrink-0" />
            <div>
              <p class="text-gray-800 mb-2 dark:text-gray-200">Sei sicuro di voler eliminare il tuo account?</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Questa azione comporterà:</p>
              <ul class="text-sm text-gray-600 list-disc pl-5 mt-1 space-y-1 dark:text-gray-400">
                <li>La rimozione di tutti i tuoi dati personali</li>
                <li>L'eliminazione del tuo database SQL</li>
                <li>La perdita di accesso a tutte le tue query salvate</li>
              </ul>
              <p class="text-sm text-red-600 font-medium mt-2 dark:text-red-500">Questa azione non può essere annullata.</p>
            </div>
          </div>
          
          <div class="mt-4">
            <p class="text-sm text-gray-700 mb-2 dark:text-gray-300">Per confermare, inserisci la tua password:</p>
            <input 
              type="password" 
              v-model="confirmPassword"
              placeholder="La tua password" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
            />
            <p v-if="passwordError" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ passwordError }}</p>
          </div>
        </div>
        
        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg dark:bg-gray-700">
          <button 
            @click="showDeleteConfirm = false" 
            class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Annulla
          </button>
          <button 
            @click="proceedToFinalConfirmation"
            :disabled="!confirmPassword || isDeleting"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 flex items-center dark:bg-red-700 dark:hover:bg-red-800 dark:disabled:bg-red-900/50"
          >
            <template v-if="isPasswordValidating">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifica...
            </template>
            <template v-else>
              Procedi
            </template>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Modale conferma eliminazione account - Fase finale -->
    <div v-if="showFinalConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full dark:bg-gray-800 dark:border dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-red-600 dark:text-red-500">Conferma finale</h3>
        </div>
        
        <div class="px-6 py-4">
          <div class="flex items-start mb-4">
            <ExclamationIcon class="h-6 w-6 text-red-500 mr-3 flex-shrink-0" />
            <div>
              <p class="text-gray-800 font-medium mb-2 dark:text-gray-200">Stai per eliminare definitivamente il tuo account</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Digitando "ELIMINA" nella casella sottostante, confermi di voler procedere con l'eliminazione permanente del tuo account.</p>
            </div>
          </div>
          
          <div class="mt-4">
            <p class="text-sm text-gray-700 mb-2 dark:text-gray-300">Digita <span class="font-medium">ELIMINA</span> per confermare:</p>
            <input 
              type="text" 
              v-model="deleteConfirmationText"
              placeholder="ELIMINA" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
            />
          </div>
        </div>
        
        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg dark:bg-gray-700">
          <button 
            @click="cancelFinalConfirmation" 
            class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Annulla
          </button>
          <button 
            @click="deleteAccount"
            :disabled="deleteConfirmationText !== 'ELIMINA' || isDeleting"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 flex items-center dark:bg-red-700 dark:hover:bg-red-800 dark:disabled:bg-red-900/50"
          >
            <template v-if="isDeleting">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Eliminazione in corso...
            </template>
            <template v-else>
              Elimina definitivamente
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useToasts } from '@/composables/useToasts.js'; 
import api from '../services/api';

// Icone
import {
  UserIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ExclamationCircleIcon,
  ExclamationIcon, KeyIcon, DownloadIcon, CloudIcon,
} from '@heroicons/vue/outline';

export default {
  name: 'ProfileView',
  components: {
    UserIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ExclamationCircleIcon,
    ExclamationIcon, KeyIcon, DownloadIcon, CloudIcon,
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    const { toast } = useToasts();

    const exportButton = ref(null);
    const exportMenu = ref(null);

    // Stato UI principale
    const isLoading = ref(true);
    const error = ref(null);
    const isDarkMode = inject('isDarkMode', ref(false));

    // Dati utente
    const userData = computed(() => store.getters['user/userProfile']);

    // Modale Reset Password
    const showResetPasswordModal = ref(false);
    const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const passwordChecks = ref({ length: 0, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecial: false });
    const passwordStrength = ref(0);
    const isPasswordResetting = ref(false);
    const passwordResetError = ref('');
    const passwordResetSuccess = ref('');

    // Modale Cancellazione Account
    const showDeleteConfirm = ref(false);
    const showFinalConfirm = ref(false);
    const confirmPassword = ref('');
    const passwordError = ref('');
    const isPasswordValidating = ref(false);
    const isDeleting = ref(false);
    const deleteConfirmationText = ref('');

    // Export Dati
    const showExportOptions = ref(false);
    const isDownloading = ref(false);

    // --- CARICAMENTO DATI ---
    const loadAllData = async () => {
      isLoading.value = true;
      error.value = null;
      try {
        await store.dispatch('user/fetchProfile');
      } catch (err) {
        error.value = err.message || 'Si è verificato un errore durante il caricamento dei dati.';
        toast.error(error.value);
      } finally {
        isLoading.value = false;
      }
    };

    const handleClickOutside = (event) => {
      if (showExportOptions.value && 
          exportButton.value && !exportButton.value.contains(event.target) &&
          exportMenu.value && !exportMenu.value.contains(event.target)) {
        showExportOptions.value = false;
      }
    };
    
    onMounted(async () => {
      loadAllData();
      document.addEventListener('click', handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside);
    });

    // --- COMPUTED PROPERTIES ---
    
    const userInitials = computed(() => {
      if (userData.value?.username?.trim()) {
        return userData.value.username.slice(0, 2).toUpperCase();
      }
      if (userData.value?.email) {
        return userData.value.email[0].toUpperCase();
      }
      return '';
    });

    // Query usage computed
    const queryLimit = computed(() => userData.value?.queryUsage?.limit ?? 50);
    const queryUsed = computed(() => userData.value?.queryUsage?.used ?? 0);
    const queryRemaining = computed(() => userData.value?.queryUsage?.remaining ?? 50);
    
    const queryPercentage = computed(() => {
      if (queryLimit.value === 0) return 0;
      return (queryRemaining.value / queryLimit.value) * 100;
    });

    const queryBarClass = computed(() => {
      const p = queryPercentage.value;
      if (p < 10) return 'bg-gradient-to-r from-red-400 to-red-500';
      if (p < 25) return 'bg-gradient-to-r from-orange-400 to-orange-500';
      if (p < 50) return 'bg-gradient-to-r from-yellow-400 to-amber-500';
      return 'bg-gradient-to-r from-green-400 to-emerald-500';
    });

    const passwordStrengthText = computed(() => {
      if (passwordStrength.value < 20) return 'Molto debole';
      if (passwordStrength.value < 40) return 'Debole';
      if (passwordStrength.value < 60) return 'Media';
      if (passwordStrength.value < 80) return 'Buona';
      return 'Forte';
    });
    
    const passwordStrengthClass = computed(() => {
      if (passwordStrength.value < 20) return 'bg-red-500';
      if (passwordStrength.value < 40) return 'bg-orange-500';
      if (passwordStrength.value < 60) return 'bg-yellow-500';
      if (passwordStrength.value < 80) return 'bg-green-400';
      return 'bg-green-600';
    });

    const passwordStrengthTextClass = computed(() => {
      if (passwordStrength.value < 20) return 'text-red-600 dark:text-red-500';
      if (passwordStrength.value < 40) return 'text-orange-600 dark:text-orange-500';
      if (passwordStrength.value < 60) return 'text-yellow-600 dark:text-yellow-500';
      if (passwordStrength.value < 80) return 'text-green-500';
      return 'text-green-600 dark:text-green-500';
    });
    
    const isPasswordFormValid = computed(() => (
      passwordForm.value.currentPassword &&
      passwordForm.value.newPassword &&
      passwordForm.value.confirmPassword &&
      passwordForm.value.newPassword === passwordForm.value.confirmPassword &&
      passwordStrength.value >= 40
    ));

    // --- FUNZIONI ---

    const formatDate = (dateString, options = {}) => {
      if (!dateString) return 'N/A';
      const defaultOptions = { dateStyle: 'long', timeStyle: 'short' };
      return new Intl.DateTimeFormat('it-IT', { ...defaultOptions, ...options }).format(new Date(dateString));
    };

    const checkPasswordStrength = () => {
      const password = passwordForm.value.newPassword;
      passwordChecks.value = {
        length: password.length,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password)
      };
      let score = 0;
      if (passwordChecks.value.length >= 8) score += 20;
      if (passwordChecks.value.hasUppercase) score += 20;
      if (passwordChecks.value.hasLowercase) score += 20;
      if (passwordChecks.value.hasNumber) score += 20;
      if (passwordChecks.value.hasSpecial) score += 20;
      passwordStrength.value = score;
    };

    const resetPassword = async () => {
      if (!isPasswordFormValid.value) return;
      isPasswordResetting.value = true;
      passwordResetError.value = '';
      passwordResetSuccess.value = '';
      try {
        const response = await api.post('/user/reset-password', {
          currentPassword: passwordForm.value.currentPassword,
          newPassword: passwordForm.value.newPassword
        });
        if (response.data.success) {
          passwordResetSuccess.value = 'Password aggiornata con successo!';
          toast.success('Password aggiornata con successo!');
          setTimeout(() => {
            closePasswordModal();
          }, 2000);
        } else {
          throw new Error(response.data.message || 'Errore sconosciuto');
        }
      } catch (err) {
        passwordResetError.value = err.response?.data?.message || 'Si è verificato un errore durante l\'aggiornamento.';
        toast.error(passwordResetError.value);
      } finally {
        isPasswordResetting.value = false;
      }
    };

    const closePasswordModal = () => {
      showResetPasswordModal.value = false;
      passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
      passwordChecks.value = { length: 0, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecial: false };
      passwordStrength.value = 0;
      passwordResetError.value = '';
      passwordResetSuccess.value = '';
    };

    // --- GESTIONE CANCELLAZIONE ACCOUNT ---

    const proceedToFinalConfirmation = async () => {
      if (!confirmPassword.value) {
        passwordError.value = 'Inserisci la tua password per continuare.';
        return;
      }
      isPasswordValidating.value = true;
      passwordError.value = '';
      try {
        const response = await api.post('/user/validate-password', {
          password: confirmPassword.value
        });
        if (response.data.valid) {
          showDeleteConfirm.value = false;
          showFinalConfirm.value = true;
        } else {
          passwordError.value = 'Password non corretta.';
        }
      } catch (err) {
        passwordError.value = err.response?.data?.message || 'Errore di validazione. Riprova.';
      } finally {
        isPasswordValidating.value = false;
      }
    };

    const cancelFinalConfirmation = () => {
      showFinalConfirm.value = false;
      confirmPassword.value = '';
      deleteConfirmationText.value = '';
    };

    const deleteAccount = async () => {
      if (deleteConfirmationText.value !== 'ELIMINA') return;
      isDeleting.value = true;
      try {
        await api.delete('/user/account', {
          data: { password: confirmPassword.value }
        });
        await store.dispatch('auth/logout');
        router.push({ path: '/login', query: { accountDeleted: 'true' } });
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Errore durante l\'eliminazione dell\'account.';
        toast.error(errorMessage);
        showFinalConfirm.value = false; 
      } finally {
        isDeleting.value = false;
      }
    };

    // --- EXPORT DATI ---

    const toggleExportOptions = () => {
      showExportOptions.value = !showExportOptions.value;
    };

    const handleExportClick = (format) => {
      downloadUserData(format);
      showExportOptions.value = false;
    };

    const downloadUserData = async (format = 'json') => {
      if (isDownloading.value) return;
      isDownloading.value = true;
      toast.info(`Inizio download dei dati in formato ${format.toUpperCase()}...`);
      try {
        const response = await api.get('/user/export-data', {
          params: { format },
          responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        
        const date = new Date().toISOString().split('T')[0];
        const filename = `dati_utente_queryforge_${date}.${format}`;
        link.setAttribute('download', filename);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Download completato!');
      } catch (err) {
        console.error('Errore nel download dei dati:', err);
        toast.error('Impossibile scaricare i dati in questo momento.');
      } finally {
        isDownloading.value = false;
      }
    };
    
    return {
      // Dati
      userData,

      // Stato UI
      isLoading,
      error,
      isDarkMode,
      showExportOptions,
      isDownloading,
      
      // Modali
      showResetPasswordModal,
      passwordForm,
      passwordChecks,
      passwordStrength,
      passwordStrengthText,
      passwordStrengthClass,
      passwordStrengthTextClass,
      isPasswordFormValid,
      isPasswordResetting,
      passwordResetError,
      passwordResetSuccess,
      showDeleteConfirm,
      showFinalConfirm,
      confirmPassword,
      passwordError,
      isPasswordValidating,
      isDeleting,
      deleteConfirmationText,
      
      // Computed
      userInitials,
      queryLimit,
      queryUsed,
      queryRemaining,
      queryPercentage,
      queryBarClass,

      // Funzioni
      loadAllData,
      formatDate,
      proceedToFinalConfirmation,
      cancelFinalConfirmation,
      deleteAccount,
      checkPasswordStrength,
      resetPassword,
      closePasswordModal,
      toggleExportOptions,
      handleExportClick,
      downloadUserData,
      exportButton,
      exportMenu,
    };
  }
};
</script>

<style scoped>
</style>