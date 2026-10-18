import api from './api'; 

const exerciseService = {
  async fetchExercises() {
    try {
      const response = await api.get('/exercises');
      return response.data;
    } catch (error) {
      console.error('Errore durante il recupero degli esercizi:', error);
      throw new Error('Impossibile caricare gli esercizi. Riprova più tardi.');
    }
  }
};

export default exerciseService;