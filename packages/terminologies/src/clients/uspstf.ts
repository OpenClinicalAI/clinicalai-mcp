/**
 * USPSTF snapshot loader (ARCHITECTURE.md §5.4 — "snapshot-first, optional
 * live mode"). A versioned JSON snapshot ships inside the package so USPSTF
 * lookups work out of the box with no AHRQ API token. A future live-mode
 * fallback would activate via `USPSTF_API_TOKEN`.
 *
 * Bundled at `data/uspstf-2026-01.json`; tsup's `onSuccess` copies it into
 * `dist/data/` so the same loader works from both source (tests) and the
 * built bundle.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Recommendation, UspstfGrade, UspstfSnapshot } from "../types.js";

let CACHED: UspstfSnapshot | null = null;

/** Find the snapshot whether we're running from source (`src/`) or the bundle (`dist/`). */
function resolveSnapshotPath(): string {
  const candidates = [
    new URL("./data/uspstf-2026-01.json", import.meta.url), // dist/data/
    new URL("../../data/uspstf-2026-01.json", import.meta.url), // packages/terminologies/data/
  ];
  for (const c of candidates) {
    const path = fileURLToPath(c);
    if (existsSync(path)) return path;
  }
  throw new Error("USPSTF snapshot file not found relative to the package.");
}

/** Load the snapshot once and cache for the process lifetime. */
export function loadSnapshot(): UspstfSnapshot {
  if (CACHED) return CACHED;
  const text = readFileSync(resolveSnapshotPath(), "utf8");
  CACHED = JSON.parse(text) as UspstfSnapshot;
  return CACHED;
}

/** Search the snapshot's recommendations by free-text query (case-insensitive substring). */
export function searchSnapshot(query: string): Recommendation[] {
  const q = query.toLowerCase();
  return loadSnapshot().recommendations.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.topic.toLowerCase().includes(q) ||
      r.specific_recommendation.toLowerCase().includes(q) ||
      (r.population ?? "").toLowerCase().includes(q),
  );
}

/** Filter the snapshot by USPSTF grade. */
export function listByGrade(grade: UspstfGrade): Recommendation[] {
  return loadSnapshot().recommendations.filter((r) => r.grade === grade);
}

/** Get a single recommendation by ID. */
export function getRecommendation(id: string): Recommendation | undefined {
  return loadSnapshot().recommendations.find((r) => r.id === id);
}

/**
 * The AHRQ license/redistribution notice that must appear in every USPSTF
 * tool's `warnings` output (§5.4: "License caveat that must be surfaced").
 */
export const AHRQ_LICENSE_WARNING =
  "USPSTF content is reproduced verbatim under AHRQ's redistribution permission. It must NOT be modified, reproduced for a fee, sold, or incorporated into a profit-making venture without written AHRQ permission. Source: U.S. Preventive Services Task Force, AHRQ.";

/** Snapshot-provenance warning advertised on every USPSTF result. */
export function snapshotProvenanceWarning(): string {
  const snap = loadSnapshot();
  return `Served from bundled USPSTF snapshot ${snap.snapshot_version} (date ${snap.snapshot_date}). Set USPSTF_API_TOKEN to activate live AHRQ Prevention TaskForce API queries (planned).`;
}
