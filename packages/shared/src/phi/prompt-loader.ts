/**
 * Loads the redaction prompt for the `foundation` backend.
 *
 * Open-source prompt content is part of this project's transparency commitment
 * (ARCHITECTURE.md §3.5.4): every model invocation has its prompt published.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ClinicalMcpError } from "../results.js";
import type { RedactionConfig } from "../types.js";

/**
 * Absolute path to the verbatim HIPAA Safe Harbor prompt template
 * (`prompts/safe_harbor.md`). Resolved relative to this module so it works
 * from both the bundle (`dist/`) and source.
 */
export function safeHarborPromptPath(): string {
  return fileURLToPath(new URL("./prompts/safe_harbor.md", import.meta.url));
}

/** Read the verbatim Safe Harbor prompt template. */
export function loadSafeHarborPrompt(): string {
  return readFileSync(safeHarborPromptPath(), "utf8");
}

/**
 * Resolve the system prompt for a `foundation` backend config: either the
 * built-in verbatim Safe Harbor template or a user-supplied custom prompt.
 */
export function loadFoundationPrompt(config: RedactionConfig): string {
  const fc = config.foundation;
  if (!fc) {
    throw ClinicalMcpError.of(
      "INVALID_INPUT",
      "phi_redaction.backend is 'foundation' but no `foundation` config block is present.",
      { suggestion: "Add a phi_redaction.foundation block to the deployment policy." },
    );
  }
  if (fc.prompt_template === "custom") {
    if (!fc.custom_prompt_path) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "foundation.prompt_template is 'custom' but foundation.custom_prompt_path is not set.",
      );
    }
    try {
      return readFileSync(fc.custom_prompt_path, "utf8");
    } catch (err) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        `Could not read foundation.custom_prompt_path "${fc.custom_prompt_path}": ${(err as Error).message}`,
      );
    }
  }
  return loadSafeHarborPrompt();
}
