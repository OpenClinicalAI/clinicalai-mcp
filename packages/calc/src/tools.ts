/**
 * Assembles every `@openclinicalai/calc` tool: one tool per calculator plus the
 * two discovery tools. The shared meta tools are mounted by the server scaffold.
 */

import type { ToolDef } from "@openclinicalai/shared";
import { discoveryTools } from "./discovery.js";
import { calcToolDef } from "./framework.js";
import { ALL_CALCULATORS } from "./registry.js";

/** All domain tools exposed by the calc server. */
export function calcTools(): ToolDef[] {
  return [...ALL_CALCULATORS.map(calcToolDef), ...discoveryTools()];
}
