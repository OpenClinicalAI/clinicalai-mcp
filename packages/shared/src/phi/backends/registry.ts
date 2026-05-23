/**
 * Redaction-backend registry. ARCHITECTURE.md §3.5.4 specifies six backends:
 * regex, presidio, openmed, foundation, ensemble, custom.
 *
 * This module holds only the registry — it imports no backend implementation,
 * so backends (notably `ensemble`, which dispatches to others) can depend on it
 * without an import cycle.
 */

import { ClinicalMcpError } from "../../results.js";
import type { PhiCategory, RedactionBackend, RedactionConfig } from "../../types.js";
import type { RedactionResult } from "../redact.js";

/**
 * A pluggable redaction backend. `redact` may be sync or async; it receives the
 * full `RedactionConfig` so it can read its own per-backend config block.
 */
export interface RedactionBackendImpl {
  name: RedactionBackend;
  redact(
    text: string,
    categories: PhiCategory[],
    config: RedactionConfig,
  ): RedactionResult | Promise<RedactionResult>;
}

const registry = new Map<RedactionBackend, RedactionBackendImpl>();

/** Register (or replace) a redaction backend. */
export function registerRedactionBackend(impl: RedactionBackendImpl): void {
  registry.set(impl.name, impl);
}

/** Backends available in this build. */
export function availableRedactionBackends(): RedactionBackend[] {
  return [...registry.keys()];
}

/** Resolve a backend by name, or fail loudly with the available set. */
export function getRedactionBackend(name: RedactionBackend): RedactionBackendImpl {
  const impl = registry.get(name);
  if (!impl) {
    throw ClinicalMcpError.of("INVALID_INPUT", `Redaction backend "${name}" is not registered.`, {
      suggestion: `Available backends: ${availableRedactionBackends().join(", ") || "(none)"}.`,
    });
  }
  return impl;
}
