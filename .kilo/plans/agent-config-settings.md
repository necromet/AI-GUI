# Plan: Sidebar Back Button Fix + Agent Configuration Settings

## Part 1: Sidebar Back Button Fixes (Quick)

### 1a. Move back button to top of sidebar when on settings

Currently the "Back" button is in the footer section (line 514 of `Sidebar.tsx`). When on `/settings`, move it to the top of the sidebar content area, above the settings tabs.

**File: `components/Sidebar.tsx`**
- In the `isSettingsPage` branch (line 197), add a back button at the top of the settings tab navigation, before the `sectionLabel('Settings')` call
- Remove the conditional back button from the footer when on settings page (lines 514-521) — keep it only for the non-settings case

### 1b. Change back icon from Home to ArrowLeft

**File: `components/Sidebar.tsx`**
- Replace `<Home size={16} />` with `<ArrowLeft size={16} />` for the back button
- The `ArrowLeft` icon is already imported (line 3)

---

## Part 2: Agent Configuration Settings Tab

### Overview

Add a new "Agents" tab to the settings page that lets users configure tools, system prompts, and tool parameters for all 4 agents: Plugin Agent, Library Agent, Stitch Agent, and RAG Agent. Configuration stored in localStorage.

### Data Model

```ts
// New file: lib/agentConfig.ts

interface AgentToolConfig {
  enabled: boolean;
  paramOverrides?: Record<string, { description?: string }>;
}

interface AgentConfig {
  tools: Record<string, AgentToolConfig>;       // tool name → config
  systemPromptAppend: string;                    // appended to the default prompt
}

type AgentType = 'plugin' | 'library' | 'stitch' | 'rag';
```

### Agent → Tool Mapping

| Agent | Available Tools | Default Enabled |
|-------|----------------|-----------------|
| **Plugin** | `web_browse`, `execute_code`, `search_web` | All 3 |
| **Library** | `search_library`, `create_component`, `read_component`, `update_component`, `ask_user`, `execute_code`, `write_component_file`, `delete_component_file`, `create_todo_list`, `verify_component`, `list_folders`, `create_folder`, `move_to_folder`, `list_folder_contents` | All |
| **Stitch** | `web_browse`, `execute_code`, `search_web`, `edit_html`, `generate_html`, `generate_spec`, `edit_spec`, `search_library` | All |
| **RAG** | None (uses retrieval, no tool execution) | N/A — prompt only |

### Files to Create

#### `lib/agentConfig.ts` — Config helpers
- `getAgentConfig(agent: AgentType): AgentConfig` — reads from localStorage, returns defaults if missing
- `saveAgentConfig(agent: AgentType, config: AgentConfig): void` — writes to localStorage
- `getEnabledTools(agent: AgentType): string[]` — returns list of enabled tool names
- `getToolParamOverrides(agent: AgentType, toolName: string): Record<string, { description?: string }>` — returns param overrides
- `getSystemPromptAppend(agent: AgentType): string` — returns custom prompt suffix
- `AGENT_DEFAULTS: Record<AgentType, AgentConfig>` — hardcoded default configs for each agent
- localStorage keys: `edward:labs_agentConfig_plugin`, `edward:labs_agentConfig_library`, etc.

### Files to Modify

#### `components/SettingsPage.tsx` — Add "Agents" tab
- Add new tab `{ id: 'agents', label: 'Agents', icon: Wrench }` to `SETTINGS_TABS`
- Add `renderAgentsTab()` function with:
  - Sub-tab selector for the 4 agents (Plugin, Library, Stitch, RAG)
  - **Tool Toggles**: checkbox list of all tools for the selected agent, each with name + description, toggle on/off
  - **System Prompt**: textarea showing the current appended prompt, editable
  - **Tool Parameters**: collapsible section per tool showing parameter descriptions, editable
- Import `getAgentConfig`, `saveAgentConfig`, `AGENT_DEFAULTS` from `lib/agentConfig`

#### `server/services/agentService.ts` — Accept tool filters from request
- `buildToolSystemPrompt(tools: string[])` already filters by tool name — no change needed
- The agent route (`server/routes/agent.ts` line 23) already receives `tools` array from the client — no server change needed for tool toggles

#### `server/routes/agent.ts` — Accept custom system prompt
- Line 53: `const fullSystem = [stitchPrompt, systemInstruction, toolPrompt, langInstruction]...`
- Add support for `systemPromptAppend` in the request body, appended after `systemInstruction`

#### `server/routes/libraryAgent.ts` — Accept custom system prompt
- The library agent builds its prompt from `LIBRARY_AGENT_BASE_PROMPT` (line 12)
- Accept `systemPromptAppend` in the request body, append to the base prompt

#### `components/AgentChatPanel.tsx` — Pass config to agent calls
- On `handleSendMessage` (line 115): read `getEnabledTools('plugin')` instead of using local `enabledTools` state, OR merge local state with config
- Pass `systemPromptAppend` from config to the agent API call
- The existing `enabledTools` state + `toggleTool` UI (line 101) can remain as the runtime override, but the default should come from the config

#### `components/StitchPanel.tsx` — Read stitch agent config
- When sending agent messages, read `getEnabledTools('stitch')` and `getSystemPromptAppend('stitch')` from config

#### `components/RAGChatPanel.tsx` — Read RAG agent config
- Pass `getSystemPromptAppend('rag')` to the RAG API call

#### `server/routes/rag.ts` — Accept custom system prompt
- Accept `systemPromptAppend` and append to the RAG system prompt

#### `services/agentService.ts` (client) — Pass systemPromptAppend
- Update `sendAgentMessage` to accept and pass `systemPromptAppend` in the request body

### UI Design for the Agents Tab

```
┌─────────────────────────────────────────────┐
│ Agents                                      │
│                                             │
│ [Plugin] [Library] [Stitch] [RAG]           │
│                                             │
│ ─── Tools ─────────────────────────────── │
│ ☑ web_browse    Fetch webpage content       │
│ ☑ execute_code  Run JavaScript in sandbox   │
│ ☑ search_web    Search the web via DuckDuck │
│                                             │
│ ─── System Prompt ─────────────────────── │
│ ┌───────────────────────────────────────┐   │
│ │ Additional instructions appended to   │   │
│ │ the default agent prompt...           │   │
│ │                                       │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ─── Tool Parameters ──────────────────── │
│ ▸ web_browse (1 param)                      │
│ ▸ execute_code (1 param)                    │
│ ▸ search_web (1 param)                      │
│                                             │
│              [Reset to Defaults]             │
└─────────────────────────────────────────────┘
```

### Implementation Order

1. Create `lib/agentConfig.ts` with config helpers + defaults
2. Add "Agents" tab to `SettingsPage.tsx` with the full UI
3. Update `AgentChatPanel.tsx` to read plugin agent config
4. Update client `services/agentService.ts` to pass `systemPromptAppend`
5. Update `server/routes/agent.ts` to accept `systemPromptAppend`
6. Update `server/routes/libraryAgent.ts` to accept `systemPromptAppend`
7. Update `server/routes/rag.ts` to accept `systemPromptAppend`
8. Update Stitch panel to read stitch agent config
9. Update RAG panel to read rag agent config
10. Fix sidebar back button (Part 1)

### Verification

- `npm run build` — no type errors
- Manual test: open Settings → Agents tab, toggle tools, edit prompts, verify changes apply when chatting with each agent
