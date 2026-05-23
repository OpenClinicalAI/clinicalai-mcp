/**
 * Env-var-driven license-tier detection. See ARCHITECTURE.md §3.4.
 *
 * License keys are read once at startup. A missing key is not an error — just
 * a downgraded tier. The tool name never changes with license state; only the
 * `tier` field on each result does.
 */

import type { DataTier } from "./types.js";

interface LicenseDef {
  /** Env var that activates this license. */
  env: string;
  /** Tier value it unlocks, or `null` if it only raises a rate limit (stays "free"). */
  tier: DataTier | null;
  /** Human-readable description of what configuring it unlocks. */
  unlocks: string;
}

/** The configured licenses and the env vars that activate them (ARCHITECTURE.md §3.4). */
export const LICENSE_DEFS: readonly LicenseDef[] = [
  { env: "OPENFDA_API_KEY", tier: null, unlocks: "Higher openFDA quotas" },
  { env: "NCBI_API_KEY", tier: null, unlocks: "Higher PubMed eutils quotas (3 → 10 req/sec)" },
  {
    env: "DRUGBANK_API_KEY",
    tier: "licensed-drugbank",
    unlocks: "Enriched drug records, clinician-grade DDI",
  },
  { env: "LEXICOMP_API_KEY", tier: "licensed-lexicomp", unlocks: "DDI, dosing, monographs" },
  { env: "MICROMEDEX_API_KEY", tier: "licensed-micromedex", unlocks: "DDI, IV compatibility" },
  {
    env: "UMLS_API_KEY",
    tier: "licensed-umls",
    unlocks: "SNOMED, cross-vocab concept mapping, ICD-10-CM enrichment",
  },
];

/** Every env var that influences licensing/rate limits. */
export const LICENSE_ENV_VARS: readonly string[] = LICENSE_DEFS.map((d) => d.env);

export interface LicenseInfo {
  /** Licensed (non-free) tiers configured in the environment. */
  activeTiers: DataTier[];
  /** Rate-limit env vars present — these keep the tier at "free". */
  rateLimitKeys: string[];
  /** Presence of each known license env var. */
  configured: Record<string, boolean>;
}

/** Detect which licenses and rate-limit keys are configured. */
export function detectLicenses(env: NodeJS.ProcessEnv = process.env): LicenseInfo {
  const activeTiers: DataTier[] = [];
  const rateLimitKeys: string[] = [];
  const configured: Record<string, boolean> = {};

  for (const def of LICENSE_DEFS) {
    const present = Boolean(env[def.env]);
    configured[def.env] = present;
    if (!present) continue;
    if (def.tier) activeTiers.push(def.tier);
    else rateLimitKeys.push(def.env);
  }

  return { activeTiers, rateLimitKeys, configured };
}

/** True if a given licensed tier is active in the environment. */
export function hasLicense(tier: DataTier, env: NodeJS.ProcessEnv = process.env): boolean {
  return detectLicenses(env).activeTiers.includes(tier);
}
