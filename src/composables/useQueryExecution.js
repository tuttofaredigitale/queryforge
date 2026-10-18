import { ref, computed } from 'vue';
import { executeQuery as runQuery } from '@/engine/client.js';
import { addToQueryHistory } from '@/services/queryHistory.js';
import { analyzeSQLQuery } from '@/utils/queryAnalyzer.js';
import { useToasts } from './useToasts.js';

// Pattern per rilevare query che modificano il database
const DATA_MODIFICATION_PATTERNS = [
    /^INSERT\s+INTO/i,
    /^REPLACE\s+/i,
    /^UPDATE\s+/i,
    /^DELETE\s+/i,
    /^DROP\s+/i,
    /^CREATE\s+/i,
    /^ALTER\s+/i,
    /^RENAME\s+/i,
    /^TRUNCATE\s+/i
];

// Comandi che cambiano la struttura: dopo l'esecuzione la barra laterale va aggiornata
const SCHEMA_CHANGE_PATTERN = /\b(CREATE|ALTER|DROP|RENAME|TRUNCATE)\b/i;

export function useQueryExecution() {
    const { toast } = useToasts();

    // Stato Esecuzione e Risultati
    const queryResults = ref(null);
    const queryError = ref(null);
    const isExecuting = ref(false);
    const lastQuery = ref("");
    // Trigger per aggiornare la cronologia
    const queryExecutionCount = ref(0);

    // Stato Sicurezza
    const securityIssues = ref([]);
    const requiresConfirmation = ref(false);
    const isQueryBlocked = ref(false);

    /**
     * Analizza la query prima dell'esecuzione (operazioni distruttive).
     */
    const analyzeSecurity = (queryText) => {
        if (!queryText.trim()) {
            resetSecurityState();
            return { blockedCompletely: false, requiresConfirmation: false };
        }
        const analysis = analyzeSQLQuery(queryText);
        securityIssues.value = analysis.issues;
        requiresConfirmation.value = analysis.requiresConfirmation;
        isQueryBlocked.value = analysis.blockedCompletely;
        return analysis;
    };

    /**
     * Resetta lo stato di sicurezza.
     */
    const resetSecurityState = () => {
        securityIssues.value = [];
        requiresConfirmation.value = false;
        isQueryBlocked.value = false;
    };

    /**
     * Esegue la query nel database del browser e aggiorna risultati e cronologia.
     */
    const executeQueryInternal = async (queryText) => {
        lastQuery.value = queryText;
        try {
            queryResults.value = await runQuery(queryText);
            queryError.value = null;
            addToQueryHistory(queryText);
            resetSecurityState();
        } catch (err) {
            queryResults.value = null;
            queryError.value = err.message;
            addToQueryHistory(queryText, err.message);
            throw err;
        } finally {
            queryExecutionCount.value++;
        }
    };

    /**
     * Funzione principale per eseguire una query.
     */
    const executeQuery = async (queryText) => {
        if (!queryText.trim()) {
            queryError.value = "La query non può essere vuota.";
            return;
        }

        // Le operazioni distruttive richiedono una conferma
        const analysis = analyzeSecurity(queryText);
        if (analysis.blockedCompletely || analysis.requiresConfirmation) {
            return;
        }

        isExecuting.value = true;
        queryError.value = null;

        try {
            await executeQueryInternal(queryText);
            toast.success("Query eseguita con successo!");
        } catch (error) {
            handleErrorToast(error);
        } finally {
            isExecuting.value = false;
        }
    };

    /**
     * Funzione per confermare ed eseguire una query pericolosa.
     */
    const confirmAndExecute = async (queryText) => {
        isExecuting.value = true;
        queryError.value = null;

        try {
            await executeQueryInternal(queryText);
            toast.success("Query confermata ed eseguita con successo!");
        } catch (error) {
            handleErrorToast(error);
        } finally {
            isExecuting.value = false;
            // Assicuriamoci che lo stato di sicurezza sia pulito anche in caso di fallimento post-conferma
            resetSecurityState();
        }
    };

    /**
     * Mostra un toast breve: il messaggio completo è nel riquadro dei risultati.
     */
    const handleErrorToast = (error) => {
        if (error.name === 'TimeoutError') {
            toast.warning('Query interrotta: ha richiesto troppo tempo.');
        } else {
            toast.error('La query contiene un errore: trovi i dettagli nei risultati.');
        }
    };

    const clearResults = () => {
        queryResults.value = null;
        queryError.value = null;
    };

    /**
     * Computed property per verificare se l'ultima query ha modificato i dati.
     */
    const shouldShowRefresh = computed(() => {
        if (!lastQuery.value) return false;
        const trimmedQuery = lastQuery.value.trim();
        return DATA_MODIFICATION_PATTERNS.some(pattern => pattern.test(trimmedQuery));
    });

    /**
     * Vero se l'ultima query ha cambiato la struttura del database.
     */
    const changedSchema = computed(() => SCHEMA_CHANGE_PATTERN.test(lastQuery.value || ''));

    return {
        // Stato Risultati/Esecuzione
        queryResults, queryError, isExecuting, lastQuery, queryExecutionCount,
        // Stato Sicurezza
        securityIssues, requiresConfirmation, isQueryBlocked,
        // Azioni
        analyzeSecurity, resetSecurityState, executeQuery, confirmAndExecute, clearResults,
        // Helpers
        shouldShowRefresh, changedSchema
    };
}
