const path = require('path');
const fs = require('fs').promises; // Usa l'API basata su Promise

const exercisesFilePath = path.join(__dirname, '../data/sql_exercises.json');

/**
 * GET /api/exercises
 * Recupera la lista completa degli esercizi SQL.
 */
exports.getExercises = async (req, res) => {
  try {
    const data = await fs.readFile(exercisesFilePath, 'utf8');
    const exercises = JSON.parse(data);
    res.status(200).json(exercises);
  } catch (err) {
    console.error("Errore durante la lettura o il parsing del file degli esercizi:", err);
    if (err.code === 'ENOENT') {
        return res.status(404).json({ message: "File degli esercizi non trovato." });
    }
    if (err instanceof SyntaxError) {
        return res.status(500).json({ message: "Errore nel parsing dei dati degli esercizi." });
    }
    return res.status(500).json({ message: "Impossibile caricare gli esercizi al momento." });
  }
};