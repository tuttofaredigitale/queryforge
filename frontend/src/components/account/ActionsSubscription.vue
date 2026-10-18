<template>
  <div class="bg-white rounded-lg shadow-md dark:bg-gray-800 dark:border dark:border-gray-700">
    <!-- ▸ intestazione -->
    <div class="border-b px-6 py-4 flex justify-between items-center dark:border-gray-700">
      <h2 class="text-lg font-medium text-gray-800 dark:text-gray-200">Abbonamento Pro</h2>

      <!-- pill stato -->
      <span
        :class="[
          'px-3 py-0.5 rounded-full text-xs font-semibold',
          subActive
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        ]"
      >
        {{ subActive ? 'ATTIVO' : 'NON ATTIVO' }}
      </span>
    </div>

    <!-- ▸ corpo -->
    <div class="px-6 py-5 space-y-4">
      <!-- ▲ utente con abbonamento -->
      <template v-if="subscription">
        <p class="text-sm text-gray-700 dark:text-gray-200">
          <b>Pro {{ intervalLabel }}</b> – rinnovo {{ nextRenewal }}
        </p>

        <!-- blocco azioni (v-if / v-else contigui) -->
        <template v-if="!subscription.cancelled_at">
          <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mt-3 space-y-3 sm:space-y-0">
            <!-- pulsante cancella -->
            <button
              @click="openCancelModal"
              :disabled="isCancelling || isSwitching"
              class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:bg-red-300 flex items-center justify-center"
            >
              <svg v-if="isCancelling"
                   class="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" d="M4 12A8 8 0 0112 4V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"/>
              </svg>
              <span>{{ isCancelling ? 'Annullamento…' : 'Cancella abbonamento' }}</span>
            </button>

            <!-- pulsante switch piano -->
            <button
              v-if="showSwitchButton"
              @click="openSwitchModal"
              :disabled="isSwitching || isCancelling"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center"
            >
              <svg v-if="isSwitching"
                   class="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" d="M4 12A8 8 0 0112 4V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"/>
              </svg>
              <span>{{ isSwitching ? 'Cambio piano…' : switchLabel }}</span>
            </button>
          </div>
        </template>

        <!-- ▲ abbonamento già disdetto -->
        <p v-else class="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
          Abbonamento disdetto – continuerà fino al {{ nextRenewal }}.
        </p>
      </template>

      <!-- ▲ nessun abbonamento -->
      <p v-else class="text-sm text-gray-600 dark:text-gray-400">
        Non hai un piano Pro attivo.
      </p>
    </div>
  </div>

  <!-- ▸ Modal cancellazione -->
  <teleport to="body">
    <div
      v-if="showCancelModal"
      class="fixed inset-0 flex items-center justify-center z-50 bg-black/50 px-4"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full p-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Disdire il rinnovo automatico?
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Potrai continuare a usare il piano Pro fino al {{ nextRenewal }}; dopo quella data non ti verrà addebitato nulla.
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="showCancelModal = false"
            class="btn-secondary px-4 py-2"
          >Annulla</button>
          <button
            @click="cancelSubscription"
            :disabled="isCancelling"
            class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:bg-red-300 flex items-center justify-center"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  </teleport>

  <!-- Modal conferma cambio piano -->
<teleport to="body">
    <div v-if="showSwitchModal" class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full p-6">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Passa al piano {{ switchTargetLabel }}?
        </h3>

        <div class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          <template v-if="isUpgradeScenario">
            Confermando, il tuo piano verrà aggiornato immediatamente.
            Ti verrà addebitata automaticamente la differenza di costo calcolata proporzionalmente per il periodo rimanente e la tua data di rinnovo verrà adeguata al nuovo piano. Riceverai una fattura dettagliata via email.
          </template>
          <template v-else>
            Confermando, il passaggio al piano {{ switchTargetLabel }} avverrà al termine del tuo attuale ciclo di fatturazione. Continuerai a usufruire dei benefici del piano corrente fino al {{ nextRenewal }}.
          </template>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showSwitchModal = false"
                  class="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600">
            Annulla
          </button>
          <button @click="switchPlan"
                  :disabled="isSwitching" class="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center">
            <svg v-if="isSwitching" class="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" d="M4 12A8 8 0 0112 4" stroke="currentColor" stroke-width="4"/>
            </svg>
            <span v-if="isSwitching">Cambio piano…</span>
            <span v-else>Conferma Passaggio</span> </button>
        </div>
      </div>
    </div>
  </teleport>

</template>

<script setup>
import { ref, computed } from 'vue'
import api from '@/services/api'
import { useToast } from 'vue-toastification'
import { useStore } from 'vuex'

const toast = useToast()
const store = useStore()

const props = defineProps({
  subscription: {
    type: Object,
    // Rendiamo la prop non obbligatoria, così se è null non dà errore.
    // Il template gestisce già il caso in cui `subscription` è null.
    required: false,
    default: null
  }
});
const emit = defineEmits(['updated']);

const isCancelling      = ref(false)
const isSwitching       = ref(false)
const showCancelModal   = ref(false)
const showSwitchModal   = ref(false)     

const isMonthly = computed(() => {
    if (!props.subscription?.interval) return false;
    // Controlla se la stringa dell'intervallo (in minuscolo) CONTIENE "month".
    // In questo modo funziona sia per 'month' che per 'monthly'.
    return props.subscription.interval.toLowerCase().includes('month');
});

// Helper per determinare lo scenario di upgrade/downgrade
const isUpgradeScenario = computed(() => {
  if (!props.subscription) return false;
  // È un upgrade se si passa da mensile ad annuale
  return isMonthly.value;
});

// Helper per lo stato dell'abbonamento
const subActive = computed(() => !!props.subscription && !props.subscription.cancelled_at);

// Helper per formattare la data di rinnovo
const nextRenewal = computed(() => {
  if (!props.subscription) return '';
  const rawDate = props.subscription.renews_at || props.subscription.ends_at;
  if (!rawDate) return '—';
  const d = new Date(rawDate);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
});

// Proprietà calcolate che ora usano 'isMonthly' come unica fonte di verità
const switchTargetType = computed(() => {
  if (!props.subscription) return null;
  return isMonthly.value ? 'yearly' : 'monthly';
});

const switchLabel = computed(() => {
  if (!props.subscription) return '';
  return isMonthly.value ? 'Passa ad Annuale' : 'Passa a Mensile';
});

const switchTargetLabel = computed(() => {
  if (!props.subscription) return '';
  return isMonthly.value ? 'Pro Annuale' : 'Pro Mensile';
});

const showSwitchButton = computed(() => subActive.value && !!switchTargetType.value);

const intervalLabel = computed(() => {
  if (!props.subscription) return '';
  return isMonthly.value ? 'Mensile' : 'Annuale';
});

function openCancelModal () {
  showCancelModal.value = true
}

function openSwitchModal () {
  showSwitchModal.value = true
}

async function cancelSubscription() {
  if (!props.subscription) return;
  
  isCancelling.value = true;
  try {
    await api.post('/billing/cancel', { subscriptionId: props.subscription.id });
    
    showCancelModal.value = false;
    toast.success(`Il rinnovo automatico è stato cancellato.`);
    
    // Notifica il componente genitore che i dati sono cambiati e devono essere ricaricati.
    emit('updated');
    // Aggiorna anche lo store se necessario
    await store.dispatch('user/loadUserSubscription');

  } catch (e) {
    // Gestione errore CORRETTA
    console.error("Errore durante la cancellazione:", e);
    toast.error(e.response?.data?.message || 'Si è verificato un errore durante la cancellazione.');
  } finally {
    isCancelling.value = false;
  }
}

async function switchPlan() {
  if (!switchTargetType.value) return;

  isSwitching.value = true;
  try {
    await api.post('/billing/change-plan', { planType: switchTargetType.value });
    
    toast.success('Piano aggiornato con successo!');
    showSwitchModal.value = false;
    
    // Notifica il componente genitore che i dati sono cambiati e devono essere ricaricati.
    emit('updated');
    // Aggiorna anche lo store se necessario
    await store.dispatch('user/loadUserSubscription');

  } catch (e) {
    // Gestione errore CORRETTA
    console.error("Errore durante il cambio piano:", e);
    toast.error(e.response?.data?.message || 'Si è verificato un errore durante il cambio piano.');
  } finally {
    isSwitching.value = false;
  }
}

</script>
