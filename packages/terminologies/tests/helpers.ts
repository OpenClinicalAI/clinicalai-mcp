/**
 * Test helpers — fetch stub that routes by URL substring and a context builder
 * using the NoopCache so tests touch no filesystem.
 */

import { type ServerContext, createClinicalMcpServer } from "@openclinicalai/shared";
import { vi } from "vitest";
import { terminologyTools } from "../src/index.js";

export interface FetchRoute {
  match: string;
  body?: unknown;
  text?: string;
  status?: number;
}

export function stubFetchRoutes(routes: FetchRoute[]) {
  const fn = vi.fn(async (input: unknown) => {
    const url = typeof input === "string" ? input : String(input);
    const route = routes.find((r) => url.includes(r.match));
    if (!route) throw new Error(`unmocked fetch URL: ${url}`);
    const status = route.status ?? 200;
    const textBody = route.text ?? (route.body !== undefined ? JSON.stringify(route.body) : "");
    return {
      ok: status < 400,
      status,
      headers: { get: (_name: string): string | null => null },
      json: async () => route.body,
      text: async () => textBody,
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export function buildContext(extraEnv: Record<string, string> = {}): ServerContext {
  return createClinicalMcpServer({
    name: "@openclinicalai/terminologies",
    version: "0.1.0",
    tools: terminologyTools(),
    env: { CLINICALAI_MCP_CACHE_URL: "none", ...extraEnv },
  }).context;
}
