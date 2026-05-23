/**
 * Combine the atomic, UMLS-stub, USPSTF, and composite tools into one list.
 */

import type { ToolDef } from "@clinical-mcp/shared";
import { compositeTerminologyTools } from "./tools/composite.js";
import { icd10LoincTools } from "./tools/icd10-loinc.js";
import { snomedUmlsTools } from "./tools/snomed.js";
import { uspstfTools } from "./tools/uspstf.js";

export function terminologyTools(): ToolDef[] {
  return [...icd10LoincTools, ...snomedUmlsTools, ...uspstfTools, ...compositeTerminologyTools];
}

export { compositeTerminologyTools, icd10LoincTools, snomedUmlsTools, uspstfTools };
