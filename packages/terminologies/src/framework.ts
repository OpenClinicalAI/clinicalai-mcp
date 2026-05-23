/**
 * Terminology-domain framework. Re-exports the cross-cutting tool-handler
 * infrastructure from `@clinical-mcp/shared` and adds citation builders for
 * NLM, AHRQ, and (forthcoming) UMLS sources.
 */

import { PUBLISHERS, type Source, makeSource } from "@clinical-mcp/shared";

export {
  crossCuttingShape,
  redactIfSensitive,
  type UpstreamText,
  withCache,
  type WithCacheOptions,
} from "@clinical-mcp/shared";

const NOW = (): string => new Date().toISOString();

/** Build a citation for an NLM Clinical Tables result. */
export function clinicalTablesSource(args: {
  vocabulary: "ICD-10-CM" | "LOINC";
  query?: string;
  code?: string;
}): Source {
  const fragment = args.query
    ? `?terms=${encodeURIComponent(args.query)}`
    : args.code
      ? `?terms=${encodeURIComponent(args.code)}`
      : "";
  const path = args.vocabulary === "ICD-10-CM" ? "icd10cm" : "loinc_items";
  return makeSource({
    title: `NLM Clinical Tables (${args.vocabulary})${args.query ? `: ${args.query}` : args.code ? `: ${args.code}` : ""}`,
    url: `https://clinicaltables.nlm.nih.gov/api/${path}/v3/search${fragment}`,
    publisher: PUBLISHERS.NLM,
    retrieved_at: NOW(),
  });
}

/** Build a citation for a USPSTF recommendation. */
export function uspstfSource(rec: { id: string; title: string; topic_url?: string }): Source {
  return makeSource({
    title: `USPSTF: ${rec.title}`,
    url:
      rec.topic_url ?? "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics",
    identifier: rec.id,
    identifier_type: "uspstf",
    publisher: PUBLISHERS.USPSTF,
    retrieved_at: NOW(),
  });
}
