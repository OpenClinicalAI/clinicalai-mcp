/**
 * Pass-A drug-dosing tools (docs/DRUG_DOSING_CALCULATORS.md v0.1 shortlist).
 *
 * These are pure-compute tools — they do not need FDA-label parsing.
 * Pass B (label-parse-dependent) lands separately once the per-drug label
 * parser ships.
 *
 * Slug convention: `calc_*` for formula-driven; `dose_*` reserved for the
 * label-lookup-driven tools that come in Pass B; `flag_*` for tools that
 * return a categorical warning rather than a numeric dose.
 */

import {
  PUBLISHERS,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
  makeSource,
} from "@openclinicalai/shared";
import { z } from "zod";
import { crossCuttingShape } from "../framework.js";

const formulaSource = (args: { title: string; url: string; publisher: string }) =>
  makeSource({ ...args });

const NO_CACHE = { hit: false as const, age_s: 0 };

/* -------------------------------------------------------------------------- */
/* Vancomycin AUC dosing (first-order PK)                                      */
/* -------------------------------------------------------------------------- */

const vancomycinAucDose = defineTool({
  name: "calc_vancomycin_auc_dose",
  description:
    "First-order PK vancomycin dosing for target AUC₂₄/MIC ≥400 per ASHP/IDSA/PIDS/SIDP 2020 consensus. Returns loading dose, maintenance dose, interval, and predicted AUC₂₄. Two-level Bayesian estimation is the gold standard for individualized dosing — this is the first-order one-equation starting point that pharmacy then refines from levels.",
  inputSchema: {
    ...crossCuttingShape,
    weight_kg: z
      .number()
      .positive()
      .describe(
        "Body weight, kg (use actual body weight; obese patients may need adjusted body weight — pharmacist judgement).",
      ),
    crcl_ml_min: z.number().positive().describe("Creatinine clearance, mL/min (Cockcroft-Gault)."),
    target_auc_mg_hr_l: z
      .number()
      .positive()
      .optional()
      .describe(
        "Target AUC₂₄, mg·h/L. Defaults to 500 (mid-range of 400–600 target per ASHP/IDSA 2020).",
      ),
    age_y: z
      .number()
      .positive()
      .optional()
      .describe("Age in years (informational; CrCl already captures most age effect)."),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    const target = args.target_auc_mg_hr_l ?? 500;
    // Matzke/Pai-style first-order PK:
    //   Vd (L) ≈ 0.7 × weight
    //   Cl (L/hr) ≈ CrCl(mL/min) × 60 × 1e-3 × 0.65 (vancomycin Cl ≈ 65% of CrCl)
    //   ke (hr⁻¹) = Cl / Vd
    //   AUC = Daily dose / Cl  →  Daily dose = AUC × Cl
    const vdL = 0.7 * args.weight_kg;
    const clLhr = ((args.crcl_ml_min * 60) / 1000) * 0.65;
    const ke = clLhr / vdL;
    const halfLifeHr = Math.log(2) / ke;
    const dailyDoseMg = Math.round(target * clLhr);
    // Pick an interval that hits ~3–4× half-life and lands on a clinical round.
    const idealIntervalHr = Math.max(8, Math.round((halfLifeHr * 3) / 4) * 4);
    const interval =
      idealIntervalHr <= 8 ? 8 : idealIntervalHr <= 12 ? 12 : idealIntervalHr <= 24 ? 24 : 36;
    const dosesPerDay = 24 / interval;
    const maintenanceDoseMg = Math.round(dailyDoseMg / dosesPerDay / 250) * 250;
    // Loading dose: 25–30 mg/kg for severely ill; use 25 mg/kg here, capped at 3000 mg.
    const loadingDoseMg = Math.min(Math.round(args.weight_kg * 25), 3000);
    const predictedAuc = Math.round((maintenanceDoseMg * dosesPerDay) / clLhr);

    return makeResult({
      data: {
        loading_dose_mg: loadingDoseMg,
        maintenance_dose_mg: maintenanceDoseMg,
        interval_hr: interval,
        doses_per_day: dosesPerDay,
        predicted_auc_24_mg_hr_l: predictedAuc,
        target_auc_24_mg_hr_l: target,
        estimated_half_life_hr: Math.round(halfLifeHr * 10) / 10,
        clearance_l_hr: Math.round(clLhr * 100) / 100,
        volume_distribution_l: Math.round(vdL * 10) / 10,
        interpretation: {
          band: `Loading ${loadingDoseMg} mg, then ${maintenanceDoseMg} mg IV q${interval}h`,
          detail: `First-order PK estimate targeting AUC₂₄ ≈ ${target} mg·h/L. Confirm with two-level steady-state Bayesian estimation (gold standard) when possible. Pharmacist should adjust based on response, organ function trajectory, and serum levels.`,
        },
      },
      sources: [
        formulaSource({
          title:
            "Rybak MJ, Le J, Lodise TP, et al. Therapeutic monitoring of vancomycin for serious methicillin-resistant Staphylococcus aureus infections: a revised consensus guideline. Am J Health Syst Pharm. 2020;77(11):835-864.",
          url: "https://pubmed.ncbi.nlm.nih.gov/32191793/",
          publisher: "ASHP/IDSA/PIDS/SIDP",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "First-order PK is a starting estimate, NOT a substitute for pharmacist-driven two-level Bayesian dosing in unstable renal function, hemodialysis, ICU, neonatal, obesity, or severely ill patients.",
        "AUC-based dosing requires steady-state level draws; trough-only monitoring is deprecated per ASHP/IDSA 2020. Target AUC₂₄ 400–600 mg·h/L assumes MIC ≤ 1 mg/L by broth microdilution.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Aminoglycoside Hartford once-daily dosing                                   */
/* -------------------------------------------------------------------------- */

const aminoglycosideHartford = defineTool({
  name: "calc_aminoglycoside_hartford",
  description:
    "Once-daily extended-interval aminoglycoside dosing per the Hartford nomogram (Nicolau 1995). Gentamicin/tobramycin 7 mg/kg loading; amikacin 15 mg/kg. Interval is selected per CrCl band and then refined by a 6–14h post-dose level. Not for endocarditis-synergy dosing — use traditional q8h for that.",
  inputSchema: {
    ...crossCuttingShape,
    drug: z.enum(["gentamicin", "tobramycin", "amikacin"]).describe("Aminoglycoside agent."),
    weight_kg: z
      .number()
      .positive()
      .describe("Body weight in kilograms (use ABW if actual >120% of IBW per Pai 2000)."),
    crcl_ml_min: z.number().positive().describe("Creatinine clearance, mL/min."),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    const dosePerKg = args.drug === "amikacin" ? 15 : 7;
    const dose = Math.round((args.weight_kg * dosePerKg) / 10) * 10; // round to nearest 10 mg

    // Hartford nomogram intervals (Nicolau 1995):
    //   CrCl ≥60 → q24h
    //   CrCl 40–59 → q36h
    //   CrCl 20–39 → q48h
    //   CrCl <20 → re-dose by level (q48h+, monitor)
    let interval: string;
    let detail: string;
    if (args.crcl_ml_min >= 60) {
      interval = "q24h";
      detail =
        "CrCl ≥60 — q24h interval. Draw a level at 6–14 h post-dose; the Hartford nomogram (Nicolau 1995) plots that level against time to determine the next interval.";
    } else if (args.crcl_ml_min >= 40) {
      interval = "q36h";
      detail = "CrCl 40–59 — q36h interval per Hartford. Confirm with a 6–14h post-dose level.";
    } else if (args.crcl_ml_min >= 20) {
      interval = "q48h";
      detail =
        "CrCl 20–39 — q48h interval per Hartford. Watch for accumulation; consider pharmacy-driven dosing.";
    } else {
      interval = "individualized";
      detail =
        "CrCl <20 — extended-interval dosing not validated; switch to traditional dosing with peak/trough monitoring, or pharmacy-driven Bayesian estimation. Hartford nomogram does not extend below CrCl 20.";
    }

    return makeResult({
      data: {
        drug: args.drug,
        loading_dose_mg: dose,
        dose_per_kg: dosePerKg,
        interval,
        post_dose_level_timing_hr: "6–14",
        interpretation: {
          band: `${dose} mg IV ${interval}`,
          detail,
        },
      },
      sources: [
        formulaSource({
          title:
            "Nicolau DP, Freeman CD, Belliveau PP, Nightingale CH, Ross JW, Quintiliani R. Experience with a once-daily aminoglycoside program administered to 2,184 adult patients. Antimicrob Agents Chemother. 1995;39(3):650-655.",
          url: "https://pubmed.ncbi.nlm.nih.gov/7708209/",
          publisher: "Antimicrobial Agents and Chemotherapy",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Hartford once-daily is NOT for synergy dosing in endocarditis (use gentamicin 1 mg/kg q8h with the β-lactam) or for pregnant patients. Pediatric extended-interval dosing has separate nomograms.",
        "CrCl <20 mL/min falls outside Hartford — switch to traditional dosing with peak/trough monitoring.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Carboplatin Calvert AUC dosing                                              */
/* -------------------------------------------------------------------------- */

const carboplatinCalvert = defineTool({
  name: "calc_carboplatin_calvert",
  description:
    "Carboplatin dose by the Calvert formula: dose (mg) = target AUC × (GFR + 25). FDA 2010 capping guidance limits GFR to 125 mL/min for chemo dosing to avoid overdosing in patients with very high creatinine clearance.",
  inputSchema: {
    ...crossCuttingShape,
    target_auc: z
      .number()
      .positive()
      .describe(
        "Target AUC, mg·min/mL. Adult typical: 5–7 for first-line, 4 for pretreated, 2 for weekly schedules.",
      ),
    crcl_ml_min: z
      .number()
      .positive()
      .describe(
        "Glomerular filtration rate, mL/min. Use Cockcroft-Gault CrCl per FDA capping guidance, not CKD-EPI eGFR.",
      ),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    // FDA 2010 capping: GFR is capped at 125 mL/min for dose calculation.
    const cappedGfr = Math.min(args.crcl_ml_min, 125);
    const dose = Math.round(args.target_auc * (cappedGfr + 25));
    return makeResult({
      data: {
        carboplatin_dose_mg: dose,
        target_auc: args.target_auc,
        gfr_used_ml_min: cappedGfr,
        gfr_was_capped: cappedGfr < args.crcl_ml_min,
        interpretation: {
          band: `Carboplatin ${dose} mg IV`,
          detail: `Calvert formula: dose = AUC × (GFR + 25) = ${args.target_auc} × (${cappedGfr} + 25) = ${dose} mg. ${
            cappedGfr < args.crcl_ml_min
              ? `GFR capped at 125 mL/min per FDA 2010 — uncapped value was ${args.crcl_ml_min}.`
              : "No FDA cap applied at this GFR."
          }`,
        },
      },
      sources: [
        formulaSource({
          title:
            "Calvert AH, Newell DR, Gumbrell LA, et al. Carboplatin dosage: prospective evaluation of a simple formula based on renal function. J Clin Oncol. 1989;7(11):1748-1756.",
          url: "https://pubmed.ncbi.nlm.nih.gov/2681557/",
          publisher: "Journal of Clinical Oncology",
        }),
        formulaSource({
          title:
            "U.S. Food and Drug Administration. Carboplatin dose calculation. October 2010. (Capping guidance: GFR ≤ 125 mL/min for dose calculation.)",
          url: "https://www.fda.gov/drugs/clinical-pharmacology/carboplatin-dosing",
          publisher: PUBLISHERS.FDA,
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Calvert + FDA 2010 capping: use Cockcroft-Gault CrCl as the GFR input (not CKD-EPI eGFR). Eyeballing GFR from a high-end CKD-EPI value risks overdosing.",
        "Target-AUC selection is regimen- and prior-therapy-dependent. Heavily pretreated patients typically use AUC 4–5; first-line regimens use 5–7; weekly schedules use 2.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Total daily MME (CDC 2022)                                                  */
/* -------------------------------------------------------------------------- */

const MME_FACTORS: Record<string, number> = {
  // CDC 2022 conversion factors (mg PO morphine equivalent per mg of each opioid).
  // PMID 36356238 supplemental table.
  morphine: 1,
  hydrocodone: 1,
  oxycodone: 1.5,
  hydromorphone: 5,
  oxymorphone: 3,
  codeine: 0.15,
  tramadol: 0.2,
  tapentadol: 0.4,
  // Fentanyl transdermal patch: 2.4 per µg/hr (24h cumulative).
  fentanyl_patch_ug_hr: 2.4,
};

/** Methadone is tiered (CDC 2022); see calc_opioid_methadone_conversion for the daily-dose tiering. */
const METHADONE_FACTOR_BY_DAILY_DOSE = (mgPerDay: number): number => {
  if (mgPerDay <= 20) return 4;
  if (mgPerDay <= 40) return 8;
  if (mgPerDay <= 60) return 10;
  return 12;
};

const mmeTotalDaily = defineTool({
  name: "calc_mme_total_daily",
  description:
    "Total daily morphine milligram equivalents (MME) from an opioid regimen, using CDC 2022 conversion factors. Methadone uses CDC 2022 tiered factors (NOT the legacy flat 4.7), and buprenorphine is intentionally excluded — CDC 2022 deprecated a single buprenorphine MME factor as pharmacologically suspect.",
  inputSchema: {
    ...crossCuttingShape,
    regimen: z
      .array(
        z.object({
          drug: z
            .enum([
              "morphine",
              "hydrocodone",
              "oxycodone",
              "hydromorphone",
              "oxymorphone",
              "codeine",
              "tramadol",
              "tapentadol",
              "fentanyl_patch_ug_hr",
              "methadone",
            ])
            .describe("Opioid agent."),
          dose_mg: z
            .number()
            .positive()
            .describe(
              "Single-dose amount (mg). For fentanyl_patch_ug_hr, this is the patch strength in µg/hr (the 'mg' label is overloaded — see drug enum).",
            ),
          doses_per_day: z.number().positive().describe("Number of doses per day."),
        }),
      )
      .min(1)
      .describe("List of opioids in the patient's daily regimen."),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    // Compute methadone daily mg first, since its conversion factor depends on it.
    const methadoneEntries = args.regimen.filter((r) => r.drug === "methadone");
    const methadoneMgPerDay = methadoneEntries.reduce(
      (sum, r) => sum + r.dose_mg * r.doses_per_day,
      0,
    );
    const methadoneFactor = METHADONE_FACTOR_BY_DAILY_DOSE(methadoneMgPerDay);

    const breakdown: { drug: string; daily_dose: number; factor: number; mme: number }[] = [];
    let total = 0;
    for (const entry of args.regimen) {
      const dailyDose = entry.dose_mg * entry.doses_per_day;
      let factor: number;
      if (entry.drug === "methadone") {
        factor = methadoneFactor;
      } else {
        factor = MME_FACTORS[entry.drug] ?? 0;
      }
      const mme = dailyDose * factor;
      breakdown.push({
        drug: entry.drug,
        daily_dose: Math.round(dailyDose * 10) / 10,
        factor,
        mme: Math.round(mme * 10) / 10,
      });
      total += mme;
    }
    const totalRounded = Math.round(total * 10) / 10;

    let band: string;
    let detail: string;
    if (totalRounded < 50) {
      band = `lower risk (${totalRounded} MME/day < 50)`;
      detail =
        "Below the CDC 2022 50 MME/day threshold. Continue to monitor for tolerance, hyperalgesia, and indication-appropriateness.";
    } else if (totalRounded < 90) {
      band = `increased overdose risk (${totalRounded} MME/day, 50–89)`;
      detail =
        "CDC 2022 50–89 MME/day band: increased overdose risk; reassess opioid necessity, consider taper, and ensure naloxone is co-prescribed.";
    } else {
      band = `high risk (${totalRounded} MME/day ≥ 90)`;
      detail =
        "CDC 2022 ≥ 90 MME/day band: high overdose risk. Requires explicit clinical justification; pain-specialist input is reasonable. Naloxone co-prescription is recommended.";
    }

    return makeResult({
      data: {
        total_mme_per_day: totalRounded,
        breakdown,
        interpretation: { band, detail },
      },
      sources: [
        formulaSource({
          title:
            "Dowell D, Ragan KR, Jones CM, Baldwin GT, Chou R. CDC Clinical Practice Guideline for Prescribing Opioids for Pain — United States, 2022. MMWR Recomm Rep. 2022;71(3):1-95.",
          url: "https://pubmed.ncbi.nlm.nih.gov/36356238/",
          publisher: "CDC",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Methadone MME is non-linear and tiered (CDC 2022) — this implementation uses the published 4/8/10/12 factors. The legacy flat 4.7 factor is pharmacologically inaccurate at higher daily doses.",
        "Buprenorphine is intentionally excluded from MME totaling — CDC 2022 deprecated a single buprenorphine MME factor. Account for buprenorphine clinically without rolling it into MME math.",
        "MME is a population-level risk signal, not a patient-level pain-control predictor. The 50/90 MME/day thresholds inform monitoring and shared-decision conversations; they are not absolute prescribing limits.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Equianalgesic opioid conversion (with incomplete-cross-tolerance haircut)   */
/* -------------------------------------------------------------------------- */

const opioidEquianalgesic = defineTool({
  name: "calc_opioid_equianalgesic",
  description:
    "Convert from one opioid to another using the CDC 2022 MME conversion factors, with the standard 25–50% incomplete-cross-tolerance reduction applied to the target dose. Methadone is excluded from both source and target — use `calc_opioid_methadone_conversion` (separate tool, MME-band-tiered) for methadone.",
  inputSchema: {
    ...crossCuttingShape,
    source_drug: z
      .enum([
        "morphine",
        "hydrocodone",
        "oxycodone",
        "hydromorphone",
        "oxymorphone",
        "codeine",
        "tramadol",
        "tapentadol",
      ])
      .describe("Source opioid."),
    source_daily_dose_mg: z
      .number()
      .positive()
      .describe("Total daily dose of the source opioid (mg)."),
    target_drug: z
      .enum([
        "morphine",
        "hydrocodone",
        "oxycodone",
        "hydromorphone",
        "oxymorphone",
        "codeine",
        "tramadol",
        "tapentadol",
      ])
      .describe("Target opioid."),
    cross_tolerance_reduction_pct: z
      .number()
      .min(0)
      .max(75)
      .optional()
      .describe(
        "Percent reduction for incomplete cross-tolerance (default 30 — within the 25–50% standard range). Set to 0 to skip; not recommended.",
      ),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    const reduction = (args.cross_tolerance_reduction_pct ?? 30) / 100;
    const sourceFactor = MME_FACTORS[args.source_drug] ?? 0;
    const targetFactor = MME_FACTORS[args.target_drug] ?? 0;
    if (sourceFactor === 0 || targetFactor === 0) {
      throw new Error("Unknown source or target opioid.");
    }
    const sourceMme = args.source_daily_dose_mg * sourceFactor;
    const targetDailyEquivalent = sourceMme / targetFactor;
    const targetDailyWithHaircut = targetDailyEquivalent * (1 - reduction);

    return makeResult({
      data: {
        source_drug: args.source_drug,
        source_daily_dose_mg: args.source_daily_dose_mg,
        source_mme: Math.round(sourceMme * 10) / 10,
        target_drug: args.target_drug,
        target_daily_equivalent_mg: Math.round(targetDailyEquivalent * 10) / 10,
        cross_tolerance_reduction_pct: Math.round(reduction * 100),
        target_recommended_starting_mg: Math.round(targetDailyWithHaircut * 10) / 10,
        interpretation: {
          band: `Start ${Math.round(targetDailyWithHaircut * 10) / 10} mg/day of ${args.target_drug} (${Math.round(reduction * 100)}% reduction from equipotent ${Math.round(targetDailyEquivalent * 10) / 10} mg/day)`,
          detail: `Source ${args.source_daily_dose_mg} mg/day ${args.source_drug} ≈ ${Math.round(sourceMme * 10) / 10} MME/day. Equipotent target ${args.target_drug} dose is ${Math.round(targetDailyEquivalent * 10) / 10} mg/day; reduce by ${Math.round(reduction * 100)}% for incomplete cross-tolerance → start at ${Math.round(targetDailyWithHaircut * 10) / 10} mg/day, then titrate. Use breakthrough doses 10–15% of total daily dose as needed.`,
        },
      },
      sources: [
        formulaSource({
          title:
            "Dowell D, Ragan KR, Jones CM, Baldwin GT, Chou R. CDC Clinical Practice Guideline for Prescribing Opioids for Pain — United States, 2022. MMWR Recomm Rep. 2022;71(3):1-95.",
          url: "https://pubmed.ncbi.nlm.nih.gov/36356238/",
          publisher: "CDC",
        }),
        formulaSource({
          title:
            "Knotkova H, Fine PG, Portenoy RK. Opioid rotation: the science and the limitations of the equianalgesic dose table. J Pain Symptom Manage. 2009;38(3):426-439.",
          url: "https://pubmed.ncbi.nlm.nih.gov/19735901/",
          publisher: "Journal of Pain and Symptom Management",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Incomplete cross-tolerance reductions of 25–50% are the standard starting point; clinicians use 50%+ in opioid-naive or fragile patients and 0–25% in patients with strong tolerance. The 30% default is a middle-ground starting estimate, not a recommendation.",
        "Methadone conversion is non-linear and excluded from this tool — see calc_opioid_methadone_conversion (planned).",
        "Equianalgesic tables are population averages; individual response varies substantially. Re-evaluate within 24–48 hours of rotation.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* UFH weight-based dosing (Raschke nomogram)                                  */
/* -------------------------------------------------------------------------- */

const heparinWeightBased = defineTool({
  name: "calc_heparin_weight_based",
  description:
    "Unfractionated heparin weight-based dosing (Raschke 1993 nomogram). VTE: 80 U/kg bolus + 18 U/kg/hr infusion. ACS: 60 U/kg bolus capped at 4000 U + 12 U/kg/hr capped at 1000 U/hr (per ACC/AHA NSTEMI 2014). First aPTT check at 6 hours.",
  inputSchema: {
    ...crossCuttingShape,
    weight_kg: z
      .number()
      .positive()
      .describe(
        "Body weight, kg. Use actual body weight; some institutions cap at 150 kg — flag in clinical context.",
      ),
    indication: z
      .enum(["vte", "acs"])
      .describe("Indication: vte (DVT/PE treatment) or acs (acute coronary syndrome)."),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    let bolusU: number;
    let infusionUPerHr: number;
    let bolusCapped = false;
    let infusionCapped = false;
    if (args.indication === "vte") {
      bolusU = Math.round(args.weight_kg * 80);
      infusionUPerHr = Math.round(args.weight_kg * 18);
    } else {
      bolusU = args.weight_kg * 60;
      if (bolusU > 4000) {
        bolusU = 4000;
        bolusCapped = true;
      } else {
        bolusU = Math.round(bolusU);
      }
      infusionUPerHr = args.weight_kg * 12;
      if (infusionUPerHr > 1000) {
        infusionUPerHr = 1000;
        infusionCapped = true;
      } else {
        infusionUPerHr = Math.round(infusionUPerHr);
      }
    }

    return makeResult({
      data: {
        indication: args.indication,
        bolus_units: bolusU,
        bolus_capped: bolusCapped,
        infusion_units_per_hr: infusionUPerHr,
        infusion_capped: infusionCapped,
        first_aptt_check_hr: 6,
        interpretation: {
          band: `${bolusU} U bolus, then ${infusionUPerHr} U/hr infusion (${args.indication.toUpperCase()})`,
          detail:
            args.indication === "vte"
              ? "VTE treatment: 80 U/kg bolus + 18 U/kg/hr infusion (Raschke 1993). Check first aPTT at 6 hours, then adjust per institutional nomogram every 6 hours until 2 consecutive therapeutic levels."
              : `ACS: 60 U/kg bolus (max 4000 U) + 12 U/kg/hr infusion (max 1000 U/hr) per ACC/AHA NSTEMI 2014. Check first aPTT at 6 hours.${bolusCapped || infusionCapped ? " Bolus and/or infusion were capped." : ""}`,
        },
      },
      sources: [
        formulaSource({
          title:
            "Raschke RA, Reilly BM, Guidry JR, Fontana JR, Srinivas S. The weight-based heparin dosing nomogram compared with a 'standard care' nomogram. A randomized controlled trial. Ann Intern Med. 1993;119(9):874-881.",
          url: "https://pubmed.ncbi.nlm.nih.gov/8214996/",
          publisher: "Annals of Internal Medicine",
        }),
        formulaSource({
          title:
            "Amsterdam EA, Wenger NK, Brindis RG, et al. 2014 AHA/ACC Guideline for the Management of Patients With Non-ST-Elevation Acute Coronary Syndromes. J Am Coll Cardiol. 2014;64(24):e139-e228.",
          url: "https://pubmed.ncbi.nlm.nih.gov/25260718/",
          publisher: "American College of Cardiology / American Heart Association",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Institutional nomograms vary on the bolus/infusion targets and the aPTT adjustment table — confirm against your hospital's protocol before prescribing. Patients with obesity (>150 kg) and ECMO require pharmacist-driven dosing.",
        "Heparin-induced thrombocytopenia must be screened with platelet trends every 2–3 days; consider 4Ts score if platelets fall.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* 4F-PCC (Kcentra) INR-band reversal dosing                                   */
/* -------------------------------------------------------------------------- */

const fourFactorPccKcentra = defineTool({
  name: "calc_4fpcc_kcentra",
  description:
    "4-factor prothrombin complex concentrate (Kcentra) reversal dose for warfarin-associated major bleeding. INR-band-based per FDA label and Neurocrit Care 2016. Hard cap at 5000 IU regardless of weight. Pair with IV vitamin K 10 mg (concurrent, not deferred).",
  inputSchema: {
    ...crossCuttingShape,
    weight_kg: z
      .number()
      .positive()
      .describe("Body weight, kg (capped at 100 kg for dose calculation per FDA label)."),
    inr: z.number().positive().describe("Current INR."),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    // FDA label: dose is capped at 100 kg of body weight; total cap 5000 IU.
    const dosingWeight = Math.min(args.weight_kg, 100);
    let iuPerKg: number;
    let maxIu: number;
    let band: string;
    if (args.inr >= 2 && args.inr < 4) {
      iuPerKg = 25;
      maxIu = 2500;
      band = "INR 2 to <4 → 25 IU/kg (max 2500)";
    } else if (args.inr >= 4 && args.inr <= 6) {
      iuPerKg = 35;
      maxIu = 3500;
      band = "INR 4–6 → 35 IU/kg (max 3500)";
    } else if (args.inr > 6) {
      iuPerKg = 50;
      maxIu = 5000;
      band = "INR >6 → 50 IU/kg (max 5000)";
    } else {
      // INR < 2 — Kcentra is not indicated for reversal at therapeutic INR.
      throw new Error(
        "INR is below the Kcentra reversal threshold (<2.0). Kcentra is not indicated for INR <2; reassess clinical scenario.",
      );
    }
    const computedDose = iuPerKg * dosingWeight;
    const dose = Math.min(Math.round(computedDose), maxIu);

    return makeResult({
      data: {
        kcentra_dose_iu: dose,
        iu_per_kg: iuPerKg,
        dosing_weight_kg: dosingWeight,
        weight_was_capped: args.weight_kg > 100,
        dose_was_capped_at_band_max: computedDose > maxIu,
        absolute_max_iu: 5000,
        interpretation: {
          band,
          detail: `${dose} IU IV 4F-PCC (Kcentra). Pair with IV vitamin K 10 mg administered concurrently (not deferred) — Kcentra's effect lasts ~12–24 hours; vitamin K provides durable reversal. Reassess INR 30 minutes after Kcentra completion.`,
        },
      },
      sources: [
        formulaSource({
          title:
            "Kcentra (Prothrombin Complex Concentrate, Human) [package insert]. CSL Behring, Marburg, Germany.",
          url: "https://www.fda.gov/vaccines-blood-biologics/approved-blood-products/kcentra",
          publisher: PUBLISHERS.FDA,
        }),
        formulaSource({
          title:
            "Frontera JA, Lewin JJ 3rd, Rabinstein AA, et al. Guideline for Reversal of Antithrombotics in Intracranial Hemorrhage: A Statement for Healthcare Professionals from the Neurocritical Care Society and Society of Critical Care Medicine. Neurocrit Care. 2016;24(1):6-46.",
          url: "https://pubmed.ncbi.nlm.nih.gov/26714677/",
          publisher: "Neurocritical Care Society",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Kcentra without concurrent IV vitamin K leads to INR rebound at 12–24 hours. Always administer both together for warfarin reversal.",
        "Kcentra is not appropriate for DOAC reversal — use idarucizumab (dabigatran) or andexanet alfa (factor Xa inhibitors) where available. 4F-PCC is sometimes used off-label for DOAC reversal but per ACCP 2018 is second-line.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Sodium correction rate (hyponatremia / hypernatremia rate-of-change limits) */
/* -------------------------------------------------------------------------- */

const sodiumCorrectionRate = defineTool({
  name: "calc_sodium_correction_rate",
  description:
    "Maximum safe rate of sodium correction in hyponatremia or hypernatremia, with the time-to-reach-target calculation. Hyponatremia limit (osmotic demyelination / CPM risk): 6–8 mEq/L per 24h for chronic, up to 10–12 for acute documented <24h onset. Hypernatremia limit (cerebral edema risk): 0.5 mEq/L per hour, 10 mEq/L per 24h.",
  inputSchema: {
    ...crossCuttingShape,
    current_sodium_mmol_l: z.number().positive().describe("Current serum sodium, mmol/L."),
    target_sodium_mmol_l: z.number().positive().describe("Target serum sodium, mmol/L."),
    chronicity: z
      .enum(["chronic", "acute_documented_under_24h"])
      .describe(
        "Documented onset chronicity. Chronic (or unknown duration) → strict 6–8 mEq/L/24h cap. Acute documented <24h → 10–12 mEq/L/24h ceiling per ESS 2014.",
      ),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    const direction =
      args.target_sodium_mmol_l > args.current_sodium_mmol_l ? "increase" : "decrease";
    const delta = Math.abs(args.target_sodium_mmol_l - args.current_sodium_mmol_l);

    let maxPer24h: number;
    let detail: string;
    if (direction === "increase") {
      // Hyponatremia → raising Na.
      maxPer24h = args.chronicity === "acute_documented_under_24h" ? 12 : 8;
      detail = `Hyponatremia correction. Max ${maxPer24h} mEq/L per 24 hours per ${args.chronicity === "acute_documented_under_24h" ? "ESS 2014 acute" : "ESS 2014 chronic"} cap. Exceeding the cap risks osmotic demyelination (formerly central pontine myelinolysis).`;
    } else {
      // Hypernatremia → lowering Na.
      maxPer24h = 10;
      detail =
        "Hypernatremia correction. Max 0.5 mEq/L per hour, 10 mEq/L per 24h (Adrogué-Madias 2000) to avoid cerebral edema. Replace free water gradually.";
    }
    const minHoursToTarget = Math.ceil((delta / maxPer24h) * 24);
    const ratePerHr = Math.round((maxPer24h / 24) * 100) / 100;

    return makeResult({
      data: {
        direction,
        delta_mmol_l: delta,
        max_per_24h_mmol_l: maxPer24h,
        max_per_hour_mmol_l: ratePerHr,
        minimum_hours_to_reach_target: minHoursToTarget,
        chronicity: args.chronicity,
        interpretation: {
          band: `Max ${ratePerHr} mEq/L per hour; reach target over ≥${minHoursToTarget} hours`,
          detail,
        },
      },
      sources: [
        formulaSource({
          title: "Adrogué HJ, Madias NE. Hyponatremia. N Engl J Med. 2000;342(21):1581-1589.",
          url: "https://pubmed.ncbi.nlm.nih.gov/10824078/",
          publisher: "New England Journal of Medicine",
        }),
        formulaSource({
          title:
            "Spasovski G, Vanholder R, Allolio B, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Intensive Care Med. 2014;40(3):320-331.",
          url: "https://pubmed.ncbi.nlm.nih.gov/24569496/",
          publisher: "European Society of Endocrinology / ESICM / ERA-EDTA",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Osmotic demyelination syndrome (ODS / CPM) is irreversible — over-rapid correction of chronic hyponatremia is the prototypical avoidable iatrogenic harm. When in doubt, treat as chronic (slower cap).",
        "Re-lower with D5W or DDAVP if correction overshoots — this is an active management decision, not a wait-and-watch one.",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */
/* Beers Criteria flag (v0.1 vendored subset)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Subset of the AGS Beers Criteria 2023 — the highest-traffic
 * potentially-inappropriate-medication classes. The full ~50-class
 * table will be vendored in a follow-up release. Keyed by RxNorm
 * ingredient name (lowercase) for v0.1; will move to RxCUI-based
 * matching once we wire the rxnorm-name-to-rxcui lookup into this
 * tool (planned for Pass A.5).
 */
const BEERS_2023_TABLE: Record<
  string,
  { severity: "avoid" | "use_with_caution"; rationale: string; alternative?: string }
> = {
  // Anticholinergics — avoid in older adults.
  diphenhydramine: {
    severity: "avoid",
    rationale:
      "First-generation antihistamine with strong anticholinergic effects — confusion, delirium, falls, urinary retention. AGS Beers 2023.",
    alternative:
      "Second-generation antihistamines (loratadine, cetirizine) if antihistamine indicated.",
  },
  hydroxyzine: {
    severity: "avoid",
    rationale: "Anticholinergic burden in older adults; high sedation. AGS Beers 2023.",
  },
  oxybutynin: {
    severity: "avoid",
    rationale:
      "Anticholinergic — urinary retention, confusion, delirium. AGS Beers 2023 (immediate-release; extended-release with caution).",
    alternative: "Mirabegron or behavioral therapy for overactive bladder; pelvic floor PT.",
  },
  // Benzodiazepines and Z-drugs — avoid.
  diazepam: {
    severity: "avoid",
    rationale:
      "Long-acting benzodiazepine — falls, fractures, delirium, cognitive impairment. AGS Beers 2023 avoids all benzodiazepines in older adults.",
  },
  alprazolam: {
    severity: "avoid",
    rationale: "Benzodiazepine — falls, fractures, delirium. AGS Beers 2023.",
  },
  lorazepam: {
    severity: "avoid",
    rationale:
      "Benzodiazepine — falls, fractures, delirium. AGS Beers 2023. May be needed for status epilepticus / palliative care.",
  },
  zolpidem: {
    severity: "avoid",
    rationale: "Z-drug — falls, MVAs, complex sleep behaviors. AGS Beers 2023.",
    alternative: "Sleep hygiene, melatonin, CBT-I.",
  },
  // First-generation antipsychotics — increased mortality in dementia.
  haloperidol: {
    severity: "use_with_caution",
    rationale:
      "Antipsychotic use in dementia carries an FDA boxed warning for increased mortality. Reserve for severe agitation when non-pharmacologic measures have failed; lowest effective dose, time-limited. AGS Beers 2023.",
  },
  quetiapine: {
    severity: "use_with_caution",
    rationale:
      "Antipsychotic in dementia: FDA boxed warning for increased mortality. AGS Beers 2023.",
  },
  // NSAIDs — chronic use avoided.
  ibuprofen: {
    severity: "use_with_caution",
    rationale:
      "Non-COX-selective NSAID — GI bleed, AKI, HF exacerbation, BP elevation. AGS Beers 2023 avoids chronic use without PPI co-therapy and GI bleed risk consideration.",
    alternative: "Acetaminophen first; topical NSAIDs for localized pain; physical therapy.",
  },
  naproxen: {
    severity: "use_with_caution",
    rationale:
      "Non-COX-selective NSAID — same risks as ibuprofen, longer half-life. AGS Beers 2023.",
  },
  // Other notable Beers 2023 entries.
  meperidine: {
    severity: "avoid",
    rationale:
      "Opioid — normeperidine metabolite accumulates in older adults causing neurotoxicity (delirium, seizures). AGS Beers 2023 avoids in older adults.",
    alternative: "Morphine, hydromorphone, oxycodone where opioid indicated.",
  },
  glyburide: {
    severity: "avoid",
    rationale: "Long-acting sulfonylurea — prolonged hypoglycemia in older adults. AGS Beers 2023.",
    alternative: "Glipizide (shorter half-life), or non-sulfonylurea T2DM agents.",
  },
  metoclopramide: {
    severity: "use_with_caution",
    rationale:
      "Risk of tardive dyskinesia and extrapyramidal symptoms. AGS Beers 2023 limits to ≤12 weeks in older adults unless gastroparesis is otherwise unmanageable.",
  },
  digoxin: {
    severity: "use_with_caution",
    rationale:
      "AGS Beers 2023 avoids first-line in AF or HFrEF; use only with serum-level monitoring. Doses >0.125 mg/day increase toxicity risk.",
  },
};

const beersFlag = defineTool({
  name: "flag_beers_criteria",
  description:
    "Flag a medication as potentially inappropriate for an older adult per the AGS Beers Criteria 2023. Returns severity (avoid / use_with_caution / not_flagged), rationale, and a suggested alternative class where available. v0.1 covers a high-traffic subset (~15 classes); the full ~50-class table lands in v0.2.",
  inputSchema: {
    ...crossCuttingShape,
    drug_name: z
      .string()
      .min(1)
      .describe(
        "Lowercase RxNorm ingredient name (e.g. 'diphenhydramine', 'lorazepam'). v0.1 keys on name; v0.2 will accept RxCUI.",
      ),
    age_y: z
      .number()
      .nonnegative()
      .describe("Patient age in years. Beers Criteria apply to age ≥ 65."),
  },
  handler: async (args, _ctx): Promise<ToolResult<unknown>> => {
    if (args.age_y < 65) {
      return makeResult({
        data: {
          flagged: false,
          severity: "not_flagged",
          rationale:
            "Patient age <65 — AGS Beers Criteria 2023 specifically apply to older adults (≥65).",
          drug_name: args.drug_name,
        },
        sources: [
          formulaSource({
            title:
              "By the 2023 American Geriatrics Society Beers Criteria Update Expert Panel. American Geriatrics Society 2023 updated AGS Beers Criteria for potentially inappropriate medication use in older adults. J Am Geriatr Soc. 2023;71(7):2052-2081.",
            url: "https://pubmed.ncbi.nlm.nih.gov/37139824/",
            publisher: "American Geriatrics Society",
          }),
        ],
        tier: "free",
        cache: NO_CACHE,
        phi_mode: args.phi_mode,
      });
    }

    const key = args.drug_name.toLowerCase().trim();
    const entry = BEERS_2023_TABLE[key];
    if (!entry) {
      return makeResult({
        data: {
          flagged: false,
          severity: "not_flagged",
          rationale:
            "Drug not in v0.1 Beers high-traffic subset. v0.2 will vendor the full AGS 2023 table (~50 classes). Verify against the published Beers list manually — absence from this subset does NOT imply Beers-safe.",
          drug_name: args.drug_name,
        },
        sources: [
          formulaSource({
            title:
              "By the 2023 American Geriatrics Society Beers Criteria Update Expert Panel. American Geriatrics Society 2023 updated AGS Beers Criteria for potentially inappropriate medication use in older adults. J Am Geriatr Soc. 2023;71(7):2052-2081.",
            url: "https://pubmed.ncbi.nlm.nih.gov/37139824/",
            publisher: "American Geriatrics Society",
          }),
        ],
        tier: "free",
        cache: NO_CACHE,
        phi_mode: args.phi_mode,
        warnings: [
          "v0.1 Beers table is a subset (~15 high-traffic classes). Absence from this subset is not authoritative — verify against the published AGS 2023 list before relying on a 'not flagged' result.",
        ],
      });
    }

    return makeResult({
      data: {
        flagged: true,
        severity: entry.severity,
        rationale: entry.rationale,
        ...(entry.alternative ? { alternative_class: entry.alternative } : {}),
        drug_name: args.drug_name,
      },
      sources: [
        formulaSource({
          title:
            "By the 2023 American Geriatrics Society Beers Criteria Update Expert Panel. American Geriatrics Society 2023 updated AGS Beers Criteria for potentially inappropriate medication use in older adults. J Am Geriatr Soc. 2023;71(7):2052-2081.",
          url: "https://pubmed.ncbi.nlm.nih.gov/37139824/",
          publisher: "American Geriatrics Society",
        }),
      ],
      tier: "free",
      cache: NO_CACHE,
      phi_mode: args.phi_mode,
      warnings: [
        "Beers Criteria are flags for review, not absolute contraindications. Some Beers-flagged medications remain appropriate for individual patients after risk/benefit discussion (e.g. lorazepam for status epilepticus, antipsychotics for severe refractory agitation in dementia).",
      ],
    });
  },
});

/* -------------------------------------------------------------------------- */

export const dosingDrugTools: ToolDef[] = [
  vancomycinAucDose,
  aminoglycosideHartford,
  carboplatinCalvert,
  mmeTotalDaily,
  opioidEquianalgesic,
  heparinWeightBased,
  fourFactorPccKcentra,
  sodiumCorrectionRate,
  beersFlag,
];
