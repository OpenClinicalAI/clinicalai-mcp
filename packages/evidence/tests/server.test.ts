import { describe, expect, it } from "vitest";
import { evidenceTools } from "../src/index.js";
import { buildContext } from "./helpers.js";

describe("evidence server", () => {
  it("builds without a phi-lint violation and mounts every tool", () => {
    const ctx = buildContext();
    // 7 atomic + 2 composite + 3 USPSTF + 5 shared meta tools = 17 total.
    expect(ctx.toolNames.length).toBe(evidenceTools().length + 5);
    expect(ctx.toolNames).toEqual(
      expect.arrayContaining([
        "search_pubmed",
        "get_article",
        "find_related_articles",
        "find_systematic_reviews",
        "search_trials",
        "get_trial",
        "find_trials_for_condition",
        "summarize_evidence",
        "compare_treatments",
        "search_uspstf",
        "get_uspstf_recommendation",
        "list_uspstf_by_grade",
        "redact_phi",
      ]),
    );
  });

  it("ships 12 domain tools (7 atomic + 2 composite + 3 USPSTF)", () => {
    expect(evidenceTools().length).toBe(12);
  });
});
