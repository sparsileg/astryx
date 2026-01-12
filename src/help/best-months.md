# Best Month Calculation

## Overview

Calculates the **best observing month** for each target using a sophisticated two-criteria weighted scoring system. The algorithm evaluates every day of the year to find when a target is most favorably positioned for astrophotography.

## How Best Month is Calculated

### Two Scoring Criteria

The best month calculation uses two independent scores that are combined with type-specific weights:

#### 1. Transit Score (How Close to Midnight)

The transit score measures how close the target's transit time is to local midnight.

**Why this matters:** Targets that transit near midnight are observable for the longest period during a single night. Targets that transit at dawn or dusk have very limited imaging windows.

**Calculation:**
- For each day, calculate when the target transits (reaches its highest point in the sky)
- Measure distance from midnight: `min(|hour - 0|, |hour - 24|)`
- Convert to score: `1 - (distance / 12)`
  - Transit at midnight = 1.0 (perfect)
  - Transit at noon = 0.0 (worst)
  - Transit at 6 PM or 6 AM = 0.5

#### 2. Dark Hours Score (How Much Imaging Time)

The dark hours score measures how many hours the target is above its altitude threshold during astronomical darkness.

**Why this matters:** More dark hours means more imaging time. Targets benefit from longer nights (winter) and from being positioned favorably in the sky during darkness.

**Calculation:**
- For each day, sample altitude every 10 minutes during astronomical darkness (sun below -18°)
- Count accumulated hours when target is above its type-specific altitude threshold
- Find the maximum dark hours across the entire year
- Normalize each day's dark hours: `darkHours / maxDarkHours`
  - Day with most dark hours = 1.0 (perfect)
  - Day with no dark hours = 0.0

### Type-Specific Weights

Different target types prioritize these criteria differently based on their observational requirements:

| Type | Transit Weight | Dark Hours Weight | Min Altitude |
|------|----------------|-------------------|--------------|
| **Stars & Asterisms** | 75% | 25% | 40° |
| **Dark Nebulae** | 70% | 30% | 40° |
| **Reflection Nebulae** | 70% | 30% | 40° |
| **Galaxies** | 70% | 30% | 40° |
| **Galaxy Clusters** | 65% | 35% | 40° |
| **Open Clusters** | 65% | 35% | 40° |
| **Globular Clusters** | 65% | 35% | 40° |
| **Planetary Nebulae** | 60% | 40% | 30° |
| **Cluster + Nebula** | 60% | 40% | 30° |
| **Bright Nebulae** | 55% | 45% | 30° |
| **Supernova Remnants** | 55% | 45% | 30° |
| **Other** | 60% | 40% | 30° |

**Rationale:**
- **High transit weight** (stars, dark nebulae, galaxies): These targets benefit most from being high in the sky. Position matters more than total time.
- **Balanced weights** (bright nebulae, SNRs): These extended objects benefit from both good positioning and longer integration time.
- **Lower altitude thresholds** (bright nebulae): Brighter objects can be imaged at lower altitudes where atmospheric extinction is greater.

### Final Score Calculation

For each day of the year:

```
score = (transitScore × transitWeight) + (darkHoursScore × darkHoursWeight)
```

The day with the **highest score** determines the best month.

**Example:**

For a dark nebula (70% transit / 30% dark hours):
- Day in December: Transit at 11 PM (score 0.92), 8.5 dark hours (score 0.95)
  - Final: `(0.92 × 0.70) + (0.95 × 0.30) = 0.929`
- Day in June: Transit at midnight (score 1.0), 3.2 dark hours (score 0.36)
  - Final: `(1.0 × 0.70) + (0.36 × 0.30) = 0.808`

December wins despite June having perfect transit time, because the much longer dark hours in December overcome the slight transit disadvantage.

## Why Some Targets Have No Best Month

Approximately 24% of targets will have **null** (no best month) for a given location. This happens when a target is **never observable** from that location under reasonable conditions.

### Reason 1: Peak Altitude Too Low (Most Common)

Every target type has a minimum altitude threshold (30° or 40°). If a target's **peak altitude** (when it transits) never reaches this threshold, it cannot be observed well from your location.

**Peak altitude** depends only on:
- Your latitude
- Target's declination
- Your artificial horizon profile

**Formula:** `peakAltitude = 90° - |latitude - declination|`

**Example:**
- Location: Home (39°N)
- Target: Abell 1060 (declination -27.5°)
- Peak altitude: `90° - |39° - (-27.5°)| = 90° - 66.5° = 23.5°`
- Threshold for galaxy cluster: 40°
- Result: **null** (never gets high enough)

**Common scenarios:**
- **Southern hemisphere objects from northern locations** (and vice versa)
- Objects with extreme declinations that barely rise above horizon
- Circumpolar objects that never rise (for objects near the opposite celestial pole)

### Reason 2: Never in Darkness

Even if a target reaches sufficient altitude, it may **never be above the threshold during astronomical darkness** on any day of the year.

**Why this happens:**
- **Sun proximity:** Target is always near the sun seasonally (e.g., transits during daylight all year)
- **Summer circumpolar targets:** At high latitudes, summer months may have no astronomical darkness, so circumpolar targets near the zenith have zero dark hours
- **Twilight-only visibility:** Target only rises/sets during twilight periods

**Example:**
A target at +85° declination observed from 45°N latitude:
- Always circumpolar (never sets)
- Always high in sky
- But during June-July, astronomical darkness never occurs
- If target's only high-altitude time is during these months → **null**

### Null Statistics

For a typical northern mid-latitude location (35-45°N):
- **~76% of targets** have valid best months
- **~24% are null** (not observable)

The null rate varies by latitude:
- **Equatorial locations** (~0-10°): Lowest null rate (~15%) - can see both hemispheres
- **Mid-latitudes** (~35-45°): Medium null rate (~24%) - miss far southern objects
- **High latitudes** (~55°+): Higher null rate (~30-35%) - miss southern objects + summer darkness issues

## Visibility Window vs Best Month

**Best Month** answers: "When is this target positioned most favorably?"

**Visibility Window** (Start/End months) answers: "During which months can I observe this target at all?"

The visibility window is calculated separately based on:
- Minimum dark hours requirement (default: 3 hours)
- Same altitude thresholds as best month
- Finds the longest continuous sequence of observable days

**Example:**
- Target: M 31 (Andromeda Galaxy)
- Best Month: **October** (transits at midnight, long dark hours)
- Visibility Window: **July through March** (observable, but less ideal in July/March)

You can observe M 31 for many months, but October provides the optimal combination of transit time and dark hours.

## Location Dependency

Best months are **location-specific** because they depend on:

1. **Latitude** - Affects peak altitude and dark hour distribution
2. **Longitude** - Affects local transit time (but usually same month)
3. **Timezone** - Only affects time display, not the month
4. **Artificial horizon** - Blocks low-altitude observations

**Significant differences** between locations occur when:
- Large latitude changes (>20-30°) alter peak altitudes and darkness patterns
- Northern hemisphere vs Southern hemisphere (completely inverts seasons)
- Extreme latitude locations (>60°) have unusual darkness patterns

**Minimal differences** when:
- Same latitude, different longitude (transit time shifts but same month)
- Small latitude changes (<10°) within same hemisphere
- Similar mid-latitude locations within the same continent

## Calculation Parameters

The best month calculation uses these defaults:

- **Sampling:** Every day of the year (can be adjusted with `DAY_SAMPLING_STEP`)
- **Time resolution:** 10-minute intervals during darkness (adjustable with `SAMPLING_INTERVAL_MINUTES`)
- **Darkness definition:** Astronomical darkness (sun below -18°)
- **Year:** Current calendar year (assumes typical year, not specific year)

## Timestamps and Metadata

When best months are calculated, we store:
- **Calculation timestamp** - When the calculation was performed
- **Location used** - Which observer location was used
- **Altitude parameter** - Minimum altitude threshold used
- **Dark hours parameter** - Minimum dark hours threshold used

This metadata helps you know if recalculation is needed when you change locations or adjust observation parameters.

## Tips for Using Best Month

1. **Best month is a guide, not a rule** - A target may be excellent 2-3 months before/after its best month
2. **Check visibility window** - Tells you the full range of observable months
3. **Consider weather** - Your location's best weather months may not align with astronomical best months
4. **Multi-target sessions** - Different targets have different best months; plan sessions accordingly
5. **Recalculate when traveling** - If you travel >500 miles north/south, recalculate for better accuracy

## Advanced: Algorithm Performance

The calculation is optimized for speed:
- **Calculates** ~365 days × 2 criteria per target
- **Processing time:** ~15-30 seconds for 15,000+ targets
- **Uses transit-based approach:** Simplified from complex window calculations (previous versions took minutes)
- **Memory efficient:** Processes one target at a time

The algorithm is deterministic - running it multiple times with the same parameters produces identical results.
