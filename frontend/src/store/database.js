import api from '@/services/api';

export default {
  namespaced: true,
  state: {
    structure: {}
  },
  mutations: {
    SET_STRUCTURE(state, structure) {
      state.structure = structure;
    }
  },
  actions: {
    async fetchStructure({ commit }) {
      const response = await api.get('/db/structure');
      commit('SET_STRUCTURE', response.data);
      return response.data;
    },
    async reset({ commit }) {
      await api.post('/db/reset');
      const response = await api.get('/db/structure');
      commit('SET_STRUCTURE', response.data);
      return response.data;
    }
  }
};