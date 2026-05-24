/**
 * Cardiology calculators (ARCHITECTURE.md §5.3).
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, rangePoints, sumBreakdown } from "../framework.js";

const flag = (condition: boolean, points: number): number => (condition ? points : 0);

/* -------------------------------------------------------------------------- */

const chadsVasc = defineCalculator({
  name: "calc_chads_vasc",
  title: "CHA₂DS₂-VASc Score",
  domain: "cardiology",
  description:
    "Estimate annual stroke/thromboembolism risk in non-valvular atrial fibrillation and guide anticoagulation decisions.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    sex: z.enum(["M", "F"]).describe("Biological sex (female contributes 1 point)."),
    congestive_heart_failure: z.boolean().describe("History of CHF or LV dysfunction."),
    hypertension: z.boolean().describe("History of hypertension."),
    diabetes: z.boolean().describe("History of diabetes mellitus."),
    stroke_tia_thromboembolism: z.boolean().describe("Prior stroke, TIA, or thromboembolism."),
    vascular_disease: z
      .boolean()
      .describe("Vascular disease (prior MI, peripheral artery disease, or aortic plaque)."),
  },
  sources: [
    formulaSource({
      title:
        "Lip GYH, Nieuwlaat R, Pisters R, et al. Refining clinical risk stratification for predicting stroke and thromboembolism in atrial fibrillation using a novel risk factor-based approach: the euro heart survey. Chest. 2010;137(2):263-272.",
      url: "https://pubmed.ncbi.nlm.nih.gov/19762550/",
      publisher: "Chest",
    }),
  ],
  compute: (args) => {
    const agePoints = args.age_y >= 75 ? 2 : args.age_y >= 65 ? 1 : 0;
    const breakdown = [
      {
        component: "Congestive heart failure / LV dysfunction",
        value: flag(args.congestive_heart_failure, 1),
      },
      { component: "Hypertension", value: flag(args.hypertension, 1) },
      { component: "Age (≥75 = 2, 65–74 = 1)", value: agePoints },
      { component: "Diabetes mellitus", value: flag(args.diabetes, 1) },
      {
        component: "Stroke / TIA / thromboembolism",
        value: flag(args.stroke_tia_thromboembolism, 2),
      },
      { component: "Vascular disease", value: flag(args.vascular_disease, 1) },
      { component: "Sex category (female)", value: flag(args.sex === "F", 1) },
    ];
    const score = sumBreakdown(breakdown);
    const nonSexScore = score - (args.sex === "F" ? 1 : 0);

    let band: string;
    let detail: string;
    if (nonSexScore === 0) {
      band = "low — anticoagulation not recommended";
      detail =
        "No non-sex risk factors. Oral anticoagulation is generally not recommended; female sex alone does not change this.";
    } else if (nonSexScore === 1) {
      band = "intermediate — consider anticoagulation";
      detail =
        "One non-sex risk factor. Oral anticoagulation may be considered, weighing bleeding risk and patient preference.";
    } else {
      band = "high — anticoagulation recommended";
      detail =
        "Two or more non-sex risk factors. Oral anticoagulation is recommended absent a strong contraindication.";
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

const hasBled = defineCalculator({
  name: "calc_has_bled",
  title: "HAS-BLED Bleeding Risk Score",
  domain: "cardiology",
  description:
    "Estimate 1-year major bleeding risk in atrial fibrillation patients on anticoagulation and flag modifiable bleeding risk factors.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years (>65 contributes 1 point)."),
    uncontrolled_hypertension: z
      .boolean()
      .describe("Uncontrolled hypertension (systolic BP >160 mmHg)."),
    abnormal_renal_function: z
      .boolean()
      .describe("Abnormal renal function (dialysis, transplant, or creatinine ≥2.26 mg/dL)."),
    abnormal_liver_function: z
      .boolean()
      .describe(
        "Abnormal liver function (cirrhosis, or bilirubin >2× ULN with AST/ALT/ALP >3× ULN).",
      ),
    prior_stroke: z.boolean().describe("History of stroke."),
    prior_major_bleeding: z
      .boolean()
      .describe("Prior major bleeding or predisposition to bleeding."),
    labile_inr: z
      .boolean()
      .describe("Labile INR (unstable/high, or time in therapeutic range <60%)."),
    antiplatelet_or_nsaid_use: z.boolean().describe("Concomitant antiplatelet or NSAID use."),
    alcohol_excess: z.boolean().describe("Alcohol use ≥8 drinks per week."),
  },
  sources: [
    formulaSource({
      title:
        "Pisters R, Lane DA, Nieuwlaat R, et al. A novel user-friendly score (HAS-BLED) to assess 1-year risk of major bleeding in patients with atrial fibrillation. Chest. 2010;138(5):1093-1100.",
      url: "https://pubmed.ncbi.nlm.nih.gov/20299623/",
      publisher: "Chest",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Hypertension (uncontrolled)", value: flag(args.uncontrolled_hypertension, 1) },
      { component: "Abnormal renal function", value: flag(args.abnormal_renal_function, 1) },
      { component: "Abnormal liver function", value: flag(args.abnormal_liver_function, 1) },
      { component: "Stroke history", value: flag(args.prior_stroke, 1) },
      {
        component: "Bleeding history or predisposition",
        value: flag(args.prior_major_bleeding, 1),
      },
      { component: "Labile INR", value: flag(args.labile_inr, 1) },
      { component: "Elderly (age >65)", value: flag(args.age_y > 65, 1) },
      { component: "Antiplatelet / NSAID use", value: flag(args.antiplatelet_or_nsaid_use, 1) },
      { component: "Alcohol excess", value: flag(args.alcohol_excess, 1) },
    ];
    const score = sumBreakdown(breakdown);

    const band = score >= 3 ? "high bleeding risk" : "low-to-moderate bleeding risk";
    const detail =
      score >= 3
        ? "A score ≥3 indicates higher bleeding risk and warrants caution and regular review — but rarely outweighs the stroke-prevention benefit of anticoagulation when CHA₂DS₂-VASc is elevated. Address modifiable factors (BP control, labile INR, alcohol, concomitant antiplatelets/NSAIDs)."
        : "A score 0–2 indicates lower bleeding risk. Continue to address any modifiable bleeding risk factors.";

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

const grace = defineCalculator({
  name: "calc_grace",
  title: "GRACE ACS Risk Score",
  domain: "cardiology",
  description:
    "Estimate in-hospital mortality risk in acute coronary syndrome from age, vitals, creatinine, Killip class, and presenting features.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    heart_rate_bpm: z.number().positive().describe("Heart rate in beats per minute."),
    sbp_mm_hg: z.number().positive().describe("Systolic blood pressure in mmHg."),
    creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
    killip_class: z
      .number()
      .int()
      .min(1)
      .max(4)
      .describe(
        "Killip class: 1 = no CHF, 2 = rales/JVD, 3 = pulmonary edema, 4 = cardiogenic shock.",
      ),
    cardiac_arrest_at_admission: z.boolean().describe("Cardiac arrest at admission."),
    st_segment_deviation: z.boolean().describe("ST-segment deviation on ECG."),
    elevated_cardiac_enzymes: z.boolean().describe("Elevated cardiac biomarkers."),
  },
  sources: [
    formulaSource({
      title:
        "Granger CB, Goldberg RJ, Dabbous O, et al. Predictors of hospital mortality in the global registry of acute coronary events. Arch Intern Med. 2003;163(19):2345-2353.",
      url: "https://pubmed.ncbi.nlm.nih.gov/14581255/",
      publisher: "Archives of Internal Medicine",
    }),
  ],
  compute: (args) => {
    const agePoints = rangePoints(args.age_y, [
      { upTo: 29, points: 0 },
      { upTo: 39, points: 8 },
      { upTo: 49, points: 25 },
      { upTo: 59, points: 41 },
      { upTo: 69, points: 58 },
      { upTo: 79, points: 75 },
      { upTo: 89, points: 91 },
      { upTo: Number.POSITIVE_INFINITY, points: 100 },
    ]);
    const hrPoints = rangePoints(args.heart_rate_bpm, [
      { upTo: 49.9, points: 0 },
      { upTo: 69.9, points: 3 },
      { upTo: 89.9, points: 9 },
      { upTo: 109.9, points: 15 },
      { upTo: 149.9, points: 24 },
      { upTo: 199.9, points: 38 },
      { upTo: Number.POSITIVE_INFINITY, points: 46 },
    ]);
    const sbpPoints = rangePoints(args.sbp_mm_hg, [
      { upTo: 79.9, points: 58 },
      { upTo: 99.9, points: 53 },
      { upTo: 119.9, points: 43 },
      { upTo: 139.9, points: 34 },
      { upTo: 159.9, points: 24 },
      { upTo: 199.9, points: 10 },
      { upTo: Number.POSITIVE_INFINITY, points: 0 },
    ]);
    const creatininePoints = rangePoints(args.creatinine_mg_dl, [
      { upTo: 0.39, points: 1 },
      { upTo: 0.79, points: 4 },
      { upTo: 1.19, points: 7 },
      { upTo: 1.59, points: 10 },
      { upTo: 1.99, points: 13 },
      { upTo: 3.99, points: 21 },
      { upTo: Number.POSITIVE_INFINITY, points: 28 },
    ]);
    const killipPoints = [0, 0, 20, 39, 59][args.killip_class] ?? 0;

    const breakdown = [
      { component: "Age", value: agePoints },
      { component: "Heart rate", value: hrPoints },
      { component: "Systolic blood pressure", value: sbpPoints },
      { component: "Serum creatinine", value: creatininePoints },
      { component: "Killip class", value: killipPoints },
      {
        component: "Cardiac arrest at admission",
        value: flag(args.cardiac_arrest_at_admission, 39),
      },
      { component: "ST-segment deviation", value: flag(args.st_segment_deviation, 28) },
      { component: "Elevated cardiac enzymes", value: flag(args.elevated_cardiac_enzymes, 14) },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    if (score <= 108) band = "low risk — in-hospital mortality <2%";
    else if (score <= 140) band = "intermediate risk — in-hospital mortality ~2–5%";
    else band = "high risk — in-hospital mortality >5%";

    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail:
          "Higher GRACE scores indicate higher acute-coronary-syndrome mortality; intermediate/high risk supports an early invasive strategy.",
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const timiNstemi = defineCalculator({
  name: "calc_timi_nstemi",
  title: "TIMI Risk Score for UA/NSTEMI",
  domain: "cardiology",
  description:
    "Estimate 14-day risk of death, new/recurrent MI, or severe recurrent ischemia in unstable angina / NSTEMI.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years (≥65 contributes 1 point)."),
    cad_risk_factor_count: z
      .number()
      .int()
      .min(0)
      .max(5)
      .describe(
        "Number of CAD risk factors (hypertension, hypercholesterolemia, diabetes, smoking, family history); ≥3 contributes 1 point.",
      ),
    known_cad: z.boolean().describe("Known coronary artery disease (stenosis ≥50%)."),
    aspirin_use_past_7d: z.boolean().describe("Aspirin use in the past 7 days."),
    severe_angina: z.boolean().describe("Severe angina (≥2 episodes in 24 hours)."),
    st_deviation: z.boolean().describe("ST-segment deviation ≥0.5 mm on ECG."),
    positive_cardiac_marker: z.boolean().describe("Elevated cardiac biomarker."),
  },
  sources: [
    formulaSource({
      title:
        "Antman EM, Cohen M, Bernink PJLM, et al. The TIMI risk score for unstable angina/non-ST elevation MI. JAMA. 2000;284(7):835-842.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10938172/",
      publisher: "JAMA",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Age ≥65", value: flag(args.age_y >= 65, 1) },
      { component: "≥3 CAD risk factors", value: flag(args.cad_risk_factor_count >= 3, 1) },
      { component: "Known CAD (stenosis ≥50%)", value: flag(args.known_cad, 1) },
      { component: "Aspirin use in past 7 days", value: flag(args.aspirin_use_past_7d, 1) },
      { component: "Severe angina (≥2 episodes/24h)", value: flag(args.severe_angina, 1) },
      { component: "ST deviation ≥0.5 mm", value: flag(args.st_deviation, 1) },
      { component: "Positive cardiac marker", value: flag(args.positive_cardiac_marker, 1) },
    ];
    const score = sumBreakdown(breakdown);

    // 14-day risk of death / MI / urgent revascularization (Antman 2000).
    const risk = [4.7, 4.7, 8.3, 13.2, 19.9, 26.2, 40.9, 40.9][score] ?? 40.9;
    let band: string;
    if (score <= 2) band = `low risk — ~${risk}% 14-day event rate`;
    else if (score <= 4) band = `intermediate risk — ~${risk}% 14-day event rate`;
    else band = `high risk — ~${risk}% 14-day event rate`;

    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail:
          "The composite endpoint is 14-day all-cause mortality, new or recurrent MI, or severe recurrent ischemia prompting urgent revascularization. Higher scores support an early invasive strategy.",
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

export const cardiologyCalculators: CalculatorDef[] = [chadsVasc, hasBled, grace, timiNstemi];
