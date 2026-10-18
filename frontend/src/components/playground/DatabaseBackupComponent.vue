<template>
  <div class="w-full tab-content-wrapper">
  <div class="h-full flex flex-col">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-200">Gestione Backup</h2>
      
      <!-- Pulsanti con visualizzazione adattiva per mobile -->
      <div class="flex space-x-2">
        <!-- Pulsante Info - solo icona su mobile -->
        <button
          @click="toggleInfoPanel"
          class="p-2 sm:px-3 sm:py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 flex items-center text-sm dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          :title="showInfoPanel ? 'Nascondi informazioni' : 'Mostra informazioni'"
        >
          <InformationCircleIcon class="h-5 w-5 sm:mr-1" />
          <span class="hidden sm:inline">Info</span>
          <ChevronDownIcon v-if="!showInfoPanel" class="h-4 w-4 hidden sm:block sm:ml-1" />
          <ChevronUpIcon v-else class="h-4 w-4 hidden sm:block sm:ml-1" />
        </button>
        
        <!-- Pulsante Nuovo Backup - solo icona su mobile -->
        <button
          @click="createBackup"
          :disabled="isCreatingBackup"
          class="p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center dark:bg-indigo-700 dark:hover:bg-indigo-800 dark:disabled:bg-indigo-800/50"
        >
          <RefreshIcon v-if="isCreatingBackup" class="h-5 w-5 sm:mr-2 animate-spin" />
          <PlusIcon v-else class="h-5 w-5 sm:mr-2" />
          <span class="hidden sm:inline">{{ isCreatingBackup ? 'Creazione in corso...' : 'Nuovo Backup' }}</span>
        </button>
      </div>
    </div>

    <!-- Sezione Info Collassabile -->
    <transition
      name="slide-fade"
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-class="opacity-0 max-h-0 overflow-hidden"
      enter-to-class="opacity-100 max-h-[500px] overflow-hidden"
      leave-class="opacity-100 max-h-[500px] overflow-hidden"
      leave-to-class="opacity-0 max-h-0 overflow-hidden"
    >
      <div v-if="showInfoPanel" class="bg-blue-50 p-3 sm:p-4 rounded-md mb-4 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100">
        <div class="flex items-start">
          <InformationCircleIcon class="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <h3 class="font-medium text-blue-700 dark:text-blue-300">Informazioni sui Backup</h3>
            <p class="text-sm text-blue-600 dark:text-blue-200 mt-1">
              I backup consentono di salvare lo stato attuale del database per ripristinarlo successivamente.
              <span class="font-medium">Diversamente dal Reset,</span> che riporta il database allo stato iniziale predefinito,
              i backup permettono di tornare a uno stato intermedio personalizzato.
            </p>
            <p class="text-sm text-blue-600 dark:text-blue-200 mt-1">
              <span class="font-medium">Politica di retention:</span> i backup manuali vengono conservati per 3 mesi, mentre i backup automatici per 7 giorni.
            </p>
            <p class="text-sm text-blue-600 dark:text-blue-200 mt-1">
              <span class="font-medium">Limiti:</span> puoi avere al massimo {{ backupLimit }} backup manuali. Se raggiungi il limite, il backup più vecchio verrà eliminato automaticamente.
            </p>
            <p class="text-sm text-blue-600 dark:text-blue-200 mt-1">
              <span class="font-medium">Auto-rotazione:</span> indica un backup creato dopo che il sistema ha eliminato automaticamente 
              un backup più vecchio perché è stato raggiunto il limite di {{ backupLimit }} backup manuali.
            </p>
          </div>
        </div>
      </div>
    </transition>
    
    <!-- Stato dei Backup - Layout responsive per mobile -->
    <div class="bg-white rounded-md shadow-sm mb-4 flex-shrink-0 dark:bg-gray-800 dark:border dark:border-gray-700">
      <div class="border-b px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
        <h3 class="font-medium text-gray-700 dark:text-gray-200 text-sm sm:text-base">Panoramica</h3>
      </div>

      <div class="p-3 sm:p-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <!-- Statistiche Backup ottimizzate per mobile -->
          <div class="bg-gray-50 p-2 sm:p-4 rounded-md border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
            <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Backup totali</div>
            <div class="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{{ totalBackups }}</div>
          </div>
          
          <div class="bg-gray-50 p-2 sm:p-4 rounded-md border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
            <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Backup manuali</div>
            <div class="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100" :class="{
              'text-yellow-600 dark:text-yellow-500': manualBackupsCount >= backupLimit - 2, 
              'text-red-600 dark:text-red-500': manualBackupsCount >= backupLimit
            }">
              {{ manualBackupsCount }} / {{ backupLimit }}
            </div>
          </div>
          
          <div class="bg-gray-50 p-2 sm:p-4 rounded-md border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
            <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Ultimo backup</div>
            <div class="text-sm sm:text-lg font-medium text-gray-800 dark:text-gray-100">
              {{ lastBackupDate || 'Nessun backup' }}
            </div>
          </div>

          <div class="bg-gray-50 p-2 sm:p-4 rounded-md border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
            <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Spazio utilizzato</div>
            <div class="text-sm sm:text-lg font-medium text-gray-800 dark:text-gray-100">{{ formatBytes(totalBackupSize) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Avviso quando si è vicini al limite -->
    <div v-if="manualBackupsCount >= backupLimit - 2 && manualBackupsCount < backupLimit" class="bg-yellow-50 p-3 sm:p-4 rounded-md mb-4 border border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800">
      <div class="flex items-start">
        <ExclamationIcon class="h-5 w-5 text-yellow-500 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            Stai raggiungendo il limite di backup manuali ({{ manualBackupsCount }} di {{ backupLimit }}). Ti consigliamo di eliminare i backup meno importanti.
          </p>
        </div>
      </div>
    </div>

    <!-- Avviso quando si raggiunge il limite -->
    <div v-if="backupWarning" class="bg-red-50 p-3 sm:p-4 rounded-md mb-4 border border-red-200 dark:bg-red-900/30 dark:border-red-800">
      <div class="flex items-start">
        <ExclamationCircleIcon class="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p class="text-sm text-red-700 dark:text-red-300">
            {{ backupWarning }}
          </p>
        </div>
      </div>
    </div>

    <!-- Sezione Etichette Collassabile - Adattata per mobile -->
    <div class="bg-white rounded-md shadow-sm mb-4 flex-shrink-0 dark:bg-gray-800 dark:border dark:border-gray-700">
      <div class="border-b px-3 sm:px-4 py-2 bg-gray-50 flex justify-between items-center cursor-pointer dark:bg-gray-700 dark:border-gray-600" @click="toggleLabelsPanel">
        <h3 class="font-medium text-gray-700 dark:text-gray-200 text-sm sm:text-base">Etichette backup</h3>
        <div class="flex items-center text-gray-500 dark:text-gray-400">
          <ChevronDownIcon v-if="!showLabelsPanel" class="h-4 w-4" />
          <ChevronUpIcon v-else class="h-4 w-4" />
        </div>
      </div>
      
      <transition
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-class="opacity-0 max-h-0 overflow-hidden"
        enter-to-class="opacity-100 max-h-[500px] overflow-hidden"
        leave-class="opacity-100 max-h-[500px] overflow-hidden"
        leave-to-class="opacity-0 max-h-0 overflow-hidden"
      >
        <div v-if="showLabelsPanel" class="p-3 sm:p-4 dark:text-gray-200">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <!-- Etichette ottimizzate per mobile -->
            <div class="flex items-center">
              <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs mr-2 dark:bg-indigo-900/50 dark:text-indigo-300">Manuale</span>
              <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Backup creato manualmente</span>
            </div>
            
            <div class="flex items-center">
              <span class="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs mr-2 dark:bg-green-900/50 dark:text-green-300">Automatico</span>
              <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Backup creato dal sistema</span>
            </div>
            
            <div class="flex items-center">
              <span class="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs mr-2 dark:bg-orange-900/50 dark:text-orange-300">Auto-rotazione</span>
              <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Creato dopo limite raggiunto</span>
            </div>
            
            <!-- 
            <div class="flex items-center">
              <span class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs mr-2 dark:bg-purple-900/50 dark:text-purple-300">Esteso</span>
              <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Scadenza estesa manualmente</span>
            </div>
            -->
          </div>
        </div>
      </transition>
    </div>

    <!-- Lista dei Backup - Responsive per mobile -->
    <div class="bg-white rounded-md shadow-sm flex-grow overflow-hidden flex flex-col dark:bg-gray-800 dark:border dark:border-gray-700">
      <div class="border-b px-3 sm:px-4 py-2 bg-gray-50 flex justify-between items-center dark:bg-gray-700 dark:border-gray-600">
        <h3 class="font-medium text-gray-700 dark:text-gray-200 text-sm sm:text-base">I tuoi backup</h3>
        <button 
          @click="loadBackups" 
          :disabled="isLoading" 
          class="p-1.5 text-indigo-600 hover:text-indigo-800 flex items-center dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <RefreshIcon class="h-4 w-4" :class="{'animate-spin': isLoading}" />
          <span class="ml-1 text-xs hidden sm:inline">Aggiorna</span>
        </button>
      </div>

      <div class="p-3 sm:p-4 overflow-y-auto flex-grow">
        <!-- Stato di caricamento -->
        <div v-if="isLoading" class="text-center py-8 text-gray-500 dark:text-gray-400">
          <div class="animate-pulse flex justify-center space-x-2 mb-3">
            <div class="h-2 w-2 bg-indigo-400 rounded-full"></div>
            <div class="h-2 w-2 bg-indigo-500 rounded-full"></div>
            <div class="h-2 w-2 bg-indigo-600 rounded-full"></div>
          </div>
          Caricamento backup...
        </div>

        <!-- Nessun backup disponibile -->
        <div v-else-if="backups.length === 0" class="text-center py-8">
          <div class="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
            <DatabaseIcon class="w-full h-full" />
          </div>
          <p class="text-gray-500 dark:text-gray-400 mb-4 text-sm sm:text-base">Non hai ancora creato alcun backup.</p>
          <button 
            @click="createBackup" 
            :disabled="isCreatingBackup"
            class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs sm:text-sm dark:bg-indigo-700 dark:hover:bg-indigo-800"
          >
            Crea il tuo primo backup
          </button>
        </div>

        <!-- Lista dei backup ottimizzata per mobile -->
        <div v-else class="space-y-3">
          <div 
            v-for="backup in backups" 
            :key="backup.id" 
            class="border rounded-md p-3 sm:p-4 hover:border-indigo-200 hover:bg-indigo-50 transition-colors dark:border-gray-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
          >
            <!-- Layout adattivo per mobile: impilato su mobile, affiancato su desktop -->
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start">
              <div>
                <div class="flex items-center flex-wrap">
                  <span class="font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base">{{ backup.backup_name || `Backup #${backup.id}` }}</span>
                  
                  <!-- Etichette -->
                  <div class="flex flex-wrap gap-1 mt-1 sm:mt-0">
                    <!-- Etichetta Manuale -->
                    <span 
                      v-if="backup.backup_type === 'manual'" 
                      class="sm:ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs group relative cursor-help dark:bg-indigo-900/50 dark:text-indigo-300"
                    >
                      Manuale
                      <span class="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded p-1.5 w-44 z-10 left-0 bottom-full mb-1 dark:bg-gray-900 dark:border dark:border-gray-700">
                        Backup creato manualmente dall'utente
                      </span>
                    </span>
                    
                    <!-- Etichetta Automatico -->
                    <span 
                      v-else 
                      class="sm:ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs group relative cursor-help dark:bg-green-900/50 dark:text-green-300"
                    >
                      Auto
                      <span class="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded p-1.5 w-56 z-10 left-0 bottom-full mb-1 dark:bg-gray-900 dark:border dark:border-gray-700">
                        Backup creato automaticamente dal sistema
                      </span>
                    </span>
                    
                    <!-- Etichetta Auto-rotazione -->
                    <span 
                      v-if="hasMetadata(backup, 'auto_rotated') && backup.metadata.auto_rotated" 
                      class="sm:ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs group relative cursor-help dark:bg-orange-900/50 dark:text-orange-300"
                    >
                      Rotazione
                      <div class="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded p-2 w-64 z-10 left-0 bottom-full mb-1 dark:bg-gray-900 dark:border dark:border-gray-700">
                        <div class="relative">
                          <p class="mb-1">Backup creato dopo eliminazione automatica del backup più vecchio</p>
                        </div>
                      </div>
                    </span>
                    
                    <!-- Etichetta Esteso -->
                    <span 
                      v-if="hasMetadata(backup, 'extended') && backup.metadata.extended" 
                      class="sm:ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs group relative cursor-help dark:bg-purple-900/50 dark:text-purple-300"
                    >
                      Esteso
                      <span class="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded p-1.5 w-52 z-10 left-0 bottom-full mb-1 dark:bg-gray-900 dark:border dark:border-gray-700">
                        Backup con data di scadenza estesa manualmente
                      </span>
                    </span>
                  </div>
                </div>
                <div class="flex flex-wrap gap-x-3 mt-1">
                  <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Creato: {{ formatDateShort(backup.created_at) }}
                  </div>
                  <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {{ formatBytes(backup.backup_size) }}
                  </div>
                </div>
                <!-- Visualizzazione retention -->
                <div class="text-xs sm:text-sm mt-1">
                  <span class="text-gray-500 dark:text-gray-400">Scadenza: </span>
                  <span 
                    :class="getRetentionClasses(backup.retention_until)"
                  >
                    {{ backup.retention_until ? formatDateShort(backup.retention_until) : 'Non impostata' }}
                    <span v-if="isExpiringWithinDays(backup.retention_until, 3)" class="ml-1 italic">
                      (in scadenza)
                    </span>
                  </span>
                </div>
              </div>
              
              <!-- Pulsanti azione ottimizzati per mobile -->
              <div class="flex gap-1 sm:gap-2 mt-3 sm:mt-0">
                <button 
                  @click="downloadBackup(backup)" 
                  :disabled="isDownloading && downloadingBackupId === backup.id" 
                  class="flex-1 sm:flex-none px-2 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs sm:text-sm dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/80"
                >
                  <span v-if="isDownloading && downloadingBackupId === backup.id" class="sm:hidden">
                    ...
                  </span>
                  <span v-else class="sm:hidden flex items-center justify-center">
                    <DownloadIcon class="h-3.5 w-3.5" />
                  </span>
                  <span v-if="isDownloading && downloadingBackupId === backup.id" class="hidden sm:inline">
                    Download...
                  </span>
                  <span v-else class="hidden sm:inline flex items-center">
                    <DownloadIcon class="h-4 w-4 mr-1" />
                    Download
                  </span>
                </button>

                <!-- <button 
                  @click="extendRetention(backup)" 
                  v-if="backup.backup_type === 'manual' && isExpiringWithinDays(backup.retention_until, 30)" 
                  class="flex-1 sm:flex-none px-2 py-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-xs sm:text-sm dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/80"
                  title="Estendi la scadenza di altri 3 mesi"
                >
                  <span class="sm:hidden">Est.</span>
                  <span class="hidden sm:inline">Estendi</span>
                </button> -->

                <button 
                  @click="showRestoreConfirmation(backup)" 
                  :disabled="isRestoring" 
                  class="flex-1 sm:flex-none px-2 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 text-xs sm:text-sm dark:bg-indigo-700 dark:hover:bg-indigo-800 dark:disabled:bg-indigo-900/50"
                >
                  <span v-if="isRestoring && restoringBackupId === backup.id" class="sm:hidden">
                    ...
                  </span>
                  <span v-else class="sm:hidden">Ripr.</span>
                  <span v-if="isRestoring && restoringBackupId === backup.id" class="hidden sm:inline">
                    Ripristino...
                  </span>
                  <span v-else class="hidden sm:inline">Ripristina</span>
                </button>
                <button 
                  @click="deleteBackup(backup.id)" 
                  :disabled="isDeletingBackup" 
                  class="flex-1 sm:flex-none px-2 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 text-xs sm:text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:disabled:bg-gray-800"
                >
                  <span class="sm:hidden">Elim.</span>
                  <span class="hidden sm:inline">Elimina</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modale di conferma eliminazione -->
    <div v-if="showDeleteConfirmation" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full dark:bg-gray-800 dark:text-gray-200 dark:border dark:border-gray-700">
        <h3 class="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 dark:text-gray-100">Conferma Eliminazione</h3>
        <p class="text-sm text-gray-700 mb-4 dark:text-gray-300">
          Sei sicuro di voler eliminare questo backup? Questa operazione non può essere annullata.
        </p>
        <div class="flex justify-end space-x-3">
          <button 
            @click="cancelDeleteBackup"
            class="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Annulla
          </button>
          <button 
            @click="confirmDeleteBackup"
            :disabled="isDeletingBackup"
            class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:bg-red-400 flex items-center text-sm dark:bg-red-700 dark:hover:bg-red-800 dark:disabled:bg-red-900/50"
          >
            <span v-if="isDeletingBackup">Eliminazione...</span>
            <span v-else>Conferma</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modale di conferma ripristino - adattata per mobile -->
    <div v-if="showRestoreModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full dark:bg-gray-800 dark:text-gray-200 dark:border dark:border-gray-700">
        <h3 class="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 dark:text-gray-100">Conferma Ripristino</h3>
        <p class="text-sm text-gray-700 mb-2 dark:text-gray-300">
          Stai per ripristinare il database allo stato del backup:
        </p>
        <p class="text-sm text-gray-700 mb-2 font-medium dark:text-gray-300">
          {{ selectedBackup ? (selectedBackup.backup_name || `Backup #${selectedBackup.id}`) : '' }}
          del {{ selectedBackup ? formatDateShort(selectedBackup.created_at) : '' }}
        </p>
        <p class="text-sm text-gray-700 mb-4 dark:text-gray-300">
          Questa operazione sostituirà lo stato attuale del database.
        </p>
        <div class="flex justify-end space-x-3">
          <button 
            @click="cancelRestore"
            class="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Annulla
          </button>
          <button 
            @click="confirmRestore"
            :disabled="isRestoring"
            class="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:bg-indigo-400 flex items-center text-sm dark:bg-indigo-700 dark:hover:bg-indigo-800 dark:disabled:bg-indigo-900/50"
          >
            <RefreshIcon v-if="isRestoring" class="h-4 w-4 mr-2 animate-spin" />
            <span v-if="isRestoring">Ripristino...</span>
            <span v-else>Conferma</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, watch, inject } from 'vue';
import api from '../../services/api';
import { 
  RefreshIcon, 
  PlusIcon, 
  DatabaseIcon,
  InformationCircleIcon,
  ExclamationIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  DownloadIcon 
} from '@heroicons/vue/outline';

export default {
  components: {
    RefreshIcon,
    PlusIcon,
    DatabaseIcon,
    InformationCircleIcon,
    ExclamationIcon,
    ExclamationCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    XIcon,
    DownloadIcon
  },
  
  emits: ['refresh-db-structure', 'show-toast'],
  
  setup(props, { emit }) {
    // Accedi allo stato dark mode se disponibile
    const isDarkMode = inject('isDarkMode', ref(false));
    
    // Dati principali
    const backups = ref([]);
    const backupLimit = ref(10);
    const backupWarning = ref(null);
    const isLoading = ref(false);
    const isCreatingBackup = ref(false);
    const isRestoring = ref(false);
    const isDeletingBackup = ref(false);
    const restoringBackupId = ref(null);
    const isExtendingRetention = ref(false);

    const error = ref(null);

    // State per il download dei backup
    const isDownloading = ref(false);
    const downloadingBackupId = ref(null);

    // Stato dei pannelli collassabili
    const showInfoPanel = ref(false);
    const showLabelsPanel = ref(false);

    const showDeleteConfirmation = ref(false);
    const backupToDelete = ref(null);
    
    // Modale di conferma ripristino
    const showRestoreModal = ref(false);
    const selectedBackup = ref(null);

    // Toggle funzioni per i pannelli collassabili
    const toggleInfoPanel = () => {
      showInfoPanel.value = !showInfoPanel.value;
      localStorage.setItem('showBackupInfoPanel', showInfoPanel.value);
    };
    
    const toggleLabelsPanel = () => {
      showLabelsPanel.value = !showLabelsPanel.value;
      localStorage.setItem('showBackupLabelsPanel', showLabelsPanel.value);
    };

    // Statistiche
    const totalBackups = computed(() => backups.value.length);
    
    const manualBackupsCount = computed(() => {
      return backups.value.filter(backup => backup.backup_type === 'manual').length;
    });

    const lastBackupDate = computed(() => {
      if (backups.value.length === 0) return null;
      
      // Trova il backup più recente
      const sortedBackups = [...backups.value].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      return formatDateShort(sortedBackups[0].created_at);
    });
    
    const totalBackupSize = computed(() => {
      return backups.value.reduce((total, backup) => total + (backup.backup_size || 0), 0);
    });

    // Verifica se un backup ha un certo campo nei metadati
    const hasMetadata = (backup, field) => {
      try {
        if (!backup.metadata) return false;
        
        // Se è già un oggetto
        if (typeof backup.metadata === 'object') {
          return backup.metadata && backup.metadata[field] !== undefined;
        }
        
        // Se è una stringa JSON
        const metadata = JSON.parse(backup.metadata);
        return metadata && metadata[field] !== undefined;
      } catch (e) {
        console.error('Errore nel parsing dei metadati:', e);
        return false;
      }
    };

    // Carica la lista dei backup
    const loadBackups = async () => {
      try {
        isLoading.value = true;
        error.value = null;
        const response = await api.get('/backup/backups');
        
        // Converte i metadati JSON in oggetti per i backup
        backups.value = response.data.map(backup => {
          if (backup.metadata && typeof backup.metadata === 'string') {
            try {
              backup.metadata = JSON.parse(backup.metadata);
            } catch (e) {
              console.warn('Errore nel parsing dei metadati del backup:', e);
            }
          }
          return backup;
        });
      } catch (error) {
        console.error('Errore nel caricamento dei backup:', error);
        // TODO: mostrare messaggio di errore
      } finally {
        isLoading.value = false;
      }
    };

    // Crea un nuovo backup
    const createBackup = async () => {
      try {
        isCreatingBackup.value = true;
        const response = await api.post('/backup/backups');

        // Emetti l'evento toast di successo
        emit('show-toast', 'Backup creato con successo', 'success');
        
        // Se c'è un avviso dal server, mostralo
        if (response.data.warning) {
          backupWarning.value = response.data.warning;
          
          // Nascondi il messaggio dopo 10 secondi
          setTimeout(() => {
            backupWarning.value = null;
          }, 10000);
        }
        
        // Ricarica la lista dei backup
        await loadBackups();
      } catch (error) {
        console.error('Errore nella creazione del backup:', error);
        emit('show-toast', 'Errore nella creazione del backup', 'error');
      } finally {
        isCreatingBackup.value = false;
      }
    };

    // Estendi la retention di un backup
    const extendRetention = async (backup) => {
      if (isExtendingRetention.value) return;
      
      try {
        isExtendingRetention.value = true;
        
        // Estendi la data di scadenza di 3 mesi
        const currentDate = backup.retention_until ? new Date(backup.retention_until) : new Date();
        currentDate.setMonth(currentDate.getMonth() + 3);
        const newRetentionDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
        
        // Chiamata API per aggiornare la data di retention
        await api.patch(`/backup/backups/${backup.id}/extend`, {
          retention_until: newRetentionDate
        });

        emit('show-toast', 'Data di scadenza estesa con successo', 'success');
        
        // Ricarica la lista dei backup
        await loadBackups();
      } catch (error) {
        console.error('Errore nell\'estensione della retention:', error);
        emit('show-toast', 'Errore nell\'estensione della data di scadenza', 'error');
      } finally {
        isExtendingRetention.value = false;
      }
    };

    // Mostra la modale di conferma ripristino
    const showRestoreConfirmation = (backup) => {
      selectedBackup.value = backup;
      showRestoreModal.value = true;
    };

    // Annulla il ripristino
    const cancelRestore = () => {
      showRestoreModal.value = false;
      selectedBackup.value = null;
    };

    // Conferma il ripristino
    const confirmRestore = async () => {
      try {
        isRestoring.value = true;
        restoringBackupId.value = selectedBackup.value.id;
        
        await api.post(`/backup/backups/${selectedBackup.value.id}/restore`);
        
        // Chiudi la modale
        showRestoreModal.value = false;
        selectedBackup.value = null;
        
        // Ricarica la lista dei backup
        await loadBackups();
        
        // Emetti evento per aggiornare la struttura del DB
        emit('refresh-db-structure');

        emit('show-toast', 'Database ripristinato con successo', 'success');
        
      } catch (error) {
        console.error('Errore nel ripristino del backup:', error);
        emit('show-toast', 'Errore nel ripristino del backup', 'error');
      } finally {
        isRestoring.value = false;
        restoringBackupId.value = null;
      }
    };

    // Elimina un backup
    const deleteBackup = async (backupId) => {
      backupToDelete.value = backupId;
      showDeleteConfirmation.value = true;
    };

    const confirmDeleteBackup = async () => {
      if (!backupToDelete.value) return;
      
      try {
        isDeletingBackup.value = true;
        await api.delete(`/backup/backups/${backupToDelete.value}`);
        
        // Ricarica la lista dei backup
        await loadBackups();
        
        // Emetti il toast di successo
        emit('show-toast', 'Backup eliminato con successo', 'success');
        
        // Chiudi la modale e resetta lo stato
        showDeleteConfirmation.value = false;
        backupToDelete.value = null;
      } catch (error) {
        console.error('Errore nell\'eliminazione del backup:', error);
        emit('show-toast', 'Errore nell\'eliminazione del backup', 'error');
      } finally {
        isDeletingBackup.value = false;
      }
    };

    const cancelDeleteBackup = () => {
      showDeleteConfirmation.value = false;
      backupToDelete.value = null;
    };

    // Formatta le date - versione lunga
    const formatDate = (dateString) => {
      if (!dateString) return 'Non impostata';
      const date = new Date(dateString);
      return date.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    // Formatta le date - versione più breve per mobile
    const formatDateShort = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/(\d{2})\/(\d{2})\/(\d{2})/, '$1/$2/$3');
    };

    // Formatta i bytes in formato leggibile (KB, MB, GB)
    const formatBytes = (bytes) => {
      if (bytes === 0 || bytes === undefined) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Verifica se un backup scadrà entro un certo numero di giorni
    const isExpiringWithinDays = (dateString, days) => {
      if (!dateString) return false;
      
      const retentionDate = new Date(dateString);
      const now = new Date();
      const daysUntilExpiry = Math.floor((retentionDate - now) / (1000 * 60 * 60 * 24));
      
      return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
    };

    // Ottiene le classi CSS per la data di retention in base alla prossimità alla scadenza
    const getRetentionClasses = (dateString) => {
      if (!dateString) return 'text-gray-500 dark:text-gray-400';
      
      if (isExpiringWithinDays(dateString, 3)) {
        return 'text-yellow-600 dark:text-yellow-500 font-medium';
      }
      
      // Verifica se la data è già passata
      const retentionDate = new Date(dateString);
      const now = new Date();
      
      if (retentionDate < now) {
        return 'text-red-600 dark:text-red-500 font-medium';
      }
      
      return 'text-green-600 dark:text-green-500';
    };

    // Carica i backup e le preferenze all'avvio del componente
    onMounted(() => {
      // Carica le preferenze dal localStorage
      const savedInfoPanelState = localStorage.getItem('showBackupInfoPanel');
      if (savedInfoPanelState !== null) {
        showInfoPanel.value = savedInfoPanelState === 'true';
      }
      
      const savedLabelsPanelState = localStorage.getItem('showBackupLabelsPanel');
      if (savedLabelsPanelState !== null) {
        showLabelsPanel.value = savedLabelsPanelState === 'true';
      } else {
        // Per default, nascondi il pannello etichette
        showLabelsPanel.value = false;
      }
      
      loadBackups();
    });

    // Implementazione della funzione di download backup
    const downloadBackup = async (backup) => {
      if (isDownloading.value) return;
      
      try {
        isDownloading.value = true;
        downloadingBackupId.value = backup.id;
        
        // Richiesta API per ottenere l'URL di download del backup
        const response = await api.get(`/backup/backups/${backup.id}/download`, {
          responseType: 'blob' // Importante per gestire correttamente i file binari
        });
        
        // Crea un oggetto URL dal blob ricevuto
        const url = window.URL.createObjectURL(new Blob([response.data]));
        
        // Crea un elemento anchor invisibile per avviare il download
        const link = document.createElement('a');
        link.href = url;
        
        // Genera un nome file appropriato basato sul nome del backup e la data
        const fileName = backup.backup_name 
          ? `${backup.backup_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${formatFileDate(backup.created_at)}.sql` 
          : `backup_${backup.id}_${formatFileDate(backup.created_at)}.sql`;
        
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        
        // Simula il click per avviare il download
        link.click();
        
        // Rimuove l'elemento anchor e libera la memoria
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        emit('show-toast', 'Download del backup completato', 'success');

      } catch (error) {
        console.error('Errore nel download del backup:', error);
        // Mostra messaggio di errore all'utente
        emit('show-toast', 'Impossibile scaricare il backup. Riprova più tardi.', 'error');
      } finally {
        isDownloading.value = false;
        downloadingBackupId.value = null;
      }
    };
    
    // Funzione helper per formattare le date nel nome file
    const formatFileDate = (dateString) => {
      if (!dateString) return 'unknown_date';
      const date = new Date(dateString);
      return date.toISOString().slice(0, 10).replace(/-/g, '');
    };

    return {
      backups,
      backupLimit,
      backupWarning,
      isLoading,
      isCreatingBackup,
      isRestoring,
      isDeletingBackup,
      restoringBackupId,
      showRestoreModal,
      selectedBackup,
      totalBackups,
      manualBackupsCount,
      lastBackupDate,
      totalBackupSize,
      showInfoPanel,
      showLabelsPanel,
      toggleInfoPanel,
      toggleLabelsPanel,
      loadBackups,
      createBackup,
      showRestoreConfirmation,
      cancelRestore,
      confirmRestore,
      deleteBackup,
      showDeleteConfirmation,
      backupToDelete,
      confirmDeleteBackup,
      cancelDeleteBackup,
      extendRetention,
      formatDate,
      formatDateShort,
      formatBytes,
      isExpiringWithinDays,
      getRetentionClasses,
      hasMetadata,
      isDarkMode,
      isDownloading,
      downloadingBackupId,
      downloadBackup
    };
  }
};
</script>