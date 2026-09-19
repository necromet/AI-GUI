# Agent Builder: Gap Analysis & Implementation Plan

> `/agent-builder` (main app) vs `open-agent-builder` feature parity

---

## Status: ALL PHASES COMPLETE

All 14 gaps have been implemented across 3 phases. The `/agent-builder` route now has full feature parity with `open-agent-builder`.

| Phase | Items | Status |
|-------|-------|--------|
| Phase 1 | G1 Guardrails, G2 Approval handles, G3 Parallel routing, G11 Edge cleanup | Done |
| Phase 2 | G4 Edge labels, G7 Save as template, G12 HTTP auth, G13 Set-state types, G14 Extract model | Done |
| Phase 3 | G5 Publish, G6 Share, G8 Paste config, G9 Mermaid, G10 Credential detection | Done |

---

## Summary

The main app's `/agent-builder` already covers **~80%** of open-agent-builder's core workflow features. The gaps are concentrated in:

1. **Guardrails node** (no config panel in frontend) — DONE
2. **User-approval dual handles** (approve/reject output paths) — DONE
3. **Parallel execution routing** (auto fan-out) — DONE
4. **Edge label editing** (modal) — DONE
5. **Publish/Share/Save-as-Template** (modals + endpoints) — DONE
6. **Paste config import** (modal) — DONE
7. **Mermaid diagram export** — DONE
8. **Credential duplicate detection + edge cleanup** — DONE
9. **Richer node configs** (HTTP auth types, set-state value types, extract model selection) — DONE

---

## What Already Exists (no changes needed)

| Feature | Main App | File(s) |
|---------|----------|---------|
| 12 node types (start, end, agent, mcp, if-else, while, user-approval, transform, set-state, extract, http, note) | Yes | `types.ts`, `constants.ts` |
| React Flow canvas + drag-and-drop | Yes | `WorkflowCanvas.tsx` |
| Custom node renderer with status badges | Yes | `CustomNode.tsx` |
| Node palette sidebar (categorized, searchable) | Yes | `Sidebar.tsx`, `WorkflowSidebar.tsx` |
| Right-side settings panel (resizable) | Yes | `NodeSettingsPanel.tsx` |
| 12 node config panels | Yes | `nodes/*.tsx` |
| Execution panel (SSE streaming, per-node status) | Yes | `ExecutionPanel.tsx` |
| Command palette (Ctrl+K) | Yes | `CommandPalette.tsx` |
| Canvas + node context menus | Yes | `CanvasContextMenu.tsx`, `NodeContextMenu.tsx` |
| Template gallery (6 built-in templates) | Yes | `TemplateGallery.tsx` |
| Onboarding overlay | Yes | `OnboardingOverlay.tsx` |
| Undo/redo (50 snapshots) | Yes | `hooks/useUndoRedo.ts` |
| Auto-save (5s debounce) | Yes | `hooks/useAutoSave.ts` |
| Workflow validation | Yes | `validateWorkflow.ts` |
| Minimap | Yes | `WorkflowCanvas.tsx` |
| Variable system (`{{var}}`) with autocomplete | Yes | `VariableAutocomplete.tsx`, `VariablePicker.tsx` |
| Edge insertion button | Yes | `EdgeAddButton.tsx` |
| Keyboard shortcuts overlay | Yes | `ShortcutOverlay.tsx` |
| Export JSON / Export code / Import LangGraph | Yes | `WorkflowToolbar.tsx` + backend routes |
| LangGraph execution engine | Yes | `server/services/workflowExecutor.ts` |
| Standalone BFS engine | Yes | `server/services/workflowEngine.ts` |
| Approval pause/resume | Yes | `hooks/useApprovalWatch.ts`, `ExecutionPanel.tsx` |
| Multi-provider LLM (7 providers) | Yes | `server/services/workflowExecutors/agent.ts` |
| MCP / Firecrawl integration | Yes | `server/services/workflowExecutors/mcp.ts` |
| Variable substitution engine | Yes | `server/services/workflowExecutors/variables.ts` |

---

## Gaps to Close

### G1: Guardrails Node Config Panel (Priority: HIGH)

**Open Agent Builder**: Full `ToolsNodePanel.tsx` (38KB) with PII detection, content moderation, jailbreak detection, hallucination checks, and violation action (block/warn/log).

**Main App**: Guardrails executor exists (`server/services/workflowExecutors/tools.ts`) but **no frontend config panel**. The node type isn't in `constants.ts` or `types.ts`.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/types.ts` | Add `'guardrails'` to `WorkflowNodeType` union |
| `components/agent-builder/constants.ts` | Add guardrails node definition to `NODE_TYPES` and `NODE_CATEGORIES` (under "AI & Tools") |
| `components/agent-builder/shared/colors.ts` | Add `guardrails` to `NODE_COLORS` |
| `components/agent-builder/shared/icons.ts` | Add `shield` icon to `ICON_MAP` |
| `components/agent-builder/nodes/GuardrailsNodeConfig.tsx` | **New file** — Checkboxes for PII/moderation/jailbreak, violation action select (block/warn/log) |
| `components/agent-builder/nodes/index.ts` | Export `GuardrailsNodeConfig` |
| `components/agent-builder/NodeSettingsPanel.tsx` | Add `'guardrails'` case to config panel switch |
| `components/agent-builder/CustomNode.tsx` | Ensure `guardrails` renders correctly (should work via color/icon maps) |
| `components/Sidebar.tsx` | Add guardrails to node palette category |
| `server/services/workflowExecutor.ts` | Add `'guardrails'` case in `createNodeExecutor` switch (already has import for `executeGuardrailsNode`) |

---

### G2: User-Approval Dual Output Handles (Priority: HIGH)

**Open Agent Builder**: User-approval nodes have two output handles — `approve` (green) and `reject` (red) — allowing different paths based on human decision.

**Main App**: Single output handle only. Approval just pauses/resumes the same path.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/CustomNode.tsx` | Add two source handles for `user-approval`: `approve` (green, 30%) and `reject` (red, 70%) |
| `components/agent-builder/nodes/ApprovalNodeConfig.tsx` | Add fields for approve message and reject message |
| `components/agent-builder/ExecutionPanel.tsx` | Send `sourceHandle` with approval response (`approve` or `reject`) |
| `server/services/workflowExecutor.ts` | Add conditional edges for `user-approval` type (route based on `result.output.approved`) |
| `server/services/workflowExecutors/logic.ts` | Update `executeUserApprovalNode` to accept and pass through approval decision |
| `server/routes/workflowApprovals.ts` | Accept `decision: 'approve' | 'reject'` in resume payload |

---

### G3: Parallel Execution Routing (Priority: MEDIUM)

**Open Agent Builder**: Auto-detects when a non-branching node has multiple outgoing edges and uses LangGraph `Send` for parallel fan-out.

**Main App**: Multiple outgoing edges on non-branching nodes only route to the first target (line 167: `graph.addEdge(node.id, outEdges[0].target)`).

**Changes needed**:

| File | Change |
|------|--------|
| `server/services/workflowExecutor.ts` | Import `Send` from `@langchain/langgraph`. In `buildGraph()`, when `outEdges.length > 1` and node is not `if-else`/`while`, use parallel routing with `Send` or sequential chaining |

---

### G4: Edge Label Editing (Priority: MEDIUM)

**Open Agent Builder**: `EdgeLabelModal.tsx` — click an edge to edit its label (useful for conditional branches).

**Main App**: Edges support labels in the data model (`WorkflowEdge.label`) but no UI to edit them.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/EdgeLabelModal.tsx` | **New file** — Small modal/popover with text input for edge label |
| `components/agent-builder/WorkflowCanvas.tsx` | Add `onEdgeClick` handler that opens `EdgeLabelModal` |

---

### G5: Publish as API Endpoint (Priority: MEDIUM)

**Open Agent Builder**: `PublishModal.tsx` — generates API endpoint with API key, curl examples, SSE streaming URL.

**Main App**: No publish feature.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/PublishModal.tsx` | **New file** — Modal showing endpoint URL, API key, curl examples |
| `components/agent-builder/WorkflowToolbar.tsx` | Add "Publish" button |
| `server/routes/workflows.ts` | Add `POST /:id/publish` endpoint (generates API key, stores publish config) |
| `server/db/workflows.ts` | Add `published` column to `workflows` table, add `api_keys` table |

---

### G6: Share Workflow Modal (Priority: LOW)

**Open Agent Builder**: `ShareWorkflowModal.tsx` — generate shareable links.

**Main App**: No share feature (single-user app).

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/ShareWorkflowModal.tsx` | **New file** — Copy JSON to clipboard, export as file |
| `components/agent-builder/WorkflowToolbar.tsx` | Add "Share" button |

---

### G7: Save as Template (Priority: MEDIUM)

**Open Agent Builder**: `SaveAsTemplateModal.tsx` — name, description, category, tags, difficulty, estimated time.

**Main App**: Can create from templates but can't save custom workflows as templates.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/SaveAsTemplateModal.tsx` | **New file** — Form with name, description, category, difficulty, estimated time |
| `components/agent-builder/WorkflowToolbar.tsx` | Add "Save as Template" button |
| `server/routes/workflows.ts` | Add `POST /templates` endpoint (already exists, verify it works for user-created templates) |

---

### G8: Paste Config Import (Priority: LOW)

**Open Agent Builder**: `PasteConfigModal.tsx` — paste JSON to import node configuration.

**Main App**: No paste-config feature.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/PasteConfigModal.tsx` | **New file** — Textarea for JSON, validates and applies to selected node |
| `components/agent-builder/NodeSettingsPanel.tsx` | Add "Paste Config" button |

---

### G9: Mermaid Diagram Export (Priority: LOW)

**Open Agent Builder**: `getMermaidDiagram()` generates Mermaid flowchart from compiled graph.

**Main App**: No Mermaid export.

**Changes needed**:

| File | Change |
|------|--------|
| `server/services/workflowExecutor.ts` | Add `toMermaid()` method that converts nodes/edges to Mermaid syntax |
| `server/routes/workflows.ts` | Add `POST /:id/export-mermaid` endpoint |
| `components/agent-builder/WorkflowToolbar.tsx` | Add "Export Mermaid" button |

---

### G10: Credential Duplicate Detection (Priority: LOW)

**Open Agent Builder**: `detectDuplicateCredentials()` warns when same MCP credential is used in multiple nodes.

**Main App**: No duplicate detection.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/validateWorkflow.ts` | Add duplicate MCP credential check to validation |

---

### G11: Automatic Edge Cleanup (Priority: MEDIUM)

**Open Agent Builder**: `cleanupInvalidEdges()` removes edges whose source/target nodes no longer exist.

**Main App**: No automatic cleanup — stale edges can accumulate.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/WorkflowCanvas.tsx` | Add `cleanupInvalidEdges()` call on node deletion and on workflow load |

---

### G12: Richer HTTP Node Config (Priority: LOW)

**Open Agent Builder**: HTTP node supports auth types (bearer, api-key, basic) with token/key/username fields.

**Main App**: HTTP node has method/URL/headers/body but no auth type selector.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/nodes/HTTPNodeConfig.tsx` | Add auth type select (none/bearer/api-key/basic), conditional token/key/username/password fields |
| `server/services/workflowExecutors/http.ts` | Apply auth headers based on `data.authType` |

---

### G13: Richer Set-State Node Config (Priority: LOW)

**Open Agent Builder**: Set-state node supports value types (string, number, boolean, json, expression).

**Main App**: Set-state node is basic key-value pairs.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/nodes/SetStateNodeConfig.tsx` | Add value type selector per variable (string/number/boolean/json/expression) |
| `server/services/workflowExecutors/variables.ts` | Parse values based on type (JSON.parse for json, eval for expression, Number() for number, etc.) |

---

### G14: Extract Node Model Selection (Priority: LOW)

**Open Agent Builder**: Extract node lets user choose which model to use for extraction.

**Main App**: Extract node only has a schema textarea, no model selector.

**Changes needed**:

| File | Change |
|------|--------|
| `components/agent-builder/nodes/ExtractNodeConfig.tsx` | Add model selector (reuse `CHAT_MODELS` from `AgentNodeConfig`) |
| `server/services/workflowExecutors/extract.ts` | Accept `model` parameter, use selected model for extraction |

---

## Implementation Order

### Phase 1 — Core Gaps (fix broken/incomplete features)
1. **G2** — User-approval dual handles (enables branching on approval)
2. **G1** — Guardrails node config panel (node type exists in backend, missing frontend)
3. **G11** — Edge cleanup (prevents stale edge bugs)
4. **G3** — Parallel execution routing (fixes multi-edge routing)

### Phase 2 — UX Polish
5. **G4** — Edge label editing
6. **G7** — Save as template
7. **G12** — Richer HTTP config
8. **G13** — Richer set-state config
9. **G14** — Extract node model selection

### Phase 3 — Power Features
10. **G5** — Publish as API endpoint
11. **G9** — Mermaid diagram export
12. **G8** — Paste config import
13. **G6** — Share workflow modal
14. **G10** — Credential duplicate detection

---

## Estimated Effort

| Phase | Items | Est. Lines | Complexity |
|-------|-------|-----------|------------|
| Phase 1 | G1, G2, G3, G11 | ~400 new + ~150 modified | Medium |
| Phase 2 | G4, G7, G12, G13, G14 | ~350 new + ~100 modified | Low |
| Phase 3 | G5, G6, G8, G9, G10 | ~500 new + ~100 modified | Medium |
| **Total** | **14 items** | **~1,250 new + ~350 modified** | |

---

## Files Most Affected

| File | Changes from |
|------|-------------|
| `components/agent-builder/CustomNode.tsx` | G2 (approval handles) |
| `components/agent-builder/WorkflowCanvas.tsx` | G4 (edge click), G11 (edge cleanup) |
| `components/agent-builder/WorkflowToolbar.tsx` | G5, G6, G7, G9 (new buttons) |
| `components/agent-builder/NodeSettingsPanel.tsx` | G1 (guardrails case), G8 (paste button) |
| `components/agent-builder/nodes/` | G1, G12, G13, G14 (config panels) |
| `components/agent-builder/types.ts` | G1 (guardrails type) |
| `components/agent-builder/constants.ts` | G1 (guardrails definition) |
| `server/services/workflowExecutor.ts` | G1, G2, G3 (graph building) |
| `server/services/workflowExecutors/logic.ts` | G2 (approval decision) |
| `server/services/workflowExecutors/http.ts` | G12 (auth types) |
| `server/services/workflowExecutors/variables.ts` | G13 (value types) |
| `server/services/workflowExecutors/extract.ts` | G14 (model selection) |
| `server/routes/workflows.ts` | G5, G7, G9 (new endpoints) |
| `components/agent-builder/validateWorkflow.ts` | G10 (duplicate detection) |
