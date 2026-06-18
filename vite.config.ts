import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      base: './',
      server: {
        port: 5173,
        host: 'localhost',
        proxy: {
          '/mimo-api': {
            target: 'https://token-plan-sgp.xiaomimimo.com/v1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/mimo-api/, ''),
          }
        }
      },
      plugins: [
        react(),
      ],
      define: {
        'process.env.MIMO_API_KEY': JSON.stringify(env.MIMO_API_KEY),
        'process.env.MIMO_BASE_URL': JSON.stringify(env.MIMO_BASE_URL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      }
    };
});
