import { afterEach, describe, expect, it, vi } from "vitest";
import { drugTools } from "../src/index.js";
import type {
  AdverseEventSummary,
  DoseAdjustmentReport,
  DrugFullProfile,
  DrugRecord,
  DrugSummary,
  InteractionReport,
  RecallSummary,
  SafetySummary,
  StructuredProductLabel,
} from "../src/index.js";
import { buildContext, stubFetchRoutes } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const tool = (name: string) => {
  const t = drugTools().find((d) => d.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
};

/* -------------------------------------------------------------------------- */
/* Atomic tools                                                                */
/* -------------------------------------------------------------------------- */

describe("search_drugs", () => {
  it("returns RxNorm concepts capped by the limit", async () => {
    stubFetchRoutes([
      {
        match: "/REST/drugs.json",
        body: {
          drugGroup: {
            conceptGroup: [
              {
                tty: "IN",
                conceptProperties: [
                  { rxcui: "6809", name: "metformin", tty: "IN" },
                  { rxcui: "316256", name: "Glucophage", tty: "BN" },
                ],
              },
            ],
          },
        },
      },
    ]);
    const result = await tool("search_drugs").handler(
      { query: "metformin", limit: 1 },
      buildContext(),
    );
    const data = result.data as DrugSummary[];
    expect(data).toHaveLength(1);
    expect(data[0]?.rxcui).toBe("6809");
    expect(result.tier).toBe("free");
  });

  it("sorts results by TTY priority so the ingredient outranks branded products", async () => {
    // RxNav returns alphabetical order — Glucophage (BN) before metformin (IN).
    // The handler must reorder so the ingredient lands first.
    stubFetchRoutes([
      {
        match: "/REST/drugs.json",
        body: {
          drugGroup: {
            conceptGroup: [
              {
                tty: "SBD",
                conceptProperties: [
                  { rxcui: "999991", name: "Glucophage XR 500 MG", tty: "SBD" },
                  { rxcui: "316256", name: "Glucophage", tty: "BN" },
                  { rxcui: "861007", name: "metformin 500 MG", tty: "SCD" },
                  { rxcui: "6809", name: "metformin", tty: "IN" },
                ],
              },
            ],
          },
        },
      },
    ]);
    const result = await tool("search_drugs").handler({ query: "metformin" }, buildContext());
    const data = result.data as DrugSummary[];
    expect(data[0]?.tty).toBe("IN");
    expect(data[0]?.rxcui).toBe("6809");
    expect(data[1]?.tty).toBe("SCD");
    expect(data[2]?.tty).toBe("BN");
    expect(data[3]?.tty).toBe("SBD");
  });

  it("redacts the query in sensitive mode before calling RxNav", async () => {
    const fetchFn = stubFetchRoutes([
      {
        match: "/REST/drugs.json",
        body: { drugGroup: { conceptGroup: [] } },
      },
    ]);
    const result = await tool("search_drugs").handler(
      { query: "patient a@b.com on metformin", phi_mode: "sensitive" },
      buildContext(),
    );
    expect(result.phi_redaction_applied?.applied).toBe(true);
    expect(result.phi_redaction_applied?.categories).toContain("email");
    // The outbound URL must not carry the raw email — it carries the redaction token.
    const called = String(fetchFn.mock.calls[0]?.[0]);
    expect(called).not.toContain("a%40b.com");
    expect(called).toContain("REDACTED");
  });
});

describe("get_drug_by_rxcui", () => {
  it("combines RxNorm properties with related concept groups", async () => {
    stubFetchRoutes([
      {
        match: "/REST/rxcui/6809/properties.json",
        body: { properties: { rxcui: "6809", name: "metformin", tty: "IN" } },
      },
      {
        match: "/related.json",
        body: {
          relatedGroup: {
            rxcui: "6809",
            conceptGroup: [
              { tty: "BN", conceptProperties: [{ rxcui: "316256", name: "Glucophage" }] },
              { tty: "SCD", conceptProperties: [{ rxcui: "861007", name: "metformin 500 MG" }] },
            ],
          },
        },
      },
    ]);
    const result = await tool("get_drug_by_rxcui").handler({ rxcui: "6809" }, buildContext());
    const data = result.data as DrugRecord;
    expect(data.name).toBe("metformin");
    expect(data.brand_names?.[0]?.name).toBe("Glucophage");
    expect(data.clinical_drugs?.[0]?.rxcui).toBe("861007");
  });

  it("rejects an unknown RxCUI as NOT_FOUND", async () => {
    stubFetchRoutes([
      { match: "/properties.json", body: {}, status: 404 },
      { match: "/related.json", body: {}, status: 404 },
    ]);
    await expect(
      tool("get_drug_by_rxcui").handler({ rxcui: "9999999" }, buildContext()),
    ).rejects.toMatchObject({ payload: { code: "NOT_FOUND" } });
  });
});

describe("get_drug_label", () => {
  const labelBody = {
    results: [
      {
        set_id: "abc-123",
        indications_and_usage: ["For type 2 diabetes."],
        boxed_warning: ["Lactic acidosis."],
        dosage_and_administration: ["500 mg PO BID."],
        openfda: { brand_name: ["Glucophage"], rxcui: ["6809"] },
      },
    ],
  };

  it("fetches the SPL by RxCUI and extracts sections", async () => {
    stubFetchRoutes([{ match: "/drug/label.json", body: labelBody }]);
    const result = await tool("get_drug_label").handler({ setid_or_rxcui: "6809" }, buildContext());
    const data = result.data as StructuredProductLabel;
    expect(data.brand_name).toBe("Glucophage");
    expect(data.sections.boxed_warning?.[0]).toContain("Lactic acidosis");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("rejects an input that is neither a SetID nor an RxCUI", async () => {
    await expect(
      tool("get_drug_label").handler({ setid_or_rxcui: "not-a-valid-key" }, buildContext()),
    ).rejects.toThrow();
  });
});

describe("get_adverse_events", () => {
  it("returns top reactions and total reports", async () => {
    stubFetchRoutes([
      {
        match: "/drug/event.json",
        body: {
          results: [
            { term: "DIARRHOEA", count: 4500 },
            { term: "NAUSEA", count: 3200 },
          ],
          meta: { results: { total: 200000 } },
        },
      },
    ]);
    const result = await tool("get_adverse_events").handler({ rxcui: "6809" }, buildContext());
    const data = result.data as AdverseEventSummary;
    expect(data.total_reports).toBe(200000);
    expect(data.top_reactions[0]?.reaction).toBe("DIARRHOEA");
  });
});

describe("get_drug_recalls", () => {
  it("returns enforcement records mapped to RecallSummary", async () => {
    stubFetchRoutes([
      {
        match: "/drug/enforcement.json",
        body: {
          results: [
            {
              recall_number: "D-001-2024",
              classification: "Class II",
              status: "Ongoing",
              reason_for_recall: "Failed dissolution.",
            },
          ],
        },
      },
    ]);
    const result = await tool("get_drug_recalls").handler({ rxcui: "6809" }, buildContext());
    const data = result.data as RecallSummary[];
    expect(data[0]?.classification).toBe("Class II");
  });
});

describe("get_drug_interactions", () => {
  it("surfaces each rxcui's FDA-label drug_interactions section on the free tier", async () => {
    // Both rxcuis resolve via direct openfda.rxcui hit. The label for 6809
    // includes a drug_interactions section; the label for 1191 does not.
    stubFetchRoutes([
      {
        match: "rxcui%3A6809",
        body: {
          results: [
            {
              set_id: "metformin-set",
              drug_interactions: ["May potentiate hypoglycemic agents."],
              openfda: { generic_name: ["metformin"], rxcui: ["6809"] },
            },
          ],
        },
      },
      {
        match: "rxcui%3A1191",
        body: {
          results: [
            {
              set_id: "aspirin-set",
              openfda: { generic_name: ["aspirin"], rxcui: ["1191"] },
            },
          ],
        },
      },
    ]);
    const result = await tool("get_drug_interactions").handler(
      { rxcuis: ["6809", "1191"] },
      buildContext(),
    );
    const data = result.data as InteractionReport;
    // No pairwise interactions on the free tier — that needs a licensed source.
    expect(data.interactions).toEqual([]);
    expect(data.source).toBe("fda-label-prose");
    expect(data.label_interactions).toHaveLength(2);
    const metformin = data.label_interactions?.find((e) => e.rxcui === "6809");
    expect(metformin?.drug_interactions?.[0]).toContain("hypoglycemic");
    const aspirin = data.label_interactions?.find((e) => e.rxcui === "1191");
    expect(aspirin?.drug_interactions).toBeUndefined();
    expect(aspirin?.note).toContain("Drug Interactions");
    expect(result.warnings?.join(" ")).toContain("prose, not pairwise");
    expect(result.warnings?.join(" ")).toContain("DrugBank no longer issues");
  });

  it("notes when no FDA label exists at all for a queried rxcui", async () => {
    // Direct openfda.rxcui lookup is empty AND the RxNorm fallback name turns
    // up nothing either — resolveLabel returns matched_via: "none".
    stubFetchRoutes([
      { match: "/drug/label.json", body: { results: [] } },
      { match: "/REST/rxcui/9999999/properties.json", body: {}, status: 404 },
      { match: "/REST/rxcui/8888888/properties.json", body: {}, status: 404 },
    ]);
    const result = await tool("get_drug_interactions").handler(
      { rxcuis: ["9999999", "8888888"] },
      buildContext(),
    );
    const data = result.data as InteractionReport;
    expect(data.label_interactions).toHaveLength(2);
    for (const entry of data.label_interactions ?? []) {
      expect(entry.note).toContain("No FDA label found");
    }
  });

  it("routes through DrugBank and returns tier 'licensed-drugbank' when configured", async () => {
    const fetchFn = stubFetchRoutes([
      {
        match: "/ddi",
        body: [
          {
            name: "metformin + glipizide",
            severity: "moderate",
            description: "Increased risk of hypoglycemia.",
            management: "Monitor blood glucose closely.",
            subject_drug: { rxcui: "6809", name: "metformin" },
            affected_drug: { rxcui: "4821", name: "glipizide" },
          },
        ],
      },
    ]);
    const result = await tool("get_drug_interactions").handler(
      { rxcuis: ["6809", "4821"] },
      buildContext({ DRUGBANK_API_KEY: "test-key" }),
    );
    const data = result.data as InteractionReport;
    expect(result.tier).toBe("licensed-drugbank");
    expect(data.source).toBe("drugbank");
    expect(data.interactions).toHaveLength(1);
    expect(data.interactions[0]?.severity).toBe("moderate");
    expect(data.interactions[0]?.drugs).toHaveLength(2);
    // Verify the Bearer auth header was sent.
    const init = fetchFn.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    expect(init?.headers?.authorization).toBe("Bearer test-key");
  });

  it("surfaces a DrugBank 401 as LICENSE_REQUIRED", async () => {
    stubFetchRoutes([{ match: "/ddi", body: {}, status: 401 }]);
    await expect(
      tool("get_drug_interactions").handler(
        { rxcuis: ["6809", "4821"] },
        buildContext({ DRUGBANK_API_KEY: "bad-key" }),
      ),
    ).rejects.toMatchObject({ payload: { code: "LICENSE_REQUIRED" } });
  });
});

/* -------------------------------------------------------------------------- */
/* Composite tools                                                             */
/* -------------------------------------------------------------------------- */

describe("get_drug_full_profile", () => {
  it("fans out across RxNorm, openFDA label, FAERS, and enforcement", async () => {
    stubFetchRoutes([
      {
        match: "/properties.json",
        body: { properties: { rxcui: "6809", name: "metformin", tty: "IN" } },
      },
      {
        match: "/related.json",
        body: {
          relatedGroup: {
            rxcui: "6809",
            conceptGroup: [
              { tty: "BN", conceptProperties: [{ rxcui: "316256", name: "Glucophage" }] },
            ],
          },
        },
      },
      {
        match: "/drug/label.json",
        body: {
          results: [
            {
              set_id: "abc-123",
              boxed_warning: ["Lactic acidosis."],
              openfda: { brand_name: ["Glucophage"], rxcui: ["6809"] },
            },
          ],
        },
      },
      {
        match: "/drug/event.json",
        body: {
          results: [{ term: "DIARRHOEA", count: 4500 }],
          meta: { results: { total: 200000 } },
        },
      },
      {
        match: "/drug/enforcement.json",
        body: {
          results: [
            { recall_number: "D-001-2024", classification: "Class II", status: "Completed" },
          ],
        },
      },
    ]);
    const result = await tool("get_drug_full_profile").handler({ rxcui: "6809" }, buildContext());
    const data = result.data as DrugFullProfile;
    expect(data.record.name).toBe("metformin");
    expect(data.label?.brand_name).toBe("Glucophage");
    expect(data.adverse_events?.top_reactions[0]?.reaction).toBe("DIARRHOEA");
    // "Completed" is not an active recall, so the active list is empty.
    expect(data.active_recalls).toHaveLength(0);
    expect(data.interactions.interactions).toHaveLength(0);
  });
});

describe("safety_summary", () => {
  it("extracts safety-relevant label sections and active recalls", async () => {
    stubFetchRoutes([
      {
        match: "/drug/label.json",
        body: {
          results: [
            {
              set_id: "abc-123",
              boxed_warning: ["Lactic acidosis."],
              contraindications: ["Severe renal impairment."],
              warnings_and_precautions: ["Monitor renal function."],
              pregnancy: ["Pregnancy category B."],
              openfda: { rxcui: ["6809"] },
            },
          ],
        },
      },
      {
        match: "/drug/enforcement.json",
        body: {
          results: [
            { recall_number: "D-X", classification: "Class I", status: "Ongoing" },
            { recall_number: "D-Y", classification: "Class III", status: "Terminated" },
          ],
        },
      },
    ]);
    const result = await tool("safety_summary").handler({ rxcui: "6809" }, buildContext());
    const data = result.data as SafetySummary;
    expect(data.boxed_warning?.[0]).toContain("Lactic acidosis");
    expect(data.contraindications?.[0]).toContain("renal impairment");
    expect(data.active_recalls).toHaveLength(1);
    expect(data.active_recalls[0]?.classification).toBe("Class I");
  });
});

describe("renal_dose_adjustment", () => {
  it("classifies CrCl and surfaces the renal-impairment label paragraph", async () => {
    stubFetchRoutes([
      {
        match: "/drug/label.json",
        body: {
          results: [
            {
              set_id: "abc-123",
              dosage_and_administration: ["Usual dose: 500 mg PO BID."],
              use_in_specific_populations: [
                "Geriatric Use: monitor closely.",
                "Renal Impairment: contraindicated when eGFR < 30 mL/min.",
              ],
              openfda: { rxcui: ["6809"] },
            },
          ],
        },
      },
    ]);
    const result = await tool("renal_dose_adjustment").handler(
      { rxcui: "6809", crcl_ml_min: 45 },
      buildContext(),
    );
    const data = result.data as DoseAdjustmentReport;
    expect(data.band).toContain("moderately");
    expect(data.label_excerpts.use_in_specific_populations?.[0]).toContain("Renal Impairment");
    // The geriatric paragraph should be filtered out of the renal-specific excerpt.
    expect(data.label_excerpts.use_in_specific_populations).toHaveLength(1);
  });

  it("returns a clear warning when no label is found", async () => {
    // Both the direct rxcui lookup and the RxNorm-name fallback come back empty,
    // so resolveLabel surfaces matched_via: "none".
    stubFetchRoutes([
      { match: "/drug/label.json", body: {}, status: 404 },
      { match: "/properties.json", body: {}, status: 404 },
    ]);
    const result = await tool("renal_dose_adjustment").handler(
      { rxcui: "9999999", crcl_ml_min: 60 },
      buildContext(),
    );
    expect(result.warnings?.join(" ")).toContain("No FDA label");
  });
});

/* -------------------------------------------------------------------------- */
/* Label resolver fallback (ingredient-vs-product mismatch)                    */
/* -------------------------------------------------------------------------- */

describe("label resolver fallback", () => {
  const metforminLabel = {
    set_id: "abc-123",
    boxed_warning: ["Lactic acidosis."],
    contraindications: ["Severe renal impairment."],
    openfda: { generic_name: ["metformin"], rxcui: ["861007"] },
  };

  it("falls back to a generic_name lookup when the direct RxCUI hit is empty", async () => {
    // Direct openfda.rxcui:6809 returns no results (ingredient-level RxCUI), so
    // resolveLabel pulls the RxNorm name and retries with openfda.generic_name.
    // Route order matters — generic_name is more specific than the bare path.
    stubFetchRoutes([
      {
        match: "rxcui%3A6809",
        body: { results: [] },
      },
      {
        match: "/REST/rxcui/6809/properties.json",
        body: { properties: { rxcui: "6809", name: "metformin", tty: "IN" } },
      },
      {
        match: "generic_name",
        body: { results: [metforminLabel] },
      },
      {
        match: "/drug/enforcement.json",
        body: { results: [] },
      },
    ]);
    const result = await tool("safety_summary").handler({ rxcui: "6809" }, buildContext());
    const data = result.data as SafetySummary;
    expect(data.boxed_warning?.[0]).toContain("Lactic acidosis");
    // The fallback warning explains the route the resolver took.
    expect(result.warnings?.join(" ")).toContain("generic_name");
    expect(result.warnings?.join(" ")).toContain("metformin");
  });

  it("surfaces a none-matched warning when both lookups are empty", async () => {
    stubFetchRoutes([
      { match: "/drug/label.json", body: { results: [] } },
      {
        match: "/REST/rxcui/9999999/properties.json",
        body: { properties: { rxcui: "9999999", name: "made-up-drug", tty: "IN" } },
      },
      { match: "/drug/enforcement.json", body: { results: [] } },
    ]);
    const result = await tool("safety_summary").handler({ rxcui: "9999999" }, buildContext());
    expect(result.warnings?.join(" ")).toContain("No FDA label found");
    expect(result.warnings?.join(" ")).toContain("made-up-drug");
  });
});
