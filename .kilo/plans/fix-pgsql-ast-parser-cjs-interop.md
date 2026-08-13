# Fix: pgsql-ast-parser `moo.keywords` CJS/ESM Interop Error

## Problem

`pgsql-ast-parser@12.0.2` is a **webpack-bundled CJS file** (6484 lines). It contains two bare `require()` calls that break in browser ESM context:

- **Module 0** (line 91): `module.exports = require("moo")` — moo is UMD, provides `keywords` function
- **Module 9** (line 1975): `module.exports = require("nearley")` — CJS parser generator

The internal webpack `__webpack_require__(0)` calls module 0, which does `module.exports = require("moo")`. In Vite 6's CJS→ESM transform, this bare `require("moo")` either fails to resolve or returns a broken reference, so `moo_1.keywords` is `undefined` at runtime.

Vite 7.3.1 (standalone project) handles this correctly via Rolldown's improved CJS interop. Vite 6.4.1 (main app) does not.

## Previous Attempt (builds but runtime fails)

The plan's original approach — returning raw CJS from a `load` hook — failed at **build** time (Rollup can't find ESM exports). A virtual module approach (`\0pgsql-ast-parser-esm`) was then tried:

1. `resolveId` intercepts `pgsql-ast-parser` → `\0pgsql-ast-parser-esm`
2. `load` hook inlines moo and nearley via CJS IIFEs, replaces bare `require()` calls, converts outer `exports` → `__pgExports`, appends `export var parse = __pgExports.parse` etc.

This **builds successfully** (4145 modules, 51s) but **fails at dev runtime**: `moo_1.keywords is not a function`. The inlined moo UMD wrapper is evaluated inside ESM strict mode, and something in the evaluation chain produces a moo object missing `keywords`.

## Solution: Pre-bundle with esbuild at startup

Instead of manually inlining CJS code, **delegate the CJS→ESM conversion to esbuild** by pre-bundling `pgsql-ast-parser` at Vite startup using esbuild's JavaScript API.

### Why this works

esbuild's bundler (`bundle: true, format: 'esm'`) correctly handles:
1. Bare `require("moo")` → resolves from `node_modules`, bundles inline
2. Bare `require("nearley")` → same
3. Webpack IIFE pattern → preserved as regular JavaScript
4. CJS `module.exports` → converted to ESM exports

The result is a self-contained ESM module with proper `export { parse, ... }` declarations. Both dev (Vite) and build (Rollup) can consume this cleanly.

## Files

### Modified

| File | Change |
|------|--------|
| `vite.config.ts` | Rewrite `pgsqlAstParserPlugin()` to use esbuild pre-bundling |
| `vite.config.ts` | Add `optimizeDeps.exclude: ['pgsql-ast-parser']` to prevent double-processing |

### Already done (no change)

| File | Change |
|------|--------|
| `package.json` | `vite-plugin-commonjs` already uninstalled |

## Implementation

### `vite.config.ts` — new plugin

```typescript
function pgsqlAstParserPlugin() {
  let cachedBundle: string | null = null;

  return {
    name: 'pgsql-ast-parser-esm',
    enforce: 'pre' as const,
    async configResolved() {
      const esbuild = await import('esbuild');
      const result = await esbuild.build({
        entryPoints: [path.resolve(__dirname, 'node_modules/pgsql-ast-parser/index.js')],
        bundle: true,
        format: 'esm',
        write: false,
        platform: 'browser',
        target: 'es2020',
      });
      cachedBundle = result.outputFiles[0].text;
    },
    resolveId(source: string) {
      if (source === 'pgsql-ast-parser') {
        return { id: '\0pgsql-ast-parser-esm' };
      }
      return null;
    },
    load(id: string) {
      if (id !== '\0pgsql-ast-parser-esm') return null;
      return cachedBundle;
    },
  };
}
```

### `vite.config.ts` — optimizeDeps

Add to the return object of `defineConfig`:

```typescript
optimizeDeps: {
  exclude: ['pgsql-ast-parser'],
},
```

This prevents Vite's dependency scanner from pre-bundling `pgsql-ast-parser` (our plugin handles it entirely).

## Verification

1. `npm run build` — must pass
2. `npm run dev` — navigate to `/database`, type SQL, verify ExplainCanvas renders without `moo.keywords` errors
3. No console errors referencing `moo_1.keywords` or `__x00__pgsql-ast-parser-esm`
