# Finding Targets

::: {.note title="At a glance"}
**Target Selection** is where you find things to image. Search the database
by name when you know what you want, or filter it by catalog, type, the
month it's well placed, size, and brightness when you're looking for ideas.
Click a result to see its details, pin it, add it to your To Do List, or
send the whole list to the Target Optimizer.
:::

## What You'll See

Open **Target Selection** in the sidebar. The view has two cards:

- **Target Search & Filter**, on the left, is where you say what you're
  looking for: a name in the search box at the top, or the filters below it.
- **Results**, on the right, lists the matching targets. Clicking one opens
  its details over the list.

Until you change them, the filters are at their defaults (every catalog
and type, any month, and the size and magnitude limits from your Settings),
so the Results card already shows a list.

::: {.shot id="target-selection-overview"}
Target Selection with Type set to emission nebulae, Visibility set to the
current month, and the Results card showing the list.
:::

## Search by Name

Type in **Target Name** at the top of the Target Search & Filter card.
Searching starts once you've typed two characters, and the results update as
you type.

Astryx looks for what you type in each target's designation, its common
names, and its other designations, so all of these work:

- A designation: **M 31**, **NGC 7000**, **Sh 2-155**. You can leave out the
  space: **M31** finds M 31.
- A common name or part of one: **Rosette**, **Veil**, **Horsehead**.
- A word: **nebula** finds every target with "nebula" in a name.

An exact match comes first, then names that start with what you typed, then
the rest.

Starting a search puts the filters back to their defaults, so the search
covers every target. Changing a filter clears the search box. Searching and
filtering are two ways of filling the same Results list.

::: tip
**Data to search** above the search box chooses between **All Targets** and
your **To Do List**. Switch it to To Do List to find something you saved
earlier without wading through the whole database. It works the same way for
the filters.
:::

## Filter the Database

The filters sit below the search box. Set any combination; the Results card
updates each time you change one. There's no Apply button.

| Filter | What it keeps |
|:-------|:--------------------------|
| Catalog | Targets from the catalogs you tick. Use **Select All** and **Select None** at the top of the list. |
| Type | Targets of the types you tick, such as Emission nebula or Galaxy. **Select All** and **Select None** work here too. |
| Visibility | Targets that are well placed from your location in the month you choose. **Any month** turns this filter off. |
| Min Size (′) | Targets at least this large, in arcminutes. It starts at the Min Target Size in Settings. Leave it blank to include every size. |
| Limiting Mag | Targets at least this bright. Lower numbers are brighter. It starts at the Max Magnitude in Settings. Leave it blank to include every magnitude. |

**Reset**, below the filters, puts every filter back to its default.

A few things about the filters aren't obvious:

- **An empty Catalog or Type list matches nothing.** If you click **Select
  None** and forget to tick anything, the Results card is empty.
- **Visibility depends on your location.** A target counts as well placed in
  a month when, from the location chosen in the sidebar, it spends at least
  two unbroken hours above 35° in full darkness on nights in that month.
  Change locations and the list changes with it. With **Any month**, the
  list includes targets that never rise high enough to image from where you
  are.
- **Size uses a target's larger dimension.** A 20′ × 3′ edge-on galaxy
  passes a 10′ minimum.
- **Targets with no magnitude always pass Limiting Mag.** About a third of
  the database has no magnitude, including most emission and all dark
  nebulae, so a strict magnitude limit doesn't hide them.

::: why
The database is mostly small galaxies: about 11,400 of its 14,000 targets
are galaxies, and most of those are under 3′ across. With every type ticked
and no size limit, the list is a wall of faint smudges. Ticking only the
types you image and setting a minimum size that suits your field of view
turns thousands of results into a few hundred worth considering.
:::

::: {.shot id="target-selection-filters"}
The Target Search & Filter card with the Type list open, showing Select All,
Select None, and the ticked types.
:::

## Reading the Results

The line above the list says how many targets matched, for example
"Showing 15 of 412 unique results". The list loads more as you scroll.

Each row shows the target's designation, its type, its common name if it has
one, and its constellation. Three small badges sit next to the name:

| Badge | Meaning |
|:-----|:----------------------|
| Pin | Filled when the target is pinned. |
| Box | Ticked when the target is on your To Do List. |
| Circle | Empty: no Imaging Log project. Half filled: a project in progress. Filled: a completed project. |

A dimmed badge means it doesn't apply. The badges check every designation a
target has, so M 42 shows the same badges as NGC 1976.

::: note
Many objects are in more than one catalog: M 42 is also NGC 1976, and the
Cave Nebula is both Sh 2-155 and C 9. When the database links two entries
like this, filter results show the object once, under the first catalog in
this order: Messier, NGC, IC, Sharpless,
Caldwell, Barnard, Arp, Abell. A name search shows every match, so you can
find an object under whichever name you know.
:::

Filter results come in a random order, and the order changes each time the
filters change. That's deliberate: with hundreds of results, a fixed order
would always put the same targets at the top. Search results are in order of
how well they match.

## Target Details

Click a result and two things happen: the target becomes the Current Target
(see [Introduction](introduction.md)), and its **Target Details** window
opens. It's the same window you get by clicking a target anywhere else in
Astryx.

The window's header has two buttons:

- **Pin** adds the target to your Pinned Targets in the sidebar. Pin the
  targets you want to image next; the Sequence Planner plans the night
  around them. Once it's pinned, the button reads **Unpin**.
- **Add to To Do List** adds it to your To Do List, the longer list of
  targets you'd like to image someday. Once it's there, the button reads
  **Remove from To Do List**.

Below the header are four sections:

| Section | What it shows |
|:------|:------------------------|
| Designation | Name, Type, Common Name, Other Info (other designations), Catalog, and Constellation. The name, type, and common names link to Wikipedia. |
| Visual Information | Max Size and Min Size in arcminutes, Magnitude, and Surface Brightness. A dash means the database has no value. |
| Coordinates | Right Ascension and Declination (J2000). |
| Observability from *your location* | Criteria, Peak Altitude, Best Month, the months it's Observable, and when these were Calculated. |

The **Best Month** is when the target is best placed for imaging from your
location: high in the sky around midnight, with plenty of dark hours.
**Observable** is the run of months it's well placed at all, the same months
the Visibility filter uses. If a target never gets high enough, the section
says "Not observable with current criteria".

Close the window with **Close** or the Esc key. The results list is still
underneath.

::: {.shot id="target-selection-detail"}
The Target Details window for M 31, showing the Pin and Add to To Do List
buttons and the Observability section.
:::

## Doing Something With the Results

The two buttons in the Results card's header act on every target in the
list, not only the ones you can see:

- **Send to Optimizer** hands the list to the [Target
  Optimizer](target-optimizer.md), which picks
  the best of them for a given night. Open **Target Optimizer** and choose
  **Filter Targets** as its source. [Your First Night](first-night.md)
  walks through this.
- **Create Imaging Program** saves the list as a program in the [Imaging
  Log](imaging-log.md),
  for working through a set of targets over many nights. For example, to
  image every Messier object, click **Reset**, tick only Messier in
  **Catalog**, and clear **Min Size (′)** and **Limiting Mag**. Then click
  **Create Imaging Program** and name it "Messier Catalog". Click
  **Create**; Astryx opens the Imaging Log's Programs tab. A program
  can hold up to 199 targets, so narrow the filters first if the list is
  longer.

## Tips

::: tip
Pinned Targets are for tonight; the To Do List is for someday. Add anything
that catches your eye to the To Do List as you browse, and pin only what
you'll image next. When you sit down to plan, the To Do List gives the
Target Optimizer a ready-made list to choose from.
:::

::: tip
To see what's in season, set **Visibility** to the current month, tick the
types you image, and click a few results. The Peak Altitude and Best Month
in each target's details tell you whether this month is the start, the middle,
or the end of the target's season.
:::

## Related

- [Your First Night](first-night.md): from a filtered list to a plan for
  tonight.
- [To Do List](todo-list.md): your shortlist, and what on it you can image
  tonight.
- [Target Optimizer](target-optimizer.md): ranking a filtered list for a
  night.
- [Getting Started](getting-started.md): the Settings that set the
  starting size and magnitude limits.
- [The Target Database](appendix-target-database.md): where the targets come
  from, and what the database holds.
- [Best Month Calculation](appendix-best-months.md): how the Best Month and the
  Observable months are worked out.
