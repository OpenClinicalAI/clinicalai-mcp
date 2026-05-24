# OpenClinicalAI `clinicalai-mcp` — Architecture

**Status:** scoping → ready to start v0.1
**Owner:** Karl
**Audience:** the broader clinical-AI community (open source first), with Karl's company as a downstream consumer
**License:** Apache 2.0

---

## 1. Mission and scope

### Why this exists

The clinical AI landscape today is dominated by closed-source products — OpenEvidence, Doximity's clinical assistant, and a handful of EHR-embedded tools — that offer real capability but no transparency about how they work. Their prompts are hidden, their data sources are unverifiable in detail, their evaluation methodology is internal. For clinicians making decisions and researchers studying clinical AI, that opacity is a problem.

This project's goal is to build the open-source equivalent — *real* Open Evidence — where every component is visible and auditable:

- **Source code** for every tool, every wrapper, every redaction pipeline.
- **Prompts** for every foundation-model-backed component (PHI redaction, composite-tool interpretive logic, anywhere a model is invoked).
- **Data sources** named, cited, and traceable to primary literature.
- **Evaluation methodology** published, with reproducible benchmarks.

Paired with the community-supported PubMed MCP, this suite forms the open backbone of a clinical evidence agent that a clinician, researcher, or hospital can fully understand and verify end-to-end.

The roadmap includes engaging academic clinicians to formally evaluate this stack against OpenEvidence and Doximity's clinical AI, with the goal of publishing comparative-performance benchmarks. The bar isn't "open." The bar is "open and at-parity-or-better." If we ship the first and not the second we haven't done the work.

The broader stance: the future of AI in clinical intelligence should not be exclusively owned by a handful of well-capitalized vendors. The same tools that let a Silicon Valley startup build a billion-dollar clinical product should be available, transparent, and auditable to a community hospital, a public-health researcher, a clinician in a low-resource setting, and the patients those clinicians serve. This project is one piece of making that real.

### What we're building

An open-source suite of MCP (Model Context Protocol) servers that expose free, public clinical data sources to agent hosts (Claude Desktop, Claude Code, third-party agent frameworks). The goal is to close the gap between general-purpose agent capability and clinician-grade reference workflows — drug lookups, evidence search, clinical calculators, terminology resolution — without forcing every team to rebuild the same wrappers.

Each server exposes multiple tools (MCPs are not one-tool-per-server; the protocol just has a server advertise a flat tool list). Servers are sliced by domain so that tools which naturally chain together share types, identifiers, and composite operations.

### Naming and structure

- **Umbrella project / GitHub org:** **OpenClinicalAI** (`github.com/openclinicalai`). The umbrella covers this MCP suite and any sibling repos that emerge over time (eval harness, reference agent implementation, curated datasets, etc.).
- **This repo:** **`clinicalai-mcp`** (`github.com/openclinicalai/clinicalai-mcp`). The MCP server suite — the meat of the project at v0.1, but explicitly not the only thing the umbrella will ever ship.
- **npm scope:** **`@openclinicalai`**. Each MCP server is its own package under that scope: `@openclinicalai/drugs`, `@openclinicalai/evidence`, `@openclinicalai/calc`, `@openclinicalai/terminologies`, plus `@openclinicalai/shared` for the common layer.
- **Environment variable prefix:** `CLINICALAI_MCP_*` for configuration scoped to this suite (e.g., `CLINICALAI_MCP_POLICY`, `CLINICALAI_MCP_CACHE_URL`). Future sibling products under the umbrella would use their own prefixes.
- **Local cache dir:** `~/.clinicalai-mcp/` by default.

### Design priorities

1. **Citation-first.** Every clinical claim returned by any tool carries a stable, linkable source. This is what makes the difference between an agent that sounds confident and an agent a clinician can verify.
2. **PHI-aware, deployment-policy-driven.** Tools never transmit PHI to upstream public APIs (NIH, FDA, etc. are not BAA partners and this is a universal regulatory floor). Beyond that floor, PHI handling — caching, logging, audit — is governed by a deployment policy chosen at server startup and a per-call `phi_mode` flag, so the system fits both personal-laptop and covered-entity deployments.
3. **License-tier graceful degradation.** Tools work on the free tier; if the user configures a license (DrugBank, Lexicomp, UMLS, etc.), the same tool returns richer data and marks the source. Agents don't branch on license state.
4. **Local-first, zero-ops.** Default deployment is `npx`-installable, runs as a per-user stdio process, uses local SQLite for caching. Pluggable for shared backends if a hospital ever wants one.
5. **Agent-friendly return shapes.** Default to flat, extracted, citation-ready payloads. Raw upstream blobs available behind `verbose: true`.
6. **Clinician-validated.** Every clinical interpretive layer — composite-tool synthesis text, calculator interpretive bands, redaction prompt language, any place this project puts words a clinician might read and treat as guidance — must pass clinician review before that surface ships. Subtle wrong-feels in clinical interpretive text are worse than the agent doing the synthesis itself. This is a release gate on user-facing interpretive content, not on framework code.
7. **Zero telemetry.** Nothing this project ships phones home. Not anonymous counts, not startup pings, not error reports. See §3.6 for the rationale.

---

## 2. The four MCP servers

| Server | Bundles | Why it's grouped |
|---|---|---|
| `@openclinicalai/drugs` | openFDA, DailyMed, RxNorm | All three cross-reference via RxCUI; composite operations are natural |
| `@openclinicalai/evidence` | PubMed (eutils), ClinicalTrials.gov, USPSTF (bundled snapshot) | Same query patterns, literature/study/guideline lookup |
| `@openclinicalai/calc` | Pure-compute clinical calculators | No external API, no rate limits, no licensing — distributable as a static package |
| `@openclinicalai/terminologies` | NLM Clinical Tables (ICD-10-CM, LOINC), (UMLS at licensed tier) | Code lookup with shared query patterns |

**Grouping principle:** tools that chain together (e.g. RxCUI → label → adverse events) belong in the same server so they can share type definitions and offer composite tools. Tools that don't chain shouldn't be coupled.

**What's deliberately out of scope for v0.1:**

- Clinical guidelines (UpToDate, DynaMed, NCCN). These are a procurement problem, not an engineering problem, and shouldn't block the open-source release.
- Real-time EHR integration. PHI invariant rules this out by construction.
- Clinician-grade DDI on the free tier. RxNorm has limited interaction data (NDF-RT is deprecated); design the slot so a licensed source can fill it.

---

## 3. Cross-cutting conventions

These conventions apply to every tool in every server. They live in `packages/shared/` and are enforced via TypeScript types + runtime validators.

### 3.1 Return shape contract

Every tool returns an object of this shape:

```ts
interface ToolResult<T> {
  schema_version: "1";              // Negotiation point for future contract changes
  data: T;                          // The flat, extracted answer
  sources: Source[];                // 1..N citations, never empty for clinical claims
  tier: DataTier;                   // "free" | "licensed-<vendor>"
  retrieved_at: string;             // ISO 8601 UTC
  cache: { hit: boolean; age_s: number };
  phi_mode: PhiMode;                // Echoed back so callers can audit
  phi_redaction_applied?: PhiRedactionReport;  // Present when sensitive mode redacted upstream-bound text
  verbose?: unknown;                // Raw upstream payload, only present when verbose: true
  warnings?: string[];              // Soft signals: data freshness, license suggestions, etc.
}

interface Source {
  title: string;                    // Human-readable title
  url: string;                      // Stable, linkable URL
  identifier?: string;              // PMID, NCT ID, RxCUI, SetID, etc.
  identifier_type?: string;         // "pmid" | "nct" | "rxcui" | "setid" | "icd10" | ...
  publisher?: string;               // "NLM" | "FDA" | "ClinicalTrials.gov" | ...
  retrieved_at: string;             // ISO 8601 UTC
}

type DataTier =
  | "free"
  | "licensed-drugbank"
  | "licensed-lexicomp"
  | "licensed-micromedex"
  | "licensed-umls"
  | "compute"; // for clinical-calc, no external source

type PhiMode = "safe" | "sensitive";  // see §3.5 for semantics

interface PhiRedactionReport {
  applied: true;
  categories: PhiCategory[];          // which patterns fired
  count: number;                      // total redactions across all string inputs
}

type PhiCategory =
  | "name" | "mrn" | "date" | "address" | "phone" | "email" | "ssn" | "insurance_id";
```

Every tool input schema also accepts these two optional cross-cutting parameters:

```ts
interface CrossCuttingInputs {
  verbose?: boolean;                  // default false
  phi_mode?: PhiMode;                 // default "safe" (can be elevated by deployment policy)
  cache?: "default" | "fresh" | "only";  // see §4.3
}
```

**Rationale:** the agent and downstream auditors can always answer "where did this come from, when, and at what data quality." Citations are a first-class field, not buried in metadata.

### 3.2 Citation contract

- Every tool that returns clinical information **must** populate `sources` with at least one entry.
- The first entry in `sources` is the primary source; subsequent entries are supporting/cross-referenced.
- URLs must be stable and resolve to the underlying record (not a search results page).
- Calculators cite the published formula (e.g. "Cockcroft-Gault, Nephron 1976") in `sources` with `tier: "compute"`.

### 3.3 Error envelope

Errors are returned as MCP tool errors with a structured payload:

```ts
interface ToolError {
  code: ErrorCode;
  message: string;            // Human-readable, safe to surface to the user
  retryable: boolean;
  upstream?: {                // Present when the failure originated from a 3rd-party API
    service: string;          // "pubmed" | "openfda" | ...
    status?: number;
    request_id?: string;
  };
  suggestion?: string;        // e.g. "Set OPENFDA_API_KEY to raise rate limit from 240/min to 120k/day"
}

type ErrorCode =
  | "INVALID_INPUT"           // Caller's fault, do not retry
  | "NOT_FOUND"               // Resource does not exist
  | "RATE_LIMITED"            // Retry with backoff
  | "UPSTREAM_UNAVAILABLE"    // 3rd-party down
  | "LICENSE_REQUIRED"        // Tool path requires a license the user hasn't configured
  | "CACHE_MISS_REQUIRED_HIT" // Caller passed cache: "only" and there was no hit
  | "INTERNAL";
```

`LICENSE_REQUIRED` is for tools that have **no** free-tier fallback. Tools with degraded free behavior return `tier: "free"` with a `warnings` entry instead of erroring.

### 3.4 License-tier convention

This is project-wide and not negotiable per-MCP — consistency is the value.

- The tool name stays the same regardless of license state. Agents do not branch.
- The tool description explicitly states what changes when a license is present, and which env var configures it.
- License keys are read from env vars at server startup; missing keys are not errors, just a downgraded tier.
- The `tier` field on every result tells the caller which source backed the answer.
- A meta tool `describe_capabilities()` (in `packages/shared`, mounted on every server — see §5.0) returns the active license set so an agent can surface this to the user if asked.

**Configured licenses and the env vars that activate them:**

| Env var | Tier value | What it unlocks |
|---|---|---|
| `OPENFDA_API_KEY` | stays `"free"` (just raises rate limit) | Higher openFDA quotas |
| `NCBI_API_KEY` | stays `"free"` (just raises rate limit) | Higher PubMed eutils quotas (3 → 10 req/sec) |
| `DRUGBANK_API_KEY` | `"licensed-drugbank"` | Enriched drug records, clinician-grade DDI |
| `LEXICOMP_API_KEY` | `"licensed-lexicomp"` | DDI, dosing, monographs |
| `MICROMEDEX_API_KEY` | `"licensed-micromedex"` | DDI, IV compatibility |
| `UMLS_API_KEY` | `"licensed-umls"` | SNOMED, cross-vocab concept mapping, ICD-10-CM enrichment |

### 3.5 PHI handling

PHI handling has two layers: a **deployment policy** chosen at server startup that sets defaults for the whole process, and a **per-call `phi_mode` flag** that lets the calling agent declare whether *this specific call* may contain PHI. Both work against one non-negotiable floor:

> **Universal floor — not policy-controllable:** No tool transmits PHI to upstream public APIs (PubMed eutils, openFDA, RxNorm, DailyMed, ClinicalTrials.gov, NLM Clinical Tables, USPSTF). These endpoints belong to NIH and FDA and are not BAA partners with anyone. Free-text upstream-bound fields are run through redaction in `sensitive` mode regardless of deployment policy.

#### 3.5.1 Schema-level invariants

Independent of policy and per-call flags:

- No tool input has a parameter that is by semantic a patient identifier (`patient_name`, `mrn`, `dob`, `address`, `ssn`, `email`, `phone`, `insurance_id`). Calculator tools accept clinical values (age, weight, vitals, lab values); search tools accept queries and identifiers (RxCUI, PMID, NCT ID, ICD-10 code). A `phi_lint` rule in CI scans every tool schema and rejects PHI-shaped field names.
- This is a schema rule, not a refusal-to-operate rule. The MCP is a reference-lookup layer; PHI fields would be a category error here.

#### 3.5.2 Per-call `phi_mode`

Every tool accepts `phi_mode?: "safe" | "sensitive"`. The default is `safe`, but a deployment policy can elevate the default to `sensitive` process-wide.

**`safe` (default):** the caller asserts no PHI is present.
- Normal caching, normal debug logging.
- Verbose echo of upstream responses permitted.
- If any input string matches a PHI pattern, the result includes a `warnings` entry suggesting `phi_mode: "sensitive"` — soft nudge, not enforcement.

**`sensitive`:** the caller declares PHI may be in the inputs.
- Cache *writes* skipped (reads from existing cache still allowed; cached clinical reference data has no per-patient info).
- Logging switches to audit-only: timestamp, tool name, returned source URLs, `phi_mode`, but never input payloads.
- `verbose` field is stripped from the response (raw upstream JSON often echoes the query).
- Any free-text field destined for upstream egress is run through the configured PHI redaction backend (see §3.5.4) before the upstream call. `phi_redaction_applied` is populated on the result with categories and count.
- Best-effort redaction is advertised as such — it's a defense layer, not a guarantee. The schema-level invariant is the actual guarantee.

#### 3.5.3 Deployment policy

Selected via `CLINICALAI_MCP_POLICY` (named preset) or `CLINICALAI_MCP_POLICY_FILE` (YAML path). The policy is read once at startup and immutable for the process lifetime.

**`personal` (default):** conservative; assumes no infrastructure-level protections.
- Cache writes blocked entirely when `phi_mode: "sensitive"`.
- Logging stays out of files; structured audit events go to stderr only.
- PHI-pattern warnings in `safe` mode are enabled.
- Suitable for: laptops, students, casual users, anyone running this outside a covered environment.

**`covered_entity`:** assumes the org has BAA-covered infrastructure, FDE, audit pipeline, retention policy.
- Cache writes permitted in `sensitive` mode (hashed-keyed, encrypted-at-rest if a passphrase is configured via `CLINICALAI_MCP_CACHE_ENCRYPTION_KEY`).
- Audit events ship to a configured sink (`syslog://`, `file://`, or `https://` webhook).
- PHI-pattern warnings in `safe` mode can be downgraded to silent (covered entities often don't need the nudge).
- Suitable for: hospital deployments where IT has reviewed the policy YAML and configured surrounding controls.

**`research_deid`:** assumes inputs have been HIPAA safe-harbor de-identified upstream.
- Effectively `personal` minus PHI-pattern warnings (false positives on de-identified clinical text become noise).
- Suitable for: research environments operating on already-de-identified datasets.

Policy YAML schema (lives in `packages/shared/policy-schema.json`, validated at startup):

```yaml
# clinicalai-mcp deployment policy
deployment_type: covered_entity   # personal | covered_entity | research_deid
cache:
  persist_sensitive_inputs: true  # default depends on deployment_type
  encrypted_at_rest: true         # informs default cache dir + warns if key absent
logging:
  audit_sink: "syslog://localhost:514"
  payload_redaction: false        # full payloads ok if CE has audit pipeline
  phi_pattern_warnings: false     # silence nudges in CE deployments
upstream_egress:
  phi_policy: deny                # universal floor, not user-overridable
```

A `describe_policy()` meta tool (mounted on every server via the shared package) returns the active policy *and a SHA-256 hash of the loaded YAML* so a hospital's compliance team can verify the running config matches the approved version. The hash is computed after env-var resolution so secrets don't appear in it but the resolved policy state does.

**Fail-loud validation.** The policy YAML is validated at startup. Bad combinations cause the server to refuse to start with a clear error pointing at the offending field. The rules:

- If `deployment_type: covered_entity`, then `logging.audit_sink` MUST be non-null. (A covered-entity deployment without an audit sink is a misconfiguration, not a soft default.)
- If `cache.persist_sensitive_inputs: true`, then `cache.encrypted_at_rest: true` AND `CLINICALAI_MCP_CACHE_ENCRYPTION_KEY` env var MUST be set.
- `upstream_egress.phi_policy` MUST equal `deny`. Any other value rejects the policy. (The universal floor is enforced as a config-level invariant too, so a misconfigured YAML can't accidentally relax it.)
- All env vars referenced by the policy MUST resolve at startup. Unresolved references error out rather than silently defaulting.
- `deployment_type: research_deid` with `phi_redaction.backend: foundation` warns but does not error — de-identified data shouldn't need redaction but it's not wrong.

Validation errors print the policy section that failed, the rule it violated, and the env var or field name to fix. No partial-start, no degraded mode — the process exits non-zero so orchestration layers (systemd, Docker, Kubernetes) treat it as a deploy failure.

This is what replaces the original "no PHI" invariant: instead of one rigid rule, an explicit policy layer that matches the deployment's actual compliance posture, plus a per-call flag for situational control, plus a non-negotiable floor on what leaves the process, plus fail-loud validation that prevents misconfiguration from looking like a working system.

#### 3.5.4 PHI redaction backends

Redaction is not a single algorithm; it's a pluggable backend chosen at startup via the policy YAML. This reflects empirical testing, not theoretical preference: off-the-shelf clinical NER models (OpenMed and other BioBERT-family redactors) and rule-based stacks (Microsoft Presidio's default configuration) **fail to generalize** on real clinical content outside the corpora they were trained on. They miss embedded dates in narrative notes, surnames in non-Western formats, structured identifiers in free-text, and the long tail of de-identification cases that the published benchmarks don't capture. Presidio's regex+NER stack performs respectably on form-like inputs and collapses on transcripts and clinical narratives. We tested these so the documentation doesn't have to be hedged about it.

The most reliable general-purpose redactor we've found is a foundation model with the verbatim HIPAA Safe Harbor §164.514(b)(2)(i) identifiers in its system prompt — materially better recall on the long tail, at the cost of latency and per-call inference. But different deployments have different content profiles (a primary-care free-text dictation looks nothing like a discharge summary looks nothing like a billing claim), so the right answer is to ship multiple backends and give users the tools to *empirically* select what works for their content. Picking one backend and hoping it generalizes is exactly the failure mode we're trying to avoid.

```ts
type RedactionBackend =
  | "regex"        // built-in, deterministic, fast, low recall on names
  | "presidio"     // wrapper around Microsoft Presidio (sidecar)
  | "openmed"      // wrapper around OpenMed-NER (sidecar)
  | "foundation"   // foundation model with verbatim Safe Harbor system prompt
  | "ensemble"     // run multiple backends, union the spans
  | "custom";      // user-provided JS module path

interface RedactionConfig {
  backend: RedactionBackend;
  // Per-backend config; only the relevant block needs to be populated
  regex?: { categories?: PhiCategory[] };
  presidio?: { url: string; api_key_env?: string };
  openmed?: { url: string; api_key_env?: string };
  foundation?: {
    provider: "anthropic" | "openai" | "local";
    model: string;
    api_key_env: string;
    prompt_template: "safe_harbor_verbatim" | "custom";
    custom_prompt_path?: string;
  };
  ensemble?: { backends: RedactionBackend[]; mode: "union" | "intersection" };
  custom?: { module_path: string };
}
```

**`regex` (default for `personal` deployment):** deterministic patterns for names (limited recall — surname-only patterns plus a curated common-name list), MRN-shaped numbers, dates, addresses, phones, emails, SSN, insurance IDs. Fast, no network, no model dependency. Honest about its limitations — emits a `warnings` entry noting that name-redaction recall is the weak point.

**`foundation` (recommended for `covered_entity` deployment):** sends each free-text input to a configured foundation model with the verbatim HIPAA Safe Harbor §164.514(b)(2)(i) identifier list in the system prompt. The model returns redacted text plus a structured spans list. Costs API calls and adds latency, but materially better recall on the long tail (typo'd names, embedded dates, geographic identifiers smaller than state). Local-model option supported via Ollama-compatible endpoint.

**`presidio` and `openmed`:** wrappers that talk to a sidecar service over HTTP. The MCP doesn't bundle the Python runtime — users stand up their own Presidio/OpenMed container and point the policy at it. Useful for shops that already have one of these in their stack.

**`ensemble`:** runs multiple backends, takes the union (most conservative — anything any backend flagged is redacted) or intersection (most precise — only spans all backends agreed on). Union is the safe default for clinical use.

**`custom`:** loads a JS module that exports a `redact(text, categories)` function returning the same shape as the built-ins. Allows orgs to plug in their own internal redactor without forking.

Two complementary tools in `packages/shared` make the backend selection empirical, not theoretical:

```ts
compare_redaction_backends(args: {
  text: string;
  backends: RedactionBackend[];
}): ToolResult<{
  results: { backend: RedactionBackend; redacted: string; spans: RedactionSpan[]; latency_ms: number }[];
}>

evaluate_redaction(args: {
  text: string;
  ground_truth_spans: RedactionSpan[];
  backend: RedactionBackend;
}): ToolResult<{
  precision: number;
  recall: number;
  f1: number;
  false_positives: RedactionSpan[];
  false_negatives: RedactionSpan[];
}>
```

`compare_redaction_backends` lets users paste sample content and see how each backend performs side-by-side. `evaluate_redaction` lets them score against a labeled dataset (their own corpus, MIMIC notes with i2b2 de-id annotations, etc.) so the selection is data-driven, not vibes.

The Safe Harbor prompt template lives in `packages/shared/src/phi/prompts/safe_harbor.md` and quotes 45 CFR §164.514(b)(2)(i) verbatim — name, geographic subdivisions smaller than state, all date elements (except year) for dates directly related to an individual (with the >89-year-old aggregation rule), phone numbers, fax numbers, email addresses, SSNs, MRNs, health plan beneficiary numbers, account numbers, certificate/license numbers, vehicle identifiers, device identifiers, URLs, IP addresses, biometric identifiers, full-face photos, and "any other unique identifying number, characteristic, or code." The verbatim regulatory text is the prompt content; we don't paraphrase. Open-source prompt content is part of the project's transparency commitment — every model invocation in this stack has its prompt published, viewable, and auditable.

### 3.6 Telemetry: none, by design

This project ships zero telemetry. No anonymous usage counts. No startup pings. No error reporting to a centralized sink. No per-call latency metrics phoning home. The MCP processes do their job and nothing leaves the local environment except the upstream API calls each tool explicitly documents.

This is an intentional design choice with three reasons:

1. **Trust gap.** Even level-1 telemetry (anonymous version-ping on startup) asks hospital IT and clinicians to *trust that the developer is doing only what they claim*. Hospital infosec has no way to audit what's actually sent without reading every line of source — and the moment our dependency tree changes, that audit is stale. Eliminating the question entirely is more credible than relying on policy disclosures or after-the-fact attestations.
2. **No clinical justification.** Telemetry in consumer software exists to inform product decisions — which features to invest in, which calculators get traffic, which queries fail. For an open-source clinical tool prioritizing correctness and citation rigor, those questions aren't what drive build decisions; the correctness of formulas, the quality of citations, and the validity of interpretive content are. The roadmap value of telemetry here is real but not high enough to spend the trust capital.
3. **Single bright line.** Either we phone home or we don't. Any intermediate posture — "anonymous counts, opt-out" — creates audit complexity, supply-chain risk (a future dependency change accidentally enabling something more invasive), and the perpetual question of what's "really" being sent. Zero is the only answer that's *auditable by reading one line of code*: there is no network call.

Users who want metrics for their *own* deployment configure the `logging.audit_sink` in their policy YAML (see §3.5.3) to ship structured events to their own SIEM, file, syslog, or HTTPS webhook. The audit sink is the user's pipeline, not ours. Nothing in this project sends data anywhere except to the explicitly-documented upstream APIs each tool wraps, and that surface is named in every tool's `sources` field on every result.

---

## 4. Caching

### 4.1 Default backend: SQLite (WAL)

- One SQLite file per MCP server, stored under `~/.clinicalai-mcp/<server>/cache.db` by default (overridable via `CLINICALAI_MCP_CACHE_DIR`).
- WAL mode enabled at open; thousands of reads/sec, single-writer serialization is not a concern at the per-user process scale.
- Schema:

```sql
CREATE TABLE cache (
  key TEXT PRIMARY KEY,         -- sha256 of (tool_name, normalized_args, tier)
  value BLOB NOT NULL,          -- gzipped JSON
  inserted_at INTEGER NOT NULL, -- unix seconds
  ttl_s INTEGER NOT NULL
);
CREATE INDEX idx_cache_inserted ON cache(inserted_at);
```

- **TTLs by source** (defaults, overridable per tool):
  - PubMed/ClinicalTrials.gov search results: 24h
  - DailyMed labels: 7d
  - RxNorm records: 7d
  - openFDA adverse events: 24h
  - USPSTF recommendations: 30d
  - Calculator results: not cached (pure compute)

### 4.2 Pluggable backend

The cache module exposes a `Cache` interface (`get`, `set`, `delete`, `purgeOlderThan`) implemented by:

- `SqliteCache` (default)
- `RedisCache` (activated when `CLINICALAI_MCP_CACHE_URL=redis://...`)
- `PostgresCache` (activated when `CLINICALAI_MCP_CACHE_URL=postgres://...`)
- `NoopCache` (activated when `CLINICALAI_MCP_CACHE_URL=none`, useful for testing/eval)

Cache is **smoothing, not source-of-truth.** If it disappears, the MCP still works, just slower. No tool reads from the cache without a freshness check against TTL.

### 4.3 Cache hint parameter

Every tool accepts an optional `cache` parameter:

```ts
cache?: "default" | "fresh" | "only"
// default: serve from cache if fresh, else fetch
// fresh:   bypass cache, fetch from upstream, repopulate cache
// only:    return from cache or fail with CACHE_MISS_REQUIRED_HIT
```

`"only"` is useful for offline eval runs and reproducible demos.

---

## 5. Tool inventories

These are first-pass tool surfaces — concrete enough to start scaffolding, loose enough to evolve in v0.1.

### 5.0 Shared meta tools

Mounted on every server via `packages/shared`. Always available regardless of which MCP is loaded.

```ts
describe_capabilities(): ToolResult<{
  server_name: string;
  server_version: string;
  active_licenses: DataTier[];          // which licensed tiers are configured
  available_tools: string[];
}>

describe_policy(): ToolResult<{
  deployment_type: "personal" | "covered_entity" | "research_deid";
  policy_hash: string;                  // SHA-256 of resolved policy state, for compliance verification
  cache_persists_sensitive_inputs: boolean;
  audit_sink: string | null;
  phi_pattern_warnings_enabled: boolean;
  phi_redaction_backend: RedactionBackend;
  upstream_phi_policy: "deny";          // universal floor, hardcoded
  validation_status: "valid";           // process won't have started otherwise — fail-loud at boot
}>

redact_phi(args: {
  text: string;
  categories?: PhiCategory[];           // default: all
  backend_override?: RedactionBackend;  // override the policy-configured backend for this call
}): ToolResult<{
  redacted_text: string;
  redactions: { category: PhiCategory; count: number }[];
  backend_used: RedactionBackend;
}>

compare_redaction_backends(args: {
  text: string;
  backends: RedactionBackend[];
}): ToolResult<{
  results: { backend: RedactionBackend; redacted: string; spans: RedactionSpan[]; latency_ms: number }[];
}>

evaluate_redaction(args: {
  text: string;
  ground_truth_spans: RedactionSpan[];
  backend: RedactionBackend;
}): ToolResult<{ precision: number; recall: number; f1: number; false_positives: RedactionSpan[]; false_negatives: RedactionSpan[] }>
```

`redact_phi` is exposed as a tool (not just used internally in `sensitive` mode) so an agent processing a patient chart can pre-redact before constructing search queries — the redaction logic stays shared between the per-call sensitive-mode pipeline and explicit caller use. `compare_redaction_backends` and `evaluate_redaction` exist so users can empirically select the right backend for their content rather than guess — see §3.5.4.

### 5.1 `@openclinicalai/drugs`

```ts
// Atomic lookups
search_drugs(query: string, limit?: number): ToolResult<DrugSummary[]>
get_drug_by_rxcui(rxcui: string): ToolResult<DrugRecord>
get_drug_label(setid_or_rxcui: string): ToolResult<StructuredProductLabel>
get_adverse_events(rxcui: string, since?: string, limit?: number): ToolResult<AdverseEventSummary>
get_drug_recalls(rxcui: string): ToolResult<RecallSummary[]>
get_drug_interactions(rxcuis: string[]): ToolResult<InteractionReport>   // tier-aware

// Composite / fan-out tools — earn their keep through interpretive logic on top of atomic results
get_drug_full_profile(rxcui: string): ToolResult<DrugFullProfile>
compare_drugs(rxcuis: string[]): ToolResult<DrugComparison>              // side-by-side mechanism, AE, indications
safety_summary(rxcui: string): ToolResult<SafetySummary>                 // black box + recalls + pregnancy/lactation + REMS
formulary_alternatives(rxcui: string): ToolResult<AlternativeSet>        // same-class drugs via RxNorm relationships
pediatric_drug_check(rxcui: string): ToolResult<PediatricSummary>        // pediatric label sections + dosing
geriatric_drug_check(rxcui: string): ToolResult<GeriatricSummary>        // Beers Criteria flags + geriatric label info
renal_dose_adjustment(rxcui: string, crcl_ml_min: number): ToolResult<DoseAdjustmentReport>
hepatic_dose_adjustment(rxcui: string, child_pugh?: "A"|"B"|"C"): ToolResult<DoseAdjustmentReport>
```

Tier behavior for `get_drug_interactions`:

- Free tier: returns whatever the now-deprecated NDF-RT and RxNorm relationship data still surface, with a `warnings` entry stating the limitation and the env vars that would unlock clinician-grade data.
- DrugBank/Lexicomp/Micromedex tiers: returns structured interaction records with severity, mechanism, and clinical management.

### 5.2 `@openclinicalai/evidence`

```ts
// Atomic lookups
search_pubmed(query: string, filters?: {
  publication_types?: PublicationType[];     // "RCT", "systematic-review", "meta-analysis", ...
  date_from?: string; date_to?: string;
  free_full_text?: boolean;
  limit?: number;
}): ToolResult<ArticleSummary[]>

get_article(pmid: string): ToolResult<Article>
find_related_articles(pmid: string, limit?: number): ToolResult<ArticleSummary[]>
find_systematic_reviews(query: string, limit?: number): ToolResult<ArticleSummary[]>  // pre-filtered

search_trials(query: string, filters?: {
  status?: TrialStatus[];                    // "recruiting", "completed", ...
  phase?: TrialPhase[];
  location?: string;
  intervention?: string;
  limit?: number;
}): ToolResult<TrialSummary[]>

get_trial(nct_id: string): ToolResult<Trial>
find_trials_for_condition(condition: string, limit?: number): ToolResult<TrialSummary[]>

// Composite / fan-out tools
summarize_evidence(question: string): ToolResult<EvidenceSummary>
  // Combines systematic-review filter + key RCTs + active recruiting trials, deduplicates,
  // emits a grade-of-evidence indicator based on study design + recency.

compare_treatments(args: {
  treatment_a: string;
  treatment_b: string;
  condition: string;
}): ToolResult<TreatmentComparison>
  // Head-to-head literature focused on comparative-effectiveness studies + meta-analyses.

literature_update(args: {
  prior_query: string;
  since_date: string;
}): ToolResult<ArticleSummary[]>
  // What's new in the literature since the last check — keyword-stable delta.

find_recruiting_trials_for(args: {
  condition: string;
  age_y?: number;                            // numeric clinical value, not PHI
  sex?: "M" | "F";
  location?: string;
  intervention_class?: string;
}): ToolResult<TrialSummary[]>
  // Recruiting-only, location-filtered, eligibility-matched where the trial publishes structured criteria.

// USPSTF preventive-care recommendations — see "USPSTF data ingestion" below for sourcing details.
// Lives in @openclinicalai/evidence because USPSTF recommendations are evidence-derived clinical
// guidelines (systematic-review-driven preventive-care recommendations with grades A/B/C/D/I), not
// a code vocabulary. They belong next to PubMed and ClinicalTrials.gov, not next to ICD-10/LOINC.
search_uspstf(query: string): ToolResult<RecommendationSummary[]>
get_uspstf_recommendation(id: string): ToolResult<Recommendation>
list_uspstf_by_grade(grade: "A"|"B"|"C"|"D"|"I"): ToolResult<RecommendationSummary[]>
```

**USPSTF data ingestion.** USPSTF/AHRQ runs a documented but **token-gated** API (the Prevention TaskForce API, formerly ePSS). Tokens are obtained by emailing `uspstfpda@ahrq.gov` — not anonymous, not self-serve. AHRQ explicitly recommends downloading and caching the full dataset locally; weekly refresh is sufficient.

The implementation is **hybrid snapshot-first, optional live mode**:

- Bundle a versioned snapshot (`packages/evidence/data/uspstf-YYYY-MM.json`) inside the package. Users get USPSTF coverage out of the box with no token, no API key, no network dependency for these lookups.
- Refresh monthly via a scripted pull from the live API (one maintainer holds the token; the snapshot is the redistributable artifact).
- Offer an optional `USPSTF_API_TOKEN` env var that activates live mode — when set, queries hit the live API and the snapshot becomes fallback.

**License caveat that must be surfaced.** USPSTF content is **not pure public domain.** AHRQ permits verbatim redistribution with attribution, but explicitly prohibits modifications to the text, reproduction for a fee, sale, or incorporation into a profit-making venture without written AHRQ permission. Every USPSTF tool's result includes a `warnings` entry that quotes the AHRQ disclaimer and the no-commercial-resale clause, and the README's "Compliance Notes" section calls this out so downstream consumers (especially commercial vendors building on this) are on notice. This is the kind of thing that gets people in trouble when it's a footnote; we treat it as a first-class output field.

### 5.3 `@openclinicalai/calc`

Each calculator is its own tool with a strictly typed schema. The set below is the v0.1 target — high-traffic calculators, formulas re-implemented from primary literature (cite the original paper in `sources`).

**Why not just use MDCalc:** MDCalc has no public compute API today. Their only programmatic surface is a SMART-on-FHIR EHR embed and a partnership-only commercial division — neither lets us call calc-as-a-function from an MCP. The Terms of Use don't permit scraping. So MDCalc is *not* available as a backing source for v0.1 regardless of partnership relationships. The plan: reimplement formulas from primary literature for the free tier, and design the tool surface so an `MDCalc-licensed` tier can be added later if MDCalc ever ships a compute API or licenses their evidence-content layer (pearls, validation studies, clinical guidance — the parts that aren't in the original papers). Tier values would be `"compute"` (free) and `"licensed-mdcalc"` (future).

**Why not fork an existing OSS calc library:** four Python libraries are available — `vitaldb/medcalc` (MIT, 59 tools), `Nobrega-Medtech/nobra_calculator` (Apache 2.0, 300+ tools, metadata-driven), `winninghealth/medcalcmcp` (Apache 2.0, derived from NCBI's MedCalc-Bench), and `alexgoodell/open-med-calc` (peer-reviewed in *npj Digital Medicine*, only 5 calcs but the highest scientific credibility). All Python. We picked Node/TS. Rather than depart from single-runtime for one package or shell out to Python, the plan is to port formulas natively into TypeScript, cite both the primary literature *and* the OSS reference implementation in each tool's `sources`, and validate every calculator numerically against the [MedCalc-Bench](https://github.com/ncbi-nlp/MedCalc-Bench) and [MedMCP-Calc](https://arxiv.org/html/2601.23049v1) benchmark suites in CI. This gets us scientific rigor without language lock-in.

```ts
// Renal / metabolic
calc_creatinine_clearance(args: { age_y: number; weight_kg: number; sex: "M"|"F"; serum_creatinine_mg_dl: number }): ToolResult<CalcResult>
calc_gfr_ckd_epi(args: { age_y: number; sex: "M"|"F"; race?: "black"|"other"; serum_creatinine_mg_dl: number }): ToolResult<CalcResult>
calc_meld(args: { bilirubin_mg_dl: number; inr: number; creatinine_mg_dl: number; sodium_meq_l?: number; on_dialysis?: boolean }): ToolResult<CalcResult>

// Cardiology
calc_chads_vasc(args: ChadsVascInputs): ToolResult<CalcResult>
calc_has_bled(args: HasBledInputs): ToolResult<CalcResult>
calc_grace(args: GraceInputs): ToolResult<CalcResult>
calc_timi_nstemi(args: TimiInputs): ToolResult<CalcResult>

// Pulmonology / VTE
calc_curb65(args: Curb65Inputs): ToolResult<CalcResult>
calc_wells_pe(args: WellsPeInputs): ToolResult<CalcResult>
calc_wells_dvt(args: WellsDvtInputs): ToolResult<CalcResult>
calc_pesi(args: PesiInputs): ToolResult<CalcResult>

// Critical care
calc_apache_ii(args: ApacheInputs): ToolResult<CalcResult>
calc_sofa(args: SofaInputs): ToolResult<CalcResult>
calc_qsofa(args: QsofaInputs): ToolResult<CalcResult>

// Discovery
list_calculators(domain?: string): ToolResult<CalculatorIndex>
describe_calculator(name: string): ToolResult<CalculatorSpec>  // returns full input schema + reference

// Composite / fan-out — interpretive logic over multiple atomic calculators
calc_kidney_workup(args: KidneyWorkupInputs): ToolResult<KidneyWorkupResult>
  // Cockcroft-Gault + CKD-EPI + (MDRD optional), with interpretive notes on which is appropriate when.

calc_cardiac_risk_panel(args: CardiacRiskInputs): ToolResult<CardiacRiskResult>
  // CHA2DS2-VASc + HAS-BLED with clinical net-benefit interpretation paired.

calc_sepsis_panel(args: SepsisPanelInputs): ToolResult<SepsisPanelResult>
  // qSOFA + SOFA + (APACHE II if ICU vitals provided), graded by data availability.

calc_pe_workup(args: PeWorkupInputs): ToolResult<PeWorkupResult>
  // Wells PE + PERC + PESI, with the diagnostic-pathway logic between them surfaced as interpretive text.
```

`CalcResult` includes the numeric output, the interpretive band (e.g. "low risk / intermediate / high"), the inputs as received (for auditing), and the original citation in `sources` (primary literature + OSS reference implementation where applicable).

### 5.4 `@openclinicalai/terminologies`

```ts
// ICD-10-CM (NLM Clinical Tables, free)
search_icd10(query: string, limit?: number): ToolResult<CodeMatch[]>
lookup_icd10(code: string): ToolResult<CodeRecord>

// LOINC (NLM Clinical Tables, free)
search_loinc(query: string, limit?: number): ToolResult<CodeMatch[]>
lookup_loinc(code: string): ToolResult<CodeRecord>

// SNOMED CT (UMLS, licensed)
search_snomed(query: string, limit?: number): ToolResult<CodeMatch[]>             // LICENSE_REQUIRED on free tier
lookup_snomed(code: string): ToolResult<CodeRecord>                                // LICENSE_REQUIRED on free tier

// Cross-vocab (UMLS, licensed)
lookup_concept(term: string, target_vocabs?: string[]): ToolResult<ConceptMap>     // LICENSE_REQUIRED on free tier

// Composite / fan-out
map_concept_across_vocabs(term: string): ToolResult<ConceptCrossMap>               // ICD-10 + LOINC + SNOMED (if licensed) + RxNorm
code_workup(term: string): ToolResult<CodeWorkup>                                  // ICD-10 candidates with hierarchical context, siblings, "consider also" set
```

**Note on USPSTF placement.** USPSTF preventive-care recommendations were originally part of `@openclinicalai/terminologies` (snapshot-style lookup pattern matched the ICD-10/LOINC implementation). In v0.1 they moved to `@openclinicalai/evidence` because USPSTF recommendations are evidence-derived clinical guidelines (systematic-review-driven, graded A/B/C/D/I), not a code vocabulary — and the natural cross-tool workflows ("find the RCTs cited by this USPSTF recommendation") chain through `search_pubmed`, not through ICD-10. See §5.2 for the current USPSTF tool surface and the AHRQ license-clause requirement.

---

## 6. Repo layout

Single GitHub repo, pnpm workspaces.

```
clinicalai-mcp/
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── ARCHITECTURE.md                 # this file
├── README.md
├── LICENSE                         # Apache 2.0
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint, type-check, test, phi-lint
│       └── release.yml             # changesets-based independent semver release
├── packages/
│   ├── shared/                     # @openclinicalai/shared
│   │   ├── src/
│   │   │   ├── types.ts            # ToolResult, Source, ToolError, DataTier, PhiMode
│   │   │   ├── cache/              # Cache interface + SqliteCache, RedisCache, ...
│   │   │   ├── citations.ts        # helpers for building Source objects
│   │   │   ├── license.ts          # env-var-driven tier detection
│   │   │   ├── policy/             # policy YAML loader + named presets + describe_policy tool
│   │   │   ├── phi/                # redact_phi tool + pattern library + sensitive-mode pipeline
│   │   │   ├── phi-lint.ts         # CI rule for schema-level PHI invariants
│   │   │   └── server.ts           # MCP server scaffold w/ describe_capabilities + describe_policy + redact_phi
│   │   └── package.json
│   ├── drugs/                      # @openclinicalai/drugs
│   ├── evidence/                   # @openclinicalai/evidence
│   ├── calc/                       # @openclinicalai/calc
│   └── terminologies/              # @openclinicalai/terminologies
└── examples/
    ├── claude-desktop-config.json  # ready-to-paste mcpServers block (personal mode)
    ├── claude-code-config.md
    ├── policies/
    │   ├── personal.yaml           # documented example of the default
    │   ├── covered_entity.yaml     # template for hospital IT to review
    │   └── research_deid.yaml
    └── eval-harness/               # offline eval with cache: "only"
```

Each package's `package.json` declares a `bin` so `npx @openclinicalai/drugs` runs the server directly. Each ships a CommonJS bundle so older Node versions in hospital environments don't break.

---

## 7. Runtime, tooling, releases

- **Runtime:** Node 20+ (LTS), TypeScript 5.x. ESM source, CJS + ESM dual bundles via `tsup`.
- **Lint/format:** Biome (faster than ESLint + Prettier, single config).
- **Testing:**
  - Unit tests with Vitest. Mock upstream APIs at the HTTP layer (MSW).
  - Snapshot tests for tool outputs (the return shape contract is part of the public API).
  - Integration tests against real upstream APIs, gated to `CI_INTEGRATION=1` and recorded as cassettes for the default test run.
- **Validation:** Zod schemas at every tool boundary. Tool input schemas are derived from Zod (`zod-to-json-schema`) so they stay in sync with what's advertised to the MCP host.
- **Releases:** Changesets. Each package versions independently; a single PR can release one or many packages.
- **Versioning:** semver. Breaking changes to the return shape contract are major bumps across all packages simultaneously.

---

## 8. Distribution

- **npm** from day one. Each package published under the `@openclinicalai` scope.
- **MCP registries:** publish to Anthropic's MCP registry and Smithery at v0.1. Discovery is the limiting factor for community adoption right now; being early is worth more than being polished.
- **Docker images:** not v0.1. Add later if hospital IT asks.
- **No PyPI:** single-runtime decision. If demand emerges, a Python client could be added as a thin wrapper that calls the Node servers over stdio.

### Install UX

Target install in a Claude Desktop config for the **default personal** deployment:

```json
{
  "mcpServers": {
    "clinical-drugs": {
      "command": "npx",
      "args": ["-y", "@openclinicalai/drugs"],
      "env": {
        "OPENFDA_API_KEY": "<optional>",
        "DRUGBANK_API_KEY": "<optional>"
      }
    },
    "clinical-evidence": {
      "command": "npx",
      "args": ["-y", "@openclinicalai/evidence"],
      "env": { "NCBI_API_KEY": "<optional>" }
    },
    "clinical-calc": {
      "command": "npx",
      "args": ["-y", "@openclinicalai/calc"]
    },
    "clinical-terminologies": {
      "command": "npx",
      "args": ["-y", "@openclinicalai/terminologies"],
      "env": { "UMLS_API_KEY": "<optional>" }
    }
  }
}
```

For a **covered-entity** deployment, add the policy env var or file to each server's `env` block:

```json
"env": {
  "CLINICALAI_MCP_POLICY_FILE": "/etc/clinicalai-mcp/policy.yaml",
  "CLINICALAI_MCP_CACHE_ENCRYPTION_KEY": "<from secrets manager>",
  "NCBI_API_KEY": "<optional>"
}
```

`policy.yaml` ships as an example in `examples/policies/covered_entity.yaml` so hospital IT has a starting template to review and adapt.

---

## 9. Open questions to resolve before v0.1

Most of the original open questions are resolved (see §10 for the audit trail). What remains:

1. **Calculator coverage scope.** The list in §5.3 is ~15 calculators. The OSS reference libraries cover 59–300+. What's the v0.1 cut? Recommendation: ship the ICU/cardiology/renal/VTE core (~25 calculators), prioritizing the high-traffic MDCalc set, and take community contributions for the long tail. Every shipped calculator must pass numeric validation against MedCalc-Bench.
2. **Eval harness.** Ship a thin eval runner in `examples/eval-harness/` that runs MedMCP-Calc + a fixed prompt set against the servers with `cache: "only"` so contributors can validate changes deterministically. Not blocking but high-leverage.
3. **Clinician validation pass — release gate.** Every clinical interpretive layer must be reviewed by practicing clinicians before v0.1 ships. This includes: composite-tool synthesis text (§5.1–5.4), calculator interpretive bands (the "low/moderate/high risk" language and thresholds), the Safe Harbor redaction prompt phrasing, and any tool documentation that describes clinical use. This is not a peer-review-of-formulas pass — that's MedCalc-Bench's job — it's a "does this text feel right to a clinician reading it under time pressure" pass. Karl + Adam first internal review; recruit 2–3 external academic clinicians (per the mission's stated goal of academic validation) for the formal v0.1 sign-off. Findings of "feels wrong" block the release on that surface even when math checks out.
4. **Custom redaction backend distribution.** If a user writes a custom redaction backend, how does it get loaded? Options: local file path in the policy YAML (simple, no isolation), or as an npm package with a known export shape (better isolation, requires publishing). Recommendation: support both — file path for quick experiments, npm package for production.
5. **Snapshot refresh cadence for USPSTF.** Monthly is sufficient given USPSTF update frequency, but worth deciding whether the snapshot tags trigger a patch release of `@openclinicalai/evidence` (gives users an automatic update path) or whether snapshots are downloaded at runtime from a CDN (avoids package churn but adds network dependency).

## 10. Decisions resolved during scoping

For audit-trail purposes; everything below is settled and reflected in the doc.

- **MDCalc as a backing source:** rejected. No public compute API exists; only a SMART-on-FHIR EHR embed and partnership-only commercial division. Reimplement formulas from primary literature; leave `licensed-mdcalc` tier slot for future content-enrichment partnership.
- **Forking an existing OSS calc library:** rejected. All four candidates (`vitaldb/medcalc`, `nobra_calculator`, `winninghealth/medcalcmcp`, `open-med-calc`) are Python; our suite is Node/TS. Port formulas natively, cite both primary literature and the OSS reference impl, validate numerically against MedCalc-Bench and MedMCP-Calc.
- **USPSTF data source:** documented but token-gated AHRQ API exists. Hybrid snapshot-first approach: bundle versioned snapshot, optional live mode via `USPSTF_API_TOKEN`. Surface the no-commercial-resale clause in every result.
- **`schema_version` on `ToolResult`:** added, defaulted to `"1"`.
- **Policy YAML hash in `describe_policy()`:** added (SHA-256 of resolved policy state).
- **Fail-loud policy validation:** adopted. Bad combinations refuse startup with clear errors; no degraded mode.
- **Telemetry:** zero, advertised as a feature. Users add their own audit sink via `logging.audit_sink` if they want metrics.
- **PHI redaction:** pluggable backends (regex, presidio, openmed, foundation, ensemble, custom). Foundation-model backend with verbatim HIPAA Safe Harbor system prompt is the recommended choice for `covered_entity` deployments. `compare_redaction_backends` and `evaluate_redaction` tools let users empirically select. Empirical justification: OpenMed and BioBERT-family clinical NER models, plus Presidio's default stack, were tested and fail to generalize outside their training corpora on real clinical content — particularly transcripts and narrative notes. See §3.5.4.
- **Runtime:** Node/TypeScript across all packages, despite Python's stronger clinical-library ecosystem. Reason: MCP TypeScript SDK is the most mature, `npx -y` install works on every platform without runtime version-managers, most production MCPs ship in TS, and hospital IT prefers one-binary-in-PATH over Python virtualenv management. Cost: porting clinical calc libraries from Python to TS, which is straightforward because formulas come from primary literature.
- **Composite tools beyond `get_drug_full_profile`:** adopted across all four MCPs (§5.1–5.4). Principle: composites earn their keep when there's clinical interpretive logic to ship along with the data; pure parallel fan-outs are left to the agent.
- **Cross-MCP composites:** rejected for v0.1. Agent orchestrates across servers; each MCP composes within its own boundary.

---

## 11. First milestones

A rough sequencing for v0.1 — not a hard plan, just an order that makes the early demos work.

1. Repo scaffold, `packages/shared`, `Cache` interface + SqliteCache, ToolResult/Source/Error/PhiMode types, policy loader + validator (fail-loud), `describe_capabilities` + `describe_policy` + `redact_phi`, CI with phi-lint + policy-validation tests.
2. PHI redaction backends: regex first, foundation backend with Safe Harbor prompt second. `compare_redaction_backends` + `evaluate_redaction` tools.
3. `@openclinicalai/calc` — fastest to ship, no external deps, gives an immediate demo and validates the shared layer. Numeric validation against MedCalc-Bench in CI.
4. `@openclinicalai/drugs` — openFDA + RxNorm + DailyMed wrappers, free-tier interactions with the documented warning. Composite tools (`get_drug_full_profile`, `safety_summary`, `renal_dose_adjustment`).
5. `@openclinicalai/evidence` — PubMed eutils + ClinicalTrials.gov + USPSTF (snapshot-first, AHRQ license clause surfaced on every result). Composite tools (`summarize_evidence`, `compare_treatments`).
6. `@openclinicalai/terminologies` — ICD-10-CM, LOINC; UMLS slot wired but inactive without key. (USPSTF moved to `@openclinicalai/evidence` in v0.1 — see §5.2.)
7. Licensed-tier code paths for `drugs` (DrugBank first — best free-developer onboarding of the three) and `terminologies` (UMLS).
8. **Clinician validation pass** (release gate per §9 item 3). Internal review by Karl + Adam; external academic clinician review aligned with the mission's stated benchmarking-against-OpenEvidence/Doximity goal. Block release on any interpretive surface that fails the "feels right under time pressure" pass.
9. Publish to npm + MCP registries.
10. Post-v0.1: begin formal comparative evaluation against OpenEvidence and Doximity's clinical AI, in collaboration with the engaged academic clinicians, targeting publishable comparative benchmarks.
