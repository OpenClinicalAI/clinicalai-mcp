/**
 * @openclinicalai/evidence — public API.
 *
 * PubMed (eutils) + ClinicalTrials.gov wrappers, composites, and USPSTF
 * preventive-care recommendations (ARCHITECTURE.md §5.2). USPSTF lives here
 * because its recommendations are evidence-derived clinical guidelines, not
 * a code vocabulary.
 *
 * The server is launched via the `clinicalai-mcp-evidence` bin (`cli.ts`).
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
export {
  AHRQ_LICENSE_WARNING,
  getRecommendation,
  listByGrade,
  loadSnapshot,
  searchSnapshot,
  snapshotProvenanceWarning,
} from "./clients/uspstf.js";
export {
  atomicEvidenceTools,
  compositeEvidenceTools,
  evidenceTools,
  uspstfTools,
} from "./registry.js";
export type {
  Article,
  ArticleSummary,
  EvidenceSummary,
  PublicationType,
  Recommendation,
  RecommendationSummary,
  Trial,
  TrialPhase,
  TrialStatus,
  TrialSummary,
  TreatmentComparison,
  UspstfGrade,
  UspstfSnapshot,
} from "./types.js";
