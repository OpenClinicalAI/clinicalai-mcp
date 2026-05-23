import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CodeMatch,
  type CodeRecord,
  type CodeWorkup,
  type ConceptMap,
  type Recommendation,
  type RecommendationSummary,
  terminologyTools,
} from "../src/index.js";
import { buildContext, stubFetchRoutes } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const tool = (name: string) => {
  const t = terminologyTools().find((d) => d.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
};

const icd10Body = (rows: [string, string][]) => [
  rows.length,
  rows.map((r) => r[0]),
  null,
  rows,
  null,
];

/* -------------------------------------------------------------------------- */
/* ICD-10 / LOINC tools                                                        */
/* -------------------------------------------------------------------------- */

describe("search_icd10 + lookup_icd10", () => {
  it("search_icd10 returns CodeMatch records", async () => {
    stubFetchRoutes([
      {
        match: "/icd10cm/v3/search",
        body: icd10Body([["E11.9", "Type 2 diabetes mellitus without complications"]]),
      },
    ]);
    const result = await tool("search_icd10").handler({ query: "diabetes" }, buildContext());
    const data = result.data as CodeMatch[];
    expect(data[0]?.code).toBe("E11.9");
    expect(data[0]?.vocabulary).toBe("icd10cm");
  });

  it("lookup_icd10 returns the exact-matching code", async () => {
    stubFetchRoutes([
      {
        match: "/icd10cm/v3/search",
        body: icd10Body([
          ["E11.9", "Type 2 diabetes mellitus without complications"],
          ["E11.91", "Some descendant"],
        ]),
      },
    ]);
    const result = await tool("lookup_icd10").handler({ code: "E11.9" }, buildContext());
    const data = result.data as CodeRecord;
    expect(data.code).toBe("E11.9");
  });

  it("lookup_icd10 throws NOT_FOUND when no row matches exactly", async () => {
    stubFetchRoutes([{ match: "/icd10cm/v3/search", body: icd10Body([]) }]);
    await expect(
      tool("lookup_icd10").handler({ code: "Z99.9" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "NOT_FOUND" } });
  });

  it("search_loinc returns LOINC matches with extra fields", async () => {
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
    const result = await tool("search_loinc").handler({ query: "glucose blood" }, buildContext());
    const data = result.data as CodeMatch[];
    expect(data[0]?.code).toBe("50678-0");
  });
});

/* -------------------------------------------------------------------------- */
/* SNOMED / UMLS LICENSE_REQUIRED stubs                                        */
/* -------------------------------------------------------------------------- */

describe("SNOMED / UMLS tools (free tier)", () => {
  it("search_snomed throws LICENSE_REQUIRED when no UMLS key is set", async () => {
    await expect(
      tool("search_snomed").handler({ query: "diabetes" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "LICENSE_REQUIRED" } });
  });

  it("lookup_concept throws LICENSE_REQUIRED with a clear suggestion", async () => {
    await expect(
      tool("lookup_concept").handler({ term: "diabetes" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "LICENSE_REQUIRED" } });
  });

  it("search_snomed routes through UMLS and returns tier 'licensed-umls' when configured", async () => {
    const fetchFn = stubFetchRoutes([
      {
        match: "/rest/search/current",
        body: {
          result: {
            results: [
              { ui: "44054006", rootSource: "SNOMEDCT_US", name: "Diabetes mellitus type 2" },
            ],
          },
        },
      },
    ]);
    const result = await tool("search_snomed").handler(
      { query: "diabetes" },
      buildContext({ UMLS_API_KEY: "umls-key" }),
    );
    const data = result.data as CodeMatch[];
    expect(result.tier).toBe("licensed-umls");
    expect(data[0]?.code).toBe("44054006");
    expect(data[0]?.vocabulary).toBe("snomedct");
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("apiKey=umls-key");
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("sabs=SNOMEDCT_US");
  });

  it("lookup_snomed returns a CodeRecord when the SNOMED concept exists", async () => {
    stubFetchRoutes([
      {
        match: "/source/SNOMEDCT_US/44054006",
        body: {
          result: { ui: "44054006", name: "Diabetes mellitus type 2", rootSource: "SNOMEDCT_US" },
        },
      },
    ]);
    const result = await tool("lookup_snomed").handler(
      { code: "44054006" },
      buildContext({ UMLS_API_KEY: "umls-key" }),
    );
    const data = result.data as CodeRecord;
    expect(data.code).toBe("44054006");
    expect(data.vocabulary).toBe("snomedct");
  });

  it("lookup_concept maps a term across vocabularies via UMLS atoms", async () => {
    stubFetchRoutes([
      {
        match: "/rest/search/current",
        body: { result: { results: [{ ui: "C0011860", name: "Diabetes mellitus type 2" }] } },
      },
      {
        match: "/CUI/C0011860/atoms",
        body: {
          result: [
            {
              ui: "A1",
              name: "Diabetes mellitus type 2",
              code: "https://uts-ws.nlm.nih.gov/rest/content/current/source/SNOMEDCT_US/44054006",
              rootSource: "SNOMEDCT_US",
            },
            {
              ui: "A2",
              name: "Type 2 diabetes mellitus without complications",
              code: "https://uts-ws.nlm.nih.gov/rest/content/current/source/ICD10CM/E11.9",
              rootSource: "ICD10CM",
            },
          ],
        },
      },
    ]);
    const result = await tool("lookup_concept").handler(
      { term: "type 2 diabetes" },
      buildContext({ UMLS_API_KEY: "umls-key" }),
    );
    const data = result.data as ConceptMap;
    expect(data.mappings.snomedct?.[0]?.code).toBe("44054006");
    expect(data.mappings.icd10cm[0]?.code).toBe("E11.9");
  });
});

/* -------------------------------------------------------------------------- */
/* USPSTF tools                                                                */
/* -------------------------------------------------------------------------- */

describe("USPSTF tools", () => {
  it("search_uspstf finds recommendations by free-text query", async () => {
    const result = await tool("search_uspstf").handler({ query: "hypertension" }, buildContext());
    const data = result.data as RecommendationSummary[];
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]?.grade).toBe("A");
  });

  it("get_uspstf_recommendation returns the full specific_recommendation text", async () => {
    const result = await tool("get_uspstf_recommendation").handler(
      { id: "aspirin-cvd-prevention-older-adults" },
      buildContext(),
    );
    const data = result.data as Recommendation;
    expect(data.grade).toBe("D");
    expect(data.specific_recommendation).toContain("aspirin");
  });

  it("get_uspstf_recommendation throws NOT_FOUND for unknown IDs", async () => {
    await expect(
      tool("get_uspstf_recommendation").handler({ id: "bogus" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "NOT_FOUND" } });
  });

  it("list_uspstf_by_grade filters by letter", async () => {
    const result = await tool("list_uspstf_by_grade").handler({ grade: "A" }, buildContext());
    const data = result.data as RecommendationSummary[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.grade === "A")).toBe(true);
  });

  it("every USPSTF result surfaces the AHRQ license clause as a warning", async () => {
    for (const name of ["search_uspstf", "list_uspstf_by_grade"]) {
      const args = name === "search_uspstf" ? { query: "screening" } : { grade: "A" as const };
      const result = await tool(name).handler(args, buildContext());
      expect(result.warnings?.join(" ")).toContain("AHRQ");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Composites                                                                  */
/* -------------------------------------------------------------------------- */

describe("map_concept_across_vocabs", () => {
  it("returns ICD-10 + LOINC mappings in parallel and notes the UMLS gap", async () => {
    stubFetchRoutes([
      { match: "/icd10cm/v3/search", body: icd10Body([["R73.9", "Hyperglycemia, unspecified"]]) },
      {
        match: "/loinc_items/v3/search",
        body: [
          1,
          ["2345-7"],
          null,
          [["2345-7", "Glucose [Mass/volume] in Serum or Plasma", "", ""]],
          null,
        ],
      },
    ]);
    const result = await tool("map_concept_across_vocabs").handler(
      { term: "glucose" },
      buildContext(),
    );
    const data = result.data as ConceptMap;
    expect(data.mappings.icd10cm.length).toBeGreaterThan(0);
    expect(data.mappings.loinc.length).toBeGreaterThan(0);
    expect(data.mappings.snomedct).toBeUndefined();
    expect(result.tier).toBe("free");
    expect(result.warnings?.join(" ")).toContain("UMLS");
  });

  it("includes SNOMED CT via UMLS when licensed (tier 'licensed-umls')", async () => {
    stubFetchRoutes([
      { match: "/icd10cm/v3/search", body: icd10Body([["R73.9", "Hyperglycemia, unspecified"]]) },
      {
        match: "/loinc_items/v3/search",
        body: [
          1,
          ["2345-7"],
          null,
          [["2345-7", "Glucose [Mass/volume] in Serum or Plasma", "", ""]],
          null,
        ],
      },
      {
        match: "/rest/search/current",
        body: {
          result: {
            results: [{ ui: "33747003", rootSource: "SNOMEDCT_US", name: "Glucose measurement" }],
          },
        },
      },
    ]);
    const result = await tool("map_concept_across_vocabs").handler(
      { term: "glucose" },
      buildContext({ UMLS_API_KEY: "umls-key" }),
    );
    const data = result.data as ConceptMap;
    expect(result.tier).toBe("licensed-umls");
    expect(data.mappings.snomedct).toBeDefined();
    expect(data.mappings.snomedct?.[0]?.vocabulary).toBe("snomedct");
  });
});

describe("code_workup", () => {
  it("splits ICD-10 candidates into top-N and consider-also", async () => {
    stubFetchRoutes([
      {
        match: "/icd10cm/v3/search",
        body: icd10Body([
          ["E11.9", "Type 2 diabetes mellitus without complications"],
          ["E11.65", "Type 2 diabetes mellitus with hyperglycemia"],
          ["E10.9", "Type 1 diabetes mellitus without complications"],
          ["E13.9", "Other specified diabetes"],
          ["E16.2", "Hypoglycemia, unspecified"],
          ["R73.9", "Hyperglycemia, unspecified"],
          ["E78.5", "Hyperlipidemia, unspecified"],
        ]),
      },
    ]);
    const result = await tool("code_workup").handler(
      { term: "diabetes", top_n: 3 },
      buildContext(),
    );
    const data = result.data as CodeWorkup;
    expect(data.candidates).toHaveLength(3);
    expect(data.consider_also.length).toBeGreaterThan(0);
  });
});
