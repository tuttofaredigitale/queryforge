// File: src/composables/useToasts.js

import { ref } from 'vue';

const toasts = ref([]);
let nextToastId = 0;

export function useToasts() {

  /**
   * Mostra un toast a schermo.
   * @param {string} message - Il messaggio da mostrare.
   * @param {('success'|'error'|'info'|'warning')} [type='info'] - Il tipo di toast.
   * @param {number} [duration=3000] - La durata in millisecondi.
   */
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = nextToastId++;
    toasts.value.push({
      id,
      message,
      type,
    });
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  /**
   * Rimuove un toast specifico dallo schermo.
   * @param {number} id - L'ID del toast da rimuovere.
   */
  const removeToast = (id) => {
    const index = toasts.value.findIndex(toast => toast.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  // Un oggetto helper per chiamare facilmente i toast tipizzati
  const toast = {
    success: (message) => showToast(message, 'success'),
    error: (message) => showToast(message, 'error'),
    info: (message) => showToast(message, 'info'),
    warning: (message) => showToast(message, 'warning'),
  };

  // Esponiamo lo stato (la lista dei toast) e le funzioni per manipolarlo.
  return {
    toasts,
    removeToast,
    toast,
  };
}