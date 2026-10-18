<template>
  <Teleport to="body">
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title" 
      role="dialog" 
      aria-modal="true"
    >
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        @click="close"
      ></div>

      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <!-- Header -->
          <div class="bg-yellow-50 dark:bg-yellow-900/30 px-4 pt-5 pb-4 sm:p-6">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-800 sm:mx-0 sm:h-10 sm:w-10">
                <svg class="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white" id="modal-title">
                  Verifica la tua email
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Per accedere a QueryForge devi prima verificare il tuo indirizzo email.
                    <br><br>
                    Controlla la tua casella di posta (anche lo spam) per trovare l'email di verifica.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="bg-white dark:bg-gray-800 px-4 py-4 sm:px-6">
            <!-- Success message -->
            <div v-if="resendSuccess" class="rounded-md bg-green-50 dark:bg-green-900/30 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-green-800 dark:text-green-300">
                    Email inviata con successo!
                  </p>
                  <p class="text-sm text-green-700 dark:text-green-400 mt-1">
                    Controlla la tua casella di posta e clicca sul link di verifica.
                  </p>
                </div>
              </div>
            </div>

            <!-- Error message -->
            <div v-if="resendError" class="rounded-md bg-red-50 dark:bg-red-900/30 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-red-800 dark:text-red-300">
                    {{ resendError }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Resend button -->
            <div v-if="!resendSuccess" class="space-y-3">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Non hai ricevuto l'email? Clicca qui sotto per riceverne una nuova.
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">
                Email: <span class="font-medium">{{ email }}</span>
              </p>
              <button
                @click="resend"
                :disabled="isResending || cooldown > 0"
                class="w-full inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:text-sm"
              >
                <span v-if="isResending" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Invio in corso...
                </span>
                <span v-else-if="cooldown > 0">
                  Riprova tra {{ cooldown }}s
                </span>
                <span v-else>
                  <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Reinvia email di verifica
                </span>
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              @click="close"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, watch } from 'vue';
import api from '@/services/api';

export default {
  name: 'ResendVerificationModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    email: {
      type: String,
      required: true
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const isResending = ref(false);
    const resendSuccess = ref(false);
    const resendError = ref('');
    const cooldown = ref(0);
    let cooldownInterval = null;

    const close = () => {
      emit('close');
    };

    const resend = async () => {
      if (isResending.value || cooldown.value > 0 || !props.email) return;

      isResending.value = true;
      resendError.value = '';

      try {
        const response = await api.post('/auth/resend-verification', {
          email: props.email.trim().toLowerCase()
        });

        if (response.data.success) {
          resendSuccess.value = true;
          
          // Start cooldown
          cooldown.value = 60;
          cooldownInterval = setInterval(() => {
            cooldown.value--;
            if (cooldown.value <= 0) {
              clearInterval(cooldownInterval);
            }
          }, 1000);
        }
      } catch (err) {
        if (err.response?.status === 429) {
          resendError.value = 'Troppe richieste. Attendi qualche minuto prima di riprovare.';
          cooldown.value = 60;
        } else {
          // Per sicurezza, mostriamo sempre successo
          resendSuccess.value = true;
        }
      } finally {
        isResending.value = false;
      }
    };

    // Reset state when modal opens
    watch(() => props.isOpen, (newVal) => {
      if (newVal) {
        resendSuccess.value = false;
        resendError.value = '';
      }
    });

    return {
      isResending,
      resendSuccess,
      resendError,
      cooldown,
      close,
      resend
    };
  }
};
</script>