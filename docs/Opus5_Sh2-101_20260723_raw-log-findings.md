# Raw Log Analysis — Findings & Report Improvement Recommendations

**Logs analyzed:** `Autorun_Log_2026-07-23_220534.txt` (678 lines), `PHD2_GuideLog_2026-07-23_214017.txt` (11,626 lines)
**Code reviewed:** `asiair-log-parser.js`, `asiair-log-view.js`, `phd2-log-parser.js`, `phd2-log-view.js`
**Session:** Sh2-101, 2026-07-23/24, 300s subs

---

## 0. Headline

The raw logs contain enough information to **fully explain** the anomalous portion of this session, and the explanation is not the one either report gave — nor the one I gave in earlier analysis. Both of my previous hypotheses were wrong, and I've marked the corrections explicitly in §6.

Three structural findings drive most of the recommendations:

1. **A single unhandled log token (`Settle Timeout`) cascades into six visible report errors** — inflated dither duration, missing images, a phantom 25-minute gap, a swallowed autofocus, an inflated session total, and a corrupted learned value that then feeds the sequence planner.
2. **A single unhandled row type (`DROP`) in the PHD2 log produces the NaN** that poisoned the overall RMS, the "poor" verdict, and the narrative string. It also concealed a session that was genuinely worse than the one flagged as critical.
3. **The two logs share a common clock**, so joining them yields a per-sub guiding RMS — a directly actionable frame-quality metric that neither report currently produces. This is the single highest-value addition available.

---

# PART 1 — ASIAir Autorun Log

## 1.1 The `Settle Timeout` cascade

The ASIAir emits two possible terminators after `[Guide] Dither Settle`:

```
[Guide] Settle Done       ← handled
[Guide] Settle Timeout    ← not handled anywhere in the parser
```

This session had **five** timeouts (01:53:10, 02:16:48, 02:24:58, 02:31:02, 02:37:04), each exactly 63s after its dither — implying a **60s settle timeout** configured on the ASIAir.

In `_extractEvents`, both dither handlers scan forward for `Settle Done` with no terminator and no time bound:

```js
while (j < lines.length) {
    if (lines[j].includes('[Guide] Settle Done')) { ... break; }
    j++;
}
...
j = k + 1;   // skips everything scanned over
```

On a timeout the scan runs to the *next* successful settle, which can be many minutes and many events later. Running your parser against the raw log reproduces this exactly:

| Dither at | Parsed duration | Actual | Error |
|---|---|---|---|
| 01:52:07 | 407s | 63s | +344s |
| 02:15:45 | 189s | 63s | +126s |
| 02:23:55 | **1491s** | 63s | +1428s |

Total inflation: **+1,898s (31.6 min)**. Everything else follows from this:

- **Dither total 55.1m → true ~26.7m.** Learned dither becomes 59s instead of ~23s.
- **Images 36, 41, 42 and the aborted 43 are swallowed** by the `j = k + 1` skip. Reported subs = 58; actual = 60 complete + 1 aborted.
- **The autofocus at 02:16:49 is swallowed.** Report shows 10 AF events; the log has 11.
- **The block-boundary check never fires**, so imgs 35–40 merge into one 36.8m block spanning an autofocus.
- **The "25-minute gap" at 02:23–02:48 is an artifact** — images 41 and 42 were captured at 02:24:58 and 02:31:02.

### Recommended fix

```js
const SETTLE_END = /\[Guide\] Settle (Done|Timeout)/;
```

Match either terminator, record `settled: true|false` on the dither event, and bound the scan (abort on `Exposure`, `[AutoFocus|Begin]`, `[Autorun|`, `Log disabled`, or elapsed > 300s). Exclude un-settled dithers from the learned-value EMA, and surface them as a first-class anomaly — a settle timeout means **the following exposure began before the guider had settled**, which is a frame-quality flag, not just a timing detail.

Affected subs this session: **36, 41, 42** (and the aborted 43).

## 1.2 The double-count in `totalTrackedS`

```js
const totalTrackedS = imagingTotalS + afTotalS + calTotalS + meridianTotalS + ditherTotalS;
```

Imaging blocks are measured start-of-first-exposure to end-of-last-exposure, so they **already contain** their dithers. Adding `ditherTotalS` inflates the denominator, understating `imagingPct` and distorting every other percentage. Your own report note says as much ("Dither total is included in the summary but is embedded within imaging segments").

Fix: compute `totalTrackedS` without `ditherTotalS`, and present dither as a *nested* share of imaging rather than a sibling category. Better still, validate against wall clock (first to last timestamp) and report the unaccounted remainder explicitly — a non-zero remainder is itself a useful anomaly signal.

## 1.3 Manual interventions are invisible

The log records them plainly:

```
02:39:34 Stop Autorun Manually
02:39:34 [Autorun|End] Pause Autorun
Log disabled at 2026/07/24 02:39:34
Log enabled at 2026/07/24 02:48:18
02:48:18 [Autorun|Begin] Sh2-101 Start
```

None of `Stop Autorun Manually`, `Pause Autorun`, `Log disabled`/`Log enabled`, or the resulting **8.7-minute gap** appears in the report. This matters twice over: it's lost time that should be accounted for, and it's the correct explanation for what the reports presented as an unexplained hole.

Also unhandled: **duplicate image numbers**. Image 43 appears twice (02:37:04 aborted after ~2.5 min; 02:50:50 completed). A duplicate frame number is a reliable aborted-frame signal and should be reported as such.

## 1.4 Autofocus data is parsed for duration only — everything else is discarded

Each AF block contains a full V-curve and fine-focus sweep. The parser keeps only start/end timestamps. Available per event:

| Field | Source line | Value this session |
|---|---|---|
| Trigger reason | `[AutoFocus|Begin] Run AF ...` | interval / temp-change / post-flip / pre-start |
| Temperature | same line | 24.5 °C → 20.6 °C |
| Focuser position | `Auto focus succeeded, the focused position is N` | 35788 → 35865 |
| Achieved star size | last `Calculate Focus Point` | 2.5 → 3.5 px |
| V-curve shape | 9–10 `Calculate V-Curve` samples | step 30 |
| Fine-sweep shape | 5 `Calculate Focus Point` samples | step 15 |

**Three high-value derived metrics:**

**(a) Temperature compensation coefficient.** Regressing focuser position on temperature across the 11 AF events:

```
position = 36286 − 20.2 × T(°C)     r² = 0.975, max residual ±6.4 steps
```

That is a usable temp-comp coefficient for the AT115EDT + EAF, produced free from a single night. Accumulated across sessions it becomes a genuinely reliable number, and a drifting coefficient would flag a mechanical change.

**(b) Autofocus interval is over-conservative.** Fitting a parabola to the pooled near-focus samples gives the critical focus zone:

| Defocus | Star size vs best |
|---|---|
| ±10 steps | +1% |
| ±15 steps | +3% |
| ±20 steps | +6% |
| ±30 steps | +13% |

Cooling ran at 0.70 °C/h, so a 30-minute AF interval permits only **~7 steps** of drift — smaller than the scatter in the temp fit itself. A 60-minute interval permits ~14 steps (~2–3% star growth) and would recover roughly 10 minutes of the 21 minutes spent on autofocus. Two caveats: the parabola pools samples from AFs at different temperatures, so the curvature is more trustworthy than the vertex position; and the `temperature changed 1 degrees` trigger would still fire independently, which is the right safety net.

**(c) Achieved star size is a seeing proxy.** The AF-measured minimum grew monotonically through the night:

```
2.8  2.6  2.6  2.5  3.0  2.8  3.2  3.1  2.9  3.3  3.5     (px, chronological)
```

A 40% increase from best to worst, with the focus fit residuals staying inside ±6 steps — so this is atmosphere, not focus. That's an independent transparency/seeing trace to correlate against SubframeSelector or Photyx FWHM, and it comes from the guide-scope-independent main imaging train.

## 1.5 Other unused ASIAir data

| Log content | Currently | Value |
|---|---|---|
| `"ZWO000" is Disconnected` (×3: 22:06:37, 01:53:17, 01:55:08) | ignored | Mount comms dropouts. Two fall inside the anomalous imaging block. |
| `[Meridian Flip|Begin] Wait 5min42s` | ignored | The *configured* pre-flip wait, stated directly. Separates configured from stochastic pause (see §7). |
| `[AutoCenter|End] Too far from center, distance = 86%(0.695313°)` | ignored | First centering attempt failed; two solves were needed. Repeated occurrences indicate mount pointing-model drift. |
| `Solve succeeded: ... Angle = 290.239, Star number = 588` | ignored | Field rotation angle — verifies camera angle vs the Astryx framing plan. Star number is a transparency proxy. |
| `Shooting 60 flat frames, exposure 1.2s` | filtered out by `_extractLightFrameLines` | Correct to exclude from the timeline, but calibration coverage is worth a one-line note. |
| `Mount GoTo Home POS` | ignored | Clean shutdown confirmation. |
| Second `[Autorun|Begin]` after resume | merged silently | Should be shown as a session restart. |

## 1.6 Target/date extraction is fragile

`_extractTarget` uses `line.match(/\[Autorun\|Begin\]\s+(\S+)\s+Start/)` — `\S+` breaks on any target name containing a space ("Sh 2-101", "NGC 7000 Region"). The first autorun in this file is `FOV Start`, which would be returned as the target were it not filtered by the light-frame pass. Prefer capturing everything between `]` and the trailing ` Start`, and prefer the target name from the *light-frame* session specifically.

Also worth capturing: `Target RA:20h0m21s DEC:+35°25'16"` — gives coordinates for transit calculation without a catalog lookup, which is exactly what the Flip Pause derivation in §7 needs.

---

# PART 2 — PHD2 Guide Log

## 2.1 Root cause of the NaN: `DROP` rows

PHD2 writes two row types in the frame table. The parser only recognises one:

```
608,1261.975,"DROP",,,,,,,,,,,,,48,4.60,6,"Star lost - mass changed"
609,1263.985,"DROP",,,,,,,,,,,,,0,0.00,2,"Star lost - low SNR"
```

`parts[0]` is numeric so the row passes the guard, but columns 3–14 are empty. `parseFloat('')` returns `NaN`, and there is no validity check — so `raRaw`/`decRaw` become NaN, the RMS sums become NaN, and NaN propagates into `_computeOverall`, which is where the session-wide RMS and the entire narrative header came from.

The `'poor'` verdict follows mechanically from `phd2-log-view.js:240`:

```js
const quality = overall.totRms < 1.5 ? 'excellent' : ... : 'poor';
```

Every comparison against NaN is false, so the chain falls through to `'poor'`. Same mechanism produces `"approximately NaN× the night average"`.

**All 33 DROP rows in this log are in session 12, between 02:39:47 and 02:40:55** — i.e. *after* `Stop Autorun Manually` at 02:39:34. They record the star being lost during your manual intervention, not a guiding failure.

### Recommended fix

Filter on `parts[2]` rather than `parts[0]`:

```js
const rowType = parts[2].replace(/"/g, '');
if (rowType === 'Mount') { /* guiding frame */ }
else if (rowType === 'DROP') { /* dropped frame — count, don't average */ }
```

Then guard every aggregate with `Number.isFinite`, and add an assertion so a NaN can never reach the view layer. DROP frames should be reported as their own metric (**drop rate per session**), which is a better guide-health indicator than the current error-code counting.

## 2.2 The `ERROR_CODES` map is wrong — and the log self-documents

`phd2-log-parser.js:19` hardcodes a mapping that contradicts the reason strings PHD2 writes in column 18 of every DROP row:

| Code | Your map | Log's own text | Report said |
|---|---|---|---|
| 2 | Saturated star | **Star lost - low SNR** | "Saturated star — 22 frames" ✗ |
| 6 | Star too close to edge | **Star lost - mass changed** | "Star too close to edge — 9 frames" ✗ |
| 7 | Star mass change | **No star found** | "Star mass change" ✗ |

All three descriptions in the report were wrong, and they pointed the diagnosis in the wrong direction — "saturated star near the frame edge" was an entirely invented failure mode built from two mislabeled codes.

**Fix: read column 18 when present and use it verbatim.** Fall back to the table only when the field is absent, and label such output as inferred. Given your standing preference for flagged uncertainty over confident guessing, a hardcoded map that overrides self-describing log data is exactly the pattern to remove.

Related: `phd2-log-view.js:321` emits, for *any* single-frame error code:

> `one frame had a star mass change (code 7) — likely a satellite or aircraft pass, no impact`

This is hardcoded regardless of the actual code, and asserts a physical cause with no supporting evidence. It should be replaced with the log's own reason string and no causal claim.

## 2.3 Reported RMS conflates guiding with dither settling

This is the largest quantitative error in the guide report, and it changes the verdict completely.

`_finalizeSession` averages **all** frames, including those between `SETTLING STATE CHANGE, Settling started` and `Settling complete`. During settle the star is deliberately being moved several pixels, so those frames are not guiding errors at all.

Excluding settle windows (frame-weighted across the 12 clean sessions, 8,744 frames):

| | Reported | All frames | **Settled only** |
|---|---|---|---|
| RA | NaN | 1.03" | **0.79"** |
| Dec | NaN | 0.94" | **0.55"** |
| Total | NaN | 1.39" | **0.97"** |

**0.97" total is 0.15 px RMS on the guide scale and ~1.0 px on the main camera at 0.96"/px.** Not "poor" — this is good guiding. Dec (0.55") is markedly better than RA (0.79"), consistent with harmonic-drive periodic error rather than polar misalignment.

The peak columns are affected the same way. Session 3's reported 11.72" RA peak drops to **5.0"** once settle frames are excluded.

Recommendation: report **settled RMS as the headline**, with all-frames RMS and settle-time statistics as secondary. The `SETTLING STATE CHANGE` markers are already in the log and already parsed for dither counting; they just need to gate the statistics.

## 2.4 The `Settling failed` marker is present and unused

```
INFO: SETTLING STATE CHANGE, Settling failed
```

Five occurrences — exactly matching the five ASIAir `Settle Timeout` events. Parsing this gives the guide-side confirmation independently of the ASIAir log, and lets the guide report flag the affected subs on its own.

## 2.5 What actually happened in sessions 11 and 12

Recomputed from the raw log:

| Session | Reported | Actual (all frames) | Actual (settled) |
|---|---|---|---|
| 11 | 40.52" | 40.52" | 10.98" |
| 12 | **NaN** ("Good guiding") | **55.34"** | 22.78" |

Session 12 was **worse than session 11** and was reported as good. That's the most consequential single failure in the guide report.

The frame-level trace shows an unambiguous signature. Around every dither in these two sessions:

```
01:52:12  dx=  -0.21  dy= -0.29   RAraw=    0.0"  mass=3583  snr=39.2
01:52:16  dx=  38.88  dy=-26.56   RAraw= -296.2"  mass=2528  snr=34.4   RAdur=1800E
01:52:18  dx=  -2.32  dy=  1.36   RAraw=   16.9"  mass=3589  snr=39.6
```

The excursion is **the same displacement every time**: +38.9, −26.5 px = **47.2 px**, with star mass dropping from ~3,450 to ~2,520 (73%) and recovering instantly on the next frame.

That is not a mount error. **PHD2 was alternating between two stars.** Diagnostic evidence:

- **Search region = 50 px** (log header). The companion sits at 47.2 px — just inside it.
- **Star mass tolerance = 50%.** The 27% mass difference passes without tripping an error code, so nothing was flagged.
- **Lock position = (1174, 96)** on a 1280×960 sensor — 96 px from the frame edge, the most extreme of any session.
- The bimodal mass distribution appears in **sessions 11 and 12 only** (16 and 22 frames), and in no other session.
- After you recalibrated at 02:41:37, PHD2 re-selected at (1066, 89) and the signature vanished entirely — sessions 13–16 average 0.90" settled.

A `RAdur` of 1800 ms (the configured maximum) on every swap frame means PHD2 was issuing full-length corrections to chase a 5-arcminute jump that never happened, then correcting back. The recurring settle timeouts follow directly, because settling can't converge while the reference alternates.

**This is detectable automatically.** A recurring identical `(dx, dy)` displacement combined with a bimodal star mass is a clean, low-false-positive signature, and it's more useful than any RMS threshold because it names the fix: reduce the search region, or reject guide stars near the frame edge.

Two supporting observations:

- **Frame cadence anomalies track it.** Frames spaced >3s apart (nominal 2.0s): 0–6 in every clean session, **59 in session 11 and 33 in session 12**. Cadence irregularity is a cheap independent health metric.
- **The mount disconnects are separate.** `"ZWO000" is Disconnected` at 01:53:17 and 01:55:08 fall inside session 11 but the PHD2 stream continues without interruption, so they didn't cause the excursions. They remain worth reporting on their own.

## 2.6 Reproducible periodic structure in RA

FFT of settled RA residuals, run independently on seven long clean sessions on both sides of the meridian:

| Session | Dominant periods |
|---|---|
| 5, 6, 7 | ~215s, ~390s, ~485s |
| 8, 14, 15, 16 | ~390s, ~485s, ~215s |

Amplitudes are 0.27–0.48" against a session RA RMS of ~1.0" — so a substantial fraction of your RA error is periodic and, in principle, predictable. The consistency across independent sessions and across the flip makes this a property of the drive rather than of any one session.

I can't map these periods to specific gear stages without the AM5's internal reduction ratios, so I'd present this descriptively rather than diagnostically. It is nonetheless actionable: periodic error at these timescales is what predictive PEC targets, and it bounds how much improvement a guide-parameter change could deliver.

## 2.7 Header metadata is parsed once and discarded

PHD2 rewrites a full header at every `Guiding Begins`. The parser reads pixel scale and focal length globally and ignores the rest. Per session, available:

| Field | Use |
|---|---|
| `Pier side` | Independent meridian-flip detection; per-side RMS comparison |
| `Hour angle` | RMS vs HA (this session: −3.37 h → +2.91 h) |
| `Lock position` | Guide star placement — directly diagnosed §2.5 |
| `HFD` | Guide-star focus at session start (3.67 → 6.43 px range here) |
| `xRate`, `yRate` | Calibration rates. Changed 1.347 → 1.407 → 1.266 across three calibrations; an outlier here is a bad-calibration flag. |
| `Search region`, `Star mass tolerance` | Required for §2.5 detection |
| `Dither scale`, `Dither = both axes` | Verifies dither configuration |
| `X/Y guide algorithm`, aggression, hysteresis, min-move | Correlate parameter changes with performance across nights |

Only **three** calibrations occurred (21:43:37, 01:10:14, 02:41:37); the ASIAir report shows one, because the manual recalibration at 02:41 happened while autorun was paused.

## 2.8 Dither amplitude — confirms the peak-column artifact

All 60 `INFO: DITHER by` records parsed:

- Mean magnitude **1.53 px** (max 2.54 px) = **9.6" mean, 16.0" max** on the guide scale
- ≈ **10 px** on the main camera at 0.96"/px

This confirms that the ~10–12.5" peaks in the reported per-session peak columns are the dithers themselves, not guiding errors. The dither setting is healthy; the metric was measuring the wrong thing.

---

# PART 3 — Cross-Log Fusion: Per-Sub Guiding RMS

Both logs are timestamped on the same clock. Joining ASIAir `Exposure 300.0s image N#` events to PHD2 frames falling inside each 300s window yields **per-sub guiding RMS** — the metric that actually matters for frame selection.

Result for this session (61 exposure starts; 150 guide frames per sub):

| Subs | In-exposure RMS | Verdict |
|---|---|---|
| 1–34, 43(2nd)–60 | 0.78" – 1.45" | 52 clean subs |
| **35** | 11.67" | reject |
| **36** | 11.66" | reject (also began un-settled) |
| **37** | 6.43" | reject |
| **38** | 12.83" | reject |
| **39** | 10.70" | reject |
| **40** | 28.46" (peak 297.6") | reject |
| **41** | 11.35" | reject (began un-settled) |
| **42** | 6.01" | reject (began un-settled) |
| 43 (aborted) | 40.01" | discarded at capture |

**The reports flagged subs 35–40. The actual damage is subs 35–42 — eight frames, not six.** At 11" RMS with 0.96"/px imaging, that's ~12 px of smear; these are unambiguous rejects.

**Usable integration: 52 × 300s = 4h 20m** of the 60 captured (5h 00m).

### Why this is the highest-value addition

- It replaces a session-level "inspect subs 35–40" hint with a per-frame number.
- It's directly comparable to the SubframeSelector and Photyx metrics already in your workflow, and it measures something they cannot: guiding is invisible to star-shape statistics when the smear is small, and this catches it independently.
- Exported as CSV keyed on frame number, it drops straight into a weighting or rejection pass.
- It costs nothing beyond a join both parsers already have the data for.

Suggested export columns: `image_no, start_utc, rms_ra, rms_dec, rms_total, peak_total, dropped_frames, settled_at_start, guide_snr_median, af_star_size_of_block, temperature`.

### Second-order fusion opportunities

- **Un-settled start flag** — from `Settle Timeout` / `Settling failed`, marks subs whose first seconds were unguided. Trailing is concentrated at the exposure start rather than distributed, so these frames fail differently and are worth blinking separately.
- **Sub-to-session attribution** — anomalies currently report line numbers. Reporting affected image numbers is far more useful at the processing stage.
- **Autofocus star size per imaging block** — a per-block seeing proxy attached to the frames it applies to.
- **Guide health during the flip** — the flip and its recalibration bracket a natural quality boundary.

---

# PART 4 — Prioritized Recommendations

## ASIAir parser

| # | Change | Priority |
|---|---|---|
| A1 | Match `Settle (Done\|Timeout)`; bound all forward scans by terminator and elapsed time | **Critical** |
| A2 | Exclude un-settled dithers from the learned-value EMA; flag affected subs | **Critical** |
| A3 | Remove `ditherTotalS` from `totalTrackedS`; present dither as nested within imaging | **Critical** |
| A4 | Reconcile parsed timeline against wall clock; report unaccounted remainder | High |
| A5 | Detect `Stop Autorun Manually` / `Pause Autorun` / `Log disabled`→`enabled` gaps as events | High |
| A6 | Detect duplicate image numbers → aborted-frame event | High |
| A7 | Capture AF temperature, focuser position, achieved star size, trigger reason | High |
| A8 | Emit temp-comp coefficient (regression + r² + residuals) | Medium |
| A9 | Capture `"ZWO000" is Disconnected` events | Medium |
| A10 | Parse `Wait NminNs to Meridian Flip` for the configured pause | Medium |
| A11 | Capture plate-solve angle, star number, AutoCenter retry count | Medium |
| A12 | Fix `_extractTarget` for names containing spaces; capture target RA/Dec | Medium |
| A13 | Report calibration frame coverage (flats/darks/bias sessions) as a footnote | Low |

## PHD2 parser

| # | Change | Priority |
|---|---|---|
| P1 | Filter rows on `parts[2] === "Mount"`; handle `DROP` separately | **Critical** |
| P2 | Guard all aggregates with `Number.isFinite`; never let NaN reach the view | **Critical** |
| P3 | Replace `ERROR_CODES` with column 18's self-described reason string | **Critical** |
| P4 | Remove the hardcoded "satellite or aircraft pass" narrative assertion | **Critical** |
| P5 | Compute RMS on settled frames only; report all-frames separately | **Critical** |
| P6 | Parse `Settling failed`; flag the affected subs | High |
| P7 | Guide-star swap detection: recurring identical (dx,dy) + bimodal star mass | High |
| P8 | Warn when lock position is within ~150 px of a frame edge | High |
| P9 | Report drop-rate per session as a primary health metric | High |
| P10 | Report frame-cadence irregularity (count of >1.5× nominal intervals) | Medium |
| P11 | Capture per-session header block (pier side, HA, lock pos, HFD, rates, search region, mass tolerance) | Medium |
| P12 | Flag calibration rate outliers across the night | Medium |
| P13 | Report dither amplitude in guide px, arcsec, and main-camera px | Medium |
| P14 | RA periodogram on long clean sessions, presented descriptively | Low |

## Cross-log

| # | Change | Priority |
|---|---|---|
| X1 | Per-sub guiding RMS table + CSV export | **Highest value** |
| X2 | Un-settled-start flag per sub | High |
| X3 | Express all anomalies in image numbers, not just log line numbers | High |
| X4 | Attach per-block AF star size to each sub | Medium |

## Cross-cutting principles

- **Never scan forward without a terminator set and a time bound.** Both cascade bugs share this shape.
- **Prefer the log's self-description over a hardcoded lookup**, and label anything inferred.
- **Validate totals against wall clock**, and surface the residual rather than absorbing it.
- **Don't let a derived value silently feed the planner.** The corrupted 59s dither reached the sequence plan with no visible provenance; learned values should carry a date and a sample count, and be rejected when derived from anomalous events.
- **Assert on non-finite values at the parser/view boundary.**

---

# PART 5 — Revised Session Facts

| Quantity | Earlier reports | Corrected from raw logs |
|---|---|---|
| Subs captured | 58 | **60 complete + 1 aborted** |
| Exposure | 300s | 300s (confirmed) |
| Sub cycle | 352s modeled | **~323s measured** (300 + ~23 overhead) |
| Dither events | 56 (ASIAir) / 60 (PHD2) | **60** — both logs agree once timeouts are handled |
| Dither+overhead per sub | 59s | **22.8s mean / 24s median** (clean blocks) |
| Dither total | 55.1m | **26.7m (7.2% of session)** |
| Session-wide RMS | NaN → "poor" | **0.97" settled** (RA 0.79", Dec 0.55") |
| Session 12 | "Good guiding, NaN" | **55.34" — worst session of the night** |
| Autofocus events | 10 | **11** |
| Guide calibrations | 1 | **3** (21:43, 01:10, 02:41) |
| 02:23–02:48 gap | unexplained | imgs 41–42 captured; manual stop 02:39:34–02:48:18 |
| Damaged subs | 35–40 | **35–42** (8 subs) |
| Usable integration | 3h 28m | **4h 20m** (52 × 300s) |
| Cause of anomaly | "mount overcorrection or periodic error" | **Guide-star swap: 47.2 px companion inside the 50 px search region, primary star 96 px from frame edge** |

---

# PART 6 — Corrections to My Earlier Analysis

Explicitly flagged, since these were stated with more confidence than the evidence supported:

1. **"Cable drag on the east side" — wrong.** I ranked it most likely from the RA-only signature and post-flip timing. The frame-level data shows a fixed 47.2 px displacement with a bimodal star mass, which is a guide-star swap and rules out a mechanical cause. **No cable inspection is needed.** The post-flip calibration hypothesis is also ruled out — the same calibration (xRate 1.407) guided session 10 cleanly at 1.16" settled.

2. **"Images 41 and 42 are gone" — wrong.** Both were captured, at 02:24:58 and 02:31:02. The gap was a parser artifact, not lost data.

3. **"Session 12 was a failed guide recovery on a saturated edge star" — wrong,** and built entirely on the mislabeled error codes. Session 12 was a continuation of the same star-swap problem, ended by your manual stop. Its 33 dropped frames all occurred *after* that stop.

4. **"Session 12 classified good despite errors" — understated.** It wasn't merely mislabeled; it concealed the worst session of the night.

5. **The 59s dither mechanism — wrong.** I inferred the learner was attributing all non-exposure time to dither. The actual mechanism is the unterminated forward scan past `Settle Timeout` (§1.1). The arithmetic coincidence I cited was just that.

6. **Recommended dither value 17s — revise to ~21s.** Direct measurement of in-block sub-to-sub intervals gives 22.8s mean total overhead; less the 2s sub gap, the dither value should be **21s**, cycle **323s**, six-sub block **32.3m**. My 17s came from back-solving through the corrupted block totals rather than measuring directly.

7. **Settled RMS 1.39" — revise to 0.97".** My earlier figure included dither-settle frames.

8. **"Guiding was lost ~6 min before imaging stopped" — wrong.** PHD2 session 11 ended at 02:16:49 because the ASIAir stopped guiding for the autofocus at that timestamp, not because the star was lost. Normal sequence behaviour.

Two earlier findings **survive verification**: the ~12" peak-column ceiling is the dither amplitude (measured mean 9.6", max 16.0"), and RA is consistently worse than Dec (0.79" vs 0.55" settled, a 44% difference, larger than I originally estimated).

---

# PART 7 — Effect on the Sequence Plan

Correcting the parser changes two of the recommended Astryx settings from my previous document:

| Setting | Previously recommended | Now |
|---|---|---|
| Dither (learned) | 17s | **21s** |
| Flip Pause | 6 min | **5.7m observed → derive it** |

The flip pause is now fully decomposable, because the log states the configured part directly:

```
01:01:40 [Meridian Flip|Begin] Wait 5min42s to Meridian Flip
01:07:22 Meridian Flip 1# Start
01:08:14 [Meridian Flip|End] Meridian Flip succeeded
```

The 5m42s is the ASIAir's own computed wait from the end of the last pre-flip sub to the flip point — not a fixed setting. Astryx already computes transit time, so given the target RA/Dec (also in the log), the flip offset, and the sub cycle, this value is fully determined and should be **calculated rather than stored**. The flip itself took 52s, consistent with the 1 min I recommended.

Corrected cycle: **300 + 2 + 21 = 323s**, six-sub block **32.3m** (Astryx currently models 35.2m). This still closes the drift to roughly a minute across the first four blocks.

---

## Appendix — Reproduction

All figures above were computed directly from the two raw logs. Your `asiair-log-parser.js` was executed unmodified against `Autorun_Log_2026-07-23_220534.txt` to confirm the cascade in §1.1; it reproduced the published report exactly, including the 407s / 189s / 1491s dither durations, `ditherAvgS = 59.0`, `totalTrackedS = 397.4m`, and the imgs 35–40 block at 36.8m.
