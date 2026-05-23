#!/usr/bin/env node
/**
 * `@clinical-mcp/calc` server entrypoint — the `clinical-mcp-calc` bin.
 *
 * Runs as a per-user stdio MCP process. The shared scaffold loads + validates
 * the deployment policy, mounts the meta tools, and runs phi-lint over every
 * calculator's input schema before serving.
 */

import { runClinicalMcpServer } from "@clinical-mcp/shared";
import { calcTools } from "./tools.js";

runClinicalMcpServer({
  name: "@clinical-mcp/calc",
  version: "0.1.0",
  tools: calcTools(),
}).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
