# Combined Session Analysis Report

The combined report joins your ASIAir Autorun log and your PHD2 guide log
into a single view of an imaging night. It replaces reading the two
separate ASIAir and PHD2 reports side by side, cross-referencing image
numbers and timestamps yourself to work out what happened.

Both logs need to be loaded to get the combined report. If only the ASIAir
log is loaded, or only the PHD2 log, you'll still see the two original
single-log reports, but not this one.

A night with only flats, darks, or bias frames (no light frames) gets a
short calibration-only notice instead of the full report — there's nothing
to tier or analyze on a night with no actual imaging.

## Report sections

**Verdict.** The headline numbers for the night: subs captured, how many
fell into each quality tier, usable integration time, settled guide RMS,
and a count of findings by severity. If Astryx has a logged imaging-log
session for this date, your telescope and sensor are shown at the top of
this section too.

**Recommendations.** Astryx's own settings (sub gap, dither duration, AF
duration, and so on), your ASIAir configuration, your PHD2 configuration,
and process/hardware suggestions — each with what was observed, what's
recommended, and how confident that recommendation is. A recommendation
with nothing to change still shows up here, so you know a setting was
checked and left alone, not skipped.

**Session Timeline.** A chronological table of what happened overnight —
imaging blocks, autofocus runs, meridian flips, and anything flagged as a
finding. By default this hides routine housekeeping (dither, plate solve,
routine mount tracking start/stop) and anything guide-quality-related other
than guide calibration itself, so the table reads like your sequence plan
rather than a guide-camera log. Check "Show all events" to see everything,
including guide-star losses, reselections, and every individual dither.

**Summary.** Where the night's time actually went — imaging, autofocus,
guide calibration, meridian flip, dither — reconciled against wall clock,
with any unaccounted time called out explicitly rather than hidden.

**Per-Sub Frame Quality.** One row per exposure, grouped by target: start
time, guide RMS (RA, Dec, and total), peak, temperature, and a quality tier
(clean / marginal / reject / unknown) with the reason when it's not clean.
Exportable as CSV from the button below the report.

**Guiding Analysis.** Guide equipment, overall guiding statistics, a
pier-side breakdown, dither amplitude, and — when there's enough log
signal — informational notes on the effective dither settle timeout and
effective frames-per-dither actually used that night. These two are
informational only; they're not recommendations, because they're fixed
ASIAir settings the log can only report on, not sensibly suggest a change
to. The full Guide Sessions table and any PHD2 calibration blocks are
listed underneath.

**Findings.** Every anomaly the analysis turned up, ranked by severity,
each with the evidence behind it and, where relevant, what alternative
explanations were ruled out and why.

**Focus and Environment.** Autofocus events for the night, plus any
detected focus/temperature drift trend or achieved-star-size trend across
the session.

**Data Quality.** How much to trust everything above: how many invariants
(internal cross-checks) passed or failed, how many log lines the parser
couldn't recognize, how many subs have no guide data, a Meridian Flip
Verification table (see below), and a fixed list of things this kind of
analysis can never see — satellite trails, image-level quality, and so on.

## Meridian Flip Verification

ASIAir's meridian flip has two settings: how long before the target
crosses the meridian it stops tracking (Astryx calls this Flip Pause), and
how long after the crossing it re-centers and resumes (Flip Offset). These
are fixed dial settings in ASIAir, not something the night's conditions
would ever justify changing — so rather than a recommendation, the report
computes the true meridian transit time for your target and location and
compares it against what actually happened in the log, and against what
Astryx currently has stored for these two settings. The Delta column is
there specifically to catch the case where ASIAir and Astryx have quietly
drifted out of sync with each other.

This table only appears when Astryx has a location to compute the transit
from — that needs an Astyx imaging-log session logged for the same date.

## Tiers

Every sub is placed into one of four tiers:

* **Clean** — nothing flagged. Settled at start, no guide failures, RMS
  within the night's normal range.
* **Marginal** — usable, but something is off: RMS elevated relative to
  the night's median, started before its dither settled, or a guide
  failure happened during the exposure.
* **Reject** — RMS far enough above the night's median to be considered
  unusable, or the exposure was truncated.
* **Unknown** — no guide data available for this exposure window, so no
  tier could be assigned either way.

Tiers are relative to each night's own median guide RMS, not a fixed
number, since guiding performance on a given rig changes over time.

## Confidence levels

Every recommendation and finding carries one of four confidence levels:

* **Measured** — read directly from the log, no computation involved.
* **Derived** — computed from log data and cross-checked against an
  independent path (for example, the meridian transit calculations).
* **Inferred** — a pattern match against corpus behavior, not a direct
  measurement. Inferred findings state what alternative explanations they
  ruled out and how.
* **Copied** — the value as configured, shown for reference, with no
  independent verification behind it (usually because the data needed to
  verify it — like a location — isn't available for that night).

## PDF export

The "Download PDF Report" button produces a printable version sized for
portrait letter paper. It matches the on-screen report almost exactly,
with two differences: the Session Timeline is condensed to the same
default view as "Show all events" unchecked (rather than including every
row), and each target's Per-Sub table starts on its own page, so a
multi-target night doesn't run everything together.

## What this analysis can't see

Log analysis only knows what ASIAir and PHD2 wrote down. A few things are
worth keeping in mind:

* Satellite and aircraft trails are invisible — the guide camera looks at
  a different patch of sky than the main camera.
* Image-level quality (gradients, focus at the sensor, transparency within
  a single sub) isn't visible to a log parser at all. A clean tier means
  nothing looked wrong in the guide/timing data — it doesn't mean the
  frame is a keeper.
* Guide-star mass is not a usable measure of transparency. It stays flat
  within a single guide-star lock even through real cloud, since PHD2
  loses and reselects a star rather than watching it fade.
* A finding only fires for a pattern that's been specifically coded for.
  A genuinely new kind of failure will only show up as an invariant
  failure or unaccounted time in Data Quality, not as a named finding.
* All of the thresholds behind the tiers and findings are calibrated
  against your own rig's logged history — they're not universal defaults,
  and they'll drift as your equipment or technique changes.

## How to use this information

Start with the Verdict and Recommendations at the top — that's the fastest
read on whether the night was clean and whether anything in your setup
needs attention. If the Verdict flags a dither-count mismatch or an
unreliable RMS figure, check Data Quality before trusting the numbers
above it.

For a night that didn't go well, the Session Timeline with "Show all
events" checked and the Findings section together will usually tell you
what happened and when — check the Per-Sub table for the specific frames
worth a closer visual look, since log analysis can flag likely problem
frames but can't confirm them by looking at the actual image.
