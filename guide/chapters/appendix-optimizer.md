# Target Optimizer Scoring

This appendix describes how the Target Optimizer scores each target and
each combination. See [Target Optimizer](target-optimizer.md) for how to
use it.

## The Night

The night runs from the start you chose (astronomical dusk, or your Custom
time) to astronomical dawn, at the location chosen in the sidebar. A
target's **window** is the time it spends above both the Min Altitude from
Settings and the location's horizon profile during the night.

A target is left out if it never gets above them, or if its window is
shorter than one hour. If a target dips below them and comes back up, the
window is one of the two parts; the dip is shown on the card but doesn't
change the scores.

## The Four Scores

Each score runs from 0 to 100.

**Window.** One hour scores 0 and eight hours scores 100:

```
window = (window hours − 1) ÷ 7 × 100, at most 100
```

**Altitude.** The peak is the highest altitude during the window, checked
every 10 minutes:

```
altitude = (peak − Min Altitude) ÷ (90° − Min Altitude) × 100
```

**Centering.** How close the target's meridian crossing (transit) is to
the middle of the night:

```
centering = (1 − |transit − middle of night| ÷ half the night's length) × 100
```

A target that doesn't cross the meridian during the night scores 0.

**Moon.** The window is checked every 15 minutes. Each check scores 1 if
the Moon is below the horizon, and otherwise:

```
(1 − illumination) × separation ÷ 90°, with separation capped at 90°
```

*Illumination* is the Moon's illuminated fraction for the night, from 0 at
new Moon to 1 at full; *separation* is the angle between the Moon and the
target. The Moon score is the average of the checks, times 100.

## The Composite Score

```
composite = 0.30 × window + 0.25 × altitude + 0.15 × centering + 0.30 × Moon
```

The results show the 37 targets with the highest composite scores.

## Combinations

Combinations are built from the targets in the results. Each target in a
combination is given **usable hours**: the hours of its window when no
other target in the combination is up, plus an equal share of the hours it
shares with them. Two targets up for the same two hours get one hour each
of that time.

```
solo score     = composite × window hours
pair score     = (composite₁ × usable hours₁ + composite₂ × usable hours₂) ÷ 2
triplet score  = (sum of composite × usable hours over the three) ÷ 3
```

This is the **Avg score** on each combination. The five best solo targets,
pairs, and triplets are shown.

**Coverage** is the time from the earliest window start to the latest
window end in the combination, including any gaps between the windows.
