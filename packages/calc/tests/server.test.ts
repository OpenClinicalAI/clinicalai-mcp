import { createClinicalMcpServer } from "@openclinicalai/shared";
import { describe, expect, it } from "vitest";
import { ALL_CALCULATORS, calcTools, discoveryTools } from "../src/index.js";

function build() {
  return createClinicalMcpServer({
    name: "@openclinicalai/calc",
    version: "0.1.0",
    tools: calcTools(),
    env: { CLINICALAI_MCP_CACHE_URL: "none" },
  });
}

describe("calc server", () => {
  it("builds without a phi-lint violation and mounts every tool", () => {
    const { context } = build();
    // ALL_CALCULATORS + 2 discovery tools + 5 shared meta tools.
    expect(context.toolNames).toEqual(
      expect.arrayContaining([
        "calc_meld",
        "calc_apache_ii",
        "calc_pe_workup",
        "calc_berlin_ards",
        "list_calculators",
      ]),
    );
    expect(context.toolNames.length).toBe(ALL_CALCULATORS.length + 2 + 5);
  });

  it("every calculator carries at least one citation", () => {
    for (const calc of ALL_CALCULATORS) {
      expect(calc.sources.length).toBeGreaterThan(0);
    }
  });

  it("every calculator declares a complexity", () => {
    for (const calc of ALL_CALCULATORS) {
      expect(["formula", "lookup", "tree", "multi-step"]).toContain(calc.complexity);
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

  it("list_calculators filters by complexity", async () => {
    const { context } = build();
    const list = discoveryTools().find((t) => t.name === "list_calculators");
    const result = await list?.handler({ complexity: "tree" }, context);
    const data = result?.data as { count: number; calculators: { name: string }[] };
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(data.calculators.map((c) => c.name)).toContain("calc_berlin_ards");
  });

  it("describe_calculator surfaces the complexity field", async () => {
    const { context } = build();
    const describe = discoveryTools().find((t) => t.name === "describe_calculator");
    const result = await describe?.handler({ name: "calc_berlin_ards" }, context);
    const data = result?.data as { complexity: string };
    expect(data.complexity).toBe("tree");
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
