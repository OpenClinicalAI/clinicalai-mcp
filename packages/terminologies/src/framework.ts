/**
 * Terminology-domain framework. Re-exports the cross-cutting tool-handler
 * infrastructure from `@openclinicalai/shared` and adds citation builders for
 * NLM Clinical Tables and (forthcoming) UMLS sources.
 */

import { PUBLISHERS, type Source, makeSource } from "@openclinicalai/shared";

export {
  crossCuttingShape,
  redactIfSensitive,
  type UpstreamText,
  withCache,
  type WithCacheOptions,
} from "@openclinicalai/shared";

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
