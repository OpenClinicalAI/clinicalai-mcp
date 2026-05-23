/**
 * The `ensemble` backend — runs several backends and combines their spans
 * (ARCHITECTURE.md §3.5.4):
 *   - `union`        — anything any backend flagged is redacted (most conservative;
 *                      the safe default for clinical use).
 *   - `intersection` — only spans every backend agreed on (most precise).
 */

import { ClinicalMcpError } from "../../results.js";
import type { RedactionSpan } from "../../types.js";
import { applyRedactionSpans, dedupeSpans } from "../redact.js";
import { type RedactionBackendImpl, getRedactionBackend } from "./registry.js";

function spansOverlap(a: RedactionSpan, b: RedactionSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

export const ensembleBackend: RedactionBackendImpl = {
  name: "ensemble",
  async redact(text, categories, config) {
    const ec = config.ensemble;
    if (!ec || !Array.isArray(ec.backends) || ec.backends.length === 0) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "phi_redaction.backend is 'ensemble' but `ensemble.backends` is empty or missing.",
      );
    }
    if (ec.backends.includes("ensemble")) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "an ensemble cannot include the `ensemble` backend itself.",
      );
    }

    const results = await Promise.all(
      ec.backends.map((name) =>
        Promise.resolve(getRedactionBackend(name).redact(text, categories, config)),
      ),
    );
    const spanLists = results.map((r) => r.spans);

    let combined: RedactionSpan[];
    if (ec.mode === "intersection") {
      // Keep a span from the first backend only if every other backend has a
      // span overlapping it.
      const [first = [], ...rest] = spanLists;
      combined = first.filter((s) => rest.every((other) => other.some((o) => spansOverlap(s, o))));
    } else {
      // union (default): everything any backend flagged.
      combined = spanLists.flat();
    }

    const spans = dedupeSpans(combined);
    return {
      redacted_text: applyRedactionSpans(text, spans),
      spans,
      backend_used: "ensemble",
      warnings: results.flatMap((r) => r.warnings),
    };
  },
};
