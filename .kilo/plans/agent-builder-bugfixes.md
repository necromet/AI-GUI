# Agent Builder — Bug Fixes

## Bugs Found

### BUG-1: Tool creation fails with empty description (the reported error)
**File**: `server/routes/agentBuilder.ts:55`
**Cause**: Backend validates `!name || !description` but frontend sends `description: ''` from sidebar quick-create.
**Fix**: Change validation to only require `name`. Allow empty description.

### BUG-2: Agents list doesn't include tools count
**File**: `server/routes/agentBuilder.ts:102-111`
**Cause**: `GET /agents` returns agents without tools. Sidebar badge shows `agent.tools?.length` which is always `undefined`.
**Fix**: LEFT JOIN with agent_builder_agent_tools to include tool count, or leave as-is and rely on the per-agent fetch. The simpler fix: return tool IDs in the list endpoint.

### BUG-3: Edge dagre layout breaks when agent references a tool not in the current tools array
**File**: `components/agent-builder/AgentBuilderCanvas.tsx:75-90`
**Cause**: `autoLayout` iterates `agent.tools` and creates dagre edges to `tool-{id}`, but if a tool was deleted or isn't loaded yet, dagre will reference a nonexistent node, causing a layout error.
**Fix**: Guard edges — only add if the tool node exists in the graph.

### BUG-4: Tool panel shows same condition as agent panel (both check `detailNode`)
**File**: `components/agent-builder/AgentBuilderPanel.tsx:134,147`
**Cause**: Both conditions check `detailNode && detailAgent` and `detailNode && detailTool`. Since `detailAgent` is null when type is 'tool' and `detailTool` is null when type is 'agent', the logic works by accident, but if a detail is open and you click a different node type, the old panel stays until close animation finishes. This is a minor race.
**Fix**: Not critical, but the condition is fine as-is since they're mutually exclusive.

### BUG-5: `useAgentChat` stale closure over `messages`
**File**: `components/agent-builder/hooks/useAgentChat.ts:111`
**Cause**: `sendMessage` depends on `[messages, isStreaming]`, but `messages` inside the callback captures the value at call time. The `setMessages(prev => ...)` pattern is used for updates, but the `history` construction at line 27 uses the captured `messages` directly. If user sends messages rapidly, history could be stale.
**Fix**: Use a ref for messages or reconstruct from prev state.

### BUG-6: Abort removes the wrong message on client disconnect
**File**: `components/agent-builder/hooks/useAgentChat.ts:99`
**Cause**: On AbortError, it does `setMessages(prev => prev.slice(0, -1))` which removes the last message. But the last message is the empty assistant placeholder. If the user message was the last, it would remove the user message instead.
**Fix**: Remove the second-to-last or the assistant message specifically.

### BUG-7: Canvas node click selects agent even when clicking a tool node
**File**: `components/agent-builder/AgentBuilderPanel.tsx:126`
**Cause**: `onNodeClick={(id, type) => setSelectedAgentId(type === 'agent' ? id : selectedAgentId)}` — when clicking a tool node, it keeps the previously selected agent instead of clearing or doing something useful.
**Fix**: Also open detail panel for the clicked tool node.

### BUG-8: PUT endpoints silently fail when no fields provided
**File**: `server/routes/agentBuilder.ts:69-89,148-169,247-264`
**Cause**: If request body is empty, the SQL becomes `UPDATE ... SET updated_at=NOW() WHERE id=$1` which succeeds but returns the unchanged row. Not a crash, but misleading.
**Fix**: Return 400 if no update fields provided.

### BUG-9: `buildZodSchema` crashes on empty properties
**File**: `server/routes/agentBuilder.ts:19-37`
**Cause**: If `schema.properties` is `undefined`, `Object.entries(undefined)` throws. The `|| {}` fallback handles `null` but not the case where `schema` itself is malformed.
**Fix**: Add guard for missing `schema` or `schema.properties`.

### BUG-10: Workflow delete button never visible (CSS issue)
**File**: `components/agent-builder/AgentSidebar.tsx:203-204`
**Cause**: Delete button uses `opacity-0 group-hover:opacity-100` but the parent `<div>` doesn't have `group` class.
**Fix**: Add `group` class to the parent div.
