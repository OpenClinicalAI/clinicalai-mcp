/**
 * Infectious-disease calculators (ARCHITECTURE.md §5.3).
 *
 * Formulas re-implemented from primary literature.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator, sumBreakdown } from "../framework.js";

/* -------------------------------------------------------------------------- */

const centor = defineCalculator({
  name: "calc_centor",
  title: "Centor Score (McIsaac modification)",
  domain: "infectious-disease",
  complexity: "lookup",
  description:
    "Pre-test probability of group A streptococcal pharyngitis from age + tonsillar exudate + tender anterior cervical nodes + fever + cough absence. McIsaac 1998 added age weighting to extend the original Centor 1981 to pediatric and elderly patients.",
  inputSchema: {
    age_y: z.number().nonnegative().describe("Age in years (3–14: +1, 15–44: 0, ≥45: −1)."),
    tonsillar_exudate_or_swelling: z.boolean().describe("Tonsillar exudate or swelling on exam."),
    tender_anterior_cervical_adenopathy: z
      .boolean()
      .describe("Tender anterior cervical lymphadenopathy."),
    temperature_c: z.number().describe("Temperature in °C (>38°C: +1)."),
    cough_absent: z.boolean().describe("Absence of cough (absence scores +1)."),
  },
  sources: [
    formulaSource({
      title:
        "Centor RM, Witherspoon JM, Dalton HP, Brody CE, Link K. The diagnosis of strep throat in adults in the emergency room. Med Decis Making. 1981;1(3):239-246.",
      url: "https://pubmed.ncbi.nlm.nih.gov/6763125/",
      publisher: "Medical Decision Making",
    }),
    formulaSource({
      title:
        "McIsaac WJ, White D, Tannenbaum D, Low DE. A clinical score to reduce unnecessary antibiotic use in patients with sore throat. CMAJ. 1998;158(1):75-83.",
      url: "https://pubmed.ncbi.nlm.nih.gov/9475915/",
      publisher: "CMAJ",
    }),
    formulaSource({
      title:
        "Shulman ST, Bisno AL, Clegg HW, et al. Clinical practice guideline for the diagnosis and management of group A streptococcal pharyngitis: 2012 update by the Infectious Diseases Society of America. Clin Infect Dis. 2012;55(10):e86-e102.",
      url: "https://pubmed.ncbi.nlm.nih.gov/22965026/",
      publisher: "Clinical Infectious Diseases (IDSA)",
    }),
  ],
  compute: (args) => {
    const agePts = args.age_y < 15 ? (args.age_y >= 3 ? 1 : 0) : args.age_y >= 45 ? -1 : 0;
    const breakdown = [
      { component: "Age (3–14: +1, 15–44: 0, ≥45: −1)", value: agePts },
      {
        component: "Tonsillar exudate / swelling",
        value: args.tonsillar_exudate_or_swelling ? 1 : 0,
      },
      {
        component: "Tender anterior cervical adenopathy",
        value: args.tender_anterior_cervical_adenopathy ? 1 : 0,
      },
      { component: "Temperature >38°C", value: args.temperature_c > 38 ? 1 : 0 },
      { component: "Cough absent", value: args.cough_absent ? 1 : 0 },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score <= 0) {
      band = `very low GABHS probability (${score} ≤ 0, ~1–2.5%)`;
      detail =
        "Very low pre-test probability of group A strep. IDSA 2012 recommends no testing and no empirical antibiotics.";
    } else if (score === 1) {
      band = "low GABHS probability (1, ~5–10%)";
      detail = "Low probability. IDSA 2012 generally does not recommend testing.";
    } else if (score === 2) {
      band = "moderate GABHS probability (2, ~11–17%)";
      detail =
        "Moderate probability — IDSA 2012 recommends rapid antigen detection test (RADT) and/or throat culture. Treat only if positive.";
    } else if (score === 3) {
      band = "high GABHS probability (3, ~28–35%)";
      detail =
        "Higher probability — RADT and/or culture, treat if positive (or consider empirical antibiotics pending culture in high-risk settings).";
    } else {
      band = `very high GABHS probability (${score} ≥ 4, ~51–53%)`;
      detail =
        "Highest pre-test probability. Consider empirical antibiotics pending culture per IDSA 2012, particularly with high local prevalence.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "Even a maximum score has only ~50% positive predictive value for GABHS — clinical correlation and confirmatory testing remain standard. The McIsaac age weighting is not validated outside primary-care adult and pediatric populations.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const feverPain = defineCalculator({
  name: "calc_feverpain",
  title: "FeverPAIN Score for Strep Pharyngitis",
  domain: "infectious-disease",
  complexity: "lookup",
  description:
    "Five-item primary-care score for streptococcal pharyngitis from the PRISM trial (Little 2013). Endorsed by NICE NG84 (2018) — FeverPAIN ≥ 4 supports immediate antibiotic prescription.",
  inputSchema: {
    fever_in_past_24h: z.boolean().describe("Fever in the past 24 hours."),
    purulent_tonsils: z.boolean().describe("Purulent tonsillar exudate."),
    attended_within_3_days_of_onset: z
      .boolean()
      .describe("Patient attended within 3 days of symptom onset (rapid onset)."),
    severely_inflamed_tonsils: z.boolean().describe("Severe tonsil inflammation."),
    cough_or_coryza_absent: z
      .boolean()
      .describe("Absence of cough OR coryza (absence scores positively)."),
  },
  sources: [
    formulaSource({
      title:
        "Little P, Hobbs FDR, Moore M, et al. Clinical score and rapid antigen detection test to guide antibiotic use for sore throats: randomised controlled trial of PRISM (primary care streptococcal management). BMJ. 2013;347:f5806.",
      url: "https://pubmed.ncbi.nlm.nih.gov/24202989/",
      publisher: "BMJ",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Fever in past 24h", value: args.fever_in_past_24h ? 1 : 0 },
      { component: "Purulent tonsils", value: args.purulent_tonsils ? 1 : 0 },
      {
        component: "Attended within 3 days of onset",
        value: args.attended_within_3_days_of_onset ? 1 : 0,
      },
      {
        component: "Severely inflamed tonsils",
        value: args.severely_inflamed_tonsils ? 1 : 0,
      },
      {
        component: "Cough/coryza absent",
        value: args.cough_or_coryza_absent ? 1 : 0,
      },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score <= 1) {
      band = `low probability (${score}, ~13–18% strep)`;
      detail =
        "Low probability of group A strep. NICE NG84 (2018) recommends no antibiotics and self-care advice.";
    } else if (score <= 3) {
      band = `moderate probability (${score}, ~34–40% strep)`;
      detail =
        "Moderate probability. NICE NG84 supports a delayed-script strategy (antibiotic prescription to use only if symptoms worsen / don't improve in 3–5 days).";
    } else {
      band = `high probability (${score}, ~62–65% strep)`;
      detail =
        "High probability. NICE NG84 supports immediate antibiotic prescription if symptoms are severe or worsening, or if the patient is at high risk of complications.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "PRISM derivation cohort was age ≥3 y in UK primary care — do not apply to children <3 or to settings dominated by different streptococcal epidemiology. The 'severe inflammation' input is clinician-subjective.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const infectiousDiseaseCalculators: CalculatorDef[] = [centor, feverPain];
