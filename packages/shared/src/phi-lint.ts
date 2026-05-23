/**
 * phi-lint — the CI rule for the schema-level PHI invariant (ARCHITECTURE.md §3.5.1).
 *
 * No tool input may have a parameter that is, by semantics, a patient identifier.
 * The MCP is a reference-lookup layer; PHI fields are a category error here. This
 * module scans tool input schemas and rejects PHI-shaped field names. The server
 * scaffold runs it over every registered tool at startup, and the test suite runs
 * it in CI.
 *
 * This is a *field-name* check. It is intentionally conservative: it does not ban
 * generic names like `name` or `date` (a calculator's `describe_calculator(name)`
 * or an evidence query's `date_from` are legitimate), only names that are
 * unambiguously patient identifiers.
 */

import { z } from "zod";

/**
 * Separatorless, lowercased forms of unambiguously-PHI field names.
 * Input names are normalized the same way before lookup.
 */
const FORBIDDEN: ReadonlyMap<string, string> = new Map([
  // names
  ["patientname", "name"],
  ["firstname", "name"],
  ["lastname", "name"],
  ["fullname", "name"],
  ["middlename", "name"],
  ["givenname", "name"],
  ["familyname", "name"],
  ["surname", "name"],
  ["maidenname", "name"],
  ["fname", "name"],
  ["lname", "name"],
  // medical record number
  ["mrn", "mrn"],
  ["medicalrecordnumber", "mrn"],
  ["medicalrecordno", "mrn"],
  // date of birth
  ["dob", "date"],
  ["dateofbirth", "date"],
  ["birthdate", "date"],
  // address
  ["address", "address"],
  ["streetaddress", "address"],
  ["homeaddress", "address"],
  ["mailingaddress", "address"],
  ["street", "address"],
  ["ipaddress", "address"],
  // phone / fax
  ["phone", "phone"],
  ["phonenumber", "phone"],
  ["telephone", "phone"],
  ["fax", "phone"],
  ["faxnumber", "phone"],
  // email
  ["email", "email"],
  ["emailaddress", "email"],
  // ssn
  ["ssn", "ssn"],
  ["socialsecuritynumber", "ssn"],
  ["socialsecurity", "ssn"],
  // insurance / account identifiers
  ["insuranceid", "insurance_id"],
  ["memberid", "insurance_id"],
  ["beneficiaryid", "insurance_id"],
  ["subscriberid", "insurance_id"],
  ["healthplanid", "insurance_id"],
  ["policynumber", "insurance_id"],
  ["accountnumber", "insurance_id"],
]);

/** A single phi-lint failure. */
export interface PhiLintViolation {
  /** Tool whose schema contains the offending field. */
  tool: string;
  /** Dotted path to the field, e.g. "filters.patient_name". */
  field: string;
  /** Which PHI category the field name resembles. */
  category: string;
  /** Human-readable explanation. */
  reason: string;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Classify a single field name; returns the PHI category it resembles, or `null`. */
export function classifyPhiField(name: string): string | null {
  const norm = normalize(name);
  const direct = FORBIDDEN.get(norm);
  if (direct) return direct;
  // A `patient`-prefixed field is a patient identifier by construction.
  if (norm.startsWith("patient") && norm !== "patients") return "name";
  return null;
}

/** Lint a flat list of field names for one tool. */
export function phiLintFieldNames(
  tool: string,
  fieldNames: string[],
  pathPrefix = "",
): PhiLintViolation[] {
  const violations: PhiLintViolation[] = [];
  for (const name of fieldNames) {
    const category = classifyPhiField(name);
    if (!category) continue;
    const field = pathPrefix ? `${pathPrefix}.${name}` : name;
    violations.push({
      tool,
      field,
      category,
      reason: `field "${field}" is PHI-shaped (resembles a ${category} identifier). Tool inputs must not accept patient identifiers — the MCP is a reference-lookup layer (ARCHITECTURE.md §3.5.1).`,
    });
  }
  return violations;
}

/** Peel optional/nullable/default/effects/array wrappers to the inner schema. */
function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: z.ZodTypeAny = schema;
  for (;;) {
    if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
      s = s.unwrap();
    } else if (s instanceof z.ZodDefault) {
      s = s._def.innerType;
    } else if (s instanceof z.ZodEffects) {
      s = s._def.schema;
    } else if (s instanceof z.ZodArray) {
      s = s.element;
    } else {
      return s;
    }
  }
}

/** Recursively lint a Zod object schema (descends into nested object fields). */
export function phiLintZodObject(
  tool: string,
  schema: z.ZodObject<z.ZodRawShape>,
  pathPrefix = "",
): PhiLintViolation[] {
  const violations: PhiLintViolation[] = [];
  const shape = schema.shape;
  for (const key of Object.keys(shape)) {
    violations.push(...phiLintFieldNames(tool, [key], pathPrefix));
    const inner = unwrap(shape[key] as z.ZodTypeAny);
    if (inner instanceof z.ZodObject) {
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      violations.push(...phiLintZodObject(tool, inner as z.ZodObject<z.ZodRawShape>, childPath));
    }
  }
  return violations;
}

/**
 * Thrown when phi-lint finds a violation at server startup. Fail-loud: a
 * PHI-shaped tool input must never reach a running server.
 */
export class PhiLintError extends Error {
  readonly violations: PhiLintViolation[];

  constructor(violations: PhiLintViolation[]) {
    super(
      `phi-lint failed — ${violations.length} PHI-shaped tool input field(s):\n${violations
        .map((v) => `  - [${v.tool}] ${v.reason}`)
        .join("\n")}`,
    );
    this.name = "PhiLintError";
    this.violations = violations;
  }
}
