// backend/src/utils/queryLimiter.js
// Course Lab Edition - Sistema semplificato per limite query giornaliere

const db = require('../db/database');
const logger = require('./logger');

// Limite fisso per Course Lab Edition
const DAILY_QUERY_LIMIT = parseInt(process.env.FREE_QUERY_DAILY_LIMIT) || 50;

const queryLimiter = {
  /**
   * Ottiene l'utilizzo query dell'utente per oggi
   * @param {number} userId - ID dell'utente
   * @returns {Promise<Object>} Statistiche di utilizzo
   */
  async getUsageStats(userId) {
    const today = new Date().toISOString().split('T')[0];
    let connection;
    
    try {
      connection = await db.getAuthConnection();
      
      const [rows] = await connection.execute(
        'SELECT count FROM query_usage WHERE user_id = ? AND usage_date = ?',
        [userId, today]
      );
      
      const currentCount = rows.length > 0 ? rows[0].count : 0;
      const remaining = Math.max(0, DAILY_QUERY_LIMIT - currentCount);
      
      return {
        plan: 'course-lab',
        limit: DAILY_QUERY_LIMIT,
        used: currentCount,
        remaining: remaining,
        isUnlimited: false,
        resetTime: 'mezzanotte (00:00)'
      };
      
    } catch (error) {
      logger.error(`Errore nel recupero utilizzo query per utente ${userId}:`, {
        error: error.message,
        userId
      });
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.release();
        } catch (releaseErr) {
          logger.error('Errore nel rilascio connessione queryLimiter:', releaseErr.message);
        }
      }
    }
  },

  /**
   * Verifica se l'utente può eseguire una query
   * @param {number} userId - ID dell'utente
   * @returns {Promise<Object>} Risultato del check
   */
  async canExecuteQuery(userId) {
    try {
      const stats = await this.getUsageStats(userId);
      
      if (stats.remaining <= 0) {
        return {
          allowed: false,
          reason: 'limit_exceeded',
          limit: stats.limit,
          used: stats.used,
          message: `Hai raggiunto il limite di ${DAILY_QUERY_LIMIT} query giornaliere. Riprova domani!`
        };
      }
      
      return {
        allowed: true,
        remaining: stats.remaining
      };
      
    } catch (error) {
      logger.error(`Errore verifica permessi query per utente ${userId}:`, error.message);
      // In caso di errore DB, permettiamo la query per non bloccare l'utente
      return { allowed: true, remaining: DAILY_QUERY_LIMIT };
    }
  },

  /**
   * Restituisce la configurazione corrente
   * @returns {Object} Configurazione
   */
  getConfig() {
    return {
      dailyLimit: DAILY_QUERY_LIMIT,
      plan: 'course-lab',
      aiEnabled: false,
      backupEnabled: false
    };
  }
};

module.exports = queryLimiter;