import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AHRQ_LICENSE_WARNING,
  getRecommendation,
  listByGrade,
  loadSnapshot,
  searchIcd10,
  searchIcd10ByCode,
  searchLoinc,
  searchSnapshot,
  snapshotProvenanceWarning,
} from "../src/index.js";
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

describe("USPSTF snapshot loader", () => {
  it("loads the bundled snapshot with the expected version metadata", () => {
    const snap = loadSnapshot();
    expect(snap.snapshot_version).toBe("2026-01");
    expect(snap.recommendations.length).toBeGreaterThan(0);
  });

  it("searchSnapshot is a case-insensitive substring across title / topic / population / text", () => {
    expect(searchSnapshot("aspirin").length).toBeGreaterThan(0);
    expect(searchSnapshot("HYPERTENSION").length).toBeGreaterThan(0);
  });

  it("listByGrade filters to that letter", () => {
    const a = listByGrade("A");
    expect(a.every((r) => r.grade === "A")).toBe(true);
  });

  it("getRecommendation returns a known ID and undefined for unknown", () => {
    expect(getRecommendation("hypertension-screening-adults")?.grade).toBe("A");
    expect(getRecommendation("bogus-id")).toBeUndefined();
  });

  it("exports the verbatim AHRQ license warning and a snapshot provenance line", () => {
    expect(AHRQ_LICENSE_WARNING).toContain("AHRQ");
    expect(snapshotProvenanceWarning()).toContain("2026-01");
  });
});
