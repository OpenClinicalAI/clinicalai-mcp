/**
 * Anthropic-SDK agent loop driving the clinical-mcp tools.
 *
 * Adaptive thinking is enabled and `display: "summarized"` so the clinician
 * reading the trace can see Claude's reasoning between tool calls — that's the
 * point of running the harness as a validation surface, not just a black-box
 * test runner.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { type McpSession, type RemoteTool, callRemoteTool } from "./mcp.js";

const MODEL = "claude-opus-4-7";
const MAX_TOOL_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a clinical decision-support assistant for the clinical-mcp test harness.

Use the provided MCP tools to answer the clinician's question. Always:
- Pick the most specific tool that fits the question (e.g. calc_chads_vasc over a generic search).
- Pass the cross-cutting params \`phi_mode\` and \`cache\` only when the question mentions PHI or you need cache control.
- In your final answer cite the source URLs that came back in each tool result's \`sources\` field, so a clinician can verify the answer end-to-end.
- If a tool result returns \`tier: "free"\` with a warning about a licensed source, mention that the answer is from the free tier.`;

/** A single tool call recorded in the transcript. */
export interface ToolCallTrace {
  name: string;
  input: Record<string, unknown>;
  result: string;
  is_error: boolean;
}

/** Output of {@link runQuestion}. */
export interface QuestionTrace {
  question: string;
  turns: number;
  tool_calls: ToolCallTrace[];
  final_answer: string;
  stop_reason?: string;
}

function anthropicToolsFor(tools: RemoteTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));
}

/** Pretty-print a Claude response block for the transcript. */
function printBlock(block: Anthropic.ContentBlock, turn: number): void {
  if (block.type === "text") {
    if (block.text.trim().length === 0) return;
    process.stdout.write(`\n[Turn ${turn} • assistant]\n${block.text}\n`);
  } else if (block.type === "thinking") {
    const text = block.thinking?.trim();
    if (text) process.stdout.write(`\n[Turn ${turn} • thinking]\n${text}\n`);
  } else if (block.type === "tool_use") {
    const args = JSON.stringify(block.input, null, 2);
    process.stdout.write(`\n[Turn ${turn} • tool_use] ${block.name}\n${args}\n`);
  }
}

/** Print a tool result, truncated to keep the transcript readable. */
function printToolResult(name: string, text: string, isError: boolean): void {
  const max = 800;
  const truncated =
    text.length > max
      ? `${text.slice(0, max)}\n… (${text.length - max} more chars truncated)`
      : text;
  const tag = isError ? "tool_result (ERROR)" : "tool_result";
  process.stdout.write(`\n[${tag}] ${name}\n${truncated}\n`);
}

/**
 * Run one clinical question through Claude with the given MCP session as the
 * tool-execution backend. Prints the transcript to stdout as it goes.
 */
export async function runQuestion(
  claude: Anthropic,
  session: McpSession,
  question: string,
): Promise<QuestionTrace> {
  process.stdout.write(`\n${"═".repeat(72)}\n`);
  process.stdout.write(`Question: ${question}\n`);
  process.stdout.write(`${"═".repeat(72)}\n`);

  const tools = anthropicToolsFor(session.tools);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const toolCalls: ToolCallTrace[] = [];
  let finalAnswer = "";
  let stopReason: string | undefined;
  let turn = 0;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    turn += 1;
    const response = await claude.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive", display: "summarized" },
      tools,
      messages,
    });
    stopReason = response.stop_reason ?? undefined;

    for (const block of response.content) {
      printBlock(block, turn);
      if (block.type === "text") finalAnswer = block.text;
    }

    // Always echo the full assistant content back — thinking blocks must be
    // preserved for adaptive thinking + tool use to work correctly.
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const input = (block.input as Record<string, unknown>) ?? {};
      const { text, isError } = await callRemoteTool(session, block.name, input);
      printToolResult(block.name, text, isError);
      toolCalls.push({ name: block.name, input, result: text, is_error: isError });
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: text || "(no content)",
        ...(isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
  }

  process.stdout.write(
    `\n[summary] ${turn} turn(s), ${toolCalls.length} tool call(s), stop_reason=${stopReason ?? "?"}\n`,
  );

  return {
    question,
    turns: turn,
    tool_calls: toolCalls,
    final_answer: finalAnswer,
    stop_reason: stopReason,
  };
}
