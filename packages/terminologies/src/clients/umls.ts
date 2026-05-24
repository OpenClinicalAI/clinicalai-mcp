/**
 * NLM UMLS REST API client (https://documentation.uts.nlm.nih.gov/).
 *
 * Auth is the `apiKey` query parameter; the free UMLS license is available via
 * uts.nlm.nih.gov registration. This client only covers the endpoints the
 * terminologies tools need:
 *
 *   - search/current — by free-text term, optionally filtered to a source (`sabs`)
 *   - content/.../source/<sab>/<code> — fetch a concept by source code
 *   - content/.../CUI/<cui>/atoms — list atoms across requested vocabularies
 */

import { getUpstreamJson } from "@openclinicalai/shared";
import type { CodeMatch, CodeRecord } from "../types.js";

const UMLS_BASE = "https://uts-ws.nlm.nih.gov/rest";

/** UMLS source abbreviations relevant to this package. */
const SAB_TO_VOCAB = {
  SNOMEDCT_US: "snomedct",
  ICD10CM: "icd10cm",
  LNC: "loinc",
} as const satisfies Record<string, CodeMatch["vocabulary"]>;

interface UmlsSearchResultItem {
  ui?: string;
  rootSource?: string;
  uri?: string;
  name?: string;
}

interface UmlsSearchResponse {
  result?: { results?: UmlsSearchResultItem[] };
}

interface UmlsSourceConceptResponse {
  result?: { ui?: string; name?: string; rootSource?: string };
}

interface UmlsAtom {
  ui?: string;
  name?: string;
  code?: string;
  rootSource?: string;
  termType?: string;
}

interface UmlsAtomsResponse {
  result?: UmlsAtom[];
}

function appendKey(url: URL, env: NodeJS.ProcessEnv): URL {
  const key = env.UMLS_API_KEY;
  if (key) url.searchParams.set("apiKey", key);
  return url;
}

/** Extract the trailing source code from a UMLS `code` URL. */
function codeFromAtomUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = /\/source\/[^/]+\/([^/?#]+)/.exec(url);
  return match?.[1];
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Search a single source vocabulary; returns source-specific codes via
 * `returnIdType=sourceConcept`.
 */
export async function searchUmlsBySource(
  term: string,
  sab: keyof typeof SAB_TO_VOCAB,
  env: NodeJS.ProcessEnv,
  limit = 25,
): Promise<CodeMatch[]> {
  const url = appendKey(new URL(`${UMLS_BASE}/search/current`), env);
  url.searchParams.set("string", term);
  url.searchParams.set("sabs", sab);
  url.searchParams.set("returnIdType", "sourceConcept");
  url.searchParams.set("pageSize", String(limit));
  const json = await getUpstreamJson<UmlsSearchResponse>({
    service: "umls",
    url: url.toString(),
  });
  const vocab = SAB_TO_VOCAB[sab];
  const out: CodeMatch[] = [];
  for (const r of json.result?.results ?? []) {
    if (!r.ui || r.ui === "NONE" || !r.name) continue;
    out.push({ code: r.ui, name: r.name, vocabulary: vocab });
  }
  return out;
}

/** Search UMLS by term; returns CUIs (default `returnIdType`). */
export async function searchUmlsCui(
  term: string,
  env: NodeJS.ProcessEnv,
  limit = 25,
): Promise<{ cui: string; name: string }[]> {
  const url = appendKey(new URL(`${UMLS_BASE}/search/current`), env);
  url.searchParams.set("string", term);
  url.searchParams.set("pageSize", String(limit));
  const json = await getUpstreamJson<UmlsSearchResponse>({
    service: "umls",
    url: url.toString(),
  });
  const out: { cui: string; name: string }[] = [];
  for (const r of json.result?.results ?? []) {
    if (!r.ui || r.ui === "NONE" || !r.name) continue;
    out.push({ cui: r.ui, name: r.name });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Single source-code lookup                                                   */
/* -------------------------------------------------------------------------- */

/** Fetch a single source concept by SAB + code. */
export async function lookupUmlsSource(
  sab: keyof typeof SAB_TO_VOCAB,
  code: string,
  env: NodeJS.ProcessEnv,
): Promise<CodeRecord | null> {
  const url = appendKey(
    new URL(`${UMLS_BASE}/content/current/source/${sab}/${encodeURIComponent(code)}`),
    env,
  );
  try {
    const json = await getUpstreamJson<UmlsSourceConceptResponse>({
      service: "umls",
      url: url.toString(),
    });
    const r = json.result;
    if (!r?.name) return null;
    return { code: r.ui ?? code, name: r.name, vocabulary: SAB_TO_VOCAB[sab] };
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* CUI atoms across vocabularies                                               */
/* -------------------------------------------------------------------------- */

/** List atoms of a CUI restricted to the requested vocabularies. */
export async function getUmlsCuiAtoms(
  cui: string,
  sabs: (keyof typeof SAB_TO_VOCAB)[],
  env: NodeJS.ProcessEnv,
): Promise<Map<keyof typeof SAB_TO_VOCAB, CodeMatch[]>> {
  const url = appendKey(
    new URL(`${UMLS_BASE}/content/current/CUI/${encodeURIComponent(cui)}/atoms`),
    env,
  );
  url.searchParams.set("sabs", sabs.join(","));
  url.searchParams.set("pageSize", "100");
  const json = await getUpstreamJson<UmlsAtomsResponse>({
    service: "umls",
    url: url.toString(),
  });
  const grouped = new Map<keyof typeof SAB_TO_VOCAB, CodeMatch[]>();
  for (const atom of json.result ?? []) {
    const sab = atom.rootSource as keyof typeof SAB_TO_VOCAB | undefined;
    if (!sab || !(sab in SAB_TO_VOCAB)) continue;
    const code = codeFromAtomUrl(atom.code);
    if (!code || !atom.name) continue;
    const list = grouped.get(sab) ?? [];
    // Skip duplicates by source code.
    if (!list.some((m) => m.code === code)) {
      list.push({ code, name: atom.name, vocabulary: SAB_TO_VOCAB[sab] });
    }
    grouped.set(sab, list);
  }
  return grouped;
}
