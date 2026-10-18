<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Logo -->
      <div class="text-center">
        <router-link to="/">
          <img src="/logoQueryForge.svg" alt="QueryForge" class="mx-auto h-16 w-auto" />
        </router-link>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Verifica in corso...
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Stiamo verificando la tua email, attendi un momento.
        </p>
      </div>

      <!-- Success State -->
      <div v-else-if="verificationSuccess" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
          <svg class="h-10 w-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ alreadyVerified ? 'Email già verificata' : 'Email verificata!' }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ alreadyVerified 
            ? 'La tua email era già stata verificata. Puoi effettuare il login.' 
            : 'Il tuo account è ora attivo. Puoi effettuare il login e iniziare ad usare QueryForge.' 
          }}
        </p>
        <router-link 
          to="/login" 
          class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          Vai al Login
          <svg class="ml-2 -mr-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
          </svg>
        </router-link>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
          <svg class="h-10 w-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Verifica fallita
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ errorMessage }}
        </p>
        
        <!-- Resend verification section -->
        <div v-if="showResendOption" class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Hai bisogno di un nuovo link di verifica?
          </p>
          
          <div v-if="!resendSuccess">
            <input
              v-model="resendEmail"
              type="email"
              placeholder="Inserisci la tua email"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white mb-3"
            />
            <button
              @click="resendVerification"
              :disabled="isResending || !resendEmail"
              class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="isResending" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Invio in corso...
              </span>
              <span v-else>Reinvia email di verifica</span>
            </button>
          </div>
          
          <div v-else class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md p-4">
            <p class="text-sm text-green-700 dark:text-green-400">
              ✓ Email inviata! Controlla la tua casella di posta.
            </p>
          </div>
        </div>

        <div class="mt-6">
          <router-link 
            to="/login" 
            class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
          >
            ← Torna al Login
          </router-link>
        </div>
      </div>

      <!-- No Token State -->
      <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900 mb-4">
          <svg class="h-10 w-10 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Token mancante
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Il link di verifica non è valido. Assicurati di aver copiato l'intero URL dall'email.
        </p>
        <router-link 
          to="/login" 
          class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
        >
          ← Torna al Login
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api';

export default {
  name: 'VerifyEmail',
  setup() {
    const route = useRoute();
    
    const isLoading = ref(true);
    const verificationSuccess = ref(false);
    const alreadyVerified = ref(false);
    const error = ref(false);
    const errorMessage = ref('');
    const showResendOption = ref(false);
    
    // Resend state
    const resendEmail = ref('');
    const isResending = ref(false);
    const resendSuccess = ref(false);

    const verifyEmail = async () => {
      const token = route.query.token;
      
      if (!token) {
        isLoading.value = false;
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        
        if (response.data.success) {
          verificationSuccess.value = true;
          alreadyVerified.value = response.data.alreadyVerified || false;
        } else {
          error.value = true;
          errorMessage.value = response.data.message || 'Errore durante la verifica';
          showResendOption.value = response.data.code === 'INVALID_OR_EXPIRED_TOKEN';
        }
      } catch (err) {
        error.value = true;
        if (err.response?.data?.message) {
          errorMessage.value = err.response.data.message;
          showResendOption.value = err.response.data.code === 'INVALID_OR_EXPIRED_TOKEN';
        } else {
          errorMessage.value = 'Si è verificato un errore durante la verifica. Riprova più tardi.';
        }
      } finally {
        isLoading.value = false;
      }
    };

    const resendVerification = async () => {
      if (!resendEmail.value || isResending.value) return;
      
      isResending.value = true;
      
      try {
        const response = await api.post('/auth/resend-verification', {
          email: resendEmail.value.trim().toLowerCase()
        });
        
        if (response.data.success) {
          resendSuccess.value = true;
          
          // Se già verificato, mostra messaggio appropriato
          if (response.data.alreadyVerified) {
            errorMessage.value = 'Questo account è già verificato. Puoi effettuare il login.';
            showResendOption.value = false;
          }
        }
      } catch (err) {
        // Mostra sempre un messaggio generico per sicurezza
        resendSuccess.value = true;
      } finally {
        isResending.value = false;
      }
    };

    onMounted(() => {
      verifyEmail();
    });

    return {
      isLoading,
      verificationSuccess,
      alreadyVerified,
      error,
      errorMessage,
      showResendOption,
      resendEmail,
      isResending,
      resendSuccess,
      resendVerification
    };
  }
};
</script>