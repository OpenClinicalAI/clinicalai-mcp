/**
 * Test helpers — a `fetch` stub that routes by URL substring, and a context
 * builder that runs the server with the NoopCache so tests touch no filesystem.
 */

import { type ServerContext, createClinicalMcpServer } from "@clinical-mcp/shared";
import { vi } from "vitest";
import { drugTools } from "../src/index.js";

export interface FetchRoute {
  /** Substring that must appear in the URL. */
  match: string;
  /** JSON body to return. */
  body: unknown;
  status?: number;
}

/**
 * Build a global `fetch` mock that picks a route by URL substring. The first
 * matching route wins; an unmatched URL throws to make missed routes obvious.
 */
export function stubFetchRoutes(routes: FetchRoute[]) {
  const fn = vi.fn(async (input: unknown, ..._rest: unknown[]) => {
    const url = typeof input === "string" ? input : String(input);
    const route = routes.find((r) => url.includes(r.match));
    if (!route) throw new Error(`unmocked fetch URL: ${url}`);
    const status = route.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: { get: (_name: string): string | null => null },
      json: async () => route.body,
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Build a server context for handler tests (no filesystem cache). Extra env can be merged. */
export function buildContext(extraEnv: Record<string, string> = {}): ServerContext {
  return createClinicalMcpServer({
    name: "@clinical-mcp/drugs",
    version: "0.1.0",
    tools: drugTools(),
    env: { CLINICAL_CACHE_URL: "none", ...extraEnv },
  }).context;
}
