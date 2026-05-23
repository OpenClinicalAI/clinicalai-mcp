/**
 * The six atomic drug tools (ARCHITECTURE.md §5.1).
 *
 * Every tool accepts the cross-cutting params (`verbose`, `phi_mode`, `cache`)
 * and goes through {@link withCache} so cache hints, sensitive-mode write rules,
 * and the `cache: "only"` semantics all live in one place.
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
import { fetchDrugBankDdi, toDrugInteraction } from "../clients/drugbank.js";
import {
  type OpenFdaLabel,
  fetchAdverseEventCounts,
  fetchEnforcement,
  fetchLabelBySetId,
} from "../clients/openfda.js";
import { getRelatedConcepts, getRxNormProperties, searchDrugs } from "../clients/rxnorm.js";
import {
  crossCuttingShape,
  dailyMedSource,
  openFdaSource,
  redactIfSensitive,
  rxnormSource,
  withCache,
} from "../framework.js";
import { labelResolutionWarning, resolveLabel } from "../label-resolver.js";
import { openFdaToSpl } from "../labels.js";
import type {
  AdverseEventSummary,
  DrugRecord,
  DrugSummary,
  InteractionReport,
  LabelInteractionsEntry,
  RecallSummary,
  StructuredProductLabel,
} from "../types.js";

const RXCUI_RE = /^\d+$/;
const SETID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RxNorm term-type priority for search-result ranking. Lower number = better
 * match for a generic free-text drug search. The ingredient (IN) is the most
 * useful concept for chaining into other tools — clinical drugs come next,
 * brand names after, branded products last. RxNav's own ordering is
 * alphabetical, which is useless for clinical UX.
 */
const TTY_PRIORITY: Record<string, number> = {
  IN: 0,
  PIN: 1,
  MIN: 2,
  SCD: 10,
  SCDC: 11,
  SCDF: 12,
  SCDG: 13,
  BN: 20,
  SBD: 30,
  SBDC: 31,
  SBDF: 32,
  SBDG: 33,
  GPCK: 40,
  BPCK: 41,
};

/* -------------------------------------------------------------------------- */

const searchDrugsTool = defineTool({
  name: "search_drugs",
  description:
    "Search RxNorm by drug name (generic or brand). Returns concept properties (RxCUI, name, term type) suitable for chaining into other drug tools.",
  inputSchema: {
    ...crossCuttingShape,
    query: z.string().min(1).describe("Drug name to search for (generic or brand)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of results to return. Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<DrugSummary[]>> => {
    const limit = args.limit ?? 25;
    const prepared = await redactIfSensitive(ctx, args.query, args);
    const { data, cache } = await withCache(
      ctx,
      "search_drugs",
      { ...args, query: prepared.text },
      { ttl_s: 60 * 60 },
      async () => {
        const concepts = await searchDrugs(prepared.text);
        // Sort by clinical usefulness BEFORE slicing — RxNav returns alphabetically,
        // which buries the ingredient under branded combination products.
        concepts.sort(
          (a, b) => (TTY_PRIORITY[a.tty ?? ""] ?? 99) - (TTY_PRIORITY[b.tty ?? ""] ?? 99),
        );
        return concepts.slice(0, limit).map<DrugSummary>((c) => ({
          rxcui: c.rxcui,
          name: c.name,
          ...(c.tty ? { tty: c.tty } : {}),
          ...(c.synonym ? { synonym: c.synonym } : {}),
        }));
      },
    );
    return makeResult({
      data,
      sources: [
        makeSource({
          title: `RxNorm search: "${prepared.text}"`,
          url: `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(prepared.text)}`,
          publisher: PUBLISHERS.NLM,
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

const getDrugByRxcuiTool = defineTool({
  name: "get_drug_by_rxcui",
  description:
    "Fetch RxNorm concept properties and common relationships (ingredients, brand names, clinical drugs) for an RxCUI.",
  inputSchema: {
    ...crossCuttingShape,
    rxcui: z.string().regex(RXCUI_RE).describe("RxNorm Concept Unique Identifier (digits only)."),
  },
  handler: async (args, ctx): Promise<ToolResult<DrugRecord>> => {
    const { data, cache } = await withCache(
      ctx,
      "get_drug_by_rxcui",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      async () => {
        const [props, related] = await Promise.all([
          getRxNormProperties(args.rxcui),
          getRelatedConcepts(args.rxcui, ["IN", "BN", "SCD"]),
        ]);
        if (!props) {
          throw ClinicalMcpError.of("NOT_FOUND", `No RxNorm concept for RxCUI ${args.rxcui}.`);
        }
        const record: DrugRecord = {
          rxcui: props.rxcui,
          name: props.name,
          ...(props.tty ? { tty: props.tty } : {}),
          ...(props.synonym ? { synonym: props.synonym } : {}),
        };
        const ingredients = related.get("IN")?.map((c) => ({ rxcui: c.rxcui, name: c.name }));
        const brands = related.get("BN")?.map((c) => ({ rxcui: c.rxcui, name: c.name }));
        const clinicalDrugs = related.get("SCD")?.map((c) => ({ rxcui: c.rxcui, name: c.name }));
        if (ingredients?.length) record.ingredients = ingredients;
        if (brands?.length) record.brand_names = brands;
        if (clinicalDrugs?.length) record.clinical_drugs = clinicalDrugs;
        return record;
      },
    );
    return makeResult({
      data,
      sources: [rxnormSource(args.rxcui, data.name)],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const getDrugLabelTool = defineTool({
  name: "get_drug_label",
  description:
    "Fetch the FDA Structured Product Label sections (indications, dosage, warnings, etc.) for a drug, by SetID (DailyMed UUID) or RxCUI.",
  inputSchema: {
    ...crossCuttingShape,
    setid_or_rxcui: z.string().min(1).describe("DailyMed SetID (UUID) or RxNorm RxCUI (digits)."),
  },
  handler: async (
    args,
    ctx,
  ): Promise<ToolResult<StructuredProductLabel & { verbose?: OpenFdaLabel }>> => {
    const isSetId = SETID_RE.test(args.setid_or_rxcui);
    const isRxcui = RXCUI_RE.test(args.setid_or_rxcui);
    if (!isSetId && !isRxcui) {
      throw ClinicalMcpError.of(
        "INVALID_INPUT",
        "setid_or_rxcui must be either a DailyMed SetID (UUID) or an RxCUI (digits).",
      );
    }
    const { data, cache } = await withCache(
      ctx,
      "get_drug_label",
      args,
      { ttl_s: DEFAULT_TTL_S.dailymed_label },
      async () => {
        let label: OpenFdaLabel | null;
        let resolverWarning: string | undefined;
        if (isSetId) {
          label = await fetchLabelBySetId(args.setid_or_rxcui, ctx.env);
        } else {
          const resolution = await resolveLabel(args.setid_or_rxcui, ctx.env);
          label = resolution.label;
          resolverWarning = labelResolutionWarning(resolution);
        }
        if (!label) {
          throw ClinicalMcpError.of("NOT_FOUND", `No FDA label found for ${args.setid_or_rxcui}.`);
        }
        return { spl: openFdaToSpl(label), raw: label, resolverWarning };
      },
    );

    return makeResult({
      data: data.spl,
      sources: [
        openFdaSource({
          title: data.spl.brand_name
            ? `openFDA label: ${data.spl.brand_name}`
            : `openFDA label ${data.spl.set_id ?? args.setid_or_rxcui}`,
          url: `https://api.fda.gov/drug/label.json?search=${
            isSetId ? `set_id:%22${args.setid_or_rxcui}%22` : `openfda.rxcui:${args.setid_or_rxcui}`
          }`,
          ...(data.spl.set_id ? { identifier: data.spl.set_id, identifier_type: "setid" } : {}),
        }),
        ...(data.spl.set_id
          ? [dailyMedSource(data.spl.set_id, data.spl.brand_name ?? data.spl.generic_name)]
          : []),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      ...(args.verbose ? { verbose: data.raw } : {}),
      ...(data.resolverWarning ? { warnings: [data.resolverWarning] } : {}),
    });
  },
});

/* -------------------------------------------------------------------------- */

const getAdverseEventsTool = defineTool({
  name: "get_adverse_events",
  description:
    "Return aggregated FAERS adverse-event report counts for a drug by RxCUI: total reports and top MedDRA preferred terms.",
  inputSchema: {
    ...crossCuttingShape,
    rxcui: z.string().regex(RXCUI_RE).describe("RxNorm RxCUI."),
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Restrict to reports received on/after this date (YYYY-MM-DD)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of distinct reaction terms to return. Defaults to 25."),
  },
  handler: async (args, ctx): Promise<ToolResult<AdverseEventSummary>> => {
    const { data, cache } = await withCache(
      ctx,
      "get_adverse_events",
      args,
      { ttl_s: DEFAULT_TTL_S.openfda_adverse_events },
      async () => {
        const counts = await fetchAdverseEventCounts(
          args.rxcui,
          { since: args.since, limit: args.limit ?? 25 },
          ctx.env,
        );
        const summary: AdverseEventSummary = {
          rxcui: args.rxcui,
          top_reactions: counts.top.map((t) => ({ reaction: t.term, count: t.count })),
          ...(counts.total !== undefined ? { total_reports: counts.total } : {}),
          ...(args.since ? { time_range: { since: args.since } } : {}),
        };
        return summary;
      },
    );
    return makeResult({
      data,
      sources: [
        openFdaSource({
          title: `openFDA FAERS adverse events for RxCUI ${args.rxcui}`,
          url: `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.rxcui:${args.rxcui}`,
          identifier: args.rxcui,
          identifier_type: "rxcui",
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      warnings:
        data.top_reactions.length === 0
          ? ["FAERS returned no records for this RxCUI in the requested window."]
          : undefined,
    });
  },
});

/* -------------------------------------------------------------------------- */

const getDrugRecallsTool = defineTool({
  name: "get_drug_recalls",
  description:
    "Return FDA drug-enforcement (recall) records for a drug by RxCUI, most recent first.",
  inputSchema: {
    ...crossCuttingShape,
    rxcui: z.string().regex(RXCUI_RE).describe("RxNorm RxCUI."),
  },
  handler: async (args, ctx): Promise<ToolResult<RecallSummary[]>> => {
    const { data, cache } = await withCache(
      ctx,
      "get_drug_recalls",
      args,
      { ttl_s: 24 * 60 * 60 },
      async () => {
        const records = await fetchEnforcement(args.rxcui, ctx.env);
        return records.map<RecallSummary>((r) => ({
          ...(r.recall_number ? { recall_number: r.recall_number } : {}),
          ...(r.classification ? { classification: r.classification } : {}),
          ...(r.status ? { status: r.status } : {}),
          ...(r.reason_for_recall ? { reason_for_recall: r.reason_for_recall } : {}),
          ...(r.recalling_firm ? { recalling_firm: r.recalling_firm } : {}),
          ...(r.product_description ? { product_description: r.product_description } : {}),
          ...(r.recall_initiation_date ? { recall_initiation_date: r.recall_initiation_date } : {}),
          ...(r.distribution_pattern ? { distribution_pattern: r.distribution_pattern } : {}),
        }));
      },
    );
    return makeResult({
      data,
      sources: [
        openFdaSource({
          title: `openFDA drug enforcement for RxCUI ${args.rxcui}`,
          url: `https://api.fda.gov/drug/enforcement.json?search=openfda.rxcui:${args.rxcui}`,
          identifier: args.rxcui,
          identifier_type: "rxcui",
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
    });
  },
});

/* -------------------------------------------------------------------------- */

const getDrugInteractionsTool = defineTool({
  name: "get_drug_interactions",
  description:
    "Return drug interactions for a set of RxCUIs. Tier-aware: the free tier surfaces each drug's FDA-label 'Drug Interactions' section (prose, not pairwise) since NLM retired the public RxNav interaction API in January 2024 and DrugBank no longer issues academic licenses. When LEXICOMP_API_KEY / MICROMEDEX_API_KEY (or a paid DRUGBANK_API_KEY) is configured, structured pairwise interactions are returned instead.",
  inputSchema: {
    ...crossCuttingShape,
    rxcuis: z
      .array(z.string().regex(RXCUI_RE))
      .min(2)
      .max(20)
      .describe("Two or more RxCUIs to check for interactions."),
  },
  handler: async (args, ctx): Promise<ToolResult<InteractionReport>> => {
    const drugbankConfigured = ctx.licenses.activeTiers.includes("licensed-drugbank");

    if (drugbankConfigured) {
      const { data, cache } = await withCache(
        ctx,
        "get_drug_interactions",
        args,
        { ttl_s: DEFAULT_TTL_S.rxnorm_record, tier: "licensed-drugbank" },
        async () => {
          const raw = await fetchDrugBankDdi(args.rxcuis, ctx.env);
          const report: InteractionReport = {
            queried_rxcuis: args.rxcuis,
            interactions: raw.map(toDrugInteraction),
            source: "drugbank",
          };
          return report;
        },
      );
      return makeResult({
        data,
        sources: [
          makeSource({
            title: `DrugBank DDI lookup (${args.rxcuis.length} RxCUIs)`,
            url: `${ctx.env.DRUGBANK_API_BASE ?? "https://api.drugbank.com/v1"}/ddi?rxcui_list=${args.rxcuis.join(",")}`,
            publisher: "DrugBank",
          }),
        ],
        tier: "licensed-drugbank",
        cache,
        phi_mode: args.phi_mode,
      });
    }

    // Free-tier: surface each drug's FDA label "Drug Interactions" prose.
    // Not pairwise — the agent has to read across entries — but real clinical
    // signal vs. an empty stub. NLM retired RxNav's free DDI API in Jan 2024,
    // and DrugBank discontinued academic licenses, so label prose is the only
    // free, authoritative interaction surface left.
    const { data, cache } = await withCache(
      ctx,
      "get_drug_interactions",
      args,
      { ttl_s: DEFAULT_TTL_S.dailymed_label },
      async () => {
        const entries = await Promise.all(
          args.rxcuis.map(async (rxcui) => {
            const resolution = await resolveLabel(rxcui, ctx.env);
            const entry: LabelInteractionsEntry = {
              rxcui,
              ...(resolution.generic_name ? { name: resolution.generic_name } : {}),
            };
            if (resolution.label?.drug_interactions?.length) {
              entry.drug_interactions = resolution.label.drug_interactions;
            } else if (!resolution.label) {
              entry.note = "No FDA label found (RxCUI + generic_name fallback both empty).";
            } else {
              entry.note = "FDA label found but has no 'Drug Interactions' section.";
            }
            return entry;
          }),
        );
        const report: InteractionReport = {
          queried_rxcuis: args.rxcuis,
          interactions: [],
          source: "fda-label-prose",
          label_interactions: entries,
        };
        return report;
      },
    );

    const warnings: string[] = [
      "Free-tier interactions are FDA-label prose, not pairwise structured DDI. Read each drug's 'Drug Interactions' section under `label_interactions[]` and cross-reference manually.",
      "NLM retired the public RxNav interaction API in January 2024 and DrugBank no longer issues academic licenses. Configure LEXICOMP_API_KEY or MICROMEDEX_API_KEY (planned) for clinician-grade pairwise DDI; a paid DRUGBANK_API_KEY also works if you have one.",
    ];

    return makeResult({
      data,
      sources: [
        ...args.rxcuis.map((rxcui) =>
          openFdaSource({
            title: `openFDA label drug_interactions section for RxCUI ${rxcui}`,
            url: `https://api.fda.gov/drug/label.json?search=openfda.rxcui:${rxcui}`,
            identifier: rxcui,
            identifier_type: "rxcui",
          }),
        ),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      warnings,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const atomicDrugTools: ToolDef[] = [
  searchDrugsTool,
  getDrugByRxcuiTool,
  getDrugLabelTool,
  getAdverseEventsTool,
  getDrugRecallsTool,
  getDrugInteractionsTool,
];
