<!-- QueryLimitModal.vue -->
<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 sm:mx-0 sm:h-10 sm:w-10">
                <ClockIcon class="h-6 w-6 text-amber-600" />
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900">
                  Limite giornaliero raggiunto
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500">
                    Hai eseguito tutte le 50 query disponibili per oggi. Il contatore si resetterà automaticamente a mezzanotte.
                  </p>
                  <p class="mt-2 text-sm text-gray-500">
                    Nel frattempo, approfitta per ripassare la teoria o esplorare nuovi argomenti!
                  </p>
                </div>
              </div>
            </div>

            <!-- Banner AF Cloud Academy -->
            <div class="mt-6 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-lg p-4">
              <div class="flex items-start space-x-3">
                <div class="bg-white/20 p-2 rounded-full flex-shrink-0">
                  <CloudIcon class="h-6 w-6 text-white" />
                </div>
                <div class="flex-1">
                  <p class="font-semibold text-white text-sm">
                    ☁️ Vuoi portare le tue competenze nel Cloud?
                  </p>
                  <p class="text-white/90 text-xs mt-1">
                    Scopri i corsi per le certificazioni AWS su AF Cloud Academy
                  </p>
                  <a 
                    href="https://alessioferrari.net/academy/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="inline-flex items-center mt-3 px-3 py-1.5 bg-white text-orange-600 rounded-md shadow hover:shadow-lg transition font-semibold text-xs"
                  >
                    <span>Visita l'Academy</span>
                    <svg class="ml-1.5 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button 
              type="button" 
              class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
              @click="$emit('close')"
            >
              Ho capito
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ClockIcon, CloudIcon } from '@heroicons/vue/outline';

export default {
  name: 'QueryLimitModal',
  components: {
    ClockIcon,
    CloudIcon
  },
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close']
};
</script>