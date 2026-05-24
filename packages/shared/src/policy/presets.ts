/**
 * Named policy presets, selectable via `CLINICALAI_MCP_POLICY`.
 *
 * A preset is just a `PolicyFile` — it goes through exactly the same default
 * resolution and fail-loud validation as a user-supplied YAML file.
 *
 * Note: `covered_entity` selected purely by name will FAIL validation, because
 * a covered-entity deployment requires a real `logging.audit_sink` that only the
 * deploying org can supply. That failure is intentional (§3.5.3) — covered
 * entities must provide a reviewed policy file, not a bare preset name.
 */

import type { DeploymentType } from "../types.js";
import type { PolicyFile } from "./schema.js";

export const PRESETS: Record<DeploymentType, PolicyFile> = {
  personal: {
    deployment_type: "personal",
  },
  covered_entity: {
    deployment_type: "covered_entity",
    // audit_sink intentionally absent — see file header.
  },
  research_deid: {
    deployment_type: "research_deid",
  },
};

/** Names accepted by `CLINICALAI_MCP_POLICY`. */
export const PRESET_NAMES = Object.keys(PRESETS) as DeploymentType[];
