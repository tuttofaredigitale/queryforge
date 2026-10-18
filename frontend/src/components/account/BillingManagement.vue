<template>
  <div class="bg-white rounded-lg shadow-md mt-6 dark:bg-gray-800 dark:border dark:border-gray-700">
    <!-- Header -->
    <div class="border-b px-4 sm:px-6 py-4 dark:border-gray-700">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 class="text-lg font-medium text-gray-800 dark:text-gray-200">
            Abbonamento e Fatturazione
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestisci il tuo piano, i pagamenti e visualizza lo storico.
          </p>
        </div>
      </div>
    </div>

    <!-- Navigazione a Schede RESPONSIVE -->
    <div>
      <!-- Menu a tendina per Mobile (visibile solo sotto il breakpoint 'sm') -->
      <div class="sm:hidden px-4 pt-4">
        <label for="tabs" class="sr-only">Seleziona una scheda</label>
        <select 
          id="tabs" 
          name="tabs" 
          v-model="activeTab" 
          class="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option v-for="tab in tabs" :key="tab.id" :value="tab.id">{{ tab.name }}</option>
        </select>
      </div>

      <!-- Barra delle schede per Desktop (nascosta sotto il breakpoint 'sm') -->
      <div class="hidden sm:block">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-6 px-6" aria-label="Tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500',
                'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none'
              ]"
            >
              <component :is="tab.icon" class="h-5 w-5 inline-block mr-1.5 -mt-0.5" />
              {{ tab.name }}
            </button>
          </nav>
        </div>
      </div>
    </div>

    <!-- Contenuto delle Schede -->
    <div class="px-4 sm:px-6 py-6">
      
      <!-- Scheda Abbonamento -->
      <div v-show="activeTab === 'subscription'">
        <div v-if="subscription">
          <dl class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 mb-6 border-b pb-6 dark:border-gray-700">
            <div class="sm:col-span-1">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Piano attuale</dt>
              <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{{ subscription.variant_name }}</dd>
            </div>
            <div class="sm:col-span-1">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Stato</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">
                <span :class="getStatusClass(subscription.status)" class="px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ getStatusText(subscription.status) }}
                </span>
              </dd>
            </div>
            <div class="sm:col-span-1">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Prezzo</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{{ formatCurrency(subscription.price) }} / {{ subscription.interval === 'year' ? 'anno' : 'mese' }}</dd>
            </div>
            <div class="sm:col-span-1" v-if="subscription.renews_at">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Prossimo rinnovo</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{{ formatDate(subscription.renews_at) }}</dd>
            </div>
             <div class="sm:col-span-1" v-if="subscription.ends_at">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Scadenza piano</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{{ formatDate(subscription.ends_at) }}</dd>
            </div>
            <div class="sm:col-span-1">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Data attivazione</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{{ formatDate(subscription.created_at) }}</dd>
            </div>
          </dl>
          <h3 class="text-base font-medium text-gray-800 dark:text-gray-200 mb-3">Gestisci piano</h3>
          <ActionsSubscription :subscription="subscription" @updated="$emit('data-updated')" />
        </div>
        <div v-else>
          <p class="text-gray-600 dark:text-gray-400">Nessun abbonamento attivo trovato.</p>
          <ProPlanPromotion class="mt-4" />
        </div>
      </div>

      <!-- Scheda Metodi di Pagamento -->
      <div v-show="activeTab === 'payment'">
        <div v-if="paymentMethod">
           <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border dark:bg-gray-700/50 dark:border-gray-600">
             <div class="flex items-center">
                <CreditCardIcon class="h-8 w-8 text-gray-500 dark:text-gray-400 mr-4"/>
                <div>
                    <p class="font-medium text-gray-800 dark:text-gray-200">{{ paymentMethod.card_brand }} che termina con {{ paymentMethod.card_last_four }}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Metodo di pagamento predefinito</p>
                </div>
             </div>
             <a :href="paymentMethod.update_url" target="_blank" class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 dark:border-gray-500 dark:hover:bg-gray-600">
                Aggiorna
             </a>
           </div>
        </div>
         <div v-else>
          <p class="text-gray-600 dark:text-gray-400">Nessun metodo di pagamento associato all'abbonamento.</p>
        </div>
      </div>

      <!-- Scheda Storico Fatture -->
      <div v-show="activeTab === 'history'">
        <div v-if="invoices && invoices.length > 0">
          <div class="flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead>
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-0">Data</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Totale</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Stato</th>
                      <th scope="col" class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <a
                          v-if="subscription?.customer_portal_url"
                          :href="subscription.customer_portal_url"
                          target="_blank"
                          class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded-md transition
                                dark:bg-indigo-700 dark:hover:bg-indigo-800"
                        >
                          <ExternalLinkIcon class="h-3 w-3" />
                          <span>Portale pagamenti</span>
                        </a>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr v-for="invoice in invoices" :key="invoice.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-200 sm:pl-0">{{ formatDate(invoice.created_at) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ formatCurrency(invoice.total) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                         <span :class="getStatusClass(invoice.status)" class="px-2.5 py-0.5 rounded-full text-xs font-medium">
                           {{ getStatusText(invoice.status) }}
                         </span>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <a :href="invoice.receipt_url" target="_blank" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                          Genera documento<span class="sr-only">, fattura {{ invoice.order_number }}</span>
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div v-else>
          <p class="text-gray-600 dark:text-gray-400">Nessuna fattura trovata.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ActionsSubscription from '@/components/account/ActionsSubscription.vue';
import ProPlanPromotion from '@/components/common/ProPlanPromotion.vue';
import { CreditCardIcon, CurrencyEuroIcon, ReceiptTaxIcon, ExternalLinkIcon } from '@heroicons/vue/outline';

defineProps({
  subscription: { type: Object, default: null },
  paymentMethod: { type: Object, default: null },
  invoices: { type: Array, default: () => [] },
});
defineEmits(['data-updated']);

const activeTab = ref('subscription');
const tabs = ref([
  { id: 'subscription', name: 'Abbonamento', icon: CurrencyEuroIcon },
  { id: 'payment', name: 'Metodo di Pagamento', icon: CreditCardIcon },
  { id: 'history', name: 'Storico Ordini', icon: ReceiptTaxIcon },
]);

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(dateString));
};
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return 'N/A';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount / 100);
};
const getStatusClass = (status) => {
  if (!status) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
  const statusMap = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    cancelled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    past_due: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    unpaid: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return statusMap[status] || statusMap.default;
};
const getStatusText = (status) => {
  if (!status || typeof status !== 'string') {
    return 'N/D'; 
  }

  const textMap = {
    active: 'Attivo',
    paid: 'Pagato',
    cancelled: 'Cancellato',
    past_due: 'In ritardo',
    unpaid: 'Non pagato',
  };
  
  return textMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
};
</script>