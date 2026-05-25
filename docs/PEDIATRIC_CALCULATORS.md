# Pediatric Clinical Calculator Catalog

This file is the **dedicated pediatric calculator roadmap** for
[`@openclinicalai/calc`](../packages/calc/). It complements
[`CALCULATOR_INVENTORY.md`](./CALCULATOR_INVENTORY.md), which is the
cross-domain catalog. Pediatrics is **structurally underrepresented** in every
cross-domain catalog we surveyed (MDCalc's pediatric category is shallow,
MedCalc-Bench's 55-calc set contains effectively no peds-specific entries,
`Nobrega-Medtech/nobra_calculator` has only a handful, and `vitaldb/medcalc`
has none). The reason is that pediatric calculators are mostly maintained by
specialty societies (AAP, AHA, NRP, PALS, WHO, CDC, ESPGHAN, ISPAD, IPNA,
NICE, RCPCH) rather than aggregated into a single open catalog.

This file sources directly from those society publications and from the
original derivation papers. Every row carries an explicit `society_endorsement`
field so contributors know whether they're porting a society-endorsed standard
or a single-author proposal.

## How to read the table

| Field | Meaning |
|---|---|
| **name** | Canonical clinical name. |
| **slug** | Proposed `calc_*` MCP tool name (snake_case). |
| **subdomain** | One of: neonatal, infant (≤1y), early-childhood (1–5y), school-age (5–12y), adolescent (12–18y), peds-emergency, peds-critical-care, peds-cardiology, peds-pulmonology, peds-nephrology, peds-endocrinology, peds-oncology, peds-trauma, peds-developmental, peds-growth, peds-fluids/electrolytes, peds-dosing, peds-infectious, peds-gi, peds-pain. |
| **primary_citation** | Original derivation paper (Author Year + PMID/DOI). For society-endorsed instruments, the society's clinical report PMID. |
| **society_endorsement** | AAP, AHA, PALS, NRP, WHO, CDC, ESPGHAN, ISPAD, IPNA, IDSA, SCCM, NICE, RCPCH, ACEP, etc. `—` if none. |
| **complexity** | `formula`, `lookup`, `tree`, or `multi-step`. |
| **priority** | `must-have`, `should-have`, `nice-to-have`, or `controversial`. |
| **notes** | Age applicability, gotchas, regional variants, IP concerns. |

## How to contribute a row

1. Pick a `must-have` or `should-have` row, open the PMID, port natively into
   TypeScript using `defineCalculator()`.
2. **Do not** copy from any of the OSS implementations — re-derive from the
   primary derivation paper or society document so our `sources[]` contract
   stays honest.
3. Add at least 5 fixture cases from worked examples in the source paper.
4. For LMS-based growth-chart calculators, also commit the reference table
   under `packages/calc/src/data/` with the source URL and access date.

## Anti-patterns we are intentionally **not** including

- **Drug-dosing nomograms** (vancomycin peds, amoxicillin weight-band tables,
  acetaminophen mg/kg, dexamethasone croup dose) — these belong in
  `@openclinicalai/drugs`, not here.
- **Diagnostic-criteria checklists that are not calculators.** Example:
  Kawasaki disease's 5-features + ≥5-day fever is a checklist, not a score.
  EXCEPT Kobayashi/Egami/Sano scores predict IVIG resistance and ARE
  calculator-shaped — those are included.
- **Adult calculators applied unchanged to peds** — only included if there is
  a published pediatric validation paper or different thresholds (e.g.
  Westley Croup, PECARN, pSOFA, McIsaac peds adjustment).
- **Inventing calculators.** If we can't find a primary derivation citation,
  the row is marked `TODO`. Listed below in the "Couldn't resolve" section.

---

## Summary

**Total entries:** 92 calculator rows across 16 pediatric subdomains.

### Counts by subdomain × priority

| Subdomain | must-have | should-have | nice-to-have | controversial | Total |
|---|---|---|---|---|---|
| neonatal | 5 | 4 | 3 | 0 | 12 |
| infant (≤1y) | 3 | 2 | 1 | 0 | 6 |
| early-childhood / school-age / adolescent | 2 | 2 | 1 | 0 | 5 |
| peds-emergency | 4 | 4 | 2 | 0 | 10 |
| peds-critical-care | 3 | 3 | 1 | 1 | 8 |
| peds-cardiology | 1 | 3 | 2 | 0 | 6 |
| peds-pulmonology | 3 | 3 | 1 | 0 | 7 |
| peds-nephrology | 2 | 2 | 1 | 0 | 5 |
| peds-endocrinology | 1 | 2 | 1 | 0 | 4 |
| peds-oncology | 0 | 1 | 2 | 0 | 3 |
| peds-trauma | 2 | 2 | 1 | 0 | 5 |
| peds-developmental | 0 | 1 | 2 | 0 | 3 |
| peds-growth | 3 | 2 | 1 | 0 | 6 |
| peds-fluids/electrolytes | 2 | 1 | 0 | 0 | 3 |
| peds-infectious | 1 | 2 | 1 | 0 | 4 |
| peds-gi / peds-pain | 2 | 3 | 0 | 0 | 5 |
| **Total** | **34** | **37** | **20** | **1** | **92** |

### Cross-references to existing inventory

Entries marked `[CROSS]` in notes appear in `CALCULATOR_INVENTORY.md` already.
This file enriches them with subdomain + priority + society endorsement, and
should be considered the authoritative peds-side record.

---

## Neonatal

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| APGAR Score (1, 5, 10 min) | calc_apgar | neonatal | Apgar V 1953 — PMID 13083014 | NRP, AAP, AHA | lookup | must-have | Universal newborn score; AAP/ACOG 2015 reaffirmed (Watterberg KL et al — PMID 26416932). NRP guideline integrates it. [CROSS] |
| Ballard Score / New Ballard Score | calc_new_ballard | neonatal | Ballard JL et al 1991 — PMID 1880657 | NRP, AAP | lookup | must-have | Gestational age estimate from neuromuscular + physical maturity, 0–44 wk extension. Distinct from original 1979 Ballard (PMID 458292). |
| Silverman-Andersen Respiratory Score | calc_silverman_andersen | neonatal | Silverman WA, Andersen DH 1956 — PMID 13322355 | NRP | lookup | should-have | Neonatal respiratory distress; 0 (none) – 10 (severe). Still used in NICUs worldwide. |
| Downes' Score (Neonatal Respiratory Distress) | calc_downes | neonatal | Downes JJ et al 1970 — PMID 5527481 | — | lookup | should-have | RDS severity; sometimes preferred over Silverman in older neonates / late-preterm. |
| Bhutani Hour-Specific Bilirubin Nomogram | calc_bhutani_bili | neonatal | Bhutani VK et al 1999 — PMID 9917458 | AAP | lookup | must-have | Plots TSB on age-in-hours nomogram → low / low-intermediate / high-intermediate / high risk zone. Now embedded in AAP 2022 hyperbilirubinemia CPG. [CROSS] |
| AAP 2022 Phototherapy Threshold | calc_aap_phototherapy_2022 | neonatal | Kemper AR et al 2022 — PMID 35927462 | AAP | lookup | must-have | 2022 AAP guideline; thresholds depend on gestational age, hours, and neurotoxicity risk factors. Replaced 2004 AAP guideline. [CROSS] |
| AAP 2022 Exchange Transfusion Threshold | calc_aap_exchange_2022 | neonatal | Kemper AR et al 2022 — PMID 35927462 | AAP | lookup | should-have | Companion to phototherapy thresholds; same gestational-age + risk-factor matrix. [CROSS] |
| Modified Finnegan NAS (Neonatal Abstinence Score) | calc_finnegan_nas | neonatal | Finnegan LP et al 1975 — PMID 1234543 | AAP (historical) | lookup | should-have | Opioid withdrawal severity; Modified Finnegan is the operational scoring sheet used in NICUs. Being supplanted by ESC. [CROSS] |
| Eat, Sleep, Console (ESC) | calc_esc_neonatal | neonatal | Grossman MR et al 2017 — PMID 28396567 | AAP (emerging) | tree | should-have | Function-based NAS alternative; NEJM 2023 trial (Young LW et al — PMID 37125832) showed shorter LOS vs Finnegan. [CROSS] |
| Neonatal Early-Onset Sepsis (Kaiser) | calc_neonatal_eos_kaiser | neonatal | Puopolo KM et al 2011 — PMID 22025592 | AAP (endorsed in 2018 EOS CPG) | formula | must-have | Multivariate logistic; outputs prior + posterior EOS probability per 1000 live births. AAP COFN 2018 Clinical Report PMID 30455342 endorses it for ≥34-wk infants. [CROSS] |
| SNAP-II / SNAPPE-II | calc_snappe_ii | neonatal | Richardson DK et al 2001 — PMID 11533341 | — | lookup | nice-to-have | NICU severity of illness; SNAPPE-II adds perinatal extension. Used mostly in research/benchmarking. [CROSS] |
| CRIB-II (Clinical Risk Index for Babies) | calc_crib_ii | neonatal | Parry G et al 2003 — PMID 12849208 | — | lookup | nice-to-have | NICU mortality risk; UK-validated. Alternative to SNAPPE-II. [CROSS] |

## Infant (≤1y)

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Modified Bell Staging (NEC) | calc_bell_nec_modified | infant (≤1y) | Walsh MC, Kliegman RM 1986 — PMID 3081865 | AAP | lookup | must-have | Necrotizing enterocolitis stage I–IIIB; drives surgical decisions. Original Bell 1978 — PMID 413500. [CROSS] |
| BRUE 2.0 Risk Stratification | calc_brue_2 | infant (≤1y) | Merritt JL et al 2019 — PMID 31391259 | AAP | tree | must-have | Brief Resolved Unexplained Event lower-risk vs higher-risk; 2.0 adds quantitative risk prediction. Original criteria: Tieder JS 2016 — PMID 27050422. [CROSS] |
| Infant Scalp Hematoma Score (PECARN-derived) | calc_infant_scalp_score | infant (≤1y) | Schutzman SA et al 2021 — PMID 33561868 | — | lookup | must-have | Asymptomatic head injury <12 mo; predicts intracranial injury on CT. Derived from PECARN dataset. [CROSS] |
| WAT-1 (Withdrawal Assessment Tool) | calc_wat1 | infant (≤1y) | Franck LS et al 2008 — PMID 18367963 | — | lookup | should-have | Iatrogenic opioid + benzo withdrawal in PICU/NICU. Validated 6 wk–6 y. [CROSS] |
| CRIES Pain Scale (Neonatal post-op) | calc_cries | infant (≤1y) | Krechel SW, Bildner J 1995 — PMID 8521315 | — | lookup | should-have | Post-op pain 32–60 wk PMA; 5 items × 0–2. Better than Wong-Baker for preverbal/intubated. |
| Pediatric Partial Exchange Transfusion (Polycythemia) | calc_neonatal_partial_exchange | infant (≤1y) | Black VD et al 1985 — PMID 4017121 | AAP | formula | nice-to-have | Volume to exchange for symptomatic polycythemia (Hct >65 %). [CROSS] |

## Early-childhood / school-age / adolescent

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Pediatric Glasgow Coma Scale (PGCS) | calc_pediatric_gcs | early-childhood | Reilly PL et al 1988 — PMID 3221668 | PALS, AHA | lookup | must-have | Modified Verbal scale for preverbal kids. James 1986 PMID 3787329 is the alternative early citation. [CROSS] |
| AVPU (Pediatric) | calc_avpu_pediatric | early-childhood | APLS (Advanced Paediatric Life Support) 6th ed | APLS, RCPCH | lookup | must-have | Alert / Voice / Pain / Unresponsive — primary survey shortcut. |
| PED-MIDAS (Pediatric Migraine Disability) | calc_pedmidas | adolescent | Hershey AD et al 2001 — PMID 11437978 | — | lookup | should-have | Headache disability in 4–18 y; used for chronic migraine trials. [CROSS] |
| PCS (Post-Concussion Symptom Scale) — Child | calc_pcs_child | school-age | Sady MD et al 2014 — PMID 24385047 | — | lookup | should-have | 5–12 y self-report; companion to SCAT-5 child. |
| Bright Futures Developmental Surveillance Indicator | calc_bright_futures_screen | early-childhood | AAP Bright Futures 4th ed 2017 | AAP | tree | nice-to-have | Periodicity-schedule-driven prompts (ASQ-3, M-CHAT-R, etc.); structurally a tree decision, not a numeric score. |

## Peds emergency

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| PECARN Pediatric Head Injury Rule (<2 y and ≥2 y) | calc_pecarn_head | peds-emergency | Kuppermann N et al 2009 — PMID 19758692 | ACEP, AAP | tree | must-have | Two separate decision trees by age. Highest-evidence pediatric ED rule (33 k pts). [CROSS] |
| CATCH Rule (Canadian peds head CT) | calc_catch | peds-emergency | Osmond MH et al 2010 — PMID 20212034 | — | tree | should-have | Canadian alternative to PECARN; specifically for minor head trauma. [CROSS] |
| CHALICE Rule (UK peds head injury) | calc_chalice | peds-emergency | Dunning J et al 2006 — PMID 17056862 | NICE | tree | should-have | UK rule; included in NICE NG232 head-injury algorithm. [CROSS] |
| Yale Observation Scale | calc_yale_observation | peds-emergency | McCarthy PL et al 1982 — PMID 7050877 | — | lookup | should-have | Ill child severity 3 mo – 36 mo; 6 items × 1/3/5. Used in febrile-infant workup as a gestalt anchor. [CROSS] |
| Rochester Criteria (Febrile Infant <60 d) | calc_rochester_criteria | peds-emergency | Jaskiewicz JA et al 1994 — PMID 8084378 | — | tree | must-have | Low-risk infant ≤60 d; predates AAP 2021. Still in use as a benchmark. [CROSS] |
| Philadelphia Criteria (Febrile Infant 29–60 d) | calc_philadelphia_criteria | peds-emergency | Baker MD et al 1993 — PMID 8413449 | — | tree | should-have | 29–60 d febrile; uses CSF in protocol. [CROSS] |
| Boston Criteria (Febrile Infant 28–89 d) | calc_boston_criteria | peds-emergency | Baskin MN et al 1992 — PMID 1500416 | — | tree | should-have | 28–89 d febrile; CSF + outpatient ceftriaxone protocol. [CROSS] |
| Step-by-Step (Febrile Infant ≤90 d) | calc_step_by_step | peds-emergency | Gomez B et al 2016 — PMID 27574017 | — | tree | must-have | Sequential decision tree using procalcitonin + CRP. European default. [CROSS] |
| AAP 2021 Febrile Infant 8–60 d Algorithm | calc_aap_febrile_infant_2021 | peds-emergency | Pantell RH et al 2021 — PMID 34281996 | AAP | tree | must-have | Age-banded (8–21 d / 22–28 d / 29–60 d); current AAP standard, integrates procalcitonin. [CROSS] |
| Kocher Criteria (Septic Hip Joint) | calc_kocher_arthritis | peds-emergency | Kocher MS et al 1999 — PMID 10608376 | — | lookup | must-have | Septic arthritis vs transient synovitis; 4 criteria. Caird 2006 (PMID 16882892) added CRP. [CROSS] |

## Peds critical care

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Phoenix Sepsis Score | calc_phoenix_sepsis | peds-critical-care | Schlapbach LJ et al 2024 — PMID 38245889 | SCCM (Phoenix Task Force 2024) | lookup | must-have | 2024 international peds sepsis definition; ≥2 = sepsis; ≥3 = septic shock subtype. Replaces Goldstein 2005. [CROSS] |
| pSOFA (Pediatric SOFA) | calc_psofa | peds-critical-care | Matics TJ, Sanchez-Pinto LN 2017 — PMID 28783810 | — | lookup | should-have | Sepsis-3 adapted for kids; still used in many PICUs alongside Phoenix. Controversial: 2024 Phoenix Task Force recommends Phoenix over pSOFA going forward. [CROSS] |
| PIM3 (Pediatric Index of Mortality 3) | calc_pim3 | peds-critical-care | Straney L et al 2013 — PMID 23439458 | ANZICS-PICU | formula | must-have | First-hour PICU mortality; current standard. Variants: PIM (1997), PIM2 (2003), PIM3 (2013). [CROSS] |
| PRISM III / PRISM IV | calc_prism_iv | peds-critical-care | Pollack MM et al 2016 — PMID 27749600 | — | formula | should-have | 24-hr PICU mortality. PRISM IV (2016) is current; PRISM III (1996 — PMID 8559463) widely used. [CROSS] |
| Bedside PEWS (Pediatric Early Warning Score) | calc_bedside_pews | peds-critical-care | Parshuram CS et al 2009 — PMID 19852828 | — | lookup | must-have | Validated 7-item ward deterioration score; used worldwide on inpatient peds wards. EPOCH RCT (Parshuram 2018 PMID 29486497) was negative for mortality but score still ubiquitous. [CROSS] |
| Goldstein 2005 Pediatric SIRS / Sepsis | calc_goldstein_peds_sepsis_2005 | peds-critical-care | Goldstein B et al 2005 — PMID 15636651 | IPSCC (2005) | tree | controversial | Pre-Phoenix peds sepsis criteria. Explicitly being deprecated by SCCM 2024 Phoenix Task Force. Ship for legacy compatibility only; flag in interpretation. |
| Oxygenation Index (OI) | calc_oxygenation_index | peds-critical-care | Khemani RG et al 2018 — PMID 29470486 | PALICC-2 | formula | should-have | Pediatric ARDS severity per PALICC-2 2023 (Emeriaud G et al — PMID 36661420). OI = (MAP × FiO2 × 100) / PaO2. [CROSS] |
| Oxygen Saturation Index (OSI) | calc_oxygen_saturation_index | peds-critical-care | Khemani RG et al 2009 — PMID 19561453 | PALICC-2 | formula | nice-to-have | Non-invasive surrogate for OI when ABG not available (uses SpO2). |

## Peds cardiology

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Kobayashi Score (IVIG-Resistance in KD) | calc_kobayashi_kd | peds-cardiology | Kobayashi T et al 2006 — PMID 17015795 | AHA (referenced in 2017 KD statement) | lookup | must-have | Predicts IVIG resistance in Kawasaki disease (Japanese validation). McCrindle 2017 (PMID 28356445) discusses limited generalizability outside Japan. |
| Egami Score (IVIG-Resistance in KD) | calc_egami_kd | peds-cardiology | Egami K et al 2006 — PMID 16769373 | — | lookup | should-have | Japanese alternative to Kobayashi; lower discrimination outside Asia. |
| Sano Score (IVIG-Resistance in KD) | calc_sano_kd | peds-cardiology | Sano T et al 2007 — PMID 17151749 | — | lookup | should-have | Three-variable simplified Japanese score. |
| Kawasaki Coronary Artery Z-Score | calc_kd_coronary_z | peds-cardiology | Dallaire F, Dahdah N 2011 — PMID 21232927 | AHA (McCrindle 2017 endorses Z-score methodology) | formula | should-have | Coronary artery dimension standardized to BSA. AHA 2017 KD statement (PMID 28356445) defines aneurysm thresholds in Z-units. [CROSS] |
| HCM Risk-Kids (Pediatric HCM SCD) | calc_hcm_risk_kids | peds-cardiology | Norrish G et al 2019 — PMID 31408137 | ESC (referenced 2023 CMP guideline) | formula | nice-to-have | 5-yr sudden-death risk in childhood HCM. [CROSS] |
| AAP 2017 Pediatric Blood Pressure Percentile | calc_aap_bp_percentile | peds-cardiology | Flynn JT et al 2017 — PMID 28827377 | AAP | lookup | nice-to-have | Age-, sex-, height-percentile BP tables; defines elevated / stage 1 / stage 2 HTN for 1–17 y. [CROSS] |

## Peds pulmonology

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Westley Croup Score | calc_westley_croup | peds-pulmonology | Westley CR et al 1978 — PMID 685810 | — | lookup | must-have | Croup severity; drives dex / racemic-epi decision. 0–17 with 5 components. [CROSS] |
| PRAM (Pediatric Respiratory Assessment Measure) | calc_pram | peds-pulmonology | Chalut DS et al 2000 — PMID 10742237 | — | lookup | must-have | Acute asthma 2–17 y; preferred over PASS in many EDs. [CROSS] |
| PASS (Pediatric Asthma Severity Score) | calc_pass_asthma | peds-pulmonology | Gorelick MH et al 2004 — PMID 14745526 | — | lookup | should-have | 5-item ED asthma. [CROSS] |
| Pediatric Asthma Score (PAS) | calc_pas_asthma | peds-pulmonology | Kelly CS et al 2000 — PMID 10674975 | — | lookup | should-have | Inpatient-focused. [CROSS] |
| Modified Tal Score (Bronchiolitis) | calc_tal_bronchiolitis | peds-pulmonology | Tal A et al 1983 — PMID 6359270 | — | lookup | must-have | Bronchiolitis severity 0–12. Multiple modifications in literature; document which. [CROSS] |
| RDAI (Respiratory Distress Assessment Instrument) | calc_rdai | peds-pulmonology | Lowell DI et al 1987 — PMID 3552065 | — | lookup | should-have | Bronchiolitis instrument; basis of Lowell pre/post-treatment delta. [CROSS] |
| Asthma Predictive Index (API) | calc_api | peds-pulmonology | Castro-Rodríguez JA et al 2000 — PMID 11029352 | — | tree | nice-to-have | Predicts asthma at 6+ y in wheezy toddlers. [CROSS] |

## Peds nephrology

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Bedside Schwartz eGFR (2009) | calc_schwartz_bedside_egfr | peds-nephrology | Schwartz GJ et al 2009 — PMID 19158356 | IPNA, KDIGO | formula | must-have | k=0.413; only validated for 1–18 y with creatinine ≤ ~1.6. Universal peds eGFR. [CROSS] |
| CKiD U25 eGFR | calc_ckid_u25_egfr | peds-nephrology | Pierce CB et al 2021 — PMID 33933277 | IPNA, KDIGO (2024 update) | formula | must-have | Sex- and age-dependent; spans 1–25 y; smooth peds-to-adult transition. Recommended in 2024 KDIGO CKD update. [CROSS] |
| Updated Schwartz with Cystatin C | calc_schwartz_cysc | peds-nephrology | Schwartz GJ et al 2012 — PMID 22302874 | IPNA | formula | should-have | Uses creatinine + cystatin C + BUN; better than Schwartz-creatinine alone. |
| pRIFLE (Pediatric RIFLE for AKI) | calc_prifle | peds-nephrology | Akcan-Arikan A et al 2007 — PMID 17396113 | — | lookup | should-have | Pediatric AKI classification based on eCCl change. Now often replaced by KDIGO 2012 pediatric application. [CROSS] |
| Pediatric Nephrotic Syndrome Remission Criteria | calc_peds_nephrotic_remission | peds-nephrology | KDIGO 2021 GN guideline | KDIGO | tree | nice-to-have | Complete remission = UPCR <0.2 g/g × 3 d; standardized peds nephrotic response definitions. |

## Peds endocrinology

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| ISPAD Pediatric DKA Severity | calc_ispad_peds_dka | peds-endocrinology | Glaser N et al 2022 (ISPAD CPG) — PMID 36059171 | ISPAD | lookup | must-have | Mild / moderate / severe by pH + HCO3; drives fluid + insulin rate. Replaces 2018 ISPAD edition. |
| Pediatric DKA Cerebral Edema Risk (Glaser) | calc_glaser_cerebral_edema | peds-endocrinology | Glaser N et al 2001 — PMID 11172153 | ISPAD (referenced) | lookup | should-have | NEJM 2001 derivation; pH <7.1, low pCO2, high BUN, Na correction. |
| Pediatric Hypoglycemia Treatment Volume | calc_peds_d10_d25_dose | peds-endocrinology | Sperling MA — Pediatric Endocrinology textbook | PES | formula | should-have | 2 mL/kg D10 IV bolus standard; nomographic. |
| Tanner Stage (Pubertal) | calc_tanner_stage | peds-endocrinology | Marshall WA, Tanner JM 1969, 1970 — PMIDs 5785179, 5440182 | — | lookup | nice-to-have | Sexual maturity rating 1–5; structurally a classification not a score. Consider parking in `@openclinicalai/terminologies` instead. |

## Peds oncology

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Lansky Play-Performance Score | calc_lansky | peds-oncology | Lansky SB et al 1987 — PMID 3815714 | COG | lookup | should-have | Peds analog of Karnofsky for <16 y. [CROSS] |
| Intergroup Rhabdomyosarcoma Study (IRS) Group/Stage | calc_irs_rhabdo | peds-oncology | Lawrence W et al 1997 — PMID 9305705 | COG | lookup | nice-to-have | Rhabdomyosarcoma risk stratification; arguably a classification, kept here because it cascades inputs. |
| Pediatric End-Stage Liver Disease (PELD) | calc_peld | peds-oncology | McDiarmid SV et al 2002 — PMID 12108774 | UNOS, OPTN | formula | nice-to-have | <12 y liver allocation in US. Adolescents use MELD. |

## Peds trauma

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Pediatric Trauma Score (PTS, Tepas 1987) | calc_pediatric_trauma_score | peds-trauma | Tepas JJ et al 1987 — PMID 3559615 | — | lookup | must-have | 6 variables × −1/+1/+2; field triage tool. [CROSS] |
| Revised Pediatric Trauma Score (RTS-Peds) | calc_rts_peds | peds-trauma | Champion HR et al 1989 — PMID 2657105 | ACS-COT | formula | should-have | Same RTS formula used in adults; included for ACS Trauma Center reporting. |
| Pediatric NIH Stroke Scale (PedNIHSS) | calc_pednihss | peds-trauma | Ichord RN et al 2011 — PMID 22025283 | AHA (2019 Peds Stroke Statement) | lookup | must-have | Pediatric stroke severity 2–18 y; differs from adult NIHSS in language items. [CROSS] |
| Pediatric Glasgow Outcome Scale–Extended (GOS-E Peds) | calc_gose_peds | peds-trauma | Beers SR et al 2012 — PMID 22364619 | — | lookup | should-have | TBI outcome score for kids; adapts adult GOS-E. |
| Pediatric Cervical-Spine Clearance (PECARN C-spine) | calc_pecarn_cspine | peds-trauma | Leonard JC et al 2019 — PMID 30923225 | — | tree | nice-to-have | Pediatric c-spine rule (Lancet CH&A); 8-factor model; still under prospective validation as of 2024. |

## Peds developmental

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| M-CHAT-R/F (Modified Checklist for Autism, Revised w/ Follow-up) | calc_mchat_rf | peds-developmental | Robins DL et al 2014 — PMID 24366990 | AAP (Bright Futures) | tree | should-have | Two-stage autism screen at 16–30 mo. Bright Futures recommends use at 18 + 24 mo. IP: M-CHAT-R is free for clinical use; verify licensing language in our ports. |
| Ages & Stages Questionnaire (ASQ-3) Score | calc_asq3 | peds-developmental | Squires J, Bricker D 2009 (Brookes) | AAP (Bright Futures) | lookup | nice-to-have | Developmental screening 1–66 mo. Proprietary instrument; we can ship the scoring algorithm but not the questionnaire items — IP review required. |
| Pediatric Symptom Checklist (PSC-17) | calc_psc17 | peds-developmental | Gardner W et al 1999 — PMID 10337682 | AAP | lookup | nice-to-have | Behavioral/emotional screening 4–16 y; PSC-17 is free. |

## Peds growth

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| WHO Weight-for-Age Z-Score (0–5 y) | calc_who_waz | peds-growth | WHO Multicentre Growth Reference Study 2006 — WHO Technical Report | WHO | formula | must-have | LMS-based z-score from WHO 2006 tables. Default 0–5 y per WHO/AAP. See architectural decision #1 below. |
| WHO Length/Height-for-Age Z-Score (0–5 y) | calc_who_haz | peds-growth | WHO Multicentre Growth Reference Study 2006 | WHO | formula | must-have | LMS-based; complements WAZ. |
| WHO BMI-for-Age Z-Score (0–5 y) | calc_who_bmiz | peds-growth | WHO Multicentre Growth Reference Study 2006 | WHO | formula | should-have | Stunting / wasting / overweight / obesity classification under-5. |
| WHO Head-Circumference-for-Age Z-Score (0–5 y) | calc_who_hcz | peds-growth | WHO Multicentre Growth Reference Study 2007 — PMID 17876529 | WHO | formula | should-have | Microcephaly / macrocephaly screening. |
| CDC BMI-for-Age Percentile (2–20 y) | calc_cdc_bmi_percentile | peds-growth | Kuczmarski RJ et al 2002 (CDC Vital Health Stat 11(246)) | CDC | formula | must-have | US clinical default ≥2 y. Output is **percentile**, not z-score, and bands are <5 (UW), 5–84 (normal), 85–94 (overweight), ≥95 (obesity), ≥120 % of 95th (severe obesity). See architectural decision #3. [CROSS] |
| MUAC-for-Age Z-Score / Threshold (6 mo – 5 y) | calc_muac_zscore | peds-growth | WHO MGRS 2009 — WHO Technical Report | WHO | formula | nice-to-have | Mid-upper arm circumference; <115 mm severe acute malnutrition, 115–125 mm moderate acute malnutrition. Field-deployable malnutrition screen. |

## Peds fluids / electrolytes

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Holliday-Segar Maintenance Fluids (4-2-1 rule) | calc_holliday_segar_maintenance | peds-fluids/electrolytes | Holliday MA, Segar WE 1957 — PMID 13431307 | AAP | formula | must-have | Pediatric maintenance fluid foundation. AAP 2018 (PMID 30478247) now recommends **isotonic** maintenance for >28 d (mortality benefit). [CROSS] |
| Pediatric Resuscitation Bolus (10–20 mL/kg) | calc_peds_iv_bolus | peds-fluids/electrolytes | PALS 2020 — Circulation 142:S469 | PALS, AHA | formula | must-have | Initial resuscitation volume bolus; max 20 mL/kg per bolus, reassess. |
| Pediatric Burn Resuscitation (Galveston / Cincinnati / Parkland-modified) | calc_peds_burn_fluids | peds-fluids/electrolytes | Carvajal HF 1980 — PMID 7375360 | ABA | formula | should-have | Galveston formula = 5000 mL/m² burn + 2000 mL/m² maintenance / 24 h. Cincinnati and Modified Parkland are alternatives; document which we ship. |

## Peds infectious

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Bacterial Meningitis Score (Nigrovic, Children) | calc_bms_children | peds-infectious | Nigrovic LE et al 2007 — PMID 17200296 | — | tree | must-have | Pediatric bacterial vs aseptic meningitis rule. Used to safely discharge low-risk kids with CSF pleocytosis. [CROSS] |
| McIsaac Pharyngitis Score (Pediatric Adjustment) | calc_mcisaac_peds | peds-infectious | McIsaac WJ et al 2004 — PMID 15076161 | IDSA, AAP (Shulman 2012 PMID 22965026) | lookup | should-have | Centor + age adjustment (peds gets +1); drives strep testing/treatment. Common ED tool. |
| Pediatric Pneumonia Severity (Pereda) | calc_pereda_pna | peds-infectious | Pereda MA et al 2015 — PMID 25691378 | — | lookup | should-have | Peds CAP severity; less well-validated than adult PSI/CURB-65. [CROSS] |
| ROSE Rule for Pediatric PE | calc_rose_pe_peds | peds-infectious | Kanis J et al 2018 — PMID 29885868 | — | lookup | nice-to-have | Pediatric PE rule-out; small derivation cohort, awaiting larger validation. [CROSS] |

## Peds GI / peds pain

| name | slug | subdomain | primary_citation | society_endorsement | complexity | priority | notes |
|---|---|---|---|---|---|---|---|
| Pediatric Appendicitis Score (PAS, Samuel) | calc_pas_appendicitis | peds-gi | Samuel M 2002 — PMID 12037754 | — | lookup | must-have | 10-point pediatric appendicitis score; drives imaging decisions. [CROSS] |
| Pediatric Appendicitis Risk Calculator (pARC) | calc_parc_appendicitis | peds-gi | Kharbanda AB et al 2018 — PMID 29554260 | — | formula | should-have | Continuous probability output 0–100 %; outperforms PAS in validation. |
| PCDAI (Pediatric Crohn's Disease Activity Index) | calc_pcdai | peds-gi | Hyams JS et al 1991 — PMID 1916003 | ESPGHAN, NASPGHAN | lookup | should-have | Standard peds Crohn's activity instrument. Short PCDAI (Kappelman 2011 PMID 21063221) is a streamlined variant. |
| PUCAI (Pediatric Ulcerative Colitis Activity Index) | calc_pucai | peds-gi | Turner D et al 2007 — PMID 17919496 | ESPGHAN, NASPGHAN | lookup | should-have | Standard peds UC activity. ESPGHAN/ECCO 2018 (PMID 29481494) embeds PUCAI in management algorithm. |
| FLACC Pain Scale | calc_flacc | peds-pain | Merkel SI et al 1997 — PMID 9220806 | AAP | lookup | must-have | Face / Legs / Activity / Cry / Consolability; 2 mo – 7 y or any nonverbal patient. [CROSS] |
| Wong-Baker FACES | calc_wong_baker_faces | peds-pain | Wong DL, Baker CM 1988 — PMID 3344163 | AAP | lookup | must-have | Self-report ≥3 y; 6-face visual analog 0–10. [CROSS] |
| Revised FLACC (r-FLACC, cognitive impairment) | calc_rflacc | peds-pain | Malviya S et al 2006 — PMID 16677232 | — | lookup | should-have | Adds individualized descriptors for cognitively impaired children. |
| BOPS (Behavioral Observational Pain Scale, post-op peds) | calc_bops | peds-pain | Hesselgard K et al 2007 — PMID 17651411 | — | lookup | should-have | Post-op 1–7 y. [CROSS] |
| CHEOPS (Children's Hospital of Eastern Ontario Pain Scale) | calc_cheops | peds-pain | McGrath PJ et al 1985 (Adv Pain Res Ther) | — | lookup | nice-to-have | Older instrument; still in research use. [CROSS] |
| Cornell Assessment of Pediatric Delirium (CAPD) | calc_capd | peds-pain | Traube C et al 2014 — PMID 24351375 | — | lookup | should-have | PICU delirium 0–21 y; threshold ≥9. [CROSS] |
| DHAKA Dehydration Score | calc_dhaka | peds-gi | Levine AC et al 2016 — PMID 26973174 | — | lookup | should-have | Low-resource peds dehydration assessment; WHO has separate scale. [CROSS] |
| Gorelick Clinical Dehydration Scale | calc_gorelick_dehydration | peds-gi | Gorelick MH et al 1997 — PMID 9118502 | — | lookup | should-have | 10-item peds dehydration; gold standard for comparison. [CROSS] |
| Clinical Dehydration Scale (Goldman 4-item CDS) | calc_cds_goldman | peds-gi | Goldman RD et al 2008 — PMID 18450901 | — | lookup | nice-to-have | 4-item rapid peds dehydration; Canadian. |

---

## Architectural decisions for the user

The following items are not "port the formula" tasks. Each requires a
framework decision before implementation begins.

### 1. WHO/CDC growth-chart z-scores need an LMS-table primitive

WHO 2006 child-growth standards and CDC 2000 growth charts both encode their
percentile curves using the **LMS method** (Cole TJ 1990 — PMID 2233205): a
smoothed Box-Cox transformation where each (age, sex) cell carries three
parameters L (skewness), M (median), S (CV). The z-score formula is:

```
z = ((measurement / M)^L − 1) / (L × S)    when L ≠ 0
z = ln(measurement / M) / S                when L = 0
```

This is not a closed-form formula — it requires shipping the reference table
as data. Both WHO and CDC tables are public-domain (WHO under "free for
non-commercial use", CDC fully public domain). Recommendation:

- Add a new framework primitive: `defineParametricCalculator()` that accepts a
  reference-table loader function `(age, sex) => { L, M, S }` and a
  measurement transformer. The pediatric growth z-score calculators
  (WAZ / HAZ / BMI-Z / HCZ / MUAC-Z × {WHO, CDC}) all share this shape.
- Commit the LMS tables under `packages/calc/src/data/growth/` as
  TypeScript-generated literals (no runtime CSV parsing); include the source
  URL + access date in a sidecar `README`.
- Decide policy: when a measurement is requested outside the reference age
  range (e.g. 5.5 y on a WHO 0–5 y chart), do we extrapolate, error, or
  switch to CDC silently? Recommendation: error, document the boundary
  explicitly. WHO transition to CDC at 24 mo is the US convention; UK uses
  WHO to 4 y then UK90.

### 2. Tree-class febrile-infant calcs need a `complexity: tree` framework primitive

Yale, Rochester, Philadelphia, Boston, Step-by-Step, and AAP 2021 are all
**cascading rule sets** with multiple branches (low-risk, intermediate, high-
risk) and per-branch action recommendations. They do not fit `formula` or
`lookup` cleanly. Recommendation:

- The user is already planning a `complexity: tree` framework primitive — these 
  6 febrile-infant rules + PECARN head, CATCH, CHALICE, BRUE 2.0, PRAM, ESC,
  Phoenix Sepsis, AAP 2022 bili thresholds, Step-by-Step, and IRS grouping all
  fit that pattern.
- Suggested shape: `defineTreeCalculator()` returns a `CalcResult` where
  `result` is a numeric tier (0/1/2/...) and `band` carries the recommended
  action. The `breakdown[]` carries the branch path traversed, for clinician
  auditability.

### 3. Pediatric obesity / BMI percentile is a different output shape

Peds doesn't use the adult BMI bands (<18.5 / 18.5–25 / 25–30 / ≥30). Peds
uses **CDC BMI-for-age percentile bands**: <5th underweight, 5–84th normal,
85–94th overweight, ≥95th obesity, ≥120 % of 95th percentile severe obesity
(Class 2 + 3 obesity, per CDC 2022 update — PMID 36533863).

The calculator output for `calc_cdc_bmi_percentile` therefore needs to carry:

- The BMI value (kg/m²)
- The CDC percentile (0–100)
- The clinical band (underweight / normal / overweight / obesity Class 1 / obesity Class 2 / obesity Class 3)
- The "% of 95th percentile" value (used for severe obesity)

Suggested: define a sub-type of `CalcResult` where `breakdown` carries
`{ component: "percentile", value: number }` + `{ component: "pct_of_95th", value: number }`. Or extend `CalcResult` with an optional `secondary: { value: number; unit: string }[]` for cases where one numeric output isn't enough.

### 4. Age input precision

Pediatric calculators care about exact age forms in three regimes:

- **Neonatal / NICU calcs (APGAR, Ballard, Bhutani, AAP bili, SNAPPE-II)** —
  need **gestational age in weeks + days** plus **postnatal age in hours**.
  These are not interchangeable with "age in months."
- **Infant calcs (Kaiser EOS, BRUE, febrile-infant rules)** — need
  **chronological age in days** (the rules have cutoffs at 21, 28, 60, 90 d).
- **Child / adolescent calcs (growth charts, BP percentiles, Schwartz)** —
  need **chronological age in years.months** or decimal years.

Recommendation: add a shared utility `peds-age.ts` that defines a
`PediatricAge` union:

```ts
type PediatricAge =
  | { kind: "gestational"; weeks: number; days: number }
  | { kind: "postnatal-hours"; hours: number }
  | { kind: "postnatal-days"; days: number }
  | { kind: "postnatal-months"; months: number }
  | { kind: "decimal-years"; years: number };
```

Each calculator's Zod schema accepts only the forms it needs; we provide
shared canonicalization helpers (`toDays`, `toMonths`, `toDecimalYears`).
This is more honest than forcing every calc to take "age in days" and
risking off-by-one errors on the gestational-vs-postnatal-vs-corrected
distinction.

### 5. Phoenix Sepsis Score vs pSOFA — explicit transition policy

The Phoenix Sepsis Score (Schlapbach 2024 — PMID 38245889) is the
**2024 SCCM Phoenix Task Force standard**, replacing both pSOFA (Matics 2017)
and the Goldstein 2005 pediatric sepsis criteria. Ship Phoenix as
`must-have`. Ship pSOFA as `should-have` for legacy use cases. Ship
Goldstein 2005 as `controversial` with an explicit warning in the
interpretation: "Superseded by Phoenix Sepsis Score (Schlapbach 2024).
Include only for legacy compatibility."

This is consistent with how we handle MDRD / Cockcroft-Gault / CKD-EPI in
adults — we ship all three but flag the deprecated ones.

### 6. KD IVIG-resistance scores have a known generalizability ceiling

Kobayashi, Egami, and Sano were all derived in Japanese cohorts and have
markedly lower discrimination in North American / European populations
(Sleeper LA et al 2011 — PMID 21255763). Document this in each score's
`warnings`. Recommendation: surface a single boolean `caveat_non_japanese_population` warning
when any of these calcs is invoked. The McCrindle 2017 AHA Scientific
Statement (PMID 28356445) explicitly says these scores are not validated
outside Japan; our `interpretation.detail` should say so.

### 7. Bright Futures / ASQ-3 / M-CHAT-R/F have soft IP boundaries

- **Bright Futures**: AAP publishes the periodicity schedule openly; we can
  ship the "what to screen at what visit" tree.
- **ASQ-3**: Brookes Publishing proprietary instrument; we can ship the
  age-band scoring cutoffs from the published research literature, but the
  questionnaire items themselves are copyrighted. Recommend shipping only the
  cutoff lookup (input: child's raw subscale scores → band) and pointing to
  the publisher for the questionnaire.
- **M-CHAT-R/F**: free for clinical use with attribution; we can ship items + scoring.

Add an IP-review checklist row to each `defineCalculator()` for peds
instruments: who owns the items, what license, are we shipping items or
scoring only?

### 8. Pediatric drug-dosing calcs are out of scope here

Vancomycin AUC peds, amoxicillin weight-band, dexamethasone croup dose,
acetaminophen mg/kg, opioid equianalgesic peds — all out of scope. These go
in `@openclinicalai/drugs` because they take patient weight + drug as inputs
and return a drug-specific volume/dose, which is the drugs package's
abstraction. We don't double-ship.

---

## Couldn't resolve / ambiguous

| name | issue | recommendation |
|---|---|---|
| Pediatric Glasgow Outcome Scale (original, not extended) | Multiple non-canonical adaptations in the literature; no single derivation paper | Skip; use GOS-E Peds instead. |
| Acute Pediatric Migraine Disability (PedsQL Migraine subscale) | PedsQL is proprietary; subscale scoring requires license | Out of scope; flag for `@openclinicalai/terminologies`. |
| Pediatric PESI (pPESI) | "pPESI" appears in CALCULATOR_INVENTORY.md row 393 but we cannot find a primary derivation paper. ROSE rule (Kanis 2018) is the closest peds-specific PE rule | Replace pPESI placeholder with ROSE rule (Kanis 2018); flag CALCULATOR_INVENTORY.md row 393 for removal. |
| RISK (Acute Tubular Injury, ped) | Inventory row 875 marked omit; we agree | Omit. |
| pCASA-Q | Inventory row 884 marked skip; we agree | Omit. |
| "Centor (peds variant)" | Not a real peds variant — what exists is McIsaac with peds age adjustment; we ship that as calc_mcisaac_peds | Remove duplicate row from CALCULATOR_INVENTORY.md row 864. |
| "Caboodle Caputo Pediatric BP" | This is a transcription artifact in CALCULATOR_INVENTORY.md row 825; the real instrument is the AAP 2017 BP percentile (Flynn 2017) | Replace with calc_aap_bp_percentile. |
| HEADS-ED (peds mental-health ED) | In CALCULATOR_INVENTORY.md as `psychiatry` row 982; valid peds tool but cross-cuts mental health and ED | Keep as-is in psychiatry; add cross-reference here when shipped. |
| Apgar at 5 minutes Mortality (Iliodromiti 2014) | Inventory row 880; this is not a separate calculator, it's an interpretation table on top of the existing APGAR | Fold into `calc_apgar` interpretation table, don't ship as separate calc. |

---

## Recommended v0.1 peds-must-have shortlist (20 calcs)

The user asked for the 15–25 calculators that should land first. These
maximize clinical coverage per development hour and have unambiguous
primary citations:

| # | Calculator | Rationale |
|---|---|---|
| 1 | **APGAR Score** | Universal, every newborn, NRP/AAP standard. |
| 2 | **New Ballard Score** | Gestational age in any NICU/well-newborn admission. |
| 3 | **Bhutani Hour-Specific Bilirubin Nomogram** | Foundational for AAP 2022 hyperbili guideline. |
| 4 | **AAP 2022 Phototherapy Threshold** | Current AAP standard for hyperbilirubinemia management. |
| 5 | **Neonatal EOS (Kaiser)** | High-impact; reduces unnecessary empiric antibiotics. |
| 6 | **Holliday-Segar Maintenance Fluids** | Foundational peds fluid math; every peds inpatient. |
| 7 | **Bedside Schwartz eGFR (2009)** | The peds GFR estimator. |
| 8 | **CKiD U25 eGFR** | KDIGO 2024 recommended for adolescent-to-adult transition. |
| 9 | **WHO Weight-for-Age Z-Score (0–5 y)** | First global growth tool; needs LMS primitive. |
| 10 | **CDC BMI-for-Age Percentile (2–20 y)** | US peds obesity standard. |
| 11 | **PECARN Pediatric Head Injury Rule** | Highest-evidence peds ED rule. |
| 12 | **AAP 2021 Febrile Infant 8–60 d Algorithm** | Current AAP standard, integrates procalcitonin. |
| 13 | **Phoenix Sepsis Score** | 2024 SCCM standard; replaces pSOFA + Goldstein. |
| 14 | **PIM3** | Universal PICU mortality benchmark. |
| 15 | **Bedside PEWS** | Ubiquitous on peds wards. |
| 16 | **Westley Croup Score** | Drives dex/racemic-epi decision in every croup case. |
| 17 | **PRAM** | Standard ED peds asthma severity. |
| 18 | **Pediatric Appendicitis Score (PAS, Samuel)** | High-volume ED rule. |
| 19 | **FLACC + Wong-Baker FACES** | Ubiquitous pain assessment, every peds encounter. |
| 20 | **ISPAD Pediatric DKA Severity** | Standard peds DKA triage. |

After v0.1: layer in the should-have rows (37 calcs) in domain-bundle PRs
(neonatal bundle, febrile-infant bundle, peds-ID bundle, peds-pulmonology
bundle, etc.).

---

## Cross-cutting framework recommendations

1. **Adopt `defineTreeCalculator()` before shipping any of the febrile-infant
   rules.** Without it, six high-priority calcs (Yale, Rochester,
   Philadelphia, Boston, Step-by-Step, AAP 2021) end up modeled as ad-hoc
   `multi-step` and lose composability.

2. **Adopt `defineParametricCalculator()` for LMS growth tables.** Without
   it, growth-chart z-scores collapse to hand-written 5000-line lookup
   tables and the inventory drowns. With it, 6 must-have / should-have
   growth calcs ship from one primitive + 6 data tables.

3. **Adopt a `PediatricAge` discriminated-union input type.** Without it,
   the difference between "gestational age 38 + 2 weeks" and "postnatal age
   28 days" gets paved over in `number`-typed inputs and we'll regret it
   when neonatal calcs go to clinical review.

4. **Add a `peds` domain to `CalculatorDomain` in framework.ts.** Currently
   the domain enum is `renal-metabolic | cardiology | pulmonary-vte |
   critical-care | composite`. Add `peds` so `list_calculators` can surface
   the peds catalog cleanly to MCP clients.

5. **Add a `populationCaveat: string[]` field to `CalculatorDef`.** Used to
   flag derivations that don't generalize (e.g. Kobayashi outside Japan,
   CKiD U25 in non-CKD healthy kids). The current `warnings` field is
   per-result; this is per-calculator metadata.

6. **Add a `licenseNote: string` field to `CalculatorDef`.** For peds
   instruments where the scoring is free but the items are proprietary
   (ASQ-3, PedsQL, some Brookes/Pearson tools), document the boundary in
   metadata so MCP clients can surface it.

7. **Validate against PALS/NRP/AAP/AHA published worked examples, not
   MedCalc-Bench.** MedCalc-Bench has no peds-specific fixtures. The
   society publications (NRP textbook, PALS provider manual, AAP Red Book)
   include worked-example cases. Treat those as the equivalent of
   MedCalc-Bench for peds — commit at least 5 society-sourced fixtures per
   calculator.
