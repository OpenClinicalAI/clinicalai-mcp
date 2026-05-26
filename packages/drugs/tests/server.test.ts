import { describe, expect, it } from "vitest";
import { drugTools } from "../src/index.js";
import { buildContext } from "./helpers.js";

describe("drugs server", () => {
  it("builds without a phi-lint violation and mounts every tool", () => {
    const ctx = buildContext();
    // 6 atomic + 3 composite + 9 dosing (Pass A) + 5 shared meta tools = 23 total.
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
        // Pass A dosing tools:
        "calc_vancomycin_auc_dose",
        "calc_aminoglycoside_hartford",
        "calc_carboplatin_calvert",
        "calc_mme_total_daily",
        "calc_opioid_equianalgesic",
        "calc_heparin_weight_based",
        "calc_4fpcc_kcentra",
        "calc_sodium_correction_rate",
        "flag_beers_criteria",
        "redact_phi",
      ]),
    );
  });

  it("ships 18 domain tools (6 atomic + 3 composite + 9 Pass A dosing)", () => {
    expect(drugTools().length).toBe(18);
  });
});
