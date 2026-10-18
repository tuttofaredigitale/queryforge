// File: src/composables/useTheme.js

import { ref, onMounted, onUnmounted } from 'vue';

// La variabile di stato per il tema
const isDarkMode = ref(false);

/**
 * Un Composable per gestire il tema Dark/Light dell'applicazione,
 * salvando la preferenza dell'utente nel localStorage.
 */
export function useTheme() {

  // Funzione per applicare il tema al tag <html>
  const applyTheme = () => {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Funzione per alternare il tema
  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value;
    localStorage.setItem('sql-playground-dark-mode', isDarkMode.value.toString());
    applyTheme();
  };

  // Funzione di inizializzazione per controllare le preferenze salvate o di sistema
  const initTheme = () => {
    const savedPreference = localStorage.getItem('sql-playground-dark-mode');
    
    if (savedPreference !== null) {
      isDarkMode.value = savedPreference === 'true';
    } else {
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyTheme();
  };

  // Listener per rilevare cambiamenti nel tema di sistema operativo
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleSystemThemeChange = (e) => {
    // Aggiorna solo se l'utente non ha già impostato una preferenza manuale
    if (localStorage.getItem('sql-playground-dark-mode') === null) {
      isDarkMode.value = e.matches;
      applyTheme();
    }
  };

  // Quando il composable viene usato per la prima volta in un componente,
  // inizializza il tema e aggiungi il listener.
  onMounted(() => {
    initTheme();
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  });

  // Quando il componente che usa il composable viene smontato,
  // pulisci il listener per evitare memory leaks.
  onUnmounted(() => {
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
  });

  // Esponiamo lo stato (isDarkMode) e la funzione per cambiarlo.
  return {
    isDarkMode,
    toggleDarkMode,
  };
}