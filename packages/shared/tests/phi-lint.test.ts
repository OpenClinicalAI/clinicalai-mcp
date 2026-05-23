import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PhiLintError, classifyPhiField, phiLintZodObject } from "../src/phi-lint.js";

describe("classifyPhiField", () => {
  it("flags unambiguous PHI field names", () => {
    expect(classifyPhiField("patient_name")).toBe("name");
    expect(classifyPhiField("first_name")).toBe("name");
    expect(classifyPhiField("mrn")).toBe("mrn");
    expect(classifyPhiField("date_of_birth")).toBe("date");
    expect(classifyPhiField("ssn")).toBe("ssn");
    expect(classifyPhiField("email")).toBe("email");
    expect(classifyPhiField("home_address")).toBe("address");
    expect(classifyPhiField("insurance_id")).toBe("insurance_id");
  });

  it("flags any patient-prefixed field", () => {
    expect(classifyPhiField("patient_id")).toBe("name");
    expect(classifyPhiField("patientIdentifier")).toBe("name");
  });

  it("does not flag legitimate generic field names", () => {
    expect(classifyPhiField("query")).toBeNull();
    expect(classifyPhiField("drug_name")).toBeNull();
    expect(classifyPhiField("name")).toBeNull(); // e.g. describe_calculator(name)
    expect(classifyPhiField("date_from")).toBeNull(); // e.g. an evidence query window
    expect(classifyPhiField("rxcui")).toBeNull();
    expect(classifyPhiField("age_y")).toBeNull();
    expect(classifyPhiField("limit")).toBeNull();
  });
});

describe("phiLintZodObject", () => {
  it("passes a clean tool schema", () => {
    const schema = z.object({
      query: z.string(),
      limit: z.number().optional(),
      verbose: z.boolean().optional(),
    });
    expect(phiLintZodObject("search_drugs", schema)).toEqual([]);
  });

  it("rejects a PHI-shaped top-level field", () => {
    const schema = z.object({ patient_name: z.string(), query: z.string() });
    const violations = phiLintZodObject("bad_tool", schema);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.field).toBe("patient_name");
    expect(violations[0]?.category).toBe("name");
  });

  it("descends into nested object fields", () => {
    const schema = z.object({
      filters: z.object({ mrn: z.string(), status: z.string() }).optional(),
    });
    const violations = phiLintZodObject("nested_tool", schema);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.field).toBe("filters.mrn");
  });

  it("descends through array element schemas", () => {
    const schema = z.object({
      records: z.array(z.object({ dob: z.string() })),
    });
    const violations = phiLintZodObject("array_tool", schema);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.field).toBe("records.dob");
  });
});

describe("PhiLintError", () => {
  it("summarizes every violation in its message", () => {
    const err = new PhiLintError([
      { tool: "t", field: "ssn", category: "ssn", reason: 'field "ssn" is PHI-shaped' },
    ]);
    expect(err.message).toContain("phi-lint failed");
    expect(err.message).toContain("ssn");
    expect(err.violations).toHaveLength(1);
  });
});
