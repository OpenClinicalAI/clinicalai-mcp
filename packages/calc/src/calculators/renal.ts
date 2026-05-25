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

const targetWeight = defineCalculator({
  name: "calc_target_weight",
  title: "Target Body Weight (BMI-targeted)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Compute the body weight that corresponds to a given target BMI for a patient's height. Returns a numeric target only — pair with a behavior-change tool and dietitian referral in clinical use.",
  inputSchema: {
    target_bmi: z.number().positive().describe("Target BMI in kg/m² (typically 18.5–30)."),
    height_m: z.number().positive().describe("Height in meters."),
  },
  sources: [
    formulaSource({
      title:
        "World Health Organization. Obesity: preventing and managing the global epidemic. WHO Technical Report Series 894, Geneva, 2000. (BMI categories.)",
      url: "https://iris.who.int/handle/10665/42330",
      publisher: "WHO",
    }),
  ],
  compute: (args) => {
    const target = round1(args.target_bmi * args.height_m * args.height_m);
    return {
      result: target,
      unit: "kg",
      interpretation: {
        band: `${target} kg at BMI ${args.target_bmi}`,
        detail:
          "Numeric target only — operational formula, not a validated clinical goal-setter. Pair with patient context, behavior-change support, and a dietitian referral.",
      },
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const adjustedBodyWeight = defineCalculator({
  name: "calc_adjusted_body_weight",
  title: "Adjusted Body Weight",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Adjusted body weight = IBW + 0.4 × (actual − IBW). Used for aminoglycoside, vancomycin, and some chemotherapy dosing in patients whose actual weight exceeds IBW by >20–30%.",
  inputSchema: {
    actual_weight_kg: z.number().positive().describe("Actual measured body weight, kg."),
    ideal_weight_kg: z
      .number()
      .positive()
      .describe("Ideal body weight in kg (e.g. from calc_ibw_devine)."),
  },
  sources: [
    formulaSource({
      title:
        "Pai MP, Paloucek FP. The origin of the 'ideal' body weight equations. Ann Pharmacother. 2000;34(9):1066-1069. (Historical context for adjusted body weight.)",
      url: "https://pubmed.ncbi.nlm.nih.gov/10852121/",
      publisher: "Annals of Pharmacotherapy",
    }),
  ],
  compute: (args) => {
    if (args.actual_weight_kg <= args.ideal_weight_kg) {
      return {
        result: args.actual_weight_kg,
        unit: "kg",
        interpretation: {
          band: `${args.actual_weight_kg} kg (no adjustment — use actual)`,
          detail:
            "Actual weight is at or below IBW. The adjustment factor is intended for obesity (actual > IBW); return actual unchanged.",
        },
        inputs: { ...args },
      };
    }
    const adjusted = round1(
      args.ideal_weight_kg + 0.4 * (args.actual_weight_kg - args.ideal_weight_kg),
    );
    const excessPct = Math.round(
      ((args.actual_weight_kg - args.ideal_weight_kg) / args.ideal_weight_kg) * 100,
    );
    return {
      result: adjusted,
      unit: "kg",
      interpretation: {
        band: `${adjusted} kg (actual ${excessPct}% above IBW)`,
        detail:
          "Adjusted body weight (Pai-Paloucek). Apply only when actual weight exceeds IBW by >20–30% per Pai 2000. Used in aminoglycoside dosing, vancomycin loading, and select chemotherapy protocols.",
      },
      inputs: { ...args },
      warnings:
        excessPct < 20
          ? [
              "Actual weight is less than 20% above IBW — Pai 2000 recommends using actual body weight rather than the adjusted formula in this range.",
            ]
          : undefined,
    };
  },
});

/* -------------------------------------------------------------------------- */

const fena = defineCalculator({
  name: "calc_fena",
  title: "Fractional Excretion of Sodium (FENa)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "FENa = (U_Na × S_Cr) / (S_Na × U_Cr) × 100. Differentiates prerenal AKI (FENa < 1%) from intrinsic / ATN (FENa > 2%). Invalidated by loop diuretics — use FE-urea instead.",
  inputSchema: {
    serum_creatinine_mg_dl: z.number().positive().describe("Serum creatinine, mg/dL."),
    serum_sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
    urine_creatinine_mg_dl: z.number().positive().describe("Urine creatinine, mg/dL."),
    urine_sodium_mmol_l: z.number().positive().describe("Urine sodium, mmol/L."),
  },
  sources: [
    formulaSource({
      title:
        "Espinel CH. The FENa test. Use in the differential diagnosis of acute renal failure. JAMA. 1976;236(6):579-581.",
      url: "https://pubmed.ncbi.nlm.nih.gov/1255711/",
      publisher: "JAMA",
    }),
  ],
  compute: (args) => {
    const fenaValue =
      Math.round(
        ((args.urine_sodium_mmol_l * args.serum_creatinine_mg_dl) /
          (args.serum_sodium_mmol_l * args.urine_creatinine_mg_dl)) *
          100 *
          100,
      ) / 100;
    let band: string;
    let detail: string;
    if (fenaValue < 1) {
      band = `prerenal pattern (${fenaValue}% < 1%)`;
      detail =
        "FENa < 1% suggests preserved tubular sodium reabsorption — typically prerenal AKI (volume depletion, cardiorenal). Exceptions: contrast nephropathy, hepatorenal syndrome, and early glomerulonephritis can produce FENa < 1% despite intrinsic pathology.";
    } else if (fenaValue > 2) {
      band = `intrinsic / ATN pattern (${fenaValue}% > 2%)`;
      detail =
        "FENa > 2% suggests impaired tubular sodium handling — typically acute tubular necrosis. Pair with urine sediment, BUN/Cr ratio, and clinical context.";
    } else {
      band = `indeterminate (${fenaValue}% between 1–2%)`;
      detail =
        "FENa in the indeterminate range; clinical correlation needed. Consider FE-urea (more reliable on loop diuretics).";
    }
    return {
      result: fenaValue,
      unit: "%",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "Loop diuretics artificially elevate FENa — use the fractional excretion of urea (FE-urea) instead in patients on furosemide/torsemide/bumetanide.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const freeWaterDeficit = defineCalculator({
  name: "calc_free_water_deficit",
  title: "Free Water Deficit (Adrogué-Madias)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Free water deficit in hypernatremia — FWD = TBW% × weight × (Na/140 − 1). Used to calculate the water-replacement volume; correct hypernatremia slowly (≤0.5 mEq/L/hr, ≤10 mEq/L per 24h) to avoid cerebral edema.",
  inputSchema: {
    age_y: z.number().nonnegative().describe("Age in years."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
    weight_kg: z.number().positive().describe("Body weight, kg."),
    sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
  },
  sources: [
    formulaSource({
      title: "Adrogué HJ, Madias NE. Hypernatremia. N Engl J Med. 2000;342(20):1493-1499.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10816188/",
      publisher: "New England Journal of Medicine",
    }),
  ],
  compute: (args) => {
    // Total body water fraction by age and sex.
    let tbwFraction: number;
    if (args.age_y < 18) tbwFraction = 0.6;
    else if (args.age_y >= 65) tbwFraction = args.sex === "F" ? 0.45 : 0.5;
    else tbwFraction = args.sex === "F" ? 0.5 : 0.6;

    const fwd = round1(tbwFraction * args.weight_kg * (args.sodium_mmol_l / 140 - 1));
    return {
      result: fwd,
      unit: "L",
      interpretation: {
        band: `${fwd} L deficit`,
        detail:
          "Free-water-replacement volume to return serum sodium to 140 mmol/L. Replace gradually — the rate-of-correction limit is the same as the deficit volume in matters of safety: ≤ 0.5 mEq/L per hour and ≤ 10 mEq/L per 24 hours to avoid cerebral edema. Ongoing losses (urine output, insensible) must be replaced on top of this deficit.",
      },
      inputs: { ...args, tbw_fraction: tbwFraction },
      warnings: [
        "Adrogué-Madias also publishes a sodium-deficit formula for hyponatremia — these are different scenarios; do not confuse the two.",
        "TBW fractions are population estimates; obese patients may need a leaner correction. Hemodynamically unstable patients need parallel volume resuscitation.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const maintenanceFluids = defineCalculator({
  name: "calc_maintenance_fluids",
  title: "Maintenance IV Fluid Rate (Holliday-Segar 4-2-1)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Holliday-Segar 4-2-1 rule for maintenance IV fluid rate by body weight. Returns mL/hr; does not specify composition (sodium-free dextrose-only fluids are no longer recommended for inpatient pediatric maintenance — see Friedman 2018).",
  inputSchema: {
    weight_kg: z.number().positive().describe("Body weight in kilograms."),
  },
  sources: [
    formulaSource({
      title:
        "Holliday MA, Segar WE. The maintenance need for water in parenteral fluid therapy. Pediatrics. 1957;19(5):823-832.",
      url: "https://pubmed.ncbi.nlm.nih.gov/13431307/",
      publisher: "Pediatrics",
    }),
    formulaSource({
      title:
        "Friedman JN, Beck CE, DeGroot J, et al. Comparison of Isotonic and Hypotonic Intravenous Maintenance Fluids: A Randomized Clinical Trial. JAMA Pediatr. 2018;172(11):1071-1078.",
      url: "https://pubmed.ncbi.nlm.nih.gov/30359961/",
      publisher: "JAMA Pediatrics",
    }),
  ],
  compute: (args) => {
    let rate: number;
    if (args.weight_kg < 10) rate = 4 * args.weight_kg;
    else if (args.weight_kg <= 20) rate = 40 + 2 * (args.weight_kg - 10);
    else rate = 60 + 1 * (args.weight_kg - 20);
    rate = round1(rate);
    return {
      result: rate,
      unit: "mL/hr",
      interpretation: {
        band: `${rate} mL/hr maintenance`,
        detail:
          "Holliday-Segar rate is a starting point for a relatively well, afebrile, non-third-spacing patient. Critical-illness, fever, third-spacing, and ongoing losses all alter the requirement. This tool gives volume, not composition — for inpatient peds, isotonic fluids are preferred over hypotonic per Friedman 2018.",
      },
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const mdrdGfr = defineCalculator({
  name: "calc_mdrd_gfr",
  title: "MDRD eGFR (4-variable, IDMS-traceable) — legacy",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Legacy MDRD eGFR equation. Deprecated by NKF/ASN (Delgado 2021) in favor of the race-free CKD-EPI 2021 equation (`calc_gfr_ckd_epi`). The race coefficient is configurable and defaults OFF for new use — set it on only when faithfully reproducing legacy EHR reports.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
    serum_creatinine_mg_dl: z
      .number()
      .positive()
      .describe("Serum creatinine, mg/dL (standardized assay)."),
    apply_black_race_coefficient: z
      .boolean()
      .optional()
      .describe(
        "Apply the 1.212 Black-race coefficient. Defaults to false (NKF/ASN 2021 recommendation). Only set true when reproducing legacy reports.",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Levey AS, Coresh J, Greene T, et al. Using standardized serum creatinine values in the Modification of Diet in Renal Disease Study equation for estimating glomerular filtration rate. Ann Intern Med. 2006;145(4):247-254.",
      url: "https://pubmed.ncbi.nlm.nih.gov/16908915/",
      publisher: "Annals of Internal Medicine",
    }),
    formulaSource({
      title:
        "Delgado C, Baweja M, Crews DC, et al. A unifying approach for GFR estimation: Recommendations of the NKF-ASN Task Force on reassessing the inclusion of race in diagnosing kidney disease. J Am Soc Nephrol. 2022;33(1):216-242.",
      url: "https://pubmed.ncbi.nlm.nih.gov/34470707/",
      publisher: "Journal of the American Society of Nephrology",
    }),
  ],
  compute: (args) => {
    const sexFactor = args.sex === "F" ? 0.742 : 1;
    const raceFactor = args.apply_black_race_coefficient ? 1.212 : 1;
    const egfr = Math.round(
      175 * args.serum_creatinine_mg_dl ** -1.154 * args.age_y ** -0.203 * sexFactor * raceFactor,
    );

    let band: string;
    if (egfr >= 90) band = "G1 — normal or high (≥90)";
    else if (egfr >= 60) band = "G2 — mildly decreased (60–89)";
    else if (egfr >= 45) band = "G3a — mildly to moderately decreased (45–59)";
    else if (egfr >= 30) band = "G3b — moderately to severely decreased (30–44)";
    else if (egfr >= 15) band = "G4 — severely decreased (15–29)";
    else band = "G5 — kidney failure (<15)";

    return {
      result: egfr,
      unit: "mL/min/1.73m²",
      interpretation: {
        band,
        detail:
          "MDRD underperforms at GFR > 60 (it was derived in a CKD cohort) and has been superseded by CKD-EPI 2021 (`calc_gfr_ckd_epi`). Use MDRD only for back-compat with legacy EHR reports or studies that pre-date the 2021 NKF/ASN recommendation.",
      },
      inputs: { ...args },
      warnings: [
        "MDRD is the legacy CKD-staging equation. NKF/ASN 2021 (Delgado et al, PMID 34470707) recommends `calc_gfr_ckd_epi` (CKD-EPI 2021, race-free) as the current standard. Race coefficient defaults to OFF; only enable for explicit legacy reproduction.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Wrenn / Figge acid-base delta family                                         */
/* -------------------------------------------------------------------------- */

/** Compute anion gap (no K convention) from the three core inputs. */
function computeAnionGapValue(sodium: number, chloride: number, bicarbonate: number): number {
  return sodium - (chloride + bicarbonate);
}

/** Albumin-corrected AG per Figge 1998. */
function computeAlbCorrectedAg(ag: number, albumin: number): number {
  return ag + 2.5 * (4.0 - albumin);
}

function deltaGapBand(delta: number): { band: string; detail: string } {
  if (Math.abs(delta) <= 6) {
    return {
      band: `pure anion-gap acidosis (Δgap ${delta}, within ±6)`,
      detail:
        "Δgap close to 0 — the elevated anion gap accounts for the entire bicarbonate deficit; no coexisting non-AG acidosis or metabolic alkalosis indicated.",
    };
  }
  if (delta > 0) {
    return {
      band: `coexisting metabolic alkalosis (Δgap ${delta} > 6)`,
      detail:
        "Positive Δgap — the bicarbonate is higher than would be expected for the magnitude of the AG rise, suggesting a coexisting metabolic alkalosis.",
    };
  }
  return {
    band: `coexisting non-AG (hyperchloremic) metabolic acidosis (Δgap ${delta} < −6)`,
    detail:
      "Negative Δgap — the bicarbonate has fallen more than the AG has risen, suggesting a coexisting non-anion-gap (hyperchloremic) metabolic acidosis.",
  };
}

function deltaRatioBand(ratio: number): { band: string; detail: string } {
  if (ratio < 0.4) {
    return {
      band: `non-AG / hyperchloremic acidosis (Δratio ${ratio} < 0.4)`,
      detail:
        "Pattern suggests a pure non-anion-gap (hyperchloremic) metabolic acidosis — the AG has barely risen relative to the bicarbonate drop.",
    };
  }
  if (ratio < 1.0) {
    return {
      band: `combined high-AG + non-AG acidosis (Δratio ${ratio}, 0.4–1.0)`,
      detail: "Mixed pattern — both an anion-gap acidosis and a non-AG acidosis contributing.",
    };
  }
  if (ratio <= 2.0) {
    return {
      band: `pure anion-gap acidosis (Δratio ${ratio}, 1.0–2.0; typical of DKA)`,
      detail:
        "Pattern consistent with a pure anion-gap metabolic acidosis (e.g. DKA, lactic acidosis).",
    };
  }
  return {
    band: `high-AG acidosis with coexisting metabolic alkalosis or chronic respiratory acidosis (Δratio ${ratio} > 2.0)`,
    detail:
      "The bicarbonate has fallen less than the AG rise would predict — suggests a coexisting metabolic alkalosis or pre-existing chronic respiratory acidosis with renal compensation.",
  };
}

const deltaGap = defineCalculator({
  name: "calc_delta_gap",
  title: "Delta Gap (Wrenn)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Δgap = anion gap − 12 (or other lab-specific normal AG). Diagnoses mixed acid-base disorders by comparing the AG rise to the HCO₃ fall.",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
    chloride_mmol_l: z.number().positive().describe("Serum chloride, mmol/L."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate, mmol/L."),
    normal_anion_gap: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal anion gap (default 12; some labs use 10)."),
  },
  sources: [
    formulaSource({
      title:
        "Wrenn K. The delta (Δ) gap: an approach to mixed acid-base disorders. Ann Emerg Med. 1990;19(11):1310-1313.",
      url: "https://pubmed.ncbi.nlm.nih.gov/2389872/",
      publisher: "Annals of Emergency Medicine",
    }),
  ],
  compute: (args) => {
    const ag = computeAnionGapValue(
      args.sodium_mmol_l,
      args.chloride_mmol_l,
      args.bicarbonate_mmol_l,
    );
    const normalAg = args.normal_anion_gap ?? 12;
    const delta = round1(ag - normalAg);
    const { band, detail } = deltaGapBand(delta);
    return {
      result: delta,
      unit: "mEq/L",
      interpretation: { band, detail },
      inputs: { ...args, anion_gap: ag },
    };
  },
});

const deltaRatio = defineCalculator({
  name: "calc_delta_ratio",
  title: "Delta Ratio (Wrenn)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Δratio = (AG − 12) / (24 − HCO₃). Discriminates pure anion-gap acidosis (1.0–2.0) from mixed patterns. Undefined when HCO₃ ≥ 24 (no acidosis to compare against).",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
    chloride_mmol_l: z.number().positive().describe("Serum chloride, mmol/L."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate, mmol/L."),
    normal_anion_gap: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal AG (default 12)."),
    normal_bicarbonate: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal bicarbonate (default 24)."),
  },
  sources: [
    formulaSource({
      title:
        "Wrenn K. The delta (Δ) gap: an approach to mixed acid-base disorders. Ann Emerg Med. 1990;19(11):1310-1313.",
      url: "https://pubmed.ncbi.nlm.nih.gov/2389872/",
      publisher: "Annals of Emergency Medicine",
    }),
    formulaSource({
      title:
        "Berend K, de Vries APJ, Gans ROB. Physiological approach to assessment of acid-base disturbances. N Engl J Med. 2014;371(15):1434-1445.",
      url: "https://pubmed.ncbi.nlm.nih.gov/25295502/",
      publisher: "New England Journal of Medicine",
    }),
  ],
  compute: (args) => {
    const ag = computeAnionGapValue(
      args.sodium_mmol_l,
      args.chloride_mmol_l,
      args.bicarbonate_mmol_l,
    );
    const normalAg = args.normal_anion_gap ?? 12;
    const normalBicarb = args.normal_bicarbonate ?? 24;
    const denominator = normalBicarb - args.bicarbonate_mmol_l;

    if (denominator <= 0) {
      return {
        result: 0,
        unit: "",
        interpretation: {
          band: "undefined (HCO₃ at or above reference)",
          detail:
            "Δratio is not meaningful when bicarbonate is at or above the reference normal — no metabolic acidosis is present to compare the AG rise against.",
        },
        inputs: { ...args, anion_gap: ag },
        warnings: [
          "Bicarbonate is at or above the reference value; Δratio is undefined. Use the Δgap or interpret the AG and HCO₃ separately.",
        ],
      };
    }
    const ratio = round1((ag - normalAg) / denominator);
    const { band, detail } = deltaRatioBand(ratio);
    return {
      result: ratio,
      unit: "",
      interpretation: { band, detail },
      inputs: { ...args, anion_gap: ag },
      warnings: [
        "Δratio band cutoffs are clinical-correlate ranges (Berend 2014 textbook review), not strict thresholds from Wrenn 1990. Interpret in clinical context.",
      ],
    };
  },
});

const albCorrectedAnionGap = defineCalculator({
  name: "calc_albumin_corrected_anion_gap",
  title: "Albumin-Corrected Anion Gap (Figge)",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Restores AG sensitivity in hypoalbuminemia by adding 2.5 mEq/L per 1 g/dL below 4.0 (Figge 1998).",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
    chloride_mmol_l: z.number().positive().describe("Serum chloride, mmol/L."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate, mmol/L."),
    albumin_g_dl: z.number().positive().describe("Serum albumin, g/dL."),
  },
  sources: [
    formulaSource({
      title:
        "Figge J, Jabor A, Kazda A, Fencl V. Anion gap and hypoalbuminemia. Crit Care Med. 1998;26(11):1807-1810.",
      url: "https://pubmed.ncbi.nlm.nih.gov/9559600/",
      publisher: "Critical Care Medicine",
    }),
  ],
  compute: (args) => {
    const ag = computeAnionGapValue(
      args.sodium_mmol_l,
      args.chloride_mmol_l,
      args.bicarbonate_mmol_l,
    );
    const corrected = round1(computeAlbCorrectedAg(ag, args.albumin_g_dl));
    let band: string;
    let detail: string;
    if (corrected > 12) {
      band = `elevated (${corrected} > 12)`;
      detail =
        "Albumin-corrected AG is elevated. Hypoalbuminemia narrows the measured AG; the correction restores diagnostic sensitivity for unmeasured-anion acidosis.";
    } else if (corrected < 6) {
      band = `low (${corrected} < 6)`;
      detail = "Albumin-corrected AG is low — consider paraproteinemia or lab artifact.";
    } else {
      band = `within reference (${corrected} mEq/L)`;
      detail =
        "Albumin-corrected AG within typical reference range. The correction matters most when albumin < 4 g/dL.";
    }
    return {
      result: corrected,
      unit: "mEq/L",
      interpretation: { band, detail },
      inputs: { ...args, raw_anion_gap: ag },
    };
  },
});

const albCorrectedDeltaGap = defineCalculator({
  name: "calc_albumin_corrected_delta_gap",
  title: "Albumin-Corrected Delta Gap",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Δgap computed from the albumin-corrected AG (Figge 1998 + Wrenn 1990). Same interpretive bands as Δgap.",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
    chloride_mmol_l: z.number().positive().describe("Serum chloride, mmol/L."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate, mmol/L."),
    albumin_g_dl: z.number().positive().describe("Serum albumin, g/dL."),
    normal_anion_gap: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal AG (default 12)."),
  },
  sources: [
    formulaSource({
      title:
        "Figge J, Jabor A, Kazda A, Fencl V. Anion gap and hypoalbuminemia. Crit Care Med. 1998;26(11):1807-1810.",
      url: "https://pubmed.ncbi.nlm.nih.gov/9559600/",
      publisher: "Critical Care Medicine",
    }),
    formulaSource({
      title:
        "Wrenn K. The delta (Δ) gap: an approach to mixed acid-base disorders. Ann Emerg Med. 1990;19(11):1310-1313.",
      url: "https://pubmed.ncbi.nlm.nih.gov/2389872/",
      publisher: "Annals of Emergency Medicine",
    }),
  ],
  compute: (args) => {
    const ag = computeAnionGapValue(
      args.sodium_mmol_l,
      args.chloride_mmol_l,
      args.bicarbonate_mmol_l,
    );
    const correctedAg = computeAlbCorrectedAg(ag, args.albumin_g_dl);
    const normalAg = args.normal_anion_gap ?? 12;
    const delta = round1(correctedAg - normalAg);
    const { band, detail } = deltaGapBand(delta);
    return {
      result: delta,
      unit: "mEq/L",
      interpretation: { band, detail },
      inputs: { ...args, raw_anion_gap: ag, corrected_anion_gap: round1(correctedAg) },
    };
  },
});

const albCorrectedDeltaRatio = defineCalculator({
  name: "calc_albumin_corrected_delta_ratio",
  title: "Albumin-Corrected Delta Ratio",
  domain: "renal-metabolic",
  complexity: "formula",
  description:
    "Δratio computed from the albumin-corrected AG. Undefined when HCO₃ ≥ 24. Same interpretive bands as Δratio.",
  inputSchema: {
    sodium_mmol_l: z.number().positive().describe("Serum sodium, mmol/L."),
    chloride_mmol_l: z.number().positive().describe("Serum chloride, mmol/L."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate, mmol/L."),
    albumin_g_dl: z.number().positive().describe("Serum albumin, g/dL."),
    normal_anion_gap: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal AG (default 12)."),
    normal_bicarbonate: z
      .number()
      .positive()
      .optional()
      .describe("Reference normal bicarbonate (default 24)."),
  },
  sources: [
    formulaSource({
      title:
        "Figge J, Jabor A, Kazda A, Fencl V. Anion gap and hypoalbuminemia. Crit Care Med. 1998;26(11):1807-1810.",
      url: "https://pubmed.ncbi.nlm.nih.gov/9559600/",
      publisher: "Critical Care Medicine",
    }),
    formulaSource({
      title:
        "Wrenn K. The delta (Δ) gap: an approach to mixed acid-base disorders. Ann Emerg Med. 1990;19(11):1310-1313.",
      url: "https://pubmed.ncbi.nlm.nih.gov/2389872/",
      publisher: "Annals of Emergency Medicine",
    }),
  ],
  compute: (args) => {
    const ag = computeAnionGapValue(
      args.sodium_mmol_l,
      args.chloride_mmol_l,
      args.bicarbonate_mmol_l,
    );
    const correctedAg = computeAlbCorrectedAg(ag, args.albumin_g_dl);
    const normalAg = args.normal_anion_gap ?? 12;
    const normalBicarb = args.normal_bicarbonate ?? 24;
    const denominator = normalBicarb - args.bicarbonate_mmol_l;

    if (denominator <= 0) {
      return {
        result: 0,
        unit: "",
        interpretation: {
          band: "undefined (HCO₃ at or above reference)",
          detail:
            "Δratio is not meaningful when bicarbonate is at or above reference — no metabolic acidosis to compare against.",
        },
        inputs: { ...args, raw_anion_gap: ag, corrected_anion_gap: round1(correctedAg) },
        warnings: ["HCO₃ ≥ reference; Δratio undefined."],
      };
    }
    const ratio = round1((correctedAg - normalAg) / denominator);
    const { band, detail } = deltaRatioBand(ratio);
    return {
      result: ratio,
      unit: "",
      interpretation: { band, detail },
      inputs: { ...args, raw_anion_gap: ag, corrected_anion_gap: round1(correctedAg) },
      warnings: [
        "Δratio band cutoffs are clinical-correlate ranges (Berend 2014). Interpret in clinical context.",
      ],
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
  targetWeight,
  adjustedBodyWeight,
  fena,
  freeWaterDeficit,
  maintenanceFluids,
  mdrdGfr,
  deltaGap,
  deltaRatio,
  albCorrectedAnionGap,
  albCorrectedDeltaGap,
  albCorrectedDeltaRatio,
];
