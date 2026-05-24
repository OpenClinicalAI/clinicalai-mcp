/**
 * Evidence-domain framework. Re-exports the cross-cutting handler infrastructure
 * from `@openclinicalai/shared` and adds the citation builders for PubMed,
 * ClinicalTrials.gov, and USPSTF.
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

/** Build a citation for a PubMed article. */
export function pubmedSource(pmid: string, title?: string): Source {
  return makeSource({
    title: title ? `PubMed: ${title} (PMID ${pmid})` : `PubMed PMID ${pmid}`,
    url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`,
    identifier: pmid,
    identifier_type: "pmid",
    publisher: PUBLISHERS.NIH,
    retrieved_at: NOW(),
  });
}

/** Build a citation for a ClinicalTrials.gov record. */
export function clinicalTrialsSource(nctId: string, title?: string): Source {
  return makeSource({
    title: title ? `ClinicalTrials.gov: ${title} (${nctId})` : `ClinicalTrials.gov ${nctId}`,
    url: `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`,
    identifier: nctId,
    identifier_type: "nct",
    publisher: PUBLISHERS.CLINICALTRIALS,
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
