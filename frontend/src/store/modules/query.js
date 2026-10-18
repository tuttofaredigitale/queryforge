import api from '@/services/api';

export default {
  namespaced: true,
  state: {
    results: {
      columns: [],
      rows: []
    },
    saved: [],
    history: []
  },
  mutations: {
    SET_RESULTS(state, results) {
      state.results = results;
    },
    SET_SAVED(state, queries) {
      state.saved = queries;
    },
    ADD_SAVED(state, query) {
      state.saved.push(query);
    },
    SET_HISTORY(state, history) {
      state.history = history;
    },
    ADD_HISTORY(state, entry) {
      state.history.unshift(entry);
    }
  },
  actions: {
    async execute({ commit }, queryText) {
      try {
        const response = await api.post('/query/execute', { query: queryText });
        commit('SET_RESULTS', response.data);
        
        // Add to history
        commit('ADD_HISTORY', {
          id: Date.now(),
          query: queryText,
          timestamp: new Date().toLocaleTimeString(),
          success: true
        });
        
        return response.data;
      } catch (error) {
        // Add failed query to history
        commit('ADD_HISTORY', {
          id: Date.now(),
          query: queryText,
          timestamp: new Date().toLocaleTimeString(),
          success: false
        });
        
        throw error;
      }
    },
    async save({ commit }, { name, query }) {
      const response = await api.post('/query/save', { name, query });
      
      commit('ADD_SAVED', {
        id: response.data.id,
        name,
        query
      });
      
      return response.data;
    },
    async fetchSaved({ commit }) {
      const response = await api.get('/query/saved');
      commit('SET_SAVED', response.data);
      return response.data;
    },
    async fetchHistory({ commit }) {
      const response = await api.get('/query/history');
      commit('SET_HISTORY', response.data);
      return response.data;
    }
  }
};