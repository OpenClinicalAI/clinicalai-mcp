/**
 * Test helpers — fetch stub that routes by URL substring (with json/text
 * variants) and a context builder using the NoopCache.
 */

import { type ServerContext, createClinicalMcpServer } from "@clinical-mcp/shared";
import { vi } from "vitest";
import { evidenceTools } from "../src/index.js";

export interface FetchRoute {
  /** Substring that must appear in the URL. */
  match: string;
  /** JSON body to return (mutually exclusive with `text`). */
  body?: unknown;
  /** Plain-text body to return (e.g. MEDLINE efetch). */
  text?: string;
  status?: number;
}

/** Build a global `fetch` mock that picks a route by URL substring. */
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

/** Build a server context for handler tests (no filesystem cache). */
export function buildContext(extraEnv: Record<string, string> = {}): ServerContext {
  return createClinicalMcpServer({
    name: "@clinical-mcp/evidence",
    version: "0.1.0",
    tools: evidenceTools(),
    env: { CLINICAL_CACHE_URL: "none", ...extraEnv },
  }).context;
}
