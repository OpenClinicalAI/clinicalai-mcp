# Drug-Dosing Calculator Catalog — `@openclinicalai/drugs`

This file is the **drug-dosing tool roadmap** for
[`@openclinicalai/drugs`](../packages/drugs/). It is the sibling of
[`docs/CALCULATOR_INVENTORY.md`](./CALCULATOR_INVENTORY.md), which catalogs the
*pure-compute* clinical calculators (scores, indices, lab-derived formulas)
that live in `@openclinicalai/calc`.

The two catalogs are deliberately separate because the derivations differ:

| Catalog | Lives in | Derived from | Cite via |
|---|---|---|---|
| `CALCULATOR_INVENTORY.md` | `@openclinicalai/calc` | A primary derivation paper (Cockcroft 1976, Lip 2010, Wells 2000…) | PMID + DOI of the derivation paper |
| **`DRUG_DOSING_CALCULATORS.md` (this file)** | `@openclinicalai/drugs` | An **FDA label** or a **pharmacist consensus guideline** (ASHP/IDSA/ACCP/NCCN/CDC dose-modification tables); occasionally a published PK paper for the model | FDA SetID + openFDA URL for label-derived tools; PMID for guideline-derived; PMID for PK-model papers |

A tool belongs in `drugs` if (and only if) **its output depends on a drug
identity (RxCUI) or returns a drug-specific dose, route, or regimen.** A pure
formula that happens to be used for drug dosing (Cockcroft-Gault, BSA-Mosteller)
lives in `calc` and gets *called by* the `drugs` dosing tools.

The single biggest UX win of this catalog over what we ship today is the move
from **prose to structured output**: the existing `renal_dose_adjustment` and
`hepatic_dose_adjustment` composites return the relevant FDA-label paragraphs,
which is correct but forces the agent to re-parse the label every time. The
tools in this catalog are structured-output siblings — given an RxCUI and a
patient parameter, they return a structured dose recommendation the agent can
act on, with the prose fallback preserved when parsing fails.

## How to read the table

| Field | Meaning |
|---|---|
| **name** | Canonical clinical name (the form a clinician or pharmacist types). |
| **slug** | Proposed MCP tool name (snake_case). See "Slug convention" in §Architectural decisions below. |
| **category** | Clinical bucket. One of: `antimicrobial-dosing`, `anticoagulant-dosing`, `chemotherapy-dosing`, `renal-adjustment`, `hepatic-adjustment`, `pediatric-dosing`, `geriatric-dosing`, `weight-based-dosing`, `opioid-conversion`, `insulin-dosing`, `electrolyte-replacement`, `fluid-resuscitation`, `blood-product-dosing`, `IV-compatibility`, `reversal-dosing`. |
| **primary_source** | The document the dosing rule is derived from. FDA label → SetID family + openFDA. Guideline → PMID. PK paper → PMID. |
| **data_source_needed** | What the runtime needs to actually answer: `fda-label-parse` (parse the renal/hepatic/pediatric section of an openFDA label), `rxnorm-graph` (RxCUI → ingredient/strength resolution), `pharmacokinetic-formula` (per-drug Vd/Cl constants), `lookup-table` (vendored static table from a guideline), `crcl-input`, `child-pugh-input`, `weight-input`, `bsa-input`, `target-AUC-input`, `age-input`, `serum-level-input`. |
| **licensed_tier** | `free` (FDA labels / RxNorm / public guidelines), `licensed-lexicomp`, `licensed-micromedex`, `licensed-drugbank`. Note: even when free-tier is possible, a licensed-tier upgrade often returns higher-fidelity structured data. |
| **complexity** | `formula`, `lookup-table`, `tree`, `pk-model`. |
| **priority** | `must-have` (v0.1 shortlist), `should-have` (v0.5), `nice-to-have` (v1.0 / community), `controversial` (clinically valid but contested or out-of-scope for free tier). |
| **notes** | One-line implementation gotcha or clinical caveat. |

## Slug convention

This catalog uses **two** prefixes deliberately:

- `calc_*` — pure-compute drug-dosing tools where the output is a number (dose,
  interval, infusion rate). Mirrors the `calc_*` convention in
  `@openclinicalai/calc`. Examples: `calc_vancomycin_auc_dose`,
  `calc_carboplatin_calvert`, `calc_mme_total_daily`.
- `dose_*` — drug-specific adjustment / lookup tools where the output is a
  structured dose recommendation derived from an FDA label or guideline table.
  Examples: `dose_doac_apixaban_adjusted`, `dose_renal_adjustment_structured`,
  `dose_pediatric_lookup`.

The boundary: if there is a **formula** producing a number, use `calc_*`. If
there is a **lookup or branching adjustment** keyed on patient parameters
returning a structured regimen, use `dose_*`. This matches how clinicians
actually think about these — vancomycin AUC dosing is *computed*, apixaban dose
adjustment is *looked up*.

---

## Summary

**Total entries:** 64 dosing tools across 14 categories.

### Counts by priority

| Priority | Count | Notes |
|---|---|---|
| `must-have` | 13 | v0.1 shortlist. Highest clinical traffic, clean derivations, mostly FDA-label or CDC/ASHP guidelines that are free to vendor. See "v0.1 must-have shortlist" §5 below. |
| `should-have` | 27 | v0.5 — fills out antimicrobial, anticoagulant, opioid, insulin, and structured renal/hepatic adjustment coverage. |
| `nice-to-have` | 16 | v1.0 / community territory — long-tail antibiotic adjustments, pediatric niche drugs, less-trafficked chemo regimens. |
| `controversial` | 8 | Either licensed-tier-only (chemo regimens with NCCN restrictions, structured DDI-driven dosing), or where the free-tier answer is materially worse than the licensed-tier answer. |

### Counts by category

| Category | Count | Most common derivation |
|---|---|---|
| antimicrobial-dosing | 12 | FDA label + IDSA/ASHP consensus |
| anticoagulant-dosing | 11 | FDA label + CHEST guidelines |
| chemotherapy-dosing | 8 | Calvert 1989 (carboplatin); NCCN dose-mod tables (licensed) |
| renal-adjustment | 6 | FDA label parse (structured lookup) |
| hepatic-adjustment | 3 | FDA label parse keyed on Child-Pugh |
| pediatric-dosing | 5 | FDA label pediatric section + AAP |
| geriatric-dosing | 2 | AGS Beers Criteria 2023; STOPP/START v3 (2023) |
| opioid-conversion | 4 | CDC 2022; Fine 2009 methadone bands |
| insulin-dosing | 5 | ADA standards; institutional rules |
| electrolyte-replacement | 4 | ASHP nomograms; ICU protocols |
| reversal-dosing | 3 | FDA label (Kcentra) + neurology guidelines |
| blood-product-dosing | 3 | AABB consensus + pharmacist nomograms |
| fluid-resuscitation | 1 | Parkland — sits at calc/drugs boundary |
| IV-compatibility | 1 | Trissel + Micromedex — fundamentally licensed-tier |

### Sources cross-walked

For the FDA-label-derived rows, the implementation route is the existing
`label-resolver.ts` + `openFdaLabel` plumbing — every dosing tool that needs a
label parse should run through `resolveLabel(rxcui)` and then either parse the
relevant section into structured form or fall back to the existing
`renal_dose_adjustment` / `hepatic_dose_adjustment` composites (see
"Architectural decision 3" below).

For guideline-derived rows (CDC MME, Beers, ASHP K-replacement nomograms),
the vendored data ships **bundled** with the package — small enough to embed
and update at release time, like the USPSTF snapshot pattern in
`@openclinicalai/evidence`. The catalog calls these out as `lookup-table`
complexity with a `primary_source` PMID; the actual JSON tables live next to
the tool code.

---

## Antimicrobial dosing

The highest-clinical-traffic category. Vancomycin AUC and aminoglycoside
once-daily dosing are the two most-asked-for inpatient pharmacist consults; the
β-lactam extended-infusion calculators are the antibiotic-stewardship growth
area; the antibiotic renal-adjustment lookup is the workhorse for every
hospitalist round.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Vancomycin AUC₂₄/MIC dosing (Bayesian / two-level) | `calc_vancomycin_auc_dose` | antimicrobial-dosing | Rybak MJ et al. ASHP/IDSA/PIDS/SIDP 2020 — PMID 32191793 | `pharmacokinetic-formula`, `weight-input`, `crcl-input`, `target-AUC-input` | free | pk-model | must-have | Replaces trough-based dosing per 2020 consensus. Inputs: weight, age, sex, CrCl, target AUC (400–600 mg·h/L typical). Outputs: loading dose, maintenance dose, interval, predicted AUC₂₄, predicted trough. Two-level Bayesian estimation is a stretch goal — first-pass implements first-order PK (Matzke / Pai). |
| Vancomycin trough-based dosing (legacy) | `calc_vancomycin_trough_dose` | antimicrobial-dosing | Rybak MJ et al. ASHP 2009 — PMID 19106348 | `pharmacokinetic-formula`, `weight-input`, `crcl-input` | free | pk-model | should-have | Legacy — many institutions still use it. Ship it with a header warning that AUC-based is preferred per 2020 consensus. Target trough 10–20 mg/L depending on infection. |
| Aminoglycoside once-daily dosing (Hartford nomogram) | `calc_aminoglycoside_hartford` | antimicrobial-dosing | Nicolau DP et al. 1995 — PMID 7708209 | `pharmacokinetic-formula`, `weight-input`, `crcl-input` | free | pk-model | must-have | Gentamicin / tobramycin once-daily. 7 mg/kg loading; interval per nomogram from CrCl + post-dose level. Amikacin variant uses 15 mg/kg. Ship a `drug` enum (`gentamicin`/`tobramycin`/`amikacin`). |
| Aminoglycoside traditional / multiple-daily dosing | `calc_aminoglycoside_traditional` | antimicrobial-dosing | Sarubbi FA, Hull JH 1978 — PMID 686540 | `pharmacokinetic-formula`, `weight-input`, `crcl-input` | free | pk-model | should-have | For endocarditis synergy dosing (gentamicin 1 mg/kg q8h with β-lactam) and patients where peak/trough monitoring is preferred. |
| β-lactam extended-infusion dosing (piperacillin-tazobactam, meropenem, cefepime) | `calc_betalactam_extended_infusion` | antimicrobial-dosing | Lodise TP et al. 2007 — PMID 17304463; IDSA stewardship 2016 — PMID 27080992 | `pharmacokinetic-formula`, `weight-input`, `crcl-input`, RxCUI for drug selection | free | pk-model | should-have | %T>MIC target. Pip-tazo 4.5 g over 4 h q8h is the canonical example. Meropenem 1–2 g over 3 h q8h. Cefepime 2 g over 4 h q8h. Ship as a single tool with a `drug` enum. |
| Fluconazole renal-adjusted loading + maintenance | `dose_fluconazole_renal` | antimicrobial-dosing | Fluconazole FDA label (SetID family); IDSA candidiasis 2016 — PMID 26679628 | `fda-label-parse`, `crcl-input`, `weight-input` | free | lookup-table | should-have | Loading dose unchanged; maintenance halved when CrCl <50. Common dosing error in candidemia. |
| Voriconazole AUC / TDM dosing | `calc_voriconazole_tdm` | antimicrobial-dosing | Pascual A et al. 2008 — PMID 18444800; IDSA aspergillosis 2016 — PMID 27365388 | `pharmacokinetic-formula`, `weight-input`, `serum-level-input` | free | pk-model | nice-to-have | Therapeutic trough 1–5.5 mg/L. Non-linear PK + CYP2C19 polymorphism — flag as `controversial` for free-tier accuracy. License upgrade (Lexicomp) returns institutional TDM nomograms. |
| Echinocandin dosing (caspofungin, micafungin, anidulafungin) | `dose_echinocandin_standard` | antimicrobial-dosing | Caspofungin / micafungin / anidulafungin FDA labels | `fda-label-parse`, RxCUI | free | lookup-table | should-have | Caspofungin loading 70 mg → 50 mg/day; hepatic dose adjustment for caspofungin only. Body-weight adjustment is contested; ship the label dose and flag the literature. |
| Daptomycin weight-based dosing (ABW vs AdjBW) | `calc_daptomycin_dose` | antimicrobial-dosing | Daptomycin FDA label (SetID); IDSA SAB 2011 — PMID 21208910 | `weight-input`, `crcl-input`, RxCUI | free | formula | should-have | 6 mg/kg q24h skin/soft tissue, 8–10 mg/kg q24h bacteremia/endocarditis (off-label, society-recommended). Use ABW; AdjBW in obesity is institutional. CrCl <30 → q48h. |
| Antibiotic renal-dose adjustment (structured lookup) | `dose_renal_adjustment_structured` | antimicrobial-dosing | Sanford guide (paid) / IDSA / FDA labels per drug | `fda-label-parse`, `crcl-input`, RxCUI | free (FDA labels) / licensed-lexicomp (Sanford-equivalent) | lookup-table | must-have | The workhorse. Given RxCUI + CrCl, return structured `{ dose, interval, route, max_per_day }` parsed from FDA label or curated table. Graceful degradation to existing `renal_dose_adjustment` prose composite when parse fails. **This is where the drugs package earns its keep over the calc package.** |
| Colistin / polymyxin B loading + maintenance dosing | `calc_colistin_dose` | antimicrobial-dosing | Tsuji BT et al. ACCP 2019 — PMID 30710469 | `pharmacokinetic-formula`, `weight-input`, `crcl-input` | free | pk-model | nice-to-have | Loading 9 million IU CBA over 30 min; maintenance per CrCl band. Toxic narrow window. Ship with hard warning to confirm with ID consultation. |
| Linezolid dose adjustment (renal + serotonin syndrome risk) | `dose_linezolid_adjusted` | antimicrobial-dosing | Linezolid FDA label; IDSA 2011 SAB — PMID 21208910 | `fda-label-parse`, `crcl-input` | free | lookup-table | nice-to-have | Renal adjustment not standardized in label but recommended at CrCl <30 by some authors. Flag concomitant serotonergic drugs via DDI subroutine. |

## Anticoagulant dosing

DOAC dose adjustments and warfarin INR-based nudges are the two highest-traffic
anticoagulant questions; the heparin and enoxaparin protocols are
institution-variant enough that we have to be careful to ship the FDA-label /
ACCP version and flag local variability.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Apixaban dose adjustment (CrCl + age + weight) | `dose_doac_apixaban_adjusted` | anticoagulant-dosing | Apixaban FDA label (SetID 988a724a-...); ARISTOTLE / AVERROES | `fda-label-parse`, `crcl-input`, `age-input`, `weight-input` | free | lookup-table | must-have | 2.5 mg BID if ≥2 of: age ≥80, weight ≤60 kg, SCr ≥1.5 mg/dL. Otherwise 5 mg BID. Different rules for VTE vs AF — branch on `indication`. |
| Rivaroxaban dose adjustment (renal + indication) | `dose_doac_rivaroxaban_adjusted` | anticoagulant-dosing | Rivaroxaban FDA label; EINSTEIN / ROCKET-AF | `fda-label-parse`, `crcl-input`, RxCUI | free | lookup-table | must-have | AF: 20 mg daily (CrCl >50), 15 mg daily (CrCl 15–50), avoid <15. VTE: 15 mg BID × 21d → 20 mg daily. Post-MI: 2.5 mg BID. Indication-driven. |
| Dabigatran dose adjustment (renal + age + DDI) | `dose_doac_dabigatran_adjusted` | anticoagulant-dosing | Dabigatran FDA label; RE-LY | `fda-label-parse`, `crcl-input`, `age-input` | free | lookup-table | should-have | 150 mg BID (CrCl >30), 75 mg BID (CrCl 15–30), avoid <15. Strong P-gp inhibitor + CrCl 30–50 → 75 mg BID. Age ≥75 considerations. |
| Edoxaban dose adjustment (renal + weight + DDI) | `dose_doac_edoxaban_adjusted` | anticoagulant-dosing | Edoxaban FDA label; ENGAGE AF-TIMI 48; Hokusai-VTE | `fda-label-parse`, `crcl-input`, `weight-input` | free | lookup-table | should-have | **Avoid in AF if CrCl >95** (paradox — reduced efficacy at high CrCl per ENGAGE substudy). 60 mg daily (CrCl 50–95), 30 mg daily (CrCl 15–50 or weight ≤60 kg or strong P-gp inhibitor). |
| Enoxaparin weight + renal-adjusted dosing | `dose_enoxaparin_adjusted` | anticoagulant-dosing | Enoxaparin FDA label; CHEST AT9 — PMID 22315259; ASH VTE 2020 — PMID 33007077 | `fda-label-parse`, `weight-input`, `crcl-input` | free | lookup-table | must-have | VTE treatment 1 mg/kg BID or 1.5 mg/kg daily; prophylaxis 40 mg daily / 30 mg BID. CrCl <30 → 1 mg/kg daily. Obesity (>150 kg) and CrCl <30 need anti-Xa monitoring — flag, don't hide. |
| Unfractionated heparin weight-based dosing (VTE / ACS) | `calc_heparin_weight_based` | anticoagulant-dosing | Raschke RA et al. 1993 — PMID 8214996 (VTE nomogram); ACC/AHA NSTEMI 2014 — PMID 25260718 (ACS) | `weight-input`, `pharmacokinetic-formula` | free | formula | must-have | VTE: 80 U/kg bolus + 18 U/kg/hr. ACS: 60 U/kg bolus (max 4000 U) + 12 U/kg/hr (max 1000 U/hr). Output: bolus dose, infusion rate, expected initial aPTT check at 6 h. |
| Heparin aPTT-based adjustment (Raschke nomogram) | `calc_heparin_aptt_adjustment` | anticoagulant-dosing | Raschke RA et al. 1993 — PMID 8214996 | `pharmacokinetic-formula`, `weight-input`, serum-aPTT-input | free | lookup-table | should-have | Adjust drip rate per current aPTT band (institutional ratios vary — ship Raschke and let policy override). |
| Warfarin maintenance dose adjustment (INR-based) | `dose_warfarin_inr_adjustment` | anticoagulant-dosing | Holbrook A et al. CHEST 2012 — PMID 22315259; ACCP AT9; institutional Caldwell/Daiichi nomograms | `lookup-table`, current-INR-input, current-weekly-dose-input, target-INR-input | free | lookup-table | should-have | Multiple published nomograms (Lin/Caldwell, Daiichi, Avant-Garde). Ship one well-cited nomogram (CHEST AT9) and flag that institutional ones differ. **Not** initial dosing — that requires genotype/clinical-prediction model (WarPATH, IWPC) which is `controversial`. |
| Argatroban dosing for HIT (hepatic-aware) | `dose_argatroban_hit` | anticoagulant-dosing | Argatroban FDA label; ACCP HIT 2018 — PMID 30482786 | `fda-label-parse`, `weight-input`, `child-pugh-input` | free | lookup-table | should-have | 2 µg/kg/min, halve to 0.5 µg/kg/min for moderate-severe hepatic impairment. Critical illness reduces clearance further. |
| Bivalirudin dosing (renal-aware, PCI/HIT) | `dose_bivalirudin_renal` | anticoagulant-dosing | Bivalirudin FDA label; ACCP HIT 2018 — PMID 30482786 | `fda-label-parse`, `weight-input`, `crcl-input` | free | lookup-table | nice-to-have | PCI: 0.75 mg/kg bolus + 1.75 mg/kg/hr. HIT: 0.15 mg/kg/hr. CrCl <30 → 1.0 mg/kg/hr. |
| Fondaparinux dosing (weight + renal) | `dose_fondaparinux_adjusted` | anticoagulant-dosing | Fondaparinux FDA label; ACCP AT9 | `fda-label-parse`, `weight-input`, `crcl-input` | free | lookup-table | nice-to-have | VTE: 5 mg <50 kg, 7.5 mg 50–100 kg, 10 mg >100 kg. Avoid CrCl <30. |

## Reversal dosing

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| 4F-PCC (Kcentra) reversal dosing | `calc_4fpcc_kcentra` | reversal-dosing | Kcentra FDA label; Neurocrit Care 2016 — PMID 26714677 | `weight-input`, current-INR-input | free | lookup-table | must-have | INR 2 to <4 → 25 IU/kg (max 2500), INR 4–6 → 35 IU/kg (max 3500), INR >6 → 50 IU/kg (max 5000). Cap at 5000 IU. |
| Vitamin K reversal dosing | `dose_vitamin_k_inr_reversal` | reversal-dosing | CHEST AT9 — PMID 22315259 | current-INR-input, indication-input (bleeding vs no-bleed) | free | lookup-table | should-have | INR 4.5–10 no bleed → 1–2.5 mg PO; INR >10 no bleed → 2.5–5 mg PO; major bleed → 5–10 mg IV slow + 4F-PCC. |
| Idarucizumab / andexanet alfa dose selection | `dose_doac_reversal` | reversal-dosing | Praxbind FDA label; Andexxa FDA label; Neurocrit Care 2020 — PMID 31900893 | `fda-label-parse`, RxCUI for target drug, time-since-last-dose, dose-of-last-DOAC | free | tree | should-have | Idarucizumab: 5 g IV (two 2.5 g vials) for dabigatran. Andexanet: low-dose vs high-dose per apixaban/rivaroxaban dose and time since last dose. Costly — flag formulary considerations. |

## Chemotherapy dosing

Chemotherapy dose modification is where NCCN's licensed content begins to bite.
The well-published primary formulas (Calvert carboplatin AUC, 5-FU per BSA,
methotrexate per BSA with leucovorin) are implementable free-tier. The
regimen-specific dose-reduction tables for grade 3 toxicity that NCCN
publishes are licensed-content territory — ship the formulas + a generic
BSA-based dose calculator and link out to the licensed source for the
modification tables.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Carboplatin AUC dosing (Calvert formula) | `calc_carboplatin_calvert` | chemotherapy-dosing | Calvert AH et al. 1989 — PMID 2681557 | `target-AUC-input`, `crcl-input` (or eGFR per institutional convention) | free | formula | must-have | Dose (mg) = AUC × (CrCl + 25). Target AUC 5–7 typical adult; reduce to 4 in pretreated. Use Cockcroft-Gault not eGFR in FDA-required capping (max GFR 125 mL/min per FDA capping guidance 2010). |
| Body Surface Area for chemo dosing (calls calc package) | `dose_bsa_chemo_dose` | chemotherapy-dosing | Mosteller RD 1987 — PMID 3657876 (BSA); per-drug FDA labels for mg/m² | `bsa-input` (delegated to calc package), RxCUI, indication | free | formula | should-have | Wraps `calc_bsa_mosteller` from the calc package and applies the per-drug per-indication mg/m² from the FDA label. Hard-cap at maximum-BSA per regimen (typically 2.0–2.2 m² — Sacher 2012 / institutional). |
| 5-FU dose calculator (per regimen) | `calc_5fu_dose` | chemotherapy-dosing | FOLFOX / FOLFIRI primary papers (FOLFOX: de Gramont 2000 — PMID 11051023) | `bsa-input`, regimen-input | free | lookup-table | should-have | mg/m² varies per regimen (FOLFOX: 400 mg/m² bolus + 2400 mg/m² 46-h infusion, FOLFIRI similar). Ship a small regimen enum. DPYD genotyping affects dosing — flag, don't auto-adjust. |
| Cisplatin renal-adjusted dosing | `dose_cisplatin_renal` | chemotherapy-dosing | Cisplatin FDA label; Madias NE 1978 — PMID 343678 | `fda-label-parse`, `crcl-input`, `bsa-input` | free | lookup-table | should-have | Avoid CrCl <60 unless oncology weighs risk/benefit. No standard adjustment band — most published guidance is to switch to carboplatin. Surface the FDA label warning. |
| High-dose methotrexate dosing + leucovorin rescue | `calc_methotrexate_hdmtx` | chemotherapy-dosing | Bleyer WA 1978 — PMID 352421; Howard SC et al. 2016 — PMID 27340215 | `pharmacokinetic-formula`, `bsa-input`, serum-MTX-level-input | free | pk-model | nice-to-have | Critical narrow window. 1–12 g/m² typical. Leucovorin rescue 24h post-MTX, escalated per 24/48/72-h MTX level. Glucarpidase rescue if level >2 µmol/L at 48 h. Pediatric leukemia vs adult lymphoma protocols differ. |
| Cyclophosphamide IBW-vs-ABW dosing | `dose_cyclophosphamide_weight` | chemotherapy-dosing | NCCN HSCT preparative regimens; Lippert WW 2018 — PMID 30021137 | `weight-input`, `bsa-input` (and IBW from calc package) | free | formula | nice-to-have | Use IBW in obesity per HSCT preparative regimens. Differs from solid-tumor practice (BSA-based). Branch on `regimen`. |
| Doxorubicin / anthracycline cumulative-dose tracker | `calc_anthracycline_cumulative` | chemotherapy-dosing | Swain SM et al. 2003 — PMID 12736862 (doxorubicin); van Dalen EC 2010 (epirubicin) | doses-history-input, `bsa-input` | free | formula | should-have | Lifetime cap doxorubicin 450–500 mg/m² (cardiotoxicity threshold). Sum prior anthracycline exposures (with idarubicin/epirubicin conversion factors). Output: cumulative mg/m², doxorubicin-equivalent dose, % of cap, cardiotox-risk band. |
| Pediatric chemotherapy BSA-based dose with peds caps | `dose_pediatric_chemo` | chemotherapy-dosing | COG / NCCN pediatric regimens; FDA label | `bsa-input`, `age-input`, RxCUI, regimen-input | free + licensed-lexicomp for full regimen catalog | lookup-table | controversial | Pediatric oncology regimens have age-specific overrides (infants <12 mo, BSA <0.6 m², etc.) that are protocol-specific. Free-tier should refuse and point to COG/regimen; licensed-tier returns the lookup. |

## Renal-adjustment (structured-output sibling of existing composite)

These are **structured-output siblings** of the existing
`renal_dose_adjustment` composite. The existing composite returns the FDA-label
prose under `label_excerpts.dosage_and_administration` and
`label_excerpts.use_in_specific_populations`; the new tools attempt to parse
that prose into a structured `{ crcl_band, dose, interval, route, warnings }`
shape. See Architectural decision 2 for the both-tools rationale.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Structured renal adjustment (generic FDA-label parser) | `dose_renal_adjustment_structured` | renal-adjustment | Per-drug FDA label | `fda-label-parse`, `crcl-input`, RxCUI | free + licensed-lexicomp (richer table) | lookup-table | must-have | Cross-listed under antimicrobial. The general-purpose tool. Falls back to existing prose composite when parse fails. |
| Renal adjustment quality-of-parse confidence | `dose_renal_adjustment_confidence` | renal-adjustment | clinicalai-mcp meta | n/a | free | formula | nice-to-have | Returns `{ confidence: "high"|"medium"|"low", reason }` for the structured parse. Lets the agent decide whether to trust the structured output or read the prose. |
| Renal-replacement-therapy dosing (intermittent HD vs CRRT) | `dose_rrt_adjustment` | renal-adjustment | Heintz BH et al. ACCP 2009 — PMID 19476419; Aronoff Renal Drug Handbook (4th/5th ed, licensed) | `fda-label-parse`, RxCUI, RRT-modality-input | free (FDA labels carry HD/CRRT guidance for some drugs) + licensed-lexicomp | lookup-table | should-have | Vancomycin, β-lactams, aminoglycosides have well-published RRT dosing. Long-tail of drugs need the Aronoff handbook (licensed). |
| Peritoneal-dialysis intraperitoneal dosing | `dose_pd_intraperitoneal` | renal-adjustment | ISPD guideline 2022 — PMID 35394346 | RxCUI, weight-input, PD-modality-input | free | lookup-table | nice-to-have | Intraperitoneal vancomycin / cefazolin / gentamicin for PD peritonitis. ISPD 2022 carries the dosing tables; ship vendored. |
| Pediatric renal adjustment | `dose_pediatric_renal_adjusted` | renal-adjustment | Per-drug FDA label pediatric + renal sections; AAP NeoFax-equivalent (licensed) | `fda-label-parse`, `crcl-input` (Schwartz from calc), `age-input` | free | lookup-table | nice-to-have | Schwartz eGFR → renal band → dose. Most FDA labels lack pediatric-renal combined dosing; flag with prose fallback. |
| ECMO dosing adjustment | `dose_ecmo_adjustment` | renal-adjustment | Shekar K et al. 2014 — PMID 24433558 (ASAP-ECMO); ELSO red book | RxCUI, weight-input, ECMO-config-input | free (sparse) + licensed-micromedex | lookup-table | nice-to-have | Vd-altered for lipophilic drugs (fentanyl, midazolam). Sparse free-tier evidence; ship as `controversial` with the published-paper subset. |

## Hepatic-adjustment

Sibling pattern to renal — structured Child-Pugh-keyed parse of the FDA label
"Use in specific populations" section.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Structured hepatic adjustment (generic FDA-label parser) | `dose_hepatic_adjustment_structured` | hepatic-adjustment | Per-drug FDA label | `fda-label-parse`, `child-pugh-input`, RxCUI | free + licensed-lexicomp | lookup-table | should-have | Sibling to `dose_renal_adjustment_structured`. Child-Pugh A/B/C parse. The hepatic section is more often narrative than the renal section — expect higher parse-failure rate, graceful prose fallback. |
| Hepatic-impairment dose halving (CYP-dependent drugs) | `dose_hepatic_cyp_halving` | hepatic-adjustment | Verbeeck RK 2008 — PMID 18496670 | RxCUI, `child-pugh-input`, CYP-substrate-input | free | tree | nice-to-have | Generic "halve the dose in Child-Pugh B, avoid in C" rule for CYP3A4 substrates. Surface as an interpretive layer, not a hard recommendation. |
| MELD-aware hepatic adjustment | `dose_meld_adjusted` | hepatic-adjustment | Verbeeck RK 2008 — PMID 18496670; calls `calc_meld` from calc | RxCUI, MELD-input | free | lookup-table | nice-to-have | For drugs where MELD is a better predictor than Child-Pugh (limited evidence — flag as research-stage). |

## Pediatric dosing

Pediatric dosing is mg/kg or mg/m² with caps — the formula is trivial, the
hard part is the per-drug constants and the age-band caps. The two FDA-label
sections that matter are `pediatric_use` and `dosage_and_administration`; both
are in `OpenFdaLabel` already.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Pediatric weight-based dose with adult cap (generic) | `dose_pediatric_lookup` | pediatric-dosing | Per-drug FDA label `pediatric_use` + `dosage_and_administration`; AAP Red Book (licensed) for ID drugs | `fda-label-parse`, `weight-input`, `age-input`, RxCUI | free | lookup-table | should-have | Returns `{ dose_mg_per_kg, max_dose_mg, interval, route }`. Includes the "do not exceed adult dose" check. |
| Pediatric amoxicillin for AOM | `dose_peds_amoxicillin_aom` | pediatric-dosing | AAP AOM 2013 — PMID 23439909; amoxicillin FDA label | `weight-input`, severity-input | free | lookup-table | should-have | 80–90 mg/kg/day divided BID for ≥6 months, max 3 g/day. Treatment duration 10/7/5 days by age. |
| Pediatric albuterol nebulizer dose | `dose_peds_albuterol_neb` | pediatric-dosing | NHLBI EPR-3 — PMID 17983880 | `weight-input` | free | formula | should-have | 0.15 mg/kg (min 2.5 mg, max 5 mg). Continuous neb 0.5 mg/kg/hr. |
| Pediatric ondansetron for vomiting (oral / IV) | `dose_peds_ondansetron` | pediatric-dosing | Ondansetron FDA label; AAP — PMID 17875925 | `weight-input`, `age-input` | free | lookup-table | nice-to-have | 0.15 mg/kg IV (max 4 mg). Oral 2 mg (8–15 kg), 4 mg (15–30 kg), 8 mg (>30 kg). QT considerations. |
| Pediatric intranasal midazolam for seizure | `dose_peds_midazolam_in` | pediatric-dosing | Mpimbaza A et al. 2008 — PMID 18025201; NICE epilepsy 2022 | `weight-input` | free | formula | nice-to-have | 0.2 mg/kg IN, max 10 mg. Pre-hospital seizure abortive. |

## Geriatric dosing (Beers / STOPP-START)

These tools return **flags + reasons**, not a numeric dose. They're the
geriatric equivalent of a renal adjustment lookup — given a drug, return the
clinical-context-aware warning.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Beers Criteria flag for potentially inappropriate medication | `flag_beers_criteria` | geriatric-dosing | AGS Beers Criteria 2023 — PMID 37139824 | RxCUI, `age-input`, optional comorbidities | free | lookup-table | must-have | Vendor the 2023 AGS Beers table. Returns `{ flagged: bool, severity, rationale, alternative_class }`. Age ≥65 trigger. Excluded already from the existing composite `geriatric_drug_check` — wire it up. |
| STOPP/START v3 flag | `flag_stopp_start` | geriatric-dosing | O'Mahony D et al. 2023 — PMID 36738027 | RxCUI, `age-input`, comorbidities | free | lookup-table | should-have | European geriatric prescribing. STOPP = should-stop, START = should-consider-starting. Sibling tool to Beers; ship both because they differ in coverage. |

## Opioid conversion

The single most-asked-about non-anticoagulant dosing question. CDC 2022 MME
conversion factors are public and free to vendor; methadone conversion is
non-linear and has its own evidence base.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Morphine milligram equivalents (total daily MME) | `calc_mme_total_daily` | opioid-conversion | CDC Clinical Practice Guideline 2022 — PMID 36356238 | regimen-input (list of {RxCUI, dose, frequency}) | free | formula | must-have | The headline opioid tool. Vendored CDC 2022 conversion factors (fentanyl, hydrocodone, hydromorphone, methadone-special, morphine, oxycodone, oxymorphone, tramadol, codeine, tapentadol, buprenorphine). Output includes the 50 / 90 MME/day risk thresholds. |
| Equianalgesic opioid conversion (one-to-one) | `calc_opioid_equianalgesic` | opioid-conversion | CDC 2022; Knotkova H et al. 2009 — PMID 19101129 | source-RxCUI, source-dose, target-RxCUI | free | formula | must-have | Converts from one opioid to another (e.g. morphine 30 mg PO → hydromorphone 6 mg PO). **Includes the standard 25–50 % incomplete-cross-tolerance reduction.** Methadone is excluded — see next tool. |
| Methadone conversion (MME-band-dependent) | `calc_opioid_methadone_conversion` | opioid-conversion | Fine PG, Portenoy RK 2009 — PMID 19101129; Ayonrinde 2000 — PMID 11005254 | total-daily-MME-input | free | lookup-table | should-have | Non-linear. <60 MME → 1:4, 60–199 MME → 1:8, 200–499 MME → 1:12, ≥500 MME → 1:15 (Fine/Portenoy bands). Ship with a hard "consult palliative care / pain specialist" warning. |
| Fentanyl transdermal patch conversion | `calc_fentanyl_patch_conversion` | opioid-conversion | Janssen monograph; CDC 2022 | total-daily-MME-input | free | lookup-table | should-have | Total daily oral morphine equivalent (mg) ÷ 2 = patch dose (µg/h), rounded to nearest patch size (12, 25, 50, 75, 100 µg/h). Equivalent published tables differ slightly — ship the conservative Janssen monograph values. |

## Insulin dosing

Insulin is rules-and-thumb territory; the formulas are universal but the
clinical context (T1DM vs T2DM vs steroid-induced, naive vs uptitrated) drives
which formula to apply. Ship the formulas; let the agent / clinician pick the
context.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Total daily insulin dose (TDD) estimate | `calc_insulin_tdd` | insulin-dosing | ADA Standards of Care 2024 — PMID 38078577 | `weight-input`, indication-input (T1DM / T2DM / steroid-induced) | free | formula | should-have | T1DM 0.4–0.5 U/kg/day, T2DM 0.2–0.5 U/kg/day naive, steroid-induced 0.3–0.6 U/kg/day. Ship as a range, not a point estimate. |
| Insulin sensitivity factor (correction factor) | `calc_insulin_isf` | insulin-dosing | Davidson PC et al. 2008 — PMID 18564088 (1700-rule); Walsh J 1989 (1500-rule) | TDD-input, insulin-type-input | free | formula | should-have | 1700/TDD for rapid-acting analogs; 1500/TDD for regular insulin. Output: 1 unit drops BG by X mg/dL. |
| Insulin-to-carb ratio (500-rule) | `calc_insulin_icr` | insulin-dosing | Walsh J 2003 — Pumping Insulin | TDD-input | free | formula | should-have | 500/TDD = g carbs covered by 1 unit. Validate per patient. |
| Insulin correction dose | `calc_insulin_correction_dose` | insulin-dosing | Walsh J 2003 | current-BG-input, target-BG-input, ISF-input | free | formula | should-have | Correction units = (current BG − target BG) / ISF. Cap at TDD-derived ceiling. |
| DKA insulin infusion + transition (subQ) | `calc_dka_insulin_protocol` | insulin-dosing | ADA / DKA Consensus 2009 — PMID 19564476; updated 2024 | `weight-input`, glucose-input, ketosis-resolution-flag | free | tree | nice-to-have | Initial 0.1 U/kg bolus + 0.1 U/kg/hr infusion (or no bolus + 0.14 U/kg/hr). Transition to subQ basal-bolus when anion gap closes — overlap by 1–2 hours. Pediatric variant differs. |

## Electrolyte replacement

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Potassium replacement (IV + PO) | `calc_potassium_replacement` | electrolyte-replacement | ASHP K-replacement nomogram; Kraft MD et al. 2005 — PMID 16221017 | serum-K-input, `crcl-input`, route-input | free | lookup-table | should-have | Per-100-mEq-deficit-vs-mEq-per-mmol-rise nomogram. IV max 10 mEq/hr peripheral, 20 mEq/hr central. Halve in CrCl <30. |
| Magnesium replacement (IV) | `calc_magnesium_replacement` | electrolyte-replacement | ASHP institutional; Hammond DA 2018 — PMID 30141706 | serum-Mg-input, `crcl-input` | free | lookup-table | should-have | 1–2 g IV per 0.1 mg/dL below 2.0 mg/dL, infused over 1 hour. Renal caution. |
| Phosphate replacement (KPhos / NaPhos) | `calc_phosphate_replacement` | electrolyte-replacement | Charron T et al. 2003 — PMID 12545140; Taylor BE 2004 — PMID 15467087 | serum-PO4-input, `weight-input`, `crcl-input` | free | lookup-table | nice-to-have | Mild (2.3–3.0): 0.16 mmol/kg over 4–6 hr; severe (<1.5): 0.32–0.64 mmol/kg over 8–12 hr. K-phos vs Na-phos choice by serum K. |
| Sodium correction rate (hyponatremia limit) | `calc_sodium_correction_rate` | electrolyte-replacement | Adrogué HJ, Madias NE 2000 — PMID 10816188; ESS 2014 — PMID 24569496 | current-Na-input, target-Na-input, `weight-input` | free | formula | should-have | Max correction 6–8 mEq/L/24h (chronic) or 10–12 mEq/L/24h (acute). Calls `calc_sodium_deficit` from calc. Output: max-allowed Na change, expected hours, 3 % saline mL/h. ODS / CPM risk warning. |

## Blood products

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Platelet transfusion expected count increment (CCI) | `calc_platelet_cci` | blood-product-dosing | Slichter SJ et al. 2010 — PMID 20554970 | pre-transfusion-count, post-transfusion-count, platelet-content-input, `bsa-input` | free | formula | should-have | CCI = (post-pre)/(units transfused × 10¹¹) × BSA. <5000 / <7500 at 1h post = refractoriness signal. |
| Cryoprecipitate dosing for fibrinogen | `calc_cryo_dose_fibrinogen` | blood-product-dosing | AABB Standards 32nd ed; Roback JD 2010 | current-fibrinogen-input, target-fibrinogen-input, `weight-input` | free | formula | nice-to-have | 1 unit / 5 kg raises fibrinogen ~50 mg/dL. Adult dose often 10 units. |
| Massive transfusion ratio (1:1:1) | `dose_massive_transfusion` | blood-product-dosing | PROPPR 2015 — PMID 25647203; ATLS 10th ed | weight-input, ABC-score-input | free | lookup-table | nice-to-have | 1:1:1 RBC:FFP:platelets per PROPPR. Adjunctive TXA per CRASH-2 (1 g over 10 min + 1 g infusion over 8 h within 3 h of injury). |

## Fluid resuscitation

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Parkland formula for burns | `calc_parkland_burns` | fluid-resuscitation | Baxter CR 1968 — PMID 4882538; ABA 2008 — PMID 18193380 | `weight-input`, %TBSA-burn-input | free | formula | should-have | **Boundary call:** lives in `calc`, not `drugs`. 4 mL × kg × %TBSA over 24 h (half in first 8 h). No drug identity. **Cross-referenced here for catalog completeness; implementation goes in `@openclinicalai/calc`.** |

## IV compatibility

This is a single placeholder for a category that is **fundamentally
licensed-tier**. There is no free, comprehensive Y-site compatibility table —
Trissel's Handbook on Injectable Drugs and the King Guide are commercial.

| name | slug | category | primary_source | data_source_needed | licensed_tier | complexity | priority | notes |
|---|---|---|---|---|---|---|---|---|
| Y-site IV compatibility check | `check_iv_y_site_compatibility` | IV-compatibility | Trissel LA, King Guide (both licensed); Micromedex IV Compatibility | RxCUI list, vehicle-input | licensed-micromedex / licensed-lexicomp | lookup-table | controversial | Free-tier: refuse with `LICENSE_REQUIRED` error and point to Trissel. No partial free-tier answer is safe — incompatibility precipitates inside the line and kills patients. The one tool where degradation is unacceptable. |

---

## Architectural decisions

### 1. The `calc` vs `drugs` boundary

**Rule:** A tool belongs in `@openclinicalai/drugs` if and only if **its
output depends on a drug identity (RxCUI) or returns a drug-specific dose,
route, or regimen.** Otherwise it belongs in `@openclinicalai/calc`.

Worked examples of the boundary:

| Tool | Lives in | Why |
|---|---|---|
| Cockcroft-Gault CrCl | `calc` | Pure formula, no drug |
| Carboplatin AUC dose (Calvert) | `drugs` | Output is a carboplatin-specific dose in mg |
| BSA (Mosteller) | `calc` | Pure formula, no drug |
| Vancomycin AUC dose | `drugs` | Output is a vancomycin-specific loading + maintenance + interval |
| MME total daily | `drugs` | Conversion factors are per-drug, output is a drug-specific equivalent |
| Sodium deficit formula | `calc` | Pure formula |
| Sodium correction rate with 3% saline rate | `drugs` | Output is a per-drug infusion rate (`3% saline`) |
| Parkland burns formula | `calc` | Pure formula, no drug identity — output is "lactated Ringer's mL" but the drug is the vehicle, not the intervention |
| Holliday-Segar 4-2-1 maintenance fluids | `calc` | Pure formula; the output is "D5½NS mL/h" which is a vehicle, not a drug |
| Beers Criteria flag | `drugs` | Input is RxCUI, output is a drug-specific warning |
| Cumulative anthracycline dose tracking | `drugs` | Per-drug equivalent factors (idarubicin → doxorubicin) |

The boundary cases (Parkland, Holliday-Segar, sodium correction rate, MME)
were the test of the rule. The vehicle / electrolyte solution carrying a
calculation **does not** count as a drug identity for the purposes of this
rule — the calculation is fundamentally about the patient's fluid math, not
about the saline / D5W / LR being delivered. Conversely, MME is **about** the
opioid being converted; opioids are identifiable RxCUIs and the conversion is
per-drug. That tool is in `drugs`.

A reasonable check: if the catalog row's `data_source_needed` includes `RxCUI`
as a required input, it belongs in `drugs`. If it includes only patient
parameters (weight, age, vitals, labs), it belongs in `calc`.

### 2. Structured-output siblings vs. verbose mode on existing tools

We currently ship `renal_dose_adjustment(rxcui, crcl_ml_min)` and
`hepatic_dose_adjustment(rxcui, child_pugh)` (planned) that return FDA-label
**prose** under `label_excerpts.dosage_and_administration` and
`label_excerpts.use_in_specific_populations`. The catalog adds structured-output
tools (`dose_renal_adjustment_structured`, `dose_hepatic_adjustment_structured`)
that return a parsed `{ crcl_band, dose_mg, dose_per_kg, interval, route,
max_per_day, warnings }` shape.

**Recommendation: ship both, named differently.** Not a `verbose` flag on the
existing tool, and not a single tool that auto-degrades.

Reasoning:

- **Different agent surfaces want different shapes.** A clinician-facing
  agent reading a label section as documentation wants the prose. A
  dose-calculator agent computing the next vancomycin order wants the
  structured `{ dose_mg, interval }`. The two consumption patterns are
  different enough that they deserve different tools.
- **Parse failure must be a first-class signal.** When the FDA label section
  is narrative-only (most chemo labels) or multi-table (some combo products),
  the structured parser can fail. Returning an "empty structured output" with
  a warning is confusing. A separate tool that *explicitly* says "I tried to
  parse this and the result is `null`, here is the prose fallback" is
  clearer than a flag-toggled hybrid.
- **`verbose` is already overloaded.** The cross-cutting `verbose: true` flag
  per ARCHITECTURE.md §3.1 returns the raw upstream payload. Overloading it
  to also mean "return structured-vs-prose" conflates two unrelated axes.
- **Both tools share the same `resolveLabel()` + `withCache()` path.** The
  structured tool calls the prose tool internally; if the parse succeeds, it
  returns structured + prose; if it fails, it returns the prose + a `warnings`
  entry `"structured parse failed for this label; prose fallback returned"`.
  The agent never has to know which tool to call first.

This implies one new generic tool per parameter (CrCl, Child-Pugh, age, weight)
plus a per-drug-class set of specialized tools where the parse is uniformly
reliable (DOAC adjustment, daptomycin renal, enoxaparin renal).

### 3. FDA label parsing is hard — graceful degradation strategy

The renal-impairment and hepatic-impairment text in FDA labels is inconsistent:

- Some drugs (apixaban, rivaroxaban, dabigatran) have **structured tables** in
  the label `dosage_and_administration` section. These parse cleanly.
- Some (vancomycin, gentamicin) have **multi-paragraph narrative** with the
  dose adjustment buried in context. Parses are mid-reliability.
- Some (older drugs, biologics) have **only a "no formal study, use caution"
  paragraph** with no concrete dose advice. These cannot be parsed because
  there is nothing to parse.

The recommended degradation strategy:

1. **Run the structured parser.** If it returns a non-null result, package it
   as the primary `data` field with `parse_confidence: "high"`.
2. **If it fails or returns mid-confidence**, attach the prose excerpt (via the
   existing `renal_dose_adjustment` composite plumbing) as a sibling field
   `label_prose_fallback`, set `parse_confidence: "low"`, and emit a
   `warnings` entry stating that the structured output may be incomplete and
   the prose is the safer surface.
3. **If even the prose lookup is empty** (no label resolved by RxCUI or
   generic-name fallback), return the existing
   `labelResolutionWarning(resolution)` warning and the empty result. **Never
   return a confident-looking structured object with low-confidence data** —
   that is the silent-wrong failure mode we cannot ship.

The parse-confidence enum is part of the tool's return shape, not a hidden
field. Agents should be able to surface "the structured dose adjustment for
this drug is not parseable from the FDA label; here is the relevant prose
instead" to the user. Honest UX beats confident wrong UX every time.

Implementation note: the parser should be a per-section regex / structured-text
heuristic, **not** a model-backed extraction. Model-backed parse introduces
the same trust + auditability gap that we explicitly avoid in the PHI
redaction architecture (§3.5.4) — we want to be able to point at one TypeScript
file and say "this is what the parser does". A future enhancement could add a
`foundation-model parse` backend as a sibling, the same way redaction backends
work. The tool returns the *deterministic* parse by default.

### 4. PK-model tools: per-drug `calc_*` vs. one generic `dose_pk`

**Recommendation: per-drug tools.**

The PK-model tools in this catalog (`calc_vancomycin_auc_dose`,
`calc_aminoglycoside_hartford`, `calc_carboplatin_calvert`,
`calc_methotrexate_hdmtx`, `calc_voriconazole_tdm`,
`calc_betalactam_extended_infusion`, `calc_colistin_dose`) are real PK formulas
with drug-specific parameters: Vd, Cl, half-life, target AUC, target trough.

A generic `dose_pk(rxcui, target, patient)` would have to either:

- carry a per-drug PK constants table internally and dispatch on RxCUI (which
  is just the per-drug tools collapsed into one less-discoverable surface), or
- ask the agent to pass the PK parameters in, which defeats the purpose of
  the tool — the clinical value is that the tool *knows* vancomycin's Vd is
  0.7 L/kg without the agent having to.

Per-drug tools also let:

- the description / `notes` carry the drug-specific clinical context (target
  AUC range, indication-specific dosing, monitoring schedule),
- the `sources` cite the drug-specific PK paper (Matzke 1984 for vancomycin,
  Nicolau 1995 for aminoglycosides),
- the input schema document the drug-specific inputs (Hartford uses post-dose
  level + interval-from-nomogram, AUC uses two-level fit).

A single generic tool would either bury all of this or surface a kitchen-sink
input schema. Per-drug tools mirror how clinicians and pharmacists actually
think about these.

The seven PK tools are a small, finite set. As more PK calculators get
contributed (linezolid, posaconazole, gentamicin neonates, busulfan TDM),
ship them as siblings.

### 5. Licensed-tier behavior for drug-dosing tools

Per ARCHITECTURE.md §3.4, every tool's name and signature stays constant
regardless of license state — agents do not branch on tier. The `tier` field
on the result tells the caller what backed the answer, and a `warnings` entry
suggests the license upgrade where relevant.

For the dosing tools in this catalog the behavior is:

- **Free tier (default):** structured output where the FDA-label parse
  succeeds; prose fallback (via the existing
  `renal_dose_adjustment`-style composites) where it doesn't; `tier: "free"`.
- **Licensed tier (Lexicomp / Micromedex when configured):** structured
  output from the licensed monograph database, which carries explicit
  CrCl bands, indication-specific dose tables, and pediatric-specific dosing
  that the FDA label often does not enumerate. `tier: "licensed-lexicomp"`
  (or `-micromedex`).
- **One tool that breaks this pattern:** `check_iv_y_site_compatibility` has
  no free-tier answer — there is no safe degraded output. That tool errors
  with `LICENSE_REQUIRED` on the free tier rather than guess. This is the
  documented exception in ARCHITECTURE.md §3.3 for tools with no free-tier
  fallback.

The free-tier-to-licensed-tier upgrade for dosing should be transparent to the
agent: same tool name, same input schema, richer `data` and different `tier`.
This matches how `get_drug_interactions` already works (FDA label prose → free,
DrugBank structured → licensed).

### 6. Other discoveries

**a. Indication branching is unavoidable for several tools.**

Several tools (rivaroxaban, enoxaparin, daptomycin, fluconazole, dabigatran)
have different dosing for different indications:

- Rivaroxaban: AF prophylaxis, VTE treatment, VTE prophylaxis, post-MI, all
  different doses.
- Enoxaparin: VTE prophylaxis (40 mg daily / 30 mg BID), VTE treatment
  (1 mg/kg BID), bridging.
- Daptomycin: skin/soft tissue (6 mg/kg), bacteremia/endocarditis (8–10 mg/kg).

These need an `indication` enum input. The catalog rows above call this out
in `notes` but the implementation should standardize the enum across tools —
something like `indication: "af-stroke-prevention" | "vte-treatment" |
"vte-prophylaxis" | "acs-secondary-prevention" | ...`. A small shared
enum in `@openclinicalai/drugs/types.ts` makes the surface predictable.

**b. Severity / clinical context branching for opioid and electrolyte tools.**

Sodium correction rate depends on chronic-vs-acute hyponatremia (the
correction-rate cap differs). The catalog row above flags this but it
generalizes — several tools need a `clinical_context` discriminator (acute /
chronic, mild / severe, naive / pretreated). The pattern matches the
`indication` enum from (a) above; ship a shared enum.

**c. Toxic-narrow-window drugs need a hard refusal pattern.**

High-dose methotrexate, colistin, busulfan, and amphotericin B desoxycholate
have toxic narrow therapeutic windows where a confidently-wrong dose
recommendation could kill a patient. For these tools the catalog flags
`controversial` priority and recommends shipping with hard warnings ("confirm
with oncology / ID / institutional pharmacist"). The tool returns a
recommendation but the `warnings` field carries the consult prompt. The
clinician-validation gate in ARCHITECTURE.md §1 priority 6 applies here in
spades: these tools must pass clinician review with the specific question
"would you trust this output without consultation?" before they ship.

**d. The `dose_*` prefix is new — register it in registry.ts.**

The existing `packages/drugs/src/registry.ts` exports `drugTools()` =
`atomicDrugTools + compositeDrugTools`. The dosing tools constitute a third
category. Suggest splitting `tools/dosing.ts` (or further: `tools/dosing-renal.ts`,
`tools/dosing-pk.ts`, `tools/dosing-anticoag.ts`, etc.) and a `dosingTools` export
that the registry concatenates. Mirrors how the calc package shards its
calculators by domain.

**e. Caching TTL for dosing tools.**

Per ARCHITECTURE.md §4.1, openFDA labels cache for 7 days. Dosing tools that
parse labels inherit that TTL. Pure-compute PK tools (`calc_vancomycin_auc_dose`,
`calc_carboplatin_calvert`) should **not cache** results (per the calc-package
convention) — the input is patient-specific and the output is patient-specific,
so cache hits are by definition stale across patients. The lookup-table tools
(`flag_beers_criteria`, `calc_mme_total_daily`) cache only the *vendored table*
behind the tool, not the tool result — a long TTL on the table file, no TTL on
the per-call computation.

**f. PHI-mode behavior for dosing tools.**

Dosing tools take clinical values (weight, age, CrCl) and RxCUIs — no PHI by
schema (per §3.5.1 invariant). The cross-cutting `phi_mode` flag still applies:
in `sensitive` mode, the prose fallback returned from `dose_renal_adjustment_structured`
should run through the redaction pipeline before being placed in the cache or
the verbose echo. The existing
`redactIfSensitive` helper from `framework.ts` already does this for
free-text inputs; the prose-fallback path needs the same treatment on the way
out (label text is not PHI but the caller's clinical narrative could be, and
the prose echo is a known leak vector for verbose-mode debugging).

**g. The pediatric dosing surface has a structural gap.**

FDA labels are weak on pediatric dosing for many drugs. AAP's Red Book (ID
drugs) and Lexicomp's NeoFax (neonatal) are the canonical structured sources;
both are licensed. The pediatric tools in this catalog should ship with an
explicit `warnings` entry on free-tier: "Pediatric dosing on the free tier is
limited to FDA-label pediatric sections; configure LEXICOMP_API_KEY for
NeoFax-equivalent neonatal and toddler dosing." Same shape as the existing
`get_drug_interactions` warnings entry.

**h. Bundled-data sourcing pattern.**

The CDC 2022 MME table, the AGS Beers 2023 criteria, the STOPP/START v3
table, and the Hartford aminoglycoside nomogram are all small, public,
slow-changing tables. They should ship **bundled** in the package (same
pattern as the USPSTF snapshot in `@openclinicalai/evidence`), with a
`primary_source` PMID-linked citation and a versioned JSON file under
`packages/drugs/src/data/`. The README should document the update cadence
(annual for CDC and AGS, ad-hoc for the others) and the file ships with a
`retrieved_at` and `published_at` field.

---

## v0.1 must-have shortlist

These 13 tools cover the highest-clinical-traffic dosing questions and have
the cleanest derivations + parses. Shipping these is the v0.1 dosing surface;
the rest of the catalog is v0.5 and beyond.

| # | name | slug | category | why it's must-have |
|---|---|---|---|---|
| 1 | Vancomycin AUC/MIC dosing | `calc_vancomycin_auc_dose` | antimicrobial-dosing | Highest-volume pharmacist consult in inpatient. 2020 ASHP/IDSA consensus mandate. |
| 2 | Aminoglycoside once-daily (Hartford) | `calc_aminoglycoside_hartford` | antimicrobial-dosing | Universal ICU + ID. Nomogram is public and finite. |
| 3 | Structured renal dose adjustment | `dose_renal_adjustment_structured` | renal-adjustment | The structured sibling of our existing prose composite. Highest-leverage payoff per implementation effort. |
| 4 | Apixaban dose adjustment | `dose_doac_apixaban_adjusted` | anticoagulant-dosing | Most-prescribed DOAC. 2/3 dose-adjustment criteria are a common prescribing error. |
| 5 | Rivaroxaban dose adjustment | `dose_doac_rivaroxaban_adjusted` | anticoagulant-dosing | Indication-driven dosing is the single most common DOAC dosing error. |
| 6 | Enoxaparin adjusted dosing | `dose_enoxaparin_adjusted` | anticoagulant-dosing | Renal + weight + obesity nuance. Anti-Xa-monitoring flag is the agent's win. |
| 7 | UFH weight-based dosing | `calc_heparin_weight_based` | anticoagulant-dosing | Universal. VTE + ACS branches. |
| 8 | 4F-PCC (Kcentra) reversal | `calc_4fpcc_kcentra` | reversal-dosing | High-acuity, finite table. Off-by-one in INR-band would be dangerous. |
| 9 | Carboplatin AUC (Calvert) | `calc_carboplatin_calvert` | chemotherapy-dosing | Single most-cited oncology dosing formula. Pure-compute, no parse needed. |
| 10 | Total daily MME | `calc_mme_total_daily` | opioid-conversion | The headline opioid tool. CDC 2022 conversion factors are public. |
| 11 | Equianalgesic opioid conversion | `calc_opioid_equianalgesic` | opioid-conversion | The companion to MME. Incomplete-cross-tolerance haircut is the clinical add. |
| 12 | Beers Criteria flag | `flag_beers_criteria` | geriatric-dosing | AGS 2023 vendor-able. Single highest-leverage geriatric prescribing surface. |
| 13 | Sodium correction rate | `calc_sodium_correction_rate` | electrolyte-replacement | ICU-traffic. ODS / CPM risk is the prototypical avoidable-harm reason for a dosing tool. |

Implementation note: the v0.1 shortlist is designed to ship in **two passes**:

- **Pass A — pure-compute (no FDA label parse needed):**
  `calc_vancomycin_auc_dose`, `calc_aminoglycoside_hartford`,
  `calc_carboplatin_calvert`, `calc_mme_total_daily`, `calc_opioid_equianalgesic`,
  `calc_heparin_weight_based`, `calc_4fpcc_kcentra`, `calc_sodium_correction_rate`,
  `flag_beers_criteria` (vendored table, no parse). 9 tools. Can ship in
  parallel with the existing drugs surface — no new dependencies.
- **Pass B — FDA-label-parse-dependent:** `dose_renal_adjustment_structured`,
  `dose_doac_apixaban_adjusted`, `dose_doac_rivaroxaban_adjusted`,
  `dose_enoxaparin_adjusted`. 4 tools. These depend on the per-drug label
  parser shipping first, which has its own test-fixture-curation cost.

Recommend Pass A first to unblock the high-traffic pharmacist-consult
workflow, then Pass B to start the structured-output surface.

---

## Couldn't-resolve list

These came up during research and were left out of the catalog with
deliberation. Documenting them so the next person doesn't have to re-do the
work.

| name | reason left out |
|---|---|
| Vancomycin two-level Bayesian fit (full) | Genuinely belongs in a dedicated PK calculator (DoseMeRx / InsightRx). Free-tier first-order PK estimate from the same paper (Matzke 1984) is what we ship; a "real Bayesian" version is a future enhancement that needs a Bayesian library (not in scope for v0.5). |
| Tacrolimus / cyclosporin TDM dosing | Genotype + drug-interaction + steady-state-shift complexity. The free-tier answer is "consult transplant pharmacy"; the licensed-tier answer needs Lexicomp's transplant module. Worth a row at v1.0 when we have a licensed tier wired up. |
| Phenytoin albumin-corrected level + dose adjustment | The level correction (Sheiner-Tozer) is `calc`-package territory — it's a pure formula. The dose adjustment is a single Kelman 1975 nomogram. Worth a row at v0.5 once the level-correction calculator lives in `calc`. |
| Antiretroviral dosing with renal / hepatic / TB-IRIS adjustments | The HIV-DDI surface is so dense that this is genuinely a licensed-tier-only domain — DHHS guidelines change quarterly and the structured tables live in Lexicomp / Liverpool HIV Interactions. Free-tier should refuse and link out. |
| Dose-banding (oncology rounding to vial sizes) | NHS Cancer Network practice; finite tables exist but they're institutional. Not a generic surface. |
| Theophylline dosing | Niche; toxic narrow window. Few enough patients on it that we deferred. |
| Lithium TDM dosing | Niche post-SSRI era; the structured dose adjustment is in older psychiatric pharmacology references. Worth a v1.0 row. |
| Digoxin TDM dosing (Bauer / Konishi nomograms) | Cardiology niche; the nomograms are well-published (Bauer LA 1980) but the surface is small. v0.5 candidate. |
| Lidocaine / amiodarone IV loading + maintenance | ACLS-protocol territory — these are usually decided at the bedside from a code algorithm card, not from a dosing tool. The catalog row would be "look at the ACLS algorithm", which isn't a useful tool. |
| Pediatric maintenance fluids (Holliday-Segar 4-2-1) | Pure formula, no drug identity. Belongs in `@openclinicalai/calc`, already listed there as `calc_maintenance_fluids` (planned-v0.5). |
| Sodium deficit formula | Pure formula, lives in `calc`. The companion tool `calc_sodium_correction_rate` *is* in this catalog because it returns the per-drug (3 % saline) infusion rate. |
| Corrected calcium for albumin | Pure formula, lives in `calc` (`calc_corrected_calcium`, planned-v0.5). The drugs-side companion would be a `dose_calcium_replacement` tool — leaving it out of the must-have because the data is institutional-protocol-driven, not a clean published nomogram. |
| Glucarpidase rescue for methotrexate toxicity | Bundled into `calc_methotrexate_hdmtx` rather than a standalone tool — same indication, same paper (Howard 2016). |
| Heparin protamine reversal dosing | Worth a row at v0.5. Left out of the must-have only because of the niche-traffic argument relative to 4F-PCC. |
| Insulin pump basal / bolus profile setup | Endocrinology specialty workflow, not an MCP-tool-shape question. The agent should consult endocrinology, not compute a pump profile. |
| Continuous renal replacement (CRRT) effluent-based dosing | A subset of `dose_rrt_adjustment`; rolled into that row. |

---

## How to contribute a row

1. Pick a `should-have` or `nice-to-have` row (or add a new one in the
   appropriate category table).
2. Open the `primary_source`. For FDA-label rows, fetch the label via the
   existing `resolveLabel(rxcui)` plumbing and pull the relevant section
   text. For guideline rows, find the PMID and read the dosing table.
3. Implement the tool in `packages/drugs/src/tools/dosing-<category>.ts`,
   using `defineTool()` from `@openclinicalai/shared` (same pattern as
   `tools/atomic.ts` and `tools/composite.ts`).
4. For label-parsing tools, write the per-drug parser as a deterministic
   regex / structured-text heuristic in
   `packages/drugs/src/parsers/<drug-or-section>.ts`. Cover at least 5
   FDA-label fixtures (test-vendored) — the parse-confidence enum exists
   because parses fail; make sure the test catches a known-bad parse.
5. For PK-model tools, cite the PK paper in `sources` and document the
   per-drug constants (Vd, Cl, half-life) inline in the source file. The
   constants are clinical content and need to be verifiable.
6. Add a clinician-validation row to the v0.1 release checklist (per
   ARCHITECTURE.md §1 priority 6) — every interpretive band ("8 mg/kg q24h
   for bacteremia") needs a clinician sign-off before it ships.
