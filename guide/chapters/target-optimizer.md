# Target Optimizer

::: {.note title="At a glance"}
The **Target Optimizer** takes a list of targets, your To Do List or the
results of a filter, and ranks them for one night: how long each is up, how
high it climbs, whether it's best in the middle of the night, and how much
the Moon gets in the way. It can also suggest two or three targets that
share the night well.
:::

## What You'll See

Open **Target Optimizer** in the sidebar. The **Optimizer Settings** card at
the top holds the controls. After you click **Find Targets**, the results
appear below it, in the **Suggested Targets** card.

::: {.shot id="target-optimizer-overview"}
The Target Optimizer after Find Targets: the Optimizer Settings card, the
summary line, and the first three result cards.
:::

## The Settings

| Control | What it does |
|:------------|:--------------------------------------------------------|
| Date | The night to plan: the evening of this date and the morning after. It starts at today. |
| Start | **Dusk** starts the night at astronomical dusk. **Custom** shows a time field for your own start, for example if you can't be at the telescope until 23:00. |
| Source | The targets to rank: **To Do List**, or **Filter Targets**, the targets you sent from Target Selection. |
| Find Targets | Ranks the targets and shows the results. |

The night always ends at astronomical dawn. The Optimizer uses the location
chosen in the sidebar and the Min Altitude from Settings.

A Custom time is in your location's local time. It can be up to 60
minutes before dusk; Astryx uses it as you typed it and warns you it's
before dusk. Later times, such as 01:00, mean that time after midnight. A
time more than 60 minutes before dusk or after dawn can't be used, so
Astryx says so and starts at dusk.

### Sending Targets from a Filter

**Filter Targets** is grayed out and reads "Filter Targets (none loaded)"
until you send it a list. To send one:

1. In **Target Selection**, set the filters (see [Finding
   Targets](target-selection.md)).
2. In the Results card, click **Send to Optimizer**. Astryx sends every
   result, not just the ones on screen, and says how many it sent.
3. Open **Target Optimizer**.
4. Under **Source**, choose **Filter Targets**. It now shows the count, for
   example "Filter Targets (240 targets)".

The list stays until you send another one or close Astryx.

## The Results

The line at the top of the **Suggested Targets** card says how many targets
are shown out of how many were checked, and why the rest were left out:

| Reason | What it means |
|:------------------------------------|:------------------------------------------|
| never rises above minimum altitude | The target stays below your Min Altitude all night. |
| window too short | The target is above your Min Altitude for less than an hour. |
| below top 37 | The target qualified, but only the 37 best are shown. |

### A Result Card

The cards are ranked by **Composite Score**, best first. Each card has:

- The target's designation, common name, type, and **Min/Max Size**, in
  arcminutes.
- **Window**: when the target is above your Min Altitude during the night,
  and for how many hours.
- **Peak**: the highest it gets during the window, and when.
- **Moon**: how close the Moon comes to the target, in degrees, while the
  Moon is up during the window. If the Moon is down all through the window,
  it's the distance at the middle of the window.
- **Dips below min altitude**, with the times, if the target drops below
  your Min Altitude and comes back up during the night. The Window covers
  only one of the two parts.
- Four scores from 0 to 100, **Window**, **Altitude**, **Centering**, and
  **Moon**, and the **Composite Score** that combines them.

| Score | What scores high |
|:-----------|:----------------------------------------------------------|
| Window | A long window. One hour scores 0; eight hours or more scores 100. |
| Altitude | A high peak. Peaking at your Min Altitude scores 0; straight overhead scores 100. |
| Centering | Crossing the meridian, its highest point, in the middle of the night. |
| Moon | The Moon down, faint, or far away during the window. |

The Composite Score weighs Window and Moon at 30% each, Altitude at 25%,
and Centering at 15%. [Target Optimizer Scoring](appendix-optimizer.md) gives the
formulas.

::: note
The Optimizer uses your Min Altitude and the location's horizon profile, so
a target behind your trees ranks lower or is left out. To see how much the
horizon costs a target, open it in **Daily Visibility** and turn
**Horizon** off and on.
:::

### What You Can Do with a Card

| Button | What it does |
|:-----------------|:--------------------------------------------------------|
| Daily Visibility | Makes the target the Current Target and opens Daily Visibility for the Optimizer's date, with your horizon profile on. |
| Pin | Adds the target to Pinned Targets, ready for the Sequence Planner. |
| × | Removes the card from the results. Use it to drop targets you don't want before looking at Best Combinations. |

## Best Combinations

The Sequence Planner images one target at a time, so a long night can hold
two or three targets, one after another. Click **Best Combinations** at the
top of the results to see which ones share the night well. Click
**Individual Targets** to go back to the cards.

The combinations are built from the targets in the results, so anything you
removed with × is left out. The combinations come in three lists, of up to
five each:
**Solo Targets**, **Pairs**, and **Triplets**. Each combination shows:

- **Coverage**: the hours from the earliest window's start to the latest
  window's end, out of the hours in the night.
- **Avg score**: how good the combination is. It counts both the targets'
  Composite Scores and the hours each one can have to itself, so it isn't a
  0-to-100 score; use it to compare combinations with each other.
- Each target's **Window**, **Peak**, and **Score**.

When two targets are up at the same time, they have to share those hours,
so a pair that follows one another across the night scores better than one
that's up at the same time.

Click **Replace Pinned Targets** to unpin all your Pinned Targets and pin
the combination's targets instead. Astryx asks first.

::: {.shot id="target-optimizer-combinations"}
Best Combinations: the Solo Targets, Pairs, and Triplets lists, with
Coverage, Avg score, and Replace Pinned Targets on each card.
:::

::: why
The best single target isn't always part of the best night. A target that
is up from dusk to dawn uses the whole night by itself, while two targets
that rise and set at different times can each get a good run at their best.
Best Combinations looks at the night as a whole.
:::

## Coming Back to the Results

The results stay while Astryx is open, so you can look at a target in Daily
Visibility or the Viewfinder and come back to them. The settings, though,
go back to today, **Dusk**, and **To Do List**. Before you click **Daily
Visibility** on a card, set the **Date** again if the results are for
another night.

## Tips

::: tip
Run the Optimizer on your To Do List for the next few nights in turn. A
target that ranks low tonight because of the Moon may top the list next
week.
:::

::: tip
If you can only stay up part of the night, set **Start** to **Custom** with
the time you'll be ready. Targets that set early drop down the list.
:::

## Related

- [Your First Night](first-night.md): the Optimizer as part of planning a
  night.
- [Finding Targets](target-selection.md): building a list to send.
- [To Do List](todo-list.md): keeping a shortlist to rank.
- [Daily Visibility](daily-visibility.md): checking a result in detail.
- [Target Optimizer Scoring](appendix-optimizer.md): the formulas.
