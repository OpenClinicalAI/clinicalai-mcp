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
  complexity: "lookup",
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
  complexity: "lookup",
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
  complexity: "lookup",
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
  complexity: "lookup",
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

const map = defineCalculator({
  name: "calc_map",
  title: "Mean Arterial Pressure (MAP)",
  domain: "cardiology",
  complexity: "formula",
  description:
    "Mean arterial pressure from systolic and diastolic blood pressure. The Surviving Sepsis Campaign target for resuscitation is MAP ≥ 65 mmHg.",
  inputSchema: {
    systolic_bp_mm_hg: z.number().positive().describe("Systolic blood pressure in mmHg."),
    diastolic_bp_mm_hg: z.number().positive().describe("Diastolic blood pressure in mmHg."),
  },
  sources: [
    formulaSource({
      title:
        "Magder SA. The meaning of blood pressure. Crit Care. 2018;22(1):257. (Review of MAP as the relevant perfusion pressure.)",
      url: "https://pubmed.ncbi.nlm.nih.gov/24935095/",
      publisher: "Critical Care",
    }),
    formulaSource({
      title:
        "Evans L, Rhodes A, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021. Crit Care Med. 2021;49(11):e1063-e1143.",
      url: "https://pubmed.ncbi.nlm.nih.gov/34599691/",
      publisher: "Critical Care Medicine",
    }),
  ],
  compute: (args) => {
    const mapValue =
      Math.round(((args.systolic_bp_mm_hg + 2 * args.diastolic_bp_mm_hg) / 3) * 10) / 10;
    let band: string;
    let detail: string;
    if (mapValue < 60) {
      band = `severe hypotension (${mapValue} < 60)`;
      detail =
        "MAP < 60 mmHg risks end-organ hypoperfusion. Identify and treat the underlying cause urgently (volume, vasopressors, cardiac output).";
    } else if (mapValue < 65) {
      band = `below SSC resuscitation target (${mapValue} < 65)`;
      detail =
        "Below the Surviving Sepsis Campaign 2021 resuscitation target of MAP ≥ 65 mmHg for septic shock. Continue resuscitation per institutional protocol.";
    } else {
      band = `at or above SSC target (${mapValue} ≥ 65)`;
      detail =
        "At or above the Surviving Sepsis Campaign 2021 resuscitation target of MAP ≥ 65 mmHg. Individualize the target — some patients (chronic hypertension, neurocritical care) need higher MAP.";
    }

    return {
      result: mapValue,
      unit: "mmHg",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "The (SBP + 2·DBP)/3 formula assumes a normal heart rate (60–100). At extreme tachycardia the diastolic-weighted approximation underestimates true MAP — invasive arterial-line MAP is the gold standard when accuracy matters.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const ldlFriedewald = defineCalculator({
  name: "calc_ldl_friedewald",
  title: "LDL Cholesterol (Friedewald formula)",
  domain: "cardiology",
  complexity: "formula",
  description:
    "Calculate LDL cholesterol from total cholesterol, HDL, and triglycerides using the Friedewald formula. Invalid when triglycerides > 400 mg/dL — use Martin-Hopkins or Sampson (or direct LDL) at high triglycerides.",
  inputSchema: {
    total_cholesterol_mg_dl: z.number().positive().describe("Total cholesterol, mg/dL."),
    hdl_mg_dl: z.number().positive().describe("HDL cholesterol, mg/dL."),
    triglycerides_mg_dl: z.number().positive().describe("Triglycerides, mg/dL (fasting)."),
  },
  sources: [
    formulaSource({
      title:
        "Friedewald WT, Levy RI, Fredrickson DS. Estimation of the concentration of low-density lipoprotein cholesterol in plasma, without use of the preparative ultracentrifuge. Clin Chem. 1972;18(6):499-502.",
      url: "https://pubmed.ncbi.nlm.nih.gov/4337382/",
      publisher: "Clinical Chemistry",
    }),
    formulaSource({
      title:
        "Grundy SM, Stone NJ, Bailey AL, et al. 2018 AHA/ACC Guideline on the Management of Blood Cholesterol. J Am Coll Cardiol. 2019;73(24):e285-e350.",
      url: "https://pubmed.ncbi.nlm.nih.gov/30586774/",
      publisher: "Journal of the American College of Cardiology",
    }),
  ],
  compute: (args) => {
    const ldl = Math.round(
      args.total_cholesterol_mg_dl - args.hdl_mg_dl - args.triglycerides_mg_dl / 5,
    );
    let band: string;
    let detail: string;
    if (ldl < 70) {
      band = "optimal (<70)";
      detail =
        "LDL < 70 mg/dL — optimal range, particularly for ASCVD secondary prevention and high-risk primary prevention per 2018 AHA/ACC cholesterol guideline.";
    } else if (ldl < 100) {
      band = "optimal-to-near-optimal (70–99)";
      detail = "LDL within the optimal range for most adults.";
    } else if (ldl < 130) {
      band = "near-optimal (100–129)";
      detail = "Near-optimal LDL; lifestyle and risk-factor management indicated.";
    } else if (ldl < 160) {
      band = "borderline high (130–159)";
      detail = "Borderline-high LDL — review ASCVD risk and consider pharmacologic therapy.";
    } else if (ldl < 190) {
      band = "high (160–189)";
      detail = "High LDL — statin therapy indicated per 2018 cholesterol guideline.";
    } else {
      band = "very high (≥190)";
      detail =
        "Very high LDL (≥190 mg/dL) — high-intensity statin therapy indicated. Consider familial-hypercholesterolemia evaluation if early/severe.";
    }
    return {
      result: ldl,
      unit: "mg/dL",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings:
        args.triglycerides_mg_dl > 400
          ? [
              "Triglycerides > 400 mg/dL — Friedewald is invalid in this range. Use Martin-Hopkins, Sampson-NIH, or direct-measured LDL.",
            ]
          : args.triglycerides_mg_dl > 200
            ? [
                "Triglycerides > 200 mg/dL — Friedewald accuracy degrades; consider Martin-Hopkins or direct LDL for treatment-decision-grade precision.",
              ]
            : undefined,
    };
  },
});

/* -------------------------------------------------------------------------- */

const heartScore = defineCalculator({
  name: "calc_heart_score",
  title: "HEART Score for Major Cardiac Events",
  domain: "cardiology",
  complexity: "lookup",
  description:
    "Risk-stratify chest-pain patients in the emergency department for 6-week major adverse cardiac events (MACE). Score 0–10 across five components: History, ECG, Age, Risk factors, Troponin.",
  inputSchema: {
    history: z
      .enum(["slightly_suspicious", "moderately_suspicious", "highly_suspicious"])
      .describe(
        "Clinician gestalt about the history: slightly (0), moderately (1), highly suspicious (2).",
      ),
    ecg: z
      .enum(["normal", "non_specific_repolarization", "significant_st_deviation"])
      .describe(
        "ECG findings: normal (0), non-specific repolarization disturbance (1), significant ST deviation (2).",
      ),
    age_y: z.number().nonnegative().describe("Age in years."),
    risk_factors_count: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Count of cardiovascular risk factors: hypertension, hypercholesterolemia, diabetes, obesity (BMI >30), current smoker or stopped <3 mo, family history of CVD before 65, history of atherosclerotic disease.",
      ),
    atherosclerotic_disease_history: z
      .boolean()
      .describe(
        "History of atherosclerotic disease (prior MI, PCI / CABG, CVA / TIA, peripheral artery disease). Forces the Risk-Factors sub-score to 2 regardless of count.",
      ),
    initial_troponin: z
      .enum(["normal", "1_to_3_times_normal", "over_3_times_normal"])
      .describe(
        "Initial troponin: ≤normal (0), 1–3× normal upper limit (1), >3× normal upper limit (2).",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Six AJ, Backus BE, Kelder JC. Chest pain in the emergency room: value of the HEART score. Neth Heart J. 2008;16(6):191-196.",
      url: "https://pubmed.ncbi.nlm.nih.gov/18665203/",
      publisher: "Netherlands Heart Journal",
    }),
    formulaSource({
      title:
        "Backus BE, Six AJ, Kelder JC, et al. A prospective validation of the HEART score for chest pain patients at the emergency department. Int J Cardiol. 2013;168(3):2153-2158.",
      url: "https://pubmed.ncbi.nlm.nih.gov/23465250/",
      publisher: "International Journal of Cardiology",
    }),
  ],
  compute: (args) => {
    const historyPts =
      args.history === "highly_suspicious" ? 2 : args.history === "moderately_suspicious" ? 1 : 0;
    const ecgPts =
      args.ecg === "significant_st_deviation"
        ? 2
        : args.ecg === "non_specific_repolarization"
          ? 1
          : 0;
    const agePts = args.age_y >= 65 ? 2 : args.age_y >= 45 ? 1 : 0;
    const rfPts =
      args.atherosclerotic_disease_history || args.risk_factors_count >= 3
        ? 2
        : args.risk_factors_count >= 1
          ? 1
          : 0;
    const tropPts =
      args.initial_troponin === "over_3_times_normal"
        ? 2
        : args.initial_troponin === "1_to_3_times_normal"
          ? 1
          : 0;

    const breakdown = [
      { component: "History", value: historyPts },
      { component: "ECG", value: ecgPts },
      { component: "Age", value: agePts },
      { component: "Risk factors", value: rfPts },
      { component: "Initial troponin", value: tropPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score <= 3) {
      band = "low risk (0–3) — ~1.7% 6-week MACE";
      detail =
        "Low-risk HEART score. The HEART Pathway (Backus 2013) supports early ED disposition with shared decision-making; institutional pathways vary on serial troponin requirements before discharge.";
    } else if (score <= 6) {
      band = "moderate risk (4–6) — ~16.6% 6-week MACE";
      detail =
        "Moderate-risk HEART score. Hospital observation / further evaluation typically indicated — serial troponin, stress testing, or coronary CT angiography per institutional protocol.";
    } else {
      band = "high risk (7–10) — ~50.1% 6-week MACE";
      detail =
        "High-risk HEART score. Admit for early invasive evaluation; consider cardiology consultation. Disposition decisions belong to the treating team — these MACE rates are derived population averages, not patient-level predictions.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "MACE rates from Backus 2013 validation. The 'discharge low-risk' decision is part of the HEART Pathway clinical algorithm, not a direct claim of the original Six 2008 paper. Not validated in patients <21 y.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const rcri = defineCalculator({
  name: "calc_rcri",
  title: "Revised Cardiac Risk Index (Lee)",
  domain: "cardiology",
  complexity: "lookup",
  description:
    "Lee's RCRI — 30-day major cardiac complication risk in elective non-cardiac surgery. Six binary criteria; the risk bands are 0=0.4%, 1=0.9%, 2=6.6%, ≥3=11%. The 2014 ACC/AHA perioperative guideline uses 1% MACE as the elevated-risk threshold.",
  inputSchema: {
    high_risk_surgery: z
      .boolean()
      .describe(
        "High-risk surgery: intraperitoneal, intrathoracic, or suprainguinal vascular (per Lee 1999).",
      ),
    ischemic_heart_disease: z
      .boolean()
      .describe(
        "History of ischemic heart disease (prior MI, positive ETT, current ischemic chest pain, nitrate therapy, ECG with pathological Q waves).",
      ),
    congestive_heart_failure: z
      .boolean()
      .describe(
        "History of CHF (pulmonary edema, bilateral rales/S3, PND, or CXR pulmonary vascular redistribution).",
      ),
    cerebrovascular_disease: z.boolean().describe("History of TIA or stroke."),
    insulin_treatment_for_diabetes: z
      .boolean()
      .describe("Preoperative insulin treatment for diabetes."),
    preoperative_creatinine_mg_dl: z
      .number()
      .positive()
      .describe("Preoperative serum creatinine, mg/dL (counts if >2.0)."),
  },
  sources: [
    formulaSource({
      title:
        "Lee TH, Marcantonio ER, Mangione CM, et al. Derivation and prospective validation of a simple index for prediction of cardiac risk of major noncardiac surgery. Circulation. 1999;100(10):1043-1049.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10477528/",
      publisher: "Circulation",
    }),
  ],
  compute: (args) => {
    const creatHigh = args.preoperative_creatinine_mg_dl > 2.0;
    const breakdown = [
      { component: "High-risk surgery", value: args.high_risk_surgery ? 1 : 0 },
      { component: "Ischemic heart disease", value: args.ischemic_heart_disease ? 1 : 0 },
      { component: "Congestive heart failure", value: args.congestive_heart_failure ? 1 : 0 },
      { component: "Cerebrovascular disease", value: args.cerebrovascular_disease ? 1 : 0 },
      {
        component: "Insulin treatment for diabetes",
        value: args.insulin_treatment_for_diabetes ? 1 : 0,
      },
      { component: "Preoperative creatinine > 2.0 mg/dL", value: creatHigh ? 1 : 0 },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score === 0) {
      band = "0 factors — 30-day MACE ~0.4%";
      detail =
        "Below the 1% ACC/AHA elevated-risk threshold; routine perioperative cardiac assessment generally sufficient.";
    } else if (score === 1) {
      band = "1 factor — 30-day MACE ~0.9%";
      detail =
        "Just below the 1% elevated-risk threshold. Use functional-capacity assessment per ACC/AHA 2014 algorithm.";
    } else if (score === 2) {
      band = "2 factors — 30-day MACE ~6.6%";
      detail =
        "Elevated risk per ACC/AHA 2014 — consider functional capacity, stress testing, and perioperative β-blocker / statin per institutional protocol.";
    } else {
      band = `${score} factors — 30-day MACE ~11%`;
      detail =
        "High perioperative cardiac risk. Multidisciplinary review; functional-capacity assessment, possible non-invasive stress testing, and possible procedural delay / risk-modification discussion.";
    }

    return {
      result: score,
      unit: "factors",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "RCRI is validated in elective non-cardiac surgery in patients ≥50; it underperforms in emergency surgery and is not designed for cardiac surgery. The original paper publishes complication rates, not a go/no-go threshold — that lives in the downstream ACC/AHA 2014 perioperative guideline.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const qtc = defineCalculator({
  name: "calc_qtc",
  title: "Corrected QT Interval (QTc) — five formulas",
  domain: "cardiology",
  complexity: "formula",
  description:
    "Heart-rate-corrected QT interval. Returns the QTc by the requested method (Bazett, Fridericia, Framingham, Hodges, Rautaharju). AHA/ACCF/HRS 2009 prolongation thresholds: adult male >450 ms, adult female >470 ms; severely prolonged >500 ms; FDA ICH-E14 triggers drug-discontinuation review at QTc >500 ms or ΔQTc >60 ms.",
  inputSchema: {
    qt_interval_ms: z.number().positive().describe("QT interval, milliseconds."),
    heart_rate_bpm: z.number().positive().describe("Heart rate, beats per minute."),
    sex: z
      .enum(["M", "F"])
      .optional()
      .describe(
        "Biological sex — used to apply the sex-specific prolongation threshold (male >450, female >470).",
      ),
    method: z
      .enum(["bazett", "fridericia", "framingham", "hodges", "rautaharju"])
      .optional()
      .describe(
        "Correction method. Defaults to `fridericia` (FDA preference per ICH-E14). Bazett over-corrects at HR >90 and under-corrects at HR <60.",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Rautaharju PM, Surawicz B, Gettes LS, et al. AHA/ACCF/HRS Recommendations for the Standardization and Interpretation of the Electrocardiogram: Part IV — the ST segment, T and U waves, and the QT interval. J Am Coll Cardiol. 2009;53(11):982-991. (Source of the standard QTc prolongation thresholds.)",
      url: "https://pubmed.ncbi.nlm.nih.gov/19281930/",
      publisher: "Journal of the American College of Cardiology",
    }),
    formulaSource({
      title:
        "Sagie A, Larson MG, Goldberg RJ, Bengtson JR, Levy D. An improved method for adjusting the QT interval for heart rate (the Framingham Heart Study). Am J Cardiol. 1992;70(7):797-801.",
      url: "https://pubmed.ncbi.nlm.nih.gov/1519533/",
      publisher: "American Journal of Cardiology",
    }),
    formulaSource({
      title:
        "Rautaharju PM, Mason JW, Akiyama T. New age- and sex-specific criteria for QT prolongation based on rate correction formulas that minimize bias at the upper normal limits. Int J Cardiol. 2014;174(3):535-540.",
      url: "https://pubmed.ncbi.nlm.nih.gov/24793593/",
      publisher: "International Journal of Cardiology",
    }),
  ],
  compute: (args) => {
    const method = args.method ?? "fridericia";
    const rrSec = 60 / args.heart_rate_bpm;
    let qtc: number;
    switch (method) {
      case "bazett":
        qtc = args.qt_interval_ms / Math.sqrt(rrSec);
        break;
      case "fridericia":
        qtc = args.qt_interval_ms / Math.cbrt(rrSec);
        break;
      case "framingham":
        qtc = args.qt_interval_ms + 154 * (1 - rrSec);
        break;
      case "hodges":
        qtc = args.qt_interval_ms + 1.75 * (args.heart_rate_bpm - 60);
        break;
      case "rautaharju":
        qtc = (args.qt_interval_ms * (120 + args.heart_rate_bpm)) / 180;
        break;
    }
    const qtcRounded = Math.round(qtc);

    const prolongedThreshold = args.sex === "F" ? 470 : 450;
    let band: string;
    let detail: string;
    if (qtcRounded < 340) {
      band = `short QTc (${qtcRounded} < 340 ms, abnormal)`;
      detail =
        "Short QTc is abnormal — consider short-QT syndrome, hypercalcemia, hyperkalemia, acidosis, or digitalis effect.";
    } else if (qtcRounded > 500) {
      band = `severely prolonged QTc (${qtcRounded} > 500 ms)`;
      detail = `Severely prolonged QTc. FDA ICH-E14 guidance triggers drug-discontinuation evaluation at >500 ms or ΔQTc >60 ms. Review QT-prolonging drugs, electrolytes (K, Mg), and clinical context (LQTS, bradyarrhythmia). Method: ${method}.`;
    } else if (qtcRounded > prolongedThreshold) {
      band = `prolonged QTc (${qtcRounded} > ${prolongedThreshold} ms, ${args.sex === "F" ? "female" : "male"} threshold)`;
      detail = `Prolonged QTc by AHA/ACCF/HRS 2009 thresholds. Review QT-prolonging medications and electrolytes; serial monitoring is reasonable. Method: ${method}.`;
    } else {
      band = `normal QTc (${qtcRounded} ms)`;
      detail = `QTc within normal limits by AHA/ACCF/HRS 2009 thresholds. Method: ${method}.`;
    }

    return {
      result: qtcRounded,
      unit: "ms",
      interpretation: { band, detail },
      inputs: { ...args, method, rr_seconds: Number(rrSec.toFixed(3)) },
      warnings: [
        "QTc is invalid in atrial fibrillation or wide-complex rhythms — compute manual JT interval instead. Bazett over-corrects at HR >90 bpm and under-corrects at HR <60; Fridericia (FDA ICH-E14 preference) is more rate-independent. QT should be measured in lead II or V5 with the longest interval present.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const cardiologyCalculators: CalculatorDef[] = [
  chadsVasc,
  hasBled,
  grace,
  timiNstemi,
  map,
  ldlFriedewald,
  heartScore,
  rcri,
  qtc,
];
