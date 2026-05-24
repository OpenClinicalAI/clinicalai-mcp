import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  PhiLintError,
  type ToolDef,
  createClinicalMcpServer,
  makeResult,
  metaTools,
} from "../src/index.js";

/** Build a server with the cache disabled so tests touch no filesystem. */
function buildServer(tools: ToolDef[] = []) {
  return createClinicalMcpServer({
    name: "@openclinicalai/test",
    version: "0.1.0",
    tools,
    env: { CLINICALAI_MCP_CACHE_URL: "none" },
  });
}

describe("createClinicalMcpServer", () => {
  it("mounts the three shared meta tools", () => {
    const { context } = buildServer();
    expect(context.toolNames).toEqual(
      expect.arrayContaining(["describe_capabilities", "describe_policy", "redact_phi"]),
    );
  });

  it("defaults to the personal deployment policy", () => {
    const { context } = buildServer();
    expect(context.policy.deployment_type).toBe("personal");
    expect(context.policy.upstream_egress.phi_policy).toBe("deny");
  });

  it("registers a clean domain tool alongside the meta tools", () => {
    const cleanTool: ToolDef = {
      name: "search_things",
      description: "Search things.",
      inputSchema: { query: z.string() },
      handler: () => Promise.resolve(makeResult({ data: [], sources: [] })),
    };
    const { context } = buildServer([cleanTool]);
    expect(context.toolNames).toContain("search_things");
  });

  it("fails loudly when a domain tool has a PHI-shaped input field", () => {
    const badTool: ToolDef = {
      name: "bad_tool",
      description: "Has a PHI-shaped field.",
      inputSchema: { patient_name: z.string() },
      handler: () => Promise.resolve(makeResult({ data: {}, sources: [] })),
    };
    expect(() => buildServer([badTool])).toThrow(PhiLintError);
  });
});

describe("meta tools", () => {
  it("describe_capabilities reports server identity and the tool list", async () => {
    const { context } = buildServer();
    const tool = metaTools(context).find((t) => t.name === "describe_capabilities");
    const result = await tool?.handler({}, context);
    const data = result?.data as { server_name: string; available_tools: string[] };
    expect(data.server_name).toBe("@openclinicalai/test");
    expect(data.available_tools).toContain("redact_phi");
  });

  it("describe_policy reports a valid, hashed policy", async () => {
    const { context } = buildServer();
    const tool = metaTools(context).find((t) => t.name === "describe_policy");
    const result = await tool?.handler({}, context);
    const data = result?.data as {
      validation_status: string;
      policy_hash: string;
      upstream_phi_policy: string;
    };
    expect(data.validation_status).toBe("valid");
    expect(data.upstream_phi_policy).toBe("deny");
    expect(data.policy_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("redact_phi redacts via the policy-configured backend", async () => {
    const { context } = buildServer();
    const tool = metaTools(context).find((t) => t.name === "redact_phi");
    const result = await tool?.handler({ text: "reach me at a@b.com" }, context);
    const data = result?.data as {
      redacted_text: string;
      backend_used: string;
      redactions: { category: string; count: number }[];
    };
    expect(data.redacted_text).toContain("[REDACTED:EMAIL]");
    expect(data.backend_used).toBe("regex");
    expect(data.redactions).toContainEqual({ category: "email", count: 1 });
  });
});
