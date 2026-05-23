/**
 * ICD-10-CM and LOINC tools backed by the NLM Clinical Tables search API.
 * Both are free, key-less endpoints.
 */

import {
  ClinicalMcpError,
  DEFAULT_TTL_S,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
} from "@clinical-mcp/shared";
import { z } from "zod";
import {
  searchIcd10,
  searchIcd10ByCode,
  searchLoinc,
  searchLoincByCode,
} from "../clients/clinical-tables.js";
import { clinicalTablesSource, crossCuttingShape, withCache } from "../framework.js";
import type { CodeMatch, CodeRecord } from "../types.js";

const ICD10_CODE_RE = /^[A-Z][0-9A-Z]{1,7}(\.[0-9A-Z]{1,4})?$/i;
const LOINC_CODE_RE = /^\d+-\d$/;

/* -------------------------------------------------------------------------- */

const searchIcd10Tool = defineTool({
  name: "search_icd10",
  description:
    "Search ICD-10-CM by free-text term (clinical name, synonym). Backed by the NLM Clinical Tables API.",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe('Free-text term (e.g. "type 2 diabetes").'),
    limit: z.number().int().min(1).max(100).optional().describe("Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeMatch[]>> => {
    const limit = args.limit ?? 25;
    const { data, cache } = await withCache(
      ctx,
      "search_icd10",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      () => searchIcd10(args.query, limit),
    );
    return makeResult({
      data,
      sources: [clinicalTablesSource({ vocabulary: "ICD-10-CM", query: args.query })],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const lookupIcd10Tool = defineTool({
  name: "lookup_icd10",
  description: "Look up an ICD-10-CM code and return its display name.",
  inputSchema: {
    ...crossCuttingShape,
    code: z.string().regex(ICD10_CODE_RE).describe("ICD-10-CM code, e.g. E11.9."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeRecord>> => {
    const { data, cache } = await withCache(
      ctx,
      "lookup_icd10",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      async () => {
        const matches = await searchIcd10ByCode(args.code, 5);
        const exact = matches.find((m) => m.code.toUpperCase() === args.code.toUpperCase());
        if (!exact) {
          throw ClinicalMcpError.of("NOT_FOUND", `No ICD-10-CM code found for "${args.code}".`);
        }
        return exact;
      },
    );
    return makeResult({
      data,
      sources: [clinicalTablesSource({ vocabulary: "ICD-10-CM", code: args.code })],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const searchLoincTool = defineTool({
  name: "search_loinc",
  description:
    'Search LOINC by free-text term (e.g. "glucose blood"). Returns LOINC codes with long common names and component/system metadata.',
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Free-text term."),
    limit: z.number().int().min(1).max(100).optional().describe("Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeMatch[]>> => {
    const limit = args.limit ?? 25;
    const { data, cache } = await withCache(
      ctx,
      "search_loinc",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      () => searchLoinc(args.query, limit),
    );
    return makeResult({
      data,
      sources: [clinicalTablesSource({ vocabulary: "LOINC", query: args.query })],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const lookupLoincTool = defineTool({
  name: "lookup_loinc",
  description: "Look up a LOINC code (e.g. 50678-0) and return its long common name and metadata.",
  inputSchema: {
    ...crossCuttingShape,
    code: z.string().regex(LOINC_CODE_RE).describe("LOINC code, e.g. 50678-0."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeRecord>> => {
    const { data, cache } = await withCache(
      ctx,
      "lookup_loinc",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      async () => {
        const matches = await searchLoincByCode(args.code, 5);
        const exact = matches.find((m) => m.code === args.code);
        if (!exact) {
          throw ClinicalMcpError.of("NOT_FOUND", `No LOINC code found for "${args.code}".`);
        }
        return exact;
      },
    );
    return makeResult({
      data,
      sources: [clinicalTablesSource({ vocabulary: "LOINC", code: args.code })],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const icd10LoincTools: ToolDef[] = [
  searchIcd10Tool,
  lookupIcd10Tool,
  searchLoincTool,
  lookupLoincTool,
];
