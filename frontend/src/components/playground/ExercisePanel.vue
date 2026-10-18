<template>
  <div class="flex flex-col h-full min-h-0 bg-white dark:bg-gray-800 shadow-lg">
    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
      <h3 class="text-lg sm:text-xl font-medium text-gray-700 dark:text-white">Esercizi SQL e ripasso concetti chiave</h3>
      <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="isLoading" class="flex-grow flex items-center justify-center">
        Caricamento esercizi...
    </div>
    <div v-else-if="error" class="p-4 text-red-500">
        Errore: {{ error }}
    </div>

    <div v-else class="flex flex-grow overflow-hidden min-h-0">

        <div
            class="w-full lg:w-1/2 border-r dark:border-gray-700 overflow-y-auto"
            v-show="!activeExercise || isLargeScreen"
        >
            <ExerciseNavigation
                :chapters="chapters"
                :activeLessonId="activeExercise ? activeExercise.id : null"
                @selectLesson="selectExercise"
            />
        </div>

        <div
            div class="w-full lg:w-1/2 flex flex-col overflow-hidden min-h-0"
            v-show="activeExercise || (isLargeScreen && chapters.length > 0)"
        >
            <div v-if="activeExercise && !isLargeScreen" class="p-2 border-b dark:border-gray-700 flex-shrink-0">
                <button @click="activeExercise = null" class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 text-sm flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Torna alle Lezioni
                </button>
            </div>

            <div class="flex-grow overflow-hidden min-h-0">
                <ExerciseDetail
                    :exercise="activeExercise"
                    :hasNext="hasNext"
                    :hasPrevious="hasPrevious"
                    @loadQuery="loadQueryInEditor"
                    @navigate="navigateExercises"
                />
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ExerciseNavigation from './ExerciseNavigation.vue';
import ExerciseDetail from './ExerciseDetail.vue';
import exerciseService from '@/services/exerciseService.js';
import { useToasts } from '@/composables/useToasts.js';

const emit = defineEmits(['close', 'loadQuery']);
const { toast } = useToasts();

const chapters = ref([]);
const isLoading = ref(true);
const error = ref(null);
const activeExercise = ref(null);

const isLargeScreen = ref(window.innerWidth >= 1024);

const handleResize = () => {
  isLargeScreen.value = window.innerWidth >= 1024;
};

const fetchExercises = async () => {
  isLoading.value = true;
  try {
    chapters.value = await exerciseService.fetchExercises();
  } catch (err) {
    error.value = err.message;
    toast.error("Errore nel caricamento degli esercizi.");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchExercises();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const selectExercise = (exercise) => {
  activeExercise.value = exercise;
};

const loadQueryInEditor = (query) => {
    emit('loadQuery', query);
    toast.success('Soluzione caricata nell\'editor SQL.');
};

const allExercises = computed(() => chapters.value.flatMap(chapter => chapter.lessons));
const currentIndex = computed(() => {
    if (!activeExercise.value) return -1;
    return allExercises.value.findIndex(ex => ex.id === activeExercise.value.id);
});

const hasNext = computed(() => currentIndex.value !== -1 && currentIndex.value < allExercises.value.length - 1);
const hasPrevious = computed(() => currentIndex.value > 0);

const navigateExercises = (direction) => {
    if (direction === 'next' && hasNext.value) {
        activeExercise.value = allExercises.value[currentIndex.value + 1];
    } else if (direction === 'previous' && hasPrevious.value) {
        activeExercise.value = allExercises.value[currentIndex.value - 1];
    }
};
</script>