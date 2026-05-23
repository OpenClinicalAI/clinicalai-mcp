/**
 * Convert an openFDA label record into the canonical {@link StructuredProductLabel}
 * shape. openFDA varies between `warnings_and_precautions` /
 * `warnings_and_cautions` / plain `warnings` — we treat them as the same slot.
 */

import type { OpenFdaLabel } from "./clients/openfda.js";
import type { StructuredProductLabel } from "./types.js";

export function openFdaToSpl(label: OpenFdaLabel): StructuredProductLabel {
  const oa = label.openfda ?? {};
  return {
    ...(label.set_id ? { set_id: label.set_id } : {}),
    ...(oa.brand_name?.[0] ? { brand_name: oa.brand_name[0] } : {}),
    ...(oa.generic_name?.[0] ? { generic_name: oa.generic_name[0] } : {}),
    ...(oa.manufacturer_name?.[0] ? { manufacturer: oa.manufacturer_name[0] } : {}),
    ...(oa.rxcui ? { rxcui: oa.rxcui } : {}),
    sections: {
      ...(label.boxed_warning ? { boxed_warning: label.boxed_warning } : {}),
      ...(label.indications_and_usage
        ? { indications_and_usage: label.indications_and_usage }
        : {}),
      ...(label.dosage_and_administration
        ? { dosage_and_administration: label.dosage_and_administration }
        : {}),
      ...(label.contraindications ? { contraindications: label.contraindications } : {}),
      ...((label.warnings_and_precautions ?? label.warnings_and_cautions ?? label.warnings)
        ? {
            warnings_and_precautions:
              label.warnings_and_precautions ?? label.warnings_and_cautions ?? label.warnings,
          }
        : {}),
      ...(label.adverse_reactions ? { adverse_reactions: label.adverse_reactions } : {}),
      ...(label.drug_interactions ? { drug_interactions: label.drug_interactions } : {}),
      ...(label.use_in_specific_populations
        ? { use_in_specific_populations: label.use_in_specific_populations }
        : {}),
      ...(label.pediatric_use ? { pediatric_use: label.pediatric_use } : {}),
      ...(label.geriatric_use ? { geriatric_use: label.geriatric_use } : {}),
      ...(label.pregnancy ? { pregnancy: label.pregnancy } : {}),
      ...(label.lactation ? { lactation: label.lactation } : {}),
      ...(label.overdosage ? { overdosage: label.overdosage } : {}),
      ...(label.clinical_pharmacology
        ? { clinical_pharmacology: label.clinical_pharmacology }
        : {}),
    },
  };
}
