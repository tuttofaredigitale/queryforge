import { ref } from 'vue';
import { getDatabaseStructure, resetDatabase as resetLocalDatabase } from '@/engine/client.js';
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
            databaseStructure.value = await getDatabaseStructure();
        } catch (err) {
            console.error("Errore caricamento struttura DB:", err);
            error.value = "Impossibile caricare la struttura del database";
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Riporta il database ai dati di esempio iniziali.
     */
    const resetDatabase = async () => {
        try {
            isResetting.value = true;
            await resetLocalDatabase();

            toast.success('Database riportato ai dati iniziali');

            // Ricarica automaticamente la struttura dopo il reset
            await loadDatabaseStructure();

            return true; // Operazione riuscita
        } catch (err) {
            console.error("Errore reset database:", err);
            toast.error('Errore durante il reset del database');
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
