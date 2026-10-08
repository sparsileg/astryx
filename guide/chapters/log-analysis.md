# Log Analysis

::: {.note title="At a glance"}
**Log Analysis** reads the logs your ASIAir and PHD2 write during a night,
and tells you what happened: how many subs were clean, where the time
went, what went wrong and when, and what to change. Each log you analyze
also teaches the Sequence Planner how long your rig really takes between
exposures.
:::

## What You'll See

Open **Log Analysis** in the sidebar. The **Session Log Analysis** card has
two file pickers:

- **Session Log**: the ASIAir's Autorun log for the night, a .txt file.
- **PHD2 Guide Log**: the PHD2 guide log for the same night, also a .txt
  file, with a name like PHD2_GuideLog_2026-10-07_201500.txt.

Each log you load adds a report below them. Click a report's title to open
or close it:

| Report | Appears when | Title |
|:--------------------|:-----------------------|:----------------------------------------|
| Session Report | The Session Log is loaded | Session Report — *target* — *date* |
| PHD2 Guide Report | The PHD2 Guide Log is loaded | PHD2 Guide Report — *date* |
| Combined Report | Both are loaded | Combined Report — *targets* — *date* |

The Combined Report is the one to read. The other two are the separate
views of each log that it brings together.

::: {.shot id="log-analysis-overview"}
Log Analysis with both logs loaded: the two file pickers and the three
report titles, with the Combined Report open at its Verdict.
:::

## Loading a Night

1. Copy the night's logs from your ASIAir to your computer.
2. In **Session Log**, choose the Autorun log.
3. In **PHD2 Guide Log**, choose the guide log from the same night.

The order doesn't matter. Loading another log in either picker replaces
that report and rebuilds the Combined Report.

If you recorded the night in the Imaging Log (a session with the same
date), the Combined Report uses that session's telescope, sensor, and
location. Without one, it uses your telescope and sensor if you have only
one of each, and leaves out what needs a location.

A night with only flats, darks, or bias frames has no light frames to
analyze; the Combined Report says so and stops there.

## What the Logs Teach the Sequence Planner

Each time you load a Session Log, Astryx measures two things the Sequence
Planner needs:

- the **sub gap**: how long the camera takes between the end of one
  exposure and the start of the next, and
- the **dither duration**: how long a dither takes to settle.

It moves its stored figures a fifth of the way toward each night's
measurements, so a single unusual night doesn't throw them off. A night
with too few clean samples leaves them alone. The **Behavior** table in the
Combined Report's Recommendations shows each night's measurement and the
stored figure.

::: note
Load each night's Session Log once. Loading the same log again counts the
night twice.
:::

## The Combined Report

### Verdict

The headline numbers: **Subs Captured**; how many were **Clean /
Marginal / Reject / Unknown**; **Usable Integration**; **Settled Guide
RMS**, the guiding error once each dither had settled; and the
**Findings**, counted by severity: **Critical**, **Warning**, and **Info**.
The telescope and sensor appear above them when Astryx knows them.

Every sub is given a tier:

| Tier | Meaning |
|:-----------|:----------------------------------------------------------------|
| Clean | Nothing flagged. |
| Marginal | Usable, but something was off: guiding worse than usual for the night, a start before the dither settled, or a guide failure during the exposure. |
| Reject | Guiding much worse than usual for the night, or the exposure was cut short. |
| Unknown | No guide data for the exposure, so no tier could be given. |

"Usual for the night" means compared with the night's own median guiding,
not a fixed number. [Session Report Details](appendix-session-report.md)
gives the limits.

### Recommendations

First, the frames worth a closer look: every Marginal and Reject sub, by
image number. Then up to three tables:

| Table | What it covers |
|:------------------------|:--------------------------------------------------------|
| Behavior | The sub gap and dither duration: tonight's measurement and the running average the Sequence Planner uses. |
| Sequence Planning | AF Duration, Guide Calibration Duration, and Flip Duration, measured tonight, with the value to set in the Sequence Planner. |
| Guiding Configuration | PHD2 settings: Search Region, Star Mass Tolerance, RA / Dec Minimum Move, RA / Dec Aggression, Guide Star Selection, and Calibration Timing. |

Each row gives what was **Observed**, what's **Recommended**, and the
**Confidence**. A row that needs a change is highlighted, with the evidence
below it. A setting with nothing to change is still listed, so you know it
was checked.

The confidence tells you how far to trust a row:

| Confidence | Meaning |
|:-----------|:---------------------------------------------------------------|
| Measured | Read straight from the log. |
| Derived | Calculated from the log and checked another way. |
| Inferred | A pattern that matches known behavior, not a direct measurement. |
| Copied | Your setting, shown for reference; nothing in the logs could check it. |

### Session Timeline

The night in order: imaging blocks, autofocus runs, guide calibrations,
meridian flips, and anything flagged as a finding, with each one's
**Time**, **Duration**, and, for imaging, **Guide Quality**. A row naming
the target marks each change of target, and repeated identical events are
shown once with a count.

Dithers, plate solves, and the routine start and stop of tracking are
hidden. Tick **Show all events** to see them.

### Summary

Where the night's time went: imaging, autofocus, guide calibration,
meridian flip, and the rest, with each one's **Total Time** and **% of
Session**. Time Astryx can't account for is listed, not hidden.

### Per-Sub Frame Quality

One table for each target, with a row for each sub: **Image #**, **Start**,
**RMS RA**, **RMS Dec**, **RMS Total**, **Peak**, **Temp**, and **Tier**.
The Tier column also notes dropped guide frames and a start before the
dither settled. Marginal and Reject rows are highlighted.

### Guiding Analysis

The guide camera and mount, overall guiding statistics, and the results
for each side of the pier and for dithering. Below them are the **Guide
Sessions** table (each stretch of guiding between interruptions) and the
**Calibrations** table (each PHD2 calibration: **West Rate**, **North
Rate**, **Orthogonality**, and any **Star Lost**).

### Findings

Every problem the analysis found, most severe first, each with the
evidence behind it. An Inferred finding also says what other explanations
it ruled out. [Session Report Details](appendix-session-report.md) lists
the checks.

### Focus and Environment

The night's autofocus runs, with each one's **Trigger**, **Duration**,
**Outcome**, **Temp**, and **Star Size**, and any trend in focus position
with temperature, or in star size over the night.

### Data Quality

How far to trust everything above:

- how many internal checks passed and failed,
- how many log lines Astryx didn't recognize,
- how many subs have no guide data,
- **Meridian Flip Verification**, and
- **Stated Limits**: what log analysis can never see.

**Meridian Flip Verification** compares what your ASIAir actually did at
the meridian flip with the **Flip Pause** and **Flip Offset** set in the
Sequence Planner. A large **Delta** means the two have drifted apart; set
the Sequence Planner to match your ASIAir. The table needs the night's
location, so it appears only when the night is in the Imaging Log.

### Saving the Report

- **Download PDF Report** saves the whole report as a PDF. Keep it with
  the night's subs: it's a lasting record of how each sub was taken,
  what went wrong, and which frames to check, long after the logs are
  gone. It also prints well. The timeline in it leaves out the hidden
  events, as the screen does with **Show all events** unticked, and each
  target's Per-Sub table starts on a new page.
- **Download Per-Sub CSV** saves the Per-Sub Frame Quality table for a
  spreadsheet.

## What Log Analysis Can't See

Log analysis only knows what the ASIAir and PHD2 wrote down:

- Satellite and aircraft trails are invisible: the guide camera looks at a
  different patch of sky from the main camera.
- Image quality itself, such as gradients, focus, and haze within a sub,
  isn't in the logs. A Clean sub had nothing wrong in its guiding and
  timing; it may still not be a keeper.
- The brightness of the guide star isn't a reliable measure of cloud, since
  PHD2 loses a fading star and picks another rather than watching it fade.
- A check finds only what it was written to find. A new kind of problem
  shows up only as a failed internal check or unaccounted time in Data
  Quality.
- The limits behind the tiers and findings were tuned on one rig's logs.
  They're a good starting point, not universal.

## Reading a Night

Start with the **Verdict** and **Recommendations**: they tell you quickly
whether the night was clean and whether anything needs changing. If the
Verdict mentions a mismatch, check **Data Quality** before trusting the
numbers.

For a night that went wrong, tick **Show all events** in the Session
Timeline and read it alongside **Findings**: together they usually show
what happened and when. Then look at the frames the Recommendations list.
The logs can point to likely problem frames; only looking at the images can
confirm them.

## Tips

::: tip
Record the night in the Imaging Log before you analyze its logs. The
report then knows your telescope, sensor, and location, and can check your
meridian flip settings.
:::

::: tip
Analyze your logs regularly, not just after bad nights. Clean nights are
what tune the Sequence Planner's exposure counts.
:::

## Related

- [Sequence Planner](sequence-planner.md): the settings the
  recommendations refer to.
- [Imaging Log](imaging-log.md): recording the night, so the report knows
  your equipment and location.
- [Session Report Details](appendix-session-report.md): tiers, confidence,
  and every check.
