/**
 * Pulmonology / VTE calculators (ARCHITECTURE.md §5.3).
 */

import { formulaSource } from "@clinical-mcp/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, sumBreakdown } from "../framework.js";

const flag = (condition: boolean, points: number): number => (condition ? points : 0);

/* -------------------------------------------------------------------------- */

const curb65 = defineCalculator({
  name: "calc_curb65",
  title: "CURB-65 Pneumonia Severity Score",
  domain: "pulmonary-vte",
  description:
    "Assess community-acquired pneumonia severity and guide the admission decision from confusion, urea, respiratory rate, blood pressure, and age.",
  inputSchema: {
    confusion: z.boolean().describe("New-onset confusion / disorientation."),
    bun_mg_dl: z
      .number()
      .nonnegative()
      .describe("Blood urea nitrogen in mg/dL (>19 mg/dL scores)."),
    respiratory_rate: z.number().positive().describe("Respiratory rate in breaths per minute."),
    sbp_mm_hg: z.number().positive().describe("Systolic blood pressure in mmHg."),
    dbp_mm_hg: z.number().positive().describe("Diastolic blood pressure in mmHg."),
    age_y: z.number().positive().describe("Age in years (≥65 scores)."),
  },
  sources: [
    formulaSource({
      title:
        "Lim WS, van der Eerden MM, Laing R, et al. Defining community acquired pneumonia severity on presentation to hospital: an international derivation and validation study. Thorax. 2003;58(5):377-382.",
      url: "https://pubmed.ncbi.nlm.nih.gov/12728155/",
      publisher: "Thorax",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Confusion", value: flag(args.confusion, 1) },
      { component: "Urea >19 mg/dL (>7 mmol/L)", value: flag(args.bun_mg_dl > 19, 1) },
      { component: "Respiratory rate ≥30", value: flag(args.respiratory_rate >= 30, 1) },
      {
        component: "Blood pressure (SBP <90 or DBP ≤60)",
        value: flag(args.sbp_mm_hg < 90 || args.dbp_mm_hg <= 60, 1),
      },
      { component: "Age ≥65", value: flag(args.age_y >= 65, 1) },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score <= 1) {
      band = "low severity (0–1) — ~1.5% 30-day mortality";
      detail = "Low severity — usually suitable for outpatient management.";
    } else if (score === 2) {
      band = "moderate severity (2) — ~9% 30-day mortality";
      detail =
        "Moderate severity — consider a short inpatient stay or supervised outpatient treatment.";
    } else {
      band = "high severity (3–5) — ~22% 30-day mortality";
      detail = "High severity — admit; a score of 4–5 should prompt assessment for ICU-level care.";
    }

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

const wellsPe = defineCalculator({
  name: "calc_wells_pe",
  title: "Wells Criteria for Pulmonary Embolism",
  domain: "pulmonary-vte",
  description:
    "Estimate the pretest probability of pulmonary embolism to guide D-dimer vs. imaging.",
  inputSchema: {
    clinical_signs_of_dvt: z.boolean().describe("Clinical signs and symptoms of DVT."),
    pe_most_likely_diagnosis: z
      .boolean()
      .describe("PE is the most likely diagnosis, or equally likely."),
    heart_rate_bpm: z.number().positive().describe("Heart rate in beats per minute (>100 scores)."),
    immobilization_or_surgery: z
      .boolean()
      .describe("Immobilization ≥3 days or surgery in the previous 4 weeks."),
    previous_pe_or_dvt: z.boolean().describe("Previously diagnosed PE or DVT."),
    hemoptysis: z.boolean().describe("Hemoptysis."),
    malignancy: z.boolean().describe("Malignancy with treatment within 6 months, or palliative."),
  },
  sources: [
    formulaSource({
      title:
        "Wells PS, Anderson DR, Rodger M, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism. Thromb Haemost. 2000;83(3):416-420.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10744147/",
      publisher: "Thrombosis and Haemostasis",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Clinical signs of DVT", value: flag(args.clinical_signs_of_dvt, 3) },
      {
        component: "PE is the most likely diagnosis",
        value: flag(args.pe_most_likely_diagnosis, 3),
      },
      { component: "Heart rate >100", value: flag(args.heart_rate_bpm > 100, 1.5) },
      { component: "Immobilization or surgery", value: flag(args.immobilization_or_surgery, 1.5) },
      { component: "Previous PE or DVT", value: flag(args.previous_pe_or_dvt, 1.5) },
      { component: "Hemoptysis", value: flag(args.hemoptysis, 1) },
      { component: "Malignancy", value: flag(args.malignancy, 1) },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    if (score < 2) band = "low pretest probability (<2)";
    else if (score <= 6) band = "moderate pretest probability (2–6)";
    else band = "high pretest probability (>6)";

    const twoTier = score <= 4 ? "PE unlikely" : "PE likely";
    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail: `Two-tier model: ${twoTier} (≤4 unlikely, >4 likely). With a low/unlikely probability, a negative D-dimer can exclude PE; a high probability generally warrants CT pulmonary angiography.`,
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const wellsDvt = defineCalculator({
  name: "calc_wells_dvt",
  title: "Wells Criteria for Deep Vein Thrombosis",
  domain: "pulmonary-vte",
  description: "Estimate the pretest probability of deep vein thrombosis.",
  inputSchema: {
    active_cancer: z
      .boolean()
      .describe("Active cancer (treatment within 6 months, or palliative)."),
    paralysis_or_immobilization: z
      .boolean()
      .describe("Paralysis, paresis, or recent plaster immobilization of the lower extremities."),
    bedridden_or_major_surgery: z
      .boolean()
      .describe("Recently bedridden ≥3 days, or major surgery within 12 weeks."),
    localized_tenderness: z
      .boolean()
      .describe("Localized tenderness along the distribution of the deep venous system."),
    entire_leg_swollen: z.boolean().describe("Entire leg swollen."),
    calf_swelling_3cm: z
      .boolean()
      .describe("Calf swelling ≥3 cm larger than the asymptomatic side."),
    pitting_edema: z.boolean().describe("Pitting edema confined to the symptomatic leg."),
    collateral_superficial_veins: z
      .boolean()
      .describe("Collateral superficial veins (non-varicose)."),
    previous_dvt: z.boolean().describe("Previously documented DVT."),
    alternative_diagnosis_likely: z
      .boolean()
      .describe("An alternative diagnosis is at least as likely as DVT (subtracts 2 points)."),
  },
  sources: [
    formulaSource({
      title:
        "Wells PS, Anderson DR, Bormanis J, et al. Value of assessment of pretest probability of deep-vein thrombosis in clinical management. Lancet. 1997;350(9094):1795-1798.",
      url: "https://pubmed.ncbi.nlm.nih.gov/9428249/",
      publisher: "Lancet",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Active cancer", value: flag(args.active_cancer, 1) },
      {
        component: "Paralysis / paresis / immobilization",
        value: flag(args.paralysis_or_immobilization, 1),
      },
      {
        component: "Bedridden ≥3 days or major surgery <12 weeks",
        value: flag(args.bedridden_or_major_surgery, 1),
      },
      {
        component: "Localized tenderness (deep venous system)",
        value: flag(args.localized_tenderness, 1),
      },
      { component: "Entire leg swollen", value: flag(args.entire_leg_swollen, 1) },
      { component: "Calf swelling ≥3 cm", value: flag(args.calf_swelling_3cm, 1) },
      { component: "Pitting edema (symptomatic leg)", value: flag(args.pitting_edema, 1) },
      {
        component: "Collateral superficial veins",
        value: flag(args.collateral_superficial_veins, 1),
      },
      { component: "Previously documented DVT", value: flag(args.previous_dvt, 1) },
      {
        component: "Alternative diagnosis at least as likely",
        value: flag(args.alternative_diagnosis_likely, -2),
      },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    if (score >= 3) band = "high pretest probability (≥3)";
    else if (score >= 1) band = "moderate pretest probability (1–2)";
    else band = "low pretest probability (≤0)";

    const twoTier = score >= 2 ? "DVT likely" : "DVT unlikely";
    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail: `Two-tier model: ${twoTier} (≥2 likely, <2 unlikely). With an unlikely probability, a negative D-dimer can exclude DVT; otherwise proceed to compression ultrasonography.`,
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const pesi = defineCalculator({
  name: "calc_pesi",
  title: "Pulmonary Embolism Severity Index (PESI)",
  domain: "pulmonary-vte",
  description:
    "Estimate 30-day mortality risk in confirmed pulmonary embolism to support outpatient-vs-inpatient triage.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years (added directly to the score)."),
    sex: z.enum(["M", "F"]).describe("Biological sex (male adds 10 points)."),
    cancer: z.boolean().describe("History of cancer."),
    heart_failure: z.boolean().describe("History of chronic heart failure."),
    chronic_lung_disease: z.boolean().describe("History of chronic lung disease."),
    heart_rate_bpm: z
      .number()
      .positive()
      .describe("Heart rate in beats per minute (≥110 adds 20)."),
    sbp_mm_hg: z.number().positive().describe("Systolic blood pressure in mmHg (<100 adds 30)."),
    respiratory_rate: z
      .number()
      .positive()
      .describe("Respiratory rate in breaths/min (≥30 adds 20)."),
    temperature_c: z.number().describe("Temperature in °C (<36 adds 20)."),
    altered_mental_status: z.boolean().describe("Altered mental status."),
    oxygen_saturation_pct: z
      .number()
      .positive()
      .describe("Arterial oxygen saturation in percent (<90 adds 20)."),
  },
  sources: [
    formulaSource({
      title:
        "Aujesky D, Obrosky DS, Stone RA, et al. Derivation and validation of a prognostic model for pulmonary embolism. Am J Respir Crit Care Med. 2005;172(8):1041-1046.",
      url: "https://pubmed.ncbi.nlm.nih.gov/16020800/",
      publisher: "American Journal of Respiratory and Critical Care Medicine",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Age (years)", value: Math.round(args.age_y) },
      { component: "Male sex", value: flag(args.sex === "M", 10) },
      { component: "Cancer", value: flag(args.cancer, 30) },
      { component: "Chronic heart failure", value: flag(args.heart_failure, 10) },
      { component: "Chronic lung disease", value: flag(args.chronic_lung_disease, 10) },
      { component: "Heart rate ≥110", value: flag(args.heart_rate_bpm >= 110, 20) },
      { component: "Systolic BP <100", value: flag(args.sbp_mm_hg < 100, 30) },
      { component: "Respiratory rate ≥30", value: flag(args.respiratory_rate >= 30, 20) },
      { component: "Temperature <36 °C", value: flag(args.temperature_c < 36, 20) },
      { component: "Altered mental status", value: flag(args.altered_mental_status, 60) },
      { component: "Oxygen saturation <90%", value: flag(args.oxygen_saturation_pct < 90, 20) },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    if (score <= 65) band = "Class I — very low 30-day mortality risk";
    else if (score <= 85) band = "Class II — low 30-day mortality risk";
    else if (score <= 105) band = "Class III — intermediate 30-day mortality risk";
    else if (score <= 125) band = "Class IV — high 30-day mortality risk";
    else band = "Class V — very high 30-day mortality risk";

    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail:
          "Classes I–II identify low-risk patients who may be candidates for outpatient or early-discharge management; classes III–V indicate higher risk and inpatient care.",
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const perc = defineCalculator({
  name: "calc_perc",
  title: "PERC Rule (PE Rule-out Criteria)",
  domain: "pulmonary-vte",
  description:
    "Apply the 8-criterion PERC rule. In a patient already judged low-risk for PE, a PERC-negative result (all criteria absent) allows PE to be excluded without D-dimer or imaging.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years (≥50 is a positive criterion)."),
    heart_rate_bpm: z
      .number()
      .positive()
      .describe("Heart rate in beats per minute (≥100 is positive)."),
    oxygen_saturation_pct: z
      .number()
      .positive()
      .describe("Arterial oxygen saturation in percent (<95% is positive)."),
    unilateral_leg_swelling: z.boolean().describe("Unilateral leg swelling."),
    hemoptysis: z.boolean().describe("Hemoptysis."),
    recent_surgery_or_trauma: z
      .boolean()
      .describe("Surgery or trauma requiring general anesthesia within the past 4 weeks."),
    prior_pe_or_dvt: z.boolean().describe("Prior PE or DVT."),
    hormone_use: z
      .boolean()
      .describe("Exogenous estrogen use (oral contraceptives or hormone therapy)."),
  },
  sources: [
    formulaSource({
      title:
        "Kline JA, Courtney DM, Kabrhel C, et al. Prospective multicenter evaluation of the pulmonary embolism rule-out criteria. J Thromb Haemost. 2008;6(5):772-780.",
      url: "https://pubmed.ncbi.nlm.nih.gov/18318689/",
      publisher: "Journal of Thrombosis and Haemostasis",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Age ≥50", value: flag(args.age_y >= 50, 1) },
      { component: "Heart rate ≥100", value: flag(args.heart_rate_bpm >= 100, 1) },
      { component: "Oxygen saturation <95%", value: flag(args.oxygen_saturation_pct < 95, 1) },
      { component: "Unilateral leg swelling", value: flag(args.unilateral_leg_swelling, 1) },
      { component: "Hemoptysis", value: flag(args.hemoptysis, 1) },
      { component: "Recent surgery or trauma", value: flag(args.recent_surgery_or_trauma, 1) },
      { component: "Prior PE or DVT", value: flag(args.prior_pe_or_dvt, 1) },
      { component: "Exogenous estrogen use", value: flag(args.hormone_use, 1) },
    ];
    const positiveCount = sumBreakdown(breakdown);

    const negative = positiveCount === 0;
    return {
      result: positiveCount,
      unit: "positive criteria",
      interpretation: {
        band: negative ? "PERC negative" : "PERC positive",
        detail: negative
          ? "All 8 criteria are absent. In a patient already assessed as low pretest probability, PE can be excluded without further testing."
          : "One or more criteria are present — PERC does not apply; proceed with D-dimer or imaging per the pretest probability.",
      },
      breakdown,
      inputs: { ...args },
      warnings: [
        "The PERC rule is only valid when the clinician has already judged the patient to be at low pretest probability for PE.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const pulmonaryVteCalculators: CalculatorDef[] = [curb65, wellsPe, wellsDvt, pesi, perc];
