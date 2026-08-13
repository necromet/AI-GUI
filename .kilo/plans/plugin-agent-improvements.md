# Plugin Agent Improvements

## Summary

Four improvements to `/experiments/plugin-agent`:
1. Document how tools work
2. Model selection should use available models from codebase
3. Chat rendering should match `/chat` (use `ChatMessage` + `MarkdownRenderer`)
4. Chat tab empty state should say "Pick a workflow" not "Pick an agent"

---

## 1. How Tools Work (Documentation)

The Agent Builder tools are currently **stubs**. Here's the flow:

- **DB tables**: `agent_builder_tools` stores tool definitions (name, description, `parameters_schema` JSON, icon, color). `agent_builder_agent_tools` junction links tools to agents.
- **Frontend**: User creates tools in the sidebar, attaches them to agents. The `AgentBuilderCanvas` visualizes agent→tool connections as React Flow edges.
- **Backend** (`server/routes/agentBuilder.ts:401-411`): When `/api/agent-builder/chat` is called, it loads the agent's tools from DB, builds Zod schemas from `parameters_schema`, and creates Vercel AI SDK `tool()` objects. The `execute` function is a **hardcoded stub**: `return \`Tool "${t.name}" executed with: ${JSON.stringify(args)}\``.
- **Chat hook** (`useAgentChat.ts`): Frontend streams SSE events from the backend. `tool_call` and `tool_result` events are parsed and displayed in the UI, but tool execution is entirely server-side (and non-functional since the execute is a stub).

**No changes needed** — this is just documentation for understanding.

---

## 2. Model Selection Based on Available Models

**Problem**: `AgentDetailPanel.tsx:83` has a free-text `<Input>` for model. Users type arbitrary strings. It should be a dropdown of `DEFAULT_MODELS` from `constants.tsx`.

**Changes**:

### `components/agent-builder/AgentDetailPanel.tsx`
- Import `DEFAULT_MODELS` from `constants.tsx`
- Replace the free-text `<Input>` for model with a `<Select>` (shadcn/ui) dropdown
- Show model name + provider in the dropdown options
- Filter to only show chat-type models (exclude TTS/ASR/voice models)
- Also add a provider field (auto-derived from selected model)

**New code sketch**:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_MODELS } from '../../constants';

const chatModels = DEFAULT_MODELS.filter(m => m.modelType === 'chat');

// Replace Input with:
<Select value={model} onValueChange={setModel}>
  <SelectTrigger className="h-8 text-xs">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {chatModels.map(m => (
      <SelectItem key={m.id} value={m.id}>
        {m.name} ({m.provider})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## 3. Chat Rendering Matching `/chat`

**Problem**: `AgentChatView.tsx` uses custom CSS classes (`ab-chat-msg`, `ab-chat-msg-content`) with plain `white-space: pre-wrap` text rendering. It does NOT use `ChatMessage` or `MarkdownRenderer`. This means no markdown rendering, no code syntax highlighting, no thinking indicators, no copy buttons, etc.

**Changes**:

### `components/agent-builder/AgentChatView.tsx`
- Import `ChatMessage` from `../ChatMessage`
- Import `Message`, `Role` from `../../types`
- Convert `AgentBuilderMessage[]` to `Message[]` for rendering
- Replace the custom message rendering div with `<ChatMessage>` component
- Keep the tool call display as-is (or integrate it with the message flow)
- Keep the custom input area (it's different from PromptInputBox and that's fine)

**Key conversion**:
```tsx
import ChatMessage from '../ChatMessage';
import { Role, Message } from '../../types';

// In the message rendering section, convert and render:
{messages.map((msg, i) => {
  const chatMsg: Message = {
    id: String(i),
    role: msg.role === 'user' ? Role.User : Role.Assistant,
    content: msg.content,
    timestamp: msg.timestamp || Date.now(),
    isThinking: isStreaming && i === messages.length - 1 && !msg.content,
  };
  return (
    <ChatMessage
      key={i}
      message={chatMsg}
      onRegenerate={() => {}}
      onFeedback={() => {}}
      isStreaming={isStreaming && i === messages.length - 1}
    />
  );
})}
```

- Remove the custom `ab-chat-msg`, `ab-chat-msg-header`, `ab-chat-msg-content` CSS from `styles.css` (or leave them — they won't be used)
- The tool calls section can remain as a separate block above/below the message, or be integrated

---

## 4. "Pick a workflow" Label

**Problem**: `AgentChatView.tsx:45` says "Pick an agent to chat with" when no agent is selected but workflow agents exist. Since the chat tab operates at the workflow level, it should say "Pick a workflow" or "Select a workflow to chat with".

**Changes**:

### `components/agent-builder/AgentChatView.tsx`
- Line 45: Change `Pick an agent to chat with` → `Pick a workflow to chat with`
- Line 46: Change `Select from the agents in this workflow` → `Select a workflow from the sidebar to start chatting`

Wait — re-reading the code more carefully: the empty state at line 37-68 shows when `!agent && hasWorkflowAgents`. This means a workflow IS selected, but no agent within it is chosen. The user wants this to instead prompt workflow selection (not agent selection).

Looking at the flow: `AgentBuilderPanel` renders `AgentChatView` with `agent={fullAgent || selectedAgent}` and `workflowAgents={workflowDetail?.agents}`. When no workflow is selected, `AgentBuilderPanel` shows "Select a workflow to get started" (line 199). When a workflow IS selected but no agent is chosen, `AgentChatView` shows "Pick an agent to chat with".

**The user's intent**: In the chat tab, the primary action should be picking a **workflow**, not picking an agent. The agent selection within a workflow should be secondary.

**Revised changes**:

### `components/agent-builder/AgentChatView.tsx`
- When `!agent && !hasWorkflowAgents` (no workflow selected): Show "Select a workflow to get started" (this already happens in AgentBuilderPanel line 193-202)
- When `!agent && hasWorkflowAgents` (workflow selected, no agent): Change label to "Pick an agent from this workflow" — this is actually correct behavior since you DO need to pick an agent to chat with
- The user's request "it should be pick a workflow, not pick an agent" likely refers to the empty state when NO workflow is selected. Let me re-check...

Actually, looking at `AgentBuilderPanel.tsx:193-202`:
```tsx
{!selectedWorkflowId ? (
  <div>Select a workflow to get started</div>
) : view === 'canvas' ? (
  <AgentBuilderCanvas ... />
) : (
  <AgentChatView agent={...} workflowAgents={...} />
)}
```

When no workflow is selected, the main area shows "Select a workflow to get started". When a workflow is selected and chat view is active, `AgentChatView` renders. If no agent is selected within that workflow, it shows "Pick an agent to chat with".

The user says "in chat tab in /experiments/plugin-agent: it should be pick a workflow, not pick an agent". This means when in chat tab with NO workflow selected, the message should reference workflow selection. But that message is in `AgentBuilderPanel`, not `AgentChatView`.

**Resolution**: Change `AgentChatView.tsx:45` from "Pick an agent to chat with" to "Pick a workflow to start chatting" — and when no workflow is selected, the `AgentBuilderPanel` already shows the right message. When a workflow IS selected but no agent is chosen, keep the agent selection UI but relabel the header to be workflow-centric.

**Simpler interpretation**: The empty state in chat tab should say "Pick a workflow" instead of "Pick an agent". Update:
- `AgentChatView.tsx:45`: `Pick an agent to chat with` → `Pick a workflow to chat with`
- `AgentChatView.tsx:46`: `Select from the agents in this workflow` → `Select a workflow from the sidebar`

But this doesn't make sense if workflowAgents exist (meaning a workflow IS selected). Let me just change the text to be about workflows and adjust the empty state logic.

**User's answer**: The entire chat tab should only prompt for workflow selection. When a workflow is selected, auto-pick the first agent in that workflow.

**Changes**:

### `components/agent-builder/AgentBuilderPanel.tsx`
- In the `AgentChatView` rendering (line 218-223), when `view === 'chat'` and a workflow is selected but no agent is chosen, auto-select the first agent from `workflowDetail.agents`
- Add a `useEffect` that auto-selects the first agent when switching to chat view with a workflow selected:
  ```tsx
  useEffect(() => {
    if (view === 'chat' && selectedWorkflowId && workflowDetail?.agents.length && !selectedAgentId) {
      setSelectedAgentId(workflowDetail.agents[0].id);
    }
  }, [view, selectedWorkflowId, workflowDetail, selectedAgentId]);
  ```

### `components/agent-builder/AgentChatView.tsx`
- Remove the "Pick an agent to chat with" empty state (lines 37-68) since auto-pick will handle it
- The remaining empty state (lines 71-83, when `!agent`) becomes the "Select a workflow" prompt:
  - Change text to "Select a workflow to start chatting"
  - Change subtitle to "Choose a workflow from the sidebar"

---

## Files to Modify

| File | Change |
|------|--------|
| `components/agent-builder/AgentDetailPanel.tsx` | Replace model text input with Select dropdown from DEFAULT_MODELS (chat models only) |
| `components/agent-builder/AgentChatView.tsx` | Replace custom message rendering with `ChatMessage` component; remove "Pick an agent" empty state; change remaining empty state to "Select a workflow" |
| `components/agent-builder/AgentBuilderPanel.tsx` | Add `useEffect` to auto-pick first workflow agent when entering chat view |
| `components/agent-builder/styles.css` | Remove unused `.ab-chat-msg*` styles (optional cleanup) |

## Verification

- `npm run build` (the only verification command per AGENTS.md)
