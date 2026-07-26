# Log Corpus Index

**Range:** 2025-10-23 → 2026-07-23
**Files:** 25 ASIAir Autorun logs, 19 PHD2 guide logs
**Purpose:** One row per session with headline metrics, so later analysis can reference a night without reprocessing. Raw logs are not committed; filenames are given so originals can be located on the data drive.

Guide RMS below is **settled-frames-only, frame-weighted**, computed with the corrected parsing described in the format survey. It is not what the current Astryx report produces.

---

## Imaging sessions

| Date | Targets | Exp | Subs | Span | Guide RMS | Guide sess | Drops | Annotate? |
|---|---|---|---|---|---|---|---|---|
| 2025-10-23 | IC405, NGC281, NGC7023 | 300s | 104 | 9.9h | 1.20" | 26 | 10 | |
| 2025-11-17 | IC405, NGC281 | 300s | 110 | 10.6h | 1.18" | 25 | 14 | **yes** |
| 2025-11-23 | DQ Piscium, IC405, NGC281 | 300s | 164 | 12.0h | 1.13" | 24 | 2 | **yes** |
| 2025-12-16 | M1 | 300s | 94 | 5.4h | 1.27" | 21 | 86 | **yes** |
| 2025-12-20 | M1 | 300s | 104 | 6.4h | 1.32" | 45 | 322 | **yes** |
| 2025-12-21 | M1, NGC1333 | 300s | 140 | 12.1h | 1.23" | 29 | 22 | |
| 2026-02-03 | C49, NGC1333 | 300s | 53 | 4.8h | 1.02" | 4 | 13 | **yes** |
| 2026-02-04 | C49 | 300s | 60 | 5.3h | 1.39" | 3 | 0 | |
| 2026-02-05 | C49 | 300s | 60 | 5.3h | 1.03" | 3 | 0 | |
| 2026-02-06 | C49 | 300s | 27 | 2.4h | 0.97" | 10 | 74 | **yes** |
| 2026-03-09 | NGC4244 | 300s | 91 | 8.5h | 1.16" | 22 | 0 | **yes** |
| 2026-03-19 | NGC4244 | 300s | 145 | 8.5h | 1.12" | 17 | 0 | |
| 2026-04-17 | NGC4565 | 300s | 125 | 8.1h | 0.89" | 17 | 24 | **yes** |
| 2026-04-21 | test | 1s | 1 | 0.0h | — | — | — | |
| 2026-05-09 | M64 | 300s | 118 | 6.0h | 0.94" | 13 | 0 | |
| 2026-05-11 | M64 | 300s | 57 | 5.8h | 1.08" | 130 | 1334 | **yes** |
| 2026-06-05 | M92, M12, M10, M64 | 12/60/300s | 245 | 6.8h | 1.17" | 45 | 232 | **yes** |
| 2026-06-15 | Sh2-101 (+FOV) | 300s | 137 | 6.3h | 1.00" | 43 | 293 | **yes** |
| 2026-07-13 | Sh2-101 | 300s | 115 | 7.0h | 0.94" | 12 | 0 | |
| 2026-07-23 | Sh2-101 | 300s | 121 | 6.4h | 0.97" | 16 | 33 | **yes** |

*Sub counts are raw `Exposure ... image N#` occurrences and include restarts and aborted frames; they are not net keeper counts.*

## Calibration-only sessions

| Date | File | Content |
|---|---|---|
| 2025-10-23 | `Autorun_Log_2025-10-23_194936.txt` | 60 flats, 1.2s |
| 2025-11-18 | `Autorun_Log_2025-11-18_081759.txt` | 60 flats (morning) |
| 2026-02-04 | `Autorun_Log_2026-02-04_144918.txt` | 60 flats (afternoon) |
| 2026-03-10 | `Autorun_Log_2026-03-10_063916.txt` | 60 flats (morning) |
| 2026-06-20 | `Autorun_Log_2026-06-20_213945.txt` | 60 flats |

These produce `target = Unknown` under the current parser. They should be recognised as calibration sessions and reported as such rather than as failures.

## Unpaired ASIAir logs

No matching PHD2 guide log for: 2025-10-23_194936, 2025-11-18, 2026-02-04_144918, 2026-03-10, 2026-04-21, 2026-06-20.

All are flat-only or the 1-frame test run, so no guiding was expected. **Every imaging night in the corpus has a paired guide log** — good coverage for cross-log work.

---

## Event summary per night

Counts of failure-class events, from the ASIAir log.

| Date | Star lost | Select failed | AF failed | Settle T/O | Manual stop | Mount disc. | Slew/solve fail | Off-centre |
|---|---|---|---|---|---|---|---|---|
| 2025-10-23 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 4 |
| 2025-11-17 | 1 | **102** | 0 | 1 | 0 | 0 | 1 | 5 |
| 2025-11-23 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 4 |
| 2025-12-16 | 8 | 21 | 0 | 0 | 3 | 0 | 0 | 0 |
| 2025-12-20 | **30** | **122** | 1 | 2 | 1 | 0 | 0 | 2 |
| 2025-12-21 | 1 | 0 | 2 | 1 | 0 | 0 | 0 | 6 |
| 2026-02-03 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |
| 2026-02-04 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 1 |
| 2026-02-05 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| 2026-02-06 | 7 | 1 | 0 | 0 | 1 | 0 | 1 | 1 |
| 2026-03-09 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 1 |
| 2026-03-19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| 2026-04-17 | 1 | 9 | 0 | 1 | 1 | 0 | 0 | 1 |
| 2026-04-21 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| 2026-05-09 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| 2026-05-11 | **123** | **108** | 4 | 3 | 0 | 0 | 1 | 1 |
| 2026-06-05 | **23** | 9 | 0 | 1 | 2 | 0 | 0 | 10 |
| 2026-06-15 | **27** | **44** | 2 | 2 | 5 | 0 | 1 (dl) | 2 |
| 2026-07-13 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 |
| 2026-07-23 | 0 | 0 | 0 | **5** | 1 | 3 | 0 | 1 |

---

## Nights flagged for annotation

A one-line note from you would materially improve detector validation on these. The logs show *what* happened but not *why* — in particular, whether you intervened because something looked wrong on screen, or the system failed on its own.

| Date | What the log shows | Question |
|---|---|---|
| **2026-05-11** | 123 star-lost, 108 select-failed, 4 AF failures, 1 plate-solve failure, 1,334 dropped guide frames (17.7%), 131 guide sessions. Only 57 subs in 5.8h. | Clouds? Dew? Something mechanical? This is the worst night in the corpus by a wide margin. |
| **2025-12-20** | 30 star-lost, 122 select-failed, 322 drops, 47 guide sessions, 104 subs in 6.4h. | Similar signature to 2026-05-11 but milder. Same cause? |
| **2026-06-15** | 27 star-lost, 44 select-failed, 5 manual stops, 1 `Download failed`, 293 drops. | Five manual interventions — what were you responding to? Also the only `Download failed` in the corpus. |
| **2025-11-17** | 102 select-failed but only 1 star-lost, and guiding was fine at 1.18". | Odd combination — repeated star *selection* failures without guiding degrading. Was this at the start of the night? |
| **2025-12-16** | 94 subs against 280 planned; 3 manual stops; 86 drops. | Ended early — weather, or did you change plan? |
| **2026-02-06** | 27 subs against 40 planned in 2.4h; 7 star-lost; 74 drops. | Ended early. |
| **2026-02-03** | Only 4 guide sessions for 53 subs across 4.8h — far fewer sessions than usual for that many subs. | Was guiding running continuously, or was PHD2 restarted? |
| **2026-06-05** | 3 separate `Plan Tonight` runs, 4 targets, 3 exposure lengths (12s/60s/300s), 245 exposures. | What was this — a test night, or a deliberate multi-target plan? Understanding the intent shapes how the report should group it. |
| **2026-04-17** | 9 select-failed, 1 manual stop, best guiding in the corpus (0.89"). | Minor — mainly what the manual stop was for. |
| **2026-03-09** | 91 subs against 180 planned, 1 manual stop. | Ended about halfway. |
| **2025-11-23** | 12-hour session, 3 targets including `DQ Piscium`, 164 subs. | Longest night in the corpus. Anything notable? Also: is `DQ Piscium` a variable-star run rather than deep-sky imaging? |
| **2026-07-23** | Already analysed in detail. | Confirmed: manual stop at 02:39 followed by recalibration. |

Nights **not** needing annotation — clean and self-explanatory, useful as baselines: 2025-10-23, 2025-12-21, 2026-02-04, 2026-02-05, 2026-03-19, 2026-05-09, 2026-07-13.

---

## Corpus coverage assessment

**Well covered:**
- Normal single-target 300s imaging with meridian flip — 14 nights
- Multi-target `Plan Tonight` structure — 6 nights
- Guide-star failure cascades — 4 nights at varying severity
- Early session termination — 4 nights
- Manual intervention — 10 nights
- Flat calibration runs — 5 nights
- Both mount-string firmware generations — 6 before / 13 after
- Bin1 and Bin2 guiding — 4 nights mixed

**Thin or absent — worth pulling if you have them:**

| Gap | Why it matters |
|---|---|
| **Dark / bias autoruns** | `_extractLightFrameLines` filters for them but has never been tested against one. |
| **A failed meridian flip** | The success string is known; the failure string is not. Currently unhandleable. |
| **Two flips in one session** | `Meridian Flip <N>#` is numbered, so the firmware anticipates it. Never observed. |
| **Anything older than 2025-10** | The format-drift window is only 9 months. Older logs would strengthen the drift analysis considerably. |
| **A night with a different guide scope or camera** | Everything in the corpus is 123 mm / ASI120MM Mini, so scale-dependent logic is untested. |
| **A night where an Astryx report gave a number you knew was wrong** | Direct validation targets. |

Nothing in the gap list blocks the design work. They are worth adding opportunistically rather than searching for.
