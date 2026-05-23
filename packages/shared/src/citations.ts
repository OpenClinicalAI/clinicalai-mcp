/**
 * Helpers for building `Source` objects. Citations are a first-class field
 * (ARCHITECTURE.md §3.2): every tool returning clinical information must
 * populate `sources` with at least one entry, and the first entry is primary.
 */

import { nowIso } from "./results.js";
import type { Source } from "./types.js";

/** Known publishers, for consistent `Source.publisher` values. */
export const PUBLISHERS = {
  NLM: "NLM",
  FDA: "FDA",
  NIH: "NIH",
  CLINICALTRIALS: "ClinicalTrials.gov",
  AHRQ: "AHRQ",
  USPSTF: "USPSTF",
} as const;

/** Build a `Source`, defaulting `retrieved_at` to now if not supplied. */
export function makeSource(
  input: Omit<Source, "retrieved_at"> & { retrieved_at?: string },
): Source {
  return {
    title: input.title,
    url: input.url,
    ...(input.identifier ? { identifier: input.identifier } : {}),
    ...(input.identifier_type ? { identifier_type: input.identifier_type } : {}),
    ...(input.publisher ? { publisher: input.publisher } : {}),
    retrieved_at: input.retrieved_at ?? nowIso(),
  };
}

/**
 * Build a citation for a published formula, for `tier: "compute"` calculators
 * (ARCHITECTURE.md §3.2) — e.g. "Cockcroft-Gault, Nephron 1976".
 */
export function formulaSource(input: {
  title: string;
  url: string;
  publisher?: string;
}): Source {
  return makeSource(input);
}
