const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exerciseController');
const authMiddleware = require('../middlewares/auth');

// Rotta protetta per ottenere tutti gli esercizi
router.get('/', authMiddleware.authenticate, exerciseController.getExercises);

module.exports = router;