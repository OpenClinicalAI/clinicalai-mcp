/**
 * General prognostic-index calculators (ARCHITECTURE.md §5.3).
 *
 * Tools that estimate broad mortality or comorbidity burden across multiple
 * organ systems / disease categories — used for risk adjustment in
 * observational studies and as one input to clinical-judgement decisions
 * (e.g. surgical fitness, transplant candidacy, end-of-life conversations).
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, sumBreakdown } from "../framework.js";

/* -------------------------------------------------------------------------- */

const charlson = defineCalculator({
  name: "calc_charlson",
  title: "Charlson Comorbidity Index (CCI)",
  domain: "prognosis-general",
  complexity: "lookup",
  description:
    "Weighted comorbidity index for prognostic risk adjustment. Implements the 1987 Charlson weights plus the 1994 Charlson age-adjusted variant (the original 1987 paper did not include the age weighting). Cite both when used.",
  inputSchema: {
    age_y: z.number().nonnegative().describe("Age in years."),
    myocardial_infarction: z.boolean().describe("History of definite or probable MI."),
    congestive_heart_failure: z.boolean().describe("CHF with exertional or PND symptoms."),
    peripheral_vascular_disease: z.boolean().describe("Peripheral vascular disease."),
    cerebrovascular_accident_or_tia: z.boolean().describe("Prior stroke or TIA."),
    dementia: z.boolean().describe("Dementia."),
    chronic_pulmonary_disease: z
      .boolean()
      .describe("Chronic pulmonary disease (COPD, severe asthma, etc.)."),
    connective_tissue_disease: z
      .boolean()
      .describe(
        "Connective tissue disease (SLE, RA, polymyositis, dermatomyositis, MCTD per Charlson 1987 — NOT osteoarthritis).",
      ),
    peptic_ulcer_disease: z.boolean().describe("Peptic ulcer disease."),
    liver_disease: z
      .enum(["none", "mild", "moderate_to_severe"])
      .describe(
        "Liver disease severity: none (0), mild (1 pt — chronic hepatitis), moderate-to-severe (3 pt — cirrhosis with portal hypertension, varices, or hepatic decompensation).",
      ),
    diabetes_mellitus: z
      .enum(["none_or_diet", "uncomplicated", "end_organ_damage"])
      .describe(
        "Diabetes status: none or diet-controlled (0), uncomplicated (1 pt), with end-organ damage (2 pt — nephropathy, retinopathy, neuropathy).",
      ),
    hemiplegia: z.boolean().describe("Hemiplegia from any cause."),
    moderate_to_severe_ckd: z
      .boolean()
      .describe("Moderate-to-severe CKD (serum creatinine >3 mg/dL or dialysis)."),
    solid_tumor: z
      .enum(["none", "localized", "metastatic"])
      .describe(
        "Solid tumor: none (0), localized active or within 5 years (2 pt), metastatic (6 pt).",
      ),
    leukemia: z.boolean().describe("Leukemia (acute or chronic)."),
    lymphoma: z.boolean().describe("Lymphoma (including multiple myeloma)."),
    aids: z.boolean().describe("AIDS (not HIV-positive alone)."),
  },
  sources: [
    formulaSource({
      title:
        "Charlson ME, Pompei P, Ales KL, MacKenzie CR. A new method of classifying prognostic comorbidity in longitudinal studies: development and validation. J Chronic Dis. 1987;40(5):373-383.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3558716/",
      publisher: "Journal of Chronic Diseases",
    }),
    formulaSource({
      title:
        "Charlson M, Szatrowski TP, Peterson J, Gold J. Validation of a combined comorbidity index. J Clin Epidemiol. 1994;47(11):1245-1251. (Age-adjusted Charlson variant.)",
      url: "https://pubmed.ncbi.nlm.nih.gov/7722560/",
      publisher: "Journal of Clinical Epidemiology",
    }),
  ],
  compute: (args) => {
    // Age weighting (Charlson 1994 — original 1987 had no age weight).
    let agePts: number;
    if (args.age_y < 50) agePts = 0;
    else if (args.age_y < 60) agePts = 1;
    else if (args.age_y < 70) agePts = 2;
    else if (args.age_y < 80) agePts = 3;
    else agePts = 4;

    // 1-point comorbidities.
    const onePtFlags: [string, boolean][] = [
      ["Myocardial infarction", args.myocardial_infarction],
      ["Congestive heart failure", args.congestive_heart_failure],
      ["Peripheral vascular disease", args.peripheral_vascular_disease],
      ["CVA or TIA", args.cerebrovascular_accident_or_tia],
      ["Dementia", args.dementia],
      ["Chronic pulmonary disease", args.chronic_pulmonary_disease],
      ["Connective tissue disease", args.connective_tissue_disease],
      ["Peptic ulcer disease", args.peptic_ulcer_disease],
    ];
    const onePtSum = onePtFlags.reduce((sum, [, v]) => sum + (v ? 1 : 0), 0);

    // Liver disease (1 mild / 3 moderate-to-severe).
    const liverPts =
      args.liver_disease === "moderate_to_severe" ? 3 : args.liver_disease === "mild" ? 1 : 0;

    // DM (1 uncomplicated / 2 end-organ damage).
    const dmPts =
      args.diabetes_mellitus === "end_organ_damage"
        ? 2
        : args.diabetes_mellitus === "uncomplicated"
          ? 1
          : 0;

    // 2-point comorbidities.
    const twoPtFlags: [string, boolean][] = [
      ["Hemiplegia", args.hemiplegia],
      ["Moderate-to-severe CKD", args.moderate_to_severe_ckd],
      ["Leukemia", args.leukemia],
      ["Lymphoma", args.lymphoma],
    ];
    const twoPtSum = twoPtFlags.reduce((sum, [, v]) => sum + (v ? 2 : 0), 0);

    // Solid tumor (2 localized / 6 metastatic).
    const tumorPts =
      args.solid_tumor === "metastatic" ? 6 : args.solid_tumor === "localized" ? 2 : 0;

    // AIDS = 6 points.
    const aidsPts = args.aids ? 6 : 0;

    const breakdown = [
      { component: `Age (${args.age_y}y)`, value: agePts },
      { component: "1-point comorbidities (sum)", value: onePtSum },
      { component: `Liver disease (${args.liver_disease})`, value: liverPts },
      { component: `Diabetes (${args.diabetes_mellitus})`, value: dmPts },
      { component: "2-point comorbidities (sum)", value: twoPtSum },
      { component: `Solid tumor (${args.solid_tumor})`, value: tumorPts },
      { component: "AIDS", value: aidsPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score === 0) {
      band = "0 — ~98% 10-year survival";
      detail = "No comorbidity-attributable mortality risk above baseline.";
    } else if (score <= 2) {
      band = `${score} — ~90% 10-year survival`;
      detail = "Mild comorbidity burden.";
    } else if (score <= 4) {
      band = `${score} — ~77% 10-year survival`;
      detail = "Moderate comorbidity burden — affects perioperative and treatment planning.";
    } else {
      band = `${score} — ~21% 10-year survival`;
      detail =
        "High comorbidity burden — significantly elevated long-term mortality risk; pair with patient-level conversations about goals of care, treatment intensity, and surgical fitness.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "CCI is for risk adjustment in observational studies and as one input to clinical judgement; it is NOT a patient-level prognostic predictor. 'Connective tissue disease' specifically means SLE / RA / polymyositis / dermatomyositis / MCTD per Charlson 1987 — not osteoarthritis. Age weighting is from Charlson 1994; the 1987 paper did not include age.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const prognosisCalculators: CalculatorDef[] = [charlson];
