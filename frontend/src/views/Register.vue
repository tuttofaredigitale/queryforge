<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 px-4">
    <!-- Form Wrapper -->
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 py-8 px-4 shadow rounded-lg sm:px-10">
        <h2 class="mb-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-200">
          Crea il tuo account
        </h2>
        <!-- Aumentato leggermente lo spacing per i nuovi elementi -->
        <form @submit.prevent="handleRegister" class="space-y-6">
          
          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              autofocus
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="Il tuo username"
            />
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="la-tua-email@esempio.com"
            />
          </div>

          <!-- Password (FIX B: Migliorata con indicatore di forza) -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
              @input="checkPasswordStrength"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="La tua password"
            />
            <!-- Indicatore Forza Password (Copiato da ProfileView.vue) -->
            <div class="mt-2" v-if="password.length > 0">
                <div class="flex items-center mb-1">
                    <div class="text-xs text-gray-700 mr-2 dark:text-gray-300">Forza:</div>
                    <div class="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-600">
                        <div 
                            class="h-2 rounded-full transition-all duration-300"
                            :class="passwordStrengthClass"
                            :style="{ width: `${passwordStrength}%` }"
                        ></div>
                    </div>
                    <div class="ml-2 text-xs font-medium" :class="passwordStrengthTextClass">
                        {{ passwordStrengthText }}
                    </div>
                </div>
                <!-- Lista requisiti password -->
                <ul class="text-xs text-gray-600 mt-1 space-y-1 dark:text-gray-400">
                    <li :class="{'text-green-600 dark:text-green-400': passwordChecks.length >= 8}">
                        <span>{{ passwordChecks.length >= 8 ? '✓' : '•' }}</span> Almeno 8 caratteri
                    </li>
                    <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasUppercase}">
                        <span>{{ passwordChecks.hasUppercase ? '✓' : '•' }}</span> Almeno una lettera maiuscola
                    </li>
                    <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasLowercase}">
                        <span>{{ passwordChecks.hasLowercase ? '✓' : '•' }}</span> Almeno una lettera minuscola
                    </li>
                    <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasNumber}">
                        <span>{{ passwordChecks.hasNumber ? '✓' : '•' }}</span> Almeno un numero
                    </li>
                    <li :class="{'text-green-600 dark:text-green-400': passwordChecks.hasSpecial}">
                        <span>{{ passwordChecks.hasSpecial ? '✓' : '•' }}</span> Almeno un carattere speciale
                    </li>
                </ul>
            </div>
          </div>

          <!-- FIX A: Aggiunta Conferma Password -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Conferma Password</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="Conferma la password"
            />
            <p v-if="password && confirmPassword && password !== confirmPassword" 
               class="mt-1 text-xs text-red-600 dark:text-red-400">
                Le password non corrispondono
            </p>
          </div>

          <!-- Consensi GDPR -->
          <div class="pt-4 space-y-4">
            <div class="flex items-center">
                <input
                id="terms"
                type="checkbox"
                v-model="termsAccepted"
                required
                class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label for="terms" class="ml-2 block text-sm text-gray-800 dark:text-gray-200">
                Ho letto e accetto i
                <button type="button" @click.prevent="showTermsModal = true" class="text-indigo-600 hover:underline">Termini e Condizioni</button>
                </label>
            </div>

            <div class="flex items-center">
                <input
                id="privacy"
                type="checkbox"
                v-model="privacyAccepted"
                required
                class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label for="privacy" class="ml-2 block text-sm text-gray-800 dark:text-gray-200">
                Ho letto e accetto la
                <button type="button" @click.prevent="showPrivacyModal = true" class="text-indigo-600 hover:underline">Privacy Policy</button>
                </label>
            </div>
          </div>

          <!-- Pulsante Submit (disabilitato se il form non è valido) -->
          <button
            type="submit"
            :disabled="loading || !isFormValid"
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <span v-if="!loading">Registrati</span>
            <span v-else>Caricamento...</span>
          </button>

          <!-- Errore locale mantenuto per contesto -->
          <div v-if="error" class="mt-2 text-red-600 text-sm text-center">{{ error }}</div>

          <div class="text-sm text-center mt-4">
            <RouterLink to="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
              Hai già un account? Accedi
            </RouterLink>
          </div>
        </form>
      </div>
    </div>

    <!-- Modali (Invariati, con aggiunta stile dark mode ai pulsanti) -->
    <!-- Modal Termini e Condizioni -->
    <div v-if="showTermsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-screen overflow-auto">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Termini e Condizioni</h3>
          <button @click="showTermsModal = false" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <XIcon class="h-6 w-6" />
          </button>
        </div>
        <iframe src="/terms" class="w-full h-96 border-0" title="Termini e Condizioni"></iframe>
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end sticky bottom-0 bg-white dark:bg-gray-800">
          <button @click="acceptTerms" class="mr-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">Accetto</button>
          <button @click="showTermsModal = false" class="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400">Chiudi</button>
        </div>
      </div>
    </div>

    <!-- Modal Privacy Policy -->
    <div v-if="showPrivacyModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-screen overflow-auto">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Privacy Policy</h3>
          <button @click="showPrivacyModal = false" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <XIcon class="h-6 w-6" />
          </button>
        </div>
        <iframe src="/privacy-policy" class="w-full h-96 border-0" title="Privacy Policy"></iframe>
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end sticky bottom-0 bg-white dark:bg-gray-800">
          <button @click="acceptPrivacy" class="mr-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">Accetto</button>
          <button @click="showPrivacyModal = false" class="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400">Chiudi</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { XIcon } from '@heroicons/vue/outline';
import api from '@/services/api';
import { useToasts } from '@/composables/useToasts.js';

const router = useRouter();
const { toast } = useToasts();

const username = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const termsAccepted = ref(false);
const privacyAccepted = ref(false);
const showTermsModal = ref(false);
const showPrivacyModal = ref(false);
const error = ref(null);
const loading = ref(false);

// --- Logica Forza Password ---
const passwordStrength = ref(0);
const passwordChecks = ref({ length: 0, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecial: false });

const checkPasswordStrength = () => {
    const pwd = password.value;
    passwordChecks.value = {
        length: pwd.length,
        hasUppercase: /[A-Z]/.test(pwd),
        hasLowercase: /[a-z]/.test(pwd),
        hasNumber: /[0-9]/.test(pwd),
        hasSpecial: /[^A-Za-z0-9]/.test(pwd)
    };
    let score = 0;
    if (passwordChecks.value.length >= 8) score += 20;
    if (passwordChecks.value.hasUppercase) score += 20;
    if (passwordChecks.value.hasLowercase) score += 20;
    if (passwordChecks.value.hasNumber) score += 20;
    if (passwordChecks.value.hasSpecial) score += 20;
    passwordStrength.value = score;
};

// Computed properties per la UI della forza password
const passwordStrengthText = computed(() => {
    if (passwordStrength.value < 40) return 'Debole';
    if (passwordStrength.value < 60) return 'Media';
    if (passwordStrength.value < 80) return 'Buona';
    return 'Forte';
});

const passwordStrengthClass = computed(() => {
    if (passwordStrength.value < 40) return 'bg-red-500';
    if (passwordStrength.value < 60) return 'bg-yellow-500';
    if (passwordStrength.value < 80) return 'bg-green-400';
    return 'bg-green-600';
});

const passwordStrengthTextClass = computed(() => {
    if (passwordStrength.value < 40) return 'text-red-600 dark:text-red-500';
    if (passwordStrength.value < 60) return 'text-yellow-600 dark:text-yellow-500';
    if (passwordStrength.value < 80) return 'text-green-500';
    return 'text-green-600 dark:text-green-500';
});

// Computed property per validità form complessiva
const isFormValid = computed(() => {
    return username.value && email.value && 
           password.value && confirmPassword.value &&
           password.value === confirmPassword.value &&
           passwordStrength.value >= 60 && // Richiede almeno forza "Media"
           termsAccepted.value && privacyAccepted.value;
});

const acceptTerms = () => {
  termsAccepted.value = true;
  showTermsModal.value = false;
};
const acceptPrivacy = () => {
  privacyAccepted.value = true;
  showPrivacyModal.value = false;
};

const handleRegister = async () => {
  // Controlli di validazione con feedback tramite Toast
  if (!termsAccepted.value) {
    const msg = 'Devi accettare i Termini e Condizioni per registrarti';
    error.value = msg;
    toast.warning(msg);
    return;
  }
  if (!privacyAccepted.value) {
    const msg = 'Devi accettare la Privacy Policy per registrarti';
    error.value = msg;
    toast.warning(msg);
    return;
  }
  if (password.value !== confirmPassword.value) {
    const msg = 'Le password non corrispondono.';
    error.value = msg;
    toast.error(msg);
    return;
  }
  if (passwordStrength.value < 60) {
    const msg = 'La password non è sufficientemente sicura (richiesta almeno forza Media).';
    error.value = msg;
    toast.warning(msg);
    return;
  }

  loading.value = true;
  error.value = null;
  
  try {
    // =====================================================
    // MODIFICATO: Chiamata diretta all'API invece di Vuex
    // per gestire meglio la risposta con verifica email
    // =====================================================
    const response = await api.post('/auth/register', {
      username: username.value,
      email: email.value,
      password: password.value,
      termsAccepted: termsAccepted.value,
      privacyAccepted: privacyAccepted.value
    });
    
    if (response.data.success) {
      // =====================================================
      // NUOVO: Gestione verifica email obbligatoria
      // =====================================================
      if (response.data.requiresEmailVerification) {
        // Salva email per la pagina di successo (backup)
        sessionStorage.setItem('registrationEmail', email.value);
        
        // Redirect alla pagina di conferma registrazione
        router.push({ 
          path: '/registration-success',
          query: { email: email.value }
        });
      } else {
        // Fallback: se la verifica email è disabilitata (vecchio comportamento)
        // Questo caso non dovrebbe più verificarsi con la nuova configurazione
        if (response.data.accessToken) {
          localStorage.setItem('accessToken', response.data.accessToken);
          if (response.data.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }
        }
        toast.success('Registrazione completata! Benvenuto in QueryForge.');
        router.push('/playground');
      }
    }
    // =====================================================

  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message || 'Errore durante la registrazione. Riprova.';
    error.value = errorMessage;
    toast.error(errorMessage);
  } finally {
    loading.value = false;
  }
};
</script>