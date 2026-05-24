/**
 * openFDA client (label, FAERS adverse events, enforcement/recalls).
 *
 * `OPENFDA_API_KEY` is appended when present — it stays at tier "free" and just
 * raises the rate limit (ARCHITECTURE.md §3.4).
 */

import { getUpstreamJson } from "@openclinicalai/shared";

const OPENFDA_BASE = "https://api.fda.gov";

/** Append the openFDA API key if one is configured. */
function withKey(url: URL, env: NodeJS.ProcessEnv): URL {
  const key = env.OPENFDA_API_KEY;
  if (key) url.searchParams.set("api_key", key);
  return url;
}

/** Raw openFDA label record — every section field is optional and string[]. */
export interface OpenFdaLabel {
  set_id?: string;
  indications_and_usage?: string[];
  dosage_and_administration?: string[];
  contraindications?: string[];
  boxed_warning?: string[];
  warnings_and_cautions?: string[];
  warnings_and_precautions?: string[];
  warnings?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  use_in_specific_populations?: string[];
  pediatric_use?: string[];
  geriatric_use?: string[];
  pregnancy?: string[];
  lactation?: string[];
  overdosage?: string[];
  clinical_pharmacology?: string[];
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    rxcui?: string[];
  };
}

interface OpenFdaListResponse<T> {
  results?: T[];
}

interface OpenFdaCountTerm {
  term: string;
  count: number;
}

interface OpenFdaCountResponse {
  results?: OpenFdaCountTerm[];
  meta?: { results?: { total?: number } };
}

export interface OpenFdaEnforcement {
  recall_number?: string;
  classification?: string;
  status?: string;
  reason_for_recall?: string;
  recalling_firm?: string;
  product_description?: string;
  recall_initiation_date?: string;
  distribution_pattern?: string;
}

/** Fetch the most relevant SPL for an RxCUI from openFDA. */
export async function fetchLabelByRxcui(
  rxcui: string,
  env: NodeJS.ProcessEnv,
): Promise<OpenFdaLabel | null> {
  const url = withKey(new URL(`${OPENFDA_BASE}/drug/label.json`), env);
  url.searchParams.set("search", `openfda.rxcui:${rxcui}`);
  url.searchParams.set("limit", "1");
  try {
    const json = await getUpstreamJson<OpenFdaListResponse<OpenFdaLabel>>({
      service: "openfda",
      url: url.toString(),
    });
    return json.results?.[0] ?? null;
  } catch (err) {
    // openFDA returns 404 when no records match a search — treat that as "no label".
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/**
 * Fallback label search by generic_name. Necessary because FDA labels index by
 * specific labeled product (SetID + product-level RxCUIs), so an ingredient-
 * level RxCUI like 6809 (metformin) often returns no direct hits even though
 * the labels for that ingredient absolutely exist.
 */
export async function fetchLabelByGenericName(
  name: string,
  env: NodeJS.ProcessEnv,
): Promise<OpenFdaLabel | null> {
  const url = withKey(new URL(`${OPENFDA_BASE}/drug/label.json`), env);
  url.searchParams.set("search", `openfda.generic_name:"${name}"`);
  url.searchParams.set("limit", "1");
  try {
    const json = await getUpstreamJson<OpenFdaListResponse<OpenFdaLabel>>({
      service: "openfda",
      url: url.toString(),
    });
    return json.results?.[0] ?? null;
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/** Fetch a label by SetID (DailyMed UUID). */
export async function fetchLabelBySetId(
  setid: string,
  env: NodeJS.ProcessEnv,
): Promise<OpenFdaLabel | null> {
  const url = withKey(new URL(`${OPENFDA_BASE}/drug/label.json`), env);
  url.searchParams.set("search", `set_id:"${setid}"`);
  url.searchParams.set("limit", "1");
  try {
    const json = await getUpstreamJson<OpenFdaListResponse<OpenFdaLabel>>({
      service: "openfda",
      url: url.toString(),
    });
    return json.results?.[0] ?? null;
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/** Fetch FAERS reaction counts for an RxCUI. */
export async function fetchAdverseEventCounts(
  rxcui: string,
  opts: { since?: string; limit?: number },
  env: NodeJS.ProcessEnv,
): Promise<{ top: OpenFdaCountTerm[]; total: number | undefined }> {
  const url = withKey(new URL(`${OPENFDA_BASE}/drug/event.json`), env);
  const filters = [`patient.drug.openfda.rxcui:${rxcui}`];
  if (opts.since) filters.push(`receivedate:[${opts.since.replace(/-/g, "")}+TO+NOW]`);
  url.searchParams.set("search", filters.join("+AND+"));
  url.searchParams.set("count", "patient.reaction.reactionmeddrapt.exact");
  url.searchParams.set("limit", String(opts.limit ?? 25));
  try {
    const json = await getUpstreamJson<OpenFdaCountResponse>({
      service: "openfda",
      url: url.toString(),
    });
    return { top: json.results ?? [], total: json.meta?.results?.total };
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") {
      return { top: [], total: 0 };
    }
    throw err;
  }
}

/** Fetch drug enforcement / recall records for an RxCUI. */
export async function fetchEnforcement(
  rxcui: string,
  env: NodeJS.ProcessEnv,
  limit = 25,
): Promise<OpenFdaEnforcement[]> {
  const url = withKey(new URL(`${OPENFDA_BASE}/drug/enforcement.json`), env);
  url.searchParams.set("search", `openfda.rxcui:${rxcui}`);
  url.searchParams.set("limit", String(limit));
  try {
    const json = await getUpstreamJson<OpenFdaListResponse<OpenFdaEnforcement>>({
      service: "openfda",
      url: url.toString(),
    });
    return json.results ?? [];
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return [];
    throw err;
  }
}
