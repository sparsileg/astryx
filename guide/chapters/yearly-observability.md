# Yearly Observability

::: {.note title="At a glance"}
**Yearly Observability** shows a whole year for one target: how high it gets
during full darkness each night, and how good each night is for imaging it.
Use it to find a target's season, see where the full Moons fall in it, and
understand why a target isn't available in a given month.
:::

## What You'll See

Open **Yearly Observability** in the sidebar. It shows the Current Target
from the location chosen in the sidebar (see
[Introduction](introduction.md)). To look at a different target, change the
Current Target, for example by clicking it in Target Selection or the To Do
List, then come back. Changing the location in the sidebar redraws the
graph.

At the top are the target's name and common name, and a summary line:

- **Peak altitude**: the highest the target gets during astronomical
  darkness on any night of the year.
- **Best month** and **Observable**: the same Best Month and run of
  Observable months shown in the target's details in Target Selection.
  They're missing if the target has no Best Month from this location.

Below the summary, **Minimum Altitude:** sets the altitude you need, from 5°
to 60°. It starts at the Min Altitude in Settings.

Under the graph, a legend names each part of it: Target Altitude, Minimum
Altitude, Observability (darker = better), Full Moon, and Current Day.

::: {.shot id="yearly-observability-overview"}
Yearly Observability for M 42 from a mid-northern location: the summary line,
the Minimum Altitude control, and the graph with its dark season and the
full-Moon markers.
:::

## Reading the Graph

The graph covers twelve months, starting on the first day of the current
month. Month names run along the bottom, with the year under the first month
and under each January. Height on the graph is altitude, from the horizon at
the bottom to straight overhead at the top.

| Part | What it shows |
|:----------------|:------------------------------------|
| White line | The target's highest altitude during astronomical darkness on each night. Gaps mean it stays below the horizon all night. |
| Yellow dashed line | Your Minimum Altitude. |
| Background | How good each night is for imaging this target. Darker is better. White means the target doesn't reach your Minimum Altitude in darkness that night, or there's no astronomical darkness at all. |
| Gold circles along the top | Full Moons. |
| Orange vertical line | Today. |

The background shading takes three things into account for each night:

- how close to midnight the target crosses the meridian (its highest point),
- how many hours it spends high enough in full darkness, and
- the Moon: how bright it is, and how close it comes to the target.

So the dark stretch of the background is the target's season, and the pale
gaps that recur inside it, centered on the gold circles, are the full-Moon
weeks.

::: note
The Minimum Altitude here only moves the dashed line and turns nights below
it white. It doesn't change how the remaining nights are shaded. That
shading uses a fixed altitude for each type of target; [Yearly Observability
Details](appendix-yearly.md) has the values.
:::

### The Shape of the Line

The white line is flat across the middle of a target's season, and slopes
down on either side. That's because of *when* the target is highest, not
how high it can get:

- **Flat:** every night, the target reaches the same highest altitude when
  it crosses the meridian. When that happens during full darkness, the line
  shows the full altitude, so it stays level.
- **Sloping:** the target crosses the meridian about four minutes earlier
  each night, or two hours earlier each month. Before its season, it's
  highest after dawn; after its season, it's highest before dusk. Either
  way, darkness only catches it while it's lower, so the line slopes down.

How long the flat stretch lasts depends on how long your nights are: long
winter nights catch more of each target's arc than short summer ones.

::: why
The line shows how high a target *can* get, not how long it stays there.
Early and late in the season, a target may reach a good altitude for only an
hour at the start or end of the night. Check those nights in Daily
Visibility before you plan around them.
:::

## Using It

- **Find the season.** Look for the dark stretch of background and the flat
  part of the line. That's when to image the target.
- **Avoid the Moon.** Within the season, plan your nights in the dark gaps
  between the gold circles.
- **See why a target isn't available.** If the line never reaches the dashed
  line, the target never gets high enough from this location. If it does,
  but not this month, it's out of season; the graph shows when it comes
  back.
- **Set the bar.** Raise **Minimum Altitude** if trees or buildings block
  your low sky, or if you want the steadier air higher up. The white parts
  of the background grow to show the nights you'd lose.

## Tips

::: tip
Check Yearly Observability before starting a long project. A target that
needs twenty hours of integration needs a season with enough dark,
moon-free nights to collect them. If the season is nearly over, start
something else and come back next year.
:::

::: tip
Set **Minimum Altitude** to match the Min Altitude in Settings, so the
dashed line here is the same one you see in Daily Visibility and the
Sequence Planner.
:::

## Related

- [Finding Targets](target-selection.md): the Best Month and Observable
  months in a target's details.
- [To Do List](todo-list.md): changing the Current Target from your
  shortlist.
- [Yearly Observability Details](appendix-yearly.md): how the shading is
  scored.
- [Best Month Calculation](appendix-best-months.md): how the Best Month and Observable
  months are worked out.
