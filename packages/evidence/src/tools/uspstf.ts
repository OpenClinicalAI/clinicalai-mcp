/**
 * USPSTF tools, served from the bundled snapshot (ARCHITECTURE.md §5.2).
 *
 * Every result includes a warnings entry that surfaces the AHRQ license clause
 * verbatim — USPSTF content is not pure public domain, and downstream consumers
 * (especially commercial vendors) need to see the restriction on every call.
 */

import {
  ClinicalMcpError,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
} from "@openclinicalai/shared";
import { z } from "zod";
import {
  AHRQ_LICENSE_WARNING,
  getRecommendation,
  listByGrade,
  searchSnapshot,
  snapshotProvenanceWarning,
} from "../clients/uspstf.js";
import { crossCuttingShape, uspstfSource } from "../framework.js";
import type { Recommendation, RecommendationSummary } from "../types.js";

const gradeEnum = z.enum(["A", "B", "C", "D", "I"]);

/** Strip the body from a Recommendation to produce a RecommendationSummary. */
function toSummary(r: Recommendation): RecommendationSummary {
  return {
    id: r.id,
    title: r.title,
    topic: r.topic,
    grade: r.grade,
    ...(r.population ? { population: r.population } : {}),
    ...(r.topic_url ? { topic_url: r.topic_url } : {}),
    ...(r.date_issued ? { date_issued: r.date_issued } : {}),
  };
}

function uspstfWarnings(): string[] {
  return [AHRQ_LICENSE_WARNING, snapshotProvenanceWarning()];
}

/* -------------------------------------------------------------------------- */

const searchUspstfTool = defineTool({
  name: "search_uspstf",
  description:
    "Search USPSTF recommendations by free-text query (case-insensitive substring across title, topic, population, and the recommendation text). Served from the bundled snapshot.",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Free-text query."),
  },
  handler: (args): Promise<ToolResult<RecommendationSummary[]>> => {
    const matches = searchSnapshot(args.query);
    const summaries = matches.map(toSummary);
    return Promise.resolve(
      makeResult({
        data: summaries,
        sources: matches.map((r) => uspstfSource(r)),
        tier: "free",
        cache: { hit: false, age_s: 0 },
        phi_mode: args.phi_mode,
        warnings: uspstfWarnings(),
      }),
    );
  },
});

/* -------------------------------------------------------------------------- */

const getUspstfRecommendationTool = defineTool({
  name: "get_uspstf_recommendation",
  description:
    "Fetch a single USPSTF recommendation by ID, including the verbatim specific-recommendation text.",
  inputSchema: {
    ...crossCuttingShape,
    id: z.string().min(1).describe("USPSTF recommendation ID slug."),
  },
  handler: async (args): Promise<ToolResult<Recommendation>> => {
    const rec = getRecommendation(args.id);
    if (!rec) {
      throw ClinicalMcpError.of("NOT_FOUND", `No USPSTF recommendation with ID "${args.id}".`, {
        suggestion: "Call search_uspstf or list_uspstf_by_grade to discover IDs.",
      });
    }
    return makeResult({
      data: rec,
      sources: [uspstfSource(rec)],
      tier: "free",
      cache: { hit: false, age_s: 0 },
      phi_mode: args.phi_mode,
      warnings: uspstfWarnings(),
    });
  },
});

/* -------------------------------------------------------------------------- */

const listUspstfByGradeTool = defineTool({
  name: "list_uspstf_by_grade",
  description:
    "List USPSTF recommendations carrying a specific grade (A, B, C, D, or I). Useful for surfacing the strongest recommendations (A/B) for a population.",
  inputSchema: {
    ...crossCuttingShape,
    grade: gradeEnum.describe("USPSTF grade letter."),
  },
  handler: (args): Promise<ToolResult<RecommendationSummary[]>> => {
    const matches = listByGrade(args.grade);
    return Promise.resolve(
      makeResult({
        data: matches.map(toSummary),
        sources: matches.map((r) => uspstfSource(r)),
        tier: "free",
        cache: { hit: false, age_s: 0 },
        phi_mode: args.phi_mode,
        warnings: uspstfWarnings(),
      }),
    );
  },
});

/* -------------------------------------------------------------------------- */

export const uspstfTools: ToolDef[] = [
  searchUspstfTool,
  getUspstfRecommendationTool,
  listUspstfByGradeTool,
];
