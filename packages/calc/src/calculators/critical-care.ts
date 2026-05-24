/**
 * Critical-care calculators (ARCHITECTURE.md §5.3).
 */

import { ClinicalMcpError, formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, rangePoints, sumBreakdown } from "../framework.js";

const flag = (condition: boolean, points: number): number => (condition ? points : 0);

/* -------------------------------------------------------------------------- */

const apacheII = defineCalculator({
  name: "calc_apache_ii",
  title: "APACHE II Score",
  domain: "critical-care",
  description:
    "Acute Physiology and Chronic Health Evaluation II — estimate ICU mortality risk from the worst physiologic values in the first 24 hours, age, and chronic health status.",
  inputSchema: {
    temperature_c: z.number().describe("Core temperature in °C."),
    mean_arterial_pressure_mm_hg: z.number().positive().describe("Mean arterial pressure in mmHg."),
    heart_rate_bpm: z.number().positive().describe("Heart rate in beats per minute."),
    respiratory_rate: z.number().positive().describe("Respiratory rate in breaths per minute."),
    fio2: z.number().min(0.21).max(1).describe("Fraction of inspired oxygen (0.21–1.0)."),
    pao2_mm_hg: z.number().positive().describe("Arterial PaO₂ in mmHg (used when FiO₂ < 0.5)."),
    a_a_gradient_mm_hg: z
      .number()
      .nonnegative()
      .optional()
      .describe("Alveolar-arterial O₂ gradient in mmHg. Required when FiO₂ ≥ 0.5."),
    arterial_ph: z.number().positive().describe("Arterial pH."),
    serum_sodium_meq_l: z.number().positive().describe("Serum sodium in mEq/L."),
    serum_potassium_meq_l: z.number().positive().describe("Serum potassium in mEq/L."),
    serum_creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
    acute_renal_failure: z
      .boolean()
      .describe("True if acute renal failure is present (doubles the creatinine points)."),
    hematocrit_pct: z.number().positive().describe("Hematocrit in percent."),
    wbc_10e3_per_mm3: z.number().positive().describe("White blood cell count in ×10³/mm³."),
    glasgow_coma_scale: z.number().int().min(3).max(15).describe("Glasgow Coma Scale (3–15)."),
    age_y: z.number().positive().describe("Age in years."),
    severe_organ_insufficiency: z
      .boolean()
      .describe("History of severe organ insufficiency or immunocompromise."),
    admission_type: z
      .enum(["nonoperative", "emergency_postop", "elective_postop"])
      .describe("Admission type, used with chronic health points."),
  },
  sources: [
    formulaSource({
      title:
        "Knaus WA, Draper EA, Wagner DP, Zimmerman JE. APACHE II: a severity of disease classification system. Crit Care Med. 1985;13(10):818-829.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3928249/",
      publisher: "Critical Care Medicine",
    }),
  ],
  compute: (args) => {
    const temperaturePoints = rangePoints(args.temperature_c, [
      { upTo: 29.9, points: 4 },
      { upTo: 31.9, points: 3 },
      { upTo: 33.9, points: 2 },
      { upTo: 35.9, points: 1 },
      { upTo: 38.4, points: 0 },
      { upTo: 38.9, points: 1 },
      { upTo: 40.9, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const mapPoints = rangePoints(args.mean_arterial_pressure_mm_hg, [
      { upTo: 49, points: 4 },
      { upTo: 69, points: 2 },
      { upTo: 109, points: 0 },
      { upTo: 129, points: 2 },
      { upTo: 159, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const hrPoints = rangePoints(args.heart_rate_bpm, [
      { upTo: 39, points: 4 },
      { upTo: 54, points: 3 },
      { upTo: 69, points: 2 },
      { upTo: 109, points: 0 },
      { upTo: 139, points: 2 },
      { upTo: 179, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const rrPoints = rangePoints(args.respiratory_rate, [
      { upTo: 5, points: 4 },
      { upTo: 9, points: 2 },
      { upTo: 11, points: 1 },
      { upTo: 24, points: 0 },
      { upTo: 34, points: 1 },
      { upTo: 49, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);

    // Oxygenation: A-a gradient when FiO₂ ≥ 0.5, otherwise PaO₂.
    let oxygenationPoints: number;
    if (args.fio2 >= 0.5) {
      if (args.a_a_gradient_mm_hg === undefined) {
        throw ClinicalMcpError.of(
          "INVALID_INPUT",
          "APACHE II: a_a_gradient_mm_hg is required when fio2 ≥ 0.5.",
        );
      }
      oxygenationPoints = rangePoints(args.a_a_gradient_mm_hg, [
        { upTo: 199.9, points: 0 },
        { upTo: 349, points: 2 },
        { upTo: 499, points: 3 },
        { upTo: Number.POSITIVE_INFINITY, points: 4 },
      ]);
    } else {
      oxygenationPoints = rangePoints(args.pao2_mm_hg, [
        { upTo: 54.9, points: 4 },
        { upTo: 60, points: 3 },
        { upTo: 70, points: 1 },
        { upTo: Number.POSITIVE_INFINITY, points: 0 },
      ]);
    }

    const phPoints = rangePoints(args.arterial_ph, [
      { upTo: 7.149, points: 4 },
      { upTo: 7.249, points: 3 },
      { upTo: 7.329, points: 2 },
      { upTo: 7.499, points: 0 },
      { upTo: 7.599, points: 1 },
      { upTo: 7.699, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const sodiumPoints = rangePoints(args.serum_sodium_meq_l, [
      { upTo: 110, points: 4 },
      { upTo: 119, points: 3 },
      { upTo: 129, points: 2 },
      { upTo: 149, points: 0 },
      { upTo: 154, points: 1 },
      { upTo: 159, points: 2 },
      { upTo: 179, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const potassiumPoints = rangePoints(args.serum_potassium_meq_l, [
      { upTo: 2.499, points: 4 },
      { upTo: 2.9, points: 2 },
      { upTo: 3.4, points: 1 },
      { upTo: 5.4, points: 0 },
      { upTo: 5.9, points: 1 },
      { upTo: 6.9, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const creatinineBase = rangePoints(args.serum_creatinine_mg_dl, [
      { upTo: 0.599, points: 2 },
      { upTo: 1.4, points: 0 },
      { upTo: 1.9, points: 2 },
      { upTo: 3.4, points: 3 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const creatininePoints = args.acute_renal_failure ? creatinineBase * 2 : creatinineBase;
    const hematocritPoints = rangePoints(args.hematocrit_pct, [
      { upTo: 19.99, points: 4 },
      { upTo: 29.9, points: 2 },
      { upTo: 45.9, points: 0 },
      { upTo: 49.9, points: 1 },
      { upTo: 59.9, points: 2 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const wbcPoints = rangePoints(args.wbc_10e3_per_mm3, [
      { upTo: 0.99, points: 4 },
      { upTo: 2.9, points: 2 },
      { upTo: 14.9, points: 0 },
      { upTo: 19.9, points: 1 },
      { upTo: 39.9, points: 2 },
      { upTo: Number.POSITIVE_INFINITY, points: 4 },
    ]);
    const gcsPoints = 15 - args.glasgow_coma_scale;
    const agePoints = rangePoints(args.age_y, [
      { upTo: 44, points: 0 },
      { upTo: 54, points: 2 },
      { upTo: 64, points: 3 },
      { upTo: 74, points: 5 },
      { upTo: Number.POSITIVE_INFINITY, points: 6 },
    ]);
    let chronicHealthPoints = 0;
    if (args.severe_organ_insufficiency) {
      chronicHealthPoints = args.admission_type === "elective_postop" ? 2 : 5;
    }

    const breakdown = [
      { component: "Temperature", value: temperaturePoints },
      { component: "Mean arterial pressure", value: mapPoints },
      { component: "Heart rate", value: hrPoints },
      { component: "Respiratory rate", value: rrPoints },
      { component: "Oxygenation", value: oxygenationPoints },
      { component: "Arterial pH", value: phPoints },
      { component: "Serum sodium", value: sodiumPoints },
      { component: "Serum potassium", value: potassiumPoints },
      { component: "Serum creatinine", value: creatininePoints },
      { component: "Hematocrit", value: hematocritPoints },
      { component: "White blood cell count", value: wbcPoints },
      { component: "Glasgow Coma Scale (15 − GCS)", value: gcsPoints },
      { component: "Age", value: agePoints },
      { component: "Chronic health", value: chronicHealthPoints },
    ];
    const score = sumBreakdown(breakdown);

    const mortality = rangePoints(score, [
      { upTo: 4, points: 4 },
      { upTo: 9, points: 8 },
      { upTo: 14, points: 15 },
      { upTo: 19, points: 25 },
      { upTo: 24, points: 40 },
      { upTo: 29, points: 55 },
      { upTo: 34, points: 75 },
      { upTo: Number.POSITIVE_INFINITY, points: 85 },
    ]);

    return {
      result: score,
      unit: "points",
      interpretation: {
        band: `score ${score} — approximately ${mortality}% predicted in-hospital mortality`,
        detail:
          "APACHE II ranges 0–71; higher scores indicate greater severity of illness and higher predicted ICU mortality. Predicted mortality also depends on the primary diagnosis.",
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const sofa = defineCalculator({
  name: "calc_sofa",
  title: "SOFA Score (Sequential Organ Failure Assessment)",
  domain: "critical-care",
  description:
    "Quantify the degree of organ dysfunction across six organ systems. An acute rise of ≥2 points defines sepsis under Sepsis-3.",
  inputSchema: {
    pao2_fio2_ratio: z.number().positive().describe("PaO₂/FiO₂ ratio in mmHg."),
    on_respiratory_support: z
      .boolean()
      .describe(
        "True if mechanically ventilated / on respiratory support (required for the 3- and 4-point respiratory bands).",
      ),
    platelets_10e3_per_ul: z.number().nonnegative().describe("Platelet count in ×10³/µL."),
    bilirubin_mg_dl: z.number().nonnegative().describe("Total bilirubin in mg/dL."),
    mean_arterial_pressure_mm_hg: z.number().positive().describe("Mean arterial pressure in mmHg."),
    dopamine_mcg_kg_min: z
      .number()
      .nonnegative()
      .optional()
      .describe("Dopamine dose in µg/kg/min."),
    dobutamine: z.boolean().optional().describe("True if dobutamine is being given (any dose)."),
    epinephrine_mcg_kg_min: z
      .number()
      .nonnegative()
      .optional()
      .describe("Epinephrine dose in µg/kg/min."),
    norepinephrine_mcg_kg_min: z
      .number()
      .nonnegative()
      .optional()
      .describe("Norepinephrine dose in µg/kg/min."),
    glasgow_coma_scale: z.number().int().min(3).max(15).describe("Glasgow Coma Scale (3–15)."),
    creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
    urine_output_ml_day: z
      .number()
      .nonnegative()
      .optional()
      .describe("Urine output in mL/day. Used for the renal sub-score when low."),
  },
  sources: [
    formulaSource({
      title:
        "Vincent JL, Moreno R, Takala J, et al. The SOFA (Sepsis-related Organ Failure Assessment) score to describe organ dysfunction/failure. Intensive Care Med. 1996;22(7):707-710.",
      url: "https://pubmed.ncbi.nlm.nih.gov/8844239/",
      publisher: "Intensive Care Medicine",
    }),
  ],
  compute: (args) => {
    // Respiration.
    let respiration: number;
    const ratio = args.pao2_fio2_ratio;
    if (ratio >= 400) respiration = 0;
    else if (ratio >= 300) respiration = 1;
    else if (ratio >= 200) respiration = 2;
    else if (args.on_respiratory_support) respiration = ratio >= 100 ? 3 : 4;
    else respiration = 2;

    // Coagulation.
    const platelets = args.platelets_10e3_per_ul;
    const coagulation =
      platelets >= 150 ? 0 : platelets >= 100 ? 1 : platelets >= 50 ? 2 : platelets >= 20 ? 3 : 4;

    // Liver.
    const bili = args.bilirubin_mg_dl;
    const liver = bili < 1.2 ? 0 : bili < 2 ? 1 : bili < 6 ? 2 : bili < 12 ? 3 : 4;

    // Cardiovascular (vasopressor doses in µg/kg/min).
    const dopamine = args.dopamine_mcg_kg_min ?? 0;
    const epi = args.epinephrine_mcg_kg_min ?? 0;
    const norepi = args.norepinephrine_mcg_kg_min ?? 0;
    let cardiovascular: number;
    if (dopamine > 15 || epi > 0.1 || norepi > 0.1) cardiovascular = 4;
    else if (dopamine > 5 || epi > 0 || norepi > 0) cardiovascular = 3;
    else if (dopamine > 0 || args.dobutamine) cardiovascular = 2;
    else if (args.mean_arterial_pressure_mm_hg < 70) cardiovascular = 1;
    else cardiovascular = 0;

    // CNS.
    const gcs = args.glasgow_coma_scale;
    const cns = gcs >= 15 ? 0 : gcs >= 13 ? 1 : gcs >= 10 ? 2 : gcs >= 6 ? 3 : 4;

    // Renal — worst of creatinine-based and urine-output-based.
    const creat = args.creatinine_mg_dl;
    let renal = creat < 1.2 ? 0 : creat < 2 ? 1 : creat < 3.5 ? 2 : creat < 5 ? 3 : 4;
    if (args.urine_output_ml_day !== undefined) {
      if (args.urine_output_ml_day < 200) renal = Math.max(renal, 4);
      else if (args.urine_output_ml_day < 500) renal = Math.max(renal, 3);
    }

    const breakdown = [
      { component: "Respiration (PaO₂/FiO₂)", value: respiration },
      { component: "Coagulation (platelets)", value: coagulation },
      { component: "Liver (bilirubin)", value: liver },
      { component: "Cardiovascular (MAP / vasopressors)", value: cardiovascular },
      { component: "CNS (Glasgow Coma Scale)", value: cns },
      { component: "Renal (creatinine / urine output)", value: renal },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    if (score <= 6) band = "lower organ dysfunction (0–6)";
    else if (score <= 9) band = "moderate organ dysfunction (7–9)";
    else if (score <= 12) band = "high organ dysfunction (10–12)";
    else band = "very high organ dysfunction (≥13)";

    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail:
          "SOFA ranges 0–24; higher scores indicate more severe organ dysfunction and higher mortality. Under Sepsis-3, an acute increase of ≥2 points from baseline in a patient with suspected infection defines sepsis.",
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const qsofa = defineCalculator({
  name: "calc_qsofa",
  title: "qSOFA (Quick SOFA)",
  domain: "critical-care",
  description:
    "A rapid bedside screen — respiratory rate, mentation, and systolic blood pressure — for patients with suspected infection at risk of poor outcomes.",
  inputSchema: {
    respiratory_rate: z
      .number()
      .positive()
      .describe("Respiratory rate in breaths per minute (≥22 scores)."),
    altered_mentation: z.boolean().describe("Altered mentation (Glasgow Coma Scale < 15)."),
    sbp_mm_hg: z.number().positive().describe("Systolic blood pressure in mmHg (≤100 scores)."),
  },
  sources: [
    formulaSource({
      title:
        "Seymour CW, Liu VX, Iwashyna TJ, et al. Assessment of clinical criteria for sepsis: for the Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):762-774.",
      url: "https://pubmed.ncbi.nlm.nih.gov/26903335/",
      publisher: "JAMA",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Respiratory rate ≥22", value: flag(args.respiratory_rate >= 22, 1) },
      { component: "Altered mentation", value: flag(args.altered_mentation, 1) },
      { component: "Systolic BP ≤100", value: flag(args.sbp_mm_hg <= 100, 1) },
    ];
    const score = sumBreakdown(breakdown);

    const band = score >= 2 ? "high risk (≥2)" : "lower risk (0–1)";
    const detail =
      score >= 2
        ? "A qSOFA ≥2 in suspected infection identifies patients at higher risk of prolonged ICU stay or in-hospital death — escalate assessment (including a full SOFA score) and treatment."
        : "A qSOFA of 0–1 does not rule out sepsis; reassess if the clinical picture changes.";
    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

export const criticalCareCalculators: CalculatorDef[] = [apacheII, sofa, qsofa];
