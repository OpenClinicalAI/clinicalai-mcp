/**
 * Core cross-cutting types for the clinical-mcp suite.
 *
 * Every tool in every server returns a `ToolResult<T>`. These types are the
 * public contract — breaking changes here are major version bumps across all
 * packages simultaneously (ARCHITECTURE.md §7). See §3.1–§3.3.
 */

/** Negotiation point for future contract changes. */
export type SchemaVersion = "1";

/** Which data source backed an answer. See ARCHITECTURE.md §3.4. */
export type DataTier =
  | "free"
  | "licensed-drugbank"
  | "licensed-lexicomp"
  | "licensed-micromedex"
  | "licensed-umls"
  | "compute";

/** Per-call PHI declaration. See ARCHITECTURE.md §3.5.2. */
export type PhiMode = "safe" | "sensitive";

/** Cache behavior hint a caller may pass on any tool. See ARCHITECTURE.md §4.3. */
export type CacheHint = "default" | "fresh" | "only";

/** Deployment-policy posture chosen at server startup. See ARCHITECTURE.md §3.5.3. */
export type DeploymentType = "personal" | "covered_entity" | "research_deid";

/** Categories of PHI the redaction layer recognizes. See ARCHITECTURE.md §3.1. */
export type PhiCategory =
  | "name"
  | "mrn"
  | "date"
  | "address"
  | "phone"
  | "email"
  | "ssn"
  | "insurance_id";

/** A single citation. The first entry in `ToolResult.sources` is the primary source. */
export interface Source {
  /** Human-readable title. */
  title: string;
  /** Stable, linkable URL that resolves to the underlying record. */
  url: string;
  /** PMID, NCT ID, RxCUI, SetID, ICD-10 code, etc. */
  identifier?: string;
  /** "pmid" | "nct" | "rxcui" | "setid" | "icd10" | ... */
  identifier_type?: string;
  /** "NLM" | "FDA" | "ClinicalTrials.gov" | ... */
  publisher?: string;
  /** ISO 8601 UTC. */
  retrieved_at: string;
}

/** Present on a result when `sensitive` mode redacted upstream-bound text. */
export interface PhiRedactionReport {
  applied: true;
  /** Which categories fired. */
  categories: PhiCategory[];
  /** Total redactions across all string inputs. */
  count: number;
}

/** Cache provenance, echoed on every result. */
export interface CacheInfo {
  hit: boolean;
  age_s: number;
}

/**
 * The shape every tool returns. The agent and downstream auditors can always
 * answer "where did this come from, when, and at what data quality."
 */
export interface ToolResult<T> {
  /** Always "1" for this contract version. */
  schema_version: SchemaVersion;
  /** The flat, extracted answer. */
  data: T;
  /** 1..N citations; never empty for clinical claims. */
  sources: Source[];
  /** Which source tier backed this answer. */
  tier: DataTier;
  /** ISO 8601 UTC. */
  retrieved_at: string;
  cache: CacheInfo;
  /** Echoed back so callers can audit. */
  phi_mode: PhiMode;
  /** Present when `sensitive` mode redacted upstream-bound text. */
  phi_redaction_applied?: PhiRedactionReport;
  /** Raw upstream payload; only present when `verbose: true` and mode is `safe`. */
  verbose?: unknown;
  /** Soft signals: data freshness, license suggestions, etc. */
  warnings?: string[];
}

/** Optional cross-cutting params accepted by every tool input schema. */
export interface CrossCuttingInputs {
  /** Default false. */
  verbose?: boolean;
  /** Default "safe" (can be elevated process-wide by deployment policy). */
  phi_mode?: PhiMode;
  /** Default "default". */
  cache?: CacheHint;
}

/** Structured error codes. See ARCHITECTURE.md §3.3. */
export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "LICENSE_REQUIRED"
  | "CACHE_MISS_REQUIRED_HIT"
  | "INTERNAL";

/** Structured payload carried by every tool error. */
export interface ToolError {
  code: ErrorCode;
  /** Human-readable, safe to surface to the user. */
  message: string;
  retryable: boolean;
  /** Present when the failure originated from a 3rd-party API. */
  upstream?: {
    service: string;
    status?: number;
    request_id?: string;
  };
  /** Actionable hint, e.g. which env var to set. */
  suggestion?: string;
}

/* --------------------------------------------------------------------------
 * PHI redaction types. See ARCHITECTURE.md §3.5.4.
 * ------------------------------------------------------------------------ */

/** A redacted span within a piece of text. */
export interface RedactionSpan {
  /** Inclusive start offset into the original text. */
  start: number;
  /** Exclusive end offset into the original text. */
  end: number;
  category: PhiCategory;
  /** Original text of the span. Omitted from `safe`-mode-facing outputs. */
  text?: string;
}

/** Selectable redaction strategies. Only `regex` is implemented in v0.1 milestone 1. */
export type RedactionBackend =
  | "regex"
  | "presidio"
  | "openmed"
  | "foundation"
  | "ensemble"
  | "custom";

export interface RedactionConfig {
  backend: RedactionBackend;
  /**
   * Free-text audit field — for `covered_entity` deployments using a cloud
   * foundation backend, the BAA / ZDR reference (contract ID, execution
   * date, compliance ticket). Records who signed off on cloud-PHI
   * disclosure for this deployment.
   */
  compliance_attested_by?: string;
  regex?: { categories?: PhiCategory[] };
  presidio?: { url: string; api_key_env?: string };
  openmed?: { url: string; api_key_env?: string };
  foundation?: {
    provider: "anthropic" | "openai" | "local";
    model: string;
    /** Env var holding the provider API key. Optional for `local` (Ollama needs none). */
    api_key_env?: string;
    /** Override the provider base URL. Required for `local`; optional for `openai`/`anthropic`. */
    base_url?: string;
    prompt_template: "safe_harbor_verbatim" | "custom";
    custom_prompt_path?: string;
  };
  ensemble?: { backends: RedactionBackend[]; mode: "union" | "intersection" };
  custom?: { module_path: string };
}
