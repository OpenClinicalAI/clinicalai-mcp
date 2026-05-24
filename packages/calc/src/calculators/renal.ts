/**
 * Renal / metabolic calculators (ARCHITECTURE.md §5.3).
 *
 * Formulas are reimplemented from the primary literature cited on each result.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator } from "../framework.js";

const round1 = (n: number): number => Math.round(n * 10) / 10;

/* -------------------------------------------------------------------------- */

const creatinineClearance = defineCalculator({
  name: "calc_creatinine_clearance",
  title: "Creatinine Clearance (Cockcroft-Gault)",
  domain: "renal-metabolic",
  description:
    "Estimate creatinine clearance from age, weight, sex, and serum creatinine using the Cockcroft-Gault equation. Widely used for renal drug dosing.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    weight_kg: z.number().positive().describe("Body weight in kilograms."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
    serum_creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
  },
  sources: [
    formulaSource({
      title:
        "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31-41.",
      url: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
      publisher: "Nephron",
    }),
  ],
  compute: (args) => {
    const sexFactor = args.sex === "F" ? 0.85 : 1;
    const crcl = round1(
      ((140 - args.age_y) * args.weight_kg * sexFactor) / (72 * args.serum_creatinine_mg_dl),
    );

    let band: string;
    let detail: string;
    if (crcl >= 90) {
      band = "normal (≥90 mL/min)";
      detail = "Estimated creatinine clearance is in the normal range.";
    } else if (crcl >= 60) {
      band = "mildly decreased (60–89 mL/min)";
      detail = "Mildly reduced clearance — review renally-cleared drug doses.";
    } else if (crcl >= 30) {
      band = "moderately decreased (30–59 mL/min)";
      detail = "Moderately reduced clearance — many renally-cleared drugs need dose adjustment.";
    } else if (crcl >= 15) {
      band = "severely decreased (15–29 mL/min)";
      detail =
        "Severely reduced clearance — substantial dose adjustment or avoidance is often required.";
    } else {
      band = "kidney failure (<15 mL/min)";
      detail =
        "Clearance consistent with kidney failure — specialist input and careful drug review indicated.";
    }

    return {
      result: crcl,
      unit: "mL/min",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "Cockcroft-Gault estimates creatinine clearance, not GFR, and uses actual body weight; in obesity or low muscle mass it may misestimate. Use clinical judgement for drug dosing.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const gfrCkdEpi = defineCalculator({
  name: "calc_gfr_ckd_epi",
  title: "Estimated GFR (CKD-EPI 2021, race-free)",
  domain: "renal-metabolic",
  description:
    "Estimate glomerular filtration rate from age, sex, and serum creatinine using the 2021 race-free CKD-EPI creatinine equation — the current NKF/ASN-recommended equation.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
    serum_creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
  },
  sources: [
    formulaSource({
      title:
        "Inker LA, Eneanya ND, Coresh J, et al. New Creatinine- and Cystatin C-Based Equations to Estimate GFR without Race. N Engl J Med. 2021;385(19):1737-1749.",
      url: "https://pubmed.ncbi.nlm.nih.gov/34554658/",
      publisher: "New England Journal of Medicine",
    }),
  ],
  compute: (args) => {
    const female = args.sex === "F";
    const kappa = female ? 0.7 : 0.9;
    const alpha = female ? -0.241 : -0.302;
    const scrK = args.serum_creatinine_mg_dl / kappa;
    const egfr = Math.round(
      142 *
        Math.min(scrK, 1) ** alpha *
        Math.max(scrK, 1) ** -1.2 *
        0.9938 ** args.age_y *
        (female ? 1.012 : 1),
    );

    let band: string;
    if (egfr >= 90) band = "G1 — normal or high (≥90)";
    else if (egfr >= 60) band = "G2 — mildly decreased (60–89)";
    else if (egfr >= 45) band = "G3a — mildly to moderately decreased (45–59)";
    else if (egfr >= 30) band = "G3b — moderately to severely decreased (30–44)";
    else if (egfr >= 15) band = "G4 — severely decreased (15–29)";
    else band = "G5 — kidney failure (<15)";

    const detail =
      egfr >= 60
        ? "An eGFR ≥60 is not, by itself, CKD — interpret with markers of kidney damage (e.g. albuminuria) and clinical context."
        : "An eGFR <60 sustained ≥3 months meets the GFR criterion for CKD; confirm chronicity and assess albuminuria for full staging.";

    return {
      result: egfr,
      unit: "mL/min/1.73m²",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "The 2021 CKD-EPI equation is race-free by design. eGFR is least reliable near-normal and at extremes of muscle mass; a cystatin C-based estimate can confirm.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const meld = defineCalculator({
  name: "calc_meld",
  title: "MELD-Na (Model for End-Stage Liver Disease, sodium-adjusted)",
  domain: "renal-metabolic",
  description:
    "Estimate 3-month mortality in chronic liver disease from bilirubin, INR, creatinine, and (optionally) sodium using the MELD-Na score.",
  inputSchema: {
    bilirubin_mg_dl: z.number().positive().describe("Total bilirubin in mg/dL."),
    inr: z.number().positive().describe("International normalized ratio."),
    creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
    sodium_meq_l: z
      .number()
      .positive()
      .optional()
      .describe("Serum sodium in mEq/L. When supplied, the sodium-adjusted MELD-Na is returned."),
    on_dialysis: z
      .boolean()
      .optional()
      .describe("True if the patient had ≥2 dialysis sessions (or 24h of CVVHD) in the past week."),
  },
  sources: [
    formulaSource({
      title:
        "Kamath PS, Wiesner RH, Malinchoc M, et al. A model to predict survival in patients with end-stage liver disease. Hepatology. 2001;33(2):464-470.",
      url: "https://pubmed.ncbi.nlm.nih.gov/11172350/",
      publisher: "Hepatology",
    }),
    formulaSource({
      title:
        "Kim WR, Biggins SW, Kremers WK, et al. Hyponatremia and mortality among patients on the liver-transplant waiting list. N Engl J Med. 2008;359(10):1018-1026.",
      url: "https://pubmed.ncbi.nlm.nih.gov/18768945/",
      publisher: "New England Journal of Medicine",
    }),
  ],
  compute: (args) => {
    const bili = Math.max(args.bilirubin_mg_dl, 1);
    const inr = Math.max(args.inr, 1);
    // Creatinine is floored at 1.0, capped at 4.0, and set to 4.0 on dialysis.
    let creat = Math.max(args.creatinine_mg_dl, 1);
    if (args.on_dialysis) creat = 4;
    creat = Math.min(creat, 4);

    let score = Math.round(
      10 * (0.957 * Math.log(creat) + 0.378 * Math.log(bili) + 1.12 * Math.log(inr) + 0.643),
    );

    let usedSodium = false;
    if (args.sodium_meq_l !== undefined && score > 11) {
      const na = Math.min(Math.max(args.sodium_meq_l, 125), 137);
      score = Math.round(score + 1.32 * (137 - na) - 0.033 * score * (137 - na));
      usedSodium = true;
    }
    score = Math.min(Math.max(score, 6), 40);

    let band: string;
    if (score <= 9) band = "≤9 — ~1.9% 3-month mortality";
    else if (score <= 19) band = "10–19 — ~6% 3-month mortality";
    else if (score <= 29) band = "20–29 — ~19.6% 3-month mortality";
    else if (score <= 39) band = "30–39 — ~52.6% 3-month mortality";
    else band = "≥40 — ~71.3% 3-month mortality";

    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail: usedSodium
          ? "Sodium-adjusted MELD-Na. Higher scores indicate higher 3-month mortality and higher liver-transplant priority."
          : "Base MELD (no sodium supplied). Higher scores indicate higher 3-month mortality.",
      },
      inputs: { ...args },
      warnings: [
        "MELD 3.0 (2023) superseded MELD-Na for OPTN allocation; it additionally incorporates serum albumin and sex. This tool implements MELD-Na.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const renalCalculators: CalculatorDef[] = [creatinineClearance, gfrCkdEpi, meld];
