/**
 * DailyMed v2 client (NLM, free).
 *
 * Used to resolve canonical Structured Product Label SetIDs and their human
 * titles for citation. Label *content* is fetched from openFDA (which exposes
 * the parsed SPL sections as JSON); DailyMed serves the SPL XML, which we do
 * not parse on the free tier.
 */

import { getUpstreamJson } from "@openclinicalai/shared";

const DAILYMED_BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

export interface DailyMedSpl {
  setid: string;
  title?: string;
  spl_version?: number;
  published_date?: string;
}

interface DailyMedListResponse<T> {
  data?: T[];
}

/** Look up SPLs published for a given RxCUI. */
export async function fetchSplsByRxcui(rxcui: string): Promise<DailyMedSpl[]> {
  const url = new URL(`${DAILYMED_BASE}/spls.json`);
  url.searchParams.set("rxcui", rxcui);
  try {
    const json = await getUpstreamJson<DailyMedListResponse<DailyMedSpl>>({
      service: "dailymed",
      url: url.toString(),
    });
    return json.data ?? [];
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return [];
    throw err;
  }
}

/** Look up SPLs by drug name (used as a fallback when no RxCUI is known). */
export async function fetchSplsByName(name: string): Promise<DailyMedSpl[]> {
  const url = new URL(`${DAILYMED_BASE}/spls.json`);
  url.searchParams.set("drug_name", name);
  try {
    const json = await getUpstreamJson<DailyMedListResponse<DailyMedSpl>>({
      service: "dailymed",
      url: url.toString(),
    });
    return json.data ?? [];
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return [];
    throw err;
  }
}
