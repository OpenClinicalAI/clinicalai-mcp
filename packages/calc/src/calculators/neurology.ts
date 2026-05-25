/**
 * Neurology calculators (ARCHITECTURE.md §5.3).
 *
 * Formulas re-implemented from primary literature.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, sumBreakdown } from "../framework.js";

/* -------------------------------------------------------------------------- */

const gcs = defineCalculator({
  name: "calc_gcs",
  title: "Glasgow Coma Scale (GCS)",
  domain: "neurology",
  complexity: "lookup",
  description:
    "Sum of best eye-opening (E, 1–4), best verbal response (V, 1–5), and best motor response (M, 1–6). Range 3–15. Bands: 13–15 mild, 9–12 moderate, 3–8 severe brain injury (consider airway protection).",
  inputSchema: {
    best_eye_response: z
      .enum(["spontaneous", "to_voice", "to_pain", "none"])
      .describe(
        "Best eye-opening response: spontaneous (4), to voice (3), to pain (2), none (1). For 'not testable' (swollen-shut eyes), use the highest applicable category per Teasdale 2014 conventions.",
      ),
    best_verbal_response: z
      .enum(["oriented", "confused", "inappropriate_words", "incomprehensible_sounds", "none"])
      .describe(
        "Best verbal response: oriented (5), confused (4), inappropriate words (3), incomprehensible sounds (2), none (1).",
      ),
    best_motor_response: z
      .enum([
        "obeys_commands",
        "localizes_pain",
        "withdraws_from_pain",
        "flexion_to_pain",
        "extension_to_pain",
        "none",
      ])
      .describe(
        "Best motor response: obeys commands (6), localizes to pain (5), withdraws from pain (4), abnormal flexion / decorticate (3), abnormal extension / decerebrate (2), none (1).",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Teasdale G, Jennett B. Assessment of coma and impaired consciousness. A practical scale. Lancet. 1974;2(7872):81-84.",
      url: "https://pubmed.ncbi.nlm.nih.gov/4136544/",
      publisher: "Lancet",
    }),
    formulaSource({
      title:
        "Teasdale G, Maas A, Lecky F, Manley G, Stocchetti N, Murray G. The Glasgow Coma Scale at 40 years: standing the test of time. Lancet Neurol. 2014;13(8):844-854. (40-year update.)",
      url: "https://pubmed.ncbi.nlm.nih.gov/25030516/",
      publisher: "Lancet Neurology",
    }),
  ],
  compute: (args) => {
    const eyePts =
      args.best_eye_response === "spontaneous"
        ? 4
        : args.best_eye_response === "to_voice"
          ? 3
          : args.best_eye_response === "to_pain"
            ? 2
            : 1;
    const verbalPts =
      args.best_verbal_response === "oriented"
        ? 5
        : args.best_verbal_response === "confused"
          ? 4
          : args.best_verbal_response === "inappropriate_words"
            ? 3
            : args.best_verbal_response === "incomprehensible_sounds"
              ? 2
              : 1;
    const motorPts =
      args.best_motor_response === "obeys_commands"
        ? 6
        : args.best_motor_response === "localizes_pain"
          ? 5
          : args.best_motor_response === "withdraws_from_pain"
            ? 4
            : args.best_motor_response === "flexion_to_pain"
              ? 3
              : args.best_motor_response === "extension_to_pain"
                ? 2
                : 1;

    const breakdown = [
      { component: `Eye (E${eyePts})`, value: eyePts },
      { component: `Verbal (V${verbalPts})`, value: verbalPts },
      { component: `Motor (M${motorPts})`, value: motorPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score >= 13) {
      band = `mild (${score}, 13–15)`;
      detail =
        "Mild brain injury. Typically managed conservatively with observation; high-risk features (anticoagulation, focal deficits, persistent vomiting, dangerous mechanism) may still prompt CT per institutional protocols (e.g. Canadian CT Head, New Orleans).";
    } else if (score >= 9) {
      band = `moderate (${score}, 9–12)`;
      detail =
        "Moderate brain injury. CT imaging indicated; consider neurosurgical consult and admission for monitoring.";
    } else {
      band = `severe (${score}, 3–8)`;
      detail =
        "Severe brain injury. GCS ≤8 traditionally indicates a need for airway protection — intubation is a clinical decision based on the trajectory and ability to protect airway, not the number alone. Urgent neurosurgical evaluation.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: {
        band,
        detail: `${detail} (E${eyePts}V${verbalPts}M${motorPts})`,
      },
      breakdown,
      inputs: { ...args },
      warnings: [
        "GCS is for adults and children ≥2 years. Pediatric GCS-Peds uses a different verbal-component scale for younger children. 'Not testable' components (intubated, eyes swollen shut) should be documented as NT rather than substituted — substitution loses information about the clinical reason.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const neurologyCalculators: CalculatorDef[] = [gcs];
