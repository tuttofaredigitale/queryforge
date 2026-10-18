// File: src/composables/usePersistentState.js

import { ref, watch } from 'vue';

/**
 * Crea una ref reattiva il cui valore viene automaticamente salvato
 * e ripristinato dal localStorage.
 *
 * @param {string} key - La chiave univoca da usare nel localStorage.
 * @param {*} defaultValue - Il valore di default da usare se non c'è nulla nel localStorage.
 * @returns {Ref} - Una ref reattiva che si sincronizza con il localStorage.
 */
export function usePersistentState(key, defaultValue) {
  
  // 1. Legge il valore iniziale dal localStorage o usa il default.
  const storedValue = localStorage.getItem(key);
  const state = ref(storedValue ? JSON.parse(storedValue) : defaultValue);

  // 2. Osserva i cambiamenti della 'state' e li salva nel localStorage.
  watch(
    state,
    (newValue) => {
      if (newValue === null || newValue === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    },
    { deep: true } // 'deep' è utile se lo stato è un oggetto o un array.
  );

  return state;
}