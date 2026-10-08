# Sequence Planner Rules

This appendix describes how the Sequence Planner builds a plan and counts
exposures. See [Sequence Planner](sequence-planner.md) for how to use it.

## The Session

The night runs from astronomical dusk (the Sun 18° below the horizon), or
your Custom start, to astronomical dawn. Within it, the session:

- starts when the first target in the plan is above your minimum altitude
  (and horizon profile, with **Use Horizon** on), if that's later than the
  start, and
- ends when the last target sets below them, if that's before dawn.

So the session's length depends on which targets come first and last, and
the planner takes this into account when it chooses the order.

## Overheads

**At the start of each target**: a guide calibration, then an autofocus
(with **Autofocus** ticked).

**Periodic autofocus**: every **AF Interval** minutes after the last
autofocus on the same target. The run waits for the exposure in progress to
finish.

**Meridian flip**: a target that crosses the meridian during its turn
flips at the transit plus the **Flip Offset**:

1. Imaging stops **Flip Pause** minutes before the flip.
2. The flip takes **Flip Duration** minutes.
3. An autofocus runs (with **Autofocus** ticked).
4. A guide calibration runs.

## Counting Exposures

A target's turn is its share of the session. Its imaging time is the turn
minus all the overheads in it:

```
exposures = imaging seconds ÷ (exposure length + time between exposures)
```

rounded down. The time between exposures is:

```
time between exposures = sub gap + dither time ÷ Frames per Dither
```

or just the sub gap with **Frames per Dither** at 0. The sub gap starts at
5 seconds and the dither time at 25 seconds. Each session log you analyze
in Log Analysis moves each one a fifth of the way toward what that night
measured, if the log has enough clean samples.

The last exposure of the night is allowed to run past the end of the
session rather than be cut short.

## Ranking Plans

Plans are compared on **usable integration**: time spent on exposures while
the target is above the minimum altitude and horizon. Time lost to
overheads, or to a target that has set or sits behind the horizon, doesn't
count. Each target's exposures are counted with its own exposure length.

Plans are ranked by, in order:

1. **Minimum integration**: the most targets with at least 120 minutes of
   usable integration. If not every target can get there, the plan that
   brings the weakest of the rest closest to 120 minutes wins.
2. **Least wasted time**: the most usable integration in total.
3. **Balance**: integration spread as evenly as possible across the
   targets.

## Starting Order

Every plan starts from an equal split of the session, with the targets
ordered by:

1. the time they set below your minimum altitude, soonest first, so targets
   about to be lost are imaged while they're still up;
2. then, for targets still up at the end of the session, the time they
   rise, with a target already up at the start counting as rising then;
3. then the time they cross the meridian, so each is imaged nearer its
   highest point;
4. then their names.

The order you pinned the targets in never matters.

## Two or Three Targets

**Order.** Every order is tried: 2 for two targets, 6 for three. For each
one, the session's start and end are worked out again, and the flip and
handover steps below are applied. On a tie, the starting order wins.

**Meridian flips.** For each target that flips during its turn, three
handovers to the next target are tried:

- **Exclude the flip**: hand over just before imaging would stop for the
  flip, so the flip never happens; the time saved goes to the next target.
- **Include the flip**: keep imaging through the flip and for a while after
  it, taking time from the next target.
- **Absorb the next target's flip**: when the next target would also flip,
  keep imaging the current one until after that flip time, so the next
  target starts on the right side of the meridian. One adjustment can save
  two flips.

Each is kept only if it ranks higher than the plan without it.

**Handovers.** Finally, each handover is moved in 1% steps to the position
that ranks highest. A target keeps imaging until the next one has risen
above the minimum altitude and horizon, or hands over early when it sets.
The sweep repeats until no handover moves, since moving one can change the
best place for another.

## Four or More Targets

Trying every order stops being practical beyond three targets (24 orders
for four, millions for ten), so larger plans are built another way:

1. **Leave out targets that can't be imaged.** A target that isn't above
   the minimum altitude and horizon for an equal share of the session, or
   for 120 minutes if that's less, is left out and listed as not planned.
   Leaving targets out raises everyone else's share, so the check repeats
   until no more drop out.
2. **Image the target that will be lost soonest.** Whenever a target
   finishes, the next is the one, of those already up, that sets soonest.
   The planner searches for the most usable imaging every target can get
   this way. A target that can't be fitted in at all is left out too.
3. **Avoid meridian flips.** If a target's turn would include its flip, it
   starts after the flip instead, and the target before it keeps imaging
   meanwhile. The flip is only paid for when waiting would lose the target,
   or for the night's first target, when waiting would leave the telescope
   idle.
4. **Hand out the time left over.** The handover sweep then moves the
   handovers to gain usable integration, without taking any target below
   what the weakest one got (or 120 minutes, if that's less).

## Limits

- The Moon isn't taken into account.
- A target's turn isn't split around a horizon obstruction. The time behind
  the horizon is marked and doesn't count as usable integration, but the
  plan doesn't move another target into the gap.
- The planner can't talk to your equipment. The flip is modeled as a fixed
  block of time; the real timing depends on your capture software.
- With four or more targets, the order follows the set and rise times;
  other orders aren't tried, and time left over mostly goes to targets later
  in the night, since the evening targets are limited by when they set.
