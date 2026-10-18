<!-- src/components/playground/QueryCounter.vue -->

<template>
  <!-- 1. Stato di Caricamento: mostrato finché isLoading è true -->
  <div v-if="isLoading" class="query-counter query-counter--loading">
    <span class="text-xs text-gray-400 dark:text-gray-500">Caricamento uso...</span>
  </div>

  <!-- 2. Utente PRO: condizione semplice e diretta -->
  <div v-else-if="isProPlan" class="query-counter" :class="{ 'query-counter--low': isLow }">
    <div class="query-counter__icon">
      <DatabaseIcon class="w-5 h-5" />
    </div>
    <div class="query-counter__content">
      <div class="query-counter__title">
        Query illimitate
      </div>
    </div>
  </div>

  <!-- 3. Utente FREE: condizione semplice e diretta, mostra solo se usageData esiste -->
  <div v-else-if="usageData" class="query-counter" :class="{ 'query-counter--low': isLow }">
    <div class="query-counter__icon">
      <DatabaseIcon class="w-5 h-5" />
    </div>
    <div class="query-counter__content">
      <div class="query-counter__title">
        {{ usageData.remaining ?? '?' }} / {{ usageData.limit ?? '∞' }} rimanenti
      </div>
      <div class="query-counter__subtitle">
        <span v-if="isLow" class="text-red-600">Limite quasi raggiunto, si resetta a mezzanotte</span>

      </div>
    </div>
    <!-- <button
      class="query-counter__upgrade-btn"
      :disabled="isCheckoutLoading"
      @click="handleUpgrade"
    >
      {{ isCheckoutLoading ? 'Caricamento...' : 'Passa a Pro' }}
    </button> -->
  </div>

  <!-- 4. Fallback: mostrato solo se il caricamento è finito e nessuna delle condizioni sopra è vera -->
  <div v-else class="query-counter query-counter--error">
    <span class="text-xs text-gray-500 dark:text-gray-400">Dati uso non disp.</span>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { createCheckoutSession } from '@/services/paymentService';
import { useToast } from 'vue-toastification';
import { DatabaseIcon } from '@heroicons/vue/solid';

const store = useStore();
const toast = useToast();

const userProfile = computed(() => store.getters['user/userProfile']);
const isLoading = computed(() => store.getters['user/isLoadingProfile']);

const isProPlan = computed(() => userProfile.value?.plan?.toLowerCase() === 'pro');
const usageData = computed(() => userProfile.value?.queryUsage);

// RIMOSSA la computed 'shouldShowCounter', non è più necessaria.

const isLow = computed(() => {
  if (isProPlan.value || !usageData.value) return false;
  const remaining = usageData.value.remaining;
  const limit = usageData.value.limit;
  if (limit > 0 && typeof remaining === 'number' && (remaining / limit) <= 0.20) return true;
  return typeof remaining === 'number' && remaining <= 10;
});

const isCheckoutLoading = ref(false);

async function handleUpgrade() {
  isCheckoutLoading.value = true;
  try {
    const variantId = import.meta.env.VITE_PRO_MONTHLY_VARIANT_ID;
    const response = await createCheckoutSession(variantId);
    if (response?.data?.checkoutUrl) {
      window.location.href = response.data.checkoutUrl;
    } else {
      toast.error('Errore: URL di checkout non valido ricevuto dal server.');
    }
  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message || 'Errore durante l’avvio del checkout.';
    toast.error(errorMessage);
  } finally {
    isCheckoutLoading.value = false;
  }
}
</script>

<style scoped>
/* Gli stili rimangono esattamente gli stessi */
.query-counter {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: #f3f4f6;
  border-radius: 8px;
  max-width: 100%;
  color: #111827;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
.dark .query-counter {
  background-color: #374151;
  color: #d1d5db;
}
.query-counter--low {
  background-color: #fef2f2;
  border: 1px solid #fee2e2;
  color: #991b1b;
}
.dark .query-counter--low {
  background-color: rgba(153, 27, 27, 0.3);
  border-color: rgba(185, 28, 28, 0.5);
  color: #fca5a5;
}
.query-counter--loading,
.query-counter--error {
    background-color: #f9fafb;
    color: #6b7280;
    justify-content: center;
    font-style: italic;
}
.dark .query-counter--loading,
.dark .query-counter--error {
     background-color: #4b5563;
     color: #9ca3af;
}

.query-counter__icon {
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.query-counter--low .query-counter__icon {
  color: #ef4444;
}
.dark .query-counter--low .query-counter__icon {
  color: #f87171;
}
.query-counter__content {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.query-counter__title {
  font-weight: 600;
  font-size: 0.9rem;
}
.query-counter__subtitle {
  font-size: 0.75rem;
  color: #6b7280;
}
.dark .query-counter__subtitle {
   color: #9ca3af;
}
.query-counter__subtitle .text-red-600 {
   color: #dc2626;
}
.dark .query-counter__subtitle .text-red-600 {
   color: #f87171;
}
.query-counter__upgrade-btn {
  padding: 4px 10px;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
  white-space: nowrap;
  flex-shrink: 0;
}
.query-counter__upgrade-btn:hover {
  background-color: #4338ca;
}
.dark .query-counter__upgrade-btn {
  background-color: #4f46e5;
}
.dark .query-counter__upgrade-btn:hover {
  background-color: #4338ca;
}
</style>