/**
 * SNOMED CT and cross-vocabulary tools (ARCHITECTURE.md §5.4).
 *
 * Tier-aware:
 *   - No `UMLS_API_KEY` configured → `LICENSE_REQUIRED` (§3.3: the contract for
 *     tools with no free-tier fallback).
 *   - `UMLS_API_KEY` set → call the NLM UMLS REST API, tier becomes
 *     `licensed-umls`.
 */

import {
  ClinicalMcpError,
  DEFAULT_TTL_S,
  PUBLISHERS,
  type ServerContext,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
  makeSource,
} from "@clinical-mcp/shared";
import { z } from "zod";
import {
  getUmlsCuiAtoms,
  lookupUmlsSource,
  searchUmlsBySource,
  searchUmlsCui,
} from "../clients/umls.js";
import { crossCuttingShape, withCache } from "../framework.js";
import type { CodeMatch, CodeRecord, ConceptMap } from "../types.js";

const VOCAB_TO_SAB = {
  snomedct: "SNOMEDCT_US",
  icd10cm: "ICD10CM",
  loinc: "LNC",
} as const;

type VocabToken = keyof typeof VOCAB_TO_SAB;
const vocabEnum = z.enum(["snomedct", "icd10cm", "loinc"]);

function ensureUmls(ctx: ServerContext, tool: string): void {
  if (ctx.licenses.activeTiers.includes("licensed-umls")) return;
  throw ClinicalMcpError.of(
    "LICENSE_REQUIRED",
    `${tool} requires a UMLS license. Set UMLS_API_KEY to enable SNOMED CT / cross-vocabulary lookups.`,
    { suggestion: "Apply for free UMLS access at https://uts.nlm.nih.gov/uts/" },
  );
}

function umlsSearchSource(term: string, sab: string) {
  return makeSource({
    title: `UMLS search (${sab}): ${term}`,
    url: `https://uts-ws.nlm.nih.gov/rest/search/current?string=${encodeURIComponent(term)}&sabs=${sab}`,
    publisher: PUBLISHERS.NLM,
  });
}

/* -------------------------------------------------------------------------- */

const searchSnomedTool = defineTool({
  name: "search_snomed",
  description:
    "Search SNOMED CT by free-text term via the UMLS REST API. Requires a UMLS license (set UMLS_API_KEY).",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Free-text term."),
    limit: z.number().int().min(1).max(100).optional().describe("Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeMatch[]>> => {
    ensureUmls(ctx, "search_snomed");
    const limit = args.limit ?? 25;
    const { data, cache } = await withCache(
      ctx,
      "search_snomed",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record, tier: "licensed-umls" },
      () => searchUmlsBySource(args.query, "SNOMEDCT_US", ctx.env, limit),
    );
    return makeResult({
      data,
      sources: [umlsSearchSource(args.query, "SNOMEDCT_US")],
      tier: "licensed-umls",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const lookupSnomedTool = defineTool({
  name: "lookup_snomed",
  description: "Look up a SNOMED CT concept by ID via the UMLS REST API. Requires a UMLS license.",
  inputSchema: {
    ...crossCuttingShape,
    code: z.string().regex(/^\d+$/).describe("SNOMED CT concept ID (digits)."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeRecord>> => {
    ensureUmls(ctx, "lookup_snomed");
    const { data, cache } = await withCache(
      ctx,
      "lookup_snomed",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record, tier: "licensed-umls" },
      async () => {
        const record = await lookupUmlsSource("SNOMEDCT_US", args.code, ctx.env);
        if (!record) {
          throw ClinicalMcpError.of("NOT_FOUND", `No SNOMED CT concept with ID "${args.code}".`);
        }
        return record;
      },
    );
    return makeResult({
      data,
      sources: [
        makeSource({
          title: `UMLS SNOMED CT concept ${args.code}`,
          url: `https://uts-ws.nlm.nih.gov/rest/content/current/source/SNOMEDCT_US/${encodeURIComponent(args.code)}`,
          identifier: args.code,
          identifier_type: "snomed_concept_id",
          publisher: PUBLISHERS.NLM,
        }),
      ],
      tier: "licensed-umls",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const lookupConceptTool = defineTool({
  name: "lookup_concept",
  description:
    "Map a clinical term across vocabularies via UMLS — picks the best-matching CUI and returns its atoms grouped by source (SNOMED CT, ICD-10-CM, LOINC). Requires a UMLS license.",
  inputSchema: {
    ...crossCuttingShape,
    term: z.string().min(1).describe("Clinical term to map."),
    target_vocabs: z
      .array(vocabEnum)
      .optional()
      .describe("Restrict the cross-map to these vocabularies. Defaults to all three."),
  },
  handler: async (args, ctx): Promise<ToolResult<ConceptMap>> => {
    ensureUmls(ctx, "lookup_concept");
    const targets = (args.target_vocabs as VocabToken[] | undefined) ?? [
      "snomedct",
      "icd10cm",
      "loinc",
    ];
    const sabs = targets.map((v) => VOCAB_TO_SAB[v]);

    const { data, cache } = await withCache(
      ctx,
      "lookup_concept",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record, tier: "licensed-umls" },
      async () => {
        const cuis = await searchUmlsCui(args.term, ctx.env, 1);
        const top = cuis[0];
        if (!top) {
          const empty: ConceptMap = {
            term: args.term,
            mappings: {
              icd10cm: [],
              loinc: [],
              ...(targets.includes("snomedct") ? { snomedct: [] } : {}),
            },
          };
          return empty;
        }
        const grouped = await getUmlsCuiAtoms(top.cui, sabs, ctx.env);
        const map: ConceptMap = {
          term: args.term,
          mappings: {
            icd10cm: grouped.get("ICD10CM") ?? [],
            loinc: grouped.get("LNC") ?? [],
            ...(targets.includes("snomedct") ? { snomedct: grouped.get("SNOMEDCT_US") ?? [] } : {}),
          },
        };
        return map;
      },
    );

    return makeResult({
      data,
      sources: [umlsSearchSource(args.term, sabs.join(","))],
      tier: "licensed-umls",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const snomedUmlsTools: ToolDef[] = [searchSnomedTool, lookupSnomedTool, lookupConceptTool];
