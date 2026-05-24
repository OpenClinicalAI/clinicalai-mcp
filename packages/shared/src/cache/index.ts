/**
 * Cache module entrypoint + the `createCache` factory.
 *
 * Backend selection (ARCHITECTURE.md §4.2):
 *   - default                       → SqliteCache
 *   - CLINICALAI_MCP_CACHE_URL=none        → NoopCache
 *   - CLINICALAI_MCP_CACHE_URL=redis://... → RedisCache    (planned, milestone TBD)
 *   - CLINICALAI_MCP_CACHE_URL=postgres://...→ PostgresCache (planned, milestone TBD)
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { ClinicalMcpError } from "../results.js";
import { NoopCache } from "./noop-cache.js";
import { SqliteCache } from "./sqlite-cache.js";
import type { Cache } from "./types.js";

export { cacheKey, normalizeArgs } from "./key.js";
export { NoopCache } from "./noop-cache.js";
export { SqliteCache } from "./sqlite-cache.js";
export type { Cache, CacheEntry, CacheSetOptions } from "./types.js";

/** Default per-source TTLs in seconds. See ARCHITECTURE.md §4.1. */
export const DEFAULT_TTL_S = {
  pubmed_search: 24 * 60 * 60,
  clinicaltrials_search: 24 * 60 * 60,
  dailymed_label: 7 * 24 * 60 * 60,
  rxnorm_record: 7 * 24 * 60 * 60,
  openfda_adverse_events: 24 * 60 * 60,
  uspstf_recommendation: 30 * 24 * 60 * 60,
} as const;

export interface CreateCacheOptions {
  /** Server slug used for the default cache directory, e.g. "drugs". */
  server: string;
  /** Override the cache directory entirely (otherwise `CLINICALAI_MCP_CACHE_DIR` or `~/.clinicalai-mcp`). */
  cacheDir?: string;
  /** Env to read from; defaults to `process.env` (overridable for tests). */
  env?: NodeJS.ProcessEnv;
}

/**
 * Build the cache backend for a server. Honors `CLINICALAI_MCP_CACHE_URL` and
 * `CLINICALAI_MCP_CACHE_DIR`. Redis/Postgres backends are recognized but not yet
 * implemented — they fail loudly rather than silently degrading.
 */
export function createCache(opts: CreateCacheOptions): Cache {
  const env = opts.env ?? process.env;
  const url = env.CLINICALAI_MCP_CACHE_URL;

  if (url === "none") return new NoopCache();

  if (url?.startsWith("redis://") || url?.startsWith("rediss://")) {
    throw ClinicalMcpError.of(
      "INVALID_INPUT",
      "CLINICALAI_MCP_CACHE_URL points at Redis, but the Redis cache backend is not implemented in this build.",
      {
        suggestion:
          "Use the default SQLite cache (unset CLINICALAI_MCP_CACHE_URL) or CLINICALAI_MCP_CACHE_URL=none.",
      },
    );
  }
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) {
    throw ClinicalMcpError.of(
      "INVALID_INPUT",
      "CLINICALAI_MCP_CACHE_URL points at Postgres, but the Postgres cache backend is not implemented in this build.",
      {
        suggestion:
          "Use the default SQLite cache (unset CLINICALAI_MCP_CACHE_URL) or CLINICALAI_MCP_CACHE_URL=none.",
      },
    );
  }
  if (url) {
    throw ClinicalMcpError.of(
      "INVALID_INPUT",
      `Unrecognized CLINICALAI_MCP_CACHE_URL scheme: ${url}`,
      {
        suggestion: "Expected one of: none, redis://..., postgres://...",
      },
    );
  }

  const baseDir =
    opts.cacheDir ?? env.CLINICALAI_MCP_CACHE_DIR ?? join(homedir(), ".clinicalai-mcp");
  return new SqliteCache(join(baseDir, opts.server, "cache.db"));
}
