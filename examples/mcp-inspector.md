# MCP Inspector quickstart

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a tiny
debugging UI that connects to one stdio MCP server, lets you call individual
tools with raw JSON inputs, and shows the full `ToolResult` envelope back —
data, sources, warnings, cache hit, redaction report. It's the right surface for
engineering-side QA before a clinician sees the suite end-to-end.

## Prerequisites

```sh
corepack pnpm install
corepack pnpm -r build
```

## Launch the inspector against one server

Pick a server and run the inspector with `node` pointing at its built bin:

```sh
# @openclinicalai/calc
npx @modelcontextprotocol/inspector node packages/calc/dist/cli.js

# @openclinicalai/drugs (set the openFDA key if you have one)
OPENFDA_API_KEY=your-key npx @modelcontextprotocol/inspector node packages/drugs/dist/cli.js

# @openclinicalai/evidence (NCBI key raises rate limit but isn't required)
NCBI_API_KEY=your-key npx @modelcontextprotocol/inspector node packages/evidence/dist/cli.js

# @openclinicalai/terminologies (UMLS key activates SNOMED tools)
UMLS_API_KEY=your-key npx @modelcontextprotocol/inspector node packages/terminologies/dist/cli.js
```

The Inspector opens at `http://localhost:5173`. It lists every tool exposed by
the server (including the 5 shared meta tools `describe_capabilities`,
`describe_policy`, `redact_phi`, `compare_redaction_backends`, and
`evaluate_redaction`) and renders each tool's JSON-schema input form.

## Representative checks per server

Use these as a smoke test that the full ToolResult envelope is well-formed
before turning a clinician loose on Claude Desktop.

### `@openclinicalai/calc`

| Tool | Inputs | Look for in the result |
|---|---|---|
| `calc_chads_vasc` | `{age_y: 76, sex: "F", congestive_heart_failure: false, hypertension: true, diabetes: true, stroke_tia_thromboembolism: false, vascular_disease: false}` | `data.result === 5`, primary-literature citation in `sources`, `interpretation.band` mentions "high" |
| `calc_creatinine_clearance` | `{age_y: 70, weight_kg: 80, sex: "M", serum_creatinine_mg_dl: 1.2}` | `data.result === 64.8`, unit "mL/min", Cockcroft-Gault Nephron 1976 citation |
| `list_calculators` | `{domain: "composite"}` | Returns 4 composites |
| `describe_calculator` | `{name: "calc_meld"}` | Returns Zod input schema rendered to JSON Schema + Kamath 2001 / Kim 2008 citations |

### `@openclinicalai/drugs`

| Tool | Inputs | Look for |
|---|---|---|
| `search_drugs` | `{query: "metformin"}` | RxCUI list back; `tier: "free"`; NLM source URL |
| `safety_summary` | `{rxcui: "6809"}` | Boxed warning + contraindications; FDA source |
| `get_drug_interactions` | `{rxcuis: ["6809", "4821"]}` (no DRUGBANK key) | Empty interactions + clear warning about NLM API retirement + license suggestion |
| `redact_phi` | `{text: "Reach me at a@b.com"}` | `redacted_text` contains `[REDACTED:EMAIL]` |

### `@openclinicalai/evidence`

| Tool | Inputs | Look for |
|---|---|---|
| `search_pubmed` | `{query: "SGLT2 heart failure", publication_types: ["rct"], limit: 5}` | Recent ArticleSummary records with PMIDs, NIH source |
| `summarize_evidence` | `{question: "Does metformin reduce mortality in T2DM?"}` | `evidence_grade` ∈ {high, moderate, low, insufficient}; SR/RCT/recruiting buckets populated |
| `get_trial` | `{nct_id: "NCT00000620"}` | Flattened Trial record (eligibility, interventions, etc.) |
| `search_uspstf` | `{query: "screening"}` | Multiple recommendations + **AHRQ license clause in `warnings`** |
| `list_uspstf_by_grade` | `{grade: "A"}` | Filtered list + AHRQ warning |

### `@openclinicalai/terminologies`

| Tool | Inputs | Look for |
|---|---|---|
| `search_icd10` | `{query: "type 2 diabetes"}` | E11.x codes back |
| `map_concept_across_vocabs` | `{term: "glucose"}` | ICD-10 + LOINC mappings, SNOMED-omitted note (or SNOMED filled if `UMLS_API_KEY` is set) |
| `search_snomed` | `{query: "diabetes"}` (no UMLS key) | `LICENSE_REQUIRED` error with suggestion to set `UMLS_API_KEY` |

## What you're verifying

Concretely the Inspector is the fastest way to validate:

1. **Citations are populated and stable.** Every clinical-claim result has a `sources` array with linkable URLs.
2. **`tier` is correct** — `"free"` / `"compute"` for the free/calc tiers, `"licensed-drugbank"` or `"licensed-umls"` when those env vars are set.
3. **Interpretive bands feel right** — the `interpretation.band` and `interpretation.detail` text on calculators / composites is what you'd want to see at the bedside (§9.3 release-gate territory).
4. **AHRQ disclaimer is on every USPSTF result** (`warnings` includes it).
5. **`redact_phi` actually redacts** in your deployment's configured backend (regex by default; foundation/presidio/openmed/ensemble/custom if you've set up a policy).

For natural-language clinician testing rather than tool-by-tool probing, use
[claude-desktop-config.local.json](claude-desktop-config.local.json) instead.
