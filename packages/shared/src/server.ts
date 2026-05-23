/**
 * MCP server scaffold (ARCHITECTURE.md §5.0, §6).
 *
 * Every domain server (`drugs`, `evidence`, `calc`, `terminologies`) is built
 * by calling `createClinicalMcpServer` with its tool list. The scaffold:
 *   - loads + validates the deployment policy (fail-loud),
 *   - detects configured licenses,
 *   - opens the cache backend,
 *   - mounts the three shared meta tools (`describe_capabilities`,
 *     `describe_policy`, `redact_phi`),
 *   - runs phi-lint over every tool's input schema before registration,
 *   - registers all tools on an `McpServer`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { type Cache, createCache } from "./cache/index.js";
import { loadDotEnv } from "./dotenv.js";
import { type LicenseInfo, detectLicenses } from "./license.js";
import { metaTools } from "./meta-tools.js";
import { PhiLintError, phiLintZodObject } from "./phi-lint.js";
import { type LoadedPolicy, type ResolvedPolicy, loadPolicy } from "./policy/index.js";
import { ClinicalMcpError } from "./results.js";
import type { ToolError, ToolResult } from "./types.js";

/** Runtime context handed to every tool handler. */
export interface ServerContext {
  serverName: string;
  serverVersion: string;
  /** The resolved, validated deployment policy (immutable for the process). */
  policy: ResolvedPolicy;
  /** Configured license tiers and rate-limit keys. */
  licenses: LicenseInfo;
  /** Shared cache backend. */
  cache: Cache;
  /** Process environment as seen at startup (for license-key/API-key lookup). */
  env: NodeJS.ProcessEnv;
  /** Names of every registered tool (meta tools + domain tools). */
  toolNames: string[];
}

/**
 * A tool definition. Domain packages build these (typically via {@link defineTool})
 * and pass them to {@link createClinicalMcpServer}.
 */
export interface ToolDef {
  name: string;
  description: string;
  /** Zod raw shape — advertised to the MCP host and used for input validation. */
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>, ctx: ServerContext) => Promise<ToolResult<unknown>>;
}

/** Authoring helper: keeps the handler's `args` strongly typed against the shape. */
export function defineTool<TShape extends z.ZodRawShape>(def: {
  name: string;
  description: string;
  inputSchema: TShape;
  handler: (args: z.infer<z.ZodObject<TShape>>, ctx: ServerContext) => Promise<ToolResult<unknown>>;
}): ToolDef {
  return def as unknown as ToolDef;
}

export interface CreateServerOptions {
  /** Package name, e.g. "@clinical-mcp/drugs". */
  name: string;
  /** Package version. */
  version: string;
  /** Domain tools to mount alongside the shared meta tools. */
  tools?: ToolDef[];
  /** Env to read configuration from; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

export interface ClinicalMcpServer {
  server: McpServer;
  context: ServerContext;
  /** Non-fatal warnings surfaced during policy load. */
  warnings: string[];
  /** Connect over stdio and begin serving. */
  start(): Promise<void>;
}

/** Short slug (no npm scope) used for the cache directory. */
function shortName(name: string): string {
  return name.replace(/^@[^/]+\//, "");
}

function toToolError(err: unknown): ToolError {
  if (err instanceof ClinicalMcpError) return err.payload;
  return {
    code: "INTERNAL",
    message: err instanceof Error ? err.message : String(err),
    retryable: false,
  };
}

/**
 * Build a clinical-mcp server. Throws `PolicyValidationError`, `PhiLintError`,
 * or `ClinicalMcpError` on a fatal misconfiguration — see {@link runClinicalMcpServer}
 * for the fail-loud entrypoint that turns those into a non-zero exit.
 */
export function createClinicalMcpServer(opts: CreateServerOptions): ClinicalMcpServer {
  const env = opts.env ?? process.env;

  const loaded: LoadedPolicy = loadPolicy(env);
  const licenses = detectLicenses(env);
  const cache = createCache({ server: shortName(opts.name), env });

  const context: ServerContext = {
    serverName: opts.name,
    serverVersion: opts.version,
    policy: loaded.policy,
    licenses,
    cache,
    env,
    toolNames: [],
  };

  const domainTools = opts.tools ?? [];
  const allTools: ToolDef[] = [...metaTools(context), ...domainTools];
  context.toolNames = allTools.map((t) => t.name);

  // phi-lint: reject PHI-shaped input fields before anything is registered.
  const violations = allTools.flatMap((t) => phiLintZodObject(t.name, z.object(t.inputSchema)));
  if (violations.length > 0) throw new PhiLintError(violations);

  const server = new McpServer({ name: opts.name, version: opts.version });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(args ?? {}, context);
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: toToolError(err) }, null, 2),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  return {
    server,
    context,
    warnings: loaded.warnings,
    async start() {
      await server.connect(new StdioServerTransport());
    },
  };
}

/**
 * Fail-loud entrypoint for a domain server's `bin`. Builds and starts the
 * server; on any fatal misconfiguration it prints a clear error to stderr and
 * exits non-zero so systemd / Docker / Kubernetes treat it as a deploy failure
 * (ARCHITECTURE.md §3.5.3).
 */
export async function runClinicalMcpServer(opts: CreateServerOptions): Promise<void> {
  // Load a project-level `.env` (gitignored) before anything reads
  // configuration. Existing real env vars are preserved.
  const loadedEnv = loadDotEnv();
  if (loadedEnv) {
    process.stderr.write(`[clinical-mcp] loaded env from ${loadedEnv}\n`);
  }

  let built: ClinicalMcpServer;
  try {
    built = createClinicalMcpServer(opts);
  } catch (err) {
    process.stderr.write(`\n[clinical-mcp] ${opts.name} failed to start:\n`);
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n`);
    process.exit(1);
    return;
  }
  // Non-fatal policy warnings go to stderr only — never off the machine (§3.6).
  for (const w of built.warnings) process.stderr.write(`[clinical-mcp] warning: ${w}\n`);
  await built.start();
}
