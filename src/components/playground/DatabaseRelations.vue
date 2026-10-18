<template>
  <div class="w-full tab-content-wrapper">
  <div class="h-full flex flex-col">
    <div class="bg-white rounded-md shadow-sm mb-4 dark:bg-gray-800 dark:border dark:border-gray-700">
      <div class="border-b px-4 py-2 bg-gray-50 flex justify-between items-center dark:bg-gray-700 dark:border-gray-600">
        <h3 class="text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-200">Visualizzazione Relazioni Database</h3>
        <!-- Pulsante refresh semplificato -->
        <button
          @click="$emit('refresh')"
          :disabled="isLoading"
          class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors dark:text-indigo-400 dark:hover:bg-gray-600"
          title="Aggiorna struttura database"
        >
          <RefreshIcon class="h-5 w-5" :class="{'animate-spin': isLoading}" />
        </button>
      </div>
      <div class="p-4">
        <div v-if="isLoading" class="text-gray-500 dark:text-gray-400 text-center py-8">
          Caricamento struttura database...
          <div class="mt-2 w-full flex justify-center">
            <div class="animate-pulse flex space-x-2">
              <div class="h-2 w-2 bg-indigo-400 rounded-full"></div>
              <div class="h-2 w-2 bg-indigo-500 rounded-full"></div>
              <div class="h-2 w-2 bg-indigo-600 rounded-full"></div>
            </div>
          </div>
        </div>
        <div v-else-if="!databaseStructure || databaseStructure.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-8">
          Nessuna tabella trovata nel database.
        </div>
        <div v-else>
          <!-- Controlli Zoom/Reset - Versione più compatta per mobile -->
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              @click="zoomIn"
              class="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 flex items-center dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              title="Zoom In"
            >
              <PlusIcon class="h-4 w-4" />
              <span class="ml-1 hidden sm:inline text-sm">Zoom In</span>
            </button>
            
            <button
              @click="zoomOut"
              class="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 flex items-center dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              title="Zoom Out"
            >
              <MinusIcon class="h-4 w-4" />
              <span class="ml-1 hidden sm:inline text-sm">Zoom Out</span>
            </button>
            
            <button
              @click="resetView"
              class="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 flex items-center dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              title="Reset Vista"
            >
              <EyeIcon class="h-4 w-4" />
              <span class="ml-1 hidden sm:inline text-sm">Reset Vista</span>
            </button>
            
            <button
              @click="reloadDiagram"
              class="p-1.5 bg-indigo-100 hover:bg-indigo-200 rounded text-indigo-700 flex items-center dark:bg-indigo-900/50 dark:hover:bg-indigo-800/70 dark:text-indigo-300"
              title="Ricarica Diagramma"
            >
              <RefreshIcon class="h-4 w-4" />
              <span class="ml-1 hidden sm:inline text-sm">Ricarica</span>
            </button>
          </div>
          
          <!-- Opzioni di visualizzazione - Mantenuta la struttura originale ma più compatta -->
          <div class="mb-4 p-3 bg-gray-50 rounded border dark:bg-gray-700 dark:border-gray-600">
            <h4 class="font-medium text-gray-700 mb-2 dark:text-gray-200">Opzioni di visualizzazione</h4>
            <div class="flex flex-wrap gap-4">
              <div>
                <label class="block text-sm text-gray-600 mb-1 dark:text-gray-300">Layout</label>
                <select 
                  v-model="layoutType" 
                  @change="changeLayout"
                  class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                >
                  <option value="physics">Automatico (Fisica)</option>
                  <option value="hierarchical">Gerarchico</option>
                  <option value="circular">Circolare</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1 dark:text-gray-300">Classificazione tabelle</label>
                <select 
                  v-model="tableClassification" 
                  @change="reloadDiagram"
                  class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                >
                  <option value="auto">Automatica</option>
                  <option value="none">Nessuna</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Legenda a tendina per mobile, normale per desktop -->
          <div class="mb-4">
            <!-- Pulsante per mostrare/nascondere su mobile -->
            <button 
              @click="isLegendOpen = !isLegendOpen"
              class="w-full md:hidden p-2 bg-gray-50 rounded border flex items-center justify-between dark:bg-gray-700 dark:border-gray-600 mb-1"
            >
              <h4 class="font-medium text-gray-700 dark:text-gray-200 text-sm">Legenda</h4>
              <ChevronDownIcon 
                class="h-4 w-4 text-gray-500 transition-transform duration-200"
                :class="{ 'transform rotate-180': isLegendOpen }"
              />
            </button>
            
            <!-- Legenda sempre visibile su desktop, controllata da isLegendOpen su mobile -->
            <div :class="{'hidden md:block': !isLegendOpen}" class="p-3 bg-gray-50 rounded border dark:bg-gray-700 dark:border-gray-600">
              <h4 class="font-medium text-gray-700 mb-2 dark:text-gray-200 hidden md:block">Legenda</h4>
              <div class="flex flex-wrap gap-x-8 gap-y-2">
                <!-- Tipi di tabelle -->
                <div class="flex items-center">
                  <div class="w-4 h-4 bg-blue-100 border border-blue-500 rounded mr-2"></div>
                  <span class="text-sm dark:text-gray-300">Tabella Principale</span>
                </div>
                <div class="flex items-center">
                  <div class="w-4 h-4 bg-yellow-100 border border-yellow-500 rounded mr-2"></div>
                  <span class="text-sm dark:text-gray-300">Tabella di Lookup</span>
                </div>
                <div class="flex items-center">
                  <div class="w-4 h-4 bg-green-100 border border-green-500 rounded mr-2"></div>
                  <span class="text-sm dark:text-gray-300">Tabella di Associazione</span>
                </div>
                
                <!-- Tipi di relazioni -->
                <div class="flex items-center">
                  <div class="h-0.5 w-6 bg-blue-500 mr-2"></div>
                  <span class="text-sm dark:text-gray-300">Relazione 1-n</span>
                </div>
                <div class="flex items-center">
                  <div class="h-0.5 w-6 mr-2" style="border-top: 2px dashed #10B981;"></div>
                  <span class="text-sm dark:text-gray-300">Relazione n-m</span>
                </div>
                <div class="flex items-center">
                  <div class="h-0.5 w-6 mr-2" style="border-top: 2px dotted #8B5CF6;"></div>
                  <span class="text-sm dark:text-gray-300">Relazione 1-1</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Contenitore per il diagramma - Altezza adattiva per mobile -->
          <div 
            ref="diagramContainer" 
            class="w-full border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700" 
            :style="{height: isMobile ? '350px' : '500px'}"
          ></div>
          
          <!-- Suggerimento per mobile -->
          <div class="mt-2 text-xs text-center text-gray-500 dark:text-gray-400 sm:hidden">
            <p>Usa due dita per zoom, trascina per spostare</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, onMounted, watch, nextTick, inject } from 'vue';
import { RefreshIcon, PlusIcon, MinusIcon, ChevronDownIcon, EyeIcon } from '@heroicons/vue/outline';

// Importa vis-network a livello di modulo (non dinamicamente)
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

export default {
  components: {
    RefreshIcon,
    PlusIcon,
    MinusIcon,
    ChevronDownIcon,
    EyeIcon
  },
  // Resto del codice invariato
  props: {
    databaseStructure: {
      type: Array,
      required: true
    },
    isLoading: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    // Il resto del codice rimane invariato...
    const diagramContainer = ref(null);
    let network = null;
    
    // Opzioni di visualizzazione
    const layoutType = ref('physics');
    const tableClassification = ref('auto');
    
    // Stato e gestione errori
    const status = ref('Inizializzazione...');
    const error = ref(null);
    
    // Nuovi state per mobile
    const isMobile = ref(false);
    const isLegendOpen = ref(false);
    
    // Rileva se siamo su mobile
    const checkMobile = () => {
      isMobile.value = window.innerWidth < 640; // breakpoint 'sm' di Tailwind
      
      // Se cambiamo da desktop a mobile o viceversa, adattiamo il diagramma
      if (network) {
        nextTick(() => {
          network.fit();
        });
      }
    };
    
    // Accedi allo stato dark mode se disponibile
    const isDarkMode = inject('isDarkMode', ref(false));
    
    // Funzione per singolarizzare o pluralizzare parole in italiano
    const getSingularAndPluralForms = (word) => {
      // Regole principali di plurale in italiano
      const forms = [word]; // Sempre includi la forma originale
      
      // Caso speciale per alcune tabelle comuni
      const specialCases = {
        'ordini': ['ordine', 'ordini'],
        'clienti': ['cliente', 'clienti'],
        'dettagli_ordine': ['dettaglio_ordine', 'dettagli_ordine'],
        'prodotti': ['prodotto', 'prodotti'],
        'categorie': ['categoria', 'categorie'],
        'utenti': ['utente', 'utenti'],
        'fatture': ['fattura', 'fatture'],
        'pagamenti': ['pagamento', 'pagamenti']
      };
      
      if (specialCases[word]) {
        return specialCases[word];
      }
      
      // Singolarizzazione
      if (word.endsWith('i')) {
        // Plurale maschile in -i  --> singolare in -o oppure -e
        forms.push(word.slice(0, -1) + 'o'); // es. prodotti -> prodotto
        forms.push(word.slice(0, -1) + 'e'); // es. clienti -> cliente
      }
      else if (word.endsWith('e')) {
        // Plurale femminile in -e --> singolare in -a
        forms.push(word.slice(0, -1) + 'a'); // es. persone -> persona
      }
      else if (word.endsWith('o')) {
        // Singolare maschile in -o --> plurale in -i
        forms.push(word.slice(0, -1) + 'i'); // es. prodotto -> prodotti
      }
      else if (word.endsWith('a')) {
        // Singolare femminile in -a --> plurale in -e
        forms.push(word.slice(0, -1) + 'e'); // es. persona -> persone
      }
      else if (word.endsWith('e')) {
        // Singolare maschile in -e --> plurale in -i
        forms.push(word.slice(0, -1) + 'i'); // es. cliente -> clienti
      }
      
      return forms;
    };
    
    // Funzione per trovare la tabella correlata
    const findRelatedTable = (column, sourceTable) => {
      if (!column.endsWith('_id')) return null;
      
      // Estrai il nome base della tabella dalla colonna (rimuovi _id)
      const baseTableName = column.replace('_id', '');
      
      // Per ogni tabella nel database
      for (const table of props.databaseStructure) {
        // Salta la tabella stessa
        if (table.name === sourceTable) continue;
        
        // Ottieni le possibili forme della tabella target
        const possibleForms = getSingularAndPluralForms(baseTableName);
        const tableForms = getSingularAndPluralForms(table.name);
        
        // Verifica se c'è una corrispondenza tra le forme
        for (const form of possibleForms) {
          if (tableForms.includes(form)) {
            return table.name;
          }
        }
      }
      
      // Caso speciale: se la colonna è semplicemente "id" (chiave primaria), non è una relazione
      if (column === 'id') return null;
      
      // Se non troviamo corrispondenze, verifichiamo se esiste una tabella con il nome esatto
      if (props.databaseStructure.some(t => t.name === baseTableName)) {
        return baseTableName;
      }
      
      return null;
    };
    
    // Determina il tipo di tabella
    const determineTableType = (tableName, references, referencedBy) => {
      // Se abbiamo scelto di non classificare le tabelle
      if (tableClassification.value === 'none') {
        return 'main';
      }
      
      // Estrai la struttura della tabella
      const table = props.databaseStructure.find(t => t.name === tableName);
      if (!table) return 'main';
      
      // Conta le colonne che non sono chiavi
      const nonKeyColumns = table.columns.filter(c => c.key !== 'PRI' && !c.name.endsWith('_id')).length;
      
      // Se ha molte foreign keys e poche colonne proprie, è probabilmente una tabella di associazione
      if (references.length >= 2 && nonKeyColumns <= 1) {
        return 'junction';
      }
      
      // Se viene referenziata da altre tabelle ma ha poche colonne, è probabilmente una tabella di lookup
      if (referencedBy.length > 0 && nonKeyColumns <= 2) {
        return 'lookup';
      }
      
      // Se ha molte colonne proprie, è una tabella principale
      return 'main';
    };
    
    // Determina il tipo di relazione
    const determineRelationType = (sourceTable, targetTable, relations) => {
      // Conta quante volte sourceTable fa riferimento a targetTable
      const sourceToTarget = relations.filter(r => 
        r.from === sourceTable && r.to === targetTable
      ).length;
      
      // Conta quante volte targetTable fa riferimento a sourceTable
      const targetToSource = relations.filter(r => 
        r.from === targetTable && r.to === sourceTable
      ).length;
      
      // Se entrambe le tabelle fanno riferimento l'una all'altra, è probabilmente N:M
      if (sourceToTarget > 0 && targetToSource > 0) {
        return 'many-to-many';
      }
      
      // Verifica se la relazione è 1:1
      // Una relazione 1:1 potrebbe essere indicata da una colonna unique
      const table = props.databaseStructure.find(t => t.name === sourceTable);
      if (table) {
        // Cerca colonne con nome target_id e chiave UNI/PRI
        const uniqueKeys = table.columns.filter(c => 
          (c.key === 'UNI' || c.key === 'PRI') && 
          c.name.endsWith('_id')
        );
        
        for (const col of uniqueKeys) {
          const relatedTable = findRelatedTable(col.name, sourceTable);
          if (relatedTable === targetTable) {
            return 'one-to-one';
          }
        }
      }
      
      // Altrimenti, è probabilmente 1:N
      return 'one-to-many';
    };
    
    // Cambia il layout del diagramma - ottimizzato per mobile
    const changeLayout = () => {
      if (!network) return;
      
      let options = {};
      
      switch (layoutType.value) {
        case 'hierarchical':
          options = {
            physics: { enabled: false },
            layout: {
              hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                nodeSpacing: isMobile.value ? 100 : 150,
                levelSeparation: isMobile.value ? 80 : 100
              }
            }
          };
          break;
        case 'circular':
          options = {
            physics: { enabled: false },
            layout: {
              improvedLayout: true,
              randomSeed: 2,
              circular: {
                avoidOverlap: 1
              }
            }
          };
          
          // Posiziona i nodi in cerchio
          const radius = isMobile.value ? 180 : 250;
          const nodePositions = {};
          const nodes = network.body.nodes;
          const nodeIds = Object.keys(nodes);
          
          nodeIds.forEach((id, i) => {
            const angle = 2 * Math.PI * i / nodeIds.length;
            nodePositions[id] = {
              x: radius * Math.cos(angle),
              y: radius * Math.sin(angle)
            };
          });
          
          // Applica le posizioni
          network.setOptions({ 
            layout: { improvedLayout: false },
            physics: { enabled: false } 
          });
          network.setPositions(nodePositions);
          break;
        case 'physics':
        default:
          options = {
            physics: {
              enabled: true,
              solver: 'forceAtlas2Based',
              forceAtlas2Based: {
                gravitationalConstant: -100,
                centralGravity: 0.01,
                springLength: isMobile.value ? 120 : 150,
                springConstant: 0.08
              },
              maxVelocity: 50,
              minVelocity: 0.1,
              stabilization: {
                enabled: true,
                iterations: 1000,
                updateInterval: 25
              }
            },
            layout: { improvedLayout: true }
          };
          break;
      }
      
      network.setOptions(options);
      
      // Se abbiamo cambiato in un layout non-physics, ferma la simulazione
      if (layoutType.value !== 'physics') {
        setTimeout(() => {
          network.stopSimulation();
        }, 50);
      }
    };
    
    // Funzione per creare il diagramma - ottimizzato per mobile
    const createDiagram = () => {
      if (!props.databaseStructure || props.databaseStructure.length === 0) {
        status.value = 'Nessuna tabella trovata';
        return;
      }
      
      if (!diagramContainer.value) {
        status.value = 'Contenitore del diagramma non trovato';
        return;
      }
      
      try {
        status.value = 'Creazione dei nodi e delle relazioni';
        error.value = null;
        
        // Prima passata: raccogliamo tutte le relazioni
        const relations = [];
        
        props.databaseStructure.forEach((table) => {
          table.columns.forEach(column => {
            // Verifica se la colonna è una potenziale chiave esterna
            if (column.name.endsWith('_id')) {
              // Trova la tabella correlata
              const targetTableName = findRelatedTable(column.name, table.name);
              
              if (targetTableName) {
                // Aggiungi alla lista delle relazioni rilevate
                relations.push({
                  from: table.name,
                  to: targetTableName,
                  column: column.name
                });
              }
            }
          });
        });
        
        // Seconda passata: determiniamo il tipo di ogni tabella
        const tableTypes = {};
        
        // Creiamo una mappa di tabelle referenziate
        const referencesMap = {};
        const referencedByMap = {};
        
        props.databaseStructure.forEach(table => {
          referencesMap[table.name] = relations.filter(r => r.from === table.name).map(r => r.to);
          referencedByMap[table.name] = relations.filter(r => r.to === table.name).map(r => r.from);
        });
        
        // Determina il tipo di ogni tabella
        props.databaseStructure.forEach(table => {
          tableTypes[table.name] = determineTableType(
            table.name, 
            referencesMap[table.name] || [], 
            referencedByMap[table.name] || []
          );
        });
        
        // Creiamo i nodi (tabelle)
        const nodesArray = [];
        const edgesArray = [];
        
        // Aggiungiamo le tabelle come nodi
        props.databaseStructure.forEach((table) => {
          // Determiniamo il tipo di tabella e assegniamo il colore appropriato
          const tableType = tableTypes[table.name];
          let color = {
            background: '#EBF4FF', // bg-blue-100 (default)
            border: '#3B82F6',     // text-blue-500
            highlight: { background: '#DBEAFE', border: '#2563EB' } // bg-blue-50, border-blue-600
          };
          
          switch (tableType) {
            case 'lookup':
              color = {
                background: '#FEF3C7', // bg-yellow-100
                border: '#F59E0B',     // text-yellow-500
                highlight: { background: '#FEF9C3', border: '#CA8A04' } // bg-yellow-50, border-yellow-600
              };
              break;
            case 'junction':
              color = {
                background: '#DCFCE7', // bg-green-100
                border: '#10B981',     // text-green-500
                highlight: { background: '#ECFDF5', border: '#059669' } // bg-green-50, border-green-600
              };
              break;
          }
          
          // Adatta i colori per la dark mode se necessario
          if (isDarkMode.value) {
            // Rendi più scuri i colori di sfondo per la dark mode
            switch (tableType) {
              case 'main':
                color.background = '#1E3A8A'; // bg-blue-900
                color.border = '#3B82F6';     // text-blue-500
                color.highlight = { background: '#1E40AF', border: '#60A5FA' }; // bg-blue-800, border-blue-400
                break;
              case 'lookup':
                color.background = '#78350F'; // bg-yellow-900
                color.border = '#F59E0B';     // text-yellow-500
                color.highlight = { background: '#92400E', border: '#FBBF24' }; // bg-yellow-800, border-yellow-400
                break;
              case 'junction':
                color.background = '#064E3B'; // bg-green-900
                color.border = '#10B981';     // text-green-500
                color.highlight = { background: '#065F46', border: '#34D399' }; // bg-green-800, border-green-400
                break;
            }
          }
          
          // Colore del testo adatto alla dark mode
          const textColor = isDarkMode.value ? '#F9FAFB' : '#111827'; // text-gray-50 : text-gray-900
          
          // Raccogliamo le colonne in formato HTML - dimensioni ridotte per mobile
          const fontSize = isMobile.value ? '10px' : '12px';
          const padding = isMobile.value ? '6px' : '8px';
          const cellPadding = isMobile.value ? '2px' : '4px';
          
          let columnsHtml = `<div style="padding: ${padding}; background-color: ${isDarkMode.value ? '#1F2937' : '#FFFFFF'}; color: ${textColor};">`;
          columnsHtml += `<table style="width: 100%; border-collapse: collapse; font-size: ${fontSize};">`;
          
          // Aggiungiamo l'intestazione con il tipo di tabella
          columnsHtml += `
            <tr style="background-color: ${color.border}${isDarkMode.value ? '40' : '20'};">
              <td colspan="2" style="padding: ${cellPadding}; border-bottom: 1px solid ${isDarkMode.value ? '#4B5563' : '#E5E7EB'}; text-align: center; font-weight: bold; color: ${color.border};">
                ${tableType === 'main' ? 'Tabella Principale' : tableType === 'lookup' ? 'Tabella di Lookup' : 'Tabella di Associazione'}
              </td>
            </tr>
          `;
          
          table.columns.forEach(column => {
            const isPrimary = column.key === 'PRI';
            const isForeign = column.key === 'MUL'; // Assunzione: MUL indica foreign key in MySQL
            
            // Colori di sfondo per le righe adattati alla dark mode
            let rowBgColor;
            if (isDarkMode.value) {
              rowBgColor = isPrimary ? '#78350F30' : isForeign ? '#064E3B30' : '#1F2937';
            } else {
              rowBgColor = isPrimary ? '#FEFCE8' : isForeign ? '#ECFDF5' : 'white';
            }
            
            columnsHtml += `
              <tr style="background-color: ${rowBgColor}">
                <td style="padding: ${cellPadding}; border-bottom: 1px solid ${isDarkMode.value ? '#4B5563' : '#E5E7EB'}; text-align: left; display: flex; align-items: center;">
                  ${isPrimary ? '<span style="color: #EAB308; margin-right: 4px;">🔑</span>' : ''}
                  ${column.name}
                </td>
                <td style="padding: ${cellPadding}; border-bottom: 1px solid ${isDarkMode.value ? '#4B5563' : '#E5E7EB'}; text-align: right;">${column.type}</td>
              </tr>
            `;
          });
          
          columnsHtml += '</table></div>';
          
          // Aggiungiamo il nodo per questa tabella - dimensioni ridotte per mobile
          nodesArray.push({
            id: table.name,
            label: table.name,
            title: columnsHtml,
            shape: 'box',
            margin: isMobile.value ? 8 : 10,
            widthConstraint: { minimum: isMobile.value ? 100 : 120 },
            color: color,
            font: { 
              size: isMobile.value ? 12 : 14,
              color: isDarkMode.value ? '#F9FAFB' : '#111827' // text-gray-50 : text-gray-900
            }
          });
        });
        
        // Aggiungiamo le relazioni
        relations.forEach(relation => {
          // Determiniamo il tipo di relazione
          const relationType = determineRelationType(relation.from, relation.to, relations);
          
          // Stile della linea in base al tipo di relazione
          let color, width, dash;
          
          switch (relationType) {
            case 'one-to-one':
              color = '#8B5CF6'; // text-purple-500
              width = 1;
              dash = [5, 5]; // linea tratteggiata
              break;
            case 'many-to-many':
              color = '#10B981'; // text-green-500
              width = 1.5;
              dash = [6, 3]; // linea tratteggiata
              break;
            case 'one-to-many':
            default:
              color = '#3B82F6'; // text-blue-500
              width = 1;
              dash = false; // linea continua
          }
          
          // Aggiungi la relazione al diagramma
          edgesArray.push({
            from: relation.from,
            to: relation.to,
            arrows: { to: { enabled: true, type: 'arrow' } },
            label: isMobile.value ? '' : relation.column, // nascondi le etichette su mobile
            font: { 
              size: 10, 
              align: 'middle',
              color: isDarkMode.value ? '#E5E7EB' : '#374151' // text-gray-200 : text-gray-700
            },
            color: { color: color },
            width: width,
            dashes: dash,
            smooth: { type: 'curvedCW', roundness: 0.2 }
          });
        });
        
        // Creazione dei dataset
        const nodes = new DataSet(nodesArray);
        const edges = new DataSet(edgesArray);
        
        // Opzioni di configurazione di base - ottimizzate per mobile
        let options = {
          nodes: {
            shape: 'box',
            margin: isMobile.value ? 8 : 10,
            shapeProperties: {
              borderRadius: 4
            }
          },
          edges: {
            font: {
              size: isMobile.value ? 10 : 12,
              align: 'middle',
              color: isDarkMode.value ? '#E5E7EB' : '#374151' // text-gray-200 : text-gray-700
            },
            smooth: {
              type: 'curvedCW',
              roundness: 0.2
            }
          },
          physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
              gravitationalConstant: -100,
              centralGravity: 0.01,
              springLength: isMobile.value ? 120 : 150,
              springConstant: 0.08
            },
            maxVelocity: 50,
            minVelocity: 0.1,
            stabilization: {
              enabled: true,
              iterations: 1000,
              updateInterval: 25
            }
          },
          interaction: {
            hover: true,
            tooltipDelay: 200,
            hideEdgesOnDrag: true,
            navigationButtons: true,
            keyboard: true,
            zoomView: true // Abilita il pinch-to-zoom su mobile
          }
        };
        
        // Sfondo del canvas per dark mode
        if (isDarkMode.value) {
          options.manipulation = {
            enabled: false
          };
          options.configure = {
            enabled: false
          };
          
          // Imposta lo sfondo del canvas per la dark mode
          const container = diagramContainer.value;
          if (container) {
            container.style.backgroundColor = '#1F2937'; // bg-gray-800
          }
        }
        
        // Distruggiamo la rete esistente se presente
        if (network) {
          network.destroy();
          network = null;
        }
        
        status.value = 'Creazione del diagramma';
        
        // Creiamo la nuova rete
        network = new Network(diagramContainer.value, { nodes, edges }, options);
        
        // Evento per stabilizzare il layout
        network.once('stabilizationIterationsDone', () => {
          network.stopSimulation();
          status.value = 'Diagramma completato';
        });
        
        // Applica il layout selezionato
        changeLayout();
        
      } catch (err) {
        status.value = 'Errore durante la creazione del diagramma';
        error.value = err.message;
        console.error('Errore creazione diagramma:', err);
      }
    };
    
    // Funzione per ricaricare il diagramma
    const reloadDiagram = () => {
      nextTick(createDiagram);
    };
    
    // Funzioni di controllo zoom
    const zoomIn = () => {
      if (network) {
        const scale = network.getScale() + 0.1;
        network.moveTo({ scale: scale });
      }
    };
    
    const zoomOut = () => {
      if (network) {
        const scale = Math.max(0.1, network.getScale() - 0.1);
        network.moveTo({ scale: scale });
      }
    };
    
    const resetView = () => {
      if (network) {
        network.fit();
      }
    };
    
    // Osserva cambiamenti nella struttura del database
    watch(() => props.databaseStructure, () => {
      nextTick(createDiagram);
    }, { deep: true });
    
    // Osserva cambiamenti nello stato di caricamento
    watch(() => props.isLoading, (newVal) => {
      if (!newVal) {
        nextTick(createDiagram);
      }
    });
    
    // Osserva cambiamenti nello stato dark mode
    watch(() => isDarkMode.value, () => {
      // Ricarica il diagramma quando cambia il tema
      nextTick(createDiagram);
    });
    
    // Controlla lo stato mobile all'avvio e al resize
    onMounted(() => {
      checkMobile();
      window.addEventListener('resize', debounce(checkMobile, 200));
      
      // Diamo un po' di tempo al DOM per renderizzare correttamente
      setTimeout(() => {
        createDiagram();
      }, 500);
    });
    
    // Funzione debounce per evitare troppe chiamate durante il resize
    const debounce = (fn, delay) => {
      let timer = null;
      return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          fn.apply(this, args);
        }, delay);
      };
    };
    
    return {
      diagramContainer,
      zoomIn,
      zoomOut,
      resetView,
      reloadDiagram,
      status,
      error,
      layoutType,
      tableClassification,
      changeLayout,
      isMobile,
      isLegendOpen
    };
  }
};
</script>