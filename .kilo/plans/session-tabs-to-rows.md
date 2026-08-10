# Plan: Remove session cap, add scrollable container, ensure default session

## Goal
1. Remove the 3-session cap — allow unlimited sessions with a scrollable container.
2. Ensure a default session exists when a project/component is first opened (already handled by auto-create in hooks — no change needed).

## Current behavior
- `SessionTabs` slices to `sessions.slice(0, 3)` and only shows the "New session" button when `sessions.length < 3`.
- `handleNewSession` in both hooks bails out when `sessions.length >= 3`.
- Both hooks already auto-create 1 session when `loadedSessions.length === 0` (lines 52–61 in both hooks) — this is the "default 1 session" behavior and needs no change.

## Changes

### 1. `components/skema/SkemaAgentSidebar.tsx` — `SessionTabs` (lines 238–276)
- Remove `sessions.slice(0, 3)` → use `sessions.map(...)`.
- Remove the `sessions.length < 3` guard on the "New session" button — always show it.
- Wrap the `flex flex-col gap-0.5` container with `overflow-y-auto max-h-32` (or similar) to make sessions scrollable when many exist.

### 2. `components/library/AgentSidebar.tsx` — `SessionTabs` (lines 273–311)
- Same changes as above (identical function).

### 3. `components/skema/agent/useSkemaAgentSessions.ts` — `handleNewSession` (line 98)
- Remove `sessions.length >= 3` guard: change `if (!project?.id || sessions.length >= 3) return;` → `if (!project?.id) return;`.

### 4. `components/library/agent/useAgentSessions.ts` — `handleNewSession` (line 97)
- Remove `sessions.length >= 3` guard: change `if (!selectedComponent || sessions.length >= 3) return;` → `if (!selectedComponent) return;`.

## Files to edit
1. `components/skema/SkemaAgentSidebar.tsx` — `SessionTabs` function
2. `components/library/AgentSidebar.tsx` — `SessionTabs` function
3. `components/skema/agent/useSkemaAgentSessions.ts` — `handleNewSession`
4. `components/library/agent/useAgentSessions.ts` — `handleNewSession`

## Verification
`npm run build`
