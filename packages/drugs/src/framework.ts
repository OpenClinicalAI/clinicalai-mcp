/**
 * Drug-domain framework — the cross-cutting tool-handler infrastructure lives
 * in `@openclinicalai/shared` and is re-exported here. This file only adds the
 * citation builders that are specific to the drug data sources.
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

/** Build a citation for an openFDA record. */
export function openFdaSource(args: {
  title: string;
  url: string;
  identifier?: string;
  identifier_type?: string;
}): Source {
  return makeSource({
    title: args.title,
    url: args.url,
    publisher: PUBLISHERS.FDA,
    ...(args.identifier ? { identifier: args.identifier } : {}),
    ...(args.identifier_type ? { identifier_type: args.identifier_type } : {}),
    retrieved_at: NOW(),
  });
}

/** Build a citation for an RxNorm concept. */
export function rxnormSource(rxcui: string, name?: string): Source {
  return makeSource({
    title: name ? `RxNorm concept: ${name} (RxCUI ${rxcui})` : `RxNorm concept RxCUI ${rxcui}`,
    url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${encodeURIComponent(rxcui)}`,
    identifier: rxcui,
    identifier_type: "rxcui",
    publisher: PUBLISHERS.NLM,
    retrieved_at: NOW(),
  });
}

/** Build a citation for a DailyMed Structured Product Label. */
export function dailyMedSource(setid: string, title?: string): Source {
  return makeSource({
    title: title ? `DailyMed SPL: ${title}` : `DailyMed SPL ${setid}`,
    url: `https://dailymed.nlm.nih.gov/dailymed/druginfo.cfm?setid=${encodeURIComponent(setid)}`,
    identifier: setid,
    identifier_type: "setid",
    publisher: PUBLISHERS.NLM,
    retrieved_at: NOW(),
  });
}
