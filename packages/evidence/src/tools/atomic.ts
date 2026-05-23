/**
 * The seven atomic evidence tools (ARCHITECTURE.md §5.2).
 *
 * Every tool accepts the cross-cutting params (`verbose`, `phi_mode`, `cache`)
 * and goes through {@link withCache}. Sensitive mode redacts free-text queries
 * via the policy-configured PHI backend before they leave the process.
 */

import {
  ClinicalMcpError,
  DEFAULT_TTL_S,
  PUBLISHERS,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
  makeSource,
} from "@clinical-mcp/shared";
import { z } from "zod";
import { type CtSearchFilters, getTrial, searchTrials } from "../clients/clinicaltrials.js";
import {
  buildPubMedTerm,
  efetchArticle,
  elinkSimilar,
  esearch,
  esummary,
} from "../clients/pubmed.js";
import {
  clinicalTrialsSource,
  crossCuttingShape,
  pubmedSource,
  redactIfSensitive,
  withCache,
} from "../framework.js";
import type {
  Article,
  ArticleSummary,
  PublicationType,
  Trial,
  TrialPhase,
  TrialStatus,
  TrialSummary,
} from "../types.js";

const PMID_RE = /^\d+$/;
const NCT_RE = /^NCT\d{8}$/i;

const publicationTypeEnum = z.enum([
  "rct",
  "systematic-review",
  "meta-analysis",
  "review",
  "case-report",
  "guideline",
  "clinical-trial",
  "observational",
]);

const trialStatusEnum = z.enum([
  "recruiting",
  "not-yet-recruiting",
  "enrolling-by-invitation",
  "active-not-recruiting",
  "completed",
  "suspended",
  "terminated",
  "withdrawn",
]);

const trialPhaseEnum = z.enum(["early-phase1", "phase1", "phase2", "phase3", "phase4", "n-a"]);

/* -------------------------------------------------------------------------- */

const searchPubmedTool = defineTool({
  name: "search_pubmed",
  description:
    "Search PubMed with optional publication-type, date, and free-full-text filters. Returns flat ArticleSummary records ordered by relevance.",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Free-text PubMed search query."),
    publication_types: z
      .array(publicationTypeEnum)
      .optional()
      .describe("Restrict to one or more publication types."),
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Publication date from (YYYY-MM-DD)."),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Publication date to (YYYY-MM-DD)."),
    free_full_text: z.boolean().optional().describe("Restrict to articles with free full text."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of results to return. Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<ArticleSummary[]>> => {
    const prepared = await redactIfSensitive(ctx, args.query, args);
    const term = buildPubMedTerm(prepared.text, {
      publication_types: args.publication_types as PublicationType[] | undefined,
      ...(args.date_from ? { date_from: args.date_from } : {}),
      ...(args.date_to ? { date_to: args.date_to } : {}),
      ...(args.free_full_text !== undefined ? { free_full_text: args.free_full_text } : {}),
    });
    const limit = args.limit ?? 25;
    const { data, cache } = await withCache(
      ctx,
      "search_pubmed",
      { ...args, query: prepared.text },
      { ttl_s: DEFAULT_TTL_S.pubmed_search },
      async () => {
        const pmids = await esearch(term, { retmax: limit }, ctx.env);
        return await esummary(pmids, ctx.env);
      },
    );
    return makeResult({
      data,
      sources: [
        makeSource({
          title: `PubMed search: ${term}`,
          url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`,
          publisher: PUBLISHERS.NIH,
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      phi_redaction_applied: prepared.redaction,
      warnings: data.length === 0 ? ["PubMed returned no results for this query."] : undefined,
    });
  },
});

/* -------------------------------------------------------------------------- */

const getArticleTool = defineTool({
  name: "get_article",
  description:
    "Fetch a PubMed article by PMID — title, authors, abstract, journal, publication types, and MeSH terms.",
  inputSchema: {
    ...crossCuttingShape,
    pmid: z.string().regex(PMID_RE).describe("PubMed Identifier (digits)."),
  },
  handler: async (args, ctx): Promise<ToolResult<Article>> => {
    const { data, cache } = await withCache(
      ctx,
      "get_article",
      args,
      { ttl_s: DEFAULT_TTL_S.pubmed_search },
      async () => {
        const article = await efetchArticle(args.pmid, ctx.env);
        if (!article) {
          throw ClinicalMcpError.of("NOT_FOUND", `No PubMed article with PMID ${args.pmid}.`);
        }
        return article;
      },
    );
    return makeResult({
      data,
      sources: [pubmedSource(args.pmid, data.title)],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const findRelatedArticlesTool = defineTool({
  name: "find_related_articles",
  description:
    "Find articles similar to a PMID using PubMed's elink neighbor command, then fetch their summary metadata.",
  inputSchema: {
    ...crossCuttingShape,
    pmid: z.string().regex(PMID_RE).describe("Anchor PMID."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of related articles to return. Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<ArticleSummary[]>> => {
    const limit = args.limit ?? 25;
    const { data, cache } = await withCache(
      ctx,
      "find_related_articles",
      args,
      { ttl_s: DEFAULT_TTL_S.pubmed_search },
      async () => {
        const pmids = (await elinkSimilar(args.pmid, ctx.env)).slice(0, limit);
        return await esummary(pmids, ctx.env);
      },
    );
    return makeResult({
      data,
      sources: [pubmedSource(args.pmid)],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const findSystematicReviewsTool = defineTool({
  name: "find_systematic_reviews",
  description:
    "Convenience wrapper over search_pubmed pre-filtered to systematic reviews and meta-analyses.",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Free-text query."),
    limit: z.number().int().min(1).max(100).optional().describe("Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<ArticleSummary[]>> => {
    const prepared = await redactIfSensitive(ctx, args.query, args);
    const term = buildPubMedTerm(prepared.text, {
      publication_types: ["systematic-review", "meta-analysis"],
    });
    const limit = args.limit ?? 25;
    const { data, cache } = await withCache(
      ctx,
      "find_systematic_reviews",
      { ...args, query: prepared.text },
      { ttl_s: DEFAULT_TTL_S.pubmed_search },
      async () => {
        const pmids = await esearch(term, { retmax: limit }, ctx.env);
        return await esummary(pmids, ctx.env);
      },
    );
    return makeResult({
      data,
      sources: [
        makeSource({
          title: `PubMed systematic-review search: ${term}`,
          url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`,
          publisher: PUBLISHERS.NIH,
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      phi_redaction_applied: prepared.redaction,
    });
  },
});

/* -------------------------------------------------------------------------- */

const searchTrialsTool = defineTool({
  name: "search_trials",
  description:
    "Search ClinicalTrials.gov with optional status, phase, location, and intervention filters.",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Free-text query."),
    status: z.array(trialStatusEnum).optional().describe("Restrict to one or more statuses."),
    phase: z.array(trialPhaseEnum).optional().describe("Restrict to one or more phases."),
    location: z.string().optional().describe("Geographic filter (city / country / etc.)."),
    intervention: z.string().optional().describe("Intervention name filter."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of trials to return. Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<TrialSummary[]>> => {
    const prepared = await redactIfSensitive(ctx, args.query, args);
    const filters: CtSearchFilters = {
      query: prepared.text,
      pageSize: args.limit ?? 25,
      ...(args.status ? { status: args.status as TrialStatus[] } : {}),
      ...(args.phase ? { phase: args.phase as TrialPhase[] } : {}),
      ...(args.location ? { location: args.location } : {}),
      ...(args.intervention ? { intervention: args.intervention } : {}),
    };
    const { data, cache } = await withCache(
      ctx,
      "search_trials",
      { ...args, query: prepared.text },
      { ttl_s: DEFAULT_TTL_S.clinicaltrials_search },
      () => searchTrials(filters),
    );
    return makeResult({
      data,
      sources: [
        makeSource({
          title: `ClinicalTrials.gov search: ${prepared.text}`,
          url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(prepared.text)}`,
          publisher: PUBLISHERS.CLINICALTRIALS,
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      phi_redaction_applied: prepared.redaction,
    });
  },
});

/* -------------------------------------------------------------------------- */

const getTrialTool = defineTool({
  name: "get_trial",
  description: "Fetch a ClinicalTrials.gov record by NCT ID.",
  inputSchema: {
    ...crossCuttingShape,
    nct_id: z.string().regex(NCT_RE).describe("ClinicalTrials.gov identifier (NCT########)."),
  },
  handler: async (args, ctx): Promise<ToolResult<Trial>> => {
    const { data, cache } = await withCache(
      ctx,
      "get_trial",
      args,
      { ttl_s: DEFAULT_TTL_S.clinicaltrials_search },
      async () => {
        const trial = await getTrial(args.nct_id);
        if (!trial) {
          throw ClinicalMcpError.of(
            "NOT_FOUND",
            `No ClinicalTrials.gov record for ${args.nct_id}.`,
          );
        }
        return trial;
      },
    );
    return makeResult({
      data,
      sources: [clinicalTrialsSource(args.nct_id, data.brief_title)],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const findTrialsForConditionTool = defineTool({
  name: "find_trials_for_condition",
  description:
    "Convenience wrapper over search_trials that searches ClinicalTrials.gov by structured condition.",
  inputSchema: {
    ...crossCuttingShape,
    condition: z.string().min(1).describe("Condition / disease name."),
    limit: z.number().int().min(1).max(100).optional().describe("Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<TrialSummary[]>> => {
    const { data, cache } = await withCache(
      ctx,
      "find_trials_for_condition",
      args,
      { ttl_s: DEFAULT_TTL_S.clinicaltrials_search },
      () => searchTrials({ condition: args.condition, pageSize: args.limit ?? 25 }),
    );
    return makeResult({
      data,
      sources: [
        makeSource({
          title: `ClinicalTrials.gov by condition: ${args.condition}`,
          url: `https://clinicaltrials.gov/search?cond=${encodeURIComponent(args.condition)}`,
          publisher: PUBLISHERS.CLINICALTRIALS,
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const atomicEvidenceTools: ToolDef[] = [
  searchPubmedTool,
  getArticleTool,
  findRelatedArticlesTool,
  findSystematicReviewsTool,
  searchTrialsTool,
  getTrialTool,
  findTrialsForConditionTool,
];
