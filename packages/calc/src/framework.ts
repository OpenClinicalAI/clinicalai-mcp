/**
 * The calculator framework — the shared shape every clinical calculator in this
 * package conforms to, plus helpers for turning a calculator into an MCP tool.
 *
 * Each calculator is a pure function of clinical values (no external API, no
 * rate limits, no PHI). Every result is `tier: "compute"` and cites the primary
 * literature the formula comes from (ARCHITECTURE.md §3.2, §5.3).
 *
 * Implementation patterns (`complexity` field on every CalculatorDef):
 *
 *   - `formula`     — a single arithmetic expression (e.g. Cockcroft-Gault).
 *   - `lookup`      — additive points by component (e.g. CHA₂DS₂-VASc, HAS-BLED).
 *   - `tree`        — rule-cascade criteria producing a categorical classification
 *                     (e.g. Berlin ARDS severity, Duke endocarditis criteria).
 *                     Output `result` is a string, not a number; `rule_trace`
 *                     records which criteria fired. Tested via branch coverage
 *                     on the rules, not numeric tolerance.
 *   - `multi-step`  — composite of several atomic calculators with interpretive
 *                     logic on top (e.g. calc_kidney_workup).
 */

import { type Source, type ToolDef, type ToolResult, makeResult } from "@openclinicalai/shared";
import { z } from "zod";

/** Domains used to group calculators for `list_calculators`. */
export type CalculatorDomain =
  | "renal-metabolic"
  | "cardiology"
  | "pulmonary-vte"
  | "critical-care"
  | "infectious-disease"
  | "hepatology-gi"
  | "neurology"
  | "hematology"
  | "trauma"
  | "obstetrics"
  | "pediatrics"
  | "endocrinology"
  | "oncology"
  | "emergency-medicine"
  | "composite";

/** Implementation-pattern signal (see file header for semantics). */
export type CalculatorComplexity = "formula" | "lookup" | "tree" | "multi-step";

/** The clinician-facing reading of a calculator's numeric or categorical output. */
export interface CalcInterpretation {
  /** Short band label, e.g. "intermediate risk", "CKD stage G3a", "moderate ARDS". */
  band: string;
  /** Clinician-facing interpretive sentence(s). Subject to the §9 clinician-review gate. */
  detail: string;
}

/* -------------------------------------------------------------------------- */
/* Tree-class primitives (rule-cascade calculators)                            */
/* -------------------------------------------------------------------------- */

/**
 * A single criterion in a rule-tree calculator. `met` records whether the
 * criterion was satisfied by the inputs; `category` groups related criteria
 * (e.g. "major" / "minor" for Duke endocarditis); `detail` carries the value
 * that drove the decision for clinician verification.
 */
export interface RuleCriterion {
  name: string;
  met: boolean;
  category?: string;
  detail?: string;
}

/**
 * The trace returned by a tree-class calculator — replaces the additive
 * `breakdown` of formula/lookup calcs. Records every criterion evaluated plus
 * an optional human-readable summary line (e.g. "2 major + 3 minor → definite").
 */
export interface RuleTrace {
  criteria: RuleCriterion[];
  summary?: string;
}

/** Build a `RuleCriterion`. Trailing options stay omitted when not set. */
export function criterion(
  name: string,
  met: boolean,
  opts?: { category?: string; detail?: string },
): RuleCriterion {
  return {
    name,
    met,
    ...(opts?.category ? { category: opts.category } : {}),
    ...(opts?.detail ? { detail: opts.detail } : {}),
  };
}

/** Count satisfied criteria. */
export function countMet(criteria: RuleCriterion[]): number {
  return criteria.filter((c) => c.met).length;
}

/**
 * Count satisfied criteria grouped by `category` (uncategorized criteria are
 * grouped under `_uncategorized`). Useful for Duke-style "N major + N minor"
 * aggregation rules.
 */
export function countMetByCategory(criteria: RuleCriterion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of criteria) {
    if (!c.met) continue;
    const cat = c.category ?? "_uncategorized";
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts;
}

/* -------------------------------------------------------------------------- */
/* CalcResult                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The payload every calculator returns. The original citation travels in the
 * enclosing `ToolResult.sources` (ARCHITECTURE.md §5.3).
 *
 * - Formula / lookup calcs return a numeric `result` and use `breakdown`.
 * - Tree calcs return a categorical `result` (string) and use `rule_trace`.
 * - Multi-step (composite) calcs use whichever shape fits their interpretive
 *   payload.
 */
export interface CalcResult {
  /** Numeric output (formula/lookup) or categorical classification (tree). */
  result: number | string;
  /** Unit of `result`. Empty string for categorical/tree results. */
  unit: string;
  interpretation: CalcInterpretation;
  /** Additive-score breakdown, when the score is a sum of components. */
  breakdown?: { component: string; value: number }[];
  /** Rule-cascade trace — populated by tree-class calculators instead of `breakdown`. */
  rule_trace?: RuleTrace;
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
  /** Implementation pattern — drives both testing strategy and `describe_calculator` output. */
  complexity: CalculatorComplexity;
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
  complexity: CalculatorComplexity;
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

/**
 * Narrow a {@link CalcResult}'s `result` to a number. Tree-class calcs return
 * a categorical string; composites that consume formula/lookup atomic calcs
 * use this to assert (at runtime) that the sub-calc returned numeric.
 */
export function numericResult(r: CalcResult): number {
  if (typeof r.result !== "number") {
    throw new Error(
      `Expected numeric calculator result, got ${typeof r.result} ("${r.result}"). Tree-class calculators cannot feed into a numeric composite.`,
    );
  }
  return r.result;
}
