/**
 * Combine the atomic and composite drug tools into one list for the server.
 */

import type { ToolDef } from "@openclinicalai/shared";
import { atomicDrugTools } from "./tools/atomic.js";
import { compositeDrugTools } from "./tools/composite.js";

export function drugTools(): ToolDef[] {
  return [...atomicDrugTools, ...compositeDrugTools];
}

export { atomicDrugTools, compositeDrugTools };
