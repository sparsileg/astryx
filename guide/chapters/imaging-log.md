# Imaging Log

::: {.note title="At a glance"}
The **Imaging Log** records what you've imaged. A **project** is one image
you're working toward, such as a single target or a mosaic, and each night
you spend on it is a **session**. **Programs** track a list of targets you
want to work through, such as the Messier catalog. **Reports** and
**Activity** show your progress.
:::

## What You'll See

Open **Imaging Log** in the sidebar. It has four tabs:

| Tab | What it holds |
|:-----------|:------------------------------------------------------------|
| Projects | Your projects, each with its sessions. |
| Programs | Lists of targets to work through, with your progress on each. |
| Reports | Summaries: which catalogs you've covered, progress on each program, and your projects by status. |
| Activity | A calendar of the nights you imaged. |

::: {.shot id="imaging-log-projects"}
The Projects tab with three project cards, one of them opened to show its
sessions table.
:::

## Projects

### Creating a Project

1. On the **Projects** tab, click **+ New Project**.
2. Type a **Project Name**, for example "Horsehead Nebula Region".
3. Under **Targets**, type part of a designation or common name, and click
   the target in the list. Add as many as the image covers; a mosaic or a
   field with several objects can have more than one.
4. Leave **Status** at **Planning**, or choose where the project stands.
5. Click **Save Project**.

A target's other designations appear next to it, for example "(also: NGC
1976)". **Remove** takes a target out of the project.

The project form also has:

- **Published Image Link**: a web address for the finished image, for
  example on AstroBin. It must start with http:// or https://.
- **Notes**: anything you want to remember about the project. Click
  **Expand** for a larger box.

### The Project Card

Each project is a card. Its lines show:

- the name, with a link to the published image if you added one,
- **Targets** and **Sessions**: how many of each,
- the integration so far, by filter, for example "L: 6.5h  Ha: 3.0h",
- the **Status**, and the date the project was last changed (**Modified**).

**Edit Project** opens the project form again. **Delete Project** deletes
the project and all its sessions, after asking.

Click the card to open its **Imaging Sessions**: a table of the sessions,
oldest first, with each one's **Date**, **Filter**, **Exposures**,
**Integration**, and **Location**. Click the card again to close it.

### Status

A project moves through five steps:

| Status | Meaning |
|:----------------------|:------------------------------------------------|
| Planning | You haven't started imaging. |
| Acquiring Data | You're collecting exposures. |
| Acquisition Complete | You have all the data you want. |
| Processing | You're working on the image. |
| Completed | The image is finished. |

Only **Completed** projects count as imaged in Programs and Reports.

### Finding a Project

- **Search** finds projects by name or by target designation. It searches
  all projects, whatever the Status filter says.
- **Status** shows projects at one status. It starts at **All But
  Completed**, so finished projects are out of the way; choose **All
  Statuses** to see everything.
- **Sort By** orders the list by **Last Modified** (newest or oldest),
  **Name** (A-Z or Z-A), or **Status**.

## Sessions

### Adding a Session

1. Click a project to open it, then click **+ Add Session**.
2. Fill in the **Equipment** section: **Date**, **Location**, **Telescope**,
   **Sensor**, and **Filter**, and if you like, the camera's settings.
3. Click **Calculate Moon Data** to fill in the Moon.
4. Set the night's **Clouds**, **Smoke**, **Seeing**, and
   **Transparency**.
5. Under **Acquisition**, enter the **Sub Length (seconds)** and **Original
   Exposures**.
6. Click **Save Session**.

A new session copies the location, telescope, sensor, filter, and sub
length from the project's most recent session, so a second night on the
same target takes only a few changes.

To change a session later, click its row in the project's table. To
delete it, click **Delete** in its row.

::: note
A session needs a **Date**, a **Location**, a **Telescope**, a **Sensor**, a
**Filter**, a **Sub Length**, and at least one **Original Exposure** before
it can be saved, and its date can't be in the future. If
you record the session before you start imaging, enter the number of
exposures you plan, for example from the Sequence Planner, and correct it
in the morning.
:::

### The Session Fields

| Section | Fields |
|:---------------------|:------------------------------------------------------|
| Equipment | **Date**, **Location**, **Telescope**, **Sensor**, **Filter**, plus **Rotation (°)** (the camera angle your plate solver reported), **Temp Setpoint (°C)**, **Bin**, **Gain**, and **Offset**. |
| Moon & Conditions | **Moon Set**, **Moon Rise**, **Illumination (%)**, **Angle from Moon (°)**, and the four condition lists. |
| Acquisition | **Sub Length (seconds)**, **Original Exposures**, **Used**, and **Integration Time**, which Astryx works out. |
| Notes | Anything about the night. Notes are kept as plain text; if you write them in Markdown, they render when you paste them into a Markdown document. |

The equipment lists hold what you saved in Admin Tools (see [Getting
Started](getting-started.md)). The condition lists start at **Unknown**:

| List | Choices |
|:-------------|:------------------------------------------------------|
| Clouds | None, Intermittent, Hazy |
| Smoke | None, Light, Moderate |
| Seeing | Poor, Below Average, Average, Good, Excellent |
| Transparency | Poor, Below Average, Average, Good, Excellent |

### The Moon

**Calculate Moon Data** needs the **Date** and **Location**. It uses the
project's first target, and fills in:

- **Moon Rise** and **Moon Set**, in the location's local time, between
  noon on the date and noon the next day,
- **Illumination (%)**, the Moon's illuminated fraction over the night, and
- **Angle from Moon (°)**, the closest the Moon comes to the target while
  the target is above your Min Altitude.

### Exposures and Integration

**Original Exposures** is how many exposures you took. **Used** is how many
you kept after throwing out the bad ones: trailed stars, clouds, satellite
trails you couldn't remove. It can't be more than Original Exposures.

**Integration Time** is Used times Sub Length, for example "115 × 300s =
9.6h". Only **Used** exposures count: the project card, the sessions table,
and the integration by filter all show 0 for a session until you fill in
Used.

::: why
Integration time, the total exposure you stack, is what decides how deep
and smooth an image gets. Doubling it improves the signal-to-noise ratio by
about 40%. The log adds it up for each filter, so you can see which filter
needs another night.
:::

## Programs

A program is a list of targets you want to image over months or years. Its
progress counts the targets that are in a **Completed** project, under any
of their designations: a Completed project on NGC 1976 counts toward M 42
in a Messier program.

### Creating a Program

Click **New Program**, type a **Program Name**, and choose a **Program
Type**:

- **Catalog Pattern** covers a numbered catalog: choose a **Catalog
  Prefix** and type the **Maximum Number**. For example, M and 110 make the
  Messier catalog. Targets that don't exist in the database still count
  toward the total.
- **Manual List** takes a **Target List**, one designation per line. Astryx
  matches each line against the database, including other designations,
  and shows which lines **Matched** and which **Failed**. **Copy Missing
  Targets as CSV** copies the failed lines so you can fix them.

Click **Save Program**. To make a program from a filter in Target
Selection instead, use **Create Imaging Program** (see [Finding
Targets](target-selection.md)).

### The Program Card

Each program shows its **Targets**, how many are **Imaged** and what
percentage that is, how many are **Remaining**, a status (**Not Started**,
**Started**, or **Complete**), and a progress bar. **Edit Program** and
**Delete Program** change or remove it.

::: note
Adding a target to a project warns you if its number is above a Catalog
Pattern program's Maximum Number, for example NGC 7841 in a program that
stops at 7840.
:::

## Reports

The **Reports** tab has three cards:

| Report | What it shows |
|:-------------------|:--------------------------------------------------------|
| Catalog Coverage | For each catalog, how many targets you've imaged, counting each target's other designations too. |
| Program Progress | Each program's progress, with **Targets Completed** (click a project's name to go to it) and, for a Manual List, **Targets yet to be imaged**. |
| Project Status | For each status, how many projects, targets, and sessions. |

Catalog Coverage and Program Progress count only **Completed** projects.

## Activity

The **Activity** tab is a calendar of one year, a square for each day,
like the contribution calendar on GitHub. A day you imaged is colored; the
brighter the color, the more integration you collected that night, compared
with your other nights that year. Like the rest of the Imaging Log, it counts
only **Used** exposures. A dot marks a night with a session where you kept
none of the subs, so the night still shows even when nothing was used. Hold
the pointer over a day to see each session's used and taken subs. Drag the slider above the calendar to choose the year.

::: {.shot id="imaging-log-activity"}
The Activity tab for a year with several dozen imaging nights.
:::

## Tips

::: tip
Create a project when you start planning a target, not after the first
night. Its Planning status reminds you it's in the queue, and the first
session copies nothing until there is one.
:::

::: tip
Set a project to **Completed** when the image is finished. That's what
moves your programs and Catalog Coverage forward.
:::

## Related

- [Your First Night](first-night.md): recording a night as part of the
  routine.
- [Finding Targets](target-selection.md): making a program from a filter.
- [Getting Started](getting-started.md): locations, telescopes, sensors, and
  filters.
