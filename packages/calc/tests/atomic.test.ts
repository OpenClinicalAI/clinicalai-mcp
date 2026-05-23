import { describe, expect, it } from "vitest";
import { getCalculator } from "../src/index.js";

/** Run an atomic calculator by name. */
function compute(name: string, args: Record<string, unknown>) {
  const calc = getCalculator(name);
  if (!calc) throw new Error(`no calculator ${name}`);
  return calc.compute(args);
}

describe("renal/metabolic calculators", () => {
  it("Cockcroft-Gault creatinine clearance", () => {
    // 70yo male, 80 kg, SCr 1.2 → (140-70)*80 / (72*1.2) = 64.8 mL/min.
    const m = compute("calc_creatinine_clearance", {
      age_y: 70,
      weight_kg: 80,
      sex: "M",
      serum_creatinine_mg_dl: 1.2,
    });
    expect(m.result).toBe(64.8);
    // Female applies the 0.85 factor.
    const f = compute("calc_creatinine_clearance", {
      age_y: 70,
      weight_kg: 80,
      sex: "F",
      serum_creatinine_mg_dl: 1.2,
    });
    expect(f.result).toBe(55.1);
  });

  it("CKD-EPI 2021 eGFR", () => {
    expect(
      compute("calc_gfr_ckd_epi", { age_y: 60, sex: "M", serum_creatinine_mg_dl: 1.0 }).result,
    ).toBe(86);
    expect(
      compute("calc_gfr_ckd_epi", { age_y: 50, sex: "F", serum_creatinine_mg_dl: 0.8 }).result,
    ).toBe(90);
  });

  it("MELD-Na", () => {
    // bili 2.0, INR 1.5, creat 1.5 → MELD 17.
    expect(
      compute("calc_meld", { bilirubin_mg_dl: 2.0, inr: 1.5, creatinine_mg_dl: 1.5 }).result,
    ).toBe(17);
    // With sodium 130 the sodium correction applies (MELD > 11).
    expect(
      compute("calc_meld", {
        bilirubin_mg_dl: 2.0,
        inr: 1.5,
        creatinine_mg_dl: 1.5,
        sodium_meq_l: 130,
      }).result,
    ).toBe(22);
    // Normal labs floor at 1.0 → MELD floors at 6.
    expect(
      compute("calc_meld", { bilirubin_mg_dl: 1.0, inr: 1.0, creatinine_mg_dl: 1.0 }).result,
    ).toBe(6);
  });
});

describe("cardiology calculators", () => {
  it("CHA₂DS₂-VASc", () => {
    // 76yo female with hypertension + diabetes → age 2 + htn 1 + dm 1 + female 1 = 5.
    const r = compute("calc_chads_vasc", {
      age_y: 76,
      sex: "F",
      congestive_heart_failure: false,
      hypertension: true,
      diabetes: true,
      stroke_tia_thromboembolism: false,
      vascular_disease: false,
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("high");
    // Male with no risk factors → 0.
    expect(
      compute("calc_chads_vasc", {
        age_y: 50,
        sex: "M",
        congestive_heart_failure: false,
        hypertension: false,
        diabetes: false,
        stroke_tia_thromboembolism: false,
        vascular_disease: false,
      }).result,
    ).toBe(0);
  });

  it("HAS-BLED", () => {
    // 70yo: uncontrolled HTN + prior stroke + labile INR + elderly = 4.
    const r = compute("calc_has_bled", {
      age_y: 70,
      uncontrolled_hypertension: true,
      abnormal_renal_function: false,
      abnormal_liver_function: false,
      prior_stroke: true,
      prior_major_bleeding: false,
      labile_inr: true,
      antiplatelet_or_nsaid_use: false,
      alcohol_excess: false,
    });
    expect(r.result).toBe(4);
    expect(r.interpretation.band).toContain("high");
  });

  it("GRACE ACS risk", () => {
    // age 65 (58) + HR 80 (9) + SBP 120 (34) + Cr 1.0 (7) + Killip I (0)
    // + ST deviation (28) + enzymes (14) = 150.
    const r = compute("calc_grace", {
      age_y: 65,
      heart_rate_bpm: 80,
      sbp_mm_hg: 120,
      creatinine_mg_dl: 1.0,
      killip_class: 1,
      cardiac_arrest_at_admission: false,
      st_segment_deviation: true,
      elevated_cardiac_enzymes: true,
    });
    expect(r.result).toBe(150);
    expect(r.interpretation.band).toContain("high");
  });

  it("TIMI for UA/NSTEMI", () => {
    // age ≥65 + ≥3 risk factors + known CAD + ASA + ST dev + marker = 6.
    const r = compute("calc_timi_nstemi", {
      age_y: 70,
      cad_risk_factor_count: 3,
      known_cad: true,
      aspirin_use_past_7d: true,
      severe_angina: false,
      st_deviation: true,
      positive_cardiac_marker: true,
    });
    expect(r.result).toBe(6);
  });
});

describe("pulmonary/VTE calculators", () => {
  it("CURB-65", () => {
    const r = compute("calc_curb65", {
      confusion: true,
      bun_mg_dl: 25,
      respiratory_rate: 32,
      sbp_mm_hg: 85,
      dbp_mm_hg: 70,
      age_y: 70,
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("high");
  });

  it("Wells PE", () => {
    // signs of DVT (3) + PE most likely (3) + HR>100 (1.5) = 7.5.
    const r = compute("calc_wells_pe", {
      clinical_signs_of_dvt: true,
      pe_most_likely_diagnosis: true,
      heart_rate_bpm: 110,
      immobilization_or_surgery: false,
      previous_pe_or_dvt: false,
      hemoptysis: false,
      malignancy: false,
    });
    expect(r.result).toBe(7.5);
    expect(r.interpretation.detail).toContain("PE likely");
  });

  it("Wells DVT", () => {
    // active cancer (1) + tenderness (1) + leg swollen (1) − alternative dx (2) = 1.
    const r = compute("calc_wells_dvt", {
      active_cancer: true,
      paralysis_or_immobilization: false,
      bedridden_or_major_surgery: false,
      localized_tenderness: true,
      entire_leg_swollen: true,
      calf_swelling_3cm: false,
      pitting_edema: false,
      collateral_superficial_veins: false,
      previous_dvt: false,
      alternative_diagnosis_likely: true,
    });
    expect(r.result).toBe(1);
  });

  it("PESI", () => {
    // age 70 (70) + male (10) + HR≥110 (20) = 100 → Class III.
    const r = compute("calc_pesi", {
      age_y: 70,
      sex: "M",
      cancer: false,
      heart_failure: false,
      chronic_lung_disease: false,
      heart_rate_bpm: 120,
      sbp_mm_hg: 110,
      respiratory_rate: 24,
      temperature_c: 37,
      altered_mental_status: false,
      oxygen_saturation_pct: 96,
    });
    expect(r.result).toBe(100);
    expect(r.interpretation.band).toContain("Class III");
  });

  it("PERC rule", () => {
    const negative = compute("calc_perc", {
      age_y: 40,
      heart_rate_bpm: 80,
      oxygen_saturation_pct: 98,
      unilateral_leg_swelling: false,
      hemoptysis: false,
      recent_surgery_or_trauma: false,
      prior_pe_or_dvt: false,
      hormone_use: false,
    });
    expect(negative.result).toBe(0);
    expect(negative.interpretation.band).toBe("PERC negative");
    // Age ≥50 is a positive criterion.
    expect(
      compute("calc_perc", {
        age_y: 55,
        heart_rate_bpm: 80,
        oxygen_saturation_pct: 98,
        unilateral_leg_swelling: false,
        hemoptysis: false,
        recent_surgery_or_trauma: false,
        prior_pe_or_dvt: false,
        hormone_use: false,
      }).interpretation.band,
    ).toBe("PERC positive");
  });
});

describe("critical-care calculators", () => {
  const normalApache = {
    temperature_c: 37,
    mean_arterial_pressure_mm_hg: 90,
    heart_rate_bpm: 80,
    respiratory_rate: 16,
    fio2: 0.21,
    pao2_mm_hg: 95,
    arterial_ph: 7.4,
    serum_sodium_meq_l: 140,
    serum_potassium_meq_l: 4.0,
    serum_creatinine_mg_dl: 1.0,
    acute_renal_failure: false,
    hematocrit_pct: 40,
    wbc_10e3_per_mm3: 8,
    glasgow_coma_scale: 15,
    age_y: 40,
    severe_organ_insufficiency: false,
    admission_type: "nonoperative",
  };

  it("APACHE II — all-normal physiology scores 0", () => {
    expect(compute("calc_apache_ii", normalApache).result).toBe(0);
  });

  it("APACHE II — deranged physiology", () => {
    const r = compute("calc_apache_ii", {
      ...normalApache,
      temperature_c: 35, // 1
      mean_arterial_pressure_mm_hg: 60, // 2
      heart_rate_bpm: 130, // 2
      respiratory_rate: 30, // 1
      pao2_mm_hg: 58, // 3 (FiO2 < 0.5)
      arterial_ph: 7.3, // 2
      serum_potassium_meq_l: 6.0, // 3
      serum_creatinine_mg_dl: 2.5, // 3, doubled to 6
      acute_renal_failure: true,
      hematocrit_pct: 28, // 2
      wbc_10e3_per_mm3: 16, // 1
      glasgow_coma_scale: 10, // 5
      age_y: 70, // 5
      severe_organ_insufficiency: true, // 5 (nonoperative)
    });
    expect(r.result).toBe(38);
  });

  it("APACHE II requires the A-a gradient when FiO2 ≥ 0.5", () => {
    expect(() => compute("calc_apache_ii", { ...normalApache, fio2: 0.6 })).toThrow();
  });

  it("SOFA — all-normal physiology scores 0", () => {
    expect(
      compute("calc_sofa", {
        pao2_fio2_ratio: 450,
        on_respiratory_support: false,
        platelets_10e3_per_ul: 200,
        bilirubin_mg_dl: 0.5,
        mean_arterial_pressure_mm_hg: 80,
        glasgow_coma_scale: 15,
        creatinine_mg_dl: 1.0,
      }).result,
    ).toBe(0);
  });

  it("SOFA — multi-organ dysfunction", () => {
    const r = compute("calc_sofa", {
      pao2_fio2_ratio: 150, // 3 (on support, ≥100)
      on_respiratory_support: true,
      platelets_10e3_per_ul: 40, // 3
      bilirubin_mg_dl: 7, // 3
      mean_arterial_pressure_mm_hg: 60,
      norepinephrine_mcg_kg_min: 0.2, // 4
      glasgow_coma_scale: 9, // 3
      creatinine_mg_dl: 4.0, // 3
    });
    expect(r.result).toBe(19);
  });

  it("qSOFA", () => {
    const r = compute("calc_qsofa", {
      respiratory_rate: 24,
      altered_mentation: true,
      sbp_mm_hg: 95,
    });
    expect(r.result).toBe(3);
    expect(r.interpretation.band).toContain("high");
  });
});
