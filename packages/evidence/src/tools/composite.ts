/**
 * Composite evidence tools (ARCHITECTURE.md §11 milestone 5):
 *   - summarize_evidence  — best-available evidence for a clinical question:
 *                          systematic reviews + key RCTs + recruiting trials,
 *                          deduplicated, with a coarse evidence grade.
 *   - compare_treatments  — head-to-head literature for two treatments in a
 *                          condition: systematic reviews + comparative studies.
 */

import {
  DEFAULT_TTL_S,
  PUBLISHERS,
  type Source,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
  makeSource,
} from "@openclinicalai/shared";
import { z } from "zod";
import { searchTrials } from "../clients/clinicaltrials.js";
import { buildPubMedTerm, esearch, esummary } from "../clients/pubmed.js";
import { crossCuttingShape, redactIfSensitive, withCache } from "../framework.js";
import type { ArticleSummary, EvidenceSummary, TreatmentComparison } from "../types.js";

/** Deduplicate ArticleSummaries by PMID. */
function dedupeArticles(...lists: ArticleSummary[][]): ArticleSummary[] {
  const seen = new Map<string, ArticleSummary>();
  for (const list of lists) {
    for (const article of list) {
      if (!seen.has(article.pmid)) seen.set(article.pmid, article);
    }
  }
  return [...seen.values()];
}

/* -------------------------------------------------------------------------- */

const summarizeEvidenceTool = defineTool({
  name: "summarize_evidence",
  description:
    "Pull together the best-available evidence for a clinical question — systematic reviews, key RCTs, and active recruiting trials — and grade the strongest study design surfaced.",
  inputSchema: {
    ...crossCuttingShape,
    question: z.string().min(3).describe("The clinical question to summarize evidence for."),
  },
  handler: async (args, ctx): Promise<ToolResult<EvidenceSummary>> => {
    const prepared = await redactIfSensitive(ctx, args.question, args);
    const { data, cache } = await withCache(
      ctx,
      "summarize_evidence",
      { ...args, question: prepared.text },
      { ttl_s: DEFAULT_TTL_S.pubmed_search },
      async () => {
        const srTerm = buildPubMedTerm(prepared.text, {
          publication_types: ["systematic-review", "meta-analysis"],
        });
        const rctTerm = buildPubMedTerm(prepared.text, { publication_types: ["rct"] });

        const [srPmids, rctPmids, recruiting] = await Promise.all([
          esearch(srTerm, { retmax: 10 }, ctx.env),
          esearch(rctTerm, { retmax: 10 }, ctx.env),
          searchTrials({
            query: prepared.text,
            status: ["recruiting"],
            pageSize: 10,
          }),
        ]);

        const [srSummaries, rctSummaries] = await Promise.all([
          esummary(srPmids, ctx.env),
          esummary(rctPmids, ctx.env),
        ]);

        const systematicReviews = dedupeArticles(srSummaries);
        const keyTrials = dedupeArticles(rctSummaries).filter(
          (a) => !systematicReviews.some((s) => s.pmid === a.pmid),
        );

        let grade: EvidenceSummary["evidence_grade"];
        if (systematicReviews.length >= 1) grade = "high";
        else if (keyTrials.length >= 2) grade = "moderate";
        else if (keyTrials.length === 1) grade = "low";
        else grade = "insufficient";

        const summary: EvidenceSummary = {
          question: prepared.text,
          evidence_grade: grade,
          systematic_reviews: systematicReviews,
          key_trials: keyTrials,
          recruiting_trials: recruiting,
          total_evidence_items: systematicReviews.length + keyTrials.length + recruiting.length,
        };
        return summary;
      },
    );

    const sources: Source[] = [
      makeSource({
        title: `PubMed evidence search: ${prepared.text}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(prepared.text)}`,
        publisher: PUBLISHERS.NIH,
      }),
      makeSource({
        title: `ClinicalTrials.gov recruiting trials: ${prepared.text}`,
        url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(prepared.text)}&aggFilters=status:rec`,
        publisher: PUBLISHERS.CLINICALTRIALS,
      }),
    ];

    return makeResult({
      data,
      sources,
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      phi_redaction_applied: prepared.redaction,
      warnings:
        data.total_evidence_items === 0
          ? ["No systematic reviews, RCTs, or recruiting trials matched this query."]
          : undefined,
    });
  },
});

/* -------------------------------------------------------------------------- */

const compareTreatmentsTool = defineTool({
  name: "compare_treatments",
  description:
    "Find head-to-head comparative-effectiveness evidence for two treatments in a given condition: systematic reviews and meta-analyses plus broader comparative studies.",
  inputSchema: {
    ...crossCuttingShape,
    treatment_a: z.string().min(1),
    treatment_b: z.string().min(1),
    condition: z.string().min(1),
  },
  handler: async (args, ctx): Promise<ToolResult<TreatmentComparison>> => {
    const treatA = await redactIfSensitive(ctx, args.treatment_a, args);
    const treatB = await redactIfSensitive(ctx, args.treatment_b, args);
    const cond = await redactIfSensitive(ctx, args.condition, args);
    const base = `${treatA.text} AND ${treatB.text} AND ${cond.text}`;

    const { data, cache } = await withCache(
      ctx,
      "compare_treatments",
      { treatment_a: treatA.text, treatment_b: treatB.text, condition: cond.text },
      { ttl_s: DEFAULT_TTL_S.pubmed_search },
      async () => {
        const srTerm = buildPubMedTerm(base, {
          publication_types: ["systematic-review", "meta-analysis"],
        });
        const [srPmids, allPmids] = await Promise.all([
          esearch(srTerm, { retmax: 15 }, ctx.env),
          esearch(base, { retmax: 25 }, ctx.env),
        ]);
        const [srSummaries, allSummaries] = await Promise.all([
          esummary(srPmids, ctx.env),
          esummary(allPmids, ctx.env),
        ]);
        const systematic = dedupeArticles(srSummaries);
        const comparative = dedupeArticles(allSummaries).filter(
          (a) => !systematic.some((s) => s.pmid === a.pmid),
        );
        const comparison: TreatmentComparison = {
          treatment_a: treatA.text,
          treatment_b: treatB.text,
          condition: cond.text,
          systematic_reviews: systematic,
          comparative_articles: comparative,
          head_to_head_count: systematic.length + comparative.length,
        };
        return comparison;
      },
    );

    // The aggregate redaction report covers any of the three free-text inputs.
    const totalRedactions =
      (treatA.redaction?.count ?? 0) +
      (treatB.redaction?.count ?? 0) +
      (cond.redaction?.count ?? 0);
    const redactionReport =
      totalRedactions > 0
        ? {
            applied: true as const,
            categories: [
              ...new Set([
                ...(treatA.redaction?.categories ?? []),
                ...(treatB.redaction?.categories ?? []),
                ...(cond.redaction?.categories ?? []),
              ]),
            ],
            count: totalRedactions,
          }
        : undefined;

    return makeResult({
      data,
      sources: [
        makeSource({
          title: `PubMed comparative-effectiveness search: ${base}`,
          url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(base)}`,
          publisher: PUBLISHERS.NIH,
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      phi_redaction_applied: redactionReport,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const compositeEvidenceTools: ToolDef[] = [summarizeEvidenceTool, compareTreatmentsTool];
