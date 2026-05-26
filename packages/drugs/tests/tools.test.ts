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

/* -------------------------------------------------------------------------- */
/* Pass A drug-dosing tools                                                    */
/* -------------------------------------------------------------------------- */

describe("calc_vancomycin_auc_dose", () => {
  it("computes a reasonable starting regimen for a 70 kg adult with CrCl 80", async () => {
    const result = await tool("calc_vancomycin_auc_dose").handler(
      { weight_kg: 70, crcl_ml_min: 80 },
      buildContext(),
    );
    const data = result.data as {
      loading_dose_mg: number;
      maintenance_dose_mg: number;
      interval_hr: number;
    };
    // Loading: 25 mg/kg × 70 = 1750 mg
    expect(data.loading_dose_mg).toBe(1750);
    // Maintenance > 0 and a clinical interval
    expect(data.maintenance_dose_mg).toBeGreaterThan(0);
    expect([8, 12, 24, 36]).toContain(data.interval_hr);
  });

  it("caps loading dose at 3000 mg for large patients", async () => {
    const result = await tool("calc_vancomycin_auc_dose").handler(
      { weight_kg: 150, crcl_ml_min: 90 },
      buildContext(),
    );
    const data = result.data as { loading_dose_mg: number };
    expect(data.loading_dose_mg).toBe(3000);
  });
});

describe("calc_aminoglycoside_hartford", () => {
  it("gentamicin 70 kg, CrCl 80 → 490 mg q24h", async () => {
    const r = await tool("calc_aminoglycoside_hartford").handler(
      { drug: "gentamicin", weight_kg: 70, crcl_ml_min: 80 },
      buildContext(),
    );
    const data = r.data as { loading_dose_mg: number; interval: string };
    expect(data.loading_dose_mg).toBe(490);
    expect(data.interval).toBe("q24h");
  });

  it("amikacin uses 15 mg/kg loading", async () => {
    const r = await tool("calc_aminoglycoside_hartford").handler(
      { drug: "amikacin", weight_kg: 70, crcl_ml_min: 80 },
      buildContext(),
    );
    const data = r.data as { loading_dose_mg: number };
    expect(data.loading_dose_mg).toBe(1050);
  });

  it("CrCl 40–59 → q36h", async () => {
    const r = await tool("calc_aminoglycoside_hartford").handler(
      { drug: "gentamicin", weight_kg: 60, crcl_ml_min: 45 },
      buildContext(),
    );
    const data = r.data as { interval: string };
    expect(data.interval).toBe("q36h");
  });

  it("CrCl <20 falls outside Hartford → individualized", async () => {
    const r = await tool("calc_aminoglycoside_hartford").handler(
      { drug: "gentamicin", weight_kg: 60, crcl_ml_min: 15 },
      buildContext(),
    );
    const data = r.data as { interval: string };
    expect(data.interval).toBe("individualized");
  });
});

describe("calc_carboplatin_calvert", () => {
  it("CrCl 100, AUC 6 → dose 750 mg", async () => {
    const r = await tool("calc_carboplatin_calvert").handler(
      { target_auc: 6, crcl_ml_min: 100 },
      buildContext(),
    );
    const data = r.data as { carboplatin_dose_mg: number; gfr_was_capped: boolean };
    // 6 × (100 + 25) = 750
    expect(data.carboplatin_dose_mg).toBe(750);
    expect(data.gfr_was_capped).toBe(false);
  });

  it("FDA caps GFR at 125 mL/min for dose calculation", async () => {
    const r = await tool("calc_carboplatin_calvert").handler(
      { target_auc: 5, crcl_ml_min: 200 },
      buildContext(),
    );
    const data = r.data as { carboplatin_dose_mg: number; gfr_was_capped: boolean };
    // Capped at 125: 5 × (125 + 25) = 750
    expect(data.carboplatin_dose_mg).toBe(750);
    expect(data.gfr_was_capped).toBe(true);
  });
});

describe("calc_mme_total_daily", () => {
  it("oxycodone 10 mg × 4 + hydrocodone 5 mg × 4 → 80 MME/day (increased risk)", async () => {
    const r = await tool("calc_mme_total_daily").handler(
      {
        regimen: [
          { drug: "oxycodone", dose_mg: 10, doses_per_day: 4 },
          { drug: "hydrocodone", dose_mg: 5, doses_per_day: 4 },
        ],
      },
      buildContext(),
    );
    const data = r.data as { total_mme_per_day: number; interpretation: { band: string } };
    // (10 × 4 × 1.5) + (5 × 4 × 1) = 60 + 20 = 80
    expect(data.total_mme_per_day).toBe(80);
    expect(data.interpretation.band).toContain("increased overdose risk");
  });

  it("methadone uses tiered CDC 2022 factors (NOT flat 4.7)", async () => {
    const r = await tool("calc_mme_total_daily").handler(
      { regimen: [{ drug: "methadone", dose_mg: 30, doses_per_day: 1 }] },
      buildContext(),
    );
    const data = r.data as { total_mme_per_day: number };
    // 30 mg/day → falls in 21-40 band → factor 8 → 240 MME
    expect(data.total_mme_per_day).toBe(240);
  });

  it("≥90 MME/day → high risk band", async () => {
    const r = await tool("calc_mme_total_daily").handler(
      { regimen: [{ drug: "morphine", dose_mg: 50, doses_per_day: 2 }] },
      buildContext(),
    );
    const data = r.data as { total_mme_per_day: number; interpretation: { band: string } };
    expect(data.total_mme_per_day).toBe(100);
    expect(data.interpretation.band).toContain("high risk");
  });
});

describe("calc_opioid_equianalgesic", () => {
  it("morphine 30 mg/day → hydromorphone 4.2 mg/day with default 30% reduction", async () => {
    const r = await tool("calc_opioid_equianalgesic").handler(
      { source_drug: "morphine", source_daily_dose_mg: 30, target_drug: "hydromorphone" },
      buildContext(),
    );
    const data = r.data as { target_recommended_starting_mg: number; source_mme: number };
    expect(data.source_mme).toBe(30);
    // Equipotent: 30 / 5 = 6 mg/day hydromorphone, ×0.7 = 4.2
    expect(data.target_recommended_starting_mg).toBe(4.2);
  });

  it("explicit 50% reduction halves the equipotent dose", async () => {
    const r = await tool("calc_opioid_equianalgesic").handler(
      {
        source_drug: "morphine",
        source_daily_dose_mg: 60,
        target_drug: "oxycodone",
        cross_tolerance_reduction_pct: 50,
      },
      buildContext(),
    );
    const data = r.data as { target_recommended_starting_mg: number };
    // 60 mg morphine = 60 MME; oxycodone equipotent: 60 / 1.5 = 40 mg; × 0.5 = 20 mg
    expect(data.target_recommended_starting_mg).toBe(20);
  });
});

describe("calc_heparin_weight_based", () => {
  it("VTE 80 kg → 6400 U bolus + 1440 U/hr (no cap)", async () => {
    const r = await tool("calc_heparin_weight_based").handler(
      { weight_kg: 80, indication: "vte" },
      buildContext(),
    );
    const data = r.data as {
      bolus_units: number;
      infusion_units_per_hr: number;
      bolus_capped: boolean;
      infusion_capped: boolean;
    };
    expect(data.bolus_units).toBe(6400);
    expect(data.infusion_units_per_hr).toBe(1440);
    expect(data.bolus_capped).toBe(false);
    expect(data.infusion_capped).toBe(false);
  });

  it("ACS caps bolus at 4000 U and infusion at 1000 U/hr for heavy patients", async () => {
    const r = await tool("calc_heparin_weight_based").handler(
      { weight_kg: 100, indication: "acs" }, // 100 × 60 = 6000 → cap 4000; 100 × 12 = 1200 → cap 1000
      buildContext(),
    );
    const data = r.data as {
      bolus_units: number;
      infusion_units_per_hr: number;
      bolus_capped: boolean;
      infusion_capped: boolean;
    };
    expect(data.bolus_units).toBe(4000);
    expect(data.infusion_units_per_hr).toBe(1000);
    expect(data.bolus_capped).toBe(true);
    expect(data.infusion_capped).toBe(true);
  });
});

describe("calc_4fpcc_kcentra", () => {
  it("80 kg, INR 3 → 25 IU/kg = 2000 IU", async () => {
    const r = await tool("calc_4fpcc_kcentra").handler({ weight_kg: 80, inr: 3 }, buildContext());
    const data = r.data as { kcentra_dose_iu: number };
    expect(data.kcentra_dose_iu).toBe(2000);
  });

  it("80 kg, INR 5 → 35 IU/kg = 2800 IU", async () => {
    const r = await tool("calc_4fpcc_kcentra").handler({ weight_kg: 80, inr: 5 }, buildContext());
    const data = r.data as { kcentra_dose_iu: number };
    expect(data.kcentra_dose_iu).toBe(2800);
  });

  it("80 kg, INR 8 → 50 IU/kg = 4000 IU (under absolute cap)", async () => {
    const r = await tool("calc_4fpcc_kcentra").handler({ weight_kg: 80, inr: 8 }, buildContext());
    const data = r.data as { kcentra_dose_iu: number };
    expect(data.kcentra_dose_iu).toBe(4000);
  });

  it("Heavy patient INR 8 caps at 5000 IU (FDA weight cap at 100 kg + band max)", async () => {
    const r = await tool("calc_4fpcc_kcentra").handler({ weight_kg: 130, inr: 8 }, buildContext());
    const data = r.data as { kcentra_dose_iu: number; weight_was_capped: boolean };
    // 100 kg × 50 = 5000
    expect(data.kcentra_dose_iu).toBe(5000);
    expect(data.weight_was_capped).toBe(true);
  });

  it("INR < 2 is below the reversal threshold — throws", async () => {
    await expect(
      tool("calc_4fpcc_kcentra").handler({ weight_kg: 80, inr: 1.5 }, buildContext()),
    ).rejects.toThrow();
  });
});

describe("calc_sodium_correction_rate", () => {
  it("Hyponatremia chronic correction → max 8 mEq/L per 24h", async () => {
    const r = await tool("calc_sodium_correction_rate").handler(
      { current_sodium_mmol_l: 120, target_sodium_mmol_l: 135, chronicity: "chronic" },
      buildContext(),
    );
    const data = r.data as { max_per_24h_mmol_l: number; minimum_hours_to_reach_target: number };
    expect(data.max_per_24h_mmol_l).toBe(8);
    // delta = 15, at 8/24h → 15/8 × 24 = 45 hr
    expect(data.minimum_hours_to_reach_target).toBe(45);
  });

  it("Hyponatremia acute documented <24h → max 12 mEq/L per 24h", async () => {
    const r = await tool("calc_sodium_correction_rate").handler(
      {
        current_sodium_mmol_l: 120,
        target_sodium_mmol_l: 135,
        chronicity: "acute_documented_under_24h",
      },
      buildContext(),
    );
    const data = r.data as { max_per_24h_mmol_l: number };
    expect(data.max_per_24h_mmol_l).toBe(12);
  });

  it("Hypernatremia (target < current) → 10 mEq/L per 24h cap", async () => {
    const r = await tool("calc_sodium_correction_rate").handler(
      { current_sodium_mmol_l: 160, target_sodium_mmol_l: 145, chronicity: "chronic" },
      buildContext(),
    );
    const data = r.data as { direction: string; max_per_24h_mmol_l: number };
    expect(data.direction).toBe("decrease");
    expect(data.max_per_24h_mmol_l).toBe(10);
  });
});

describe("flag_beers_criteria", () => {
  it("diphenhydramine in 75yo → flagged 'avoid'", async () => {
    const r = await tool("flag_beers_criteria").handler(
      { drug_name: "diphenhydramine", age_y: 75 },
      buildContext(),
    );
    const data = r.data as {
      flagged: boolean;
      severity: string;
      rationale: string;
      alternative_class?: string;
    };
    expect(data.flagged).toBe(true);
    expect(data.severity).toBe("avoid");
    expect(data.rationale).toContain("anticholinergic");
    expect(data.alternative_class).toContain("loratadine");
  });

  it("diphenhydramine in 50yo → not_flagged (age <65)", async () => {
    const r = await tool("flag_beers_criteria").handler(
      { drug_name: "diphenhydramine", age_y: 50 },
      buildContext(),
    );
    const data = r.data as { flagged: boolean; severity: string };
    expect(data.flagged).toBe(false);
    expect(data.severity).toBe("not_flagged");
  });

  it("Unknown drug in 75yo → not_flagged with explicit caveat about v0.1 subset", async () => {
    const r = await tool("flag_beers_criteria").handler(
      { drug_name: "acetaminophen", age_y: 75 },
      buildContext(),
    );
    const data = r.data as { flagged: boolean; rationale: string };
    expect(data.flagged).toBe(false);
    expect(data.rationale).toContain("v0.1 Beers high-traffic subset");
  });

  it("zolpidem in 80yo → flagged 'avoid' with alternative", async () => {
    const r = await tool("flag_beers_criteria").handler(
      { drug_name: "zolpidem", age_y: 80 },
      buildContext(),
    );
    const data = r.data as { flagged: boolean; severity: string; alternative_class?: string };
    expect(data.flagged).toBe(true);
    expect(data.severity).toBe("avoid");
    expect(data.alternative_class).toContain("CBT-I");
  });

  it("haloperidol in 75yo → 'use_with_caution' (not avoid)", async () => {
    const r = await tool("flag_beers_criteria").handler(
      { drug_name: "haloperidol", age_y: 75 },
      buildContext(),
    );
    const data = r.data as { severity: string };
    expect(data.severity).toBe("use_with_caution");
  });
});
