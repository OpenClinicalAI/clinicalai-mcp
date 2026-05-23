/**
 * The built-in `regex` backend — deterministic, fast, no network, no model.
 * The detection logic lives in `../redact.ts`.
 */

import { regexRedact } from "../redact.js";
import type { RedactionBackendImpl } from "./registry.js";

export const regexBackend: RedactionBackendImpl = {
  name: "regex",
  redact: (text, categories) => regexRedact(text, categories),
};
