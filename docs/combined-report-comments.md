# Iteration #1

FYI - the logs I used were from 2025-11-17, a two-target night.

Let's start with comparing the original Session Detail and the new
Combined Report and come up with a synthesis.

One of the primary purposes of the Session Timeline is to be able to
compare it easily with the Sequence Plan. In the new Session Timeline,
we don't need to include the Plate Solve, Dither, and mount start/top
 events. Perhaps some might find them useful so I don't want to remove
them from the code. Maybe we can hide them behind a feature flag for
now and revisit later. Perhaps there's a way that we can toggle them
on or off from within the HTML report itself and the setting would
carry over into the PDF report.

I prefer the formatting of the original report with some shuffling of
the columns. How about if the new session timeline has the following
columns:

Time (always start and end times)
Event
Duration (accurate to one decimal like the original report)
Target
Guide Quality (for Imaging events only)

Like this:

23:02-23:04 Autofocus 2.2m NGC 281 0.78"(or blank)

I really like the Summary of event types immediately following the
timeline in the original report with total time and % of session
columns, including the last line that indicates how many minutes passed
vs how many minutes were tracked. Let's make sure we put that in the
combined report. The current format is perfect.

I like the Verdict section of the new combined report, so let's keep
that.

In the combined report, there was a Guide Failure (selectFailed)
event. Those will be infrequent but good to know about so let's keep
those in there. However, there closeare about a hundred events spread
over about 26 minutes and they are all exactly the same. If we have
duplicate events like that in sequence, let's collapse them into a
single event with a start/end time.

The new per-sub Frame Quality is really informative. I like it a
lot. But it's quite side and I want to try and get everything to fit
onto a 8.5x11" piece of paper in portrait mode. Let's tweak it a bit.

Since we have the target in the header already, let's drop that as a
column. I presume that a separate table will be created if the exposure time
changes, and each table will always be the same exposure, so we can
put that in the header info: NGC 281 (50 subs, 300s), or something
like that. And then remove the exposure column.  Let's delete the
Dropped column and move the Dropped column value to the Tier column,
so that if it is dropped, we put 'Dropped' in that
column. The temp might be useful so let's keep that for now. Let's
drop the AF Star Size column. We can always join with the Focus and
Environment values if we want to know the star size at the sub level.

I like the new Guiding Analysis section. We might want to explain some
of the values a little more, but for now it's fine. I like the
Calibrations section. I like the Focus and Environment section.

I see you put the Time Accounting table further down in the
report. That is the same as the Summary I mentioned just after the
timeline. Let's just move this section up to just below the timeline
like it was in the original report.

It seems like we don't have any information from the Phd2 original
report. In that report, I like the equipment table and the overall
statistics table as well. The Sessions table from the original PHD2
report should be in the combined report somewhere. I think the
Anomalies & Events list is helpful, as long as the reporting is
evidence-based. We can lose the Session by session list because the
information is already contained in the Sessions table.

I know you haven't done the Recommendations code yet. I recommend that
section be placed at the top of the combined report, along with a
narrative analysis - kind of like an executive summary.

You indicated that we can't generate a report with just the PHD2
log. It has lots of useful information. At the very least, we could
generate the current report if the ASIAir session log is not
available. Thoughts on that?

---

# Iteration #2


In the Session Timeline, instead of a separate column for Target,
insert a single "event" that indicates the target. Don't put a time on
that line, but the event will simply be "Target NGC 281", for
example. And then delete the Target column.

What does the Guide Session #: lock position... mean? And how come
they start at around 23:04 and end at about 01:21?. Put under the
"Show all events" checkbox trigger.

I wonder how we can delete the Settled@Start column in the Per-Sub
Frame Quality table? We don't need to report Yes, but how do we report
a No?

---

# Iteration #3

In the Guiding Analysis section, replace "Camera" with "Guide Camera".

Put the imaging telescope/sensor info, inferred from the Astryx
equipment database, at the top of the Verdict section.

In the recommendations, mention specific frames that should be
carefully examined for defects.

Order

- Verdict
- Session Timeline
- Summary
- Per-Sub Frame Quality
- Findings (Session vs Guide session?) - move to under Calibrations?
- Guiding Analysis
    Guide Sessions
    Calibrations
- Focus and Environment
- Astryx Recommended Session Settings (put after Verdict)
- Data Quality

Wait to do the PDF version until after the recommendations are added.
