<template>
  <div class="bg-white rounded-md shadow-sm flex-grow flex flex-col">
    <div
      class="border-b px-4 py-2 flex justify-between items-center bg-gray-50"
    >
      <h3 class="font-medium text-gray-700">Risultati</h3>
      <div class="flex space-x-2">
        <button
          @click="$emit('export-csv')"
          class="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-md transition"
          title="Esporta CSV"
        >
          <DownloadIcon class="h-4 w-4" />
        </button>
        <button
          @click="toggleFullscreen"
          class="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-md transition"
          title="Visualizza a schermo intero"
        >
          <SwitchVerticalIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
    <div
      class="p-4 overflow-auto flex-grow"
      :class="{ 'fixed inset-0 z-50 bg-white': isFullscreen }"
    >
      <table
        v-if="results.rows.length"
        class="min-w-full divide-y divide-gray-200"
      >
        <thead class="bg-gray-50">
          <tr>
            <th
              v-for="column in results.columns"
              :key="column"
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="(row, idx) in results.rows"
            :key="idx"
            class="hover:bg-gray-50 transition"
          >
            <td
              v-for="column in results.columns"
              :key="column"
              class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
            >
              {{ row[column] }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="text-center text-gray-500 py-8">
        Nessun risultato da visualizzare. Esegui una query per vedere i dati.
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { DownloadIcon, SwitchVerticalIcon } from "@heroicons/vue/outline";

export default {
  components: {
    DownloadIcon,
    SwitchVerticalIcon,
  },
  props: {
    results: {
      type: Object,
      default: () => ({
        columns: [],
        rows: [],
      }),
    },
  },
  emits: ["export-csv"],
  setup() {
    const isFullscreen = ref(false);

    const toggleFullscreen = () => {
      isFullscreen.value = !isFullscreen.value;
    };

    return {
      isFullscreen,
      toggleFullscreen,
    };
  },
};
</script>
