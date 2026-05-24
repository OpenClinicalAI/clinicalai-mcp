/**
 * @openclinicalai/calc — public API.
 *
 * Pure-compute clinical calculators (ARCHITECTURE.md §5.3). The server itself is
 * launched via the `clinicalai-mcp-calc` bin (see `cli.ts`).
 */

export { cardiologyCalculators } from "./calculators/cardiology.js";
export { compositeCalculators } from "./calculators/composite.js";
export { criticalCareCalculators } from "./calculators/critical-care.js";
export { pulmonaryVteCalculators } from "./calculators/pulmonary-vte.js";
export { renalCalculators } from "./calculators/renal.js";
export { discoveryTools } from "./discovery.js";
export {
  type CalcInterpretation,
  type CalcResult,
  calcToolDef,
  type CalculatorDef,
  type CalculatorDomain,
  defineCalculator,
  rangePoints,
} from "./framework.js";
export { ALL_CALCULATORS, getCalculator } from "./registry.js";
export { calcTools } from "./tools.js";
