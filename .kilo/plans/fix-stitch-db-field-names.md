# Plan: Fix Stitch Sidebar + DB Field Name Bugs

## Root Cause

The SQLite tables use `id` as the primary key column. The old IndexedDB used `model_id`, `conversation_id`, `message_id`. The new `apiDatabaseAdapter` returns the raw SQLite shape (`id`), but **all consuming code** still references the old field names.

This causes `undefined` values for every DB-backed ID, breaking conversation creation, message loading, model lookups, and the stitch sidebar.

## Bug Inventory

### Bug 1: `model_id` → `id` (model objects)

The API returns `{ id, name, ... }` but code reads `model_id`:

| File | Line | Code | Fix |
|------|------|------|-----|
| `App.tsx` | 275 | `m.model_id` | `m.id` |
| `App.tsx` | 356 | `dbModel!.model_id!` | `dbModel!.id!` |
| `components/StitchEditor.tsx` | 92 | `dbModel!.model_id!` | `dbModel!.id!` |
| `components/RAGChatPanel.tsx` | 89 | `dbModel!.model_id!` | `dbModel!.id!` |
| `components/AgentChatPanel.tsx` | 81 | `dbModel!.model_id!` | `dbModel!.id!` |

### Bug 2: `conversation_id` → `id` (conversation objects)

The API returns `{ id, title, ... }` but code reads `conversation_id`:

| File | Line | Code | Fix |
|------|------|------|-----|
| `App.tsx` | 253 | `conv.conversation_id!.toString()` | `conv.id!.toString()` |
| `App.tsx` | 257 | `conv.conversation_id` | `conv.id` |
| `components/StitchEditor.tsx` | 75 | `match.conversation_id` | `match.id` |
| `components/StitchEditor.tsx` | 76 | `match.conversation_id` | `match.id` |

### Bug 3: `message_id` → `id` (message objects)

The API returns `{ id, role, content, ... }` but code reads `message_id`:

| File | Line | Code | Fix |
|------|------|------|-----|
| `App.tsx` | 313 | `msg.message_id!.toString()` | `msg.id!.toString()` |
| `App.tsx` | 318 | `msg.message_id` | `msg.id` |
| `components/RAGChatPanel.tsx` | 67 | `msg.message_id!.toString()` | `msg.id!.toString()` |
| `components/RAGChatPanel.tsx` | 72 | `msg.message_id` | `msg.id` |
| `components/AgentChatPanel.tsx` | 64 | `msg.message_id!.toString()` | `msg.id!.toString()` |
| `components/AgentChatPanel.tsx` | 69 | `msg.message_id` | `msg.id` |

### Bug 4: Stitch conversation restore uses title matching (fragile)

`StitchEditor.tsx:74` matches conversations by `c.title === project.title`. This is unreliable if two projects share a title. Not a crash bug but causes wrong conversation to load. Not fixing in this pass — would need a `project_id` column on conversations.

## Implementation Plan

### Step 1: Fix `App.tsx`
- Line 253: `conv.conversation_id!` → `conv.id!`
- Line 257: `conv.conversation_id` → `conv.id`
- Line 258: `conv.model_id` → `conv.model_id` (keep — this is the FK in the conversations table, which IS `model_id`)
- Line 275: `m.model_id` → `m.id`
- Line 313: `msg.message_id!` → `msg.id!`
- Line 318: `msg.message_id` → `msg.id`
- Line 356: `dbModel!.model_id!` → `dbModel!.id!`

Wait — `conv.model_id` is correct because the conversations table has a `model_id` column. Only the primary key is `id`. Let me re-verify.

### Verified field mapping

| Table | PK | FK | Other |
|-------|----|----|-------|
| `models` | `id` | — | `name`, `description`, ... |
| `conversations` | `id` | `model_id` | `title`, `type`, `created_at`, `updated_at` |
| `messages` | `id` | `conversation_id` | `role`, `content`, `message_order`, `timestamp`, ... |

So:
- `conv.model_id` — **correct**, this is the FK column
- `conv.conversation_id` — **BUG**, should be `conv.id` (the PK)
- `m.model_id` — **BUG**, should be `m.id` (the PK)
- `msg.message_id` — **BUG**, should be `msg.id` (the PK)
- `msg.conversation_id` — **correct**, this is the FK column

### Step 2: Fix `components/StitchEditor.tsx`
- Line 75: `match.conversation_id` → `match.id`
- Line 76: `match.conversation_id` → `match.id`
- Line 92: `dbModel!.model_id!` → `dbModel!.id!`

### Step 3: Fix `components/RAGChatPanel.tsx`
- Line 67: `msg.message_id!` → `msg.id!`
- Line 72: `msg.message_id` → `msg.id`
- Line 89: `dbModel!.model_id!` → `dbModel!.id!`

### Step 4: Fix `components/AgentChatPanel.tsx`
- Line 64: `msg.message_id!` → `msg.id!`
- Line 69: `msg.message_id` → `msg.id`
- Line 81: `dbModel!.model_id!` → `dbModel!.id!`

## Files to Modify

1. `App.tsx` — 6 field name fixes
2. `components/StitchEditor.tsx` — 3 field name fixes
3. `components/RAGChatPanel.tsx` — 3 field name fixes
4. `components/AgentChatPanel.tsx` — 3 field name fixes

Total: 15 field name renames across 4 files.
