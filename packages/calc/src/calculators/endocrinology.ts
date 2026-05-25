/**
 * Endocrinology calculators (ARCHITECTURE.md §5.3).
 *
 * Formulas re-implemented from primary literature.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator } from "../framework.js";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */

const homaIr = defineCalculator({
  name: "calc_homa_ir",
  title: "HOMA-IR (Homeostatic Model Assessment of Insulin Resistance)",
  domain: "endocrinology",
  complexity: "formula",
  description:
    "HOMA-IR = (fasting insulin × fasting glucose) / 405. A unitless index of insulin resistance. Requires a true fasting state (≥8h). Cutoffs are population-specific — use clinician judgement and consider local lab references.",
  inputSchema: {
    fasting_insulin_uIU_ml: z
      .number()
      .positive()
      .describe(
        "Fasting plasma insulin, µIU/mL (also written mU/L). If you have pmol/L, divide by ~6 first.",
      ),
    fasting_glucose_mg_dl: z.number().positive().describe("Fasting plasma glucose, mg/dL."),
  },
  sources: [
    formulaSource({
      title:
        "Matthews DR, Hosker JP, Rudenski AS, Naylor BA, Treacher DF, Turner RC. Homeostasis model assessment: insulin resistance and beta-cell function from fasting plasma glucose and insulin concentrations in man. Diabetologia. 1985;28(7):412-419.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3899825/",
      publisher: "Diabetologia",
    }),
    formulaSource({
      title:
        "Geloneze B, Vasques AC, Stabe CF, et al. HOMA1-IR and HOMA2-IR indexes in identifying insulin resistance and metabolic syndrome: Brazilian Metabolic Syndrome Study (BRAMS). Arq Bras Endocrinol Metabol. 2009;53(2):281-287.",
      url: "https://pubmed.ncbi.nlm.nih.gov/19893913/",
      publisher: "Arq Bras Endocrinol Metabol",
    }),
  ],
  compute: (args) => {
    const homa = round2((args.fasting_insulin_uIU_ml * args.fasting_glucose_mg_dl) / 405);
    let band: string;
    let detail: string;
    if (homa < 2.5) {
      band = `normal insulin sensitivity (HOMA-IR ${homa} < 2.5)`;
      detail =
        "Below the commonly-cited 2.5 cutoff (Geloneze 2009 BRAMS). Cutoffs are population-specific and not universally accepted — interpret against the local lab's reference if available.";
    } else if (homa <= 4) {
      band = `borderline insulin resistance (HOMA-IR ${homa}, 2.5–4)`;
      detail =
        "Borderline range. Consider clinical context (BMI, waist circumference, family history, glucose tolerance).";
    } else {
      band = `insulin resistance (HOMA-IR ${homa} > 4)`;
      detail = "Above the commonly-cited 4.0 cutoff for insulin resistance.";
    }
    return {
      result: homa,
      unit: "",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "HOMA-IR cutoffs are population-specific (different in Brazilian, Korean, US, and European cohorts) and not universally accepted — surface as a signal, not a diagnostic threshold. Requires true fasting (≥8h); postprandial values invalidate the model. Not applicable in type 1 diabetes or insulin-pump patients.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const endocrinologyCalculators: CalculatorDef[] = [homaIr];
