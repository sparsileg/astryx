# Session Analysis — Design Document

**Status:** For review. No code until this is agreed.  **Supersedes:**
the analysis paths in `asiair-log-parser.js` and `phd2-log-parser.js`
(the extraction code is largely reusable).  **Inputs:**
`log-format-survey.md`, `threshold-calibration.md`, `corpus-index.md`
**Validation corpus:** 25 ASIAir logs, 19 PHD2 logs, 2025-10-23 →
2026-07-23

---

## 1. Why this is a rewrite rather than a bug-fix pass

Running the current parsers across the corpus produces these failure
rates:

| Failure | Frequency |
|---|---|
| Headline guide RMS renders as `NaN`, report says "poor" | 11 of 19 nights |
| Log contains multiple targets; report names one | 9 of 25 |
| PHD2 pixel scale differs between sessions; one value applied to all | 4 of 19 |
| Learned dither corrupted by settle-timeout cascade | 5 of 25 |
| Target reported as `Unknown` or `FOV` | 6 of 25 |
| Error-code descriptions wrong | 5 of 5 observed codes |

These are not independent bugs. They share three causes:

1. **Unbounded forward scans.** Both dither handlers scan for `Settle
   Done` with no terminator set and no time limit. A `Settle Timeout`
   sends the scan minutes downstream, swallowing exposures and
   autofocus events on the way. One unhandled token produced six
   visible report errors on 2026-07-23.
2. **No separation between evidence and narrative.** The view authors
   claims directly — including a hardcoded "likely a satellite or
   aircraft pass" emitted for any single-frame error code regardless
   of what the code was. There is no structure that can prevent an
   unsupported assertion.
3. **No validation of derived numbers.** `totalTrackedS` double-counts
   dither; nothing checks it against wall clock. A corrupted learned
   value flows into the sequence planner with no provenance.

The extraction logic is sound and largely reusable. The architecture
around it is what needs replacing.

---

## 2. Design principles

**P1 — Never scan forward without a terminator set and a time bound.**
Every forward scan declares what ends it and what the maximum
plausible span is. Exceeding either is a parse failure, recorded, not
silently absorbed.

**P2 — Prefer the log's self-description to a hardcoded lookup.** PHD2
writes the reason for every dropped frame in column 18. A hardcoded
table that overrides it is how all five error codes came to be
mislabeled. Where a table is unavoidable, mark its output as inferred.

**P3 — Every derived number is cross-checked against an independent
path.** Two computations of the same quantity that disagree mean at
least one is wrong. When an invariant fails, the report says so
instead of printing the corrupted value.

**P4 — Findings carry evidence; the view renders only findings.** No
claim reaches the user without a log line, timestamp, or computed
metric behind it. This structurally eliminates the "satellite pass"
class of bug.

**P5 — Confidence is a first-class field.** Three tiers: **measured**
(read directly from the log), **derived** (computed and
invariant-checked), **inferred** (pattern match). Inferred claims name
the alternatives they ruled out and the discriminator used.

**P6 — State what cannot be seen.** The 2025-12-20 validation showed
log-based detection finds 17 of 26 rejected frames. A report implying
its reject list is complete would have kept 9 bad subs. Limits are
reported, not omitted.

**P7 — Learned values carry provenance and are derived only from clean
data.** Date, sample count, and the blocks they came from. A learned
value derived from an anomalous session is rejected, not averaged in.

**P8 — Thresholds are configuration, not literals.** All bands live in
`APP_CONFIG.LOG_ANALYSIS`. Defaults come from
`threshold-calibration.md` and are marked as rig-specific.

---

## 3. Architecture

```
asiair-log-parser.js ──┐
                       ├──► session-fusion.js ──► FusedSession ──► session-report-view.js
phd2-log-parser.js ────┘           │
                                   ├──► session-invariants.js
                                   ├──► session-detectors.js
                                   └──► session-recommendations.js
```

**Rules:**

- Neither parser knows the other exists. The current
  `Phd2LogParser.parse(text, asiairParsed)` coupling is removed.
- Parsers emit structure only — no anomaly detection, no narrative, no
  side effects.
- `_updateLearnedValues` moves out of `parse()`. Opening a log
  currently mutates settings; with a combined report that becomes a
  correctness problem.
- The view receives a `FusedSession` and renders it. It contains no
  thresholds, no classification logic, and no prose that isn't derived
  from a `Finding`.
- Fusion degrades gracefully: a missing PHD2 log yields a valid
  `FusedSession` with `guide: null` on every sub, and detectors that
  need guide data mark themselves unavailable rather than absent.
- Flat-only (and dark/bias) autoruns are excluded from analysis
  entirely — not run through invariants, detectors, or tiering. A
  flat-only night produces a minimal `FusedSession` marked `kind:
  'calibrationOnly'` with just autorun/frame counts; sections 2–8
  render nothing for it.

---

## 4. Data model

### 4.1 ASIAir side

```
AsiairLog {
  source: { filename, firstTimestamp, lastTimestamp, lineCount,
            unmatchedLines: [{ lineNo, text }] }
  runs:   AutorunRun[]
  gaps:   LogGap[]        // Log disabled → Log enabled
  plans:  PlanRun[]       // Plan Tonight groupings
}

AutorunRun {
  index, rawTarget, target,          // target = normalized
  kind: 'light'|'flat'|'dark'|'bias'|'framing'|'unknown',
  plannedFrames, exposureS, exposureIsAuto, binning,
  coords: { raHours, decDeg } | null,
  startedAt, endedAt,
  endReason: 'finish'|'pause'|'manualStop'|'truncated',
  blocks: ImagingBlock[],
  events: RunEvent[]
}

ImagingBlock { firstImageNo, lastImageNo, startedAt, endedAt, subs: Sub[] }

Sub {
  imageNo,                  // as logged; may repeat
  sequenceNo,               // monotonic across the night
  startedAt, exposureS,
  aborted, duplicateOf,
  settledAtStart,           // false when preceded by Settle Timeout/failed
  precedingDither: DitherEvent | null
}
```

`RunEvent` is a discriminated union:

``` AutofocusEvent { startedAt, endedAt, settleEndedAt, trigger:
'interval'|'temperature'|'preRun'|'postFlip'|'manual', temperatureC,
outcome: 'success'|'failed'|'cancelled', focuserPosition,
achievedStarSize, vCurve: [{ position, starSize }], fineSweep: [{
position, starSize }] }

DitherEvent { startedAt, settleStartedAt, endedAt,
              outcome: 'done'|'timeout'|'failed', durationS }

GuideCalibrationEvent { startedAt, endedAt, settleEndedAt, outcome }

MeridianFlipEvent { pauseStartedAt, configuredWaitS,   // from "Wait 5min42s"
                    flipStartedAt, flipEndedAt, flipNumber, outcome }

PlateSolveEvent { at, attemptNo, outcome, offCentrePct, offCentreDeg,
                  solvedRa, solvedDec, angleDeg, starNumber }

GuideFailureEvent { at, kind: 'starLost'|'selectFailed'|'trackingFailed' }

MountEvent { at, kind: 'disconnected'|'gotoHome'|'startTracking'|'stopTracking' }

InterventionEvent { at, kind: 'manualStop'|'cancelAf'|'pausePlan' }

GuideRecoveryEvent { startedAt, settleStartedAt, endedAt,
                     outcome: 'done'|'timeout'|'failed', durationS,
                     affectedImg }   // mid-imaging Guide Settle → recovery, not dither-triggered
```

### 4.2 PHD2 side

``` GuideLog { source: { filename, phdVersion, logVersion, ... ,
unmatchedLines } sessions: GuideSession[] calibrations: Calibration[]
}

GuideSession {
  index, startedAt, endedAt, terminated,
  equipment: { pixelScaleArcsec, binning, focalLengthMm, cameraModel,
               guideExposureMs, mount, searchRegionPx, starMassTolerancePct,
               ditherScale, ditherAxes, serverEnabled,
               raAlgorithm, raAggression, raHysteresis, raMinMove,
               decAlgorithm, decAggression, decMinMove, backlashComp },
  geometry:  { decDeg, hourAngleHr, pierSide, lockPosition: {x,y},
               starPosition: {x,y}, initialHfdPx, frameSize: {w,h} },
  rates:     { xAngle, xRate, yAngle, yRate, parity },
  frames: GuideFrame[],
  drops:  DropFrame[],
  settleWindows: [{ startedAt, endedAt, outcome: 'complete'|'failed' }],
  dithers: [{ at, dxPx, dyPx, newLock: {x,y} }]
}

GuideFrame { t, dxPx, dyPx, raRawPx, decRawPx, raGuidePx, decGuidePx,
             raDurationMs, raDirection, decDurationMs, decDirection,
             starMass, snr, errorCode, settled }

DropFrame  { t, starMass, snr, errorCode, reason }   // reason from column 18
```

**Equipment is per session, not per log.** This is the fix for the 4
mixed-binning nights.

`Calibration` is new — the current parser discards these blocks
entirely:

```
Calibration {
  startedAt, completedAt, mount, outcome,
  steps: [{ direction, step, dx, dy, x, y, dist }],
  west:  { angleDeg, ratePxPerSec, parity },
  north: { angleDeg, ratePxPerSec, parity },
  backlashSteps: [...],
  orthogonalityErrorDeg,        // |west.angle − north.angle| − 90
  starLostDuringCalibration: n
}
```

### 4.3 Fusion

```
FusedSession {
  night, targets: [], span: { from, to },
  subs: FusedSub[],
  timeline: TimelineEntry[],
  metrics: SessionMetrics,
  invariants: InvariantResult[],
  findings: Finding[],
  recommendations: Recommendation[],
  coverage: { asiairPresent, phd2Present, unmatchedLineCount,
              unaccountedSeconds, subsWithoutGuideData },
  equipment: { phd2Camera, phd2FocalLengthMm, phd2PixelScaleArcsec,
               matchedProfile: EquipmentProfile | null,
               matchConfidence: 'exact'|'partial'|'unmatched' }
}

FusedSub {
  imageNo, sequenceNo, target, startedAt, exposureS,
  guide: { rmsRa, rmsDec, rmsTotal, peakTotal,
           frameCount, droppedCount, medianSnr } | null,
  settledAtStart, guideFailureCount,
  blockAchievedStarSize, temperatureC,
  tier: 'clean'|'marginal'|'reject'|'unknown',
  tierReasons: [ ... ]
}
```

**Three tiers, not two.** Validation on 2025-12-20 gave 17 clear
rejects against 26 actual, with a marginal band at frames 43–51
(1.35–2.22" against a 1.1" night median) accounting for most of the
gap. A binary verdict would have understated the damage.

### 4.4 Finding

```
Finding {
  id, code,                        // stable code, e.g. 'GUIDE_STAR_SWAP'
  severity:   'info'|'warning'|'critical',
  confidence: 'measured'|'derived'|'inferred',
  title, detail,
  evidence:   [{ source: 'asiair'|'phd2'|'computed',
                 lineNo, timestamp, text, value }],
  affectedSubs: [imageNo],
  timeRange:  { from, to } | null,
  ruledOut:   [{ hypothesis, discriminator, observed }],
  recommendationIds: []
}
```

`ruledOut` is what lets the report say *"not mechanical — displacement
is fixed at 46.7 px with CV 0.03; a mechanical excursion produces
scattered displacements"* rather than presenting a guess as a
conclusion.

---

## 5. Invariants

Checked on every parse. Each returns `InvariantResult { id, expected,
actual, tolerance, passed, severity, impact }`. **A failed invariant
suppresses the affected number in the report and raises a Finding.**

| ID | Invariant | Catches (observed) |
|---|---|---|
| I1 | Imaging block duration ≈ Σ(exposure + measured overhead) | Inflated dither, swallowed frames |
| I2 | Wall clock = Σ tracked events + unaccounted remainder | The phantom 25-minute gap |
| I3 | ASIAir dither count == PHD2 dither count over the same window | 56 vs 60 on 2026-07-23 |
| I4 | Sub numbering contiguous; duplicates explicitly accounted | Images 41–42 vanishing; image 43 twice |
| I5 | Guide-session boundaries ≈ imaging-block boundaries | Swallowed autofocus at 02:16:49 |
| I6 | PHD2 frame count × guide exposure ≈ session duration | Dropped/delayed frames |
| I7 | Every AF has Begin, End and a settle terminator | Truncated AF blocks |
| I8 | Every dither has a terminator within the timeout | The settle cascade |
| I9 | Pixel scale and binning constant within one guide session | Mixed-binning nights |
| I10 | Captured frames ≤ planned frames per run | Multi-run merge |
| I11 | Every autorun has a Begin and an End | Truncated logs |
| I12 | Exposure length constant within one run | The 12/60/300s night |
| I13 | Unmatched line count == 0 | Future firmware changes |
| I14 | Every settle window has a terminator | PHD2 `Settling failed` handling |
| I15 | Learned values derived only from blocks with no findings | The 59s reaching the planner |

I13 deserves emphasis: it is the only mechanism that will surface a
firmware format change *before* it corrupts a number. Unmatched lines
are reported with counts and samples in the data-quality section.

---

## 6. Detectors

Each detector emits zero or more `Finding`s. Validation status is
recorded per detector; unvalidated detectors ship as `info` severity
until they have evidence.

### D1 — Guide-star swap
**Signature:** ≥5 frames with star mass < 85% of session median AND
displacement > 8 px, where the coefficient of variation of those
displacements < 0.15.  **Discriminator:** fixed displacement ⇒
alternating reference star; scattered ⇒ genuine excursion.
**Validation:** 511 guide sessions, 9 months. **2 flags, both true
positives (2026-07-23 sessions 11 and 12). Zero false positives.**
**Rules out:** mechanical drag, calibration error, wind, comms fault.
**Recommendation emitted:** reduce search region, or reject guide
stars near the frame edge.

### D2 — Cloud / transparency loss
**Primary signature:** guide-failure event density per exposure window
(`Guide star lost`, `Select Guide Star failed`, `Settle Timeout`, AF
failure). Threshold ≥3 per 300s window, with the acquisition phase
before the first successful settle excluded.  **Corroborating
signature:** reversal of the focuser cooling trend — cooling rate
turning positive between consecutive AF events.  **Validation:** three
annotated nights.

| Night | Annotation | Detector |
|---|---|---|
| 2026-06-15 | "clouds frames ~41–47" | frames 41–47 |
| 2026-05-11 | "clear ~90 min, then clouds, opening ~03:00" | disturbance from frame 13, continuous 21–47, clear from 48 (02:35) |
| 2025-12-20 | none recalled | two bands, 12–17 and 51–58 — **corroborated by a 4 °C temperature rise 22:43→00:20**, which is backwards for clear-sky cooling |

**Explicitly rejected approach:** guide-star mass as a gradual
transparency proxy. Tested and it does not work — within a single
lock, mass stays at 91–97% of that lock's peak straight through known
cloud, because PHD2 loses and re-selects rather than tracking a fading
star. Mass is also incomparable across re-selections (2025-12-20
ranged 1830–4237 across six different stars). **Cloud is binary in the
guide log.**

### D3 — Unsettled exposure start
Any sub whose preceding dither ended in `timeout` or
`failed`. Trailing is concentrated at the start of the exposure rather
than distributed, so these fail differently and are worth blinking
separately.  **Baseline:** 1.5% of dithers corpus-wide; 8.3% on
2026-07-23.

### D4 — Truncated exposure
Primary signal: logged duration measurably less than the configured
`exposureS`. Duplicate image number is corroborating evidence only,
not the detection criterion — ASIAir happened to reissue the same
image number on the 2026-07-23 retry, but that's an artifact of how it
recovered, not guaranteed behavior. Keying on duplicate numbering
alone would miss any truncation whose retry lands on a new number
instead of repeating the old one.  **Observed:** image 43 truncated at
2.5 min of 5 on 2026-07-23, reissued as image 43 again on the
successful retry.

### D5 — Manual intervention
`Stop Autorun Manually`, `Cancel AF Manually`, `Pause Plan Tonight`,
and `Log disabled`→`enabled` gaps.  **Required exclusion:** a run of
manual stops within a flat-capture run, each followed by a new run at
a different exposure, is flat-exposure tuning and must not be reported
as incidents. 2026-06-15 ends with four such stops in three minutes
(2.0 → 1.4 → 1.2 → 1.1s). Naive detection reports four failures.

### D6 — Mount disconnect
`"ZWO<N>" is Disconnected`. Report with the subs it overlaps. Do not
attribute causation — on 2026-07-23 two disconnects fall inside the
anomalous block but the PHD2 stream continues uninterrupted through
both.

### D7 — Frame cadence irregularity
Count of PHD2 frame intervals > 1.5× the guide exposure.
**Baseline:** 0–6 per clean session; 59 and 33 on the two known-bad
sessions.

### D8 — Elevated guiding
Settled RMS against configurable bands, and against the user's
trailing median where history exists.  **Corpus:** median 1.12", range
0.89–1.39". Current code compares a 2.0" threshold against
*all-frames* RMS, so the elevated band never fires on real degradation
— metric and threshold were mismatched.

### D9 — Axis-ratio inversion
Dec RMS exceeding RA RMS. Median ratio across the corpus is RA/Dec =
1.38, stable across 19 nights and both pier sides. An inversion is
unusual for this rig and worth surfacing.

### D10 — Calibration outlier
Rate deviating from the night's other calibrations; orthogonality
error from West/North angles; `STAR LOST during calibration` count.
**Observed:** rates of 1.347 / 1.407 / 1.266 px/sec across three
calibrations on 2026-07-23; 86 star-lost-during-calibration events in
one night (2026-05-11).

### D11 — Autofocus health
Failure rate, duration outliers, achieved star-size trend.
**Baseline:** median 109s, p90 113s, 95.6% success across 225 events.

### D12 — Plate-solve degradation
Repeated `Too far from center`, `Mount slews failed`, `Plate Solve
failed`, and `Star number` trend across the night.  **Note:** `Star
number` (588–1056 observed) is the only genuine transparency
measurement in either log, but it is written only a handful of times
per night. Coarse sanity check, not a per-sub metric.

### D13 — Focus drift
Regress focuser position on temperature per night; report coefficient,
r², and residuals; flag outliers and coefficient drift across
sessions.  **Observed:** −20.2 steps/°C, r² = 0.975, residuals ±6.4
steps (2026-07-23, one night only).

### D14 — Dropped-frame rate
DROP rows as a fraction of total frames.  **Baseline:** 1.18% corpus;
per-night 0% to 17.7%.

### D15 — Guide star near frame edge
Lock position within a configurable distance of the sensor edge. Both
D1 flags locked within 105 px on a 1280×960 sensor; clean sessions
that night ranged 112–410 px. Ships as `info` until the corpus-wide
distribution is gathered.

### D16 — Mid-imaging guide recovery
Built on `GuideRecoveryEvent` (§4.1) — a `Guide Settle → Guide star
lost → Settle failed/Done` cycle occurring mid-imaging, outside
dither/AF/calibration. First observed as ~100+ occurrences on the M64
log (2026-05-11), previously silently skipped by the parser.

**Resolved (ELR.p4-3): own Finding, not folded into D2 or D7.** The
underlying pattern — repeated star-lost-and-reselect cycling — points
toward a different root cause than either alternative: guide-star
selection or search-region sizing (the same category D1 already
recommends against — "reduce search region, or reject guide stars near
the frame edge"), not transparency (D2) or hardware/comms cadence gaps
(D7). Folding it into either would blend a distinct, correctly-
diagnosable signal into one that implies the wrong root cause, and would
prevent Phase 6's recommendations engine from ever attaching a specific
fix to it. Ships as `info` until validated against more nights.

---

## 7. Report structure

Single combined report. ASIAir-derived session detail first, as you
suggested.

**1. Verdict** — subs captured / clean / marginal / reject, usable
integration, settled guide RMS, finding counts by severity. Every
figure here is a fusion product.

**2. Session timeline** — the existing ASIAir event table, extended
with a guide-quality column per imaging block and anomalies
interleaved as their own rows. Manual stops, recovery gaps, aborted
frames and disconnects appear inline. This is where a silent 25-minute
hole becomes impossible.

**3. Per-sub frame quality** — the join. Image number, target, start,
RMS RA/Dec/total, peak, dropped frames, settled-at-start, block AF
star size, temperature, tier, tier reasons. CSV export keyed on image
number.

**4. Findings** — ranked by severity, each with evidence, affected
subs, and what was ruled out.

**5. Guiding analysis** — settled RMS headline with all-frames
secondary; per-axis; pier side and hour-angle breakdown; dither
amplitude in guide px, arcsec and main-camera px; calibration summary;
periodicity where a long clean session permits it.

**6. Focus and environment** — temperature trace with cooling-rate
annotation, focus/temperature regression, achieved star-size trend, AF
cadence adequacy.

**7. Time accounting** — reconciled against wall clock with the
unaccounted remainder shown explicitly. Dither presented as nested
within imaging, not as a sibling category.

**8. Recommendations** — four groups: Astryx settings, ASIAir
configuration, PHD2 configuration, process and hardware.

**9. Data quality** — invariant results, unmatched line count with
samples, subs lacking guide data, and an explicit statement of what
the analysis cannot see.

Section 9 is unusual and is what makes the other eight trustworthy.

---

## 8. Recommendations engine

Each `Recommendation` carries five fields minimum: observed,
recommended, evidence, confidence, expected impact. A recommendation
with no change required is still worth printing — *"AF Duration 2m →
2m; observed mean 2.09m across 11 events; measured; no change"* tells
the user not to touch it.

Grouping:

| Group | Examples |
|---|---|
| **Astryx settings** | Sub gap, dither duration, AF duration, flip pause and duration, guide calibration |
| **ASIAir config** | AF interval, flip offset, frames per dither, settle timeout, dither scale |
| **PHD2 config** | Calibration orthogonality, calibration rate consistency, calibration step size, search region, star mass tolerance, min-move, aggression |
| **Process / hardware** | Guide star selection, cable routing, calibration timing, flat exposure |

Two rules:

- **Astryx settings that mirror ASIAir configuration are copied, not
  learned.** AF Interval, Flip Offset and Frames per Dither belong to
  the ASIAir. AF Duration, Flip Duration, Guide Calibration, Sub Gap
  and Dither are measured performance. Flip Pause is the only hybrid —
  and should be *derived* from transit time, target coordinates
  (available in the log), flip offset and sub cycle rather than stored
  at all.
- **Learned values are computed from clean blocks only**, carry a date
  and sample count, and are rejected when the contributing blocks have
  findings. This alone would have blocked the corrupted 59s from
  reaching the sequence planner.

---

## 9. Stated limits

Reported in section 9 of every report, not omitted:

| Limit | Evidence |
|---|---|
| Satellite and aircraft trails are undetectable | 2025-12-20 frame 2 had bright Starlink trails; PHD2 shows RMS 0.77"/0.52", steady star mass, SNR 42.7, zero error codes. The guide camera sees a different patch of sky. |
| Image-level quality is invisible | Transparency within the sub, gradients, FWHM, focus at the sensor. Log-based detection found 17 of 26 rejected frames on 2025-12-20; the 9-frame gap is duo-band signal loss the logs cannot measure. |
| Guide-star mass is not a transparency proxy | Flat at 91–97% within a lock through known cloud; incomparable across re-selections. |
| Novel failure modes | A detector finds what it was written to find. Unknown failures surface only as invariant failures or unaccounted intervals — which is why sections 7 and 9 exist. |
| Thresholds are rig-specific | All defaults derive from one AM5 / AT115EDT / ASI120MM Mini setup over 9 months. |
| Equipment linkage is name/value matching, not physical verification | Matching a session's logged camera model and focal length to an Astryx equipment record confirms the log and the database agree on paper — it cannot detect a physically miswired rig, a lens cap, or dew producing normal-looking header values from a camera pointed at nothing. |

---

## 10. Open decisions

Flagged rather than resolved.

**Q1 — Report scope.** One combined report replacing both, or a
combined report plus the two existing detail reports retained as
drill-downs? Recommendation: combined replaces both, since every
substantive finding needed both logs.

**Q2 — Missing PHD2 log.** Degrade gracefully with `guide: null`, or
refuse to produce the combined report? Recommendation: degrade, and
state the limitation in section 9.

**Q3 — Multi-target nights.** One report with per-target sections, or
one report per target? 9 of 25 nights are multi-target and one has
three separate `Plan Tonight` runs at three exposure
lengths. Recommendation: one report per night with per-target
sections, since time accounting and environment are night-level.

**Q4 — Historical baselines.** Should the recommendations engine
compare against the user's own trailing median (requiring per-session
metric storage in the DB) or ship fixed defaults? Storing metrics is a
schema change and a `DB_VERSION` bump. Fixed defaults are simpler but
drift out of calibration — your guiding improved from 1.20" to 0.97"
over the corpus.

**Q5 — Tier thresholds.** The marginal band on 2025-12-20 (1.35–2.22"
against a 1.1" median) is suggestive but was not tuned to match your
keeper count, deliberately. Should tiers be absolute, or relative to
each night's own median?

**Q6 — CSV export target.** Plain CSV, or a format matching
SubframeSelector / Photyx input directly?

**Q7 — LLM narration.** Sections 4 and 8 could be authored by the
Claude API from the findings array. Better synthesis, but adds a
network dependency and a key to an offline-capable desktop
app. Recommendation: build stages 1–6 regardless, since the evidence
layer is a prerequisite either way, and decide afterwards.

**Q8 — Test fixtures.** Commit a handful of small ASIAir logs (~40 KB)
with expected output for regression testing? PHD2 logs at ~1 MB are
too heavy for the repo.

---

## 11. Non-goals

- Image analysis. Astryx reads logs; SubframeSelector and Photyx read
  frames.
- Predicting weather.
- Replacing PHD2's own analysis tools.
- Multi-night trend analysis in v1 — depends on Q4.
