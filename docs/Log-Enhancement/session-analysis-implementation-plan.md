# Session Analysis — Phased Implementation Plan

**Depends on:** `session-analysis-design.md` (agreed), `threshold-calibration.md`, `log-format-survey.md`
**Methodology:** one file change at a time, full BEFORE/AFTER blocks, fresh upload before each change, test and confirm before proceeding.

Seven phases, each independently testable and each leaving the app in a working state. Phases 1 and 2 deliver value on their own and are prerequisites for everything after.

---

## Phase 1 — Correctness fixes to the existing parsers

**Goal:** stop producing wrong numbers. No new features, no new files, no architecture change. Existing reports keep working and start being correct.

**Why first:** these are the bugs already shipping to a report you read. Phase 2 onward is worthless if the underlying extraction is wrong.

### Issues

| # | Title | Files | Size |
|---|---|---|---|
| 1.1 | ASIAir: match all three settle terminators and bound forward scans | `asiair-log-parser.js` | M |
| 1.2 | ASIAir: remove dither from `totalTrackedS` double-count | `asiair-log-parser.js`, `asiair-log-view.js` | S |
| 1.3 | PHD2: filter frame rows on `parts[2] === "Mount"`, handle DROP separately | `phd2-log-parser.js` | S |
| 1.4 | PHD2: guard all aggregates with `Number.isFinite`; never render NaN | `phd2-log-parser.js`, `phd2-log-view.js` | S |
| 1.5 | PHD2: replace `ERROR_CODES` with the log's own reason string | `phd2-log-parser.js` | S |
| 1.6 | PHD2: remove the hardcoded "satellite or aircraft pass" narrative | `phd2-log-view.js` | S |
| 1.7 | PHD2: compute RMS on settled frames only; report all-frames separately | `phd2-log-parser.js`, `phd2-log-view.js` | M |
| 1.8 | PHD2: per-session equipment parsing (fixes mixed-binning nights) | `phd2-log-parser.js` | M |
| 1.9 | ASIAir: exclude un-settled dithers from the learned-value EMA | `asiair-log-parser.js` | S |
| 1.10 | Move `_updateLearnedValues` out of `parse()` | `asiair-log-parser.js`, caller | S |

**Ordering:** 1.3 → 1.4 → 1.5 → 1.6 before 1.7, since settled-frame RMS is meaningless while NaN is in play. 1.1 before 1.9. 1.8 is independent.

**Validation for the phase:** re-run both parsers against all 44 corpus logs. Expected outcomes:

- Zero `NaN` in any output (currently 11 of 19 nights)
- 2026-07-23 dither total ~26.7m, not 55.1m; learned dither ~21s, not 59s
- 2026-07-23 imgs 41, 42 and the aborted 43 present; 11 AF events, not 10
- Settled RMS within 0.89–1.39" on every night
- Error-code descriptions matching column 18

**Note:** 1.5 and 1.7 change published numbers substantially. Any historical report or note quoting the old values becomes wrong. Worth a changelog entry.

---

## Phase 2 — Full extraction

**Goal:** capture everything the logs contain, whether or not anything consumes it yet. Emit the Phase 3 data model.

**Why before fusion:** every detector and invariant depends on fields the current parsers discard. Building fusion on partial extraction means reworking it.

### Issues

| # | Title | Files | Size |
|---|---|---|---|
| 2.1 | ASIAir: multi-run model — `AutorunRun[]` with per-run target, exposure, kind | `asiair-log-parser.js` | **L** |
| 2.2 | ASIAir: target name capture and normalization (spaces, `M 1`/`M1`, `FOV`, `test`) | `asiair-log-parser.js` | M |
| 2.3 | ASIAir: `Plan Tonight` grouping | `asiair-log-parser.js` | M |
| 2.4 | ASIAir: millisecond exposures, auto-exposure, negative declination | `asiair-log-parser.js` | S |
| 2.5 | ASIAir: full autofocus capture — trigger, temperature, position, star size, V-curve, fine sweep | `asiair-log-parser.js` | M |
| 2.6 | ASIAir: guide failure events (`Guide star lost`, `Select Guide Star failed`) | `asiair-log-parser.js` | S |
| 2.7 | ASIAir: intervention and gap events (`Stop Autorun Manually`, `Log disabled`→`enabled`) | `asiair-log-parser.js` | S |
| 2.8 | ASIAir: plate solve and AutoCenter capture (angle, star number, off-centre, retries) | `asiair-log-parser.js` | S |
| 2.9 | ASIAir: mount events, meridian flip `configuredWaitS`, flip number | `asiair-log-parser.js` | S |
| 2.10 | ASIAir: duplicate and aborted frame detection | `asiair-log-parser.js` | S |
| 2.11 | PHD2: full per-session header capture (geometry, rates, algorithm parameters) | `phd2-log-parser.js` | M |
| 2.12 | PHD2: settle-window model tolerating repeats and failure-after-complete | `phd2-log-parser.js` | M |
| 2.13 | PHD2: calibration block parsing (steps, angles, rates, backlash, orthogonality) | `phd2-log-parser.js` | **L** |
| 2.14 | PHD2: full frame fields (dx, dy, guide distances, durations, directions) | `phd2-log-parser.js` | S |
| 2.15 | Both: unmatched-line collection | both parsers | S |

**2.1 is the largest single change in the plan** and reshapes the parser's return contract. It should land first in the phase and be tested against 2026-06-05 (10 runs, 4 targets, 3 exposure lengths, 3 `Plan Tonight` groups) before anything else in Phase 2 proceeds.

**Validation:** parse all 44 logs; `unmatchedLines` empty on every one; run/target/exposure counts matching `corpus-index.md`.

---

## Phase 3 — Fusion and invariants

**Goal:** a new module joining both parsed models, checking invariants, and emitting `FusedSession`.

### Issues

| # | Title | Files | Size |
|---|---|---|---|
| 3.1 | `session-fusion.js` scaffold and `FusedSession` model | new | M |
| 3.2 | Per-sub guide join (PHD2 frames within each exposure window) | `session-fusion.js` | M |
| 3.3 | `session-invariants.js` with I1–I15 | new | **L** |
| 3.4 | `Finding` registry and severity/confidence model | `session-fusion.js` | M |
| 3.5 | Invariant failures suppress affected values and raise findings | `session-fusion.js` | M |
| 3.6 | Graceful degradation when the PHD2 log is absent | `session-fusion.js` | S |
| 3.7 | `APP_CONFIG.LOG_ANALYSIS` — all thresholds from `threshold-calibration.md` | `config.js` | S |

**Validation:** per-sub RMS for 2026-07-23 reproducing 52 clean and 8 damaged (35–42); invariants passing on the clean nights in `corpus-index.md` and failing where expected on 2026-07-23, 2026-06-05 and 2026-05-11.

---

## Phase 4 — Detectors

**Goal:** D1–D15 as independent, individually testable functions.

### Issues

| # | Detector | Validation status | Size |
|---|---|---|---|
| 4.1 | `session-detectors.js` scaffold + registration | — | S |
| 4.2 | D3 unsettled start, D4 aborted/duplicate | measured | S |
| 4.3 | D5 manual intervention **incl. flat-tuning exclusion** | measured | M |
| 4.4 | D6 mount disconnect, D7 cadence irregularity | measured | S |
| 4.5 | D1 guide-star swap | **0 FP / 511 sessions** | M |
| 4.6 | D2 cloud/transparency (failure density + cooling reversal) | **3/3 annotated nights** | **L** |
| 4.7 | D8 elevated RMS, D9 axis-ratio inversion | corpus baselines | S |
| 4.8 | D14 drop rate, D15 lock-position edge | corpus baselines | S |
| 4.9 | D11 AF health, D13 focus drift regression | n=225 / n=1 night | M |
| 4.10 | D10 calibration outlier and orthogonality | unvalidated | M |
| 4.11 | D12 plate-solve degradation | unvalidated | S |

**Rule:** unvalidated detectors (4.10, 4.11) ship at `info` severity until they have corpus evidence.

**Validation:** run the full detector set across all 19 paired nights and diff against `corpus-index.md`. Specifically — D1 fires only on 2026-07-23 sessions 11 and 12; D2 fires on 2026-06-15 frames 41–47, 2026-05-11 frames ~21–47, 2025-12-20 frames 12–17 and 51–58; D5 does *not* fire on the 2026-06-15 flat-tuning sequence.

---

## Phase 5 — Combined report view

**Goal:** render `FusedSession` as the nine-section report.

### Issues

| # | Title | Size |
|---|---|---|
| 5.1 | `session-report-view.js` scaffold and section framework | M |
| 5.2 | §1 Verdict + §2 Session timeline with interleaved anomalies | **L** |
| 5.3 | §3 Per-sub table with three-tier classification | M |
| 5.4 | §3 CSV export | S |
| 5.5 | §4 Findings with evidence and ruled-out hypotheses | M |
| 5.6 | §5 Guiding analysis | M |
| 5.7 | §6 Focus and environment | M |
| 5.8 | §7 Time accounting with unaccounted remainder | S |
| 5.9 | §9 Data quality and stated limits | S |
| 5.10 | Per-target sections for multi-target nights | M |
| 5.11 | PDF output via pdfmake | M |
| 5.12 | Retire or demote the two existing report views (pending Q1) | M |

**Constraint:** the view contains no thresholds and no classification logic, and renders no prose not derived from a `Finding`.

---

## Phase 6 — Recommendations engine

### Issues

| # | Title | Size |
|---|---|---|
| 6.1 | `session-recommendations.js` scaffold and `Recommendation` model | M |
| 6.2 | Astryx settings group (sub gap, dither, AF, flip, calibration) | M |
| 6.3 | Learned values from clean blocks only, with date and sample count | M |
| 6.4 | Derive Flip Pause from transit, coordinates, offset and sub cycle | **L** |
| 6.5 | ASIAir configuration group | M |
| 6.6 | PHD2 configuration group | M |
| 6.7 | Process and hardware group | M |
| 6.8 | §8 rendering with observed / recommended / evidence / confidence / impact | M |

**6.4 is the highest-value single item in this phase.** It converts the largest remaining sequence-plan error from a stored constant into a derived value, using data (target RA/Dec, configured wait) already present in the log.

---

## Phase 7 — Validation and cleanup

| # | Title | Size |
|---|---|---|
| 7.1 | Regression fixtures — small ASIAir logs with expected output (pending Q8) | M |
| 7.2 | Full corpus re-run; compare against `corpus-index.md` | M |
| 7.3 | Add log-analysis checks to the Validate Algorithms admin view | M |
| 7.4 | Help documentation for the combined report | M |
| 7.5 | Remove dead code from the old report paths | S |

---

## Sequencing and dependencies

```
Phase 1  ─────────────────────────────────► (ships value alone)
   │
Phase 2  ─────────────────────────────────► (2.1 first, gates the rest)
   │
   ├──► Phase 3 (fusion + invariants)
   │        │
   │        ├──► Phase 4 (detectors)
   │        │        │
   │        └────────┴──► Phase 5 (view)
   │                          │
   │                          └──► Phase 6 (recommendations)
   │
   └──────────────────────────────────────► Phase 7
```

Phases 4 and 5 can partially interleave — §1–§3 of the report only need Phase 3.

---

## Decisions needed before starting

Blocking: **Q1** (report scope) gates 5.12. **Q3** (multi-target grouping) gates 2.1, the largest change in the plan. **Q4** (historical baselines) gates 3.7 and 6.3, and implies a `DB_VERSION` bump if metric storage is wanted.

Not blocking: Q2, Q5, Q6, Q7, Q8.

**Suggested start:** Phase 1, issues 1.3 → 1.4 → 1.5 → 1.6. Four small single-file changes that between them eliminate the NaN cascade and every wrong error-code description — the most visible defects — while Q1/Q3/Q4 are still being decided.
