const fs = require('fs');
const path = require('path');
const files = [
  'components/agent-builder/AgentBuilderPanel.tsx',
  'components/agent-builder/AgentBuilderCanvas.tsx',
  'components/agent-builder/AgentNode.tsx',
  'components/agent-builder/ToolNode.tsx',
  'components/agent-builder/AgentChatView.tsx',
  'components/agent-builder/AgentDetailPanel.tsx',
  'components/agent-builder/ToolDetailPanel.tsx',
  'components/agent-builder/AgentSidebar.tsx',
  'components/agent-builder/hooks/useAgentBuilder.ts',
  'components/agent-builder/hooks/useAgentChat.ts',
  'components/agent-builder/styles.css',
  'components/agent-builder/node-panels/AgentPanel.tsx',
  'components/agent-builder/node-panels/MCPPanel.tsx',
  'components/agent-builder/node-panels/LogicPanel.tsx'
];
files.forEach(f => {
  try { fs.unlinkSync(f); console.log('Deleted:', f); }
  catch (e) { console.error('Failed:', f, e.message); }
});
try { fs.rmdirSync('components/agent-builder/node-panels'); console.log('Removed empty node-panels dir'); }
catch (e) { console.error('rmdir failed:', e.message); }
const remaining = fs.readdirSync('components/agent-builder');
console.log('\nRemaining in agent-builder:', remaining);
