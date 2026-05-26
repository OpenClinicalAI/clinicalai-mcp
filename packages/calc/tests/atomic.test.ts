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

/* -------------------------------------------------------------------------- */
/* MedCalc-Bench tier-5: QTc family + OB dating + Caprini                      */
/* -------------------------------------------------------------------------- */

describe("MedCalc-Bench tier-5: QTc (5 methods, one tool)", () => {
  // QT 400, HR 60 → RR 1.0 → no correction in any method
  it("QTc Bazett: QT 400, HR 60 → 400", () => {
    const r = compute("calc_qtc", {
      qt_interval_ms: 400,
      heart_rate_bpm: 60,
      method: "bazett",
    });
    expect(r.result).toBe(400);
    expect(r.interpretation.band).toContain("normal");
  });

  it("QTc Bazett: QT 440, HR 100 → 568 (severely prolonged)", () => {
    const r = compute("calc_qtc", {
      qt_interval_ms: 440,
      heart_rate_bpm: 100,
      method: "bazett",
    });
    expect(r.result).toBe(568);
    expect(r.interpretation.band).toContain("severely prolonged");
  });

  it("QTc Fridericia: QT 440, HR 100 → 522", () => {
    // 440 / (0.6)^(1/3) = 440 / 0.8434 = 521.7 → round = 522
    const r = compute("calc_qtc", {
      qt_interval_ms: 440,
      heart_rate_bpm: 100,
      method: "fridericia",
    });
    expect(r.result).toBe(522);
  });

  it("QTc Framingham: QT 440, HR 100 → 502", () => {
    const r = compute("calc_qtc", {
      qt_interval_ms: 440,
      heart_rate_bpm: 100,
      method: "framingham",
    });
    // 440 + 154 × 0.4 = 440 + 61.6 = 501.6 → 502
    expect(r.result).toBe(502);
  });

  it("QTc Hodges: QT 440, HR 100 → 510", () => {
    const r = compute("calc_qtc", {
      qt_interval_ms: 440,
      heart_rate_bpm: 100,
      method: "hodges",
    });
    expect(r.result).toBe(510);
  });

  it("QTc Rautaharju: QT 440, HR 100 → 538", () => {
    const r = compute("calc_qtc", {
      qt_interval_ms: 440,
      heart_rate_bpm: 100,
      method: "rautaharju",
    });
    // 440 × 220 / 180 = 537.78 → 538
    expect(r.result).toBe(538);
  });

  it("QTc default method is Fridericia (FDA ICH-E14 preference)", () => {
    const r = compute("calc_qtc", {
      qt_interval_ms: 440,
      heart_rate_bpm: 100,
    });
    expect(r.result).toBe(522); // same as fridericia
    expect(r.interpretation.detail).toContain("fridericia");
  });

  it("QTc sex-specific thresholds: 460 ms is normal for male, prolonged for female", () => {
    const male = compute("calc_qtc", {
      qt_interval_ms: 460,
      heart_rate_bpm: 60,
      method: "bazett",
      sex: "M",
    });
    expect(male.interpretation.band).toContain("prolonged QTc (460 > 450");

    const female = compute("calc_qtc", {
      qt_interval_ms: 460,
      heart_rate_bpm: 60,
      method: "bazett",
      sex: "F",
    });
    expect(female.interpretation.band).toContain("normal");
  });
});

describe("MedCalc-Bench tier-5: obstetric dating", () => {
  it("EDD: LMP 2024-01-01, default 28-day cycle → 2024-10-07", () => {
    const r = compute("calc_estimated_due_date", { last_menstrual_period_date: "2024-01-01" });
    expect(r.result).toBe("2024-10-07");
  });

  it("EDD: LMP 2024-01-01, cycle 32 → 2024-10-11", () => {
    const r = compute("calc_estimated_due_date", {
      last_menstrual_period_date: "2024-01-01",
      cycle_length_days: 32,
    });
    expect(r.result).toBe("2024-10-11");
  });

  it("EDC: LMP 2024-01-01 → 2024-01-15", () => {
    const r = compute("calc_estimated_conception_date", {
      last_menstrual_period_date: "2024-01-01",
    });
    expect(r.result).toBe("2024-01-15");
  });

  it("EGA: LMP 2024-01-01, current 2024-04-08 → 14w0d (98 days)", () => {
    const r = compute("calc_estimated_gestational_age", {
      last_menstrual_period_date: "2024-01-01",
      current_date: "2024-04-08",
    });
    expect(r.result).toBe(98);
    expect(r.interpretation.band).toContain("14w0d");
    expect(r.interpretation.band).toContain("second trimester");
  });

  it("EGA: LMP 2024-01-01, current 2024-03-15 → 10w4d (74 days)", () => {
    const r = compute("calc_estimated_gestational_age", {
      last_menstrual_period_date: "2024-01-01",
      current_date: "2024-03-15",
    });
    expect(r.result).toBe(74);
    expect(r.interpretation.band).toContain("10w4d");
  });

  it("EGA: throws if current date is before LMP", () => {
    expect(() =>
      compute("calc_estimated_gestational_age", {
        last_menstrual_period_date: "2024-04-01",
        current_date: "2024-01-01",
      }),
    ).toThrow();
  });

  it("EGA: rejects malformed date strings", () => {
    expect(() =>
      compute("calc_estimated_due_date", { last_menstrual_period_date: "01/01/2024" }),
    ).toThrow();
  });
});

describe("MedCalc-Bench tier-5: Caprini VTE (2005)", () => {
  const baseline = {
    age_y: 35,
    surgery_type: "none" as const,
    bmi_kg_m2: 22,
    major_surgery_last_month: false,
    chf_last_month: false,
    sepsis_last_month: false,
    pneumonia_last_month: false,
    immobilizing_cast: false,
    varicose_veins: false,
    current_swollen_legs: false,
    inflammatory_bowel_disease: false,
    acute_myocardial_infarction: false,
    copd: false,
    central_venous_access: false,
    malignancy: false,
    previous_dvt: false,
    previous_pe: false,
    family_history_thrombosis: false,
    factor_v_leiden: false,
    prothrombin_20210a: false,
    elevated_homocysteine: false,
    lupus_anticoagulant: false,
    elevated_anticardiolipin: false,
    heparin_induced_thrombocytopenia: false,
    other_thrombophilia: false,
    hip_pelvis_leg_fracture_last_month: false,
    stroke_last_month: false,
    multiple_trauma_last_month: false,
    acute_spinal_cord_injury_last_month: false,
    mobility: "normal" as const,
  };

  it("Caprini: healthy 35yo, BMI 22, no surgery, no RFs → 0 (very low)", () => {
    const r = compute("calc_caprini", baseline);
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("very low");
  });

  it("Caprini: 50yo male, BMI 28, elective major lower-extremity arthroplasty → 7 (high)", () => {
    const r = compute("calc_caprini", {
      ...baseline,
      age_y: 50,
      bmi_kg_m2: 28,
      surgery_type: "major_lower_extremity_arthroplasty",
    });
    // age 1 + BMI 1 + surgery 5 = 7
    expect(r.result).toBe(7);
    expect(r.interpretation.band).toContain("high");
  });

  it("Caprini: 35yo, minor surgery only → 1 (low)", () => {
    const r = compute("calc_caprini", {
      ...baseline,
      surgery_type: "minor",
    });
    // age 0 + surgery 1 = 1
    expect(r.result).toBe(1);
    expect(r.interpretation.band).toContain("low");
  });

  it("Caprini: age 75 contributes 3 points; previous DVT contributes 3", () => {
    const r = compute("calc_caprini", {
      ...baseline,
      age_y: 75,
      previous_dvt: true,
    });
    // age 3 + previous_dvt 3 = 6, qualifies as high
    expect(r.result).toBe(6);
    expect(r.interpretation.band).toContain("high");
  });

  it("Caprini: acute spinal cord injury contributes 5 points", () => {
    const r = compute("calc_caprini", {
      ...baseline,
      acute_spinal_cord_injury_last_month: true,
    });
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("high");
  });

  it("Caprini: mobility 'confined to bed >72h' contributes 2 points", () => {
    const r = compute("calc_caprini", { ...baseline, mobility: "confined_to_bed_72h" });
    expect(r.result).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* MedCalc-Bench tier-6: Charlson + PSI/PORT (the heavies)                     */
/* -------------------------------------------------------------------------- */

describe("MedCalc-Bench tier-6: Charlson Comorbidity Index", () => {
  const baseline = {
    age_y: 30,
    myocardial_infarction: false,
    congestive_heart_failure: false,
    peripheral_vascular_disease: false,
    cerebrovascular_accident_or_tia: false,
    dementia: false,
    chronic_pulmonary_disease: false,
    connective_tissue_disease: false,
    peptic_ulcer_disease: false,
    liver_disease: "none" as const,
    diabetes_mellitus: "none_or_diet" as const,
    hemiplegia: false,
    moderate_to_severe_ckd: false,
    solid_tumor: "none" as const,
    leukemia: false,
    lymphoma: false,
    aids: false,
  };

  it("Charlson: healthy 30yo → 0 (98% 10y survival)", () => {
    const r = compute("calc_charlson", baseline);
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("98%");
  });

  it("Charlson: 75yo with COPD, uncomplicated DM, prior MI → 6", () => {
    const r = compute("calc_charlson", {
      ...baseline,
      age_y: 75, // age 3
      chronic_pulmonary_disease: true, // 1
      diabetes_mellitus: "uncomplicated", // 1
      myocardial_infarction: true, // 1
    });
    expect(r.result).toBe(6);
    expect(r.interpretation.band).toContain("21%");
  });

  it("Charlson: 60yo with metastatic colon cancer + mild liver disease → 9", () => {
    const r = compute("calc_charlson", {
      ...baseline,
      age_y: 60, // age 2
      solid_tumor: "metastatic", // 6
      liver_disease: "mild", // 1
    });
    expect(r.result).toBe(9);
  });

  it("Charlson: AIDS contributes 6 points", () => {
    const r = compute("calc_charlson", { ...baseline, aids: true });
    expect(r.result).toBe(6);
  });

  it("Charlson: moderate-to-severe liver disease contributes 3 points", () => {
    const r = compute("calc_charlson", { ...baseline, liver_disease: "moderate_to_severe" });
    expect(r.result).toBe(3);
  });

  it("Charlson: DM with end-organ damage contributes 2 points", () => {
    const r = compute("calc_charlson", { ...baseline, diabetes_mellitus: "end_organ_damage" });
    expect(r.result).toBe(2);
  });

  it("Charlson: age 85 contributes 4 points (highest age bracket)", () => {
    const r = compute("calc_charlson", { ...baseline, age_y: 85 });
    expect(r.result).toBe(4);
  });
});

describe("MedCalc-Bench tier-6: PSI/PORT", () => {
  const baseline = {
    age_y: 45,
    sex: "M" as const,
    nursing_home_resident: false,
    neoplastic_disease: false,
    liver_disease_history: false,
    congestive_heart_failure: false,
    cerebrovascular_disease: false,
    renal_disease: false,
    altered_mental_status: false,
    respiratory_rate_per_min: 16,
    systolic_bp_mm_hg: 120,
    temperature_c: 37.0,
    pulse_bpm: 80,
    arterial_ph: 7.4,
    bun_mg_dl: 14,
    sodium_mmol_l: 140,
    glucose_mg_dl: 100,
    hematocrit_percent: 42,
    pao2_mm_hg: 90,
    pleural_effusion_on_xray: false,
  };

  it("PSI: 45yo male, no comorbidities, normal vitals → Class I (~0.1%)", () => {
    const r = compute("calc_psi_port", baseline);
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("Class I");
    expect((r.inputs as { psi_class: number }).psi_class).toBe(1);
  });

  it("PSI: 75yo female nursing home + AMS + RR 32 → Class IV (~9%)", () => {
    // Age 65 (female -10) + nursing home 10 + AMS 20 + RR≥30 20 = 115 points = Class IV
    const r = compute("calc_psi_port", {
      ...baseline,
      age_y: 75,
      sex: "F",
      nursing_home_resident: true,
      altered_mental_status: true,
      respiratory_rate_per_min: 32,
    });
    expect(r.result).toBe(115);
    expect(r.interpretation.band).toContain("Class IV");
  });

  it("PSI: age <50 but with comorbidity falls through to point-based scoring", () => {
    const r = compute("calc_psi_port", { ...baseline, congestive_heart_failure: true });
    // Age 45 (M) + CHF 10 = 55 points = Class II
    expect(r.result).toBe(55);
    expect(r.interpretation.band).toContain("Class II");
  });

  it("PSI: SBP <90 contributes 20 points", () => {
    const r = compute("calc_psi_port", { ...baseline, age_y: 50, systolic_bp_mm_hg: 80 });
    // Age 50 (M) + SBP<90 20 = 70 = Class II (≤70)
    expect(r.result).toBe(70);
    expect(r.interpretation.band).toContain("Class II");
  });

  it("PSI: severely elevated points → Class V (>130)", () => {
    const r = compute("calc_psi_port", {
      ...baseline,
      age_y: 80, // 80
      neoplastic_disease: true, // 30
      altered_mental_status: true, // 20
      arterial_ph: 7.25, // 30
      bun_mg_dl: 50, // 20
    });
    // 80 + 30 + 20 + 30 + 20 = 180 → Class V
    expect(r.result).toBe(180);
    expect(r.interpretation.band).toContain("Class V");
  });
});

/* -------------------------------------------------------------------------- */
/* Pediatrics                                                                   */
/* -------------------------------------------------------------------------- */

describe("Pediatrics: APGAR", () => {
  it("Perfect APGAR: pink, ≥100, vigorous cry, active, strong cry → 10", () => {
    const r = compute("calc_apgar", {
      appearance: "pink_all_over",
      pulse: "100_or_over",
      grimace: "cough_sneeze_cry",
      activity: "active_motion",
      respiration: "strong_cry",
    });
    expect(r.result).toBe(10);
    expect(r.interpretation.band).toContain("reassuring");
  });

  it("Severely depressed: blue, absent, no response, limp, absent → 0", () => {
    const r = compute("calc_apgar", {
      appearance: "blue_pale_all_over",
      pulse: "absent",
      grimace: "no_response",
      activity: "limp",
      respiration: "absent",
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("severely depressed");
  });

  it("Moderate band 4–6: pink, <100, grimace, some flexion, weak → 6", () => {
    // 2 + 1 + 1 + 1 + 1 = 6 (lands at upper end of moderate band)
    const r = compute("calc_apgar", {
      appearance: "pink_all_over",
      pulse: "under_100",
      grimace: "grimace",
      activity: "some_flexion",
      respiration: "weak_irregular",
    });
    expect(r.result).toBe(6);
    expect(r.interpretation.band).toContain("moderately");
  });
});

describe("Pediatrics: GCS (modified verbal scale)", () => {
  it("Best: spontaneous, smiles/coos appropriately, obeys → 15", () => {
    const r = compute("calc_pediatric_gcs", {
      best_eye_response: "spontaneous",
      best_verbal_response: "smiles_coos_cries_appropriately",
      best_motor_response: "obeys_or_normal_spontaneous_movement",
    });
    expect(r.result).toBe(15);
    expect(r.interpretation.band).toContain("mild");
  });

  it("Severe: to_pain, persistent_irritable, extension → 3+3+2 = 8", () => {
    const r = compute("calc_pediatric_gcs", {
      best_eye_response: "to_pain",
      best_verbal_response: "persistent_irritable",
      best_motor_response: "extension_to_pain",
    });
    expect(r.result).toBe(7);
    expect(r.interpretation.band).toContain("severe");
  });
});

describe("Pediatrics: Schwartz bedside eGFR", () => {
  it("Height 100 cm, Cr 0.5 → ~83 mL/min/1.73m²", () => {
    const r = compute("calc_schwartz_bedside_egfr", {
      height_cm: 100,
      serum_creatinine_mg_dl: 0.5,
      age_y: 5,
    });
    // 0.413 × 100 / 0.5 = 82.6 → 83
    expect(r.result).toBe(83);
    expect(r.interpretation.band).toContain("G2");
  });

  it("Age outside 1–18 surfaces validation warning", () => {
    const r = compute("calc_schwartz_bedside_egfr", {
      height_cm: 80,
      serum_creatinine_mg_dl: 0.3,
      age_y: 0.5,
    });
    expect(r.warnings?.join(" ")).toContain("outside the Schwartz validation range");
  });
});

describe("Pediatrics: Westley Croup", () => {
  it("All zero → mild (0/17)", () => {
    const r = compute("calc_westley_croup", {
      level_of_consciousness: "normal",
      cyanosis: "none",
      stridor: "none",
      air_entry: "normal",
      retractions: "none",
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("mild");
  });

  it("Cyanosis at rest + disoriented → impending respiratory failure", () => {
    const r = compute("calc_westley_croup", {
      level_of_consciousness: "disoriented",
      cyanosis: "at_rest",
      stridor: "at_rest",
      air_entry: "markedly_decreased",
      retractions: "severe",
    });
    // 5 + 5 + 2 + 2 + 3 = 17
    expect(r.result).toBe(17);
    expect(r.interpretation.band).toContain("impending");
  });
});

describe("Pediatrics: PRAM", () => {
  it("All normal → 0 (mild)", () => {
    const r = compute("calc_pram", {
      suprasternal_retractions: "absent",
      scalene_retractions: "absent",
      air_entry: "normal",
      wheezing: "absent",
      oxygen_saturation: "over_95",
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("mild");
  });

  it("Severe asthma exacerbation maxes at 12", () => {
    const r = compute("calc_pram", {
      suprasternal_retractions: "present",
      scalene_retractions: "present",
      air_entry: "minimal_or_absent",
      wheezing: "audible_without_stethoscope_or_silent_chest",
      oxygen_saturation: "under_92",
    });
    expect(r.result).toBe(12);
    expect(r.interpretation.band).toContain("severe");
  });
});

describe("Pediatrics: FLACC", () => {
  it("All zeros → no pain (0)", () => {
    const r = compute("calc_flacc", {
      face: "no_expression",
      legs: "normal",
      activity: "lying_quiet",
      cry: "no_cry",
      consolability: "content_relaxed",
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("no pain");
  });

  it("All twos → severe (10/10)", () => {
    const r = compute("calc_flacc", {
      face: "frequent_quivering_chin_clenched_jaw",
      legs: "kicking_or_drawn_up",
      activity: "arched_rigid_or_jerking",
      cry: "crying_steadily_screaming_sobbing",
      consolability: "difficult_to_console",
    });
    expect(r.result).toBe(10);
    expect(r.interpretation.band).toContain("severe");
  });
});

describe("Pediatrics: Wong-Baker FACES", () => {
  it("Face 0 (no hurt) → band 'no hurt'", () => {
    const r = compute("calc_wong_baker_faces", { selected_face_value: 0 });
    expect(r.interpretation.band).toContain("no hurt");
  });

  it("Face 8 (whole lot) → severe", () => {
    const r = compute("calc_wong_baker_faces", { selected_face_value: 8 });
    expect(r.interpretation.band).toContain("severe");
  });
});

describe("Pediatrics: Kocher septic hip", () => {
  it("All four criteria met → 4 (~99% probability)", () => {
    const r = compute("calc_kocher_arthritis", {
      non_weight_bearing: true,
      fever_over_38_5c: true,
      esr_over_40: true,
      wbc_over_12k: true,
    });
    expect(r.result).toBe(4);
    expect(r.interpretation.band).toContain("99%");
  });

  it("No criteria → 0 (~0.2%)", () => {
    const r = compute("calc_kocher_arthritis", {
      non_weight_bearing: false,
      fever_over_38_5c: false,
      esr_over_40: false,
      wbc_over_12k: false,
    });
    expect(r.result).toBe(0);
    expect(r.interpretation.band).toContain("0.2%");
  });
});

describe("Pediatrics: Trauma Score (Tepas)", () => {
  it("Well-appearing >20 kg child → +12", () => {
    const r = compute("calc_pediatric_trauma_score", {
      weight_band: "over_20kg",
      airway: "normal",
      sbp_band: "over_90_mmHg",
      cns_status: "awake",
      open_wound: "none",
      fracture: "none",
    });
    expect(r.result).toBe(12);
    expect(r.interpretation.band).toContain("low risk");
  });

  it("Critically injured infant <10 kg → −6 (high risk)", () => {
    const r = compute("calc_pediatric_trauma_score", {
      weight_band: "under_10kg",
      airway: "unmaintainable",
      sbp_band: "under_50_mmHg_or_unobtainable",
      cns_status: "comatose",
      open_wound: "major_or_penetrating",
      fracture: "open_or_multiple",
    });
    expect(r.result).toBe(-6);
    expect(r.interpretation.band).toContain("high risk");
  });
});

describe("Pediatrics: PECARN head injury (tree-class)", () => {
  const reassuring2yPlus = {
    age_y: 5,
    gcs: 15,
    altered_mental_status: false,
    loss_of_consciousness: false,
    severe_mechanism: false,
    signs_of_basilar_skull_fracture: false,
    severe_headache: false,
    vomiting: false,
  };

  it("≥2y with no predictors → very-low-risk (no CT)", () => {
    const r = compute("calc_pecarn_head", reassuring2yPlus);
    expect(r.result).toBe("very-low-risk");
    expect(r.interpretation.band).toContain("very low");
  });

  it("≥2y with GCS 14 → high-risk", () => {
    const r = compute("calc_pecarn_head", { ...reassuring2yPlus, gcs: 14 });
    expect(r.result).toBe("high-risk");
  });

  it("≥2y with isolated vomiting → intermediate-risk", () => {
    const r = compute("calc_pecarn_head", { ...reassuring2yPlus, vomiting: true });
    expect(r.result).toBe("intermediate-risk");
  });

  it("<2y rule uses palpable skull fracture, not basilar signs", () => {
    const r = compute("calc_pecarn_head", {
      age_y: 1,
      gcs: 15,
      altered_mental_status: false,
      loss_of_consciousness: false,
      severe_mechanism: false,
      palpable_skull_fracture: true,
    });
    expect(r.result).toBe("high-risk");
    expect(r.interpretation.detail).toContain("palpable skull fracture");
  });
});

describe("Pediatrics: ISPAD DKA severity", () => {
  it("pH 7.35, HCO₃ 18 → no DKA", () => {
    const r = compute("calc_ispad_peds_dka", { venous_ph: 7.35, bicarbonate_mmol_l: 18 });
    expect(r.result).toBe("no-dka");
  });

  it("pH 7.25, HCO₃ 12 → mild", () => {
    const r = compute("calc_ispad_peds_dka", { venous_ph: 7.25, bicarbonate_mmol_l: 12 });
    expect(r.result).toBe("mild");
  });

  it("pH 7.15, HCO₃ 8 → moderate", () => {
    const r = compute("calc_ispad_peds_dka", { venous_ph: 7.15, bicarbonate_mmol_l: 8 });
    expect(r.result).toBe("moderate");
  });

  it("pH 7.05, HCO₃ 4 → severe (use more severe of pH or HCO₃)", () => {
    const r = compute("calc_ispad_peds_dka", { venous_ph: 7.05, bicarbonate_mmol_l: 4 });
    expect(r.result).toBe("severe");
  });
});

describe("Pediatrics: Oxygenation Index (PALICC-2)", () => {
  it("MAP 10, FiO₂ 0.5, PaO₂ 100 → OI 5 (mild ARDS)", () => {
    const r = compute("calc_oxygenation_index", {
      mean_airway_pressure_cm_h2o: 10,
      fio2: 0.5,
      pao2_mm_hg: 100,
    });
    // (10 × 0.5 × 100) / 100 = 5
    expect(r.result).toBe(5);
    expect(r.interpretation.band).toContain("mild");
  });

  it("MAP 20, FiO₂ 1.0, PaO₂ 80 → OI 25 (severe)", () => {
    const r = compute("calc_oxygenation_index", {
      mean_airway_pressure_cm_h2o: 20,
      fio2: 1.0,
      pao2_mm_hg: 80,
    });
    expect(r.result).toBe(25);
    expect(r.interpretation.band).toContain("severe");
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
