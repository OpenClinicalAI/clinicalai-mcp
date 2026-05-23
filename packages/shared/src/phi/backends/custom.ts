/**
 * The `custom` backend — loads a user-provided JS module so an org can plug in
 * its own internal redactor without forking (ARCHITECTURE.md §3.5.4).
 *
 * The module at `phi_redaction.custom.module_path` must export a function:
 *   redact(text: string, categories: PhiCategory[])
 *     → { spans: RedactionSpan[]; warnings?: string[] }  (sync or async)
 *
 * As with the `foundation` backend, the redacted text is reconstructed locally
 * from the returned spans, so a custom module only has to do detection.
 */

import { pathToFileURL } from "node:url";
import { ClinicalMcpError } from "../../results.js";
import type { PhiCategory, RedactionSpan } from "../../types.js";
import { ALL_PHI_CATEGORIES } from "../patterns.js";
import { applyRedactionSpans, dedupeSpans } from "../redact.js";
import type { RedactionBackendImpl } from "./registry.js";

interface CustomRedactOutput {
  spans?: unknown;
  warnings?: unknown;
}

type CustomRedactFn = (
  text: string,
  categories: PhiCategory[],
) => CustomRedactOutput | Promise<CustomRedactOutput>;

export const customBackend: RedactionBackendImpl = {
  name: "custom",
  async redact(text, categories, config) {
    const cc = config.custom;
    if (!cc?.module_path) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "phi_redaction.backend is 'custom' but no `custom.module_path` is configured.",
      );
    }

    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(cc.module_path).href)) as Record<string, unknown>;
    } catch (err) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        `could not load custom redaction module "${cc.module_path}": ${(err as Error).message}`,
      );
    }

    const exported = mod.redact ?? (mod.default as Record<string, unknown> | undefined)?.redact;
    if (typeof exported !== "function") {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        `custom redaction module "${cc.module_path}" must export a \`redact\` function.`,
      );
    }

    const output = await (exported as CustomRedactFn)(text, categories);
    const validCategory = new Set<string>(ALL_PHI_CATEGORIES);
    const wanted = new Set(categories);

    const raw: RedactionSpan[] = [];
    for (const entry of Array.isArray(output?.spans) ? output.spans : []) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const { start, end, category } = e;
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      if (typeof category !== "string" || !validCategory.has(category)) continue;
      if (!wanted.has(category as PhiCategory)) continue;
      const s = Math.max(0, Math.min(start as number, text.length));
      const en = Math.max(0, Math.min(end as number, text.length));
      if (en <= s) continue;
      raw.push({ start: s, end: en, category: category as PhiCategory, text: text.slice(s, en) });
    }

    const spans = dedupeSpans(raw);
    const warnings = Array.isArray(output?.warnings)
      ? output.warnings.filter((w): w is string => typeof w === "string")
      : [];
    return {
      redacted_text: applyRedactionSpans(text, spans),
      spans,
      backend_used: "custom",
      warnings,
    };
  },
};
