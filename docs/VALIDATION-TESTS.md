# Validation Tests — Astronomy Accuracy Bugs

**Purpose:** exact steps to confirm each bug exists *before* the corresponding issue is implemented, and to confirm it's fixed *after*. Same steps, run twice.

**How to run a test:** open Astryx in a browser (web build is easiest for this — Tauri works too), open DevTools (F12), go to the Console tab, paste the snippet, press Enter, read the output. All snippets use functions already global in the app, so they work as-is once Astryx has loaded.

**Your location values** (used throughout): latitude `39.296739`, longitude `-78.198136`, elevation `233`, timezone `-5`. If you test from a different saved location, substitute its values.

---

## Test 1 — Timezone double-offset in twilight (dusk/dawn)

**Covers:** "Fix timezone double-offset in twilight calculations" — affects To Do, Best Months, Yearly, Seqplan (via `astro-sun.js`).

### Console script
```js
const lat = 39.296739, lon = -78.198136, tz = -5;

function testTwilight(y, m, d, label) {
    const date = new Date(y, m - 1, d);
    const isDST = SettingsManager.isDSTActive(date, tz);
    const duskJD = findAstronomicalDusk(date, lat, lon, tz, isDST);
    const dawnJD = findNextAstronomicalDawn(date, lat, lon, tz, isDST);
    const duskStr = duskJD ? TimeUtils.formatLocalTimeWithDate(TimeUtils.jdToDate(duskJD), tz, isDST) : 'none';
    const dawnStr = dawnJD ? TimeUtils.formatLocalTimeWithDate(TimeUtils.jdToDate(dawnJD), tz, isDST) : 'none';
    console.log(`${label}: dusk=${duskStr}  dawn=${dawnStr}  isDST=${isDST}`);
}

testTwilight(2026, 6, 21, 'June 21 2026 (summer)');
testTwilight(2026, 12, 21, 'Dec 21 2025 (winter control)');
```

### External reference
Go to `https://www.timeanddate.com/astronomy/search.html`, search using coordinates `39.296739, -78.198136` (or the nearest named town if it won't take raw coordinates — Berryville/Winchester VA area), set the date to **June 21, 2026**. Read "Astronomical Twilight Starts" (= dawn) and "Astronomical Twilight Ends" (= dusk, the prior evening's value — check the date carefully).

### Before fix (expected — bug present)
- June 21 dawn is at or very near **4:00:00 AM** (the search-start clamp).
- Console value differs from timeanddate.com's dawn by tens of minutes.
- December control also runs, but its error is small (both offsets in play but starting hours earlier than dusk still lands correctly for dusk; check dawn too — if it's off by less than dusk's error, that's consistent with the bug since winter nights are long enough to absorb it more often).

### After fix (expected — pass criteria)
- June 21: console dawn within **±2 minutes** of timeanddate.com's astronomical dawn.
- June 21: console dawn is **not** exactly 4:00:00 AM (unless that's coincidentally correct, which it won't be at this latitude/date).
- December 21: console dawn/dusk within ±2 minutes of timeanddate.com, and **unchanged from the before-fix run** (winter was already approximately correct — this is the regression check).
- Changing your OS timezone (or DevTools → Sensors → Location/timezone override, if your browser supports it) and rerunning must **not** change the console output for a fixed location.

---

## Test 2 — Daily Visibility dawn (dusk+6h overshoot)

**Covers:** "Dawn search starts at dusk+6h — overshoots dawn on short summer nights". Independent of Test 1 — test this **after** Test 1's fix is in, so Test 1's bug isn't muddying the result.

### Console script
```js
const loc = DataManager.getLocation(SettingsManager.getSelectedLocation());
const t = DailyVisibilityCalculations.calculateTwilightTimes(
    '2026-06-21', loc.latitude, loc.longitude, loc.timezone, SettingsManager.getDSTConfig()
);
console.log('Daily Visibility June 21 dusk:', t.dusk, ' dawn:', t.dawn);

const t2 = DailyVisibilityCalculations.calculateTwilightTimes(
    '2025-12-21', loc.latitude, loc.longitude, loc.timezone, SettingsManager.getDSTConfig()
);
console.log('Daily Visibility Dec 21 dusk:', t2.dusk, ' dawn:', t2.dawn);
```

Also check visually: navigate to the **Daily Visibility** view in the app, set the date to June 21, 2026, and read the dusk/dawn shown in the results panel — should match the console output.

### Before fix (expected — bug present)
- June 21 dawn is **exactly 6 hours after dusk** (e.g. dusk 22:41 → dawn 04:41, to the second). This is the signature: dawn − dusk = exactly 6:00:00.
- December: dawn − dusk is a plausible winter night length (>6h), not clamped — this path is unaffected by the +6h bug in winter, so December should already look reasonable (may still carry Test 1's bug if run before that fix).

### After fix (expected — pass criteria)
- June 21 dawn matches Test 1's astro-sun result for the same date (both should now agree, since both call the same underlying threshold search) and matches timeanddate.com within ±2 minutes.
- Dawn − dusk is the true night length (~5 hours at this latitude in June), not 6:00:00.
- December unchanged from before this fix.

---

## Test 3 — Sequence Planner isDST bug

**Covers:** "Sequence Planner passes nonexistent location.isDST to twilight functions". Test **after** Tests 1 and 2 land — this test's value is the cross-view consistency check.

### Console script
```js
const loc = DataManager.getLocation(SettingsManager.getSelectedLocation());
// Mimics what seqplan-calculations.js does internally for a given date string
const localDate = new Date(2026, 5, 21); // June 21, 2026
const seqplanResult = SeqPlanCalculations.getTwilightForDate
    ? SeqPlanCalculations.getTwilightForDate('2026-06-21')
    : null;
console.log('Seqplan twilight (if exposed):', seqplanResult);
```

If `SeqPlanCalculations` doesn't expose a convenient method (function name may differ from this guess — check `seqplan-calculations.js` for the actual exported function name if this errors), the reliable test is via the **UI**:

1. Open **To Do List**, note tonight's (or June 21's, if the view supports picking a date) dusk/dawn.
2. Open **Sequence Planner**, load or create a session for the same date, and note the displayed session start/end.

### Before fix (expected — bug present)
- Sequence Planner's session end is **later** than To Do's dawn — in June, look for it landing around **5:00 AM** rather than true dawn (~3:44–4:05 AM EDT depending on exact date).

### After fix (expected — pass criteria)
- Sequence Planner's session start/end **exactly matches** To Do's dusk/dawn for the same date and location (same minute).
- Repeat for a winter date — same equality check.

---

## Test 4 — Moon rise/set (parallax + horizon dip)

**Covers:** "Moon rise/set: apply topocentric parallax to the altitude threshold" + "Fix dimensional error in horizon dip formula" — do and test together.

### Console script
```js
const loc = DataManager.getLocation(SettingsManager.getSelectedLocation());
const today = new Date();
const startJD = TimeUtils.dateToJD(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0));
const endJD = startJD + 1;

const result = calculateMoonRiseSet(startJD, endJD, loc.latitude, loc.longitude, loc.elevation);
console.log('Moonrise JD:', result.riseJD, result.riseJD ? TimeUtils.formatLocalTimeWithDate(TimeUtils.jdToDate(result.riseJD), loc.timezone, SettingsManager.isDSTActive(today, loc.timezone)) : 'none');
console.log('Moonset JD:', result.setJD, result.setJD ? TimeUtils.formatLocalTimeWithDate(TimeUtils.jdToDate(result.setJD), loc.timezone, SettingsManager.isDSTActive(today, loc.timezone)) : 'none');
```
(If `calculateMoonRiseSet`'s return shape uses different property names than `riseJD`/`setJD`, `console.log(result)` first to see the actual keys, then adjust.)

### External reference
Go to `https://www.timeanddate.com/moon/@` and search your coordinates (or nearest town), or use the USNO calculator at `https://aa.usno.navy.mil/data/RS_OneDay` with latitude `39.296739`, longitude `-78.198136` (west, so enter as negative or select W), for **today's date**. Read moonrise and moonset.

### Before fix (expected — bug present)
- Astryx's moonrise is **~5–8 minutes earlier** than timeanddate.com/USNO.
- Astryx's moonset is **~5–8 minutes later** than timeanddate.com/USNO.
- (This combines the parallax error, ~6 min, with the dip formula error, ~1–2 min at 233m elevation — both push in the same direction.)

### After fix (expected — pass criteria)
- Both moonrise and moonset within **±2 minutes** of timeanddate.com/USNO.
- Repeat on 2–3 more dates spread across the month (near first quarter and near full moon are good spread choices) — the error should NOT scale with moon phase (it's a geometric effect, not a phase effect), so consistent ±2 min across all dates confirms the fix generalizes.

---

## Test 5 — Target transit time accuracy

**Covers:** "findTargetTransit: replace fragile scan with direct O(1) computation" — this is a precision + robustness fix more than a "wrong before" bug (the old scan was usually close), so the test is about precision and about the step-size-immunity claim.

### Console script
```js
const loc = DataManager.getLocation(SettingsManager.getSelectedLocation());
// M42 (Orion Nebula): RA 5h35.3m = 5.5883h, Dec -5.39
const raHours = 5.5883, dec = -5.39;
const today = new Date();
const startJD = TimeUtils.dateToJD(today);
const endJD = startJD + 1;

const transitJD = findTargetTransit(startJD, endJD, raHours, dec, loc.longitude);
console.log('M42 transit:', transitJD ? TimeUtils.formatLocalTimeWithDate(TimeUtils.jdToDate(transitJD), loc.timezone, SettingsManager.isDSTActive(today, loc.timezone)) : 'none');
```

### External reference
Stellarium (desktop app, free) set to your exact lat/lon/elevation: search M42, open its info panel, read "Meridian passage" / transit time for today's date. Alternatively `https://theskylive.com/planetarium` with location set, search M42, read the transit time shown.

### Before fix (expected)
- Should already be close (old scan quantized to the minute, ±36 sec threshold slop) — within ~1–2 minutes of Stellarium. This test mainly confirms it stays that good, since the fix is about removing fragility, not fixing a big error.

### After fix (expected — pass criteria)
- Within ±1 minute of Stellarium.
- **Step-size immunity check:** temporarily change `APP_CONFIG.TARGET_SEARCH_STEP_SIZE` in `config.js` from `1/1440` to `2/1440` (2-minute steps), reload, rerun the console script. Transit time must be **identical** (the new implementation doesn't scan, so it's immune). Revert the config change afterward. *(Old implementation: this same test would have shown occasional missed transits — `null` returned — this is what "17% of transits vanish" refers to; not guaranteed to reproduce on every run since it depends on exact phase alignment, so treat a pass here as sufficient rather than trying to force the old failure.)*

---

## Test 6 — Waxing/waning near syzygy

**Covers:** "Moon waxing/waning classification uses mean longitudes — wrong phase name near syzygy". Uses real 2026 syzygy instants (sourced from timeanddate.com via Live Science and Fullmoonology):

- **Full Moon:** June 29, 2026, 23:56 UTC (7:56 PM EDT)
- **New Moon:** July 14, 2026, 5:43 AM EDT (9:43 UTC)

### Console script
```js
function testPhaseNear(label, y, m, d, h, min) {
    const date = new Date(Date.UTC(y, m - 1, d, h, min));
    const jd = TimeUtils.dateToJD(date);
    const phase = getMoonPhase(jd);
    console.log(`${label}: illum=${phase.illumination?.toFixed(1)}%  isWaxing=${phase.isWaxing}  name=${phase.phaseName ?? '(check property name)'}`);
}

// A few hours after full moon (should be WANING) — full was 23:56 UTC June 29
testPhaseNear('2h after full',  2026, 6, 30, 1, 56);
testPhaseNear('6h after full',  2026, 6, 30, 5, 56);
testPhaseNear('12h after full', 2026, 6, 30, 11, 56);

// A few hours after new moon (should be WAXING) — new is 9:43 UTC July 14
testPhaseNear('2h after new',  2026, 7, 14, 11, 43);
testPhaseNear('6h after new',  2026, 7, 14, 15, 43);
testPhaseNear('12h after new', 2026, 7, 14, 21, 43);
```
(Adjust `phase.phaseName` to whatever property `getMoonPhase` actually returns for the display name — `console.log(phase)` first if unsure.)

### Before fix (expected — bug may appear)
At one or more of the offsets (2h/6h/12h), especially the closer ones, `isWaxing` may read **backwards**: `true` shortly after full moon (should be `false`/waning), or `false` shortly after new moon (should be `true`/waxing). This won't necessarily reproduce at every offset — it depends on the mean-vs-true longitude gap at that exact moment — which is why several offsets are tested.

### After fix (expected — pass criteria)
- All six calls: waning after full, waxing after new — at every offset, no exceptions.
- Illumination percentages are **unchanged** from the before-fix run (this fix touches only the waxing/waning flag, not illumination — a change here would indicate a mistake in the fix).

---

## Test 7 — Sun RA normalization (internal consistency, no external reference needed)

**Covers:** "Normalize sun RA to 0–24h". This is an internal consistency fix; there's no independent source for "sun RA" as such (it's not directly displayed), so the test is a range check plus a downstream-unaffected check.

### Console script
```js
function testSunRA(y, m, d) {
    const jd = TimeUtils.dateToJD(new Date(y, m - 1, d));
    const pos = getSunPosition(jd);
    console.log(`${y}-${m}-${d}: sun RA = ${pos.ra.toFixed(4)}h  (must be in [0,24))`);
}
testSunRA(2026, 3, 1);   // RA typically negative pre-fix (winter/spring side)
testSunRA(2026, 6, 21);
testSunRA(2026, 9, 21);
testSunRA(2026, 12, 21);
```

### Before fix (expected)
- March 1 (and other dates where true solar RA is in the −12h to 0h range) prints a **negative** value.

### After fix (expected — pass criteria)
- All four values in `[0, 24)`.
- **Regression check (critical):** rerun Test 1's twilight script for the same four dates before and after this fix — dusk/dawn must be **byte-identical**, since hour-angle normalization downstream was already absorbing the negative RA. Any difference means something downstream double-normalized and needs investigation before this fix is accepted.

---

## Test 8 — solarBrightnessAdvanced sign fix (internal consistency)

**Covers:** "solarBrightnessAdvanced: inverted signs on aerosol, humidity, and seasonal terms". No independent external source publishes sky-brightness mag/arcsec² for arbitrary humidity/aerosol inputs, so this is a **directional** consistency test, not an absolute-value comparison.

### Console script
```js
// Only meaningful if the function is kept with options (fix option (a)).
// If the team chose option (b) (strip the terms), this test doesn't apply —
// instead just confirm quality scores still look sane (see below).
const base = solarBrightnessAdvanced(-10, {});
const humid = solarBrightnessAdvanced(-10, { humidity: 0.9 });
const dry   = solarBrightnessAdvanced(-10, { humidity: 0.1 });
const hazy  = solarBrightnessAdvanced(-10, { aerosolOpticalDepth: 0.5 });
const clear = solarBrightnessAdvanced(-10, { aerosolOpticalDepth: 0.05 });
const winter = solarBrightnessAdvanced(-10, { season: 'winter' });
const summer = solarBrightnessAdvanced(-10, { season: 'summer' });

console.log('humid(0.9) < dry(0.1)?', humid < dry, `(${humid.toFixed(2)} vs ${dry.toFixed(2)})`);
console.log('hazy(0.5) < clear(0.05)?', hazy < clear, `(${hazy.toFixed(2)} vs ${clear.toFixed(2)})`);
console.log('winter > summer?', winter > summer, `(${winter.toFixed(2)} vs ${summer.toFixed(2)})`);
```
(Signature is a guess based on the file structure — adjust parameter names/order to match the actual function if it errors.)

### Before fix (expected — bug present)
- All three comparisons print **false** (humid ≥ dry, hazy ≥ clear, winter ≤ summer) — i.e., backwards from physical reality.

### After fix, option (a) — pass criteria
- All three comparisons print **true**: humid sky is brighter (lower mag/arcsec² value) than dry; hazy brighter than clear; winter darker (higher value) than summer.

### After fix, option (b) — pass criteria
- The function signature no longer accepts these options (or they're silently ignored, per whatever was decided); confirm no console errors from `calculateSkyLight` calls in Daily Visibility / Optimizer, and spot-check that a bright-moon night still scores lower than a dark-sky night in the Optimizer's target list (sanity check that the whole pipeline still behaves).

---

## Quick reference — pass/fail summary table

| Test | Before (expected) | After (must pass) |
|---|---|---|
| 1. Twilight double-offset | June dawn ≈ 4:00 AM, wrong by tens of min | Within ±2 min of timeanddate.com, TZ-independent |
| 2. Dawn dusk+6h overshoot | June dawn = dusk + exactly 6:00:00 | Matches Test 1, within ±2 min of reference |
| 3. Seqplan isDST | Session end ~5:00 AM in June | Exactly matches To Do's dusk/dawn |
| 4. Moon parallax + dip | Moonrise ~5–8 min early, moonset ~5–8 min late | Both within ±2 min of reference, across 3+ dates |
| 5. Transit computation | Usually fine, occasionally fragile | Within ±1 min; immune to step-size change |
| 6. Waxing/waning | May flip near syzygy | Correct at all tested offsets; illumination unchanged |
| 7. Sun RA normalization | Negative values possible | Always in [0,24); twilight output unchanged |
| 8. Brightness signs | Backwards (humid/hazy/winter score wrong direction) | Correct direction (a) or terms removed (b) |

---

## A note on order

Run these roughly in the order listed — Tests 2 and 3 assume Test 1 is already fixed (their "after" criteria reference Test 1's corrected values), and Test 7's regression check needs Test 1's script to compare against. Tests 4, 5, 6, 8 are independent of the others and can be done anytime.
