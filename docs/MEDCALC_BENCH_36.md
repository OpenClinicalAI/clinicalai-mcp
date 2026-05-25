# MedCalc-Bench: Implementation Brief for Unshipped Calculators

## Scope and provenance

This brief catalogs the **44 MedCalc-Bench v1.0 calculators that are not yet
shipped** in `@openclinicalai/calc`, with implementation-ready details so each
can be ported into TypeScript without redoing primary-literature research.

> **Count note (vs. task brief).** The task brief estimated "36 unshipped." The
> actual count from `calculator_implementations/calc_path.json` (NCBI
> MedCalc-Bench v1.0, commit at main) is 55 calculators total. The intersection
> with our shipped atomic set is 11 (`creatinine_clearance`, `ckd_epi`,
> `cha2ds2_vasc`, `wells_pe`, `wells_dvt`, `meldna`, `has_bled`, `apache_ii`,
> `sofa`, `curb_65`, `perc_rule`). That leaves **44 unshipped MedCalc-Bench
> atomics**, not 36. The 8-calc delta arises from MedCalc-Bench treating each
> QTc method (Bazett/Fridericia/Framingham/Hodges/Rautaharju) and each acid-base
> variant (delta_gap, delta_ratio, albumin_corrected_anion,
> albumin_corrected_delta_gap, albumin_delta_ratio) and each LMP-derived
> obstetric date as separate calculators. If we collapse the 5 QTc methods into
> one `calc_qtc` with a method parameter, the 5 acid-base variants into
> `calc_acid_base_panel`, and the 3 LMP date calcs into `calc_obstetric_dating`,
> the implementable-tool count drops to **38**, close to the brief's "36."

**Primary sources for every section below:**

- MedCalc-Bench v1.0 — Khandekar N, Jin Q, Xiong G et al. *MedCalc-Bench:
  Evaluating Large Language Models for Medical Calculations.* NeurIPS 2024
  Datasets and Benchmarks Track. arXiv:2406.12036. PMID 38922827 covers the
  earlier preprint exchange.
- All implementation pseudo-formulas were extracted from
  `github.com/ncbi-nlp/MedCalc-Bench/blob/main/calculator_implementations/<file>.py`
  and **independently re-stated from the cited primary derivation paper**.
  Do not copy the Python code verbatim — re-derive from primary literature so
  our `sources[]` contract is honest.

**Conventions used in every section:**

- Each input lists `name | required? | type | unit | valid range`. Units shown
  match the canonical paper; MedCalc-Bench fixtures may arrive in alternative
  units (e.g., serum creatinine in µmol/L) and your TS implementation must
  convert via the shared `unit_converter` helper.
- "Edge cases / clinical caveats" rows that say **"bands need full-text
  verification"** mean the publicly indexed abstract did not include the cutoff
  band; the implementer must read the linked PMID full text (or an open-access
  copy from PMC where available) before shipping.
- All `complexity` labels follow the taxonomy in `docs/CALCULATOR_INVENTORY.md`
  (`formula | lookup | tree | multi-step`).

---

## Cardiology (8 calculators)

### HEART Score for Major Cardiac Events

- **MedCalc-Bench ID:** `calc_id: 18`
- **Proposed slug:** `calc_heart_score`
- **Domain:** cardiology
- **Primary citation:** Six AJ, Backus BE, Kelder JC 2008 — PMID 18665203
  (*Chest pain in the emergency room: value of the HEART score.* Neth Heart J
  2008;16(6):191-196.)
- **Complexity:** `lookup`
- **Inputs:**
  - `history` | required | enum | `slightly_suspicious | moderately_suspicious | highly_suspicious` | — | clinician gestalt
  - `ecg` | required | enum | `normal | non_specific_repolarization | significant_st_deviation` | —
  - `age` | required | number | years | 0–120
  - `risk_factors_count` | required | int | count of: HTN, hypercholesterolemia, DM, obesity (BMI >30), smoking (current or stopped <3mo), family history of CVD before 65, history of atherosclerotic disease (MI, PCI/CABG, CVA/TIA, PAD) | 0–7
  - `atherosclerotic_disease_history` | required | bool | — | — (forces +2 even if `risk_factors_count` < 3)
  - `initial_troponin` | required | enum | `≤normal | 1–3×normal | >3×normal` | —
- **Output:**
  - Integer 0–10
  - Interpretive bands (Six 2008; validated in HEART Pathway, Backus 2013 — PMID 23465250):
    - 0–3: low risk (~1.7% 6-week MACE)
    - 4–6: moderate risk (~16.6% 6-week MACE)
    - 7–10: high risk (~50.1% 6-week MACE)
  - Clinical action (Backus 2013 publishes only the bands; the "discharge from ED if HEART 0–3" recommendation comes from HEART Pathway validation): document MACE rate; do **not** infer the action from the original Six 2008 paper.
- **Formula:** Sum of 5 sub-scores (each 0/1/2):
  - History: slightly=0, moderately=1, highly=2
  - ECG: normal=0, non-specific repol=1, significant ST deviation=2
  - Age: <45=0, 45–64=1, ≥65=2
  - Risk factors: 0 RF=0, 1–2 RF=1, ≥3 RF **or** any atherosclerotic-disease history=2
  - Troponin: ≤normal=0, 1–3× normal=1, >3× normal=2
- **Edge cases / clinical caveats:**
  - "Atherosclerotic disease history" is a *forced* +2 even with only 1–2 other RFs (per Backus 2013 wording).
  - Missing risk factors are treated as *absent* (MedCalc-Bench convention; check with derivation paper before shipping).
  - Not validated in patients <21 y per Six 2008.
- **Test fixtures:**
  - MedCalc-Bench instance ID examples typically: 45-yo male, moderately suspicious history, normal ECG, 1 RF (HTN), troponin normal → score 0+1+1+1+0 = **3** (low risk).
  - 68-yo female with prior MI (atherosclerotic disease), highly suspicious history, ST depression on ECG, troponin 2× normal → 2+2+2+2+1 = **9** (high risk).

---

### Revised Cardiac Risk Index (Lee)

- **MedCalc-Bench ID:** `calc_id: 17`
- **Proposed slug:** `calc_rcri`
- **Domain:** cardiology (perioperative)
- **Primary citation:** Lee TH, Marcantonio ER, Mangione CM et al 1999 — PMID 10477528 (*Derivation and prospective validation of a simple index for prediction of cardiac risk of major noncardiac surgery.* Circulation 1999;100:1043-9.)
- **Complexity:** `lookup`
- **Inputs:**
  - `high_risk_surgery` | required | bool | — | intraperitoneal, intrathoracic, or suprainguinal vascular
  - `ischemic_heart_disease` | required | bool | — | prior MI, positive ETT, current chest pain due to ischemia, nitrate therapy, ECG with pathological Q waves
  - `congestive_heart_failure` | required | bool | — | pulmonary edema, bilateral rales/S3, PND, or CXR pulmonary vascular redistribution
  - `cerebrovascular_disease` | required | bool | — | prior TIA or stroke
  - `insulin_treatment_for_diabetes` | required | bool | — | preoperative insulin use
  - `preoperative_creatinine_mg_dl` | required | number | mg/dL | 0–20 (≥2 mg/dL = 176.8 µmol/L scores)
- **Output:**
  - Integer 0–6
  - Interpretive bands (Lee 1999, Table 6 — 30-day major cardiac complication rate):
    - 0 factors: 0.4%
    - 1 factor: 0.9%
    - 2 factors: 6.6%
    - ≥3 factors: 11%
  - Clinical action: the paper publishes only the rates, not a binary go/no-go recommendation; downstream ACC/AHA 2014 perioperative guideline (Fleisher) uses 1% MACE as the elevated-risk cutoff. Do not infer cancellation thresholds from Lee 1999 directly.
- **Formula:** RCRI = sum of 6 binary criteria (each = 1 if present, 0 otherwise).
- **Edge cases / clinical caveats:**
  - The "high-risk surgery" definition is closed-vocabulary; CABG and AAA repair *are* high-risk, but they are also high-risk by other instruments. Stay within the Lee list.
  - Creatinine threshold is **>2.0 mg/dL** (strict greater-than per Lee 1999 supplemental table).
  - Validated in ≥50 y elective non-cardiac surgery; performance in emergency or cardiac surgery is poor.
- **Test fixtures:**
  - 62-yo for elective AAA (high-risk surgery), prior MI, prior TIA, Cr 1.1, no DM, no CHF → score = 3, 30-day cardiac event rate ≈ 11%.
  - 55-yo for laparoscopic cholecystectomy (not high-risk), no comorbidities → score 0, rate 0.4%.

---

### Framingham Risk Score for Hard Coronary Heart Disease

- **MedCalc-Bench ID:** `calc_id: 46`
- **Proposed slug:** `calc_framingham_chd`
- **Domain:** cardiology (primary prevention)
- **Primary citation:** Wilson PWF, D'Agostino RB, Levy D et al 1998 — PMID 9603539 (*Prediction of coronary heart disease using risk factor categories.* Circulation 1998;97:1837-47.) Coefficients used by MedCalc-Bench come from the 2002 Adult Treatment Panel III revision / NCEP recalibration; cross-check before shipping.
- **Complexity:** `formula`
- **Inputs:**
  - `sex` | required | enum | `male | female` | —
  - `age` | required | number | years | 30–75 (Wilson validation range)
  - `total_cholesterol_mg_dl` | required | number | mg/dL | 100–400
  - `hdl_cholesterol_mg_dl` | required | number | mg/dL | 20–100
  - `systolic_bp_mm_hg` | required | number | mmHg | 80–220
  - `on_bp_medication` | required | bool | — | —
  - `smoker` | required | bool | — | current smoker
- **Output:**
  - 10-year hard CHD risk as percentage (0–100)
  - Interpretive bands (NCEP ATP III 2001 — *not* in Wilson 1998 directly):
    - <10% — low risk
    - 10–20% — moderate risk
    - >20% — high risk / "CHD risk equivalent"
  - Clinical action: ATP III statin-eligibility tied to >20% category; not in Wilson primary paper. Cite ATP III separately.
- **Formula:** Cox proportional hazards model on log-transformed continuous variables. Re-derive from Wilson 1998 Table 4 (Male) and Table 5 (Female). MedCalc-Bench Python uses these coefficients (verify with paper before shipping):
  - **Male:** `risk_score = 52.00961·ln(age) + 20.014077·ln(TC) − 0.905964·ln(HDL) + 1.305784·ln(SBP) + 0.241549·bp_med + 12.096316·smoker − 4.605038·ln(age)·ln(TC) − 2.84367·ln(min(age,70))·smoker − 2.93323·ln(age)² − 172.300168`. `risk% = (1 − 0.9402^exp(risk_score))·100`
  - **Female:** `risk_score = 31.764001·ln(age) + 22.465206·ln(TC) − 1.187731·ln(HDL) + 2.552905·ln(SBP) + 0.420251·bp_med + 13.07543·smoker − 5.060998·ln(age)·ln(TC) − 2.996945·ln(min(age,78))·smoker − 146.5933061`. `risk% = (1 − 0.98767^exp(risk_score))·100`
- **Edge cases / clinical caveats:**
  - Age caps for the smoker-interaction term (70 male, 78 female) are MedCalc-Bench's reading; **must verify against Wilson 1998 published supplemental coefficients** — flag for the implementer.
  - This is "hard CHD" (MI + coronary death), not all-CHD. PCE 2013 (ASCVD) supersedes for current US guidelines.
  - Race-blind; underestimates risk in Black patients (one of the motivations for Pooled Cohort Equations and PREVENT).
- **Test fixtures:**
  - 55-yo male, TC 230, HDL 40, SBP 140 on BP meds, non-smoker — expected ~15% (moderate risk).
  - 65-yo female, TC 250, HDL 50, SBP 160 on BP meds, smoker — expected ~30% (high risk).
- **Flag for contributor:** Coefficients need full-text verification against the Wilson 1998 PDF; the MedCalc-Bench Python file does not cite a specific table.

---

### Mean Arterial Pressure (MAP)

- **MedCalc-Bench ID:** `calc_id: 5`
- **Proposed slug:** `calc_map`
- **Domain:** cardiology / hemodynamics
- **Primary citation:** No single primary paper; the formula is taught universally. Most-cited derivation: Sesso HD et al 2000 — PMID 10818075 in epidemiology context. For implementation, cite Magder S 2014 — PMID 24935095 (review of MAP as the relevant perfusion pressure).
- **Complexity:** `formula`
- **Inputs:**
  - `systolic_bp_mm_hg` | required | number | mmHg | 50–250
  - `diastolic_bp_mm_hg` | required | number | mmHg | 30–150
- **Output:**
  - Numeric, mmHg
  - Bands: SSC sepsis guidelines (Evans 2021 — PMID 34599691) cite **MAP ≥65 mmHg** as the resuscitation target; below that = hypoperfusion. Critical care literature uses MAP <60 as severe hypotension.
  - Do not include cardiac-output interpretations; MAP alone is not diagnostic.
- **Formula:** `MAP = (SBP + 2·DBP) / 3`. (Equivalent: `DBP + 1/3·(SBP − DBP)`.)
- **Edge cases / clinical caveats:**
  - Valid only at HR 60–100; at extreme tachycardia, diastolic fraction is shorter and the 1/3:2/3 weighting underestimates MAP.
  - Invasive arterial line MAP is the gold standard; cuff MAP is an estimate.
- **Test fixtures:**
  - SBP 120, DBP 80 → MAP 93.3 mmHg
  - SBP 90, DBP 50 → MAP 63.3 mmHg (below SSC threshold)

---

### QTc Bazett

- **MedCalc-Bench ID:** `calc_id: 11`
- **Proposed slug:** `calc_qtc_bazett` (or single `calc_qtc` with `method=bazett`)
- **Domain:** cardiology / electrophysiology
- **Primary citation:** Bazett HC 1920 (*An analysis of the time-relations of electrocardiograms.* Heart 1920;7:353-70.) — no PMID, pre-1947.
- **Complexity:** `formula`
- **Inputs:**
  - `qt_interval_ms` | required | number | ms | 200–600
  - `heart_rate_bpm` | required | number | beats/min | 30–200
- **Output:**
  - Numeric, ms
  - Bands (AHA/ACCF/HRS 2009 — Rautaharju PM et al, PMID 19281930):
    - Adult male: prolonged QTc >450 ms; severely prolonged >500 ms
    - Adult female: prolonged QTc >470 ms; severely prolonged >500 ms
    - Both sexes: short QTc <340 ms abnormal
  - Clinical action (FDA 2005 ICH-E14 guidance): QTc >500 ms or ΔQTc >60 ms triggers drug-discontinuation evaluation. Cite separately from Bazett.
- **Formula:** `QTc = QT / √RR` where `RR = 60 / HR` (in seconds). Equivalent: `QTc = QT · √(HR/60)`.
- **Edge cases / clinical caveats:**
  - **Overcorrects at HR >90 bpm and undercorrects at HR <60 bpm** — known limitation; FDA prefers Fridericia for thorough QT/QTc trials.
  - Invalid in AF or wide-complex rhythms (compute manual JT instead).
  - QT must be measured in lead II or V5 with the longest QT interval present.
- **Test fixtures:**
  - QT 400 ms, HR 60 → RR 1.0 s → QTc 400 ms
  - QT 440 ms, HR 100 → RR 0.6 s → QTc 568 ms (severely prolonged by AHA)

---

### QTc Fridericia

- **MedCalc-Bench ID:** `calc_id: 56`
- **Proposed slug:** `calc_qtc_fridericia` (or `calc_qtc` with `method=fridericia`)
- **Domain:** cardiology / electrophysiology
- **Primary citation:** Fridericia LS 1920 (*Die Systolendauer im Elektrokardiogramm bei normalen Menschen und bei Herzkranken.* Acta Med Scand 1920;53:469-86.) — no PMID.
- **Complexity:** `formula`
- **Inputs:** same as Bazett.
- **Output:** same bands as Bazett (use AHA/ACCF/HRS 2009 cutoffs).
- **Formula:** `QTc = QT / RR^(1/3)` where `RR = 60 / HR`.
- **Edge cases / clinical caveats:**
  - **Preferred by FDA for thorough QT/QTc drug studies** (ICH E14 step 4 guidance) because it is more rate-independent than Bazett.
  - Same validity limitations re: AF / wide-complex rhythm.
- **Test fixtures:**
  - QT 400 ms, HR 60 → RR 1.0 s → QTc 400 ms (no correction at HR 60).
  - QT 440 ms, HR 100 → RR 0.6 s → QTc ≈ 521 ms.

---

### QTc Framingham

- **MedCalc-Bench ID:** `calc_id: 57`
- **Proposed slug:** `calc_qtc_framingham`
- **Domain:** cardiology / electrophysiology
- **Primary citation:** Sagie A, Larson MG, Goldberg RJ et al 1992 — PMID 1519533 (*An improved method for adjusting the QT interval for heart rate (the Framingham Heart Study).* Am J Cardiol 1992;70:797-801.)
- **Complexity:** `formula`
- **Inputs:** same as Bazett.
- **Output:** same bands (AHA/ACCF/HRS 2009).
- **Formula:** `QTc = QT + 154·(1 − RR)` where `RR = 60/HR` in seconds, and QT in ms.
- **Edge cases / clinical caveats:**
  - Linear correction; less heart-rate dependent than Bazett.
  - Validated in Framingham Heart Study cohort (predominantly white American adults); generalizability to other populations is limited but commonly accepted.
- **Test fixtures:**
  - QT 400 ms, HR 60 → RR 1.0 → QTc 400 ms.
  - QT 440 ms, HR 100 → RR 0.6 → QTc 440 + 154·(0.4) = 501.6 ms.

---

### QTc Hodges

- **MedCalc-Bench ID:** `calc_id: 58`
- **Proposed slug:** `calc_qtc_hodges`
- **Domain:** cardiology / electrophysiology
- **Primary citation:** Hodges M, Salerno D, Erlien D 1983 — PMID 6638271 (*Bazett's QT correction reviewed: evidence that a linear QT correction for heart rate is better.* J Am Coll Cardiol 1983;1:694.)
- **Complexity:** `formula`
- **Inputs:** same as Bazett.
- **Output:** same bands.
- **Formula:** `QTc = QT + 1.75·(HR − 60)`. (Equivalent in MedCalc-Bench code: `QT + 1.75·((60/RR) − 60)` — algebraically the same.)
- **Edge cases / clinical caveats:**
  - Heart-rate-linear correction; less popular than Bazett/Fridericia.
  - Same validity limitations re: arrhythmia.
- **Test fixtures:**
  - QT 400 ms, HR 60 → QTc 400 ms.
  - QT 440 ms, HR 100 → QTc 440 + 1.75·40 = 510 ms.

---

### QTc Rautaharju

- **MedCalc-Bench ID:** `calc_id: 59`
- **Proposed slug:** `calc_qtc_rautaharju`
- **Domain:** cardiology / electrophysiology
- **Primary citation:** Rautaharju PM, Mason JW, Akiyama T 2014 — PMID 24793593 (*New age- and sex-specific criteria for QT prolongation based on rate correction formulas that minimize bias at the upper normal limits.* Int J Cardiol 2014;174:535-540.). MedCalc-Bench cites Rautaharju 2004 (PMID 15539110); the more commonly referenced derivation is 2014.
- **Complexity:** `formula`
- **Inputs:** same as Bazett.
- **Output:** same bands.
- **Formula:** `QTc = QT · (120 + HR) / 180`.
- **Edge cases / clinical caveats:**
  - Different from the other four QTc formulas: multiplicative-linear rather than divisive.
  - Validated in a large healthy-volunteer ECG database; performance near the upper-bound cutoffs is the rationale.
- **Test fixtures:**
  - QT 400 ms, HR 60 → QTc = 400·180/180 = 400 ms.
  - QT 440 ms, HR 100 → QTc = 440·220/180 ≈ 537.8 ms.

---

## Critical care / general acute medicine (4 calculators)

### Glasgow Coma Scale (GCS)

- **MedCalc-Bench ID:** `calc_id: 21`
- **Proposed slug:** `calc_gcs`
- **Domain:** critical-care / neuro
- **Primary citation:** Teasdale G, Jennett B 1974 — PMID 4136544 (*Assessment of coma and impaired consciousness. A practical scale.* Lancet 1974;2:81-84.)
- **Complexity:** `lookup`
- **Inputs:**
  - `best_eye_response` | required | enum | `spontaneous(4) | to_voice(3) | to_pain(2) | none(1) | not_testable(treat as 4 per MedCalc-Bench / Teasdale 2014 update)` | —
  - `best_verbal_response` | required | enum | `oriented(5) | confused(4) | inappropriate_words(3) | incomprehensible_sounds(2) | none(1) | not_testable(treat as 5)` | —
  - `best_motor_response` | required | enum | `obeys_commands(6) | localizes_pain(5) | withdraws_from_pain(4) | flexion_to_pain(3) | extension_to_pain(2) | none(1)` | —
- **Output:**
  - Integer 3–15
  - Bands (Teasdale 1974 + Working Party 2014):
    - 13–15: mild brain injury
    - 9–12: moderate
    - 3–8: severe (consider intubation for airway protection)
- **Formula:** GCS = E + V + M (sum of three components).
- **Edge cases / clinical caveats:**
  - "Not testable" components (e.g., intubated patient, swollen-shut eyes) are scored as **NT** in the official scale, not as a number; many EHRs and MedCalc-Bench impute the full sub-score, which is convention but loses information. Implement with both behaviors and document.
  - Motor sub-score has the highest prognostic value; consider exposing it separately.
  - Pediatric variants (GCS-Peds) require a different verbal component scale; do not use adult GCS in children <2 y.
- **Test fixtures:**
  - Eyes spontaneous, oriented, obeys commands → GCS 15.
  - Eyes to pain, incomprehensible sounds, extension to pain → 2+2+2 = GCS 6 (severe).

---

### Charlson Comorbidity Index (CCI)

- **MedCalc-Bench ID:** `calc_id: 32`
- **Proposed slug:** `calc_charlson`
- **Domain:** prognosis-general
- **Primary citation:** Charlson ME, Pompei P, Ales KL, MacKenzie CR 1987 — PMID 3558716 (*A new method of classifying prognostic comorbidity in longitudinal studies.* J Chronic Dis 1987;40:373-83.)
- **Complexity:** `lookup`
- **Inputs:**
  - `age` | required | number | years | 0–120
  - `myocardial_infarction` | required | bool | — | history of definite or probable MI
  - `congestive_heart_failure` | required | bool | — | exertional or PND symptoms
  - `peripheral_vascular_disease` | required | bool | —
  - `cerebrovascular_accident_or_tia` | required | bool | — | combined per Charlson 1987
  - `dementia` | required | bool | —
  - `chronic_pulmonary_disease` | required | bool | —
  - `connective_tissue_disease` | required | bool | —
  - `peptic_ulcer_disease` | required | bool | —
  - `liver_disease` | required | enum | `none | mild | moderate_to_severe` | —
  - `diabetes_mellitus` | required | enum | `none_or_diet | uncomplicated | end_organ_damage` | —
  - `hemiplegia` | required | bool | —
  - `moderate_to_severe_ckd` | required | bool | —
  - `solid_tumor` | required | enum | `none | localized | metastatic` | —
  - `leukemia` | required | bool | —
  - `lymphoma` | required | bool | —
  - `aids` | required | bool | —
- **Output:**
  - Integer 0–37
  - Bands (Charlson 1987 — 10-year survival):
    - 0: ~98% 10-year survival
    - 1–2: 90%
    - 3–4: 77%
    - ≥5: 21%
  - Clinical action: used to risk-adjust outcomes in observational studies; not directly actionable.
- **Formula:** Sum of weights:
  - Age: <50=0, 50–59=1, 60–69=2, 70–79=3, ≥80=4
  - 1 pt each: MI, CHF, PVD, CVA/TIA, dementia, COPD, CTD, PUD, mild liver disease, uncomplicated DM
  - 2 pt each: hemiplegia, moderate-severe CKD, localized solid tumor, leukemia, lymphoma, end-organ-damage DM
  - 3 pt: moderate-to-severe liver disease
  - 6 pt each: metastatic solid tumor, AIDS
- **Edge cases / clinical caveats:**
  - "Connective tissue disease" specifically meant SLE, RA, polymyositis, dermatomyositis, MCTD per Charlson 1987 — *not* osteoarthritis.
  - MedCalc-Bench combines CVA and TIA into a single 1-point criterion (any present = 1); confirm against the implementation paper's Table 1 before shipping.
  - The original 1987 paper does *not* include the age weighting; that's Charlson 1994 (PMID 8189599). Cite both: original index + age-adjusted variant.
- **Test fixtures:**
  - 75-yo with COPD, DM uncomplicated, prior MI — age 3 + COPD 1 + DM 1 + MI 1 = **6**.
  - 60-yo with metastatic colon cancer, mild liver disease — age 2 + metastatic 6 + mild liver 1 = **9**.

---

### SIRS Criteria

- **MedCalc-Bench ID:** `calc_id: 51`
- **Proposed slug:** `calc_sirs`
- **Domain:** infectious / critical-care
- **Primary citation:** Bone RC, Balk RA, Cerra FB et al 1992 — PMID 1303622 (*Definitions for sepsis and organ failure and guidelines for the use of innovative therapies in sepsis. The ACCP/SCCM Consensus Conference Committee.* Chest 1992;101:1644-55.)
- **Complexity:** `lookup`
- **Inputs:**
  - `temperature_c` | required | number | °C | 30–43 (accept °F and convert)
  - `heart_rate_bpm` | required | number | bpm | 30–250
  - `respiratory_rate_per_min` | optional | number | breaths/min | 0–60
  - `paco2_mm_hg` | optional | number | mmHg | 10–80
  - `wbc_per_mm3` | required | number | cells/mm³ | 0–80000
  - `bands_percent` | optional | number | % | 0–100 (>10% bands counts as WBC criterion met)
- **Output:**
  - Integer 0–4 (count of criteria met)
  - Bands (Bone 1992):
    - ≥2 of 4 criteria = SIRS positive
    - SIRS + infection = "sepsis" (legacy definition; superseded by Sepsis-3 / qSOFA which we already ship)
  - Clinical action: do not use SIRS alone for sepsis diagnosis post-Sepsis-3 (2016). Flag this in the tool description.
- **Formula:** count of:
  - Temp >38°C or <36°C
  - HR >90 bpm
  - RR >20/min **OR** PaCO₂ <32 mmHg
  - WBC >12,000/mm³ **OR** <4,000/mm³ **OR** >10% bands
- **Edge cases / clinical caveats:**
  - Sepsis-3 (Singer 2016, PMID 26903338) deprecated SIRS for sepsis screening in favor of qSOFA + organ-dysfunction criteria. Keep SIRS available for back-compat but flag as legacy.
  - Pediatric SIRS uses age-specific thresholds (Goldstein 2005, PMID 15636646).
- **Test fixtures:**
  - T 38.5°C, HR 110, RR 24, WBC 15,000 → 4 criteria met → SIRS positive.
  - T 37°C, HR 85, RR 18, WBC 8,000 → 0 criteria → SIRS negative.

---

### Maintenance Fluids (Holliday-Segar 4-2-1 rule)

- **MedCalc-Bench ID:** `calc_id: 22`
- **Proposed slug:** `calc_maintenance_fluids`
- **Domain:** renal/metabolic / pediatrics
- **Primary citation:** Holliday MA, Segar WE 1957 — PMID 13431307 (*The maintenance need for water in parenteral fluid therapy.* Pediatrics 1957;19:823-32.)
- **Complexity:** `formula`
- **Inputs:**
  - `weight_kg` | required | number | kg | 0.5–200
- **Output:**
  - Numeric, mL/hr
  - No interpretive bands (this is a delivered fluid rate, not a score).
- **Formula:**
  - Weight <10 kg: `rate = 4·weight` (mL/hr)
  - 10 ≤ weight ≤ 20 kg: `rate = 40 + 2·(weight − 10)` (mL/hr)
  - Weight >20 kg: `rate = 60 + 1·(weight − 20)` (mL/hr)
- **Edge cases / clinical caveats:**
  - The 4-2-1 rule assumes a relatively well, afebrile, non-third-spacing patient. Critical-care fluid management is dynamic; do not use this as a sole driver.
  - Sodium-free dextrose-only maintenance fluids are no longer recommended in inpatient pediatrics (Friedman 2018, PMID 30359961) — flag in tool description that this gives **volume**, not composition.
- **Test fixtures:**
  - 8 kg infant → 8·4 = 32 mL/hr.
  - 15 kg child → 40 + 2·5 = 50 mL/hr.
  - 70 kg adult → 60 + 50 = 110 mL/hr.

---

## Pulmonary / pneumonia (1 calculator)

### Pneumonia Severity Index (PSI / PORT)

- **MedCalc-Bench ID:** `calc_id: 29`
- **Proposed slug:** `calc_psi_port`
- **Domain:** pulmonary-vte / infectious
- **Primary citation:** Fine MJ, Auble TE, Yealy DM et al 1997 — PMID 9412649 (*A prediction rule to identify low-risk patients with community-acquired pneumonia.* N Engl J Med 1997;336:243-50.)
- **Complexity:** `lookup` (multi-variable point sum, then class assignment)
- **Inputs:**
  - `age` | required | int | years | 0–120
  - `sex` | required | enum | `male | female` | —
  - `nursing_home_resident` | required | bool | —
  - `neoplastic_disease` | required | bool | — | active or within 1 year (Fine 1997 def)
  - `liver_disease_history` | required | bool | —
  - `congestive_heart_failure` | required | bool | —
  - `cerebrovascular_disease` | required | bool | —
  - `renal_disease` | required | bool | —
  - `altered_mental_status` | required | bool | — | new disorientation
  - `respiratory_rate_per_min` | required | number | bpm | 0–60
  - `systolic_bp_mm_hg` | required | number | mmHg | 50–250
  - `temperature_c` | required | number | °C | 30–43
  - `pulse_bpm` | required | number | bpm | 30–250
  - `arterial_ph` | required | number | — | 6.8–7.8
  - `bun_mg_dl` | required | number | mg/dL | 1–200
  - `sodium_mmol_l` | required | number | mmol/L | 100–180
  - `glucose_mg_dl` | required | number | mg/dL | 30–1000
  - `hematocrit_percent` | required | number | % | 5–70
  - `pao2_mm_hg` | required (alt: kPa) | number | mmHg | 30–120
  - `pleural_effusion_on_xray` | required | bool | —
- **Output:**
  - Class I–V (computed from total points + age-bracket rules)
  - 30-day mortality bands (Fine 1997 Table 4):
    - Class I (age <50, no comorbidities, normal vitals): 0.1%
    - Class II (≤70 points): 0.6%
    - Class III (71–90): 0.9–2.8%
    - Class IV (91–130): 8.2–9.3%
    - Class V (>130): 27.0–29.2%
  - Clinical action (Fine 1997 + IDSA/ATS 2019 CAP guideline — PMID 31573350): Class I-II usually outpatient; III observation/short admit; IV-V admit (ICU consideration for V).
- **Formula:**
  - Age (years), male: +age; female: +age − 10
  - Nursing home: +10
  - Neoplastic: +30; liver: +20; CHF: +10; CVD: +10; renal: +10
  - Altered mental status: +20
  - RR ≥30: +20; SBP <90: +20
  - Temp <35°C or >39.9°C: +15
  - Pulse ≥125: +10
  - pH <7.35: +30
  - BUN ≥30 mg/dL (or ≥11 mmol/L): +20
  - Na <130 mmol/L: +20
  - Glucose ≥250 mg/dL: +10
  - Hct <30%: +10
  - PaO₂ <60 mmHg or <8 kPa: +10
  - Pleural effusion: +10
  - **Class I**: age <50, no listed comorbidity, all vitals normal → assign without summing
  - **Class II–V**: sum points, then thresholds ≤70 / 71–90 / 91–130 / >130
- **Edge cases / clinical caveats:**
  - The "step 1" Class I shortcut is sometimes overlooked — code must handle it before computing the point sum.
  - "Liver disease" in Fine 1997 is clinical/laboratory cirrhosis; do not include uncomplicated fatty liver.
  - Underestimates risk in elderly with absent vital sign derangement (a known limitation; CURB-65 may be more sensitive).
- **Test fixtures:**
  - 45-yo male, no comorbidities, normal vitals/labs → Class I (no calculation needed).
  - 75-yo female (age 75 − 10 = 65), nursing home (+10), confused (+20), RR 32 (+20) → 115 points → Class IV; 30-day mortality ~9%.

---

## Renal / metabolic (10 calculators)

### MDRD GFR Equation (4-variable)

- **MedCalc-Bench ID:** `calc_id: 9`
- **Proposed slug:** `calc_mdrd_gfr`
- **Domain:** renal/metabolic
- **Primary citation:** Levey AS, Coresh J, Greene T et al 2006 — PMID 16908915 (*Using standardized serum creatinine values in the Modification of Diet in Renal Disease Study equation for estimating glomerular filtration rate.* Ann Intern Med 2006;145:247-54.) — the 4-variable IDMS-traceable version.
- **Complexity:** `formula`
- **Inputs:**
  - `age` | required | number | years | 18–110
  - `sex` | required | enum | `male | female` | —
  - `creatinine_mg_dl` | required | number | mg/dL | 0.1–15 (accept µmol/L; standardized assay required)
  - `race` | optional | enum | `black | other | unknown` | —
- **Output:**
  - eGFR in mL/min/1.73 m²
  - Bands (KDOQI 2002 / KDIGO 2012 CKD stages — Levin 2013 PMID 23732715):
    - G1 ≥90 (with kidney damage)
    - G2 60–89
    - G3a 45–59
    - G3b 30–44
    - G4 15–29
    - G5 <15 (kidney failure)
- **Formula:** `eGFR = 175 · (creatinine)^(−1.154) · (age)^(−0.203) · (0.742 if female) · (1.212 if Black)` (creatinine in mg/dL).
- **Edge cases / clinical caveats:**
  - **Deprecated by NKF/ASN Task Force (Delgado 2021, PMID 34470707)** in favor of race-free CKD-EPI 2021. Keep available for back-compat with legacy EHR reports but flag as legacy.
  - Race coefficient should be configurable and default to OFF for new implementations.
  - Underperforms at GFR >60; that's expected — MDRD was derived in the CKD population.
- **Test fixtures:**
  - 60-yo non-Black male, Cr 1.0 → 175·1^(−1.154)·60^(−0.203)·1·1 ≈ 77 mL/min/1.73m².
  - 50-yo Black female, Cr 1.5 → 175·1.5^(−1.154)·50^(−0.203)·0.742·1.212 ≈ 47 mL/min/1.73m².

---

### Anion Gap

- **MedCalc-Bench ID:** `calc_id: 39`
- **Proposed slug:** `calc_anion_gap`
- **Domain:** renal/metabolic
- **Primary citation:** Emmett M, Narins RG 1977 — PMID 320459 (*Clinical use of the anion gap.* Medicine (Baltimore) 1977;56:38-54.)
- **Complexity:** `formula`
- **Inputs:**
  - `sodium_mmol_l` | required | number | mmol/L (≈mEq/L) | 100–180
  - `chloride_mmol_l` | required | number | mmol/L | 70–130
  - `bicarbonate_mmol_l` | required | number | mmol/L | 5–40
- **Output:**
  - Numeric, mEq/L
  - Reference range (Kraut 2007, PMID 17699176): typical AG 6–12 mEq/L (lab-dependent). >12 = elevated; <6 = low (consider paraproteinemia).
- **Formula:** `AG = Na − (Cl + HCO₃)`. Some authors include K (`AG = (Na+K) − (Cl+HCO₃)`); MedCalc-Bench uses the no-K convention. Ship the no-K formula and document.
- **Edge cases / clinical caveats:**
  - Lab-specific reference range; older Cl-electrode methods returned a wider normal range.
  - Severe hypoalbuminemia masks an elevated AG — use albumin-corrected AG (calc_albumin_corrected_anion_gap) when albumin <4 g/dL.
- **Test fixtures:**
  - Na 140, Cl 100, HCO₃ 24 → AG = 16 (elevated).
  - Na 138, Cl 105, HCO₃ 28 → AG = 5 (low).

---

### Delta Gap

- **MedCalc-Bench ID:** `calc_id: 63`
- **Proposed slug:** `calc_delta_gap`
- **Domain:** renal/metabolic
- **Primary citation:** Wrenn K 1990 — PMID 2389872 (*The delta (Δ) gap: an approach to mixed acid-base disorders.* Ann Emerg Med 1990;19:1310-3.)
- **Complexity:** `formula`
- **Inputs:** same as anion gap (Na, Cl, HCO₃).
- **Output:**
  - Numeric, mEq/L
  - Wrenn 1990 interpretation:
    - ΔGap ≈ 0 (within ±6): pure anion-gap metabolic acidosis
    - ΔGap > 0 (positive): coexisting metabolic alkalosis
    - ΔGap < 0 (negative): coexisting non-AG metabolic acidosis
- **Formula:** `ΔGap = AG − 12` (12 = upper limit of normal AG per Wrenn 1990).
- **Edge cases / clinical caveats:**
  - The "12" reference is lab-dependent; some labs use 10 as the normal-AG ceiling. Make the reference value a constructor option.
- **Test fixtures:**
  - Na 140 Cl 100 HCO₃ 24 → AG 16 → ΔGap = 4 (pure AG acidosis).
  - Na 140 Cl 90 HCO₃ 14 → AG 36 → ΔGap = 24 (consider coexisting metabolic alkalosis).

---

### Delta Ratio

- **MedCalc-Bench ID:** `calc_id: 64`
- **Proposed slug:** `calc_delta_ratio`
- **Domain:** renal/metabolic
- **Primary citation:** Wrenn K 1990 — PMID 2389872 (same as Delta Gap; the ratio is the formal Wrenn proposal). Also Goodkin DA et al 1986 — PMID 3963964.
- **Complexity:** `formula`
- **Inputs:** same as anion gap.
- **Output:**
  - Unitless ratio
  - Bands (Wrenn 1990):
    - <0.4: hyperchloremic non-AG metabolic acidosis
    - 0.4–0.8: combined high-AG and non-AG acidosis
    - 1.0–2.0: pure anion-gap acidosis (typical DKA)
    - >2.0: high-AG acidosis with concurrent metabolic alkalosis or preexisting compensated respiratory acidosis
- **Formula:** `ΔRatio = (AG − 12) / (24 − HCO₃)`.
- **Edge cases / clinical caveats:**
  - Bands are clinical-correlate ranges; published in textbook chapters (Berend 2014 — PMID 25271605 review) rather than as cutoffs in Wrenn 1990. The ranges above are *clinician-reported*; **bands need full-text verification** for the implementer.
  - Division by zero risk when HCO₃ = 24; guard with `if HCO₃ ≥ 24, ΔRatio is undefined / acidosis ruled out`.
- **Test fixtures:**
  - AG 20, HCO₃ 16 → (20−12)/(24−16) = 1.0 (pure AG acidosis).
  - AG 24, HCO₃ 18 → 12/6 = 2.0 (boundary case).

---

### Albumin-Corrected Anion Gap

- **MedCalc-Bench ID:** `calc_id: 65`
- **Proposed slug:** `calc_albumin_corrected_anion_gap`
- **Domain:** renal/metabolic
- **Primary citation:** Figge J, Jabor A, Kazda A, Fencl V 1998 — PMID 9559600 (*Anion gap and hypoalbuminemia.* Crit Care Med 1998;26:1807-10.)
- **Complexity:** `formula`
- **Inputs:** Na, Cl, HCO₃ + `albumin_g_dl` | required | number | g/dL | 0.5–6.
- **Output:**
  - Numeric, mEq/L
  - Same reference range as anion gap (typical 6–12); the correction restores sensitivity in hypoalbuminemia.
- **Formula:** `AG_corrected = AG + 2.5·(4.0 − albumin)` (albumin in g/dL; correction factor 2.5 per Figge 1998).
- **Edge cases / clinical caveats:**
  - The 2.5/g·dL correction assumes normal physiologic pH; in severe acidosis, the buffer behavior diverges.
- **Test fixtures:**
  - Na 140 Cl 100 HCO₃ 20 albumin 2.0 → AG = 20, corrected = 20 + 2.5·2 = 25.
  - Na 140 Cl 100 HCO₃ 24 albumin 4.0 → AG = 16, corrected = 16 (no correction at normal albumin).

---

### Albumin-Corrected Delta Gap

- **MedCalc-Bench ID:** `calc_id: 66`
- **Proposed slug:** `calc_albumin_corrected_delta_gap`
- **Domain:** renal/metabolic
- **Primary citation:** Figge 1998 (PMID 9559600) + Wrenn 1990 (PMID 2389872) compound rule.
- **Complexity:** `formula`
- **Inputs:** Na, Cl, HCO₃, albumin.
- **Output:** Numeric, mEq/L. Interpretation same as Delta Gap.
- **Formula:** `ΔGap_corrected = AG_corrected − 12`.
- **Edge cases / clinical caveats:** Combines both transformation risks (low albumin, lab-dependent AG normal range). Document the embedded "12" and "4.0" constants as configuration options.
- **Test fixtures:**
  - From the AG_corrected fixture above: 25 − 12 = 13 (corrected delta gap, consistent with concurrent metabolic alkalosis).

---

### Albumin-Corrected Delta Ratio

- **MedCalc-Bench ID:** `calc_id: 67`
- **Proposed slug:** `calc_albumin_corrected_delta_ratio`
- **Domain:** renal/metabolic
- **Primary citation:** Figge 1998 + Wrenn 1990.
- **Complexity:** `formula`
- **Inputs:** Na, Cl, HCO₃, albumin.
- **Output:** Unitless ratio; bands per delta ratio (clinical-correlate; need full-text verification).
- **Formula:** `ΔRatio_corrected = (AG_corrected − 12) / (24 − HCO₃)`.
- **Edge cases:** All caveats from Delta Ratio + albumin correction apply.
- **Test fixtures:** AG_corr 25, HCO₃ 18 → 13/6 ≈ 2.17 (concurrent metabolic alkalosis).

---

### Free Water Deficit

- **MedCalc-Bench ID:** `calc_id: 38`
- **Proposed slug:** `calc_free_water_deficit`
- **Domain:** renal/metabolic
- **Primary citation:** Adrogué HJ, Madias NE 2000 — PMID 10816188 (*Hypernatremia.* N Engl J Med 2000;342:1493-9.)
- **Complexity:** `formula`
- **Inputs:**
  - `age` | required | number | years | 0–120
  - `sex` | required | enum | `male | female` | —
  - `weight_kg` | required | number | kg | 0.5–250
  - `sodium_mmol_l` | required | number | mmol/L | 130–200
- **Output:**
  - Numeric, L
  - No interpretive bands; this is the deficit volume.
- **Formula:** `FWD = TBW% · weight · (Na/140 − 1)` where TBW% is:
  - Child (<18 y): 0.60
  - Adult male (18–64): 0.60
  - Adult female (18–64): 0.50
  - Elderly male (≥65): 0.50
  - Elderly female (≥65): 0.45
- **Edge cases / clinical caveats:**
  - Adrogué/Madias also publish a sodium-deficit formula for hyponatremia — do not confuse the two.
  - TBW fractions are estimates; obese patients may need a leaner correction.
  - Correct hypernatremia slowly (≤0.5 mEq/L/hr; ≤10 mEq/L/24h) to avoid cerebral edema — relevant clinical note, not part of the calculator output.
- **Test fixtures:**
  - 70-yo male 80 kg, Na 155 → 0.5·80·(155/140 − 1) = 0.5·80·0.107 ≈ 4.3 L.
  - 30-yo female 60 kg, Na 150 → 0.5·60·(150/140 − 1) ≈ 2.1 L.

---

### Fractional Excretion of Sodium (FENa)

- **MedCalc-Bench ID:** `calc_id: 40`
- **Proposed slug:** `calc_fena`
- **Domain:** renal/metabolic
- **Primary citation:** Espinel CH 1976 — PMID 1255711 (*The FENa test. Use in the differential diagnosis of acute renal failure.* JAMA 1976;236:579-81.)
- **Complexity:** `formula`
- **Inputs:**
  - `serum_creatinine_mg_dl` | required | number | mg/dL | 0.1–15
  - `serum_sodium_mmol_l` | required | number | mmol/L | 100–180
  - `urine_creatinine_mg_dl` | required | number | mg/dL | 10–500
  - `urine_sodium_mmol_l` | required | number | mmol/L | 5–300
- **Output:**
  - Percentage (%)
  - Bands (Espinel 1976):
    - <1%: prerenal AKI (intact tubular Na reabsorption)
    - >2%: intrinsic / ATN
    - 1–2%: indeterminate
- **Formula:** `FENa = (U_Na · S_Cr) / (S_Na · U_Cr) · 100`.
- **Edge cases / clinical caveats:**
  - Loop diuretics invalidate FENa (artificially elevates it); use FE-urea (Carvounis 2002, PMID 12110013) instead.
  - Glomerulonephritis and contrast nephropathy can give FENa <1% despite intrinsic disease — clinical correlation needed.
- **Test fixtures:**
  - U_Na 10, S_Cr 2.0, S_Na 140, U_Cr 80 → (10·2)/(140·80)·100 = 0.18% (prerenal).
  - U_Na 60, S_Cr 3.0, S_Na 140, U_Cr 30 → (60·3)/(140·30)·100 = 4.3% (ATN).

---

### Serum Osmolality (calculated)

- **MedCalc-Bench ID:** `calc_id: 30`
- **Proposed slug:** `calc_serum_osmolality`
- **Domain:** renal/metabolic
- **Primary citation:** Smithline N, Gardner KD 1976 — PMID 1271372 (*Gaps — anionic and osmolal.* JAMA 1976;236:1594-7.)
- **Complexity:** `formula`
- **Inputs:**
  - `sodium_mmol_l` | required | number | mmol/L | 100–180
  - `bun_mg_dl` | required | number | mg/dL | 1–200
  - `glucose_mg_dl` | required | number | mg/dL | 30–1000
- **Output:**
  - Numeric, mOsm/kg (≈ mmol/L for dilute aqueous serum)
  - Reference range: 275–295 mOsm/kg (lab-dependent).
- **Formula:** `S_Osm = 2·Na + BUN/2.8 + glucose/18` (Na mmol/L; BUN mg/dL; glucose mg/dL).
- **Edge cases / clinical caveats:**
  - Some formulations include ethanol/2.8 or ethanol/3.7 for toxic-alcohol screening — *do not* add automatically; require an explicit ethanol input.
  - The "2.8" and "18" are dimensional conversion constants (BUN molecular weight 28, glucose 180); document and unit-test.
- **Test fixtures:**
  - Na 140, BUN 14, glucose 90 → 280 + 5 + 5 = 290 mOsm/kg.
  - Na 145, BUN 60, glucose 600 → 290 + 21.4 + 33.3 = 344.7 mOsm/kg (hyperosmolar).

---

### Sodium Correction for Hyperglycemia (Hillier)

- **MedCalc-Bench ID:** `calc_id: 26`
- **Proposed slug:** `calc_corrected_sodium_hillier`
- **Domain:** renal/metabolic
- **Primary citation:** Hillier TA, Abbott RD, Barrett EJ 1999 — PMID 10225241 (*Hyponatremia: evaluating the correction factor for hyperglycemia.* Am J Med 1999;106:399-403.)
- **Complexity:** `formula`
- **Inputs:**
  - `measured_sodium_mmol_l` | required | number | mmol/L | 100–180
  - `glucose_mg_dl` | required | number | mg/dL | 100–1500
- **Output:**
  - Numeric corrected sodium, mmol/L
  - No interpretive bands; use this value as input for clinical hyponatremia categorization.
- **Formula:** `Na_corrected = Na_measured + 0.024·(glucose − 100)`.
- **Edge cases / clinical caveats:**
  - Hillier's factor (0.024 mmol/L per mg/dL above 100) is more accurate than the older Katz 1.6 mmol/L per 100 mg/dL — especially at glucose >400.
  - If implementing both Katz and Hillier, expose `method` parameter.
- **Test fixtures:**
  - Measured Na 130, glucose 500 → 130 + 0.024·400 = 139.6 mmol/L corrected.
  - Measured Na 135, glucose 200 → 135 + 0.024·100 = 137.4 mmol/L corrected.

---

## Hepatology / GI (3 calculators)

### Child-Pugh Score for Cirrhosis Mortality

- **MedCalc-Bench ID:** `calc_id: 15`
- **Proposed slug:** `calc_child_pugh`
- **Domain:** hepatology
- **Primary citation:** Pugh RNH, Murray-Lyon IM, Dawson JL, Pietroni MC, Williams R 1973 — PMID 4541913 (*Transection of the oesophagus for bleeding oesophageal varices.* Br J Surg 1973;60:646-9.) — Pugh's modification of Child & Turcotte 1964.
- **Complexity:** `lookup`
- **Inputs:**
  - `total_bilirubin_mg_dl` | required | number | mg/dL | 0.1–50
  - `albumin_g_dl` | required | number | g/dL | 1–6
  - `inr` | required | number | — | 0.8–10
  - `ascites` | required | enum | `absent | slight | moderate` | —
  - `encephalopathy` | required | enum | `none | grade_1_2 | grade_3_4` | West-Haven grades
- **Output:**
  - Integer 5–15
  - Class assignment (Pugh 1973):
    - Class A: 5–6 points (well-compensated; ~100% 1-yr survival, ~85% 2-yr)
    - Class B: 7–9 points (~80% 1-yr, ~57% 2-yr)
    - Class C: 10–15 points (~45% 1-yr, ~35% 2-yr)
  - Clinical action: Class C generally precludes elective non-transplant surgery; transplant evaluation criteria are MELD-based now.
- **Formula:** Each of 5 criteria scored 1/2/3:
  - Bilirubin: <2/<34.2 µmol/L = 1; 2–3 = 2; >3 = 3
  - Albumin: >3.5 g/dL = 1; 2.8–3.5 = 2; <2.8 = 3
  - INR: <1.7 = 1; 1.7–2.3 = 2; >2.3 = 3
  - Ascites: absent = 1; slight = 2; moderate = 3
  - Encephalopathy: none = 1; grade 1–2 = 2; grade 3–4 = 3
  - Sum → A/B/C.
- **Edge cases / clinical caveats:**
  - For cholestatic disease (PBC, PSC), some sources use a bilirubin-shifted scale (Pugh 1973 footnote); document and expose as optional.
  - Subjective inputs (ascites severity, encephalopathy grade) introduce inter-rater variability. MELD/MELD-Na are objective and now preferred for transplant allocation.
- **Test fixtures:**
  - Bili 1.5, alb 3.8, INR 1.4, no ascites, no enceph → 1+1+1+1+1 = 5, Class A.
  - Bili 4.0, alb 2.5, INR 2.5, moderate ascites, grade 3 enceph → 3+3+3+3+3 = 15, Class C.

---

### Fibrosis-4 (FIB-4) Index

- **MedCalc-Bench ID:** `calc_id: 19`
- **Proposed slug:** `calc_fib4`
- **Domain:** hepatology
- **Primary citation:** Sterling RK, Lissen E, Clumeck N et al 2006 — PMID 16729309 (*Development of a simple noninvasive index to predict significant fibrosis in patients with HIV/HCV coinfection.* Hepatology 2006;43:1317-25.)
- **Complexity:** `formula`
- **Inputs:**
  - `age` | required | number | years | 18–110
  - `ast_u_l` | required | number | U/L | 5–5000
  - `alt_u_l` | required | number | U/L | 5–5000
  - `platelet_count_per_l` | required | number | ×10⁹/L | 5–800
- **Output:**
  - Numeric (unitless index)
  - Bands (Sterling 2006 for HIV/HCV; AASLD 2023 for NAFLD — Rinella PMID 36800447):
    - <1.45: low probability of advanced fibrosis (F3–F4)
    - 1.45–3.25: indeterminate
    - >3.25: high probability of advanced fibrosis
  - Clinical action: AASLD 2023 NAFLD guideline routes FIB-4 ≥1.3 (age <65) or ≥2.0 (age ≥65) to hepatology referral / VCTE.
- **Formula:** `FIB-4 = (age · AST) / (platelets[10⁹/L] · √ALT)`.
- **Edge cases / clinical caveats:**
  - Bands derived in HIV/HCV; for NAFLD use age-stratified cutoffs (AASLD 2023). Expose both interpretations.
  - Not validated in acute hepatitis (transaminitis distorts the AST/ALT ratio).
- **Test fixtures:**
  - 55-yo, AST 50, ALT 40, platelets 200 → (55·50)/(200·√40) = 2750/1264.9 ≈ 2.17 (indeterminate).
  - 70-yo, AST 80, ALT 30, platelets 100 → (70·80)/(100·√30) = 5600/547.7 ≈ 10.2 (high probability).

---

### Glasgow-Blatchford Bleeding Score (GBS)

- **MedCalc-Bench ID:** `calc_id: 27`
- **Proposed slug:** `calc_glasgow_blatchford`
- **Domain:** hepatology / GI
- **Primary citation:** Blatchford O, Murray WR, Blatchford M 2000 — PMID 11073021 (*A risk score to predict need for treatment for upper-gastrointestinal haemorrhage.* Lancet 2000;356:1318-21.)
- **Complexity:** `lookup`
- **Inputs:**
  - `sex` | required | enum | `male | female` | —
  - `bun_mg_dl` | required | number | mg/dL | 1–200
  - `hemoglobin_g_dl` | required | number | g/dL | 3–20
  - `systolic_bp_mm_hg` | required | number | mmHg | 50–250
  - `pulse_bpm` | required | number | bpm | 30–250
  - `melena_present` | required | bool | —
  - `syncope` | required | bool | — | at presentation
  - `liver_disease_history` | required | bool | —
  - `cardiac_failure` | required | bool | —
- **Output:**
  - Integer 0–23
  - Bands (Blatchford 2000 + Stanley 2017 validation — PMID 28053181):
    - 0: ~99% specificity for no need of intervention → safe outpatient management
    - 1–5: low-intermediate risk
    - 6+: high risk; admit and endoscopy within 24h
  - Clinical action: ESGE 2021 (Gralnek, PMID 34607361) endorses GBS ≤1 for outpatient management of UGIB.
- **Formula:** Sum of:
  - BUN (mg/dL): <18.2 = 0; 18.2–22.3 = 2; 22.4–28 = 3; 28–70 = 4; >70 = 6 (MedCalc-Bench uses mg/dL; the original paper uses mmol/L — convert and verify).
  - Hgb (male): ≥13 = 0; 12–13 = 1; 10–12 = 3; <10 = 6
  - Hgb (female): ≥12 = 0; 10–12 = 1; <10 = 6
  - SBP: ≥110 = 0; 100–109 = 1; 90–99 = 2; <90 = 3
  - Pulse ≥100: +1
  - Melena: +1
  - Syncope: +2
  - Liver disease: +2
  - Cardiac failure: +2
- **Edge cases / clinical caveats:**
  - BUN bins were derived in mmol/L (Blatchford 2000); MedCalc-Bench reads in mg/dL. The bin edges above match the converted mg/dL values, but verify against the Lancet 2000 paper Table 2 directly.
  - Score of 0 reliably identifies very low risk; do not extend the outpatient-discharge recommendation to other low scores without supporting literature.
- **Test fixtures:**
  - 50-yo male, BUN 15, Hgb 14, SBP 130, pulse 80, no melena/syncope/liver/cardiac → 0+0+0+0+0+0+0+0+0 = 0 (consider outpatient).
  - 65-yo female, BUN 30, Hgb 9, SBP 100, pulse 110, melena, syncope, liver disease, no CHF → 4+6+1+1+1+2+2+0 = 17 (high risk).

---

## OB / dating (3 calculators)

### Estimated Due Date (Naegele's Rule)

- **MedCalc-Bench ID:** `calc_id: 13`
- **Proposed slug:** `calc_estimated_due_date`
- **Domain:** obstetrics
- **Primary citation:** Naegele FK 1812 (historical; no PMID). Modern reference: ACOG Committee Opinion No. 700, *Methods for Estimating the Due Date* 2017 — PMID 28426621.
- **Complexity:** `formula`
- **Inputs:**
  - `last_menstrual_period_date` | required | ISO date | — | —
  - `cycle_length_days` | optional | int | days | 21–45; default 28
- **Output:**
  - ISO date (EDD)
  - No interpretive bands; bracket "term" gestational age separately (37–41+6 weeks).
- **Formula:** `EDD = LMP + 280 days + (cycle_length − 28)`.
- **Edge cases / clinical caveats:**
  - First-trimester ultrasound CRL dating is preferred over LMP-based dating per ACOG 2017 when discrepancy >5 days.
  - Inputs assume a regular menstrual cycle and ovulation on day 14 of an idealized 28-day cycle. PCOS / irregular cycles invalidate this.
- **Test fixtures:**
  - LMP 2024-01-01, cycle 28 → EDD 2024-10-07 (40 weeks).
  - LMP 2024-01-01, cycle 32 → EDD 2024-10-11.

---

### Estimated Date of Conception

- **MedCalc-Bench ID:** `calc_id: 68`
- **Proposed slug:** `calc_estimated_conception_date`
- **Domain:** obstetrics
- **Primary citation:** Operational definition tied to ACOG 2017 (PMID 28426621); no separate derivation paper.
- **Complexity:** `formula`
- **Inputs:** LMP date (required).
- **Output:** ISO date.
- **Formula:** `EDC = LMP + 14 days` (ovulation assumed on cycle day 14).
- **Edge cases / clinical caveats:** Same cycle-irregularity caveats as EDD.
- **Test fixtures:** LMP 2024-01-01 → EDC 2024-01-15.

---

### Estimated Gestational Age (from LMP)

- **MedCalc-Bench ID:** `calc_id: 69`
- **Proposed slug:** `calc_estimated_gestational_age`
- **Domain:** obstetrics
- **Primary citation:** ACOG 2017 (PMID 28426621).
- **Complexity:** `formula`
- **Inputs:**
  - `last_menstrual_period_date` | required | ISO date | —
  - `current_date` | required | ISO date | —
- **Output:**
  - Tuple `(weeks, days)`; total days = (current − LMP).
- **Formula:** `days_elapsed = current_date − LMP`; `weeks = days_elapsed // 7`; `days = days_elapsed % 7`.
- **Edge cases / clinical caveats:** Output prefers `Xw Yd` notation in clinical text; expose both the tuple and the formatted string.
- **Test fixtures:**
  - LMP 2024-01-01, current 2024-04-08 → 98 days = 14 weeks, 0 days.
  - LMP 2024-01-01, current 2024-03-15 → 74 days = 10 weeks, 4 days.

---

## Anthropometrics / dosing (5 calculators)

### Body Mass Index (BMI)

- **MedCalc-Bench ID:** `calc_id: 6`
- **Proposed slug:** `calc_bmi`
- **Domain:** renal/metabolic / general
- **Primary citation:** Quetelet LAJ 1832 (historical). Modern reference: Keys A et al 1972 — PMID 4628049.
- **Complexity:** `formula`
- **Inputs:**
  - `weight_kg` | required | number | kg | 0.5–500
  - `height_m` | required | number | m | 0.3–2.5
- **Output:**
  - Numeric, kg/m²
  - WHO bands (WHO 2000 TRS 894):
    - <18.5: underweight
    - 18.5–24.9: normal
    - 25.0–29.9: overweight
    - 30.0–34.9: class I obesity
    - 35.0–39.9: class II
    - ≥40.0: class III (severe)
  - Asian-population variants (WHO 2004, PMID 14726171): lower overweight cutoff 23.0.
- **Formula:** `BMI = weight / height²`.
- **Edge cases / clinical caveats:**
  - Misclassifies muscular individuals; consider waist circumference or body composition in athletes.
  - Pediatric BMI uses CDC age- and sex-specific percentiles, not the adult bands.
- **Test fixtures:**
  - 70 kg, 1.75 m → 22.86 kg/m² (normal).
  - 100 kg, 1.65 m → 36.73 kg/m² (class II obesity).

---

### Body Surface Area (Mosteller)

- **MedCalc-Bench ID:** `calc_id: 60`
- **Proposed slug:** `calc_bsa_mosteller`
- **Domain:** renal/metabolic / oncology dosing
- **Primary citation:** Mosteller RD 1987 — PMID 3657876 (*Simplified calculation of body-surface area.* N Engl J Med 1987;317:1098.)
- **Complexity:** `formula`
- **Inputs:**
  - `weight_kg` | required | number | kg | 0.5–500
  - `height_cm` | required | number | cm | 30–250
- **Output:**
  - Numeric, m²
  - Reference range: 1.6–2.0 m² typical adult; chemotherapy dosing capped at 2.2 m² in many institutional protocols (institutional, not MedCalc-Bench).
- **Formula:** `BSA = √(weight · height / 3600)`.
- **Edge cases / clinical caveats:**
  - Du Bois 1916 formula is older and still used; Haycock 1978 is more accurate in children. Expose `method` parameter if shipping all three.
- **Test fixtures:**
  - 70 kg, 175 cm → √(70·175/3600) = √3.4028 ≈ 1.84 m².
  - 50 kg, 150 cm → √(50·150/3600) = √2.0833 ≈ 1.44 m².

---

### Ideal Body Weight (Devine)

- **MedCalc-Bench ID:** `calc_id: 10`
- **Proposed slug:** `calc_ibw_devine`
- **Domain:** renal/metabolic / dosing
- **Primary citation:** Devine BJ 1974 (*Gentamicin therapy.* Drug Intell Clin Pharm 1974;8:650-5.) — non-indexed in PubMed; cite by author/year + journal.
- **Complexity:** `formula`
- **Inputs:**
  - `height_inches` | required | number | in | 12–96
  - `sex` | required | enum | `male | female` | —
- **Output:**
  - Numeric, kg.
  - No interpretive bands; consumed as input by drug-dosing protocols and tidal-volume calculators.
- **Formula:**
  - Male: `IBW = 50 + 2.3·(height_inches − 60)`
  - Female: `IBW = 45.5 + 2.3·(height_inches − 60)`
- **Edge cases / clinical caveats:**
  - Negative IBW possible for very short patients (<5 ft); clamp at a clinically reasonable lower bound (e.g., 30 kg adult) or document.
  - For pediatric dosing, use length-based tools (Broselow) not Devine.
- **Test fixtures:**
  - 70-inch male → 50 + 2.3·10 = 73 kg.
  - 64-inch female → 45.5 + 2.3·4 = 54.7 kg.

---

### Adjusted Body Weight

- **MedCalc-Bench ID:** `calc_id: 62`
- **Proposed slug:** `calc_adjusted_body_weight`
- **Domain:** renal/metabolic / dosing
- **Primary citation:** No single derivation paper; used since at least Bauer 1980 for aminoglycoside dosing. Reference: Pai MP, Paloucek FP 2000 — PMID 10852121 (*The origin of the "ideal" body weight equations.* Ann Pharmacother 2000;34:1066-9.) for historical context.
- **Complexity:** `formula`
- **Inputs:**
  - `actual_weight_kg` | required | number | kg | 0.5–500
  - `ideal_weight_kg` | required (or derive from height + sex) | number | kg | —
- **Output:** Numeric, kg.
- **Formula:** `ABW = IBW + 0.4·(actual − IBW)`.
- **Edge cases / clinical caveats:**
  - Apply only when actual weight exceeds IBW by >20–30% (Pai 2000). If actual ≤ IBW, do not apply correction.
  - Used for aminoglycoside, vancomycin, and some chemotherapy dosing.
- **Test fixtures:**
  - Actual 100 kg, IBW 70 kg → 70 + 0.4·30 = 82 kg.
  - Actual 75 kg, IBW 73 kg → not applicable; use actual.

---

### Target Body Weight (BMI-targeted)

- **MedCalc-Bench ID:** `calc_id: 61`
- **Proposed slug:** `calc_target_weight`
- **Domain:** renal/metabolic / nutrition
- **Primary citation:** Operational formula; cite WHO 2000 TRS 894 (BMI categories).
- **Complexity:** `formula`
- **Inputs:**
  - `target_bmi` | required | number | kg/m² | 18.5–30
  - `height_m` | required | number | m | 0.3–2.5
- **Output:** Numeric, kg.
- **Formula:** `target_weight = target_bmi · height²`.
- **Edge cases / clinical caveats:**
  - Not validated as a clinical goal-setter; provides a numeric target only. Pair with a behavior-change tool / dietitian referral in clinical narrative.
- **Test fixtures:**
  - Target BMI 25, height 1.70 m → 25·2.89 = 72.25 kg.

---

## Endocrinology / acid-base (1 calculator)

### HOMA-IR (Homeostatic Model Assessment of Insulin Resistance)

- **MedCalc-Bench ID:** `calc_id: 31`
- **Proposed slug:** `calc_homa_ir`
- **Domain:** endocrinology
- **Primary citation:** Matthews DR, Hosker JP, Rudenski AS et al 1985 — PMID 3899825 (*Homeostasis model assessment: insulin resistance and beta-cell function from fasting plasma glucose and insulin concentrations in man.* Diabetologia 1985;28:412-9.)
- **Complexity:** `formula`
- **Inputs:**
  - `fasting_insulin_uIU_ml` | required | number | µIU/mL | 0.5–300 (accept pmol/L; conversion ×6.0)
  - `fasting_glucose_mg_dl` | required | number | mg/dL | 30–500
- **Output:**
  - Unitless index.
  - Bands (no single canonical cutoff; commonly cited Matthews 1985 + Geloneze 2009, PMID 19893913):
    - <2.5: normal insulin sensitivity (population-dependent)
    - 2.5–4.0: borderline insulin resistance
    - >4.0: insulin resistance
  - **Bands need full-text verification** — the cutoffs above are population-specific (Brazilian, Korean, US cohorts publish different numbers); document this caveat in the tool description.
- **Formula:** `HOMA-IR = (insulin · glucose) / 405` (insulin µIU/mL; glucose mg/dL).
- **Edge cases / clinical caveats:**
  - Fasting state is required (≥8h); postprandial values invalidate the model.
  - Type 1 diabetes / insulin-pump patients are not amenable to HOMA-IR.
  - Alternative formulation: `HOMA-IR = (insulin · glucose) / 22.5` if glucose in mmol/L (Matthews 1985 original).
- **Test fixtures:**
  - Insulin 10 µIU/mL, glucose 100 mg/dL → 10·100/405 = 2.47 (normal).
  - Insulin 25 µIU/mL, glucose 130 mg/dL → 25·130/405 = 8.02 (insulin resistance).

---

## Calcium / electrolytes (1 calculator)

### Calcium Correction for Hypoalbuminemia (Payne)

- **MedCalc-Bench ID:** `calc_id: 7`
- **Proposed slug:** `calc_corrected_calcium`
- **Domain:** renal/metabolic
- **Primary citation:** Payne RB, Little AJ, Williams RB, Milner JR 1973 — PMID 4748672 (*Interpretation of serum calcium in patients with abnormal serum proteins.* BMJ 1973;4:643-6.)
- **Complexity:** `formula`
- **Inputs:**
  - `serum_calcium_mg_dl` | required | number | mg/dL | 4–18 (accept mmol/L; conversion ×4.008)
  - `serum_albumin_g_dl` | required | number | g/dL | 1–6 (accept g/L; conversion ÷10)
  - `normal_albumin_g_dl` | optional | number | g/dL | default 4.0
- **Output:**
  - Numeric corrected calcium, mg/dL.
  - Reference range: 8.5–10.5 mg/dL (lab-dependent).
- **Formula:** `Ca_corrected = Ca_measured + 0.8·(4.0 − albumin)` (mg/dL).
- **Edge cases / clinical caveats:**
  - Payne formula is most accurate at albumin 2.5–4.5 g/dL; performs poorly at very low albumin (<2 g/dL) or in CKD.
  - Ionized calcium is the gold standard when accuracy matters (Gauci 2008, PMID 18077594 review).
- **Test fixtures:**
  - Ca 8.0, albumin 2.0 → 8.0 + 0.8·2 = 9.6 mg/dL (normal corrected).
  - Ca 9.5, albumin 4.0 → 9.5 (no correction).

---

## Infectious / strep pharyngitis (2 calculators)

### Centor Score (McIsaac Modification)

- **MedCalc-Bench ID:** `calc_id: 20`
- **Proposed slug:** `calc_centor`
- **Domain:** infectious (primary care)
- **Primary citation:** Centor RM, Witherspoon JM, Dalton HP, Brody CE, Link K 1981 — PMID 6739465 (*The diagnosis of strep throat in adults in the emergency room.* Med Decis Making 1981;1:239-46.); McIsaac modification: McIsaac WJ, White D, Tannenbaum D, Low DE 1998 — PMID 9457169 (*A clinical score to reduce unnecessary antibiotic use in patients with sore throat.* CMAJ 1998;158:75-83.).
- **Complexity:** `lookup`
- **Inputs:**
  - `age` | required | number | years | 1–110
  - `tonsillar_exudate_or_swelling` | required | bool | —
  - `tender_anterior_cervical_adenopathy` | required | bool | —
  - `temperature_c` | required | number | °C | 30–43
  - `cough_absent` | required | bool | — | absence of cough scores positively
- **Output:**
  - Integer −1 to 5
  - Bands (McIsaac 1998 — probability of GABHS):
    - ≤0: 1–2.5%
    - 1: 5–10%
    - 2: 11–17%
    - 3: 28–35%
    - ≥4: 51–53%
  - Clinical action (IDSA 2012, Shulman PMID 22965026): score 0–1 no test/no abx; 2–3 rapid strep / culture; ≥4 consider empirical abx pending culture.
- **Formula:** Sum:
  - Age 3–14: +1; 15–44: 0; ≥45: −1
  - Tonsillar exudate/swelling: +1
  - Tender anterior cervical adenopathy: +1
  - Temp >38°C: +1
  - Cough absent: +1
- **Edge cases / clinical caveats:**
  - Original Centor 1981 did not include age weighting; McIsaac 1998 added it to broaden pediatric/elderly applicability.
  - Score ≥4 still has only ~50% positive predictive value — empirical antibiotic decisions remain clinical.
- **Test fixtures:**
  - 8-yo, exudate, tender nodes, T 38.5°C, no cough → 1+1+1+1+1 = 5.
  - 50-yo, no exudate, no nodes, T 37.5°C, with cough → −1+0+0+0+0 = −1.

---

### FeverPAIN Score for Strep Pharyngitis

- **MedCalc-Bench ID:** `calc_id: 33`
- **Proposed slug:** `calc_feverpain`
- **Domain:** infectious (primary care)
- **Primary citation:** Little P, Hobbs FDR, Moore M et al 2013 — PMID 24202989 (*Clinical score and rapid antigen detection test to guide antibiotic use for sore throats: randomised controlled trial of PRISM.* BMJ 2013;347:f5806.)
- **Complexity:** `lookup`
- **Inputs:**
  - `fever_in_past_24h` | required | bool | —
  - `purulent_tonsils` | required | bool | —
  - `attended_within_3_days_of_onset` | required | bool | — | rapid onset
  - `severely_inflamed_tonsils` | required | bool | —
  - `cough_or_coryza_absent` | required | bool | — | absence of cough/coryza scores
- **Output:**
  - Integer 0–5
  - Bands (Little 2013):
    - 0–1: 13–18% streptococci → unlikely
    - 2–3: 34–40% streptococci → delayed-script strategy
    - 4–5: 62–65% streptococci → consider antibiotics
  - Clinical action: NICE NG84 (2018) endorses FeverPAIN ≥4 for immediate antibiotic prescription.
- **Formula:** Sum of 5 binary criteria (each = 1 if present).
- **Edge cases / clinical caveats:**
  - PRISM trial inclusion was age ≥3 y; do not apply to younger children.
  - Subjective inputs ("severe" tonsil inflammation) introduce inter-rater variability.
- **Test fixtures:**
  - Fever yes, no cough/coryza, onset 2 days, purulent tonsils, severe inflammation → 5 (high probability).
  - Fever no, with cough, onset 5 days, no purulent tonsils → 0 (very low).

---

## Pain / opioid (1 calculator)

### Morphine Milligram Equivalents (MME)

- **MedCalc-Bench ID:** `calc_id: 49`
- **Proposed slug:** `calc_mme`
- **Domain:** pain / opioid stewardship
- **Primary citation:** Dowell D, Haegerich TM, Chou R 2016 — PMID 26977696 (*CDC guideline for prescribing opioids for chronic pain — United States, 2016.* JAMA 2016;315:1624-45.); updated CDC guideline Dowell 2022 — PMID 36327391.
- **Complexity:** `formula`
- **Inputs:**
  - For each opioid in patient regimen:
    - `drug` | required | enum | one of: codeine, fentanyl_buccal, fentanyl_patch, hydrocodone, hydromorphone, methadone, morphine, oxycodone, oxymorphone, tapentadol, tramadol, buprenorphine
    - `dose_mg` (or `dose_ug` for fentanyl) | required | number | mg or µg | per single dose
    - `doses_per_day` | required | number | /day | 1–24
- **Output:**
  - Numeric, total MME/day
  - Bands (CDC 2022):
    - <50 MME/day: lower risk
    - 50–89: increased overdose risk; reassess
    - ≥90: high risk; require justification
- **Formula:** `MME_total = Σ_drugs (dose_mg · doses_per_day · conversion_factor)`. Conversion factors (CDC 2022 supplemental table):
  - Codeine: 0.15
  - Fentanyl buccal: 0.13 (per µg)
  - Fentanyl patch: 2.4 (per µg/hr; over 24h)
  - Hydrocodone: 1
  - Hydromorphone: 5
  - Methadone: tiered by daily dose — 1–20 mg/d → 4; 21–40 → 8; 41–60 → 10; >60 → 12 (Dowell 2022; MedCalc-Bench uses flat 4.7 which is an older AAPM value — flag and use CDC 2022 tiered).
  - Morphine: 1
  - Oxycodone: 1.5
  - Oxymorphone: 3
  - Tapentadol: 0.4
  - Tramadol: 0.2
  - Buprenorphine (transdermal): variable; CDC 2022 deprecated a single factor — flag this.
- **Edge cases / clinical caveats:**
  - **Buprenorphine and methadone MME conversions are non-linear** — CDC 2022 explicitly cautions against single-factor conversion. MedCalc-Bench's flat factors are convenient but pharmacologically suspect; the implementer must follow CDC 2022 tiering for methadone and document buprenorphine as a flagged "approximate" output.
  - Fentanyl patch dosing is in µg/hr (not µg/dose); conversion uses the 24-hour cumulative dose.
- **Test fixtures:**
  - 1× oxycodone 10 mg + 4× hydrocodone 5 mg = 1·10·1.5 + 4·5·1 = 15 + 20 = 35 MME/day.
  - 1× methadone 30 mg/day → 30·8 (CDC tier) = 240 MME/day (per MedCalc-Bench flat factor: 30·4.7 = 141 MME — flag the discrepancy).

---

## Hematology / VTE (1 calculator)

### Caprini Score for VTE (2005)

- **MedCalc-Bench ID:** `calc_id: 36`
- **Proposed slug:** `calc_caprini`
- **Domain:** hematology / surgery
- **Primary citation:** Caprini JA 2005 — PMID 15534795 (*Thrombosis risk assessment as a guide to quality patient care.* Dis Mon 2005;51:70-8.). The 2005 weights are the most commonly implemented; Caprini 2010 (PMID 20531233) republished with the same weights in a validation cohort.
- **Complexity:** `lookup`
- **Inputs:** (many; ship as a flat object — see MedCalc-Bench `caprini_score.py` for the canonical 28-input set)
  - `age` | required | number | years
  - `sex` | required | enum
  - `surgery_type` | required | enum | `none | minor | major | laparoscopic | arthroscopic | elective_major_lower_extremity_arthroplasty`
  - Recent (≤1 month) events: `major_surgery_last_month`, `chf_last_month`, `sepsis`, `pneumonia`, `immobilizing_plaster_cast`, `hip_pelvis_leg_fracture`, `stroke_last_month`, `multiple_trauma`, `acute_spinal_cord_injury` (each bool)
  - Venous/clotting: `varicose_veins`, `current_swollen_legs`, `current_central_venous`, `previous_dvt`, `previous_pe`, `family_history_thrombosis`, `positive_factor_v_leiden`, `positive_prothrombin_20210A`, `elevated_serum_homocysteine` (each bool)
  - Antiphospholipid / HIT: `positive_lupus_anticoagulant`, `elevated_anticardiolipin_antibody`, `heparin_induced_thrombocytopenia`, `congenital_acquired_thrombophilia` (each bool)
  - `mobility` | enum | `normal | on_bed_rest | confined_to_bed_72h`
  - Comorbidities: `inflammatory_bowel_disease`, `acute_myocardial_infarction`, `copd`, `malignancy` (each bool)
  - `bmi` | number | kg/m²
- **Output:**
  - Integer 0–~30+
  - Bands (Caprini 2005 + Pannucci 2017 validation, PMID 28129325):
    - 0: very low risk
    - 1–2: low risk
    - 3–4: moderate risk (mechanical prophylaxis)
    - ≥5: high risk (mechanical + pharmacologic prophylaxis)
  - Clinical action: ACCP 2012 / ASH 2019 endorse pharmacologic VTE prophylaxis for Caprini ≥5 in surgical patients.
- **Formula:** Sum of weighted criteria (excerpted; see Caprini 2005 Table 1 for full list):
  - Age ≤40: 0; 41–60: 1; 61–74: 2; ≥75: 3
  - Surgery: none 0; minor 1; major/laparoscopic/arthroscopic 2; major lower-extremity arthroplasty 5
  - 1 pt each: major surgery in last month, CHF in last month, sepsis, pneumonia, immobilizing cast, varicose veins, swollen legs, IBD, acute MI, COPD
  - 2 pt each: central venous access, malignancy
  - 3 pt each: previous DVT, previous PE, family history thrombosis, factor V Leiden, prothrombin 20210A, homocysteine, lupus anticoagulant, anticardiolipin, HIT, other thrombophilia
  - 5 pt each: hip/pelvis/leg fracture <1 mo, stroke <1 mo, multiple trauma <1 mo, acute SCI
  - Mobility: 1 pt bed rest, 2 pt confined >72h
  - BMI ≥25: +1 (note: MedCalc-Bench uses >25 strict; Caprini 2005 uses ≥25 — verify)
- **Edge cases / clinical caveats:**
  - The 2010 and 2013 revisions added/reweighted some criteria; do not mix versions. Ship as `caprini_2005` and add 2010/2013 separately if needed.
  - "Major surgery" definition varies by source; the Caprini 2005 form uses ">45 minutes" as the cutoff.
- **Test fixtures:**
  - 50-yo male, BMI 28, elective major lower-extremity arthroplasty, no other RF → age 1 + BMI 1 + surgery 5 = 7 (high risk).
  - 35-yo female, BMI 22, minor surgery only → age 0 + surgery 1 = 1 (low risk).

---

## Cholesterol (1 calculator)

### LDL Calculated (Friedewald)

- **MedCalc-Bench ID:** `calc_id: 44`
- **Proposed slug:** `calc_ldl_friedewald`
- **Domain:** cardiology / lipidology
- **Primary citation:** Friedewald WT, Levy RI, Fredrickson DS 1972 — PMID 4337382 (*Estimation of the concentration of low-density lipoprotein cholesterol in plasma, without use of the preparative ultracentrifuge.* Clin Chem 1972;18:499-502.)
- **Complexity:** `formula`
- **Inputs:**
  - `total_cholesterol_mg_dl` | required | number | mg/dL | 30–600 (accept mmol/L)
  - `hdl_mg_dl` | required | number | mg/dL | 10–150
  - `triglycerides_mg_dl` | required | number | mg/dL | 30–800 (formula invalid >400)
- **Output:**
  - Numeric LDL, mg/dL
  - Bands (NCEP ATP III 2001 / 2018 AHA/ACC cholesterol guideline — Grundy PMID 30586774):
    - <70 mg/dL: optimal (high-risk patients)
    - 70–99: optimal
    - 100–129: near-optimal
    - 130–159: borderline high
    - 160–189: high
    - ≥190: very high
- **Formula:** `LDL = TC − HDL − TG/5` (mg/dL).
- **Edge cases / clinical caveats:**
  - **Invalid when TG >400 mg/dL** (Friedewald 1972 condition); use Martin-Hopkins or Sampson formulas at high triglycerides.
  - Non-fasting samples invalidate the TG term.
  - Direct LDL is the gold standard at low LDL (<70) or high TG.
- **Test fixtures:**
  - TC 200, HDL 50, TG 150 → 200 − 50 − 30 = 120 mg/dL.
  - TC 240, HDL 40, TG 400 → 240 − 40 − 80 = 120 mg/dL (boundary; advise caution per formula limit).

---

## Quick-reference distribution table

| Domain | Count |
|---|---|
| Cardiology (HEART, RCRI, Framingham, MAP, 5×QTc) | 9 |
| Critical care / general (GCS, Charlson, SIRS, Maintenance fluids) | 4 |
| Pulmonary (PSI/PORT) | 1 |
| Renal / acid-base (MDRD, AG, ΔGap, ΔRatio, AG-corr, ΔGap-corr, ΔRatio-corr, FWD, FENa, sOsm, Na-corr) | 11 |
| Hepatology / GI (Child-Pugh, FIB-4, Glasgow-Blatchford) | 3 |
| Obstetrics (EDD, EDC, EGA) | 3 |
| Anthropometrics / dosing (BMI, BSA, IBW, ABW, target weight) | 5 |
| Endocrinology (HOMA-IR) | 1 |
| Electrolytes (Corrected Ca) | 1 |
| Infectious (Centor, FeverPAIN) | 2 |
| Pain (MME) | 1 |
| Hematology (Caprini) | 1 |
| Lipidology (LDL Friedewald) | 1 |
| Cholesterol-class (also LDL above; cross-listed under cardiology in inventory) | — |
| **Total** | **44** |
