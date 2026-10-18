// backend/src/db/database.js
// LEGACY FILE - Ri-esporta da db.js per retrocompatibilità

const db = require('../utils/db');

module.exports = {
  execute: db.execute,
  executeAuth: db.executeAuth,
  getConnection: db.getConnection,
  getAuthConnection: db.getAuthConnection,
  closePools: db.closePools,
  authPool: db.authPool,
  mainPool: db.mainPool
};