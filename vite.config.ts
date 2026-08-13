import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function pgsqlAstParserPlugin() {
  let cachedBundle: string | null = null;

  return {
    name: 'pgsql-ast-parser-esm',
    enforce: 'pre' as const,
    configResolved() {
      const parserPath = path.resolve(__dirname, 'node_modules/pgsql-ast-parser/index.js');
      const mooPath = path.resolve(__dirname, 'node_modules/moo/moo.js');
      const nearleyPath = path.resolve(__dirname, 'node_modules/nearley/lib/nearley.js');

      let code = fs.readFileSync(parserPath, 'utf-8');
      const mooSrc = fs.readFileSync(mooPath, 'utf-8');
      const nearleySrc = fs.readFileSync(nearleyPath, 'utf-8');

      const wrapCjs = (source: string) => {
        return `(function() {\nvar define;\nvar module = { exports: {} };\nvar exports = module.exports;\n(function(module, exports) {\n${source}\n})(module, exports);\nreturn module.exports;\n})()`;
      };

      code = code.replace(
        'module.exports = require("moo");',
        `module.exports = ${wrapCjs(mooSrc)};`,
      );
      code = code.replace(
        'module.exports = require("nearley");',
        `module.exports = ${wrapCjs(nearleySrc)};`,
      );

      code = code.replace(
        '(function(e, a) { for(var i in a) e[i] = a[i]; }(exports,',
        'var __pgExports = {}; (function(e, a) { for(var i in a) e[i] = a[i]; }(__pgExports,',
      );

      const exports = [
        'parse', 'parseFirst', 'parseArrayLiteral', 'parseGeometricLiteral',
        'parseIntervalLiteral', 'parseWithComments', 'astVisitor', 'arrayNilMap',
        'assignChanged', 'astMapper', 'toSql', 'intervalToString', 'normalizeInterval', 'locationOf',
      ];
      const esmExports = exports.map(n => `export var ${n} = __pgExports.${n};`).join('\n');

      cachedBundle = `${code}\n${esmExports}\nexport default __pgExports;\n`;
    },
    resolveId(source: string) {
      if (source === 'pgsql-ast-parser') {
        return { id: '\0pgsql-ast-parser-esm' };
      }
      return null;
    },
    load(id: string) {
      if (id === '\0pgsql-ast-parser-esm') return cachedBundle;
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      base: '/',
      server: {
        port: 5173,
        host: 'localhost',
        hmr: {
          host: 'localhost',
          port: 5173,
        },
        proxy: {
          '/mimo-api': {
            target: 'https://token-plan-sgp.xiaomimimo.com/v1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/mimo-api/, ''),
          },
          '/mimo-direct-api': {
            target: 'https://api.xiaomimimo.com/v1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/mimo-direct-api/, ''),
          },
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          }
        }
      },
      plugins: [
        react(),
        tailwindcss(),
        pgsqlAstParserPlugin(),
      ],
      define: {
        'process.env.MIMO_API_KEY': JSON.stringify(env.MIMO_API_KEY),
        'process.env.MIMO_BASE_URL': JSON.stringify(env.MIMO_BASE_URL),
        'process.env.MIMO_DIRECT_API_KEY': JSON.stringify(env.MIMO_DIRECT_API_KEY),
        'process.env.MIMO_DIRECT_BASE_URL': JSON.stringify(env.MIMO_DIRECT_BASE_URL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      },
      optimizeDeps: {
        exclude: ['pgsql-ast-parser'],
      }
    };
});
