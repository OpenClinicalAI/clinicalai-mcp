/**
 * PHI redaction module entrypoint. See ARCHITECTURE.md §3.5.4.
 *
 * `redactWithBackend` is the single dispatch point used by both the per-call
 * `sensitive`-mode pipeline and the explicit `redact_phi` meta tool, so the
 * redaction logic stays shared. Importing this module registers every backend.
 */

import type { PhiCategory, RedactionConfig } from "../types.js";
import { getRedactionBackend } from "./backends/index.js";
import { ALL_PHI_CATEGORIES } from "./patterns.js";
import type { RedactionResult } from "./redact.js";

export {
  availableRedactionBackends,
  getRedactionBackend,
  type RedactionBackendImpl,
  registerRedactionBackend,
} from "./backends/index.js";
export { evaluateRedaction, type RedactionEvaluation } from "./evaluate.js";
export { ALL_PHI_CATEGORIES } from "./patterns.js";
export {
  loadFoundationPrompt,
  loadSafeHarborPrompt,
  safeHarborPromptPath,
} from "./prompt-loader.js";
export {
  applyRedactionSpans,
  dedupeSpans,
  redactionPlaceholder,
  type RedactionResult,
  regexRedact,
} from "./redact.js";

/**
 * Redact `text` using the backend named by `config.backend`.
 *
 * @param categories optional override of which categories to redact; falls
 *                   back to `config.regex.categories`, then to all categories.
 */
export async function redactWithBackend(
  text: string,
  config: RedactionConfig,
  categories?: PhiCategory[],
): Promise<RedactionResult> {
  const backend = getRedactionBackend(config.backend);
  const cats = categories ?? config.regex?.categories ?? ALL_PHI_CATEGORIES;
  return backend.redact(text, cats, config);
}
