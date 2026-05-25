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
  complexity: "formula",
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
  complexity: "formula",
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
  complexity: "formula",
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
/* Anthropometric / body-measurement calculators                                */
/* These are formula-class with no risk stratification — they feed into other  */
/* tools (drug dosing, tidal volume, BSA-based chemo), so the interpretive     */
/* layer is intentionally thin.                                                 */
/* -------------------------------------------------------------------------- */

const bmi = defineCalculator({
  name: "calc_bmi",
  title: "Body Mass Index (BMI)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Body mass index from weight and height. Returns the kg/m² value and the WHO 2000 adult classification band.",
  inputSchema: {
    weight_kg: z.number().positive().describe("Body weight in kilograms."),
    height_m: z.number().positive().describe("Height in meters."),
  },
  sources: [
    formulaSource({
      title:
        "Keys A, Fidanza F, Karvonen MJ, Kimura N, Taylor HL. Indices of relative weight and obesity. J Chronic Dis. 1972;25(6):329-343. (Modern reference.)",
      url: "https://pubmed.ncbi.nlm.nih.gov/4628049/",
      publisher: "Journal of Chronic Diseases",
    }),
    formulaSource({
      title:
        "World Health Organization. Obesity: preventing and managing the global epidemic. WHO Technical Report Series 894, Geneva, 2000.",
      url: "https://iris.who.int/handle/10665/42330",
      publisher: "WHO",
    }),
  ],
  compute: (args) => {
    const bmiValue = round1(args.weight_kg / (args.height_m * args.height_m));
    let band: string;
    if (bmiValue < 18.5) band = "underweight (<18.5)";
    else if (bmiValue < 25) band = "normal (18.5–24.9)";
    else if (bmiValue < 30) band = "overweight (25.0–29.9)";
    else if (bmiValue < 35) band = "class I obesity (30.0–34.9)";
    else if (bmiValue < 40) band = "class II obesity (35.0–39.9)";
    else band = "class III obesity (≥40.0)";

    return {
      result: bmiValue,
      unit: "kg/m²",
      interpretation: {
        band,
        detail:
          "Adult WHO BMI bands (TRS 894, 2000). Asian-population variants use a lower overweight cutoff of 23 (WHO 2004). Misclassifies muscular individuals — pair with waist circumference or body composition where it matters.",
      },
      inputs: { ...args },
      warnings: [
        "Pediatric BMI is interpreted via CDC age- and sex-specific percentiles, not the adult WHO bands. Use a pediatric BMI-percentile tool for patients <20 years.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const bsaMosteller = defineCalculator({
  name: "calc_bsa_mosteller",
  title: "Body Surface Area (Mosteller)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Body surface area estimate (m²) using the Mosteller formula. Standard input for chemotherapy and pediatric drug dosing.",
  inputSchema: {
    weight_kg: z.number().positive().describe("Body weight in kilograms."),
    height_cm: z.number().positive().describe("Height in centimeters."),
  },
  sources: [
    formulaSource({
      title:
        "Mosteller RD. Simplified calculation of body-surface area. N Engl J Med. 1987;317(17):1098.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3657876/",
      publisher: "New England Journal of Medicine",
    }),
  ],
  compute: (args) => {
    const bsa = Math.sqrt((args.weight_kg * args.height_cm) / 3600);
    const bsaRounded = Math.round(bsa * 100) / 100;
    return {
      result: bsaRounded,
      unit: "m²",
      interpretation: {
        band: `${bsaRounded} m²`,
        detail:
          "BSA is most often used as a denominator in chemotherapy dosing. Many institutional chemo protocols cap BSA at 2.0–2.2 m² to avoid overdosing in obese patients — confirm against the institution's protocol.",
      },
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const ibwDevine = defineCalculator({
  name: "calc_ibw_devine",
  title: "Ideal Body Weight (Devine)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Ideal body weight (kg) by the Devine formula (1974). Used as a drug-dosing input for medications dosed by IBW (some aminoglycosides) and for ARDSnet tidal volume targets.",
  inputSchema: {
    height_inches: z.number().positive().describe("Height in inches."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
  },
  sources: [
    formulaSource({
      title: "Devine BJ. Gentamicin therapy. Drug Intell Clin Pharm. 1974;8:650-655.",
      url: "https://journals.sagepub.com/doi/10.1177/106002807400801104",
      publisher: "Drug Intelligence and Clinical Pharmacy",
    }),
  ],
  compute: (args) => {
    const base = args.sex === "F" ? 45.5 : 50;
    const ibw = round1(base + 2.3 * (args.height_inches - 60));
    return {
      result: ibw,
      unit: "kg",
      interpretation: {
        band: `${ibw} kg`,
        detail:
          "Devine IBW assumes a 60-inch (5-foot) baseline. For pediatric dosing, use length-based tools (e.g. Broselow tape) rather than Devine.",
      },
      inputs: { ...args },
      warnings:
        ibw < 30
          ? [
              "Devine IBW returned a value below 30 kg for a short-stature adult input — the formula is not validated at very short adult heights; verify clinically.",
            ]
          : undefined,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Electrolyte / acid-base calculators                                          */
/* -------------------------------------------------------------------------- */

const anionGap = defineCalculator({
  name: "calc_anion_gap",
  title: "Anion Gap",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Calculate the serum anion gap from sodium, chloride, and bicarbonate. Elevated AG suggests an unmeasured-anion metabolic acidosis; use albumin-corrected AG when albumin is low.",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium in mmol/L (≈ mEq/L)."),
    chloride_mmol_l: z.number().positive().describe("Serum chloride in mmol/L."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate in mmol/L."),
  },
  sources: [
    formulaSource({
      title:
        "Emmett M, Narins RG. Clinical use of the anion gap. Medicine (Baltimore). 1977;56(1):38-54.",
      url: "https://pubmed.ncbi.nlm.nih.gov/320459/",
      publisher: "Medicine (Baltimore)",
    }),
    formulaSource({
      title:
        "Kraut JA, Madias NE. Serum anion gap: its uses and limitations in clinical medicine. Clin J Am Soc Nephrol. 2007;2(1):162-174.",
      url: "https://pubmed.ncbi.nlm.nih.gov/17699176/",
      publisher: "Clinical Journal of the American Society of Nephrology",
    }),
  ],
  compute: (args) => {
    const ag = round1(args.sodium_mmol_l - (args.chloride_mmol_l + args.bicarbonate_mmol_l));
    let band: string;
    let detail: string;
    if (ag > 12) {
      band = `elevated (${ag} > 12)`;
      detail =
        "Elevated anion gap. Classic causes include lactic acidosis, diabetic / starvation / alcoholic ketoacidosis, uremia, and toxic alcohols (methanol, ethylene glycol, salicylates). Hypoalbuminemia narrows the AG by ~2.5 mEq/L per 1 g/dL below 4 — correct if albumin is low.";
    } else if (ag < 6) {
      band = `low (${ag} < 6)`;
      detail =
        "Low anion gap is uncommon — consider paraproteinemia (multiple myeloma), hypoalbuminemia, lithium toxicity, bromide ingestion, or laboratory artifact.";
    } else {
      band = `normal (${ag} mEq/L)`;
      detail =
        "Anion gap within typical reference range (6–12 mEq/L, lab-dependent). Normal AG does not exclude a non-anion-gap metabolic acidosis — assess HCO₃ and pH directly.";
    }
    return {
      result: ag,
      unit: "mEq/L",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "This formula does not include potassium (Na − (Cl + HCO₃)). Some authors include K (Na + K − (Cl + HCO₃)) — the cutoffs above assume the no-K convention.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const correctedCalcium = defineCalculator({
  name: "calc_corrected_calcium",
  title: "Calcium Correction for Hypoalbuminemia (Payne)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Adjust measured total serum calcium for hypoalbuminemia using the Payne 1973 formula. Provides an estimate of the calcium concentration that would be measured at normal albumin (4.0 g/dL).",
  inputSchema: {
    serum_calcium_mg_dl: z.number().positive().describe("Measured total serum calcium in mg/dL."),
    serum_albumin_g_dl: z.number().positive().describe("Serum albumin in g/dL."),
    normal_albumin_g_dl: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal albumin (default 4.0 g/dL)."),
  },
  sources: [
    formulaSource({
      title:
        "Payne RB, Little AJ, Williams RB, Milner JR. Interpretation of serum calcium in patients with abnormal serum proteins. BMJ. 1973;4(5893):643-646.",
      url: "https://pubmed.ncbi.nlm.nih.gov/4748672/",
      publisher: "BMJ",
    }),
  ],
  compute: (args) => {
    const normal = args.normal_albumin_g_dl ?? 4.0;
    const corrected = round1(args.serum_calcium_mg_dl + 0.8 * (normal - args.serum_albumin_g_dl));
    let band: string;
    if (corrected < 8.5) band = `low (${corrected} < 8.5)`;
    else if (corrected > 10.5) band = `high (${corrected} > 10.5)`;
    else band = `within reference (${corrected} mg/dL)`;

    return {
      result: corrected,
      unit: "mg/dL",
      interpretation: {
        band,
        detail:
          "Corrected calcium estimates the value at normal albumin. Reference range 8.5–10.5 mg/dL is lab-dependent. When precision matters (e.g. tetany evaluation, severe acidemia, CKD), check ionized calcium directly — Payne correction performs poorly at very low albumin (<2 g/dL) and in renal failure.",
      },
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const correctedSodiumHillier = defineCalculator({
  name: "calc_corrected_sodium_hillier",
  title: "Sodium Correction for Hyperglycemia (Hillier)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Estimate the serum sodium that would be measured at a normal glucose (100 mg/dL) using the Hillier 1999 correction factor (0.024 mmol/L per mg/dL above 100). More accurate than the older Katz 1.6 factor at glucose >400 mg/dL.",
  inputSchema: {
    measured_sodium_mmol_l: z
      .number()
      .positive()
      .describe("Measured serum sodium in mmol/L (≈ mEq/L)."),
    glucose_mg_dl: z.number().positive().describe("Serum glucose in mg/dL."),
  },
  sources: [
    formulaSource({
      title:
        "Hillier TA, Abbott RD, Barrett EJ. Hyponatremia: evaluating the correction factor for hyperglycemia. Am J Med. 1999;106(4):399-403.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10225241/",
      publisher: "American Journal of Medicine",
    }),
  ],
  compute: (args) => {
    const corrected = round1(args.measured_sodium_mmol_l + 0.024 * (args.glucose_mg_dl - 100));
    return {
      result: corrected,
      unit: "mmol/L",
      interpretation: {
        band: `${corrected} mmol/L corrected`,
        detail:
          "Use the corrected value to categorize true hyponatremia: hyperglycemic patients often have a translocational pseudohyponatremia that resolves with glucose correction.",
      },
      inputs: { ...args },
      warnings:
        args.glucose_mg_dl < 100
          ? [
              "Glucose < 100 mg/dL — Hillier correction is not meaningful below the reference; consider returning the measured value unmodified.",
            ]
          : undefined,
    };
  },
});

/* -------------------------------------------------------------------------- */

const serumOsmolality = defineCalculator({
  name: "calc_serum_osmolality",
  title: "Serum Osmolality (calculated)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Calculate serum osmolality from sodium, BUN, and glucose using the standard 2·Na + BUN/2.8 + glucose/18 formula. Compare with measured osmolality to compute an osmolal gap (toxic alcohol screening).",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium in mmol/L."),
    bun_mg_dl: z.number().positive().describe("Blood urea nitrogen in mg/dL."),
    glucose_mg_dl: z.number().positive().describe("Serum glucose in mg/dL."),
  },
  sources: [
    formulaSource({
      title:
        "Smithline N, Gardner KD Jr. Gaps — anionic and osmolal. JAMA. 1976;236(14):1594-1597.",
      url: "https://pubmed.ncbi.nlm.nih.gov/1271372/",
      publisher: "JAMA",
    }),
  ],
  compute: (args) => {
    const osm = round1(2 * args.sodium_mmol_l + args.bun_mg_dl / 2.8 + args.glucose_mg_dl / 18);
    let band: string;
    if (osm < 275) band = `low (${osm} < 275)`;
    else if (osm > 295) band = `high (${osm} > 295)`;
    else band = `within reference (${osm} mOsm/kg)`;

    return {
      result: osm,
      unit: "mOsm/kg",
      interpretation: {
        band,
        detail:
          "Calculated osmolality. An osmolal gap (measured − calculated) > 10 raises concern for an unmeasured osmole — classically methanol, ethylene glycol, isopropanol, propylene glycol, or mannitol. This formula does not include ethanol; if ethanol level is known, add ethanol_mg_dl / 3.7 for a corrected calculated osmolality before computing the gap.",
      },
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

export const renalCalculators: CalculatorDef[] = [
  creatinineClearance,
  gfrCkdEpi,
  meld,
  bmi,
  bsaMosteller,
  ibwDevine,
  anionGap,
  correctedCalcium,
  correctedSodiumHillier,
  serumOsmolality,
];
