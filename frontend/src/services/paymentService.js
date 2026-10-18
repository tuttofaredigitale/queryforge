// frontend/src/services/paymentService.js
import api from './api'; 

/**
 * Chiama il backend per creare una sessione di checkout Lemon Squeezy
 * @param {string | null} variantId - L'ID della variante LS (es. mensile/annuale). Null per usare default backend.
 * @returns {Promise<any>} - La risposta da Axios (contiene { url: '...' } in response.data)
 */
export function createCheckoutSession(variantId = null) {
  let planType = null;
  const monthlyVariantId = import.meta.env.VITE_PRO_MONTHLY_VARIANT_ID;
  const yearlyVariantId = import.meta.env.VITE_PRO_YEARLY_VARIANT_ID;

  if (variantId && monthlyVariantId && variantId.toString() === monthlyVariantId.toString()) {
    planType = 'monthly';
  } else if (variantId && yearlyVariantId && variantId.toString() === yearlyVariantId.toString()) {
    planType = 'yearly';
  } else {
    planType = 'monthly';
    if (variantId) {
      console.warn(`Variant ID ${variantId} non riconosciuto o non configurato correttamente in .env, usando default 'monthly'.`);
    }
  }

  const payload = { planType };
  const targetUrl = '/billing/checkout'; // L'endpoint corretto del backend
  
  // Ora 'api' si riferisce all'istanza importata con l'interceptor corretto
  return api.post(targetUrl, payload);
}