# clinicalai-mcp

Part of the [OpenClinicalAI](https://github.com/OpenClinicalAI) umbrella.

Open-source [MCP](https://modelcontextprotocol.io) servers exposing free, public clinical
data sources to agent hosts (Claude Desktop, Claude Code, third-party agent frameworks).

The goal: the open, auditable equivalent of closed clinical-AI products — every tool, every
prompt, every data source, and every evaluation method visible and verifiable end-to-end.

See [CHARTER.md](CHARTER.md) for the project's mission, scope, structural commitments, and competitive strategy; [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

## Status

**v0.1 — in progress.** Milestone 1 (repo scaffold + `@openclinicalai/shared`) is the first
deliverable. The four domain servers (`drugs`, `evidence`, `calc`, `terminologies`) follow.

| Milestone | Scope | Status |
|---|---|---|
| 1 | Scaffold + `@openclinicalai/shared`: types, cache, policy, PHI, server scaffold, CI | ✅ done |
| 2 | PHI redaction backends (foundation, presidio, openmed, ensemble, custom) + compare/evaluate tools | ✅ done |
| 3 | `@openclinicalai/calc` — 19 calculators (atomic + composite) + discovery tools | ✅ done |
| 4 | `@openclinicalai/drugs` — openFDA + RxNorm + DailyMed wrappers + 3 composites | ✅ done |
| 5 | `@openclinicalai/evidence` — PubMed eutils + ClinicalTrials.gov + USPSTF snapshot + summarize/compare composites | ✅ done |
| 6 | `@openclinicalai/terminologies` — ICD-10-CM + LOINC + UMLS slot | ✅ done |
| 7 | Licensed-tier code paths — DrugBank DDI client (preserved for paying customers; academic licenses no longer issued, so free-tier DDI surfaces FDA-label prose and Lexicomp/Micromedex are the realistic future licensed targets) + UMLS (SNOMED CT, cross-vocab) | ✅ done |
| 8 | Clinician validation pass + eval harness (§9, §11.8–10) | ⬜ next |

## Packages

| Package | Description |
|---|---|
| `@openclinicalai/shared` | Shared types, cache, deployment-policy loader, PHI redaction, and the MCP server scaffold mounted by every domain server. |
| `@openclinicalai/calc` | Pure-compute clinical calculators (renal/metabolic, cardiology, pulmonary/VTE, critical care, and composite workups). `npx -y @openclinicalai/calc` runs the stdio MCP server. |
| `@openclinicalai/drugs` | openFDA + RxNorm + DailyMed wrappers — drug search, RxNorm lookup, label, adverse events, recalls, free-tier interactions (FDA-label `drug_interactions` prose per RxCUI), and the `get_drug_full_profile` / `safety_summary` / `renal_dose_adjustment` composites. `npx -y @openclinicalai/drugs` runs the stdio MCP server. |
| `@openclinicalai/evidence` | PubMed (eutils) + ClinicalTrials.gov wrappers — article search, full-text fetch, related articles, systematic-review search, trial search/lookup, plus the `summarize_evidence` and `compare_treatments` composites. Also hosts USPSTF preventive-care recommendations from a bundled snapshot (AHRQ license clause on every result) — USPSTF is evidence-derived guideline material, not a code vocabulary. `npx -y @openclinicalai/evidence` runs the stdio MCP server. |
| `@openclinicalai/terminologies` | ICD-10-CM + LOINC via NLM Clinical Tables, plus the `map_concept_across_vocabs` and `code_workup` composites. SNOMED CT / cross-vocab via UMLS is a wired-but-inactive slot (LICENSE_REQUIRED until milestone 7). `npx -y @openclinicalai/terminologies` runs the stdio MCP server. |

## Repo layout

```
clinicalai-mcp/
├── packages/
│   └── shared/          @openclinicalai/shared
├── examples/
│   └── policies/        documented deployment-policy templates
└── ARCHITECTURE.md      full design doc
```

## Developing

Requires Node 20+ and pnpm 9+.

```sh
pnpm install
pnpm build       # tsup dual ESM/CJS bundles
pnpm typecheck   # tsc --noEmit across all packages
pnpm test        # vitest
pnpm lint        # biome
```

## Compliance notes

- **No PHI leaves the process.** Tools never transmit PHI to upstream public APIs. This is a
  hard floor enforced at the schema level and the policy layer — see ARCHITECTURE.md §3.5.
- **Zero telemetry.** Nothing in this project phones home. See ARCHITECTURE.md §3.6.
- Deployment-policy templates for `personal`, `covered_entity`, and `research_deid`
  deployments live in [`examples/policies/`](examples/policies/).

## License

Apache 2.0. See [LICENSE](LICENSE).
