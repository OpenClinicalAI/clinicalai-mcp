/**
 * The built-in `regex` redaction backend plus the shared span primitives
 * (`dedupeSpans`, `applyRedactionSpans`) reused by every other backend.
 * See ARCHITECTURE.md §3.5.4.
 */

import type { PhiCategory, RedactionBackend, RedactionSpan } from "../types.js";
import { ALL_PHI_CATEGORIES, phiPatterns } from "./patterns.js";

/** Output of any redaction backend. */
export interface RedactionResult {
  /** The input text with every detected span replaced by a `[REDACTED:CATEGORY]` token. */
  redacted_text: string;
  /** Every span that was redacted, in document order. */
  spans: RedactionSpan[];
  /** Which backend produced this result. */
  backend_used: RedactionBackend;
  /** Soft signals — e.g. the regex backend's honest note about name recall. */
  warnings: string[];
}

/** The token a redacted span is replaced with. */
export function redactionPlaceholder(category: PhiCategory): string {
  return `[REDACTED:${category.toUpperCase()}]`;
}

/**
 * Sort spans into document order and drop any span that overlaps an
 * already-accepted one (longest-match-first within a start position).
 * The result is safe to hand to {@link applyRedactionSpans}.
 */
export function dedupeSpans(spans: RedactionSpan[]): RedactionSpan[] {
  const sorted = [...spans]
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const accepted: RedactionSpan[] = [];
  let lastEnd = -1;
  for (const span of sorted) {
    if (span.start >= lastEnd) {
      accepted.push(span);
      lastEnd = span.end;
    }
  }
  return accepted;
}

/**
 * Replace each span with its `[REDACTED:CATEGORY]` placeholder. Spans must be
 * deduped and in document order — pass them through {@link dedupeSpans} first.
 */
export function applyRedactionSpans(text: string, spans: RedactionSpan[]): string {
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += text.slice(cursor, span.start) + redactionPlaceholder(span.category);
    cursor = span.end;
  }
  return out + text.slice(cursor);
}

/** Run every requested regex pattern and collect raw (possibly overlapping) spans. */
function detectRegexSpans(text: string, categories: PhiCategory[]): RedactionSpan[] {
  const wanted = new Set(categories);
  const raw: RedactionSpan[] = [];

  for (const { category, regex } of phiPatterns()) {
    if (!wanted.has(category)) continue;
    regex.lastIndex = 0;
    for (let m = regex.exec(text); m !== null; m = regex.exec(text)) {
      const value = m[0];
      if (value.length === 0) {
        regex.lastIndex++; // guard against zero-width matches
        continue;
      }
      raw.push({ start: m.index, end: m.index + value.length, category, text: value });
    }
  }
  return raw;
}

/**
 * Redact PHI from `text` using deterministic regex patterns.
 *
 * @param text       the input string
 * @param categories which PHI categories to redact (default: all)
 */
export function regexRedact(
  text: string,
  categories: PhiCategory[] = ALL_PHI_CATEGORIES,
): RedactionResult {
  const spans = dedupeSpans(detectRegexSpans(text, categories));

  const warnings: string[] = [];
  if (categories.includes("name")) {
    warnings.push(
      "regex backend: name-redaction recall is the weak point — only honorific-prefixed names and a curated common-name list are detected. For clinical narratives, use the `foundation` backend.",
    );
  }

  return {
    redacted_text: applyRedactionSpans(text, spans),
    spans,
    backend_used: "regex",
    warnings,
  };
}
