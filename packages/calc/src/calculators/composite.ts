/**
 * Composite / fan-out calculators (ARCHITECTURE.md §5.1–§5.4).
 *
 * Composites earn their keep through clinical interpretive logic layered on top
 * of the atomic calculators — they run several atomic computes and synthesize a
 * single clinician-facing reading. Pure parallel fan-outs are left to the agent.
 */

import type { Source } from "@clinical-mcp/shared";
import { z } from "zod";
import { type CalcResult, type CalculatorDef, defineCalculator } from "../framework.js";
import { cardiologyCalculators } from "./cardiology.js";
import { criticalCareCalculators } from "./critical-care.js";
import { pulmonaryVteCalculators } from "./pulmonary-vte.js";
import { renalCalculators } from "./renal.js";

/** Every atomic calculator, indexed by tool name. */
const ATOMIC = new Map<string, CalculatorDef>(
  [
    ...renalCalculators,
    ...cardiologyCalculators,
    ...pulmonaryVteCalculators,
    ...criticalCareCalculators,
  ].map((c) => [c.name, c]),
);

function atomic(name: string): CalculatorDef {
  const calc = ATOMIC.get(name);
  if (!calc) throw new Error(`composite references unknown calculator: ${name}`);
  return calc;
}

/** Run an atomic calculator by name. */
function run(name: string, args: Record<string, unknown>): CalcResult {
  return atomic(name).compute(args);
}

/** Union of the cited sources of several atomic calculators, deduped by URL. */
function mergedSources(...names: string[]): Source[] {
  const byUrl = new Map<string, Source>();
  for (const name of names) {
    for (const source of atomic(name).sources) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}

/** A breakdown row carrying a sub-calculator's score and its interpretive band. */
function componentRow(label: string, result: CalcResult): { component: string; value: number } {
  return { component: `${label} — ${result.interpretation.band}`, value: result.result };
}

/* -------------------------------------------------------------------------- */

const kidneyWorkup = defineCalculator({
  name: "calc_kidney_workup",
  title: "Kidney Function Workup",
  domain: "composite",
  description:
    "Estimate kidney function three ways — Cockcroft-Gault creatinine clearance, CKD-EPI 2021 eGFR, and the legacy MDRD eGFR — with guidance on which to use when.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    weight_kg: z.number().positive().describe("Body weight in kilograms."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
    serum_creatinine_mg_dl: z.number().positive().describe("Serum creatinine in mg/dL."),
  },
  sources: mergedSources("calc_creatinine_clearance", "calc_gfr_ckd_epi"),
  compute: (args) => {
    const crcl = run("calc_creatinine_clearance", { ...args });
    const ckdEpi = run("calc_gfr_ckd_epi", {
      age_y: args.age_y,
      sex: args.sex,
      serum_creatinine_mg_dl: args.serum_creatinine_mg_dl,
    });
    const female = args.sex === "F";
    const mdrd = Math.round(
      175 * args.serum_creatinine_mg_dl ** -1.154 * args.age_y ** -0.203 * (female ? 0.742 : 1),
    );

    return {
      result: ckdEpi.result,
      unit: "mL/min/1.73m²",
      interpretation: {
        band: `CKD-EPI 2021 eGFR ${ckdEpi.result} — ${ckdEpi.interpretation.band}`,
        detail:
          "Use CKD-EPI 2021 for CKD staging — it is the current NKF/ASN-recommended, race-free equation. Use Cockcroft-Gault creatinine clearance for renal drug dosing where a drug's label specifies it (most dosing studies used Cockcroft-Gault). The MDRD estimate is shown for legacy comparison only and is superseded by CKD-EPI 2021.",
      },
      breakdown: [
        componentRow("Cockcroft-Gault creatinine clearance (mL/min)", crcl),
        componentRow("CKD-EPI 2021 eGFR (mL/min/1.73m²)", ckdEpi),
        { component: "MDRD eGFR (mL/min/1.73m², legacy)", value: mdrd },
      ],
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const cardiacRiskPanel = defineCalculator({
  name: "calc_cardiac_risk_panel",
  title: "Atrial Fibrillation Risk Panel (CHA₂DS₂-VASc + HAS-BLED)",
  domain: "composite",
  description:
    "Pair the CHA₂DS₂-VASc stroke score with the HAS-BLED bleeding score and interpret their net clinical benefit for an anticoagulation decision.",
  inputSchema: {
    age_y: z.number().positive().describe("Age in years."),
    sex: z.enum(["M", "F"]).describe("Biological sex."),
    congestive_heart_failure: z.boolean().describe("History of CHF or LV dysfunction."),
    hypertension: z.boolean().describe("History of hypertension (CHA₂DS₂-VASc)."),
    diabetes: z.boolean().describe("History of diabetes mellitus."),
    stroke_tia_thromboembolism: z.boolean().describe("Prior stroke, TIA, or thromboembolism."),
    vascular_disease: z.boolean().describe("Vascular disease."),
    uncontrolled_hypertension: z
      .boolean()
      .describe("Uncontrolled hypertension, systolic BP >160 mmHg (HAS-BLED)."),
    abnormal_renal_function: z.boolean().describe("Abnormal renal function (HAS-BLED)."),
    abnormal_liver_function: z.boolean().describe("Abnormal liver function (HAS-BLED)."),
    prior_major_bleeding: z.boolean().describe("Prior major bleeding or predisposition."),
    labile_inr: z.boolean().describe("Labile INR."),
    antiplatelet_or_nsaid_use: z.boolean().describe("Concomitant antiplatelet or NSAID use."),
    alcohol_excess: z.boolean().describe("Alcohol use ≥8 drinks per week."),
  },
  sources: mergedSources("calc_chads_vasc", "calc_has_bled"),
  compute: (args) => {
    const chads = run("calc_chads_vasc", {
      age_y: args.age_y,
      sex: args.sex,
      congestive_heart_failure: args.congestive_heart_failure,
      hypertension: args.hypertension,
      diabetes: args.diabetes,
      stroke_tia_thromboembolism: args.stroke_tia_thromboembolism,
      vascular_disease: args.vascular_disease,
    });
    const hasBled = run("calc_has_bled", {
      age_y: args.age_y,
      uncontrolled_hypertension: args.uncontrolled_hypertension,
      abnormal_renal_function: args.abnormal_renal_function,
      abnormal_liver_function: args.abnormal_liver_function,
      prior_stroke: args.stroke_tia_thromboembolism,
      prior_major_bleeding: args.prior_major_bleeding,
      labile_inr: args.labile_inr,
      antiplatelet_or_nsaid_use: args.antiplatelet_or_nsaid_use,
      alcohol_excess: args.alcohol_excess,
    });

    const anticoagIndicated = chads.interpretation.band.startsWith("high");
    const highBleeding = hasBled.result >= 3;
    let detail: string;
    if (anticoagIndicated && highBleeding) {
      detail =
        "CHA₂DS₂-VASc indicates anticoagulation while HAS-BLED is elevated. A high HAS-BLED score is a prompt to correct modifiable bleeding factors (blood-pressure control, labile INR, alcohol, concomitant antiplatelets/NSAIDs) and to review more closely — it is rarely a reason to withhold anticoagulation, because the absolute stroke reduction generally exceeds the absolute bleeding increase.";
    } else if (anticoagIndicated) {
      detail =
        "CHA₂DS₂-VASc indicates anticoagulation and HAS-BLED is not high. Anticoagulate absent a contraindication, and continue to address any modifiable bleeding factors.";
    } else {
      detail =
        "CHA₂DS₂-VASc does not indicate routine anticoagulation. Reassess if risk factors accrue; HAS-BLED is most useful once anticoagulation is being considered.";
    }

    return {
      result: chads.result,
      unit: "points",
      interpretation: { band: `CHA₂DS₂-VASc ${chads.result} / HAS-BLED ${hasBled.result}`, detail },
      breakdown: [
        componentRow("CHA₂DS₂-VASc stroke score", chads),
        componentRow("HAS-BLED bleeding score", hasBled),
      ],
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const sepsisPanel = defineCalculator({
  name: "calc_sepsis_panel",
  title: "Sepsis Severity Panel (qSOFA + SOFA + APACHE II)",
  domain: "composite",
  description:
    "Run qSOFA always, the full SOFA score when its inputs are supplied, and APACHE II when ICU physiology is supplied — graded by data availability.",
  inputSchema: {
    respiratory_rate: z.number().positive().describe("Respiratory rate in breaths per minute."),
    altered_mentation: z.boolean().describe("Altered mentation (Glasgow Coma Scale < 15)."),
    sbp_mm_hg: z.number().positive().describe("Systolic blood pressure in mmHg."),
    sofa: z
      .object(atomic("calc_sofa").inputSchema)
      .optional()
      .describe("Full SOFA inputs. When supplied, the SOFA score is added to the panel."),
    apache_ii: z
      .object(atomic("calc_apache_ii").inputSchema)
      .optional()
      .describe("Full APACHE II inputs. When supplied, the APACHE II score is added to the panel."),
  },
  sources: mergedSources("calc_qsofa", "calc_sofa", "calc_apache_ii"),
  compute: (args) => {
    const qsofa = run("calc_qsofa", {
      respiratory_rate: args.respiratory_rate,
      altered_mentation: args.altered_mentation,
      sbp_mm_hg: args.sbp_mm_hg,
    });
    const breakdown = [componentRow("qSOFA", qsofa)];
    const computed = ["qSOFA"];

    let primary = qsofa;
    if (args.sofa) {
      const sofa = run("calc_sofa", args.sofa as Record<string, unknown>);
      breakdown.push(componentRow("SOFA", sofa));
      computed.push("SOFA");
      primary = sofa;
    }
    if (args.apache_ii) {
      const apache = run("calc_apache_ii", args.apache_ii as Record<string, unknown>);
      breakdown.push(componentRow("APACHE II", apache));
      computed.push("APACHE II");
    }

    const escalationNote =
      qsofa.result >= 2
        ? "qSOFA ≥2 in suspected infection flags higher risk — a full SOFA score should be obtained if not already, and treatment escalated."
        : "qSOFA is below the high-risk threshold, which does not exclude sepsis.";
    const detail = `Scores computed from the data supplied: ${computed.join(", ")}. ${escalationNote} Under Sepsis-3, sepsis is an acute rise in SOFA ≥2 from baseline with suspected infection; APACHE II adds ICU mortality prognostication.`;

    return {
      result: primary.result,
      unit: "points",
      interpretation: {
        band: `qSOFA ${qsofa.result}${args.sofa ? ` / SOFA ${primary.result}` : ""}`,
        detail,
      },
      breakdown,
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

const peWorkup = defineCalculator({
  name: "calc_pe_workup",
  title: "Pulmonary Embolism Workup (Wells + PERC + PESI)",
  domain: "composite",
  description:
    "Combine the Wells PE pretest probability, the PERC rule, and PESI severity into a single diagnostic-pathway reading.",
  inputSchema: {
    wells_pe: z.object(atomic("calc_wells_pe").inputSchema).describe("Wells PE criteria."),
    perc: z.object(atomic("calc_perc").inputSchema).describe("PERC rule criteria."),
    pesi: z
      .object(atomic("calc_pesi").inputSchema)
      .describe("PESI inputs (for severity once PE is confirmed)."),
  },
  sources: mergedSources("calc_wells_pe", "calc_perc", "calc_pesi"),
  compute: (args) => {
    const wells = run("calc_wells_pe", args.wells_pe as Record<string, unknown>);
    const perc = run("calc_perc", args.perc as Record<string, unknown>);
    const pesi = run("calc_pesi", args.pesi as Record<string, unknown>);

    const wellsUnlikely = wells.result <= 4;
    const percNegative = perc.result === 0;

    let detail: string;
    if (wellsUnlikely && percNegative) {
      detail =
        "Wells indicates PE-unlikely and PERC is negative: PE can be excluded without D-dimer or imaging. ";
    } else if (wellsUnlikely) {
      detail =
        "Wells indicates PE-unlikely but PERC is positive: obtain a D-dimer; image only if it is elevated. ";
    } else {
      detail =
        "Wells indicates PE-likely: D-dimer is not sufficient to exclude PE — proceed to CT pulmonary angiography (or V/Q). ";
    }
    detail += `If PE is confirmed, the PESI class (${pesi.interpretation.band}) informs severity and the inpatient-vs-outpatient disposition.`;

    return {
      result: wells.result,
      unit: "points",
      interpretation: {
        band: `Wells ${wells.result} / PERC ${perc.result} positive / ${pesi.interpretation.band}`,
        detail,
      },
      breakdown: [
        componentRow("Wells PE pretest probability", wells),
        componentRow("PERC rule", perc),
        componentRow("PESI severity", pesi),
      ],
      inputs: { ...args },
    };
  },
});

/* -------------------------------------------------------------------------- */

export const compositeCalculators: CalculatorDef[] = [
  kidneyWorkup,
  cardiacRiskPanel,
  sepsisPanel,
  peWorkup,
];
