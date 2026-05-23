/**
 * @clinical-mcp/evidence — public API.
 *
 * PubMed (eutils) + ClinicalTrials.gov wrappers and composites (ARCHITECTURE.md §5.2).
 * The server is launched via the `clinical-mcp-evidence` bin (`cli.ts`).
 */

export {
  getTrial,
  searchTrials,
  type CtSearchFilters,
} from "./clients/clinicaltrials.js";
export {
  articleFromMedline,
  buildPubMedTerm,
  efetchArticle,
  elinkSimilar,
  esearch,
  esummary,
  parseMedline,
} from "./clients/pubmed.js";
export { atomicEvidenceTools, compositeEvidenceTools, evidenceTools } from "./registry.js";
export type {
  Article,
  ArticleSummary,
  EvidenceSummary,
  PublicationType,
  Trial,
  TrialPhase,
  TrialStatus,
  TrialSummary,
  TreatmentComparison,
} from "./types.js";
