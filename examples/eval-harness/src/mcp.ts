/**
 * Thin MCP-client wrapper: spawn one of the clinical-mcp servers as a stdio
 * subprocess, list its tools, and call them by name. The harness uses this to
 * either drive an Anthropic agent loop (`agent.ts`) or call individual tools
 * directly from the CLI.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { type ServerName, resolveServerPath } from "./servers.js";

/** Shape of the tool list each server advertises. */
export interface RemoteTool {
  name: string;
  description: string;
  /** JSON Schema describing the tool's input. */
  input_schema: Record<string, unknown>;
}

/** A live connection to a clinical-mcp server. */
export interface McpSession {
  client: Client;
  tools: RemoteTool[];
  close(): Promise<void>;
}

/** Spawn a server, connect over stdio, and prefetch its tool list. */
export async function openSession(server: ServerName): Promise<McpSession> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [resolveServerPath(server)],
    env: { ...process.env } as Record<string, string>,
  });
  const client = new Client(
    { name: "clinical-mcp-eval-harness", version: "0.1.0" },
    { capabilities: {} },
  );
  await client.connect(transport);

  const resp = await client.listTools();
  const tools: RemoteTool[] = resp.tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: (t.inputSchema ?? { type: "object" }) as Record<string, unknown>,
  }));

  return {
    client,
    tools,
    async close() {
      await client.close();
    },
  };
}

/**
 * Call a tool by name and return the textual content the server emitted. Every
 * clinical-mcp tool returns its `ToolResult` as a single JSON-stringified text
 * block, so the returned string is JSON the caller can re-parse if needed.
 */
export async function callRemoteTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const resp = await session.client.callTool({ name, arguments: args });
  const blocks = (resp.content ?? []) as { type: string; text?: string }[];
  const text = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
  return { text, isError: Boolean(resp.isError) };
}
