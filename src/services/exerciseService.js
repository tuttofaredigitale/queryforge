import exercises from '@/data/sql_exercises.json';

// Gli esercizi sono inclusi nell'applicazione: non serve nessun server
const exerciseService = {
  async fetchExercises() {
    return exercises;
  }
};

export default exerciseService;
