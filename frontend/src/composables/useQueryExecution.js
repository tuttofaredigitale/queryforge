import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import api from "../services/api"; // Assicurati che il percorso sia corretto
import { analyzeSQLQuery } from '@/utils/queryAnalyzer.js'; // Assicurati che il percorso sia corretto
import { useToasts } from './useToasts.js';

// Pattern per rilevare query che modificano il database
const DATA_MODIFICATION_PATTERNS = [
    /^INSERT\s+INTO/i,
    /^UPDATE\s+/i,
    /^DELETE\s+FROM/i,
    /^DROP\s+TABLE/i,
    /^CREATE\s+TABLE/i,
    /^ALTER\s+TABLE/i,
    /^TRUNCATE\s+TABLE/i
];

export function useQueryExecution() {
    const store = useStore();
    const { toast } = useToasts();

    // Stato Esecuzione e Risultati
    const queryResults = ref(null);
    const queryError = ref(null);
    const isExecuting = ref(false);
    const lastQuery = ref("");
    // Trigger per aggiornare QueryCounter e History
    const queryExecutionCount = ref(0); 

    // Stato Sicurezza
    const securityIssues = ref([]);
    const requiresConfirmation = ref(false);
    const isQueryBlocked = ref(false);

    /**
     * Analizza la sicurezza della query data (Client-Side).
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
     * Logica interna di esecuzione della query (con timeout e gestione errori).
     */
    const executeQueryInternal = async (queryText, confirmed = false) => {
        const controller = new AbortController();
        const timeoutDuration = /^use\s+/i.test(queryText.trim().toLowerCase()) ? 10000 : 30000;
        
        const timeoutId = setTimeout(() => {
            const timeoutError = new Error(`Timeout: La query ha impiegato più di ${timeoutDuration / 1000} secondi per rispondere.`);
            timeoutError.name = 'TimeoutError';
            controller.abort(timeoutError);
        }, timeoutDuration);

        try {
            lastQuery.value = queryText;
            const response = await api.post('/database/execute', {
                query: queryText,
                confirmed: confirmed
            }, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            queryResults.value = response.data;
            queryError.value = null; 

            // Aggiorna lo stato utente (utilizzo query)
            if (response.data.usage) {
                store.dispatch('user/updateQueryUsageAfterExecute', response.data.usage);
            }

            // Aggiorna il trigger
            queryExecutionCount.value++;

            // Salvataggio cronologia
            try {
                await api.post('/query-history', { query: queryText });
            } catch (historyError) {
                console.warn('Salvataggio cronologia saltato:', historyError.message);
            }

            resetSecurityState();
            return; // Successo

        } catch (err) {
            clearTimeout(timeoutId);
            // Passa l'errore all'handler dettagliato
            handleExecutionError(err); 
            throw err; // Rilancia l'errore gestito
        }
    };

    /**
     * Analizza l'errore di esecuzione, aggiorna lo stato UI/Sicurezza e imposta il nome dell'errore.
     */
    const handleExecutionError = (err) => {
        // Gestione specifica QUERY_BLOCKED (dal backend)
        if (err.response?.data?.code === 'QUERY_BLOCKED') {
            const specificMessage = err.response.data.issues?.[0]?.message || "Questo comando non è consentito.";
            toast.info(specificMessage, { duration: 6000 });
            
            // Imposta l'errore come "SilentError" per evitare toast rossi duplicati nel chiamante
            err.name = 'SilentError';
            return;
        }

        // Gestione altri errori
        let errorMessage = "Si è verificato un errore sconosciuto.";
        let errorName = "GenericError";

        if (err.name === 'TimeoutError') {
            errorMessage = err.message;
            errorName = err.name;
        } else if (err.response) {
            const { status, data } = err.response;
            errorMessage = data?.message || `Errore dal server (codice ${status})`;
            
            // Gestione Rate Limit (429)
            if (status === 429) {
                errorName = 'QueryLimitError';
            }
            
            // Gestione sicurezza backend (confirmation/blocking)
            if (data?.status === 'blocked' || data?.status === 'confirmation_required') {
                securityIssues.value = data.issues || [{ level: 'critical', message: data.message }];
                requiresConfirmation.value = data?.status === 'confirmation_required';
                isQueryBlocked.value = data?.status === 'blocked';
                errorMessage = "L'operazione richiede la tua attenzione nella sezione Avvisi di Sicurezza.";
            }

        } else if (err.request) {
            errorMessage = "Errore di rete: impossibile contattare il server.";
        } else {
            errorMessage = err.message;
        }

        queryError.value = errorMessage;
        // Modifichiamo l'oggetto errore originale per includere il nome e messaggio corretti
        err.message = errorMessage;
        err.name = errorName;
    };


    /**
     * Funzione principale per eseguire una query.
     */
    const executeQuery = async (queryText) => {
        if (!queryText.trim()) {
            queryError.value = "La query non può essere vuota.";
            return;
        }

        // Analisi preventiva lato client
        const analysis = analyzeSecurity(queryText);
        if (analysis.blockedCompletely || analysis.requiresConfirmation) {
            return;
        }

        isExecuting.value = true;
        queryError.value = null;

        try {
            await executeQueryInternal(queryText, false);
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
            await executeQueryInternal(queryText, true);
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
     * Gestisce la visualizzazione dei toast in base al tipo di errore.
     */
    const handleErrorToast = (error) => {
        // Mostra il toast rosso solo se non è un errore silenzioso o un limite di query
        if (error.name !== 'SilentError' && error.name !== 'QueryLimitError') {
             console.error("Errore esecuzione query:", error.message);
             toast.error(error.message || "Esecuzione fallita");
        }
    }

    const clearResults = () => {
        queryResults.value = null;
        queryError.value = null;
    }

    /**
     * Computed property per verificare se l'ultima query ha modificato i dati.
     */
    const shouldShowRefresh = computed(() => {
        if (!lastQuery.value) return false;
        const trimmedQuery = lastQuery.value.trim().toLowerCase();
        return DATA_MODIFICATION_PATTERNS.some(pattern => pattern.test(trimmedQuery));
    });

    return {
        // Stato Risultati/Esecuzione
        queryResults, queryError, isExecuting, lastQuery, queryExecutionCount,
        // Stato Sicurezza
        securityIssues, requiresConfirmation, isQueryBlocked,
        // Azioni
        analyzeSecurity, resetSecurityState, executeQuery, confirmAndExecute, clearResults,
        // Helpers
        shouldShowRefresh
    };
}