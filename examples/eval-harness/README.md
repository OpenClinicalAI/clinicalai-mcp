# clinical-mcp eval-harness

A thin Anthropic-SDK agent that drives the clinical-mcp suite, intended for
ARCHITECTURE.md §9 item 2 ("eval harness") and §9 item 3 / §11 item 8
(clinician validation). It spawns one MCP server as a stdio subprocess,
converts its tool list into Anthropic tool definitions, and runs Claude through
a manual tool-use loop while printing a readable transcript.

## Prerequisites

```sh
corepack pnpm install
corepack pnpm -r build                  # build the four domain servers first
export ANTHROPIC_API_KEY=sk-ant-...     # for --question / --prompt-set
```

`OPENFDA_API_KEY`, `NCBI_API_KEY`, `DRUGBANK_API_KEY`, `UMLS_API_KEY` are
inherited from the env if set — the spawned servers receive them and license
tiers light up accordingly.

## Three usage patterns

```sh
# 1) List what a server exposes (no API key needed)
corepack pnpm --filter @clinical-mcp/eval-harness start -- \
  --server calc --list-tools

# 2) Call one tool directly with raw JSON args (no API key needed)
corepack pnpm --filter @clinical-mcp/eval-harness start -- \
  --server calc --tool calc_chads_vasc \
  --args '{"age_y":76,"sex":"F","congestive_heart_failure":false,"hypertension":true,"diabetes":true,"stroke_tia_thromboembolism":true,"vascular_disease":false}'

# 3) Run the agent loop on a clinical question (uses ANTHROPIC_API_KEY)
corepack pnpm --filter @clinical-mcp/eval-harness start -- \
  --server calc \
  --question "CHA2DS2-VASc for a 76yo woman with HTN, diabetes, and prior stroke?"

# 4) Sweep all bundled questions for one server
corepack pnpm --filter @clinical-mcp/eval-harness start -- \
  --server evidence --prompt-set prompts/clinical-cases.json
```

## Model

Defaults to `claude-opus-4-7` with adaptive thinking (`display: "summarized"`)
so the transcript shows Claude's reasoning between tool calls — that's the
point of running this as the §9.3 validation surface. The system prompt nudges
Claude to cite the `sources` URLs from each tool result in its final answer.

## What the transcript looks like

```
═══════════════════════════════════════════════════════════════════
Question: CHA2DS2-VASc for a 76yo woman with HTN, diabetes, and prior stroke?
═══════════════════════════════════════════════════════════════════

[Turn 1 • thinking]
The patient is 76yo (age ≥75 → 2) female (sex → 1) with HTN (1), DM (1), prior
stroke (→ 2). Total expected: 7. Will call calc_chads_vasc.

[Turn 1 • tool_use] calc_chads_vasc
{
  "age_y": 76,
  "sex": "F",
  ...
}

[tool_result] calc_chads_vasc
{ "data": { "result": 7, "interpretation": { "band": "high — anticoagulation recommended", ... }, ...

[Turn 2 • assistant]
The patient's CHA2DS2-VASc score is 7 (high risk; anticoagulation recommended).
Per the Lip 2010 derivation (PubMed PMID 19762550) ...

[summary] 2 turn(s), 1 tool call(s), stop_reason=end_turn
```

## What it does NOT do (yet)

- No MedCalc-Bench numeric validation (§11 item 3 calls for this in CI).
- No outcome scoring — it prints transcripts; a clinician reads them. Adding a
  rubric/grader is the natural next step.
- No `cache: "only"` reproducibility mode — populate the cache by running once
  in `--cache fresh` mode, then re-run with `--cache only` for deterministic
  re-runs (not yet wired into the harness CLI; pass `cache` via the tool args
  for now if you want it).
