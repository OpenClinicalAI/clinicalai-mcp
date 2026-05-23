/**
 * The `openmed` backend — a thin wrapper around an OpenMed-NER sidecar
 * (ARCHITECTURE.md §3.5.4). As with `presidio`, this package does not bundle
 * the model runtime: the user runs their own container and points
 * `phi_redaction.openmed.url` at its inference endpoint.
 *
 * Wire contract — the configured `url` is the full inference endpoint:
 *   POST {url}   {"text": "..."}
 *   → either  [{ "start": 0, "end": 9, "label": "PATIENT" }, ...]
 *       or    {"entities": [{ "start": 0, "end": 9, "label": "PATIENT" }, ...]}
 *
 * `label` is matched case-insensitively against the keyword table below, so the
 * common label vocabularies of BioBERT-family clinical NER models map without
 * the user having to rename anything.
 */

import { ClinicalMcpError } from "../../results.js";
import type { PhiCategory, RedactionSpan } from "../../types.js";
import { applyRedactionSpans, dedupeSpans } from "../redact.js";
import type { RedactionBackendImpl } from "./registry.js";

/** Substring keywords (lowercased) mapped to a PHI category, checked in order. */
const LABEL_KEYWORDS: [string, PhiCategory][] = [
  ["mrn", "mrn"],
  ["record", "mrn"],
  ["email", "email"],
  ["phone", "phone"],
  ["fax", "phone"],
  ["contact", "phone"],
  ["ssn", "ssn"],
  ["social", "ssn"],
  ["dob", "date"],
  ["birth", "date"],
  ["date", "date"],
  ["age", "date"],
  ["address", "address"],
  ["street", "address"],
  ["location", "address"],
  ["city", "address"],
  ["zip", "address"],
  ["geo", "address"],
  ["url", "address"],
  ["ip", "address"],
  ["insurance", "insurance_id"],
  ["beneficiary", "insurance_id"],
  ["account", "insurance_id"],
  ["license", "insurance_id"],
  ["id", "insurance_id"],
  ["patient", "name"],
  ["name", "name"],
  ["person", "name"],
  ["doctor", "name"],
  ["staff", "name"],
];

function labelToCategory(label: string): PhiCategory | null {
  const l = label.toLowerCase();
  for (const [keyword, category] of LABEL_KEYWORDS) {
    if (l.includes(keyword)) return category;
  }
  return null;
}

interface OpenMedEntity {
  start: number;
  end: number;
  label?: string;
  entity_group?: string;
}

export const openmedBackend: RedactionBackendImpl = {
  name: "openmed",
  async redact(text, categories, config) {
    const oc = config.openmed;
    if (!oc?.url) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "phi_redaction.backend is 'openmed' but no `openmed.url` is configured.",
        { suggestion: "Stand up an OpenMed-NER sidecar and set phi_redaction.openmed.url." },
      );
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = oc.api_key_env ? process.env[oc.api_key_env] : undefined;
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    let resp: Response;
    try {
      resp = await fetch(oc.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      throw ClinicalMcpError.of(
        "UPSTREAM_UNAVAILABLE",
        `openmed sidecar was unreachable: ${(err as Error).message}`,
        { upstream: { service: "openmed" } },
      );
    }
    if (!resp.ok) {
      throw ClinicalMcpError.of(
        "UPSTREAM_UNAVAILABLE",
        `openmed sidecar returned HTTP ${resp.status}.`,
        { upstream: { service: "openmed", status: resp.status } },
      );
    }

    const body = (await resp.json()) as OpenMedEntity[] | { entities?: OpenMedEntity[] };
    const entities = Array.isArray(body) ? body : (body.entities ?? []);
    const wanted = new Set(categories);
    const raw: RedactionSpan[] = [];
    for (const e of entities) {
      const label = e.label ?? e.entity_group;
      if (!label) continue;
      const category = labelToCategory(label);
      if (!category || !wanted.has(category)) continue;
      if (!Number.isInteger(e.start) || !Number.isInteger(e.end) || e.end <= e.start) continue;
      raw.push({ start: e.start, end: e.end, category, text: text.slice(e.start, e.end) });
    }

    const spans = dedupeSpans(raw);
    return {
      redacted_text: applyRedactionSpans(text, spans),
      spans,
      backend_used: "openmed",
      warnings: [
        "openmed backend: BioBERT-family clinical NER models can fail to generalize outside their training corpora — validate against your own content with evaluate_redaction.",
      ],
    };
  },
};
