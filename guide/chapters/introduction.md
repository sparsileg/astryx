# Introduction

*Plan better. Image more. Waste less clear sky.*

Astryx helps you decide what to image, when to image it, and how long to
image it. It searches a database of over 14,000 deep-sky objects, works out
when each one is well placed from your location, builds an imaging plan for
the night, keeps a log of your imaging projects, and analyzes the ASIAir and
PHD2 logs from your sessions.

Everything starts at [astryx.tools](https://astryx.tools). From there you can
open the browser version and start using it right away, with nothing to
install, or go to the **Downloads** page for the desktop app, available for
Windows and for Ubuntu-based Linux systems.

::: {.note title="Quick Start"}
Add your observing location and your equipment, and Astryx is ready to use.
You don't need to read anything else first. [Getting
Started](getting-started.md) has the details.

Open the system menu (≡), choose **Start Tutorial**, and follow along. It
walks you through both steps and takes about ten minutes.
:::

## Getting Help as You Go

Every tutorial is listed under **Tutorials** in the system menu. Each one
walks you through a single view in a few minutes, and when it finishes it
offers to start the next. If you take them in order, you'll have seen
everything Astryx does. If you leave a tutorial partway through, **Resume
Tutorial** in the system menu picks up where you stopped.

Hold the pointer over a control and a tooltip explains what it does.

This guide is for when you want more than a tooltip: what a view is for, how
to read its results, and what to do next. [Recipes](recipes.md) walks through common jobs from
start to finish, and [Something Doesn't Look Right](troubleshooting.md)
explains the most common surprises. The [Glossary](appendix-glossary.md)
defines the terms.

## What Do You Want to Do?

Start from your question and go to the view that answers it.

| I want to… | Go to |
|:---|:---|
| Find targets by name, type, size, or catalog | [Target Selection](target-selection.md) |
| Find targets that are well placed in a given month | [Target Selection](target-selection.md), Visibility filter |
| Keep a shortlist of targets I want to image | [To Do List](todo-list.md) |
| See when during the year a target is well placed | [Yearly Observability](yearly-observability.md) |
| See a target's altitude through one night, with the Moon and weather | [Daily Visibility](daily-visibility.md) |
| See how a target fits my camera's field of view | [Viewfinder](viewfinder.md) |
| Find out what is best to image on a given night | [Target Optimizer](target-optimizer.md) |
| Plan the order and timing of several targets in one night | [Sequence Planner](sequence-planner.md) |
| Keep track of imaging projects and sessions | [Imaging Log](imaging-log.md) |
| Find out what went wrong, or right, in a session | [Log Analysis](log-analysis.md) |
| Check cloud cover and light pollution | [Utilities](utilities.md) |
| Save my data, or move it to another computer | [Backup and Restore](backup-restore.md) |

## Who Astryx Is For

Astryx was built by an imager who uses one-shot-color cameras and an ASIAir,
and it works best for that kind of setup. If you image in mono, or control
your rig with NINA, most of Astryx works just as well for you, but you may
find gaps, particularly in the session details the Imaging Log records and
in Log Analysis, which reads ASIAir and PHD2 logs.

If you'd like Astryx to work better for mono or NINA imaging, please
describe what you need, or what you can contribute, in an issue at
[github.com/sparsileg/astryx/issues](https://github.com/sparsileg/astryx/issues).

## Your Data Stays With You

Whether you use the browser version or the desktop app, everything you enter is stored on your own
computer and nowhere else. No account is needed, and your targets, plans,
and logs are never sent to a server.

That also means nobody else can recover your data if it's lost. Use
**Backup** in the system menu regularly, or turn on automatic backups in
**Settings**.

::: why
In the web version, your data lives in the browser, and a browser can clear
it, for example when you clear its cache. Safari may delete it after a week
without a visit, so use a different browser for Astryx. The desktop app
keeps your data in its own database, which clearing a browser doesn't touch.
Either way, keep backups: a backup is the only copy that survives a failed
disk or a lost laptop.
:::

Astryx works without an internet connection, which makes it useful in the
field. A few things need a connection when you use them: the weather
forecast in Daily Visibility, the sky images in the Viewfinder, and the
cloud and light-pollution websites that Utilities opens, and the Wikipedia
links in a target's details. These send only your location's coordinates,
or the target's position or name. Sky images you've
already viewed are kept for about two weeks, so they still work offline.

## Moving Around

The sidebar on the left lists the views. Above them are the color theme,
the location you're observing from, and the **Current Target** button. Below
them is the list of your **Pinned Targets**.

### The Current Target

Several views work on one target at a time: the Current Target, whose name
is on the button at the top of the sidebar. Daily Visibility, Yearly
Observability, and the Viewfinder all show it, so you pick a target once and
then move between those views. To change the Current Target:

- In Target Selection, click a target in the results list.
- Click a target in the [To Do List](todo-list.md).
- Click a target's name under **Pinned Targets** in the sidebar.
- Click **Daily Visibility** on a Target Optimizer result card.

The first three also open the target's **Target Details** window, with its
designations, size, coordinates, and observability, and the **Pin** and
**Add to To Do List** buttons (see [Finding Targets](target-selection.md)).
Click the **Current Target** button to open it again.

In Daily Visibility, Yearly Observability, and the Viewfinder, clicking a
pinned target doesn't open Target Details; the view switches to it at once.
Click between your Pinned Targets to compare them.

The system menu (≡) at the top of the sidebar holds **Settings**, [Admin
Tools](admin-tools.md) (locations, equipment, and target database
maintenance), [Backup and Restore](backup-restore.md), the tutorials, and
**Help**, which opens this guide.
