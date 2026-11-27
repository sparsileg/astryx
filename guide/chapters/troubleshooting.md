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
observable tonight.** The Visibility filter looks at the whole month; the
To Do List looks at tonight only. See the note in [To Do
List](todo-list.md). If you've changed **Min Altitude** since Best Months
were calculated, Target Details says so under **Criteria**; recalculate
them (see [Admin Tools](admin-tools.md)).

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
recently are kept and work offline. Astryx tries five sky survey servers
in turn; if your connection is fine, all five are down at once, so try
again later.

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

**Automatic backups aren't happening.** Check that **Automatic backups on
change** is on in Settings. A backup is made only after you change your
data, once **Minutes before backup** has passed. On the desktop app,
backups go to the **Backup Folder** in Settings, or to your Downloads
folder if it's empty.

**A backup won't restore: "Backup From a Newer Astryx".** The backup was
made by a newer version of Astryx than the one you're running. Update
Astryx, then restore it.

**Astryx won't start: "Astryx couldn't read its settings" (or "its
data").** Astryx stops rather than start with default settings, which
would be saved over yours at your next change. Nothing has been changed:
**Reload Application** to try again. If it keeps happening, report it
(see **Still Stuck?** below) before clearing anything: your data is still
there.

**Astryx won't start: "Initialization Error".** **Reload Application**
tries again; nothing on that page deletes your data. If it keeps
happening, report it (see **Still Stuck?** below) with the message the
page shows. On the web version, clearing this site's data in your
browser's settings starts Astryx afresh, but it deletes all your
locations, equipment, Imaging Log and settings, so restore a backup
afterwards and clear it only as a last resort. On the desktop app, the
page shows the folder that holds your database.

**Astryx shows an error message but keeps working.** Something that runs
as Astryx starts, such as automatic backups, the backup reminder or Best
Months, failed. The message names it. The rest of Astryx works; reload to
try again, and report it if it keeps happening.

**The desktop app won't start: "updated by a newer Astryx".** A newer
version of Astryx has updated the database, and this version can't use
it. Install the newer version. The message also names the copy saved
before the update, if there is one: replacing `astryx.db` with it brings
back your data as it was then, without the changes made since. See
[Backup and Restore](backup-restore.md) for where the database is.

**A backup won't restore: "Failed to read backup file".** The message says
what's wrong: the file isn't an Astryx backup, or a record in it is
damaged, for example after the file was edited by hand.

## Desktop App on Linux

**The desktop reports a crash when Astryx closes.** On some Linux machines
with an NVIDIA graphics card, WebKit, which draws Astryx's window, crashed
as Astryx closed, and the desktop showed a crash notice. Nothing was lost.
Astryx now sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` on Linux, which
prevents it. To turn that off, start Astryx with
`WEBKIT_DISABLE_DMABUF_RENDERER=0`.

## Still Stuck?

Describe what you see, and what you expected, in an issue at
[github.com/sparsileg/astryx/issues](https://github.com/sparsileg/astryx/issues).
Include the versions from **About**, in the system menu (≡): the Astryx,
database schema and target database versions.
