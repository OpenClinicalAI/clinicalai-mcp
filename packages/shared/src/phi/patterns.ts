/**
 * Regex pattern library for the built-in `regex` redaction backend.
 *
 * Honest about its limits (ARCHITECTURE.md §3.5.4): name recall is the weak
 * point — surname-only and honorific patterns plus a small curated common-name
 * list. MRN and insurance-ID detection is deliberately *contextual* (label-
 * prefixed) so the redactor does not shred clinical numerics (lab values,
 * RxCUIs, dose strings). The `foundation` backend (milestone 2) is the answer
 * for the long tail; this backend emits a `warnings` entry saying so.
 */

import type { PhiCategory } from "../types.js";

/** Every category the redaction layer recognizes. */
export const ALL_PHI_CATEGORIES: PhiCategory[] = [
  "name",
  "mrn",
  "date",
  "address",
  "phone",
  "email",
  "ssn",
  "insurance_id",
];

/** A small curated list of common US given names + surnames (low-recall by design). */
const COMMON_NAMES = [
  "James",
  "John",
  "Robert",
  "Michael",
  "William",
  "David",
  "Richard",
  "Joseph",
  "Thomas",
  "Charles",
  "Mary",
  "Patricia",
  "Jennifer",
  "Linda",
  "Elizabeth",
  "Barbara",
  "Susan",
  "Jessica",
  "Sarah",
  "Karen",
  "Maria",
  "Jose",
  "Wei",
  "Mohammed",
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Nguyen",
  "Patel",
  "Kim",
  "Lee",
  "Singh",
  "Khan",
  "Chen",
  "Wang",
];

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

/** A category and the (global) regex that detects it. */
export interface PhiPattern {
  category: PhiCategory;
  regex: RegExp;
}

/**
 * Build a fresh set of patterns. Returns new `RegExp` objects each call so the
 * stateful `lastIndex` of global regexes is never shared across redaction runs.
 */
export function phiPatterns(): PhiPattern[] {
  const nameAlternation = COMMON_NAMES.join("|");
  return [
    {
      category: "email",
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    },
    {
      category: "ssn",
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    },
    {
      category: "phone",
      regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
    },
    {
      // Numeric + ISO + month-name dates. Year-only is intentionally NOT matched
      // (a bare year is permitted under Safe Harbor).
      category: "date",
      regex: new RegExp(
        [
          "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b",
          "\\b\\d{4}-\\d{2}-\\d{2}\\b",
          `\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
          `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?\\s+\\d{4}\\b`,
        ].join("|"),
        "gi",
      ),
    },
    {
      category: "address",
      regex:
        /\b\d{1,6}\s+(?:[A-Z][a-zA-Z]*\.?\s){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir)\b\.?/g,
    },
    {
      // Contextual: an MRN-shaped identifier must be label-prefixed.
      category: "mrn",
      regex: /\b(?:MRN|medical record (?:number|no\.?|#))\s*[:#]?\s*[A-Za-z0-9-]{4,}/gi,
    },
    {
      // Contextual: an insurance/member/policy identifier must be label-prefixed.
      category: "insurance_id",
      regex:
        /\b(?:insurance|member|subscriber|policy|beneficiary|group)\s*(?:id|no\.?|number|#)\s*[:#]?\s*[A-Za-z0-9-]{4,}/gi,
    },
    {
      // Honorific-prefixed names, plus a curated common-name list.
      category: "name",
      regex: new RegExp(
        [
          "\\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Rev)\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?",
          `\\b(?:${nameAlternation})\\b`,
        ].join("|"),
        "g",
      ),
    },
  ];
}
