/**
 * Deployment-policy loader, resolver, and fail-loud validator (ARCHITECTURE.md §3.5.3).
 *
 * The policy is read once at startup and immutable for the process lifetime.
 * Bad combinations cause the server to refuse to start with a clear error
 * pointing at the offending field — no partial start, no degraded mode.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { DeploymentType, RedactionConfig } from "../types.js";
import { PRESETS, PRESET_NAMES } from "./presets.js";
import { type PolicyFile, policyFileSchema } from "./schema.js";

/** The fully-resolved, validated policy state for the process lifetime. */
export interface ResolvedPolicy {
  deployment_type: DeploymentType;
  cache: {
    persist_sensitive_inputs: boolean;
    encrypted_at_rest: boolean;
  };
  logging: {
    audit_sink: string | null;
    payload_redaction: boolean;
    phi_pattern_warnings: boolean;
  };
  upstream_egress: {
    /** Universal floor — always "deny". */
    phi_policy: "deny";
  };
  phi_redaction: RedactionConfig;
  /**
   * SHA-256 of the resolved policy state, for compliance verification.
   * Computed after env-var resolution: it contains env var *names*, never
   * secret values, but does capture the resolved policy posture.
   */
  policy_hash: string;
}

/** Result of {@link loadPolicy}: the policy plus any non-fatal warnings. */
export interface LoadedPolicy {
  policy: ResolvedPolicy;
  warnings: string[];
  /** Human-readable description of where the policy came from. */
  source: string;
}

/**
 * Thrown when policy validation fails. The server scaffold catches this,
 * prints it, and exits non-zero so orchestration treats it as a deploy failure.
 */
export class PolicyValidationError extends Error {
  /** The policy section that failed, e.g. "logging". */
  readonly section: string;
  /** The field or env var to fix. */
  readonly field: string;

  constructor(section: string, field: string, message: string) {
    super(`[policy.${section}] ${message} (fix: ${field})`);
    this.name = "PolicyValidationError";
    this.section = section;
    this.field = field;
  }
}

/* -------------------------------------------------------------------------- */

/** Apply deployment-type-specific defaults to a parsed policy file. */
function applyDefaults(file: PolicyFile): Omit<ResolvedPolicy, "policy_hash"> {
  const dt = file.deployment_type;
  const isCoveredEntity = dt === "covered_entity";

  return {
    deployment_type: dt,
    cache: {
      persist_sensitive_inputs: file.cache?.persist_sensitive_inputs ?? isCoveredEntity,
      encrypted_at_rest: file.cache?.encrypted_at_rest ?? isCoveredEntity,
    },
    logging: {
      audit_sink: file.logging?.audit_sink ?? null,
      payload_redaction: file.logging?.payload_redaction ?? !isCoveredEntity,
      // Soft `safe`-mode nudges: on only for `personal`.
      phi_pattern_warnings: file.logging?.phi_pattern_warnings ?? dt === "personal",
    },
    upstream_egress: {
      // Resolved below in validation; the cast is checked there.
      phi_policy: (file.upstream_egress?.phi_policy ?? "deny") as "deny",
    },
    phi_redaction: file.phi_redaction ?? { backend: "regex" },
  };
}

/** Env vars a redaction config requires to resolve at startup. */
function redactionEnvRefs(cfg: RedactionConfig): string[] {
  const refs: string[] = [];
  if (cfg.presidio?.api_key_env) refs.push(cfg.presidio.api_key_env);
  if (cfg.openmed?.api_key_env) refs.push(cfg.openmed.api_key_env);
  if (cfg.foundation?.api_key_env) refs.push(cfg.foundation.api_key_env);
  return refs;
}

/**
 * Enforce the cross-field invariants (§3.5.3). Throws `PolicyValidationError`
 * on the first hard violation; returns soft warnings otherwise.
 */
function validateResolved(
  p: Omit<ResolvedPolicy, "policy_hash">,
  env: NodeJS.ProcessEnv,
): string[] {
  const warnings: string[] = [];

  // Rule: upstream egress is the universal floor — must be "deny".
  if ((p.upstream_egress.phi_policy as string) !== "deny") {
    throw new PolicyValidationError(
      "upstream_egress",
      "upstream_egress.phi_policy",
      `phi_policy must be "deny" (the universal PHI floor is not user-overridable); got "${p.upstream_egress.phi_policy}"`,
    );
  }

  // Rule: a covered-entity deployment must have an audit sink.
  if (p.deployment_type === "covered_entity" && !p.logging.audit_sink) {
    throw new PolicyValidationError(
      "logging",
      "logging.audit_sink",
      "deployment_type is covered_entity but logging.audit_sink is null — a covered-entity deployment without an audit sink is a misconfiguration",
    );
  }

  // Rule: persisting sensitive inputs requires encryption-at-rest + a key.
  if (p.cache.persist_sensitive_inputs) {
    if (!p.cache.encrypted_at_rest) {
      throw new PolicyValidationError(
        "cache",
        "cache.encrypted_at_rest",
        "cache.persist_sensitive_inputs is true, so cache.encrypted_at_rest must also be true",
      );
    }
    if (!env.CLINICAL_CACHE_ENCRYPTION_KEY) {
      throw new PolicyValidationError(
        "cache",
        "CLINICAL_CACHE_ENCRYPTION_KEY",
        "cache.persist_sensitive_inputs is true, so the CLINICAL_CACHE_ENCRYPTION_KEY env var must be set",
      );
    }
  }

  // Rule: every env var the policy references must resolve at startup.
  for (const ref of redactionEnvRefs(p.phi_redaction)) {
    if (!env[ref]) {
      throw new PolicyValidationError(
        "phi_redaction",
        ref,
        `phi_redaction references env var ${ref}, but it is not set`,
      );
    }
  }

  // Soft: de-identified data shouldn't need a foundation-model redactor.
  if (p.deployment_type === "research_deid" && p.phi_redaction.backend === "foundation") {
    warnings.push(
      "policy: deployment_type is research_deid with a foundation redaction backend — de-identified data should not need redaction, but this is not an error.",
    );
  }

  return warnings;
}

/** Stable JSON (sorted keys) so the hash is deterministic. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const body = Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function computePolicyHash(p: Omit<ResolvedPolicy, "policy_hash">): string {
  return createHash("sha256").update(stableStringify(p)).digest("hex");
}

/**
 * Resolve and validate an already-parsed policy file into a `LoadedPolicy`.
 * Exported so tests can exercise validation without touching the filesystem.
 */
export function resolvePolicy(
  file: PolicyFile,
  env: NodeJS.ProcessEnv = process.env,
  source = "in-memory policy",
): LoadedPolicy {
  const resolved = applyDefaults(file);
  const warnings = validateResolved(resolved, env);
  const policy: ResolvedPolicy = { ...resolved, policy_hash: computePolicyHash(resolved) };
  return { policy, warnings, source };
}

/** Format a Zod parse failure into a single readable line. */
function formatZodIssues(error: {
  issues: { path: (string | number)[]; message: string }[];
}): string {
  return error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

/**
 * Load the deployment policy from the environment.
 *
 * Precedence: `CLINICAL_MCP_POLICY_FILE` (YAML path) → `CLINICAL_MCP_POLICY`
 * (preset name) → the `personal` preset (default).
 *
 * Throws `PolicyValidationError` (or a plain `Error` for unreadable/invalid
 * files) — callers are expected to print and exit non-zero.
 */
export function loadPolicy(env: NodeJS.ProcessEnv = process.env): LoadedPolicy {
  const filePath = env.CLINICAL_MCP_POLICY_FILE;
  const presetName = env.CLINICAL_MCP_POLICY;

  let rawFile: unknown;
  let source: string;

  if (filePath) {
    let text: string;
    try {
      text = readFileSync(filePath, "utf8");
    } catch (err) {
      throw new Error(
        `Could not read CLINICAL_MCP_POLICY_FILE at "${filePath}": ${(err as Error).message}`,
      );
    }
    try {
      rawFile = parseYaml(text);
    } catch (err) {
      throw new Error(
        `CLINICAL_MCP_POLICY_FILE at "${filePath}" is not valid YAML: ${(err as Error).message}`,
      );
    }
    source = `policy file: ${filePath}`;
  } else if (presetName) {
    if (!PRESET_NAMES.includes(presetName as DeploymentType)) {
      throw new Error(
        `CLINICAL_MCP_POLICY="${presetName}" is not a known preset. Expected one of: ${PRESET_NAMES.join(", ")}.`,
      );
    }
    rawFile = PRESETS[presetName as DeploymentType];
    source = `preset: ${presetName}`;
  } else {
    rawFile = PRESETS.personal;
    source = "default preset: personal";
  }

  const parsed = policyFileSchema.safeParse(rawFile);
  if (!parsed.success) {
    throw new Error(`Invalid deployment policy (${source}):\n${formatZodIssues(parsed.error)}`);
  }

  return resolvePolicy(parsed.data, env, source);
}
