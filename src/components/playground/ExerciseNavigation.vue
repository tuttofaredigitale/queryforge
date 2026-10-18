<template>
  <div class="overflow-y-auto h-full">
    <div v-for="chapter in chapters" :key="chapter.chapter_id" class="border-b dark:border-gray-700">
      <div
        class="p-4 bg-gray-100 font-semibold cursor-pointer hover:bg-gray-200 transition dark:bg-gray-700 dark:hover:bg-gray-600"
        @click="toggleChapter(chapter.chapter_id)"
      >
        <div class="flex justify-between items-center">
            <span>{{ chapter.chapter_title }}</span>
            <svg v-if="openChapters.has(chapter.chapter_id)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </div>
      </div>

      <div v-if="openChapters.has(chapter.chapter_id)">
        <div
          v-for="lesson in chapter.lessons"
          :key="lesson.id"
          class="p-4 pl-6 cursor-pointer hover:bg-gray-50 transition dark:hover:bg-gray-700/50 text-sm"
          :class="{'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-900/30 dark:text-indigo-300': lesson.id === activeLessonId}"
          @click="selectLesson(lesson)"
        >
          {{ lesson.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect } from 'vue';

const props = defineProps({
  chapters: Array,
  activeLessonId: Number
});

const emit = defineEmits(['selectLesson']);

// Usiamo un Set per tracciare i capitoli aperti
const openChapters = ref(new Set());

// Apri il primo capitolo di default quando i capitoli vengono caricati
watchEffect(() => {
    if (props.chapters && props.chapters.length > 0 && openChapters.value.size === 0) {
        openChapters.value.add(props.chapters[0].chapter_id);
    }
});

const toggleChapter = (chapterId) => {
  if (openChapters.value.has(chapterId)) {
    openChapters.value.delete(chapterId);
  } else {
    openChapters.value.add(chapterId);
  }
};

const selectLesson = (lesson) => {
  emit('selectLesson', lesson);
};
</script>