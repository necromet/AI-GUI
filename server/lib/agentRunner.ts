import type { Request, Response } from 'express';
import { streamChatCompletion, readSSEStream, type ChatMessage } from '../services/mimoService';
import { parseToolCalls, type ToolCall, type ToolResult } from '../services/agentService';
import { setupSSEHeaders, createEmitter, setupCloseDetection, sendSSEError } from './sseHelpers';

export interface AgentLoopConfig {
  /** Express request (for disconnect detection) */
  req: Request;
  /** Express response (for SSE writes) */
  res: Response;
  /** System prompt (already assembled) */
  systemPrompt: string;
  /** User messages (will be converted and prepended with system) */
  messages: any[];
  /** Function to convert user messages to ChatMessage[] */
  convertMessages: (messages: any[]) => ChatMessage[];
  /** Function to execute a tool call. Receives the call and the SSE emitter. */
  executeTool: (call: ToolCall, emitEvent: (event: any) => void) => Promise<ToolResult>;
  /** Model override (defaults to 'mimo-v2.5') */
  model?: string;
  /** Provider override */
  provider?: string;
  /** Max tokens override */
  max_tokens?: number;
  /** Maximum number of agent rounds (default: 6) */
  maxRounds?: number;
  /** Optional tag for log messages */
  logTag?: string;
  /** Called when the loop finishes successfully (before [DONE]) */
  onDone?: () => void;
}

/**
 * Run a multi-round agent loop with SSE streaming.
 *
 * Each round:
 * 1. Calls streamChatCompletion with the current message history
 * 2. Streams content/reasoning chunks to the client as SSE events
 * 3. Parses tool calls from the response
 * 4. Executes each tool call and emits tool_call/tool_result events
 * 5. Appends results to message history and repeats
 *
 * The loop exits when:
 * - No tool calls are found in the response
 * - The client disconnects
 * - maxRounds is reached
 * - An API error occurs
 */
export async function runAgentLoop(config: AgentLoopConfig): Promise<void> {
  const {
    req,
    res,
    systemPrompt,
    messages,
    convertMessages,
    executeTool: execTool,
    model,
    provider,
    max_tokens,
    maxRounds = 6,
    logTag = 'agent',
    onDone,
  } = config;

  setupSSEHeaders(res);
  const emitEvent = createEmitter(res);
  const conn = setupCloseDetection(req);

  const apiMessages: ChatMessage[] = [];
  apiMessages.push({ role: 'system', content: systemPrompt });
  apiMessages.push(...convertMessages(messages));

  let iteration = 0;

  while (iteration < maxRounds) {
    iteration++;

    const response = await streamChatCompletion({
      model: model || 'mimo-v2.5',
      messages: apiMessages,
      stream: true,
      thinking: { type: 'disabled' },
      ...(max_tokens ? { max_tokens } : {}),
    }, provider);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${logTag}] Upstream error ${response.status}:`, errorText.substring(0, 300));
      emitEvent({ error: `API error ${response.status}: ${errorText}` });
      break;
    }

    let fullResponse = '';
    await readSSEStream(response, (chunk) => {
      if (conn.isClosed()) return;
      if (chunk.content) {
        fullResponse += chunk.content;
        emitEvent({ content: chunk.content });
      }
      if (chunk.reasoning) {
        emitEvent({ reasoning: chunk.reasoning });
      }
    });

    if (conn.isClosed()) {
      console.log(`[${logTag}] Client disconnected during round ${iteration}`);
      break;
    }

    const toolCalls = parseToolCalls(fullResponse);
    console.log(`[${logTag}] round ${iteration}: ${fullResponse.length} chars, ${toolCalls.length} tool calls`);

    if (toolCalls.length === 0) break;

    apiMessages.push({ role: 'assistant', content: fullResponse });

    for (const call of toolCalls) {
      emitEvent({ tool_call: { name: call.name, arguments: call.arguments } });
      const result = await execTool(call, emitEvent);
      const outputStr = result.error ? `Error: ${result.error}` : result.output;
      emitEvent({ tool_result: { name: result.name, output: result.output, error: result.error } });
      apiMessages.push({ role: 'user', content: `[Tool: ${result.name}] ${outputStr}` });
    }
  }

  onDone?.();
  emitEvent({ done: true });
  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Wrapper that handles the try/catch and error emission for runAgentLoop.
 * Use this in route handlers for consistent error handling.
 */
export async function runAgentLoopSafe(config: AgentLoopConfig): Promise<void> {
  try {
    await runAgentLoop(config);
  } catch (error: any) {
    const tag = config.logTag || 'agent';
    console.error(`[${tag}] Error:`, error.message);
    sendSSEError(config.res, error.message);
  }
}
