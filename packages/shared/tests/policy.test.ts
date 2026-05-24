import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PRESETS,
  type PolicyFile,
  PolicyValidationError,
  loadPolicy,
  resolvePolicy,
} from "../src/policy/index.js";

const tmpDirs: string[] = [];

function tmpPolicyFile(yaml: string): string {
  const dir = mkdtempSync(join(tmpdir(), "clinicalai-mcp-policy-"));
  tmpDirs.push(dir);
  const path = join(dir, "policy.yaml");
  writeFileSync(path, yaml, "utf8");
  return path;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

/** Capture a thrown PolicyValidationError so its section/field can be asserted. */
function expectPolicyError(fn: () => unknown): PolicyValidationError {
  try {
    fn();
  } catch (err) {
    if (err instanceof PolicyValidationError) return err;
    throw err;
  }
  throw new Error("expected a PolicyValidationError, but none was thrown");
}

describe("resolvePolicy — defaults", () => {
  it("resolves the personal preset to a conservative posture", () => {
    const { policy, warnings } = resolvePolicy(PRESETS.personal, {});
    expect(policy.deployment_type).toBe("personal");
    expect(policy.cache.persist_sensitive_inputs).toBe(false);
    expect(policy.logging.audit_sink).toBeNull();
    expect(policy.logging.phi_pattern_warnings).toBe(true);
    expect(policy.upstream_egress.phi_policy).toBe("deny");
    expect(policy.phi_redaction.backend).toBe("regex");
    expect(policy.policy_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(warnings).toEqual([]);
  });

  it("silences PHI-pattern warnings for research_deid", () => {
    const { policy } = resolvePolicy(PRESETS.research_deid, {});
    expect(policy.deployment_type).toBe("research_deid");
    expect(policy.logging.phi_pattern_warnings).toBe(false);
  });
});

describe("resolvePolicy — fail-loud validation", () => {
  it("rejects a covered_entity deployment with no audit sink", () => {
    const err = expectPolicyError(() => resolvePolicy(PRESETS.covered_entity, {}));
    expect(err.section).toBe("logging");
    expect(err.field).toBe("logging.audit_sink");
  });

  it("rejects persisted sensitive inputs without encryption-at-rest", () => {
    const file: PolicyFile = {
      deployment_type: "personal",
      cache: { persist_sensitive_inputs: true, encrypted_at_rest: false },
    };
    const err = expectPolicyError(() => resolvePolicy(file, {}));
    expect(err.section).toBe("cache");
    expect(err.field).toBe("cache.encrypted_at_rest");
  });

  it("rejects persisted sensitive inputs without an encryption key", () => {
    const file: PolicyFile = {
      deployment_type: "personal",
      cache: { persist_sensitive_inputs: true, encrypted_at_rest: true },
    };
    const err = expectPolicyError(() => resolvePolicy(file, {}));
    expect(err.section).toBe("cache");
    expect(err.field).toBe("CLINICALAI_MCP_CACHE_ENCRYPTION_KEY");
  });

  it("accepts a covered_entity policy once sink + encryption key are present", () => {
    const file: PolicyFile = {
      deployment_type: "covered_entity",
      logging: { audit_sink: "syslog://localhost:514" },
    };
    const { policy } = resolvePolicy(file, { CLINICALAI_MCP_CACHE_ENCRYPTION_KEY: "s3cret" });
    expect(policy.deployment_type).toBe("covered_entity");
    expect(policy.cache.persist_sensitive_inputs).toBe(true);
  });

  it("rejects any upstream phi_policy other than deny", () => {
    const file = {
      deployment_type: "personal",
      upstream_egress: { phi_policy: "allow" },
    } as PolicyFile;
    const err = expectPolicyError(() => resolvePolicy(file, {}));
    expect(err.section).toBe("upstream_egress");
  });

  it("rejects an unresolved env var referenced by the policy", () => {
    const file: PolicyFile = {
      deployment_type: "personal",
      phi_redaction: {
        backend: "foundation",
        foundation: {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          api_key_env: "MISSING_KEY",
          prompt_template: "safe_harbor_verbatim",
        },
      },
    };
    const err = expectPolicyError(() => resolvePolicy(file, {}));
    expect(err.section).toBe("phi_redaction");
    expect(err.field).toBe("MISSING_KEY");
  });

  it("warns (does not error) for research_deid with a foundation backend", () => {
    const file: PolicyFile = {
      deployment_type: "research_deid",
      phi_redaction: {
        backend: "foundation",
        foundation: {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          api_key_env: "PRESENT_KEY",
          prompt_template: "safe_harbor_verbatim",
        },
      },
    };
    const { warnings } = resolvePolicy(file, { PRESENT_KEY: "x" });
    expect(warnings.some((w) => w.includes("research_deid"))).toBe(true);
  });
});

describe("resolvePolicy — hashing", () => {
  it("is deterministic for identical input", () => {
    const a = resolvePolicy(PRESETS.personal, {}).policy.policy_hash;
    const b = resolvePolicy(PRESETS.personal, {}).policy.policy_hash;
    expect(a).toBe(b);
  });

  it("differs when the policy posture differs", () => {
    const personal = resolvePolicy(PRESETS.personal, {}).policy.policy_hash;
    const research = resolvePolicy(PRESETS.research_deid, {}).policy.policy_hash;
    expect(personal).not.toBe(research);
  });
});

describe("loadPolicy — env-driven selection", () => {
  it("defaults to the personal preset with no env vars", () => {
    const { policy, source } = loadPolicy({});
    expect(policy.deployment_type).toBe("personal");
    expect(source).toContain("personal");
  });

  it("selects a named preset via CLINICALAI_MCP_POLICY", () => {
    const { policy } = loadPolicy({ CLINICALAI_MCP_POLICY: "research_deid" });
    expect(policy.deployment_type).toBe("research_deid");
  });

  it("rejects an unknown preset name", () => {
    expect(() => loadPolicy({ CLINICALAI_MCP_POLICY: "bogus" })).toThrow(/not a known preset/);
  });

  it("loads and validates a YAML policy file", () => {
    const path = tmpPolicyFile(
      ["deployment_type: personal", "logging:", "  phi_pattern_warnings: false", ""].join("\n"),
    );
    const { policy } = loadPolicy({ CLINICALAI_MCP_POLICY_FILE: path });
    expect(policy.deployment_type).toBe("personal");
    expect(policy.logging.phi_pattern_warnings).toBe(false);
  });

  it("rejects a YAML file with an unknown key (strict schema)", () => {
    const path = tmpPolicyFile(["deployment_type: personal", "bogus_key: true", ""].join("\n"));
    expect(() => loadPolicy({ CLINICALAI_MCP_POLICY_FILE: path })).toThrow(
      /Invalid deployment policy/,
    );
  });
});
