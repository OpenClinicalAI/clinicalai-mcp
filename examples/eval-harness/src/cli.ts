#!/usr/bin/env tsx
/**
 * clinical-mcp eval-harness CLI.
 *
 *   pnpm --filter @clinical-mcp/eval-harness start -- --server calc --list-tools
 *   pnpm --filter @clinical-mcp/eval-harness start -- --server calc --tool calc_chads_vasc --args '{"age_y":76,"sex":"F","congestive_heart_failure":false,"hypertension":true,"diabetes":true,"stroke_tia_thromboembolism":true,"vascular_disease":false}'
 *   pnpm --filter @clinical-mcp/eval-harness start -- --server calc --question "CHA2DS2-VASc for a 76yo woman with HTN, diabetes, and prior stroke?"
 *   pnpm --filter @clinical-mcp/eval-harness start -- --server evidence --prompt-set prompts/clinical-cases.json
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runQuestion } from "./agent.js";
import { callRemoteTool, openSession } from "./mcp.js";
import { ALL_SERVERS, type ServerName } from "./servers.js";

interface Args {
  server?: ServerName;
  listServers: boolean;
  listTools: boolean;
  tool?: string;
  toolArgs?: string;
  question?: string;
  promptSet?: string;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { listServers: false, listTools: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--list-servers") args.listServers = true;
    else if (arg === "--list-tools") args.listTools = true;
    else if (arg === "--server") args.server = argv[++i] as ServerName;
    else if (arg === "--tool") args.tool = argv[++i];
    else if (arg === "--args") args.toolArgs = argv[++i];
    else if (arg === "--question" || arg === "-q") args.question = argv[++i];
    else if (arg === "--prompt-set") args.promptSet = argv[++i];
  }
  return args;
}

function printHelp(): void {
  process.stdout.write(`clinical-mcp eval-harness

Usage:
  --list-servers                  Print available server names.
  --server <name>                 Required for everything else; one of: ${ALL_SERVERS.join(", ")}.
  --list-tools                    List tools the server exposes, then exit.
  --tool <name> --args <json>     Call one tool directly; print the ToolResult.
  --question "<text>"             Run the agent loop on a single clinical question.
  --prompt-set <path>             Run every question for this server from a JSON file
                                  (shape: { "<server>": ["q1", "q2", ...] }).

Env:
  ANTHROPIC_API_KEY    Required for --question / --prompt-set.

The agent uses Claude Opus 4.7 with adaptive thinking (summarized display).
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.listServers || (!args.server && !args.tool && !args.question && !args.promptSet)) {
    process.stdout.write(`Servers: ${ALL_SERVERS.join(", ")}\n`);
    if (!args.server) {
      process.stdout.write("Pass --server <name> to do anything else. --help for full usage.\n");
      return;
    }
  }

  if (!args.server) {
    process.stderr.write("--server <name> is required.\n");
    process.exit(2);
  }
  if (!ALL_SERVERS.includes(args.server)) {
    process.stderr.write(
      `Unknown server "${args.server}". Expected one of: ${ALL_SERVERS.join(", ")}.\n`,
    );
    process.exit(2);
  }

  const session = await openSession(args.server);
  try {
    if (args.listTools) {
      process.stdout.write(`\nTools available on @clinical-mcp/${args.server}:\n`);
      for (const t of session.tools) {
        const desc = (t.description ?? "").slice(0, 100);
        process.stdout.write(`  - ${t.name.padEnd(34)} ${desc}\n`);
      }
      return;
    }

    if (args.tool) {
      const toolArgs = args.toolArgs ? (JSON.parse(args.toolArgs) as Record<string, unknown>) : {};
      const { text, isError } = await callRemoteTool(session, args.tool, toolArgs);
      process.stdout.write(`\n[${isError ? "error" : "result"}] ${args.tool}\n${text}\n`);
      if (isError) process.exitCode = 1;
      return;
    }

    if (args.question || args.promptSet) {
      if (!process.env.ANTHROPIC_API_KEY) {
        process.stderr.write("Set ANTHROPIC_API_KEY before running the agent loop.\n");
        process.exit(2);
      }
      const claude = new Anthropic();
      const questions: string[] = args.question
        ? [args.question]
        : loadPromptSet(args.promptSet as string, args.server);
      for (const q of questions) {
        await runQuestion(claude, session, q);
      }
      return;
    }

    // Fallback: just list the tools.
    process.stdout.write(`\nTools available on @clinical-mcp/${args.server}:\n`);
    for (const t of session.tools) {
      process.stdout.write(`  - ${t.name}\n`);
    }
  } finally {
    await session.close();
  }
}

function loadPromptSet(path: string, server: ServerName): string[] {
  // Resolve relative paths against the eval-harness package root so the user
  // can pass "prompts/clinical-cases.json" without thinking about cwd.
  const rootRelative = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const text = (() => {
    try {
      return readFileSync(rootRelative, "utf8");
    } catch {
      return readFileSync(path, "utf8");
    }
  })();
  const parsed = JSON.parse(text) as Record<string, string[]>;
  const questions = parsed[server];
  if (!questions || questions.length === 0) {
    throw new Error(`No questions for server "${server}" in ${path}.`);
  }
  return questions;
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
