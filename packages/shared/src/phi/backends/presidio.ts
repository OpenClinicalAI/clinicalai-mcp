/**
 * The `presidio` backend — a thin wrapper around a Microsoft Presidio Analyzer
 * sidecar (ARCHITECTURE.md §3.5.4). This package does not bundle the Python
 * runtime: the user stands up their own Presidio container and points
 * `phi_redaction.presidio.url` at it.
 *
 * Wire contract — Presidio Analyzer's standard endpoint:
 *   POST {url}/analyze   {"text": "...", "language": "en"}
 *   → [{ "entity_type": "PERSON", "start": 0, "end": 9, "score": 0.85 }, ...]
 */

import { ClinicalMcpError } from "../../results.js";
import type { PhiCategory, RedactionSpan } from "../../types.js";
import { applyRedactionSpans, dedupeSpans } from "../redact.js";
import type { RedactionBackendImpl } from "./registry.js";

/** Presidio `entity_type` → clinical-mcp PHI category. Unmapped types are dropped. */
const PRESIDIO_CATEGORY: Record<string, PhiCategory> = {
  PERSON: "name",
  PHONE_NUMBER: "phone",
  EMAIL_ADDRESS: "email",
  US_SSN: "ssn",
  LOCATION: "address",
  IP_ADDRESS: "address",
  URL: "address",
  DATE_TIME: "date",
  US_DRIVER_LICENSE: "insurance_id",
  US_PASSPORT: "insurance_id",
  US_BANK_NUMBER: "insurance_id",
  US_ITIN: "insurance_id",
  MEDICAL_LICENSE: "insurance_id",
  IBAN_CODE: "insurance_id",
  CRYPTO: "insurance_id",
};

interface PresidioResult {
  entity_type: string;
  start: number;
  end: number;
}

export const presidioBackend: RedactionBackendImpl = {
  name: "presidio",
  async redact(text, categories, config) {
    const pc = config.presidio;
    if (!pc?.url) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "phi_redaction.backend is 'presidio' but no `presidio.url` is configured.",
        { suggestion: "Stand up a Presidio Analyzer sidecar and set phi_redaction.presidio.url." },
      );
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = pc.api_key_env ? process.env[pc.api_key_env] : undefined;
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    let resp: Response;
    try {
      resp = await fetch(`${pc.url.replace(/\/$/, "")}/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, language: "en" }),
      });
    } catch (err) {
      throw ClinicalMcpError.of(
        "UPSTREAM_UNAVAILABLE",
        `presidio sidecar was unreachable: ${(err as Error).message}`,
        { upstream: { service: "presidio" } },
      );
    }
    if (!resp.ok) {
      throw ClinicalMcpError.of(
        "UPSTREAM_UNAVAILABLE",
        `presidio sidecar returned HTTP ${resp.status}.`,
        { upstream: { service: "presidio", status: resp.status } },
      );
    }

    const results = (await resp.json()) as PresidioResult[];
    const wanted = new Set(categories);
    const raw: RedactionSpan[] = [];
    for (const r of Array.isArray(results) ? results : []) {
      const category = PRESIDIO_CATEGORY[r.entity_type];
      if (!category || !wanted.has(category)) continue;
      if (!Number.isInteger(r.start) || !Number.isInteger(r.end) || r.end <= r.start) continue;
      raw.push({ start: r.start, end: r.end, category, text: text.slice(r.start, r.end) });
    }

    const spans = dedupeSpans(raw);
    return {
      redacted_text: applyRedactionSpans(text, spans),
      spans,
      backend_used: "presidio",
      warnings: [
        "presidio backend: recall depends entirely on the sidecar's recognizer configuration; Presidio's default stack underperforms on clinical narratives — validate with evaluate_redaction.",
      ],
    };
  },
};
