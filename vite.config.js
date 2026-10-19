// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'path';

/**
 * Aggiunge banner cookie (iubenda) e Google Analytics solo se configurati,
 * così chi usa QueryForge in locale o lo pubblica altrove non invia dati
 * all'account del sito ufficiale.
 */
function analyticsTags(env) {
  return {
    name: 'queryforge-analytics',
    transformIndexHtml() {
      const tags = [];
      const iubenda = env.VITE_IUBENDA_WIDGET_ID;
      const ga = env.VITE_GA_ID;
      const hasIubenda = Boolean(iubenda && /^[A-Za-z0-9-]+$/.test(iubenda));
      if (hasIubenda) {
        tags.push({
          tag: 'script',
          attrs: { type: 'text/javascript', src: `https://embeds.iubenda.com/widgets/${iubenda}.js` },
          injectTo: 'head'
        });
      }
      if (ga && /^G-[A-Z0-9]+$/.test(ga)) {
        const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${ga}`;
        const gtagConfig = `window.dataLayer = window.dataLayer || [];\nfunction gtag() { dataLayer.push(arguments); }\ngtag('js', new Date());\ngtag('config', '${ga}');`;
        // Con il banner di iubenda, Analytics resta spento finché il visitatore non accetta
        // la "Misurazione" (finalità 4): prima non viene caricato e non manda nulla a Google.
        const consent = { type: 'text/plain', 'data-iub-purposes': '4' };
        tags.push({
          tag: 'script',
          attrs: hasIubenda
            ? { ...consent, class: '_iub_cs_activate', async: true, 'data-suppressedsrc': gtagSrc }
            : { async: true, src: gtagSrc },
          injectTo: 'head'
        });
        tags.push({
          tag: 'script',
          attrs: hasIubenda ? { ...consent, class: '_iub_cs_activate-inline' } : {},
          children: gtagConfig,
          injectTo: 'head'
        });
      }
      return tags;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      vue(),
      svgLoader(),
      analyticsTags(env)
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173
    },

    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          // Questa funzione dice a Vite come raggruppare i moduli
          manualChunks(id) {
            // Se l'ID del modulo include 'node_modules', è una dipendenza
            if (id.includes('node_modules')) {
              // Raggruppiamo le librerie pesanti in chunk separati
              if (id.includes('xlsx')) {
                return 'xlsx'; // Mette xlsx in un file separato
              }
              // Tutte le altre dipendenze vanno in un unico file 'vendor'
              return 'vendor';
            }
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/__tests__/**/*.test.js']
    }
  };
});
