/**
 * Scoring for `evaluate_redaction` (ARCHITECTURE.md §5.0): grade a backend's
 * predicted spans against a labeled ground-truth set so backend selection is
 * data-driven, not vibes.
 *
 * Matching is **character-overlap, category-agnostic**: a predicted span counts
 * as a hit if it overlaps any ground-truth span by ≥1 character. For redaction
 * the question is "was the PHI covered", not "was it labeled with exactly the
 * right category", so position is what's scored.
 */

import type { RedactionSpan } from "../types.js";

export interface RedactionEvaluation {
  precision: number;
  recall: number;
  f1: number;
  /** Ground-truth spans that were covered by ≥1 predicted span. */
  true_positives: number;
  /** Predicted spans that overlapped no ground-truth span (over-redaction). */
  false_positives: RedactionSpan[];
  /** Ground-truth spans no predicted span covered (leaked PHI). */
  false_negatives: RedactionSpan[];
}

function overlaps(a: RedactionSpan, b: RedactionSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Compute precision / recall / F1 of `predicted` spans against `groundTruth`. */
export function evaluateRedaction(
  predicted: RedactionSpan[],
  groundTruth: RedactionSpan[],
): RedactionEvaluation {
  const falsePositives = predicted.filter((p) => !groundTruth.some((g) => overlaps(p, g)));
  const falseNegatives = groundTruth.filter((g) => !predicted.some((p) => overlaps(p, g)));

  const matchedPredicted = predicted.length - falsePositives.length;
  const matchedGroundTruth = groundTruth.length - falseNegatives.length;

  // With no predictions there are no false positives → precision is 1 by convention;
  // with nothing to find, recall is 1.
  const precision = predicted.length > 0 ? matchedPredicted / predicted.length : 1;
  const recall = groundTruth.length > 0 ? matchedGroundTruth / groundTruth.length : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision,
    recall,
    f1,
    true_positives: matchedGroundTruth,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
  };
}
