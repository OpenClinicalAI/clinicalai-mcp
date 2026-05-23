import { describe, expect, it } from "vitest";
import { type RedactionSpan, evaluateRedaction } from "../src/index.js";

const span = (start: number, end: number): RedactionSpan => ({
  start,
  end,
  category: "name",
});

describe("evaluateRedaction", () => {
  it("scores a perfect prediction as precision/recall/f1 = 1", () => {
    const e = evaluateRedaction([span(0, 5)], [span(0, 5)]);
    expect(e.precision).toBe(1);
    expect(e.recall).toBe(1);
    expect(e.f1).toBe(1);
    expect(e.false_positives).toEqual([]);
    expect(e.false_negatives).toEqual([]);
  });

  it("counts a missed ground-truth span as a false negative (recall < 1)", () => {
    const e = evaluateRedaction([], [span(0, 5)]);
    expect(e.recall).toBe(0);
    expect(e.false_negatives).toHaveLength(1);
    expect(e.true_positives).toBe(0);
  });

  it("counts an unmatched prediction as a false positive (precision < 1)", () => {
    const e = evaluateRedaction([span(0, 5), span(10, 15)], [span(0, 5)]);
    expect(e.precision).toBe(0.5);
    expect(e.recall).toBe(1);
    expect(e.false_positives).toEqual([span(10, 15)]);
  });

  it("treats any character overlap as a match", () => {
    const e = evaluateRedaction([span(0, 10)], [span(2, 6)]);
    expect(e.precision).toBe(1);
    expect(e.recall).toBe(1);
  });

  it("scores two empty span sets as a perfect match", () => {
    const e = evaluateRedaction([], []);
    expect(e.precision).toBe(1);
    expect(e.recall).toBe(1);
    expect(e.f1).toBe(1);
  });
});
