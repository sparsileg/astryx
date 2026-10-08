# To Do List

::: {.note title="At a glance"}
The **To Do List** is your shortlist: targets you'd like to image someday.
It shows which of them you can image tonight and when each one is up, or
sorts them by type or by the month they're best placed. Click a target to
make it the Current Target.
:::

## What You'll See

Open **To Do List** in the sidebar. At the top of the view are two
controls:

- **Sort by:** chooses how the list is arranged: **Rise Time (Tonight)**,
  **Type**, or **Best Month**. It starts at Rise Time (Tonight).
- The button next to it switches between a chart and a plain list. It's
  labeled with the view it switches *to*: **List** while you're looking at
  the chart, **Chart** while you're looking at the list. The view starts as
  a chart.

If the list is empty, Astryx says so and points you to Target Selection.

::: {.shot id="todo-list-chart"}
To Do List sorted by Rise Time (Tonight), chart view: the header with
tonight's date, Minimum altitude, and dusk and dawn times, and a dozen bars,
one of them gold for a pinned target.
:::

## Adding and Removing Targets

You add targets from their Target Details window, which opens when you
click a target: a result in Target Selection, a name under **Pinned
Targets**, or the **Current Target** button (see [Finding
Targets](target-selection.md)). Click **Add to To Do List**.

Once the target is on the list, the button reads **Remove from To Do
List**. In the To Do List itself, the list view has a **Remove**
button on every row. The chart has no Remove buttons; switch to **List**
to remove targets.

## Rise Time (Tonight)

With **Rise Time (Tonight)**, Astryx works out tonight's darkness from the
location chosen in the sidebar and splits your list in two:

- **Observable Tonight** holds the targets that spend at least two unbroken
  hours above your minimum altitude between astronomical dusk and dawn.
  Targets that never drop below your minimum altitude (circumpolar targets)
  always count.
- **Not Observable Tonight** holds the rest.

The minimum altitude here is the **Min Altitude** in Settings. "Tonight" is
always tonight; to look at another date, use the Target Optimizer or Daily
Visibility.

::: note
This is not the same test as the Visibility filter in Target Selection,
which uses a fixed 35° over a whole month. A target can be in season by the
Visibility filter and still be Not Observable Tonight, or the reverse,
especially if your Min Altitude is well below or above 35°.
:::

### The List

In the list view, each card shows its count, for example "Observable
Tonight (12)". Circumpolar targets come first, then the rest in the order
they rise. Each row shows:

- the imaging status circle (empty, half filled, or filled, as in Target
  Selection),
- a pin and a gold background behind the name if the target is pinned,
- the designation, type, and up to two common names,
- **Rise** and **Set**: the times the target climbs above and sinks below
  your minimum altitude, in the location's local time. Circumpolar targets
  show "Circumpolar" for both. "N/A" means the target doesn't cross your
  minimum altitude in the 24 hours from noon to noon.

### The Chart

The chart shows only the Observable Tonight targets. Its header gives
tonight's date, your **Minimum altitude**, and the **Astronomical dusk** and
**Astronomical dawn** times. The left edge of the chart is dusk and the
right edge is dawn.

Each target gets a bar that runs from when it rises above your minimum
altitude to when it sets below it, cut off at dusk and dawn:

- A rise time at the left end of the bar means the target rises after dusk.
  A set time at the right end means it sets before dawn. No time means the
  bar runs to the edge of the night.
- The line inside the bar is the target's altitude through the night, from
  the horizon at the bottom of the bar to straight overhead at the top. The
  peak of the line is when the target is highest.
- A gold bar is a pinned target.
- The circle before the name is the imaging status.

Click a bar to make that target the Current Target.

::: tip
Read the chart from left to right to plan a night: a bar ending early in
the evening is a target to start with, and one starting after midnight is a
target to finish with. The [Sequence Planner](sequence-planner.md) does
this ordering for your pinned targets.
:::

## Type and Best Month

The other two sorts group the whole list:

- **Type** makes one group per object type, such as Emission nebula or
  Galaxy, in alphabetical order. Within a group, targets are in order of
  their Best Month.
- **Best Month** makes one group per month, starting with last month, so
  the targets whose season is ending come first, then this month's, then
  the months ahead. Targets with no Best Month for your location are in
  **No Best Month Data** at the end. Typically that's because the target
  never rises high enough from that location to image, and often never
  rises above the horizon at all: a far-southern target seen from the
  north, for example. The Best Month is the one shown in a target's details
  in Target Selection.

The list view shows every target in your To Do List, with the number of
targets in each month. The chart view shows the same groups, but only the
targets that are Observable Tonight, so it can leave out whole groups.

::: {.shot id="todo-list-month"}
To Do List sorted by Best Month, list view: cards for last month, this
month, and the next two months, with Remove buttons.
:::

## Clicking a Target

Click a target's name in the list, or its bar in the chart, and Astryx:

- makes it the Current Target, so Daily Visibility, Yearly Observability,
  and the Viewfinder show it, and
- opens its Target Details window, with the target's designations, size,
  coordinates, and observability.

Close the details window and open **Daily Visibility** to check the night
for that target.

## Tips

::: tip
Use the To Do List as the [Target Optimizer](target-optimizer.md)'s source. Choose **To Do List**
in the Target Optimizer's source list and click **Find Targets**: it ranks
everything on your list for the night you choose, without filtering the
whole database again.
:::

::: tip
In Target Selection, set **Data to search** to **To Do List** to search or
filter only your To Do List, for example to see which of your saved targets
are galaxies over 10′.
:::

::: why
The To Do List is for someday; Pinned Targets are for tonight. Keep the To
Do List long and the pinned list short. The Sequence Planner builds its plan
from your pinned targets only.
:::

## Related

- [Finding Targets](target-selection.md): searching, filtering, and adding
  targets.
- [Your First Night](first-night.md): from a list of targets to a plan for
  tonight.
- [Target Optimizer](target-optimizer.md): ranking your list for a night.
- [Getting Started](getting-started.md): the Min Altitude setting.
- [Best Month Calculation](appendix-best-months.md): how each target's Best Month is
  worked out.
