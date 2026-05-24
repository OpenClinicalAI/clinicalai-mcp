/**
 * Combine the atomic, composite, and USPSTF tools into one list for the server.
 */

import type { ToolDef } from "@openclinicalai/shared";
import { atomicEvidenceTools } from "./tools/atomic.js";
import { compositeEvidenceTools } from "./tools/composite.js";
import { uspstfTools } from "./tools/uspstf.js";

export function evidenceTools(): ToolDef[] {
  return [...atomicEvidenceTools, ...compositeEvidenceTools, ...uspstfTools];
}

export { atomicEvidenceTools, compositeEvidenceTools, uspstfTools };
