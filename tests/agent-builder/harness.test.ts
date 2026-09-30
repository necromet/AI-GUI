import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

process.env.HARNESS_WORKSPACE_DIR = path.join(os.tmpdir(), 'harness-test-workspaces');

import { evaluatePermission, matchGlob, DEFAULT_PERMISSIONS } from '../../server/lib/harness/permissions.js';
import { resolveSafePath, ensureWorkspace, getWorkspaceRoot, walkFiles } from '../../server/lib/harness/workspace.js';
import { createRegistry, ToolRegistry } from '../../server/lib/harness/toolRegistry.js';
import { buildHarnessSystemPrompt } from '../../server/lib/harness/promptAssembler.js';
import { runHarness, parseFallbackToolCalls } from '../../server/lib/harness/runner.js';
import { fsTools } from '../../server/lib/harness/tools/fsTools.js';
import type { LLMRequest, LLMResponse } from '../../server/lib/harness/types.js';

test('matchGlob handles * and **', () => {
  assert.equal(matchGlob('write', 'write'), true);
  assert.equal(matchGlob('fs.*', 'fs.read'), true);
  assert.equal(matchGlob('*', 'write'), true);
  assert.equal(matchGlob('**/*.ts', 'src/a/b.ts'), true);
  assert.equal(matchGlob('**/*.ts', 'a.ts'), true);
  assert.equal(matchGlob('**/*.env', 'config.env'), true);
  assert.equal(matchGlob('*.ts', 'src/a.ts'), false);
});

test('evaluatePermission defaults and rule override', () => {
  assert.equal(evaluatePermission([], 'write', 'a.txt', { defaultAction: 'ask' }), 'ask');
  assert.equal(evaluatePermission([], 'read', 'a.txt', { defaultAction: 'allow' }), 'allow');
  assert.equal(
    evaluatePermission([{ tool: 'write', action: 'allow' }], 'write', 'a.txt', { defaultAction: 'ask' }),
    'allow',
  );
  assert.equal(
    evaluatePermission(
      [{ tool: 'write', pattern: '**/*.env', action: 'deny' }, { tool: 'write', action: 'allow' }],
      'write',
      'config.env',
      { defaultAction: 'ask' },
    ),
    'allow',
  );
  assert.equal(
    evaluatePermission(
      [{ tool: 'write', pattern: '**/*.env', action: 'deny' }],
      'write',
      'config.env',
      { defaultAction: 'ask' },
    ),
    'deny',
  );
});

test('DEFAULT_PERMISSIONS marks mutating tools as ask', () => {
  const write = DEFAULT_PERMISSIONS.find(r => r.tool === 'write');
  assert.equal(write?.action, 'ask');
  const read = DEFAULT_PERMISSIONS.find(r => r.tool === 'read');
  assert.equal(read?.action, 'allow');
});

test('resolveSafePath rejects escapes', () => {
  const root = path.resolve('/tmp/harness-root-test');
  assert.equal(resolveSafePath(root, 'a/b.txt'), path.join(root, 'a/b.txt'));
  assert.throws(() => resolveSafePath(root, '../../etc/passwd'), /escapes workspace/);
  assert.throws(() => resolveSafePath(root, '/etc/passwd'), /escapes workspace/);
});

test('ensureWorkspace creates root and walks files', async () => {
  const agentId = 'agent_test';
  const sessionId = 'sess_test';
  const root = await ensureWorkspace(agentId, sessionId);
  assert.equal(root, getWorkspaceRoot(agentId, sessionId));
  await fs.writeFile(path.join(root, 'hello.txt'), 'hi');
  const files = await walkFiles(root);
  assert.ok(files.includes('hello.txt'));
});

test('plan mode excludes mutating tools from registry', () => {
  const registry = createRegistry();
  const planNames = registry.list('plan').map(t => t.name);
  const buildNames = registry.list('build').map(t => t.name);
  assert.ok(!planNames.includes('write'));
  assert.ok(!planNames.includes('bash'));
  assert.ok(planNames.includes('read'));
  assert.ok(buildNames.includes('write'));
});

test('tool toggles disable tools', () => {
  const registry = createRegistry();
  const names = registry.list('build', { tools: { write: false } }).map(t => t.name);
  assert.ok(!names.includes('write'));
  assert.ok(names.includes('read'));
});

test('prompt assembler includes agent prompt and mode', () => {
  const system = buildHarnessSystemPrompt({
    agentPrompt: 'You are a helpful builder.',
    mode: 'plan',
    workspaceRoot: '/tmp/ws',
    tools: fsTools,
  });
  assert.match(system, /helpful builder/);
  assert.match(system, /Mode: plan/);
  assert.match(system, /### read/);
  assert.match(system, /Workspace: \/tmp\/ws/);
});

test('parseFallbackToolCalls finds fenced tool blocks', () => {
  const text = 'Done.\n```tool\n{"name":"write","arguments":{"path":"a.txt","content":"x"}}\n```';
  const calls = parseFallbackToolCalls(text);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'write');
  assert.equal(calls[0].arguments.path, 'a.txt');
});

test('runHarness executes tools via mock LLM and writes file', async () => {
  const root = await ensureWorkspace('agent_run', 'sess_run');
  const events: any[] = [];
  let turn = 0;

  const llmCall = async (_req: LLMRequest): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'write',
            arguments: { path: 'out/hello.txt', content: 'from harness' },
          },
        ],
      };
    }
    return { text: 'Wrote the file.' };
  };

  const result = await runHarness({
    agentId: 'agent_run',
    sessionId: 'sess_run',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'Create hello.txt' }],
    config: { permissions: [{ tool: 'write', action: 'allow' }], maxSteps: 5 },
    onEvent: e => events.push(e),
    llmCall,
  });

  assert.equal(result.stopped, 'done');
  assert.equal(result.toolCalls.length, 1);
  const written = await fs.readFile(path.join(root, 'out/hello.txt'), 'utf8');
  assert.equal(written, 'from harness');
  assert.ok(events.some(e => e.type === 'tool_call' && e.name === 'write'));
  assert.ok(events.some(e => e.type === 'tool_result' && e.name === 'write'));
  assert.ok(events.some(e => e.type === 'done'));
});

test('ask permission with deny resolver does not execute', async () => {
  const root = await ensureWorkspace('agent_perm', 'sess_perm');
  const events: any[] = [];
  let turn = 0;

  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'call_1', name: 'write', arguments: { path: 'secret.txt', content: 'x' } }],
      };
    }
    return { text: 'ok' };
  };

  const result = await runHarness({
    agentId: 'agent_perm',
    sessionId: 'sess_perm',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'write secret' }],
    config: { permissions: [{ tool: 'write', action: 'ask' }], maxSteps: 5 },
    permissionResolver: () => 'deny',
    onEvent: e => events.push(e),
    llmCall,
  });

  assert.ok(!events.some(e => e.type === 'tool_result' && !e.error));
  await assert.rejects(fs.access(path.join(root, 'secret.txt')));
  assert.equal(result.toolCalls[0]?.error, 'Permission denied for write');
});

test('doom loop stops after 3 identical tool calls', async () => {
  const root = await ensureWorkspace('agent_doom', 'sess_doom');
  let turn = 0;

  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    return {
      text: '',
      toolCalls: [{ id: 'call_' + turn, name: 'glob', arguments: { pattern: '*' } }],
    };
  };

  const result = await runHarness({
    agentId: 'agent_doom',
    sessionId: 'sess_doom',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'loop' }],
    config: { maxSteps: 10 },
    llmCall,
  });

  assert.equal(result.stopped, 'doom_loop');
  assert.ok(result.toolCalls.length < 10);
});

test('plan mode blocks write even if tool is attempted', async () => {
  const root = await ensureWorkspace('agent_plan', 'sess_plan');
  let turn = 0;

  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'write', arguments: { path: 'nope.txt', content: 'x' } }],
      };
    }
    return { text: 'done' };
  };

  const result = await runHarness({
    agentId: 'agent_plan',
    sessionId: 'sess_plan',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'try write' }],
    config: { mode: 'plan', permissions: [{ tool: 'write', action: 'allow' }], maxSteps: 5 },
    llmCall,
  });

  assert.ok(result.toolCalls[0]?.error);
  await assert.rejects(fs.access(path.join(root, 'nope.txt')));
});

// ─── Phase 2: skills, memory, tasks ────────────────────────────────

test('skills discovery finds SKILL.md files', async () => {
  const root = await ensureWorkspace('agent_skills', 'sess_skills');
  await fs.mkdir(path.join(root, '.mimocode', 'skills', 'my-skill'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.mimocode', 'skills', 'my-skill', 'SKILL.md'),
    '---\nname: my-skill\ndescription: A test skill\n---\n\nBody content here.',
  );
  const { discoverSkills, searchSkills, loadSkillContent } = await import('../../server/lib/harness/skills.js');
  const skills = await discoverSkills(root);
  assert.ok(skills.some(s => s.name === 'my-skill'));
  const hits = searchSkills(skills, 'test');
  assert.equal(hits.length, 1);
  const body = await loadSkillContent(root, 'my-skill');
  assert.match(body!, /Body content/);
});

test('memory read, append, and search', async () => {
  const suffix = Date.now();
  const root = await ensureWorkspace('agent_mem_' + suffix, 'sess_mem_' + suffix);
  const { readMemoryFile, appendMemoryFile, searchMemoryFiles } = await import('../../server/lib/harness/memory.js');
  await fs.writeFile(path.join(root, 'MEMORY.md'), '');
  await appendMemoryFile(root, 'MEMORY.md', '## Rules\nAlways use spaces.');
  await appendMemoryFile(root, 'MEMORY.md', '## Style\nPrefer single quotes.');
  const content = await readMemoryFile(root, 'MEMORY.md');
  assert.match(content, /Always use spaces/);
  assert.match(content, /Prefer single quotes/);
  const hits = await searchMemoryFiles(root, 'spaces');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].file, 'MEMORY.md');
  const noHits = await searchMemoryFiles(root, 'nonexistent_zzz');
  assert.equal(noHits.length, 0);
});

test('task store CRUD and dump', async () => {
  const { createTaskStore } = await import('../../server/lib/harness/tasks.js');
  const store = createTaskStore();
  const t1 = store.create('Build backend');
  assert.equal(t1.status, 'open');
  const t2 = store.create('Write types', t1.id);
  assert.equal(t2.parentId, t1.id);
  store.start(t1.id);
  assert.equal(store.get(t1.id)!.status, 'in_progress');
  store.done(t2.id);
  assert.equal(store.get(t2.id)!.status, 'done');
  const dump = store.dump();
  assert.match(dump, /Build backend/);
  assert.match(dump, /Write types/);
  assert.match(dump, /\[done\]/);
});

test('task tool emits task_update events through harness', async () => {
  const root = await ensureWorkspace('agent_task_events', 'sess_task_events');
  const events: any[] = [];
  let turn = 0;

  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'task', arguments: { action: 'create', summary: 'Test task' } }],
      };
    }
    return { text: 'done' };
  };

  await runHarness({
    agentId: 'agent_task_events',
    sessionId: 'sess_task_events',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'add a task' }],
    config: { maxSteps: 5 },
    onEvent: e => events.push(e),
    llmCall,
  });

  assert.ok(events.some(e => e.type === 'task_update' && e.tasks.length > 0));
});

test('skill tool loads skill body into tool result', async () => {
  const root = await ensureWorkspace('agent_skill_load', 'sess_skill_load');
  await fs.mkdir(path.join(root, '.mimocode', 'skills', 'demo'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.mimocode', 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: Demo skill\n---\n\nLoaded body.',
  );

  let turn = 0;
  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'skill', arguments: { name: 'demo' } }],
      };
    }
    return { text: 'loaded' };
  };

  const result = await runHarness({
    agentId: 'agent_skill_load',
    sessionId: 'sess_skill_load',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'load demo skill' }],
    config: { maxSteps: 5 },
    llmCall,
  });

  assert.equal(result.toolCalls.length, 1);
  assert.match(result.toolCalls[0].output, /Loaded body/);
});

test('memory tool read and append via harness', async () => {
  const root = await ensureWorkspace('agent_mem_tool', 'sess_mem_tool');
  let turn = 0;
  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'memory', arguments: { action: 'append', content: '## Notes\n- Item 1' } }],
      };
    }
    if (turn === 2) {
      return {
        text: '',
        toolCalls: [{ id: 'c2', name: 'memory', arguments: { action: 'read' } }],
      };
    }
    return { text: 'done' };
  };

  const result = await runHarness({
    agentId: 'agent_mem_tool',
    sessionId: 'sess_mem_tool',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'save a note' }],
    config: { maxSteps: 5 },
    llmCall,
  });

  assert.equal(result.toolCalls.length, 2);
  assert.match(result.toolCalls[1].output, /Item 1/);
});

test('prompt assembler includes skills and task dump', () => {
  const system = buildHarnessSystemPrompt({
    mode: 'build',
    workspaceRoot: '/tmp/ws',
    tools: fsTools,
    skills: [{ name: 'code-review', description: 'Review code for bugs' }],
    taskDump: '- T1 [active] Build feature\n  - T1.1 [done] Write types',
  });
  assert.match(system, /code-review/);
  assert.match(system, /Build feature/);
  assert.match(system, /\[done\]/);
});

// ─── Phase 3: permission pause/resume, question tool, subagents ───

test('permission pause/resume via pending store', async () => {
  const root = await ensureWorkspace('agent_pause', 'sess_pause');
  const events: any[] = [];
  let turn = 0;

  const { resolvePending } = await import('../../server/lib/harness/tools/questionTool.js');

  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'call_1', name: 'write', arguments: { path: 'approved.txt', content: 'ok' } }],
      };
    }
    return { text: 'Written.' };
  };

  // Start the harness in a background promise
  const harnessPromise = runHarness({
    agentId: 'agent_pause',
    sessionId: 'sess_pause',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'write file' }],
    config: { permissions: [{ tool: 'write', action: 'ask' }], maxSteps: 5 },
    onEvent: e => {
      events.push(e);
      if (e.type === 'permission_request') {
        // Auto-resolve the pending permission after a short delay
        setTimeout(() => resolvePending(e.id, { decision: 'allow' }), 10);
      }
    },
    llmCall,
  });

  const result = await harnessPromise;

  assert.ok(events.some(e => e.type === 'permission_request'));
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].output, 'Wrote approved.txt (2 chars)');
  const written = await fs.readFile(path.join(root, 'approved.txt'), 'utf8');
  assert.equal(written, 'ok');
});

test('question tool pauses and resumes with user answer', async () => {
  const root = await ensureWorkspace('agent_question', 'sess_question');
  const events: any[] = [];
  let turn = 0;

  const { resolvePending } = await import('../../server/lib/harness/tools/questionTool.js');

  const llmCall = async (): Promise<LLMResponse> => {
    turn++;
    if (turn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'question', arguments: { question: 'What language?', options: ['TS', 'Python'] } }],
      };
    }
    return { text: 'Using TypeScript.' };
  };

  const harnessPromise = runHarness({
    agentId: 'agent_question',
    sessionId: 'sess_question',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'ask me' }],
    config: { maxSteps: 5 },
    onEvent: e => {
      events.push(e);
      if (e.type === 'question') {
        setTimeout(() => resolvePending(e.id, { answer: 'TypeScript' }), 10);
      }
    },
    llmCall,
  });

  const result = await harnessPromise;

  assert.ok(events.some(e => e.type === 'question'));
  assert.equal(result.toolCalls.length, 1);
  assert.match(result.toolCalls[0].output, /TypeScript/);
});

test('subagent explore returns read-only result', async () => {
  const root = await ensureWorkspace('agent_sub', 'sess_sub');
  await fs.writeFile(path.join(root, 'README.md'), '# Test project');

  const { createSubagentTool } = await import('../../server/lib/harness/subagents.js');
  const subagentLLM = async (_req: LLMRequest): Promise<LLMResponse> => {
    return { text: 'Found: README.md in the workspace.' };
  };
  let parentTurn = 0;
  const parentLLM = async (): Promise<LLMResponse> => {
    parentTurn++;
    if (parentTurn === 1) {
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'subagent', arguments: { prompt: 'List files', type: 'explore' } }],
      };
    }
    return { text: 'Done.' };
  };

  const { createRegistry } = await import('../../server/lib/harness/toolRegistry.js');
  const registry = createRegistry();
  for (const t of createSubagentTool({
    workspaceRoot: root,
    agentId: 'agent_sub',
    sessionId: 'sess_sub',
    llmCall: subagentLLM,
  })) registry.register(t);

  const result = await runHarness({
    agentId: 'agent_sub',
    sessionId: 'sess_sub',
    workspaceRoot: root,
    messages: [{ role: 'user', content: 'explore' }],
    config: { maxSteps: 10 },
    registry,
    permissionResolver: () => 'allow',
    llmCall: parentLLM,
  });

  assert.equal(result.toolCalls.length, 1);
  assert.match(result.toolCalls[0].output, /README\.md/);
});

test('builtin registry includes fs, shell, web, skill, and memory tools', async () => {
  const { createRegistry } = await import('../../server/lib/harness/toolRegistry.js');
  const registry = createRegistry();
  assert.ok(registry.get('read'));
  assert.ok(registry.get('write'));
  assert.ok(registry.get('bash'));
  assert.ok(registry.get('glob'));
  assert.ok(registry.get('grep'));
  assert.ok(registry.get('webfetch'));
  assert.ok(registry.get('websearch'));
  assert.ok(registry.get('memory'));
  assert.ok(registry.get('skill'));
  assert.ok(registry.get('skill_search'));
  assert.ok(!registry.get('question'), 'question is factory-created, not in builtinTools');
});
