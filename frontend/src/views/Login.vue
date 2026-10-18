<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 px-4">
    
    <!-- Toast container -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      <transition-group name="toast">
        <div
          v-for="toastItem in toasts"
          :key="toastItem.id"
          class="flex items-center max-w-md py-3 px-4 shadow-lg rounded-md transform transition-all duration-300"
          :class="[
            toastItem.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : '',
            toastItem.type === 'error'   ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' : '',
            toastItem.type === 'info'    ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' : '',
            toastItem.type === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : ''
          ]"
        >
          <!-- Icone toast -->
          <svg v-if="toastItem.type === 'success'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <svg v-else-if="toastItem.type === 'error'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <svg v-else-if="toastItem.type === 'info'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <svg v-else-if="toastItem.type === 'warning'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          
          <div class="flex-grow pr-1">{{ toastItem.message }}</div>
          <button @click="removeToast(toastItem.id)" class="ml-2 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </transition-group>
    </div>

    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-200">
        Accedi al tuo account
      </h2>
    </div>

    <div class="w-full max-w-md mt-8">
      <div class="bg-white dark:bg-gray-800 py-8 px-4 shadow rounded-lg sm:px-10">
        <form class="space-y-6" @submit.prevent="handleLogin">
          <!-- Campo Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                autofocus
                class="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              />
            </div>
          </div>

          <!-- Campo Password -->
          <div>
            <div class="flex items-center justify-between">
                <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <div class="text-sm">
                    <button
                        type="button"
                        @click="showForgotPasswordModal = true"
                        class="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                        Password dimenticata?
                    </button>
                </div>
            </div>

            <div class="mt-1">
              <input
                id="password"
                v-model="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              />
            </div>
          </div>

          <!-- Pulsante Submit -->
          <div>
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <span v-if="!isLoading">Accedi</span>
              <span v-else>Caricamento...</span>
            </button>
          </div>

          <div v-if="error" class="mt-2 text-red-600 text-sm text-center">{{ error }}</div>

          <div class="text-sm text-center mt-4">
            <RouterLink to="/register" class="font-medium text-indigo-600 hover:text-indigo-500">
              Non hai un account? Registrati
            </RouterLink>
          </div>
        </form>
      </div>
    </div>

    <div class="text-center mt-8 mb-8">
    <router-link to="/" class="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium inline-flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Torna alla Home
    </router-link>
  </div>

    <!-- Modal per reset password -->
    <div v-if="showForgotPasswordModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <!-- header -->
        <div class="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-medium text-indigo-600 dark:text-indigo-400">Recupero password</h3>
          <button @click="closeForgotPasswordModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- body -->
        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Inserisci l'email per ricevere link di reset.</p>
          <input v-model="resetEmail" type="email" autocomplete="email" placeholder="Email" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500 mb-2" />
          <div v-if="resetError" class="p-3 bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded mb-2">{{ resetError }}</div>
          <div v-if="resetSuccess" class="p-3 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded mb-2">{{ resetSuccess }}</div>
        </div>
        <!-- footer -->
        <div class="px-6 py-4 border-t dark:border-gray-700 flex justify-end space-x-3">
          <button @click="closeForgotPasswordModal" class="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Annulla</button>
          <button @click="requestPasswordReset" :disabled="isPasswordResetLoading" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center">
            <svg v-if="isPasswordResetLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            <span v-if="!isPasswordResetLoading">Invia link</span>
            <span v-else>Invio...</span>
          </button>
        </div>
      </div>
    </div>

    <!-- =====================================================
         NUOVO: Modal per reinvio verifica email
         ===================================================== -->
    <ResendVerificationModal
      :is-open="showVerificationModal"
      :email="unverifiedEmail"
      @close="showVerificationModal = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import api from '@/services/api';
import { useToasts } from '@/composables/useToasts.js';
// NUOVO: Import del componente per reinvio verifica
import ResendVerificationModal from '@/components/common/ResendVerificationModal.vue';

const store = useStore();
const router = useRouter();
const route = useRoute();
const { toasts, toast, removeToast } = useToasts();

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref('');

// Stato Modale Password Dimenticata
const showForgotPasswordModal = ref(false);
const resetEmail = ref('');
const resetError = ref('');
const resetSuccess = ref('');
const isPasswordResetLoading = ref(false);

// =====================================================
// NUOVO: Stato per modale verifica email
// =====================================================
const showVerificationModal = ref(false);
const unverifiedEmail = ref('');

// Gestione feedback post-azione 
onMounted(() => {
  // Gestione legacy sessionStorage 
  if (sessionStorage.getItem('userLoggedOut')) {
    toast.success('Logout effettuato con successo');
    sessionStorage.removeItem('userLoggedOut');
  }

  // Gestione moderna tramite query parameters
  const query = route.query;

  // Aggiunto supporto per ?status=loggedOut se si decidesse di usarlo
  if (query.status === 'loggedOut') {
    toast.success('Logout effettuato con successo');
  }
  
  // Gestione Account Eliminato
  if (query.accountDeleted === 'true') {
    toast.info('Il tuo account è stato eliminato con successo.');
  }

  // NUOVO: Gestione email appena verificata
  if (query.verified === 'true') {
    toast.success('Email verificata con successo! Ora puoi accedere.');
  }

  // Pulisce l'URL se sono presenti parametri gestiti
  if (Object.keys(query).length > 0) {
    router.replace({ path: route.path, query: {} });
  }
});

const handleLogin = async () => {
  isLoading.value = true;
  error.value = '';
  try {
    await store.dispatch('auth/login', { email: email.value, password: password.value });
    router.push('/playground');
  } catch (err) {
    // =====================================================
    // NUOVO: Gestione errore EMAIL_NOT_VERIFIED
    // =====================================================
    if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
      // Mostra modale per reinvio verifica
      unverifiedEmail.value = err.response.data.email || email.value;
      showVerificationModal.value = true;
      error.value = ''; // Non mostrare errore nel form
      return;
    }
    // =====================================================

    const errorMessage = err.response?.data?.message || 'Credenziali non valide o errore di connessione.';
    error.value = errorMessage;
    toast.error(errorMessage);
  } finally {
    isLoading.value = false;
  }
};

const requestPasswordReset = async () => {
  if (!resetEmail.value) {
    resetError.value = "Inserisci un indirizzo email valido.";
    return;
  }
  resetError.value = '';
  resetSuccess.value = '';
  isPasswordResetLoading.value = true;
  try {
    const res = await api.post('/auth/forgot-password', { email: resetEmail.value });
    if (res.data.success) {
      // Messaggio generico per sicurezza 
      resetSuccess.value = 'Se l\'indirizzo email è registrato, riceverai un link per il reset.';
      setTimeout(closeForgotPasswordModal, 5000);
    } else {
      resetError.value = res.data.message || 'Si è verificato un errore.';
    }
  } catch (e) {
    resetError.value = e.response?.data?.message || 'Errore durante l\'invio della richiesta.';
  } finally {
    isPasswordResetLoading.value = false;
  }
};

const closeForgotPasswordModal = () => {
  showForgotPasswordModal.value = false;
  resetEmail.value = '';
  resetError.value = '';
  resetSuccess.value = '';
};
</script>

<style scoped>
/* Stili per le animazioni dei toast */
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from { opacity: 0; transform: translateX(30px); }
.toast-leave-to { opacity: 0; transform: translateX(100%); }
</style>