// store/modules/user.js

// Importa il servizio API se lo usi per le chiamate (opzionale, puoi usare fetch)
import api from '../../services/api'; // Esempio

export default {
  namespaced: true,

  state: () => ({
    profile: null, // L'UNICA fonte di verità per i dati dell'utente
    isLoadingProfile: false,
    subscriptionStatus: undefined,
    subscriptionEndDate: null,
    lemonsqueezySubscriptionId: null,
    planType: null
  }),

  getters: {
    userProfile: (state) => state.profile,
    isLoadingProfile: (state) => state.isLoadingProfile,

    isProPlan: (state) => state.profile?.plan?.toLowerCase() === 'pro',
    
    aiCredits: (state) => state.profile?.aiCredits || null,
    canUseAI: (state) => state.profile?.aiCredits?.canUse || false,
    aiCreditsRemaining: (state) => state.profile?.aiCredits?.remaining || 0,
  },

  mutations: {
    SET_PROFILE(state, profile) {
      state.profile = profile;
    },
    SET_LOADING_PROFILE(state, isLoading) {
      state.isLoadingProfile = isLoading;
    },
    
    UPDATE_AI_CREDITS(state, updatedCredits) {
      if (state.profile) {
        state.profile.aiCredits = updatedCredits;
      }
    },

    UPDATE_QUERY_USAGE(state, updatedQueryUsage) {
      if (state.profile && updatedQueryUsage) {
        state.profile.queryUsage = updatedQueryUsage;
      }
    },

    SET_USER_SUBSCRIPTION_DATA(state, payload) {
      state.subscriptionStatus = payload.subscription_status;
      state.subscriptionEndDate = payload.subscription_end_date;
      state.lemonsqueezySubscriptionId = payload.lemonsqueezy_subscription_id;
      state.planType = payload.plan_type;
    },
  },

  actions: {
    // Questa diventa l'azione principale per caricare tutti i dati dell'utente
    async fetchProfile({ commit }) {
      commit('SET_LOADING_PROFILE', true);
      try {
        const response = await api.get('/user/profile'); // Questa chiamata ora restituisce tutto
        if (response.data.success && response.data.user) {
          commit('SET_PROFILE', response.data.user);
        } else {
          throw new Error("Dati utente non trovati nella risposta API.");
        }
      } catch (error) {
        console.error('Errore in fetchProfile:', error);
        commit('SET_PROFILE', null);
        throw error;
      } finally {
        commit('SET_LOADING_PROFILE', false);
      }
    },

    // Azione chiamata dopo una query AI per aggiornare l'UI
    // La sua implementazione rimane la stessa, ma ora è molto più chiara
    updateAiCreditsAfterUse({ commit }, usagePayload) {
      if (usagePayload) {
        commit('UPDATE_AI_CREDITS', usagePayload);
      }
    },

    async loadUserSubscription({ commit }) {
      try {
        // Usa fetch o il tuo client Axios. Qui uso fetch puro come nei tuoi esempi:
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const response = await fetch('/api/billing/subscription', { headers });

        if (!response.ok) throw new Error(`Errore HTTP ${response.status} nel caricare l'abbonamento`);

        const data = await response.json();
        const subData = data.subscription || null;
        commit('SET_USER_SUBSCRIPTION_DATA', {
          subscription_status: subData ? subData.status : 'none',
          subscription_end_date: subData ? subData.ends_at : null,
          lemonsqueezy_subscription_id: subData ? subData.id : null,
          plan_type: subData ? subData.interval : null
        });
      } catch (err) {
        // In caso di errore, fallback
        commit('SET_USER_SUBSCRIPTION_DATA', {
          subscription_status: 'none',
          subscription_end_date: null,
          lemonsqueezy_subscription_id: null,
          plan_type: null
        });
        console.error('Errore in loadUserSubscription:', err);
      }
    },

    // Azione per incrementare (usata come fallback o se preferita)
    incrementQueryUsage({ commit, getters }) {
      if (!getters.isProPlan && !getters.isQueryLimitReached) {
        commit('INCREMENT_QUERY_COUNT');
      }
    },

    async refreshProfile({ commit }) {
      try {
        const response = await api.get('/user/profile');
        if (response.data.success) {
          commit('SET_PROFILE', response.data.user);
          return response.data.user;
        }
      } catch (error) {
        console.error('Errore nel refresh del profilo:', error);
        throw error;
      }
    },

    updateAiCreditsAfterUse({ commit }, usagePayload) {
      if (usagePayload) {
        commit('UPDATE_AI_CREDITS', usagePayload);
      }
    },

    updateQueryUsageAfterExecute({ commit }, usagePayload) {
      if (usagePayload) {
        commit('UPDATE_QUERY_USAGE', usagePayload);
      }
    }
  } 
}; 