/**
 * @openclinicalai/terminologies — public API.
 *
 * ICD-10-CM + LOINC (NLM Clinical Tables, free) and SNOMED CT / UMLS slots
 * (licensed, planned for milestone 7).
 *
 * USPSTF used to live here too but moved to @openclinicalai/evidence in v0.1
 * since its recommendations are evidence-derived guidelines, not codes.
 *
 * Server is launched via the `clinicalai-mcp-terminologies` bin (`cli.ts`).
 */

export {
  searchIcd10,
  searchIcd10ByCode,
  searchLoinc,
  searchLoincByCode,
} from "./clients/clinical-tables.js";
export {
  compositeTerminologyTools,
  icd10LoincTools,
  snomedUmlsTools,
  terminologyTools,
} from "./registry.js";
export type { CodeMatch, CodeRecord, CodeWorkup, ConceptMap } from "./types.js";
