/**
 * Domain shapes for `@openclinicalai/terminologies` (ARCHITECTURE.md §5.4).
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
