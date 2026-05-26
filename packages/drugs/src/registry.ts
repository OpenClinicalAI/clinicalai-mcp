/**
 * Combine the atomic, composite, and dosing drug tools into one list for the server.
 */

import type { ToolDef } from "@openclinicalai/shared";
import { atomicDrugTools } from "./tools/atomic.js";
import { compositeDrugTools } from "./tools/composite.js";
import { dosingDrugTools } from "./tools/dosing.js";

export function drugTools(): ToolDef[] {
  return [...atomicDrugTools, ...compositeDrugTools, ...dosingDrugTools];
}

export { atomicDrugTools, compositeDrugTools, dosingDrugTools };
