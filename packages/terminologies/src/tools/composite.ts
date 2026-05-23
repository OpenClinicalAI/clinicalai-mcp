/**
 * Composite terminology tools (ARCHITECTURE.md §5.4):
 *   - map_concept_across_vocabs — same term resolved in ICD-10 + LOINC (+ SNOMED CT when UMLS is licensed)
 *   - code_workup               — top ICD-10 candidates plus a broader "consider also" set
 *
 * Cross-MCP composites are deliberately out of scope (§10): RxNorm mapping
 * lives in `@clinical-mcp/drugs` and stays an agent-orchestrated step.
 */

import {
  DEFAULT_TTL_S,
  type DataTier,
  PUBLISHERS,
  type Source,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
  makeSource,
} from "@clinical-mcp/shared";
import { z } from "zod";
import { searchIcd10, searchLoinc } from "../clients/clinical-tables.js";
import { searchUmlsBySource } from "../clients/umls.js";
import { clinicalTablesSource, crossCuttingShape, withCache } from "../framework.js";
import type { CodeMatch, CodeWorkup, ConceptMap } from "../types.js";

/* -------------------------------------------------------------------------- */

const mapConceptAcrossVocabsTool = defineTool({
  name: "map_concept_across_vocabs",
  description:
    "Resolve a clinical term across ICD-10-CM and LOINC in parallel. SNOMED CT is included when a UMLS license is configured (planned for milestone 7). RxNorm mapping lives in @clinical-mcp/drugs.",
  inputSchema: {
    ...crossCuttingShape,
    term: z.string().min(1).describe("Clinical term to map."),
    limit_per_vocab: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum matches to return per vocabulary. Defaults to 10."),
  },
  handler: async (args, ctx): Promise<ToolResult<ConceptMap>> => {
    const limit = args.limit_per_vocab ?? 10;
    const umlsLicensed = ctx.licenses.activeTiers.includes("licensed-umls");
    const tier: DataTier = umlsLicensed ? "licensed-umls" : "free";

    const { data, cache } = await withCache(
      ctx,
      "map_concept_across_vocabs",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record, tier },
      async () => {
        const tasks: [Promise<CodeMatch[]>, Promise<CodeMatch[]>, Promise<CodeMatch[]> | null] = [
          searchIcd10(args.term, limit),
          searchLoinc(args.term, limit),
          umlsLicensed ? searchUmlsBySource(args.term, "SNOMEDCT_US", ctx.env, limit) : null,
        ];
        const [icd10, loinc, snomed] = await Promise.all([
          tasks[0],
          tasks[1],
          tasks[2] ?? Promise.resolve(undefined),
        ]);
        const map: ConceptMap = {
          term: args.term,
          mappings: {
            icd10cm: icd10,
            loinc,
            ...(snomed ? { snomedct: snomed } : {}),
          },
        };
        return map;
      },
    );

    const warnings: string[] = [];
    if (!umlsLicensed) {
      warnings.push(
        "SNOMED CT mapping is omitted because no UMLS license is configured. Set UMLS_API_KEY to include SNOMED in this composite.",
      );
    }
    warnings.push(
      "RxNorm mapping lives in @clinical-mcp/drugs (see search_drugs / get_drug_by_rxcui); cross-MCP composition is left to the agent (ARCHITECTURE.md §10).",
    );

    const sources: Source[] = [
      clinicalTablesSource({ vocabulary: "ICD-10-CM", query: args.term }),
      clinicalTablesSource({ vocabulary: "LOINC", query: args.term }),
    ];
    if (umlsLicensed) {
      sources.push(
        makeSource({
          title: `UMLS SNOMED CT search: ${args.term}`,
          url: `https://uts-ws.nlm.nih.gov/rest/search/current?string=${encodeURIComponent(args.term)}&sabs=SNOMEDCT_US`,
          publisher: PUBLISHERS.NLM,
        }),
      );
    }

    return makeResult({
      data,
      sources,
      tier,
      cache,
      phi_mode: args.phi_mode,
      warnings,
    });
  },
});

/* -------------------------------------------------------------------------- */

const codeWorkupTool = defineTool({
  name: "code_workup",
  description:
    'Surface the top ICD-10-CM candidates for a term plus a broader "consider also" set so an agent can quickly differentiate likely codes.',
  inputSchema: {
    ...crossCuttingShape,
    term: z.string().min(1).describe("Clinical term."),
    top_n: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Top-candidates count. Defaults to 5."),
  },
  handler: async (args, ctx): Promise<ToolResult<CodeWorkup>> => {
    const topN = args.top_n ?? 5;
    const { data, cache } = await withCache(
      ctx,
      "code_workup",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      async () => {
        // Fetch one broader set and split into top / consider-also.
        const broader = await searchIcd10(args.term, 25);
        const candidates: CodeMatch[] = broader.slice(0, topN);
        const considerAlso: CodeMatch[] = broader.slice(topN);
        const workup: CodeWorkup = {
          term: args.term,
          candidates,
          consider_also: considerAlso,
        };
        return workup;
      },
    );

    return makeResult({
      data,
      sources: [clinicalTablesSource({ vocabulary: "ICD-10-CM", query: args.term })],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      warnings:
        data.candidates.length === 0
          ? [`ICD-10-CM returned no candidates for "${args.term}".`]
          : undefined,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const compositeTerminologyTools: ToolDef[] = [mapConceptAcrossVocabsTool, codeWorkupTool];
