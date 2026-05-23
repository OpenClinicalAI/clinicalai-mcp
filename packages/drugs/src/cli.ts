#!/usr/bin/env node
/**
 * `@clinical-mcp/drugs` server entrypoint — the `clinical-mcp-drugs` bin.
 *
 * Runs as a per-user stdio MCP process. The shared scaffold loads + validates
 * the deployment policy, mounts the meta tools, and runs phi-lint over every
 * drug tool's input schema before serving.
 */

import { runClinicalMcpServer } from "@clinical-mcp/shared";
import { drugTools } from "./registry.js";

runClinicalMcpServer({
  name: "@clinical-mcp/drugs",
  version: "0.1.0",
  tools: drugTools(),
}).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
