# Charter — OpenClinicalAI

**Status:** living document. Open to community input.
**Audience:** clinicians, researchers, contributors, hospital IT, anyone considering using or building on this project who wants to understand *why* it exists, *what* it will and won't do, and *how* it plans to compete with closed-source alternatives.
**Last updated:** 2026-05-23
**Companion docs:** [ARCHITECTURE.md](ARCHITECTURE.md) (system design), [README.md](README.md) (quickstart).

This document is the project's charter — its posture, scope, structural commitments, competitive positioning, and per-domain technical strategy. The system architecture lives in ARCHITECTURE.md; this is the strategic frame that shapes which engineering investments are worth making.

The short version: we don't compete on premium content access. We compete on engineering quality, citation rigor, transparency, and orchestration. The benchmark we publish demonstrates parity-or-better on the question types where free-tier coverage is genuinely sufficient, which turns out to be most clinical questions. For the rest, we honestly point users to the closed competitors.

---

## 0. Project posture, intended use, and what's out of scope

This project exists to help people who build products *for clinicians* — products that make clinicians' jobs easier and enhance the care of patients. That framing constrains what this project will and won't support.

**Intended use.** OpenClinicalAI provides reference-data and computation tools that clinician-facing AI products can use to surface information for clinicians to act on. The tools are designed for human-in-the-loop workflows where a licensed clinician evaluates and applies the output.

**Out of scope — explicitly and by license.** Use of these tools to build *autonomous* clinical AI systems that cut humans out of the loop, or that endanger patients by acting on outputs without clinician review, is a violation of the project's license and against its spirit. The license text will include a use-restriction clause to this effect (TBD: specific language to be drafted; we'll evaluate Hippocratic License v3, Responsible AI License variants, or a project-specific addendum to Apache 2.0). If you are building a product that diagnoses, doses, prescribes, or otherwise makes clinical decisions without a licensed clinician in the decision path, this is not the toolkit for you.

**The SaMD line.** Software as a Medical Device regulation lives adjacent to what we ship. As long as composite tools surface information for clinician evaluation with appropriate disclaimers (the result *contains* a calculation, a guideline grade, an interaction warning — not "give this patient this dose"), we operate outside the SaMD boundary. The moment a composite shifts from "here's the relevant information" to "here's the clinical action to take," the regulatory posture shifts. We deliberately don't cross that line in any composite tool, and contributions that do will be rejected.

**What we won't build (and what we will).** A non-exhaustive list of things this project intentionally won't ship in its core:

- No direct EHR integrations (FHIR R4/R5 read or write). Clinical decisions belong to the EHR's CDS hooks, not to our tools.
- No PDF-to-structure pipelines for clinical notes. That's an extraction problem with its own integrity considerations and a different threat model.
- No patient-facing tools or interfaces. Everything here is built for clinician consumption.
- No prescribing logic, dosing recommendations, or any tool whose output is intended to be acted on directly.

The caveat: if a community of cracked open-source EHR engineers ever wanted to build a fully open EHR alongside this — to give the practice of medicine back to independent clinicians rather than the EHR oligopoly — we'd be glad. That's a sibling project, not a feature of this one.

### 0.1 Funding posture and structural commitments

The project will not take VC or PE money, ever. The kind of incentive structure that VC and PE financing create — pressure toward enterprise upsell, exit timelines, growth metrics that conflict with mission integrity — would compromise the open-source clinical-AI-for-all framing this project exists to embody. We will not accept that tradeoff.

Acceptable funding and structural paths if the project ever scales beyond what volunteer effort can sustain:

- **Non-profit incorporation.** A 501(c)(3) or equivalent structure that legally aligns the project's operations with its public-benefit mission. Foundation grants, individual donations, institutional sponsorship from values-aligned organizations (academic medical centers, public-interest healthcare bodies, mission-aligned philanthropies) are appropriate funding sources.
- **Living-wage-floor compensation, capped at the top.** Every employee — including the project lead — receives at minimum a living wage for their location. Total compensation (salary + any benefits with cash equivalence) is capped at low-to-mid-six-figures (specific number TBD; the principle is that no individual extracts wealth disproportionate to mission contribution).
- **Excess revenue is directed outward.** Any revenue beyond the operating costs of the project — staff, infrastructure, contracted clinician time, eval work — is directed to accelerating other open-source efforts, clinical education programs, or other initiatives that benefit humanity, particularly in healthcare access and clinical training in resource-limited settings. The project is not a vehicle for accumulating institutional wealth.

These commitments will be encoded in the non-profit's bylaws if/when that entity is formed, and signaled in advance (here and in the README) so that contributors, users, and potential institutional partners understand the structural constraints they're aligning with. The project is intentionally architecting itself to remove incentive paths that would otherwise drift it away from its stated values.

This is open for refinement at scoping time and will be discussed publicly before any formal entity is stood up.

---

## 1. The competitive landscape (verified 2026-05; competitor stacks shift, re-check before relying on any specific deal claim below)

Three closed-source products dominate clinical AI over evidence:

**OpenEvidence (Daniel Nadler)** has assembled the strongest content stack via direct publisher licensing: NEJM Group full text from 1990+ (Feb 2025), JAMA Network plus eleven specialty journals (June 2025), NCCN oncology guidelines (Nov 2025), AAFP (American Family Physician + FPM), ACEP Clinical Policies (Dec 2025), Wiley journals (Mar 2025). Plus Microsoft as enterprise distribution and Mayo Clinic Platform Accelerate as incubator. They claim a ~35-40M citation index — PubMed-scale — but their differentiator is the *right to display full text* from licensed publishers, not the raw count. They're free for verified clinicians and monetize through enterprise channels. DDI source isn't publicly disclosed; the educated guess is Lexicomp or First Databank.

*Worth knowing for our strategy:* OpenEvidence's pre-deal architecture in 2023-2024 (before any of the publisher deals above) ran on PubMed abstracts + PMC Open Access + FDA labels. On that footprint they hit 90% USMLE performance and 25k/month signups before NEJM came online in early 2025. The publisher deals are a moat *now*; they weren't required for initial traction. See §4.1 for what this implies about our v0.1 ambition.

**Doximity (DoxGPT, Doximity Ask)** acquired Pathway Medical for $63M in July 2025 to bootstrap their content layer. Pathway had spent seven years curating structured medical data — about 3,200 drug monographs, journal coverage, guideline summaries, landmark trials. DDI is Pathway's proprietary structured interaction graph, likely seeded from DrugBank + RxNorm + FDA labels rather than Lexicomp/FDB. No major journal partnerships announced.

**Heidi Health (Heidi Evidence)** rented their way in via ongoing subscriptions: DynaMed (EBSCO) for US, plus NICE, BMJ, MIMS, HealthPathways for UK/AU markets. Built on Anthropic Claude. Smaller literature index than OpenEvidence; deeper on point-of-care curated content.

All three paths require capital we don't have and aren't trying to raise: substantial publisher deals (deal-size figures aren't public; "substantial" is the honest framing), $63M acqui-hires, or perpetual subscription fees to closed content vendors.

---

## 2. Where we lose, by design

Honesty about unfixable gaps matters because it determines where we don't compete and what the benchmark should and shouldn't measure.

**Premium journal full text.** NEJM, JAMA, Lancet, and similar publisher-locked content requires negotiated licenses with separate Generative AI license riders. The BYO-license-at-runtime pattern doesn't help here, for two reasons:

1. Most premium journals don't expose institutional content via TDM-friendly APIs in the first place. Institutional access is web-session-authenticated, not API-keyed.
2. Even where APIs exist, Wolters Kluwer and Elsevier have split API access from AI-use-of-API-content into two distinct licensing tiers as of 2026. A regular institutional API contract for Lexicomp or UpToDate is not legally sufficient to consume that content via an MCP — the institution also needs the GenAI license rider, which is sold separately.

This is the structural surprise of the 2026 licensing landscape: even institutional customers who already pay for the content are walled off from AI use of that same content unless they pay again.

**Clinician-grade DDI from the dominant vendors.** Lexicomp, Micromedex, and First Databank lock APIs behind enterprise contracts. Lexicomp and Micromedex are usable via our BYO adapters *only* when the institution has both the API contract and the GenAI rider. First Databank has no individual or small-shop tier at all. Only DrugBank offers a realistic single-user/small-shop BYO path, and even that is sales-gated and may have tightened its academic tier as of 2026.

**UpToDate-quality point-of-care synthesis.** Wolters Kluwer guards UpToDate's content tightly. No realistic BYO path exists at any tier — even institutions with full UpToDate enterprise subscriptions cannot legally feed UpToDate content into a third-party AI/RAG system. We don't include a UpToDate slot in `.env.example` because we shouldn't imply a path that doesn't exist.

**NCCN guideline full text.** NCCN licensed to OpenEvidence specifically. We can link to public NCCN pages but not redistribute the guideline body content.

**Implication for product design — with a confidence framing that matters:** we don't compete on the closed-content axes above. If a benchmark question requires NEJM full text or Lexicomp-grade DDI to answer correctly, we will lose that benchmark. But the more important question is what those benchmark losses *actually mean* for clinical utility, and the project's working hypothesis is: usually less than the benchmark scores suggest.

Most clinical content companies are, at their core, repackaging expert recommendations of the underlying literature. The literature itself is largely accessible — PubMed abstracts cover 100%, PMC OA gives full text on a meaningful subset, and the expert-recommendation layer that closed products charge for is a curation and synthesis problem, not a content-access problem. The project lead's working hypothesis (informed by hands-on work with current frontier models) is that with strong agentic orchestration, careful retrieval engineering, and community-contributed curation of canonical literature, foundation models — including open-source ones like DeepSeek and GLM — can match closed competitors on most actual clinical tasks. Not benchmark-by-benchmark on every closed-content-dependent question, but on the clinical utility a clinician actually experiences when using the tool.

There is precedent for the community-curation half of this. One of the earliest projects to demonstrate clinician-driven open contribution to clinical NLP was the work around patient-friendly definitions — clinicians voluntarily contributing the kind of plain-language clinical content that proprietary vendors charge enterprise prices for. The same model applies to expert curation of literature: clinicians who already do journal clubs, write society recommendations, and curate canonical reading lists for trainees can — and historically have — contributed that curation openly when the project they're contributing to deserves it. The CUJ-curation pass in §8 plus future specialty-canonical-papers contribution is this thesis in operational form.

So the honest framing isn't "we lose to closed competitors on closed-content-dependent benchmarks and that's a permanent disadvantage." It's: "we lose benchmark scores that measure access to closed content; the clinical utility delta is much smaller than the benchmark delta suggests, and the path to closing it runs through engineering, agentic orchestration, and community-curated expert synthesis — not through us replicating the publisher-licensing capital structure."

We still design the comparative evaluation to weight question categories honestly. We don't pretend full-text-only questions are answerable from abstracts. But we don't internalize the closed competitors' framing that benchmark score equals clinical utility, either. The eval design should measure clinical utility for the actual clinician task, not access to specific content vendors.

---

## 3. Where we can compete

### 3.0 The general principle: engineering depth over content breadth

The pattern across every place we can compete is the same: closed competitors do shallow, lookup-style integrations over the sources they have, because their differentiator is the *breadth* of sources they license. We can't match that breadth, so the investment goes the other way — we go *deep* on the free sources we do have, exposing the rich structure, relationships, hierarchies, and reasoning latent in those sources but that nobody surfaces well.

This applies to literature retrieval (PubMed + PMC OA, §3.1), terminology and ontology lookup (§3.2), drug ontology graph traversal (§3.3), composite reasoning across sources (§3.5), calculator interpretation (in the calc MCP), trials matching (in evidence), and adverse-event signal extraction (in drugs). The thesis isn't "we have a better RAG over PubMed." It's: *for every clinical reference source where the underlying data has more structure than competitors expose, we expose more of it, better.*

Why this works: a closed product with NEJM full text but a flat ICD-10 lookup is no better than us on ICD-10 work, and we cover ICD-10 work intensively. A closed product with Lexicomp DDI but a shallow RxNorm wrapper misses the formulary-alternative and pharmacologic-class workflows that fall out of walking the RxNorm graph properly. The breadth advantage only matters on questions that require breadth. For everything else, depth wins — and depth is what engineering buys.

The five places where this depth shows up in v0.1:

### 3.1 Retrieval quality over PubMed abstracts + PMC Open Access

PubMed has 100% abstract coverage of biomedical literature, fully free, well-API'd. PubMed Central Open Access gives full text on roughly 20% of papers — bulk-downloadable but ~3M papers totaling ~1.5TB uncompressed, which doesn't fit a local-first, npx-installable architecture. For many clinical questions, abstracts alone contain study design, primary findings, and conclusions — the parts an evidence-summarization agent actually needs to cite.

**Important empirical anchor:** OpenEvidence in 2023-2024, before any major publisher deals, ran on PubMed abstracts + PMC OA + FDA labels and hit 90% USMLE performance and 25k/month signups on that footprint. Abstract-level coverage is sufficient for early-stage credibility. The publisher full-text deals are their *current* moat; they weren't required for initial product traction. Our v0.1 ambition can be calibrated against that benchmark.

Investment areas:

- **CUJ-curated PMC OA local index.** Rather than vectorizing all 3M PMC OA papers (multi-week effort, multi-GB index, awkward fit for npx-installable), build a curated local index using NLM's [Clinically Useful Journals (CUJ) filter](https://pmc.ncbi.nlm.nih.gov/articles/PMC10361554/) as the backbone — 241 titles across 80 clinical subjects, redesigned in 2023 as a data-driven NLM-endorsed clinical-relevance filter. CUJ × ~10 years × publication-type filter (RCT, systematic review, guideline, key cohort) lands in the 50-150k-paper range, well within local-first feasibility (~500MB-1.5GB vector index). This handles the v0.1 use case cleanly; full PMC OA can be a hosted-mode option in v1.0+ for institutional deployments that want broader coverage and can absorb the storage.
- **Hybrid retrieval.** Reciprocal rank fusion of lexical (PubMed boolean queries, MeSH-aware) + semantic (open-weights clinical embeddings over abstracts and the CUJ-curated PMC OA index) + structured (publication type, recency, study size). No single retrieval method dominates across clinical query types.
- **MeSH-aware query expansion.** NLM's MeSH controlled vocabulary is a free, high-quality query rewriter. Map natural-language clinical concepts to MeSH terms before running PubMed queries. Catches results that pure embedding retrieval misses.
- **Recency-aware scoring.** Clinical evidence decays. A 2023 RCT often outweighs a 2018 meta-analysis on the same intervention. Recency weighting is a free win that closed competitors often underweight.
- **Per-article license tracking.** The PMC OA bulk archive carries mixed licenses (CC-BY, CC-BY-NC, CC-BY-NC-SA, public domain). The local index records the per-article license; tool results surface the license alongside the citation so downstream consumers can comply with redistribution and modification terms. This is both legally correct and reinforces the citation-rigor positioning.

### 3.2 Terminology and ontology depth

ICD-10-CM, LOINC, SNOMED CT, RxNorm, MeSH, UMLS — every clinical terminology has rich structure that most clinician-facing AI products under-utilize. To be precise about the competitive landscape: dedicated terminology vendors (Snowstorm, Termlex, Apelon DTS, FHIR ConceptMap services, the SNOMED browser stack) absolutely do real ontology depth — that's their entire product. They're just not where clinicians or agents go for it; they're backend infrastructure for EHRs and reference applications, not agent-callable tools. The unfilled niche is *bringing terminology-vendor-grade depth into the agent tool surface*, which is where closed clinician-facing AI does flat code-to-description lookups: "ICD-10 E11.9" → "type 2 diabetes mellitus without complications." That's table-stakes from the EHR side; it's where the AI products stop. What they miss, and what the data is fully open to support:

- **Hierarchical navigation.** ICD-10 codes form a tree of siblings, parents, and children. A clinician documenting "type 2 diabetes with kidney complications" should see E11.21 (with diabetic nephropathy), E11.22 (with diabetic chronic kidney disease), with the structural relationship visible. Expose tree traversal as first-class tools (`get_parent`, `get_children`, `get_siblings`) or as fields on the lookup result.
- **Cross-vocab mapping.** A LOINC lab result connects to ICD-10 diagnoses connects to SNOMED clinical findings connects to RxNorm prescribed drugs. UMLS makes these mappings; few products expose them as a tool surface. The `map_concept_across_vocabs` composite in ARCHITECTURE.md §5.4 is the v0.1 anchor.
- **Fuzzy matching with confidence.** A clinician types "metformin glucotrol" — the right answer is "did you mean metformin AND glipizide (brand: Glucotrol)?" That requires fuzzy match + drug recognition + clarification, not a single boolean lookup with no match.
- **Semantic search over code descriptions.** "Find ICD-10 codes for inflammatory conditions of the small bowel" — should return Crohn's, eosinophilic enteritis, etc., without requiring boolean keyword query construction. Embed code descriptions once, serve fuzzy + semantic + exact-match results merged via RRF.
- **Code workups.** For documentation: not just "the code you asked for" but "the code, its siblings, parent context, commonly-co-occurring codes, and the 'consider also' set" — encoded as the `code_workup` composite.

These are pure engineering investments over free terminology APIs (NLM Clinical Tables for ICD-10/LOINC, RxNorm REST API). The data is there; the depth is the differentiator. A well-built `@openclinicalai/terminologies` outperforms every closed product I can name on this surface — because none of them invest in it; it's not where their paying customers focus.

### 3.3 Drug ontology graph traversal

RxNorm is a graph, not a list. Every drug has rich relationships: ingredients, brand names, dose forms, ATC pharmacologic classes, NDFRT mechanism categories, brand-generic equivalents, dose-strength variants. Closed competitors do RxCUI lookup → drug record; few traverse the graph to expose what's clinically useful:

- **Generic ↔ brand traversal.** Search "Glucophage" → "Glucophage is the brand for metformin; generic alternatives by manufacturer; same-class alternatives via ATC: glipizide, glyburide, glimepiride."
- **Pharmacologic class browsing.** "What other drugs are in this ATC class" is a free RxNorm relationship query. Useful for formulary alternatives, comparable-mechanism reasoning, allergic cross-reactivity inference.
- **Mechanism-based grouping.** NDFRT (deprecated but still queryable) groups drugs by mechanism — "ACE inhibitors," "selective beta-1 antagonists," etc. Surfacing this as a navigable structure is more useful than the raw codes.
- **Ingredient-level comparison.** Compare combination drugs by constituent ingredients — necessary for therapeutic substitution, contraindication checking on shared ingredients, and allergy cross-reactivity.

The `compare_drugs`, `formulary_alternatives`, and `safety_summary` composites in ARCHITECTURE.md §5.1 lean on this. The implementation investment is *actually walking the RxNorm graph* rather than treating it as a bag of attributes — which is where most competing products stop.

**Edge-case classes that get fail-loud handling, not silent wrong answers.** Walking RxNorm "properly" is harder than the bullet list above implies. Combination drugs (Janumet = sitagliptin + metformin) cannot be naively treated as their components for interaction or substitution logic. OTC formulations, scheduled substances, REMS-restricted drugs, biosimilars, and authorized generics all have semantic gotchas where a graph-traversal shortcut produces clinically wrong results. The implementation must detect these classes and either return structured "this requires explicit handling" results or refuse to traverse — never silently return a wrong answer that looks right. Test fixtures explicitly cover these categories.

### 3.4 Citation rigor as a first-class output

OpenEvidence claims citation. Making ours *verifiably* traceable to primary sources — PMID, NCT ID, DOI, retrieval date, the actual sentence cited — is a differentiator clinicians can directly evaluate. Every `ToolResult` already carries a populated `sources` array; the engineering investment is in making that array's contents survive contact with reality.

Specific investment: a `verify_citation(claim, source)` composite tool that takes a claim and a cited source, fetches the source's text (PMC OA or abstract), and returns a confidence score that the source actually supports the claim. Used by the agent to self-check before responding. This is hallucination prevention as a tool the agent can call on itself — and it's something none of the closed competitors expose because their architecture is single-shot RAG.

### 3.5 Composition over single-shot RAG

OpenEvidence, Doximity, and Heidi are largely single-shot RAG architectures: question in, evidence summary out. Our MCP architecture lets an agent orchestrate multiple tool calls — search broader, refine, cross-reference, check guidelines, run a calculator, compare to active trials, verify citations. A well-orchestrated agent with composite tools can outperform a single-shot RAG over richer content for many question types.

The `summarize_evidence`, `compare_treatments`, and `literature_update` composites in ARCHITECTURE.md §5.2 are designed for this. The implementation must not just fan out and concatenate — the interpretive layer is where the value compounds: per-finding evidence-quality signals (study design, sample size, recency, replication, single-center vs multi-center, declared conflicts of interest from author affiliations), conflict detection across studies, and explicit recency weighting. We deliberately do *not* claim to automate full GRADE — real GRADE requires expert judgment across risk-of-bias, inconsistency, indirectness, imprecision, and publication-bias domains, and "we extracted study design and N" conflated with "we GRADEd this" is exactly the credibility trap to avoid. We surface structured evidence-quality signals; we leave grade-of-evidence judgement to the clinician (or to a downstream tool that explicitly commits to real GRADE with clinician input as a v0.5+ effort).

### 3.6 Open evaluation methodology

OpenEvidence and Doximity benchmark internally. They publish results they like; they don't publish their evaluation harness. We publish ours.

The comparative-evaluation protocol against OpenEvidence/Doximity/Heidi will be designed as a reproducible open benchmark — query set, scoring rubric, citation-accuracy methodology, all in the repo. Academic clinicians can run it. Closed competitors can run it too if they want; **we explicitly invite them to**. Transparency in evaluation is itself a moat: it forces an honest conversation about where we win and lose, and it gives clinicians a way to evaluate without trusting any vendor's internal marketing.

**On methodology specifically.** The project lead has strong, published views on what counts as rigorous clinical-AI evaluation, and the eval methodology will be designed against that bar — statistically sound, IRR-aware (with careful treatment of epistemic vs aleatoric uncertainty in tasks), FactScore-influenced for factual and stylistic correctness, and explicitly skeptical of common "methodologies" in the clinical-AI space that don't actually measure what they claim (the PDQI-9 reliance for note-generation eval being the canonical example). The project will *not* commit to a specific named methodology in this document — we deliberately avoid endorsing methodologies that may turn out to be poorly suited to the actual tasks. The eval design will be published with its statistical reasoning visible, the community is welcomed and explicitly invited to contribute and critique, and the closed competitors are welcomed to participate or to publish their own results against the same open harness.

What the eval will *not* be: a single-number leaderboard score, a black-box "we tested it internally" claim, or a derivative of someone else's methodology adopted because the methodology is familiar rather than because it measures the right thing.

**Tactical:** NEJM AI publishes open benchmarks and datasets in perpetuity (`ai.nejm.org/about/products-and-services`), but those are mostly Q&A / image / coding tasks, not the retrieval+citation-fidelity benchmarks this project most needs. NEJM AI alignment may be appropriate as one *brand* anchor (their methodology framing has academic credibility), but the comparative-eval protocol needs its own task design built around the question types in §3.7 — retrieval, citation accuracy, evidence-quality signal extraction, structured drug-info correctness, terminology mapping fidelity. Other candidate benchmark inputs to evaluate: MedQA, MedMCQA, BioASQ — each measures something different and none is a perfect fit alone.

### 3.7 Choose tasks where the content gap is smallest

Not every clinical question requires NEJM full text. Categories where free-tier coverage is genuinely sufficient and where we have at least parity with closed competitors:

- **Drug labels and basic pharmacology** — openFDA + DailyMed + RxNorm covers this entirely. We don't have a structural disadvantage.
- **Active clinical trials** — ClinicalTrials.gov is the authoritative source, free, well-API'd. We arguably have an *advantage* because closed competitors deprioritize trials in favor of journal content. A clinician asking "what trials are recruiting for this patient profile" should get a better answer from us than from OpenEvidence.
- **Preventive recommendations** — USPSTF is canonical, free, and our snapshot-first strategy handles the token-gating cleanly.
- **Calculator-driven decisions** — primary literature suffices; no content licensing needed.
- **Mechanism and pharmacology questions** — typically answerable from abstracts plus drug labels.
- **Comparative-effectiveness on older interventions** — older literature is more likely to be in PMC OA than recent NEJM-quality work, so we're actually better positioned for this than competitors who index closed full text but skip PMC OA.

The comparative-eval benchmark should weight these categories heavily. Not because we're gaming the eval — because these are the questions we can answer well and the questions where the closed competitors don't have a structural advantage. The eval design is the strategic positioning.

---

## 4. Tactical playbooks per MCP

Each domain server has its own concrete engineering investments that operationalize the depth-over-breadth thesis. The evidence MCP is the deepest playbook because it has the largest content gap to close; the others have smaller gaps but the same pattern of investment.

### 4.1 `@openclinicalai/evidence` — tactical playbook

The evidence MCP is where the literature-retrieval competition (§3.1) lives. Priorities for v0.1 to reach parity on the categories in §3.7:

1. **CUJ-curated PMC OA local index** (per §3.1). Don't try to vectorize all 3M PMC OA papers at v0.1 — the engineering effort and storage footprint don't fit local-first. Build the index over the [NLM Clinically Useful Journals (CUJ) filter](https://pmc.ncbi.nlm.nih.gov/articles/PMC10361554/) — 241 titles, ~10 years, filtered by publication type (RCT, systematic review, guideline, key cohort). Target ~50-150k papers, ~500MB-1.5GB vector index, refreshed monthly via the official bulk-download API. Per-article license recorded alongside the vectors so tool results can surface them with citations. Build a clean upgrade path for v1.0 to optionally extend to full PMC OA (likely as a hosted-mode dependency for institutional deployments that want broader coverage).

2. **MeSH-aware query expansion.** Use NLM's MeSH vocabulary as a free query rewriter. Map natural-language concepts to MeSH terms before running PubMed eutils. Combine MeSH-expanded boolean queries with embedding queries; merge results via reciprocal rank fusion.

3. **Hybrid retrieval ranker.** RRF over lexical (PubMed eutils boolean) + semantic (PMC OA vector search) + structured filters (publication type, recency, citation count). Tune weights on a held-out clinical query set. Open the tuning code — transparency in retrieval is part of the differentiator.

4. **Citation verification composite.** `verify_citation(claim, source)` tool that takes a claim and a source, fetches the source text, and returns a confidence that the source supports the claim. Agent uses it to self-check before final response. Specifically expose this as a tool the agent calls on itself — not as a hidden post-processing step — so the verification trace is visible in the agent log.

5. **`summarize_evidence` composite quality.** Where the interpretive layer earns its keep: grade of evidence per finding (GRADE methodology, simplified for automation), conflict detection across studies, recency weighting, study-quality flags. Pure parallel fan-out is the agent's job; this composite exists to add interpretation.

6. **ClinicalTrials.gov as first-class, not afterthought.** Recruiting trials with structured eligibility criteria is an area where we can outperform competitors. Build `find_recruiting_trials_for` to match on structured demographic eligibility (age range, sex, location, intervention class) — not just keyword search.

7. **NEJM AI benchmark in CI from day one.** Wire the open benchmark suite into CI. Track scores over time. Publish them. This is both quality signal and competitive positioning artifact.

### 4.2 `@openclinicalai/terminologies` — tactical playbook

Where the ontology-depth competition (§3.2) lives. Priorities for v0.1:

1. **Semantic search across NLM Clinical Tables.** Most terminology lookups today are keyword-boolean; semantic search over code descriptions is a substantial UX upgrade. Embed code descriptions once (MedCPT or a comparable open clinical embedding), serve fuzzy + semantic + exact-match results merged via RRF. This applies to ICD-10-CM, LOINC, and (with UMLS license) SNOMED.

2. **Hierarchical navigation as a first-class tool.** Every `lookup_*` tool returns the code's parent, children, and siblings as structured fields. Build `get_parent`, `get_children`, `get_siblings`, and `get_hierarchy_path` as composable tools so agents naturally chain documentation workflows.

3. **Cross-vocab mapping via UMLS (licensed tier).** This is where the UMLS license pays off, and where the BYO-license pattern actually works at single-user tier (UMLS is free per individual). Build `map_concept_across_vocabs(term, target_vocabs)` to traverse the UMLS metathesaurus and return best matches per vocabulary with confidence scores. Agents asking "ICD-10 codes for this LOINC lab" or "SNOMED finding for this RxNorm drug indication" go through this.

4. **Code workup composite.** `code_workup(term)` returns ICD-10 candidates with hierarchical context, sibling codes, commonly-co-occurring codes (free relationship data where available), and the "consider also" set used in coding workflows. This is the documentation-workflow composite that earns the MCP its keep against generic LLM coding.

5. **USPSTF preventive-care cascade.** `get_uspstf_recommendation` returns a recommendation, but `summarize_preventive_care_for(age, sex, risk_factors)` returns the full ordered cascade of grade A and B recommendations applicable to a patient profile — the actual clinical use case. Built on the bundled USPSTF snapshot; no live API required.

### 4.3 `@openclinicalai/drugs` — tactical playbook

Where the drug ontology graph competition (§3.3) and free-tier DDI realism (§2) both live. Priorities for v0.1:

1. **RxNorm graph traversal as the foundation.** `get_drug_by_rxcui` returns more than the bare drug record: ingredients, brand variants, ATC pharmacologic class, mechanism family, dose-form siblings — all from free RxNorm relationships. The composite tools (`compare_drugs`, `formulary_alternatives`, `safety_summary`) all read from this enriched record rather than re-fetching.

2. **Free-tier interactions surface.** The FDA structured product label's "Drug Interactions" section is the strongest free-tier source for interactions. Parse it per-drug, surface as structured-ish output rather than prose blob, mark `tier: "free"` clearly with a warning that licensed-tier (DrugBank / Lexicomp / Micromedex) gives structured pairwise data with severity and management. Combine with whatever RxNorm pairwise relationship data still exists in NDFRT.

3. **Per-population dose adjustments from labels.** Most product labels include pediatric, geriatric, renal, and hepatic adjustment guidance as prose sections. Build label-section parsers and expose as structured tools: `renal_dose_adjustment(rxcui, crcl)`, `hepatic_dose_adjustment(rxcui, child_pugh)`, `pediatric_drug_check(rxcui)`, `geriatric_drug_check(rxcui)` (latter includes Beers Criteria flags). Composite tools with real interpretive value, all from free sources.

4. **Safety summary composite.** `safety_summary(rxcui)` pulls black box warnings, REMS programs, pregnancy/lactation guidance, recent recalls, and recent AE signal trends from openFDA FAERS into a single structured safety profile. Each datum is from a free source; the composite is the value-add.

5. **Formulary alternative composite.** `formulary_alternatives(rxcui)` walks ATC class via RxNorm, returns same-class alternatives with comparison on AE profile, indication overlap, and (if a licensed cost source is configured) cost. Genuinely useful workflow that closed competitors deprioritize.

### 4.4 `@openclinicalai/calc` — tactical playbook

Calc has broader scope than the original v0.1 framing implied. The catalog research (`docs/CALCULATOR_INVENTORY.md`, 1,203 entries) puts the calculator universe in context: MDCalc carries ~900+, the academic-benchmark gold standard NCBI MedCalc-Bench covers 55, and we ship 27 atomic calcs at this point (the original 15 + 8 MedCalc-Bench tier-1 anthropometric/electrolyte/MAP additions + 1 tree-class Berlin ARDS + 4 composites = 28 total). Five investment areas:

1. **Composite panels with interpretive logic.** The `calc_kidney_workup`, `calc_cardiac_risk_panel`, `calc_sepsis_panel`, `calc_pe_workup` composites in ARCHITECTURE.md §5.3 are where calc earns its keep. The composite runs the atomic calculators and adds the clinical interpretation: when CKD-EPI vs Cockcroft-Gault is appropriate, what the GRACE+CHADS-VASc combination means clinically, the PE diagnostic-pathway logic linking Wells + PERC + PESI. This is the surface that goes through clinician review per ARCHITECTURE.md §1 priority 6 — interpretive text is where wrong-feels matter most.

2. **MedCalc-Bench validation in CI.** Every calculator with a MedCalc-Bench entry must pass numeric validation against MedCalc-Bench's fixture set. Block release on any calculator that fails. This is the scientific-rigor differentiator that lets the comparative eval credibly claim parity with MDCalc-quality calc surface, despite reimplementing formulas from primary literature rather than licensing MDCalc. `docs/MEDCALC_BENCH_36.md` is the per-calc implementation brief for the 44 unshipped MedCalc-Bench calcs (8 of which collapse the QTc/acid-base/OB-dating variant families into single tools with a `method` parameter, leaving 38 distinct implementations).

3. **Tree-class calculators are a first-class category, distinct from formulas.** Many widely-used clinical rules — Berlin ARDS severity, Duke endocarditis criteria, McDonald MS, Rochester / Philadelphia / Boston febrile-infant rules, Phoenix Sepsis Score, Westley Croup — are rule-cascade categorical classifications, not numeric formulas. The framework now models these as `complexity: "tree"` with categorical `result` and a `rule_trace` field showing which criteria fired. Tested by branch coverage rather than numeric tolerance. MedCalc-Bench is exclusively numeric and covers zero of them; their fixtures come from society guidelines or worked clinical-case examples in the primary literature. Berlin ARDS is shipped as the first proof of pattern (see `packages/calc/src/calculators/critical-care.ts`).

4. **Pediatrics is structurally underrepresented in every cross-domain catalog** (MDCalc, MedCalc-Bench, nobra_calculator, vitaldb/medcalc). Building peds coverage requires direct sourcing from pediatric specialty bodies (AAP / AHA / PALS / NRP / WHO / CDC / ESPGHAN / ISPAD / IPNA / PICS). `docs/PEDIATRIC_CALCULATORS.md` is the 92-entry catalog with society endorsement on every row and a 20-calc v0.1 must-have shortlist (APGAR, New Ballard, Bhutani, AAP 2022 phototherapy, Kaiser EOS, Holliday-Segar, Schwartz, CKiD U25, WHO WAZ, CDC BMI%, PECARN head, AAP 2021 febrile-infant, Phoenix Sepsis, PIM3, Bedside PEWS, Westley Croup, PRAM, PAS, FLACC + Wong-Baker, ISPAD DKA). Three framework primitives gate this work: tree (now shipped), an LMS-parametric reference-table primitive for WHO/CDC z-scores, and a `PediatricAge` discriminated-union input for gestational-weeks-and-days vs postnatal-hours-vs-days-vs-months-vs-years.

5. **Drug-dosing calculators live in `@openclinicalai/drugs`, not here.** The calc-vs-drugs boundary rule: any tool that needs an RxCUI input or returns a drug-specific output goes to `drugs`, paired with the existing `renal_dose_adjustment` / `hepatic_dose_adjustment` composites. `docs/DRUG_DOSING_CALCULATORS.md` is the 64-tool plan with a 13-tool v0.1 shortlist (vancomycin AUC, aminoglycoside Hartford, carboplatin Calvert, MME total daily, equianalgesic opioid, UFH weight-based, 4F-PCC Kcentra, sodium correction rate, Beers Criteria flag, structured renal adjustment, apixaban / rivaroxaban / enoxaparin adjusted). Vehicle solutions (Parkland burns, Holliday-Segar pediatric maintenance fluid) stay in `calc` since they aren't drug-specific.

6. **Four calculators we cannot ship under Apache-2.0.** MMSE (PAR Inc. copyright), MoCA (MoCA Clinic licensing), STS Cardiac Surgery Risk (closed coefficients), and BOADICEA/CanRisk (non-commercial). All four are widely used; the README acknowledges this gap honestly rather than letting users discover it and assume neglect.

---

## 5. The positioning narrative

The pitch to a clinician evaluating OpenClinicalAI vs. OpenEvidence:

> OpenEvidence has more premium journal full text than we do. That's real and we're not pretending otherwise.
>
> What we have instead: full transparency in source code, prompts, retrieval logic, and evaluation methodology — you can audit every step. Citation rigor you can verify against primary sources via the `verify_citation` tool (best-effort in v0.1, with explicit confidence caveats — see §6). Orchestration via MCP tools that any agent host can use, so you're not locked into a single product. Upstream queries go only to non-PHI public APIs (PubMed, openFDA, RxNorm, etc.), and PHI handling is governed by your configured deployment policy — including the option of a fully on-device redaction backend that makes no external calls. Free at the AI layer, with your institution's existing content licenses (DrugBank, DynaMed Infobutton, and others as the licensing landscape evolves) plugging in via standardized adapters to enrich coverage — without paying for an AI product on top.
>
> For clinical questions answerable from peer-reviewed literature, preventive recommendations, drug labels, and active trials — which is most of them — we aim for parity or better. For questions requiring Wolters Kluwer's licensed content, we honestly point you to the closed competitors.

This concedes nothing important. It says: we serve a different segment — institutions and clinicians who value transparency, customizability, on-device deployment, and architectural independence over bundled premium content access — and the published benchmark will demonstrate parity on the question types that segment actually cares about.

The pitch to a hospital IT or compliance team is different but related:

> Your existing content stack stays where it is. We don't ask you to send PHI to closed APIs. We don't ask you to pay for content you already license. We don't ask you to trust our marketing about what our model does — every prompt, every tool, every redaction pipeline is open source and auditable. When questions require content you've licensed (Lexicomp, DynaMed, DrugBank), our adapters plug into your existing infrastructure under your existing contracts. When questions can be answered from free sources, you pay nothing.

---

## 6. Open questions for the implementation phase

Decisions worth making early, even if not at v0.1 ship time:

1. **CUJ-curated index storage backend.** SQLite-vec, LanceDB, or DuckDB+vss for the ~50-150k-paper local vector index? Benchmark on a representative query set before committing. Same embedding store will likely back the terminology semantic search (§4.2) — pick once, reuse.
2. **Embedding model — pick once, reuse across MCPs.** Open weights only (consistent with transparency commitment). MedCPT (NCBI's clinical-domain embedding) is a strong candidate; SPECTER2 is another. The decision applies to both literature retrieval (§4.1) and terminology semantic search (§4.2). Cross-evaluate on representative queries from both surfaces before committing.
3. **CUJ filter refinement.** Out of CUJ × ~10 years, what filters yield the ~50-150k high-value subset? Publication-type (RCT, systematic review, guideline, key cohort) is the obvious cut. Specialty-balanced sampling vs raw recency? This should ideally be informed by clinician input — see clinician engagement plan in §8.
4. **Recency weighting curve.** Linear, exponential, or domain-specific (faster decay for therapeutics, slower for diagnostic test characteristics)?
5. **`verify_citation` honest scoping for v0.1.** Confidence-that-this-source-supports-this-claim is a clinical-domain NLI problem. Small-model NLI confidence isn't trustworthy at clinical bar; foundation-model verification brings back the cost/latency/BAA conversation. v0.1 will ship "best-effort with explicit caveats" — the tool returns a confidence score and the cited span, but does not claim calibrated reliability. The calibrated version is post-v0.1 work that needs clinician-labeled ground truth to do properly.
6. **License-restriction clause language.** Per §0, the license needs use-restriction language preventing autonomous clinical AI use. Evaluate Hippocratic License v3, Responsible AI License variants, or a project-specific addendum to Apache 2.0. This needs legal review before v0.1 publishes.
7. **NEJM AI benchmark fit verification.** Per §3.6, NEJM AI Bench is mostly Q&A / image / coding — not the retrieval+citation-fidelity benchmark we most need. Confirm the actual task taxonomy and decide whether to align with NEJM AI for the brand anchor, build a homemade benchmark for the retrieval/citation tasks, or both. Likely "both."

### Resolved-during-scoping (audit trail for things that were once open)

- ~~PHI redaction backend selection.~~ Pluggable backend system shipped in ARCHITECTURE.md §3.5.4 with regex / presidio / openmed / foundation / ensemble / custom options. **Post-v0.1 work item:** re-benchmark the default-for-covered-entity recommendation against OpenMed Nemotron Privacy Filter 1.5.0 once tested with `compare_redaction_backends` — the prior negative finding was on OpenMed's BERT-family NER models and may not apply to the newer architecture.
- ~~GRADE methodology automation.~~ Replaced with "structured evidence-quality signals" per §3.5; full GRADE deliberately not committed to (credibility trap). See §3.6 for evaluation methodology framing.

---

## 7. Moats — what's defensible when anyone can fork

Honest framing: open source means anyone can fork. The architectural choices in ARCHITECTURE.md don't generate defensibility on their own. So what is?

**Execution velocity.** The project that ships the next composite tool, the next PHI backend, the next eval benchmark first earns the trust capital. This is mostly about whether the maintainers are willing and able to ship at a meaningful cadence — which is a social and operational question, not a technical one.

**Clinician trust.** Trust accumulates through clinician validation passes (see §8), through honest comparative-eval results published openly, through the absence of hype claims, and through citation rigor that clinicians can directly verify. Forks won't have this; rebuilding it takes years of consistent shipping with clinician-in-the-loop discipline. This is probably the strongest defensible asset over time.

**Evaluation methodology becoming canonical.** If the comparative-eval protocol we publish becomes the methodology the academic clinical-AI community uses to evaluate any clinical evidence retrieval product (open or closed), the project sits at the center of how clinical AI quality gets measured. That's a position of influence forks can't replicate by copying code. The path to this is academic credibility of the methodology, which routes through the engaged clinicians in §8 plus published work.

**What's *not* a moat.** The MCP suite itself, the per-MCP architecture, the BYO-license adapter pattern, the deployment-policy system, the redaction backend zoo — all forkable, all replicable, none defensible on their own. The architecture is the public good; the moats are social and operational. That's the project ethos and shouldn't be apologized for.

---

## 8. Clinician engagement plan (placeholder)

ARCHITECTURE.md §11.8 gates v0.1 release on external clinician review of interpretive content. This section specifies that path — at the level of commitment Karl is willing to make at scoping time.

**Internal pass:** Karl + Adam, as the closest-to-the-project clinicians.

**External pass:** Karl plans to engage his company's clinical-affairs resources to see what specialty-clinician time can be donated. Beyond that, Karl has personal connections at Stanford, Harvard, and UCSF to recruit from, with openness to whoever else in the academic clinical-AI community wants to participate. Specialties prioritized for v0.1: internal medicine (broadest coverage of composite-tool surface), nephrology (kidney workup composite is high-stakes interpretive content), cardiology (cardiac risk panel + DDI overlap), and critical care (sepsis panel + APACHE/SOFA interpretive layer).

**The methodology.** Reviewers receive specific composite tool outputs against test cases, asked to flag (a) anything that feels clinically wrong even when the math is right, (b) anything that could mislead a clinician under time pressure, (c) anything that crosses the SaMD line per §0. Findings of category (a) or (b) block release on that surface; (c) findings block until the composite is restructured.

**The CUJ curation pass** is a separate clinician-engagement workstream: specialty experts contribute their canonical-papers lists to refine the CUJ-filtered subset (§4.1.3). This is community-contributable on a longer timeline and doesn't gate v0.1.

This plan is intentionally rough at scoping time. It firms up as commitments are confirmed; the section gets updated rather than handwaved into v0.2 forever.

---

## 9. What this document is NOT

This isn't an engineering roadmap — that's ARCHITECTURE.md §11. It isn't a feature spec — that's the tool inventories in §5. It's the strategic frame that explains *why* we're investing in retrieval quality, citation rigor, and open evaluation rather than chasing a content-licensing parity we can't afford and don't want to depend on.

When in doubt during implementation: the bar isn't "match OpenEvidence on every benchmark." The bar is "do the open, transparent, citation-rigorous version *better* than they do the closed version, on the question categories where free-tier coverage is genuinely sufficient." That's a winnable game. Don't get drawn into the unwinnable one.
