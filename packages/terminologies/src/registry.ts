/**
 * Combine the atomic, UMLS-stub, and composite tools into one list.
 *
 * USPSTF tools used to live here; they moved to @openclinicalai/evidence in
 * v0.1 because they're evidence-derived guidelines, not a code vocabulary.
 */

import type { ToolDef } from "@openclinicalai/shared";
import { compositeTerminologyTools } from "./tools/composite.js";
import { icd10LoincTools } from "./tools/icd10-loinc.js";
import { snomedUmlsTools } from "./tools/snomed.js";

export function terminologyTools(): ToolDef[] {
  return [...icd10LoincTools, ...snomedUmlsTools, ...compositeTerminologyTools];
}

export { compositeTerminologyTools, icd10LoincTools, snomedUmlsTools };
