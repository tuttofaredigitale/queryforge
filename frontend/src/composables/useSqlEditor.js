// File: src/composables/useSqlEditor.js

import { ref, computed } from 'vue';

// Definizioni che non cambiano mai, possono stare fuori dalla funzione principale.
const FONT_SIZES = [
  { label: 'XS', class: 'text-xs' },
  { label: 'S', class: 'text-sm' },
  { label: 'M', class: 'text-base' },
  { label: 'L', class: 'text-lg' },
  { label: 'XL', class: 'text-xl' },
  { label: '2XL', class: 'text-2xl' }
];

const QUERY_TEMPLATES = [
  { name: "SELECT", type: "select" },
  { name: "INSERT", type: "insert" },
  { name: "UPDATE", type: "update" },
  { name: "DELETE", type: "delete" },
  { name: "CREATE TABLE", type: "create" },
  { name: "ALTER TABLE", type: "alter" },
  { name: "JOIN", type: "join" },
  { name: "GROUP BY", type: "group" },
  { name: "ORDER BY", type: "order" }
];


/**
 * Un Composable per gestire la logica dell'editor SQL, inclusi font,
 * template e azioni sull'editor.
 * 
 * @param {Ref<string>} query - Una ref che contiene il testo della query dal componente genitore.
 * @param {Ref<Array>} databaseStructure - Una ref che contiene la struttura del DB.
 */
export function useSqlEditor(query, databaseStructure) {
  
  // --- GESTIONE DIMENSIONE FONT ---

  const loadFontSizePreference = () => {
    const savedIndex = localStorage.getItem('sql-editor-font-size');
    return savedIndex !== null ? parseInt(savedIndex) : 1; // Default: indice 1 (S)
  };
  
  const fontSizeIndex = ref(loadFontSizePreference());

  const saveFontSizePreference = () => {
    localStorage.setItem('sql-editor-font-size', fontSizeIndex.value.toString());
  };
  
  const fontSizeClass = computed(() => FONT_SIZES[fontSizeIndex.value].class);
  const fontSizeLabel = computed(() => FONT_SIZES[fontSizeIndex.value].label);

  const increaseFontSize = () => {
    if (fontSizeIndex.value < FONT_SIZES.length - 1) {
      fontSizeIndex.value++;
      saveFontSizePreference();
    }
  };

  const decreaseFontSize = () => {
    if (fontSizeIndex.value > 0) {
      fontSizeIndex.value--;
      saveFontSizePreference();
    }
  };

  const resetFontSize = () => {
    fontSizeIndex.value = 1; // Torna a S (text-sm)
    saveFontSizePreference();
  };

  // --- GESTIONE TEMPLATE QUERY ---
  
  const queryTemplates = ref(QUERY_TEMPLATES);

  const getTableColumns = (tableName) => {
    if (!databaseStructure.value) return [];
    const table = databaseStructure.value.find(t => t.name === tableName);
    return table ? table.columns : [];
  };

  /**
   * Aggiorna la ref 'query' con un template SQL.
   * @param {string} type - Il tipo di template (es. 'select', 'insert').
   * @param {string|null} tableName - Il nome della tabella per il template.
   * @returns {string} - La query generata.
   */
  const insertQueryTemplate = (type, tableName) => {
    const table = tableName || (databaseStructure.value && databaseStructure.value.length > 0 ? databaseStructure.value[0].name : 'tabella');
    let templateQuery = '';

    switch (type) {
        case 'select':
          templateQuery = `SELECT * FROM ${table} LIMIT 10;`;
          break;
        case 'insert':
          const columns = getTableColumns(table);
          if (columns.length > 0) {
            const columnList = columns.map(col => col.name).join(', ');
            const valueList = columns.map(() => '?').join(', ');
            templateQuery = `INSERT INTO ${table} (${columnList}) VALUES (${valueList});`;
          } else {
            templateQuery = `INSERT INTO ${table} (colonna1, colonna2) VALUES (valore1, valore2);`;
          }
          break;
        case 'update':
          templateQuery = `UPDATE ${table} SET colonna = valore WHERE condizione;`;
          break;
        case 'delete':
          templateQuery = `DELETE FROM ${table} WHERE condizione;`;
          break;
        case 'create':
          templateQuery = `CREATE TABLE nuova_tabella (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nome VARCHAR(100) NOT NULL,\n  data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`;
          break;
        case 'alter':
          templateQuery = `ALTER TABLE ${table} ADD COLUMN nuova_colonna VARCHAR(100);`;
          break;
        case 'join':
          templateQuery = `SELECT a.*, b.* \nFROM ${table} a\nJOIN altra_tabella b ON a.id = b.id_riferimento\nLIMIT 10;`;
          break;
        case 'group':
          templateQuery = `SELECT colonna, COUNT(*) as conteggio\nFROM ${table}\nGROUP BY colonna\nORDER BY conteggio DESC;`;
          break;
        case 'order':
          templateQuery = `SELECT * FROM ${table}\nORDER BY colonna DESC\nLIMIT 10;`;
          break;
        default:
          templateQuery = `SELECT * FROM ${table} LIMIT 10;`;
      }
      
    // Aggiorna la ref della query passata dal componente genitore
    query.value = templateQuery;
    return templateQuery; // Restituisce la query per eventuali usi futuri
  };

  // --- AZIONI SULL'EDITOR ---

  /**
   * Pulisce il contenuto della ref 'query'.
   */
  const clearEditor = () => {
    query.value = "";
  };


  return {
    // Gestione font
    fontSizeClass,
    fontSizeLabel,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    
    // Gestione template
    queryTemplates,
    insertQueryTemplate,

    // Azioni
    clearEditor,
  };
}