import { createClinicalMcpServer } from "@clinical-mcp/shared";
import { describe, expect, it } from "vitest";
import { ALL_CALCULATORS, calcTools, discoveryTools } from "../src/index.js";

function build() {
  return createClinicalMcpServer({
    name: "@clinical-mcp/calc",
    version: "0.1.0",
    tools: calcTools(),
    env: { CLINICAL_CACHE_URL: "none" },
  });
}

describe("calc server", () => {
  it("builds without a phi-lint violation and mounts every tool", () => {
    const { context } = build();
    // 19 calculators + 2 discovery tools + 3 (... actually 5) shared meta tools.
    expect(context.toolNames).toEqual(
      expect.arrayContaining(["calc_meld", "calc_apache_ii", "calc_pe_workup", "list_calculators"]),
    );
    expect(context.toolNames.length).toBe(ALL_CALCULATORS.length + 2 + 5);
  });

  it("every calculator carries at least one citation", () => {
    for (const calc of ALL_CALCULATORS) {
      expect(calc.sources.length).toBeGreaterThan(0);
    }
  });
});

describe("discovery tools", () => {
  it("list_calculators enumerates the full surface", async () => {
    const { context } = build();
    const list = discoveryTools().find((t) => t.name === "list_calculators");
    const result = await list?.handler({}, context);
    const data = result?.data as { count: number; calculators: { domain: string }[] };
    expect(data.count).toBe(ALL_CALCULATORS.length);
  });

  it("list_calculators filters by domain", async () => {
    const { context } = build();
    const list = discoveryTools().find((t) => t.name === "list_calculators");
    const result = await list?.handler({ domain: "composite" }, context);
    const data = result?.data as { count: number };
    expect(data.count).toBe(4);
  });

  it("describe_calculator returns a JSON Schema and citations", async () => {
    const { context } = build();
    const describe = discoveryTools().find((t) => t.name === "describe_calculator");
    const result = await describe?.handler({ name: "calc_meld" }, context);
    const data = result?.data as { input_schema: unknown; sources: unknown[] };
    expect(data.input_schema).toBeTruthy();
    expect(data.sources.length).toBeGreaterThan(0);
  });

  it("describe_calculator rejects an unknown calculator", async () => {
    const { context } = build();
    const describe = discoveryTools().find((t) => t.name === "describe_calculator");
    await expect(describe?.handler({ name: "calc_bogus" }, context)).rejects.toThrow();
  });
});
