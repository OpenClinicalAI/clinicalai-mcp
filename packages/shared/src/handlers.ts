/**
 * Tool-handler infrastructure consumed by every domain package: the cross-
 * cutting input shape from §3.1, the policy-aware cache wrapper, and the
 * sensitive-mode redaction of upstream-bound free text from §3.5.2.
 *
 * Domain packages compose these into their own tool handlers — no domain
 * package re-implements caching, sensitive-mode write rules, or the
 * `cache: "only"` semantics.
 */

import { z } from "zod";
import { cacheKey } from "./cache/index.js";
import { redactWithBackend } from "./phi/index.js";
import { ClinicalMcpError } from "./results.js";
import type { ServerContext } from "./server.js";
import type { CacheHint, CacheInfo, DataTier, PhiCategory, PhiRedactionReport } from "./types.js";

/** Cross-cutting params accepted by every tool input schema (ARCHITECTURE.md §3.1). */
export const crossCuttingShape = {
  verbose: z.boolean().optional().describe("Include the raw upstream payload under `verbose`."),
  phi_mode: z
    .enum(["safe", "sensitive"])
    .optional()
    .describe("Per-call PHI declaration. Sensitive mode redacts upstream-bound free text."),
  cache: z
    .enum(["default", "fresh", "only"])
    .optional()
    .describe("Cache hint. `fresh` bypasses cache; `only` returns from cache or fails."),
} as const;

/** Pull the cache hint out of an args object. */
function cacheHintOf(args: Record<string, unknown>): CacheHint {
  const value = args.cache;
  if (value === "fresh" || value === "only" || value === "default") return value;
  return "default";
}

export interface WithCacheOptions {
  ttl_s: number;
  /** Tier label used in the cache key — defaults to "free". */
  tier?: DataTier;
}

/**
 * Centralized cache + sensitive-mode policy plumbing. Tools call this with a
 * fetcher; the wrapper handles the cache hint, sensitive-mode write-blocking,
 * and the `cache: "only"` miss → `CACHE_MISS_REQUIRED_HIT`.
 */
export async function withCache<T>(
  ctx: ServerContext,
  toolName: string,
  args: Record<string, unknown>,
  options: WithCacheOptions,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cache: CacheInfo }> {
  const hint = cacheHintOf(args);
  const tier = options.tier ?? "free";
  const key = cacheKey(toolName, args, tier);

  if (hint !== "fresh") {
    const hit = await ctx.cache.get(key);
    if (hit) return { data: hit.value as T, cache: { hit: true, age_s: hit.age_s } };
    if (hint === "only") {
      throw ClinicalMcpError.of(
        "CACHE_MISS_REQUIRED_HIT",
        `No cached value for ${toolName} with the given arguments.`,
      );
    }
  }

  const data = await fetcher();

  // Sensitive mode: cache writes are blocked unless the policy allows persisting
  // sensitive inputs (covered-entity deployments only; ARCHITECTURE.md §3.5.2/3).
  const sensitive = args.phi_mode === "sensitive";
  const allowed = !sensitive || ctx.policy.cache.persist_sensitive_inputs;
  if (allowed) await ctx.cache.set(key, data, { ttl_s: options.ttl_s });

  return { data, cache: { hit: false, age_s: 0 } };
}

/** Output of {@link redactIfSensitive}: the safe-to-send text plus a report. */
export interface UpstreamText {
  text: string;
  redaction?: PhiRedactionReport;
}

/**
 * In `sensitive` mode, redact a free-text input through the policy-configured
 * backend before it leaves the process. In `safe` mode the text passes through.
 */
export async function redactIfSensitive(
  ctx: ServerContext,
  text: string,
  args: Record<string, unknown>,
): Promise<UpstreamText> {
  if (args.phi_mode !== "sensitive") return { text };
  const result = await redactWithBackend(text, ctx.policy.phi_redaction);
  const categories = [...new Set(result.spans.map((s) => s.category))] as PhiCategory[];
  return {
    text: result.redacted_text,
    redaction: { applied: true, categories, count: result.spans.length },
  };
}
