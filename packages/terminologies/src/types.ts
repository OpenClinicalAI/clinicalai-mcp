/**
 * Domain shapes for `@clinical-mcp/terminologies` (ARCHITECTURE.md §5.4).
 */

/** A code lookup match — code + display name + the vocabulary it came from. */
export interface CodeMatch {
  code: string;
  name: string;
  vocabulary: "icd10cm" | "loinc" | "snomedct";
  /** Optional extra display fields (e.g. LOINC component / system). */
  extra?: Record<string, string>;
}

/** A single code record. */
export interface CodeRecord extends CodeMatch {
  /** Free-text definition or synonyms, where the source provides them. */
  definition?: string;
  synonyms?: string[];
}

/** USPSTF preventive-care recommendation grade. */
export type UspstfGrade = "A" | "B" | "C" | "D" | "I";

/** A USPSTF recommendation in summary form (list endpoints). */
export interface RecommendationSummary {
  id: string;
  title: string;
  topic: string;
  grade: UspstfGrade;
  population?: string;
  topic_url?: string;
  date_issued?: string;
}

/** A full USPSTF recommendation. */
export interface Recommendation extends RecommendationSummary {
  specific_recommendation: string;
}

/** Snapshot wrapper for the bundled USPSTF JSON. */
export interface UspstfSnapshot {
  snapshot_version: string;
  snapshot_date: string;
  source: string;
  source_url?: string;
  license_notice?: string;
  recommendations: Recommendation[];
}

/** map_concept_across_vocabs output. */
export interface ConceptMap {
  term: string;
  mappings: {
    icd10cm: CodeMatch[];
    loinc: CodeMatch[];
    snomedct?: CodeMatch[];
  };
}

/** code_workup output: top candidates + a "consider also" set. */
export interface CodeWorkup {
  term: string;
  candidates: CodeMatch[];
  consider_also: CodeMatch[];
}
