# Commit, Push to Master, Merge to Main

## Context

The Skema feature has been completely rewritten:
- **Interactive HTML editor** with click-to-edit (inspect element style)
- **File-based Skema agent** using Vercel AI SDK (matching Library agent pattern)
- Removed canvas/grid mode entirely

**Current state**: On `master`, 5 commits ahead of `origin/master`. 16 modified files + 3 new untracked source files. Temp build scripts (`_run_build.cjs`, `_run_build.mjs`, `build-check.mjs`) exist but should NOT be committed.

VPS deployment will be done separately later.

## Steps

### Step 1: Verify build compiles

```bash
npm run build
```

Fix any errors before proceeding.

### Step 2: Stage relevant files

Stage all 16 modified + 3 new source files. **Exclude** temp build scripts and `.kilo/`:

```
# Modified
App.tsx
components/Sidebar.tsx
components/SkemaEditor.tsx
components/SkemaPanel.tsx
components/canvas/CanvasEditor.tsx
components/canvas/CanvasSidebar.tsx
components/library/agent/types.ts
components/library/agent/useAgentStream.ts
components/skema/SkemaAgentSidebar.tsx
components/skema/agent/types.ts
components/skema/agent/useSkemaAgentSessions.ts
components/skema/agent/useSkemaAgentStream.ts
server/db/skemaProjects.ts
server/routes/skema.ts
server/routes/skemaAgent.ts
types.ts

# New
components/skema/ElementToolbar.tsx
components/skema/InteractivePreview.tsx
components/skema/inspectorScript.ts
```

### Step 3: Commit

```
git commit -m "feat: rewrite Skema as interactive HTML editor with Vercel AI SDK agent

- Replace grid/canvas editor with click-to-edit HTML preview (inspect element style)
- Add InteractivePreview with injected inspector script (hover, select, inline edit)
- Add ElementToolbar for style/text editing of selected elements
- Rewrite Skema agent server with Vercel AI SDK file-based tools
- Match Library agent pattern: multi-round SSE streaming, tool calling
- Remove canvas/grid mode from SkemaPanel and App.tsx
- Add ProjectFile type and files/activeFile fields to SkemaBoard"
```

### Step 4: Push to master

```bash
git push origin master
```

### Step 5: Merge master into main and push

```bash
git checkout main
git merge master
git push origin main
git checkout master
```
