/**
 * Resolve an FDA label for an RxCUI, with a fallback chain that handles the
 * ingredient-vs-product mismatch:
 *
 *   1. Try `openfda.rxcui:<rxcui>` directly. Hits for product-level RxCUIs
 *      (SCD/SBD/etc.) that openFDA indexes.
 *   2. If empty, fetch the RxNorm name and try `openfda.generic_name:"<name>"`.
 *      Catches ingredient-level RxCUIs whose labels live on specific products.
 *
 * Why this matters: a clinician asking for metformin's safety summary expects
 * the boxed warning to show up. RxCUI 6809 is the *ingredient* concept;
 * openFDA has no label tied to it directly, even though every metformin
 * product has the lactic-acidosis boxed warning. Without this fallback the
 * `safety_summary` tool silently returns empty fields.
 */

import {
  type OpenFdaLabel,
  fetchLabelByGenericName,
  fetchLabelByRxcui,
} from "./clients/openfda.js";
import { getRxNormProperties } from "./clients/rxnorm.js";

export interface LabelResolution {
  label: OpenFdaLabel | null;
  /** How the label was found, if at all. */
  matched_via: "rxcui" | "generic_name" | "none";
  /** The generic name we fell back on, if any. */
  generic_name?: string;
}

/** Try direct RxCUI match, then fall back to generic_name. */
export async function resolveLabel(
  rxcui: string,
  env: NodeJS.ProcessEnv,
): Promise<LabelResolution> {
  const direct = await fetchLabelByRxcui(rxcui, env);
  if (direct) return { label: direct, matched_via: "rxcui" };

  const props = await getRxNormProperties(rxcui);
  if (!props?.name) return { label: null, matched_via: "none" };

  const byName = await fetchLabelByGenericName(props.name, env);
  if (byName) {
    return { label: byName, matched_via: "generic_name", generic_name: props.name };
  }
  return { label: null, matched_via: "none", generic_name: props.name };
}

/**
 * Build a warning describing how the label was resolved. Returns `undefined`
 * for a direct-hit (the default case — no warning needed).
 */
export function labelResolutionWarning(resolution: LabelResolution): string | undefined {
  if (resolution.matched_via === "rxcui") return undefined;
  if (resolution.matched_via === "generic_name") {
    return `No FDA label was indexed for this RxCUI directly (common for ingredient-level RxCUIs). Fell back to a generic_name match on "${resolution.generic_name}" — verify the surfaced label is for the intended product.`;
  }
  return resolution.generic_name
    ? `No FDA label found for "${resolution.generic_name}" (RxCUI lookup and generic_name fallback both empty).`
    : "No FDA label found for this RxCUI (RxCUI lookup and generic_name fallback both empty).";
}
