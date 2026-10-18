<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 py-8 px-4 shadow-md rounded-lg sm:px-10">
        <!-- Header -->
        <div class="text-center">
          <h2 class="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Reimposta la tua password</h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Inserisci una nuova password per il tuo account</p>
        </div>

        <!-- Messaggio Token non valido -->
        <div v-if="tokenInvalid" class="mt-6 rounded-md bg-red-50 dark:bg-red-900/30 p-4 dark:border dark:border-red-800">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400 dark:text-red-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800 dark:text-red-400">{{ tokenError }}</h3>
              <p class="mt-2 text-sm text-red-700 dark:text-red-300">Il link di reset password non è valido o è scaduto. Prova a richiedere un nuovo link.</p>
              <div class="mt-4">
                <RouterLink to="/login" class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                  Torna alla pagina di login
                </RouterLink>
              </div>
            </div>
          </div>
        </div>

        <!-- Reset form -->
        <form v-if="!tokenInvalid && !resetSuccess" @submit.prevent="resetPassword" class="mt-6 space-y-6">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nuova password</label>
            <input
              id="password"
              v-model="passwordForm.newPassword"
              type="password"
              @input="checkPasswordStrength"
              required
              class="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-200"
            />

            <div class="mt-2">
              <div class="flex items-center">
                <span class="text-sm text-gray-700 dark:text-gray-300 mr-2">Forza:</span>
                <div class="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                  <div
                    :class="passwordStrengthClass"
                    :style="{ width: passwordStrength + '%' }"
                    class="h-2 rounded-full transition-all"
                  ></div>
                </div>
                <span :class="passwordStrengthTextClass" class="ml-2 text-sm">{{ passwordStrengthText }}</span>
              </div>
              <ul class="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li :class="{ 'text-green-600 dark:text-green-400': passwordChecks.length >= 8 }">
                  <span v-if="passwordChecks.length >= 8">✓</span><span v-else>•</span> Almeno 8 caratteri
                </li>
                <li :class="{ 'text-green-600 dark:text-green-400': passwordChecks.hasUppercase }">
                  <span v-if="passwordChecks.hasUppercase">✓</span><span v-else>•</span> Lettera maiuscola
                </li>
                <li :class="{ 'text-green-600 dark:text-green-400': passwordChecks.hasLowercase }">
                  <span v-if="passwordChecks.hasLowercase">✓</span><span v-else>•</span> Lettera minuscola
                </li>
                <li :class="{ 'text-green-600 dark:text-green-400': passwordChecks.hasNumber }">
                  <span v-if="passwordChecks.hasNumber">✓</span><span v-else>•</span> Numero
                </li>
                <li :class="{ 'text-green-600 dark:text-green-400': passwordChecks.hasSpecial }">
                  <span v-if="passwordChecks.hasSpecial">✓</span><span v-else>•</span> Carattere speciale
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Conferma password</label>
            <input
              id="confirmPassword"
              v-model="passwordForm.confirmPassword"
              type="password"
              required
              class="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-200"
            />
            <p
              v-if="passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword"
              class="mt-2 text-sm text-red-600 dark:text-red-400"
            >
              Le password non corrispondono
            </p>
          </div>

          <!-- Errore -->
          <div
            v-if="resetError"
            class="rounded-md bg-red-50 dark:bg-red-900/30 p-4 dark:border dark:border-red-800"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400 dark:text-red-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800 dark:text-red-400">Si è verificato un errore</h3>
                <p class="mt-2 text-sm text-red-700 dark:text-red-300">{{ resetError }}</p>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="!isPasswordFormValid || isPasswordResetting"
              class="w-full flex justify-center py-2 px-4 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 dark:bg-indigo-700 dark:hover:bg-indigo-800 dark:disabled:bg-indigo-900/50"
            >
              <span v-if="!isPasswordResetting">Reimposta password</span>
              <span v-else>Reimpostazione in corso...</span>
            </button>
          </div>
        </form>

        <div v-if="resetSuccess" class="mt-6 rounded-md bg-green-50 dark:bg-green-900/30 p-4 dark:border dark:border-green-800">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400 dark:text-green-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-green-800 dark:text-green-400">Password reimpostata con successo</h3>
              <p class="mt-2 text-sm text-green-700 dark:text-green-300">La tua password è stata aggiornata. Ora puoi accedere con la nuova password.</p>
              <div class="mt-4">
                <RouterLink to="/login" class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                  Vai alla pagina di login
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import api from '@/services/api';

export default {
  name: 'ResetPassword',
  components: { RouterLink },
  props: { tokenProp: { type: String, default: '' } },
  setup(props) {
    const route = useRoute();
    const router = useRouter();
    const token = ref('');
    const tokenInvalid = ref(false);
    const tokenError = ref('');

    const passwordForm = ref({ newPassword: '', confirmPassword: '' });
    const passwordChecks = ref({ length: 0, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecial: false });
    const passwordStrength = ref(0);

    const resetError = ref('');
    const resetSuccess = ref(false);
    const isPasswordResetting = ref(false);

    const passwordStrengthText = computed(() => {
      if (passwordStrength.value < 20) return 'Molto debole';
      if (passwordStrength.value < 40) return 'Debole';
      if (passwordStrength.value < 60) return 'Media';
      if (passwordStrength.value < 80) return 'Buona';
      return 'Forte';
    });

    const passwordStrengthClass = computed(() => {
      if (passwordStrength.value < 20) return 'bg-red-500';
      if (passwordStrength.value < 40) return 'bg-orange-500';
      if (passwordStrength.value < 60) return 'bg-yellow-500';
      if (passwordStrength.value < 80) return 'bg-green-400';
      return 'bg-green-600';
    });

    const passwordStrengthTextClass = computed(() => {
      if (passwordStrength.value < 20) return 'text-red-600 dark:text-red-500';
      if (passwordStrength.value < 40) return 'text-orange-600 dark:text-orange-500';
      if (passwordStrength.value < 60) return 'text-yellow-600 dark:text-yellow-500';
      if (passwordStrength.value < 80) return 'text-green-500';
      return 'text-green-600 dark:text-green-500';
    });

    const isPasswordFormValid = computed(() => {
      return (
        passwordForm.value.newPassword &&
        passwordForm.value.confirmPassword &&
        passwordForm.value.newPassword === passwordForm.value.confirmPassword &&
        passwordStrength.value >= 40
      );
    });

    onMounted(async () => {
      const tokenFromUrl = route.params.token || route.query.token;
      token.value = tokenFromUrl || props.tokenProp || localStorage.getItem('reset_token');
      if (!token.value) {
        tokenInvalid.value = true;
        tokenError.value = 'Token non trovato';
        return;
      }
      try {
        const res = await api.get(`/auth/validate-reset-token/${token.value}`);
        if (!res.data.valid) {
          tokenInvalid.value = true;
          tokenError.value = res.data.message || 'Token non valido o scaduto';
        }
      } catch (err) {
        tokenInvalid.value = true;
        tokenError.value = err.response?.data?.message || 'Token non valido o scaduto';
      }
      localStorage.removeItem('reset_token');
    });

    const checkPasswordStrength = () => {
      const pw = passwordForm.value.newPassword;
      passwordChecks.value = {
        length: pw.length,
        hasUppercase: /[A-Z]/.test(pw),
        hasLowercase: /[a-z]/.test(pw),
        hasNumber: /[0-9]/.test(pw),
        hasSpecial: /[^A-Za-z0-9]/.test(pw)
      };
      let score = 0;
      score += Math.min(25, (pw.length / 12) * 25);
      if (passwordChecks.value.hasUppercase) score += 15;
      if (passwordChecks.value.hasLowercase) score += 15;
      if (passwordChecks.value.hasNumber) score += 15;
      if (passwordChecks.value.hasSpecial) score += 30;
      passwordStrength.value = Math.min(100, score);
    };

    const resetPassword = async () => {
      if (!isPasswordFormValid.value) return;
      resetError.value = '';
      isPasswordResetting.value = true;
      try {
        const response = await api.post('/auth/reset-password', {
          token: token.value,
          newPassword: passwordForm.value.newPassword
        });
        if (response.data.success) {
          resetSuccess.value = true;
        } else {
          resetError.value = response.data.message || 'Errore durante il reset della password';
        }
      } catch (err) {
        resetError.value = err.response?.data?.message || 'Errore durante il reset della password';
      } finally {
        isPasswordResetting.value = false;
      }
    };

    return {
      token,
      tokenInvalid,
      tokenError,
      passwordForm,
      passwordChecks,
      passwordStrength,
      passwordStrengthText,
      passwordStrengthClass,
      passwordStrengthTextClass,
      isPasswordFormValid,
      resetError,
      resetSuccess,
      isPasswordResetting,
      checkPasswordStrength,
      resetPassword
    };
  }
};
</script>

<style scoped>
/* Non c'è bisogno */
</style>
