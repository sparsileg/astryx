# Session Report Details

This appendix gives the rules behind the Combined Report in Log Analysis.
See [Log Analysis](log-analysis.md) for how to read it.

## Tiers

Each sub is compared with the night's median settled guide RMS: the
middle value of all the subs' total RMS.

| Tier | Rule |
|:-----------|:---------------------------------------------------------------|
| Unknown | No guide data covers the exposure, or the night has no median to compare with. |
| Reject | The exposure was cut short, or its RMS is more than 2 × the night's median. |
| Marginal | Its RMS is more than 1.2 × the median, it started before the dither settled, or a guide failure happened during it. |
| Clean | None of the above. |

The rules are checked in that order, so a sub that is both cut short and
unsettled is Reject.

## Settled Guide RMS

The Verdict's guide RMS leaves out the time while each dither settles,
since guiding is meant to be rough then. The Elevated guiding check uses
these bands:

| Settled RMS | Band |
|:----------------|:-------------|
| Under 0.95″ | Excellent |
| 0.95″ to 1.3″ | Normal |
| 1.3″ to 2″ | Elevated |
| 2″ to 4″ | High |
| 4″ or more | Critical |

## The Checks

Sixteen checks run on every night with light frames. Each finding has a
severity: **Critical** needs attention, **Warning** is worth looking into,
and **Info** is for the record.

| Check | What it looks for |
|:--------------------------|:---------------------------------------------------------|
| Guide-star swap | PHD2 jumping to a different star mid-session without saying so. |
| Cloud or transparency loss | A burst of guide failures: at least 3 in 5 minutes. |
| Unsettled start | Subs that started before the dither settled. Warning above 5% of the subs. |
| Truncated exposure | A sub that ended before its exposure time. |
| Manual intervention | An autorun stopped or an autofocus cancelled by hand, Plan Tonight paused, or a gap in the log. |
| Mount disconnect | The mount dropping its connection. |
| Frame cadence | Guide frames arriving at irregular intervals. |
| Elevated guiding | Settled RMS of 1.3″ or more: Info when elevated, Warning when high, Critical at 4″. |
| Axis-ratio inversion | Dec RMS higher than RA RMS, which often points to balance, backlash, or polar alignment. |
| Calibration outlier | PHD2 calibrations that disagree with each other, lost the star, or have a large orthogonality error. |
| Autofocus health | Autofocus failing more than usual, runs taking over 1.5 times the typical length, or star size growing through the night. |
| Plate-solve degradation | Plate solves that didn't center cleanly, or a falling star count. |
| Focus drift | The night's focus change per degree of temperature, when there are enough autofocus runs. |
| Dropped frames | The share of guide frames PHD2 dropped. Warning above 2%. |
| Lock position near edge | The guide star close to the edge of the guide camera's frame. |
| Mid-imaging guide recovery | Guiding lost and recovered in the middle of imaging. |

Calibration outlier, Plate-solve degradation, and Mid-imaging guide
recovery are new and not yet confirmed against many nights, so they report
as Info whatever they find.

## Internal Checks

Before the report is built, Astryx checks the two logs against each other:
for example, that the number of dithers agrees, and that each sub's guide
frames add up to its exposure time. A failed check appears in Data Quality
with what it affects, and a mismatch that touches a Verdict figure is noted
beside it.

## Where the Limits Come From

The limits were set from the logs of one rig over nine months: 25 ASIAir
logs and 19 PHD2 logs. They suit a typical small refractor on a strain-wave
mount with a guide camera. A very different rig may trip some checks more,
or less, often than it should.
