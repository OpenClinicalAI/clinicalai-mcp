/**
 * Pediatric calculators (ARCHITECTURE.md §5.3 + docs/PEDIATRIC_CALCULATORS.md).
 *
 * This file ships the pediatric subset of the 20-calc must-have shortlist that
 * does NOT require the LMS-parametric reference-table primitive (deferred for
 * a follow-up release — see "Architectural decisions" §1 in
 * docs/PEDIATRIC_CALCULATORS.md). Specifically deferred until LMS lands:
 * WHO/CDC z-scores (WAZ, HAZ, BMIZ, HCZ), MUAC, Bhutani bili nomogram,
 * AAP 2022 phototherapy thresholds.
 *
 * Age convention: pediatric calculators accept the most natural age field for
 * their use case — `age_y` (years, decimal allowed) for school-age scoring,
 * `age_months` for infant/early-childhood, `age_days` for neonatal,
 * `gestational_age_weeks` for fetal/neonatal. A formal PediatricAge
 * discriminated-union input is planned but kept thin in v0.1 so each
 * calculator surfaces the unit clinicians actually document in.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import {
  type CalculatorDef,
  countMet,
  criterion,
  defineCalculator,
  sumBreakdown,
} from "../framework.js";

/* -------------------------------------------------------------------------- */
/* APGAR Score                                                                  */
/* -------------------------------------------------------------------------- */

const apgar = defineCalculator({
  name: "calc_apgar",
  title: "APGAR Score",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Newborn assessment at 1, 5, and 10 minutes of life. 5 components (Appearance, Pulse, Grimace, Activity, Respiration) × 0–2 each = 0–10. AAP/ACOG 2015 reaffirmed: a single low APGAR is not a sole diagnostic of asphyxia; the 10-minute APGAR has the strongest mortality / outcome correlation.",
  inputSchema: {
    appearance: z
      .enum(["blue_pale_all_over", "blue_extremities", "pink_all_over"])
      .describe(
        "Appearance / color: blue or pale all over (0), pink body with blue extremities = acrocyanosis (1), pink all over (2).",
      ),
    pulse: z
      .enum(["absent", "under_100", "100_or_over"])
      .describe("Pulse: absent (0), <100/min (1), ≥100/min (2)."),
    grimace: z
      .enum(["no_response", "grimace", "cough_sneeze_cry"])
      .describe(
        "Grimace / reflex irritability: no response to stimulation (0), grimace (1), vigorous cry / cough / sneeze (2).",
      ),
    activity: z
      .enum(["limp", "some_flexion", "active_motion"])
      .describe("Activity / muscle tone: limp (0), some flexion (1), active motion (2)."),
    respiration: z
      .enum(["absent", "weak_irregular", "strong_cry"])
      .describe("Respiration: absent (0), weak / irregular / slow (1), strong cry (2)."),
  },
  sources: [
    formulaSource({
      title:
        "Apgar V. A proposal for a new method of evaluation of the newborn infant. Curr Res Anesth Analg. 1953;32(4):260-267.",
      url: "https://pubmed.ncbi.nlm.nih.gov/13083014/",
      publisher: "Current Researches in Anesthesia & Analgesia",
    }),
    formulaSource({
      title:
        "Watterberg KL, Aucott S, Benitz WE, et al. The Apgar Score. American Academy of Pediatrics Committee on Fetus and Newborn; American College of Obstetricians and Gynecologists Committee on Obstetric Practice. Pediatrics. 2015;136(4):819-822.",
      url: "https://pubmed.ncbi.nlm.nih.gov/26416932/",
      publisher: "American Academy of Pediatrics / ACOG",
    }),
  ],
  compute: (args) => {
    const appearance =
      args.appearance === "pink_all_over" ? 2 : args.appearance === "blue_extremities" ? 1 : 0;
    const pulse = args.pulse === "100_or_over" ? 2 : args.pulse === "under_100" ? 1 : 0;
    const grimace = args.grimace === "cough_sneeze_cry" ? 2 : args.grimace === "grimace" ? 1 : 0;
    const activity =
      args.activity === "active_motion" ? 2 : args.activity === "some_flexion" ? 1 : 0;
    const respiration =
      args.respiration === "strong_cry" ? 2 : args.respiration === "weak_irregular" ? 1 : 0;

    const breakdown = [
      { component: "Appearance (A)", value: appearance },
      { component: "Pulse (P)", value: pulse },
      { component: "Grimace (G)", value: grimace },
      { component: "Activity (A)", value: activity },
      { component: "Respiration (R)", value: respiration },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score >= 7) {
      band = `reassuring (${score}/10)`;
      detail =
        "APGAR ≥7 — generally reassuring. AAP/ACOG 2015: a single APGAR is not a sole asphyxia diagnostic; serial assessment matters more than any one timepoint.";
    } else if (score >= 4) {
      band = `moderately depressed (${score}/10)`;
      detail =
        "APGAR 4–6 — moderate depression. Initiate NRP positive-pressure ventilation per algorithm; reassess at 5 minutes.";
    } else {
      band = `severely depressed (${score}/10)`;
      detail =
        "APGAR 0–3 — severe depression. NRP resuscitation algorithm; consider intubation, chest compressions, and team-based care.";
    }

    return {
      result: score,
      unit: "points",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "APGAR is not a predictor of long-term outcome on its own. The 10-minute APGAR correlates more strongly with mortality and neurodevelopmental outcome than the 1- or 5-minute scores (AAP/ACOG 2015). Use NRP resuscitation algorithm to drive interventions, not APGAR alone.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Pediatric GCS (modified verbal scale for preverbal children)                 */
/* -------------------------------------------------------------------------- */

const pediatricGcs = defineCalculator({
  name: "calc_pediatric_gcs",
  title: "Pediatric Glasgow Coma Scale (PGCS)",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Modified GCS for children <2 years using a developmentally-adjusted verbal scale (smiles/coos/cries appropriately etc., rather than oriented/confused/inappropriate). Sum of Eye + Verbal + Motor = 3–15. Use adult GCS for children ≥2 years.",
  inputSchema: {
    best_eye_response: z
      .enum(["spontaneous", "to_voice", "to_pain", "none"])
      .describe("Eye-opening: spontaneous (4), to voice (3), to pain (2), none (1)."),
    best_verbal_response: z
      .enum([
        "smiles_coos_cries_appropriately",
        "cries_consolable",
        "persistent_irritable",
        "restless_agitated",
        "none",
      ])
      .describe(
        "Modified verbal (peds): smiles/coos/cries appropriately (5), cries but consolable (4), persistently irritable (3), restless and agitated (2), none (1).",
      ),
    best_motor_response: z
      .enum([
        "obeys_or_normal_spontaneous_movement",
        "localizes_pain",
        "withdraws_from_pain",
        "flexion_to_pain",
        "extension_to_pain",
        "none",
      ])
      .describe(
        "Motor: obeys commands / normal spontaneous movement (6), localizes pain (5), withdraws (4), flexion / decorticate (3), extension / decerebrate (2), none (1).",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Reilly PL, Simpson DA, Sprod R, Thomas L. Assessing the conscious level in infants and young children: a paediatric version of the Glasgow Coma Scale. Childs Nerv Syst. 1988;4(1):30-33.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3221668/",
      publisher: "Child's Nervous System",
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
    const verbalMap: Record<typeof args.best_verbal_response, number> = {
      smiles_coos_cries_appropriately: 5,
      cries_consolable: 4,
      persistent_irritable: 3,
      restless_agitated: 2,
      none: 1,
    };
    const motorMap: Record<typeof args.best_motor_response, number> = {
      obeys_or_normal_spontaneous_movement: 6,
      localizes_pain: 5,
      withdraws_from_pain: 4,
      flexion_to_pain: 3,
      extension_to_pain: 2,
      none: 1,
    };
    const verbalPts = verbalMap[args.best_verbal_response];
    const motorPts = motorMap[args.best_motor_response];

    const breakdown = [
      { component: `Eye (E${eyePts})`, value: eyePts },
      { component: `Verbal-Peds (V${verbalPts})`, value: verbalPts },
      { component: `Motor (M${motorPts})`, value: motorPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score >= 13) {
      band = `mild (${score})`;
      detail =
        "Mild brain injury per pediatric GCS. CT imaging decisions per institutional rule (PECARN <2 y, PECARN ≥2 y).";
    } else if (score >= 9) {
      band = `moderate (${score})`;
      detail = "Moderate brain injury. CT and observation; pediatric neurosurgery consult.";
    } else {
      band = `severe (${score})`;
      detail =
        "Severe brain injury. Airway protection (intubation per clinical assessment), urgent CT, neurosurgical consult, ICU admission.";
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
        "Pediatric GCS verbal scale is for children <2 y (preverbal). Children ≥2 y typically use the standard adult GCS verbal scale. Document the version used.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Bedside Schwartz eGFR (peds; 2009)                                          */
/* -------------------------------------------------------------------------- */

const schwartzBedsideEgfr = defineCalculator({
  name: "calc_schwartz_bedside_egfr",
  title: "Bedside Schwartz eGFR (2009)",
  domain: "pediatrics",
  complexity: "formula",
  description:
    "Pediatric eGFR by the 2009 updated Schwartz bedside formula: eGFR = 0.413 × height_cm / serum_creatinine_mg_dL. Validated 1–18 years. For ages 1–25, prefer the CKiD U25 equation (Pierce 2021); for adults, use CKD-EPI 2021 in @openclinicalai/calc.",
  inputSchema: {
    height_cm: z.number().positive().describe("Height (length for <2 y) in centimeters."),
    serum_creatinine_mg_dl: z
      .number()
      .positive()
      .describe("Serum creatinine in mg/dL (enzymatic, IDMS-traceable assay)."),
    age_y: z.number().positive().describe("Age in years (formula validated 1–18)."),
  },
  sources: [
    formulaSource({
      title:
        "Schwartz GJ, Muñoz A, Schneider MF, et al. New equations to estimate GFR in children with CKD. J Am Soc Nephrol. 2009;20(3):629-637.",
      url: "https://pubmed.ncbi.nlm.nih.gov/19158356/",
      publisher: "Journal of the American Society of Nephrology",
    }),
  ],
  compute: (args) => {
    const egfr = Math.round((0.413 * args.height_cm) / args.serum_creatinine_mg_dl);

    let band: string;
    if (egfr >= 90) band = "G1 — normal or high (≥90)";
    else if (egfr >= 60) band = "G2 — mildly decreased (60–89)";
    else if (egfr >= 45) band = "G3a — mildly to moderately decreased (45–59)";
    else if (egfr >= 30) band = "G3b — moderately to severely decreased (30–44)";
    else if (egfr >= 15) band = "G4 — severely decreased (15–29)";
    else band = "G5 — kidney failure (<15)";

    const ageWarn = args.age_y < 1 || args.age_y > 18;

    return {
      result: egfr,
      unit: "mL/min/1.73m²",
      interpretation: {
        band,
        detail:
          "Bedside Schwartz is the de facto peds eGFR standard but loses accuracy at extremes of muscle mass, severe CKD, and ages outside 1–18. For ages 1–25 the CKiD U25 equation (Pierce 2021, PMID 33933277) gives a smoother transition into adulthood; KDIGO 2024 endorses it.",
      },
      inputs: { ...args },
      warnings: [
        "Bedside Schwartz is validated for ages 1–18 with creatinine ≤ ~1.6 mg/dL — accuracy drops at higher creatinine. Use a creatinine assay that is IDMS-traceable (enzymatic). For ages near 18 or for the peds-to-adult transition, the CKiD U25 equation (Pierce 2021) is the current recommendation.",
        ...(ageWarn
          ? [
              `Age ${args.age_y} is outside the Schwartz validation range (1–18 y); interpret with caution.`,
            ]
          : []),
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Westley Croup Score                                                         */
/* -------------------------------------------------------------------------- */

const westleyCroup = defineCalculator({
  name: "calc_westley_croup",
  title: "Westley Croup Score",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Croup severity from 5 components (level of consciousness, cyanosis, stridor, air entry, retractions). 0 = mild, 8+ = severe. Drives dexamethasone + racemic-epinephrine decisions and disposition (discharge vs admission).",
  inputSchema: {
    level_of_consciousness: z
      .enum(["normal", "disoriented"])
      .describe("Level of consciousness: normal (0), disoriented (5)."),
    cyanosis: z
      .enum(["none", "with_agitation", "at_rest"])
      .describe("Cyanosis: none (0), with agitation (4), at rest (5)."),
    stridor: z
      .enum(["none", "with_agitation", "at_rest"])
      .describe("Stridor: none (0), with agitation (1), at rest (2)."),
    air_entry: z
      .enum(["normal", "decreased", "markedly_decreased"])
      .describe("Air entry: normal (0), decreased (1), markedly decreased (2)."),
    retractions: z
      .enum(["none", "mild", "moderate", "severe"])
      .describe("Retractions: none (0), mild (1), moderate (2), severe (3)."),
  },
  sources: [
    formulaSource({
      title:
        "Westley CR, Cotton EK, Brooks JG. Nebulized racemic epinephrine by IPPB for the treatment of croup: a double-blind study. Am J Dis Child. 1978;132(5):484-487.",
      url: "https://pubmed.ncbi.nlm.nih.gov/665812/",
      publisher: "American Journal of Diseases of Children",
    }),
  ],
  compute: (args) => {
    const conscPts = args.level_of_consciousness === "disoriented" ? 5 : 0;
    const cyanosisPts =
      args.cyanosis === "at_rest" ? 5 : args.cyanosis === "with_agitation" ? 4 : 0;
    const stridorPts = args.stridor === "at_rest" ? 2 : args.stridor === "with_agitation" ? 1 : 0;
    const airEntryPts =
      args.air_entry === "markedly_decreased" ? 2 : args.air_entry === "decreased" ? 1 : 0;
    const retractionsPts =
      args.retractions === "severe"
        ? 3
        : args.retractions === "moderate"
          ? 2
          : args.retractions === "mild"
            ? 1
            : 0;

    const breakdown = [
      { component: "Level of consciousness", value: conscPts },
      { component: "Cyanosis", value: cyanosisPts },
      { component: "Stridor", value: stridorPts },
      { component: "Air entry", value: airEntryPts },
      { component: "Retractions", value: retractionsPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score <= 2) {
      band = `mild (${score}/17)`;
      detail =
        "Mild croup. Single dose of dexamethasone 0.6 mg/kg PO/IM (max 16 mg) is standard. Outpatient management usually appropriate; humidified air provides no proven benefit but is harmless.";
    } else if (score <= 5) {
      band = `moderate (${score}/17)`;
      detail =
        "Moderate croup. Dexamethasone + consider nebulized racemic epinephrine. Observe at least 3–4 hours after epinephrine for rebound stridor before discharge.";
    } else if (score <= 11) {
      band = `severe (${score}/17)`;
      detail =
        "Severe croup. Dexamethasone + nebulized racemic epinephrine; admission for monitoring is usually warranted; consider ICU if severe respiratory distress persists.";
    } else {
      band = `impending respiratory failure (${score}/17)`;
      detail =
        "Impending respiratory failure (Westley ≥12). Urgent airway management — anesthesia and ENT at bedside; ICU admission. Heliox may help temporize.";
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
/* PRAM — Pediatric Respiratory Assessment Measure                              */
/* -------------------------------------------------------------------------- */

const pram = defineCalculator({
  name: "calc_pram",
  title: "Pediatric Respiratory Assessment Measure (PRAM)",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "PRAM for acute asthma severity in children 2–17. 5 components, 0–12. Validated in ED setting; preferred over PASS in many institutions for its responsiveness to treatment.",
  inputSchema: {
    suprasternal_retractions: z
      .enum(["absent", "present"])
      .describe("Suprasternal retractions: absent (0), present (2)."),
    scalene_retractions: z
      .enum(["absent", "present"])
      .describe("Scalene muscle contraction: absent (0), present (2)."),
    air_entry: z
      .enum(["normal", "decreased_at_base", "decreased_apex_base", "minimal_or_absent"])
      .describe(
        "Air entry: normal (0), decreased at base (1), decreased apex + base (2), minimal or absent (3).",
      ),
    wheezing: z
      .enum([
        "absent",
        "expiratory_only",
        "inspiratory_and_expiratory",
        "audible_without_stethoscope_or_silent_chest",
      ])
      .describe(
        "Wheezing: absent (0), expiratory only (1), inspiratory and expiratory (2), audible without stethoscope or silent chest (3).",
      ),
    oxygen_saturation: z
      .enum(["over_95", "92_to_95", "under_92"])
      .describe("Oxygen saturation on room air: ≥95% (0), 92–94% (1), <92% (2)."),
  },
  sources: [
    formulaSource({
      title:
        "Chalut DS, Ducharme FM, Davis GM. The Preschool Respiratory Assessment Measure (PRAM): a responsive index of acute asthma severity. J Pediatr. 2000;137(6):762-768.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10742237/",
      publisher: "Journal of Pediatrics",
    }),
  ],
  compute: (args) => {
    const supra = args.suprasternal_retractions === "present" ? 2 : 0;
    const scalene = args.scalene_retractions === "present" ? 2 : 0;
    const airEntryMap = {
      normal: 0,
      decreased_at_base: 1,
      decreased_apex_base: 2,
      minimal_or_absent: 3,
    } as const;
    const airEntry = airEntryMap[args.air_entry];
    const wheezeMap = {
      absent: 0,
      expiratory_only: 1,
      inspiratory_and_expiratory: 2,
      audible_without_stethoscope_or_silent_chest: 3,
    } as const;
    const wheeze = wheezeMap[args.wheezing];
    const satPts =
      args.oxygen_saturation === "under_92" ? 2 : args.oxygen_saturation === "92_to_95" ? 1 : 0;

    const breakdown = [
      { component: "Suprasternal retractions", value: supra },
      { component: "Scalene muscle contraction", value: scalene },
      { component: "Air entry", value: airEntry },
      { component: "Wheezing", value: wheeze },
      { component: "O₂ saturation", value: satPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score <= 3) {
      band = `mild (${score}/12)`;
      detail =
        "Mild asthma exacerbation. SABA + oral corticosteroids; discharge after appropriate response.";
    } else if (score <= 7) {
      band = `moderate (${score}/12)`;
      detail =
        "Moderate asthma exacerbation. SABA q20min + oral or IV corticosteroids; consider ipratropium in first hour. Reassess.";
    } else {
      band = `severe (${score}/12)`;
      detail =
        "Severe asthma exacerbation. Continuous SABA + IV corticosteroids + ipratropium; consider IV magnesium sulfate; admit. Reassess for ICU-level care if no rapid response.";
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
/* FLACC pain scale                                                             */
/* -------------------------------------------------------------------------- */

const flacc = defineCalculator({
  name: "calc_flacc",
  title: "FLACC Pain Scale",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Behavioral pain assessment for non-verbal or preverbal children (2 months – 7 years, or any non-verbal patient). 5 components (Face, Legs, Activity, Cry, Consolability) × 0–2 each = 0–10. Same 0–10 scale as adult numeric rating, allowing parallel documentation.",
  inputSchema: {
    face: z
      .enum(["no_expression", "occasional_grimace", "frequent_quivering_chin_clenched_jaw"])
      .describe(
        "Face: no expression / smile (0), occasional grimace / withdrawn (1), frequent quivering chin or clenched jaw (2).",
      ),
    legs: z
      .enum(["normal", "uneasy_restless_tense", "kicking_or_drawn_up"])
      .describe(
        "Legs: normal / relaxed (0), uneasy / restless / tense (1), kicking or legs drawn up (2).",
      ),
    activity: z
      .enum(["lying_quiet", "squirming_tense", "arched_rigid_or_jerking"])
      .describe(
        "Activity: lying quietly / normal position (0), squirming / shifting / tense (1), arched / rigid / jerking (2).",
      ),
    cry: z
      .enum(["no_cry", "moans_whimpers", "crying_steadily_screaming_sobbing"])
      .describe(
        "Cry: no cry / asleep (0), moans / whimpers / occasional complaint (1), crying steadily / screaming / sobbing (2).",
      ),
    consolability: z
      .enum(["content_relaxed", "reassured_by_touch_or_talk", "difficult_to_console"])
      .describe(
        "Consolability: content / relaxed (0), reassured by touching / hugging / talking (1), difficult to console or comfort (2).",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Merkel SI, Voepel-Lewis T, Shayevitz JR, Malviya S. The FLACC: a behavioral scale for scoring postoperative pain in young children. Pediatr Nurs. 1997;23(3):293-297.",
      url: "https://pubmed.ncbi.nlm.nih.gov/9220806/",
      publisher: "Pediatric Nursing",
    }),
  ],
  compute: (args) => {
    const faceMap = {
      no_expression: 0,
      occasional_grimace: 1,
      frequent_quivering_chin_clenched_jaw: 2,
    } as const;
    const legsMap = {
      normal: 0,
      uneasy_restless_tense: 1,
      kicking_or_drawn_up: 2,
    } as const;
    const activityMap = {
      lying_quiet: 0,
      squirming_tense: 1,
      arched_rigid_or_jerking: 2,
    } as const;
    const cryMap = {
      no_cry: 0,
      moans_whimpers: 1,
      crying_steadily_screaming_sobbing: 2,
    } as const;
    const consolabilityMap = {
      content_relaxed: 0,
      reassured_by_touch_or_talk: 1,
      difficult_to_console: 2,
    } as const;

    const breakdown = [
      { component: "Face", value: faceMap[args.face] },
      { component: "Legs", value: legsMap[args.legs] },
      { component: "Activity", value: activityMap[args.activity] },
      { component: "Cry", value: cryMap[args.cry] },
      { component: "Consolability", value: consolabilityMap[args.consolability] },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score === 0) {
      band = "no pain (0/10)";
      detail = "No behavioral pain indicators.";
    } else if (score <= 3) {
      band = `mild pain (${score}/10)`;
      detail = "Mild pain — non-pharmacologic measures + consider non-opioid analgesic.";
    } else if (score <= 6) {
      band = `moderate pain (${score}/10)`;
      detail =
        "Moderate pain — scheduled non-opioid + consider short-acting opioid for breakthrough.";
    } else {
      band = `severe pain (${score}/10)`;
      detail =
        "Severe pain — scheduled multimodal analgesia including opioid; reassess within 30–60 minutes.";
    }

    return {
      result: score,
      unit: "points (0–10)",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "FLACC behavioral assessment depends on observer interpretation — inter-rater variability is documented. For children with cognitive impairment, the revised FLACC (r-FLACC, Malviya 2006) adds individualized descriptors and is more sensitive.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Wong-Baker FACES pain scale                                                 */
/* -------------------------------------------------------------------------- */

const wongBakerFaces = defineCalculator({
  name: "calc_wong_baker_faces",
  title: "Wong-Baker FACES Pain Rating Scale",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Self-report pain rating for children ≥3 years (and adults with cognitive or language barriers). 6-face visual analog scale mapped to 0–10. The clinician selects the face the patient points to; this tool just classifies the resulting numeric value into the same 0–10 bands FLACC uses, for documentation parity.",
  inputSchema: {
    selected_face_value: z
      .number()
      .int()
      .min(0)
      .max(10)
      .describe(
        "Numeric value of the face the patient selected: 0 (no hurt), 2 (hurts a little bit), 4 (hurts a little more), 6 (hurts even more), 8 (hurts a whole lot), 10 (hurts worst). Allow odd values for between-face responses.",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Wong DL, Baker CM. Pain in children: comparison of assessment scales. Pediatr Nurs. 1988;14(1):9-17.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3344163/",
      publisher: "Pediatric Nursing",
    }),
  ],
  compute: (args) => {
    const v = args.selected_face_value;
    let band: string;
    let detail: string;
    if (v === 0) {
      band = "no hurt (0/10)";
      detail = "Patient reports no pain.";
    } else if (v <= 3) {
      band = `mild pain (${v}/10)`;
      detail = "Mild pain — non-pharmacologic measures + consider non-opioid analgesic.";
    } else if (v <= 6) {
      band = `moderate pain (${v}/10)`;
      detail =
        "Moderate pain — scheduled non-opioid + consider short-acting opioid for breakthrough.";
    } else {
      band = `severe pain (${v}/10)`;
      detail =
        "Severe pain — multimodal analgesia including opioid; reassess within 30–60 minutes.";
    }

    return {
      result: v,
      unit: "points (0–10)",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "Wong-Baker is a self-report instrument — requires the child to understand the face-to-pain mapping. For children <3 y or non-verbal patients, use FLACC instead.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Kocher criteria (pediatric septic hip vs transient synovitis)                */
/* -------------------------------------------------------------------------- */

const kocher = defineCalculator({
  name: "calc_kocher_arthritis",
  title: "Kocher Criteria (Pediatric Septic Hip)",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Differentiates septic arthritis of the hip from transient synovitis in children with hip pain or limp. 4 criteria; predicted probability of septic arthritis rises with criteria met: 0 = 0.2%, 1 = 3%, 2 = 40%, 3 = 93%, 4 = 99%. Caird 2006 added CRP (PMID 16882892) — when CRP available, that variant performs better.",
  inputSchema: {
    non_weight_bearing: z.boolean().describe("Inability to bear weight on the affected side."),
    fever_over_38_5c: z.boolean().describe("Temperature >38.5 °C."),
    esr_over_40: z.boolean().describe("ESR >40 mm/hr."),
    wbc_over_12k: z.boolean().describe("WBC >12,000 cells/mm³."),
  },
  sources: [
    formulaSource({
      title:
        "Kocher MS, Zurakowski D, Kasser JR. Differentiating between septic arthritis and transient synovitis of the hip in children: an evidence-based clinical prediction algorithm. J Bone Joint Surg Am. 1999;81(12):1662-1670.",
      url: "https://pubmed.ncbi.nlm.nih.gov/10608376/",
      publisher: "Journal of Bone and Joint Surgery (American)",
    }),
  ],
  compute: (args) => {
    const breakdown = [
      { component: "Non–weight-bearing", value: args.non_weight_bearing ? 1 : 0 },
      { component: "Temp >38.5 °C", value: args.fever_over_38_5c ? 1 : 0 },
      { component: "ESR >40 mm/hr", value: args.esr_over_40 ? 1 : 0 },
      { component: "WBC >12,000", value: args.wbc_over_12k ? 1 : 0 },
    ];
    const score = sumBreakdown(breakdown);

    const probMap: Record<number, string> = {
      0: "0.2",
      1: "3",
      2: "40",
      3: "93",
      4: "99",
    };
    const band = `${score}/4 criteria — ~${probMap[score]}% probability of septic arthritis`;
    let detail: string;
    if (score <= 1) {
      detail =
        "Low probability — observation, NSAIDs, and weight-bearing reassessment. Septic arthritis is unlikely but cannot be entirely excluded.";
    } else if (score === 2) {
      detail =
        "Intermediate probability — pursue joint aspiration / arthrocentesis. Consider CRP (Caird 2006) for additional discrimination.";
    } else {
      detail =
        "High probability — emergent orthopedic consult, joint aspiration, broad-spectrum antibiotics after culture, and operative drainage if confirmed septic arthritis.";
    }

    return {
      result: score,
      unit: "criteria",
      interpretation: { band, detail },
      breakdown,
      inputs: { ...args },
      warnings: [
        "Original Kocher 1999 derivation cohort was from Boston Children's Hospital; subsequent validations have shown lower predictive accuracy in some populations. Adding CRP (Caird 2006) typically improves discrimination. Clinical judgement and arthrocentesis remain the standard for ambiguous cases.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Pediatric Trauma Score (Tepas 1987)                                          */
/* -------------------------------------------------------------------------- */

const pediatricTraumaScore = defineCalculator({
  name: "calc_pediatric_trauma_score",
  title: "Pediatric Trauma Score (PTS, Tepas)",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "Field triage score for injured children. 6 variables × −1 / +1 / +2 = −6 to +12. PTS ≤8 indicates a critically injured child who should be transported to a pediatric trauma center.",
  inputSchema: {
    weight_band: z
      .enum(["under_10kg", "10_to_20kg", "over_20kg"])
      .describe("Weight: <10 kg (−1), 10–20 kg (+1), >20 kg (+2)."),
    airway: z
      .enum(["unmaintainable", "maintainable_with_oral_nasal_airway_or_o2", "normal"])
      .describe(
        "Airway: unmaintainable / requires intubation (−1), maintainable with oral/nasal airway or O₂ (+1), normal (+2).",
      ),
    sbp_band: z
      .enum(["under_50_mmHg_or_unobtainable", "50_to_90_mmHg", "over_90_mmHg"])
      .describe("Systolic BP: <50 mmHg or unobtainable (−1), 50–90 mmHg (+1), >90 mmHg (+2)."),
    cns_status: z
      .enum(["comatose", "obtunded_or_loss_of_consciousness", "awake"])
      .describe("CNS: comatose (−1), obtunded or any loss of consciousness (+1), awake (+2)."),
    open_wound: z
      .enum(["major_or_penetrating", "minor", "none"])
      .describe("Open wound: major or penetrating (−1), minor (+1), none (+2)."),
    fracture: z
      .enum(["open_or_multiple", "single_closed", "none"])
      .describe(
        "Skeletal: open or multiple fractures (−1), single closed fracture (+1), none (+2).",
      ),
  },
  sources: [
    formulaSource({
      title:
        "Tepas JJ 3rd, Mollitt DL, Talbert JL, Bryant M. The pediatric trauma score as a predictor of injury severity in the injured child. J Pediatr Surg. 1987;22(1):14-18.",
      url: "https://pubmed.ncbi.nlm.nih.gov/3819993/",
      publisher: "Journal of Pediatric Surgery",
    }),
  ],
  compute: (args) => {
    const weightPts =
      args.weight_band === "over_20kg" ? 2 : args.weight_band === "10_to_20kg" ? 1 : -1;
    const airwayPts =
      args.airway === "normal"
        ? 2
        : args.airway === "maintainable_with_oral_nasal_airway_or_o2"
          ? 1
          : -1;
    const sbpPts =
      args.sbp_band === "over_90_mmHg" ? 2 : args.sbp_band === "50_to_90_mmHg" ? 1 : -1;
    const cnsPts =
      args.cns_status === "awake"
        ? 2
        : args.cns_status === "obtunded_or_loss_of_consciousness"
          ? 1
          : -1;
    const woundPts = args.open_wound === "none" ? 2 : args.open_wound === "minor" ? 1 : -1;
    const fracPts = args.fracture === "none" ? 2 : args.fracture === "single_closed" ? 1 : -1;

    const breakdown = [
      { component: "Weight", value: weightPts },
      { component: "Airway", value: airwayPts },
      { component: "Systolic BP", value: sbpPts },
      { component: "CNS", value: cnsPts },
      { component: "Open wound", value: woundPts },
      { component: "Skeletal injury", value: fracPts },
    ];
    const score = sumBreakdown(breakdown);

    let band: string;
    let detail: string;
    if (score >= 9) {
      band = `low risk (${score}/12)`;
      detail =
        "PTS ≥9 — minor-to-moderate injury severity. Standard ED workup at receiving facility.";
    } else if (score >= 6) {
      band = `moderate risk (${score}/12)`;
      detail =
        "PTS 6–8 — moderate injury severity. Transport to pediatric trauma center per Tepas 1987 (mortality rises steeply below 8).";
    } else {
      band = `high risk (${score}/12)`;
      detail =
        "PTS ≤5 — high injury severity. Mortality ~20-30%; transport to highest-level pediatric trauma center, activate trauma team.";
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
/* PECARN Pediatric Head Injury Rule (tree-class, age-banded)                  */
/* -------------------------------------------------------------------------- */

const pecarnHead = defineCalculator({
  name: "calc_pecarn_head",
  title: "PECARN Pediatric Head Injury Rule",
  domain: "pediatrics",
  complexity: "tree",
  description:
    "PECARN decision rule for clinically-important traumatic brain injury (ciTBI) in children with minor blunt head trauma. Two age-banded sub-rules: <2 y and ≥2 y. ciTBI = death / neurosurgery / intubation >24h / admission ≥2 nights. Validated in 42,412 children (Kuppermann 2009).",
  inputSchema: {
    age_y: z
      .number()
      .nonnegative()
      .describe("Age in years (decimal allowed; rule branches at 2 y)."),
    gcs: z.number().int().min(3).max(15).describe("Glasgow Coma Scale (3–15)."),
    altered_mental_status: z
      .boolean()
      .describe(
        "Altered mental status (agitation, somnolence, repetitive questioning, slow response).",
      ),
    loss_of_consciousness: z
      .boolean()
      .describe("Loss of consciousness. For age <2: any LOC ≥5 sec. For age ≥2: any LOC."),
    severe_mechanism: z
      .boolean()
      .describe(
        "Severe injury mechanism: MVA with ejection / fatality / rollover; pedestrian or bicyclist without helmet struck by motorized vehicle; fall >3 ft (<2 y) or >5 ft (≥2 y); head struck by high-impact object.",
      ),
    palpable_skull_fracture: z
      .boolean()
      .optional()
      .describe("(Age <2 only) Palpable skull fracture on exam."),
    occipital_parietal_or_temporal_scalp_hematoma: z
      .boolean()
      .optional()
      .describe("(Age <2 only) Occipital, parietal, or temporal scalp hematoma."),
    not_acting_normally_per_parent: z
      .boolean()
      .optional()
      .describe("(Age <2 only) Parent reports child is not acting normally."),
    signs_of_basilar_skull_fracture: z
      .boolean()
      .optional()
      .describe(
        "(Age ≥2 only) Signs of basilar skull fracture (raccoon eyes, Battle sign, hemotympanum, CSF rhinorrhea/otorrhea).",
      ),
    severe_headache: z.boolean().optional().describe("(Age ≥2 only) Severe headache."),
    vomiting: z
      .boolean()
      .optional()
      .describe("(Age ≥2 only) Vomiting (any episodes after injury)."),
  },
  sources: [
    formulaSource({
      title:
        "Kuppermann N, Holmes JF, Dayan PS, et al. Identification of children at very low risk of clinically-important brain injuries after head trauma: a prospective cohort study. Lancet. 2009;374(9696):1160-1170.",
      url: "https://pubmed.ncbi.nlm.nih.gov/19758692/",
      publisher: "Lancet (PECARN)",
    }),
  ],
  compute: (args) => {
    const isUnder2 = args.age_y < 2;
    const gcs14OrAltered = args.gcs <= 14 || args.altered_mental_status;

    const criteria: ReturnType<typeof criterion>[] = [];

    if (isUnder2) {
      criteria.push(
        criterion("GCS ≤14 or altered mental status", gcs14OrAltered),
        criterion("Palpable skull fracture", args.palpable_skull_fracture ?? false),
        criterion(
          "Occipital/parietal/temporal scalp hematoma",
          args.occipital_parietal_or_temporal_scalp_hematoma ?? false,
        ),
        criterion("LOC ≥5 seconds", args.loss_of_consciousness),
        criterion("Severe injury mechanism", args.severe_mechanism),
        criterion("Not acting normally per parent", args.not_acting_normally_per_parent ?? false),
      );
    } else {
      criteria.push(
        criterion("GCS ≤14 or altered mental status", gcs14OrAltered),
        criterion("Signs of basilar skull fracture", args.signs_of_basilar_skull_fracture ?? false),
        criterion("Loss of consciousness", args.loss_of_consciousness),
        criterion("Vomiting", args.vomiting ?? false),
        criterion("Severe headache", args.severe_headache ?? false),
        criterion("Severe injury mechanism", args.severe_mechanism),
      );
    }

    const metCount = countMet(criteria);
    const highRisk =
      gcs14OrAltered ||
      (isUnder2
        ? (args.palpable_skull_fracture ?? false)
        : (args.signs_of_basilar_skull_fracture ?? false));

    let result: string;
    let band: string;
    let detail: string;
    if (highRisk) {
      result = "high-risk";
      band = "high risk — CT head recommended";
      detail = isUnder2
        ? "GCS ≤14, altered mental status, OR palpable skull fracture → ~4.4% risk of ciTBI. CT head recommended."
        : "GCS ≤14, altered mental status, OR signs of basilar skull fracture → ~4.3% risk of ciTBI. CT head recommended.";
    } else if (metCount > 0) {
      result = "intermediate-risk";
      band = "intermediate risk — observation vs. CT (shared decision)";
      detail = isUnder2
        ? `${metCount} intermediate predictor(s) present. ~0.9% risk of ciTBI. Shared-decision discussion: observation in ED for ≥4–6 h vs. CT. Consider patient/family preference, age (<3 mo lowers threshold for CT), worsening exam, and clinician experience.`
        : `${metCount} intermediate predictor(s) present. ~0.9% risk of ciTBI. Shared-decision discussion: observation vs. CT.`;
    } else {
      result = "very-low-risk";
      band = "very low risk — no CT recommended";
      detail = isUnder2
        ? "Zero predictors — ~0.02% risk of ciTBI. CT not recommended."
        : "Zero predictors — ~0.05% risk of ciTBI. CT not recommended.";
    }

    return {
      result,
      unit: "",
      interpretation: { band, detail },
      rule_trace: {
        criteria,
        summary: `${isUnder2 ? "<2 y rule" : "≥2 y rule"}; ${metCount} predictor(s) met`,
      },
      inputs: { ...args, age_band: isUnder2 ? "<2 y" : "≥2 y" },
      warnings: [
        "PECARN rules apply to GCS ≥14 with minor blunt head trauma — GCS ≤13 is automatically high-risk and falls outside the rule. The age-banded sub-rules have different predictor lists; this tool selects the correct one based on age.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* ISPAD Pediatric DKA Severity                                                */
/* -------------------------------------------------------------------------- */

const ispadPedsDka = defineCalculator({
  name: "calc_ispad_peds_dka",
  title: "ISPAD Pediatric DKA Severity (2022)",
  domain: "pediatrics",
  complexity: "lookup",
  description:
    "ISPAD 2022 pediatric DKA severity grading from venous pH and bicarbonate. Drives fluid replacement rate and insulin infusion choice; severe DKA carries cerebral edema risk (highest in younger children with longer history of symptoms).",
  inputSchema: {
    venous_ph: z.number().positive().describe("Venous pH."),
    bicarbonate_mmol_l: z.number().positive().describe("Serum bicarbonate, mmol/L."),
  },
  sources: [
    formulaSource({
      title:
        "Glaser N, Fritsch M, Priyambada L, et al. ISPAD Clinical Practice Consensus Guidelines 2022: Diabetic ketoacidosis and hyperglycemic hyperosmolar state. Pediatr Diabetes. 2022;23(7):835-856.",
      url: "https://pubmed.ncbi.nlm.nih.gov/36059171/",
      publisher: "International Society for Pediatric and Adolescent Diabetes",
    }),
  ],
  compute: (args) => {
    // Severity is the more-severe of pH or HCO3 criteria per ISPAD 2022.
    let severity: "mild" | "moderate" | "severe";
    if (args.venous_ph < 7.1 || args.bicarbonate_mmol_l < 5) {
      severity = "severe";
    } else if (args.venous_ph < 7.2 || args.bicarbonate_mmol_l < 10) {
      severity = "moderate";
    } else if (args.venous_ph < 7.3 || args.bicarbonate_mmol_l < 15) {
      severity = "mild";
    } else {
      return {
        result: "no-dka",
        unit: "",
        interpretation: {
          band: "no DKA by ISPAD 2022 thresholds",
          detail:
            "pH ≥7.3 and HCO₃ ≥15 — does not meet ISPAD 2022 DKA criteria. Patient may have hyperglycemia without DKA; reassess for ketones (β-hydroxybutyrate) and clinical context.",
        },
        inputs: { ...args },
        warnings: [
          "DKA diagnosis also requires hyperglycemia (>200 mg/dL) and ketonemia. This tool grades severity from blood-gas values; the underlying DKA diagnosis is clinical.",
        ],
      };
    }

    let detail: string;
    if (severity === "mild") {
      detail =
        "Mild DKA. Manage with IV fluid replacement and insulin per ISPAD 2022. Cerebral edema risk is lowest in this band.";
    } else if (severity === "moderate") {
      detail =
        "Moderate DKA. IV fluids + insulin infusion (0.05–0.1 U/kg/hr per ISPAD 2022). Closer neuro monitoring; cerebral edema risk is non-zero, particularly in patients <5 y or with longer symptom history.";
    } else {
      detail =
        "Severe DKA. PICU-level care typically warranted. ISPAD 2022 recommends 0.05–0.1 U/kg/hr insulin infusion. Cerebral edema is the leading cause of DKA-related death in children — monitor neuro status hourly; have mannitol or hypertonic saline available.";
    }

    return {
      result: severity,
      unit: "",
      interpretation: {
        band: `${severity} DKA (pH ${args.venous_ph}, HCO₃ ${args.bicarbonate_mmol_l})`,
        detail,
      },
      inputs: { ...args },
      warnings: [
        "Cerebral edema risk is highest in younger children, those with longer-duration symptoms, and patients given excessive fluids early in resuscitation. ISPAD 2022 recommends 0.45-0.9% NaCl replacement over 24-48 hours and AVOIDS bicarbonate replacement except in life-threatening hyperkalemia or severe acidemia with cardiac instability.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Oxygenation Index (PALICC-2 peds ARDS severity)                              */
/* -------------------------------------------------------------------------- */

const oxygenationIndex = defineCalculator({
  name: "calc_oxygenation_index",
  title: "Oxygenation Index (OI, PALICC-2)",
  domain: "pediatrics",
  complexity: "formula",
  description:
    "OI = (mean airway pressure × FiO₂ × 100) / PaO₂. PALICC-2 (2023) pediatric ARDS severity bands: 4 ≤ OI < 8 mild, 8 ≤ OI < 16 moderate, OI ≥ 16 severe. For non-invasive support without ABG, use the Oxygen Saturation Index (OSI) variant.",
  inputSchema: {
    mean_airway_pressure_cm_h2o: z
      .number()
      .positive()
      .describe("Mean airway pressure (Paw), cm H₂O."),
    fio2: z.number().min(0.21).max(1).describe("Fraction of inspired oxygen, 0.21–1.0."),
    pao2_mm_hg: z.number().positive().describe("Arterial PaO₂, mmHg."),
  },
  sources: [
    formulaSource({
      title:
        "Emeriaud G, López-Fernández YM, Iyer NP, et al. Executive Summary of the Second International Guidelines for the Diagnosis and Initial Management of Pediatric Acute Respiratory Distress Syndrome (PALICC-2). Pediatr Crit Care Med. 2023;24(2):143-168.",
      url: "https://pubmed.ncbi.nlm.nih.gov/36661420/",
      publisher: "Pediatric Critical Care Medicine (PALICC-2)",
    }),
    formulaSource({
      title:
        "Khemani RG, Smith L, Lopez-Fernandez YM, et al. Paediatric acute respiratory distress syndrome incidence and epidemiology (PARDIE): an international, observational study. Lancet Respir Med. 2019;7(2):115-128.",
      url: "https://pubmed.ncbi.nlm.nih.gov/29680569/",
      publisher: "Lancet Respiratory Medicine",
    }),
  ],
  compute: (args) => {
    const oi =
      Math.round(((args.mean_airway_pressure_cm_h2o * args.fio2 * 100) / args.pao2_mm_hg) * 10) /
      10;

    let band: string;
    let detail: string;
    if (oi < 4) {
      band = `below pediatric ARDS threshold (OI ${oi} < 4)`;
      detail =
        "OI below the PALICC-2 pediatric ARDS oxygenation threshold (≥4). Reassess if oxygenation deteriorates.";
    } else if (oi < 8) {
      band = `mild pediatric ARDS (OI ${oi}, 4–7.9)`;
      detail =
        "Mild pediatric ARDS per PALICC-2 2023. Lung-protective ventilation (Vt 5–8 mL/kg PBW); consider prone positioning per PARDIE recommendations.";
    } else if (oi < 16) {
      band = `moderate pediatric ARDS (OI ${oi}, 8–15.9)`;
      detail =
        "Moderate pediatric ARDS. Lung-protective ventilation, optimize PEEP, prone positioning generally indicated.";
    } else {
      band = `severe pediatric ARDS (OI ${oi} ≥ 16)`;
      detail =
        "Severe pediatric ARDS. PALICC-2 endorses early prone positioning, optimization of ventilation strategy, and ECMO consultation per institutional criteria.";
    }

    return {
      result: oi,
      unit: "",
      interpretation: { band, detail },
      inputs: { ...args },
      warnings: [
        "OI requires invasive arterial blood gas. For non-invasively monitored patients, use the Oxygen Saturation Index (OSI = MAP × FiO₂ × 100 / SpO₂) which has its own PALICC-2 thresholds and is a less-validated surrogate.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const pediatricsCalculators: CalculatorDef[] = [
  apgar,
  pediatricGcs,
  schwartzBedsideEgfr,
  westleyCroup,
  pram,
  flacc,
  wongBakerFaces,
  kocher,
  pediatricTraumaScore,
  pecarnHead,
  ispadPedsDka,
  oxygenationIndex,
];
