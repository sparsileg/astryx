# Daily Visibility

::: {.note title="At a glance"}
**Daily Visibility** shows one night for one target, from noon to noon:
when it's dark, when the target is high enough and clear of your horizon,
where the Moon is, and the cloud, wind, and dew forecast. Use it to decide
whether a night is worth setting up for.
:::

## What You'll See

Open **Daily Visibility** in the sidebar. It shows the Current Target (see
[Introduction](introduction.md)) from the location chosen in the sidebar,
and the target's name is next to the view's title. To check a different
target, change the Current Target, for example by clicking **Daily
Visibility** on a Target Optimizer result card. Changing the location in the
sidebar redraws the view.

From top to bottom, the view has:

- the controls: **Date**, **Min Alt**, and **Horizon**,
- the forecast strips: **Clouds**, **Wind**, and **Dew**,
- the timeline, with the times of the night's events and the target's
  altitude, and
- three cards: **Moon Details**, **Target Details**, and **Target-Moon
  Separation**.

::: {.shot id="daily-visibility-overview"}
Daily Visibility for a target on a good night: the controls, the three
forecast strips, the timeline with its markers and altitude line, and the
three cards below.
:::

## The Controls

| Control | What it does |
|:------------|:--------------------------------------|
| Date | The night to show: the evening of this date and the morning after. Type a date in your Date Format (see [Getting Started](getting-started.md)), click 📅 to pick one from a calendar, or use the arrows: ◀ and ▶ move one day, ◀◀ and ▶▶ move a week. Hold an arrow down to animate back and forth through time. |
| Min Alt | The lowest altitude that counts, from 5° to 60°. It starts at the Min Altitude in Settings. |
| Horizon | When ticked, your location's horizon profile counts too, so the target must clear both. Untick it to see the night as if your horizon were flat. |

The date starts at today. After midnight but before noon it starts at
yesterday instead, so in the small hours you see the night you're in, not
the coming one.

## The Timeline

The timeline runs from noon on the date you chose to noon the next day.
The hours are labeled along the top, in your location's local time.

### The Sky

The background shows how dark the sky is, judged from the Sun and the
Moon:

- **Bright** (white): daylight, or a bright Moon high in the sky.
- **Dim** (gray): twilight, or moonlight.
- **Dark** (black): full darkness, with the Moon down or too faint to
  matter.

The Moon's effect depends on its phase, how high it is, and how close it is
to the target, so a crescent Moon low in the west barely dims the sky,
while a full Moon near the target washes out most of the night.

### The Lines

- The **white line** is the target's altitude, from the horizon at the
  bottom to straight overhead at the top. It's drawn only while the target
  is above your minimum altitude and clear of your horizon, so wherever you
  see it, the target is up.
- The **yellow dashed line** is your minimum altitude. With **Horizon**
  ticked, it rises wherever your horizon profile is higher than the minimum
  altitude, at the times the target passes behind it.

You can image while the white line is visible against a dark background.

### The Markers

Small yellow ticks along the bottom of the timeline mark the night's events,
each with its time. They're in three rows:

| Row | Markers |
|:---------|:------------------------------|
| Top | Astronomical dusk and dawn: the Sun 18° below the horizon. |
| Middle | Moonrise and moonset. |
| Bottom | When the target rises above, and sets below, your minimum altitude and horizon. |

A marker is missing when the event falls outside the noon-to-noon window,
or doesn't happen that day.

## The Forecast Strips

The three strips above the timeline are the weather forecast for the same
noon-to-noon window, hour by hour, from Open-Meteo:

| Strip | What it shows |
|:----------|:------------------------------------------|
| Clouds | Total cloud cover. Black is clear; bright amber is overcast. |
| Wind | Wind speed 10 m above the ground, as a yellow graph. The number at the top left is the top of the scale in mph, and the dashed line is half of it. Sheltered sites may get less wind than this. |
| Dew | The risk of dew, from how close the air temperature is to the dew point. Black is safe; bright blue means dew is likely. |

The forecast covers today and the next four days, plus last night until
noon. For other dates, the strips are replaced by "Cloud forecast
unavailable for this date". Daily Visibility needs an internet connection
for the forecast; everything else works offline.

::: tip
Hold the pointer over a strip for a reminder of what it shows.
:::

## The Cards

### Moon Details

The Moon's **Phase**, how much of it is **Illuminated** during the night,
and when it will **Rise** and **Set**. If the Moon neither rises nor sets in
the window, the card says "No rise/set during observation".

### Target Details

| Line | What it means |
|:-----------------|:--------------------------------------|
| Min altitude | The Min Alt you chose. |
| Rise, Set | When the target rises above and sets below your minimum altitude and horizon. "Before dusk" and "After dawn" mean the target is already up at dusk, or still up at dawn. |
| Dips below min | Shown only when the target drops below the dashed line during the night and comes back up, usually behind a tree or building in your horizon profile. |
| Peak altitude | The highest the target gets during darkness, and when. |
| Blocked | How many minutes the target is above your minimum altitude but behind your horizon profile. A dash means none. |

### Target-Moon Separation

A dial shows where the Moon is in relation to your target:

- **You** are the telescope in the center.
- **The target** is the bullseye at 12 o'clock.
- **The Moon** is on the rim, drawn in its phase. On the left it's
  approaching the target; on the right it has passed it. Near 12 o'clock it's
  at its closest, and at 6 o'clock it's on the far side of the sky.
- **The number** beside the dial is how far apart the Moon and the target
  are, in degrees: the closer of the separations at the start and end of
  the target's night.

The Moon moves about 13° a day against the stars, so as you step through the
nights with ▶, it travels clockwise round the dial, once a month. Many
targets lie well away from the Moon's path, and the Moon passes beside them
rather than over them. For these, it lifts outside the rim as it passes, and
arcs over the bullseye.

::: {.shot id="daily-visibility-moon-dial"}
The Target-Moon Separation card on a night with a bright Moon near the
target: the telescope in the center, the bullseye at the top, the Moon on
the rim with its haze reaching the target, the separation in degrees, and
the Interference line below.
:::

The haze around the Moon is its light in your sky. The brighter the Moon,
the further the haze spreads: a full Moon's reaches 90°, a half Moon's about
50°, and a thin crescent's hardly at all. The deeper the target sits in the
haze, the brighter the sky behind it.

If the Moon stays below the horizon from dusk to dawn, it's drawn as an
outline, with no haze.

**Interference**, below the dial, sums it up. For a full Moon it goes by
separation:

| Separation, full Moon | Interference |
|:--------------------|:-------------------------------------------------------|
| Under 20° | Severe |
| 20° to 40° | Significant |
| 40° to 60° | Some |
| 60° to 90° | Minimal |
| 90° or more | Negligible |

A fainter Moon interferes less at the same separation, in proportion to how
far its haze reaches. A half Moon 30° from the target rates as a full Moon
would at about 50°: **Some**, not **Significant**. Interference is
**Negligible** whenever the haze doesn't reach the target, and when the Moon
stays below the horizon all night.

::: why
The Moon's phase alone doesn't tell you whether a night is usable. A bright
Moon on the far side of the sky, or one that sets early, can still leave
hours of good imaging. Read the separation together with the timeline: if
the background is dark while the white line is up, the Moon isn't a
problem, whatever its phase.

It also depends on the target. Bright emission nebulae, especially imaged
with narrowband filters, and globular clusters can be good targets even
with a bright Moon. Save the dark nights for faint galaxies and reflection
nebulae.
:::

## Reading the Night

A good night has all of these:

- a long stretch of black background,
- the white line visible through most of it,
- black Clouds and Dew strips over the same hours, and
- a low Wind graph.

Then look at the details: when the target rises and sets tells you when to
start and stop, and Blocked tells you how much of the night your horizon
costs you.

## Tips

::: tip
Step through the nights with ▶ to find the next good one. The timeline and
the cards update each time, and the forecast strips cover the next four
days.
:::

::: tip
If **Blocked** shows a lot of minutes, untick **Horizon** to compare. If the
target would be well placed on a flat horizon, it may be worth imaging from
a different spot, or a different location.
:::

## Related

- [Your First Night](first-night.md): checking a night as part of planning
  it.
- [Getting Started](getting-started.md): horizon profiles and the Min
  Altitude setting.
- [Yearly Observability](yearly-observability.md): the same target over the
  whole year.
