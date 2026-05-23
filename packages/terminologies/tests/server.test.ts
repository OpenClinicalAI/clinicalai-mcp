import { describe, expect, it } from "vitest";
import { terminologyTools } from "../src/index.js";
import { buildContext } from "./helpers.js";

describe("terminologies server", () => {
  it("builds without a phi-lint violation and mounts every tool", () => {
    const ctx = buildContext();
    // 4 ICD-10/LOINC + 3 SNOMED/UMLS stubs + 3 USPSTF + 2 composite + 5 meta = 17 total.
    expect(ctx.toolNames.length).toBe(terminologyTools().length + 5);
    expect(ctx.toolNames).toEqual(
      expect.arrayContaining([
        "search_icd10",
        "lookup_icd10",
        "search_loinc",
        "lookup_loinc",
        "search_snomed",
        "lookup_snomed",
        "lookup_concept",
        "search_uspstf",
        "get_uspstf_recommendation",
        "list_uspstf_by_grade",
        "map_concept_across_vocabs",
        "code_workup",
      ]),
    );
  });

  it("ships 12 domain tools (4 + 3 + 3 + 2)", () => {
    expect(terminologyTools().length).toBe(12);
  });
});
