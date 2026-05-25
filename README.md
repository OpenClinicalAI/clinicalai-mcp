# clinicalai-mcp

Part of the [OpenClinicalAI](https://github.com/OpenClinicalAI) umbrella.

Open-source [MCP](https://modelcontextprotocol.io) servers exposing free, public
clinical data sources to agent hosts (Claude Desktop, Claude Code, third-party
agent frameworks).

The goal: the open, auditable equivalent of closed clinical-AI products — every
tool, every prompt, every data source, and every evaluation method visible and
verifiable end-to-end.

See:
- [CHARTER.md](CHARTER.md) — mission, scope, funding posture, competitive strategy, per-domain tactical playbooks
- [ARCHITECTURE.md](ARCHITECTURE.md) — full system design

## Status

**v0.1 — in progress.** All four domain servers ship. Calculator coverage is
expanding across the inventory; clinician-validation pass and eval harness are
the v0.1 release gates.

| Milestone | Scope | Status |
|---|---|---|
| 1 | Scaffold + `@openclinicalai/shared`: types, cache, policy, PHI, server scaffold, CI | ✅ done |
| 2 | PHI redaction backends (foundation, presidio, openmed, ensemble, custom) + compare/evaluate tools | ✅ done |
| 3 | `@openclinicalai/calc` — 28 calculators (24 atomic + 4 composite) + tree-class framework + discovery tools | 🟡 expanding (see [calculator coverage](#calculator-coverage)) |
| 4 | `@openclinicalai/drugs` — openFDA + RxNorm + DailyMed + 3 composites + free-tier interactions via FDA-label prose | ✅ done (dosing-calculator surface queued — see [`docs/DRUG_DOSING_CALCULATORS.md`](docs/DRUG_DOSING_CALCULATORS.md)) |
| 5 | `@openclinicalai/evidence` — PubMed eutils + ClinicalTrials.gov + USPSTF snapshot + summarize/compare composites | ✅ done |
| 6 | `@openclinicalai/terminologies` — ICD-10-CM + LOINC + UMLS slot | ✅ done |
| 7 | Licensed-tier code paths — DrugBank DDI client (academic tier closed; Lexicomp / Micromedex are the realistic future targets) + UMLS (SNOMED CT, cross-vocab) | ✅ done |
| 8 | Clinician validation pass + eval harness (ARCHITECTURE.md §9, §11.8–10) | ⬜ next |

## Packages

| Package | Description |
|---|---|
| `@openclinicalai/shared` | Shared types, cache, deployment-policy loader, PHI redaction, and the MCP server scaffold mounted by every domain server. |
| `@openclinicalai/calc` | Pure-compute clinical calculators. Four implementation patterns (`formula` / `lookup` / `tree` / `multi-step`); discovery tools filter and describe by both domain and complexity. Current surface: 28 tools (24 atomic + 4 composite). `npx -y @openclinicalai/calc` runs the stdio MCP server. |
| `@openclinicalai/drugs` | openFDA + RxNorm + DailyMed wrappers — drug search, RxNorm lookup, label, adverse events, recalls, free-tier interactions (FDA-label `drug_interactions` prose per RxCUI), and the `get_drug_full_profile` / `safety_summary` / `renal_dose_adjustment` composites. Dosing-calculator surface lands in this package, not `calc`. `npx -y @openclinicalai/drugs`. |
| `@openclinicalai/evidence` | PubMed (eutils) + ClinicalTrials.gov wrappers — article search, full-text fetch, related articles, systematic-review search, trial search/lookup, plus the `summarize_evidence` and `compare_treatments` composites. Also hosts USPSTF preventive-care recommendations from a bundled snapshot (AHRQ license clause on every result). `npx -y @openclinicalai/evidence`. |
| `@openclinicalai/terminologies` | ICD-10-CM + LOINC via NLM Clinical Tables, plus the `map_concept_across_vocabs` and `code_workup` composites. SNOMED CT / cross-vocab via UMLS is a wired-but-inactive slot (LICENSE_REQUIRED until milestone 7). `npx -y @openclinicalai/terminologies`. |

## Calculator coverage

The calculator universe across the major catalogs is around 900+ named tools
(MDCalc) with ~55 academically benchmarked in NCBI MedCalc-Bench v1.0. We
track the full universe in structured form so contributors can pick a row,
follow the primary-derivation PMID, and submit a PR:

| Catalog | Entries | Purpose |
|---|---|---|
| [`docs/CALCULATOR_INVENTORY.md`](docs/CALCULATOR_INVENTORY.md) | 1,203 cross-walked rows | The full v0.1 → v1.0 roadmap — every clinical calculator we know about, cross-walked against MDCalc / MedCalc-Bench / nobra_calculator / vitaldb, with primary-derivation PMID on every row. |
| [`docs/MEDCALC_BENCH_36.md`](docs/MEDCALC_BENCH_36.md) | 44 implementation briefs | Per-calc implementation packets (inputs / formula / bands / worked fixtures) for the unshipped MedCalc-Bench calcs — the highest-leverage batch since they already carry numeric ground truth for CI validation. |
| [`docs/PEDIATRIC_CALCULATORS.md`](docs/PEDIATRIC_CALCULATORS.md) | 92 peds rows | Pediatrics is structurally underrepresented in every cross-domain catalog. This is a society-direct catalog (AAP / AHA / PALS / NRP / WHO / CDC / ESPGHAN / ISPAD / IPNA / PICS) with a 20-calc must-have shortlist for v0.1. |
| [`docs/DRUG_DOSING_CALCULATORS.md`](docs/DRUG_DOSING_CALCULATORS.md) | 64 dosing tools | The drug-dosing surface that lands in `@openclinicalai/drugs` rather than `calc` (calc-vs-drugs boundary rule: any tool needing an RxCUI input or returning a drug-specific output goes to `drugs`). 13-tool v0.1 shortlist. |

Contribution path: pick a `wishlist` row from the inventory, follow the PMID,
implement against `packages/calc/src/framework.ts`'s `defineCalculator()`, add
test fixtures (MedCalc-Bench-sourced when available; otherwise hand-crafted
from the derivation paper), submit a PR. See the contribution guide at the top
of [`docs/CALCULATOR_INVENTORY.md`](docs/CALCULATOR_INVENTORY.md).

## Repo layout

```
clinicalai-mcp/
├── packages/
│   ├── shared/         @openclinicalai/shared
│   ├── calc/           @openclinicalai/calc
│   ├── drugs/          @openclinicalai/drugs
│   ├── evidence/       @openclinicalai/evidence
│   └── terminologies/  @openclinicalai/terminologies
├── examples/
│   ├── eval-harness/   thin Anthropic-SDK agent for clinician validation runs
│   └── policies/       documented deployment-policy templates
├── docs/               calculator inventories + implementation briefs
├── ARCHITECTURE.md     full design doc
└── CHARTER.md          mission, scope, funding, competitive strategy
```

## Developing

Requires Node 20+ and pnpm 9+.

```sh
pnpm install
pnpm -r build       # tsup dual ESM/CJS bundles
pnpm -r typecheck   # tsc --noEmit across all packages
pnpm -r test        # vitest
pnpm exec biome check .   # lint + format
```

## Compliance notes

- **No PHI leaves the process.** Tools never transmit PHI to upstream public
  APIs. This is a hard floor enforced at the schema level (the `phi-lint` CI
  rule rejects PHI-shaped field names) and the policy layer — see
  ARCHITECTURE.md §3.5.
- **Cloud foundation PHI redaction requires a BAA + Zero Data Retention
  contract** with your model provider. The
  [`examples/policies/covered_entity.yaml`](examples/policies/covered_entity.yaml)
  template makes this explicit. If you don't have those contracts, use
  [`examples/policies/covered_entity_local.yaml`](examples/policies/covered_entity_local.yaml)
  (local Ollama-compatible endpoint — PHI never leaves the deployment).
- **Zero telemetry.** Nothing in this project phones home. See
  ARCHITECTURE.md §3.6.
- **Calculators we cannot ship under Apache-2.0.** MMSE (PAR Inc. copyright),
  MoCA (MoCA Clinic licensing), STS Cardiac Surgery Risk (closed coefficients),
  and BOADICEA/CanRisk (non-commercial license only). All four are widely used;
  we acknowledge the gap rather than silently omit them. See CHARTER.md §4.4.

## License

Apache 2.0. See [LICENSE](LICENSE). A use-restriction clause is planned for
v0.1 to bar autonomous clinical AI applications that cut clinicians out of the
loop — see CHARTER.md §0 for the rationale.
