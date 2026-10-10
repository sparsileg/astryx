# Sequence Planner

::: {.note title="At a glance"}
The **Sequence Planner** turns your Pinned Targets into a plan for one
night: which target to image when, how many exposures each gets, and when
autofocus, guide calibration, and meridian flips will interrupt. It builds
the best plan it can as soon as it opens; you can then adjust it.
:::

## What You'll See

Open **Sequence Planner** in the sidebar. It plans the targets under
**Pinned Targets** (see [Introduction](introduction.md)); with none pinned,
Astryx says "No pinned targets. Please pin targets first." From top to
bottom, the view has four cards:

- **Session Settings**: the night, the place, and how long your rig takes
  for autofocus, meridian flips, guide calibration, and dithering. Click
  the card's title to fold it away once it's set.
- **Target Allocation**: one row for each target, with its exposure length
  and its share of the night.
- **Timeline**: the night as a bar, with each target's turn and every
  interruption.
- **Imaging Plan**: when to start and stop each target, and how many
  exposures you'll get.

::: {.shot id="sequence-planner-overview"}
The Sequence Planner with three pinned targets: Session Settings, Target
Allocation with three rows, the Timeline, and the Imaging Plan.
:::

## Session Settings

### The Night

| Setting | What it does |
|:--------------|:--------------------------------------------------------|
| Date | The night to plan: the evening of this date and the morning after. It starts at today. |
| Start | **Dusk** starts at astronomical dusk. **Custom** shows a field for your own start, filled in with dusk; type the time as 24-hour HH:MM (2300 works too), in the location's local time. |
| Location | Where you'll image. It starts at the location chosen in the sidebar, and can be set to any of your locations. |
| Min Alt | The lowest altitude you'll image at. It starts at the Min Altitude in Settings; a different value is highlighted. Targets must also be above the location's horizon profile. |

A Custom time can be up to 60 minutes before dusk; Astryx uses it as you
typed it and warns you it's before dusk. Later times, such as 01:30, mean
that time after midnight. A time more than 60 minutes before dusk or after
dawn can't be used, so Astryx says so and starts at dusk.

The plan never starts before the first target is above your minimum
altitude, and ends when the last target sets or at astronomical dawn,
whichever comes first.

### Overheads

The note in the card's title, "Autofocus is assumed for new targets and
after meridian flip", sums up the autofocus rule. The rest of the card
describes your rig. Astryx remembers these settings, so you set them once.

| Setting | What it does |
|:------------------|:--------------------------------------------------------|
| Autofocus | Untick it if you don't autofocus. |
| AF Interval | Minutes between autofocus runs on the same target: 0, 30, 60, 90, or 120. With 0, autofocus runs only when a target starts and after a meridian flip. |
| AF Duration | How long an autofocus run takes, in minutes. |
| Flip Pause | How long imaging stops before the meridian flip, in minutes. |
| Flip Duration | How long the flip itself takes, in minutes. |
| Flip Offset | How many minutes after the target crosses the meridian the flip starts. Match your capture software. |
| Guide Calibration | How long a guide calibration takes, in minutes. It runs when each target starts and after each flip. |
| Frames per Dither | How many exposures between dithers. Choose 0 if you don't dither; the label then reads "no dither". |

::: why
Overheads add up. With a calibration and an autofocus at the start of each
target, an autofocus every 30 minutes, and a meridian flip, a three-target
night can lose most of an hour. A plan that ignores them promises
exposures you won't get.
:::

::: note
Before the Flip Pause begins, your capture software checks whether there's
time for another complete exposure. If there isn't, it stops and waits.
So every meridian flip costs an extra, random amount of time, anywhere from
nothing to one exposure length. Because it's random, Astryx can't plan for
it, and a target that flips may end up an exposure or so short.
:::

### Time Between Exposures

Your camera also needs a few seconds between exposures to save each one,
and a dither takes time to settle. There's no setting for these: Astryx
starts with 5 seconds between exposures and 25 seconds for each dither, and
improves both figures each time you analyze a session log in [Log Analysis](log-analysis.md).
The more logs you analyze, the closer the plan's exposure counts get to what
your rig really does.

## Target Allocation

Each row has:

- the up and down arrows at the left, to move the target earlier or later
  in the night,
- the target's name,
- the exposure length in seconds; it starts at 300,
- a slider for the target's share of the night, and
- the result, for example "40% 36 × 300s": the share and the number of
  exposures.

**Total images** below the rows adds up the exposures.

Moving a slider takes time from, or gives time to, the targets after it,
split evenly among them; the targets before it keep their share. The last
target's slider can't go above the share it had when the plan was built,
because the night ends when that target sets, or at dawn.

**Reset & Optimize** throws away your changes to the order and the sliders
and builds the best plan again. Your exposure lengths stay.

::: note
Changing your Pinned Targets, or leaving the Sequence Planner and coming
back, builds a new plan, and the exposure lengths go back to 300 seconds.
Every other change keeps them.
:::

### When the Plan Changes

| You change | What happens |
|:----------------------------------------------|:------------------------------------|
| Date, Start, Location, Min Alt, or the Pinned Targets | A new plan is built from the start. |
| Any other session setting | The exposure counts are worked out again; the order and shares stay. |
| An exposure length or a slider | The same. |
| The order, with the arrows | The same, and the night's start and end move to suit the new first and last targets. |

The plan updates a second after your last change.

## The Timeline

The timeline runs from the start of the plan to its end, with the hours
labeled below it. Each target's turn is a blue block with its name;
neighboring targets are in two shades of blue so you can tell where one
ends and the next begins. Inside each block:

- The white line is the target's altitude, from 0° at the bottom of the
  block to 90° at the top.
- Yellow ticks at the top mark autofocus runs.
- An orange mark with a small circle on top marks the target crossing the
  meridian.
- **Cal** above the block marks a guide calibration, and **Flip** above
  **Cal** marks a meridian flip.
- Red crosshatching marks time when the target is below your minimum
  altitude.
- Orange hatching marks time when the target is behind your horizon
  profile.

The legend below the timeline names each of these.

::: {.shot id="sequence-planner-timeline"}
The Timeline for a two-target night: two shades of blue, the altitude
lines, autofocus ticks, a transit mark, and Cal and Flip labels.
:::

## The Imaging Plan

The first line gives the **Date**, the **Location**, and the **Session**:
the start and end times and the hours between them.

**Target Sequence** lists the targets in order. Each line gives the start
and end times, the minutes left for imaging once the overheads are taken
out, and the number and length of the exposures, for example "28 × 300s".
"Includes meridian flip" marks a target that flips during its turn.

Red lines under a target warn about time it can't be imaged:

- **Altitude constraint**: the target is below your minimum altitude at the
  start or the end of its turn.
- **Horizon constraint**: the target is behind your horizon profile.

Each comes with its start and end times and its length. Move the handover
with the sliders, or change the order, to shrink or remove them.

With four or more targets, a target that can't get enough time is left out
and listed at the bottom: "Not planned, not above the minimum altitude long
enough tonight".

### Session Detail

Click a target's name in the Target Sequence to see its turn event by
event: each **Calibration**, **Autofocus**, **Imaging**, and **Meridian
Flip**, with its start, end, and length. Click **Download PDF** to save the
list for the night.

## How the Plan Is Built

The planner tries to give every target at least two hours of usable
imaging, since that's about what you need for dithering to pay off. Then it
gets as much imaging as possible out of the night, and then shares it as
evenly as it can. Usable imaging is time spent exposing while the target is
above your minimum altitude and horizon.

With two or three targets, it tries every order, and for each one, where to
put the handovers and whether to avoid a meridian flip by handing over just
before it. With four or more, up to a Messier marathon, it images whichever
target will be lost soonest next. [Sequence Planner Rules](appendix-seqplan.md)
has the details.

The order you pinned the targets in doesn't matter. The planner doesn't
take the Moon into account; check that with the Target Optimizer or Daily
Visibility before you pin.

## Tips

::: tip
Start from the Target Optimizer. Its **Best Combinations** suggests targets
that share a night well, and **Replace Pinned Targets** hands them straight
to the Sequence Planner.
:::

::: tip
If a target only gets a sliver of the night, unpin it. Two targets with
three hours each usually give a better result than three with two.
:::

::: tip
Copy the Imaging Plan into your capture software's sequence: the start
times, the exposure lengths, and the counts. Astryx doesn't control your
equipment.
:::

## Related

- [Your First Night](first-night.md): planning a night from start to
  finish.
- [Target Optimizer](target-optimizer.md): choosing targets that share a
  night well.
- [Getting Started](getting-started.md): locations, horizon profiles, and
  the Min Altitude setting.
- [Sequence Planner Rules](appendix-seqplan.md): how the plan is built, in
  detail.
