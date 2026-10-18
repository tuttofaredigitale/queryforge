<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <router-link to="/">
          <img src="/logoQueryForge.svg" alt="QueryForge" class="mx-auto h-16 w-auto" />
        </router-link>
      </div>

      <!-- Success Card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <!-- Header with checkmark -->
        <div class="bg-green-500 px-6 py-8 text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-white mb-4">
            <svg class="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">
            Registrazione completata!
          </h1>
        </div>

        <!-- Content -->
        <div class="px-6 py-6">
          <div class="text-center mb-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Controlla la tua email
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              Abbiamo inviato un link di verifica a:
            </p>
            <p class="font-medium text-indigo-600 dark:text-indigo-400 mt-1">
              {{ email }}
            </p>
          </div>

          <!-- Instructions -->
          <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
            <h3 class="font-medium text-blue-900 dark:text-blue-300 mb-2 flex items-center">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Cosa fare ora:
            </h3>
            <ol class="list-decimal list-inside text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>Apri la tua casella email</li>
              <li>Cerca l'email da QueryForge</li>
              <li>Clicca sul link "Verifica Email"</li>
              <li>Torna qui e accedi</li>
            </ol>
          </div>

          <!-- Warning -->
          <div class="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 mb-6">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700 dark:text-yellow-400">
                  Non trovi l'email? Controlla la cartella <strong>spam</strong> o <strong>promozioni</strong>.
                </p>
              </div>
            </div>
          </div>

          <!-- Resend section -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div v-if="!resendSuccess" class="text-center">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Non hai ricevuto l'email?
              </p>
              <button
                @click="resendVerification"
                :disabled="isResending || cooldown > 0"
                class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span v-if="isResending" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Invio...
                </span>
                <span v-else-if="cooldown > 0">
                  Riprova tra {{ cooldown }}s
                </span>
                <span v-else>
                  <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Reinvia email
                </span>
              </button>
            </div>
            <div v-else class="text-center">
              <div class="inline-flex items-center text-green-600 dark:text-green-400">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Email reinviata con successo!
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 dark:bg-gray-700 px-6 py-4">
          <router-link 
            to="/login"
            class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Vai al Login
            <svg class="ml-2 -mr-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';

export default {
  name: 'RegistrationSuccess',
  setup() {
    const route = useRoute();
    const router = useRouter();
    
    const email = ref('');
    const isResending = ref(false);
    const resendSuccess = ref(false);
    const cooldown = ref(0);
    let cooldownInterval = null;

    onMounted(() => {
      // Get email from query param or sessionStorage
      email.value = route.query.email || sessionStorage.getItem('registrationEmail') || '';
      
      // If no email, redirect to register
      if (!email.value) {
        router.push('/register');
      }
      
      // Clean up sessionStorage
      sessionStorage.removeItem('registrationEmail');
    });

    const resendVerification = async () => {
      if (isResending.value || cooldown.value > 0 || !email.value) return;

      isResending.value = true;

      try {
        await api.post('/auth/resend-verification', {
          email: email.value.trim().toLowerCase()
        });
        
        resendSuccess.value = true;
        
        // Start cooldown
        cooldown.value = 60;
        cooldownInterval = setInterval(() => {
          cooldown.value--;
          if (cooldown.value <= 0) {
            clearInterval(cooldownInterval);
            resendSuccess.value = false; // Allow resend again
          }
        }, 1000);
        
      } catch (err) {
        // Per sicurezza, mostriamo sempre successo
        resendSuccess.value = true;
        cooldown.value = 60;
      } finally {
        isResending.value = false;
      }
    };

    return {
      email,
      isResending,
      resendSuccess,
      cooldown,
      resendVerification
    };
  }
};
</script>