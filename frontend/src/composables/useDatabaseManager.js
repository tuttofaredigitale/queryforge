import { ref } from 'vue';
// Assicurati che i percorsi siano corretti rispetto alla tua struttura file
import api, { apiService } from "../services/api";
import { useToasts } from './useToasts.js';

export function useDatabaseManager() {
    // Stato reattivo
    const databaseStructure = ref([]);
    const isLoading = ref(false); // Stato di caricamento della struttura
    const error = ref(null);
    const isResetting = ref(false); // Stato di reset del database
    
    const { toast } = useToasts();

    /**
     * Carica o aggiorna la struttura del database.
     */
    const loadDatabaseStructure = async () => {
        try {
            isLoading.value = true;
            error.value = null;
            const response = await api.get('/database/structure');
            databaseStructure.value = response.data;
        } catch (err) {
            console.error("Errore caricamento struttura DB:", err);
            error.value = "Impossibile caricare la struttura del database";
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Esegue il reset del database.
     * Gestisce internamente le notifiche e l'aggiornamento della struttura.
     * Lancia un errore 'RateLimitError' specifico in caso di 429.
     */
    const resetDatabase = async () => {
        try {
            isResetting.value = true;
            await apiService.resetDatabase();
            
            toast.success('Database resettato con successo');
            
            // Ricarica automaticamente la struttura dopo il reset
            await loadDatabaseStructure();
            
            return true; // Operazione riuscita

        } catch (err) {
            console.error("Errore reset database:", err);
            
            // Gestione specifica del Rate Limit (429)
            if (err.response && err.response.status === 429) {
                // Creiamo e lanciamo un errore specifico che la UI può intercettare
                const rateLimitError = new Error(err.response.data.message || "Limite di reset raggiunto.");
                rateLimitError.name = 'RateLimitError';
                throw rateLimitError;
            } else {
                // Errore generico
                toast.error('Errore durante il reset del database');
            }
            return false; // Operazione fallita

        } finally {
            isResetting.value = false;
        }
    };

    return {
        databaseStructure,
        isLoading,
        error,
        isResetting,
        loadDatabaseStructure,
        resetDatabase
    };
}