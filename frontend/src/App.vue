<template>
  <div class="min-h-screen bg-gray-100 flex flex-col dark:bg-gray-700 dark:text-gray-200">
    <nav v-if="isLoggedIn" class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-xl font-bold text-gray-800">QueryForge</h1>
            </div>
          </div>
          <div class="flex items-center">
            <span class="text-gray-600 mr-4">{{ username }}</span>
            <button
              @click="logout"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>

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
  },
  computed: {
    isLoggedIn() {
      return this.$store.getters["auth/isLoggedIn"];
    },
    user() {
      return this.$store.getters["auth/user"];
    },
    username() {
      return this.$store.getters["auth/user"]?.username || "";
    },
  },
  methods: {
    logout() {
      this.$store.dispatch("auth/logout");
      this.$router.push({ name: "Login" });
    }
  }
};
</script>