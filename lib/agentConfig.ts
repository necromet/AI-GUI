export type AgentType = 'plugin' | 'library' | 'stitch' | 'rag';

export interface AgentToolConfig {
  enabled: boolean;
  paramOverrides?: Record<string, { description?: string }>;
}

export interface AgentConfig {
  tools: Record<string, AgentToolConfig>;
  systemPromptAppend: string;
}

export const AGENT_TOOL_INFO: Record<AgentType, { name: string; description: string }[]> = {
  plugin: [
    { name: 'web_browse', description: 'Fetch and extract text content from a URL' },
    { name: 'execute_code', description: 'Execute JavaScript code in a sandboxed environment' },
    { name: 'search_web', description: 'Search the web for information via DuckDuckGo' },
  ],
  library: [
    { name: 'search_library', description: 'Search the component library using natural language' },
    { name: 'read_component', description: 'Read a component by ID with all files and metadata' },
    { name: 'ask_user', description: 'Ask the user a clarifying question' },
    { name: 'execute_code', description: 'Execute JavaScript code in a sandboxed environment' },
    { name: 'write_component_file', description: 'Write or update a single file in a component' },
    { name: 'delete_component_file', description: 'Delete a single file from a component' },
    { name: 'create_todo_list', description: 'Create a structured to-do list of tasks' },
    { name: 'verify_component', description: 'Verify the component renders in the preview sandbox' },
    { name: 'list_folders', description: 'List all library folders' },
    { name: 'list_folder_contents', description: 'List all components in a specific folder' },
  ],
  stitch: [
    { name: 'web_browse', description: 'Fetch and extract text content from a URL' },
    { name: 'execute_code', description: 'Execute JavaScript code in a sandboxed environment' },
    { name: 'search_web', description: 'Search the web for information via DuckDuckGo' },
    { name: 'edit_html', description: 'Apply surgical edits to HTML using CSS selectors' },
    { name: 'generate_html', description: 'Generate a complete HTML file from scratch' },
    { name: 'generate_spec', description: 'Generate a JSON design spec for IG content' },
    { name: 'edit_spec', description: 'Edit fields in an existing JSON design spec' },
    { name: 'search_library', description: 'Search the component library for reusable components' },
  ],
  rag: [],
};

function buildDefaults(agent: AgentType): AgentConfig {
  const tools: Record<string, AgentToolConfig> = {};
  for (const t of AGENT_TOOL_INFO[agent]) {
    tools[t.name] = { enabled: true };
  }
  return { tools, systemPromptAppend: '' };
}

export const AGENT_DEFAULTS: Record<AgentType, AgentConfig> = {
  plugin: buildDefaults('plugin'),
  library: buildDefaults('library'),
  stitch: buildDefaults('stitch'),
  rag: buildDefaults('rag'),
};

function storageKey(agent: AgentType): string {
  return `edward:labs_agentConfig_${agent}`;
}

export function getAgentConfig(agent: AgentType): AgentConfig {
  try {
    const raw = localStorage.getItem(storageKey(agent));
    if (raw) {
      const parsed = JSON.parse(raw) as AgentConfig;
      const defaults = AGENT_DEFAULTS[agent];
      const mergedTools: Record<string, AgentToolConfig> = {};
      for (const name of Object.keys(defaults.tools)) {
        mergedTools[name] = parsed.tools?.[name] ?? defaults.tools[name];
      }
      return {
        tools: mergedTools,
        systemPromptAppend: parsed.systemPromptAppend ?? '',
      };
    }
  } catch {}
  return { ...AGENT_DEFAULTS[agent] };
}

export function saveAgentConfig(agent: AgentType, config: AgentConfig): void {
  localStorage.setItem(storageKey(agent), JSON.stringify(config));
}

export function getEnabledTools(agent: AgentType): string[] {
  const config = getAgentConfig(agent);
  return Object.entries(config.tools)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);
}

export function getSystemPromptAppend(agent: AgentType): string {
  return getAgentConfig(agent).systemPromptAppend;
}

export function getToolParamOverrides(agent: AgentType, toolName: string): Record<string, { description?: string }> {
  return getAgentConfig(agent).tools[toolName]?.paramOverrides ?? {};
}
