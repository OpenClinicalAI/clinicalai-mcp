/**
 * Domain shapes for `@clinical-mcp/evidence` (ARCHITECTURE.md §5.2).
 */

/** Flat citation summary for a PubMed article. */
export interface ArticleSummary {
  pmid: string;
  title: string;
  authors?: string[];
  journal?: string;
  pub_date?: string;
  publication_types?: string[];
  doi?: string;
}

/** Full article: summary fields plus abstract and MeSH terms. */
export interface Article extends ArticleSummary {
  abstract?: string;
  mesh_terms?: string[];
}

/** Publication-type filter values accepted on search inputs. */
export type PublicationType =
  | "rct"
  | "systematic-review"
  | "meta-analysis"
  | "review"
  | "case-report"
  | "guideline"
  | "clinical-trial"
  | "observational";

/** Flat trial summary for ClinicalTrials.gov records. */
export interface TrialSummary {
  nct_id: string;
  brief_title: string;
  overall_status?: string;
  conditions?: string[];
  phases?: string[];
  start_date?: string;
  completion_date?: string;
  sponsor?: string;
}

/** Full trial record. */
export interface Trial extends TrialSummary {
  brief_summary?: string;
  detailed_description?: string;
  eligibility_criteria?: string;
  minimum_age?: string;
  maximum_age?: string;
  sex?: string;
  interventions?: { type: string; name: string }[];
  locations?: { facility?: string; city?: string; country?: string }[];
}

/** Trial-status filter values. */
export type TrialStatus =
  | "recruiting"
  | "not-yet-recruiting"
  | "enrolling-by-invitation"
  | "active-not-recruiting"
  | "completed"
  | "suspended"
  | "terminated"
  | "withdrawn";

/** Trial phases. */
export type TrialPhase = "phase1" | "phase2" | "phase3" | "phase4" | "early-phase1" | "n-a";

/** Composite-tool output: best-available evidence for a clinical question. */
export interface EvidenceSummary {
  question: string;
  /** Coarse grade derived from the strongest study design surfaced. */
  evidence_grade: "high" | "moderate" | "low" | "insufficient";
  systematic_reviews: ArticleSummary[];
  key_trials: ArticleSummary[];
  recruiting_trials: TrialSummary[];
  total_evidence_items: number;
}

/** Composite-tool output: comparative-effectiveness evidence between two treatments. */
export interface TreatmentComparison {
  treatment_a: string;
  treatment_b: string;
  condition: string;
  systematic_reviews: ArticleSummary[];
  comparative_articles: ArticleSummary[];
  head_to_head_count: number;
}
