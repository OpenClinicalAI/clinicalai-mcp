import { afterEach, describe, expect, it, vi } from "vitest";
import { searchIcd10, searchIcd10ByCode, searchLoinc } from "../src/index.js";
import { stubFetchRoutes } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NLM Clinical Tables client", () => {
  it("searchIcd10 maps the response tuple into CodeMatch records", async () => {
    stubFetchRoutes([
      {
        match: "/icd10cm/v3/search",
        body: [
          2,
          ["E11.9", "E11.65"],
          null,
          [
            ["E11.9", "Type 2 diabetes mellitus without complications"],
            ["E11.65", "Type 2 diabetes mellitus with hyperglycemia"],
          ],
          null,
        ],
      },
    ]);
    const matches = await searchIcd10("type 2 diabetes");
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({
      code: "E11.9",
      name: "Type 2 diabetes mellitus without complications",
      vocabulary: "icd10cm",
    });
  });

  it("searchIcd10ByCode restricts the search field to the code", async () => {
    const fetchFn = stubFetchRoutes([
      {
        match: "/icd10cm/v3/search",
        body: [1, ["A00.0"], null, [["A00.0", "Cholera due to Vibrio cholerae 01"]], null],
      },
    ]);
    await searchIcd10ByCode("A00.0");
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("sf=code");
  });

  it("searchLoinc surfaces the component / system metadata", async () => {
    stubFetchRoutes([
      {
        match: "/loinc_items/v3/search",
        body: [
          1,
          ["50678-0"],
          null,
          [["50678-0", "Glucose [Mass/volume] in Blood", "Glucose", "Bld"]],
          null,
        ],
      },
    ]);
    const matches = await searchLoinc("glucose blood");
    expect(matches[0]?.code).toBe("50678-0");
    expect(matches[0]?.extra?.component).toBe("Glucose");
    expect(matches[0]?.extra?.system).toBe("Bld");
  });
});
