<template>
  <div class="min-h-screen bg-gray-100 flex flex-col dark:bg-gray-700 dark:text-gray-200">
    <main class="py-6 flex-grow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <router-view />
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<script>
import AppFooter from '@/components/common/Footer.vue';

export default {
  name: "App",
  components: {
    AppFooter
  }
};
</script>
