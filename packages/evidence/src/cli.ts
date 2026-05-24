#!/usr/bin/env node
/**
 * `@openclinicalai/evidence` server entrypoint — the `clinicalai-mcp-evidence` bin.
 *
 * Runs as a per-user stdio MCP process. The shared scaffold loads + validates
 * the deployment policy, mounts the meta tools, and runs phi-lint over every
 * evidence tool's input schema before serving.
 */

import { runClinicalMcpServer } from "@openclinicalai/shared";
import { evidenceTools } from "./registry.js";

runClinicalMcpServer({
  name: "@openclinicalai/evidence",
  version: "0.1.0",
  tools: evidenceTools(),
}).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
