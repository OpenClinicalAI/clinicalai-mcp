/**
 * @clinical-mcp/terminologies — public API.
 *
 * ICD-10-CM + LOINC (NLM Clinical Tables, free), USPSTF (bundled snapshot),
 * and SNOMED CT / UMLS slots (licensed, planned for milestone 7).
 * Server is launched via the `clinical-mcp-terminologies` bin (`cli.ts`).
 */

export {
  searchIcd10,
  searchIcd10ByCode,
  searchLoinc,
  searchLoincByCode,
} from "./clients/clinical-tables.js";
export {
  AHRQ_LICENSE_WARNING,
  getRecommendation,
  listByGrade,
  loadSnapshot,
  searchSnapshot,
  snapshotProvenanceWarning,
} from "./clients/uspstf.js";
export {
  compositeTerminologyTools,
  icd10LoincTools,
  snomedUmlsTools,
  terminologyTools,
  uspstfTools,
} from "./registry.js";
export type {
  CodeMatch,
  CodeRecord,
  CodeWorkup,
  ConceptMap,
  Recommendation,
  RecommendationSummary,
  UspstfGrade,
  UspstfSnapshot,
} from "./types.js";
