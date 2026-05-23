/**
 * NLM Clinical Tables search API (free, no key).
 *
 * Endpoint shape: `GET /api/{table}/v3/search?terms=...&maxList=N&df=...&sf=...`
 * Response shape: `[total_count, codes_array, extra, display_rows, codeSystems]`
 * where `display_rows` is an array of arrays whose columns match the order of
 * the `df` (display-fields) parameter.
 */

import { getUpstreamJson } from "@clinical-mcp/shared";
import type { CodeMatch } from "../types.js";

const BASE = "https://clinicaltables.nlm.nih.gov/api";

/** The 5-element response tuple returned by every clinicaltables.nlm endpoint. */
type ClinicalTablesResponse = [
  number, // total count
  string[], // code list (parallel to display rows)
  unknown, // extra data (null for our queries)
  string[][], // display rows: one inner array per code, columns = df fields
  unknown, // code-system data (null for single-source tables)
];

interface SearchOptions {
  table: "icd10cm" | "loinc_items";
  /** Search term. */
  terms: string;
  /** Maximum number of rows to return. */
  maxList?: number;
  /** Display-field column names, in order. Their values populate the result. */
  df: string[];
  /** Search-field name (search restricted to this field). */
  sf?: string;
}

async function search(opts: SearchOptions): Promise<{ codes: string[]; rows: string[][] }> {
  const url = new URL(`${BASE}/${opts.table}/v3/search`);
  url.searchParams.set("terms", opts.terms);
  url.searchParams.set("maxList", String(opts.maxList ?? 25));
  url.searchParams.set("df", opts.df.join(","));
  if (opts.sf) url.searchParams.set("sf", opts.sf);
  const json = await getUpstreamJson<ClinicalTablesResponse>({
    service: "clinicaltables",
    url: url.toString(),
  });
  const codes = Array.isArray(json[1]) ? json[1] : [];
  const rows = Array.isArray(json[3]) ? json[3] : [];
  return { codes, rows };
}

/* -------------------------------------------------------------------------- */
/* ICD-10-CM                                                                   */
/* -------------------------------------------------------------------------- */

/** Search ICD-10-CM by term (matches name/synonyms). */
export async function searchIcd10(query: string, limit = 25): Promise<CodeMatch[]> {
  const { rows } = await search({
    table: "icd10cm",
    terms: query,
    maxList: limit,
    df: ["code", "name"],
  });
  return rows
    .filter((r) => r[0] && r[1])
    .map<CodeMatch>((r) => ({ code: r[0] as string, name: r[1] as string, vocabulary: "icd10cm" }));
}

/** Find ICD-10-CM matches by code prefix (used by `lookup_icd10`). */
export async function searchIcd10ByCode(code: string, limit = 25): Promise<CodeMatch[]> {
  const { rows } = await search({
    table: "icd10cm",
    terms: code,
    maxList: limit,
    df: ["code", "name"],
    sf: "code",
  });
  return rows
    .filter((r) => r[0] && r[1])
    .map<CodeMatch>((r) => ({ code: r[0] as string, name: r[1] as string, vocabulary: "icd10cm" }));
}

/* -------------------------------------------------------------------------- */
/* LOINC                                                                       */
/* -------------------------------------------------------------------------- */

/** Search LOINC by term. */
export async function searchLoinc(query: string, limit = 25): Promise<CodeMatch[]> {
  const { rows } = await search({
    table: "loinc_items",
    terms: query,
    maxList: limit,
    df: ["LOINC_NUM", "LONG_COMMON_NAME", "COMPONENT", "SYSTEM"],
  });
  return rows
    .filter((r) => r[0] && r[1])
    .map<CodeMatch>((r) => ({
      code: r[0] as string,
      name: r[1] as string,
      vocabulary: "loinc",
      ...(r[2] || r[3]
        ? {
            extra: {
              ...(r[2] ? { component: r[2] as string } : {}),
              ...(r[3] ? { system: r[3] as string } : {}),
            },
          }
        : {}),
    }));
}

/** Look up LOINC by code (exact / prefix). */
export async function searchLoincByCode(code: string, limit = 25): Promise<CodeMatch[]> {
  const { rows } = await search({
    table: "loinc_items",
    terms: code,
    maxList: limit,
    df: ["LOINC_NUM", "LONG_COMMON_NAME", "COMPONENT", "SYSTEM"],
    sf: "LOINC_NUM",
  });
  return rows
    .filter((r) => r[0] && r[1])
    .map<CodeMatch>((r) => ({
      code: r[0] as string,
      name: r[1] as string,
      vocabulary: "loinc",
      ...(r[2] || r[3]
        ? {
            extra: {
              ...(r[2] ? { component: r[2] as string } : {}),
              ...(r[3] ? { system: r[3] as string } : {}),
            },
          }
        : {}),
    }))
    .map((m) => ({ ...m, vocabulary: "loinc" as const })) as CodeMatch[];
}
