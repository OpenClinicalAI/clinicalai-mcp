/**
 * A cache that stores nothing. Activated via `CLINICALAI_MCP_CACHE_URL=none`.
 * Useful for tests, offline eval, and reproducible demos where cache state
 * would be a confounder.
 */

import type { Cache, CacheEntry, CacheSetOptions } from "./types.js";

export class NoopCache implements Cache {
  get(_key: string): Promise<CacheEntry | null> {
    return Promise.resolve(null);
  }

  set(_key: string, _value: unknown, _opts: CacheSetOptions): Promise<void> {
    return Promise.resolve();
  }

  delete(_key: string): Promise<void> {
    return Promise.resolve();
  }

  purgeOlderThan(_unixSeconds: number): Promise<number> {
    return Promise.resolve(0);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
