// File: src/composables/useAiTutor.js

import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import api from '@/services/api'; // Assicurati che il percorso sia corretto
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useToasts } from '@/composables/useToasts.js';

// Configurazione di Marked (può stare fuori perché è globale)
marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false, // Disabilitiamo per evitare conflitti
  highlight: (code, lang) => {
    // Semplice highlighting, puoi espanderlo con librerie come highlight.js se vuoi
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  }
});

const SQL_KEYWORDS = [
  'sql', 'mysql', 'mariadb', 'postgresql', 'sqlite', 'database', 'db', 'rdbms', 'dbms', 'relational', 'acid', 'nosql', 'schema', 'data', 'dato', 'dati', 'query', 'select', 'insert', 'update', 'delete', 'create', 'alter', 'drop', 'truncate', 'from', 'into', 'values', 'set', 'where', 'having', 'limit', 'offset', 'join', 'inner join', 'left join', 'right join', 'full join', 'outer join', 'cross join', 'union', 'intersect', 'except', 'subquery', 'nested query', 'cte', 'with', 'group by', 'order by', 'sort', 'asc', 'desc', 'distinct', 'all', 'aggregate', 'sum', 'avg', 'count', 'min', 'max', 'concat', 'substring', 'length', 'window function', 'partition by', 'row_number', 'rank', 'dense_rank', 'varchar', 'char', 'text', 'int', 'integer', 'decimal', 'float', 'double', 'boolean', 'datetime', 'timestamp', 'date', 'time', 'year', 'json', 'blob', 'binary', 'primary key', 'foreign key', 'unique', 'not null', 'check', 'default', 'constraint', 'reference', 'cascade', 'restrict', 'table', 'tabella', 'view', 'vista', 'index', 'indice', 'procedure', 'function', 'trigger', 'event', 'column', 'colonna', 'row', 'riga', 'record', 'transaction', 'commit', 'rollback', 'savepoint', 'isolation', 'lock', 'normalization', 'denormalization', '1nf', '2nf', '3nf', 'bcnf', 'entity', 'relationship', 'er diagram', 'database design', 'innodb', 'myisam', 'storage engine', 'engine', 'backup', 'restore', 'import', 'export', 'dump', 'migration', 'grant', 'revoke', 'privilege', 'user', 'permission', 'optimize', 'analyze', 'explain', 'performance', 'null', 'auto increment', 'auto_increment', 'temporary', 'clause', 'case when', 'if', 'coalesce', 'isnull', 'exists', 'in', 'like', 'between'
];

/**
 * Un Composable per gestire tutta l'interazione con l'assistente AI "Eskuel".
 */
export function useAiTutor() {
    const { toast } = useToasts();
  const store = useStore();

  // --- STATO DEL COMPOSABLE ---
  const isAiModalOpen = ref(false);
  const aiResponse = ref('');
  const isAiLoading = ref(false);
  const aiError = ref(null);
  const aiPromptType = ref(''); // 'errorExplanation' o 'generalQuestion'

  // --- FUNZIONI DI CONTROLLO DEL MODALE ---

  const openAiModal = (type) => {
    aiPromptType.value = type;
    aiResponse.value = '';
    aiError.value = null;
    isAiLoading.value = false;
    
    isAiModalOpen.value = true;
  };

  const closeAiModal = () => {
    isAiModalOpen.value = false;
  };

  // --- FUNZIONI DI INTERAZIONE CON L'API ---

  /**
   * Chiede all'AI di spiegare un errore SQL.
   * @param {string} query - La query che ha generato l'errore.
   * @param {string} error - Il messaggio di errore da spiegare.
   */
  const explainError = async (query, error) => {
    if (!error) return;

    openAiModal('errorExplanation');
    isAiLoading.value = true;

    try {
      const response = await api.post('/ai/explain-error', {
        query: query || "N/A",
        error: error
      });
      
      handleAiResponse(response);
    } catch (err) {
      handleAiError(err);
    } finally {
      isAiLoading.value = false;
    }
  };

  /**
   * MODIFICA 2: La funzione ora accetta `questionText` come argomento obbligatorio.
   * @param {string} questionText - Il testo della domanda.
   * @param {Object} [context={}] - Oggetto opzionale con dati di contesto.
   */
  const askQuestion = async (questionText, context = {}) => {
    // Il controllo sulla domanda vuota ora viene fatto sul parametro
    if (!questionText || !questionText.trim()) {
      toast.warning("Per favore, inserisci la tua domanda.");
      return;
    }
    const trimmedQuestion = questionText.trim();

    const hasSqlKeyword = SQL_KEYWORDS.some(keyword => 
      trimmedQuestion.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasSqlKeyword) {
      toast.warning("La tua domanda sembra non essere correlata a SQL...");
    }

    isAiLoading.value = true;
    aiError.value = null;

    try {
      const response = await api.post('/ai/ask', {
        question: trimmedQuestion, // Usa il parametro passato
        ...context
      });
      handleAiResponse(response);
    } catch (err) {
      handleAiError(err);
    } finally {
      isAiLoading.value = false;
    }
  };

  // --- FUNZIONI HELPER INTERNE ---
  
  const handleAiResponse = (response) => {
    if (response.data && response.data.response) {
      aiResponse.value = response.data.response;
      if (response.data.usage) {
        // Aggiorna i crediti nello store Vuex
        store.dispatch('user/updateAiCreditsAfterUse', response.data.usage);
      }
    } else {
      aiError.value = "La risposta dell'AI ha un formato non valido.";
    }
  };

  const handleAiError = (err) => {
    console.error("Errore chiamata API AI:", err);
    if (err.response?.status === 503) {
      aiError.value = "Il servizio AI non è attualmente disponibile. Riprova più tardi.";
    } else {
      aiError.value = err.response?.data?.message || err.message || "Errore nel contattare l'assistente AI.";
    }
  };

  // --- COMPUTED PER IL RENDERING ---

  const renderedAiResponse = computed(() => {
    if (!aiResponse.value) return '';
    try {
      const rawHtml = marked.parse(aiResponse.value);
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      console.error("Errore durante il parsing del Markdown:", e);
      return `<p>${aiResponse.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</p>`;
    }
  });

  // --- ESPORTAZIONE ---
  return {
    // Stato
    isAiModalOpen,
    aiResponse,
    isAiLoading,
    aiError,
    aiPromptType,
    renderedAiResponse,

    // Azioni
    openAiModal, // Mantenuta se serve aprirlo manualmente
    closeAiModal,
    explainError,
    askQuestion,
  };
}