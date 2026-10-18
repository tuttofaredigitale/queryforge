// backend/src/utils/userDatabaseManager.js

const logger = require('../utils/logger');
const { getTemplateTables } = require('../utils/db'); // Importiamo solo quello che ci serve

/**
 * Funzione principale per creare le tabelle personali di un nuovo utente.
 * Clona le tabelle 'template_' aggiungendo il prefisso 'user_{userId}_'.
 * Questa funzione è progettata per funzionare all'interno di una transazione.
 *
 * @param {number} userId - L'ID del nuovo utente.
 * @param {object} connection - La connessione al database già attiva e dentro una transazione.
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
async function createUserTables(userId, connection) {
    if (!userId || !connection) {
        const errorMsg = 'createUserTables richiede un ID utente e una connessione al database attiva.';
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    logger.info(`[UserDBManager] Avvio creazione tabelle per utente: ${userId}`);

    try {
        // 1. Ottenere la lista delle tabelle modello usando la connessione della transazione.
        const templateTables = await getTemplateTables(connection);

        if (templateTables.length === 0) {
            logger.warn(`[UserDBManager] Nessuna tabella modello trovata (template_%). L'utente ${userId} è stato creato senza tabelle personali.`);
            return { success: true, error: null };
        }

        logger.info(`[UserDBManager] Trovate ${templateTables.length} tabelle modello da clonare.`, { tables: templateTables });

        // 2. Per ogni tabella modello, creare la tabella utente e copiare i dati.
        for (const templateTable of templateTables) {
            const baseTableName = templateTable.replace(/^template_/, '');
            const userTableName = `user_${userId}_${baseTableName}`;

            logger.debug(`[UserDBManager] Creazione tabella '${userTableName}'...`);

            // Usiamo la connessione della transazione per eseguire i comandi
            await connection.execute(`CREATE TABLE \`${userTableName}\` LIKE \`${templateTable}\`;`);
            await connection.execute(`INSERT INTO \`${userTableName}\` SELECT * FROM \`${templateTable}\`;`);

            logger.info(`[UserDBManager] Tabella '${userTableName}' creata e popolata.`);
        }

        logger.info(`[UserDBManager] Tutte le tabelle per l'utente ${userId} sono state create con successo.`);
        return { success: true, error: null };

    } catch (error) {
        const errorMsg = `Errore durante la creazione delle tabelle per l'utente ${userId}: ${error.message}`;
        logger.error(errorMsg, { stack: error.stack });
        return { success: false, error: errorMsg };
    }
}

module.exports = {
    createUserTables
};