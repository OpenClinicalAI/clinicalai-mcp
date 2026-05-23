/**
 * DrugBank Clinical API client — drug-drug interactions (ARCHITECTURE.md §3.4).
 *
 * IMPORTANT — licensing reality (as of 2026): DrugBank has discontinued
 * academic licensing for the Clinical API. This client is preserved for
 * deployers who already hold (or will purchase) a commercial license, but
 * `get_drug_interactions` no longer points new users here as the path forward.
 * The realistic free-tier interaction surface is the FDA label's
 * `drug_interactions` section; the realistic licensed-tier targets for new
 * deployments are Lexicomp and Micromedex.
 *
 * The DrugBank API surface varies by license tier and product version, so the
 * wrapper is deliberately defensive: it speaks a plausible REST shape and lets
 * the deployer override the base URL via `DRUGBANK_API_BASE` if their license
 * routes through a different host.
 *
 * Assumed contract (override via env if your DrugBank product differs):
 *   GET  ${DRUGBANK_API_BASE}/ddi?rxcui_list=<csv>
 *   Authorization: Bearer ${DRUGBANK_API_KEY}
 *   → array of interaction objects (field names defensively read below).
 */

import { ClinicalMcpError } from "@clinical-mcp/shared";
import type { DrugInteraction } from "../types.js";

const DEFAULT_BASE = "https://api.drugbank.com/v1";

/** Raw DrugBank interaction shape (every field optional — read defensively). */
export interface DrugBankInteraction {
  name?: string;
  severity?: string;
  description?: string;
  extended_description?: string;
  mechanism_of_action?: string;
  management?: string;
  subject_drug?: { rxcui?: string; name?: string };
  affected_drug?: { rxcui?: string; name?: string };
}

function authHeader(env: NodeJS.ProcessEnv): string {
  const key = env.DRUGBANK_API_KEY;
  if (!key) {
    throw ClinicalMcpError.of(
      "LICENSE_REQUIRED",
      "DrugBank Clinical API access requires DRUGBANK_API_KEY.",
    );
  }
  return `Bearer ${key}`;
}

/** Fetch pairwise DDI for a list of RxCUIs from DrugBank. */
export async function fetchDrugBankDdi(
  rxcuis: string[],
  env: NodeJS.ProcessEnv,
): Promise<DrugBankInteraction[]> {
  const base = env.DRUGBANK_API_BASE ?? DEFAULT_BASE;
  const url = new URL(`${base.replace(/\/$/, "")}/ddi`);
  url.searchParams.set("rxcui_list", rxcuis.join(","));

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: authHeader(env),
        "user-agent": "clinical-mcp/0.1 (+https://github.com/kswanjitsu/OpenClinicalAI)",
      },
    });
  } catch (err) {
    throw ClinicalMcpError.of(
      "UPSTREAM_UNAVAILABLE",
      `DrugBank was unreachable: ${(err as Error).message}`,
      { upstream: { service: "drugbank" } },
    );
  }

  if (resp.status === 401 || resp.status === 403) {
    throw ClinicalMcpError.of(
      "LICENSE_REQUIRED",
      `DrugBank rejected the credentials (HTTP ${resp.status}). Check DRUGBANK_API_KEY.`,
      { upstream: { service: "drugbank", status: resp.status } },
    );
  }
  if (resp.status === 429) {
    throw ClinicalMcpError.of("RATE_LIMITED", "DrugBank rate-limited the request.", {
      upstream: { service: "drugbank", status: 429 },
    });
  }
  if (!resp.ok) {
    throw ClinicalMcpError.of("UPSTREAM_UNAVAILABLE", `DrugBank returned HTTP ${resp.status}.`, {
      upstream: { service: "drugbank", status: resp.status },
    });
  }

  const body = (await resp.json()) as
    | DrugBankInteraction[]
    | { interactions?: DrugBankInteraction[] };
  if (Array.isArray(body)) return body;
  return body.interactions ?? [];
}

/** Translate the DrugBank interaction object into our domain {@link DrugInteraction} shape. */
export function toDrugInteraction(raw: DrugBankInteraction): DrugInteraction {
  const drugs: { rxcui: string; name?: string }[] = [];
  if (raw.subject_drug?.rxcui) {
    drugs.push({
      rxcui: raw.subject_drug.rxcui,
      ...(raw.subject_drug.name ? { name: raw.subject_drug.name } : {}),
    });
  }
  if (raw.affected_drug?.rxcui) {
    drugs.push({
      rxcui: raw.affected_drug.rxcui,
      ...(raw.affected_drug.name ? { name: raw.affected_drug.name } : {}),
    });
  }
  return {
    drugs,
    ...(raw.severity ? { severity: raw.severity } : {}),
    description: raw.description ?? raw.extended_description ?? raw.name ?? "(no description)",
    ...(raw.mechanism_of_action ? { mechanism: raw.mechanism_of_action } : {}),
    ...(raw.management ? { management: raw.management } : {}),
  };
}
