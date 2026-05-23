#!/usr/bin/env node
/**
 * `@clinical-mcp/terminologies` server entrypoint — the
 * `clinical-mcp-terminologies` bin.
 *
 * Runs as a per-user stdio MCP process. The shared scaffold loads + validates
 * the deployment policy, mounts the meta tools, and runs phi-lint over every
 * terminology tool's input schema before serving.
 */

import { runClinicalMcpServer } from "@clinical-mcp/shared";
import { terminologyTools } from "./registry.js";

runClinicalMcpServer({
  name: "@clinical-mcp/terminologies",
  version: "0.1.0",
  tools: terminologyTools(),
}).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
