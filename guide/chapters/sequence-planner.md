# Sequence Planner

## Overview

The Sequence Planner helps you plan an optimal imaging session across
pinned targets for a given night. It determines the best order to image
your targets, allocates time to each one, accounts for equipment overhead
events, and visualizes the entire session on a timeline. If you are imaging
only one target, the Sequence Planner will provide the complete schedule
of events using user-defined session settings.

The planner works entirely from your pinned targets, your selected observer
location, and the session settings you provide. It requires no internet
connection.

---

## Session Boundaries

The session begins at astronomical dusk (sun below -18°), a user-defined
start time, or when your first target reaches minimum altitude. The session
ends at astronomical dawn, or when the last target sets below your minimum
altitude — whichever comes first.

**Important:** The session end time depends on which target is scheduled
last. A target that remains visible until dawn extends the session longer
than one that sets at 3 AM. The planner accounts for this when optimizing
target order.

---

## Target Allocation

Each target row has a slider for its share of the session, as a percentage.
Moving a slider takes time from, or gives time to, the targets after it in
the list, split evenly among them. Earlier targets keep their share.

The last target's slider is capped at its natural end time — it cannot be
extended past when the target sets below the minimum altitude or horizon or
dawn arrives, whichever comes first.

The total image count across all targets is displayed at the bottom of the
Target Allocation card and updates as you adjust sliders or exposure times.

Each target's net imaging time is its allocated time minus all overhead
events that occur during its window.

---

## Overhead Events

The following overhead events consume imaging time and are accounted for in
the exposure count calculation:

### Autofocus (AF)
If enabled, autofocus:

- Runs once at the **start of every target**
- Runs once **after every meridian flip**
- Runs **periodically** throughout each target at the interval you specify
- The AF timer resets after every AF event — whether periodic, post-flip,
  or at a target transition

### Calibration
- Runs once at the **start of every target**
- Also runs as part of the meridian flip sequence

### Meridian Flip
Occurs when a target transits (crosses the meridian). The full flip sequence is:

1. Wait for transit plus the user-configured offset, then pause imaging
2. Flip operation (user-configured duration)
3. Pause after flip (same duration as pause before)
4. Perform guiding calibration

A flip offset can be applied to trigger the flip slightly before or after
the exact transit time.

### Between Subs
A brief gap between each exposure (download time, dithering, etc.).

---

## Plan Optimization

The planner always optimizes the plan. It does so when the Sequence Planner
opens, when you change the date, start time, minimum altitude, or horizon
setting, and when you click **Reset & Optimize**. Changing an overhead
setting or an exposure time recalculates the plan but keeps your target
order and slider positions.

### Ranking

Candidate plans are compared on **usable integration time**: time spent on
subs while the target is above the minimum altitude and the horizon. Time
lost to overheads, or to a target that has set or sits behind the horizon,
doesn't count. Each target is scored with its own exposure time, so
targets with different exposure lengths are compared fairly.

Plans are ranked in this order:

1. **Minimum integration** — the most targets with at least 120 minutes of
   usable integration, about what dithering needs to pay off. If not every
   target can get there, the plan that brings the weakest of the rest
   closest to 120 minutes wins.
2. **Least wasted time** — the most total usable integration across all
   targets.
3. **Balance** — integration spread as evenly as possible across targets.

### Starting Point

Every plan starts from an equal split of the session, with targets ordered
by **earliest set time** — the target that sets soonest below your minimum
altitude is scheduled first, so targets with limited visibility are imaged
while they are still accessible. Targets still up at the end of the session
follow, ordered by when they rise; a target already up at the start counts
as rising then. Remaining ties go to the target that **transits first**, so
each is imaged nearer its highest point, and finally to the name. The order
you pinned targets in never affects the plan.

### Target Order

With up to 3 targets, every order is tried (2 orders for 2 targets, 6 for
3). For each order the session window is recalculated, since the first and
last targets decide when the session starts and ends, and the flip and
handover steps below are applied. On a tie, the starting order is kept.
Plans with 4 or more targets are built differently; see
[Four or More Targets](#four-or-more-targets).

### Meridian Flip Boundaries

For each target that has a meridian flip, the planner tries three boundary
positions relative to the transition to the next target:

**Option A — Exclude the flip:** End the current target just before the
flip pause begins. The flip overhead is avoided entirely, and the saved
time is given to the next target.

**Option B — Include and extend the flip:** Extend the current target's
window to include the full flip sequence plus additional post-flip imaging
time, at the expense of the next target's allocation.

**Option C — Absorb the next target's flip:** When the next target also
has a meridian flip, extend the current target's boundary past that flip,
so the next target begins with the telescope already on the correct side
of the meridian. This can eliminate two flip overhead events with a single
boundary adjustment.

Each option is kept only if it ranks higher than the plan without it.

### Handovers

Finally, each handover between consecutive targets is moved in 1% steps
to the position that ranks highest. A target keeps imaging until the next
one has risen above the minimum altitude and horizon, or hands over early
when it sets. The sweep repeats until no handover moves, since moving one
can change the best position for another.

### Four or More Targets

Trying every order stops being practical beyond 3 targets (24 orders for
4, millions for 10), so larger plans, up to a Messier marathon, are built
another way:

1. **Skip targets that can't be imaged.** A target that isn't above the
   minimum altitude and horizon for an equal share of the session, or for
   120 minutes if that's less, is left out and listed under the plan as not
   planned. Leaving targets out raises everyone else's share, so the check
   repeats until no more drop out.
2. **Image the target that will be lost soonest.** Whenever a target
   finishes, the next is the one, of those already up, that sets soonest.
   The planner searches for the most usable imaging time every target can
   get this way. A target that can't be fitted in at all is skipped too.
3. **Avoid meridian flips.** If a target's turn would include its meridian
   flip, it starts after the flip instead, and the target before it keeps
   imaging meanwhile. The flip is only paid for when waiting would lose the
   target, or for the night's first target, when waiting would leave the
   telescope idle.
4. **Hand out the time left over.** The handover sweep above then moves the
   boundaries between targets to gain usable integration, without taking
   any target below what the weakest one got (or 120 minutes, if that's
   less).

The meridian flip boundary options above apply to plans of up to 3 targets.

---

## Constraints and Assumptions

### Altitude
Targets must be above your configured minimum altitude to be scheduled.
The global minimum altitude from Settings is used as the default, but can
be overridden per session. If the first target is below minimum altitude at
the start of the session, the session start is delayed until it rises. If a
target sets before dawn, the session ends at that point.

### Horizon Profile
If your observer location has a horizon profile defined and horizon use is
enabled, targets blocked by the horizon are flagged with an orange
crosshatch overlay on the timeline. Time behind the horizon doesn't count
as usable integration when plans are ranked, but the planner does not
split a target's imaging window around a horizon obstruction.

### Meridian Flip Timing
The flip is triggered at transit plus the flip offset you specify. The
planner cannot communicate with your equipment — it models the flip as a
fixed overhead block. Actual flip timing depends on your imaging software.

### No Moon Avoidance
Moon position and phase are not currently factored into the sequencing
algorithm. Moon data is displayed on the Daily Visibility view and can
inform your manual target selection, but the sequence planner does not
automatically avoid targets near a bright moon.

---

## Manual Overrides

The optimizer's result is a suggestion. You can:

- **Drag targets** to reorder them in the Target Allocation section
- **Adjust sliders** to give more or less time to individual targets
- **Click Reset & Optimize** to return to the optimizer's suggested order
  with equal allocations

The timeline updates immediately whenever you make changes.

---

## Known Limitations

- Does not stop imaging when obstructed based on a horizon profile
- Does not take the moon position into account
- With 4 or more targets, the order follows set and rise times; other
  orders are not tried
- With 4 or more targets, the time left over after every target has its
  share mostly goes to targets later in the night, since the evening
  targets are limited by when they set
