const logger = require('../utils/logger');

/**
 * Database/schemi considerati sensibili
 */
const SENSITIVE_DATABASES = [
    'sql_auth', 
    'mysql', 
    'information_schema', 
    'performance_schema', 
    'sys',
    'phpmyadmin',
    'test' // Spesso contiene dati di test che non dovrebbero essere accessibili
];

const PROTECTED_TABLES = [
    'users',
    'refresh_tokens',
    'query_usage',
    'query_history',
    'saved_queries',
    'ai_prompt_usage',
    'billing_history',
    'user_backups',
    '_vt_vrp_4c21da3f3ff053128179821372eb8c6e_20250618133225_',
    '_vt_vrp_4fe87237881f50b79b669b7054556ec9_20250618133230_'
];

const PROTECTED_TABLES_REGEX = new RegExp(`\\b(${PROTECTED_TABLES.join('|')})\\b`, 'i');

/**
 * Pattern pericolosi con categorizzazione migliorata
 */
const DANGEROUS_PATTERNS = [
    // === QUERY SEMPRE BLOCCATE (Sicurezza Critica) ===
    { 
        pattern: /^\s*show\s+(databases|schemas)\b/i, 
        level: 'critical', 
        message: 'Il comando SHOW DATABASES/SCHEMAS non è consentito per motivi di sicurezza.', 
        alwaysBlock: true,
        category: 'information_disclosure'
    },
    { 
        pattern: /\b(information_schema|mysql|performance_schema|sys|phpmyadmin)\./i, 
        level: 'critical', 
        message: 'Accesso diretto a schemi di sistema protetti non consentito.', 
        alwaysBlock: true,
        category: 'system_access'
    },
    { 
        pattern: /^\s*use\s+(information_schema|mysql|performance_schema|sys|sql_auth|phpmyadmin)\b/i, 
        level: 'critical', 
        message: 'Tentativo di utilizzare un database di sistema protetto.', 
        alwaysBlock: true,
        category: 'system_access'
    },
    
    // === FILE SYSTEM ACCESS ===
    { 
        pattern: /\b(OUTFILE|DUMPFILE)\b/i, 
        level: 'critical', 
        message: 'Scrittura sul filesystem del server non consentita (OUTFILE/DUMPFILE).', 
        alwaysBlock: true,
        category: 'file_system'
    },
    { 
        pattern: /LOAD_FILE\s*\(/i, 
        level: 'critical', 
        message: 'Lettura dal filesystem del server non consentita (LOAD_FILE).', 
        alwaysBlock: true,
        category: 'file_system'
    },
    { 
        pattern: /LOAD\s+DATA\s+(?:LOCAL\s+)?INFILE/i, 
        level: 'critical', 
        message: 'Caricamento file non consentito (LOAD DATA INFILE).', 
        alwaysBlock: true,
        category: 'file_system'
    },
    
    // === PRIVILEGE MANAGEMENT ===
    { 
        pattern: /\b(GRANT|REVOKE)\b/i, 
        level: 'critical', 
        message: 'Gestione privilegi non consentita in ambiente playground.', 
        alwaysBlock: true,
        category: 'privileges'
    },
    { 
        pattern: /\b(CREATE|DROP|ALTER)\s+(USER|ROLE)\b/i, 
        level: 'critical', 
        message: 'Gestione utenti/ruoli non consentita.', 
        alwaysBlock: true,
        category: 'user_management'
    },
    { 
        pattern: /^\s*show\s+(grants|privileges|users)\b/i, 
        level: 'critical', 
        message: 'Visualizzazione privilegi non consentita.', 
        alwaysBlock: true,
        category: 'information_disclosure'
    },
    
    // === DATABASE STRUCTURE ===
    { 
        pattern: /\b(CREATE|DROP)\s+(DATABASE|SCHEMA)\b/i, 
        level: 'critical', 
        message: 'Creazione/eliminazione database non consentita.', 
        alwaysBlock: true,
        category: 'database_structure'
    },

    // --- SHOW TABLES ---
    {
        pattern: /^\s*show\s+tables\b/i,
        level: 'critical',
        message: 'Il comando SHOW TABLES non è consentito. Usa la barra laterale per visualizzare le tue tabelle.',
        alwaysBlock: true,
        category: 'information_disclosure'
    },

    {
        pattern: /^\s*(DESCRIBE|DESC|EXPLAIN)\b/i,
        level: 'critical',
        message: 'I comandi DESCRIBE/EXPLAIN non sono consentiti. Usa la barra laterale per i dettagli delle colonne.',
        alwaysBlock: true,
        category: 'information_disclosure'
    },

    // === QUERY CHE RICHIEDONO CONFERMA ===
    { 
        pattern: /\bDROP\s+TABLE\b/i, 
        level: 'critical', 
        message: 'Eliminazione tabella (DROP TABLE) richiede conferma esplicita.', 
        requiresConfirmation: true,
        category: 'destructive'
    },
    { 
        pattern: /\bTRUNCATE\s+TABLE\b/i, 
        level: 'critical', 
        message: 'Svuotamento tabella (TRUNCATE) richiede conferma esplicita.', 
        requiresConfirmation: true,
        category: 'destructive'
    },
    { 
        pattern: /\bDELETE\s+FROM\s+(?!.*?\bWHERE\b)/i, 
        level: 'critical', 
        message: 'DELETE senza clausola WHERE richiede conferma (eliminerà tutti i record).', 
        requiresConfirmation: true,
        category: 'destructive'
    },
    { 
        pattern: /\bUPDATE\s+.*?\bSET\b(?!.*?\bWHERE\b)/i, 
        level: 'critical', 
        message: 'UPDATE senza clausola WHERE richiede conferma (modificherà tutti i record).', 
        requiresConfirmation: true,
        category: 'destructive'
    },
    { 
        pattern: /\bALTER\s+TABLE\b/i, 
        level: 'critical', 
        message: 'Modifica struttura tabella (ALTER TABLE) richiede conferma.', 
        requiresConfirmation: true,
        category: 'structure_change'
    },

    // === PATTERN DI WARNING (Non bloccanti ma loggati) ===
    { 
        pattern: /\bUNION\s+(?:ALL\s+)?SELECT\b/i, 
        level: 'warning', 
        message: 'Utilizzo di UNION SELECT rilevato (potenziale SQL injection).', 
        requiresConfirmation: false,
        category: 'suspicious'
    },
    { 
        pattern: /\b(SLEEP|BENCHMARK)\s*\(/i, 
        level: 'warning', 
        message: 'Utilizzo di funzioni temporali rilevato (potenziale timing attack).', 
        requiresConfirmation: false,
        category: 'suspicious'
    },
    { 
        pattern: /\/\*!.*\*\//i, 
        level: 'warning', 
        message: 'Commenti eseguibili MySQL rilevati.', 
        requiresConfirmation: false,
        category: 'suspicious'
    },
    { 
        pattern: /\b(CONCAT|GROUP_CONCAT)\s*\(/i, 
        level: 'info', 
        message: 'Utilizzo di funzioni di concatenazione (normale per molte query).', 
        requiresConfirmation: false,
        category: 'informational'
    }
];

/**
 * Verifica query multiple
 */
const hasMultipleQueries = (query) => {
    if (!query) return false;
    
    // Rimuovi stringhe quotate per evitare falsi positivi
    const withoutStrings = query.replace(/'([^'\\]|\\.)*'/g, '""').replace(/"([^"\\]|\\.)*"/g, "''");
    // Rimuovi commenti
    const withoutComments = withoutStrings
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Dividi per ';' e conta parti non vuote
    const parts = withoutComments
        .split(';')
        .map(part => part.trim())
        .filter(part => part.length > 0);
    
    return parts.length > 1;
};

/**
 * Verifica accesso non autorizzato a database
 */
const accessesUnauthorizedDatabase = (query, userDatabaseName) => {
    if (!query || !userDatabaseName) return false;

    const lowerQuery = query.toLowerCase();
    const lowerUserDb = userDatabaseName.toLowerCase();

    // Pattern migliorato per catturare accessi database
    const patterns = [
        // db_name.table_name pattern
        /\b(?:from|join|into|update|delete\s+from|insert\s+into)\s+[`'"]?([a-z0-9_]+)[`'"]?\s*\.\s*[`'"]?([a-z0-9_]+)[`'"]?/gi,
        // USE database pattern
        /^\s*use\s+[`'"]?([a-z0-9_]+)[`'"]?/i
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(lowerQuery)) !== null) {
            const dbName = match[1];
            if (dbName !== lowerUserDb && !SENSITIVE_DATABASES.includes(dbName)) {
                logger.warn(`Unauthorized database access detected`, {
                    attemptedDb: dbName,
                    authorizedDb: userDatabaseName,
                    query: query.substring(0, 100)
                });
                return true;
            }
        }
    }

    return false;
};

/**
 * Analizza una query SQL per rischi di sicurezza
 */
const analyzeSQLQuery = (query, userDatabaseName) => {
    const issues = [];
    let blockedCompletely = false;
    let requiresConfirmation = false;

    if (!query || typeof query !== 'string') {
        return { 
            issues: [{ 
                level: 'critical', 
                message: 'Query non valida o mancante.',
                category: 'validation'
            }], 
            blockedCompletely: true, 
            requiresConfirmation: false 
        };
    }

    // 1. Controllo query multiple
    if (hasMultipleQueries(query)) {
        issues.push({
            type: 'multiple_queries',
            level: 'critical',
            message: 'Query multiple non consentite. Eseguire una query alla volta.',
            alwaysBlock: true,
            category: 'policy_violation'
        });
        blockedCompletely = true;
    }

    // 2. Controllo accesso database non autorizzato
    if (!blockedCompletely && userDatabaseName && accessesUnauthorizedDatabase(query, userDatabaseName)) {
        issues.push({
            type: 'unauthorized_db_access',
            level: 'critical',
            message: `Accesso consentito solo al database: ${userDatabaseName}`,
            alwaysBlock: true,
            category: 'access_violation'
        });
        blockedCompletely = true;
    }
    
    // 3. NUOVO: Controllo accesso a tabelle di sistema (SOLO IN PRODUZIONE)
    if (process.env.NODE_ENV === 'production' && !blockedCompletely) {
        if (PROTECTED_TABLES_REGEX.test(query)) {
            const match = query.match(PROTECTED_TABLES_REGEX);
            issues.push({
                type: 'protected_table_access',
                level: 'critical',
                message: `Accesso alla tabella di sistema '${match[0]}' non consentito.`,
                alwaysBlock: true,
                category: 'access_violation'
            });
            blockedCompletely = true;
        }
    }

    // 3. Controllo pattern pericolosi
    if (!blockedCompletely) {
        for (const rule of DANGEROUS_PATTERNS) {
            if (rule.pattern.test(query)) {
                logger.debug(`SQL pattern detected`, {
                    pattern: rule.pattern.toString(),
                    level: rule.level,
                    category: rule.category,
                    message: rule.message
                });

                const issue = {
                    type: 'dangerous_pattern',
                    level: rule.level,
                    message: rule.message,
                    category: rule.category,
                    alwaysBlock: rule.alwaysBlock || false,
                    requiresConfirmation: rule.requiresConfirmation || false
                };
                issues.push(issue);

                if (issue.alwaysBlock) {
                    blockedCompletely = true;
                }
                if (issue.requiresConfirmation && !issue.alwaysBlock) {
                    requiresConfirmation = true;
                }
            }
        }
    }

    // Se bloccata completamente, non può richiedere conferma
    if (blockedCompletely) {
        requiresConfirmation = false;
    }

    // Log per debugging
    if (issues.length > 0) {
        logger.info(`SQL security analysis completed`, {
            queryPreview: query.substring(0, 50) + '...',
            issuesCount: issues.length,
            blocked: blockedCompletely,
            requiresConfirmation: requiresConfirmation,
            categories: [...new Set(issues.map(i => i.category))]
        });
    }

    return {
        issues,
        blockedCompletely,
        requiresConfirmation
    };
};

/**
 * Middleware Express per validazione SQL con controllo lunghezza query
 */
const validateSQLQuery = (req, res, next) => {
    const { query, confirmed } = req.body;

    if (!query) {
        return res.status(400).json({
            success: false,
            message: 'Query SQL richiesta',
            code: 'QUERY_MISSING'
        });
    }

    const userId = req.user?.id;
    if (!userId) {
        logger.error('User ID missing in validateSQLQuery middleware');
        return res.status(500).json({
            success: false,
            message: 'Errore interno: impossibile identificare l\'utente',
            code: 'USER_ID_UNKNOWN'
        });
    }

    // ✅ AGGIUNTO: Controllo lunghezza query basato sul piano
    const userPlan = req.userPlan?.plan || 'free'; // Assumendo che req.userPlan sia impostato da middleware precedente
    const maxQueryLength = userPlan.toLowerCase() === 'pro' 
        ? parseInt(process.env.MAX_QUERY_LENGTH_PRO) || 50000
        : parseInt(process.env.MAX_QUERY_LENGTH_FREE) || 10000;

    if (query.length > maxQueryLength) {
        logger.warn(`Query too long for user ${userId}`, {
            queryLength: query.length,
            maxLength: maxQueryLength,
            plan: userPlan
        });

        return res.status(400).json({
            success: false,
            message: `Query troppo lunga. Limite per piano ${userPlan}: ${maxQueryLength} caratteri`,
            code: 'QUERY_TOO_LONG',
            current: query.length,
            limit: maxQueryLength,
            upgradeToPro: userPlan === 'free'
        });
    }

    const userDatabaseName = `sql_template_user_${userId}`;
    const securityAnalysis = analyzeSQLQuery(query, userDatabaseName);

    // Memorizza l'analisi nella richiesta
    req.sqlSecurityAnalysis = securityAnalysis;

    // Query bloccata completamente
    if (securityAnalysis.blockedCompletely) {
        logger.warn(`SQL query blocked for user ${userId}`, {
            query: query.substring(0, 100),
            issues: securityAnalysis.issues.map(i => i.message)
        });

        return res.status(403).json({
            success: false,
            message: 'Query bloccata per motivi di sicurezza',
            issues: securityAnalysis.issues.filter(issue => issue.alwaysBlock),
            code: 'QUERY_BLOCKED'
        });
    }

    // Query richiede conferma
    if (securityAnalysis.requiresConfirmation && !confirmed) {
        logger.info(`SQL query requires confirmation for user ${userId}`, {
            query: query.substring(0, 100)
        });

        return res.status(400).json({
            success: false,
            message: 'Query contiene operazioni critiche e richiede conferma',
            issues: securityAnalysis.issues.filter(issue => issue.requiresConfirmation),
            code: 'CONFIRMATION_REQUIRED',
            requiresConfirmation: true
        });
    }

    // Query sicura o confermata
    logger.debug(`SQL query validated for user ${userId}`, {
        confirmed: !!confirmed,
        targetDb: userDatabaseName,
        queryLength: query.length
    });

    next();
};

/**
 * Esegue query con timeout e logging migliorato
 */
const executeQueryWithTimeout = (connection, query, timeout = 15000) => {
    return new Promise((resolve, reject) => {
        let timer = null;
        let isCompleted = false;

        const cleanup = (err = null) => {
            if (isCompleted) return;
            isCompleted = true;

            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            if (err) {
                // Tenta di distruggere la connessione in caso di errore
                try {
                    if (connection && typeof connection.destroy === 'function') {
                        connection.destroy();
                    }
                } catch (destroyError) {
                    logger.error('Error destroying connection after timeout', { 
                        error: destroyError.message 
                    });
                }
                reject(err);
            }
        };

        // Timer per timeout
        timer = setTimeout(() => {
            const timeoutError = new Error(`Query timeout after ${timeout}ms. Query may still be running on database server.`);
            timeoutError.code = 'QUERY_TIMEOUT';
            
            logger.warn('SQL query timeout occurred', { 
                timeout,
                queryPreview: query.substring(0, 100) 
            });
            
            cleanup(timeoutError);
        }, timeout);

        // Esecuzione query
        try {
            connection.query(query, (error, results) => {
                if (isCompleted) return; // Timeout già scaduto

                if (error) {
                    logger.error('SQL query execution error', { 
                        code: error.code,
                        message: error.message,
                        queryPreview: query.substring(0, 100)
                    });
                    cleanup(error);
                } else {
                    clearTimeout(timer);
                    timer = null;
                    isCompleted = true;
                    resolve(results);
                }
            });
        } catch (executionError) {
            logger.error('SQL query execution failed to start', { 
                error: executionError.message,
                queryPreview: query.substring(0, 100)
            });
            cleanup(executionError);
        }
    });
};

module.exports = {
    analyzeSQLQuery,
    validateSQLQuery,
    executeQueryWithTimeout,
    SENSITIVE_DATABASES,
    DANGEROUS_PATTERNS
};