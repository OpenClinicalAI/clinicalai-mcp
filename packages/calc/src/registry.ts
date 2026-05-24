/**
 * The full calculator registry for `@openclinicalai/calc`.
 */

import { cardiologyCalculators } from "./calculators/cardiology.js";
import { compositeCalculators } from "./calculators/composite.js";
import { criticalCareCalculators } from "./calculators/critical-care.js";
import { pulmonaryVteCalculators } from "./calculators/pulmonary-vte.js";
import { renalCalculators } from "./calculators/renal.js";
import type { CalculatorDef } from "./framework.js";

/** Every calculator this server exposes — atomic and composite. */
export const ALL_CALCULATORS: CalculatorDef[] = [
  ...renalCalculators,
  ...cardiologyCalculators,
  ...pulmonaryVteCalculators,
  ...criticalCareCalculators,
  ...compositeCalculators,
];

/** Look up a calculator by tool name. */
export function getCalculator(name: string): CalculatorDef | undefined {
  return ALL_CALCULATORS.find((calc) => calc.name === name);
}
