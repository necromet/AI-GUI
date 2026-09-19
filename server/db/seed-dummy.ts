import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const { initializeDatabase } = await import('./index.js');
const { query, pool } = await import('./pg.js');

async function seed() {
  const ok = await initializeDatabase();
  if (!ok) {
    console.error('[seed] Could not connect to database');
    process.exit(1);
  }

  console.log('[seed] Inserting dummy data...');

  // ── Models ──────────────────────────────────────────────────────
  await query(
    "INSERT INTO models (name, description, context_window_size, active, provider, is_custom) VALUES " +
    "('mimo-v2.5', 'Xiaomi MiMo v2.5 general model', 128000, TRUE, 'xiaomi', FALSE), " +
    "('mimo-v2.5-turbo', 'Xiaomi MiMo v2.5 Turbo — faster responses', 128000, TRUE, 'xiaomi', FALSE), " +
    "('deepseek-chat', 'DeepSeek V3 general chat model', 65536, TRUE, 'deepseek', FALSE), " +
    "('deepseek-reasoner', 'DeepSeek R1 reasoning model', 65536, TRUE, 'deepseek', FALSE), " +
    "('gpt-4o', 'OpenAI GPT-4o multimodal model', 128000, TRUE, 'openai', FALSE), " +
    "('gpt-4o-mini', 'OpenAI GPT-4o Mini — fast & cheap', 128000, TRUE, 'openai', FALSE), " +
    "('gemini-2.5-flash-preview-09-2025', 'Google''s fast and versatile model.', 1000000, TRUE, 'google', FALSE), " +
    "('my-custom-model', 'A custom model for testing', 32000, TRUE, 'custom', TRUE) " +
    "ON CONFLICT (name) DO NOTHING;"
  );
  console.log('[seed] Models inserted');

  // ── Conversations ───────────────────────────────────────────────
  await query(
    "INSERT INTO conversations (id, title, model_id, type, created_at, updated_at) VALUES " +
    "(1, 'Getting started with React 19', 1, 'chat', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'), " +
    "(2, 'Debugging PostgreSQL connection pool', 3, 'chat', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'), " +
    "(3, 'Explain quantum computing simply', 5, 'chat', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'), " +
    "(4, 'RAG document analysis session', 1, 'rag', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours'), " +
    "(5, 'Python data pipeline design', 3, 'chat', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour') " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  await query("SELECT setval('conversations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM conversations));");
  console.log('[seed] Conversations inserted');

  // ── Messages ────────────────────────────────────────────────────
  const msg1user = "What are the major new features in React 19?";
  const msg1model = "React 19 introduces several major features:\n\n" +
    "1. **React Compiler** — automatic memoization, no more manual `useMemo`/`useCallback`\n" +
    "2. **Actions** — async functions for form submissions with `useActionState`\n" +
    "3. **`use()` API** — read promises and context during render\n" +
    "4. **Server Components** — first-class RSC support\n" +
    "5. **Document Metadata** — native `<title>` and `<meta>` in components\n" +
    "6. **Asset Loading** — built-in preloading for stylesheets, fonts, and scripts\n\n" +
    "These changes significantly reduce boilerplate and improve performance.";

  const msg1user2 = "Can you show me an example of useActionState?";
  const msg1model2 = "```tsx\nimport { useActionState } from \"react\";\n\n" +
    "async function addToCart(prevState, item) {\n" +
    "  const res = await fetch(\"/api/cart\", {\n" +
    "    method: \"POST\",\n" +
    "    body: JSON.stringify({ item }),\n" +
    "  });\n" +
    "  if (!res.ok) return { error: \"Failed to add\" };\n" +
    "  return { success: true, item };\n" +
    "}\n\n" +
    "function CartButton({ item }) {\n" +
    "  const [state, formAction, isPending] = useActionState(addToCart, null);\n\n" +
    "  return (\n" +
    "    <form action={formAction}>\n" +
    "      <input type=\"hidden\" name=\"item\" value={item.id} />\n" +
    "      <button disabled={isPending}>\n" +
    "        {isPending ? \"Adding...\" : \"Add to Cart\"}\n" +
    "      </button>\n" +
    "      {state?.error && <p className=\"text-red-500\">{state.error}</p>}\n" +
    "      {state?.success && <p className=\"text-green-500\">Added!</p>}\n" +
    "    </form>\n" +
    "  );\n" +
    "}\n```\n\n" +
    "The key difference from React 18: the action receives the previous state as its first argument and form data as the second.";

  const msg2user = "My pg pool keeps timing out after 30 seconds. What could be wrong?";
  const msg2model = "Common causes for pool timeouts:\n\n" +
    "1. **Max connections exhausted** — check `pool.totalCount` vs your max setting\n" +
    "2. **Idle connections not released** — ensure `client.release()` is called in `finally` blocks\n" +
    "3. **Long-running queries** — check `pg_stat_activity` for blocking queries\n" +
    "4. **Network/firewall** — connection may be dropped silently\n\n" +
    "```ts\npool.on(\"error\", (err) => {\n  console.error(\"Pool error:\", err.message);\n});\n```\n\n" +
    "Add this listener to catch unexpected idle client errors.";

  const msg2user2 = "I found the issue — a missing release in a transaction error path. Thanks!";
  const msg2model2 = "Glad you found it! Always wrap pool.connect() in try/finally:\n\n" +
    "```ts\nconst client = await pool.connect();\ntry {\n" +
    "  await client.query(\"BEGIN\");\n  // ... queries ...\n" +
    "  await client.query(\"COMMIT\");\n} catch (e) {\n" +
    "  await client.query(\"ROLLBACK\");\n  throw e;\n" +
    "} finally {\n  client.release();\n}\n```\n\n" +
    "This guarantees the connection returns to the pool even on errors.";

  const msg3user = "Explain quantum computing like I'm 10 years old";
  const msg3model = "Imagine you have a magic coin.\n\n" +
    "A **normal coin** is either heads or tails. You have to look at it to know.\n\n" +
    "A **quantum coin** can be heads AND tails at the same time — until you look at it! " +
    "That's called **superposition**.\n\n" +
    "Now imagine you have 100 magic coins. A normal computer tries one combination at a time: " +
    "\"all heads, then 99 heads + 1 tail...\" — slowly.\n\n" +
    "A quantum computer flips ALL 100 coins at once and somehow they work together to find the answer faster. " +
    "That's called **entanglement** — the coins \"talk\" to each other.\n\n" +
    "It's not magic, it's physics — and it's really hard to build because the coins are super delicate " +
    "and break if you bump the table (that's **decoherence**).";

  const msg5user = "Design a data pipeline in Python that reads CSV, transforms it, and loads into PostgreSQL";
  const msg5model = "Here's a clean ETL pipeline:\n\n" +
    "```python\nimport pandas as pd\nfrom sqlalchemy import create_engine\n\n" +
    "def extract(file_path: str) -> pd.DataFrame:\n    return pd.read_csv(file_path)\n\n" +
    "def transform(df: pd.DataFrame) -> pd.DataFrame:\n" +
    "    df = df.dropna()\n    df[\"created_at\"] = pd.to_datetime(df[\"created_at\"])\n" +
    "    df[\"name\"] = df[\"name\"].str.strip().str.lower()\n    return df\n\n" +
    "def load(df: pd.DataFrame, table: str, conn_str: str):\n" +
    "    engine = create_engine(conn_str)\n" +
    "    df.to_sql(table, engine, if_exists=\"append\", index=False)\n\n" +
    "if __name__ == \"__main__\":\n" +
    "    df = extract(\"data/input.csv\")\n    df = transform(df)\n" +
    "    load(df, \"processed_data\", \"postgresql://user:pass@localhost/mydb\")\n```\n\n" +
    "Want me to add error handling, logging, or incremental loading?";

  const msg5user2 = "Add logging and retry logic";
  const msg5model2 = "```python\nimport logging\nimport time\nfrom functools import wraps\n" +
    "import pandas as pd\nfrom sqlalchemy import create_engine\n\n" +
    "logging.basicConfig(level=logging.INFO, format=\"%(asctime)s %(levelname)s %(message)s\")\n" +
    "logger = logging.getLogger(__name__)\n\n" +
    "def retry(max_attempts=3, delay=5):\n" +
    "    def decorator(fn):\n        @wraps(fn)\n" +
    "        def wrapper(*args, **kwargs):\n" +
    "            for attempt in range(1, max_attempts + 1):\n" +
    "                try:\n                    return fn(*args, **kwargs)\n" +
    "                except Exception as e:\n" +
    "                    logger.warning(f\"Attempt {attempt}/{max_attempts} failed: {e}\")\n" +
    "                    if attempt == max_attempts:\n                        raise\n" +
    "                    time.sleep(delay)\n        return wrapper\n    return decorator\n\n" +
    "@retry(max_attempts=3, delay=5)\n" +
    "def extract(file_path: str) -> pd.DataFrame:\n" +
    "    logger.info(f\"Extracting from {file_path}\")\n" +
    "    df = pd.read_csv(file_path)\n    logger.info(f\"Extracted {len(df)} rows\")\n    return df\n\n" +
    "@retry(max_attempts=3, delay=5)\n" +
    "def transform(df: pd.DataFrame) -> pd.DataFrame:\n" +
    "    logger.info(\"Transforming data...\")\n    df = df.dropna()\n" +
    "    df[\"created_at\"] = pd.to_datetime(df[\"created_at\"])\n" +
    "    df[\"name\"] = df[\"name\"].str.strip().str.lower()\n" +
    "    logger.info(f\"Transformed to {len(df)} rows\")\n    return df\n\n" +
    "@retry(max_attempts=3, delay=5)\n" +
    "def load(df: pd.DataFrame, table: str, conn_str: str):\n" +
    "    logger.info(f\"Loading {len(df)} rows into {table}\")\n" +
    "    engine = create_engine(conn_str)\n" +
    "    df.to_sql(table, engine, if_exists=\"append\", index=False)\n" +
    "    logger.info(\"Load complete\")\n\n" +
    "if __name__ == \"__main__\":\n" +
    "    try:\n        df = extract(\"data/input.csv\")\n" +
    "        df = transform(df)\n" +
    "        load(df, \"processed_data\", \"postgresql://user:pass@localhost/mydb\")\n" +
    "    except Exception:\n        logger.exception(\"Pipeline failed\")\n        raise\n```\n\n" +
    "Each step retries 3 times with a 5-second delay. All failures are logged with full tracebacks.";

  // Helper to escape single quotes for SQL
  const esc = (s: string) => s.replace(/'/g, "''");

  await query(
    "INSERT INTO messages (conversation_id, role, content, message_order, timestamp, token_count) VALUES " +
    `(1, 'user', '${esc(msg1user)}', 1, NOW() - INTERVAL '3 days', NULL), ` +
    `(1, 'model', '${esc(msg1model)}', 2, NOW() - INTERVAL '3 days' + INTERVAL '30 seconds', 245), ` +
    `(1, 'user', '${esc(msg1user2)}', 3, NOW() - INTERVAL '2 days' - INTERVAL '1 hour', NULL), ` +
    `(1, 'model', '${esc(msg1model2)}', 4, NOW() - INTERVAL '2 days' - INTERVAL '50 minutes', 312), ` +
    `(2, 'user', '${esc(msg2user)}', 1, NOW() - INTERVAL '2 days', NULL), ` +
    `(2, 'model', '${esc(msg2model)}', 2, NOW() - INTERVAL '2 days' + INTERVAL '45 seconds', 178), ` +
    `(2, 'user', '${esc(msg2user2)}', 3, NOW() - INTERVAL '1 day' - INTERVAL '6 hours', NULL), ` +
    `(2, 'model', '${esc(msg2model2)}', 4, NOW() - INTERVAL '1 day' - INTERVAL '5 hours', 134), ` +
    `(3, 'user', '${esc(msg3user)}', 1, NOW() - INTERVAL '1 day', NULL), ` +
    `(3, 'model', '${esc(msg3model)}', 2, NOW() - INTERVAL '1 day' + INTERVAL '2 minutes', 256), ` +
    `(5, 'user', '${esc(msg5user)}', 1, NOW() - INTERVAL '3 hours', NULL), ` +
    `(5, 'model', '${esc(msg5model)}', 2, NOW() - INTERVAL '3 hours' + INTERVAL '1 minute', 189), ` +
    `(5, 'user', '${esc(msg5user2)}', 3, NOW() - INTERVAL '2 hours', NULL), ` +
    `(5, 'model', '${esc(msg5model2)}', 4, NOW() - INTERVAL '1 hour', 367) ` +
    "ON CONFLICT (conversation_id, message_order) DO NOTHING;"
  );
  await query("SELECT setval('messages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM messages));");
  console.log('[seed] Messages inserted');

  // ── Library Folders ─────────────────────────────────────────────
  await query(
    "INSERT INTO library_folders (id, name, description, color, icon, sort_order, agent_accessible) VALUES " +
    "('folder-ui', 'UI Components', 'Reusable React UI components', '#6366f1', 'layout', 1, TRUE), " +
    "('folder-utils', 'Utilities', 'Helper functions and utilities', '#f59e0b', 'wrench', 2, TRUE), " +
    "('folder-hooks', 'Custom Hooks', 'React custom hooks', '#10b981', 'anchor', 3, TRUE), " +
    "('folder-api', 'API Clients', 'Backend API client wrappers', '#ef4444', 'globe', 4, TRUE) " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Library folders inserted');

  // ── Library Components ──────────────────────────────────────────
  const btnContent = "import { cn } from \"@/lib/utils\";\nimport { ButtonHTMLAttributes, forwardRef } from \"react\";\n\n" +
    "interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {\n" +
    "  variant?: \"default\" | \"outline\" | \"ghost\" | \"destructive\";\n" +
    "  size?: \"sm\" | \"md\" | \"lg\";\n}\n\n" +
    "const Button = forwardRef<HTMLButtonElement, ButtonProps>(\n" +
    "  ({ className, variant = \"default\", size = \"md\", ...props }, ref) => {\n" +
    "    return (\n" +
    "      <button\n        ref={ref}\n" +
    "        className={cn(\n" +
    "          \"inline-flex items-center justify-center rounded-md font-medium transition-colors\",\n" +
    "          variant === \"outline\" && \"border border-input bg-transparent hover:bg-accent\",\n" +
    "          variant === \"ghost\" && \"hover:bg-accent\",\n" +
    "          variant === \"destructive\" && \"bg-destructive text-white hover:bg-destructive/90\",\n" +
    "          variant === \"default\" && \"bg-primary text-primary-foreground hover:bg-primary/90\",\n" +
    "          size === \"sm\" && \"h-8 px-3 text-sm\",\n" +
    "          size === \"md\" && \"h-10 px-4\",\n" +
    "          size === \"lg\" && \"h-12 px-6 text-lg\",\n" +
    "          className\n        )}\n        {...props}\n      />\n    );\n  }\n);\n" +
    "Button.displayName = \"Button\";\nexport { Button };";

  const cardContent = "import { cn } from \"@/lib/utils\";\nimport { HTMLAttributes, forwardRef } from \"react\";\n\n" +
    "const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(\n" +
    "  ({ className, ...props }, ref) => (\n" +
    "    <div ref={ref} className={cn(\"rounded-lg border bg-card text-card-foreground shadow-sm\", className)} {...props} />\n  )\n);\n" +
    "const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(\n" +
    "  ({ className, ...props }, ref) => (\n" +
    "    <div ref={ref} className={cn(\"flex flex-col space-y-1.5 p-6\", className)} {...props} />\n  )\n);\n" +
    "const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(\n" +
    "  ({ className, ...props }, ref) => (\n" +
    "    <div ref={ref} className={cn(\"p-6 pt-0\", className)} {...props} />\n  )\n);\n" +
    "export { Card, CardHeader, CardContent };";

  const debounceContent = "import { useState, useEffect } from \"react\";\n\n" +
    "export function useDebounce<T>(value: T, delay: number): T {\n" +
    "  const [debouncedValue, setDebouncedValue] = useState(value);\n\n" +
    "  useEffect(() => {\n" +
    "    const timer = setTimeout(() => setDebouncedValue(value), delay);\n" +
    "    return () => clearTimeout(timer);\n" +
    "  }, [value, delay]);\n\n" +
    "  return debouncedValue;\n}";

  const apiClientContent = "const BASE_URL = \"/api\";\n\n" +
    "interface RequestOptions {\n  method?: string;\n  body?: any;\n  headers?: Record<string, string>;\n}\n\n" +
    "export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {\n" +
    "  const { method = \"GET\", body, headers = {} } = options;\n" +
    "  const res = await fetch(`${BASE_URL}${endpoint}`, {\n" +
    "    method,\n    headers: { \"Content-Type\": \"application/json\", ...headers },\n" +
    "    body: body ? JSON.stringify(body) : undefined,\n    credentials: \"include\",\n" +
    "  });\n  if (!res.ok) {\n" +
    "    const err = await res.json().catch(() => ({ error: res.statusText }));\n" +
    "    throw new Error(err.error || `HTTP ${res.status}`);\n" +
    "  }\n  return res.json();\n}";

  const localStorageContent = "\"use client\";\nimport { useState, useEffect } from \"react\";\n\n" +
    "export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {\n" +
    "  const [storedValue, setStoredValue] = useState<T>(() => {\n" +
    "    if (typeof window === \"undefined\") return initialValue;\n" +
    "    try {\n" +
    "      const item = window.localStorage.getItem(key);\n" +
    "      return item ? JSON.parse(item) : initialValue;\n" +
    "    } catch {\n      return initialValue;\n    }\n  });\n\n" +
    "  useEffect(() => {\n    try {\n" +
    "      window.localStorage.setItem(key, JSON.stringify(storedValue));\n" +
    "    } catch (e) {\n      console.error(\"useLocalStorage write error:\", e);\n    }\n  }, [key, storedValue]);\n\n" +
    "  return [storedValue, setStoredValue];\n}";

  await query(
    "INSERT INTO library_components (id, name, category, content_type, description, tags, content, is_global, agent_accessible, folder_id) VALUES " +
    "('comp-button', 'Button', 'UI', 'tsx', 'A versatile button component with variants', 'button,ui,form', " +
    `'${esc(btnContent)}', TRUE, TRUE, 'folder-ui'), ` +
    "('comp-card', 'Card', 'UI', 'tsx', 'Card container with header, content, footer', 'card,ui,container', " +
    `'${esc(cardContent)}', TRUE, TRUE, 'folder-ui'), ` +
    "('comp-use-debounce', 'useDebounce', 'Hooks', 'tsx', 'Debounce a value by specified delay', 'hook,debounce,performance', " +
    `'${esc(debounceContent)}', TRUE, TRUE, 'folder-hooks'), ` +
    "('comp-api-client', 'API Client', 'API', 'ts', 'Base HTTP client with auth and error handling', 'api,fetch,http,client', " +
    `'${esc(apiClientContent)}', TRUE, TRUE, 'folder-api'), ` +
    "('comp-use-local-storage', 'useLocalStorage', 'Hooks', 'tsx', 'Persist state to localStorage with SSR safety', 'hook,storage,state', " +
    `'${esc(localStorageContent)}', TRUE, TRUE, 'folder-hooks') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Library components inserted');

  // ── Skema Projects ──────────────────────────────────────────────
  await query(
    "INSERT INTO skema_projects (id, title, description, project_type, boards_json, created_at, updated_at) VALUES " +
    "('skema-demo-1', 'Landing Page Concept', 'A modern SaaS landing page design', 'canvas', " +
    "'[{\"layout\":\"16:9\",\"elements\":[{\"type\":\"text\",\"content\":\"Welcome to SaaS\",\"x\":100,\"y\":50,\"fontSize\":48},{\"type\":\"shape\",\"shapeType\":\"rectangle\",\"x\":50,\"y\":150,\"width\":300,\"height\":200}]}]', " +
    "NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days'), " +
    "('skema-demo-2', 'Mobile App Wireframe', 'Wireframes for a fitness tracking app', 'canvas', " +
    "'[{\"layout\":\"9:16\",\"elements\":[{\"type\":\"text\",\"content\":\"FitTrack\",\"x\":20,\"y\":20,\"fontSize\":32},{\"type\":\"shape\",\"shapeType\":\"circle\",\"x\":140,\"y\":200,\"width\":100,\"height\":100}]}]', " +
    "NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day') " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Skema projects inserted');

  // ── Skema Components ────────────────────────────────────────────
  await query(
    "INSERT INTO skema_components (id, name, category, content_type, project_type, description, tags, content, is_global) VALUES " +
    "('sc-hero', 'Hero Section', 'Layout', 'html', 'all', 'Full-width hero with headline and CTA', 'hero,landing,layout', " +
    "'<section class=\"hero\"><h1>Welcome</h1><p>Build something amazing</p><button>Get Started</button></section>', TRUE), " +
    "('sc-navbar', 'Navigation Bar', 'Navigation', 'html', 'all', 'Responsive top navigation bar', 'nav,header,menu', " +
    "'<nav class=\"navbar\"><a href=\"/\">Home</a><a href=\"/about\">About</a><a href=\"/contact\">Contact</a></nav>', TRUE), " +
    "('sc-card-grid', 'Card Grid', 'Layout', 'html', 'all', 'Responsive grid of cards', 'grid,cards,layout', " +
    "'<div class=\"card-grid\"><div class=\"card\">Card 1</div><div class=\"card\">Card 2</div><div class=\"card\">Card 3</div></div>', TRUE) " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Skema components inserted');

  // ── RAG Documents ───────────────────────────────────────────────
  await query(
    "INSERT INTO rag_documents (id, name, type, chunk_count, created_at) VALUES " +
    "('rag-doc-1', 'React 19 Migration Guide', 'pdf', 12, NOW() - INTERVAL '4 days'), " +
    "('rag-doc-2', 'PostgreSQL Best Practices', 'md', 8, NOW() - INTERVAL '3 days'), " +
    "('rag-doc-3', 'API Design Guidelines', 'txt', 5, NOW() - INTERVAL '2 days') " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] RAG documents inserted');

  // ── Python Projects ─────────────────────────────────────────────
  const pyMain = '[{"name":"main.py","content":"import pandas as pd\\ndf = pd.read_csv(\\"data.csv\\")\\nprint(df.describe())","language":"python"},{"name":"utils.py","content":"def clean_data(df):\\n    return df.dropna()","language":"python"}]';
  const pyFlask = '[{"name":"app.py","content":"from flask import Flask, jsonify\\napp = Flask(__name__)\\n\\n@app.route(\\"/api/health\\")\\ndef health():\\n    return jsonify({\\"status\\": \\"ok\\"})\\n\\nif __name__ == \\"__main__\\":\\n    app.run(debug=True)","language":"python"}]';

  await query(
    "INSERT INTO python_projects (id, title, description, files_json, created_at, updated_at) VALUES " +
    `('py-proj-1', 'Data Analysis Script', 'Pandas-based CSV analyzer', '${esc(pyMain)}', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'), ` +
    `('py-proj-2', 'Flask API Starter', 'Minimal REST API with Flask', '${esc(pyFlask)}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Python projects inserted');

  // ── Notes ───────────────────────────────────────────────────────
  const notesBlocks1 = '[{"type":"heading","content":"Project Planning"},{"type":"paragraph","content":"Key milestones for Q4 2026:"},{"type":"bulletList","content":["Launch v2.0 with AI agent","Migrate to PostgreSQL 17","Add real-time collaboration"]}]';
  const notesBlocks2 = '[{"type":"heading","content":"Meeting Notes"},{"type":"paragraph","content":"Weekly sync notes"}]';
  const notesBlocks3 = '[{"type":"heading","content":"Sprint Retrospective - Week 36"},{"type":"paragraph","content":"What went well: Shipped the new editor component ahead of schedule."},{"type":"paragraph","content":"What to improve: Need better test coverage for edge cases."}]';
  const notesBlocks4 = '[{"type":"heading","content":"Architecture Decisions"},{"type":"paragraph","content":"Decision: Use Vercel AI SDK for agent streaming instead of raw SSE."},{"type":"paragraph","content":"Rationale: Better tool call handling, multi-step support, and provider abstraction."}]';

  await query(
    "INSERT INTO notes (id, title, icon, parent_id, sort_order, blocks_json, is_favorite, created_at, updated_at) VALUES " +
    `('note-root-1', 'Project Planning', '📋', NULL, 0, '${esc(notesBlocks1)}', TRUE, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day'), ` +
    `('note-root-2', 'Meeting Notes', '📝', NULL, 1, '${esc(notesBlocks2)}', FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'), ` +
    `('note-child-1', 'Sprint Retrospective', '🔄', 'note-root-2', 0, '${esc(notesBlocks3)}', FALSE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'), ` +
    `('note-child-2', 'Architecture Decisions', '🏗️', 'note-root-1', 0, '${esc(notesBlocks4)}', TRUE, NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Notes inserted');

  // ── Agent Builder Tools ─────────────────────────────────────────
  const toolImpl1 = "async (params) => { return { results: 'Results for: ' + params.query }; }";
  const toolImpl2 = "async (params) => { try { return { result: eval(params.expression) }; } catch { return { error: 'Invalid expression' }; } }";
  const toolImpl3 = "async (params) => { try { return { output: eval(params.code) }; } catch (e) { return { error: e.message }; } }";
  const toolSchema1 = '{"type":"object","properties":{"query":{"type":"string","description":"Search query"}},"required":["query"]}';
  const toolSchema2 = '{"type":"object","properties":{"expression":{"type":"string","description":"Math expression"}},"required":["expression"]}';
  const toolSchema3 = '{"type":"object","properties":{"code":{"type":"string","description":"JavaScript code to run"}},"required":["code"]}';

  await query(
    "INSERT INTO agent_builder_tools (id, name, description, parameters_schema, implementation, icon, color, created_at, updated_at) VALUES " +
    `('tool-web-search', 'Web Search', 'Search the web for information', '${esc(toolSchema1)}', '${esc(toolImpl1)}', 'search', '#3B82F6', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days'), ` +
    `('tool-calculator', 'Calculator', 'Perform mathematical calculations', '${esc(toolSchema2)}', '${esc(toolImpl2)}', 'calculator', '#10B981', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days'), ` +
    `('tool-code-executor', 'Code Executor', 'Execute JavaScript code in a sandbox', '${esc(toolSchema3)}', '${esc(toolImpl3)}', 'code', '#8B5CF6', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Agent builder tools inserted');

  // ── Agent Builder Agents ────────────────────────────────────────
  await query(
    "INSERT INTO agent_builder_agents (id, name, description, system_prompt, model, provider, color, icon, created_at, updated_at) VALUES " +
    "('agent-researcher', 'Research Assistant', 'Searches the web and summarizes findings', " +
    "'You are a research assistant. Use the web search tool to find information and provide concise summaries with sources.', " +
    "'mimo-v2.5', 'xiaomi', '#3B82F6', 'search', NOW() - INTERVAL '9 days', NOW() - INTERVAL '4 days'), " +
    "('agent-coder', 'Code Assistant', 'Writes and executes code to solve problems', " +
    "'You are a coding assistant. Write clean, well-documented code. Use the code executor tool to verify your solutions.', " +
    "'deepseek-chat', 'deepseek', '#8B5CF6', 'code', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days'), " +
    "('agent-analyst', 'Data Analyst', 'Performs calculations and data analysis', " +
    "'You are a data analyst. Use the calculator tool for computations and provide clear explanations of your analysis.', " +
    "'gpt-4o', 'openai', '#10B981', 'bar-chart', NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days') " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Agent builder agents inserted');

  // ── Agent Builder Agent-Tool Junction ───────────────────────────
  await query(
    "INSERT INTO agent_builder_agent_tools (agent_id, tool_id) VALUES " +
    "('agent-researcher', 'tool-web-search'), " +
    "('agent-coder', 'tool-code-executor'), " +
    "('agent-coder', 'tool-calculator'), " +
    "('agent-analyst', 'tool-calculator'), " +
    "('agent-analyst', 'tool-web-search') " +
    "ON CONFLICT (agent_id, tool_id) DO NOTHING;"
  );
  console.log('[seed] Agent-tool junctions inserted');

  // ── Agent Builder Workflows ─────────────────────────────────────
  const wfGraph = '{"nodes":[{"id":"n1","type":"agent","data":{"agentId":"agent-researcher"},"position":{"x":100,"y":100}},{"id":"n2","type":"agent","data":{"agentId":"agent-analyst"},"position":{"x":400,"y":100}}],"edges":[{"id":"e1","source":"n1","target":"n2"}]}';

  await query(
    "INSERT INTO agent_builder_workflows (id, name, description, graph_json, created_at, updated_at) VALUES " +
    `('workflow-1', 'Research & Summarize', 'Search the web and create a summary', '${esc(wfGraph)}', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Agent builder workflows inserted');

  // ── Agent Builder Workflow-Agent Junction ───────────────────────
  await query(
    "INSERT INTO agent_builder_workflow_agents (workflow_id, agent_id) VALUES " +
    "('workflow-1', 'agent-researcher'), " +
    "('workflow-1', 'agent-analyst') " +
    "ON CONFLICT (workflow_id, agent_id) DO NOTHING;"
  );
  console.log('[seed] Workflow-agent junctions inserted');

  // ── Agent Builder Sessions ──────────────────────────────────────
  const absMessages = '[{"role":"user","content":"Find recent breakthroughs in quantum error correction"},{"role":"assistant","content":"Here are the key recent breakthroughs in quantum error correction..."}]';

  await query(
    "INSERT INTO agent_builder_sessions (id, agent_id, title, messages_json, created_at, updated_at) VALUES " +
    `('abs-1', 'agent-researcher', 'Research session on quantum computing', '${esc(absMessages)}', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Agent builder sessions inserted');

  // ── Workflows (visual execution engine) ─────────────────────────
  const wfNodes1 = '[{"id":"start","type":"start","position":{"x":0,"y":200}},{"id":"transform","type":"transform","position":{"x":200,"y":200},"data":{"operation":"clean"}},{"id":"end","type":"end","position":{"x":400,"y":200}}]';
  const wfEdges1 = '[{"id":"e1","source":"start","target":"transform"},{"id":"e2","source":"transform","target":"end"}]';
  const wfNodes2 = '[{"id":"start","type":"start","position":{"x":0,"y":200}},{"id":"classify","type":"llm","position":{"x":200,"y":200},"data":{"prompt":"Classify the user intent"}},{"id":"respond","type":"llm","position":{"x":400,"y":200},"data":{"prompt":"Generate a helpful response"}},{"id":"end","type":"end","position":{"x":600,"y":200}}]';
  const wfEdges2 = '[{"id":"e1","source":"start","target":"classify"},{"id":"e2","source":"classify","target":"respond"},{"id":"e3","source":"respond","target":"end"}]';

  await query(
    "INSERT INTO workflows (id, custom_id, name, description, category, tags, nodes, edges, is_template, is_public, created_at, updated_at) VALUES " +
    `('wf-exec-1', 'data-pipeline', 'Data Processing Pipeline', 'ETL workflow with validation', 'data', '["etl","data","pipeline"]', '${esc(wfNodes1)}', '${esc(wfEdges1)}', TRUE, TRUE, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day'), ` +
    `('wf-exec-2', 'chatbot-flow', 'Customer Support Chatbot', 'Multi-step chatbot with escalation', 'ai', '["chatbot","support","ai"]', '${esc(wfNodes2)}', '${esc(wfEdges2)}', FALSE, FALSE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '12 hours') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Workflows (execution) inserted');

  // ── MCP Servers ─────────────────────────────────────────────────
  const mcpTools1 = '[{"name":"read_file","description":"Read a file"},{"name":"write_file","description":"Write a file"},{"name":"list_dir","description":"List directory"}]';
  const mcpTools2 = '[{"name":"search_repos","description":"Search repositories"},{"name":"get_file","description":"Get file contents"}]';

  await query(
    "INSERT INTO mcp_servers (id, name, url, description, category, auth_type, tools, connection_status, enabled, is_official, created_at, updated_at) VALUES " +
    `('mcp-1', 'Local Filesystem', 'stdio://filesystem', 'Access local file system', 'filesystem', 'none', '${esc(mcpTools1)}', 'connected', TRUE, TRUE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'), ` +
    `('mcp-2', 'GitHub API', 'https://api.github.com/mcp', 'GitHub repository access', 'devtools', 'bearer', '${esc(mcpTools2)}', 'untested', FALSE, FALSE, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] MCP servers inserted');

  // ── User LLM Keys ──────────────────────────────────────────────
  await query(
    "INSERT INTO user_llm_keys (id, provider, encrypted_key, key_prefix, is_active, created_at, updated_at) VALUES " +
    "('ulk-1', 'openai', 'b3BlbmFpLWV4YW1wbGUta2V5', 'sk-...abc', TRUE, NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days'), " +
    "('ulk-2', 'deepseek', 'ZGVlcHNlay1leGFtcGxlLWtleQ', 'sk-...def', TRUE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days') " +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] User LLM keys inserted');

  // ── Library Agent Sessions ──────────────────────────────────────
  const lasMessages = '[{"role":"user","content":"Make this button component more accessible"},{"role":"assistant","content":"Here are the accessibility improvements I suggest: 1. Add aria-label support..."}]';

  await query(
    "INSERT INTO library_agent_sessions (id, component_id, title, messages_json, created_at, updated_at) VALUES " +
    `('las-1', 'comp-button', 'Improve button accessibility', '${esc(lasMessages)}', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Library agent sessions inserted');

  // ── Skema Agent Sessions ────────────────────────────────────────
  const sasMessages = '[{"role":"user","content":"Make the hero section more visually striking with a gradient background"},{"role":"assistant","content":"I\'ve updated the hero section with a gradient background..."}]';

  await query(
    "INSERT INTO skema_agent_sessions (id, project_id, board_idx, title, messages_json, created_at, updated_at) VALUES " +
    `('sas-1', 'skema-demo-1', 0, 'Refine hero section', '${esc(sasMessages)}', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days') ` +
    "ON CONFLICT (id) DO NOTHING;"
  );
  console.log('[seed] Skema agent sessions inserted');

  await pool.end();
  console.log('[seed] All dummy data seeded successfully!');
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
