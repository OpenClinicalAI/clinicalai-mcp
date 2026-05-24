/**
 * @openclinicalai/drugs — public API.
 *
 * Free-tier wrappers over openFDA, RxNorm, and DailyMed (ARCHITECTURE.md §5.1).
 * The server is launched via the `clinicalai-mcp-drugs` bin (`cli.ts`).
 */

export {
  fetchAdverseEventCounts,
  fetchEnforcement,
  fetchLabelByRxcui,
  fetchLabelBySetId,
  type OpenFdaEnforcement,
  type OpenFdaLabel,
} from "./clients/openfda.js";
export { fetchSplsByName, fetchSplsByRxcui } from "./clients/dailymed.js";
export {
  getRelatedConcepts,
  getRxNormProperties,
  type RxConceptProperty,
  searchDrugs,
} from "./clients/rxnorm.js";
export { openFdaToSpl } from "./labels.js";
export { atomicDrugTools, compositeDrugTools, drugTools } from "./registry.js";
export type {
  AdverseEventSummary,
  DoseAdjustmentReport,
  DrugFullProfile,
  DrugInteraction,
  DrugRecord,
  DrugSummary,
  InteractionReport,
  RecallSummary,
  SafetySummary,
  StructuredProductLabel,
} from "./types.js";
