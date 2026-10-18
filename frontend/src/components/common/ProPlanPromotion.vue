<template>
  <div v-if="!isProPlan" class="pro-plan-promo">
    <div class="pro-plan-promo__content">
      <LightningBoltIcon class="pro-plan-promo__icon" />
      <div>
        <h3 class="pro-plan-promo__title">Potenzia la tua esperienza con QueryForge Pro</h3>
        <p class="pro-plan-promo__description">
          Query illimitate, assistenza IA e molto altro.
        </p>
      </div>
    </div>
    <button
      class="pro-plan-promo__button"
      :disabled="isCheckoutLoading"
      @click="handleUpgrade"
    >
      {{ isCheckoutLoading ? 'Caricamento...' : 'Passa a Pro' }}
    </button>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { LightningBoltIcon } from '@heroicons/vue/solid';
import { useStore } from 'vuex';
import { useToast } from 'vue-toastification';
import { createCheckoutSession } from '@/services/paymentService';

export default {
  name: 'ProPlanPromotion',
  components: { LightningBoltIcon },
  setup() {
    const store = useStore();
    const toast = useToast();
    const isCheckoutLoading = ref(false);

    // Computed to check if user is on Pro plan
    const isProPlan = computed(() => store.getters['user/isProPlan']);

    // Handle the upgrade checkout flow
    const handleUpgrade = async () => {
      isCheckoutLoading.value = true;
      try {
        const variantId = import.meta.env.VITE_PRO_MONTHLY_VARIANT_ID;
        
        console.log("ProPlanPromotion: Sto per chiamare createCheckoutSession con variantId:", variantId);
        const response = await createCheckoutSession(variantId);
        console.log("ProPlanPromotion: Risposta dal backend:", response);

        if (response && response.data && response.data.checkoutUrl) {
          const checkoutUrlString = response.data.checkoutUrl; 
          console.log("ProPlanPromotion: URL di checkout estratto:", checkoutUrlString);
          console.log("ProPlanPromotion: Sto per reindirizzare a:", checkoutUrlString);
          window.location.href = checkoutUrlString;
        } else {
          console.error("ProPlanPromotion: checkoutUrl non trovato nella risposta:", response.data);
          toast.error('Errore: URL di checkout non valido ricevuto dal server.');
        }

      } catch (err) {
        console.error('Errore avvio checkout (ProPlanPromotion):', err);
        const errorMessage = err.response?.data?.message || err.message || 'Errore durante l’avvio del checkout. Riprova più tardi.';
        toast.error(errorMessage);
      } finally {
        isCheckoutLoading.value = false;
      }
    };

    return {
      isProPlan,
      isCheckoutLoading,
      handleUpgrade
    };
  }
};
</script>

<style scoped>
.pro-plan-promo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #4f46e5 0%, #7e3af2 100%);
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.pro-plan-promo__content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pro-plan-promo__icon {
  width: 24px;
  height: 24px;
  color: #fff;
}

.pro-plan-promo__title {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 4px;
}

.pro-plan-promo__description {
  font-size: 0.875rem;
  opacity: 0.9;
}

.pro-plan-promo__button {
  background-color: white;
  color: #4338ca;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.pro-plan-promo__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pro-plan-promo__button:hover:not(:disabled) {
  background-color: #f9fafb;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
</style>
