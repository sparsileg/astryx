# Log Format Survey

**Corpus:** 25 ASIAir Autorun logs, 19 PHD2 guide logs
**Date range:** 2025-10-23 → 2026-07-23 (9 months)
**Volume:** ~21 MB; 511 PHD2 guide sessions; 215,000+ guide frames; 2,371 light-frame exposures
**Purpose:** Specification input for the ASIAir and PHD2 parsers. Every line pattern observed in the corpus is catalogued here with occurrence counts and first/last-seen dates.

---

## 1. Summary of format risks

| Risk | Severity | Detail |
|---|---|---|
| A log can contain **multiple targets** | **Critical** | 9 of 25 logs (36%). Current single-target model is wrong for over a third of the corpus. |
| A log can contain **multiple exposure lengths** | **Critical** | 2026-06-05 has 12s, 60s and 300s light frames in one file. |
| PHD2 **pixel scale changes mid-log** | **Critical** | 4 of 19 logs contain both Bin1 (6.29"/px) and Bin2 (12.58"/px) sessions. A single global pixel scale halves or doubles the RMS on those nights. |
| `Settle Done` is **not the only terminator** | **Critical** | `Settle Timeout` and `Settle failed` both occur. |
| Target names are **inconsistent within a single log** | High | `M 1` and `M1`; `C 49` and `C49`; `NGC 4565` and `NGC4565`. |
| Target names **contain spaces** | High | `DQ Piscium`, `NGC 1333`, `C 49`. Breaks `\S+` capture. |
| Exposures can be **in milliseconds** | High | `Exposure 258.3ms image 1#`. Current regex silently drops these. |
| DEC can be **negative** | High | `DEC:-19°1'32"` on 2026-06-05. |
| Mount identifier **changed** | Medium | `ZWO AM5/AM3` → `ZWO000` at 2026-02-03. |
| `Plan Tonight` wraps multiple autoruns | Medium | 6 logs. Changes the nesting structure. |
| Guiding sessions can be **unterminated** | Medium | 511 `Guiding Begins` vs 498 `Guiding Ends` across the corpus. |

---

## 2. ASIAir Autorun log — complete pattern catalogue

Placeholders: `<N>` integer, `<F>` decimal, `<S>` string.

### 2.1 Structural / lifecycle

| Pattern | Count | Files | First–Last |
|---|---|---|---|
| `Log enabled at <N>/<N>/<N> <N>:<N>:<N>` | 52 | 23 | 2025-10-23 – 2026-07-23 |
| `Log disabled at <N>/<N>/<N> <N>:<N>:<N>` | 52 | 23 | 2025-10-23 – 2026-07-23 |
| `Log closed at <N>/<N>/<N> <N>:<N>:<N>` | 2 | 2 | 2025-10-23 – 2025-11-17 |
| `[Autorun|Begin] <S> Start` | 65 | 21 | full range |
| `[Autorun|End] Finish Autorun` | 45 | 22 | full range |
| `[Autorun|End] Pause Autorun` | 16 | 10 | 2025-11-23 – 2026-07-23 |
| `Stop Autorun Manually` | 16 | 10 | 2025-11-23 – 2026-07-23 |
| `Plan Tonight Start` | 7 | 5 | 2025-10-23 – 2026-06-05 |
| `Plan Tonight Finish` | 5 | 4 | 2025-10-23 – 2026-06-05 |
| `Pause Plan Tonight` | 2 | 2 | 2025-11-23 – 2026-06-05 |
| `Shutdown ASIAIR` | 2 | 2 | 2025-10-23 – 2025-11-17 |
| `First delay <N>s Start` | 54 | 23 | full range |

**`Log disabled` / `Log enabled` pairs bound gaps in coverage.** These are not merely cosmetic — the 2026-07-23 session's 8.7-minute manual intervention is visible only as such a pair.

### 2.2 Target and framing

| Pattern | Count | Files |
|---|---|---|
| `Target RA:<N>h<N>m<N>s DEC:+<N>°<N>'<N>"` | 65 | 21 |
| `Target RA:...DEC:-<N>°<N>'<N>"` | — | 1 (2026-06-05) |
| `Mount slews to target position: RA:...DEC:+...` | 73 | 18 |
| `Mount slews to target position: RA:...DEC:-...` | 15 | 1 |
| `Solve succeeded: RA:...DEC:+... Angle = <F>, Star number = <N>` | 69 | 18 |
| `Solve succeeded: RA:...DEC:-...` | 13 | 1 |
| `Plate Solve` | 83 | 18 |
| `[AutoCenter|Begin] Auto-Center <N>#` | 88 | 18 |
| `[AutoCenter|End] The target is centered` | 38 | 18 |
| `[AutoCenter|End] Too far from center, distance = <N>%(<F>°)` | 44 | 18 |
| `[AutoCenter|End] Mount slews failed` | 5 | 5 |
| `[AutoCenter|End] Plate Solve failed, Star number = <N>` | 1 | 1 (2026-05-11) |
| `Exposure <F>s` (plate-solve frame) | 83 | 18 |

**Observed target name forms:** `M1`, `M 1`, `M64`, `M92`, `M12`, `M10`, `NGC281`, `NGC 1333`, `NGC1333`, `NGC4244`, `NGC 4565`, `NGC4565`, `NGC7023`, `IC405`, `C49`, `C 49`, `Sh2-101`, `DQ Piscium`, `FOV`, `test`.

Two normalization requirements follow: strip/normalize the space in catalogue designations, and recognise `FOV` and `test` as non-science runs.

### 2.3 Imaging

| Pattern | Count | Files |
|---|---|---|
| `Shooting <N> light frames, exposure <F>s Bin<N>` | 40 | 20 |
| `Shooting <N> flat frames, exposure <F>s Bin<N>` | 17 | 15 |
| `Shooting <N> flat frames, exposure <F>ms Bin<N>` | 1 | 1 |
| `Shooting <N> flat frames, auto-exposure Bin<N>` | 3 | 2 |
| `Exposure <F>s image <N>#` | 2371 | 23 |
| `Exposure <F>ms image <N>#` | 122 | 2 |
| `Download failed` | 1 | 1 (2026-06-15) |

**Exposure lengths observed in light frames:** 1.0s, 12.0s, 60.0s, 300.0s.
**Never observed:** dark or bias autoruns. The parser's `_extractLightFrameLines` filter for these is untested.

### 2.4 Autofocus

| Pattern | Count | Files |
|---|---|---|
| `[AutoFocus|Begin] Run AF <F> hours later, ...` | 124 | 15 |
| `[AutoFocus|Begin] Run AF when temperature changed <N> degrees, <F>℃ changed to <F>℃, ...` | 52 | 13 |
| `[AutoFocus|Begin] Run AF before Autorun start, ...` | 32 | 16 |
| `[AutoFocus|Begin] Run AF after Auto Meridian filpped, ...` | 17 | 14 |
| `[AutoFocus|End] Auto focus succeeded` | 217 | 15 |
| `[AutoFocus|End] Auto focus failed` | 8 | 5 |
| `Auto focus succeeded, the focused position is <N>` | 217 | 15 |
| `Auto focus failed, EAF returns to the position <N> where the last focus was succeeded` | 2 | 2 |
| `Cancel AF Manually` | 2 | 2 |
| `Find Focus Star` | 225 | 16 |
| `Find Focus Star: detect and calculate star size <F> ,  EAF position <N>` | 449 | 16 |
| `Find Focus Star: finding appropriate stars star size <F>` | 223 | 16 |
| `Find Focus Star: not found Focus Star, try to increase EXP time or Gain` | 4 | 3 |
| `Calculate V-Curve` | 220 | 15 |
| `Calculate V-Curve: detect and calculate star size <F> ,  EAF position <N>` | 2146 | 15 |
| `Calculate V-Curve : detect star failed, try to increase EXP time or Gain` | 1 | 1 |
| `Find Focus Point` | 218 | 15 |
| `Calculate Focus Point: detect and calculate star size <F> ,  EAF position <N>` | 1115 | 15 |
| `Find Focus Point: Upper limit of data point` | 1 | 1 |

Two format hazards: **`filpped` is a typo in ASIAir's own output** — if a future firmware corrects it, any parser matching the string stops detecting post-flip autofocus. And `Calculate V-Curve :` (space before colon) differs from `Calculate V-Curve:` in the success case.

The double space in `star size <F> ,  EAF position` is consistent across the whole corpus but should be matched with `\s+` rather than literally.

### 2.5 Guiding (as reported by ASIAir)

| Pattern | Count | Files |
|---|---|---|
| `[Guide] Settle Done` | 1049 | 19 |
| `[Guide] Dither` | 843 | 19 |
| `[Guide] Dither Settle` | 828 | 19 |
| `[Guide] ReSelect Guide star` | 864 | 19 |
| `[Guide] Start Guiding` | 835 | 16 |
| `[Guide] Stop Guiding` | 242 | 19 |
| `[Guide] Guide Settle` | 263 | 19 |
| `[Guide] Select Guide Star failed, no star found` | **416** | 8 |
| `[Guide] Guide star lost` | **222** | 10 |
| `[Guide] Settle Timeout` | 16 | 12 |
| `[Guide] Settle failed` | 5 | 3 |
| `[Guide] Start Calibrating` | 29 | 18 |
| `[Guide] Calibrate Success` | 29 | 18 |
| `[Guide] Stop Looping and Guiding` | 10 | 10 |
| `[Guide] Stop Looping` | 5 | 4 |
| `[Guide] Start Tracking failed` | 1 | 1 |

`Select Guide Star failed` (416) and `Guide star lost` (222) are the two highest-volume failure events in the entire corpus, and neither is parsed or reported today.

**Three settle terminators exist:** `Settle Done`, `Settle Timeout`, `Settle failed`. Any forward scan must match all three.

### 2.6 Mount and meridian

| Pattern | Count | Files |
|---|---|---|
| `Start Tracking` | 262 | 20 |
| `Stop Tracking` | 37 | 18 |
| `Wait for Mount Settle` | 21 | 18 |
| `Mount GoTo Home POS` | 16 | 14 |
| `[Meridian Flip|Begin] Wait <N>min<N>s to Meridian Flip` | 21 | 18 |
| `Meridian Flip <N># Start` | 21 | 18 |
| `[Meridian Flip|End] Meridian Flip succeeded` | 21 | 18 |
| `"ZWO<N>" is Disconnected` | 4 | 2 |

No failed meridian flip appears in the corpus — `[Meridian Flip|End]` is always `succeeded`. The failure string is unknown and must be handled defensively.

`Meridian Flip <N>#` is numbered, so more than one flip per session is anticipated by the firmware even though the corpus has only single flips.

---

## 3. PHD2 guide log — complete pattern catalogue

### 3.1 Session and header structure

Each `Guiding Begins` and each `Calibration Begins` is followed by a full header block. The corpus contains **557 header blocks: 511 guiding + 46 calibration.** A parser that reads equipment settings once globally will attribute the wrong pixel scale on any night with mixed binning.

| Pattern | Count | Files |
|---|---|---|
| `PHD<N> version, Log version <F>. Log enabled at ...` | 19 | 19 |
| `Guiding Begins at <date>` | 511 | 19 |
| `Guiding Ends at <date>` | 498 | 19 |
| `Calibration Begins at <date>` | 46 | 19 |
| `Calibration complete, mount = <S>.` | 26 + 18 | 19 |
| `Log closed at <date>` | 2 | 2 |

**13 guiding sessions in the corpus have no `Guiding Ends`.** These are not all end-of-night; some are mid-log.

### 3.2 Header fields (per session)

| Field | Values observed |
|---|---|
| `Pixel scale = <F> arc-sec/px, Binning = <N>` | 6.29/Bin1, 12.58/Bin2 |
| `Focal length = <N> mm` | 123 (constant) |
| `Exposure = <N> ms` | 2000 (constant) |
| `Camera = ZWO ASI<N>MM Mini, gain = <N>, full size = <N> x <N>, ..., pixel size = <F> um` | ASI120MM Mini, 1280×960, 3.8 µm |
| `Mount = ZWO AM5/AM3, ...` | 2025-10-23 → 2025-12-21 |
| `Mount = ZWO000, ...` | 2026-02-03 → 2026-07-23 |
| `... parity = ?/?` / `+/?` / `-/?` | three forms |
| `Search region = <N> px` | 25 (Bin2), 50 (Bin1) |
| `Star mass tolerance = <F>%` | 50.0 (constant) |
| `Dither = both axes, Dither scale = <F>, ..., Server enabled` | 435 occurrences |
| `... Server disabled` | 76 occurrences, 3 files |
| `X guide algorithm = Hysteresis, Hysteresis = <F>, Aggression = <F>, Minimum move = <F>` | constant |
| `Y guide algorithm = Resist Switch, Minimum move = <F> Aggression = <N>% FastSwitch = enabled` | constant |
| `Backlash comp = disabled, pulse = <N> ms` | constant |
| `Dec = <F> deg, Hour angle = <F> hr, Pier side = East\|West, Rotator pos = Unknown` | East 379, West 178 |
| `Lock position = <F>, <F>, Star position = <F>, <F>, HFD = <F> px` | per session |

**The mount string changed at 2026-02-03.** Any pattern keyed to `ZWO AM5/AM3` breaks on the newer half of the corpus, and vice versa.

### 3.3 Frame table

Header line:
```
Frame,Time,mount,dx,dy,RARawDistance,DECRawDistance,RAGuideDistance,DECGuideDistance,
RADuration,RADirection,DECDuration,DECDirection,XStep,YStep,StarMass,SNR,ErrorCode
```

Two row types share this table:

```
1234,2468.02,"Mount",-0.108,-0.101,0.032,0.145,0.000,0.000,64,W,0,,,,2712,35.68,0
 608,1261.97,"DROP",,,,,,,,,,,,,48,4.60,6,"Star lost - mass changed"
```

**`DROP` rows have empty columns 3–14.** `parseFloat('')` returns `NaN`. Filtering on `parts[0]` being numeric admits them; filtering on `parts[2] === '"Mount"'` excludes them correctly.

Corpus totals: **212,591 Mount rows, 2,539 DROP rows.**

### 3.4 Error codes — the log is self-documenting

DROP rows carry the reason in column 18. Across the whole corpus:

| Code | Log's own text | Frames | Current `ERROR_CODES` map | Correct? |
|---|---|---|---|---|
| 2 | `Star lost - low SNR` | 881 | Saturated star | ✗ |
| 3 | `Star lost - low mass` | 32 | Low SNR | ✗ |
| 4 | `Star lost - low HFD` | 17 | Low mass | ✗ |
| 6 | `Star lost - mass changed` | 1443 | Star too close to edge | ✗ |
| 7 | `No star found` | 166 | Star mass change | ✗ |

**All five observed codes are mislabeled**, and the errors are systematic — the current map appears shifted by roughly one position relative to reality, consistent with a mis-transcribed list. Codes 1, 5 and 8 in the map are never observed in the corpus.

Error code 7 also appears on 28 `Mount` rows (not drops), where no reason string is present.

### 3.5 INFO events

| Pattern | Count | Files |
|---|---|---|
| `INFO: SETTLING STATE CHANGE, Settling started` | 1340 | 19 |
| `INFO: SETTLING STATE CHANGE, Settling complete` | 1171 | 19 |
| `INFO: SETTLING STATE CHANGE, Settling failed` | **579** | 16 |
| `INFO: SET LOCK POSITION, new lock pos = <F>, <F>` | 828 | 19 |
| `INFO: DITHER by <F>, <F>, new lock pos = <F>, <F>` | 828 | 19 |
| `INFO: STAR LOST during calibration, Mass= <N>, SNR= <F>, Error= <N>, Status=<S>` | 86 | 1 |

**The settle state machine is not a simple start/end pair.** Observed sequences following a `Settling started`:

| Sequence | Count |
|---|---|
| started → complete | 1158 |
| started → failed | 120 |
| started → failed ×5 | 25 |
| started → failed ×2 | 16 |
| started → complete → failed | 7 |
| started → failed ×3 | 7 |
| started → complete → failed ×4 | 5 |
| started → complete → failed ×2 | 1 |

Repeated `failed` markers and `failed` *after* `complete` both occur. A settled-frame filter must treat any terminator as ending the settle window and must tolerate repeats.

### 3.6 Calibration blocks — entirely unparsed

Each calibration writes its own table:

```
Direction,Step,dx,dy,x,y,Dist
West,1,0.00,0.00,556.03,731.74,0.00
...
Backlash,1,-0.19,0.34,556.22,731.40,0.39
...
West calibration complete. Angle = 145.5 deg, Rate = 1.324 px/sec, Parity = N/A
North calibration complete. Angle = -124.5 deg, Rate = 1.640 px/sec, Parity = N/A
```

Corpus counts: West 468, East 462, North 410, South 410, Backlash 188 step rows; 42 West-complete and 44 North-complete summaries.

Available and currently discarded:

- **Orthogonality error** — the difference between the West and North angles versus 90°. A growing departure indicates cone error or polar misalignment.
- **Dec backlash** — measured directly by the `Backlash` step rows.
- **Calibration rate** (`px/sec`) — an outlier flags a bad calibration, which is otherwise invisible until guiding degrades.
- **Parity** — observed as `N/A` (most), `Even` (1), `Odd` (1).

`INFO: STAR LOST during calibration` appears 86 times in a single night (2026-05-11), which is a diagnosable calibration failure the report never mentions.

---

## 4. Behaviour of the current parsers against the corpus

Both parsers were executed unmodified against every log.

### 4.1 ASIAir parser

| Symptom | Affected logs |
|---|---|
| Reports one target when the log has several | 9 of 25 |
| Reports one exposure when the log has several | 1 of 25 |
| Image count exceeds planned subs (multi-run merge) | 11 of 25 |
| Target reported as `Unknown` | 5 of 25 (flat-only nights) |
| Target reported as `FOV` (framing run) | 1 of 25 |
| Learned dither > 50s (settle-cascade corruption) | 5 of 25 |

Worst case, 2026-06-05: reports target `M 92`, exposure 300s, 60 planned subs — the log actually contains 8 light autoruns across 4 targets at 3 exposure lengths, with 245 exposures, merged into 244 images and 226 dithers.

### 4.2 PHD2 parser

**11 of 19 nights produce `NaN` as the session-wide RMS**, and therefore print "Overall guiding quality was **poor**" regardless of actual performance.

| Date | Sessions | NaN sessions | Reported total RMS | Correct settled RMS |
|---|---|---|---|---|
| 2025-10-23 | 26 | 1 | NaN | 1.20" |
| 2025-11-17 | 25 | 1 | NaN | 1.18" |
| 2025-12-20 | 47 | 32 | NaN | 1.32" |
| 2025-12-21 | 29 | 4 | NaN | 1.23" |
| 2026-02-03 | 4 | 1 | NaN | 1.02" |
| 2026-02-06 | 10 | 8 | NaN | 0.97" |
| 2026-04-17 | 17 | 2 | NaN | 0.89" |
| 2026-05-11 | 131 | 125 | NaN | 1.08" |
| 2026-06-05 | 47 | 24 | NaN | 1.17" |
| 2026-06-15 | 44 | 29 | NaN | 1.00" |
| 2026-07-23 | 16 | 1 | NaN | 0.97" |

2026-05-11 additionally generates 378 anomaly entries from 131 sessions, which would render as an unusable wall of text.

---

## 5. Format-drift observations

Nine months is short for firmware archaeology, but three changes are already visible:

1. **Mount identifier**, `ZWO AM5/AM3` → `ZWO000`, at 2026-02-03. This is a PHD2/driver-side change; the ASIAir log is unaffected.
2. **`Shooting <N> flat frames, auto-exposure Bin<N>`** first appears 2026-06-05 — a new flat-capture mode with no exposure value in the line.
3. **Millisecond exposure formatting** first appears 2026-05-11.

The `filpped` typo is present throughout and has not been corrected.

**Recommendation:** parse defensively and log unrecognised lines rather than discarding them silently. A "lines not matched by any pattern" count belongs in the data-quality section of the report; it is the only mechanism that will surface a future firmware change before it corrupts a number.

---

## 6. Coverage gaps

Not present anywhere in the corpus, and therefore unspecifiable from data:

- Dark or bias frame autoruns
- A failed meridian flip
- A filter wheel or any filter-change event
- Rotator use (`Rotator pos = Unknown` throughout)
- Any camera other than the ASI120MM Mini as guider
- Any guide-scope focal length other than 123 mm
- Multi-night single log
- PHD2 log version other than 2.5
- Guiding with an algorithm other than Hysteresis (RA) / Resist Switch (Dec)

These should be handled defensively rather than modelled speculatively.
