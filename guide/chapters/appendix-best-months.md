# Best Month Calculation

This appendix describes how Astryx works out each target's Best Month,
Peak Altitude, and Observable months for a location. See [Admin
Tools](admin-tools.md) for running the calculation.

## The Year

The calculation covers the current calendar year, from January 1, at the
location's latitude and longitude, in its time zone with its daylight
saving. For each night it finds astronomical dusk and dawn (the Sun 18°
below the horizon), and checks the target's altitude every 10 minutes in
between.

Your horizon profile and the Moon aren't taken into account. For the Moon
on a given night, use Yearly Observability or Daily Visibility.

## Peak Altitude

The highest the target ever gets from the location, when it crosses the
meridian:

```
peak altitude = 90° − |latitude − declination|
```

It's the same every night of the year.

## Best Month

Each type of target has an altitude it must be above to count, and two
weights:

| Types | Altitude | Transit weight | Dark-hours weight |
|:--------------------------------|------:|------:|------:|
| Single and double stars, asterisms | 40° | 0.75 | 0.25 |
| Galaxies, dark and reflection nebulae | 40° | 0.70 | 0.30 |
| Galaxy clusters, globular and open clusters | 40° | 0.65 | 0.35 |
| Cluster with nebulosity, planetary nebulae | 30° | 0.60 | 0.40 |
| Emission nebulae, supernova remnants | 30° | 0.55 | 0.45 |
| Any other type | 30° | 0.60 | 0.40 |

Faint galaxies and nebulae need to be high, where there's less air to
look through, so their transit weight is high. Bright emission nebulae and
supernova remnants can be imaged lower down, and benefit more from long
nights.

Every third night of the year gets two scores:

**Transit score.** How close to local midnight the target crosses the
meridian:

```
transit score = 1 − (hours between transit and midnight) ÷ 12
```

A transit at midnight scores 1; one at 6 p.m. or 6 a.m. scores 0.5.

**Dark-hours score.** The hours the target spends above its type's
altitude during astronomical darkness, divided by the most it gets on any
night of the year.

They're combined:

```
score = transit score × transit weight + dark-hours score × dark-hours weight
```

The month of the night with the highest score is the Best Month.

For example, for a galaxy (0.70 and 0.30): a December night with the
target crossing at 11 p.m. (transit score 0.92) and 8.5 dark hours out of a
best of 9 (0.94) scores 0.92 × 0.70 + 0.94 × 0.30 = 0.93. A June night with
the target crossing at midnight (1.0) but only 3.2 dark hours (0.36) scores
1.0 × 0.70 + 0.36 × 0.30 = 0.81. December wins: the long nights outweigh
the slightly earlier transit.

## Observable Months

The Observable months are the longest unbroken run of nights on which the
target spends at least **2 hours in a row** above **35°** during
astronomical darkness. A run can wrap from December into January, for
as in "Observable: Nov–Feb" in Yearly Observability.

These figures are fixed: they don't follow the Min Altitude in Settings or
the target's type. That's why a target can have a Best Month but no
Observable months, or the other way around.

## Targets with No Best Month

A target has no Best Month from a location when:

- **It never gets high enough.** Its peak altitude is below its type's
  altitude. From 39° N, a galaxy cluster at declination −27.5° peaks at
  90° − 66.5° = 23.5°, well short of 40°. Most targets far south of a
  northern location, or far north of a southern one, are like this.
- **It's never high in darkness.** It reaches the altitude only in
  daylight or twilight, for example a target close to the Sun's path that
  is high only in the months of short summer nights at high latitudes.

The calculation's results count these as **Not meeting criteria**. They
still appear in Target Selection, but never pass the Visibility filter.

## Using the Best Month

- The Best Month is a guide, not a rule. A target is usually good for a
  month or two either side of it; the Observable months show how long.
- Your weather matters as much. The astronomically best month may be your
  cloudiest.
- Calculate again for a location you've moved by more than a few degrees of
  latitude.
