import { describe, expect, it } from "vitest";
import { getCalculator } from "../src/index.js";

function compute(name: string, args: Record<string, unknown>) {
  const calc = getCalculator(name);
  if (!calc) throw new Error(`no calculator ${name}`);
  return calc.compute(args);
}

describe("calc_kidney_workup", () => {
  it("reports Cockcroft-Gault, CKD-EPI, and MDRD side-by-side", () => {
    const r = compute("calc_kidney_workup", {
      age_y: 70,
      weight_kg: 80,
      sex: "M",
      serum_creatinine_mg_dl: 1.2,
    });
    expect(r.breakdown).toHaveLength(3);
    // First component is Cockcroft-Gault (64.8 mL/min from the atomic test).
    expect(r.breakdown?.[0]?.value).toBe(64.8);
    // The primary result is the CKD-EPI eGFR.
    expect(r.result).toBeGreaterThan(0);
    expect(r.interpretation.detail).toContain("CKD-EPI");
  });
});

describe("calc_cardiac_risk_panel", () => {
  it("pairs CHA₂DS₂-VASc with HAS-BLED and synthesizes net benefit", () => {
    const r = compute("calc_cardiac_risk_panel", {
      age_y: 78,
      sex: "F",
      congestive_heart_failure: true,
      hypertension: true,
      diabetes: false,
      stroke_tia_thromboembolism: true,
      vascular_disease: false,
      uncontrolled_hypertension: true,
      abnormal_renal_function: false,
      abnormal_liver_function: false,
      prior_major_bleeding: false,
      labile_inr: true,
      antiplatelet_or_nsaid_use: false,
      alcohol_excess: false,
    });
    expect(r.breakdown).toHaveLength(2);
    // CHA₂DS₂-VASc: age≥75 (2) + CHF (1) + HTN (1) + stroke (2) + female (1) = 7.
    expect(r.result).toBe(7);
    expect(r.interpretation.detail).toContain("anticoagulation");
  });
});

describe("calc_sepsis_panel", () => {
  it("runs qSOFA alone when no SOFA/APACHE inputs are supplied", () => {
    const r = compute("calc_sepsis_panel", {
      respiratory_rate: 24,
      altered_mentation: true,
      sbp_mm_hg: 95,
    });
    expect(r.breakdown).toHaveLength(1);
    expect(r.result).toBe(3); // qSOFA score
  });

  it("adds SOFA when its inputs are supplied", () => {
    const r = compute("calc_sepsis_panel", {
      respiratory_rate: 24,
      altered_mentation: true,
      sbp_mm_hg: 95,
      sofa: {
        pao2_fio2_ratio: 150,
        on_respiratory_support: true,
        platelets_10e3_per_ul: 40,
        bilirubin_mg_dl: 7,
        mean_arterial_pressure_mm_hg: 60,
        norepinephrine_mcg_kg_min: 0.2,
        glasgow_coma_scale: 9,
        creatinine_mg_dl: 4.0,
      },
    });
    expect(r.breakdown).toHaveLength(2);
    expect(r.result).toBe(19); // SOFA total becomes the primary result
  });
});

describe("calc_pe_workup", () => {
  it("combines Wells, PERC, and PESI into a diagnostic-pathway reading", () => {
    const r = compute("calc_pe_workup", {
      wells_pe: {
        clinical_signs_of_dvt: false,
        pe_most_likely_diagnosis: false,
        heart_rate_bpm: 80,
        immobilization_or_surgery: false,
        previous_pe_or_dvt: false,
        hemoptysis: false,
        malignancy: false,
      },
      perc: {
        age_y: 40,
        heart_rate_bpm: 80,
        oxygen_saturation_pct: 98,
        unilateral_leg_swelling: false,
        hemoptysis: false,
        recent_surgery_or_trauma: false,
        prior_pe_or_dvt: false,
        hormone_use: false,
      },
      pesi: {
        age_y: 40,
        sex: "F",
        cancer: false,
        heart_failure: false,
        chronic_lung_disease: false,
        heart_rate_bpm: 80,
        sbp_mm_hg: 120,
        respiratory_rate: 16,
        temperature_c: 37,
        altered_mental_status: false,
        oxygen_saturation_pct: 98,
      },
    });
    expect(r.breakdown).toHaveLength(3);
    expect(r.result).toBe(0); // Wells PE score
    // Wells-unlikely + PERC-negative → PE excluded without further testing.
    expect(r.interpretation.detail).toContain("excluded without");
  });
});
