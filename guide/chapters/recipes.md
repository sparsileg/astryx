# Recipes

::: {.note title="At a glance"}
Each recipe here is a common job, done from start to finish across several
views. The chapters for each view have the details.
:::

## Image Two Targets in One Night

Use the whole night by imaging one target while it's high in the evening,
then switching to a second as the first sinks.

1. Add a handful of candidates to your **To Do List** (see [To Do
   List](todo-list.md)).
2. Open **To Do List** and set **Sort by:** to **Rise Time (Tonight)**,
   with the chart showing. The chart's left edge is dusk and its right edge
   is dawn.
3. Choose the evening target: a bar that starts at the left edge and ends
   around the middle of the night. A target that crosses the meridian
   around dusk looks like this; it's at its highest as the night begins.
4. Choose the late target: a bar that starts before the first one ends and
   runs to the right edge.
5. Pin both: click each one in the To Do List and click **Pin** in its
   Target Details.
6. Open **Sequence Planner**. It images the evening target first, because
   it sets first, and hands over to the late target before the first sinks
   below your minimum altitude.
7. Check the **Timeline**. If the handover leaves one target with much
   less time than you want, move the slider in **Target Allocation**.

::: tip
An evening target that has already crossed the meridian at dusk never
needs a meridian flip. If the late target's turn starts after it crosses
the meridian too, the whole night runs without a flip.
:::

::: tip
To let Astryx find the pair, run the Target Optimizer on your To Do List
and click **Best Combinations**. Under **Pairs**, a pair whose windows
follow each other across the night, with a high **Coverage**, is what
you're after. **Replace Pinned Targets** pins it.
:::

## Image a Target Over Several Nights

Most targets need more integration than one night gives. To spread a
target over several nights:

1. Open **Yearly Observability** for the target to see its season: the
   months where the line is high and the background dark.
2. In the **Imaging Log**, click **+ New Project** to create a project.
   Set its **Status** to **Acquiring Data** when you start.
3. Before each night, check it in **Daily Visibility**, and step through
   the nights with ▶ to find the next clear, dark one.
4. After each night, add a session with **+ Add Session**, and fill in
   **Used** once you've checked the subs.
5. Watch the integration by filter on the project card. When you have
   enough, set the status to **Acquisition Complete**.

## Image a Whole Catalog

To work through the Messier catalog, or any numbered list:

1. In **Target Selection**, click **Reset**, tick only **Messier** in
   **Catalog**, and clear **Min Size (′)** and **Limiting Mag**.
2. In the Results card, click **Create Imaging Program**, name it, and click
   **Create**. Or, in the Imaging Log's **Programs** tab, click **New
   Program** and use **Catalog Pattern** with **M** and **110**.
3. Each month, set **Visibility** to the month, with **Catalog** still on
   Messier, to see which ones are in season.
4. Image each one as a project, and set it to **Completed** when it's done.
   The program's progress and the **Program Progress** report count it.

## Make the Most of a Moonlit Night

A bright Moon doesn't have to mean a night off:

1. Open **Target Optimizer**.
2. Under **Source**, choose **To Do List**, and click **Find Targets**.
3. Look at each card's **Moon** score. A high score means the Moon is down,
   faint, or far away during the target's window.
4. Prefer emission nebulae, especially with narrowband filters, and
   globular clusters. Save galaxies and reflection nebulae for dark nights.
5. In **Daily Visibility**, check your choice: the **Target-Moon
   Separation** card, and whether the background is dark while the white
   line is up.

## Plan a Short Night or a Late Start

If you can't start until late, or must stop early:

1. In **Target Optimizer**, set **Start** to **Custom** and type the time
   you'll be ready. Targets that set before then drop down the list.
2. In **Sequence Planner**, set **Start** to **Custom** with the same time.
3. If you must stop before dawn, choose targets whose windows end by then;
   the Sequence Planner always plans until the last target sets or dawn.

## Tune the Sequence Planner to Your Rig

The Sequence Planner's exposure counts are only as good as its session
settings. To match them to your rig:

1. After a night, open **Log Analysis** and load its logs (see [Log
   Analysis](log-analysis.md)).
2. In the Combined Report's **Recommendations**, read the **Sequence
   Planning** table: **AF Duration**, **Guide Calibration Duration**, and
   **Flip Duration**.
3. In the Sequence Planner's **Session Settings**, set the same values.
4. If **Meridian Flip Verification** in **Data Quality** shows a large
   **Delta**, set **Flip Pause** and **Flip Offset** to match your ASIAir.

Do this after your first few nights, and again whenever you change your
equipment. The sub gap and dither time take care of themselves.

## Move to a New Computer

1. On the old computer, open the system menu (≡), click **Backup**, and
   save a **User Data** backup and a **Targets** backup.
2. Copy both files to the new computer.
3. Install Astryx there, or open the web version.
4. Click **Restore** and restore the targets backup, then the user data
   backup.

See [Backup and Restore](backup-restore.md) for details.
