/**
 * ClinicalTrials.gov v2 API client (NIH, free).
 *
 * https://clinicaltrials.gov/api/v2 returns each study under a nested
 * `protocolSection` of modules. The mappers here flatten the modules we care
 * about into the {@link TrialSummary} / {@link Trial} shapes.
 */

import { getUpstreamJson } from "@openclinicalai/shared";
import type { Trial, TrialPhase, TrialStatus, TrialSummary } from "../types.js";

const CT_BASE = "https://clinicaltrials.gov/api/v2";

/* -------------------------------------------------------------------------- */
/* Response shapes (narrow — we only type the fields we read).                 */
/* -------------------------------------------------------------------------- */

interface CtStudyResponse {
  studies?: CtStudy[];
  nextPageToken?: string;
}

interface CtStudy {
  protocolSection?: CtProtocolSection;
}

interface CtProtocolSection {
  identificationModule?: { nctId?: string; briefTitle?: string; officialTitle?: string };
  statusModule?: {
    overallStatus?: string;
    startDateStruct?: { date?: string };
    completionDateStruct?: { date?: string };
  };
  sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
  descriptionModule?: { briefSummary?: string; detailedDescription?: string };
  conditionsModule?: { conditions?: string[] };
  designModule?: { phases?: string[] };
  armsInterventionsModule?: { interventions?: { type?: string; name?: string }[] };
  eligibilityModule?: {
    eligibilityCriteria?: string;
    minimumAge?: string;
    maximumAge?: string;
    sex?: string;
  };
  contactsLocationsModule?: {
    locations?: { facility?: string; city?: string; country?: string }[];
  };
}

/* -------------------------------------------------------------------------- */
/* User-facing token → CT.gov enum value                                        */
/* -------------------------------------------------------------------------- */

const STATUS_MAP: Record<TrialStatus, string> = {
  recruiting: "RECRUITING",
  "not-yet-recruiting": "NOT_YET_RECRUITING",
  "enrolling-by-invitation": "ENROLLING_BY_INVITATION",
  "active-not-recruiting": "ACTIVE_NOT_RECRUITING",
  completed: "COMPLETED",
  suspended: "SUSPENDED",
  terminated: "TERMINATED",
  withdrawn: "WITHDRAWN",
};

const PHASE_MAP: Record<TrialPhase, string> = {
  "early-phase1": "EARLY_PHASE1",
  phase1: "PHASE1",
  phase2: "PHASE2",
  phase3: "PHASE3",
  phase4: "PHASE4",
  "n-a": "NA",
};

/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

function trialSummaryFromStudy(study: CtStudy): TrialSummary | null {
  const p = study.protocolSection;
  const nctId = p?.identificationModule?.nctId;
  const briefTitle = p?.identificationModule?.briefTitle;
  if (!nctId || !briefTitle) return null;
  const summary: TrialSummary = { nct_id: nctId, brief_title: briefTitle };
  const status = p?.statusModule?.overallStatus;
  if (status) summary.overall_status = status;
  const conditions = p?.conditionsModule?.conditions;
  if (conditions?.length) summary.conditions = conditions;
  const phases = p?.designModule?.phases;
  if (phases?.length) summary.phases = phases;
  const startDate = p?.statusModule?.startDateStruct?.date;
  if (startDate) summary.start_date = startDate;
  const completionDate = p?.statusModule?.completionDateStruct?.date;
  if (completionDate) summary.completion_date = completionDate;
  const sponsor = p?.sponsorCollaboratorsModule?.leadSponsor?.name;
  if (sponsor) summary.sponsor = sponsor;
  return summary;
}

function trialFromStudy(study: CtStudy): Trial | null {
  const summary = trialSummaryFromStudy(study);
  if (!summary) return null;
  const p = study.protocolSection;
  const trial: Trial = { ...summary };
  const brief = p?.descriptionModule?.briefSummary;
  if (brief) trial.brief_summary = brief;
  const detailed = p?.descriptionModule?.detailedDescription;
  if (detailed) trial.detailed_description = detailed;
  const elig = p?.eligibilityModule;
  if (elig?.eligibilityCriteria) trial.eligibility_criteria = elig.eligibilityCriteria;
  if (elig?.minimumAge) trial.minimum_age = elig.minimumAge;
  if (elig?.maximumAge) trial.maximum_age = elig.maximumAge;
  if (elig?.sex) trial.sex = elig.sex;
  const interventions = p?.armsInterventionsModule?.interventions
    ?.map((i) => ({ type: i.type ?? "", name: i.name ?? "" }))
    .filter((i) => i.name);
  if (interventions?.length) trial.interventions = interventions;
  const locations = p?.contactsLocationsModule?.locations
    ?.map((l) => ({
      ...(l.facility ? { facility: l.facility } : {}),
      ...(l.city ? { city: l.city } : {}),
      ...(l.country ? { country: l.country } : {}),
    }))
    .filter((l) => Object.keys(l).length > 0);
  if (locations?.length) trial.locations = locations;
  return trial;
}

/* -------------------------------------------------------------------------- */
/* Public client functions                                                     */
/* -------------------------------------------------------------------------- */

export interface CtSearchFilters {
  query?: string;
  condition?: string;
  intervention?: string;
  location?: string;
  status?: TrialStatus[];
  phase?: TrialPhase[];
  pageSize?: number;
}

/** Search ClinicalTrials.gov. */
export async function searchTrials(filters: CtSearchFilters): Promise<TrialSummary[]> {
  const url = new URL(`${CT_BASE}/studies`);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageSize", String(filters.pageSize ?? 25));
  if (filters.query) url.searchParams.set("query.term", filters.query);
  if (filters.condition) url.searchParams.set("query.cond", filters.condition);
  if (filters.intervention) url.searchParams.set("query.intr", filters.intervention);
  if (filters.location) url.searchParams.set("query.locn", filters.location);
  if (filters.status?.length) {
    url.searchParams.set(
      "filter.overallStatus",
      filters.status.map((s) => STATUS_MAP[s]).join(","),
    );
  }
  if (filters.phase?.length) {
    url.searchParams.set("filter.phase", filters.phase.map((p) => PHASE_MAP[p]).join(","));
  }
  const json = await getUpstreamJson<CtStudyResponse>({
    service: "clinicaltrials",
    url: url.toString(),
  });
  return (json.studies ?? [])
    .map(trialSummaryFromStudy)
    .filter((s): s is TrialSummary => s !== null);
}

/** Fetch a single study by NCT ID. */
export async function getTrial(nctId: string): Promise<Trial | null> {
  const url = new URL(`${CT_BASE}/studies/${encodeURIComponent(nctId)}`);
  url.searchParams.set("format", "json");
  let study: CtStudy;
  try {
    study = await getUpstreamJson<CtStudy>({
      service: "clinicaltrials",
      url: url.toString(),
    });
  } catch (err) {
    if ((err as { payload?: { code?: string } }).payload?.code === "NOT_FOUND") return null;
    throw err;
  }
  return trialFromStudy(study);
}
