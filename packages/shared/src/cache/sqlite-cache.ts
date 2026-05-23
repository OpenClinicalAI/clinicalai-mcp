/**
 * Default cache backend: one SQLite file per server, WAL mode, gzipped-JSON values.
 * See ARCHITECTURE.md §4.1.
 *
 * better-sqlite3 is synchronous; the `Cache` interface is async, so methods here
 * simply return resolved promises. At the per-user process scale this is fine —
 * single-writer serialization is not a concern.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import Database from "better-sqlite3";
import type { Cache, CacheEntry, CacheSetOptions } from "./types.js";

interface CacheRow {
  value: Buffer;
  inserted_at: number;
  ttl_s: number;
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export class SqliteCache implements Cache {
  readonly #db: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.#db = new Database(filePath);
    this.#db.pragma("journal_mode = WAL");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        inserted_at INTEGER NOT NULL,
        ttl_s INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_inserted ON cache(inserted_at);
    `);
  }

  get(key: string): Promise<CacheEntry | null> {
    const row = this.#db
      .prepare("SELECT value, inserted_at, ttl_s FROM cache WHERE key = ?")
      .get(key) as CacheRow | undefined;
    if (!row) return Promise.resolve(null);

    const age = unixNow() - row.inserted_at;
    // Freshness check: an expired entry is a miss, and we drop it lazily.
    if (age >= row.ttl_s) {
      this.#db.prepare("DELETE FROM cache WHERE key = ?").run(key);
      return Promise.resolve(null);
    }

    const value: unknown = JSON.parse(gunzipSync(row.value).toString("utf8"));
    return Promise.resolve({
      value,
      inserted_at: row.inserted_at,
      age_s: age,
      ttl_s: row.ttl_s,
    });
  }

  set(key: string, value: unknown, opts: CacheSetOptions): Promise<void> {
    const blob = gzipSync(Buffer.from(JSON.stringify(value), "utf8"));
    this.#db
      .prepare("INSERT OR REPLACE INTO cache (key, value, inserted_at, ttl_s) VALUES (?, ?, ?, ?)")
      .run(key, blob, unixNow(), opts.ttl_s);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#db.prepare("DELETE FROM cache WHERE key = ?").run(key);
    return Promise.resolve();
  }

  purgeOlderThan(unixSeconds: number): Promise<number> {
    const info = this.#db.prepare("DELETE FROM cache WHERE inserted_at < ?").run(unixSeconds);
    return Promise.resolve(info.changes);
  }

  close(): Promise<void> {
    this.#db.close();
    return Promise.resolve();
  }
}
