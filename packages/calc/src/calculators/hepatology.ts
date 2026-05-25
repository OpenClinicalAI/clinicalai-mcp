/**
 * Hepatology / GI calculators (ARCHITECTURE.md §5.3).
 *
 * Formulas re-implemented from primary literature.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, sumBreakdown } from "../framework.js";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */

const fib4 = defineCalculator({
  name: "calc_fib4",
  title: "Fibrosis-4 (FIB-4) Index",
  domain: "hepatology-gi",
  complexity: "formula",
  description:
    "Non-invasive estimate of advanced hepatic fibrosis (F3–F4) from age, AST, ALT, and platelet count. AASLD 2023 NAFLD guideline uses age-stratified cutoffs to route patients to hepatology / VCTE.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    ast_u_l: z.number().positive().describe("Aspartate aminotransferase, U/L."),
    alt_u_l: z.number().positive().describe("Alanine aminotransferase, U/L."),
    platelet_count_10e9_per_l: z
      .number()
      .positive()
      .describe("Platelet count, ×10⁹/L (i.e. ×1000/mm³)."),
  },
  sources: [
    formulaSource({
      title:
        "Sterling RK, Lissen E, Clumeck N, et al. Development of a simple noninvasive index to predict significant fibrosis in patients with HIV/HCV coinfection. Hepatology. 2006;43(6):1317-1325.",
      url: "https://pubmed.ncbi.nlm.nih.gov/16729309/",
      publisher: "Hepatology",
    }),
    formulaSource({
      title:
        "Rinella ME, Neuschwander-Tetri BA, Siddiqui MS, et al. AASLD Practice Guidance on the clinical assessment and management of nonalcoholic fatty liver disease. Hepatology. 2023;77(5):1797-1835.",
      url: "https://pubmed.ncbi.nlm.nih.gov/36800447/",
      publisher: "Hepatology (AASLD)",
    }),
  ],
  compute: (args) => {
    const value = round2(
      (args.age_y * args.ast_u_l) / (args.platelet_count_10e9_per_l * Math.sqrt(args.alt_u_l)),
    );

    // Sterling 2006 (HIV/HCV) bands
    let sterlingBand: string;
    if (value < 1.45) sterlingBand = "low (<1.45) — advanced fibrosis unlikely";
    else if (value <= 3.25) sterlingBand = "indeterminate (1.45–3.25)";
    else sterlingBand = "high (>3.25) — advanced fibrosis likely";

    // AASLD 2023 NAFLD age-stratified action thresholds
    const aasldThreshold = args.age_y >= 65 ? 2.0 : 1.3;
    const aasldFlag = value >= aasldThreshold;

    return {
      result: value,
      unit: "",
      interpretation: {
        band: sterlingBand,
        detail: aasldFlag
          ? `FIB-4 ${value} ≥ ${aasldThreshold} (AASLD 2023 NAFLD action threshold for age ${args.age_y >= 65 ? "≥65" : "<65"}). Refer to hepatology or order vibration-controlled transient elastography (VCTE / FibroScan).`
          : `FIB-4 ${value} < ${aasldThreshold} (AASLD 2023 NAFLD action threshold for age ${args.age_y >= 65 ? "≥65" : "<65"}). Advanced fibrosis unlikely; recheck in 2–3 years per AASLD risk-stratification cadence.`,
      },
      inputs: { ...args },
      warnings: [
        "Sterling 2006 thresholds were derived in HIV/HCV coinfection; AASLD 2023 publishes age-stratified NAFLD cutoffs (1.3 / 2.0). Both interpretations are surfaced here. FIB-4 is not validated in acute hepatitis — transaminitis distorts the AST/ALT ratio.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

const childPugh = defineCalculator({
  name: "calc_child_pugh",
  title: "Child-Pugh Score for Cirrhosis Mortality",
  domain: "hepatology-gi",
  complexity: "lookup",
  description:
    "Pugh's modification of Child-Turcotte — 5 criteria (bilirubin, albumin, INR, ascites, encephalopathy), each scored 1–3, summed to 5–15 → Class A (5–6), B (7–9), C (10–15). Class C generally precludes elective non-transplant surgery.",
  inputSchema: {
    total_bilirubin_mg_dl: z.number().positive().describe("Total bilirubin, mg/dL."),
    albumin_g_dl: z.number().positive().describe("Serum albumin, g/dL."),
    inr: z.number().positive().describe("International normalized ratio."),
    ascites: z.enum(["absent", "slight", "moderate"]).describe("Clinical ascites."),
    encephalopathy: z
      .enum(["none", "grade_1_2", "grade_3_4"])
      .describe("Hepatic encephalopathy (West-Haven grade)."),
  },
  sources: [
    formulaSource({
      title:
        "Pugh RN, Murray-Lyon IM, Dawson JL, Pietroni MC, Williams R. Transection of the oesophagus for bleeding oesophageal varices. Br J Surg. 1973;60(8):646-649.",
      url: "https://pubmed.ncbi.nlm.nih.gov/4541913/",
      publisher: "British Journal of Surgery",
    }),
  ],
  compute: (args) => {
    const biliPts = args.total_bilirubin_mg_dl > 3 ? 3 : args.total_bilirubin_mg_dl >= 2 ? 2 : 1;
    const albPts = args.albumin_g_dl < 2.8 ? 3 : args.albumin_g_dl <= 3.5 ? 2 : 1;
    const inrPts = args.inr > 2.3 ? 3 : args.inr >= 1.7 ? 2 : 1;
    const ascitesPts = args.ascites === "moderate" ? 3 : args.ascites === "slight" ? 2 : 1;
    const encephPts =
      args.encephalopathy === "grade_3_4" ? 3 : args.encephalopathy === "grade_1_2" ? 2 : 1;

    const breakdown = [
      { component: "Bilirubin (1: <2, 2: 2–3, 3: >3 mg/dL)", value: biliPts },
      { component: "Albumin (1: >3.5, 2: 2.8–3.5, 3: <2.8 g/dL)", value: albPts },
      { component: "INR (1: <1.7, 2: 1.7–2.3, 3: >2.3)", value: inrPts },
      { component: "Ascites (1: absent, 2: slight, 3: moderate)", value: ascitesPts },
      {
        component: "Encephalopathy (1: none, 2: grade 1–2, 3: grade 3–4)",
        value: encephPts,
      },
    ];
    const score = sumBreakdown(breakdown);

    let cls: string;
    let detail: string;
    if (score <= 6) {
      cls = "A";
      detail =
        "Class A (well-compensated). ~100% 1-year and ~85% 2-year survival in Pugh 1973. Elective surgery is generally tolerated.";
    } else if (score <= 9) {
      cls = "B";
      detail =
        "Class B. ~80% 1-year and ~57% 2-year survival. Elevated peri-operative and procedural risk; review TIPS / variceal-screening status.";
    } else {
      cls = "C";
      detail =
        "Class C (decompensated). ~45% 1-year and ~35% 2-year survival. Generally precludes elective non-transplant surgery; transplant evaluation criteria are now MELD-based.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band: `Class ${cls} (${score} points)`, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "Ascites severity and encephalopathy grade are clinician-subjective — inter-rater variability is real. MELD / MELD-Na are objective and now preferred for liver-transplant allocation. For cholestatic disease (PBC, PSC), some sources use a bilirubin-shifted Pugh scale — confirm against institutional practice.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const glasgowBlatchford = defineCalculator({
  name: "calc_glasgow_blatchford",
  title: "Glasgow-Blatchford Bleeding Score (GBS)",
  domain: "hepatology-gi",
  complexity: "lookup",
  description:
    "Pre-endoscopy risk score for upper GI bleeding. Score 0 identifies very-low-risk patients suitable for outpatient management (ESGE 2021). Score ≥6 supports admission and endoscopy within 24 hours.",
  inputSchema: {
    sex: z.enum(["M", "F"]).describe("Biological sex (sex-specific hemoglobin thresholds)."),
    bun_mg_dl: z.number().positive().describe("Blood urea nitrogen, mg/dL."),
    hemoglobin_g_dl: z.number().positive().describe("Hemoglobin, g/dL."),
    systolic_bp_mm_hg: z.number().positive().describe("Systolic blood pressure, mmHg."),
    pulse_bpm: z.number().positive().describe("Pulse rate, beats per minute."),
    melena_present: z.boolean().describe("Melena present at presentation."),
    syncope: z.boolean().describe("Syncope at presentation."),
    liver_disease_history: z.boolean().describe("History of liver disease."),
    cardiac_failure: z.boolean().describe("History of cardiac failure."),
  },
  sources: [
    formulaSource({
      title:
        "Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet. 2000;356(9238):1318-1321.",
      url: "https://pubmed.ncbi.nlm.nih.gov/11073021/",
      publisher: "Lancet",
    }),
    formulaSource({
      title:
        "Gralnek IM, Stanley AJ, Morris AJ, et al. Endoscopic diagnosis and management of nonvariceal upper gastrointestinal hemorrhage (NVUGIH): ESGE Guideline 2021. Endoscopy. 2021;53(3):300-332.",
      url: "https://pubmed.ncbi.nlm.nih.gov/34607361/",
      publisher: "Endoscopy (ESGE)",
    }),
  ],
  compute: (args) => {
    // BUN bins (Blatchford original is mmol/L; converted to mg/dL for clinical convenience).
    let bunPts: number;
    if (args.bun_mg_dl < 18.2) bunPts = 0;
    else if (args.bun_mg_dl < 22.4) bunPts = 2;
    else if (args.bun_mg_dl < 28) bunPts = 3;
    else if (args.bun_mg_dl < 70) bunPts = 4;
    else bunPts = 6;

    let hgbPts: number;
    if (args.sex === "M") {
      if (args.hemoglobin_g_dl >= 13) hgbPts = 0;
      else if (args.hemoglobin_g_dl >= 12) hgbPts = 1;
      else if (args.hemoglobin_g_dl >= 10) hgbPts = 3;
      else hgbPts = 6;
    } else {
      if (args.hemoglobin_g_dl >= 12) hgbPts = 0;
      else if (args.hemoglobin_g_dl >= 10) hgbPts = 1;
      else hgbPts = 6;
    }

    let sbpPts: number;
    if (args.systolic_bp_mm_hg >= 110) sbpPts = 0;
    else if (args.systolic_bp_mm_hg >= 100) sbpPts = 1;
    else if (args.systolic_bp_mm_hg >= 90) sbpPts = 2;
    else sbpPts = 3;

    const breakdown = [
      { component: "BUN", value: bunPts },
      { component: `Hemoglobin (sex: ${args.sex})`, value: hgbPts },
      { component: "Systolic BP", value: sbpPts },
      { component: "Pulse ≥ 100", value: args.pulse_bpm >= 100 ? 1 : 0 },
      { component: "Melena", value: args.melena_present ? 1 : 0 },
      { component: "Syncope", value: args.syncope ? 2 : 0 },
      { component: "Liver disease history", value: args.liver_disease_history ? 2 : 0 },
      { component: "Cardiac failure", value: args.cardiac_failure ? 2 : 0 },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score === 0) {
      band = "very low risk (GBS 0)";
      detail =
        "GBS = 0 has ~99% specificity for no need of clinical intervention. ESGE 2021 supports outpatient management with timely follow-up endoscopy.";
    } else if (score <= 5) {
      band = `low-to-intermediate risk (GBS ${score})`;
      detail =
        "Low-to-intermediate risk. Most patients still need admission and endoscopy — ESGE 2021 limits outpatient discharge to GBS ≤ 1.";
    } else {
      band = `high risk (GBS ${score})`;
      detail =
        "High-risk UGIB — admit and perform endoscopy within 24 hours per ESGE 2021. Resuscitate and consider PPI prior to scope.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "Blatchford 2000 BUN bins were published in mmol/L; this implementation uses mg/dL with the standard conversion. Verify the bin boundaries against the original Lancet paper Table 2 when implementation correctness matters.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const hepatologyCalculators: CalculatorDef[] = [fib4, childPugh, glasgowBlatchford];
