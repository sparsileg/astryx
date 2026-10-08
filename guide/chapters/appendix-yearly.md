# Yearly Observability Details

This appendix describes how Yearly Observability works out the line and the
background shading for each night. See [Yearly
Observability](yearly-observability.md) for how to read the graph.

## The Nights

The graph covers 365 nights, starting on the first day of the current month.
For each night, Astryx finds astronomical dusk and dawn (the Sun 18° below
the horizon) at the location chosen in the sidebar, using the location's
time zone and daylight saving time for that date.

## The Line

The line is the target's highest altitude between dusk and dawn, checked
once a minute. On nights with no astronomical darkness, as happens in summer
at high latitudes, it's the target's altitude at local midnight instead.

The **Peak altitude** in the summary line is the highest point of the line
over the whole year.

## The Shading

Each night gets a score from 0 to 1, which sets the shade of gray: 0 is
white and 1 is black. A night is white, whatever its score, when the line is
below your Minimum Altitude.

The score has three parts.

**Transit timing.** How close to local midnight the target crosses the
meridian:

```
transit score = 1 − (hours between transit and midnight) ÷ 12
```

A transit at midnight scores 1; one at 6 p.m. or 6 a.m. scores 0.5.

**Dark hours.** How many hours the target spends above a fixed altitude for
its type during astronomical darkness, divided by the most hours it gets on
any night of the year. The best night scores 1.

The two are combined with weights that also depend on the type:

```
base score = transit score × transit weight + dark-hours score × dark-hours weight
```

| Types | Altitude | Transit weight | Dark-hours weight |
|:--------------------------------|------:|------:|------:|
| Single and double stars, asterisms | 40° | 0.75 | 0.25 |
| Galaxies, dark and reflection nebulae | 40° | 0.70 | 0.30 |
| Galaxy clusters, globular and open clusters | 40° | 0.65 | 0.35 |
| Cluster with nebulosity, planetary nebulae | 30° | 0.60 | 0.40 |
| Emission nebulae, supernova remnants | 30° | 0.55 | 0.45 |
| Any other type | 30° | 0.60 | 0.40 |

**The Moon.** The base score is multiplied by a Moon factor:

```
Moon factor = (1 − illumination) × (1 − e^(−separation ÷ 30°))
```

- *Illumination* is the Moon's illuminated fraction over the night, from 0
  at new Moon to 1 at full.
- *Separation* is the closest the Moon comes to the target while the target
  is above its type's altitude, or over the whole night if it never gets
  that high.

The separation part is 0.63 at 30°, 0.86 at 60°, and 0.95 at 90°. A full
Moon makes the factor 0, so full-Moon nights are white.

Finally, the score is raised to the power 0.7, which darkens the middle
grays so the difference between fair and good nights is easier to see:

```
score = (base score × Moon factor)^0.7
```

## The Full Moons

A gold circle marks each night when the Moon is more than 90% illuminated
and brighter than on the nights before and after.

## The Best Month and Observable Months

The Best Month and Observable months in the summary line aren't worked out
by this view. They're the values stored for each target when the Best Months
for a location were calculated, and they use the same type-specific
altitudes and weights. See [Best Month Calculation](appendix-best-months.md).

## Accuracy

Target positions are the J2000 coordinates from the database, without
correction for precession. For a graph that covers a year at a resolution
of one day, the difference isn't visible.
