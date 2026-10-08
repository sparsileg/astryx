# Your First Night

::: {.note title="At a glance"}
A clear night is coming and you want to make the most of it. This chapter
follows one night from start to finish, through the views you'll use most.
Each step points to the chapter that covers that view in full.
:::

Planning a night with Astryx follows the same path every time:

**Find → Choose → Check → Frame → Plan → Image → Review**

Before you start, make sure your location is chosen in the sidebar (see
[Getting Started](getting-started.md)).

## 1. Find Candidates

Open **Target Selection**. If you already know what you want to image, type
its name in the search bar (M 31, Rosette, NGC 7000) and skip to step 3,
Check the Night.

Otherwise, let the filters find candidates for you:

1. In **Visibility**, choose the current month. Only targets that are well
   placed from your location this month remain.
2. In **Type**, choose the kinds of object you like to image, for example
   emission nebulae and galaxies.
3. Leave **Min Size (′)** and **Limiting Mag** at the values from your
   Settings, or raise the minimum size if your field of view is wide.

The results update as you change each filter; there's no Apply button.

::: {.shot id="first-night-filters"}
Target Selection with Visibility set to the current month and a few types
selected, showing the results list.
:::

::: why
The size filter matters more than it looks. A 2-arcminute galaxy is a
smudge a few dozen pixels across on a short refractor. Setting a minimum
size that suits your field of view removes targets your setup can't do
justice to.
:::

## 2. Choose Tonight's Targets

A filtered list can still hold hundreds of targets. The Target Optimizer
picks the ones that suit *tonight*.

1. In the Results card, click **Send to Optimizer**.
2. Open **Target Optimizer** (see [Target Optimizer](target-optimizer.md)).
   The date starts at today.
3. In the source list, choose **Filter Targets**, which now shows how many
   targets you sent.
4. Click **Find Targets**.

Each result card shows when the target is above your minimum altitude, how
high it climbs, and how far it is from the Moon, with a score for each. The
best-scoring targets are at the top.

To image more than one target tonight, click **Best Combinations**. It
suggests single targets, pairs, and triplets that fill the night between
them. When one looks good, click **Replace Pinned Targets** to pin it.

To image a single target, click **Pin** on its result card.

::: {.shot id="first-night-optimizer"}
Target Optimizer results, showing the top three cards with their scores.
:::

::: tip
Use **Add to To Do List** in a target's details whenever you come across
something you'd like to image someday. Once your To Do List has a few dozen
targets, choose **To Do List** as the Target Optimizer's source
instead of filtering each time.
:::

## 3. Check the Night

Click **Daily Visibility** on a Target Optimizer result card (see [Daily
Visibility](daily-visibility.md)). Or click the
target's name under **Pinned Targets** in the sidebar, which makes it the
Current Target and opens its details. Close them, then click **Daily
Visibility** in the sidebar. The timeline runs from noon to noon:

- The background shows the sky: white for daylight, gray for twilight or
  moonlight, black for full darkness.
- The white line is your target's altitude. The dashed line is your minimum
  altitude, raised where your horizon profile is higher.
- The strips across the top are the cloud, wind, and dew forecast for the
  day.

The white line is drawn only while the target is above the dashed line,
so you can image wherever it shows against a dark background. Below the
timeline, the Moon Details and Target-Moon Separation cards tell you how much the Moon will interfere.

::: {.shot id="first-night-daily-visibility"}
Daily Visibility for a target on a good night: a long dark section, the
target line well above the dashed line, and the forecast strips at the top.
:::

## 4. Frame the Target

Open **Viewfinder** (see [Viewfinder](viewfinder.md)), which shows the
Current Target. Choose your telescope and sensor, and tick **DSS image**.
The frame is your field of view over a real sky survey image. Rotate it to fit the target, or switch to **Wider** and drag the frame
to move the center. The Center coordinates below the image tell you where to
point the mount.

## 5. Plan the Night

Open **Sequence Planner** (see [Sequence Planner](sequence-planner.md)). It builds a plan from your pinned targets as soon
as it opens:

1. In **Session Settings**, check the date, location, and start time.
2. Check the other session settings (autofocus, meridian flip, guide
   calibration, dithering) match how you run your rig. Typically, you will
   only need to do this once. The [Log
   Analysis](log-analysis.md) can help you with the proper
   settings.
3. In **Target Allocation**, set each target's exposure length.

The Timeline shows the night with a band for each target. Below it, the
Target Sequence in the Imaging Plan lists when to start and stop each target
and how many exposures you'll get. Red lines under a target warn of any
stretch where it's below your minimum altitude or behind your horizon.

Click a target's name in the Target Sequence to see its predicted session
events (autofocus runs, guide calibration, imaging, and the meridian flip)
with their start and end times. Click **Download PDF** to keep a copy for the
night.

::: {.shot id="first-night-seqplan"}
Sequence Planner with three pinned targets: the Timeline and the Imaging
Plan.
:::

## 6. Image

Go image. Astryx doesn't control your equipment; the Imaging Plan is your
guide for setting up the sequence in your capture software.

## 7. Review

As soon as you start imaging, record the night's conditions. After the
session, learn from it:

- **Imaging Log.** Create a project for the target (**+ New Project**),
  then click **+ Add Session** and fill in what you know now: the date,
  your equipment, the sky conditions, the sub length, and the number of
  exposures you plan to take. **Calculate Moon Data** fills in the Moon for
  you. After the session, click the session's row in the project to open it
  again, and fill in how many exposures you took (**Original Exposures**)
  and how many you kept (**Used**). Over time the log tracks your total
  integration on each target, by filter (see [Imaging
  Log](imaging-log.md)).
- **Log Analysis.** After the session is complete, load the night's ASIAir
  Autorun log and PHD2 guide log (see [Log Analysis](log-analysis.md)).
  The Combined Report tells you how many subs were clean, what went wrong
  and when, and what to change next time.

::: why
Log Analysis measures how long your camera actually takes between subs and
how long each dither takes to settle. The Sequence Planner uses those
measurements from then on, so its exposure counts match what your rig really
does.
:::

## Related

- [Getting Started](getting-started.md): locations, equipment, and settings.
- [Finding Targets](target-selection.md): searching and filtering.
- [To Do List](todo-list.md): keeping a shortlist of targets.
- [Daily Visibility](daily-visibility.md): reading the night's timeline.
- [Viewfinder](viewfinder.md): framing a target.
- [Target Optimizer](target-optimizer.md): ranking targets for a night.
- [Sequence Planner](sequence-planner.md): how plans are built.
- [Imaging Log](imaging-log.md): projects, sessions, and programs.
- [Log Analysis](log-analysis.md): reading the night's logs.
