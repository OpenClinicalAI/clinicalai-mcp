/**
 * NCBI eutils client for PubMed (NLM, free).
 *
 * Uses esearch + esummary for metadata and efetch (MEDLINE text) for abstracts.
 * `NCBI_API_KEY` raises the per-IP rate limit from 3 to 10 req/sec; the tier
 * stays "free" either way (ARCHITECTURE.md §3.4).
 */

import { getUpstreamJson, getUpstreamText } from "@clinical-mcp/shared";
import type { Article, ArticleSummary } from "../types.js";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function withApiKey(url: URL, env: NodeJS.ProcessEnv): URL {
  const key = env.NCBI_API_KEY;
  if (key) url.searchParams.set("api_key", key);
  return url;
}

interface EsearchResponse {
  esearchresult?: { count?: string; idlist?: string[] };
}

interface EsummaryAuthor {
  name?: string;
  authtype?: string;
}

interface EsummaryArticleId {
  idtype?: string;
  value?: string;
}

interface EsummaryRecord {
  uid?: string;
  title?: string;
  authors?: EsummaryAuthor[];
  pubdate?: string;
  /** Source journal abbreviation. */
  source?: string;
  articleids?: EsummaryArticleId[];
  pubtype?: string[];
}

interface EsummaryResponse {
  result?: { uids?: string[]; [pmid: string]: EsummaryRecord | string[] | undefined };
}

interface ElinkResponse {
  linksets?: {
    dbfrom?: string;
    ids?: string[];
    linksetdbs?: { linkname?: string; links?: string[] }[];
  }[];
}

/* -------------------------------------------------------------------------- */
/* esearch + esummary                                                          */
/* -------------------------------------------------------------------------- */

/** Run a PubMed search and return the matched PMIDs (most recent first). */
export async function esearch(
  term: string,
  opts: { retmax?: number },
  env: NodeJS.ProcessEnv,
): Promise<string[]> {
  const url = withApiKey(new URL(`${EUTILS_BASE}/esearch.fcgi`), env);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", term);
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retmax", String(opts.retmax ?? 25));
  url.searchParams.set("sort", "relevance");
  const json = await getUpstreamJson<EsearchResponse>({
    service: "pubmed",
    url: url.toString(),
  });
  return json.esearchresult?.idlist ?? [];
}

function articleSummaryFromEsummary(record: EsummaryRecord): ArticleSummary | null {
  const pmid = record.uid;
  if (!pmid || !record.title) return null;
  const doi = record.articleids?.find((a) => a.idtype === "doi")?.value;
  return {
    pmid,
    title: record.title,
    ...(record.authors?.length
      ? { authors: record.authors.map((a) => a.name ?? "").filter(Boolean) }
      : {}),
    ...(record.source ? { journal: record.source } : {}),
    ...(record.pubdate ? { pub_date: record.pubdate } : {}),
    ...(record.pubtype?.length ? { publication_types: record.pubtype } : {}),
    ...(doi ? { doi } : {}),
  };
}

/** Fetch metadata summaries for one or more PMIDs. */
export async function esummary(pmids: string[], env: NodeJS.ProcessEnv): Promise<ArticleSummary[]> {
  if (pmids.length === 0) return [];
  const url = withApiKey(new URL(`${EUTILS_BASE}/esummary.fcgi`), env);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("retmode", "json");
  const json = await getUpstreamJson<EsummaryResponse>({
    service: "pubmed",
    url: url.toString(),
  });
  const uids = json.result?.uids ?? pmids;
  const out: ArticleSummary[] = [];
  for (const uid of uids) {
    const raw = json.result?.[uid];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const record = raw as EsummaryRecord;
      const summary = articleSummaryFromEsummary({ ...record, uid });
      if (summary) out.push(summary);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* efetch + MEDLINE parsing                                                    */
/* -------------------------------------------------------------------------- */

/** Parse MEDLINE-formatted text into a tag→values map. */
export function parseMedline(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let currentTag: string | null = null;
  let currentVal = "";

  const push = () => {
    if (currentTag !== null) {
      const list = out.get(currentTag) ?? [];
      list.push(currentVal.trim());
      out.set(currentTag, list);
    }
  };

  for (const line of text.split(/\r?\n/)) {
    // Tag lines: 4-char tag (padded), then "- ", then value.
    const match = /^([A-Z][A-Z0-9 ]{3})- (.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) {
      push();
      currentTag = match[1].trim();
      currentVal = match[2];
      continue;
    }
    // Continuation lines begin with whitespace.
    if (currentTag !== null && /^\s{2,}\S/.test(line)) {
      currentVal += ` ${line.trim()}`;
      continue;
    }
    if (line.trim() === "") {
      push();
      currentTag = null;
      currentVal = "";
    }
  }
  push();
  return out;
}

/** Build an `Article` from a parsed MEDLINE tag map. */
export function articleFromMedline(map: Map<string, string[]>): Article | null {
  const pmid = map.get("PMID")?.[0];
  const title = map.get("TI")?.[0];
  if (!pmid || !title) return null;
  const abstract = map.get("AB")?.join(" ");
  const authors = map.get("FAU") ?? map.get("AU");
  const journal = map.get("JT")?.[0] ?? map.get("TA")?.[0];
  const pubDate = map.get("DP")?.[0];
  const doi = map
    .get("AID")
    ?.find((v) => v.endsWith("[doi]"))
    ?.replace(/\s*\[doi\]$/, "");
  const pubTypes = map.get("PT");
  const mesh = map.get("MH");
  return {
    pmid,
    title,
    ...(abstract ? { abstract } : {}),
    ...(authors?.length ? { authors } : {}),
    ...(journal ? { journal } : {}),
    ...(pubDate ? { pub_date: pubDate } : {}),
    ...(doi ? { doi } : {}),
    ...(pubTypes?.length ? { publication_types: pubTypes } : {}),
    ...(mesh?.length ? { mesh_terms: mesh } : {}),
  };
}

/** Fetch a single article (with abstract) by PMID. */
export async function efetchArticle(pmid: string, env: NodeJS.ProcessEnv): Promise<Article | null> {
  const url = withApiKey(new URL(`${EUTILS_BASE}/efetch.fcgi`), env);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmid);
  url.searchParams.set("rettype", "medline");
  url.searchParams.set("retmode", "text");
  let text: string;
  try {
    text = await getUpstreamText({ service: "pubmed", url: url.toString() });
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
  return articleFromMedline(parseMedline(text));
}

/* -------------------------------------------------------------------------- */
/* elink — related articles                                                    */
/* -------------------------------------------------------------------------- */

/** Find PMIDs of articles similar to the input PMID via PubMed's elink. */
export async function elinkSimilar(pmid: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  const url = withApiKey(new URL(`${EUTILS_BASE}/elink.fcgi`), env);
  url.searchParams.set("dbfrom", "pubmed");
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmid);
  url.searchParams.set("cmd", "neighbor");
  url.searchParams.set("retmode", "json");
  const json = await getUpstreamJson<ElinkResponse>({
    service: "pubmed",
    url: url.toString(),
  });
  const linkset = json.linksets?.[0]?.linksetdbs?.find((d) => d.linkname === "pubmed_pubmed");
  const links = (linkset?.links ?? []).filter((id) => id !== pmid);
  return links;
}

/* -------------------------------------------------------------------------- */
/* Query-building helpers                                                      */
/* -------------------------------------------------------------------------- */

/** Map a user-facing publication-type token to a PubMed `[Publication Type]` filter. */
const PUB_TYPE_MAP: Record<string, string> = {
  rct: "Randomized Controlled Trial",
  "systematic-review": "Systematic Review",
  "meta-analysis": "Meta-Analysis",
  review: "Review",
  "case-report": "Case Reports",
  guideline: "Guideline",
  "clinical-trial": "Clinical Trial",
  observational: "Observational Study",
};

/** Compose a PubMed search term from a base query and structured filters. */
export function buildPubMedTerm(
  base: string,
  filters: {
    publication_types?: string[];
    date_from?: string;
    date_to?: string;
    free_full_text?: boolean;
  } = {},
): string {
  const parts: string[] = [base];
  if (filters.publication_types?.length) {
    const ptParts = filters.publication_types
      .map((t) => PUB_TYPE_MAP[t])
      .filter(Boolean)
      .map((label) => `"${label}"[Publication Type]`);
    if (ptParts.length > 0) parts.push(`(${ptParts.join(" OR ")})`);
  }
  if (filters.date_from || filters.date_to) {
    const from = (filters.date_from ?? "1800/01/01").replace(/-/g, "/");
    const to = (filters.date_to ?? "3000/12/31").replace(/-/g, "/");
    parts.push(`("${from}"[Date - Publication] : "${to}"[Date - Publication])`);
  }
  if (filters.free_full_text) parts.push("free full text[sb]");
  return parts.join(" AND ");
}
