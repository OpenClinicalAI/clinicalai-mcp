#!/usr/bin/env node
/**
 * `@openclinicalai/terminologies` server entrypoint — the
 * `clinicalai-mcp-terminologies` bin.
 *
 * Runs as a per-user stdio MCP process. The shared scaffold loads + validates
 * the deployment policy, mounts the meta tools, and runs phi-lint over every
 * terminology tool's input schema before serving.
 */

import { runClinicalMcpServer } from "@openclinicalai/shared";
import { terminologyTools } from "./registry.js";

runClinicalMcpServer({
  name: "@openclinicalai/terminologies",
  version: "0.1.0",
  tools: terminologyTools(),
}).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
