/**
 * Cache interface. The cache is smoothing, not source-of-truth (ARCHITECTURE.md §4.2):
 * if it disappears the MCP still works, just slower. No tool reads from the cache
 * without a freshness check against TTL — an expired entry is reported as a miss.
 */

/** A live (non-expired) cache entry returned by {@link Cache.get}. */
export interface CacheEntry {
  /** The cached value (already decompressed and JSON-parsed). */
  value: unknown;
  /** Unix seconds at which the entry was written. */
  inserted_at: number;
  /** Seconds since the entry was written. */
  age_s: number;
  /** TTL the entry was written with, in seconds. */
  ttl_s: number;
}

export interface CacheSetOptions {
  /** Time-to-live in seconds. */
  ttl_s: number;
}

/**
 * Pluggable cache backend. `SqliteCache` is the default; `NoopCache` disables
 * caching; Redis/Postgres backends are activated via `CLINICALAI_MCP_CACHE_URL`.
 */
export interface Cache {
  /** Return a live entry, or `null` on miss / expiry. Expired rows are dropped lazily. */
  get(key: string): Promise<CacheEntry | null>;
  /** Write (or overwrite) a value with the given TTL. */
  set(key: string, value: unknown, opts: CacheSetOptions): Promise<void>;
  /** Remove a single entry. */
  delete(key: string): Promise<void>;
  /** Remove every entry inserted strictly before `unixSeconds`. Returns rows removed. */
  purgeOlderThan(unixSeconds: number): Promise<number>;
  /** Release underlying resources (file handles, connections). */
  close(): Promise<void>;
}
