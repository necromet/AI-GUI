import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isDev = mode === 'development';
    
    return {
      base: './',
      server: {
        port: 5173,
        host: 'localhost',
      },
      plugins: [
        react(),
        electron([
          {
            entry: 'electron/main.ts',
            onstart(options) {
              options.startup();
            },
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron', 'better-sqlite3'],
                },
              },
            },
          },
          {
            entry: 'electron/preload.ts',
            onstart(options) {
              options.reload();
            },
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron'],
                  output: {
                    format: 'cjs',
                    entryFileNames: '[name].js',
                  },
                },
                lib: {
                  entry: 'electron/preload.ts',
                  formats: ['cjs'],
                },
              },
            },
          },
        ]),
        renderer(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
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
