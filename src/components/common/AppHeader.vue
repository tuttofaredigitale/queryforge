<template>
  <header>
    <div class="bg-gradient-to-r from-zinc-800 via-indigo-600 to-indigo-700 text-white shadow-md dark:bg-gray-900">
      <div
        class="container mx-auto px-4 py-3 flex justify-between items-center"
      >
        <router-link to="/" class="flex items-center space-x-2" title="Torna alla pagina iniziale">
          <LogoQueryForge class="h-10 w-10" alt="QueryForge Logo" />
          <h1 class="text-xl font-bold" style="font-family: 'Montserrat', sans-serif;">QueryForge</h1>
        </router-link>

        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          class="p-2 rounded-md text-white md:hidden focus:outline-none"
          aria-label="Menu principale"
        >
          <MenuIcon v-if="!isMobileMenuOpen" class="h-6 w-6" />
          <XIcon v-else class="h-6 w-6" />
        </button>

        <div class="hidden md:flex items-center space-x-2">
          <span class="text-xs text-indigo-100 mr-2" title="Il database è salvato nel tuo browser: niente account, niente server">
            Database nel tuo browser
          </span>
          <button
            class="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-800 rounded-md transition mr-2"
            @click="requestReset"
            :disabled="isResetting"
          >
            <span v-if="isResetting">Resettando...</span>
            <span v-else>Reset Database</span>
          </button>
          <button
            @click="toggleDarkMode"
            class="p-2 ml-2 rounded-md text-gray-200 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors dark:hover:bg-indigo-800"
            :title="isDarkMode ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'"
          >
            <svg
              v-if="isDarkMode"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 theme-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 theme-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isMobileMenuOpen"
      class="md:hidden bg-indigo-600 text-white shadow-md dark:bg-gray-800 py-2 px-4"
    >
      <div class="flex flex-col space-y-2">
        <p class="text-xs text-indigo-100 py-1">Il database è salvato nel tuo browser: niente account, niente server.</p>

        <button
          class="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md transition flex items-center justify-center"
          @click="requestReset"
          :disabled="isResetting"
        >
          <RefreshIcon class="h-4 w-4 mr-2" />
          <span v-if="isResetting">Resetting...</span>
          <span v-else>Reset Database</span>
        </button>

        <button
          @click="toggleDarkMode"
          class="px-3 py-2 rounded-md text-white hover:bg-indigo-700 flex items-center justify-center"
        >
          <svg
            v-if="isDarkMode"
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span>{{ isDarkMode ? 'Passa al tema chiaro' : 'Passa al tema scuro' }}</span>
        </button>

        <div class="pt-2 border-t border-indigo-500 dark:border-gray-700 mt-2 flex justify-center">
          <button
            @click="isMobileMenuOpen = false"
            class="text-sm text-indigo-200 hover:text-white flex items-center"
          >
            <XIcon class="h-4 w-4 mr-1" />
            <span>Chiudi menu</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue';
import { useTheme } from '@/composables/useTheme.js';
import LogoQueryForge from '@/assets/images/logoQueryForge.svg';
import {
  MenuIcon,
  XIcon,
  RefreshIcon
} from "@heroicons/vue/outline";

// Definizione Props
defineProps({
  isResetting: {
    type: Boolean,
    default: false
  }
});

// Definizione Emit
const emit = defineEmits(['request-reset']);

const { isDarkMode, toggleDarkMode } = useTheme();

// Stato locale dell'Header
const isMobileMenuOpen = ref(false);

const requestReset = () => {
  isMobileMenuOpen.value = false; // Chiudi il menu mobile se aperto
  emit('request-reset');
};
</script>

<style scoped>
/* Stile necessario per l'animazione dell'icona del tema */
.theme-icon {
  transition: transform 0.5s ease;
}
</style>
