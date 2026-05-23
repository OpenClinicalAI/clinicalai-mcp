/**
 * The calculator framework — the shared shape every clinical calculator in this
 * package conforms to, plus helpers for turning a calculator into an MCP tool.
 *
 * Each calculator is a pure function of clinical values (no external API, no
 * rate limits, no PHI). Every result is `tier: "compute"` and cites the primary
 * literature the formula comes from (ARCHITECTURE.md §3.2, §5.3).
 */

import { type Source, type ToolDef, type ToolResult, makeResult } from "@clinical-mcp/shared";
import { z } from "zod";

/** Domains used to group calculators for `list_calculators`. */
export type CalculatorDomain =
  | "renal-metabolic"
  | "cardiology"
  | "pulmonary-vte"
  | "critical-care"
  | "composite";

/** The clinician-facing reading of a calculator's numeric output. */
export interface CalcInterpretation {
  /** Short band label, e.g. "intermediate risk", "CKD stage G3a". */
  band: string;
  /** Clinician-facing interpretive sentence(s). Subject to the §9 clinician-review gate. */
  detail: string;
}

/**
 * The payload every calculator returns. The original citation travels in the
 * enclosing `ToolResult.sources` (ARCHITECTURE.md §5.3).
 */
export interface CalcResult {
  /** The numeric output (score, clearance, eGFR, …). */
  result: number;
  /** Unit of `result` — e.g. "points", "mL/min", "mL/min/1.73m²". */
  unit: string;
  interpretation: CalcInterpretation;
  /** Additive-score breakdown, when the score is a sum of components. */
  breakdown?: { component: string; value: number }[];
  /** The inputs as received, echoed for auditing. */
  inputs: Record<string, unknown>;
  /** Soft signals — formula caveats, "estimate only", superseded-equation notes. */
  warnings?: string[];
}

/** A calculator definition: schema + pure compute function + provenance. */
export interface CalculatorDef {
  /** Tool name, e.g. "calc_creatinine_clearance". */
  name: string;
  /** Human-readable title, e.g. "Creatinine Clearance (Cockcroft-Gault)". */
  title: string;
  domain: CalculatorDomain;
  /** Tool description advertised to the MCP host. */
  description: string;
  /** Zod raw shape for the inputs. */
  inputSchema: z.ZodRawShape;
  /** Primary-literature (and OSS reference) citations for the formula. */
  sources: Source[];
  /** Pure compute function. Receives args already validated against `inputSchema`. */
  compute: (args: Record<string, unknown>) => CalcResult;
}

/**
 * Authoring helper: keeps `compute`'s `args` strongly typed against the schema
 * while the stored `CalculatorDef` stays loosely typed for heterogeneous arrays.
 */
export function defineCalculator<TShape extends z.ZodRawShape>(def: {
  name: string;
  title: string;
  domain: CalculatorDomain;
  description: string;
  inputSchema: TShape;
  sources: Source[];
  compute: (args: z.infer<z.ZodObject<TShape>>) => CalcResult;
}): CalculatorDef {
  return def as unknown as CalculatorDef;
}

/** Convert a calculator into a shared `ToolDef` (validates input, wraps the result). */
export function calcToolDef(def: CalculatorDef): ToolDef {
  const schema = z.object(def.inputSchema);
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    handler: (args): Promise<ToolResult<unknown>> => {
      const parsed = schema.parse(args) as Record<string, unknown>;
      const result = def.compute(parsed);
      return Promise.resolve(
        makeResult({
          data: result,
          sources: def.sources,
          tier: "compute",
          warnings: result.warnings,
        }),
      );
    },
  };
}

/**
 * Look up additive points from an ascending range table. Each entry's `upTo`
 * is an inclusive upper bound; the final entry should use `Number.POSITIVE_INFINITY`.
 */
export function rangePoints(value: number, ranges: { upTo: number; points: number }[]): number {
  for (const range of ranges) {
    if (value <= range.upTo) return range.points;
  }
  return ranges[ranges.length - 1]?.points ?? 0;
}

/** Sum a list of `{ component, value }` breakdown rows. */
export function sumBreakdown(breakdown: { component: string; value: number }[]): number {
  return breakdown.reduce((total, row) => total + row.value, 0);
}
