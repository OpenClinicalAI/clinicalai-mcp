/**
 * The five shared meta tools mounted on every server (ARCHITECTURE.md §5.0):
 *   - describe_capabilities      — server name/version, active licenses, tool list
 *   - describe_policy            — the active deployment policy + its SHA-256 hash
 *   - redact_phi                 — explicit PHI redaction, so an agent can pre-redact
 *   - compare_redaction_backends — run several backends side-by-side on sample text
 *   - evaluate_redaction         — score a backend against a labeled ground truth
 *
 * `compare_redaction_backends` and `evaluate_redaction` exist so users can
 * empirically select the right backend for their content rather than guess
 * (§3.5.4) — off-the-shelf redactors fail to generalize, so the selection must
 * be data-driven.
 */

import { z } from "zod";
import { makeSource } from "./citations.js";
import { evaluateRedaction, redactWithBackend } from "./phi/index.js";
import { phiCategorySchema, redactionBackendSchema } from "./policy/schema.js";
import { ClinicalMcpError, makeResult } from "./results.js";
import type { ServerContext, ToolDef } from "./server.js";
import type { PhiCategory, RedactionConfig, RedactionSpan, ToolResult } from "./types.js";

/** A self-citation for meta tools — they report configuration, not clinical claims. */
function metaSource() {
  return makeSource({
    title: "clinicalai-mcp — ARCHITECTURE.md §5.0 (shared meta tools)",
    url: "https://github.com/OpenClinicalAI/clinicalai-mcp/blob/main/ARCHITECTURE.md",
    publisher: "clinicalai-mcp",
  });
}

const redactPhiShape = {
  text: z.string().describe("The text to redact PHI from."),
  categories: z
    .array(phiCategorySchema)
    .optional()
    .describe("Which PHI categories to redact. Defaults to all categories."),
  backend_override: redactionBackendSchema
    .optional()
    .describe("Override the policy-configured redaction backend for this call."),
} as const;
const redactPhiInput = z.object(redactPhiShape);

const compareShape = {
  text: z.string().describe("Sample text to redact with each backend."),
  backends: z
    .array(redactionBackendSchema)
    .min(1)
    .describe("The redaction backends to run side-by-side."),
} as const;
const compareInput = z.object(compareShape);

const redactionSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  category: phiCategorySchema,
  text: z.string().optional(),
});

const evaluateShape = {
  text: z.string().describe("The text to redact and score."),
  ground_truth_spans: z
    .array(redactionSpanSchema)
    .describe("Hand-labeled PHI spans to score the backend against."),
  backend: redactionBackendSchema.describe("The redaction backend to evaluate."),
} as const;
const evaluateInput = z.object(evaluateShape);

/** Errors from one backend shouldn't fail the whole compare call. */
function errorMessage(err: unknown): string {
  if (err instanceof ClinicalMcpError) return err.payload.message;
  return err instanceof Error ? err.message : String(err);
}

/** Build the five meta tools bound to a server's runtime context. */
export function metaTools(ctx: ServerContext): ToolDef[] {
  const describeCapabilities: ToolDef = {
    name: "describe_capabilities",
    description:
      "Report this server's name, version, the configured license tiers, and the full list of available tools.",
    inputSchema: {},
    handler: (): Promise<ToolResult<unknown>> =>
      Promise.resolve(
        makeResult({
          data: {
            server_name: ctx.serverName,
            server_version: ctx.serverVersion,
            active_licenses: ctx.licenses.activeTiers,
            available_tools: ctx.toolNames,
          },
          sources: [metaSource()],
          tier: "compute",
        }),
      ),
  };

  const describePolicy: ToolDef = {
    name: "describe_policy",
    description:
      "Report the active deployment policy and a SHA-256 hash of the resolved policy state, so a compliance team can verify the running config matches the approved version.",
    inputSchema: {},
    handler: (): Promise<ToolResult<unknown>> =>
      Promise.resolve(
        makeResult({
          data: {
            deployment_type: ctx.policy.deployment_type,
            policy_hash: ctx.policy.policy_hash,
            cache_persists_sensitive_inputs: ctx.policy.cache.persist_sensitive_inputs,
            audit_sink: ctx.policy.logging.audit_sink,
            phi_pattern_warnings_enabled: ctx.policy.logging.phi_pattern_warnings,
            phi_redaction_backend: ctx.policy.phi_redaction.backend,
            upstream_phi_policy: "deny" as const,
            // The process would not have started otherwise — fail-loud at boot.
            validation_status: "valid" as const,
          },
          sources: [metaSource()],
          tier: "compute",
        }),
      ),
  };

  const redactPhi: ToolDef = {
    name: "redact_phi",
    description:
      "Redact Protected Health Information from a piece of text using the policy-configured backend. Exposed so an agent processing a patient chart can pre-redact before constructing search queries.",
    inputSchema: redactPhiShape,
    handler: async (args): Promise<ToolResult<unknown>> => {
      const { text, categories, backend_override } = redactPhiInput.parse(args);
      const config: RedactionConfig = backend_override
        ? { ...ctx.policy.phi_redaction, backend: backend_override }
        : ctx.policy.phi_redaction;

      const result = await redactWithBackend(text, config, categories as PhiCategory[] | undefined);

      const counts = new Map<PhiCategory, number>();
      for (const span of result.spans) {
        counts.set(span.category, (counts.get(span.category) ?? 0) + 1);
      }

      return makeResult({
        data: {
          redacted_text: result.redacted_text,
          redactions: [...counts.entries()].map(([category, count]) => ({ category, count })),
          backend_used: result.backend_used,
        },
        sources: [metaSource()],
        tier: "compute",
        warnings: result.warnings,
      });
    },
  };

  const compareRedactionBackends: ToolDef = {
    name: "compare_redaction_backends",
    description:
      "Run several PHI redaction backends side-by-side on a piece of sample text so a user can see how each performs and pick the one that fits their content.",
    inputSchema: compareShape,
    handler: async (args): Promise<ToolResult<unknown>> => {
      const { text, backends } = compareInput.parse(args);
      const results = await Promise.all(
        backends.map(async (backend) => {
          const config: RedactionConfig = { ...ctx.policy.phi_redaction, backend };
          const started = performance.now();
          try {
            const r = await redactWithBackend(text, config);
            return {
              backend,
              redacted: r.redacted_text,
              spans: r.spans,
              latency_ms: Math.round(performance.now() - started),
              warnings: r.warnings,
            };
          } catch (err) {
            return {
              backend,
              redacted: null,
              spans: [] as RedactionSpan[],
              latency_ms: Math.round(performance.now() - started),
              error: errorMessage(err),
            };
          }
        }),
      );
      return makeResult({
        data: { results },
        sources: [metaSource()],
        tier: "compute",
      });
    },
  };

  const evaluateRedactionTool: ToolDef = {
    name: "evaluate_redaction",
    description:
      "Score a redaction backend against a hand-labeled ground-truth span set, returning precision, recall, F1, and the specific false positives and false negatives.",
    inputSchema: evaluateShape,
    handler: async (args): Promise<ToolResult<unknown>> => {
      const { text, ground_truth_spans, backend } = evaluateInput.parse(args);
      const config: RedactionConfig = { ...ctx.policy.phi_redaction, backend };
      const result = await redactWithBackend(text, config);
      const evaluation = evaluateRedaction(result.spans, ground_truth_spans);
      return makeResult({
        data: { backend, ...evaluation },
        sources: [metaSource()],
        tier: "compute",
        warnings: result.warnings,
      });
    },
  };

  return [
    describeCapabilities,
    describePolicy,
    redactPhi,
    compareRedactionBackends,
    evaluateRedactionTool,
  ];
}
