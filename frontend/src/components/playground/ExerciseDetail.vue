<template>
  <div v-if="exercise" class="p-4 flex flex-col h-full overflow-y-auto min-h-0 pb-24 md:pb-28 [padding-bottom:calc(env(safe-area-inset-bottom)+6rem)]">
    <h2 class="text-xl font-semibold mb-3 dark:text-white">{{ exercise.title }}</h2>

    <div v-if="exercise.concept" class="bg-blue-50 p-3 rounded-md mb-4 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
      <h4 class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Concetto Chiave</h4>
      <p class="text-sm text-blue-700 dark:text-blue-200">{{ exercise.concept }}</p>
    </div>

    <div class="mb-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Obiettivo</h4>
      <p class="text-gray-600 dark:text-gray-400">{{ exercise.description }}</p>
    </div>

    <div class="flex flex-col space-y-4 mb-5">

        <div v-if="exercise.hint">
            <button
                @click="showHint = !showHint"
                class="w-full px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition dark:bg-yellow-800/50 dark:text-yellow-200 dark:hover:bg-yellow-700/60 text-left"
            >
                 {{ showHint ? 'Nascondi' : 'Mostra' }} Suggerimento 💡
            </button>

            <div v-if="showHint" class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md dark:bg-yellow-900/20 dark:border-yellow-700">
                <p class="text-sm text-yellow-800 dark:text-yellow-300">{{ exercise.hint }}</p>
            </div>
        </div>

        <div>
            <button
                @click="toggleSolution"
                class="w-full px-3 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 text-left"
            >
                {{ showSolution ? 'Nascondi Soluzione' : 'Vuoi aiuto? Scopri la Soluzione 🐱‍💻' }}
            </button>

            <div v-if="showSolution" class="mt-2">
                <div class="bg-gray-100 p-4 rounded-md shadow-inner dark:bg-gray-900 border dark:border-gray-700">
                    <pre class="text-gray-800 dark:text-white font-mono text-sm overflow-x-auto"><code>{{ exercise.solution }}</code></pre>
                </div>
                <button
                    @click="loadSolution"
                    class="mt-3 w-full px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                >
                    Carica questa query nell'Editor
                </button>
            </div>
        </div>
    </div>

    <div class="flex-grow"></div>

    <div class="sticky bottom-0 left-0 right-0 z-20 flex justify-between mt-4 pt-4 border-t dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur p-4 shadow-[0_-6px_12px_-6px_rgba(0,0,0,.15)] dark:shadow-[0_-6px_12px_-6px_rgba(0,0,0,.5)]">
      <button
        @click="$emit('navigate', 'previous')"
        :disabled="!hasPrevious"
        class="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        Indietro
      </button>
      <button
        @click="$emit('navigate', 'next')"
        :disabled="!hasNext"
        class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
      >
        Avanti
      </button>
    </div>

  </div>
  <div v-else class="p-4 text-center text-gray-500 dark:text-gray-400">
    Seleziona una lezione per iniziare.
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  exercise: Object,
  hasNext: Boolean,
  hasPrevious: Boolean
});

const emit = defineEmits(['loadQuery', 'navigate']);

const showHint = ref(false);
const showSolution = ref(false); 

// Resetta lo stato quando l'esercizio cambia
watch(() => props.exercise, () => {
  showHint.value = false;
  showSolution.value = false; 
});

const toggleSolution = () => {
    showSolution.value = !showSolution.value;
};

const loadSolution = () => {
    if (props.exercise && props.exercise.solution) {
        emit('loadQuery', props.exercise.solution);
    }
};
</script>