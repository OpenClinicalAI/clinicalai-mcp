/**
 * Obstetrics calculators (ARCHITECTURE.md §5.3).
 *
 * Pregnancy dating tools per ACOG Committee Opinion No. 700 (2017).
 * First-trimester ultrasound CRL dating is preferred over LMP-based dating
 * when discrepancy exceeds 5 days; these tools cover the LMP-derived
 * estimates only.
 */

import { formulaSource } from "@openclinicalai/shared";
import { z } from "zod";
import { type CalculatorDef, defineCalculator } from "../framework.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse an ISO date (YYYY-MM-DD) into a UTC Date. Throws on bad format. */
function parseIsoDate(value: string, field: string): Date {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`${field} must be an ISO date (YYYY-MM-DD); received "${value}"`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${field} is not a valid date: "${value}"`);
  }
  return d;
}

/** Format a UTC Date back to YYYY-MM-DD. */
function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add `days` to a UTC date and return the new Date. */
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/* -------------------------------------------------------------------------- */

const acogSource = formulaSource({
  title:
    "ACOG Committee Opinion No. 700: Methods for Estimating the Due Date. Obstet Gynecol. 2017;129(5):e150-e154.",
  url: "https://pubmed.ncbi.nlm.nih.gov/28426621/",
  publisher: "American College of Obstetricians and Gynecologists",
});

/* -------------------------------------------------------------------------- */

const estimatedDueDate = defineCalculator({
  name: "calc_estimated_due_date",
  title: "Estimated Due Date (Naegele's Rule)",
  domain: "obstetrics",
  complexity: "formula",
  description:
    "Naegele's rule for estimated due date from last menstrual period (LMP). EDD = LMP + 280 days, adjusted for cycle length deviation from 28 days. First-trimester ultrasound dating is preferred when LMP–US discrepancy exceeds 5 days (ACOG 2017).",
  inputSchema: {
    last_menstrual_period_date: z
      .string()
      .regex(ISO_DATE_RE)
      .describe("Date of last menstrual period (ISO format, YYYY-MM-DD)."),
    cycle_length_days: z
      .number()
      .int()
      .min(21)
      .max(45)
      .optional()
      .describe("Menstrual cycle length in days. Default 28."),
  },
  sources: [acogSource],
  compute: (args) => {
    const lmp = parseIsoDate(args.last_menstrual_period_date, "last_menstrual_period_date");
    const cycle = args.cycle_length_days ?? 28;
    const edd = addDays(lmp, 280 + (cycle - 28));
    return {
      result: formatIsoDate(edd),
      unit: "",
      interpretation: {
        band: `EDD ${formatIsoDate(edd)}`,
        detail:
          "Term is 37 weeks 0 days through 41 weeks 6 days. Per ACOG 2017, first-trimester ultrasound CRL dating supersedes LMP-based EDD when the two differ by more than 5 days; consider redating if discrepancy applies.",
      },
      inputs: { ...args, cycle_length_days: cycle },
      warnings: [
        "Naegele assumes a regular cycle and ovulation on cycle day 14 of a 28-day cycle. Irregular cycles, PCOS, or recent hormonal contraception invalidate this — use first-trimester ultrasound (CRL) dating instead.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const estimatedConceptionDate = defineCalculator({
  name: "calc_estimated_conception_date",
  title: "Estimated Date of Conception",
  domain: "obstetrics",
  complexity: "formula",
  description:
    "Estimated date of conception assuming ovulation on cycle day 14: EDC = LMP + 14 days. Operational definition tied to the same assumptions as Naegele's rule.",
  inputSchema: {
    last_menstrual_period_date: z
      .string()
      .regex(ISO_DATE_RE)
      .describe("Date of last menstrual period (ISO YYYY-MM-DD)."),
  },
  sources: [acogSource],
  compute: (args) => {
    const lmp = parseIsoDate(args.last_menstrual_period_date, "last_menstrual_period_date");
    const edc = addDays(lmp, 14);
    return {
      result: formatIsoDate(edc),
      unit: "",
      interpretation: {
        band: `EDC ${formatIsoDate(edc)}`,
        detail:
          "Estimated date of conception assumes ovulation on cycle day 14. Use first-trimester ultrasound for precise dating when LMP is unreliable.",
      },
      inputs: { ...args },
      warnings: [
        "Same cycle-regularity caveats as Naegele's EDD. EDC is operational, not biologically precise — actual fertilization day may vary by several days even in regular cycles.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

const estimatedGestationalAge = defineCalculator({
  name: "calc_estimated_gestational_age",
  title: "Estimated Gestational Age (from LMP)",
  domain: "obstetrics",
  complexity: "formula",
  description:
    "Gestational age in completed weeks + days from last menstrual period to a given date. Result is total days; the interpretation surfaces the conventional `Xw Yd` notation.",
  inputSchema: {
    last_menstrual_period_date: z
      .string()
      .regex(ISO_DATE_RE)
      .describe("Date of last menstrual period (ISO YYYY-MM-DD)."),
    current_date: z
      .string()
      .regex(ISO_DATE_RE)
      .describe("Reference date for the gestational-age calculation (ISO YYYY-MM-DD)."),
  },
  sources: [acogSource],
  compute: (args) => {
    const lmp = parseIsoDate(args.last_menstrual_period_date, "last_menstrual_period_date");
    const now = parseIsoDate(args.current_date, "current_date");
    const days = Math.floor((now.getTime() - lmp.getTime()) / DAY_MS);
    if (days < 0) {
      throw new Error(
        `current_date (${args.current_date}) is before last_menstrual_period_date (${args.last_menstrual_period_date}).`,
      );
    }
    const weeks = Math.floor(days / 7);
    const remainder = days % 7;

    let band: string;
    let detail: string;
    if (weeks < 14) {
      band = `${weeks}w${remainder}d (first trimester)`;
      detail =
        "First trimester (0w0d – 13w6d). First-trimester ultrasound CRL dating supersedes LMP when discrepancy >5 days (ACOG 2017).";
    } else if (weeks < 28) {
      band = `${weeks}w${remainder}d (second trimester)`;
      detail = "Second trimester (14w0d – 27w6d). Anatomy ultrasound typically 18–22 weeks.";
    } else if (weeks < 37) {
      band = `${weeks}w${remainder}d (third trimester, preterm if delivered)`;
      detail = "Third trimester before term (28w0d – 36w6d). Delivery would be preterm.";
    } else if (weeks < 42) {
      band = `${weeks}w${remainder}d (term)`;
      detail = "Term gestation (37w0d – 41w6d).";
    } else {
      band = `${weeks}w${remainder}d (post-term)`;
      detail = "Post-term gestation (≥42w0d) — induction generally indicated per ACOG.";
    }

    return {
      result: days,
      unit: "days",
      interpretation: { band, detail },
      inputs: { ...args, weeks, days_remainder: remainder },
      warnings: [
        "Gestational age is by convention measured from LMP (about 2 weeks before conception). First-trimester ultrasound is more accurate when LMP is unknown or unreliable.",
      ],
    };
  },
});

/* -------------------------------------------------------------------------- */

export const obstetricsCalculators: CalculatorDef[] = [
  estimatedDueDate,
  estimatedConceptionDate,
  estimatedGestationalAge,
];
