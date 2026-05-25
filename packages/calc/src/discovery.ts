/**
 * Discovery tools — `list_calculators` and `describe_calculator` (ARCHITECTURE.md §5.3).
 * They let an agent enumerate the calculator surface and fetch a calculator's
 * full input schema and citations before calling it.
 */

import {
  ClinicalMcpError,
  type ToolDef,
  type ToolResult,
  makeResult,
  makeSource,
} from "@openclinicalai/shared";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ALL_CALCULATORS, getCalculator } from "./registry.js";

const CALCULATOR_DOMAINS = [
  "renal-metabolic",
  "cardiology",
  "pulmonary-vte",
  "critical-care",
  "infectious-disease",
  "hepatology-gi",
  "neurology",
  "hematology",
  "trauma",
  "obstetrics",
  "pediatrics",
  "endocrinology",
  "oncology",
  "emergency-medicine",
  "composite",
] as const;

const CALCULATOR_COMPLEXITIES = ["formula", "lookup", "tree", "multi-step"] as const;

function discoverySource() {
  return makeSource({
    title: "clinicalai-mcp — ARCHITECTURE.md §5.3 (@openclinicalai/calc tool inventory)",
    url: "https://github.com/OpenClinicalAI/clinicalai-mcp/blob/main/ARCHITECTURE.md",
    publisher: "clinicalai-mcp",
  });
}

const listInput = z.object({
  domain: z.enum(CALCULATOR_DOMAINS).optional().describe("Optional domain filter."),
  complexity: z
    .enum(CALCULATOR_COMPLEXITIES)
    .optional()
    .describe(
      "Optional implementation-pattern filter — `formula`/`lookup` are numeric, `tree` is criteria-cascade categorical, `multi-step` is composite.",
    ),
});

const describeInput = z.object({
  name: z.string().describe('The calculator tool name, e.g. "calc_creatinine_clearance".'),
});

const listCalculators: ToolDef = {
  name: "list_calculators",
  description:
    "List the available clinical calculators, optionally filtered by domain (renal-metabolic, cardiology, pulmonary-vte, critical-care, infectious-disease, hepatology-gi, neurology, hematology, trauma, obstetrics, pediatrics, endocrinology, oncology, emergency-medicine, composite) and/or implementation complexity (formula, lookup, tree, multi-step).",
  inputSchema: listInput.shape,
  handler: (args): Promise<ToolResult<unknown>> => {
    const { domain, complexity } = listInput.parse(args);
    const calculators = ALL_CALCULATORS.filter(
      (c) => (!domain || c.domain === domain) && (!complexity || c.complexity === complexity),
    ).map((c) => ({
      name: c.name,
      title: c.title,
      domain: c.domain,
      complexity: c.complexity,
      description: c.description,
    }));
    return Promise.resolve(
      makeResult({
        data: { count: calculators.length, calculators },
        sources: [discoverySource()],
        tier: "compute",
      }),
    );
  },
};

const describeCalculatorHandler = async (
  args: Record<string, unknown>,
): Promise<ToolResult<unknown>> => {
  const { name } = describeInput.parse(args);
  const calc = getCalculator(name);
  if (!calc) {
    throw ClinicalMcpError.of("NOT_FOUND", `No calculator named "${name}".`, {
      suggestion: "Call list_calculators to see available calculator names.",
    });
  }
  return makeResult({
    data: {
      name: calc.name,
      title: calc.title,
      domain: calc.domain,
      complexity: calc.complexity,
      description: calc.description,
      sources: calc.sources,
      input_schema: zodToJsonSchema(z.object(calc.inputSchema)),
    },
    sources: [discoverySource()],
    tier: "compute",
  });
};

const describeCalculator: ToolDef = {
  name: "describe_calculator",
  description:
    "Return a calculator's full input schema (as JSON Schema), domain, complexity, description, and primary-literature citations.",
  inputSchema: describeInput.shape,
  handler: describeCalculatorHandler,
};

/** The two discovery tools. */
export function discoveryTools(): ToolDef[] {
  return [listCalculators, describeCalculator];
}
