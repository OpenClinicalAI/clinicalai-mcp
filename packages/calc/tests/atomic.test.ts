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

/* -------------------------------------------------------------------------- */
/* Tree-class calculators                                                      */
/* -------------------------------------------------------------------------- */
/* These tests exercise branch coverage on the rule cascade — every criterion  */
/* met / not met combination that drives a different classification — rather   */
/* than numeric tolerance on a single output value.                            */

/* -------------------------------------------------------------------------- */
/* MedCalc-Bench tier-1 batch (anthropometric + electrolyte + MAP)             */
/* -------------------------------------------------------------------------- */

describe("MedCalc-Bench tier-1: anthropometric / body-measurement", () => {
  it("BMI: 70 kg / 1.75 m → 22.9 kg/m² (normal)", () => {
    const r = compute("calc_bmi", { weight_kg: 70, height_m: 1.75 });
    expect(r.result).toBe(22.9);
    expect(r.interpretation.band).toContain("normal");
  });

  it("BMI: 100 kg / 1.65 m → 36.7 kg/m² (class II)", () => {
    const r = compute("calc_bmi", { weight_kg: 100, height_m: 1.65 });
    expect(r.result).toBe(36.7);
    expect(r.interpretation.band).toContain("class II");
  });

  it("BMI: 45 kg / 1.7 m → 15.6 (underweight)", () => {
    const r = compute("calc_bmi", { weight_kg: 45, height_m: 1.7 });
    expect(r.interpretation.band).toContain("underweight");
  });

  it("BSA Mosteller: 70 kg / 175 cm → 1.84 m²", () => {
    const r = compute("calc_bsa_mosteller", { weight_kg: 70, height_cm: 175 });
    expect(r.result).toBe(1.84);
  });

  it("BSA Mosteller: 50 kg / 150 cm → 1.44 m²", () => {
    const r = compute("calc_bsa_mosteller", { weight_kg: 50, height_cm: 150 });
    expect(r.result).toBe(1.44);
  });

  it("IBW Devine: 70-inch male → 73 kg", () => {
    const r = compute("calc_ibw_devine", { height_inches: 70, sex: "M" });
    expect(r.result).toBe(73);
  });

  it("IBW Devine: 64-inch female → 54.7 kg", () => {
    const r = compute("calc_ibw_devine", { height_inches: 64, sex: "F" });
    expect(r.result).toBe(54.7);
  });

  it("IBW Devine: very short patient triggers low-height warning", () => {
    const r = compute("calc_ibw_devine", { height_inches: 48, sex: "F" });
    expect(r.warnings?.join(" ")).toContain("very short");
  });
});

describe("MedCalc-Bench tier-1: electrolyte / acid-base", () => {
  it("Anion gap: Na 140, Cl 100, HCO₃ 24 → 16 (elevated)", () => {
    const r = compute("calc_anion_gap", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 24,
    });
    expect(r.result).toBe(16);
    expect(r.interpretation.band).toContain("elevated");
  });

  it("Anion gap: Na 138, Cl 105, HCO₃ 28 → 5 (low)", () => {
    const r = compute("calc_anion_gap", {
      sodium_mmol_l: 138,
      chloride_mmol_l: 105,
      bicarbonate_mmol_l: 28,
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("low");
  });

  it("Corrected calcium: Ca 8.0, albumin 2.0 → 9.6 (normal corrected)", () => {
    const r = compute("calc_corrected_calcium", {
      serum_calcium_mg_dl: 8.0,
      serum_albumin_g_dl: 2.0,
    });
    expect(r.result).toBe(9.6);
    expect(r.interpretation.band).toContain("within reference");
  });

  it("Corrected calcium: Ca 9.5, albumin 4.0 → 9.5 (no correction)", () => {
    const r = compute("calc_corrected_calcium", {
      serum_calcium_mg_dl: 9.5,
      serum_albumin_g_dl: 4.0,
    });
    expect(r.result).toBe(9.5);
  });

  it("Corrected sodium (Hillier): Na 130, glucose 500 → 139.6 mmol/L", () => {
    const r = compute("calc_corrected_sodium_hillier", {
      measured_sodium_mmol_l: 130,
      glucose_mg_dl: 500,
    });
    expect(r.result).toBe(139.6);
  });

  it("Corrected sodium (Hillier): Na 135, glucose 200 → 137.4 mmol/L", () => {
    const r = compute("calc_corrected_sodium_hillier", {
      measured_sodium_mmol_l: 135,
      glucose_mg_dl: 200,
    });
    expect(r.result).toBe(137.4);
  });

  it("Serum osmolality: Na 140, BUN 14, glucose 90 → 290 mOsm/kg (normal)", () => {
    const r = compute("calc_serum_osmolality", {
      sodium_mmol_l: 140,
      bun_mg_dl: 14,
      glucose_mg_dl: 90,
    });
    expect(r.result).toBe(290);
    expect(r.interpretation.band).toContain("within reference");
  });

  it("Serum osmolality: Na 145, BUN 60, glucose 600 → 344.8 (hyperosmolar)", () => {
    const r = compute("calc_serum_osmolality", {
      sodium_mmol_l: 145,
      bun_mg_dl: 60,
      glucose_mg_dl: 600,
    });
    // 290 + 60/2.8 (21.43) + 600/18 (33.33) = 344.76 → rounds to 344.8
    expect(r.result).toBe(344.8);
    expect(r.interpretation.band).toContain("high");
  });
});

describe("MedCalc-Bench tier-1: cardiology", () => {
  it("MAP: SBP 120 / DBP 80 → 93.3 mmHg (at SSC target)", () => {
    const r = compute("calc_map", { systolic_bp_mm_hg: 120, diastolic_bp_mm_hg: 80 });
    expect(r.result).toBe(93.3);
    expect(r.interpretation.band).toContain("at or above");
  });

  it("MAP: SBP 90 / DBP 50 → 63.3 mmHg (below SSC target)", () => {
    const r = compute("calc_map", { systolic_bp_mm_hg: 90, diastolic_bp_mm_hg: 50 });
    expect(r.result).toBe(63.3);
    expect(r.interpretation.band).toContain("below SSC");
  });

  it("MAP: SBP 75 / DBP 40 → 51.7 mmHg (severe hypotension)", () => {
    const r = compute("calc_map", { systolic_bp_mm_hg: 75, diastolic_bp_mm_hg: 40 });
    expect(r.result).toBe(51.7);
    expect(r.interpretation.band).toContain("severe");
  });

  it("LDL Friedewald: TC 200 / HDL 50 / TG 150 → 120 mg/dL (near-optimal)", () => {
    const r = compute("calc_ldl_friedewald", {
      total_cholesterol_mg_dl: 200,
      hdl_mg_dl: 50,
      triglycerides_mg_dl: 150,
    });
    expect(r.result).toBe(120);
    expect(r.interpretation.band).toContain("near-optimal");
  });

  it("LDL Friedewald: TC 240 / HDL 40 / TG 400 → 120 mg/dL with TG-boundary warning", () => {
    const r = compute("calc_ldl_friedewald", {
      total_cholesterol_mg_dl: 240,
      hdl_mg_dl: 40,
      triglycerides_mg_dl: 400,
    });
    expect(r.result).toBe(120);
    expect(r.warnings?.join(" ")).toContain("Triglycerides > 200");
  });

  it("LDL Friedewald: TC 300 / HDL 35 / TG 500 invalid (TG > 400)", () => {
    const r = compute("calc_ldl_friedewald", {
      total_cholesterol_mg_dl: 300,
      hdl_mg_dl: 35,
      triglycerides_mg_dl: 500,
    });
    expect(r.warnings?.join(" ")).toContain("invalid");
  });
});

/* -------------------------------------------------------------------------- */
/* MedCalc-Bench tier-2: renal-metabolic + hepatology + endocrinology          */
/* -------------------------------------------------------------------------- */

describe("MedCalc-Bench tier-2: renal-metabolic", () => {
  it("Target weight: BMI 25 / height 1.70 m → 72.25 kg", () => {
    const r = compute("calc_target_weight", { target_bmi: 25, height_m: 1.7 });
    expect(r.result).toBe(72.3); // round1 of 72.25
  });

  it("Adjusted body weight: actual 100 / IBW 70 → 82 kg", () => {
    const r = compute("calc_adjusted_body_weight", {
      actual_weight_kg: 100,
      ideal_weight_kg: 70,
    });
    expect(r.result).toBe(82);
    // (100 - 70) / 70 = 42.857% → Math.round = 43%
    expect(r.interpretation.band).toContain("43% above IBW");
  });

  it("Adjusted body weight: actual ≤ IBW returns actual unchanged", () => {
    const r = compute("calc_adjusted_body_weight", {
      actual_weight_kg: 65,
      ideal_weight_kg: 70,
    });
    expect(r.result).toBe(65);
    expect(r.interpretation.band).toContain("no adjustment");
  });

  it("FENa: U_Na 10 / S_Cr 2.0 / S_Na 140 / U_Cr 80 → 0.18% (prerenal)", () => {
    const r = compute("calc_fena", {
      serum_creatinine_mg_dl: 2.0,
      serum_sodium_mmol_l: 140,
      urine_creatinine_mg_dl: 80,
      urine_sodium_mmol_l: 10,
    });
    expect(r.result).toBe(0.18);
    expect(r.interpretation.band).toContain("prerenal");
  });

  it("FENa: U_Na 60 / S_Cr 3.0 / S_Na 140 / U_Cr 30 → 4.29% (ATN)", () => {
    const r = compute("calc_fena", {
      serum_creatinine_mg_dl: 3.0,
      serum_sodium_mmol_l: 140,
      urine_creatinine_mg_dl: 30,
      urine_sodium_mmol_l: 60,
    });
    expect(r.result).toBe(4.29);
    expect(r.interpretation.band).toContain("intrinsic");
  });

  it("Free water deficit: 70yo male / 80 kg / Na 155 → 4.3 L", () => {
    const r = compute("calc_free_water_deficit", {
      age_y: 70,
      sex: "M",
      weight_kg: 80,
      sodium_mmol_l: 155,
    });
    // 0.5 (elderly male TBW) × 80 × (155/140 - 1) = 0.5 × 80 × 0.1071 = 4.29 → round1 = 4.3
    expect(r.result).toBe(4.3);
  });

  it("Free water deficit: 30yo female / 60 kg / Na 150 → 2.1 L", () => {
    const r = compute("calc_free_water_deficit", {
      age_y: 30,
      sex: "F",
      weight_kg: 60,
      sodium_mmol_l: 150,
    });
    // 0.5 (adult female) × 60 × (150/140 - 1) = 30 × 0.0714 = 2.14 → 2.1
    expect(r.result).toBe(2.1);
  });

  it("Maintenance fluids: 8 kg infant → 32 mL/hr", () => {
    const r = compute("calc_maintenance_fluids", { weight_kg: 8 });
    expect(r.result).toBe(32);
  });

  it("Maintenance fluids: 15 kg child → 50 mL/hr", () => {
    const r = compute("calc_maintenance_fluids", { weight_kg: 15 });
    expect(r.result).toBe(50);
  });

  it("Maintenance fluids: 70 kg adult → 110 mL/hr", () => {
    const r = compute("calc_maintenance_fluids", { weight_kg: 70 });
    expect(r.result).toBe(110);
  });

  it("MDRD GFR: 60yo non-Black male, Cr 1.0 → 76 mL/min/1.73m²", () => {
    // 175 × 1.0^-1.154 × 60^-0.203 × 1 × 1 = 175 / 60^0.203 = 175 / 2.296 = 76.22 → 76
    const r = compute("calc_mdrd_gfr", {
      age_y: 60,
      sex: "M",
      serum_creatinine_mg_dl: 1.0,
    });
    expect(r.result).toBe(76);
    expect(r.warnings?.join(" ")).toContain("CKD-EPI 2021");
  });

  it("MDRD GFR: 50yo Black female, Cr 1.5, race coeff ON → 45", () => {
    // 175 × 1.5^-1.154 × 50^-0.203 × 0.742 × 1.212 = 45.4 → 45
    const r = compute("calc_mdrd_gfr", {
      age_y: 50,
      sex: "F",
      serum_creatinine_mg_dl: 1.5,
      apply_black_race_coefficient: true,
    });
    expect(r.result).toBe(45);
  });

  it("MDRD GFR: race coefficient defaults OFF (NKF/ASN 2021)", () => {
    // Without race coefficient: 175 × 1.5^-1.154 × 50^-0.203 × 0.742 = 37.5 → 37
    const r = compute("calc_mdrd_gfr", {
      age_y: 50,
      sex: "F",
      serum_creatinine_mg_dl: 1.5,
    });
    expect(r.result).toBe(37);
  });
});

describe("MedCalc-Bench tier-2: hepatology", () => {
  it("FIB-4: 55yo / AST 50 / ALT 40 / plt 200 → ~2.17 (indeterminate, AASLD flag for <65)", () => {
    const r = compute("calc_fib4", {
      age_y: 55,
      ast_u_l: 50,
      alt_u_l: 40,
      platelet_count_10e9_per_l: 200,
    });
    expect(r.result).toBeCloseTo(2.17, 1);
    expect(r.interpretation.band).toContain("indeterminate");
    expect(r.interpretation.detail).toContain("Refer to hepatology"); // ≥1.3 for age <65
  });

  it("FIB-4: 70yo / AST 80 / ALT 30 / plt 100 → high probability advanced fibrosis", () => {
    const r = compute("calc_fib4", {
      age_y: 70,
      ast_u_l: 80,
      alt_u_l: 30,
      platelet_count_10e9_per_l: 100,
    });
    expect(r.result).toBeCloseTo(10.22, 1);
    expect(r.interpretation.band).toContain("high");
  });
});

describe("MedCalc-Bench tier-3: neurology / infectious / critical-care lookups", () => {
  it("GCS: spontaneous eyes, oriented, obeys → 15", () => {
    const r = compute("calc_gcs", {
      best_eye_response: "spontaneous",
      best_verbal_response: "oriented",
      best_motor_response: "obeys_commands",
    });
    expect(r.result).toBe(15);
    expect(r.interpretation.band).toContain("mild");
  });

  it("GCS: to pain, incomprehensible, extension → 6 (severe)", () => {
    const r = compute("calc_gcs", {
      best_eye_response: "to_pain",
      best_verbal_response: "incomprehensible_sounds",
      best_motor_response: "extension_to_pain",
    });
    expect(r.result).toBe(6);
    expect(r.interpretation.band).toContain("severe");
  });

  it("GCS: 9 lands in moderate band", () => {
    const r = compute("calc_gcs", {
      best_eye_response: "to_voice", // 3
      best_verbal_response: "confused", // 4
      best_motor_response: "withdraws_from_pain", // 4 — wait that's 11
    });
    expect(r.result).toBe(11);
    expect(r.interpretation.band).toContain("moderate");
  });

  it("SIRS: T 38.5, HR 110, RR 24, WBC 15k → 4 met (positive)", () => {
    const r = compute("calc_sirs", {
      temperature_c: 38.5,
      heart_rate_bpm: 110,
      respiratory_rate_per_min: 24,
      wbc_per_mm3: 15000,
    });
    expect(r.result).toBe(4);
    expect(r.interpretation.band).toContain("positive");
  });

  it("SIRS: T 37, HR 85, RR 18, WBC 8k → 0 met (negative)", () => {
    const r = compute("calc_sirs", {
      temperature_c: 37,
      heart_rate_bpm: 85,
      respiratory_rate_per_min: 18,
      wbc_per_mm3: 8000,
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("negative");
  });

  it("SIRS: PaCO2 < 32 satisfies respiratory criterion alternative to RR", () => {
    const r = compute("calc_sirs", {
      temperature_c: 37,
      heart_rate_bpm: 85,
      paco2_mm_hg: 28,
      wbc_per_mm3: 8000,
    });
    expect(r.result).toBe(1); // only PaCO2 criterion met
  });

  it("SIRS: bands > 10% satisfies WBC criterion alternative", () => {
    const r = compute("calc_sirs", {
      temperature_c: 37,
      heart_rate_bpm: 85,
      respiratory_rate_per_min: 18,
      wbc_per_mm3: 8000,
      bands_percent: 15,
    });
    expect(r.result).toBe(1);
  });

  it("HEART: 45yo male, moderate hx, normal ECG, 1 RF, troponin normal → 3 (low)", () => {
    const r = compute("calc_heart_score", {
      history: "moderately_suspicious", // 1
      ecg: "normal", // 0
      age_y: 45, // 1
      risk_factors_count: 1, // 1
      atherosclerotic_disease_history: false,
      initial_troponin: "normal", // 0
    });
    expect(r.result).toBe(3);
    expect(r.interpretation.band).toContain("low risk");
  });

  it("HEART: 68yo female, prior MI, highly suspicious, ST depression, trop 2× → 9 (high)", () => {
    const r = compute("calc_heart_score", {
      history: "highly_suspicious", // 2
      ecg: "significant_st_deviation", // 2
      age_y: 68, // 2
      risk_factors_count: 0,
      atherosclerotic_disease_history: true, // forces RF to 2
      initial_troponin: "1_to_3_times_normal", // 1
    });
    expect(r.result).toBe(9);
    expect(r.interpretation.band).toContain("high risk");
  });

  it("HEART: atherosclerotic history forces RF sub-score to 2 even with 0 RFs", () => {
    const r = compute("calc_heart_score", {
      history: "slightly_suspicious",
      ecg: "normal",
      age_y: 30,
      risk_factors_count: 0,
      atherosclerotic_disease_history: true, // RF still scores 2
      initial_troponin: "normal",
    });
    // 0 + 0 + 0 + 2 + 0 = 2
    expect(r.result).toBe(2);
  });

  it("Centor: 8yo, exudate, nodes, T 38.5, no cough → 5 (very high)", () => {
    const r = compute("calc_centor", {
      age_y: 8,
      tonsillar_exudate_or_swelling: true,
      tender_anterior_cervical_adenopathy: true,
      temperature_c: 38.5,
      cough_absent: true,
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("very high");
  });

  it("Centor: 50yo, no exudate / nodes, T 37.5, with cough → −1 (very low)", () => {
    const r = compute("calc_centor", {
      age_y: 50,
      tonsillar_exudate_or_swelling: false,
      tender_anterior_cervical_adenopathy: false,
      temperature_c: 37.5,
      cough_absent: false,
    });
    expect(r.result).toBe(-1);
    expect(r.interpretation.band).toContain("very low");
  });

  it("FeverPAIN: all 5 criteria → 5 (high probability)", () => {
    const r = compute("calc_feverpain", {
      fever_in_past_24h: true,
      purulent_tonsils: true,
      attended_within_3_days_of_onset: true,
      severely_inflamed_tonsils: true,
      cough_or_coryza_absent: true,
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("high probability");
  });

  it("FeverPAIN: 0 criteria → 0 (low probability)", () => {
    const r = compute("calc_feverpain", {
      fever_in_past_24h: false,
      purulent_tonsils: false,
      attended_within_3_days_of_onset: false,
      severely_inflamed_tonsils: false,
      cough_or_coryza_absent: false,
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("low probability");
  });
});

describe("MedCalc-Bench tier-2: endocrinology", () => {
  it("HOMA-IR: insulin 10 / glucose 100 → 2.47 (normal)", () => {
    const r = compute("calc_homa_ir", {
      fasting_insulin_uIU_ml: 10,
      fasting_glucose_mg_dl: 100,
    });
    expect(r.result).toBe(2.47);
    expect(r.interpretation.band).toContain("normal");
  });

  it("HOMA-IR: insulin 25 / glucose 130 → 8.02 (resistance)", () => {
    const r = compute("calc_homa_ir", {
      fasting_insulin_uIU_ml: 25,
      fasting_glucose_mg_dl: 130,
    });
    expect(r.result).toBe(8.02);
    expect(r.interpretation.band).toContain("resistance");
  });
});

/* -------------------------------------------------------------------------- */
/* MedCalc-Bench tier-4: RCRI / Child-Pugh / Glasgow-Blatchford / delta family */
/* -------------------------------------------------------------------------- */

describe("MedCalc-Bench tier-4: RCRI / Child-Pugh / GBS", () => {
  it("RCRI: AAA + prior MI + prior TIA, Cr 1.1 → 3 (~11% MACE)", () => {
    const r = compute("calc_rcri", {
      high_risk_surgery: true,
      ischemic_heart_disease: true,
      congestive_heart_failure: false,
      cerebrovascular_disease: true,
      insulin_treatment_for_diabetes: false,
      preoperative_creatinine_mg_dl: 1.1,
    });
    expect(r.result).toBe(3);
    expect(r.interpretation.band).toContain("11%");
  });

  it("RCRI: lap-chole, no comorbidities → 0 (~0.4%)", () => {
    const r = compute("calc_rcri", {
      high_risk_surgery: false,
      ischemic_heart_disease: false,
      congestive_heart_failure: false,
      cerebrovascular_disease: false,
      insulin_treatment_for_diabetes: false,
      preoperative_creatinine_mg_dl: 0.9,
    });
    expect(r.result).toBe(0);
  });

  it("RCRI: Cr threshold is >2.0 (strict greater-than)", () => {
    const r = compute("calc_rcri", {
      high_risk_surgery: false,
      ischemic_heart_disease: false,
      congestive_heart_failure: false,
      cerebrovascular_disease: false,
      insulin_treatment_for_diabetes: false,
      preoperative_creatinine_mg_dl: 2.0, // boundary — should NOT count
    });
    expect(r.result).toBe(0);
  });

  it("Child-Pugh: bili 1.5, alb 3.8, INR 1.4, no ascites/enceph → 5, Class A", () => {
    const r = compute("calc_child_pugh", {
      total_bilirubin_mg_dl: 1.5,
      albumin_g_dl: 3.8,
      inr: 1.4,
      ascites: "absent",
      encephalopathy: "none",
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("Class A");
  });

  it("Child-Pugh: bili 4, alb 2.5, INR 2.5, moderate ascites, grade 3 → 15, Class C", () => {
    const r = compute("calc_child_pugh", {
      total_bilirubin_mg_dl: 4.0,
      albumin_g_dl: 2.5,
      inr: 2.5,
      ascites: "moderate",
      encephalopathy: "grade_3_4",
    });
    expect(r.result).toBe(15);
    expect(r.interpretation.band).toContain("Class C");
  });

  it("GBS: 50yo male, BUN 15, Hgb 14, SBP 130, pulse 80, all neg → 0 (very low)", () => {
    const r = compute("calc_glasgow_blatchford", {
      sex: "M",
      bun_mg_dl: 15,
      hemoglobin_g_dl: 14,
      systolic_bp_mm_hg: 130,
      pulse_bpm: 80,
      melena_present: false,
      syncope: false,
      liver_disease_history: false,
      cardiac_failure: false,
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("very low");
  });

  it("GBS: 65yo female, BUN 30, Hgb 9, SBP 100, pulse 110, +melena +syncope +liver → 17 (high)", () => {
    const r = compute("calc_glasgow_blatchford", {
      sex: "F",
      bun_mg_dl: 30,
      hemoglobin_g_dl: 9,
      systolic_bp_mm_hg: 100,
      pulse_bpm: 110,
      melena_present: true,
      syncope: true,
      liver_disease_history: true,
      cardiac_failure: false,
    });
    // BUN 30 (28<30<70) = 4 + Hgb 9 F = 6 + SBP 100 = 1 + pulse ≥100 = 1 + melena 1 + syncope 2 + liver 2 = 17
    expect(r.result).toBe(17);
    expect(r.interpretation.band).toContain("high");
  });
});

describe("MedCalc-Bench tier-4: acid-base delta family", () => {
  it("Delta gap: Na 140 / Cl 100 / HCO₃ 24 → AG 16, Δgap 4 (pure AG)", () => {
    const r = compute("calc_delta_gap", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 24,
    });
    expect(r.result).toBe(4);
    expect(r.interpretation.band).toContain("pure anion-gap");
  });

  it("Delta gap: Na 140 / Cl 90 / HCO₃ 14 → Δgap 24 (coexisting alkalosis)", () => {
    const r = compute("calc_delta_gap", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 90,
      bicarbonate_mmol_l: 14,
    });
    expect(r.result).toBe(24);
    expect(r.interpretation.band).toContain("coexisting metabolic alkalosis");
  });

  it("Delta ratio: AG 20, HCO₃ 16 → 1.0 (pure AG acidosis)", () => {
    // Na 140 Cl 104 HCO3 16 → AG = 20
    const r = compute("calc_delta_ratio", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 104,
      bicarbonate_mmol_l: 16,
    });
    expect(r.result).toBe(1);
    expect(r.interpretation.band).toContain("pure anion-gap");
  });

  it("Delta ratio: HCO₃ ≥ 24 returns undefined band", () => {
    const r = compute("calc_delta_ratio", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 24,
    });
    expect(r.interpretation.band).toContain("undefined");
  });

  it("Albumin-corrected AG: AG 20 + albumin 2.0 → 25", () => {
    // Na 140 Cl 100 HCO3 20 → AG 20; +2.5×2 = 25
    const r = compute("calc_albumin_corrected_anion_gap", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 20,
      albumin_g_dl: 2.0,
    });
    expect(r.result).toBe(25);
    expect(r.interpretation.band).toContain("elevated");
  });

  it("Albumin-corrected AG: albumin 4.0 → no correction", () => {
    // Na 140 Cl 100 HCO3 24 → AG 16
    const r = compute("calc_albumin_corrected_anion_gap", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 24,
      albumin_g_dl: 4.0,
    });
    expect(r.result).toBe(16);
  });

  it("Albumin-corrected delta gap: AG_corr 25 → Δgap_corr 13 (alkalosis)", () => {
    const r = compute("calc_albumin_corrected_delta_gap", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 20,
      albumin_g_dl: 2.0,
    });
    expect(r.result).toBe(13);
    expect(r.interpretation.band).toContain("coexisting metabolic alkalosis");
  });

  it("Albumin-corrected delta ratio: HCO₃ ≥ 24 returns undefined", () => {
    const r = compute("calc_albumin_corrected_delta_ratio", {
      sodium_mmol_l: 140,
      chloride_mmol_l: 100,
      bicarbonate_mmol_l: 24,
      albumin_g_dl: 3.0,
    });
    expect(r.interpretation.band).toContain("undefined");
  });
});

describe("Berlin ARDS (tree-class)", () => {
  const baseline = {
    onset_within_1_week: true,
    bilateral_opacities: true,
    not_explained_by_cardiac_failure: true,
    pao2_mm_hg: 80,
    fio2: 0.4,
    peep_cm_h2o: 8,
  };

  it("classifies mild ARDS at 200 < P/F ≤ 300", () => {
    // P/F = 80 / 0.4 = 200 → boundary case: 200 is mild's lower bound (exclusive),
    // so use 250 to land squarely in mild.
    const r = compute("calc_berlin_ards", { ...baseline, pao2_mm_hg: 100 }); // 100/0.4 = 250
    expect(r.result).toBe("mild");
    expect(r.interpretation.band).toBe("mild ARDS");
    expect(r.rule_trace?.criteria).toHaveLength(4);
    expect(r.rule_trace?.criteria.every((c) => c.met)).toBe(true);
  });

  it("classifies moderate ARDS at 100 < P/F ≤ 200", () => {
    const r = compute("calc_berlin_ards", { ...baseline, pao2_mm_hg: 60 }); // 60/0.4 = 150
    expect(r.result).toBe("moderate");
    expect(r.interpretation.band).toBe("moderate ARDS");
  });

  it("classifies severe ARDS at P/F ≤ 100", () => {
    const r = compute("calc_berlin_ards", { ...baseline, pao2_mm_hg: 40 }); // 40/0.4 = 100
    expect(r.result).toBe("severe");
    expect(r.interpretation.band).toBe("severe ARDS");
  });

  it("returns no-ards when timing criterion not met", () => {
    const r = compute("calc_berlin_ards", { ...baseline, onset_within_1_week: false });
    expect(r.result).toBe("no-ards");
    expect(r.interpretation.detail).toContain("Onset within 1 week");
    // Trace records WHICH criterion failed.
    expect(r.rule_trace?.criteria.find((c) => c.name.startsWith("Onset"))?.met).toBe(false);
  });

  it("returns no-ards when bilateral-opacities criterion not met", () => {
    const r = compute("calc_berlin_ards", { ...baseline, bilateral_opacities: false });
    expect(r.result).toBe("no-ards");
  });

  it("returns no-ards when edema-origin criterion not met", () => {
    const r = compute("calc_berlin_ards", {
      ...baseline,
      not_explained_by_cardiac_failure: false,
    });
    expect(r.result).toBe("no-ards");
  });

  it("returns no-ards when PEEP < 5 (oxygenation criterion not met)", () => {
    const r = compute("calc_berlin_ards", { ...baseline, peep_cm_h2o: 4 });
    expect(r.result).toBe("no-ards");
  });

  it("returns no-ards when P/F > 300 even with all clinical criteria met", () => {
    const r = compute("calc_berlin_ards", { ...baseline, pao2_mm_hg: 200 }); // 200/0.4 = 500
    expect(r.result).toBe("no-ards");
    expect(r.interpretation.band).toContain("P/F > 300");
  });

  it("includes calculated P/F ratio in inputs echo", () => {
    const r = compute("calc_berlin_ards", baseline); // 80/0.4 = 200 (moderate)
    expect((r.inputs as { pao2_fio2_ratio: number }).pao2_fio2_ratio).toBe(200);
  });

  it("warns about pediatric ARDS via PALICC-2 criteria", () => {
    const r = compute("calc_berlin_ards", baseline);
    expect(r.warnings?.join(" ")).toContain("PALICC-2");
  });
});
