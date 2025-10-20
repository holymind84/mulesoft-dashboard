import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  // Elenco dei plugin da utilizzare
  plugins: [
    // Abilita il supporto completo per React (JSX, Fast Refresh, etc.)
    react(),
    
    // Permette di importare file SVG come componenti React (es. import { ReactComponent as Logo } from './logo.svg';)
    // Mantiene la compatibilità con il modo in cui Create React App gestiva gli SVG.
    svgr(),
  ],

  // Configurazione del server di sviluppo
  server: {
    // Opzionale: imposta la porta di sviluppo a 3000, la stessa usata di default da CRA
    port: 3000, 
    open: true,
    // Configurazione per gestire il client-side routing (SPA)
    historyApiFallback: true,
    // Configura il proxy per inoltrare le chiamate API ed evitare errori CORS
    proxy: {
      // Tutte le richieste che iniziano con '/api' verranno reindirizzate
      '/api': {
        // Indirizzo del tuo server backend
        target: 'http://localhost:5000', 
        
        // Necessario per far credere al backend che la richiesta provenga dalla stessa origine
        changeOrigin: true,
      }
    }
  },
  
  // Configurazione per gestire il client-side routing (SPA)
  // Reindirizza tutte le richieste non-API all'index.html
  appType: 'spa'
});