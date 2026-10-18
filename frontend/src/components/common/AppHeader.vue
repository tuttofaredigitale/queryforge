<template>
  <header>
    <div class="bg-gradient-to-r from-zinc-800 via-indigo-600 to-indigo-700 text-white shadow-md dark:bg-gray-900">
      <div
        class="container mx-auto px-4 py-3 flex justify-between items-center"
      >
        <div class="flex items-center space-x-2">
          <LogoQueryForge class="h-10 w-10" alt="QueryForge Logo" />
          <h1 class="text-xl font-bold hidden sm:inline" style="font-family: 'Montserrat', sans-serif;">QueryForge</h1>
          <h1 class="text-xl font-bold sm:hidden" style="font-family: 'Montserrat', sans-serif;">QueryForge</h1>
          <div class="hidden md:flex">
            <QueryCounter :update-trigger="queryExecutionCount"/>
          </div>
        </div>

        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          class="p-2 rounded-md text-white md:hidden focus:outline-none"
          aria-label="Menu principale"
        >
          <MenuIcon v-if="!isMobileMenuOpen" class="h-6 w-6" />
          <XIcon v-else class="h-6 w-6" />
        </button>

        <div class="hidden md:flex items-center space-x-2">
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
          <div class="relative">
            <button
              ref="userMenuButton"
              @click="toggleUserMenu"
              class="flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-800 rounded-md transition-colors user-menu-button"
              :disabled="isLoggingOut"
            >
              <div v-if="isLoggingOut" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white">
                </div>
              <div v-else class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
                  {{ userInitials }}
                </div>
                <span class="hidden sm:inline">{{ userName }}</span>
                <span v-if="isProUser"
                      class="ml-1 px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-yellow-300 rounded-full shadow-sm dark:text-yellow-300 dark:bg-indigo-800">
                  PRO
                </span>
                <svg
                  class="h-4 w-4 transition-transform duration-200"
                  :class="{'rotate-180': isUserMenuOpen}"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>

            <div
              v-if="isUserMenuOpen"
              ref="userMenuDropdown"
              class="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 user-menu-dropdown dark:bg-gray-800 dark:text-gray-800 dark:border dark:border-gray-700"
            >
              <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-200">{{ userFullName }}</div>
                <div class="text-sm text-gray-500">{{ userEmail }}</div>
              </div>

              <router-link
                to="/profilo"
                class="block px-4 py-2 text-sm text-gray-500 hover:bg-indigo-50 flex items-center"
                @click="isUserMenuOpen = false"
              >
                <UserIcon class="h-4 w-4 mr-2 text-gray-500" />
                Il mio profilo
              </router-link>

              <div class="border-t border-gray-100 my-1 dark:border-gray-700"></div>

              <button
                @click="logout"
                :disabled="isLoggingOut"
                class="w-full text-left block px-4 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 flex items-center"
              >
                <LogoutIcon class="h-4 w-4 mr-2 text-gray-500" />
                {{ isLoggingOut ? 'Uscita in corso...' : 'Logout' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="w-full flex justify-center py-2 md:hidden">
      <QueryCounter :update-trigger="queryExecutionCount" />
    </div>
    </div>

    <div
      v-if="isMobileMenuOpen"
      class="md:hidden bg-indigo-600 text-white shadow-md dark:bg-gray-800 py-2 px-4"
    >
      <div class="flex flex-col space-y-2">
        <div class="py-2 border-b border-indigo-500 dark:border-gray-700">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold mr-3">
              {{ userInitials }}
            </div>
            <div>
              <div class="font-medium">{{ userFullName }}</div>
              <div class="text-xs text-indigo-200">{{ userEmail }}</div>
              <span v-if="isProUser"
                    class="mt-1 inline-block px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-yellow-300 rounded-full shadow-sm dark:text-yellow-300 dark:bg-indigo-600">
                PRO
              </span>
            </div>
          </div>
        </div>

        <router-link
          to="/profilo"
          class="px-3 py-2 rounded-md text-white hover:bg-indigo-700 flex items-center"
          @click="isMobileMenuOpen = false"
        >
          <UserIcon class="h-4 w-4 mr-2" />
          <span>Il mio profilo</span>
        </router-link>

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

        <button
          @click="logout"
          :disabled="isLoggingOut"
          class="px-3 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 rounded-md transition flex items-center justify-center"
        >
          <LogoutIcon class="h-4 w-4 mr-2" />
          <span>{{ isLoggingOut ? 'Uscita in corso...' : 'Logout' }}</span>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useTheme } from '@/composables/useTheme.js';
import LogoQueryForge from '@/assets/images/logoQueryForge.svg';
// Assicurati che il percorso relativo sia corretto
import QueryCounter from '../playground/QueryCounter.vue';
import {
  MenuIcon,
  XIcon,
  UserIcon,
  LogoutIcon,
  RefreshIcon
} from "@heroicons/vue/outline";

// Definizione Props
const props = defineProps({
  queryExecutionCount: {
    type: Number,
    default: 0
  },
  isResetting: {
    type: Boolean,
    default: false
  }
});

// Definizione Emit
const emit = defineEmits(['request-reset']);

const store = useStore();
const router = useRouter();
const { isDarkMode, toggleDarkMode } = useTheme();

// Stato locale dell'Header
const isLoggingOut = ref(false);
const isUserMenuOpen = ref(false);
const isMobileMenuOpen = ref(false);
const userMenuButton = ref(null);
const userMenuDropdown = ref(null);

// Dati utente (Accesso diretto allo Store)
const isProUser = computed(() => store.getters['user/isProPlan']);
const user = computed(() => store.getters["auth/user"]);

const userName = computed(() => user.value?.nome || user.value?.name || user.value?.username || 'Utente');
const userEmail = computed(() => user.value?.email || 'email@esempio.com');
const userFullName = computed(() => user.value?.nome_completo || user.value?.fullName || userName.value);
const userInitials = computed(() => userName.value.charAt(0).toUpperCase());

// Metodi
const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value;
};

const requestReset = () => {
  isMobileMenuOpen.value = false; // Chiudi il menu mobile se aperto
  emit('request-reset');
};

const logout = async () => {
  try {
    isLoggingOut.value = true;
    await store.dispatch("auth/logout");
    sessionStorage.setItem('userLoggedOut', 'true');
    router.push("/login");
  } catch (error) {
    console.error("Errore durante il logout:", error);
    // Forza il reindirizzamento anche in caso di errore
    sessionStorage.setItem('userLoggedOut', 'true');
    router.push("/login");
  } finally {
    isLoggingOut.value = false;
  }
};

// Gestione click esterno per chiudere il menu utente
const clickOutsideHandler = (event) => {
  if (isUserMenuOpen.value && userMenuDropdown.value && userMenuButton.value &&
      !userMenuDropdown.value.contains(event.target) &&
      !userMenuButton.value.contains(event.target)) {
    isUserMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', clickOutsideHandler);
});

onUnmounted(() => {
  document.removeEventListener('click', clickOutsideHandler);
});
</script>

<style scoped>
/* Stile necessario per l'animazione dell'icona del tema */
.theme-icon {
  transition: transform 0.5s ease;
}
</style>