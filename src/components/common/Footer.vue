<template>
  <footer class="bg-gradient-to-r from-zinc-800 via-indigo-700 to-zinc-900 text-white">
    <div class="container mx-auto px-6 py-12">
      
      <div class="flex flex-wrap justify-between gap-8 md:gap-4">

        <div class="w-full sm:w-1/2 md:w-2/5">
          <div class="flex items-center space-x-3 mb-4">
            <LogoQueryForge alt="QueryForge Logo" class="h-10 w-10" />
              <router-link to="/"><span class="text-xl font-bold tracking-wide" style="font-family: 'Montserrat', sans-serif;">QueryForge</span></router-link> 
          </div>
          <p class="text-sm text-gray-300 leading-relaxed">
            Il playground gratuito per fare pratica con SQL, direttamente nel browser.
          </p>
          <p class="mt-4 text-sm text-gray-300">
            © {{ currentYear }} Alessio Ferrari | P.IVA 05180750233<br>
            Un progetto di <a href="https://alessioferrari.net/" target="_blank" rel="noopener noreferrer" class="font-semibold text-indigo-300 hover:text-white transition-colors">Alessio Ferrari</a>.<br>
            Il codice è su <a href="https://github.com/tuttofaredigitale/queryforge" target="_blank" rel="noopener noreferrer" class="font-semibold text-indigo-300 hover:text-white transition-colors">GitHub</a>.
          </p>
        </div>

        <!-- Legale -->
        <div class="w-1/2 sm:w-1/4 md:w-auto">
          <h3 class="text-base font-semibold uppercase tracking-wider text-gray-200 mb-4">Legale</h3>
          <ul class="space-y-2">
            <li><a href="https://www.iubenda.com/privacy-policy/57193797" target="_blank" rel="noopener noreferrer" class="text-gray-300 hover:text-white hover:underline transition-colors">Privacy Policy</a></li>
            <li><a href="https://www.iubenda.com/privacy-policy/57193797/cookie-policy" target="_blank" rel="noopener noreferrer" class="text-gray-300 hover:text-white hover:underline transition-colors">Cookie Policy</a></li>
            <li><router-link to="/terms" class="text-gray-300 hover:text-white hover:underline transition-colors">Termini e Condizioni</router-link></li>
          </ul>
        </div>

      </div>
    </div>
  </footer>
</template>

<script>
import LogoQueryForge from '@/assets/images/logoQueryForge.svg';

export default {
  name: 'AppFooter',
  components: {
    LogoQueryForge
  },
  computed: {
    currentYear() {
      return new Date().getFullYear();
    }
  }
}
</script>