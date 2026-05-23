/**
 * Zod schema for the deployment-policy YAML (ARCHITECTURE.md §3.5.3).
 *
 * Every object is `.strict()` so an unknown or mistyped key is rejected at
 * startup rather than silently ignored — fail-loud, per §3.5.3.
 *
 * This validates *shape*. Cross-field invariants (covered_entity needs an audit
 * sink, encrypted cache needs a key, etc.) are enforced in `loader.ts`.
 */

import { z } from "zod";

export const deploymentTypeSchema = z.enum(["personal", "covered_entity", "research_deid"]);

export const redactionBackendSchema = z.enum([
  "regex",
  "presidio",
  "openmed",
  "foundation",
  "ensemble",
  "custom",
]);

export const phiCategorySchema = z.enum([
  "name",
  "mrn",
  "date",
  "address",
  "phone",
  "email",
  "ssn",
  "insurance_id",
]);

export const redactionConfigSchema = z
  .object({
    backend: redactionBackendSchema,
    /**
     * Free-text audit field. For `covered_entity` deployments using a cloud
     * foundation backend, populate with the BAA / ZDR reference (contract ID,
     * execution date, compliance ticket). Not validated by the MCP — exists
     * so the policy YAML on disk records WHO signed off on cloud-PHI
     * disclosure for this deployment.
     */
    compliance_attested_by: z.string().optional(),
    regex: z
      .object({ categories: z.array(phiCategorySchema).optional() })
      .strict()
      .optional(),
    presidio: z.object({ url: z.string(), api_key_env: z.string().optional() }).strict().optional(),
    openmed: z.object({ url: z.string(), api_key_env: z.string().optional() }).strict().optional(),
    foundation: z
      .object({
        provider: z.enum(["anthropic", "openai", "local"]),
        model: z.string(),
        api_key_env: z.string().optional(),
        base_url: z.string().optional(),
        prompt_template: z.enum(["safe_harbor_verbatim", "custom"]),
        custom_prompt_path: z.string().optional(),
      })
      .strict()
      .optional(),
    ensemble: z
      .object({
        backends: z.array(redactionBackendSchema),
        mode: z.enum(["union", "intersection"]),
      })
      .strict()
      .optional(),
    custom: z.object({ module_path: z.string() }).strict().optional(),
  })
  .strict();

export const policyFileSchema = z
  .object({
    deployment_type: deploymentTypeSchema,
    cache: z
      .object({
        persist_sensitive_inputs: z.boolean().optional(),
        encrypted_at_rest: z.boolean().optional(),
      })
      .strict()
      .optional(),
    logging: z
      .object({
        audit_sink: z.string().nullable().optional(),
        payload_redaction: z.boolean().optional(),
        phi_pattern_warnings: z.boolean().optional(),
      })
      .strict()
      .optional(),
    upstream_egress: z
      .object({
        // Free-form here; the loader enforces it MUST equal "deny".
        phi_policy: z.string().optional(),
      })
      .strict()
      .optional(),
    phi_redaction: redactionConfigSchema.optional(),
  })
  .strict();

/** The validated-but-not-yet-resolved policy file shape. */
export type PolicyFile = z.infer<typeof policyFileSchema>;
