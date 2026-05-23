/**
 * Combine the atomic and composite evidence tools into one list for the server.
 */

import type { ToolDef } from "@clinical-mcp/shared";
import { atomicEvidenceTools } from "./tools/atomic.js";
import { compositeEvidenceTools } from "./tools/composite.js";

export function evidenceTools(): ToolDef[] {
  return [...atomicEvidenceTools, ...compositeEvidenceTools];
}

export { atomicEvidenceTools, compositeEvidenceTools };
