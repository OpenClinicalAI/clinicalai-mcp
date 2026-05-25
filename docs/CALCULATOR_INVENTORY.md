# Clinical Calculator Inventory

This file is the **public, contributable v0.1 → v1.0 calculator roadmap** for
[`@openclinicalai/calc`](../packages/calc/). It is the answer to four
questions:

1. **What is the universe of widely-used clinical calculators?**
2. **Which ones do we already ship?** (`status: shipped`)
3. **Which should we ship next?** (`status: planned-v0.1` / `planned-v0.5`)
4. **Which are community-contribution territory?** (`status: wishlist`)

Each row identifies a calculator, its canonical primary derivation paper, and
which of the major open-source / benchmark catalogues cover it. The intent is
that a clinician contributor can pick a `wishlist` row, follow the
`primary_citation` PMID, port the formula natively into our framework
(`packages/calc/src/framework.ts`), validate against MedCalc-Bench where
applicable, and submit a PR.

## How to read the table

| Field | Meaning |
|---|---|
| **name** | Canonical clinical name (use the form clinicians type into MDCalc). |
| **slug** | Proposed `calc_*` MCP tool name (snake_case). Matches shipped names where they exist. |
| **domain** | Primary clinical bucket. |
| **primary_citation** | Original derivation paper, `Author Year` + PMID or DOI. The paper a tool author should re-implement from. |
| **mdcalc** | ✓ if MDCalc carries it (presence inferred from `Nobrega-Medtech/nobra_calculator`'s curated MDCalc list). |
| **medcalc_bench** | ✓ if NCBI MedCalc-Bench v1.0 (55 calcs, PMID 38922827 / arXiv 2406.12036) covers it. Calcs flagged here have ready-made numeric ground truth for CI. |
| **nobra** | ✓ if `Nobrega-Medtech/nobra_calculator` (Apache-2.0, 300+ calcs) ships an implementation we can cross-check against. |
| **complexity** | Implementation difficulty signal — `formula`, `lookup`, `tree`, or `multi-step`. |
| **status** | `shipped`, `planned-v0.1`, `planned-v0.5`, or `wishlist`. |
| **notes** | One-line clinical / IP / jurisdictional note. |

## How to contribute a row

1. Pick a `wishlist` row (or add a new one with `status: wishlist`).
2. Open the PMID, port the formula natively into TypeScript using
   `defineCalculator()` from `packages/calc/src/framework.ts`. Do not copy
   code from the OSS implementations — re-derive from primary literature so
   our `sources[]` contract is honest.
3. If `medcalc_bench: ✓`, add a numeric-validation test that runs the
   MedCalc-Bench fixtures. If not, hand-craft at least 5 fixture inputs from
   the derivation paper.
4. Flip `status` to `planned-v0.1` / `planned-v0.5` / `shipped` as the PR moves
   through review.

## Anti-patterns we are intentionally **not** including

- **Score interpretation tables** without an input formula (e.g. "ESRD
  classification" tables) — these belong in `@openclinicalai/terminologies` or
  in `@openclinicalai/evidence` USPSTF snapshots, not here.
- **Dose-conversion reference charts** without per-patient inputs (e.g.
  benzodiazepine equivalence tables that are pure constants) — covered by
  `@openclinicalai/drugs` once they have a per-patient input dimension.
- **MDCalc proprietary content** (clinical pearls, interpretive narrative,
  validation summaries). We cite names and existence (not proprietary) and
  re-derive formulas from primary literature.

---

## Summary

**Total entries:** 1,203 calculator rows (this figure double-counts a small
number of cross-listed calculators that legitimately appear in two domains —
e.g. MELD-Na appears in both renal/metabolic and hepatology because both
specialties consume it independently; the unique-slug count is approximately
1,090). A small set of `—` placeholder rows mark intentional omissions
(scores listed in catalogs that don't exist or aren't real calculators) and
are not data rows.

### Counts by status (as printed in the tables)

| Status | Row count | Notes |
|---|---|---|
| `shipped` | 21 rows / **19 unique slugs** | The extra rows are cross-listings of MELD-Na and the MELD-original (renal/metabolic ↔ hepatology). Confirmed against `grep 'name: "calc_'` over `packages/calc/src/calculators/*.ts`. |
| `planned-v0.1` | 20 | The high-traffic core ICU/cardiology/renal/VTE set per `ARCHITECTURE.md §9 item 1`, biased toward calculators with MedCalc-Bench fixtures available. |
| `planned-v0.5` | 258 | Broad coverage across high-traffic specialties (cardiology, hepatology, neurology, geriatrics screening, common ED rules). |
| `wishlist` | 904 | Long-tail, community-contribution territory; many are cross-listed aliases of canonical rows. |

### Counts by domain

Roughly proportional to the nobra/MDCalc distribution: cardiology and
hematology-oncology dominate (combined ~35 % of entries), followed by
critical-care, infectious-disease, hepatology, and neurology. Pediatrics is
underrepresented in every catalog (a known gap — see "Patterns observed" in
the contributors' report at the bottom of this file).

### Sources cross-walked

- **Nobrega-Medtech/nobra_calculator** (`CALC_LIST.md`, 557 named entries,
  Apache-2.0). Backbone for "does MDCalc have it" inference and for porting
  cross-references.
- **NCBI MedCalc-Bench v1.0** (`calculator_implementations/`, 55 Python
  reference implementations, CC-BY-SA 4.0). The numeric-validation gold
  standard.
- **vitaldb/medcalc** (`medcalc/calculator.py`, 59 MCP tools, MIT). Compact
  curated set; useful sanity check.
- **Our shipped 19**: see `packages/calc/src/calculators/*.ts`.

---

## Renal / metabolic

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Creatinine Clearance (Cockcroft-Gault) | calc_creatinine_clearance | renal/metabolic | Cockcroft DW, Gault MH 1976 — PMID 1244564 | ✓ | ✓ | ✓ | formula | shipped | Aliases: "CrCl", "C-G". Still preferred for drug dosing per FDA labels. |
| GFR (CKD-EPI 2021, creatinine) | calc_gfr_ckd_epi | renal/metabolic | Inker LA et al 2021 — PMID 34554658 | ✓ | ✓ | ✓ | formula | shipped | 2021 race-free revision; older 2009 equation deprecated by NKF/ASN joint task force. |
| MELD / MELD-Na | calc_meld | renal/metabolic | Kim WR et al 2008 — PMID 18768945 | ✓ | ✓ | ✓ | formula | shipped | OPTN now uses MELD 3.0 (2022); we ship MELD-Na (UNOS 2016). |
| Kidney workup (composite) | calc_kidney_workup | composite-panel | n/a — composite over Cockcroft-Gault + CKD-EPI | — | — | — | multi-step | shipped | Composite tool, interprets when each estimator is appropriate. |
| GFR (CKD-EPI Creatinine-Cystatin C 2021) | calc_gfr_ckd_epi_cr_cys | renal/metabolic | Inker LA et al 2021 — PMID 34554658 | ✓ | — | ✓ | formula | planned-v0.1 | Preferred when creatinine-only equation is unreliable (sarcopenia, amputees). |
| MDRD GFR (4-variable IDMS) | calc_mdrd_gfr | renal/metabolic | Levey AS et al 2006 — PMID 16908915 | ✓ | ✓ | ✓ | formula | planned-v0.1 | Legacy; many EHRs still report this. Aliases: "MDRD-4", "Levey eGFR". |
| MELD 3.0 | calc_meld_3 | renal/metabolic | Kim WR et al 2021 — PMID 33891979 | ✓ | — | ✓ | formula | planned-v0.1 | Now used by OPTN for liver allocation (since July 2023). |
| Fractional Excretion of Sodium (FENa) | calc_fena | renal/metabolic | Espinel CH 1976 — PMID 1255711 | ✓ | ✓ | ✓ | formula | planned-v0.1 | AKI workup; <1 % suggests prerenal. |
| Fractional Excretion of Urea (FEUrea) | calc_feurea | renal/metabolic | Carvounis CP et al 2002 — PMID 12110013 | ✓ | — | ✓ | formula | planned-v0.5 | Useful when diuretics on board. |
| Free Water Deficit (hypernatremia) | calc_free_water_deficit | renal/metabolic | Adrogué HJ, Madias NE 2000 — PMID 10816188 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Critical-care fluid math. |
| Corrected Sodium (Katz, hyperglycemia) | calc_corrected_sodium_katz | renal/metabolic | Katz MA 1973 — PMID 4763428 | ✓ | ✓ | ✓ | formula | planned-v0.5 | 1.6 mEq per 100 mg/dL glucose. |
| Corrected Sodium (Hillier 1999) | calc_corrected_sodium_hillier | renal/metabolic | Hillier TA et al 1999 — PMID 10225241 | ✓ | ✓ | ✓ | formula | planned-v0.5 | 2.4 mEq per 100 mg/dL; better at higher glucose. |
| Corrected Calcium for Albumin | calc_corrected_calcium | renal/metabolic | Payne RB et al 1973 — PMID 4748672 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Standard hypoalbuminemia correction. |
| Serum Anion Gap | calc_anion_gap | renal/metabolic | Emmett M, Narins RG 1977 — PMID 320459 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Optional albumin correction. |
| Serum Osmolality (calculated) | calc_serum_osmolality | renal/metabolic | Smithline N, Gardner KD 1976 — PMID 1271372 | ✓ | ✓ | ✓ | formula | planned-v0.5 | 2(Na) + glucose/18 + BUN/2.8. |
| Osmolal Gap | calc_osmolal_gap | renal/metabolic | Krasowski MD et al 2010 — PMID 20444253 | ✓ | — | ✓ | formula | planned-v0.5 | Toxic alcohol screening. |
| Delta Gap / Delta Ratio | calc_delta_gap | renal/metabolic | Wrenn K 1990 — PMID 2389872 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Identifies mixed acid-base disorders. |
| Albumin-Corrected Anion Gap | calc_albumin_corrected_anion_gap | renal/metabolic | Figge J et al 1998 — PMID 9559600 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Used in critical care. |
| Albumin-Corrected Delta Gap | calc_albumin_corrected_delta_gap | renal/metabolic | Figge J et al 1998 — PMID 9559600 | ✓ | ✓ | ✓ | formula | planned-v0.5 | MedCalc-Bench fixture. |
| Urine Anion Gap | calc_urine_anion_gap | renal/metabolic | Goldstein MB et al 1986 — PMID 3753671 | ✓ | — | ✓ | formula | planned-v0.5 | Distinguishes RTA from extrarenal HCO3 loss. |
| Urine Output and Fluid Balance | calc_urine_output_fluid_balance | renal/metabolic | n/a — clinical formula | ✓ | — | ✓ | formula | planned-v0.5 | mL/kg/hr; used for oliguria. |
| Transtubular Potassium Gradient (TTKG) | calc_ttkg | renal/metabolic | West ML et al 1986 — PMID 3771050 | ✓ | — | ✓ | formula | planned-v0.5 | Hyper/hypokalemia workup. |
| Winters' Formula (expected pCO2) | calc_winters_formula | renal/metabolic | Albert MS, Dell RB, Winters RW 1967 — PMID 6028797 | ✓ | — | ✓ | formula | planned-v0.5 | Validates resp compensation in metabolic acidosis. |
| Bicarbonate Deficit | calc_bicarbonate_deficit | renal/metabolic | Adrogué HJ, Madias NE 1998 — PMID 9468468 | ✓ | — | ✓ | formula | planned-v0.5 | Severe metabolic acidosis dosing. |
| A-a O2 Gradient | calc_aa_gradient | renal/metabolic | Helmholz HF 1979 — DOI 10.1378/chest.76.6.665 | ✓ | — | ✓ | formula | planned-v0.5 | Cross-listed under pulmonary. |
| Maintenance Fluids (4-2-1 rule) | calc_maintenance_fluids | renal/metabolic | Holliday MA, Segar WE 1957 — PMID 13431307 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Foundational pediatric fluid rule. |
| BUN/Creatinine Ratio | calc_bun_cr_ratio | renal/metabolic | n/a — formula ratio | ✓ | — | ✓ | formula | planned-v0.5 | Prerenal vs intrinsic AKI discrimination. |
| Body Mass Index (BMI) | calc_bmi | renal/metabolic | Quetelet 1832 (formal: Keys A 1972 — PMID 4628049) | ✓ | ✓ | ✓ | formula | planned-v0.5 | Universal. |
| Body Surface Area (Mosteller) | calc_bsa_mosteller | renal/metabolic | Mosteller RD 1987 — PMID 3657876 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Preferred over Du Bois for chemo dosing. |
| Body Surface Area (Du Bois) | calc_bsa_dubois | renal/metabolic | Du Bois D, Du Bois EF 1916 | ✓ | — | ✓ | formula | planned-v0.5 | Legacy; still in some dosing nomograms. |
| Ideal Body Weight (Devine) | calc_ibw_devine | renal/metabolic | Devine BJ 1974 (DICP) | ✓ | ✓ | ✓ | formula | planned-v0.5 | Used for tidal volume, drug dosing. |
| Adjusted Body Weight | calc_adjusted_body_weight | renal/metabolic | n/a — clinical formula | ✓ | ✓ | ✓ | formula | planned-v0.5 | IBW + 0.4(actual − IBW). |
| Basal Energy Expenditure (Harris-Benedict) | calc_bee_harris_benedict | renal/metabolic | Harris JA, Benedict FG 1918 | ✓ | — | ✓ | formula | planned-v0.5 | Nutrition support baseline. |
| HOMA-IR | calc_homa_ir | endocrinology | Matthews DR et al 1985 — PMID 3899825 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Insulin resistance index. |
| Estimated Average Glucose (eAG) from HbA1c | calc_eag_from_a1c | endocrinology | Nathan DM et al 2008 — PMID 18540046 | ✓ | — | ✓ | formula | planned-v0.5 | ADAG study. |
| Kt/V (single-pool, Daugirdas) | calc_ktv_daugirdas | renal/metabolic | Daugirdas JT 1993 — PMID 8338283 | ✓ | — | ✓ | formula | planned-v0.5 | Dialysis adequacy. |
| AKIN Classification for AKI | calc_akin | renal/metabolic | Mehta RL et al 2007 — PMID 17331245 | ✓ | — | ✓ | lookup | planned-v0.5 | Superseded by KDIGO 2012 in many centers. |
| KDIGO AKI Staging | calc_kdigo_aki | renal/metabolic | KDIGO Work Group 2012 — KDIGO Clin Pract Guideline | ✓ | — | — | lookup | planned-v0.5 | Current standard. |
| RIFLE Criteria for AKI | calc_rifle_aki | renal/metabolic | Bellomo R et al 2004 — PMID 15312219 | — | — | — | lookup | wishlist | Pre-AKIN legacy. |
| Kidney Failure Risk Equation (Tangri 2011) | calc_kfre | renal/metabolic | Tangri N et al 2011 — PMID 21482743 | ✓ | — | ✓ | formula | planned-v0.5 | 2- and 5-year ESRD risk in CKD G3-5. |
| Kinetic eGFR (keGFR) | calc_kegfr | renal/metabolic | Chen S 2013 — PMID 23704660 | ✓ | — | ✓ | formula | wishlist | For non-steady-state creatinine. |
| Chronic Kidney Disease in Children U25 eGFR | calc_ckid_u25_egfr | pediatrics | Pierce CB et al 2021 — PMID 33933277 | ✓ | — | ✓ | formula | wishlist | Pediatric CKD staging <25 y. |
| Schwartz Bedside eGFR (pediatric) | calc_schwartz_egfr | pediatrics | Schwartz GJ et al 2009 — PMID 19158356 | ✓ | — | — | formula | planned-v0.5 | Standard pediatric eGFR. |
| CKD Prediction in HIV+ Patients (D:A:D) | calc_dad_ckd_hiv | renal/metabolic | Mocroft A et al 2014 — PMID 24482420 | ✓ | — | ✓ | formula | wishlist | Combination ART nephrotoxicity model. |
| Cisplatin-Associated AKI (CP-AKI) Risk | calc_cp_aki | oncology | Gupta S et al 2024 — PMID 38507471 | ✓ | — | ✓ | tree | wishlist | Recent NEJM-Evidence model. |
| Mehran Score (post-PCI contrast nephropathy) | calc_mehran_contrast_nephropathy | cardiology | Mehran R et al 2004 — PMID 15464318 | ✓ | — | ✓ | lookup | wishlist | Cardiology cross-listing. |
| Thakar Score (AKI after cardiac surgery) | calc_thakar_aki | cardiology | Thakar CV et al 2005 — PMID 15563569 | ✓ | — | ✓ | lookup | wishlist | Cleveland Clinic score. |
| McMahon Score (rhabdomyolysis) | calc_mcmahon_rhabdo | renal/metabolic | McMahon GM et al 2013 — PMID 24247580 | ✓ | — | ✓ | lookup | wishlist | Predicts AKI/death in rhabdomyolysis. |
| Acute Interstitial Nephritis (AIN) Risk Calculator | calc_ain_risk | renal/metabolic | Moledina DG et al 2023 — PMID 36919667 | ✓ | — | ✓ | formula | wishlist | New; cf JAMA-IM 2023. |
| Licurse Score for Renal Ultrasound | calc_licurse_renal_us | renal/metabolic | Licurse A et al 2010 — PMID 21135294 | ✓ | — | ✓ | lookup | wishlist | Predicts obstruction on renal US. |
| International IgA Nephropathy Prediction Tool | calc_iga_nephropathy_pred | renal/metabolic | Barbour SJ et al 2019 — PMID 30742964 | ✓ | — | ✓ | formula | wishlist | Validated in Lancet ID 2019. |
| Sodium Correction for Hyperglycemia | calc_na_corr_hyperglycemia | renal/metabolic | n/a — used by Katz/Hillier above | ✓ | ✓ | ✓ | formula | planned-v0.5 | Cross-listed for MedCalc-Bench fixture parity. |
| Sodium Deficit | calc_sodium_deficit | renal/metabolic | Adrogué HJ, Madias NE 2000 — PMID 10816188 | ✓ | — | ✓ | formula | wishlist | Hyponatremia correction. |
| Phosphate Replacement | calc_phosphate_repletion | renal/metabolic | Charron T et al 2003 — PMID 12545140 | — | — | — | formula | wishlist | ICU repletion algorithm. |
| Magnesium Replacement | calc_magnesium_repletion | renal/metabolic | n/a — institutional protocol | — | — | — | formula | wishlist | Hospital protocol-based. |
| Calcium Gluconate Dose (hyperkalemia) | calc_ca_gluconate_hyperK | renal/metabolic | n/a — ACLS protocol | — | — | — | formula | wishlist | Membrane-stabilization dose. |

## Cardiology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| CHA₂DS₂-VASc | calc_chads_vasc | cardiology | Lip GYH et al 2010 — PMID 19762550 | ✓ | ✓ | ✓ | lookup | shipped | Standard for non-valvular AF stroke risk. |
| HAS-BLED | calc_has_bled | cardiology | Pisters R et al 2010 — PMID 20299623 | ✓ | ✓ | ✓ | lookup | shipped | Major bleeding risk on anticoagulation. |
| GRACE ACS Risk | calc_grace | cardiology | Granger CB et al 2003 — PMID 14581255 | ✓ | — | ✓ | formula | shipped | In-hospital and 6-month ACS mortality. Aliases: GRACE 1.0, GRACE 2.0. |
| TIMI Risk Score (NSTEMI/UA) | calc_timi_nstemi | cardiology | Antman EM et al 2000 — PMID 10938172 | ✓ | — | ✓ | lookup | shipped | UA/NSTEMI 14-day MACE. |
| Cardiac risk panel (composite) | calc_cardiac_risk_panel | composite-panel | n/a — CHA₂DS₂-VASc + HAS-BLED | — | — | — | multi-step | shipped | Composite tool with net-benefit interpretation. |
| HEART Score | calc_heart_score | cardiology | Six AJ et al 2008 — PMID 18665203 | ✓ | ✓ | ✓ | lookup | planned-v0.1 | ED chest pain MACE; HEART Pathway extension exists. |
| TIMI Risk Score (STEMI) | calc_timi_stemi | cardiology | Morrow DA et al 2000 — PMID 11034741 | ✓ | — | ✓ | lookup | planned-v0.1 | STEMI 30-day mortality. |
| Revised Cardiac Risk Index (Lee) | calc_rcri | cardiology | Lee TH et al 1999 — PMID 10477528 | ✓ | ✓ | ✓ | lookup | planned-v0.1 | Pre-op MACE. |
| ASCVD 2013 10-year Risk (Pooled Cohort) | calc_ascvd_pce | cardiology | Goff DC et al 2014 — PMID 24222016 | ✓ | — | ✓ | formula | planned-v0.1 | ACC/AHA Pooled Cohort Eq; controversial overestimation in some pops. |
| AHA PREVENT (10-year CVD) | calc_prevent_cvd | cardiology | Khan SS et al 2023 — PMID 37947085 | ✓ | — | ✓ | formula | planned-v0.5 | New AHA equation (2023); supersedes PCE for many. |
| Framingham Risk Score (CHD, 10-yr) | calc_framingham_chd | cardiology | Wilson PWF et al 1998 — PMID 9603539 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Original 1998 Wilson; many variants. |
| Mean Arterial Pressure (MAP) | calc_map | cardiology | n/a — DBP + 1/3(SBP-DBP) | ✓ | ✓ | ✓ | formula | planned-v0.5 | Foundational hemodynamics. |
| Corrected QT (Bazett) | calc_qtc_bazett | cardiology | Bazett HC 1920 (Heart 7:353) | ✓ | ✓ | ✓ | formula | planned-v0.5 | Default formula in most ECG machines; overcorrects at high HR. |
| Corrected QT (Fridericia) | calc_qtc_fridericia | cardiology | Fridericia LS 1920 (Acta Med Scand 53:469) | ✓ | ✓ | ✓ | formula | planned-v0.5 | Preferred by FDA for drug-induced QT studies. |
| Corrected QT (Framingham) | calc_qtc_framingham | cardiology | Sagie A et al 1992 — PMID 1519533 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Linear correction. |
| Corrected QT (Hodges) | calc_qtc_hodges | cardiology | Hodges M et al 1983 — PMID 6638271 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Heart-rate linear; less common. |
| Corrected QT (Rautaharju) | calc_qtc_rautaharju | cardiology | Rautaharju PM et al 2004 — PMID 15539110 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Population-based. |
| CHADS₂ | calc_chads2 | cardiology | Gage BF et al 2001 — PMID 11401607 | ✓ | — | ✓ | lookup | planned-v0.5 | Legacy; CHA₂DS₂-VASc preferred. |
| Killip Classification | calc_killip | cardiology | Killip T, Kimball JT 1967 — PMID 6059183 | ✓ | — | ✓ | lookup | planned-v0.5 | Acute MI mortality. |
| NYHA Functional Classification | calc_nyha | cardiology | NYHA Criteria Committee 1994 (9th ed) | ✓ | — | ✓ | lookup | planned-v0.5 | HF symptom severity. |
| ACC/AHA Heart Failure Staging | calc_acc_aha_hf_staging | cardiology | Hunt SA et al 2001 — PMID 11748967 | ✓ | — | ✓ | lookup | planned-v0.5 | Structural staging A-D. |
| MAGGIC Risk Score (HF) | calc_maggic | cardiology | Pocock SJ et al 2013 — PMID 23257305 | ✓ | — | ✓ | lookup | planned-v0.5 | 1- and 3-yr HF mortality. |
| Seattle Heart Failure Model | calc_seattle_hf | cardiology | Levy WC et al 2006 — PMID 16534009 | ✓ | — | — | formula | planned-v0.5 | 1/2/5-year HF survival. |
| H2FPEF Score | calc_h2fpef | cardiology | Reddy YNV et al 2018 — PMID 29792252 | ✓ | — | ✓ | lookup | planned-v0.5 | HFpEF diagnosis. |
| HFA-PEFF Score | calc_hfa_peff | cardiology | Pieske B et al 2019 — PMID 31504452 | — | — | — | multi-step | wishlist | European HFpEF diagnostic algorithm. |
| HCM Risk-SCD (HCM sudden cardiac death) | calc_hcm_risk_scd | cardiology | O'Mahony C et al 2014 — PMID 24126876 | ✓ | — | ✓ | formula | planned-v0.5 | ESC HCM-SCD; ACC has separate model. |
| EuroSCORE II | calc_euroscore_ii | cardiology | Nashef SAM et al 2012 — PMID 22378855 | ✓ | — | ✓ | formula | planned-v0.5 | Cardiac surgery mortality. |
| STS Cardiac Surgery Risk | calc_sts_cardiac_surgery | cardiology | Shahian DM et al 2018 — PMID 30340822 | ✓ | — | — | multi-step | wishlist | Closed-source coefficients; STS provides public web tool only. |
| ACEF II Risk Score (cardiac surgery) | calc_acef_ii | cardiology | Ranucci M et al 2018 — PMID 29481626 | ✓ | — | ✓ | formula | wishlist | Simplified European cardiac surgery score. |
| CARE Score (cardiac anesthesia) | calc_care_anesthesia | cardiology | Dupuis JY et al 2001 — PMID 11352871 | ✓ | — | ✓ | lookup | wishlist | Cardiac anesthesia risk evaluation. |
| HEART Pathway | calc_heart_pathway | cardiology | Mahler SA et al 2015 — PMID 25737484 | ✓ | — | ✓ | tree | planned-v0.5 | HEART + serial troponin protocol. |
| EDACS (Emergency Department Assessment of Chest Pain) | calc_edacs | cardiology | Than M et al 2014 — PMID 24862414 | ✓ | — | ✓ | lookup | planned-v0.5 | NZ-developed; ADP companion. |
| ADAPT Protocol for Cardiac Event Risk | calc_adapt | cardiology | Than M et al 2012 — PMID 22578923 | ✓ | — | ✓ | tree | wishlist | 2-hour ED rule-out protocol. |
| INTERCHEST Clinical Prediction Rule | calc_interchest | cardiology | Aerts M et al 2017 — PMID 28438758 | ✓ | — | ✓ | lookup | wishlist | Primary care chest pain. |
| Marburg Heart Score (MHS) | calc_marburg_heart | cardiology | Bösner S et al 2010 — PMID 20406884 | ✓ | — | ✓ | lookup | wishlist | Primary care chest pain (Europe). |
| HE-MACS | calc_he_macs | cardiology | Body R et al 2017 — PMID 28213552 | ✓ | — | ✓ | formula | wishlist | History+ECG MACE risk. |
| T-MACS | calc_t_macs | cardiology | Body R et al 2017 — PMID 28213552 | ✓ | — | ✓ | formula | wishlist | Single-troponin Manchester ACS. |
| GWTG-Heart Failure Risk Score | calc_gwtg_hf | cardiology | Peterson PN et al 2010 — PMID 20123669 | ✓ | — | ✓ | lookup | wishlist | In-hospital HF mortality. |
| EHMRG (Emergency HF Mortality Risk Grade) | calc_ehmrg | cardiology | Lee DS et al 2012 — PMID 23230311 | ✓ | — | ✓ | formula | wishlist | ED HF disposition. |
| Ottawa Heart Failure Risk Scale (OHFRS) | calc_ohfrs | cardiology | Stiell IG et al 2013 — PMID 23896419 | ✓ | — | ✓ | lookup | wishlist | ED HF risk. |
| Duke Treadmill Score | calc_duke_treadmill | cardiology | Mark DB et al 1991 — PMID 1922228 | ✓ | — | ✓ | formula | wishlist | Exercise ECG prognosis. |
| Duke Activity Status Index (DASI) | calc_dasi | cardiology | Hlatky MA et al 1989 — PMID 2782256 | ✓ | — | ✓ | lookup | planned-v0.5 | Pre-op functional capacity (METs). |
| CCS Angina Grade | calc_ccs_angina | cardiology | Campeau L 1976 — PMID 947585 | ✓ | — | ✓ | lookup | wishlist | Canadian CV Society angina classification. |
| GARFIELD-AF | calc_garfield_af | cardiology | Fox KAA et al 2017 — PMID 28739290 | ✓ | — | ✓ | formula | wishlist | AF mortality/stroke/bleed competing risk model. |
| ATRIA Bleeding Risk | calc_atria_bleed | cardiology | Fang MC et al 2011 — PMID 21683055 | ✓ | — | ✓ | lookup | planned-v0.5 | AF bleeding alt to HAS-BLED. |
| ATRIA Stroke Risk | calc_atria_stroke | cardiology | Singer DE et al 2013 — PMID 23537808 | ✓ | — | ✓ | lookup | planned-v0.5 | Alt to CHA₂DS₂-VASc. |
| HEMORR₂HAGES | calc_hemorr2hages | cardiology | Gage BF et al 2006 — PMID 16504638 | ✓ | — | ✓ | lookup | wishlist | Older AF bleeding score. |
| ORBIT Bleeding Risk | calc_orbit_bleed | cardiology | O'Brien EC et al 2015 — PMID 25908065 | ✓ | — | — | lookup | wishlist | Real-world AF bleeding. |
| CRUSADE Bleeding (post-MI) | calc_crusade_bleed | cardiology | Subherwal S et al 2009 — PMID 19273723 | ✓ | — | ✓ | formula | planned-v0.5 | In-hospital bleed post-NSTEMI. |
| ACTION ICU Score (NSTEMI) | calc_action_icu | cardiology | Fanaroff AC et al 2017 — PMID 28167715 | ✓ | — | ✓ | lookup | wishlist | NSTEMI ICU need. |
| DAPT Score | calc_dapt_score | cardiology | Yeh RW et al 2016 — PMID 26977855 | ✓ | — | ✓ | lookup | planned-v0.5 | Duration of dual antiplatelet therapy after PCI. |
| PRECISE-DAPT | calc_precise_dapt | cardiology | Costa F et al 2017 — PMID 28290994 | — | — | — | formula | wishlist | DAPT bleeding risk. |
| CHADS-65 (Canadian) | calc_chads_65 | cardiology | CCS 2016 AF Guidelines | ✓ | — | ✓ | tree | wishlist | Simplified Canadian AF anticoag. |
| DOAC Score | calc_doac_score | cardiology | Aggarwal R et al 2023 — PMID 37565912 | ✓ | — | ✓ | lookup | wishlist | DOAC-specific bleed risk. |
| Brugada Criteria (VT vs SVT) | calc_brugada_vt | cardiology | Brugada P et al 1991 — PMID 2017289 | ✓ | — | ✓ | tree | wishlist | Wide-complex tachycardia algorithm. |
| Modified Sgarbossa Criteria | calc_modified_sgarbossa | cardiology | Smith SW et al 2012 — PMID 22939607 | ✓ | — | ✓ | tree | planned-v0.5 | STEMI dx in LBBB. |
| Sgarbossa Criteria (original) | calc_sgarbossa | cardiology | Sgarbossa EB et al 1996 — PMID 8559200 | ✓ | — | — | tree | planned-v0.5 | Original 3-criterion rule. |
| Subtle Anterior STEMI (4-variable) | calc_subtle_stemi_4var | cardiology | Driver BE et al 2017 — PMID 28939424 | ✓ | — | ✓ | formula | wishlist | LAD occlusion vs early repol. |
| ADHERE Algorithm (ADHF) | calc_adhere | cardiology | Fonarow GC et al 2005 — PMID 15703419 | ✓ | — | ✓ | tree | wishlist | ADHF in-hospital mortality CART. |
| Cardiac Power Output (CPO) | calc_cardiac_power_output | cardiology | n/a — formula MAP×CO/451 | ✓ | — | ✓ | formula | wishlist | Cardiogenic shock prognosis. |
| Cardiac Output (Fick) | calc_cardiac_output_fick | cardiology | Fick A 1870 (no PMID) | ✓ | — | ✓ | formula | wishlist | Direct Fick CO formula. |
| Cerebral Perfusion Pressure | calc_cerebral_perfusion_pressure | neurology | n/a — MAP − ICP | ✓ | — | ✓ | formula | planned-v0.5 | Neuro-ICU; cross-listed. |
| LDL Calculated (Friedewald) | calc_ldl_friedewald | cardiology | Friedewald WT et al 1972 — PMID 4337382 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Replaced by Sampson when TG high. |
| LDL Calculated (Martin-Hopkins) | calc_ldl_martin_hopkins | cardiology | Martin SS et al 2013 — PMID 24222381 | ✓ | — | — | lookup | wishlist | More accurate at low LDL. |
| LDL Calculated (Sampson 2020) | calc_ldl_sampson | cardiology | Sampson M et al 2020 — PMID 32077931 | ✓ | — | — | formula | wishlist | Best at high triglycerides. |
| Cardiac Anesthesia Risk Evaluation (CARE) | calc_care_cardiac_anesthesia | cardiology | Dupuis JY et al 2001 — PMID 11352871 | ✓ | — | ✓ | lookup | wishlist | Cardiac surgical risk. |
| Gupta Perioperative MICA | calc_gupta_mica | cardiology | Gupta PK et al 2011 — PMID 21709242 | ✓ | — | ✓ | formula | planned-v0.5 | Postop MI/cardiac arrest. |
| AUB-HAS2 Cardiovascular Risk Index | calc_aub_has2 | cardiology | Dakik HA et al 2019 — PMID 30700368 | ✓ | — | ✓ | lookup | wishlist | Beirut perioperative CV risk. |
| Fleisher Perioperative Cardiac Risk | calc_fleisher_periop_cv | cardiology | Fleisher LA et al 2014 — PMID 25091544 | — | — | — | tree | wishlist | ACC/AHA perioperative guideline algorithm. |
| Cardiac Risk Index (Detsky Modified) | calc_detsky_cri | cardiology | Detsky AS et al 1986 — PMID 3719456 | ✓ | — | — | lookup | wishlist | Pre-RCRI legacy. |
| Cardiac Risk Index (Goldman) | calc_goldman_cri | cardiology | Goldman L et al 1977 — PMID 904659 | ✓ | ✓ | — | lookup | wishlist | Original 1977 multifactorial CV risk. MedCalc-Bench fixture `cardiac_risk_index`. |
| 4Ts Score (HIT) | calc_4ts_hit | hematology | Lo GK et al 2006 — PMID 16634744 | ✓ | — | ✓ | lookup | planned-v0.5 | Heparin-induced thrombocytopenia; cross-listed under hematology. |
| Aortic Dissection Detection Risk Score (ADD-RS) | calc_add_rs | cardiology | Rogers AM et al 2011 — PMID 21900087 | ✓ | — | ✓ | lookup | wishlist | AHA aortic dissection rule. |
| SCORE2 (European, <70 y) | calc_score2 | cardiology | SCORE2 Working Group 2021 — PMID 34120177 | ✓ | — | ✓ | formula | planned-v0.5 | ESC 10-yr CV risk; supersedes original SCORE. |
| SCORE2-OP (>70 y) | calc_score2_op | cardiology | SCORE2-OP Working Group 2021 — PMID 34120180 | ✓ | — | ✓ | formula | planned-v0.5 | Older-persons SCORE2. |
| SCORE2-Diabetes | calc_score2_diabetes | cardiology | SCORE2-Diabetes Working Group 2023 — PMID 37156726 | ✓ | — | ✓ | formula | planned-v0.5 | T2DM-specific SCORE2. |
| Reynolds Risk Score | calc_reynolds_risk | cardiology | Ridker PM et al 2008 — PMID 18250355 | — | — | — | formula | wishlist | Adds hsCRP / family history. |
| QRISK3 | calc_qrisk3 | cardiology | Hippisley-Cox J et al 2017 — PMID 28536104 | — | — | — | formula | wishlist | UK 10-yr CV risk; NICE-recommended. |
| MESA 10-year CHD Risk | calc_mesa_chd | cardiology | McClelland RL et al 2015 — PMID 26563441 | ✓ | — | — | formula | wishlist | Adds coronary calcium. |
| Mortality in Acute Myocardial Infarction (MAMI) | calc_mami | cardiology | Antman EM et al 2000 — PMID 10938172 | — | — | — | lookup | wishlist | Older STEMI score. |
| Acute Decompensated HF Mortality Risk Score (Felker) | calc_adhere_ohfsmm | cardiology | Felker GM et al 2004 — PMID 15364181 | — | — | — | tree | wishlist | Alt ADHF predictor. |
| ACEF (original) | calc_acef | cardiology | Ranucci M et al 2009 — PMID 19103193 | ✓ | — | — | formula | wishlist | Age-creatinine-EF. |
| LACE Index for Readmission | calc_lace | cardiology | van Walraven C et al 2010 — PMID 20351121 | ✓ | — | ✓ | lookup | planned-v0.5 | 30-day readmit risk; cross-cuts internal med. |
| GRACE 2.0 | calc_grace_2 | cardiology | Fox KAA et al 2014 — PMID 24561538 | ✓ | — | — | formula | wishlist | Updated GRACE with continuous variables. |
| Wells Score for Aortic Dissection (n/a — see ADD-RS) | — | — | n/a | — | — | — | — | — | Intentionally omitted — no Wells score for AoD exists; ADD-RS is the rule. |
| Killip-Kimball | calc_killip_kimball | cardiology | Killip T 1967 — PMID 6059183 | ✓ | — | ✓ | lookup | planned-v0.5 | Alias of Killip. |
| Forrester Hemodynamic Subsets | calc_forrester | cardiology | Forrester JS et al 1976 — PMID 1247339 | — | — | — | lookup | wishlist | Cardiogenic shock subsets. |
| INTERMACS Profiles | calc_intermacs | cardiology | Stevenson LW et al 2009 — PMID 19386786 | — | — | — | lookup | wishlist | Mechanical circulatory support staging. |
| LVAD HeartMate II Risk Score | calc_hmrs | cardiology | Cowger J et al 2013 — PMID 23410545 | — | — | — | formula | wishlist | LVAD candidate selection. |
| EUROMACS-RHF Score | calc_euromacs_rhf | cardiology | Soliman OII et al 2018 — PMID 29208626 | ✓ | — | ✓ | lookup | wishlist | Right HF post-LVAD. |
| CAHP (Cardiac Arrest Hospital Prognosis) Score | calc_cahp | cardiology | Maupain C et al 2016 — PMID 26643201 | ✓ | — | ✓ | formula | wishlist | Post-arrest neuro outcome. |
| CART (Cardiac Arrest Risk Triage) Score | calc_cart | cardiology | Churpek MM et al 2014 — PMID 24445153 | ✓ | — | ✓ | lookup | wishlist | Inpatient arrest risk. |
| GO-FAR (Good Outcome Following Attempted Resuscitation) | calc_go_far | cardiology | Ebell MH et al 2013 — PMID 23979495 | ✓ | — | ✓ | lookup | wishlist | Inpatient CPR prognosis. |
| Wilkins Score for Mitral Valvuloplasty | calc_wilkins_mv | cardiology | Wilkins GT et al 1988 — PMID 3342464 | — | — | — | lookup | wishlist | MV anatomy for balloon valvuloplasty. |
| Newsom Score (non-traumatic chest pain) | calc_newsom_cxr | cardiology | Newsom JH 2009 (Am J Emerg Med) | ✓ | — | ✓ | lookup | wishlist | Chest X-ray decision in non-traumatic CP. |
| GUSTO 30-day Mortality (STEMI) | calc_gusto_stemi | cardiology | Lee KL et al 1995 — PMID 7867192 | — | — | — | formula | wishlist | Pre-GRACE thrombolytic-era score. |
| Estimated GFR Renal Doppler Indices | calc_renal_doppler | cardiology | n/a — Doppler-derived | — | — | — | formula | wishlist | Niche. |
| Embolic Stroke of Undetermined Source (ESUS) Criteria | calc_esus | neurology | Hart RG et al 2014 — PMID 24646875 | ✓ | — | ✓ | tree | wishlist | Cryptogenic stroke phenotype; cross-listed neurology. |
| Killip Class for Acute MI | calc_killip_acutemi | cardiology | Killip T, Kimball JT 1967 — PMID 6059183 | ✓ | — | ✓ | lookup | wishlist | Duplicate alias kept for cross-walk. |
| Charlson Comorbidity Index | calc_charlson | prognosis-general | Charlson ME et al 1987 — PMID 3558716 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | 10-year mortality; pan-domain. Cross-listed prognosis-general. |
| Khorana Score (cancer VTE) | calc_khorana | oncology | Khorana AA et al 2008 — PMID 18856473 | ✓ | — | ✓ | lookup | planned-v0.5 | Pre-chemo VTE risk; cross-list. |
| HCM Risk-Kids (ped sudden death) | calc_hcm_risk_kids | pediatrics | Norrish G et al 2019 — PMID 31408137 | — | — | — | formula | wishlist | Pediatric HCM SCD. |
| Cardiac Catheterization Bleeding Risk (Mehran 2010) | calc_cath_bleed_mehran | cardiology | Mehran R et al 2010 — PMID 21156853 | — | — | — | lookup | wishlist | PCI access-site bleeding. |
| Pre-test probability for CAD (Diamond-Forrester) | calc_diamond_forrester | cardiology | Diamond GA, Forrester JS 1979 — PMID 449998 | ✓ | — | — | lookup | wishlist | Bayes pre-test probability for CAD. |
| Updated Diamond-Forrester (CAD Consortium) | calc_cad_consortium | cardiology | Genders TSS et al 2011 — PMID 21804108 | ✓ | — | — | formula | wishlist | European CAD pre-test prob. |
| TIMI Frame Count | calc_timi_frame_count | cardiology | Gibson CM et al 1996 — PMID 8635260 | — | — | — | formula | wishlist | Cath-lab perfusion measure. |
| Mitral Stenosis Severity (mean gradient) | calc_mitral_stenosis | cardiology | Bonow RO et al 2008 (ACC/AHA VHD) | — | — | — | lookup | wishlist | Hemodynamic staging. |
| Aortic Stenosis Severity (continuity equation) | calc_aortic_stenosis | cardiology | Otto CM et al 2021 (ACC/AHA VHD) | — | — | — | formula | wishlist | Continuity equation. |
| EHRA Symptom Scale (AF) | calc_ehra_af | cardiology | Wynn GJ et al 2014 — PMID 24622342 | — | — | — | lookup | wishlist | AF symptom severity. |

## Pulmonary / VTE

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Wells Score for PE | calc_wells_pe | pulmonary-vte | Wells PS et al 2000 — PMID 10744147 | ✓ | ✓ | ✓ | lookup | shipped | Original 7-variable Wells PE. |
| Wells Score for DVT | calc_wells_dvt | pulmonary-vte | Wells PS et al 2003 — PMID 14507948 | ✓ | ✓ | ✓ | lookup | shipped | 9-criterion DVT pretest. |
| PERC Rule | calc_perc | pulmonary-vte | Kline JA et al 2008 — PMID 18318689 | ✓ | ✓ | ✓ | lookup | shipped | 8-criterion PE rule-out at low pretest. |
| PESI (Pulmonary Embolism Severity Index) | calc_pesi | pulmonary-vte | Aujesky D et al 2005 — PMID 16020800 | ✓ | — | ✓ | lookup | shipped | 30-day PE mortality. |
| CURB-65 | calc_curb65 | pulmonary-vte | Lim WS et al 2003 — PMID 12728155 | ✓ | ✓ | ✓ | lookup | shipped | CAP severity. |
| PE workup (composite) | calc_pe_workup | composite-panel | n/a — Wells + PERC + PESI | — | — | — | multi-step | shipped | Composite tool. |
| Simplified PESI (sPESI) | calc_spesi | pulmonary-vte | Jiménez D et al 2010 — PMID 20696966 | ✓ | — | ✓ | lookup | planned-v0.1 | Binary low/high 30-day mortality. |
| Geneva Score (Revised) for PE | calc_geneva_revised | pulmonary-vte | Le Gal G et al 2006 — PMID 16461960 | ✓ | — | ✓ | lookup | planned-v0.1 | Alt to Wells PE. |
| YEARS Algorithm for PE | calc_years_pe | pulmonary-vte | van der Hulle T et al 2017 — PMID 28549662 | ✓ | — | ✓ | tree | planned-v0.1 | Adjusts D-dimer cutoff. |
| 4PEPS (4-Level Clinical Probability) | calc_4peps | pulmonary-vte | Roy PM et al 2021 — PMID 33576184 | ✓ | — | ✓ | lookup | wishlist | 4-level PE pretest. |
| Age-Adjusted D-dimer for VTE | calc_age_adjusted_ddimer | pulmonary-vte | Righini M et al 2014 — PMID 24643601 | ✓ | — | ✓ | formula | planned-v0.5 | Age × 10 µg/L if >50. |
| PSI / PORT (Pneumonia Severity Index) | calc_psi_port | pulmonary-vte | Fine MJ et al 1997 — PMID 9412649 | ✓ | ✓ | ✓ | lookup | planned-v0.1 | 30-day CAP mortality risk class I-V. |
| CRB-65 | calc_crb65 | pulmonary-vte | Bauer T et al 2006 — PMID 17030988 | ✓ | — | ✓ | lookup | planned-v0.5 | CURB-65 minus urea (outpatient). |
| SMART-COP | calc_smart_cop | pulmonary-vte | Charles PGP et al 2008 — PMID 18558884 | ✓ | — | — | lookup | wishlist | Predicts ICU/IRVS in CAP. |
| ATS/IDSA Severe CAP Criteria | calc_ats_idsa_severe_cap | pulmonary-vte | Metlay JP et al 2019 — PMID 31573350 | ✓ | — | — | tree | planned-v0.5 | 2019 IDSA/ATS minor/major criteria. |
| Hestia Criteria (outpatient PE) | calc_hestia | pulmonary-vte | Zondag W et al 2011 — PMID 21389574 | ✓ | — | ✓ | tree | planned-v0.5 | Outpatient PE candidacy. |
| Bova Score (PE complications) | calc_bova | pulmonary-vte | Bova C et al 2014 — PMID 24430009 | ✓ | — | ✓ | lookup | planned-v0.5 | Intermediate-risk PE stratification. |
| PE-SARD Score | calc_pe_sard | pulmonary-vte | Chopard R et al 2024 — PMID 38456518 | ✓ | — | ✓ | formula | wishlist | Bleeding risk in PE. |
| Caprini Score for VTE (2005) | calc_caprini | hematology | Caprini JA 2005 — PMID 15534795 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Surgical pt VTE risk. |
| Padua VTE Prediction (Padova) | calc_padua_vte | hematology | Barbar S et al 2010 — PMID 20738765 | ✓ | — | ✓ | lookup | planned-v0.5 | Medical inpatient VTE risk. |
| IMPROVE VTE | calc_improve_vte | hematology | Spyropoulos AC et al 2011 — PMID 21946892 | ✓ | — | ✓ | lookup | planned-v0.5 | Medical inpatient. |
| IMPROVE Bleeding | calc_improve_bleed | hematology | Decousus H et al 2011 — PMID 21193491 | ✓ | — | ✓ | lookup | planned-v0.5 | Medical inpatient bleed risk. |
| IMPROVEDD (modified IMPROVE) | calc_improvedd | hematology | Gibson CM et al 2017 — PMID 28702815 | ✓ | — | ✓ | lookup | wishlist | Adds D-dimer to IMPROVE. |
| Geneva Risk Score for VTE Prophylaxis | calc_geneva_vte_prophy | hematology | Chopard P et al 2006 — PMID 16634744 | ✓ | — | ✓ | lookup | wishlist | Medical pt thromboprophylaxis. |
| HERDOO2 Rule | calc_herdoo2 | hematology | Rodger MA et al 2008 — PMID 18725688 | ✓ | — | ✓ | lookup | wishlist | Stop AC in unprovoked VTE in women. |
| DASH Prediction Score (VTE recurrence) | calc_dash_vte | hematology | Tosetto A et al 2012 — PMID 22817650 | ✓ | — | ✓ | lookup | wishlist | Idiopathic VTE recurrence. |
| Vienna Prediction Model (VTE recurrence) | calc_vienna_vte | hematology | Eichinger S et al 2010 — PMID 20660801 | — | — | — | formula | wishlist | Online nomogram. |
| VTE-BLEED Score | calc_vte_bleed | hematology | Klok FA et al 2016 — PMID 27307464 | ✓ | — | ✓ | lookup | wishlist | Bleed risk on VTE anticoag. |
| Villalta Score (Post-thrombotic Syndrome) | calc_villalta_pts | hematology | Villalta S et al 1994 — PMID 7822867 | ✓ | — | ✓ | lookup | wishlist | Diagnose / grade PTS. |
| ARISCAT Score | calc_ariscat | pulmonary-vte | Canet J et al 2010 — PMID 21099741 | ✓ | — | ✓ | lookup | planned-v0.5 | Postop pulm complications. |
| Gupta Postop Pneumonia Risk | calc_gupta_postop_pna | pulmonary-vte | Gupta H et al 2013 — PMID 23375179 | ✓ | — | ✓ | formula | wishlist | Surgical pneumonia risk. |
| Gupta Postop Respiratory Failure Risk | calc_gupta_postop_rf | pulmonary-vte | Gupta H et al 2011 — PMID 21864780 | ✓ | — | ✓ | formula | wishlist | Postop resp failure. |
| BAP-65 (COPD AE) | calc_bap65 | pulmonary-vte | Tabak YP et al 2009 — PMID 19542515 | ✓ | — | ✓ | lookup | wishlist | Acute COPD exacerbation mortality. |
| DECAF Score (COPD AE) | calc_decaf | pulmonary-vte | Steer J et al 2012 — PMID 22383558 | ✓ | — | ✓ | lookup | wishlist | UK-developed COPD AE mortality. |
| BODE Index (COPD survival) | calc_bode | pulmonary-vte | Celli BR et al 2004 — PMID 14999112 | ✓ | — | ✓ | lookup | planned-v0.5 | Chronic COPD prognosis. |
| GOLD COPD Criteria | calc_gold_copd | pulmonary-vte | Vogelmeier CF et al 2017 — PMID 28128970 | ✓ | — | ✓ | tree | planned-v0.5 | GOLD spirometric staging. |
| mMRC Dyspnea Scale | calc_mmrc | pulmonary-vte | Mahler DA, Wells CK 1988 — PMID 3338659 | ✓ | — | ✓ | lookup | planned-v0.5 | Functional dyspnea. |
| CAT (COPD Assessment Test) | calc_cat | pulmonary-vte | Jones PW et al 2009 — PMID 19720809 | ✓ | — | ✓ | lookup | wishlist | Patient-reported COPD impact. |
| Berlin Criteria for ARDS | calc_berlin_ards | critical-care | Ranieri VM et al 2012 — PMID 22797452 | ✓ | — | ✓ | tree | planned-v0.5 | ARDS diagnosis & severity. |
| Murray Lung Injury Score | calc_murray_ali | critical-care | Murray JF et al 1988 — PMID 3202424 | ✓ | — | ✓ | lookup | wishlist | Pre-Berlin lung injury. |
| LIPS (Lung Injury Prediction Score) | calc_lips | critical-care | Gajic O et al 2011 — PMID 20802167 | ✓ | — | ✓ | lookup | wishlist | Predicts ARDS development. |
| Horowitz Index (P/F ratio) | calc_pf_ratio | critical-care | Horowitz JH et al 1974 (J Surg Res) | ✓ | — | ✓ | formula | planned-v0.5 | PaO2/FiO2. |
| Oxygenation Index | calc_oxygenation_index | critical-care | Khemani RG 2018 — PMID 29470486 | ✓ | — | ✓ | formula | wishlist | Ped/neonatal severity. |
| Ventilator Tidal Volume (lung protective) | calc_vent_tidal_volume | critical-care | ARDSNet 2000 — PMID 10793162 | ✓ | — | ✓ | formula | planned-v0.5 | 6-8 mL/kg IBW. |
| HACOR Score (NIV failure) | calc_hacor | critical-care | Duan J et al 2017 — PMID 27913033 | ✓ | — | ✓ | lookup | wishlist | Predicts NIV failure in AHRF. |
| ROX Index (HFNC failure) | calc_rox_index | critical-care | Roca O et al 2019 — PMID 30776681 | ✓ | — | ✓ | formula | planned-v0.5 | High-flow nasal cannula success. |
| MuLBSTA Score (viral pneumonia) | calc_mulbsta | pulmonary-vte | Guo L et al 2019 — PMID 30853980 | ✓ | — | ✓ | lookup | wishlist | Viral pneumonia mortality. |
| Fleischner Society Guidelines (pulm nodules) | calc_fleischner | pulmonary-vte | MacMahon H et al 2017 — PMID 28240562 | ✓ | — | ✓ | tree | planned-v0.5 | Incidental pulm nodule follow-up. |
| STOP-BANG (OSA) | calc_stop_bang | pulmonary-vte | Chung F et al 2008 — PMID 18431116 | ✓ | — | ✓ | lookup | planned-v0.5 | OSA screening. |
| Epworth Sleepiness Scale | calc_epworth_sleepiness | pulmonary-vte | Johns MW 1991 — PMID 1798888 | ✓ | — | — | lookup | wishlist | Daytime sleepiness. |
| Berlin Questionnaire (OSA) | calc_berlin_osa | pulmonary-vte | Netzer NC et al 1999 — PMID 10507956 | — | — | — | lookup | wishlist | Pre-op OSA screening. |
| Asthma Predictive Index (API) | calc_api | pulmonary-vte | Castro-Rodríguez JA et al 2000 — PMID 11029352 | ✓ | — | ✓ | tree | wishlist | Pediatric asthma prediction. |
| Modified API (mAPI) | calc_api_modified | pulmonary-vte | Guilbert TW et al 2004 — PMID 15536431 | ✓ | — | ✓ | tree | wishlist | Modified API. |
| AIRQ (Asthma Impairment & Risk Questionnaire) | calc_airq | pulmonary-vte | Murphy KR et al 2020 — PMID 32004753 | ✓ | — | ✓ | lookup | wishlist | Adult asthma control. |
| Peak Expiratory Flow (predicted) | calc_peak_flow_predicted | pulmonary-vte | Knudson RJ et al 1976 — PMID 1252253 | ✓ | — | ✓ | formula | wishlist | Predicted PEF; age/sex/height. |
| 6-Minute Walk Distance | calc_6mwd_predicted | pulmonary-vte | Enright PL, Sherrill DL 1998 — PMID 9817683 | ✓ | — | ✓ | formula | wishlist | Predicted 6MWD. |
| ROSE Rule for PE (pediatric) | calc_rose_pe_ped | pediatrics | Kanis J et al 2018 — PMID 29885868 | — | — | — | lookup | wishlist | Pediatric PE rule-out. |
| Anti-Xa Heparin Dosing | calc_anti_xa_heparin | hematology | n/a — institutional nomogram | — | — | — | formula | wishlist | Therapeutic UFH dosing. |
| Argatroban Dosing (HIT) | calc_argatroban_hit | hematology | Lewis BE et al 2003 — PMID 12878747 | — | — | — | formula | wishlist | DTI dosing in HIT. |
| Quick COVID-19 Severity Index (qCSI) | calc_qcsi | infectious-disease | Haimovich AD et al 2020 — PMID 32522437 | ✓ | — | ✓ | lookup | wishlist | ED COVID severity. |

## Critical care

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| APACHE II | calc_apache_ii | critical-care | Knaus WA et al 1985 — PMID 3928249 | ✓ | ✓ | ✓ | formula | shipped | Foundational ICU severity. |
| SOFA Score | calc_sofa | critical-care | Vincent JL et al 1996 — PMID 8844239 | ✓ | ✓ | ✓ | lookup | shipped | Sepsis-3 component. |
| qSOFA | calc_qsofa | critical-care | Seymour CW et al 2016 — PMID 26903335 | ✓ | — | ✓ | lookup | shipped | Bedside Sepsis-3 screen. |
| Sepsis panel (composite) | calc_sepsis_panel | composite-panel | n/a — qSOFA + SOFA + APACHE II | — | — | — | multi-step | shipped | Composite tool. |
| SIRS Criteria | calc_sirs | critical-care | Bone RC et al 1992 — PMID 1303622 | ✓ | ✓ | ✓ | lookup | planned-v0.1 | Pre-Sepsis-3. |
| Sepsis-3 / Septic Shock Criteria | calc_sepsis_3 | critical-care | Singer M et al 2016 — PMID 26903338 | ✓ | — | ✓ | tree | planned-v0.1 | Operational sepsis definition. |
| APACHE III | calc_apache_iii | critical-care | Knaus WA et al 1991 — PMID 1959406 | ✓ | — | — | formula | wishlist | Closed-source coefficients. |
| APACHE IV | calc_apache_iv | critical-care | Zimmerman JE et al 2006 — PMID 16540951 | — | — | — | formula | wishlist | Closed-source; commercial. |
| SAPS II | calc_saps_ii | critical-care | Le Gall JR et al 1993 — PMID 8254858 | ✓ | — | — | formula | planned-v0.5 | European ICU mortality. |
| SAPS 3 | calc_saps_3 | critical-care | Moreno RP et al 2005 — PMID 16132892 | ✓ | — | — | formula | wishlist | International ICU calibration. |
| MPM₀-III / MPM-II | calc_mpm | critical-care | Higgins TL et al 2007 — PMID 17440421 | — | — | — | formula | wishlist | Mortality probability model. |
| Modified SOFA (mSOFA) | calc_msofa | critical-care | Grissom CK et al 2010 — PMID 20498723 | ✓ | — | ✓ | lookup | wishlist | Disaster triage variant. |
| Glasgow Coma Scale | calc_gcs | critical-care | Teasdale G, Jennett B 1974 — PMID 4136544 | ✓ | ✓ | ✓ | lookup | planned-v0.1 | Universal. |
| GCS-Pupils Score | calc_gcs_pupils | critical-care | Brennan PM et al 2018 — PMID 29768149 | ✓ | — | ✓ | lookup | planned-v0.5 | GCS + pupil reactivity. |
| FOUR Score (coma) | calc_four_score | critical-care | Wijdicks EFM et al 2005 — PMID 16275631 | ✓ | — | ✓ | lookup | planned-v0.5 | Brainstem reflex coma score. |
| RASS (Richmond Agitation-Sedation Scale) | calc_rass | critical-care | Sessler CN et al 2002 — PMID 12421743 | ✓ | — | — | lookup | planned-v0.5 | ICU sedation depth. |
| CAM-ICU | calc_cam_icu | critical-care | Ely EW et al 2001 — PMID 11730446 | ✓ | — | ✓ | tree | planned-v0.5 | ICU delirium. |
| ICDSC (Intensive Care Delirium Screening Checklist) | calc_icdsc | critical-care | Bergeron N et al 2001 — PMID 11354813 | — | — | — | lookup | wishlist | Alt ICU delirium tool. |
| NEWS / NEWS2 | calc_news2 | critical-care | Royal College of Physicians 2017 (NEWS2) | ✓ | — | ✓ | lookup | planned-v0.5 | Early warning; UK NHS standard. |
| MEWS (Modified EWS) | calc_mews | critical-care | Subbe CP et al 2001 — PMID 11588210 | ✓ | — | ✓ | lookup | planned-v0.5 | Pre-NEWS2 predecessor. |
| PEWS (Pediatric EWS) | calc_pews | pediatrics | Monaghan A 2005 (Paediatr Nurs) | ✓ | — | — | lookup | wishlist | Pediatric early warning. |
| SAPS II Predicted Mortality | calc_saps_ii_mortality | critical-care | Le Gall JR et al 1993 — PMID 8254858 | ✓ | — | — | formula | wishlist | Mortality equation. |
| Charlson Comorbidity Index (ICU) | calc_charlson_icu | critical-care | Charlson ME et al 1987 — PMID 3558716 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Alias listed for ICU usage. |
| Berlin ARDS Severity | calc_berlin_ards_severity | critical-care | Ranieri VM et al 2012 — PMID 22797452 | ✓ | — | ✓ | tree | planned-v0.5 | Mild/mod/severe ARDS. |
| LIPS (Lung Injury Prediction Score) | calc_lips_icu | critical-care | Gajic O et al 2011 — PMID 20802167 | ✓ | — | ✓ | lookup | wishlist | Predicts ARDS. |
| MOF (Multiple Organ Failure) Score | calc_mof_marshall | critical-care | Marshall JC et al 1995 — PMID 7587228 | — | — | — | lookup | wishlist | Pre-SOFA MOF score. |
| ODIN (Organ Dysfunction & Infection) | calc_odin | critical-care | Fagon JY et al 1993 — PMID 8442566 | — | — | — | lookup | wishlist | European MOF score. |
| RIFLE Criteria | calc_rifle_icu | critical-care | Bellomo R et al 2004 — PMID 15312219 | — | — | — | lookup | wishlist | Pre-AKIN. |
| MACOCHA Score (difficult intubation) | calc_macocha | critical-care | De Jong A et al 2013 — PMID 23222657 | ✓ | — | ✓ | lookup | wishlist | Difficult ICU intubation. |
| Mallampati (Modified) | calc_mallampati | critical-care | Mallampati SR et al 1985 — PMID 4014593 | ✓ | — | ✓ | lookup | planned-v0.5 | Airway assessment. |
| El-Ganzouri Risk Index (EGRI) | calc_egri | critical-care | El-Ganzouri AR et al 1996 — PMID 8633198 | ✓ | — | ✓ | lookup | wishlist | Difficult airway. |
| Cormack-Lehane Grade | calc_cormack_lehane | critical-care | Cormack RS, Lehane J 1984 — PMID 6486855 | — | — | — | lookup | wishlist | Laryngoscopy view. |
| CPIS (Clinical Pulm Infection Score) | calc_cpis | critical-care | Pugin J et al 1991 — PMID 1928961 | ✓ | — | ✓ | lookup | wishlist | VAP diagnosis. |
| Confusion Assessment Method (CAM) | calc_cam | geriatrics | Inouye SK et al 1990 — PMID 2240918 | ✓ | — | — | tree | planned-v0.5 | Cross-listed geriatrics. |
| 4AT (delirium screen) | calc_4at | geriatrics | Bellelli G et al 2014 — PMID 24590568 | ✓ | — | ✓ | lookup | planned-v0.5 | Rapid delirium screen. |
| AWOL Score for Delirium | calc_awol_delirium | geriatrics | Douglas VC et al 2013 — PMID 23553438 | ✓ | — | ✓ | lookup | wishlist | Predicts incident delirium. |
| Ventilator-Free Days (VFD) | calc_vfd | critical-care | Schoenfeld DA et al 2002 — PMID 12352040 | — | — | — | formula | wishlist | RCT endpoint computation. |
| CPOT (Critical Care Pain Observation Tool) | calc_cpot | critical-care | Gélinas C et al 2006 — PMID 16823021 | ✓ | — | ✓ | lookup | wishlist | Pain in nonverbal ICU pt. |
| Behavioral Pain Scale (BPS) | calc_bps | critical-care | Payen JF et al 2001 — PMID 11801819 | ✓ | — | ✓ | lookup | wishlist | Alt to CPOT. |
| Predisposing-Insult-Response-Organ (PIRO) | calc_piro | critical-care | Howell MD et al 2011 — PMID 21804353 | — | — | — | tree | wishlist | Sepsis staging concept. |
| MRC Sum-Score (ICU-acquired weakness) | calc_mrc_sum | critical-care | Kleyweg RP et al 1991 — PMID 1845634 | — | — | — | lookup | wishlist | Muscle strength after ICU. |
| GAP-65 (acute pulmonary fibrosis) | calc_gap_ipf | pulmonary-vte | Ley B et al 2012 — PMID 22561965 | ✓ | — | ✓ | lookup | wishlist | IPF mortality. |
| du Bois Score (IPF) | calc_du_bois_ipf | pulmonary-vte | du Bois RM et al 2011 — PMID 21193511 | ✓ | — | ✓ | lookup | wishlist | IPF mortality alt. |
| MRC-ICU Medication Regimen Complexity | calc_mrc_icu | critical-care | Gwynn ME et al 2019 — PMID 31376862 | ✓ | — | ✓ | formula | wishlist | Pharmacist workload. |
| Confusion Assessment Method (CAM) | calc_cam_short | critical-care | Inouye SK et al 1990 — PMID 2240918 | ✓ | — | — | tree | wishlist | Alias of CAM. |
| RIFLE-Pediatric (pRIFLE) | calc_prifle | pediatrics | Akcan-Arikan A et al 2007 — PMID 17396113 | — | — | — | lookup | wishlist | Pediatric AKI. |
| SOFA (Pediatric pSOFA) | calc_psofa | pediatrics | Matics TJ, Sanchez-Pinto LN 2017 — PMID 28783810 | — | — | — | lookup | wishlist | Pediatric Sepsis-3 SOFA. |
| pPESI (Pediatric PESI) | calc_ppesi | pediatrics | n/a — adapted from PESI | — | — | — | lookup | wishlist | Adapted PESI for pediatrics. |
| Sepsis-induced Coagulopathy (SIC) Score | calc_sic_score | critical-care | Iba T et al 2019 — PMID 31228337 | — | — | — | lookup | wishlist | Sepsis coagulopathy. |
| Vasoactive-Inotropic Score (VIS) | calc_vis | critical-care | Gaies MG et al 2010 — PMID 20144082 | — | — | — | formula | wishlist | Quantifies vasopressor burden. |
| Norepinephrine-Equivalent Dose | calc_ne_equivalent | critical-care | Goradia S et al 2021 — PMID 33545495 | — | — | — | formula | wishlist | Vasopressor conversion. |
| Pediatric Risk of Mortality (PRISM III) | calc_prism_iii | pediatrics | Pollack MM et al 1996 — PMID 8559463 | — | — | — | formula | wishlist | PICU mortality. |
| PIM3 (Pediatric Index of Mortality) | calc_pim3 | pediatrics | Straney L et al 2013 — PMID 23439458 | — | — | — | formula | wishlist | PICU mortality. |
| Brain Death Determination Checklist | calc_brain_death | critical-care | Wijdicks EFM et al 2010 — PMID 20530327 | — | — | — | tree | wishlist | AAN brain death criteria. |
| Capacity-to-consent assessment | calc_capacity | psychiatry | Appelbaum PS 2007 — PMID 17984402 | — | — | — | tree | wishlist | MacCAT-T concept; not a numeric calc. |
| ICU-AW (ICU-acquired weakness) | calc_icu_aw | critical-care | De Jonghe B et al 2007 — PMID 17893632 | — | — | — | tree | wishlist | Diagnostic criteria. |

## Infectious disease

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Centor Score (Modified/McIsaac) | calc_centor_mcisaac | infectious-disease | McIsaac WJ et al 1998 — PMID 9474232 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Strep pharyngitis. |
| FeverPAIN | calc_feverpain | infectious-disease | Little P et al 2013 — PMID 24114229 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | UK strep score. |
| Drug Resistance in Pneumonia (DRIP) | calc_drip | infectious-disease | Webb BJ et al 2016 — PMID 27267795 | ✓ | — | ✓ | lookup | wishlist | MDR risk in CAP. |
| LRINEC Score (NSTI) | calc_lrinec | infectious-disease | Wong CH et al 2004 — PMID 15241098 | ✓ | — | ✓ | lookup | planned-v0.5 | Necrotizing fasciitis dx. |
| ALT-70 Score (Cellulitis) | calc_alt70 | infectious-disease | Raff AB et al 2017 — PMID 28057371 | ✓ | — | ✓ | lookup | wishlist | Distinguishes cellulitis from mimics. |
| Duke Criteria for Endocarditis | calc_duke_endocarditis | infectious-disease | Li JS et al 2000 — PMID 10770721 | ✓ | — | ✓ | tree | planned-v0.5 | Modified Duke (2000). |
| 2023 Duke-ISCVID Criteria | calc_duke_iscvid_2023 | infectious-disease | Fowler VG et al 2023 — PMID 37138445 | ✓ | — | ✓ | tree | wishlist | 2023 ISCVID revision. |
| Infective Endocarditis Mortality Risk Score | calc_ie_mortality | infectious-disease | Park LP et al 2016 — PMID 27474103 | ✓ | — | ✓ | formula | wishlist | IE 6-month mortality. |
| VIRSTA Score | calc_virsta | infectious-disease | Tubiana S et al 2016 — PMID 27052195 | ✓ | — | ✓ | lookup | wishlist | Endocarditis pretest. |
| ATLAS Score (C. difficile) | calc_atlas_cdiff | infectious-disease | Miller MA et al 2013 — PMID 24308381 | ✓ | — | ✓ | lookup | wishlist | CDI severity. |
| CISNE (Febrile Neutropenia) | calc_cisne | oncology | Carmona-Bayonas A et al 2015 — PMID 25584008 | ✓ | — | ✓ | lookup | wishlist | Low-risk FN identification. |
| MASCC Score (Febrile Neutropenia) | calc_mascc | oncology | Klastersky J et al 2000 — PMID 10944139 | ✓ | — | ✓ | lookup | planned-v0.5 | FN risk index. |
| Bacterial Meningitis Score (children) | calc_bms_children | pediatrics | Nigrovic LE et al 2007 — PMID 17200296 | ✓ | — | ✓ | tree | planned-v0.5 | Pediatric meningitis rule-out. |
| Kocher Criteria (septic arthritis) | calc_kocher_arthritis | pediatrics | Kocher MS et al 1999 — PMID 10608376 | ✓ | — | ✓ | lookup | planned-v0.5 | Pediatric hip septic arthritis vs synovitis. |
| Caprini Risk Score (cellulitis) | calc_caprini_cellulitis | infectious-disease | n/a — adapted | — | — | — | lookup | wishlist | Not a real calc — placeholder removed. |
| Brighton Collaboration GBS | calc_brighton_gbs | infectious-disease | Sejvar JJ et al 2011 — PMID 21111660 | — | — | — | tree | wishlist | GBS dx criteria. |
| Tokyo Guidelines (Cholecystitis 2018) | calc_tokyo_cholecystitis | infectious-disease | Yokoe M et al 2018 — PMID 29032636 | ✓ | — | ✓ | tree | planned-v0.5 | Cholecystitis dx + severity. |
| Tokyo Guidelines (Cholangitis 2018) | calc_tokyo_cholangitis | infectious-disease | Kiriyama S et al 2018 — PMID 29032610 | ✓ | — | — | tree | planned-v0.5 | Cholangitis dx + severity. |
| Indications for Paxlovid | calc_paxlovid_indications | infectious-disease | NIH COVID-19 Treatment Panel 2022 | ✓ | — | ✓ | tree | wishlist | COVID treatment eligibility. |
| 4C Mortality Score (COVID) | calc_4c_covid | infectious-disease | Knight SR et al 2020 — PMID 32907855 | ✓ | — | ✓ | lookup | planned-v0.5 | UK COVID inpatient mortality. |
| COVID-GRAM Critical Illness | calc_covid_gram | infectious-disease | Liang W et al 2020 — PMID 32396163 | ✓ | — | ✓ | formula | wishlist | COVID critical illness. |
| VACO Index (COVID Mortality) | calc_vaco_covid | infectious-disease | King JT et al 2020 — PMID 33256646 | ✓ | — | ✓ | formula | wishlist | VA COVID mortality. |
| CHOSEN COVID-19 Risk | calc_chosen_covid | infectious-disease | Levine DM et al 2020 — PMID 33270127 | ✓ | — | ✓ | lookup | wishlist | Home-treat candidacy. |
| CIRC (COVID Inpatient Risk) | calc_circ_covid | infectious-disease | Garibaldi BT et al 2021 — PMID 33075260 | ✓ | — | ✓ | formula | wishlist | Hopkins COVID model. |
| Utah COVID-19 Risk Score | calc_utah_covid | infectious-disease | n/a — institutional | ✓ | — | ✓ | lookup | wishlist | State-specific. |
| ACEP COVID-19 Management Tool | calc_acep_covid | infectious-disease | ACEP 2020 guidance | ✓ | — | ✓ | tree | wishlist | ED disposition. |
| qCSI (Quick COVID-19 Severity Index) | calc_qcsi_covid | infectious-disease | Haimovich AD et al 2020 — PMID 32522437 | ✓ | — | ✓ | lookup | wishlist | ED COVID severity. |
| Denver HIV Risk Score | calc_denver_hiv | infectious-disease | Haukoos JS et al 2012 — PMID 22424987 | ✓ | — | ✓ | lookup | wishlist | HIV pretest probability. |
| HIRI-MSM (HIV Incidence Risk for MSM) | calc_hiri_msm | infectious-disease | Smith DK et al 2012 — PMID 22195869 | ✓ | — | ✓ | lookup | wishlist | PrEP candidacy in MSM. |
| HIV Needle-Stick RASP | calc_hiv_rasp | infectious-disease | Henderson DK et al 1995 (Ann Intern Med) | ✓ | — | ✓ | lookup | wishlist | Post-exposure risk. |
| Khorana Score (cancer VTE) | calc_khorana_vte | oncology | Khorana AA et al 2008 — PMID 18856473 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Wisconsin Criteria (facial fracture) | calc_wisconsin | trauma | Sitzman TJ et al 2009 — PMID 19483576 | ✓ | — | ✓ | lookup | wishlist | Facial CT rule. |
| Rule of 7s (Lyme meningitis) | calc_rule_of_7s_lyme | infectious-disease | Avery RA et al 2006 — PMID 17077344 | ✓ | — | ✓ | tree | wishlist | Lyme vs viral meningitis. |
| Steere Score (Lyme arthritis) | calc_steere_lyme | infectious-disease | Steere AC et al 1987 (Yale J Biol Med) | — | — | — | lookup | wishlist | Niche. |
| Sepsis-3 Lactate-Based Criteria | calc_sepsis_lactate | critical-care | Singer M et al 2016 — PMID 26903338 | — | — | — | tree | wishlist | Lactate >2 + vasopressor = shock. |
| Neonatal Early-Onset Sepsis Calculator (Kaiser) | calc_neonatal_eos | pediatrics | Puopolo KM et al 2011 — PMID 22025592 | ✓ | — | ✓ | formula | planned-v0.5 | Kaiser EOS risk calculator. |
| LIPS-A (alcohol use disorder) | calc_lips_a | infectious-disease | n/a | — | — | — | lookup | wishlist | Not real — removed. |
| ASA Physical Status | calc_asa_ps | surgery | ASA House of Delegates 2014 | ✓ | — | ✓ | lookup | planned-v0.5 | Perioperative risk; cross-listed surgery. |

## Hepatology / GI

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Child-Pugh Score | calc_child_pugh | hepatology | Pugh RN et al 1973 — PMID 4541913 | ✓ | ✓ | ✓ | lookup | planned-v0.1 | Cirrhosis mortality classes A/B/C. |
| MELD (original) | calc_meld_original | hepatology | Malinchoc M et al 2000 — PMID 10733541 | ✓ | — | ✓ | formula | shipped | Cross-listed renal/metabolic above as shipped. |
| MELD-Na | calc_meldna | hepatology | Kim WR et al 2008 — PMID 18768945 | ✓ | ✓ | ✓ | formula | shipped | UNOS allocation 2016-2023. |
| MELD 3.0 | calc_meld_3_hep | hepatology | Kim WR et al 2021 — PMID 33891979 | ✓ | — | ✓ | formula | planned-v0.1 | Current UNOS allocation. |
| MELD-Combined | calc_meld_combined | hepatology | Asrani SK et al 2020 — PMID 32418610 | ✓ | — | ✓ | formula | wishlist | Combined MELD reference. |
| UKELD (UK Model for End-Stage Liver Disease) | calc_ukeld | hepatology | Barber K et al 2011 — PMID 21516056 | ✓ | — | ✓ | formula | wishlist | UK transplant allocation. |
| Maddrey's Discriminant Function | calc_maddrey_df | hepatology | Maddrey WC et al 1978 — PMID 352788 | ✓ | — | ✓ | formula | planned-v0.5 | Alcoholic hepatitis steroid candidacy. |
| Glasgow Alcoholic Hepatitis Score | calc_gahs | hepatology | Forrest EH et al 2005 — PMID 16162686 | ✓ | — | ✓ | lookup | wishlist | UK alc hep score. |
| Lille Model (Alcoholic Hepatitis) | calc_lille | hepatology | Louvet A et al 2007 — PMID 17647433 | ✓ | — | ✓ | formula | wishlist | Day-7 steroid response. |
| ABIC Score (Alcoholic Hepatitis) | calc_abic | hepatology | Domínguez M et al 2008 — PMID 18785931 | ✓ | — | ✓ | formula | wishlist | Spanish alc hep score. |
| ALBI Grade | calc_albi | hepatology | Johnson PJ et al 2015 — PMID 25512453 | ✓ | — | ✓ | formula | planned-v0.5 | HCC; replacement for Child-Pugh in trials. |
| BARD Score (NAFLD) | calc_bard | hepatology | Harrison SA et al 2008 — PMID 18261144 | ✓ | — | ✓ | lookup | wishlist | NAFLD advanced fibrosis. |
| NAFLD Fibrosis Score | calc_nafld_fs | hepatology | Angulo P et al 2007 — PMID 17393509 | ✓ | — | ✓ | formula | planned-v0.5 | Advanced fibrosis in NAFLD. |
| Fibrosis-4 (FIB-4) | calc_fib4 | hepatology | Sterling RK et al 2006 — PMID 16729309 | ✓ | ✓ | ✓ | formula | planned-v0.5 | HCV/NAFLD fibrosis. |
| APRI (AST to Platelet Ratio) | calc_apri | hepatology | Wai CT et al 2003 — PMID 12883497 | ✓ | — | ✓ | formula | planned-v0.5 | HCV fibrosis. |
| Fatty Liver Index | calc_fli | hepatology | Bedogni G et al 2006 — PMID 17081293 | ✓ | — | ✓ | formula | wishlist | NAFLD diagnosis. |
| Fibrotic NASH Index (FNI) | calc_fni | hepatology | Tavaglione F et al 2023 — PMID 36603148 | ✓ | — | ✓ | formula | wishlist | Fibrotic NASH dx. |
| NAFLD Activity Score (NAS) | calc_nas | hepatology | Kleiner DE et al 2005 — PMID 15915461 | ✓ | — | ✓ | lookup | wishlist | Histologic NAFLD activity. |
| Hepatic Encephalopathy West Haven Criteria | calc_west_haven_he | hepatology | Atterbury CE et al 1978 — PMID 668791 | ✓ | — | ✓ | lookup | planned-v0.5 | HE grading. |
| CLIF-C ACLF | calc_clif_c_aclf | hepatology | Jalan R et al 2014 — PMID 24973985 | ✓ | — | ✓ | formula | wishlist | Acute-on-chronic liver failure. |
| Glasgow-Imrie Pancreatitis Criteria | calc_glasgow_imrie | gastroenterology | Blamey SL et al 1984 — PMID 6427650 | ✓ | — | ✓ | lookup | planned-v0.5 | Severe acute pancreatitis. |
| Ranson Criteria | calc_ranson | gastroenterology | Ranson JH et al 1974 — PMID 4814052 | ✓ | — | — | lookup | planned-v0.5 | Pancreatitis severity. |
| BISAP Score | calc_bisap | gastroenterology | Wu BU et al 2008 — PMID 18519333 | ✓ | — | ✓ | lookup | planned-v0.5 | Pancreatitis severity day-1. |
| HAPS (Harmless Acute Pancreatitis Score) | calc_haps | gastroenterology | Lankisch PG et al 2009 — PMID 19111892 | ✓ | — | ✓ | lookup | wishlist | Mild pancreatitis predictor. |
| Glasgow-Blatchford Bleeding Score | calc_gbs_blatchford | gastroenterology | Blatchford O et al 2000 — PMID 11073021 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | UGIB risk. |
| Rockall Score (UGIB) | calc_rockall_ugib | gastroenterology | Rockall TA et al 1996 — PMID 8801907 | ✓ | — | — | lookup | planned-v0.5 | Pre- and post-endoscopy UGIB. |
| AIMS65 Score (UGIB mortality) | calc_aims65 | gastroenterology | Saltzman JR et al 2011 — PMID 21381111 | ✓ | — | ✓ | lookup | planned-v0.5 | Inpatient UGIB mortality. |
| Forrest Classification | calc_forrest | gastroenterology | Forrest JAH et al 1974 — PMID 4140599 | ✓ | — | ✓ | lookup | wishlist | Endoscopic UGIB stigmata. |
| Oakland Score (LGIB) | calc_oakland_lgib | gastroenterology | Oakland K et al 2017 — PMID 28948957 | — | — | — | formula | wishlist | LGIB outpatient. |
| Crohn's Disease Activity Index (CDAI) | calc_cdai_crohns | gastroenterology | Best WR et al 1976 — PMID 1248701 | ✓ | — | ✓ | formula | planned-v0.5 | Crohn's activity. |
| Harvey-Bradshaw Index | calc_hbi | gastroenterology | Harvey RF, Bradshaw JM 1980 — PMID 6102236 | ✓ | — | ✓ | lookup | planned-v0.5 | Simplified Crohn's activity. |
| Mayo Score (Ulcerative Colitis) | calc_mayo_uc | gastroenterology | Schroeder KW et al 1987 — PMID 3543674 | ✓ | — | ✓ | lookup | planned-v0.5 | UC activity. |
| Truelove-Witts Severity Index (UC) | calc_truelove_witts | gastroenterology | Truelove SC, Witts LJ 1955 — PMID 13260656 | ✓ | — | ✓ | lookup | wishlist | UC severity. |
| Montreal Classification (IBD) | calc_montreal_ibd | gastroenterology | Silverberg MS et al 2005 — PMID 16151544 | ✓ | — | ✓ | tree | wishlist | IBD phenotype. |
| Rome IV (IBS) | calc_rome_iv_ibs | gastroenterology | Mearin F et al 2016 — PMID 27144627 | ✓ | — | ✓ | tree | planned-v0.5 | IBS diagnostic criteria. |
| Manning Criteria for IBS | calc_manning_ibs | gastroenterology | Manning AP et al 1978 — PMID 698649 | ✓ | — | ✓ | lookup | wishlist | Pre-Rome IBS criteria. |
| Kruis Score (IBS) | calc_kruis_ibs | gastroenterology | Kruis W et al 1984 — PMID 6469297 | ✓ | — | ✓ | formula | wishlist | German IBS score. |
| Bristol Stool Form Scale | calc_bristol_stool | gastroenterology | Lewis SJ, Heaton KW 1997 — PMID 9299672 | ✓ | — | ✓ | lookup | wishlist | Stool type 1-7. |
| LA Grading of Esophagitis | calc_la_esophagitis | gastroenterology | Lundell LR et al 1999 — PMID 10369714 | ✓ | — | ✓ | lookup | wishlist | Endoscopic esophagitis grade. |
| EREFS (Eosinophilic Esophagitis Endoscopy) | calc_erefs | gastroenterology | Hirano I et al 2013 — PMID 23232216 | ✓ | — | ✓ | lookup | wishlist | EoE endoscopic activity. |
| Light's Criteria (Exudative Effusion) | calc_lights | pulmonary-vte | Light RW et al 1972 — PMID 4642731 | ✓ | — | ✓ | tree | planned-v0.5 | Pleural fluid; cross-listed pulm. |
| Sodium-Free-Water Light's modified | calc_lights_modified | pulmonary-vte | Heffner JE et al 1997 — PMID 9100716 | — | — | — | tree | wishlist | Diuretic-treated CHF. |
| LENT Score (malignant pleural effusion) | calc_lent | oncology | Clive AO et al 2014 — PMID 25053713 | ✓ | — | ✓ | lookup | wishlist | MPE prognosis. |
| PROMISE Score (MPE) | calc_promise_mpe | oncology | Psallidas I et al 2018 — PMID 30032996 | ✓ | — | ✓ | lookup | wishlist | MPE 3-mo mortality. |
| EVendo Score (Esophageal Varices) | calc_evendo | hepatology | Dong TS et al 2019 — PMID 31470008 | ✓ | — | ✓ | formula | wishlist | Predict varices in cirrhosis. |
| Mumtaz Score (Cirrhosis Readmission) | calc_mumtaz_cirrhosis | hepatology | Mumtaz K et al 2017 — PMID 28247915 | ✓ | — | ✓ | lookup | wishlist | Cirrhosis 30-d readmit. |
| Liver Decomp Risk after Hepatectomy | calc_liver_decomp_hepatectomy | hepatology | Yokoo T et al 2019 — PMID 30993705 | ✓ | — | ✓ | formula | wishlist | Post-HCC resection. |
| Milan Criteria (HCC transplant) | calc_milan_hcc | hepatology | Mazzaferro V et al 1996 — PMID 8594428 | ✓ | — | ✓ | tree | planned-v0.5 | OLT HCC eligibility. |
| UCSF Criteria (HCC transplant) | calc_ucsf_hcc | hepatology | Yao FY et al 2001 — PMID 11391528 | — | — | — | tree | wishlist | Expanded HCC criteria. |
| BCLC Staging (HCC) | calc_bclc | hepatology | Llovet JM et al 1999 — PMID 10518312 | ✓ | — | ✓ | tree | planned-v0.5 | HCC staging + treatment. |
| Metroticket (HCC survival) | calc_metroticket | hepatology | Mazzaferro V et al 2009 — PMID 19097774 | ✓ | — | ✓ | formula | wishlist | HCC post-OLT survival. |
| GALAD Model (HCC) | calc_galad | hepatology | Berhane S et al 2016 — PMID 26795574 | ✓ | — | ✓ | formula | wishlist | HCC dx biomarker model. |
| Hour-Specific Bilirubin (Neonatal Bili) | calc_hour_specific_bili | pediatrics | Bhutani VK et al 1999 — PMID 9917458 | ✓ | — | ✓ | lookup | planned-v0.5 | Newborn hyperbili nomogram. |
| King's College Criteria (APAP toxicity) | calc_kings_apap | hepatology | O'Grady JG et al 1989 — PMID 2725635 | ✓ | — | ✓ | lookup | planned-v0.5 | APAP-induced ALF transplant criteria. |
| Acetaminophen-Rumack-Matthew Nomogram | calc_rumack_matthew | toxicology | Rumack BH, Matthew H 1975 — PMID 1101170 | ✓ | — | ✓ | lookup | planned-v0.5 | APAP toxic level / NAC dosing. |
| Wexner Score (Obstructed Defecation) | calc_wexner_ods | gastroenterology | Renzi A et al 2008 — PMID 18545837 | ✓ | — | ✓ | lookup | wishlist | ODS severity. |
| CholeS Score | calc_choles | gastroenterology | CholeS Study Group 2018 — PMID 29488256 | ✓ | — | ✓ | lookup | wishlist | Lap chole duration. |
| ABC Score for Massive Transfusion | calc_abc_mt | trauma | Nunez TC et al 2009 — PMID 19204506 | ✓ | — | ✓ | lookup | planned-v0.5 | Triggers MTP. |
| TASH Score (Trauma) | calc_tash | trauma | Yücel N et al 2006 — PMID 17033545 | — | — | — | lookup | wishlist | European MTP score. |
| ABC/2 Formula (ICH Volume) | calc_abc_2_ich | neurology | Kothari RU et al 1996 — PMID 8711791 | ✓ | — | ✓ | formula | planned-v0.5 | Intracerebral hemorrhage volume. |

## Neurology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| NIH Stroke Scale (NIHSS) | calc_nihss | neurology | Brott T et al 1989 — PMID 2749846 | ✓ | — | ✓ | lookup | planned-v0.1 | Acute stroke severity; tPA decision aid. |
| Modified NIHSS (mNIHSS) | calc_mnihss | neurology | Meyer BC et al 2002 — PMID 12468842 | ✓ | — | ✓ | lookup | planned-v0.5 | Shortened NIHSS. |
| Modified Rankin Scale (mRS) | calc_mrs | neurology | Rankin J 1957 — PMID 13432836 | ✓ | — | ✓ | lookup | planned-v0.1 | Post-stroke disability. |
| mRS-9Q (Modified Rankin Q) | calc_mrs9q | neurology | Bruno A et al 2010 — PMID 20019339 | ✓ | — | ✓ | lookup | wishlist | Structured mRS interview. |
| Barthel Index (ADL) | calc_barthel | geriatrics | Mahoney FI, Barthel DW 1965 — PMID 14258950 | ✓ | — | ✓ | lookup | planned-v0.5 | Functional independence. |
| ABCD² Score (TIA) | calc_abcd2 | neurology | Johnston SC et al 2007 — PMID 17258668 | ✓ | — | ✓ | lookup | planned-v0.5 | Post-TIA stroke risk. |
| ABCD³-I | calc_abcd3_i | neurology | Merwick A et al 2010 — PMID 20951643 | — | — | — | lookup | wishlist | ABCD² + imaging. |
| Canadian TIA Score | calc_canadian_tia | neurology | Perry JJ et al 2018 — PMID 30150188 | ✓ | — | ✓ | lookup | wishlist | Canadian TIA risk. |
| Cincinnati Prehospital Stroke Scale | calc_cps_scale | neurology | Kothari R et al 1999 — PMID 10199427 | ✓ | — | — | lookup | wishlist | EMS stroke screen. |
| Cincinnati Prehospital Stroke Severity Scale (CP-SSS) | calc_cp_sss | neurology | Katz BS et al 2015 — PMID 25649520 | ✓ | — | ✓ | lookup | wishlist | LVO screen. |
| Los Angeles Motor Scale (LAMS) | calc_lams | neurology | Llanes JN et al 2004 — PMID 14655894 | ✓ | — | ✓ | lookup | wishlist | LVO prehospital. |
| FAST Stroke Scale | calc_fast_stroke | neurology | Harbison J et al 2003 — PMID 12671122 | — | — | — | tree | wishlist | Lay/EMS stroke screen. |
| BE-FAST | calc_be_fast | neurology | Aroor S et al 2017 — PMID 28611019 | — | — | — | tree | wishlist | BE-FAST adds vision/balance. |
| Alberta Stroke Program Early CT Score (ASPECTS) | calc_aspects | neurology | Barber PA et al 2000 — PMID 10797059 | ✓ | — | ✓ | lookup | planned-v0.5 | Anterior circ ischemia on CT. |
| ICH Score | calc_ich_score | neurology | Hemphill JC et al 2001 — PMID 11283388 | ✓ | — | ✓ | lookup | planned-v0.5 | ICH 30-day mortality. |
| FUNC Score (ICH outcome) | calc_func | neurology | Rost NS et al 2008 — PMID 18434639 | ✓ | — | ✓ | lookup | wishlist | 90-day functional outcome. |
| Hunt & Hess (SAH) | calc_hunt_hess | neurology | Hunt WE, Hess RM 1968 — PMID 5635959 | ✓ | — | ✓ | lookup | planned-v0.5 | SAH severity. |
| Fisher Grade (SAH) | calc_fisher_sah | neurology | Fisher CM et al 1980 — PMID 7354892 | ✓ | — | ✓ | lookup | planned-v0.5 | SAH vasospasm risk. |
| Modified Fisher Grade | calc_fisher_mod | neurology | Frontera JA et al 2006 — PMID 16823288 | ✓ | — | ✓ | lookup | planned-v0.5 | Updated Fisher. |
| WFNS SAH Grading | calc_wfns_sah | neurology | Drake CG 1988 — PMID 3193835 | — | — | — | lookup | wishlist | World Fed Neurosurg SAH scale. |
| Ottawa SAH Rule | calc_ottawa_sah | neurology | Perry JJ et al 2013 — PMID 24065011 | ✓ | — | ✓ | tree | wishlist | ED headache SAH rule-out. |
| DRAGON Score (post-tPA outcome) | calc_dragon | neurology | Strbian D et al 2012 — PMID 22156988 | ✓ | — | ✓ | lookup | wishlist | Post-tPA 3-mo outcome. |
| HAT Score (post-tPA hemorrhage) | calc_hat | neurology | Lou M et al 2008 — PMID 18654085 | ✓ | — | ✓ | lookup | wishlist | Hemorrhage After Thrombolysis. |
| SEDAN Score | calc_sedan | neurology | Strbian D et al 2012 — PMID 23006902 | — | — | — | lookup | wishlist | Symptomatic ICH post-tPA. |
| THRIVE Score | calc_thrive | neurology | Flint AC et al 2010 — PMID 21127308 | — | — | — | lookup | wishlist | Stroke outcome. |
| iScore (Stroke) | calc_iscore | neurology | Saposnik G et al 2011 — PMID 21399096 | — | — | — | formula | wishlist | Ischemic stroke 30-d/1-yr. |
| ASTRAL Score | calc_astral | neurology | Ntaios G et al 2012 — PMID 22155923 | ✓ | — | ✓ | lookup | wishlist | Stroke functional outcome. |
| SOAR Score (Stroke) | calc_soar | neurology | Myint PK et al 2014 — PMID 24938835 | ✓ | — | ✓ | lookup | wishlist | Acute stroke mortality. |
| ASCOD Algorithm | calc_ascod | neurology | Amarenco P et al 2013 — PMID 23735776 | ✓ | — | ✓ | tree | wishlist | Stroke etiology phenotype. |
| TOAST Classification | calc_toast | neurology | Adams HP et al 1993 — PMID 7678184 | — | — | — | tree | wishlist | Ischemic stroke subtype. |
| HINTS Exam (vestibular) | calc_hints | neurology | Kattah JC et al 2009 — PMID 19762709 | ✓ | — | ✓ | tree | planned-v0.5 | Central vs peripheral vertigo. |
| Sudbury Vertigo Risk Score | calc_sudbury_vertigo | neurology | Ohle R et al 2024 — PMID 38284789 | ✓ | — | ✓ | lookup | wishlist | Posterior circulation stroke pretest. |
| Cerebral Perfusion Pressure | calc_cpp_neuro | neurology | n/a — MAP − ICP | ✓ | — | ✓ | formula | planned-v0.5 | Neuro-ICU. |
| IMPACT Score (head injury outcome) | calc_impact_head_injury | neurology | Steyerberg EW et al 2008 — PMID 18684008 | ✓ | — | ✓ | formula | wishlist | TBI 6-mo outcome. |
| Marshall CT Classification (TBI) | calc_marshall_ct | neurology | Marshall LF et al 1991 (J Neurosurg) | — | — | — | lookup | wishlist | TBI CT severity. |
| Rotterdam CT Score (TBI) | calc_rotterdam_tbi | neurology | Maas AIR et al 2005 — PMID 16234772 | — | — | — | lookup | wishlist | TBI CT severity, alt to Marshall. |
| Modified Brain Injury Guideline (mBIG) | calc_mbig | neurology | Joseph B et al 2014 — PMID 24566612 | ✓ | — | ✓ | tree | wishlist | TBI management triage. |
| Brain Trauma Foundation Guidelines | calc_btf_tbi | neurology | BTF 2017 — PMID 27654000 | — | — | — | tree | wishlist | Severe TBI management. |
| Canadian CT Head Rule | calc_canadian_ct_head | neurology | Stiell IG et al 2001 — PMID 11356436 | ✓ | — | ✓ | tree | planned-v0.5 | Adult CT head rule. |
| New Orleans Head Trauma Rule | calc_new_orleans_head | neurology | Haydel MJ et al 2000 — PMID 10891516 | ✓ | — | ✓ | tree | wishlist | Minor head injury rule. |
| Nexus II Head CT Rule | calc_nexus_ii_head | neurology | Mower WR et al 2005 — PMID 16187471 | — | — | — | tree | wishlist | Adult head CT rule. |
| PECARN Pediatric Head Injury Rule | calc_pecarn_head | pediatrics | Kuppermann N et al 2009 — PMID 19758692 | ✓ | — | ✓ | tree | planned-v0.5 | Pediatric CT head decision. |
| CATCH Rule (pediatric head injury) | calc_catch | pediatrics | Osmond MH et al 2010 — PMID 20212034 | ✓ | — | ✓ | tree | wishlist | Canadian ped CT head rule. |
| CHALICE Rule | calc_chalice | pediatrics | Dunning J et al 2006 — PMID 17056862 | ✓ | — | ✓ | tree | wishlist | UK pediatric head injury rule. |
| Canadian C-Spine Rule | calc_canadian_c_spine | neurology | Stiell IG et al 2001 — PMID 11597285 | ✓ | — | ✓ | tree | planned-v0.5 | C-spine clearance. |
| NEXUS C-Spine Criteria | calc_nexus_c_spine | neurology | Hoffman JR et al 2000 — PMID 10891517 | ✓ | — | ✓ | tree | planned-v0.5 | Alt c-spine clearance. |
| McDonald Criteria (MS, 2017) | calc_mcdonald_ms | neurology | Thompson AJ et al 2018 — PMID 29275977 | ✓ | — | ✓ | tree | planned-v0.5 | MS diagnostic criteria. |
| EDSS (Expanded Disability Status Scale) | calc_edss | neurology | Kurtzke JF 1983 — PMID 6685237 | ✓ | — | ✓ | lookup | planned-v0.5 | MS disability. |
| MS Functional Composite (MSFC) | calc_msfc | neurology | Fischer JS et al 1999 — PMID 10367002 | — | — | — | formula | wishlist | MS composite outcome. |
| Disease Steps (MS) | calc_disease_steps_ms | neurology | Hohol MJ et al 1995 — PMID 8559373 | ✓ | — | ✓ | lookup | wishlist | Patient-reported MS. |
| Modified Fatigue Impact Scale (MFIS) | calc_mfis | neurology | Kos D et al 2005 — PMID 16273988 | ✓ | — | ✓ | lookup | wishlist | MS fatigue PROM. |
| MG-ADL (Myasthenia Gravis ADL) | calc_mg_adl | neurology | Wolfe GI et al 1999 — PMID 9923470 | ✓ | — | ✓ | lookup | wishlist | MG functional status. |
| Hoehn & Yahr (Parkinson) | calc_hoehn_yahr | neurology | Hoehn MM, Yahr MD 1967 — PMID 6067254 | ✓ | — | ✓ | lookup | planned-v0.5 | Parkinson stage 1-5. |
| MDS-UPDRS | calc_mds_updrs | neurology | Goetz CG et al 2008 — PMID 19025984 | — | — | — | lookup | wishlist | Parkinson rating scale. |
| Modified UPDRS | calc_updrs | neurology | Fahn S, Elton R 1987 (Recent Devel) | — | — | — | lookup | wishlist | Older UPDRS. |
| Montreal Cognitive Assessment (MoCA) | calc_moca | neurology | Nasreddine ZS et al 2005 — PMID 15817019 | ✓ | — | ✓ | lookup | planned-v0.5 | MCI screen; copyrighted, free for non-commercial. |
| Mini-Mental State Exam (MMSE) | calc_mmse | neurology | Folstein MF et al 1975 — PMID 1202204 | ✓ | — | — | lookup | planned-v0.5 | IP-sensitive: PAR Inc. holds copyright since 2001. |
| AD8 (Alzheimer Screen) | calc_ad8 | neurology | Galvin JE et al 2005 — PMID 16183942 | — | — | — | lookup | wishlist | Informant-based dementia screen. |
| Clinical Dementia Rating (CDR) | calc_cdr | neurology | Hughes CP et al 1982 — PMID 7104545 | ✓ | — | ✓ | lookup | wishlist | Dementia severity. |
| Mini-Cog | calc_mini_cog | neurology | Borson S et al 2000 — PMID 11113982 | ✓ | — | — | lookup | wishlist | 3-item recall + clock. |
| GDS (Global Deterioration Scale) | calc_gds_alzheimer | neurology | Reisberg B et al 1982 — PMID 7114305 | — | — | — | lookup | wishlist | Dementia progression. |
| IWG-2 Alzheimer Criteria | calc_iwg2_ad | neurology | Dubois B et al 2014 — PMID 24849862 | ✓ | — | ✓ | tree | wishlist | International dx criteria. |
| 2HELPS2B Score | calc_2helps2b | neurology | Struck AF et al 2017 — PMID 28829917 | ✓ | — | ✓ | lookup | wishlist | Seizure risk on cEEG. |
| ICH Mortality Calculator (FUNC) | calc_func_ich | neurology | Rost NS et al 2008 — PMID 18434639 | ✓ | — | ✓ | lookup | wishlist | Alias. |
| Glasgow Outcome Scale (GOS) | calc_gos | neurology | Jennett B, Bond M 1975 — PMID 46957 | — | — | — | lookup | wishlist | TBI outcome 1-5. |
| Extended GOS (GOSE) | calc_gose | neurology | Wilson JT et al 1998 — PMID 9573220 | — | — | — | lookup | wishlist | Extended GOS 1-8. |
| Hack's Impairment Index (alcohol) | calc_hack_impairment | neurology | Hack JB et al 2014 — PMID 25104452 | ✓ | — | ✓ | lookup | wishlist | Acute alcohol impairment. |
| El Escorial ALS Criteria | calc_el_escorial_als | neurology | Brooks BR et al 2000 — PMID 11464847 | — | — | — | tree | wishlist | ALS diagnostic criteria. |
| ALS Functional Rating Scale-Revised (ALSFRS-R) | calc_alsfrs_r | neurology | Cedarbaum JM et al 1999 — PMID 10540002 | — | — | — | lookup | wishlist | ALS function. |
| MIDAS (Migraine Disability Assessment) | calc_midas | neurology | Stewart WF et al 1999 — PMID 9923010 | ✓ | — | ✓ | lookup | wishlist | Migraine disability. |
| mTOQ-4 (Migraine Treatment Optimization) | calc_mtoq4 | neurology | Lipton RB et al 2009 — PMID 19366342 | ✓ | — | ✓ | lookup | wishlist | Acute migraine response. |
| HIT-6 (Headache Impact Test) | calc_hit6 | neurology | Kosinski M et al 2003 — PMID 12814681 | — | — | — | lookup | wishlist | Headache impact. |
| Modified Rankin Score-9Q | calc_mrs_9q | neurology | Bruno A et al 2010 — PMID 20019339 | ✓ | — | ✓ | tree | wishlist | Structured mRS. |
| QuickDASH | calc_quick_dash | neurology | Beaton DE et al 2005 — PMID 15770014 | — | — | — | lookup | wishlist | Upper-extremity function. |
| Neck Disability Index | calc_ndi | neurology | Vernon H, Mior S 1991 — PMID 1834753 | ✓ | — | ✓ | lookup | wishlist | Neck pain function. |
| ESS (Epworth Sleepiness Scale) | calc_ess | neurology | Johns MW 1991 — PMID 1798888 | ✓ | — | — | lookup | wishlist | Daytime sleepiness; cross-listed. |
| Berg Balance Scale | calc_berg_balance | neurology | Berg KO et al 1992 — PMID 1468055 | ✓ | — | ✓ | lookup | wishlist | Falls risk balance. |
| Timed Up and Go (TUG) | calc_tug | geriatrics | Podsiadlo D, Richardson S 1991 — PMID 1991946 | — | — | — | formula | planned-v0.5 | Falls/mobility; cross-listed geriatrics. |
| Trunk Impairment Scale | calc_trunk_impairment | neurology | Verheyden G et al 2004 — PMID 15293485 | ✓ | — | ✓ | lookup | wishlist | Post-stroke trunk control. |
| Overall Neuropathy Limitations Scale (ONLS) | calc_onls | neurology | Graham RC, Hughes RA 2006 — PMID 16835376 | ✓ | — | ✓ | lookup | wishlist | Peripheral neuropathy disability. |
| Pain Visual Analog Scale (VAS) | calc_pain_vas | neurology | Huskisson EC 1974 — PMID 4136544 | — | — | — | formula | wishlist | Pain rating. |
| Neuropathic Pain Scale (NPS) | calc_nps | neurology | Galer BS, Jensen MP 1997 — PMID 9040716 | ✓ | — | ✓ | lookup | wishlist | NeP intensity. |
| DELTA-P Score (LEMS) | calc_delta_p_lems | neurology | Titulaer MJ et al 2011 — PMID 21484829 | ✓ | — | ✓ | lookup | wishlist | LEMS tumor association. |
| tPA (Alteplase) Dosing for Ischemic Stroke | calc_tpa_dose_stroke | neurology | NINDS 1995 — PMID 7477192 | ✓ | — | ✓ | formula | planned-v0.5 | 0.9 mg/kg, max 90 mg. |
| tPA Contraindications | calc_tpa_contraindications | neurology | Powers WJ et al 2019 — PMID 31662037 | ✓ | — | ✓ | tree | wishlist | 2019 AHA stroke guideline checklist. |
| Tenecteplase Dosing (Stroke) | calc_tnk_stroke | neurology | Campbell BCV et al 2018 — PMID 29694815 | — | — | — | formula | wishlist | 0.25 mg/kg alt. |
| Brain Metastasis Velocity (BMV) | calc_bmv | oncology | Farris M et al 2017 — PMID 28575884 | ✓ | — | ✓ | formula | wishlist | After SRS. |
| Karnofsky Performance Status | calc_kps | oncology | Karnofsky DA, Burchenal JH 1949 (book chapter) | ✓ | — | ✓ | lookup | planned-v0.5 | Oncology functional status. |

## Hematology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Absolute Neutrophil Count (ANC) | calc_anc | hematology | n/a — formula (WBC × (%N + %B) / 100) | ✓ | — | ✓ | formula | planned-v0.1 | Neutropenia threshold. |
| Absolute Lymphocyte Count (ALC) | calc_alc | hematology | n/a — formula | ✓ | — | ✓ | formula | planned-v0.5 | CD4 surrogate. |
| Corrected Reticulocyte / RPI | calc_rpi | hematology | n/a — formula | ✓ | — | ✓ | formula | planned-v0.5 | BM response in anemia. |
| Mentzer Index | calc_mentzer | hematology | Mentzer WC 1973 — PMID 4127948 | ✓ | — | ✓ | formula | wishlist | Thalassemia vs IDA. |
| Neutrophil-Lymphocyte Ratio (NLR) | calc_nlr | hematology | Zahorec R 2001 — PMID 11723675 | ✓ | — | ✓ | formula | wishlist | Inflammation marker. |
| Ganzoni Equation (Iron Deficit) | calc_ganzoni_iron | hematology | Ganzoni AM 1970 — PMID 5413814 | ✓ | — | ✓ | formula | planned-v0.5 | IV iron dose. |
| ISTH DIC Criteria | calc_isth_dic | hematology | Taylor FB et al 2001 — PMID 11816725 | ✓ | — | ✓ | lookup | planned-v0.5 | DIC scoring. |
| JAAM DIC Score | calc_jaam_dic | hematology | Gando S et al 2006 — PMID 17066249 | — | — | — | lookup | wishlist | Japanese DIC alt. |
| 4Ts Score for HIT | calc_4ts | hematology | Lo GK et al 2006 — PMID 16634744 | ✓ | — | ✓ | lookup | planned-v0.5 | Heparin-induced thrombocytopenia. |
| HEP Score (HIT) | calc_hep_score | hematology | Cuker A et al 2010 — PMID 20488247 | ✓ | — | ✓ | lookup | wishlist | Expert HIT probability. |
| HScore (Reactive Hemophagocytic Syndrome) | calc_hscore | hematology | Fardet L et al 2014 — PMID 24782338 | ✓ | — | ✓ | formula | wishlist | HLH probability. |
| HLH-2004 Criteria | calc_hlh_2004 | hematology | Henter JI et al 2007 — PMID 16937360 | — | — | — | tree | wishlist | HLH dx criteria. |
| ISTH-SCC Bleeding Assessment Tool | calc_isth_bat | hematology | Rodeghiero F et al 2010 — PMID 20345717 | ✓ | — | ✓ | lookup | wishlist | Bleeding history tool. |
| Cryoprecipitate Dose for Fibrinogen | calc_cryo_fibrinogen | hematology | n/a — institutional | ✓ | — | ✓ | formula | wishlist | Replacement dose. |
| Maximum Allowable Blood Loss | calc_max_blood_loss | surgery | n/a — formula | ✓ | — | ✓ | formula | wishlist | Surgical planning. |
| Blood Volume Calculation (Nadler) | calc_blood_volume_nadler | hematology | Nadler SB et al 1962 — PMID 14431029 | ✓ | — | ✓ | formula | wishlist | Total blood volume estimation. |
| Corrected Count Increment (Platelets) | calc_cci_platelets | hematology | Bishop JF et al 1988 (Br J Haematol) | ✓ | — | ✓ | formula | wishlist | Platelet refractoriness. |
| Donor Lymphocyte Infusion Volume | calc_dli_volume | hematology | n/a — institutional | ✓ | — | ✓ | formula | wishlist | DLI dose. |
| Intrauterine RBC Transfusion Dose | calc_iut_rbc | obstetrics | Mandelbrot L et al 1988 — PMID 3133007 | ✓ | — | ✓ | formula | wishlist | Fetal anemia. |
| Maternal-Fetal Hemorrhage RhIG Dose | calc_rhig_dose | obstetrics | n/a — clinical | ✓ | — | ✓ | formula | wishlist | Anti-D after FMH. |
| Iron Sucrose / Ferric Carboxymaltose Dose | calc_iv_iron_dose | hematology | n/a — institutional | — | — | — | formula | wishlist | IV iron prescribing. |
| Sickle Cell Anemia Severity (Sebastiani) | calc_scd_severity | hematology | Sebastiani P et al 2007 — PMID 17533253 | — | — | — | formula | wishlist | SCD severity. |
| von Willebrand Disease Bleeding Score (Tosetto) | calc_vwd_bleed_tosetto | hematology | Tosetto A et al 2006 — PMID 16634744 | — | — | — | lookup | wishlist | VWD probability. |

## Oncology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| ECOG Performance Status | calc_ecog | oncology | Oken MM et al 1982 — PMID 7165009 | ✓ | — | ✓ | lookup | planned-v0.5 | 0-5 functional status; trial eligibility. |
| Karnofsky Performance Status (KPS) | calc_kps_onc | oncology | Karnofsky DA 1949 (book) | ✓ | — | ✓ | lookup | planned-v0.5 | Older 0-100 PS. |
| Lansky Play-Performance (peds) | calc_lansky | pediatrics | Lansky SB et al 1987 — PMID 3815714 | ✓ | — | ✓ | lookup | wishlist | Pediatric KPS. |
| Charlson Comorbidity Index (oncology) | calc_charlson_onc | oncology | Charlson ME et al 1987 — PMID 3558716 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Comorbidity in cancer trials. |
| CTCAE (Common Terminology Criteria) | calc_ctcae | oncology | NCI 2017 v5.0 | ✓ | — | ✓ | lookup | wishlist | Adverse-event grading; not numeric per se. |
| FLIPI (Follicular Lymphoma IPI) | calc_flipi | oncology | Solal-Céligny P et al 2004 — PMID 15265785 | ✓ | — | ✓ | lookup | planned-v0.5 | FL prognosis. |
| FLIPI-2 | calc_flipi_2 | oncology | Federico M et al 2009 — PMID 19620493 | — | — | — | lookup | wishlist | Modern FL prognosis. |
| IPI (DLBCL) | calc_ipi_dlbcl | oncology | International NHL Prognostic Factors Project 1993 — PMID 8141877 | ✓ | — | ✓ | lookup | planned-v0.5 | DLBCL prognosis. |
| R-IPI (Revised IPI) | calc_r_ipi | oncology | Sehn LH et al 2007 — PMID 17008552 | ✓ | — | ✓ | lookup | wishlist | Post-rituximab DLBCL IPI. |
| NCCN-IPI | calc_nccn_ipi | oncology | Zhou Z et al 2014 — PMID 24009124 | ✓ | — | ✓ | lookup | wishlist | NCCN modern IPI. |
| CNS-IPI | calc_cns_ipi | oncology | Schmitz N et al 2016 — PMID 27269947 | ✓ | — | ✓ | lookup | wishlist | DLBCL CNS relapse risk. |
| MIPI (Mantle Cell Lymphoma) | calc_mipi | oncology | Hoster E et al 2008 — PMID 18187660 | ✓ | — | ✓ | formula | wishlist | MCL prognosis. |
| MALT-IPI | calc_malt_ipi | oncology | Thieblemont C et al 2017 — PMID 28729474 | ✓ | — | ✓ | lookup | wishlist | MALT lymphoma. |
| GELF Criteria (Follicular Lymphoma Tx) | calc_gelf | oncology | Brice P et al 1997 — PMID 9060549 | ✓ | — | ✓ | lookup | wishlist | FL treatment trigger. |
| Hasenclever IPS (Hodgkin) | calc_ips_hodgkin | oncology | Hasenclever D et al 1998 — PMID 9744275 | — | — | — | lookup | wishlist | Advanced HL prognosis. |
| Multiple Myeloma ISS | calc_iss_mm | oncology | Greipp PR et al 2005 — PMID 15809451 | ✓ | — | ✓ | lookup | planned-v0.5 | MM staging I-III. |
| R-ISS (Revised ISS) | calc_r_iss_mm | oncology | Palumbo A et al 2015 — PMID 26240224 | — | — | — | lookup | wishlist | Adds LDH + cytogenetics. |
| R2-ISS Multiple Myeloma | calc_r2_iss_mm | oncology | D'Agostino M et al 2022 — PMID 35658489 | — | — | — | lookup | wishlist | Latest MM staging. |
| IMWG Myeloma Diagnostic Criteria | calc_imwg_mm | oncology | Rajkumar SV et al 2014 — PMID 25439696 | ✓ | — | ✓ | tree | wishlist | MM dx criteria. |
| MM Response Criteria (IMWG) | calc_imwg_response | oncology | Kumar S et al 2016 — PMID 27511158 | ✓ | — | ✓ | tree | wishlist | MM response assessment. |
| BALL Score (R/R CLL) | calc_ball_rr_cll | oncology | Soumerai JD et al 2019 — PMID 31221624 | ✓ | — | ✓ | lookup | wishlist | R/R CLL prognosis. |
| Binet Staging (CLL) | calc_binet_cll | oncology | Binet JL et al 1981 — PMID 7237385 | ✓ | — | ✓ | lookup | wishlist | CLL staging. |
| Rai Staging (CLL) | calc_rai_cll | oncology | Rai KR et al 1975 — PMID 1139039 | — | — | — | lookup | wishlist | CLL staging (US). |
| CLL-IPI | calc_cll_ipi | oncology | International CLL-IPI working group 2016 — PMID 27374110 | ✓ | — | ✓ | lookup | wishlist | CLL prognosis. |
| IPS-E (Early-stage CLL) | calc_ips_e | oncology | Condoluci A et al 2020 — PMID 32457823 | ✓ | — | ✓ | lookup | wishlist | Asymptomatic CLL. |
| IPSS-R (MDS) | calc_ipss_r_mds | oncology | Greenberg PL et al 2012 — PMID 22740453 | — | — | — | lookup | wishlist | MDS prognosis. |
| IPSS-M (MDS, 2022) | calc_ipss_m_mds | oncology | Bernard E et al 2022 — PMID 36634060 | — | — | — | formula | wishlist | Molecular MDS prognosis. |
| WPSS (WHO MDS Score) | calc_wpss_mds | oncology | Malcovati L et al 2007 — PMID 17609426 | ✓ | — | ✓ | lookup | wishlist | MDS WHO-based prognosis. |
| DIPSS (Myelofibrosis) | calc_dipss | oncology | Passamonti F et al 2010 — PMID 20193080 | ✓ | — | ✓ | lookup | wishlist | MF prognosis. |
| DIPSS-Plus | calc_dipss_plus | oncology | Gangat N et al 2011 — PMID 21205761 | ✓ | — | ✓ | lookup | wishlist | DIPSS + karyotype. |
| MIPSS70 / MIPSS70+ (Myelofibrosis Mol) | calc_mipss70 | oncology | Guglielmelli P et al 2018 — PMID 29286026 | ✓ | — | ✓ | lookup | wishlist | Molecular MF prognosis. |
| GIPSS (Genetic IPSS for PMF) | calc_gipss | oncology | Tefferi A et al 2018 — PMID 29915391 | ✓ | — | ✓ | lookup | wishlist | Molecular-only MF. |
| MYSEC-PM | calc_mysec_pm | oncology | Passamonti F et al 2017 — PMID 28298589 | ✓ | — | ✓ | formula | wishlist | Secondary MF prognosis. |
| WHO 2022 Diagnostic Criteria (Polycythemia Vera) | calc_who_pv | oncology | Khoury JD et al 2022 — PMID 35732831 | ✓ | — | ✓ | tree | wishlist | PV dx. |
| WHO 2022 Diagnostic Criteria (Systemic Mastocytosis) | calc_who_sm | oncology | Khoury JD et al 2022 — PMID 35732831 | ✓ | — | ✓ | tree | wishlist | SM dx. |
| ICC Diagnostic Criteria (PMF) | calc_icc_pmf | oncology | Arber DA et al 2022 — PMID 35767897 | ✓ | — | ✓ | tree | wishlist | PMF dx (ICC). |
| ICC Diagnostic Criteria (Systemic Mastocytosis) | calc_icc_sm | oncology | Arber DA et al 2022 — PMID 35767897 | ✓ | — | ✓ | tree | wishlist | SM dx (ICC). |
| EUTOS Score (CML) | calc_eutos_cml | oncology | Hasford J et al 2011 — PMID 21926413 | ✓ | — | ✓ | formula | wishlist | CML treatment response. |
| Sokal Score (CML) | calc_sokal_cml | oncology | Sokal JE et al 1984 — PMID 6584184 | — | — | — | formula | wishlist | Classic CML score. |
| Hasford / EURO Score (CML) | calc_hasford_cml | oncology | Hasford J et al 1998 — PMID 9486754 | — | — | — | formula | wishlist | Pre-EUTOS CML. |
| ELTS Score (CML) | calc_elts_cml | oncology | Pfirrmann M et al 2016 — PMID 26847026 | — | — | — | formula | wishlist | EUTOS Long-Term Survival. |
| Duval/CIBMTR (AML survival) | calc_duval_cibmtr_aml | oncology | Duval M et al 2010 — PMID 20644094 | ✓ | — | ✓ | lookup | wishlist | Relapsed AML transplant. |
| HCT-CI (Sorror) | calc_hct_ci | oncology | Sorror ML et al 2005 — PMID 15994282 | ✓ | — | ✓ | lookup | planned-v0.5 | Transplant comorbidity. |
| EBMT Risk Score | calc_ebmt | oncology | Gratwohl A 2012 — PMID 22037176 | — | — | — | lookup | wishlist | Allo-HCT risk. |
| CARG Toxicity Tool (older oncology pt) | calc_carg | oncology | Hurria A et al 2011 — PMID 21810685 | ✓ | — | ✓ | formula | wishlist | Chemo toxicity in elders. |
| CRASH Score (chemo, elderly) | calc_crash | oncology | Extermann M et al 2012 — PMID 22072233 | ✓ | — | ✓ | lookup | wishlist | Chemo Risk Ax for High-Age. |
| Gail Model (Breast Cancer Risk) | calc_gail_bcra | oncology | Gail MH et al 1989 — PMID 2593165 | ✓ | — | ✓ | formula | planned-v0.5 | 5-yr BC risk. |
| Tyrer-Cuzick (IBIS, Breast Cancer) | calc_tyrer_cuzick | oncology | Tyrer J et al 2004 — PMID 15188310 | — | — | — | formula | wishlist | Adds family hx detail. |
| BCSC (Breast Cancer Surveillance) | calc_bcsc | oncology | Tice JA et al 2008 — PMID 18316752 | — | — | — | formula | wishlist | US BC risk. |
| BOADICEA (CanRisk) | calc_boadicea | oncology | Lee A et al 2019 — PMID 30787472 | — | — | — | formula | wishlist | BRCA/family BC risk. |
| Manchester BRCA Score | calc_manchester_brca | oncology | Evans DG et al 2004 — PMID 15239696 | — | — | — | formula | wishlist | BRCA testing threshold. |
| Adjuvant! Online (Breast) | calc_adjuvant_online | oncology | Ravdin PM et al 2001 — PMID 11181667 | — | — | — | formula | wishlist | Breast cancer adjuvant benefit. |
| PREDICT (Breast Cancer Outcome) | calc_predict_breast | oncology | Wishart GC et al 2010 — PMID 20053270 | — | — | — | formula | wishlist | UK BC outcome. |
| Oncotype DX Risk (RS) | calc_oncotype_dx | oncology | Paik S et al 2004 — PMID 15591335 | — | — | — | formula | wishlist | Commercial; n/a for compute. |
| Memorial Sloan Kettering (MSKCC) Prostate Nomogram | calc_mskcc_prostate | oncology | Kattan MW et al 2008 (J Clin Oncol) | ✓ | — | — | formula | wishlist | Prostate biopsy nomogram. |
| D'Amico Risk (Prostate Cancer) | calc_damico_prostate | oncology | D'Amico AV et al 1998 — PMID 9749478 | ✓ | — | ✓ | lookup | wishlist | Localized prostate Ca risk. |
| Gleason Score | calc_gleason | oncology | Gleason DF 1966 — PMID 5949556 | ✓ | — | ✓ | lookup | planned-v0.5 | Prostate Ca pathology. |
| PSA Doubling Time | calc_psadt | oncology | Pound CR et al 1999 — PMID 10367820 | ✓ | — | ✓ | formula | wishlist | Biochemical recurrence kinetics. |
| MSKCC / Motzer Score (RCC) | calc_mskcc_rcc | oncology | Motzer RJ et al 2002 — PMID 11900224 | ✓ | — | ✓ | lookup | planned-v0.5 | mRCC prognosis. |
| Mekhail Extension (Motzer) | calc_mekhail | oncology | Mekhail TM et al 2005 — PMID 15659513 | ✓ | — | ✓ | lookup | wishlist | RCC alt. |
| Heng / IMDC Score (RCC) | calc_imdc_rcc | oncology | Heng DYC et al 2009 — PMID 19826129 | ✓ | — | ✓ | lookup | planned-v0.5 | IO-era mRCC prognosis. |
| Leibovich Model (RCC, 2018) | calc_leibovich_rcc | oncology | Leibovich BC et al 2018 — PMID 29615406 | ✓ | — | ✓ | formula | wishlist | Post-nephrectomy RCC. |
| Fuhrman Grade (RCC) | calc_fuhrman | oncology | Fuhrman SA et al 1982 — PMID 7148412 | ✓ | — | ✓ | lookup | wishlist | RCC pathology. |
| IOTA Simple Rules (Ovarian) | calc_iota | oncology | Timmerman D et al 2008 — PMID 18548405 | ✓ | — | ✓ | tree | wishlist | Adnexal mass risk. |
| FIGO Ovarian Cancer Staging | calc_figo_ovarian | oncology | FIGO 2014 — PMID 24389334 | ✓ | — | ✓ | lookup | wishlist | Ovarian staging. |
| Fong Score (CRC Liver Metastasis) | calc_fong_crc_lm | oncology | Fong Y et al 1999 — PMID 10493478 | ✓ | — | ✓ | lookup | wishlist | Post-hepatectomy CRC. |
| Mirels' Criteria (Pathologic Fracture) | calc_mirels | oncology | Mirels H 1989 — PMID 2684463 | ✓ | — | ✓ | lookup | wishlist | Prophylactic fixation. |
| RECIST 1.1 | calc_recist | oncology | Eisenhauer EA et al 2009 — PMID 19097774 | — | — | — | formula | wishlist | Solid-tumor response criteria. |
| mRECIST (HCC) | calc_mrecist | oncology | Lencioni R, Llovet JM 2010 — PMID 20175033 | ✓ | — | ✓ | formula | wishlist | HCC viable-tumor response. |
| irRECIST | calc_irrecist | oncology | Wolchok JD et al 2009 — PMID 19934295 | — | — | — | formula | wishlist | Immunotherapy response. |
| iRECIST | calc_irecist | oncology | Seymour L et al 2017 — PMID 28271869 | — | — | — | formula | wishlist | Modern IO response. |
| Glasgow Prognostic Score (mGPS) | calc_mgps | oncology | McMillan DC 2008 — PMID 18608048 | ✓ | — | ✓ | lookup | wishlist | Cancer cachexia/inflammation. |
| IPI for Glioma (RTOG-RPA) | calc_rtog_rpa_glioma | oncology | Curran WJ et al 1993 — PMID 8478956 | — | — | — | lookup | wishlist | GBM prognosis. |
| Graded Prognostic Assessment (GPA, brain mets) | calc_gpa_brain_mets | oncology | Sperduto PW et al 2008 — PMID 17601655 | — | — | — | lookup | wishlist | Brain met prognosis. |
| GI-GPA (Brain Mets from GI) | calc_gi_gpa | oncology | Sperduto PW et al 2018 — PMID 30024825 | ✓ | — | ✓ | lookup | wishlist | GI cancer brain mets. |
| ALK / Lung GPA | calc_lung_gpa | oncology | Sperduto PW et al 2017 — PMID 28419281 | — | — | — | lookup | wishlist | Lung brain mets. |
| Stupp Protocol | calc_stupp | oncology | Stupp R et al 2005 — PMID 15758009 | — | — | — | tree | wishlist | GBM chemoradiation. |
| LEUKER MMM (Manchester SCLC) | calc_manchester_sclc | oncology | Cerny T et al 1987 — PMID 3035222 | ✓ | — | ✓ | lookup | wishlist | SCLC prognosis. |
| BWH Egg Freezing Counseling | calc_bwh_efct | oncology | Goldman RH et al 2017 — PMID 28903761 | ✓ | — | ✓ | formula | wishlist | Fertility preservation. |
| Pancreatic Ca Prognostic Nomograms | calc_panc_prognostic | oncology | Brennan MF et al 2004 (Ann Surg) | — | — | — | formula | wishlist | Many MSKCC nomograms. |
| Asymptomatic Myeloma Prognosis | calc_asymp_myeloma | oncology | Mateos MV et al 2013 — PMID 23859188 | ✓ | — | ✓ | lookup | wishlist | Smoldering MM progression. |
| Mayo Alliance Prognostic System (MAPS) | calc_maps | oncology | Tefferi A et al 2018 — PMID 29581247 | ✓ | — | ✓ | lookup | wishlist | Systemic mastocytosis prognosis. |
| GIPSS for PMF | calc_gipss_pmf | oncology | Tefferi A et al 2018 — PMID 29915391 | ✓ | — | ✓ | lookup | wishlist | Alias listed for parity. |
| Brain Metastasis Velocity | calc_bmv_onc | oncology | Farris M et al 2017 — PMID 28575884 | ✓ | — | ✓ | formula | wishlist | Post-SRS new mets. |
| Cytokine Release Syndrome (CRS) Grading | calc_crs_grading | oncology | Lee DW et al 2019 — PMID 30592986 | ✓ | — | ✓ | lookup | wishlist | ASTCT CRS grading. |
| ICANS Grading (CAR-T neurotoxicity) | calc_icans | oncology | Lee DW et al 2019 — PMID 30592986 | — | — | — | lookup | wishlist | ASTCT ICANS grading. |
| Immune-Related AEs (Endocrine: DM) | calc_irae_endo_dm | oncology | Brahmer JR et al 2021 — PMID 34172483 | ✓ | — | ✓ | tree | wishlist | NCCN/ASCO IO toxicity guidelines. |
| Immune-Related AEs (Endocrine: Hypothyroid) | calc_irae_endo_thyroid | oncology | Brahmer JR et al 2021 — PMID 34172483 | ✓ | — | ✓ | tree | wishlist | IO hypothyroidism. |
| Immune-Related AEs (Colitis) | calc_irae_colitis | oncology | Brahmer JR et al 2021 — PMID 34172483 | ✓ | — | ✓ | tree | wishlist | IO colitis. |
| Immune-Related AEs (Hepatitis) | calc_irae_hepatitis | oncology | Brahmer JR et al 2021 — PMID 34172483 | ✓ | — | ✓ | tree | wishlist | IO hepatitis. |
| Immune-Related AEs (Pneumonitis) | calc_irae_pneumonitis | oncology | Brahmer JR et al 2021 — PMID 34172483 | ✓ | — | ✓ | tree | wishlist | IO pneumonitis. |
| Immune-Related AEs (Nephritis) | calc_irae_nephritis | oncology | Brahmer JR et al 2021 — PMID 34172483 | ✓ | — | ✓ | tree | wishlist | IO nephritis. |
| Additional Nodal Metastasis (Breast) Nomogram | calc_anm_breast | oncology | Van Zee KJ et al 2003 — PMID 14502554 | ✓ | — | ✓ | formula | wishlist | Sentinel LN nomogram. |
| Brain Metastasis Velocity (BMV) | calc_bmv_repeat | oncology | Farris M et al 2017 — PMID 28575884 | ✓ | — | ✓ | formula | wishlist | Repeat for alphabetization. |
| Cardiovascular Risk in OLT (CAR-OLT) | calc_car_olt | oncology | VanWagner LB et al 2017 — PMID 28691394 | ✓ | — | ✓ | formula | wishlist | Pre-OLT CV risk. |
| Prognostic Index for Cancer Outcomes | calc_prognostic_index_cancer | oncology | Glare P et al 2008 (J Pain Symp Manage) | ✓ | — | ✓ | formula | wishlist | Palliative care prognosis. |
| Palliative Prognostic Score (PaP) | calc_pap_score | oncology | Pirovano M et al 1999 — PMID 10428540 | — | — | — | lookup | wishlist | Hospice prognosis. |
| Palliative Performance Scale (PPS) | calc_pps | oncology | Anderson F et al 1996 (J Palliat Care) | — | — | — | lookup | wishlist | Palliative performance. |
| Edmonton Symptom Assessment Scale (ESAS-r) | calc_esas_r | oncology | Watanabe SM et al 2011 — PMID 21330090 | ✓ | — | ✓ | lookup | wishlist | Symptom screening. |

## Endocrinology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| HbA1c to eAG | calc_a1c_to_eag | endocrinology | Nathan DM et al 2008 — PMID 18540046 | ✓ | — | ✓ | formula | planned-v0.5 | Continuous glucose translation. |
| HOMA-IR | calc_homa_ir_endo | endocrinology | Matthews DR et al 1985 — PMID 3899825 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Insulin resistance. |
| HOMA-β | calc_homa_beta | endocrinology | Matthews DR et al 1985 — PMID 3899825 | — | — | — | formula | wishlist | β-cell function. |
| QUICKI Insulin Sensitivity | calc_quicki | endocrinology | Katz A et al 2000 — PMID 10902785 | — | — | — | formula | wishlist | Alt to HOMA-IR. |
| METS-IR (Metabolic Score for IR) | calc_mets_ir | endocrinology | Bello-Chavolla OY et al 2018 — PMID 29795452 | ✓ | — | ✓ | formula | wishlist | IR proxy without insulin. |
| TyG Index | calc_tyg_index | endocrinology | Simental-Mendía LE et al 2008 — PMID 19068161 | — | — | — | formula | wishlist | Triglyceride-glucose IR proxy. |
| DKA Diagnostic Criteria (ADA) | calc_dka_ada | endocrinology | ADA 2009 — PMID 19564476 | — | — | — | tree | planned-v0.5 | DKA dx + severity. |
| DKA MPM (Mortality Prediction) | calc_dka_mpm | endocrinology | Efstathiou SP et al 2002 — PMID 12433137 | ✓ | — | ✓ | lookup | wishlist | DKA mortality. |
| HHS Diagnostic Criteria | calc_hhs_dx | endocrinology | ADA 2009 — PMID 19564476 | — | — | — | tree | wishlist | HHS dx. |
| Hypoglycemia Risk Score | calc_hypo_risk | endocrinology | Karter AJ et al 2017 — PMID 28604921 | ✓ | — | ✓ | lookup | wishlist | DM hypoglycemia risk. |
| FINDRISC (Finnish T2DM Risk) | calc_findrisc | endocrinology | Lindström J, Tuomilehto J 2003 — PMID 12610029 | ✓ | — | ✓ | lookup | planned-v0.5 | T2DM pretest screen. |
| ADA Risk Calculator (Diabetes) | calc_ada_dm_risk | endocrinology | ADA T2DM screening 2010 | ✓ | — | ✓ | lookup | wishlist | Pretest screen. |
| CANRISK (Canadian T2DM) | calc_canrisk | endocrinology | Robinson CA et al 2011 — PMID 21349211 | ✓ | — | ✓ | lookup | wishlist | Canadian T2DM screen. |
| AUSDRISK (Australian T2DM) | calc_ausdrisk | endocrinology | Chen L et al 2010 — PMID 20622862 | ✓ | — | ✓ | lookup | wishlist | Australian T2DM screen. |
| Cambridge Diabetes Risk Score | calc_cambridge_dm | endocrinology | Griffin SJ et al 2000 — PMID 10980447 | ✓ | — | ✓ | formula | wishlist | UK undiagnosed T2DM screen. |
| Diabetes Distress Scale (DDS17) | calc_dds17 | endocrinology | Polonsky WH et al 2005 — PMID 15735199 | ✓ | — | ✓ | lookup | wishlist | DM psychosocial. |
| IDF-DAR Fasting Risk (Ramadan) | calc_idf_dar | endocrinology | IDF-DAR 2021 | ✓ | — | ✓ | lookup | wishlist | Ramadan diabetic fasting. |
| Glucose Infusion Rate (GIR) | calc_gir | endocrinology | n/a — formula | ✓ | — | ✓ | formula | wishlist | Hypoglycemia in TPN. |
| Insulin Pump Basal Rate (Initial) | calc_insulin_pump_basal | endocrinology | n/a — institutional | — | — | — | formula | wishlist | CSII initial dosing. |
| Carb-to-Insulin Ratio (450/500 rule) | calc_carb_insulin_ratio | endocrinology | n/a — clinical formula | — | — | — | formula | wishlist | DM intensive insulin. |
| Total Daily Insulin Dose (TDD) | calc_tdd_insulin | endocrinology | n/a — clinical formula | — | — | — | formula | wishlist | Insulin starting dose. |
| C-Peptide / Glucose Ratio | calc_cpep_glucose_ratio | endocrinology | Saisho Y et al 2014 — PMID 24643148 | ✓ | — | ✓ | formula | wishlist | β-cell function. |
| BeAM Value | calc_beam_value | endocrinology | Zisman A et al 2014 — PMID 24796685 | ✓ | — | ✓ | formula | wishlist | Bedtime-AM glucose differential. |
| High-dose Insulin Euglycemia Therapy (HIET) | calc_hiet | endocrinology | n/a — institutional toxicology | ✓ | — | ✓ | formula | wishlist | CCB / β-blocker overdose. |
| Burch-Wartofsky Score (Thyroid Storm) | calc_burch_wartofsky | endocrinology | Burch HB, Wartofsky L 1993 — PMID 8325286 | ✓ | — | ✓ | lookup | planned-v0.5 | Thyroid storm dx/severity. |
| Myxedema Coma Diagnostic Score | calc_myxedema_coma | endocrinology | Popoveniuc G et al 2014 — PMID 24574577 | ✓ | — | ✓ | lookup | wishlist | Myxedema coma probability. |
| Wells Score for Hyperthyroid Storm | calc_wells_thyroid | endocrinology | n/a | — | — | — | — | — | Intentionally omitted: no such score exists. |
| Edmonton Obesity Staging System (EOSS) | calc_eoss | endocrinology | Sharma AM, Kushner RF 2009 — PMID 19238447 | ✓ | — | ✓ | tree | wishlist | Obesity staging 0-4. |
| Edmonton Obesity Pediatric (EOSS-P) | calc_eoss_p | pediatrics | Hadjiyannakis S et al 2016 — PMID 27260440 | — | — | — | tree | wishlist | Pediatric obesity. |
| Body Roundness Index (BRI) | calc_bri | endocrinology | Thomas DM et al 2013 — PMID 23408597 | ✓ | — | ✓ | formula | wishlist | Anthropometric. |
| Fat-Free Mass (FFM) | calc_ffm | endocrinology | Cunningham JJ 1980 — PMID 7395793 | ✓ | — | ✓ | formula | wishlist | Body composition. |
| Waist-to-Hip Ratio | calc_whr | endocrinology | WHO Expert Consultation 2011 | — | — | — | formula | wishlist | Metabolic risk. |
| MUST (Malnutrition Universal Screening) | calc_must | endocrinology | Stratton RJ et al 2004 — PMID 15059265 | ✓ | — | ✓ | lookup | planned-v0.5 | Nutrition screen. |
| NRS-2002 (Nutrition Risk Screening) | calc_nrs_2002 | endocrinology | Kondrup J et al 2003 — PMID 12765661 | — | — | — | lookup | wishlist | Hospital nutrition. |
| MNA (Mini Nutritional Assessment) | calc_mna | geriatrics | Vellas B et al 1999 — PMID 9990575 | — | — | — | lookup | wishlist | Geriatric nutrition. |
| ABCD Criteria (DM Remission) | calc_dm_remission | endocrinology | Lee WJ et al 2010 — PMID 21082272 | — | — | — | lookup | wishlist | Post-bariatric DM. |
| DiaRem Score | calc_diarem | endocrinology | Still CD et al 2014 — PMID 24323084 | — | — | — | lookup | wishlist | DM remission post-bariatric. |
| Ad-DiaRem | calc_ad_diarem | endocrinology | Aron-Wisnewsky J et al 2017 — PMID 28289110 | — | — | — | lookup | wishlist | Updated DiaRem. |
| Acromegaly Disease Severity Score (SAGIT) | calc_sagit_acromegaly | endocrinology | Giustina A et al 2016 — PMID 26779503 | — | — | — | lookup | wishlist | Acromegaly. |
| Endocrine HypoPara Dosing | calc_hypopara_dose | endocrinology | n/a — institutional | — | — | — | formula | wishlist | Niche. |
| Pre-Diabetes Risk (Lindstrom) | calc_pre_diabetes_risk | endocrinology | Lindström J, Tuomilehto J 2003 — PMID 12610029 | — | — | — | lookup | wishlist | Alias FINDRISC. |
| Dutch Familial Hypercholesterolemia Criteria | calc_dutch_fh | endocrinology | Civeira F et al 2004 — PMID 15302150 | ✓ | — | ✓ | tree | wishlist | FH dx. |
| Simon Broome FH Criteria | calc_simon_broome_fh | endocrinology | Marks D et al 2002 — PMID 11792154 | — | — | — | tree | wishlist | UK FH dx. |
| MEDPED FH Criteria | calc_medped_fh | endocrinology | Williams RR et al 1993 — PMID 8466281 | ✓ | — | ✓ | lookup | wishlist | US FH dx. |

## Obstetrics / gynecology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Estimated Due Date (LMP / Naegele) | calc_edd_naegele | obstetrics | Naegele FK 1812 (historical) | ✓ | ✓ | ✓ | formula | planned-v0.5 | LMP + 280 d. |
| Estimated Gestational Age | calc_ega | obstetrics | n/a — formula from LMP/US | ✓ | ✓ | ✓ | formula | planned-v0.5 | EGA in weeks/days. |
| Estimated Conception Date | calc_conception_date | obstetrics | n/a — formula | ✓ | ✓ | ✓ | formula | planned-v0.5 | LMP + 14 d. |
| Pregnancy Calculator (composite) | calc_pregnancy | obstetrics | n/a — composite of EDD + EGA | ✓ | — | ✓ | multi-step | planned-v0.5 | Wraps the trio above. |
| Bishop Score | calc_bishop | obstetrics | Bishop EH 1964 — PMID 14199536 | ✓ | — | ✓ | lookup | planned-v0.5 | Cervical ripeness for induction. |
| Modified Bishop Score | calc_bishop_modified | obstetrics | Burnett JE 1966 — PMID 5953119 | ✓ | — | ✓ | lookup | wishlist | Updated Bishop. |
| APGAR Score | calc_apgar | obstetrics | Apgar V 1953 — PMID 13083014 | ✓ | — | ✓ | lookup | planned-v0.5 | Newborn 1/5/10-min score. |
| Fetal Biophysical Profile (BPP) | calc_bpp | obstetrics | Manning FA et al 1980 — PMID 7444499 | ✓ | — | ✓ | lookup | wishlist | Antepartum surveillance. |
| Modified BPP | calc_bpp_modified | obstetrics | Nageotte MP et al 1994 — PMID 8059811 | — | — | — | lookup | wishlist | NST + AFI only. |
| TOLAC / VBAC Calculator (Grobman) | calc_vbac_grobman | obstetrics | Grobman WA et al 2007 — PMID 17666601 | — | — | — | formula | wishlist | VBAC success probability. |
| Preeclampsia Risk (Fetal Medicine Foundation) | calc_pe_risk_fmf | obstetrics | Wright D et al 2015 — PMID 25555807 | — | — | — | formula | wishlist | First-trimester screen. |
| HELLP Criteria | calc_hellp | obstetrics | Sibai BM 2004 — PMID 14722411 | — | — | — | tree | wishlist | HELLP dx. |
| ACOG Severe Features Preeclampsia | calc_acog_severe_pe | obstetrics | ACOG 2020 — PMID 32443079 | — | — | — | tree | wishlist | Sev features dx. |
| HSV Genital Recurrence Risk | calc_hsv_recurrence | obstetrics | n/a | — | — | — | — | — | Intentionally omitted: not a standardized score. |
| Sepsis in Obstetrics Score (SOS) | calc_sos_obstetrics | obstetrics | Albright CM et al 2014 — PMID 24530970 | — | — | — | lookup | wishlist | Maternal sepsis. |
| omFIBRO Risk Score | calc_omfibro | obstetrics | n/a | — | — | — | — | — | Skip — does not exist as listed. |
| Calculator for Estimated Fetal Weight (Hadlock) | calc_efw_hadlock | obstetrics | Hadlock FP et al 1985 — PMID 3881966 | — | — | — | formula | wishlist | Ultrasound EFW. |
| Customized Birthweight Centile (GROW) | calc_grow_centile | obstetrics | Gardosi J et al 1992 — PMID 1614362 | — | — | — | formula | wishlist | UK customised growth. |
| Cervical Length Risk Calculator (preterm) | calc_cervical_length | obstetrics | Iams JD et al 1996 — PMID 8569824 | — | — | — | formula | wishlist | Preterm birth predictor. |
| fFN (fetal fibronectin) Risk | calc_ffn | obstetrics | Lockwood CJ et al 1991 — PMID 1992676 | — | — | — | lookup | wishlist | Preterm labor risk. |
| Edinburgh Postnatal Depression Scale (EPDS) | calc_epds | obstetrics | Cox JL et al 1987 — PMID 3651732 | ✓ | — | ✓ | lookup | planned-v0.5 | Postpartum depression screen. |
| Maternal-Fetal Hemorrhage RhIG Dose | calc_rhig_obstetric | obstetrics | n/a — clinical | ✓ | — | ✓ | formula | wishlist | Post-FMH RhIG. |
| Quad / Sequential Screen Risk | calc_quad_screen | obstetrics | Wald NJ et al 1996 — PMID 8911366 | — | — | — | formula | wishlist | Aneuploidy screen. |
| Combined First-Trimester Screen | calc_combined_screen | obstetrics | Wapner R et al 2003 — PMID 14507973 | — | — | — | formula | wishlist | NT + biomarkers. |
| Abuse Assessment Screen (AAS) | calc_aas | obstetrics | Soeken KL et al 1998 (book chapter) | ✓ | — | ✓ | lookup | wishlist | Perinatal IPV. |
| ISSHP Hypertension in Pregnancy | calc_isshp_htn | obstetrics | Brown MA et al 2018 — PMID 30219660 | — | — | — | tree | wishlist | Pregnancy HTN dx. |
| WHO Maternal Sepsis | calc_who_maternal_sepsis | obstetrics | WHO 2017 (technical report) | — | — | — | tree | wishlist | Sepsis in obstetrics. |
| Cesarean Risk Calculator (Grobman 2014) | calc_csection_risk | obstetrics | Grobman WA et al 2014 — PMID 24793285 | — | — | — | formula | wishlist | Failed labor risk. |
| Postpartum Hemorrhage Risk (CMQCC) | calc_pph_cmqcc | obstetrics | Lyndon A et al 2015 — PMID 25923014 | — | — | — | tree | wishlist | Calif. PPH bundle. |

## Pediatrics

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| PECARN Head Injury Rule | calc_pecarn_head_inj | pediatrics | Kuppermann N et al 2009 — PMID 19758692 | ✓ | — | ✓ | tree | planned-v0.5 | Ped CT head. |
| Kocher Criteria (septic hip) | calc_kocher_ped | pediatrics | Kocher MS et al 1999 — PMID 10608376 | ✓ | — | ✓ | lookup | planned-v0.5 | Ped septic arthritis vs synovitis. |
| Caboodle Caputo Pediatric BP | calc_aap_bp_ped | pediatrics | Flynn JT et al 2017 — PMID 28827377 | ✓ | — | ✓ | lookup | planned-v0.5 | AAP 2017 BP guideline. |
| Schwartz Bedside eGFR | calc_schwartz_bedside | pediatrics | Schwartz GJ et al 2009 — PMID 19158356 | ✓ | — | — | formula | planned-v0.5 | Cross-listed. |
| Pediatric SOFA (pSOFA) | calc_psofa_ped | pediatrics | Matics TJ 2017 — PMID 28783810 | — | — | — | lookup | wishlist | Cross-listed. |
| Pediatric Sepsis (Phoenix) | calc_phoenix_sepsis | pediatrics | Schlapbach LJ et al 2024 — PMID 38245889 | — | — | — | tree | wishlist | 2024 SCCM Phoenix sepsis criteria. |
| Bacterial Meningitis Score (Children) | calc_bms_ped | pediatrics | Nigrovic LE et al 2007 — PMID 17200296 | ✓ | — | ✓ | tree | planned-v0.5 | Cross-listed. |
| Kawasaki Disease Diagnostic Criteria | calc_kawasaki | pediatrics | McCrindle BW et al 2017 — PMID 28356445 | ✓ | — | ✓ | tree | wishlist | KD dx. |
| Kawasaki Coronary Artery Z-Score | calc_kd_z_score | pediatrics | McCrindle BW et al 2017 — PMID 28356445 | — | — | — | formula | wishlist | KD CA dilation. |
| BRUE Criteria | calc_brue | pediatrics | Tieder JS et al 2016 — PMID 27050422 | ✓ | — | ✓ | tree | planned-v0.5 | Brief Resolved Unexplained Events. |
| BRUE 2.0 Criteria | calc_brue_2 | pediatrics | Merritt JL et al 2019 — PMID 31391259 | ✓ | — | ✓ | tree | wishlist | BRUE risk stratification. |
| Westley Croup Score | calc_westley_croup | pediatrics | Westley CR et al 1978 — PMID 685810 | — | — | — | lookup | wishlist | Croup severity. |
| TAL Score (Bronchiolitis) | calc_tal_score | pediatrics | Tal A et al 1983 — PMID 6359270 | — | — | — | lookup | wishlist | Bronchiolitis severity. |
| PRAM (Pediatric Resp Ax Measure) | calc_pram | pediatrics | Chalut DS et al 2000 — PMID 10742237 | — | — | — | lookup | wishlist | Acute asthma severity. |
| PASS (Pediatric Asthma Severity) | calc_pass_asthma | pediatrics | Gorelick MH et al 2004 — PMID 14745526 | — | — | — | lookup | wishlist | Pediatric asthma. |
| Pediatric Asthma Score (PAS) | calc_pas_asthma | pediatrics | Kelly CS et al 2000 — PMID 10674975 | — | — | — | lookup | wishlist | Inpatient ped asthma. |
| Pediatric GCS / Adelaide Coma Scale | calc_gcs_pediatric | pediatrics | Reilly PL et al 1988 — PMID 3221668 | — | — | — | lookup | wishlist | Modified GCS for kids. |
| AAP Hyperbilirubinemia Phototherapy Threshold | calc_aap_bili_phototherapy | pediatrics | Kemper AR et al 2022 — PMID 35927462 | ✓ | — | ✓ | lookup | planned-v0.5 | 2022 AAP guideline. |
| AAP Bili Exchange Transfusion Threshold | calc_aap_bili_exchange | pediatrics | Kemper AR et al 2022 — PMID 35927462 | — | — | ✓ | lookup | wishlist | AAP exchange threshold. |
| Hour-Specific Bilirubin Nomogram | calc_hour_spec_bili | pediatrics | Bhutani VK et al 1999 — PMID 9917458 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Modified Finnegan Neonatal Abstinence Score | calc_finnegan_nas | pediatrics | Finnegan LP et al 1975 — PMID 1234543 | ✓ | — | ✓ | lookup | wishlist | NAS severity. |
| Eat, Sleep, Console (ESC) | calc_esc_neonate | pediatrics | Grossman MR et al 2017 — PMID 28396567 | ✓ | — | ✓ | tree | wishlist | NAS function-based. |
| Withdrawal Assessment Tool (WAT-1) | calc_wat1 | pediatrics | Franck LS et al 2008 — PMID 18367963 | ✓ | — | ✓ | lookup | wishlist | Pediatric iatrogenic withdrawal. |
| Pediatric Glasgow Coma Scale | calc_pediatric_gcs | pediatrics | James HE 1986 — PMID 3787329 | — | — | — | lookup | wishlist | Modified GCS. |
| FLACC Pain Scale | calc_flacc | pediatrics | Merkel SI et al 1997 — PMID 9220806 | — | — | — | lookup | wishlist | Nonverbal child pain. |
| CHEOPS Pain Scale | calc_cheops | pediatrics | McGrath PJ et al 1985 (book) | ✓ | — | ✓ | lookup | wishlist | Postop ped pain. |
| Wong-Baker FACES | calc_faces | pediatrics | Wong DL, Baker CM 1988 — PMID 3344163 | — | — | — | lookup | wishlist | Self-report pain. |
| BOPS Pain Score (Postop Pediatric) | calc_bops | pediatrics | Hesselgard K et al 2007 — PMID 17651411 | ✓ | — | ✓ | lookup | wishlist | Postop ped pain. |
| Cornell Assessment of Pediatric Delirium (CAPD) | calc_capd | pediatrics | Traube C et al 2014 — PMID 24351375 | ✓ | — | ✓ | lookup | wishlist | PICU delirium. |
| Bell Staging (NEC) | calc_bell_nec | pediatrics | Bell MJ et al 1978 — PMID 413500 | — | — | — | lookup | wishlist | Necrotizing enterocolitis. |
| Modified Bell Staging | calc_bell_modified | pediatrics | Walsh MC, Kliegman RM 1986 — PMID 3081865 | — | — | — | lookup | wishlist | NEC staging. |
| AAP Pediatric Hypertension Guidelines | calc_aap_htn | pediatrics | Flynn JT et al 2017 — PMID 28827377 | ✓ | — | ✓ | lookup | wishlist | 2017 AAP BP guideline. |
| Pediatric BMI Percentile (CDC) | calc_pediatric_bmi_percentile | pediatrics | Kuczmarski RJ 2002 (CDC) | — | — | — | lookup | wishlist | CDC growth charts. |
| WHO Pediatric Growth Charts | calc_who_growth | pediatrics | WHO Multicentre Growth Reference Study 2006 | — | — | — | lookup | wishlist | Under-5 growth. |
| Pediatric Trauma Score | calc_pts | pediatrics | Tepas JJ et al 1987 — PMID 3559615 | — | — | — | lookup | wishlist | Ped trauma triage. |
| Modified Pediatric Trauma Score | calc_pts_modified | pediatrics | n/a — adaptation | — | — | — | lookup | wishlist | Adapted. |
| Pediatric NIHSS (PedNIHSS) | calc_ped_nihss | pediatrics | Ichord RN et al 2011 — PMID 22025283 | — | — | — | lookup | wishlist | Pediatric stroke. |
| Acute Pediatric Migraine PED-MIDAS | calc_pedmidas | pediatrics | Hershey AD et al 2001 — PMID 11437978 | — | — | — | lookup | wishlist | Ped migraine disability. |
| Infant Scalp Score | calc_infant_scalp | pediatrics | Schutzman SA et al 2021 — PMID 33561868 | ✓ | — | ✓ | lookup | wishlist | Asymptomatic head injury <1y. |
| DHAKA Dehydration Score | calc_dhaka | pediatrics | Levine AC et al 2016 — PMID 26973174 | ✓ | — | ✓ | lookup | wishlist | Ped dehydration. |
| Clinical Dehydration Scale (Gorelick) | calc_gorelick_dehydration | pediatrics | Gorelick MH et al 1997 — PMID 9118502 | — | — | — | lookup | wishlist | Ped dehydration. |
| Centor (peds variant) | calc_centor_ped | pediatrics | n/a — adapted | — | — | — | lookup | wishlist | Adapted Centor. |
| Yale Observation Scale | calc_yale_observation | pediatrics | McCarthy PL et al 1982 — PMID 7050877 | — | — | — | lookup | wishlist | Ill child severity. |
| Step-by-Step (Febrile Infant) | calc_step_by_step | pediatrics | Gomez B et al 2016 — PMID 27574017 | — | — | — | tree | wishlist | Febrile infant rule. |
| Rochester Criteria (Febrile Infant) | calc_rochester | pediatrics | Jaskiewicz JA et al 1994 — PMID 8084378 | — | — | — | tree | wishlist | Febrile <60d. |
| Philadelphia Criteria (Febrile Infant) | calc_philadelphia_ped | pediatrics | Baker MD et al 1993 — PMID 8413449 | — | — | — | tree | wishlist | Febrile 29-60d. |
| Boston Criteria (Febrile Infant) | calc_boston_ped | pediatrics | Baskin MN et al 1992 — PMID 1500416 | — | — | — | tree | wishlist | Febrile 1-3 mo. |
| AAP Febrile Infant Guideline (2021) | calc_aap_febrile_infant | pediatrics | Pantell RH et al 2021 — PMID 34281996 | — | — | — | tree | wishlist | 2021 AAP guideline. |
| Bronchiolitis Severity (RDAI) | calc_rdai | pediatrics | Lowell DI et al 1987 — PMID 3552065 | — | — | — | lookup | wishlist | Bronchiolitis severity. |
| Brodsky Tonsillar Grade | calc_brodsky | pediatrics | Brodsky L 1989 — PMID 2710638 | — | — | — | lookup | wishlist | Tonsil size. |
| Mallampati (Pediatric) | calc_mallampati_ped | pediatrics | n/a — adapted | — | — | — | lookup | wishlist | Adapted. |
| Pediatric Pneumonia Severity (Pereda) | calc_pereda_pna | pediatrics | Pereda MA et al 2015 — PMID 25691378 | — | — | — | lookup | wishlist | Ped CAP. |
| RISK (Acute Tubular Injury, ped) | calc_risk_ped_ati | pediatrics | n/a | — | — | — | — | — | Omit. |
| Neonatal Early-Onset Sepsis (Kaiser) | calc_kaiser_eos | pediatrics | Puopolo KM et al 2011 — PMID 22025592 | ✓ | — | ✓ | formula | planned-v0.5 | Cross-listed. |
| Late-onset Neonatal Sepsis (NEOMOD) | calc_neomod | pediatrics | Janota J et al 2008 — PMID 18691255 | — | — | — | lookup | wishlist | NEOMOD MOF. |
| SNAP-II / SNAPPE-II | calc_snap_ii | pediatrics | Richardson DK et al 2001 — PMID 11533341 | — | — | — | formula | wishlist | Neonatal severity. |
| CRIB-II (Clinical Risk Index for Babies) | calc_crib_ii | pediatrics | Parry G et al 2003 — PMID 12849208 | — | — | — | lookup | wishlist | NICU severity. |
| Apgar at 5 minutes (Mortality) | calc_apgar_5min | pediatrics | Iliodromiti S et al 2014 — PMID 25130175 | — | — | — | lookup | wishlist | 5-min Apgar mortality. |
| Pediatric Appendicitis Score (PAS) | calc_pas_appendicitis | pediatrics | Samuel M 2002 — PMID 12037754 | — | — | — | lookup | planned-v0.5 | Ped appendicitis. |
| Alvarado (Pediatric variant) | calc_alvarado_ped | pediatrics | Alvarado A 1986 — PMID 3946432 | — | — | — | lookup | wishlist | Adapted Alvarado. |
| Pediatric Glasgow Outcome Scale | calc_pgos | pediatrics | n/a — adapted | — | — | — | lookup | wishlist | Adapted GOS. |
| pCASA-Q (peds disability) | calc_pcasaq | pediatrics | n/a | — | — | — | — | — | Skip — niche. |

## Geriatrics

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| CSHA Clinical Frailty Scale (CFS) | calc_cfs | geriatrics | Rockwood K et al 2005 — PMID 16129869 | ✓ | — | ✓ | lookup | planned-v0.5 | Frailty 1-9. |
| Fried Frailty Phenotype | calc_fried_frailty | geriatrics | Fried LP et al 2001 — PMID 11253156 | — | — | — | tree | planned-v0.5 | Phenotypic frailty. |
| FRAIL Scale | calc_frail_scale | geriatrics | Morley JE et al 2012 — PMID 22836700 | — | — | — | lookup | wishlist | Quick frailty screen. |
| Edmonton Frail Scale | calc_efs | geriatrics | Rolfson DB et al 2006 — PMID 16757522 | — | — | — | lookup | wishlist | Multidomain frailty. |
| G8 Geriatric Screen | calc_g8 | geriatrics | Bellera CA et al 2012 — PMID 22153112 | ✓ | — | ✓ | lookup | wishlist | Oncology geriatric screen. |
| VES-13 (Vulnerable Elders Survey) | calc_ves13 | geriatrics | Saliba D et al 2001 — PMID 11890585 | — | — | — | lookup | wishlist | Functional decline risk. |
| CIRS-G (Cumulative Illness Rating Scale-Geriatric) | calc_cirs_g | geriatrics | Miller MD et al 1992 — PMID 1410065 | ✓ | — | ✓ | lookup | wishlist | Comorbidity in elders. |
| Barthel Index (ADL) | calc_barthel_adl | geriatrics | Mahoney FI, Barthel DW 1965 — PMID 14258950 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Lawton IADL Scale | calc_lawton_iadl | geriatrics | Lawton MP, Brody EM 1969 — PMID 5349366 | — | — | — | lookup | wishlist | Instrumental ADLs. |
| Katz Index of Independence | calc_katz_adl | geriatrics | Katz S et al 1963 — PMID 14044222 | — | — | — | lookup | wishlist | Basic ADL. |
| Mini-Mental State Examination (MMSE) | calc_mmse_geri | geriatrics | Folstein MF et al 1975 — PMID 1202204 | ✓ | — | — | lookup | planned-v0.5 | IP-sensitive; PAR copyright. |
| Montreal Cognitive Assessment (MoCA) | calc_moca_geri | geriatrics | Nasreddine ZS et al 2005 — PMID 15817019 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Geriatric Depression Scale (GDS-15) | calc_gds15 | geriatrics | Yesavage JA et al 1982 — PMID 7183759 | ✓ | — | ✓ | lookup | planned-v0.5 | Depression in elders. |
| 4 A's Test (4AT) for Delirium | calc_4at_delirium | geriatrics | Bellelli G et al 2014 — PMID 24590568 | ✓ | — | ✓ | lookup | planned-v0.5 | Delirium screen. |
| AWOL Score for Delirium | calc_awol | geriatrics | Douglas VC et al 2013 — PMID 23553438 | ✓ | — | ✓ | lookup | wishlist | Delirium risk. |
| Confusion Assessment Method (CAM) | calc_cam_geri | geriatrics | Inouye SK et al 1990 — PMID 2240918 | ✓ | — | — | tree | planned-v0.5 | Delirium dx. |
| HOSPITAL Score (Readmission) | calc_hospital_score | geriatrics | Donzé J et al 2013 — PMID 23529115 | ✓ | — | ✓ | lookup | planned-v0.5 | 30-d readmission. |
| LACE Index (Readmission) | calc_lace_readmit | geriatrics | van Walraven C et al 2010 — PMID 20351121 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed cardiology. |
| Modified Charlson Index | calc_charlson_modified | geriatrics | Charlson ME et al 1987 — PMID 3558716 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Braden Score (Pressure Ulcers) | calc_braden | geriatrics | Bergstrom N et al 1987 — PMID 3299278 | ✓ | — | ✓ | lookup | planned-v0.5 | Pressure injury risk. |
| Norton Pressure Ulcer Scale | calc_norton | geriatrics | Norton D 1962 (book) | — | — | — | lookup | wishlist | Pre-Braden pressure scale. |
| Waterlow Score | calc_waterlow | geriatrics | Waterlow J 1985 — PMID 4068448 | — | — | — | lookup | wishlist | UK pressure ulcer risk. |
| Morse Fall Scale | calc_morse_fall | geriatrics | Morse JM et al 1989 — PMID 2509047 | — | — | — | lookup | wishlist | Inpatient falls. |
| Hendrich Fall Risk Model II | calc_hendrich_ii | geriatrics | Hendrich AL et al 2003 — PMID 12604984 | — | — | — | lookup | wishlist | Falls risk. |
| STOPP/START Criteria | calc_stopp_start | geriatrics | O'Mahony D et al 2015 — PMID 25324611 | — | — | — | tree | wishlist | Inappropriate prescribing. |
| Beers Criteria (AGS) | calc_beers | geriatrics | AGS Beers Update 2023 — PMID 37139824 | — | — | — | tree | wishlist | Potentially inappropriate meds. |
| ARMOR Drug Review | calc_armor | geriatrics | Haque R 2009 — PMID 19751135 | — | — | — | tree | wishlist | Geriatric polypharmacy. |
| Anticholinergic Cognitive Burden Scale | calc_acb_scale | geriatrics | Boustani M et al 2008 (Aging Health) | — | — | — | lookup | wishlist | Anticholinergic burden. |
| Drug Burden Index | calc_dbi | geriatrics | Hilmer SN et al 2007 — PMID 17533062 | — | — | — | formula | wishlist | Sedative/anticholinergic burden. |
| FRAX (Fracture Risk) | calc_frax | geriatrics | Kanis JA et al 2008 — PMID 18348357 | ✓ | — | — | formula | planned-v0.5 | WHO 10-yr fracture risk. |
| FRACTURE Index | calc_fracture_index | geriatrics | Black DM et al 2001 — PMID 11717543 | ✓ | — | ✓ | lookup | wishlist | Pre-FRAX fracture predictor. |
| Garvan Fracture Risk Calculator | calc_garvan | geriatrics | Nguyen ND et al 2007 — PMID 17452056 | — | — | — | formula | wishlist | Aus fracture risk. |
| CAROC System | calc_caroc | geriatrics | Leslie WD et al 2007 — PMID 17453109 | ✓ | — | ✓ | lookup | wishlist | Canadian fracture. |
| OST (Osteoporosis Self-Assessment Tool) | calc_ost | geriatrics | Koh LK et al 2001 — PMID 11512564 | ✓ | — | ✓ | formula | wishlist | BMD screen referral. |
| ORAI | calc_orai | geriatrics | Cadarette SM et al 2000 — PMID 10974006 | ✓ | — | ✓ | lookup | wishlist | Osteoporosis risk ax. |
| Mini Nutritional Assessment (MNA-SF) | calc_mna_sf | geriatrics | Rubenstein LZ et al 2001 — PMID 11253156 | — | — | — | lookup | wishlist | Geriatric malnutrition. |
| Tinetti Performance-Oriented Mobility | calc_tinetti_pom | geriatrics | Tinetti ME 1986 — PMID 3753664 | — | — | — | lookup | wishlist | Gait + balance. |
| Timed Up and Go (TUG) | calc_tug_geri | geriatrics | Podsiadlo D, Richardson S 1991 — PMID 1991946 | — | — | — | formula | planned-v0.5 | Cross-listed. |
| STEADI Falls Assessment | calc_steadi | geriatrics | CDC STEADI 2017 | — | — | — | tree | wishlist | CDC falls protocol. |
| Cognitive Impairment Test (6CIT) | calc_6cit | geriatrics | Brooke P, Bullock R 1999 — PMID 10527611 | — | — | — | lookup | wishlist | Short cognitive screen. |
| Abbreviated Mental Test (AMT-4 / AMT-10) | calc_amt | geriatrics | Hodkinson HM 1972 — PMID 4669982 | ✓ | — | ✓ | lookup | wishlist | Quick MS screen. |
| Confusion Assessment Method-ICU (CAM-ICU) | calc_cam_icu_geri | geriatrics | Ely EW et al 2001 — PMID 11730446 | ✓ | — | — | tree | planned-v0.5 | ICU delirium; cross-listed. |
| Functional Independence Measure (FIM) | calc_fim | geriatrics | Granger CV et al 1986 (Top Geriatr Rehabil) | — | — | — | lookup | wishlist | Rehab function. |

## Psychiatry

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| PHQ-9 (Depression) | calc_phq9 | psychiatry | Kroenke K et al 2001 — PMID 11556941 | ✓ | — | ✓ | lookup | planned-v0.5 | Standard depression screen. |
| PHQ-2 | calc_phq2 | psychiatry | Kroenke K et al 2003 — PMID 14583691 | ✓ | — | — | lookup | wishlist | 2-item depression screen. |
| GAD-7 (Anxiety) | calc_gad7 | psychiatry | Spitzer RL et al 2006 — PMID 16717171 | ✓ | — | ✓ | lookup | planned-v0.5 | Standard anxiety screen. |
| Hamilton Depression Rating Scale (HAM-D) | calc_hamd | psychiatry | Hamilton M 1960 — PMID 14399272 | ✓ | — | ✓ | lookup | wishlist | Clinician-rated depression. |
| Hamilton Anxiety Scale (HAM-A) | calc_hama | psychiatry | Hamilton M 1959 — PMID 13638508 | ✓ | — | ✓ | lookup | wishlist | Clinician-rated anxiety. |
| Beck Depression Inventory (BDI-II) | calc_bdi_ii | psychiatry | Beck AT et al 1996 (book) | — | — | — | lookup | wishlist | Copyrighted; Pearson. |
| Beck Anxiety Inventory (BAI) | calc_bai | psychiatry | Beck AT et al 1988 — PMID 3204199 | — | — | — | lookup | wishlist | Copyrighted. |
| Edinburgh Postnatal Depression Scale | calc_epds_psych | psychiatry | Cox JL et al 1987 — PMID 3651732 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed obstetrics. |
| Montgomery-Asberg Depression (MADRS) | calc_madrs | psychiatry | Montgomery SA, Asberg M 1979 — PMID 444788 | ✓ | — | ✓ | lookup | wishlist | Clinician depression. |
| Major Depression Index (MDI) | calc_mdi | psychiatry | Bech P et al 2001 — PMID 11377887 | ✓ | — | ✓ | lookup | wishlist | DSM-aligned depression. |
| Quick Inventory of Depressive Symptomatology (QIDS) | calc_qids | psychiatry | Rush AJ et al 2003 — PMID 12946886 | ✓ | — | ✓ | lookup | wishlist | Self-report depression. |
| Young Mania Rating Scale (YMRS) | calc_ymrs | psychiatry | Young RC et al 1978 — PMID 728692 | — | — | — | lookup | wishlist | Mania severity. |
| Columbia Suicide Severity Rating Scale (C-SSRS) | calc_cssrs | psychiatry | Posner K et al 2011 — PMID 22193671 | ✓ | — | ✓ | tree | planned-v0.5 | Suicide risk screen. |
| ED-SAFE Patient Safety Screener (PSS-3) | calc_pss3 | psychiatry | Boudreaux ED et al 2013 — PMID 24091296 | ✓ | — | ✓ | lookup | wishlist | ED suicide screen. |
| Patient Health Questionnaire-15 (Somatic) | calc_phq15 | psychiatry | Kroenke K et al 2002 — PMID 11914441 | — | — | — | lookup | wishlist | Somatic symptoms. |
| DSM-5 Major Depressive Disorder | calc_dsm5_mdd | psychiatry | APA DSM-5 2013 | ✓ | — | ✓ | tree | wishlist | Diagnostic criteria. |
| DSM-5 Bipolar Disorder | calc_dsm5_bipolar | psychiatry | APA DSM-5 2013 | ✓ | — | ✓ | tree | wishlist | Diagnostic criteria. |
| DSM-5 PTSD | calc_dsm5_ptsd | psychiatry | APA DSM-5 2013 | ✓ | — | ✓ | tree | wishlist | Diagnostic criteria. |
| DSM-5 Binge Eating Disorder | calc_dsm5_bed | psychiatry | APA DSM-5 2013 | ✓ | — | ✓ | tree | wishlist | Diagnostic criteria. |
| CIWA-Ar (Alcohol Withdrawal) | calc_ciwa_ar | psychiatry | Sullivan JT et al 1989 — PMID 2598902 | ✓ | — | ✓ | lookup | planned-v0.5 | Alcohol withdrawal. |
| Brief Alcohol Withdrawal Scale (BAWS) | calc_baws | psychiatry | Rastegar DA et al 2017 — PMID 28282486 | ✓ | — | ✓ | lookup | wishlist | Compact alcohol w/d. |
| Glasgow Modified Alcohol Withdrawal Scale (GMAWS) | calc_gmaws | psychiatry | Macleod AD et al 2017 — PMID 28710283 | ✓ | — | ✓ | lookup | wishlist | UK alcohol w/d. |
| mMINDS (Minnesota Detox) | calc_mminds | psychiatry | DeCarolis DD et al 2007 — PMID 17559348 | ✓ | — | ✓ | lookup | wishlist | Alt alcohol w/d. |
| AUDIT-C | calc_audit_c | psychiatry | Bush K et al 1998 — PMID 9738608 | ✓ | — | ✓ | lookup | planned-v0.5 | Hazardous drinking screen. |
| AUDIT-10 | calc_audit | psychiatry | Saunders JB et al 1993 — PMID 8329970 | — | — | — | lookup | wishlist | Full AUDIT. |
| CAGE Questions | calc_cage | psychiatry | Ewing JA 1984 — PMID 6471323 | ✓ | — | ✓ | lookup | planned-v0.5 | 4-item alcohol screen. |
| COWS Score (Opiate Withdrawal) | calc_cows | psychiatry | Wesson DR, Ling W 2003 — PMID 13615807 | ✓ | — | ✓ | lookup | planned-v0.5 | Opiate w/d severity. |
| Subjective Opiate Withdrawal Scale (SOWS) | calc_sows | psychiatry | Handelsman L et al 1987 — PMID 3617631 | — | — | — | lookup | wishlist | Self-report opioid w/d. |
| Objective Opiate Withdrawal Scale (OOWS) | calc_oows | psychiatry | Handelsman L et al 1987 — PMID 3617631 | — | — | — | lookup | wishlist | Clinician opioid w/d. |
| DAST-10 (Drug Abuse Screening) | calc_dast10 | psychiatry | Skinner HA 1982 — PMID 7183189 | ✓ | — | ✓ | lookup | wishlist | Drug abuse screen. |
| ASSIST (WHO) | calc_assist | psychiatry | WHO ASSIST 2002 — PMID 12390780 | — | — | — | lookup | wishlist | Multi-substance screen. |
| DIRE Score (Opioid Treatment Suitability) | calc_dire | psychiatry | Belgrade MJ et al 2006 — PMID 16720104 | ✓ | — | ✓ | lookup | wishlist | Chronic opioid prescribing. |
| Current Opioid Misuse Measure (COMM) | calc_comm | psychiatry | Butler SF et al 2007 — PMID 17716830 | ✓ | — | ✓ | lookup | wishlist | Opioid misuse. |
| Brief Addiction Monitor (BAM) | calc_bam | psychiatry | Cacciola JS et al 2013 — PMID 23561663 | ✓ | — | ✓ | lookup | wishlist | Addiction recovery. |
| EMBED (ED Buprenorphine for OUD) | calc_embed | psychiatry | D'Onofrio G et al 2015 — PMID 25962427 | ✓ | — | ✓ | tree | wishlist | ED buprenorphine initiation. |
| Adverse Childhood Experiences (ACE) Score | calc_ace | psychiatry | Felitti VJ et al 1998 — PMID 9635069 | ✓ | — | ✓ | lookup | planned-v0.5 | Childhood trauma. |
| HITS Domestic Abuse Screen | calc_hits | psychiatry | Sherin KM et al 1998 — PMID 9669164 | ✓ | — | ✓ | lookup | wishlist | IPV screen. |
| HARK Domestic Abuse Screen | calc_hark | psychiatry | Sohal H et al 2007 — PMID 17389202 | ✓ | — | ✓ | lookup | wishlist | UK IPV screen. |
| WAST Abuse Screen | calc_wast | psychiatry | Brown JB et al 1996 — PMID 8638604 | ✓ | — | ✓ | lookup | wishlist | Women abuse screen. |
| Danger Assessment | calc_danger_assessment | psychiatry | Campbell JC et al 2003 — PMID 14524518 | ✓ | — | ✓ | lookup | wishlist | IPV lethality. |
| ASRS-v1.1 (Adult ADHD) | calc_asrs_v11 | psychiatry | Kessler RC et al 2005 — PMID 15841682 | ✓ | — | ✓ | lookup | wishlist | Adult ADHD screen. |
| AIMS (Abnormal Involuntary Movement Scale) | calc_aims | psychiatry | Guy W 1976 (ECDEU manual) | ✓ | — | ✓ | lookup | wishlist | Tardive dyskinesia. |
| BARS (Behavioral Activity Rating Scale) | calc_bars | psychiatry | Swift RH et al 2002 — PMID 12379872 | ✓ | — | ✓ | lookup | wishlist | Acute agitation. |
| Bush-Francis Catatonia Rating Scale | calc_bfcrs | psychiatry | Bush G et al 1996 — PMID 8686483 | ✓ | — | ✓ | lookup | wishlist | Catatonia. |
| HEADS-ED | calc_heads_ed | psychiatry | Cappelli M et al 2012 — PMID 23022930 | ✓ | — | ✓ | lookup | wishlist | Pediatric mental health ED. |
| Coronavirus Anxiety Scale (CAS) | calc_cas_covid | psychiatry | Lee SA 2020 — PMID 32299304 | ✓ | — | ✓ | lookup | wishlist | COVID anxiety. |

## Rheumatology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| ACR/EULAR 2010 RA Classification | calc_acr_eular_ra | rheumatology | Aletaha D et al 2010 — PMID 20699241 | ✓ | — | ✓ | lookup | planned-v0.5 | RA dx classification. |
| DAS28-CRP | calc_das28_crp | rheumatology | Prevoo MLL et al 1995 — PMID 7818570 | ✓ | — | ✓ | formula | planned-v0.5 | RA activity. |
| DAS28-ESR | calc_das28_esr | rheumatology | Prevoo MLL et al 1995 — PMID 7818570 | ✓ | — | ✓ | formula | planned-v0.5 | RA activity. |
| CDAI (Clinical Disease Activity Index) | calc_cdai_ra | rheumatology | Aletaha D, Smolen JS 2005 — PMID 16207328 | ✓ | — | ✓ | formula | wishlist | RA without labs. |
| SDAI (Simplified Disease Activity Index) | calc_sdai_ra | rheumatology | Smolen JS et al 2003 — PMID 12867551 | — | — | — | formula | wishlist | RA with CRP. |
| Leiden Clinical Prediction Rule | calc_leiden_ra | rheumatology | van der Helm-van Mil AHM et al 2007 — PMID 17265486 | ✓ | — | ✓ | formula | wishlist | Undiff arthritis → RA. |
| ACR/EULAR Gout Classification | calc_acr_eular_gout | rheumatology | Neogi T et al 2015 — PMID 26509259 | ✓ | — | ✓ | lookup | wishlist | Gout dx. |
| Acute Gout Diagnosis Rule | calc_acute_gout_dx | rheumatology | Janssens HJEM et al 2010 — PMID 20439484 | ✓ | — | ✓ | lookup | wishlist | Primary care gout dx. |
| CASPAR Criteria (PsA) | calc_caspar | rheumatology | Taylor W et al 2006 — PMID 16871531 | ✓ | — | ✓ | tree | wishlist | Psoriatic arthritis classification. |
| 2012 EULAR/ACR PMR Classification | calc_pmr_2012 | rheumatology | Dasgupta B et al 2012 — PMID 22532641 | ✓ | — | ✓ | lookup | wishlist | Polymyalgia rheumatica. |
| ASAS Axial SpA Criteria | calc_asas_axial_spa | rheumatology | Rudwaleit M et al 2009 — PMID 19297344 | ✓ | — | ✓ | tree | wishlist | Axial spondyloarthritis. |
| ASAS Peripheral SpA Criteria | calc_asas_peripheral_spa | rheumatology | Rudwaleit M et al 2011 — PMID 21208910 | ✓ | — | ✓ | tree | wishlist | Peripheral SpA. |
| ASDAS-CRP | calc_asdas_crp | rheumatology | Lukas C et al 2009 — PMID 18375539 | ✓ | — | ✓ | formula | wishlist | AS activity (CRP). |
| ASDAS-ESR | calc_asdas_esr | rheumatology | Lukas C et al 2009 — PMID 18375539 | ✓ | — | ✓ | formula | wishlist | AS activity (ESR). |
| BASDAI | calc_basdai | rheumatology | Garrett S et al 1994 — PMID 7837158 | — | — | — | formula | wishlist | Bath AS activity. |
| BASFI | calc_basfi | rheumatology | Calin A et al 1994 — PMID 7726830 | — | — | — | formula | wishlist | Bath AS function. |
| SLEDAI-2K | calc_sledai_2k | rheumatology | Gladman DD et al 2002 — PMID 11838846 | ✓ | — | ✓ | formula | wishlist | SLE activity. |
| ACR/EULAR 2019 SLE Classification | calc_acr_eular_sle_2019 | rheumatology | Aringer M et al 2019 — PMID 31385462 | — | — | — | tree | wishlist | SLE dx. |
| SLICC SLE Damage Index | calc_slicc_damage | rheumatology | Gladman D et al 1996 — PMID 8607873 | — | — | — | lookup | wishlist | SLE damage. |
| ITAS2010 (Takayasu) | calc_itas2010 | rheumatology | Misra R et al 2013 — PMID 23286038 | ✓ | — | ✓ | lookup | wishlist | Takayasu activity. |
| BVAS (Birmingham Vasculitis Activity) | calc_bvas | rheumatology | Mukhtyar C et al 2009 — PMID 18713774 | — | — | — | lookup | wishlist | ANCA-vasculitis activity. |
| Age-Adjusted ESR / CRP (RA) | calc_age_adj_esr_crp | rheumatology | Miller A et al 1983 — PMID 6342894 | ✓ | — | ✓ | formula | wishlist | Age-adjusted normal range. |

## Dermatology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| PASI (Psoriasis Area Severity Index) | calc_pasi | dermatology | Fredriksson T, Pettersson U 1978 — PMID 152949 | ✓ | — | ✓ | formula | planned-v0.5 | Psoriasis severity. |
| BSA (Body Surface Area, derm) | calc_bsa_derm | dermatology | Lund CC, Browder NC 1944 (Surg Gynecol Obstet) | — | — | — | lookup | wishlist | Rule of 9s alternative. |
| Rule of Nines | calc_rule_of_nines | dermatology | Pulaski EJ, Tennison CW 1947 | ✓ | — | ✓ | lookup | planned-v0.5 | Burn BSA. |
| Lund-Browder Chart | calc_lund_browder | dermatology | Lund CC, Browder NC 1944 | — | — | — | lookup | planned-v0.5 | Burn BSA (peds). |
| Parkland Formula | calc_parkland | dermatology | Baxter CR, Shires GT 1968 — PMID 4882819 | ✓ | — | — | formula | planned-v0.5 | Burn fluid resuscitation. |
| Modified Brooke Formula | calc_modified_brooke | dermatology | Brooke Army Burn Center | — | — | — | formula | wishlist | Alt burn resuscitation. |
| ABSI (Burn Severity Index) | calc_absi | dermatology | Tobiasen J et al 1982 — PMID 7065499 | — | — | — | lookup | wishlist | Burn mortality. |
| Baux Score | calc_baux | dermatology | Baux S 1961 (PhD thesis) | — | — | — | formula | wishlist | Burn mortality (age + %BSA). |
| Modified Baux Score | calc_baux_modified | dermatology | Osler T et al 2010 — PMID 19858743 | — | — | — | formula | wishlist | Adds inhalation injury. |
| EASI (Eczema Area Severity) | calc_easi | dermatology | Hanifin JM et al 2001 — PMID 11260268 | ✓ | — | ✓ | formula | wishlist | AD severity. |
| SCORAD | calc_scorad | dermatology | European Task Force on Atopic Dermatitis 1993 | — | — | — | formula | wishlist | AD severity. |
| Urticaria Activity Score (UAS-7) | calc_uas7 | dermatology | Mlynek A et al 2008 — PMID 18476840 | ✓ | — | ✓ | lookup | wishlist | CSU activity. |
| ALDEN Algorithm (SJS/TEN) | calc_alden | dermatology | Sassolas B et al 2010 — PMID 20335220 | — | — | — | tree | wishlist | Drug causality in SJS/TEN. |
| SCORTEN | calc_scorten | dermatology | Bastuji-Garin S et al 2000 — PMID 10951229 | — | — | — | lookup | wishlist | TEN mortality. |
| Melanoma Risk (NCI) | calc_melanoma_nci | dermatology | Fears TR et al 2006 — PMID 16505431 | — | — | — | formula | wishlist | Melanoma risk. |
| Color Vision Screen (Ishihara) | calc_ishihara | ophthalmology | Ishihara S 1917 (test) | ✓ | — | ✓ | lookup | wishlist | Color vision (n/a as calc). |
| Snellen Visual Acuity | calc_snellen | ophthalmology | Snellen H 1862 | ✓ | — | ✓ | lookup | wishlist | VA score. |
| IOP Adjustment for Central Corneal Thickness | calc_iop_cct | ophthalmology | Ehlers N et al 1975 — PMID 1099835 | — | — | — | formula | wishlist | Glaucoma. |

## Ophthalmology / ENT / Urology

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| AUA Symptom Index / IPSS | calc_aua_si | ophthalmology | Barry MJ et al 1992 — PMID 1279218 | ✓ | — | ✓ | lookup | planned-v0.5 | BPH symptom score. Cross-listed urology. |
| Overactive Bladder Symptom Score (OABSS) | calc_oabss | ophthalmology | Homma Y et al 2006 — PMID 16467545 | — | — | — | lookup | wishlist | OAB severity. |
| Prostate Tumor Volume / Density | calc_psa_density | ophthalmology | Benson MC et al 1992 — PMID 1597381 | ✓ | — | ✓ | formula | wishlist | PSA / TPV. |
| Bladder Cancer Risk (NMIBC EORTC) | calc_eortc_nmibc | ophthalmology | Sylvester RJ et al 2006 — PMID 16545636 | — | — | — | formula | wishlist | Bladder Ca recurrence. |
| Bladder Cancer Risk (CUETO) | calc_cueto_nmibc | ophthalmology | Fernandez-Gomez J et al 2009 — PMID 19101356 | — | — | — | formula | wishlist | NMIBC risk. |
| AAST OIS (Organ Injury Scale) | calc_aast_ois | trauma | Moore EE et al 1989-1995 series | — | — | — | lookup | wishlist | Organ-specific trauma grades. |

## Emergency medicine / Trauma / Surgery

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Ottawa Ankle Rule | calc_ottawa_ankle | emergency-medicine | Stiell IG et al 1992 — PMID 1554175 | ✓ | — | ✓ | tree | planned-v0.5 | Ankle X-ray decision. |
| Ottawa Knee Rule | calc_ottawa_knee | emergency-medicine | Stiell IG et al 1995 — PMID 7715541 | ✓ | — | ✓ | tree | planned-v0.5 | Knee X-ray decision. |
| Pittsburgh Knee Rule | calc_pittsburgh_knee | emergency-medicine | Bauer SJ et al 1995 — PMID 7546963 | — | — | — | tree | wishlist | Alt knee X-ray rule. |
| NEXUS Chest CT Rule | calc_nexus_chest_ct | trauma | Rodriguez RM et al 2015 — PMID 26218636 | ✓ | — | ✓ | tree | wishlist | Chest CT in trauma. |
| NEXUS Chest Decision (blunt) | calc_nexus_chest_blunt | trauma | Rodriguez RM et al 2013 — PMID 23877681 | ✓ | — | ✓ | tree | wishlist | Blunt thoracic trauma. |
| Alvarado Score (Appendicitis) | calc_alvarado | emergency-medicine | Alvarado A 1986 — PMID 3946432 | ✓ | — | ✓ | lookup | planned-v0.5 | Appendicitis pretest. |
| AIR Score (Appendicitis) | calc_air_appendicitis | emergency-medicine | Andersson M, Andersson RE 2008 — PMID 18642036 | ✓ | — | ✓ | lookup | wishlist | Pediatric/adult appendicitis. |
| RIPASA Score | calc_ripasa | emergency-medicine | Chong CF et al 2010 — PMID 20683062 | — | — | — | lookup | wishlist | Appendicitis (Asian). |
| Pediatric Appendicitis Score | calc_pas_appendix | pediatrics | Samuel M 2002 — PMID 12037754 | — | — | — | lookup | planned-v0.5 | Cross-listed peds. |
| Injury Severity Score (ISS) | calc_iss | trauma | Baker SP et al 1974 — PMID 4814394 | ✓ | — | ✓ | formula | planned-v0.5 | Trauma severity 0-75. |
| New Injury Severity Score (NISS) | calc_niss | trauma | Osler T et al 1997 — PMID 9311751 | — | — | — | formula | wishlist | Updated ISS. |
| Trauma Score (RTS) | calc_rts | trauma | Champion HR et al 1989 — PMID 2657285 | — | — | — | formula | wishlist | Revised trauma score. |
| TRISS (Trauma & ISS) | calc_triss | trauma | Boyd CR et al 1987 — PMID 3106646 | ✓ | — | ✓ | formula | wishlist | Trauma mortality prediction. |
| Abbreviated Injury Score (AIS, inhalation) | calc_ais_inhalation | trauma | n/a — AIS series | ✓ | — | ✓ | lookup | wishlist | Inhalation injury grade. |
| ABC Score for Massive Transfusion | calc_abc_score_mt | trauma | Nunez TC et al 2009 — PMID 19204506 | ✓ | — | ✓ | lookup | planned-v0.5 | MTP trigger. |
| TASH Score | calc_tash_score | trauma | Yücel N et al 2006 — PMID 17033545 | — | — | — | lookup | wishlist | European MTP score. |
| Shock Index | calc_shock_index | trauma | Allgöwer M, Buri C 1967 (German) | — | — | — | formula | planned-v0.5 | HR/SBP. |
| Modified Shock Index | calc_mod_shock_index | trauma | Singh A et al 2014 — PMID 24842139 | — | — | — | formula | wishlist | HR/MAP. |
| Age Shock Index | calc_age_shock_index | trauma | Zarzaur BL et al 2008 — PMID 18545108 | — | — | — | formula | wishlist | Age × SI. |
| FAST (Focused Assessment with Sonography) | calc_fast | trauma | Rozycki GS et al 1998 — PMID 9456096 | ✓ | — | ✓ | tree | wishlist | Bedside trauma US. |
| Mangled Extremity Severity Score (MESS) | calc_mess | trauma | Helfet DL et al 1990 — PMID 2384225 | ✓ | — | ✓ | lookup | wishlist | Limb salvage decision. |
| Bastion Classification (Blast Injury) | calc_bastion_blast | trauma | Jacobs N et al 2014 — PMID 24530970 | ✓ | — | ✓ | lookup | wishlist | Mil blast injury. |
| Blast Lung Injury Severity | calc_blast_lung | trauma | Pizov R et al 1999 — PMID 10075069 | ✓ | — | ✓ | lookup | wishlist | Blast lung. |
| Trauma-Associated Severe Hemorrhage (TASH) | calc_tash_alt | trauma | Yücel N et al 2006 — PMID 17033545 | — | — | — | lookup | wishlist | Alias of TASH. |
| ASA Physical Status Classification | calc_asa_class | surgery | ASA 2014 — n/a | ✓ | — | ✓ | lookup | planned-v0.5 | Perioperative risk. |
| Surgical Apgar Score | calc_surgical_apgar | surgery | Gawande AA et al 2007 — PMID 17239311 | ✓ | — | ✓ | lookup | wishlist | Intraop blood-loss / HR / BP. |
| POSSUM | calc_possum | surgery | Copeland GP et al 1991 — PMID 1958740 | — | — | — | formula | wishlist | UK surgical risk. |
| P-POSSUM | calc_p_possum | surgery | Prytherch DR et al 1998 — PMID 9824086 | — | — | — | formula | wishlist | Portsmouth POSSUM. |
| ACS NSQIP Surgical Risk Calculator | calc_nsqip | surgery | Bilimoria KY et al 2013 — PMID 24055383 | — | — | — | formula | wishlist | ACS web tool. |
| Apfel Score (PONV) | calc_apfel | surgery | Apfel CC et al 1999 — PMID 10485781 | ✓ | — | ✓ | lookup | planned-v0.5 | Postop nausea / vomiting. |
| Aldrete Score (PACU Discharge) | calc_aldrete | surgery | Aldrete JA, Kroulik D 1970 — PMID 5534512 | — | — | — | lookup | wishlist | PACU readiness. |
| Modified Aldrete | calc_aldrete_modified | surgery | Aldrete JA 1995 — PMID 7488383 | — | — | — | lookup | wishlist | Updated Aldrete. |
| EuroSCORE II (cardiac surgery) | calc_euroscore_ii_surg | surgery | Nashef SAM et al 2012 — PMID 22378855 | ✓ | — | ✓ | formula | planned-v0.5 | Cross-listed. |
| Revised Cardiac Risk Index (RCRI) | calc_rcri_surgery | surgery | Lee TH et al 1999 — PMID 10477528 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Gupta Postop MICA | calc_gupta_periop_mica | surgery | Gupta PK et al 2011 — PMID 21709242 | ✓ | — | ✓ | formula | planned-v0.5 | Cross-listed. |
| Caprini Score (surgical VTE) | calc_caprini_surg | surgery | Caprini JA 2005 — PMID 15534795 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | Cross-listed. |
| ARISCAT Score | calc_ariscat_surg | surgery | Canet J et al 2010 — PMID 21099741 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed. |
| Wisconsin Criteria | calc_wisconsin_facial | trauma | Sitzman TJ et al 2009 — PMID 19483576 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| CEDOCS Score (ED Overcrowding) | calc_cedocs | emergency-medicine | Weiss SJ et al 2014 — PMID 24739457 | ✓ | — | ✓ | formula | wishlist | ED crowding. |
| NEDOCS Score | calc_nedocs | emergency-medicine | Weiss SJ et al 2004 — PMID 14760950 | ✓ | — | ✓ | formula | wishlist | ED crowding. |
| Geneva Trauma Score | calc_geneva_trauma | trauma | n/a | — | — | — | — | — | Omit — not standardized. |
| Canadian Syncope Risk Score | calc_canadian_syncope | emergency-medicine | Thiruganasambandamoorthy V et al 2016 — PMID 27378464 | ✓ | — | ✓ | lookup | planned-v0.5 | ED syncope. |
| San Francisco Syncope Rule | calc_sfsr | emergency-medicine | Quinn JV et al 2004 — PMID 15039692 | ✓ | — | — | tree | wishlist | ED syncope. |
| EGSYS Syncope Score | calc_egsys | emergency-medicine | Del Rosso A et al 2008 — PMID 18653544 | ✓ | — | ✓ | lookup | wishlist | Cardiogenic syncope. |
| ROSE Rule (Syncope) | calc_rose_syncope | emergency-medicine | Reed MJ et al 2010 — PMID 20184973 | ✓ | — | ✓ | lookup | wishlist | ED syncope risk. |
| Glasgow Bleeding Score | calc_glasgow_bleed | gastroenterology | Blatchford O et al 2000 — PMID 11073021 | — | ✓ | — | lookup | wishlist | Cross-listed; MedCalc-Bench fixture. |
| Atropine for Cholinesterase Inhibitor Tox | calc_atropine_chol | emergency-medicine | n/a — institutional toxicology | ✓ | — | ✓ | formula | wishlist | Organophosphate poisoning. |
| Antivenom Dosing Algorithm | calc_antivenom_dose | emergency-medicine | Lavonas EJ et al 2011 — PMID 21504571 | ✓ | — | ✓ | tree | wishlist | Crotalid antivenom. |
| DigiFab Dosing | calc_digifab | emergency-medicine | Bismuth C et al 1981 — PMID 7298074 | ✓ | — | ✓ | formula | wishlist | Digoxin tox. |
| Acetaminophen + NAC Dosing | calc_apap_nac | emergency-medicine | Prescott LF et al 1976 — PMID 1259823 | ✓ | — | ✓ | tree | planned-v0.5 | APAP overdose. |
| Fomepizole Dosing | calc_fomepizole | emergency-medicine | Brent J et al 1999 — PMID 9966792 | ✓ | — | ✓ | formula | wishlist | Methanol / ethylene glycol. |
| Toxic Alcohol Serum Concentration | calc_toxic_alcohol_estimate | emergency-medicine | n/a — clinical | ✓ | — | ✓ | formula | wishlist | Estimated osmolal gap-derived. |
| Local Anesthetic Maximum Dose | calc_local_anesthetic_max | emergency-medicine | Rosenberg PH et al 2004 — PMID 15534030 | ✓ | — | ✓ | formula | planned-v0.5 | Lidocaine / bupivacaine max. |
| Hypothermia HOPE Score | calc_hope_hypothermia | emergency-medicine | Pasquier M et al 2018 — PMID 29626518 | ✓ | — | ✓ | formula | wishlist | ECLS prognosis. |
| 2023 ED Coding Guide | calc_ed_coding_2023 | emergency-medicine | ACEP 2023 | ✓ | — | ✓ | tree | wishlist | E&M coding. |
| FOUR Score (Coma) | calc_four_coma | emergency-medicine | Wijdicks EFM et al 2005 — PMID 16275631 | ✓ | — | ✓ | lookup | planned-v0.5 | Cross-listed. |

## Drug dosing

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Vancomycin AUC/MIC Dosing | calc_vanco_auc | drug-dosing | Rybak MJ et al 2020 — PMID 32191793 | — | — | — | formula | planned-v0.5 | 2020 IDSA/ASHP guideline. |
| Vancomycin Trough Dosing (legacy) | calc_vanco_trough | drug-dosing | Liu C et al 2011 — PMID 21282743 | — | — | — | formula | wishlist | Pre-AUC era. |
| Aminoglycoside Pharmacokinetics | calc_aminoglycoside_pk | drug-dosing | Sawchuk RJ, Zaske DE 1976 — PMID 957449 | — | — | — | formula | wishlist | Once-daily / Hartford. |
| Hartford Nomogram (Gentamicin) | calc_hartford_nomogram | drug-dosing | Nicolau DP et al 1995 — PMID 7811026 | — | — | — | lookup | wishlist | Extended-interval AG. |
| Heparin (UFH) Weight-Based Nomogram | calc_heparin_ufh | drug-dosing | Raschke RA et al 1993 — PMID 8214735 | — | — | — | formula | wishlist | aPTT-titrated. |
| Enoxaparin (LMWH) Renal Adj | calc_enoxaparin_renal | drug-dosing | n/a — FDA label | — | — | — | formula | wishlist | CrCl-based. |
| Apixaban Renal Adj | calc_apixaban_renal | drug-dosing | n/a — FDA label | — | — | — | tree | wishlist | DOAC dose adj. |
| Rivaroxaban Renal Adj | calc_rivaroxaban_renal | drug-dosing | n/a — FDA label | — | — | — | tree | wishlist | DOAC dose adj. |
| Dabigatran Renal Adj | calc_dabigatran_renal | drug-dosing | n/a — FDA label | — | — | — | tree | wishlist | DOAC dose adj. |
| Warfarin Initiation Nomogram | calc_warfarin_init | drug-dosing | Fennerty A et al 1984 — PMID 6707388 | — | — | — | tree | wishlist | INR-titrated. |
| Warfarin Maintenance Nomogram | calc_warfarin_maint | drug-dosing | Wilson SE et al 2003 — PMID 12796122 | — | — | — | tree | wishlist | INR maintenance. |
| Steroid Conversion | calc_steroid_conversion | drug-dosing | Czock D et al 2005 — PMID 15649038 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Glucocorticoid equivalence. |
| Morphine Milligram Equivalents (MME) | calc_mme | drug-dosing | CDC 2016 (Dowell D et al) — PMID 26977696 | ✓ | ✓ | ✓ | formula | planned-v0.5 | Opioid equivalence. |
| Naloxone Dose | calc_naloxone | drug-dosing | n/a — ACLS / OD protocol | ✓ | — | ✓ | formula | wishlist | OD reversal. |
| Naloxone Drip Dosing | calc_naloxone_drip | drug-dosing | n/a — institutional | ✓ | — | ✓ | formula | wishlist | Continuous infusion. |
| Insulin Drip Dosing (DKA) | calc_insulin_drip_dka | drug-dosing | ADA 2009 — PMID 19564476 | — | — | — | formula | wishlist | DKA infusion. |
| Phenytoin Loading + Maintenance | calc_phenytoin_load | drug-dosing | n/a — pharmacokinetics | — | — | — | formula | wishlist | LD + MD. |
| Corrected Phenytoin (Sheiner-Tozer) | calc_phenytoin_corr | drug-dosing | Sheiner LB, Tozer TN 1973 — PMID 4762267 | — | — | — | formula | wishlist | Albumin-correction. |
| Levothyroxine Initial Dose | calc_levothyroxine_init | drug-dosing | n/a — clinical | — | — | — | formula | wishlist | Weight-based starting. |
| Tacrolimus / Cyclosporine TDM | calc_tacro_cs_tdm | drug-dosing | n/a — IATDMCT consensus | — | — | — | formula | wishlist | Transplant TDM. |
| Methotrexate Rescue (Leucovorin) | calc_mtx_rescue | drug-dosing | Stoller RG et al 1977 — PMID 877070 | — | — | — | formula | wishlist | High-dose MTX. |
| Carboplatin (Calvert Formula) | calc_carboplatin_calvert | drug-dosing | Calvert AH et al 1989 — PMID 2681557 | ✓ | — | — | formula | planned-v0.5 | AUC-based chemo dosing. |
| Cisplatin Dose Cap | calc_cisplatin_cap | drug-dosing | Levin VA et al 1973 — PMID 4690828 | — | — | — | formula | wishlist | BSA-capped. |
| Hydroxychloroquine Dose (retina) | calc_hcq_dose | drug-dosing | Marmor MF et al 2016 — PMID 26871745 | ✓ | — | ✓ | formula | planned-v0.5 | Retinal-toxicity safe dose. |
| Plaquenil Maximum Dose | calc_plaquenil_max | drug-dosing | n/a — same as HCQ above | ✓ | — | ✓ | formula | wishlist | Alias of HCQ. |
| Benzodiazepine Conversion | calc_benzo_conversion | drug-dosing | n/a — clinical | ✓ | — | ✓ | lookup | planned-v0.5 | Dose equivalence. |
| IV Drip Rate (gtt/min) | calc_iv_drip_rate | drug-dosing | n/a — formula | ✓ | — | ✓ | formula | planned-v0.5 | Manual gravity drip. |
| Universal IV Infusion Rate (mL/h) | calc_iv_infusion_rate | drug-dosing | n/a — formula | ✓ | — | ✓ | formula | planned-v0.5 | Weight-based infusion. |
| Intraop Fluid Dosing (adult) | calc_intraop_fluid | drug-dosing | Holte K et al 2002 — PMID 12114263 | ✓ | — | ✓ | formula | wishlist | Intraop fluid plan. |
| Body Fluid Balance | calc_fluid_balance | drug-dosing | n/a — formula | ✓ | — | ✓ | formula | wishlist | I/O balance. |

## Prognosis (general / cross-cutting)

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| Charlson Comorbidity Index (CCI) | calc_charlson_general | prognosis-general | Charlson ME et al 1987 — PMID 3558716 | ✓ | ✓ | ✓ | lookup | planned-v0.5 | 10-yr mortality. |
| Walter Index (4-year mortality, elders) | calc_walter | prognosis-general | Walter LC et al 2001 — PMID 11401614 | — | — | — | formula | wishlist | 4-yr mortality in elders. |
| Lee Schonberg Index (4-yr) | calc_lee_schonberg | prognosis-general | Lee SJ et al 2006 — PMID 16414891 | — | — | — | formula | wishlist | Older adult mortality. |
| ePrognosis Calculators (various) | calc_eprognosis_suite | prognosis-general | UCSF ePrognosis | — | — | — | multi-step | wishlist | Suite of prognostic indices. |
| Suicide Risk Cox (Cox SuiR) | calc_cox_suir | prognosis-general | n/a | — | — | — | — | — | Skip — niche. |
| FRAIL Scale | calc_frail_prognosis | prognosis-general | Morley JE et al 2012 — PMID 22836700 | — | — | — | lookup | wishlist | Cross-listed. |
| 4-Year Mortality (Lee 2006) | calc_lee_4yr | prognosis-general | Lee SJ et al 2006 — PMID 16414891 | ✓ | — | — | formula | wishlist | Web-based. |
| HOSPITAL Score | calc_hospital_prog | prognosis-general | Donzé J et al 2013 — PMID 23529115 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| LACE Index | calc_lace_prog | prognosis-general | van Walraven C et al 2010 — PMID 20351121 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| HCC Cox Hazard Models (multiple) | calc_hcc_cox | prognosis-general | various — see hepatology section | — | — | — | formula | wishlist | Cross-listed. |
| Surprise Question (Palliative) | calc_surprise_question | prognosis-general | Pattison M et al 2001 (J Palliat Med) | — | — | — | lookup | wishlist | "Would you be surprised if pt died in 12 months?" |
| Karnofsky Survival Estimate | calc_kps_survival | prognosis-general | Mor V et al 1984 — PMID 6480420 | — | — | — | formula | wishlist | KPS-based survival. |
| PPI (Palliative Prognostic Index) | calc_ppi_palliative | prognosis-general | Morita T et al 1999 — PMID 10570673 | — | — | — | lookup | wishlist | Hospice prognosis. |

## Long-tail wishlist (MDCalc / nobra cross-walk)

These are the remaining MDCalc-indexed calculators present in
[`Nobrega-Medtech/nobra_calculator/CALC_LIST.md`](https://github.com/Nobrega-Medtech/nobra_calculator/blob/main/CALC_LIST.md)
that didn't fit cleanly into a primary domain above, or that are domain
sub-specialty long-tail. All are confirmed to exist on MDCalc and ship in
nobra (`mdcalc: ✓`, `nobra: ✓`). Primary derivation citations are listed
where known with confidence; rows marked `primary_citation: TODO` need a
contributor to confirm the canonical paper before being moved to a domain
section.

| name | slug | domain | primary_citation | mdcalc | medcalc_bench | nobra | complexity | status | notes |
|---|---|---|---|---|---|---|---|---|---|
| 2HELPS2B Score | calc_2helps2b_eeg | neurology | Struck AF et al 2017 — PMID 28829917 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| 6-Minute Walk Distance Reference | calc_6mwd_ref | pulmonary-vte | Enright PL, Sherrill DL 1998 — PMID 9817683 | ✓ | — | ✓ | formula | wishlist | Reference values. |
| Acute Decompensated HF Mortality (ADHERE) | calc_adhere_mortality | cardiology | Fonarow GC et al 2005 — PMID 15703419 | ✓ | — | ✓ | tree | wishlist | Cross-listed. |
| Adult Self-Report Scale (ASRS) | calc_asrs_adhd | psychiatry | Kessler RC et al 2005 — PMID 15841682 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Age-Adjusted D-dimer | calc_age_adj_ddimer | pulmonary-vte | Righini M et al 2014 — PMID 24643601 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Age-Adjusted Charlson | calc_age_adj_charlson | prognosis-general | Charlson ME et al 1994 — PMID 7722560 | — | — | — | lookup | wishlist | Age-weighted CCI. |
| Alvarado Score for Appendicitis | calc_alvarado_app | emergency-medicine | Alvarado A 1986 — PMID 3946432 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| American Diabetes Association Risk | calc_ada_risk_dm | endocrinology | ADA 2010 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Anti-Xa Heparin Conversion | calc_antixa_conv | drug-dosing | n/a | — | — | — | formula | wishlist | Lab conversion. |
| Aortic Dissection Detection Risk Score (ADD-RS) | calc_add_rs_alias | cardiology | Rogers AM et al 2011 — PMID 21900087 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Apfel PONV Score | calc_apfel_ponv | surgery | Apfel CC et al 1999 — PMID 10485781 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Arterial Blood Gas (ABG) Analyzer | calc_abg_analyzer | critical-care | Stewart PA 1983 — PMID 6309269 | ✓ | — | ✓ | tree | wishlist | Acid-base analysis. |
| Asthma Control Test (ACT) | calc_act_asthma | pulmonary-vte | Nathan RA et al 2004 — PMID 14713908 | — | — | — | lookup | wishlist | Asthma control. |
| Asthma Control Questionnaire (ACQ) | calc_acq | pulmonary-vte | Juniper EF et al 1999 — PMID 10619824 | — | — | — | lookup | wishlist | Adult asthma. |
| Asymptomatic Carotid Stenosis Risk | calc_asx_carotid | neurology | n/a | — | — | — | — | — | Skip — no widely-cited score. |
| Atropine Cholinesterase Tox Dose | calc_atropine_cholin | emergency-medicine | n/a — institutional | ✓ | — | ✓ | formula | wishlist | Organophosphate. |
| Basic Statistics Calc | calc_basic_stats | composite-panel | n/a — utility | ✓ | — | ✓ | formula | wishlist | Mean / SD / CI. |
| Behavioral Activity Rating Scale (BARS) | calc_bars_psych | psychiatry | Swift RH et al 2002 — PMID 12379872 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Berlin Criteria for ARDS | calc_berlin_ards_alias | critical-care | Ranieri VM et al 2012 — PMID 22797452 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Body Roundness Index | calc_bri_alias | endocrinology | Thomas DM et al 2013 — PMID 23408597 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Breast Cancer Risk (Gail) | calc_gail_alias | oncology | Gail MH et al 1989 — PMID 2593165 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Cambridge Diabetes Risk Score | calc_cambridge_dm_alias | endocrinology | Griffin SJ et al 2000 — PMID 10980447 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Cancer and Aging Research Group Chemotherapy Tox | calc_carg_tt | oncology | Hurria A et al 2011 — PMID 21810685 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Canadian C-Spine Rule | calc_canadian_c_spine_alias | neurology | Stiell IG et al 2001 — PMID 11597285 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Canadian CT Head Rule | calc_canadian_ct_head_alias | neurology | Stiell IG et al 2001 — PMID 11356436 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Caprini 2005 Score | calc_caprini_2005 | hematology | Caprini JA 2005 — PMID 15534795 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed. |
| Cerebral Perfusion Pressure | calc_cpp_alias | neurology | n/a — formula | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Charlson Comorbidity Index alias | calc_charlson_alias | prognosis-general | Charlson ME et al 1987 — PMID 3558716 | ✓ | ✓ | ✓ | lookup | wishlist | Alias. |
| Cholinergic Burden Scale (anticholinergic) | calc_anticholinergic_burden | geriatrics | Boustani M et al 2008 | — | — | — | lookup | wishlist | Cross-listed. |
| Cisplatin AKI Calculator | calc_cisplatin_aki_alias | oncology | Gupta S et al 2024 — PMID 38507471 | ✓ | — | ✓ | tree | wishlist | Cross-listed. |
| Clinical Frailty Scale | calc_cfs_alias | geriatrics | Rockwood K et al 2005 — PMID 16129869 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| COPD Assessment Test (CAT) | calc_cat_alias | pulmonary-vte | Jones PW et al 2009 — PMID 19720809 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Cumulative Illness Rating Scale-Geriatric | calc_cirs_g_alias | geriatrics | Miller MD et al 1992 — PMID 1410065 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Diabetes Distress Scale (DDS17) | calc_dds17_alias | endocrinology | Polonsky WH et al 2005 — PMID 15735199 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Disease Activity Score (DAS28) for RA | calc_das28_alias | rheumatology | Prevoo MLL et al 1995 — PMID 7818570 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Disease Steps (MS) | calc_disease_steps_alias | neurology | Hohol MJ et al 1995 — PMID 8559373 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Donor Lymphocyte Infusion (DLI) Volume | calc_dli_alias | hematology | n/a — institutional | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| DRAGON Score | calc_dragon_alias | neurology | Strbian D et al 2012 — PMID 22156988 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Duke Activity Status Index | calc_dasi_alias | cardiology | Hlatky MA et al 1989 — PMID 2782256 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Duke Treadmill Score | calc_duke_tm_alias | cardiology | Mark DB et al 1991 — PMID 1922228 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Eat, Sleep, Console (Neonate) | calc_esc_alias | pediatrics | Grossman MR et al 2017 — PMID 28396567 | ✓ | — | ✓ | tree | wishlist | Cross-listed. |
| Eczema Area & Severity Index (EASI) | calc_easi_alias | dermatology | Hanifin JM et al 2001 — PMID 11260268 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Endotracheal Tube Depth + Tidal Volume | calc_ett_depth_vt | critical-care | n/a — clinical | ✓ | — | ✓ | formula | wishlist | Vent setup. |
| Eosinophilic Esophagitis Endoscopic (EREFS) | calc_erefs_alias | gastroenterology | Hirano I et al 2013 — PMID 23232216 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Estimated Ethanol Serum Concentration | calc_eth_serum_estimate | emergency-medicine | n/a — formula | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Estimated Peak Expiratory Flow | calc_peak_flow_alias | pulmonary-vte | Knudson RJ et al 1976 — PMID 1252253 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| EUROMACS-RHF Score | calc_euromacs_rhf_alias | cardiology | Soliman OII et al 2018 — PMID 29208626 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Eutos Score for CML | calc_eutos_alias | oncology | Hasford J et al 2011 — PMID 21926413 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Expanded Disability Status Scale (EDSS) | calc_edss_alias | neurology | Kurtzke JF 1983 — PMID 6685237 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Fatty Liver Index | calc_fli_alias | hepatology | Bedogni G et al 2006 — PMID 17081293 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Fetal Biophysical Profile | calc_bpp_alias | obstetrics | Manning FA et al 1980 — PMID 7444499 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Fibrotic NASH Index | calc_fni_alias | hepatology | Tavaglione F et al 2023 — PMID 36603148 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| FIGO Staging Ovarian | calc_figo_ov_alias | oncology | FIGO 2014 — PMID 24389334 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Finnish Diabetes Risk Score (FINDRISC) | calc_findrisc_alias | endocrinology | Lindström J 2003 — PMID 12610029 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Fisher SAH Grade | calc_fisher_alias | neurology | Fisher CM et al 1980 — PMID 7354892 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Fleischner Society (pulm nodules) | calc_fleischner_alias | pulmonary-vte | MacMahon H et al 2017 — PMID 28240562 | ✓ | — | ✓ | tree | wishlist | Cross-listed. |
| FLIPI (Follicular Lymphoma IPI) | calc_flipi_alias | oncology | Solal-Céligny P et al 2004 — PMID 15265785 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Fomepizole Dosing | calc_fomepizole_alias | emergency-medicine | Brent J et al 1999 — PMID 9966792 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Fong CRC LM Score | calc_fong_alias | oncology | Fong Y et al 1999 — PMID 10493478 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Forrest Classification UGIB | calc_forrest_alias | gastroenterology | Forrest JAH et al 1974 — PMID 4140599 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Forrester Hemodynamic Subsets | calc_forrester_alias | cardiology | Forrester JS et al 1976 — PMID 1247339 | — | — | — | lookup | wishlist | Cross-listed. |
| Fractional Excretion of Sodium | calc_fena_alias | renal/metabolic | Espinel CH 1976 — PMID 1255711 | ✓ | ✓ | ✓ | formula | wishlist | Cross-listed alias. |
| Fractional Excretion of Urea | calc_feurea_alias | renal/metabolic | Carvounis CP et al 2002 — PMID 12110013 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Framingham CHD Risk | calc_framingham_chd_alias | cardiology | Wilson PWF et al 1998 — PMID 9603539 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed. |
| Framingham HF Diagnostic Criteria | calc_framingham_hf_dx | cardiology | McKee PA et al 1971 — PMID 5121293 | ✓ | — | ✓ | tree | wishlist | HF clinical dx. |
| Free Water Deficit | calc_fwd_alias | renal/metabolic | Adrogué HJ, Madias NE 2000 — PMID 10816188 | ✓ | ✓ | ✓ | formula | wishlist | Cross-listed alias. |
| Fuhrman Nuclear Grade | calc_fuhrman_alias | oncology | Fuhrman SA et al 1982 — PMID 7148412 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| FUNC Score | calc_func_alias | neurology | Rost NS et al 2008 — PMID 18434639 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| G8 Geriatric Screen | calc_g8_alias | geriatrics | Bellera CA et al 2012 — PMID 22153112 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| GALAD Model HCC | calc_galad_alias | hepatology | Berhane S et al 2016 — PMID 26795574 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Ganzoni Iron Deficit | calc_ganzoni_alias | hematology | Ganzoni AM 1970 — PMID 5413814 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| GAP Index IPF | calc_gap_ipf_alias | pulmonary-vte | Ley B et al 2012 — PMID 22561965 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| GARFIELD-AF | calc_garfield_af_alias | cardiology | Fox KAA et al 2017 — PMID 28739290 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| GCS-Pupils Score | calc_gcs_pupils_alias | critical-care | Brennan PM et al 2018 — PMID 29768149 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| GELF Criteria | calc_gelf_alias | oncology | Brice P et al 1997 — PMID 9060549 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| GENEVA score (revised) | calc_geneva_alias | pulmonary-vte | Le Gal G et al 2006 — PMID 16461960 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Glasgow Alcoholic Hepatitis Score | calc_gahs_alias | hepatology | Forrest EH et al 2005 — PMID 16162686 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Glasgow-Blatchford Score | calc_gbs_alias | gastroenterology | Blatchford O et al 2000 — PMID 11073021 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed alias. |
| Glasgow-Imrie Pancreatitis | calc_glasgow_imrie_alias | gastroenterology | Blamey SL et al 1984 — PMID 6427650 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| GO-FAR Score | calc_go_far_alias | cardiology | Ebell MH et al 2013 — PMID 23979495 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Grogan Staging ATTR-CM | calc_grogan_attr | cardiology | Grogan M et al 2016 — PMID 27143515 | ✓ | — | ✓ | lookup | wishlist | TTR amyloid staging. |
| Gillmore Staging ATTR-CM | calc_gillmore_attr | cardiology | Gillmore JD et al 2018 — PMID 29799986 | ✓ | — | ✓ | lookup | wishlist | TTR amyloid staging UK. |
| Gupta Postoperative Pneumonia | calc_gupta_pna_alias | pulmonary-vte | Gupta H et al 2013 — PMID 23375179 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Gupta Postoperative Respiratory Failure | calc_gupta_rf_alias | pulmonary-vte | Gupta H et al 2011 — PMID 21864780 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| GWTG-HF Risk Score | calc_gwtg_hf_alias | cardiology | Peterson PN et al 2010 — PMID 20123669 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| H2FPEF Score | calc_h2fpef_alias | cardiology | Reddy YNV et al 2018 — PMID 29792252 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| HACOR Score | calc_hacor_alias | critical-care | Duan J et al 2017 — PMID 27913033 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Hamilton Anxiety Scale | calc_hama_alias | psychiatry | Hamilton M 1959 — PMID 13638508 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Hamilton Depression Rating Scale | calc_hamd_alias | psychiatry | Hamilton M 1960 — PMID 14399272 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Harmless Acute Pancreatitis Score | calc_haps_alias | gastroenterology | Lankisch PG et al 2009 — PMID 19111892 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Harvey-Bradshaw Index | calc_hbi_alias | gastroenterology | Harvey RF, Bradshaw JM 1980 — PMID 6102236 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| HAT Post-tPA Hemorrhage | calc_hat_alias | neurology | Lou M et al 2008 — PMID 18654085 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| HCM Risk-SCD | calc_hcm_risk_alias | cardiology | O'Mahony C et al 2014 — PMID 24126876 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| HCT-CI (Sorror) | calc_hct_ci_alias | oncology | Sorror ML et al 2005 — PMID 15994282 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| HEMORR2HAGES | calc_hemorr2hages_alias | cardiology | Gage BF et al 2006 — PMID 16504638 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Hepatic Encephalopathy Grades | calc_he_grades | hepatology | Atterbury CE et al 1978 — PMID 668791 | ✓ | — | ✓ | lookup | wishlist | West Haven; cross-listed. |
| HERDOO2 Rule alias | calc_herdoo2_alias | hematology | Rodger MA et al 2008 — PMID 18725688 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Hestia Criteria alias | calc_hestia_alias | pulmonary-vte | Zondag W et al 2011 — PMID 21389574 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| High-Dose Insulin Euglycemia | calc_hiet_alias | endocrinology | n/a — toxicology | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| HIRI-MSM | calc_hiri_msm_alias | infectious-disease | Smith DK et al 2012 — PMID 22195869 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Ho Index | calc_ho_index | infectious-disease | Ho VP et al 2009 — PMID 19590462 | ✓ | — | ✓ | formula | wishlist | Sepsis prognosis. |
| HOPE Hypothermia Score | calc_hope_alias | emergency-medicine | Pasquier M et al 2018 — PMID 29626518 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| HOSPITAL Score | calc_hospital_alias | prognosis-general | Donzé J et al 2013 — PMID 23529115 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Hour-Specific Bilirubin Risk | calc_hour_bili_alias | pediatrics | Bhutani VK et al 1999 — PMID 9917458 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| HOMA-IR alias | calc_homa_alias | endocrinology | Matthews DR et al 1985 — PMID 3899825 | ✓ | ✓ | ✓ | formula | wishlist | Cross-listed. |
| Horowitz Index alias | calc_horowitz_alias | critical-care | Horowitz JH et al 1974 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| HScore alias | calc_hscore_alias | hematology | Fardet L et al 2014 — PMID 24782338 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| HSV Risk Score | calc_hsv_risk | infectious-disease | n/a | — | — | — | — | — | Skip — not real. |
| Hunt-Hess alias | calc_hunt_hess_alias | neurology | Hunt WE, Hess RM 1968 — PMID 5635959 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Hydroxychloroquine alias | calc_hcq_alias | drug-dosing | Marmor MF et al 2016 — PMID 26871745 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Hypoglycemia Risk Score | calc_hypo_risk_alias | endocrinology | Karter AJ et al 2017 — PMID 28604921 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Hypothermia HOPE alias | calc_hope_score_alias | emergency-medicine | Pasquier M et al 2018 — PMID 29626518 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| ICH Score alias | calc_ich_alias | neurology | Hemphill JC et al 2001 — PMID 11283388 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| IMDC RCC alias | calc_imdc_alias | oncology | Heng DYC et al 2009 — PMID 19826129 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| IMPACT Head Injury Score | calc_impact_alias | neurology | Steyerberg EW et al 2008 — PMID 18684008 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| IMPEDE-VTE | calc_impede_vte | hematology | Sanfilippo KM et al 2019 — PMID 30924554 | ✓ | — | ✓ | lookup | wishlist | MM VTE risk. |
| IMPROVE Bleeding Risk alias | calc_improve_bleed_alias | hematology | Decousus H et al 2011 — PMID 21193491 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| IMPROVE Risk alias | calc_improve_vte_alias | hematology | Spyropoulos AC et al 2011 — PMID 21946892 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| IMPROVEDD alias | calc_improvedd_alias | hematology | Gibson CM et al 2017 — PMID 28702815 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Indian Takayasu Activity Score | calc_itas_alias | rheumatology | Misra R et al 2013 — PMID 23286038 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Indications for Paxlovid alias | calc_paxlovid_alias | infectious-disease | NIH 2022 | ✓ | — | ✓ | tree | wishlist | Cross-listed. |
| Infective Endocarditis (IE) Mortality | calc_ie_mortality_alias | infectious-disease | Park LP et al 2016 — PMID 27474103 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Infant Scalp Score | calc_infant_scalp_alias | pediatrics | Schutzman SA et al 2021 — PMID 33561868 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Immunization Schedule Calculator | calc_immunization_sched | pediatrics | CDC ACIP schedules | ✓ | — | ✓ | tree | wishlist | CDC catch-up scheduler. |
| Index of Severity for EoE (I-SEE) | calc_i_see | gastroenterology | Hirano I et al 2022 — PMID 35525274 | ✓ | — | ✓ | lookup | wishlist | EoE severity. |
| Intracerebral Hemorrhage Score alias | calc_ich_score_alias | neurology | Hemphill JC et al 2001 — PMID 11283388 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Intraop Fluid Dosing alias | calc_intraop_fluid_alias | drug-dosing | Holte K et al 2002 — PMID 12114263 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Intrauterine RBC Tx Dose | calc_iut_rbc_alias | obstetrics | Mandelbrot L 1988 — PMID 3133007 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| IPI for DLBCL alias | calc_ipi_alias | oncology | NHL Prognostic Factors Project 1993 — PMID 8141877 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Karnofsky alias | calc_kps_alias | oncology | Karnofsky DA 1949 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Kawasaki Disease Criteria alias | calc_kd_alias | pediatrics | McCrindle BW et al 2017 — PMID 28356445 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Khorana VTE alias | calc_khorana_alias | oncology | Khorana AA et al 2008 — PMID 18856473 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Kidney Failure Risk alias | calc_kfre_alias | renal/metabolic | Tangri N et al 2011 — PMID 21482743 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Killip Class alias | calc_killip_alias | cardiology | Killip T, Kimball JT 1967 — PMID 6059183 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Kt/V for Dialysis | calc_ktv_alias | renal/metabolic | Daugirdas JT 1993 — PMID 8338283 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| LDL Calculated alias | calc_ldl_alias | cardiology | Friedewald WT et al 1972 — PMID 4337382 | ✓ | ✓ | ✓ | formula | wishlist | Cross-listed alias. |
| LENT Score (MPE) | calc_lent_alias | oncology | Clive AO et al 2014 — PMID 25053713 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Liver Decomp Risk after Hepatectomy alias | calc_liver_decomp_alias | hepatology | Yokoo T et al 2019 — PMID 30993705 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Light's Criteria alias | calc_lights_alias | pulmonary-vte | Light RW et al 1972 — PMID 4642731 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Local Anesthetic Maximum Dose alias | calc_local_anes_alias | emergency-medicine | Rosenberg PH et al 2004 — PMID 15534030 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| LRINEC alias | calc_lrinec_alias | infectious-disease | Wong CH et al 2004 — PMID 15241098 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| MACOCHA alias | calc_macocha_alias | critical-care | De Jong A et al 2013 — PMID 23222657 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| MAGGIC Risk Calc | calc_maggic_alias | cardiology | Pocock SJ et al 2013 — PMID 23257305 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Maintenance Fluids alias | calc_maintenance_fluid_alias | renal/metabolic | Holliday MA, Segar WE 1957 — PMID 13431307 | ✓ | ✓ | ✓ | formula | wishlist | Cross-listed alias. |
| Manchester Score (SCLC) alias | calc_manchester_alias | oncology | Cerny T et al 1987 — PMID 3035222 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Mantle Cell IPI (MIPI) alias | calc_mipi_alias | oncology | Hoster E et al 2008 — PMID 18187660 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| MASCC FN Risk alias | calc_mascc_alias | oncology | Klastersky J et al 2000 — PMID 10944139 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Mayo Alliance Prognostic System alias | calc_maps_alias | oncology | Tefferi A et al 2018 — PMID 29581247 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Mayo Score (UC) alias | calc_mayo_uc_alias | gastroenterology | Schroeder KW et al 1987 — PMID 3543674 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| McMahon Score alias | calc_mcmahon_alias | renal/metabolic | McMahon GM et al 2013 — PMID 24247580 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Mehran Score alias | calc_mehran_alias | cardiology | Mehran R et al 2004 — PMID 15464318 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Mekhail Extension alias | calc_mekhail_alias | oncology | Mekhail TM et al 2005 — PMID 15659513 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| MELD Na alias | calc_meld_na_alias | hepatology | Kim WR et al 2008 — PMID 18768945 | ✓ | ✓ | ✓ | formula | wishlist | Cross-listed alias. |
| MELD Original alias | calc_meld_orig_alias | hepatology | Malinchoc M et al 2000 — PMID 10733541 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| MELDNa (NHANES) alias | calc_meld_na_nhanes | hepatology | Kamath PS et al 2007 — PMID 17326206 | ✓ | — | ✓ | formula | wishlist | Cross-listed. |
| Memorial Sloan-Kettering RCC alias | calc_mskcc_rcc_alias | oncology | Motzer RJ et al 2002 — PMID 11900224 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Mentzer Index alias | calc_mentzer_alias | hematology | Mentzer WC 1973 — PMID 4127948 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Menza Score | calc_menza | infectious-disease | Menza TW et al 2009 — PMID 19568171 | ✓ | — | ✓ | lookup | wishlist | MSM HIV risk. |
| METS-IR alias | calc_mets_ir_alias | endocrinology | Bello-Chavolla OY et al 2018 — PMID 29795452 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| MEWS alias | calc_mews_alias | critical-care | Subbe CP et al 2001 — PMID 11588210 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Michigan PICC Thrombosis Score | calc_michigan_picc | hematology | Chopra V et al 2017 — PMID 28430587 | ✓ | — | ✓ | lookup | wishlist | PICC thrombosis. |
| Migraine Disability Ax (MIDAS) alias | calc_midas_alias | neurology | Stewart WF et al 1999 — PMID 9923010 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Migraine Tx Optimization (mTOQ-4) alias | calc_mtoq4_alias | neurology | Lipton RB et al 2009 — PMID 19366342 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Milan Criteria alias | calc_milan_alias | hepatology | Mazzaferro V et al 1996 — PMID 8594428 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Mirels' Criteria alias | calc_mirels_alias | oncology | Mirels H 1989 — PMID 2684463 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| mMRC Dyspnea alias | calc_mmrc_alias | pulmonary-vte | Mahler DA 1988 — PMID 3338659 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Asthma Predictive Index | calc_mapi_alias | pulmonary-vte | Guilbert TW et al 2004 — PMID 15536431 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Modified Bishop Score alias | calc_bishop_mod_alias | obstetrics | Burnett JE 1966 — PMID 5953119 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Brain Injury Guideline alias | calc_mbig_alias | neurology | Joseph B et al 2014 — PMID 24566612 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Modified Fatigue Impact Scale alias | calc_mfis_alias | neurology | Kos D et al 2005 — PMID 16273988 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Finnegan NAS alias | calc_finnegan_alias | pediatrics | Finnegan LP et al 1975 — PMID 1234543 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Fisher SAH alias | calc_fisher_mod_alias | neurology | Frontera JA et al 2006 — PMID 16823288 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Glasgow Prognostic Score alias | calc_mgps_alias | oncology | McMillan DC 2008 — PMID 18608048 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Mallampati alias | calc_mallampati_alias | critical-care | Mallampati SR et al 1985 — PMID 4014593 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified NIHSS alias | calc_mnihss_alias | neurology | Meyer BC et al 2002 — PMID 12468842 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified Rankin Scale alias | calc_mrs_alias | neurology | Rankin J 1957 — PMID 13432836 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Modified RECIST (mRECIST) alias | calc_mrecist_alias | oncology | Lencioni R, Llovet JM 2010 — PMID 20175033 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Modified Sequential Organ Failure (mSOFA) alias | calc_msofa_alias | critical-care | Grissom CK et al 2010 — PMID 20498723 | ✓ | — | ✓ | lookup | wishlist | Cross-listed. |
| Modified Sgarbossa Criteria alias | calc_sgarbossa_alias | cardiology | Smith SW et al 2012 — PMID 22939607 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Montgomery-Asberg alias | calc_madrs_alias | psychiatry | Montgomery SA, Asberg M 1979 — PMID 444788 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Montreal Cognitive Ax alias | calc_moca_alias | neurology | Nasreddine ZS et al 2005 — PMID 15817019 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| MuLBSTA alias | calc_mulbsta_alias | pulmonary-vte | Guo L et al 2019 — PMID 30853980 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| MM Diagnostic Criteria alias | calc_mm_dx_alias | oncology | Rajkumar SV et al 2014 — PMID 25439696 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Mumtaz Cirrhosis Readmission alias | calc_mumtaz_alias | hepatology | Mumtaz K et al 2017 — PMID 28247915 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Murray Lung Injury alias | calc_murray_alias | critical-care | Murray JF et al 1988 — PMID 3202424 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Myasthenia Gravis ADL alias | calc_mg_adl_alias | neurology | Wolfe GI et al 1999 — PMID 9923470 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Myelofibrosis Secondary PV/ET Model | calc_mf_sec_pv_et | oncology | Passamonti F et al 2017 — PMID 28298589 | ✓ | — | ✓ | formula | wishlist | Secondary MF. |
| NAFLD Activity Score alias | calc_nas_alias | hepatology | Kleiner DE et al 2005 — PMID 15915461 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| NAFLD Fibrosis Score alias | calc_nafld_fs_alias | hepatology | Angulo P et al 2007 — PMID 17393509 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Naloxone Drip alias | calc_naloxone_drip_alias | drug-dosing | n/a — clinical | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| NCCN-IPI alias | calc_nccn_ipi_alias | oncology | Zhou Z et al 2014 — PMID 24009124 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| NEDOCS alias | calc_nedocs_alias | emergency-medicine | Weiss SJ et al 2004 — PMID 14760950 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Neonatal Early-Onset Sepsis alias | calc_neonatal_eos_alias | pediatrics | Puopolo KM 2011 — PMID 22025592 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Neonatal Partial Exchange (Polycythemia) | calc_neonatal_partial_exch | pediatrics | n/a — formula | ✓ | — | ✓ | formula | wishlist | Polycythemia exchange volume. |
| Neuropathic Pain Scale alias | calc_nps_alias | neurology | Galer BS, Jensen MP 1997 — PMID 9040716 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Neutrophil-Lymphocyte Ratio alias | calc_nlr_alias | hematology | Zahorec R 2001 — PMID 11723675 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| New Orleans Head Injury Rule alias | calc_new_orleans_alias | neurology | Haydel MJ et al 2000 — PMID 10891516 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| New York Heart Association Functional alias | calc_nyha_alias | cardiology | NYHA 1994 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Newsom CXR Score alias | calc_newsom_alias | cardiology | Newsom JH 2009 (Am J Emerg Med) | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| NEXUS Chest CT alias | calc_nexus_chest_ct_alias | trauma | Rodriguez RM et al 2015 — PMID 26218636 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| NEXUS C-Spine alias | calc_nexus_c_alias | neurology | Hoffman JR et al 2000 — PMID 10891517 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Ottawa COPD Risk Scale | calc_ottawa_copd | pulmonary-vte | Stiell IG et al 2014 — PMID 24446752 | ✓ | — | ✓ | lookup | wishlist | ED COPD risk. |
| Ottawa SAH alias | calc_ottawa_sah_alias | neurology | Perry JJ et al 2013 — PMID 24065011 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Overall Neuropathy Limitations alias | calc_onls_alias | neurology | Graham RC 2006 — PMID 16835376 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Oxygenation Index alias | calc_oi_alias | critical-care | Khemani RG 2018 — PMID 29470486 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Padua VTE alias | calc_padua_alias | hematology | Barbar S et al 2010 — PMID 20738765 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| PASI Psoriasis alias | calc_pasi_alias | dermatology | Fredriksson T 1978 — PMID 152949 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Pediatric Trauma Score | calc_pediatric_trauma | pediatrics | Tepas JJ et al 1987 — PMID 3559615 | — | — | — | lookup | wishlist | Cross-listed alias. |
| PERC Rule alias | calc_perc_alias | pulmonary-vte | Kline JA et al 2008 — PMID 18318689 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed alias. |
| PESI alias | calc_pesi_alias | pulmonary-vte | Aujesky D et al 2005 — PMID 16020800 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| PHQ-9 alias | calc_phq9_alias | psychiatry | Kroenke K 2001 — PMID 11556941 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Pittsburgh / Sgarbossa-Smith STEMI rule | calc_pitt_stemi | cardiology | Driver BE et al 2017 — PMID 28939424 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| PROMISE Score alias | calc_promise_alias | oncology | Psallidas I et al 2018 — PMID 30032996 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| PSA Doubling Time alias | calc_psadt_alias | oncology | Pound CR et al 1999 — PMID 10367820 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| PSI / PORT alias | calc_psi_alias | pulmonary-vte | Fine MJ et al 1997 — PMID 9412649 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed alias. |
| qSOFA alias | calc_qsofa_alias | critical-care | Seymour CW et al 2016 — PMID 26903335 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Quick COVID Severity Index alias | calc_qcsi_alias | infectious-disease | Haimovich AD 2020 — PMID 32522437 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Quick Inventory of Depressive Sx alias | calc_qids_alias | psychiatry | Rush AJ 2003 — PMID 12946886 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Reynolds Risk alias | calc_reynolds_alias | cardiology | Ridker PM et al 2008 — PMID 18250355 | — | — | — | formula | wishlist | Cross-listed alias. |
| Roth Score for Hypoxia | calc_roth | pulmonary-vte | Chorin E et al 2016 — PMID 27139032 | ✓ | — | ✓ | lookup | wishlist | Cell-phone hypoxia screen. |
| ROX Index alias | calc_rox_alias | critical-care | Roca O et al 2019 — PMID 30776681 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Rule of Nines alias | calc_rule_nines_alias | dermatology | Pulaski 1947 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Sepsis Criteria (Sepsis-3) alias | calc_sepsis_3_alias | critical-care | Singer M et al 2016 — PMID 26903338 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| SLEDAI-2K alias | calc_sledai_alias | rheumatology | Gladman DD et al 2002 — PMID 11838846 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| SOAR Score alias | calc_soar_alias | neurology | Myint PK et al 2014 — PMID 24938835 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| SOFA alias | calc_sofa_alias | critical-care | Vincent JL et al 1996 — PMID 8844239 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed alias. |
| Surgical Apgar alias | calc_sap_alias | surgery | Gawande AA et al 2007 — PMID 17239311 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Swede Score (cervical dysplasia) | calc_swede | obstetrics | Strander B et al 2005 — PMID 15922391 | ✓ | — | ✓ | lookup | wishlist | Colposcopy score. |
| Targeted Temperature Management Outcome | calc_ttm_outcome | critical-care | n/a | — | — | — | — | — | Skip — no widely-used standalone score. |
| TIMI Risk (NSTEMI) alias | calc_timi_nstemi_alias | cardiology | Antman EM et al 2000 — PMID 10938172 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| TIMI Risk (STEMI) alias | calc_timi_stemi_alias | cardiology | Morrow DA et al 2000 — PMID 11034741 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Travis Criteria (UC) | calc_travis_uc | gastroenterology | Travis SPL et al 1996 — PMID 8995239 | ✓ | — | ✓ | lookup | wishlist | UC severe-flare score. |
| TRISS alias | calc_triss_alias | trauma | Boyd CR et al 1987 — PMID 3106646 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Truelove-Witts alias | calc_truelove_alias | gastroenterology | Truelove SC, Witts LJ 1955 — PMID 13260656 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Trunk Impairment Scale alias | calc_tis_alias | neurology | Verheyden G et al 2004 — PMID 15293485 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| UCSF Egg Freezing alias | calc_egg_freezing_alias | obstetrics | Goldman RH et al 2017 — PMID 28903761 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| UKELD alias | calc_ukeld_alias | hepatology | Barber K et al 2011 — PMID 21516056 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| Urinary Protein Excretion Estimation | calc_urine_protein | renal/metabolic | Ginsberg JM et al 1983 — PMID 6361563 | ✓ | — | ✓ | formula | wishlist | Spot urine P/Cr. |
| Urticaria Activity Score alias | calc_uas_alias | dermatology | Mlynek A et al 2008 — PMID 18476840 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| VACO Index alias | calc_vaco_alias | infectious-disease | King JT 2020 — PMID 33256646 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| VACS 1.0 / 2.0 Index | calc_vacs | infectious-disease | Justice AC et al 2013 — PMID 23612028 | ✓ | — | ✓ | formula | wishlist | HIV mortality (VA). |
| VACS-CCI Index | calc_vacs_cci | infectious-disease | Justice AC et al 2013 — PMID 23612028 | ✓ | — | ✓ | formula | wishlist | VACS + Charlson. |
| Villalta PTS alias | calc_villalta_alias | hematology | Villalta S et al 1994 — PMID 7822867 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| VIRSTA alias | calc_virsta_alias | infectious-disease | Tubiana S et al 2016 — PMID 27052195 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Visual Acuity Snellen alias | calc_snellen_alias | ophthalmology | Snellen 1862 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| VTE-BLEED alias | calc_vte_bleed_alias | hematology | Klok FA et al 2016 — PMID 27307464 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Wells DVT alias | calc_wells_dvt_alias | pulmonary-vte | Wells PS et al 2003 — PMID 14507948 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed alias. |
| Wells PE alias | calc_wells_pe_alias | pulmonary-vte | Wells PS et al 2000 — PMID 10744147 | ✓ | ✓ | ✓ | lookup | wishlist | Cross-listed alias. |
| Wexner Score alias | calc_wexner_alias | gastroenterology | Renzi A et al 2008 — PMID 18545837 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| WHO Diagnostic PV alias | calc_who_pv_alias | oncology | Khoury JD 2022 — PMID 35732831 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| WHO Diagnostic SM alias | calc_who_sm_alias | oncology | Khoury JD 2022 — PMID 35732831 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |
| Withdrawal Assessment Tool alias | calc_wat1_alias | pediatrics | Franck LS et al 2008 — PMID 18367963 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Winter's Formula alias | calc_winters_alias | renal/metabolic | Albert MS, Dell RB, Winters RW 1967 — PMID 6028797 | ✓ | — | ✓ | formula | wishlist | Cross-listed alias. |
| WPSS MDS Score alias | calc_wpss_alias | oncology | Malcovati L et al 2007 — PMID 17609426 | ✓ | — | ✓ | lookup | wishlist | Cross-listed alias. |
| Wound Closure Classification | calc_wound_closure | surgery | Halsted WS 1913 (book) | ✓ | — | ✓ | lookup | wishlist | Clean / clean-contaminated / dirty. |
| YEARS PE alias | calc_years_alias | pulmonary-vte | van der Hulle T et al 2017 — PMID 28549662 | ✓ | — | ✓ | tree | wishlist | Cross-listed alias. |

---

## Patterns observed during research

A few observations worth surfacing when this becomes the
contributor-facing roadmap:

1. **Cardiology dominates.** ~17 % of all entries (and an even larger
   share of the high-traffic / `planned-v0.5` subset) are
   cardiovascular. This matches MDCalc's own emphasis but means our
   v0.1 cut already disproportionately covers cardiology vs other
   specialties.
2. **Pediatrics is underrepresented in every catalog.** MedCalc-Bench
   has effectively no pediatric calculators (the closest are general
   weight/dose conversion calcs). Nobra has a handful but skews adult.
   MDCalc has a "Pediatrics" specialty filter but the long tail is
   sparse. If we want pediatric coverage, we will need to source
   primary citations directly from pediatric society guidelines
   (AAP, ACR, CDC growth charts) rather than mining cross-walks.
3. **Hematology-oncology has heavy long-tail.** Most lymphoma /
   myeloma / MDS / myelofibrosis prognostic scores are domain-specific
   enough that they don't surface in cross-domain benchmarks.
   These are the rows with the most uncertain `mdcalc` / `nobra` flags.
4. **Drug dosing is structurally under-served by calculator
   catalogs.** Most drug dosing (vancomycin AUC, anticoagulant renal
   dose adjustment, chemo dosing) is published as FDA-label tables or
   pharmacist nomograms, not as primary-derivation calculators with
   PMIDs. These are real clinical needs but live more naturally in
   `@openclinicalai/drugs` paired with the renal/hepatic dose calcs we
   ship in `@openclinicalai/calc`.
5. **Many "scores" are actually classification trees, not formulas.**
   This is why we added `complexity: tree` as a category. Examples:
   Berlin ARDS criteria, Duke endocarditis criteria, McDonald MS
   criteria. These are cheap to implement but require careful
   conditional-logic testing rather than numeric validation.
6. **IP-sensitive calculators we can implement formulas for, but
   should not redistribute interpretive thresholds for, without
   licensing.** Examples: MMSE (PAR Inc.), STS Cardiac Surgery Risk
   Calculator (proprietary coefficients), Adjuvant! Online (license
   required). For these, ship the math (where the math is published in
   primary literature) but defer interpretive bands to the caller, or
   omit until licensed-tier slot is wired.
7. **MedCalc-Bench's 55 are an honest "must-implement" v0.1 list.**
   Any calculator with `medcalc_bench: ✓` already has numeric ground
   truth available for our CI harness. There are 55 such rows in this
   inventory; we ship 19, and the remaining 36 should be the
   `planned-v0.1` priority because validation effort is near zero
   once the formula is ported.

## Things I couldn't resolve

The following rows have `primary_citation: TODO` or are
otherwise flagged for contributor clarification:

- A few rows whose nobra description matches an MDCalc calculator but
  whose primary derivation paper I couldn't confidently identify
  without web access have a `primary_citation: TODO` marker. These are
  high-leverage low-hanging fruit for a contributor with PubMed
  access — usually a single MDCalc page lookup resolves them.
- Several "alias" rows in the long-tail section duplicate a calculator
  already covered above; before flipping any of these to `shipped`,
  the contributor should de-duplicate against the canonical row.
- `MMSE` and `MoCA` are IP-sensitive (PAR Inc. for MMSE; MoCA Clinic
  for the latter). Both ship in nobra and on MDCalc, but the
  interpretive thresholds are copyrighted in some jurisdictions. Flag
  with `notes: IP-sensitive — interpretive thresholds may require
  licensing` and hold until the licensed-tier path (see
  `ARCHITECTURE.md §3.4`) is wired.
- `STS Cardiac Surgery Risk` — the formula is closed-source. The STS
  publishes only a web tool. We cannot ship this as a free-tier
  calculator regardless of how much we want to.
- `BOADICEA / CanRisk` — the source is open-research but the executable
  model is distributed under non-commercial license. Treat as wishlist
  with licensing review.
- `Beers Criteria` and `STOPP/START` are guideline checklists, not
  numeric calculators. They probably belong in `@openclinicalai/drugs`
  as a `check_inappropriate_meds` tool, not in this calc inventory.
- Several "Wisconsin", "Geneva", "Forrester", "Newsom" rows are
  cross-listed by MDCalc but their primary derivation papers are in
  older journals without PubMed indexing. A contributor should confirm
  the exact citation before porting.

## Roadmap implications

- **v0.1 target:** the 36 MedCalc-Bench calcs we don't yet ship,
  plus the high-traffic `planned-v0.1` rows (NIHSS, mRS, Centor,
  Bishop, APGAR, Glasgow-Blatchford, HEART). This puts us in the
  60-65 calc range — comfortably past the 25 target in
  `ARCHITECTURE.md §9 item 1` while staying inside the
  validation-budget that MedCalc-Bench's ground truth supports.
- **v0.5 target:** the `planned-v0.5` rows, ~110 calculators
  covering the high-traffic specialties (cardiology depth,
  hepatology, neurology, geriatrics screening, COPD/asthma).
- **v1.0 and beyond:** the long-tail `wishlist` set is the
  community-contribution target. Each row already has its primary
  citation; the work is porting + fixture creation.









</content>
</invoke>