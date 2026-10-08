# Something Doesn't Look Right

::: {.note title="At a glance"}
Most surprises in Astryx have a simple cause: a setting that differs
between views, a missing step, or no internet connection. Find what you're
seeing below.
:::

## Targets and Filters

**The Visibility filter finds nothing, or Best Month is blank.**
Best Months haven't been calculated for the location chosen in the
sidebar, or the calculation was cancelled. Run **Calculate Best Months**
from **Admin Tools** (see [Admin Tools](admin-tools.md)).

**A target passes the Visibility filter, but the To Do List says it isn't
observable tonight.** The two use different minimum altitudes. The
Visibility filter and the Observable months use a fixed 35°; the To Do List
uses the **Min Altitude** in Settings. See the note in [To Do
List](todo-list.md).

**A target I know is missing from the results.** Check **Min Size (′)** and
**Limiting Mag**: they start at your Settings, and can hide small or faint
targets. An empty **Catalog** or **Type** list matches nothing. Try
searching for the target by name instead.

**A target has no Best Month at all.** It never gets high enough from your
location, or is high only in daylight or twilight. See [Best Month
Calculation](appendix-best-months.md).

## Times and Dates

**Times are an hour off.** Check the location's **Time Zone** in **Manage
Observer Locations**. Astryx uses the location's time zone and daylight
saving, not your computer's, so a location with the wrong time zone shows
wrong times everywhere.

**Times in the Target Optimizer or Sequence Planner don't match Daily
Visibility.** Daily Visibility shows times in the location's local time.
The Target Optimizer and Sequence Planner show them in your computer's
time zone. They agree when your computer is in the location's time zone.

**Daily Visibility shows yesterday's date.** After midnight and before
noon, it starts at the night you're in, which began yesterday evening.

**"No astronomical night at this location/date".** At high latitudes in
summer, the Sun never gets 18° below the horizon, so there's no
astronomical darkness to plan in. Choose another date.

## Planning

**The Sequence Planner is empty, or says "No pinned targets".** It plans
only your Pinned Targets. Pin some in Target Selection, or with **Replace
Pinned Targets** in the Target Optimizer.

**My exposure lengths went back to 300 seconds.** Changing the date, start,
location, minimum altitude, or horizon setting, changing your Pinned
Targets, or clicking **Reset & Optimize** builds a new plan with the
default length. Set exposure lengths last.

**A target was left out of the plan.** With four or more targets, a target
that can't get enough time above your minimum altitude is left out and
listed under the Imaging Plan. Unpin it, or lower **Min Alt**.

**The Target Optimizer ranks a target highly, but it's behind my trees.**
The Target Optimizer doesn't use your horizon profile. Check the target in
Daily Visibility, which does.

**The Daily Visibility button in the Target Optimizer shows the wrong
night.** The Optimizer's date goes back to today when you leave and return.
Set the **Date** again before you click.

## Online Features

**The Viewfinder's sky image doesn't load.** It needs an internet
connection the first time you look at a target. Images you've seen
recently are kept and work offline.

**The forecast strips say "Cloud forecast unavailable for this date".**
The forecast covers today and the next four days only, and needs an
internet connection.

**Check for Target Updates says the file isn't available.** It needs an
internet connection.

## Imaging Log

**A session shows 0 exposures and 0.0h.** Integration counts only **Used**
exposures. Open the session and fill in **Used**.

**A session won't save.** It needs a **Date** that isn't in the future, a
**Sub Length**, and at least one **Original Exposure**. If you record the
session before imaging, enter the number you plan to take.

**A finished target doesn't count in my program.** Only projects with the
status **Completed** count as imaged.

## Log Analysis

**There's no Combined Report.** It needs both logs: the Session Log and the
PHD2 Guide Log, from the same night.

**There's no Meridian Flip Verification.** It needs the night's location,
which comes from an Imaging Log session with the same date. Add the session,
then load the logs again.

**The report doesn't know my telescope and sensor.** As above: record the
night in the Imaging Log first.

## Data and Backups

**My data is gone.** On the web version, your data lives in the browser.
Clearing the browser's data, using a private window, or using a different
browser or computer shows an empty Astryx. Restore your latest backup (see
[Backup and Restore](backup-restore.md)).

**Automatic backups aren't happening.** If the wait after your last change
ran out while Astryx was closed, that backup is skipped. On the desktop
app, automatic backups also need a **Backup Folder** in Settings.

**A backup won't restore: "Version Mismatch".** The backup was made by a
version of Astryx with a different database version.

## Still Stuck?

Describe what you see, and what you expected, in an issue at
[github.com/sparsileg/astryx/issues](https://github.com/sparsileg/astryx/issues).
