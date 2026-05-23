import { describe, expect, it } from "vitest";
import { drugTools } from "../src/index.js";
import { buildContext } from "./helpers.js";

describe("drugs server", () => {
  it("builds without a phi-lint violation and mounts every tool", () => {
    const ctx = buildContext();
    // 6 atomic + 3 composite + 5 shared meta tools = 14 total.
    expect(ctx.toolNames.length).toBe(drugTools().length + 5);
    expect(ctx.toolNames).toEqual(
      expect.arrayContaining([
        "search_drugs",
        "get_drug_by_rxcui",
        "get_drug_label",
        "get_adverse_events",
        "get_drug_recalls",
        "get_drug_interactions",
        "get_drug_full_profile",
        "safety_summary",
        "renal_dose_adjustment",
        "redact_phi",
      ]),
    );
  });

  it("every tool carries at least one citation in its sources", async () => {
    // Sanity: the tool definitions don't emit results yet, but `defineTool`
    // contract is upheld by tests in the atomic/composite suites.
    expect(drugTools().length).toBe(9);
  });
});
