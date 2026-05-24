import { describe, expect, it } from "vitest";
import { type RedactionSpan, createClinicalMcpServer, metaTools } from "../src/index.js";

function context() {
  return createClinicalMcpServer({
    name: "@openclinicalai/test",
    version: "0.1.0",
    env: { CLINICALAI_MCP_CACHE_URL: "none" },
  }).context;
}

function tool(name: string) {
  const ctx = context();
  const def = metaTools(ctx).find((t) => t.name === name);
  if (!def) throw new Error(`meta tool ${name} not found`);
  return { def, ctx };
}

describe("compare_redaction_backends", () => {
  it("runs each requested backend and reports per-backend results", async () => {
    const { def, ctx } = tool("compare_redaction_backends");
    const result = await def.handler({ text: "reach me at a@b.com", backends: ["regex"] }, ctx);
    const data = result.data as {
      results: { backend: string; redacted: string | null; latency_ms: number }[];
    };
    expect(data.results).toHaveLength(1);
    expect(data.results[0]?.backend).toBe("regex");
    expect(data.results[0]?.redacted).toContain("[REDACTED:EMAIL]");
    expect(data.results[0]?.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("reports a per-backend error without failing the whole call", async () => {
    const { def, ctx } = tool("compare_redaction_backends");
    // presidio has no url in the default `personal` policy → that backend errors.
    const result = await def.handler({ text: "a@b.com", backends: ["regex", "presidio"] }, ctx);
    const data = result.data as {
      results: { backend: string; error?: string }[];
    };
    const presidio = data.results.find((r) => r.backend === "presidio");
    expect(presidio?.error).toBeDefined();
  });
});

describe("evaluate_redaction", () => {
  it("scores a backend against ground-truth spans", async () => {
    const { def, ctx } = tool("evaluate_redaction");
    const groundTruth: RedactionSpan[] = [{ start: 6, end: 13, category: "email" }];
    const result = await def.handler(
      { text: "email a@b.com", ground_truth_spans: groundTruth, backend: "regex" },
      ctx,
    );
    const data = result.data as { precision: number; recall: number; f1: number };
    expect(data.recall).toBe(1);
    expect(data.precision).toBe(1);
    expect(data.f1).toBe(1);
  });
});
