# Admin Tools

::: {.note title="At a glance"}
**Admin Tools**, in the system menu, holds the jobs you do now and then:
setting up locations and equipment, calculating Best Months, and keeping
the target database up to date.
:::

## What You'll See

Open the system menu (≡) and point to **Admin Tools**. It has six items:

| Item | What it does |
|:------------------------------|:----------------------------------------------------|
| Calculate Best Months | Works out each target's Best Month and Observable months for a location. |
| Manage Equipment | Adds, changes, and removes telescopes, sensors, and filters. |
| Manage Observer Locations | Adds, changes, and removes your locations and their horizon profiles. |
| Clear All Targets | Deletes the target database. |
| Check for Target Updates | Downloads a newer target database, if there is one. |
| Import Target Database | Not available at present; it's grayed out. |

[Getting Started](getting-started.md) covers **Manage Equipment** and
**Manage Observer Locations**.

## Calculate Best Months

Each target's **Best Month**, **Peak Altitude**, and **Observable** months
depend on where you are, so Astryx works them out for each of your
locations and stores them with the targets. The Visibility filter in
Target Selection, the To Do List's grouping by Best Month, and the summary
line in Yearly Observability all use them.

You rarely need to start this yourself. Astryx calculates Best Months on
its own when you choose a location in the sidebar that doesn't have them
yet, and when it starts; a message at the bottom of the screen shows the
progress.

Calculate them again yourself after you move a location's coordinates, or
after Astryx's target database has been updated:

1. Open the system menu (≡), point to **Admin Tools**, and click
   **Calculate Best Months**.
2. Under **Location:**, choose a location, or **All Locations**.
3. Click **Calculate**.

A progress bar shows each target as it's done, with an estimate of the time
left. Click **Cancel** to stop; a location's Best Months are saved only
once it's finished.

When it's done, the dialog shows how many targets were checked, how many
are **Visible targets** from the location, and how many are **Not meeting
criteria**, that is, never well placed there.

[Best Month Calculation](appendix-best-months.md) explains how the months
are chosen.

::: why
Best Months take time to calculate: every target, for every night of the
year. Working them out once and storing them is what lets the Visibility
filter search all ~14,600 targets instantly.
:::

## Clear All Targets

Deletes every target from the database, along with the Best Months. Your
locations, equipment, Pinned Targets, To Do List, and Imaging Log are kept.
Astryx asks first.

You'd only do this to start the target database afresh. Use **Check for
Target Updates** afterwards to download it again.

## Check for Target Updates

Astryx's target database is updated from time to time with corrections and
new objects. **Check for Target Updates** compares your copy with the
latest:

- "Target database is already up to date" means there's nothing to do.
- Otherwise Astryx downloads the new database and reloads. Best Months for
  the location chosen in the sidebar are then calculated again.

It needs an internet connection. The version of your target database is
the number after "t" at the bottom of the sidebar, for example "v1.11.1 d6
t12".

## Related

- [Getting Started](getting-started.md): locations, horizon profiles, and
  equipment.
- [Best Month Calculation](appendix-best-months.md): how Best Months are
  chosen.
- [The Target Database](appendix-target-database.md): where the targets
  come from.
