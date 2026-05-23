/**
 * Runtime helpers for building `ToolResult`s and raising structured errors.
 */

import type {
  CacheInfo,
  DataTier,
  ErrorCode,
  PhiMode,
  PhiRedactionReport,
  SchemaVersion,
  Source,
  ToolError,
  ToolResult,
} from "./types.js";

/** The contract version this build emits. */
export const SCHEMA_VERSION: SchemaVersion = "1";

/** Current time as an ISO 8601 UTC string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * An error carrying a structured `ToolError` payload. The server scaffold
 * converts a thrown `ClinicalMcpError` into an MCP tool error (§3.3).
 */
export class ClinicalMcpError extends Error {
  readonly payload: ToolError;

  constructor(payload: ToolError) {
    super(payload.message);
    this.name = "ClinicalMcpError";
    this.payload = payload;
  }

  /** Convenience constructor; `retryable` defaults sensibly per code. */
  static of(
    code: ErrorCode,
    message: string,
    extra?: Partial<Omit<ToolError, "code" | "message">>,
  ): ClinicalMcpError {
    const retryableByDefault: ErrorCode[] = ["RATE_LIMITED", "UPSTREAM_UNAVAILABLE"];
    return new ClinicalMcpError({
      code,
      message,
      retryable: extra?.retryable ?? retryableByDefault.includes(code),
      ...(extra?.upstream ? { upstream: extra.upstream } : {}),
      ...(extra?.suggestion ? { suggestion: extra.suggestion } : {}),
    });
  }
}

/** Inputs to {@link makeResult}; everything except `data` and `sources` has a default. */
export interface MakeResultInput<T> {
  data: T;
  sources: Source[];
  tier?: DataTier;
  cache?: CacheInfo;
  phi_mode?: PhiMode;
  phi_redaction_applied?: PhiRedactionReport;
  verbose?: unknown;
  warnings?: string[];
  retrieved_at?: string;
}

/**
 * Build a spec-compliant `ToolResult`. Centralizes the defaults so every tool
 * emits an identical envelope (§3.1).
 */
export function makeResult<T>(input: MakeResultInput<T>): ToolResult<T> {
  const result: ToolResult<T> = {
    schema_version: SCHEMA_VERSION,
    data: input.data,
    sources: input.sources,
    tier: input.tier ?? "free",
    retrieved_at: input.retrieved_at ?? nowIso(),
    cache: input.cache ?? { hit: false, age_s: 0 },
    phi_mode: input.phi_mode ?? "safe",
  };
  if (input.phi_redaction_applied) result.phi_redaction_applied = input.phi_redaction_applied;
  // The raw upstream echo is stripped in `sensitive` mode (§3.5.2).
  if (input.verbose !== undefined && result.phi_mode === "safe") result.verbose = input.verbose;
  if (input.warnings && input.warnings.length > 0) result.warnings = input.warnings;
  return result;
}
