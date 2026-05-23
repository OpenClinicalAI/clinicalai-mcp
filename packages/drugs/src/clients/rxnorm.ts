/**
 * RxNorm / RxNav client (NLM, free).
 *
 * The interaction endpoints (`/interaction/*`) were retired by NLM in January
 * 2024, so the drug-interactions tool is largely a stub on the free tier — the
 * design priority is to have the slot in place for a licensed source (DrugBank /
 * Lexicomp / Micromedex) to fill (ARCHITECTURE.md §3.4, §5.1).
 */

import { getUpstreamJson } from "@clinical-mcp/shared";

const RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST";

export interface RxConceptProperty {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
  language?: string;
}

interface ConceptGroup {
  tty: string;
  conceptProperties?: RxConceptProperty[];
}

interface DrugsResponse {
  drugGroup?: {
    name?: string;
    conceptGroup?: ConceptGroup[];
  };
}

interface PropertiesResponse {
  properties?: RxConceptProperty;
}

interface RelatedResponse {
  relatedGroup?: {
    rxcui: string;
    conceptGroup?: ConceptGroup[];
  };
}

/** Search RxNorm by drug name. Returns a flat list of concept properties. */
export async function searchDrugs(query: string): Promise<RxConceptProperty[]> {
  const url = new URL(`${RXNAV_BASE}/drugs.json`);
  url.searchParams.set("name", query);
  const json = await getUpstreamJson<DrugsResponse>({
    service: "rxnorm",
    url: url.toString(),
  });
  const groups = json.drugGroup?.conceptGroup ?? [];
  return groups.flatMap((g) => g.conceptProperties ?? []);
}

/** Fetch the properties of a single RxNorm concept by RxCUI. */
export async function getRxNormProperties(rxcui: string): Promise<RxConceptProperty | null> {
  const url = new URL(`${RXNAV_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`);
  try {
    const json = await getUpstreamJson<PropertiesResponse>({
      service: "rxnorm",
      url: url.toString(),
    });
    return json.properties ?? null;
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/** Fetch related concepts for an RxCUI, restricted to the given term types. */
export async function getRelatedConcepts(
  rxcui: string,
  ttys: string[],
): Promise<Map<string, RxConceptProperty[]>> {
  const url = new URL(`${RXNAV_BASE}/rxcui/${encodeURIComponent(rxcui)}/related.json`);
  url.searchParams.set("tty", ttys.join("+"));
  let json: RelatedResponse;
  try {
    json = await getUpstreamJson<RelatedResponse>({ service: "rxnorm", url: url.toString() });
  } catch (err) {
    // Unknown RxCUIs hit 404 on this endpoint; treat them as "no relations".
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") {
      return new Map();
    }
    throw err;
  }
  const out = new Map<string, RxConceptProperty[]>();
  for (const group of json.relatedGroup?.conceptGroup ?? []) {
    if (group.conceptProperties) out.set(group.tty, group.conceptProperties);
  }
  return out;
}
