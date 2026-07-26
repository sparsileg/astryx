# Threshold Calibration

**Derived from:** 25 ASIAir logs, 19 PHD2 logs, 2025-10-23 → 2026-07-23
**Purpose:** Replace guessed constants in the anomaly detectors with distributions measured from this rig. Every threshold below is expressed as a percentile of observed behaviour rather than a round number.

**Scope caveat:** these are baselines for *this* equipment (AM5 + AT115EDT + ASI120MM Mini guider at 123 mm, 6.29"/px). They are not universal. Any value shipped as a default should be marked as such, and ideally recalculated from the user's own history once enough sessions have accumulated.

---

## 1. Guiding performance baseline

Computed on **settled frames only** (excluding frames between `Settling started` and its terminator), frame-weighted, excluding sessions above 4" total.

| Night | RA | Dec | Total | All-frames total |
|---|---|---|---|---|
| 2025-10-23 | 0.93 | 0.76 | 1.20 | 1.35 |
| 2025-11-17 | 0.82 | 0.84 | 1.18 | 1.87 |
| 2025-11-23 | 0.86 | 0.74 | 1.13 | 1.27 |
| 2025-12-16 | 1.02 | 0.76 | 1.27 | 1.44 |
| 2025-12-20 | 1.00 | 0.86 | 1.32 | 1.45 |
| 2025-12-21 | 1.02 | 0.69 | 1.23 | 1.38 |
| 2026-02-03 | 0.84 | 0.58 | 1.02 | 1.64 |
| 2026-02-04 | 1.17 | 0.76 | 1.39 | 1.95 |
| 2026-02-05 | 0.85 | 0.57 | 1.03 | 1.55 |
| 2026-02-06 | 0.81 | 0.55 | 0.97 | 1.75 |
| 2026-03-09 | 0.89 | 0.74 | 1.16 | 1.33 |
| 2026-03-19 | 0.88 | 0.69 | 1.12 | 1.29 |
| 2026-04-17 | 0.72 | 0.53 | 0.89 | 1.32 |
| 2026-05-09 | 0.77 | 0.53 | 0.94 | 1.34 |
| 2026-05-11 | 0.88 | 0.62 | 1.08 | 1.44 |
| 2026-06-05 | 0.95 | 0.68 | 1.17 | 3.84 |
| 2026-06-15 | 0.83 | 0.54 | 1.00 | 1.37 |
| 2026-07-13 | 0.76 | 0.56 | 0.94 | 1.34 |
| 2026-07-23 | 0.79 | 0.55 | 0.97 | 1.39 |

**Corpus: median 1.12", range 0.89" – 1.39".**

Three findings worth carrying into the design:

**(a) The settled/all-frames gap is systematic.** All-frames RMS runs 15–35% higher on typical nights and 3.3× higher on the short-exposure night (2026-06-05: 1.17" settled vs 3.84" all-frames, where only 70% of frames were settled). Reporting all-frames RMS as the headline is not a small inaccuracy — it varies with dither frequency, so it makes nights incomparable.

**(b) RA is consistently worse than Dec.** Median ratio **1.38** across all 19 nights, on both sides of the meridian. This is a stable property of the rig, consistent with harmonic-drive periodic error, and it means a *Dec-worse-than-RA* night is itself an anomaly worth flagging.

**(c) Performance improved over the 9 months.** First five nights median 1.20"; last five median 0.97". Any absolute threshold set today will drift out of calibration.

### Recommended thresholds

| Band | Value | Basis |
|---|---|---|
| Excellent | < 0.95" | ~p25 of corpus |
| Normal | 0.95" – 1.30" | p25–p85 |
| Elevated | 1.30" – 2.0" | above observed range |
| High | > 2.0" | never observed on a clean night |
| Critical | > 4.0" | retain |

Current code uses `rmsElevated: 2.0` and `rmsHigh: 4.0` against **all-frames** RMS. Against settled RMS, 2.0" is well outside anything this rig has produced, so the elevated band never fires on real degradation — the thresholds and the metric were mismatched.

**Preferred long-term form:** compare against the user's own trailing median rather than a constant. "1.45" — 30% above your 90-day median of 1.12"" is more useful than any fixed band, and it self-calibrates as the rig improves.

---

## 2. Dither settle duration

n = 827 dither settles across 19 nights.

| Percentile | Seconds |
|---|---|
| p10 | 11 |
| p25 | 18 |
| **p50** | **22** |
| p75 | 27 |
| p90 | 33 |
| p99 | 61 |
| max | 63 |

Successful settles only (n = 815): median 21s, p90 33s.

Per-night medians are tightly clustered — 20s to 31s across all 19 nights, with no trend. **This is a stable rig characteristic and a good candidate for a learned value**, provided corrupted samples are excluded.

| Purpose | Value |
|---|---|
| Sequence-plan dither duration | **21s** (median of successful settles) |
| Conservative planning value | 27s (p75) |
| "Slow settle" anomaly threshold | > 33s (p90) |
| Per-night median outside 18–31s | flag as unusual for this rig |

The observed 63s maximum is the ASIAir's configured settle timeout (60s plus reporting overhead), confirmed by every `Settle Timeout` event landing at exactly 63s.

## 3. Settle failure rate

**Corpus baseline: 12 failures in 827 dithers = 1.5%.**

Per night, 15 of 19 nights had 0 or 1. The 2026-07-23 session had **5 in 60 = 8.3%**, which is 5.5× baseline — a defensible anomaly threshold derived from data rather than assumed.

| Band | Rate |
|---|---|
| Normal | ≤ 2% |
| Elevated | 2% – 5% |
| Anomalous | > 5% |

Note the ASIAir and PHD2 sides disagree in magnitude: ASIAir logs 21 `Settle Timeout`/`Settle failed` events; PHD2 logs 579 `Settling failed`. PHD2 counts every failed settle including those it retries internally, while the ASIAir logs only the ones that expire its own timer. **Both are meaningful and they measure different things** — a report should use the ASIAir count for "subs that started unsettled" and the PHD2 count for guide-health trending.

## 4. Sub cadence overhead

Measured as (start of sub *n+1*) − (start of sub *n*) − exposure, for consecutive subs within an imaging block, on clean blocks only.

For the 2026-07-23 session: n = 42, mean 22.8s, median 24s, p90 30s, max 48s.

This tracks the dither settle distribution closely, as expected when dithering every frame. **Recommended decomposition for the sequence planner:** sub gap 2s (camera download), dither 21s, cycle 323s at 300s exposure.

The learned value must be computed from clean blocks only. Including blocks containing settle timeouts or manual interventions is what produced the corrupted 59s.

## 5. Autofocus

n = 225 AF events (Begin → End) across the corpus.

| Metric | Value |
|---|---|
| Median duration | 109s (1.8m) |
| p90 | 113s (1.9m) |
| Maximum | 225s (3.8m) |
| Success rate | 217 / 227 = **95.6%** |
| Failures | 10 across 5 nights |

Adding guide re-select and settle (as the ASIAir report does) brings the effective figure to ~2.1m, consistent with the current 2-minute Astryx setting.

| Purpose | Value |
|---|---|
| Sequence-plan AF duration | 2.0 min (includes settle) |
| "Slow AF" flag | > 150s |
| AF failure rate flag | > 10% in one session |

**Focuser temperature coefficient** (2026-07-23, 11 AF events): −20.2 steps/°C, r² = 0.975, max residual ±6.4 steps. Only one night has been regressed so far; this should be recomputed per night and trended, since a change in the coefficient indicates a mechanical change in the focuser or train.

**Critical focus zone**, from pooled V-curve and fine-sweep samples: ±20 steps ≈ +6% star size, ±30 steps ≈ +13%.

## 6. Guide-star failure events

Two high-volume ASIAir events, currently unparsed:

| Event | Corpus count | Nights affected |
|---|---|---|
| `[Guide] Select Guide Star failed, no star found` | 416 | 8 of 25 |
| `[Guide] Guide star lost` | 222 | 10 of 25 |

Distribution is heavily skewed — 2026-05-11 alone accounts for 123 star-lost and 108 select-failed events. On 15 nights the counts are zero or single-digit.

| Band | Per night |
|---|---|
| Normal | ≤ 5 combined |
| Elevated | 6 – 25 |
| Anomalous | > 25 |

## 7. PHD2 dropped frames

Corpus total 2,539 DROP rows out of 215,130 frames = **1.18%**.

Per-night rate varies enormously:

| Night | Drops | Frames | Rate |
|---|---|---|---|
| 2026-05-11 | 1334 | 7,557 | 17.7% |
| 2025-12-20 | 322 | 10,949 | 2.9% |
| 2026-06-15 | 293 | 9,450 | 3.1% |
| 2026-06-05 | 232 | 8,431 | 2.8% |
| 2026-02-06 | 74 | 4,199 | 1.8% |
| 2025-12-16 | 86 | 8,252 | 1.0% |
| 7 nights | 0 | — | 0.0% |

| Band | Rate |
|---|---|
| Normal | < 0.5% |
| Elevated | 0.5% – 2% |
| Anomalous | > 2% |

Drop rate is a better guide-health indicator than error-code counting, because it is a single normalized number and does not depend on the error-code mapping.

## 8. Dither amplitude

From 828 `INFO: DITHER by` records (2026-07-23 subset measured in detail): mean magnitude 1.53 px, max 2.54 px on the guide scale — **9.6" mean, 16.0" max**, ≈ 10 main-camera px at 0.96"/px.

This confirms that per-session *peak* RA/Dec values clustering at 10–12.5" are the dithers themselves. Peak metrics must be computed on settled frames only, or they measure the dither setting rather than guiding.

## 9. Guide-star swap detector — specificity

The detector proposed in the raw-log findings document (recurring near-identical displacement combined with depressed star mass) was run across all **511 guide sessions** in the corpus.

Criteria: ≥5 frames with star mass < 85% of session median and displacement > 8 px, where the coefficient of variation of those displacements is < 0.15.

**Result: 2 flags, both on 2026-07-23, sessions 11 and 12 — the two known-bad sessions. Zero flags elsewhere.**

| Session | Frames | Displacement | CV | Search region | Lock position |
|---|---|---|---|---|---|
| 2026-07-23 01:46 | 16 | 46.7 px | 0.03 | 50 px | (1174, 96) |
| 2026-07-23 02:18 | 22 | 46.2 px | 0.07 | 50 px | (1171, 103) |

Zero false positives across 9 months. The CV < 0.15 criterion is what provides the specificity — a genuine mount excursion produces scattered displacements, a star swap produces identical ones.

**Supporting threshold — lock position edge proximity.** Both flagged sessions locked within 105 px of the frame edge on a 1280×960 sensor. Corpus distribution of edge distance should be gathered before setting this as an independent warning; on the July night, clean sessions ranged 112–410 px.

## 10. Frame cadence irregularity

PHD2 guide exposure is 2000 ms throughout the corpus. Frame intervals exceeding 3s:

| Session type | Count per session |
|---|---|
| Clean | 0 – 6 |
| 2026-07-23 session 11 | 59 |
| 2026-07-23 session 12 | 33 |

| Band | Count |
|---|---|
| Normal | ≤ 8 |
| Anomalous | > 15 |

Cheap to compute, independent of RMS, and it fired correctly on the known-bad sessions.

---

## 11. Summary table

| Threshold | Value | Confidence | Basis |
|---|---|---|---|
| Guiding excellent | < 0.95" settled | High | 19 nights |
| Guiding elevated | > 1.30" settled | High | 19 nights |
| Guiding high | > 2.0" settled | High | never observed clean |
| RA/Dec ratio normal | 1.2 – 1.6 | High | median 1.38 |
| Dither settle typical | 21s | High | n=815 |
| Dither settle slow | > 33s | High | p90 |
| Settle failure normal | ≤ 2% | High | n=827 |
| Settle failure anomalous | > 5% | Medium | one known-bad night |
| Sub cycle overhead | 23s | Medium | one night measured in detail |
| AF duration typical | 109s | High | n=225 |
| AF failure elevated | > 10% | Medium | corpus 4.4% |
| Guide-star failures anomalous | > 25/night | Medium | 8 nights affected |
| PHD2 drop rate elevated | > 0.5% | High | n=215k frames |
| PHD2 drop rate anomalous | > 2% | High | 5 nights above |
| Star-swap CV | < 0.15 | High | 0 false positives / 511 sessions |
| Cadence irregularity | > 15 per session | Medium | 2 known-bad sessions |
| Focus temp coefficient | −20.2 steps/°C | Low | one night |
| Critical focus zone | ±20 steps = +6% | Low | one night, pooled fit |

Low-confidence entries need more nights before they are worth acting on; they are recorded here so the design can accommodate them without committing to the numbers.
