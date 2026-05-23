import { describe, expect, it } from "vitest";
import {
  ClinicalMcpError,
  type RedactionBackend,
  availableRedactionBackends,
  getRedactionBackend,
  redactWithBackend,
  regexRedact,
} from "../src/index.js";

describe("regexRedact", () => {
  it("redacts an email address", () => {
    const r = regexRedact("Contact john.doe@example.com for details.");
    expect(r.redacted_text).toContain("[REDACTED:EMAIL]");
    expect(r.redacted_text).not.toContain("john.doe@example.com");
    expect(r.spans.some((s) => s.category === "email")).toBe(true);
  });

  it("redacts an SSN", () => {
    const r = regexRedact("SSN 123-45-6789 on file.");
    expect(r.redacted_text).toContain("[REDACTED:SSN]");
    expect(r.spans.find((s) => s.category === "ssn")?.text).toBe("123-45-6789");
  });

  it("redacts a phone number without misclassifying it as an SSN", () => {
    const r = regexRedact("Call 555-123-4567 to reschedule.");
    expect(r.redacted_text).toContain("[REDACTED:PHONE]");
    expect(r.spans.some((s) => s.category === "ssn")).toBe(false);
  });

  it("redacts a numeric date but leaves a bare year alone", () => {
    const withDate = regexRedact("Admitted 03/14/2021.");
    expect(withDate.redacted_text).toContain("[REDACTED:DATE]");

    const yearOnly = regexRedact("Guideline updated in 2021.");
    expect(yearOnly.spans).toHaveLength(0);
  });

  it("redacts a label-prefixed MRN", () => {
    const r = regexRedact("MRN: AB123456 admitted today.");
    expect(r.redacted_text).toContain("[REDACTED:MRN]");
  });

  it("redacts an honorific-prefixed name", () => {
    const r = regexRedact("Dr. Smith reviewed the chart.");
    expect(r.spans.some((s) => s.category === "name")).toBe(true);
  });

  it("does not shred clinical values", () => {
    const r = regexRedact("Start metformin 500 mg twice daily; CrCl 72 mL/min.");
    expect(r.spans).toHaveLength(0);
    expect(r.redacted_text).toBe("Start metformin 500 mg twice daily; CrCl 72 mL/min.");
  });

  it("honors a category filter", () => {
    const r = regexRedact("a@b.com and 123-45-6789", ["email"]);
    expect(r.redacted_text).toContain("[REDACTED:EMAIL]");
    expect(r.redacted_text).toContain("123-45-6789");
  });

  it("warns honestly about name-redaction recall", () => {
    const r = regexRedact("some text", ["name"]);
    expect(r.warnings.some((w) => w.includes("recall"))).toBe(true);
  });
});

describe("redaction backends", () => {
  it("dispatches to the regex backend via redactWithBackend", async () => {
    const r = await redactWithBackend("email me at x@y.com", { backend: "regex" });
    expect(r.backend_used).toBe("regex");
    expect(r.redacted_text).toContain("[REDACTED:EMAIL]");
  });

  it("registers all six backends from ARCHITECTURE.md §3.5.4", () => {
    expect(availableRedactionBackends().sort()).toEqual([
      "custom",
      "ensemble",
      "foundation",
      "openmed",
      "presidio",
      "regex",
    ]);
  });

  it("fails loudly for an unregistered backend name", () => {
    try {
      getRedactionBackend("bogus" as RedactionBackend);
      throw new Error("expected getRedactionBackend to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ClinicalMcpError);
      expect((err as ClinicalMcpError).payload.code).toBe("INVALID_INPUT");
    }
  });
});
