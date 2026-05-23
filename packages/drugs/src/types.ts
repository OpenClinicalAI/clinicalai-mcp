/**
 * Domain shapes for `@clinical-mcp/drugs` (ARCHITECTURE.md §5.1).
 *
 * Every tool returns one of these via the shared `ToolResult<T>` envelope.
 * Fields are flat, extracted, and citation-ready (§3.5 priority 5); raw upstream
 * blobs are reachable via `verbose: true`.
 */

/** A condensed drug concept returned by `search_drugs`. */
export interface DrugSummary {
  rxcui: string;
  name: string;
  /** RxNorm term type, e.g. "IN" (ingredient), "BN" (brand name), "SCD" (clinical drug). */
  tty?: string;
  synonym?: string;
  /** Common brand names cross-referenced by RxNorm. */
  brand_names?: string[];
}

/** A full drug record fetched by RxCUI. */
export interface DrugRecord {
  rxcui: string;
  name: string;
  tty?: string;
  synonym?: string;
  /** Cross-vocabulary relationships (where available on the free tier). */
  ingredients?: { rxcui: string; name: string }[];
  brand_names?: { rxcui: string; name: string }[];
  clinical_drugs?: { rxcui: string; name: string }[];
}

/** Selected sections of an FDA Structured Product Label. Each is an array of paragraphs. */
export interface StructuredProductLabel {
  set_id?: string;
  brand_name?: string;
  generic_name?: string;
  manufacturer?: string;
  rxcui?: string[];
  sections: {
    boxed_warning?: string[];
    indications_and_usage?: string[];
    dosage_and_administration?: string[];
    contraindications?: string[];
    warnings_and_precautions?: string[];
    adverse_reactions?: string[];
    drug_interactions?: string[];
    use_in_specific_populations?: string[];
    pediatric_use?: string[];
    geriatric_use?: string[];
    pregnancy?: string[];
    lactation?: string[];
    overdosage?: string[];
    clinical_pharmacology?: string[];
  };
}

/** Aggregated adverse-event report counts from FAERS. */
export interface AdverseEventSummary {
  rxcui: string;
  total_reports?: number;
  /** Top MedDRA preferred terms by report count. */
  top_reactions: { reaction: string; count: number }[];
  time_range?: { since?: string; until?: string };
}

/** A single drug-recall record from openFDA enforcement reports. */
export interface RecallSummary {
  recall_number?: string;
  /** "Class I" (highest severity) / "Class II" / "Class III". */
  classification?: string;
  status?: string;
  reason_for_recall?: string;
  recalling_firm?: string;
  product_description?: string;
  recall_initiation_date?: string;
  distribution_pattern?: string;
}

/** A drug-drug interaction. Severity is provider-defined on the licensed tier. */
export interface DrugInteraction {
  drugs: { rxcui: string; name?: string }[];
  severity?: string;
  description: string;
  mechanism?: string;
  management?: string;
}

/**
 * FDA label "Drug Interactions" prose for a single queried RxCUI. Free-tier
 * fallback when no licensed DDI source is configured — not pairwise.
 */
export interface LabelInteractionsEntry {
  rxcui: string;
  name?: string;
  /** Paragraphs from the label's `drug_interactions` section. */
  drug_interactions?: string[];
  /** Why the entry has no `drug_interactions` (no label found, no DDI section, etc.). */
  note?: string;
}

/** Tier-aware DDI report. */
export interface InteractionReport {
  queried_rxcuis: string[];
  /**
   * Structured pairwise interactions. Populated only when a licensed DDI
   * source (DrugBank / Lexicomp / Micromedex) is configured.
   */
  interactions: DrugInteraction[];
  source: string;
  /**
   * Free-tier fallback: FDA label "Drug Interactions" prose for each queried
   * RxCUI. Prose, not pairwise — agents must read across entries themselves.
   * Present on the free tier; omitted on the licensed tier where `interactions`
   * carries the answer directly.
   */
  label_interactions?: LabelInteractionsEntry[];
}

/** Fan-out: identity + label + adverse events + recalls + interactions. */
export interface DrugFullProfile {
  record: DrugRecord;
  label?: StructuredProductLabel;
  adverse_events?: AdverseEventSummary;
  active_recalls: RecallSummary[];
  interactions: InteractionReport;
}

/** Pulled-together safety surface from label sections plus active recalls. */
export interface SafetySummary {
  rxcui: string;
  boxed_warning?: string[];
  contraindications?: string[];
  warnings_and_precautions?: string[];
  adverse_reactions?: string[];
  pregnancy?: string[];
  lactation?: string[];
  pediatric_use?: string[];
  geriatric_use?: string[];
  active_recalls: RecallSummary[];
}

/** Renal/hepatic dose-adjustment guidance extracted from label prose. */
export interface DoseAdjustmentReport {
  rxcui: string;
  /** Patient parameter the report was prepared for. */
  parameter: { name: string; value: number; unit: string };
  /** Coarse band derived from the parameter (e.g. CKD G3a). */
  band: string;
  /** Relevant FDA label excerpts (free-tier guidance is prose, not structured tables). */
  label_excerpts: {
    dosage_and_administration?: string[];
    use_in_specific_populations?: string[];
  };
}
