# Firecrawl — Complete API Documentation

> Search the web, scrape any page, and interact with it, all through one API.

**Source:** https://docs.firecrawl.dev/introduction
**Generated:** 2026-09-11

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [API Routes / Endpoints](#api-routes--endpoints)
   - [Scrape (`/v2/scrape`)](#scrape-v2scrape)
   - [Search (`/v2/search`)](#search-v2search)
   - [Crawl (`/v2/crawl`)](#crawl-v2crawl)
   - [Map (`/v2/map`)](#map-v2map)
   - [Parse (`/v2/parse`)](#parse-v2parse)
   - [Extract (`/v2/extract`)](#extract-v2extract)
   - [Agent (`/v2/agent`)](#agent-v2agent)
   - [Interact (`/v2/scrape/{scrapeId}/interact`)](#interact-v2scrapescrapeidinteract)
   - [Browser Sandbox (`/v2/interact`)](#browser-sandbox-v2interact)
   - [Batch Scrape (`/v2/batch/scrape`)](#batch-scrape-v2batchscrape)
   - [Webhooks](#webhooks)
4. [Agent Builder — Full Reference](#agent-builder--full-reference)
5. [SDKs](#sdks)
6. [Pricing & Billing](#pricing--billing)
7. [Rate Limits](#rate-limits)

---

## Overview

Firecrawl is a web data API for AI. It converts any URL into clean, LLM-ready data (markdown, HTML, structured JSON, screenshots). It handles proxies, anti-bot, JavaScript rendering, and dynamic content.

### Core Capabilities

| Capability | Endpoint | Description |
|-----------|----------|-------------|
| **Search** | `POST /v2/search` | Web search with full-page content from results |
| **Scrape** | `POST /v2/scrape` | Extract content from any URL as markdown, HTML, or JSON |
| **Crawl** | `POST /v2/crawl` | Recursively gather content from entire sites |
| **Map** | `POST /v2/map` | Discover all URLs on a website (extremely fast) |
| **Parse** | `POST /v2/parse` | Convert local PDFs, DOCX, XLSX, HTML into markdown or JSON |
| **Extract** | `POST /v2/extract` | Extract structured data from pages using LLMs |
| **Agent** | `POST /v2/agent` | Autonomous AI-powered web data gathering |
| **Interact** | `POST /v2/scrape/{id}/interact` | Click, fill forms, extract dynamic content after scraping |
| **Browser Sandbox** | `POST /v2/interact` | Standalone managed browser sessions |
| **Batch Scrape** | `POST /v2/batch/scrape` | Scrape multiple URLs in a single batch job |

### Key Features

- **LLM-ready output**: Clean markdown, structured JSON, screenshots, and more
- **Handles the hard stuff**: Proxies, anti-bot, JavaScript rendering, dynamic content
- **Reliable**: Built for production with high uptime
- **Fast**: Results in seconds, optimized for high throughput
- **MCP Server**: Connect to any AI tool via Model Context Protocol

### MCP Server (Keyless)

```
URL: https://mcp.firecrawl.dev/v2/mcp
```

- Codex: `codex mcp add firecrawl --url https://mcp.firecrawl.dev/v2/mcp`
- Claude Code: `claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp`
- Cursor / JSON-config: `{"mcpServers": {"firecrawl": {"url": "https://mcp.firecrawl.dev/v2/mcp"}}}`

---

## Getting Started

### No API Key Required (Limited)

```bash
curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://firecrawl.dev",
    "formats": ["markdown", "html"]
  }'
```

### With API Key (Higher Rate Limits)

```bash
curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -d '{
    "url": "https://firecrawl.dev",
    "formats": ["markdown", "html"]
  }'
```

### SDK Installation

**Python:**
```bash
pip install firecrawl-py
```

```python
from firecrawl import Firecrawl

firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
doc = firecrawl.scrape("https://firecrawl.dev", formats=["markdown", "html"])
print(doc)
```

**Node.js:**
```bash
npm install firecrawl
```

```javascript
import { Firecrawl } from 'firecrawl';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
const doc = await firecrawl.scrape('https://firecrawl.dev', { formats: ['markdown', 'html'] });
console.log(doc);
```

**CLI:**
```bash
npm install -g firecrawl
firecrawl login
firecrawl https://firecrawl.dev
```

---

## API Routes / Endpoints

### Scrape (`/v2/scrape`)

**Purpose:** Turn any URL into clean data — markdown, HTML, structured JSON, screenshots.

**Endpoint:** `POST https://api.firecrawl.dev/v2/scrape`

#### Supported Output Formats

| Format | Description |
|--------|-------------|
| `markdown` | Clean markdown content |
| `summary` | Page summary |
| `html` | Cleaned HTML |
| `rawHtml` | Unmodified HTML from the page |
| `rawBase64` | Base64-encoded original HTTP response body |
| `screenshot` | Screenshot URL (expires after 24h) |
| `links` | All links on the page |
| `json` | Structured output via LLM with schema |
| `images` | All image URLs |
| `branding` | Brand identity and design system |
| `product` | Structured product data (deterministic, no LLM) |
| `audio` | MP3 audio extraction (e.g., YouTube) |
| `video` | Best-quality video extraction (e.g., YouTube) |
| `query` | Ask a natural-language question about the page |
| `highlights` | Find relevant source text from the page |

#### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | The URL to scrape |
| `formats` | array | `["markdown"]` | Output formats |
| `onlyMainContent` | boolean | `true` | Extract only main content |
| `includeTags` | array | — | HTML tags to include |
| `excludeTags` | array | — | HTML tags to exclude |
| `headers` | object | — | Custom HTTP headers |
| `waitFor` | integer | — | Wait for element (ms) |
| `timeout` | integer | 30000 | Request timeout (ms) |
| `location` | object | `{ country: "US" }` | Geo-location settings |
| `actions` | array | — | Pre-scrape browser actions |
| `maxAge` | integer | 172800000 | Cache freshness window (ms, 2 days default) |
| `storeInCache` | boolean | `true` | Whether to cache results |
| `minAge` | integer | — | Cache-only lookup (ms) |
| `zeroDataRetention` | boolean | `false` | Enterprise ZDR mode (+1 credit/page) |
| `redactPII` | boolean | `false` | Redact PII from markdown |
| `profile` | object | — | Persistent browser profile |

#### JSON Mode (Structured Extraction)

```python
from pydantic import BaseModel

class CompanyInfo(BaseModel):
    company_mission: str
    supports_sso: bool
    is_open_source: bool

result = firecrawl.scrape(
    'https://firecrawl.dev',
    formats=[{"type": "json", "schema": CompanyInfo.model_json_schema()}]
)
```

#### Actions (Pre-Scrape Interactions)

```python
doc = firecrawl.scrape(
    url="https://example.com/login",
    formats=["markdown"],
    actions=[
        {"type": "write", "text": "john@example.com"},
        {"type": "press", "key": "Tab"},
        {"type": "click", "selector": 'button[type="submit"]'},
        {"type": "wait", "milliseconds": 1500},
        {"type": "screenshot", "full_page": True},
    ],
)
```

Action types: `write`, `press`, `click`, `wait`, `screenshot`, `scroll`.

#### Response

```json
{
  "success": true,
  "data": {
    "markdown": "...",
    "html": "...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "...",
      "language": "en",
      "sourceURL": "https://firecrawl.dev",
      "statusCode": 200,
      "scrapeId": "uuid-here"
    }
  }
}
```

#### Credit Costs

- Base scrape: **1 credit**
- JSON mode: +4 credits
- Question/Highlights: +4 credits each
- PII redaction: +4 credits
- PDF parsing: 1 credit per PDF page
- Audio/Video: +4 credits

---

### Search (`/v2/search`)

**Purpose:** Search the web and get full content from results in one call.

**Endpoint:** `POST https://api.firecrawl.dev/v2/search`

#### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |
| `limit` | integer | — | Max results per source type |
| `sources` | array | `["web"]` | Result types: `web`, `news`, `images` |
| `categories` | array | — | Filter: `research`, `pdf`, `developer` |
| `includeDomains` | array | — | Restrict to specific domains |
| `excludeDomains` | array | — | Exclude specific domains |
| `scrapeOptions` | object | — | Scrape each result (formats, etc.) |
| `location` | string | — | Geo-location for search |
| `tbs` | string | — | Time-based search filter |
| `timeout` | integer | — | Request timeout (ms) |
| `safe` | boolean | `false` | SafeSearch filter |
| `enterprise` | array | — | ZDR options: `["zdr"]` or `["anon"]` |

#### Time-Based Search (`tbs` values)

- `qdr:h` — Past hour
- `qdr:d` — Past 24 hours
- `qdr:w` — Past week
- `qdr:m` — Past month
- `qdr:y` — Past year
- `sbd:1` — Sort by date (newest first)
- `cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY` — Custom date range

#### Usage

```python
results = firecrawl.search(
    query="firecrawl",
    limit=3,
    scrape_options={"formats": ["markdown", "links"]}
)
```

#### Response

```json
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://www.firecrawl.dev/",
        "title": "Firecrawl - The Web Data API for AI",
        "description": "...",
        "position": 1
      }
    ],
    "images": [...],
    "news": [...]
  }
}
```

#### Credit Costs

- 2 credits per 10 results (rounded up)
- Additional scraping costs apply per result

---

### Crawl (`/v2/crawl`)

**Purpose:** Recursively crawl a website and get content from every page.

**Endpoint:** `POST https://api.firecrawl.dev/v2/crawl`

#### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Starting URL |
| `limit` | integer | 10000 | Max pages to crawl |
| `maxDiscoveryDepth` | integer | — | Max link-discovery hops from root |
| `includePaths` | string[] | — | URL pathname regex patterns to include |
| `excludePaths` | string[] | — | URL pathname regex patterns to exclude |
| `regexOnFullURL` | boolean | `false` | Match paths against full URL |
| `crawlEntireDomain` | boolean | `false` | Follow sibling/parent paths |
| `allowSubdomains` | boolean | `false` | Follow subdomain links |
| `allowExternalLinks` | boolean | `false` | Follow external links (one hop) |
| `sitemap` | string | `"include"` | `"include"`, `"skip"`, or `"only"` |
| `ignoreQueryParameters` | boolean | `false` | Avoid re-scraping same path |
| `ignoreRobotsTxt` | boolean | `false` | Ignore robots.txt (Enterprise) |
| `delay` | number | — | Delay between scrapes (seconds) |
| `maxConcurrency` | integer | — | Max concurrent scrapes |
| `scrapeOptions` | object | — | Options for each scraped page |
| `webhook` | object | — | Webhook config for real-time notifications |

#### SDK Methods

**Crawl and wait (synchronous):**
```python
docs = firecrawl.crawl(url="https://docs.firecrawl.dev", limit=10)
```

**Start and check later (asynchronous):**
```python
job = firecrawl.start_crawl(url="https://docs.firecrawl.dev", limit=10)
status = firecrawl.get_crawl_status(job.id)
```

**Real-time with WebSocket:**
```python
async for snapshot in firecrawl.watcher(started.id, kind="crawl", poll_interval=2):
    if snapshot.status == "completed":
        for doc in snapshot.data:
            print(doc.metadata.source_url)
```

#### Status Response

```json
{
  "status": "completed",
  "total": 36,
  "completed": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-00-00T00:00:00.000Z",
  "data": [...]
}
```

Status values: `scraping`, `completed`, `failed`, `cancelled`.

#### Failed Pages

Use `GET /v2/crawl/{id}/errors` to retrieve pages that failed:
- `errors` — Network errors, timeouts
- `robotsBlocked` — URLs blocked by robots.txt

#### Credit Costs

- 1 credit per page crawled
- JSON mode: +4 credits per page
- PDF: 1 credit per PDF page

---

### Map (`/v2/map`)

**Purpose:** Input a website and get all the URLs on it — extremely fast.

**Endpoint:** `POST https://api.firecrawl.dev/v2/map`

#### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Website URL |
| `limit` | integer | — | Max URLs to return |
| `search` | string | — | Filter URLs by relevance to query |
| `sitemap` | string | `"include"` | Sitemap handling |
| `location` | object | — | Geo-location settings |

#### Usage

```python
res = firecrawl.map(url="https://firecrawl.dev", limit=50, sitemap="include")
```

#### Response

```json
{
  "success": true,
  "links": [
    {
      "url": "https://docs.firecrawl.dev/features/scrape",
      "title": "Scrape | Firecrawl",
      "description": "Turn any url into clean data"
    }
  ]
}
```

#### Credit Costs

- 1 credit per call (regardless of URLs returned)

---

### Parse (`/v2/parse`)

**Purpose:** Turn documents (PDFs, Word, Excel, PowerPoint, etc.) into clean markdown or structured JSON.

**Endpoint:** `POST https://api.firecrawl.dev/v2/parse`

#### Supported Formats

`.html`, `.htm`, `.xhtml`, `.pdf`, `.docx`, `.doc`, `.docm`, `.odt`, `.ods`, `.odp`, `.rtf`, `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.pptx`, `.ppt`, `.pptm`, `.epub`, `.csv`

#### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | file | required | File upload (multipart/form-data) |
| `formats` | array | `["markdown"]` | Output formats |
| `parsers` | array | — | Parser-specific options |
| `onlyMainContent` | boolean | `true` | Only main content |
| `redactPII` | boolean | `false` | Redact PII |
| `timeout` | integer | 30000 | Timeout (ms), max 300000 |

#### PDF Parser Options

```json
{
  "parsers": [{
    "type": "pdf",
    "mode": "auto",
    "maxPages": 100,
    "pages": true,
    "blocks": true,
    "pageMarkers": true
  }]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `"auto"` | `"fast"`, `"auto"`, or `"ocr"` |
| `maxPages` | integer | — | Cap pages to parse |
| `pages` | boolean | `false` | Per-page markdown array |
| `blocks` | boolean | `false` | Layout blocks with bounding boxes |
| `pageMarkers` | boolean | `false` | `<!-- page N -->` markers in markdown |

#### Layout Blocks (PDF)

Each block includes:
- `id` — Stable identifier (`p1.b0`)
- `type` — `title`, `section_header`, `text`, `table`, `formula`, `figure`, `caption`, `page_number`, `page_header`, `page_footer`
- `bbox` — Normalized bounding box `[x0, y0, x1, y1]`
- `content` — Markdown fragment
- `markdownSpan` — Character offsets into document markdown
- `readingOrder` — Position in reading order
- `confidence` — Layout detection and OCR confidence scores

#### Usage

```python
doc = firecrawl.parse("./report.pdf")
print(doc.markdown)

# With PDF options
doc = firecrawl.parse(
    "./report.pdf",
    options={"parsers": [{"type": "pdf", "pages": True, "blocks": True}]},
)
```

#### Credit Costs

- 1 credit per page (PDF)
- `pages`, `blocks`, `pageMarkers` options: no additional cost
- Max file size: 50 MB

---

### Extract (`/v2/extract`)

**Purpose:** Extract structured data from pages using LLMs. Successor is `/agent`.

**Endpoint:** `POST https://api.firecrawl.dev/v2/extract`

#### Key Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | array | Yes | URLs to extract from (supports `/*` wildcards) |
| `prompt` | string | If no schema | Natural language description of data |
| `schema` | object | If no prompt | JSON schema for structured output |
| `enableWebSearch` | boolean | No | Follow links outside specified domain |
| `agent` | object | No | Use FIRE-1: `{"model": "FIRE-1"}` |

#### Usage

```python
result = firecrawl.extract(
    urls=["https://docs.firecrawl.dev"],
    prompt="Extract the page description",
    schema={"type": "object", "properties": {"description": {"type": "string"}}}
)
```

#### Status Polling

```python
job = firecrawl.start_extract(urls=[...], prompt="...")
status = firecrawl.get_extract_status(job.id)
```

Status values: `completed`, `processing`, `failed`, `cancelled`.

#### Credit Costs

- Credits based on token usage (1 credit = 15 tokens)

---

### Agent (`/v2/agent`)

**Purpose:** Autonomous AI-powered web data gathering. Searches, navigates, and gathers data from the widest range of websites.

**Endpoint:** `POST https://api.firecrawl.dev/v2/agent`

> **This is the Agent Builder endpoint.** See the [full Agent Builder reference](#agent-builder--full-reference) below for comprehensive documentation.

#### Quick Example

```python
result = firecrawl.agent(
    prompt="Find the founders of Firecrawl",
    schema=FoundersSchema,
    model="spark-2",
    max_credits=100
)
```

---

### Interact (`/v2/scrape/{scrapeId}/interact`)

**Purpose:** Continue working with a scraped page — click buttons, fill forms, extract dynamic content.

**Endpoints:**
- `POST /v2/scrape/{scrapeId}/interact` — Execute interaction
- `DELETE /v2/scrape/{scrapeId}/interact` — Stop session

#### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | — | Natural language task (max 10,000 chars) |
| `code` | string | — | Code to execute (max 100,000 chars) |
| `language` | string | `"node"` | `"node"`, `"python"`, or `"bash"` |
| `timeout` | number | 30 | Timeout in seconds (1–300) |

#### Workflow

1. **Scrape** a URL → get `scrapeId` from `data.metadata.scrapeId`
2. **Interact** by calling interact with `prompt` or `code`
3. **Stop** the session when done

```python
# 1. Scrape
result = firecrawl.scrape("https://www.amazon.com", formats=["markdown"])
scrape_id = result.metadata.scrape_id

# 2. Interact
firecrawl.interact(scrape_id, prompt="Search for iPhone 16 Pro Max")
response = firecrawl.interact(scrape_id, prompt="Click the first result and tell me the price")
print(response.output)

# 3. Stop
firecrawl.stop_interaction(scrape_id)
```

#### Code Execution

**Node.js (Playwright):**
```javascript
{
  code: `
    await page.click('#next-page');
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    JSON.stringify({ title });
  `,
  language: "node"
}
```

**Python:**
```python
{
  code: """
import json
await page.click('#load-more')
await page.wait_for_load_state('networkidle')
items = await page.query_selector_all('.item')
data = [await i.text_content() for i in items]
print(json.dumps(data))
""",
  language: "python"
}
```

**Bash (agent-browser):**
```bash
agent-browser snapshot -i
agent-browser fill @e1 "firecrawl"
agent-browser click @e2
```

#### agent-browser Commands

| Command | Description |
|---------|-------------|
| `snapshot` | Full accessibility tree with element refs |
| `snapshot -i` | Interactive elements only |
| `click @e1` | Click element by ref |
| `fill @e1 "text"` | Clear field and type text |
| `type @e1 "text"` | Type without clearing |
| `press Enter` | Press keyboard key |
| `scroll down 500` | Scroll by pixels |
| `get text @e1` | Get text content |
| `screenshot` | Take screenshot |
| `eval "js code"` | Run JavaScript |

#### Persistent Profiles

Save browser state (cookies, localStorage) across sessions:

```python
# Session 1: Log in and save profile
result = firecrawl.scrape(
    "https://app.example.com/login",
    formats=["markdown"],
    profile={"name": "my-app", "save_changes": True},
)
scrape_id = result.metadata.scrape_id
firecrawl.interact(scrape_id, prompt="Fill in credentials and click Login")
firecrawl.stop_interaction(scrape_id)

# Session 2: Reuse profile (already logged in)
result = firecrawl.scrape(
    "https://app.example.com/dashboard",
    formats=["markdown"],
    profile={"name": "my-app", "save_changes": False},
)
```

#### Response

```json
{
  "success": true,
  "cdpUrl": "wss://browser.firecrawl.dev/...",
  "liveViewUrl": "https://liveview.firecrawl.dev/...",
  "interactiveLiveViewUrl": "https://liveview.firecrawl.dev/...",
  "output": "The iPhone 16 Pro Max (256GB) is priced at $1,199.00.",
  "exitCode": 0,
  "killed": false
}
```

#### Pricing

- Code-only (no prompt): **2 credits per browser minute**
- With AI prompts: **7 credits per browser minute**
- Minimum charge: 1 browser minute

---

### Browser Sandbox (`/v2/interact`)

**Purpose:** Standalone managed browser sessions for interactive workflows.

**Endpoints:**
- `POST /v2/interact` — Create session
- `POST /v2/interact/{sessionId}/execute` — Execute code
- `GET /v2/interact` — List sessions
- `DELETE /v2/interact/{sessionId}` — Close session

#### Quick Start

```javascript
// 1. Launch
const session = await firecrawl.browser({ ttl: 120, activityTtl: 60 });

// 2. Execute
const result = await firecrawl.browserExecute(session.id, {
  code: 'await page.goto("https://example.com"); await page.title();',
  language: "node",
});

// 3. Close
await firecrawl.deleteBrowser(session.id);
```

#### Session Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ttl` | 600s (10 min) | Max session lifetime (30–3600s) |
| `activityTtl` | 300s (5 min) | Auto-close after inactivity (10–3600s) |
| `profile` | — | Persistent profile object |

#### CDP Access

Every session exposes a CDP WebSocket URL for direct Playwright/Puppeteer connection:

```javascript
const browser = await chromium.connectOverCDP(session.cdpUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];
```

---

### Batch Scrape (`/v2/batch/scrape`)

**Purpose:** Scrape multiple URLs simultaneously.

**Endpoint:** `POST https://api.firecrawl.dev/v2/batch/scrape`

#### Usage

```python
job = firecrawl.batch_scrape(
    ["https://firecrawl.dev", "https://docs.firecrawl.dev"],
    formats=["markdown"],
    poll_interval=2,
    wait_timeout=120
)
```

#### Status Polling

```bash
# Submit
curl -s -X POST "https://api.firecrawl.dev/v2/batch/scrape" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://firecrawl.dev", "https://docs.firecrawl.dev"]}'

# Check status
curl -s -X GET "https://api.firecrawl.dev/v2/batch/scrape/{jobId}" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY"
```

---

### Webhooks

**Purpose:** Async event delivery for crawl, batch scrape, and agent operations.

#### Event Types

| Event | Description |
|-------|-------------|
| `crawl.started` | Crawl begins |
| `crawl.page` | Each page successfully scraped |
| `crawl.completed` | Crawl finishes |
| `crawl.failed` | Crawl encounters an error |
| `agent.started` | Agent run begins |
| `agent.action` | Agent performs an action |
| `agent.completed` | Agent run finishes |
| `agent.failed` | Agent run fails |
| `agent.cancelled` | Agent run cancelled |

#### Webhook Configuration

```json
{
  "webhook": {
    "url": "https://your-domain.com/webhook",
    "metadata": { "any_key": "any_value" },
    "events": ["started", "page", "completed"]
  }
}
```

#### Signature Verification

Every webhook includes `X-Firecrawl-Signature` header with HMAC-SHA256 signature. Verify using your webhook secret from account settings.

---

## Agent Builder — Full Reference

The `/v2/agent` endpoint is Firecrawl's autonomous AI-powered data gathering system. It searches, navigates, and gathers data from anywhere on the web without requiring you to know the URLs in advance.

### When to Use Agent

| Need | Use Agent? | Alternative |
|------|-----------|-------------|
| Don't know the URLs | **Yes** | — |
| Need autonomous navigation | **Yes** | — |
| Single known URL | No | `/scrape` with JSON mode |
| Multiple known URLs | No | `/extract` or batch scrape |
| Web search + scrape | No | `/search` |

### Core Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | **Yes** | Natural language description of data to find (max 10,000 chars) |
| `model` | string | No | Defaults to `spark-2` (Spark 1 deprecated) |
| `effort` | string | No | Reasoning budget: `low`, `medium`, `high` |
| `urls` | array | No | Optional URLs to focus on |
| `schema` | object | No | JSON schema for structured output |
| `strictConstrainToURLs` | boolean | No | Only visit provided URLs |
| `webhook` | object | No | Webhook for lifecycle events |
| `maxCredits` | number | No | Max credits to spend (default: 2,500) |

### Model: Spark 2

Every run executes on `spark-2` — the only model available:

- **Lowest cost** per run
- **Fastest** run time
- **Comparable accuracy** to former Spark 1 flagship
- **Reasoning budget**: pass `effort` (`low`, `medium`, `high`) to control thinking depth

### Basic Usage

```python
from firecrawl import Firecrawl
from pydantic import BaseModel, Field
from typing import List, Optional

app = Firecrawl(api_key="fc-YOUR_API_KEY")

class Founder(BaseModel):
    name: str = Field(description="Full name of the founder")
    role: Optional[str] = Field(None, description="Role or position")
    background: Optional[str] = Field(None, description="Professional background")

class FoundersSchema(BaseModel):
    founders: List[Founder] = Field(description="List of founders")

result = app.agent(
    prompt="Find the founders of Firecrawl",
    schema=FoundersSchema,
    model="spark-2",
    max_credits=100
)

print(result.data)
```

**Node.js:**
```javascript
import { Firecrawl } from 'firecrawl';
import { z } from 'zod';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

const result = await firecrawl.agent({
  prompt: "Find the founders of Firecrawl",
  schema: z.object({
    founders: z.array(z.object({
      name: z.string().describe("Full name of the founder"),
      role: z.string().describe("Role or position").optional(),
      background: z.string().describe("Professional background").optional()
    })).describe("List of founders")
  }),
  model: "spark-2",
  maxCredits: 100
});

console.log(result.data);
```

**cURL:**
```bash
curl -X POST "https://api.firecrawl.dev/v2/agent" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find the founders of Firecrawl",
    "model": "spark-2",
    "maxCredits": 100,
    "schema": {
      "type": "object",
      "properties": {
        "founders": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "role": { "type": "string" },
              "background": { "type": "string" }
            },
            "required": ["name"]
          }
        }
      },
      "required": ["founders"]
    }
  }'
```

### Response

```json
{
  "success": true,
  "status": "completed",
  "data": {
    "founders": [
      { "name": "Eric Ciarla", "role": "Co-founder", "background": "Previously at Mendable" },
      { "name": "Nicolas Camara", "role": "Co-founder", "background": "Previously at Mendable" },
      { "name": "Caleb Peffer", "role": "Co-founder", "background": "Previously at Mendable" }
    ]
  },
  "expiresAt": "2024-12-15T00:00:00.000Z",
  "creditsUsed": 15
}
```

### Asynchronous Usage

**Start then poll:**
```python
agent_job = app.start_agent(prompt="Find the founders of Firecrawl")
status = app.get_agent_status(agent_job.id)
```

**Status values:** `processing`, `completed`, `failed` (cancelled jobs report `failed`).

### Listing Agent Runs

```python
page = app.list_agents()
for run in page.agents:
    print(run.id, run.status, run.target_hint)

# Next page
if page.next:
    before = int(page.next.split("before=")[-1])
    older = app.list_agents(before=before)
```

### Execution Traces

Every run records a canonical execution trace — ordered events covering tool calls, reasoning summaries, progress updates, browser sessions, and output artifact changes.

```python
trace = app.get_agent_trace("JOB_ID")
for event in trace.events or []:
    print(event.type)

# With live view (while in flight)
live = app.get_agent_trace("JOB_ID", live_view=True)
for session in live.active_browser_sessions or []:
    print(session.live_view_url)
```

### Snapshots

Fetch the full content of a snapshot referenced by `artifact.updated` trace events:

```python
snapshot = app.get_agent_snapshot("JOB_ID", "SNAPSHOT_ID")
print(snapshot.snapshot)
```

### Artifacts

Every `artifact.updated` event describes a change to one artifact:
- `artifact.kind` — `json`, `markdown`, `html`, `screenshot`, or `text`
- `artifact.path` — Where the run put it
- `artifact.snapshotId` — Handle to fetch content

```python
trace = app.get_agent_trace("JOB_ID")
for event in trace.events or []:
    if event.type != "artifact.updated":
        continue
    kind = event.artifact.kind
    if kind not in ("markdown", "html", "json"):
        continue
    snapshot = app.get_agent_snapshot("JOB_ID", event.artifact.snapshot_id)
    content = json.loads(snapshot.snapshot) if kind == "json" else snapshot.snapshot
    print(kind, event.artifact.path, content)
```

### CSV Upload (Playground)

The Agent Playground supports CSV upload for batch processing:
1. Upload CSV with one or more columns of input data
2. Add output columns using the "+" button
3. Each column has its own prompt
4. Hit Run — agent processes rows in parallel

### Agent vs Extract

| Feature | Agent (New) | Extract |
|---------|-------------|---------|
| URLs Required | No | Yes |
| Speed | Faster | Standard |
| Cost | Lower | Standard |
| Reliability | Higher | Standard |
| Query Flexibility | High | Moderate |

### Example Use Cases

- **Research**: "Find the top 5 AI startups and their funding amounts"
- **Competitive Analysis**: "Compare pricing plans between Slack and Microsoft Teams"
- **Data Gathering**: "Extract contact information from company websites"
- **Content Summarization**: "Summarize the latest blog posts about web scraping"

### Agent Pricing

- **Dynamic billing** — scales with complexity
- **5 free daily runs** for all users
- Simple extractions: fewer credits
- Complex research: more credits
- Most runs: a few hundred credits
- `maxCredits` parameter to limit spending (default: 2,500)

**Cost optimization tips:**
- Start with free runs to understand pricing
- Set `maxCredits` parameter
- Optimize prompts (more specific = fewer credits)
- Break large tasks into smaller runs (150–200 rows per run)

### Cancellation

```python
# Cancel a running agent job
app.cancel_agent("JOB_ID")
```

Cancellation is cooperative — the current step finishes before stopping. Credits may accrue during that window. Cancelled jobs report `status: "failed"`.

---

## SDKs

### Official SDKs

| Language | Package |
|----------|---------|
| Python | `pip install firecrawl-py` |
| Node.js | `npm install firecrawl` |
| Go | `github.com/firecrawl/firecrawl-go` |
| Java | `io.firecrawl:firecrawl-java` |
| Ruby | `firecrawl` gem |
| Rust | `firecrawl` crate |
| .NET | `Firecrawl` NuGet package |
| PHP | `firecrawl/firecrawl-php` |
| Elixir | `firecrawl` Hex package |

### CLI

```bash
npm install -g firecrawl
firecrawl login

# Scrape
firecrawl https://firecrawl.dev

# Search
firecrawl search "firecrawl" --limit 5 --pretty

# Crawl
firecrawl crawl https://firecrawl.dev --wait --progress --limit 100

# Map
firecrawl map https://firecrawl.dev --limit 100

# Browser
firecrawl browser "open https://example.com"
firecrawl browser "snapshot"
firecrawl browser close

# Interact (after scrape)
firecrawl interact "Search for iPhone 16"
firecrawl interact stop
```

---

## Pricing & Billing

### Credit Costs Per Endpoint

| Endpoint | Base Cost | Additional Costs |
|----------|-----------|-----------------|
| Scrape | 1 credit/page | JSON +4, Question +4, Highlights +4, PII +4 |
| Crawl | 1 credit/page | Same as scrape per page |
| Map | 1 credit/call | — |
| Search | 2 credits/10 results | Scrape costs if enabled |
| Parse | 1 credit/PDF page | `pages`, `blocks`, `pageMarkers` free |
| Agent | Dynamic | ~few hundred credits per run |
| Interact | 2 or 7 credits/min | 2 (code only) or 7 (with prompts) |
| Browser | 2 or 7 credits/min | Same as Interact |
| Extract | Token-based | 1 credit = 15 tokens |

### Plans

- **Free**: Limited credits, 5 free agent runs/day
- **Standard**: Higher limits, API access
- **Enterprise**: Custom limits, ZDR, SIEM, IP restrictions

---

## Rate Limits

Rate limits vary by plan. Key points:
- Concurrent browser sessions: up to 20 across all plans
- Crawl concurrency: defaults to team limit set by plan
- `maxConcurrency` parameter can cap concurrent scrapes

---

## Additional Features

### Zero Data Retention (ZDR)

Available on Enterprise plans. Set `zeroDataRetention: true` on scrape requests (+1 credit/page). Screenshots are not available in ZDR mode.

### Change Tracking

Detect and monitor changes in web content between scrapes. Bypasses cache.

### Enhanced Mode

Better success rates on complex websites using enhanced proxies.

### FIRE-1 Agent

AI agent that enhances extraction with intelligent navigation:

```json
{
  "urls": ["https://example.com"],
  "prompt": "Extract all comments",
  "agent": { "model": "FIRE-1" }
}
```

### Location & Language

```json
{
  "location": {
    "country": "US",
    "languages": ["en"]
  }
}
```

ISO 3166-1 alpha-2 country codes. Firecrawl uses appropriate proxies and emulates language/timezone settings.

---

## Resources

- **API Reference**: https://docs.firecrawl.dev/api-reference/v2-introduction
- **Playground**: https://www.firecrawl.dev/playground
- **Dashboard**: https://www.firecrawl.dev/app
- **Open Source**: https://github.com/mendableai/firecrawl
- **Discord**: https://discord.gg/firecrawl
- **Support**: help@firecrawl.com
