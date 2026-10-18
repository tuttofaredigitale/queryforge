// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    svgLoader()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Configura il proxy per le richieste API
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
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
            if (id.includes('marked')) {
              return 'marked'; // Mette marked in un file separato
            }
            if (id.includes('dompurify')) {
              return 'dompurify'; // Mette dompurify in un file separato
            }
            // Tutte le altre dipendenze vanno in un unico file 'vendor'
            return 'vendor'; 
          }
        },
      },
    },
  },
});