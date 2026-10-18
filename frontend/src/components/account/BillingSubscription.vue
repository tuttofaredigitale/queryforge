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
console.log('*** MODULO COMPONENTE ABBONAMENTO CARICATO CORRETTAMENTE ***');
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'
import { useToast } from 'vue-toastification'
import { useStore } from 'vuex'

const toast = useToast()
const store = useStore()

// stato
const subscription      = ref(null)
const isLoading         = ref(true)
const isCancelling      = ref(false)
const isSwitching       = ref(false)
const showCancelModal   = ref(false)
const showSwitchModal   = ref(false)     

// Helper per determinare in modo sicuro se il piano è mensile
const isMonthly = computed(() => {
    if (!subscription.value?.interval) return false;
    // Controlla se la stringa dell'intervallo (in minuscolo) CONTIENE "month".
    // In questo modo funziona sia per 'month' che per 'monthly'.
    return subscription.value.interval.toLowerCase().includes('month');
});

// Helper per determinare lo scenario di upgrade/downgrade
const isUpgradeScenario = computed(() => {
  if (!subscription.value) return false;
  // È un upgrade se si passa da mensile ad annuale
  return isMonthly.value;
});

// Helper per lo stato dell'abbonamento
const subActive = computed(() => !!subscription.value && !subscription.value.cancelled_at);

// Helper per formattare la data di rinnovo
const nextRenewal = computed(() => {
  if (!subscription.value) return '';
  const rawDate = subscription.value.renews_at || subscription.value.ends_at;
  if (!rawDate) return '—';
  const d = new Date(rawDate);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
});

// Proprietà calcolate che ora usano 'isMonthly' come unica fonte di verità
const switchTargetType = computed(() => {
  if (!subscription.value) return null;
  return isMonthly.value ? 'yearly' : 'monthly';
});

const switchLabel = computed(() => {
  if (!subscription.value) return '';
  return isMonthly.value ? 'Passa ad Annuale' : 'Passa a Mensile';
});

const switchTargetLabel = computed(() => {
  if (!subscription.value) return '';
  return isMonthly.value ? 'Pro Annuale' : 'Pro Mensile';
});

const showSwitchButton = computed(() => subActive.value && !!switchTargetType.value);

const intervalLabel = computed(() => {
  if (!subscription.value) return '';
  return isMonthly.value ? 'Mensile' : 'Annuale';
});

// methods
async function loadSubscription () {
  console.log('1. Funzione loadSubscription INIZIATA.');
  try {
    isLoading.value = true;
    console.log('2. Chiamata API a /billing/subscription IN CORSO...');
    
    const { data } = await api.get('/billing/subscription');
    
    console.log('3. Chiamata API RIUSCITA. Dati ricevuti:', data);

    subscription.value = data.subscription || null;
    console.log('4. Oggetto subscription assegnato:', subscription.value);

  } catch (e) {
    console.error('5. ERRORE! Esecuzione saltata nel blocco CATCH.');
    console.error('Dettaglio errore catturato dal frontend:', e);
    
    // Mostriamo anche l'errore specifico se disponibile dalla risposta del server
    if (e.response) {
      console.error('Dati errore dalla risposta del server:', e.response.data);
    }

    toast.error('Impossibile recuperare lo stato dell’abbonamento');
  } finally {
    isLoading.value = false;
    console.log('6. Blocco FINALLY eseguito.');
  }
}

function openCancelModal () {
  showCancelModal.value = true
}

async function cancelSubscription () {
  if (!subscription.value) return
  try {
    isCancelling.value = true
    const { data } = await api.post('/subscription/cancel', { subscriptionId: subscription.value.id })
    subscription.value.cancelled_at = data.cancelled_at
    subscription.value.ends_at      = data.ends_at
    showCancelModal.value = false
    toast.success(`Abbonamento annullato. Rimarrà attivo fino al ${nextRenewal.value}.`)
    await store.dispatch('user/loadUserSubscription') 
  } catch (e) {
    console.error(e)
    toast.error(e.response?.data?.message || 'Errore durante la cancellazione')
  } finally {
    isCancelling.value = false
  }
}


function openSwitchModal () {
  showSwitchModal.value = true
}

async function switchPlan () {
  if (!switchTargetType.value) return
  try {
    isSwitching.value = true
    const { data } = await api.post('/subscription/change-plan', { planType: switchTargetType.value })
    toast.success('Piano aggiornato con successo!')
    showSwitchModal.value = false
    await loadSubscription() // ricarica dettagli aggiornati locali
    await store.dispatch('user/loadUserSubscription') 
  } catch (e) {
    console.error(e)
    toast.error(e.response?.data?.message || 'Errore durante il cambio piano')
  } finally {
    isSwitching.value = false
  }
}


onMounted(loadSubscription)
</script>
