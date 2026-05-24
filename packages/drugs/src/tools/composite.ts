/**
 * Composite drug tools (ARCHITECTURE.md §11 milestone 4):
 *   - get_drug_full_profile — identity + label + AEs + recalls + interactions
 *   - safety_summary        — boxed warnings, contraindications, populations, active recalls
 *   - renal_dose_adjustment — CrCl band + relevant label prose
 *
 * Composites earn their keep by adding clinical interpretive structure on top of
 * the atomic fan-out — they should not duplicate work an agent could trivially
 * do itself.
 */

import {
  ClinicalMcpError,
  DEFAULT_TTL_S,
  type Source,
  type ToolDef,
  type ToolResult,
  defineTool,
  makeResult,
  makeSource,
} from "@openclinicalai/shared";
import { z } from "zod";
import {
  type OpenFdaLabel,
  fetchAdverseEventCounts,
  fetchEnforcement,
} from "../clients/openfda.js";
import { getRelatedConcepts, getRxNormProperties } from "../clients/rxnorm.js";
import { crossCuttingShape, openFdaSource, rxnormSource, withCache } from "../framework.js";
import { labelResolutionWarning, resolveLabel } from "../label-resolver.js";
import { openFdaToSpl } from "../labels.js";
import type {
  AdverseEventSummary,
  DoseAdjustmentReport,
  DrugFullProfile,
  DrugRecord,
  InteractionReport,
  RecallSummary,
  SafetySummary,
  StructuredProductLabel,
} from "../types.js";

const RXCUI_RE = /^\d+$/;

/** Whether a recall record's status indicates it is still active. */
function isActiveRecall(status: string | undefined): boolean {
  if (!status) return false;
  const lower = status.toLowerCase();
  return lower === "ongoing" || lower === "open" || lower === "pending";
}

function toRecallSummary(r: { [k: string]: unknown }): RecallSummary {
  return {
    ...(typeof r.recall_number === "string" ? { recall_number: r.recall_number } : {}),
    ...(typeof r.classification === "string" ? { classification: r.classification } : {}),
    ...(typeof r.status === "string" ? { status: r.status } : {}),
    ...(typeof r.reason_for_recall === "string" ? { reason_for_recall: r.reason_for_recall } : {}),
    ...(typeof r.recalling_firm === "string" ? { recalling_firm: r.recalling_firm } : {}),
    ...(typeof r.product_description === "string"
      ? { product_description: r.product_description }
      : {}),
    ...(typeof r.recall_initiation_date === "string"
      ? { recall_initiation_date: r.recall_initiation_date }
      : {}),
    ...(typeof r.distribution_pattern === "string"
      ? { distribution_pattern: r.distribution_pattern }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */

const getDrugFullProfileTool = defineTool({
  name: "get_drug_full_profile",
  description:
    "Fan-out: RxNorm record + FDA label + FAERS adverse-event summary + active recalls + interaction stub for a single RxCUI.",
  inputSchema: {
    ...crossCuttingShape,
    rxcui: z.string().regex(RXCUI_RE).describe("RxNorm RxCUI."),
  },
  handler: async (args, ctx): Promise<ToolResult<DrugFullProfile>> => {
    const { data, cache } = await withCache(
      ctx,
      "get_drug_full_profile",
      args,
      { ttl_s: DEFAULT_TTL_S.rxnorm_record },
      async () => {
        const [props, related, labelResolution, ae, enforcement] = await Promise.all([
          getRxNormProperties(args.rxcui),
          getRelatedConcepts(args.rxcui, ["IN", "BN", "SCD"]),
          resolveLabel(args.rxcui, ctx.env),
          fetchAdverseEventCounts(args.rxcui, { limit: 25 }, ctx.env),
          fetchEnforcement(args.rxcui, ctx.env),
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

        const spl = labelResolution.label ? openFdaToSpl(labelResolution.label) : undefined;
        const adverseSummary: AdverseEventSummary = {
          rxcui: args.rxcui,
          top_reactions: ae.top.map((t) => ({ reaction: t.term, count: t.count })),
          ...(ae.total !== undefined ? { total_reports: ae.total } : {}),
        };
        const activeRecalls = enforcement
          .filter((r) => isActiveRecall(r.status))
          .map((r) => toRecallSummary(r as unknown as { [k: string]: unknown }));

        // Free-tier: surface the queried drug's FDA-label "Drug Interactions"
        // prose. See `get_drug_interactions` for the rationale (NLM retired
        // RxNav DDI in Jan 2024 + DrugBank academic licenses are gone).
        const labelDdi = labelResolution.label?.drug_interactions;
        const interactions: InteractionReport = {
          queried_rxcuis: [args.rxcui],
          interactions: [],
          source: "fda-label-prose",
          label_interactions: [
            {
              rxcui: args.rxcui,
              ...(labelResolution.generic_name ? { name: labelResolution.generic_name } : {}),
              ...(labelDdi?.length
                ? { drug_interactions: labelDdi }
                : { note: "No FDA label drug_interactions section available." }),
            },
          ],
        };

        const profile: DrugFullProfile = {
          record,
          ...(spl ? { label: spl } : {}),
          adverse_events: adverseSummary,
          active_recalls: activeRecalls,
          interactions,
        };
        return { profile, resolverWarning: labelResolutionWarning(labelResolution) };
      },
    );
    const profile = data.profile;
    const labelWarning = data.resolverWarning;

    const sources: Source[] = [rxnormSource(args.rxcui, profile.record.name)];
    if (profile.label?.set_id) {
      sources.push(
        openFdaSource({
          title: profile.label.brand_name
            ? `openFDA label: ${profile.label.brand_name}`
            : `openFDA label ${profile.label.set_id}`,
          url: `https://api.fda.gov/drug/label.json?search=openfda.rxcui:${args.rxcui}`,
          identifier: profile.label.set_id,
          identifier_type: "setid",
        }),
      );
    }
    sources.push(
      openFdaSource({
        title: `openFDA FAERS adverse events for RxCUI ${args.rxcui}`,
        url: `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.rxcui:${args.rxcui}`,
        identifier: args.rxcui,
        identifier_type: "rxcui",
      }),
    );
    if (profile.active_recalls.length > 0) {
      sources.push(
        openFdaSource({
          title: `openFDA enforcement for RxCUI ${args.rxcui}`,
          url: `https://api.fda.gov/drug/enforcement.json?search=openfda.rxcui:${args.rxcui}`,
          identifier: args.rxcui,
          identifier_type: "rxcui",
        }),
      );
    }

    const warnings = [
      "Free-tier interactions are FDA-label prose under `interactions.label_interactions[]`, not pairwise structured DDI — read each entry and cross-reference manually. Configure LEXICOMP_API_KEY or MICROMEDEX_API_KEY (planned) for clinician-grade pairwise DDI; a paid DRUGBANK_API_KEY also works if you have one (DrugBank no longer issues academic licenses).",
    ];
    if (labelWarning) warnings.push(labelWarning);

    return makeResult({
      data: profile,
      sources,
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      warnings,
    });
  },
});

/* -------------------------------------------------------------------------- */

const safetySummaryTool = defineTool({
  name: "safety_summary",
  description:
    "Pull the safety-relevant FDA label sections (boxed warning, contraindications, warnings, populations) plus any active recalls for an RxCUI.",
  inputSchema: {
    ...crossCuttingShape,
    rxcui: z.string().regex(RXCUI_RE).describe("RxNorm RxCUI."),
  },
  handler: async (args, ctx): Promise<ToolResult<SafetySummary>> => {
    const { data, cache } = await withCache(
      ctx,
      "safety_summary",
      args,
      { ttl_s: DEFAULT_TTL_S.dailymed_label },
      async () => {
        const [labelResolution, enforcement] = await Promise.all([
          resolveLabel(args.rxcui, ctx.env),
          fetchEnforcement(args.rxcui, ctx.env),
        ]);
        const spl: StructuredProductLabel | undefined = labelResolution.label
          ? openFdaToSpl(labelResolution.label)
          : undefined;
        const summary: SafetySummary = {
          rxcui: args.rxcui,
          ...(spl?.sections.boxed_warning ? { boxed_warning: spl.sections.boxed_warning } : {}),
          ...(spl?.sections.contraindications
            ? { contraindications: spl.sections.contraindications }
            : {}),
          ...(spl?.sections.warnings_and_precautions
            ? { warnings_and_precautions: spl.sections.warnings_and_precautions }
            : {}),
          ...(spl?.sections.adverse_reactions
            ? { adverse_reactions: spl.sections.adverse_reactions }
            : {}),
          ...(spl?.sections.pregnancy ? { pregnancy: spl.sections.pregnancy } : {}),
          ...(spl?.sections.lactation ? { lactation: spl.sections.lactation } : {}),
          ...(spl?.sections.pediatric_use ? { pediatric_use: spl.sections.pediatric_use } : {}),
          ...(spl?.sections.geriatric_use ? { geriatric_use: spl.sections.geriatric_use } : {}),
          active_recalls: enforcement
            .filter((r) => isActiveRecall(r.status))
            .map((r) => toRecallSummary(r as unknown as { [k: string]: unknown })),
        };
        return { summary, resolverWarning: labelResolutionWarning(labelResolution) };
      },
    );

    const summary = data.summary;
    const labelWarning = data.resolverWarning;

    const sources: Source[] = [
      openFdaSource({
        title: `openFDA label for RxCUI ${args.rxcui}`,
        url: `https://api.fda.gov/drug/label.json?search=openfda.rxcui:${args.rxcui}`,
        identifier: args.rxcui,
        identifier_type: "rxcui",
      }),
    ];
    if (summary.active_recalls.length > 0) {
      sources.push(
        openFdaSource({
          title: `openFDA enforcement for RxCUI ${args.rxcui}`,
          url: `https://api.fda.gov/drug/enforcement.json?search=openfda.rxcui:${args.rxcui}`,
          identifier: args.rxcui,
          identifier_type: "rxcui",
        }),
      );
    }

    return makeResult({
      data: summary,
      sources,
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      ...(labelWarning ? { warnings: [labelWarning] } : {}),
    });
  },
});

/* -------------------------------------------------------------------------- */

function crclBand(crcl: number): string {
  if (crcl >= 90) return "normal (≥90 mL/min)";
  if (crcl >= 60) return "mildly decreased (60–89 mL/min)";
  if (crcl >= 30) return "moderately decreased (30–59 mL/min)";
  if (crcl >= 15) return "severely decreased (15–29 mL/min)";
  return "kidney failure (<15 mL/min)";
}

/** Filter `use_in_specific_populations` paragraphs to those discussing renal impairment. */
function renalParagraphs(label: OpenFdaLabel): string[] | undefined {
  const populations = label.use_in_specific_populations;
  if (!populations) return undefined;
  const matches = populations.filter((p) =>
    /renal\s+impair|kidney|crcl|creatinine clearance/i.test(p),
  );
  return matches.length > 0 ? matches : undefined;
}

const renalDoseAdjustmentTool = defineTool({
  name: "renal_dose_adjustment",
  description:
    "Surface renal-impairment dose-adjustment guidance from the FDA label for a drug, given a patient's creatinine clearance. Free-tier guidance is the relevant label prose; structured renal dose tables ship with the licensed tier in milestone 7.",
  inputSchema: {
    ...crossCuttingShape,
    rxcui: z.string().regex(RXCUI_RE).describe("RxNorm RxCUI."),
    crcl_ml_min: z
      .number()
      .positive()
      .describe("Patient creatinine clearance in mL/min (e.g. from calc_creatinine_clearance)."),
  },
  handler: async (args, ctx): Promise<ToolResult<DoseAdjustmentReport>> => {
    const { data, cache } = await withCache(
      ctx,
      "renal_dose_adjustment",
      args,
      { ttl_s: DEFAULT_TTL_S.dailymed_label },
      async () => {
        const labelResolution = await resolveLabel(args.rxcui, ctx.env);
        const label = labelResolution.label;
        const renalSpecific = label ? renalParagraphs(label) : undefined;
        const report: DoseAdjustmentReport = {
          rxcui: args.rxcui,
          parameter: { name: "creatinine clearance", value: args.crcl_ml_min, unit: "mL/min" },
          band: crclBand(args.crcl_ml_min),
          label_excerpts: {
            ...(label?.dosage_and_administration
              ? { dosage_and_administration: label.dosage_and_administration }
              : {}),
            ...(renalSpecific ? { use_in_specific_populations: renalSpecific } : {}),
          },
        };
        return { report, resolverWarning: labelResolutionWarning(labelResolution) };
      },
    );

    const report = data.report;
    const labelWarning = data.resolverWarning;

    const warnings: string[] = [
      "Free-tier renal dose guidance is FDA label prose, not a structured dose table. Confirm against the full label and clinical judgement.",
    ];
    if (Object.keys(report.label_excerpts).length === 0) {
      warnings.push(
        "No FDA label found for this RxCUI — no renal dose-adjustment text to surface.",
      );
    }
    if (labelWarning) warnings.push(labelWarning);

    return makeResult({
      data: report,
      sources: [
        openFdaSource({
          title: `openFDA label (renal dosing) for RxCUI ${args.rxcui}`,
          url: `https://api.fda.gov/drug/label.json?search=openfda.rxcui:${args.rxcui}`,
          identifier: args.rxcui,
          identifier_type: "rxcui",
        }),
        makeSource({
          title: "clinicalai-mcp — renal dose guidance note (ARCHITECTURE.md §5.1)",
          url: "https://github.com/OpenClinicalAI/clinicalai-mcp/blob/main/ARCHITECTURE.md",
          publisher: "clinicalai-mcp",
        }),
      ],
      tier: "free",
      cache,
      phi_mode: args.phi_mode,
      warnings,
    });
  },
});

/* -------------------------------------------------------------------------- */

export const compositeDrugTools: ToolDef[] = [
  getDrugFullProfileTool,
  safetySummaryTool,
  renalDoseAdjustmentTool,
];
