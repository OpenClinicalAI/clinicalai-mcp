import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NoopCache, SqliteCache, cacheKey, normalizeArgs } from "../src/cache/index.js";

const tmpDirs: string[] = [];

function freshDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "clinicalai-mcp-cache-"));
  tmpDirs.push(dir);
  return join(dir, "cache.db");
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("SqliteCache", () => {
  it("stores and retrieves a value within TTL", async () => {
    const cache = new SqliteCache(freshDb());
    await cache.set("k1", { drug: "metformin", rxcui: "6809" }, { ttl_s: 3600 });

    const entry = await cache.get("k1");
    expect(entry).not.toBeNull();
    expect(entry?.value).toEqual({ drug: "metformin", rxcui: "6809" });
    expect(entry?.ttl_s).toBe(3600);
    expect(entry?.age_s).toBeGreaterThanOrEqual(0);
    await cache.close();
  });

  it("treats an expired entry as a miss and drops it", async () => {
    const cache = new SqliteCache(freshDb());
    await cache.set("expired", { v: 1 }, { ttl_s: 0 });
    expect(await cache.get("expired")).toBeNull();
    await cache.close();
  });

  it("returns null for an unknown key", async () => {
    const cache = new SqliteCache(freshDb());
    expect(await cache.get("nope")).toBeNull();
    await cache.close();
  });

  it("overwrites on a repeated set", async () => {
    const cache = new SqliteCache(freshDb());
    await cache.set("k", { v: 1 }, { ttl_s: 3600 });
    await cache.set("k", { v: 2 }, { ttl_s: 3600 });
    const entry = await cache.get("k");
    expect(entry?.value).toEqual({ v: 2 });
    await cache.close();
  });

  it("deletes a single entry", async () => {
    const cache = new SqliteCache(freshDb());
    await cache.set("k", { v: 1 }, { ttl_s: 3600 });
    await cache.delete("k");
    expect(await cache.get("k")).toBeNull();
    await cache.close();
  });

  it("purges entries older than a cutoff", async () => {
    const cache = new SqliteCache(freshDb());
    await cache.set("a", { v: 1 }, { ttl_s: 3600 });
    await cache.set("b", { v: 2 }, { ttl_s: 3600 });
    const removed = await cache.purgeOlderThan(Math.floor(Date.now() / 1000) + 1000);
    expect(removed).toBe(2);
    expect(await cache.get("a")).toBeNull();
    await cache.close();
  });
});

describe("NoopCache", () => {
  it("never stores anything", async () => {
    const cache = new NoopCache();
    await cache.set("k", { v: 1 }, { ttl_s: 3600 });
    expect(await cache.get("k")).toBeNull();
    expect(await cache.purgeOlderThan(Date.now())).toBe(0);
    await cache.close();
  });
});

describe("cacheKey", () => {
  it("is stable regardless of arg key order", () => {
    expect(cacheKey("search_drugs", { a: 1, b: 2 }, "free")).toBe(
      cacheKey("search_drugs", { b: 2, a: 1 }, "free"),
    );
  });

  it("changes with tool name, args, and tier", () => {
    const base = cacheKey("search_drugs", { q: "x" }, "free");
    expect(cacheKey("get_drug", { q: "x" }, "free")).not.toBe(base);
    expect(cacheKey("search_drugs", { q: "y" }, "free")).not.toBe(base);
    expect(cacheKey("search_drugs", { q: "x" }, "licensed-drugbank")).not.toBe(base);
  });

  it("normalizes nested arg objects deterministically", () => {
    expect(normalizeArgs({ a: { y: 1, x: 2 } })).toBe(normalizeArgs({ a: { x: 2, y: 1 } }));
  });
});
