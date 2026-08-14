# Cache Load Plan

## Goal

Implement an in-memory cache layer so the user doesn't re-fetch data on every page visit. On app init, eagerly preload all major data sources so navigation is instant.

## Problem

Currently, every component independently fetches its data from the backend on mount:

| Data | Source | Fetched In |
|------|--------|-----------|
| Conversations list | `GET /api/conversations` | `App.tsx` init + after every mutation |
| Messages | `GET /api/db/conversations/:id/messages` | `App.tsx`, `RAGChatPanel`, `AgentChatPanel`, `SkemaEditor` |
| Models | `GET /api/models` | `App.tsx` init |
| Library components | `GET /api/library/components` | `LibraryPanel` mount + filter change |
| Library folders | `GET /api/library/folders` | `LibraryPanel` mount |
| Skema projects | `GET /api/skema/projects` | `SkemaPanel` mount |
| Python projects | `GET /api/python/projects` | `PythonExecutorPanel` mount |
| RAG documents | `GET /api/rag/documents` | `RAGChatPanel` mount |
| Agent tools | `GET /api/skema-agent/tools` | `AgentChatPanel` mount |
| Token stats | `GET /api/stats/*` | `SidebarTokenStatsPanel` mount |

Each navigation away and back re-fetches the same data.

## Solution: In-Memory Cache with Eager Preload

### Step 1: Create `services/cacheService.ts`

New file. Simple in-memory key-value cache with TTL and stale-while-revalidate.

```ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // ms
}

const store = new Map<string, CacheEntry<any>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T, ttl = 60_000): void {
  store.set(key, { data, timestamp: Date.now(), ttl });
}

export function cacheInvalidate(key: string): void {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export async function cacheFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 60_000,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  cacheSet(key, data, ttl);
  return data;
}
```

### Step 2: Modify `services/apiDatabaseAdapter.ts`

Wrap all read functions with `cacheFetch`. Mutations (create/update/delete) call `cacheInvalidate`/`cacheInvalidatePrefix` after success.

**Cached reads (TTL 60s):**
- `getConversations()` → key `conversations`
- `getConversationsByType(type)` → key `conversations:${type}`
- `getConversationById(id)` → key `conversation:${id}`
- `getMessagesByConversation(id)` → key `messages:${id}`
- `getModels()` / `getAllModels()` → key `models` / `models:all`
- `getModelById(id)` → key `model:${id}`
- `getOverallTokenStats()` → key `stats:overall`
- `getTokenStatsByModel()` → key `stats:models`
- `getTokenStatsByDate(days)` → key `stats:dates:${days}`
- `getTokenStatsByConversation(limit)` → key `stats:conversations:${limit}`
- `getSkemaProjects()` → key `skema:projects`
- `getSkemaProject(id)` → key `skema:project:${id}`
- `getPythonProjects()` → key `python:projects`
- `getPythonProject(id)` → key `python:project:${id}`

**Cache invalidation on mutations:**
- `createConversation` → invalidate `conversations`, `conversations:*`
- `updateConversationTitle` → invalidate `conversations`, `conversations:*`, `conversation:${id}`
- `deleteConversation` → invalidate `conversations`, `conversations:*`, `conversation:${id}`, `messages:${id}`
- `addMessage` → invalidate `messages:${conversationId}`, `conversations` (updatedAt changes)
- `deleteMessage` → invalidate `messages:*` for the parent conversation
- `clearConversationMessages` → invalidate `messages:${conversationId}`
- `addModel` / `updateModel` / `deactivateModel` → invalidate `models`, `models:all`
- `saveSkemaProject` → invalidate `skema:projects`, `skema:project:${id}`
- `deleteSkemaProject` → invalidate `skema:projects`, `skema:project:${id}`
- `savePythonProject` / `createPythonProject` / `deletePythonProject` → invalidate `python:projects`, `python:project:${id}`

### Step 3: Modify `services/ragService.ts`

Wrap `listDocuments()` with `cacheFetch` (key `rag:documents`, TTL 60s). Invalidate on `uploadDocument` and `deleteDocument`.

### Step 4: Modify `services/agentService.ts`

Wrap `getAvailableTools()` with `cacheFetch` (key `agent:tools`, TTL 300s — tools rarely change).

### Step 5: Modify `components/LibraryPanel.tsx`

The Library panel uses direct `fetch('/api/library/...')` calls instead of `apiDatabaseAdapter`. Two options:

**Option A (recommended):** Add library API functions to `apiDatabaseAdapter.ts` (or a new `services/libraryApi.ts`) and use `cacheFetch` there. Then `LibraryPanel` calls those functions.

**Option B:** Import `cacheFetch` directly in `LibraryPanel` and wrap the fetch calls.

Go with Option A. Add to `apiDatabaseAdapter.ts`:
- `getLibraryComponents(params)` → key `library:components:${queryString}`
- `getLibraryFolders()` → key `library:folders`
- Invalidate on create/delete/update operations.

### Step 6: Modify `components/SkemaLibrary.tsx`

Same as LibraryPanel — it also does direct `fetch('/api/library/components')`. Route through the cached adapter.

### Step 7: Eager Preload in `App.tsx`

In the existing `initDb` useEffect (line 288), expand to preload all data sources in parallel:

```ts
useEffect(() => {
  const initDb = async () => {
    try {
      await db.getDatabase();
      // Eager preload — fire all in parallel, don't block UI
      Promise.allSettled([
        loadConversations(),
        loadModels(),
        db.getSkemaProjects(),
        db.getPythonProjects(),
        db.getLibraryFolders(),
        db.getLibraryComponents(),
        db.getOverallTokenStats(),
        db.getTokenStatsByModel(),
        db.getTokenStatsByConversation(20),
        db.getAvailableToolsCached(),
      ]).catch(() => {});
      // Only await the critical ones
      await Promise.all([loadConversations(), loadModels()]);
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  };
  initDb();
  // ... health check
}, []);
```

The critical data (conversations + models) is `await`ed so the sidebar populates immediately. Everything else is prefetched into the cache in the background — by the time the user navigates to Library/Skema/Python/Stats, the data is already cached.

### Step 8: Add a loading skeleton / splash (optional)

Since the user wants "load everything first to ensure smoother experience", consider showing a minimal loading state on the mode selector (`/`) while the preload completes. This is optional — the cache will work even without it.

## Files to Modify

| File | Change |
|------|--------|
| `services/cacheService.ts` | **NEW** — in-memory cache utility |
| `services/apiDatabaseAdapter.ts` | Wrap reads with `cacheFetch`, add invalidation to writes, add library API functions |
| `services/ragService.ts` | Wrap `listDocuments` with `cacheFetch`, invalidate on upload/delete |
| `services/agentService.ts` | Wrap `getAvailableTools` with `cacheFetch` |
| `App.tsx` | Expand init to preload all data sources in parallel |
| `components/LibraryPanel.tsx` | Replace direct `fetch` calls with cached adapter functions |
| `components/SkemaLibrary.tsx` | Replace direct `fetch` calls with cached adapter functions |

## Cache Invalidation Strategy

- **Read-through:** `cacheFetch` checks cache first, fetches on miss, stores result.
- **Write-through invalidation:** Every mutation function calls `cacheInvalidate` or `cacheInvalidatePrefix` on the relevant keys after the API call succeeds.
- **TTL fallback:** 60s default TTL ensures stale data is eventually refreshed even if invalidation is missed.
- **No stale-while-revalidate:** Keep it simple — cache hit returns immediately, cache miss fetches fresh. TTL is short enough (60s) that staleness is minimal.

## Verification

Run `npm run build` to verify no TypeScript errors.
