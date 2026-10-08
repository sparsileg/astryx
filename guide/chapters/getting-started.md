# Getting Started

::: {.note title="At a glance"}
Astryx needs two things from you: where you observe from, and what you image
with. Add a location and your equipment, and every view is ready to use.
**Start Tutorial** in the system menu (≡) walks you through both in about
ten minutes.
:::

## Add Your Location

Almost everything Astryx calculates, including dusk and dawn, rise and set
times, and how high a target climbs, depends on where you are. Add each place
you image from: your backyard, a dark site, a star party field.

1. Open the system menu (≡) and choose **Admin Tools**, then **Manage
   Observer Locations**.
2. Fill in the **Add New Location** form (the fields are described below).
3. Click **Save Location**.
4. Choose the new location from the location list at the top of the sidebar.

The first time you choose a location, Astryx works out the best month to
image each target from there. A progress message shows how far it has got.
This happens once per location, so a site you add later gets the same
treatment the first time you choose it.

::: {.shot id="manage-locations"}
The Manage Locations dialog with a location filled in, showing the Existing
Locations list below.
:::

### The location fields

| Field | What to enter |
|:-----|:---------------|
| Location Name | Any name you'll recognize, such as "Backyard" or "Cherry Springs". |
| Time Zone | The location's time zone by name, such as America/New_York or Europe/Madrid. It starts out as your computer's zone; start typing to pick another from the list. |
| Bortle Scale | How light-polluted the sky is, from 1 (excellent dark sky) to 9 (inner city). It's kept with the location for your reference. |
| Latitude | Decimal degrees, positive north of the equator and negative south. |
| Longitude | Decimal degrees, positive east of Greenwich and negative west. Anywhere in the Americas is negative. |
| Elevation | Meters above sea level. |
| Horizon Profile | Optional. The height of the trees, buildings, and hills around you. See below. |

::: why
Astryx uses the time zone's own daylight saving rules, not your computer's.
A location in Arizona never shifts its clocks, even if your laptop is set to
Denver time, and a location in Europe changes its clocks on the European
dates. Pick the zone by name and daylight saving takes care of itself.
:::

::: tip
To find your latitude and longitude, right-click your observing spot in
Google Maps: the first item in the menu is the coordinates, in decimal
degrees, ready to copy. If you're not sure of your Bortle class, the light
pollution map in [Utilities](utilities.md) shows it.
:::

### Horizon profile

A horizon profile tells Astryx where your view of the sky is blocked. Without
one, Astryx assumes a flat horizon all the way around, and a target counts as
up as soon as it clears your minimum altitude.

Enter the profile as one point per line: the azimuth (the compass direction,
0 for north, 90 for east, 180 for south, 270 for west) and the height of the
obstruction in that direction, in degrees, separated by a space. You need at
least four points. Astryx draws a straight line between neighboring points,
so add more points where the skyline changes quickly.

```
0 12
45 25
90 18
135 8
180 5
225 10
270 30
315 22
```

This is the same format as a Stellarium `horizon.txt` file, so if you've
already made a Stellarium landscape for your site, you can paste its points
in directly. Leave the box empty for a flat horizon.

A target has to clear both the horizon profile and your minimum altitude.
The horizon is used by Daily Visibility (which can switch it off), the
Sequence Planner (as an option), and the Target Optimizer. Best months and
Yearly Observability use only the minimum altitude.

::: tip
You don't need special equipment to measure a horizon. On an Android
phone, the AngleCam app works well: stand where your telescope sits, point
the camera along the skyline, and it shows the compass direction and height
of whatever is in the crosshairs. Note the height of the skyline every 15° or
so of azimuth. A compass app and an inclinometer app do the same job on any
phone. Ten minutes
of work gives you a profile good enough to stop Astryx from scheduling a
target that's behind your neighbor's oak tree.
:::

### Changing or removing a location

Click **Edit** next to a location in the Existing Locations list to load it
into the form, change what you need, and click **Save Location**. Click
**Delete** to remove it. A location that's recorded in an Imaging Log session
can't be deleted.

## Add Your Equipment

Astryx uses your telescope and camera to show how a target fits your field of
view. Open the system menu (≡) and choose **Admin Tools**, then **Manage
Equipment**. The dialog has three tabs.

::: {.shot id="manage-equipment-telescopes"}
The Manage Equipment dialog, Telescopes tab, with one saved telescope.
:::

### Telescopes

| Field | What to enter |
|:-----|:---------------|
| Telescope Name | A name you'll recognize. |
| Focal Length | The telescope's native focal length, in millimeters. |
| Aperture | In millimeters. |
| Reducer/Barlow Multiplier | 1.0 with nothing in the light path. 0.8 for a 0.8× reducer, 2.0 for a 2× Barlow. |

Click **Save Telescope**.

::: tip
If you use the same telescope with and without a reducer, save it twice,
once for each setup: for example "Esprit 100" at 1.0 and "Esprit 100 + 0.79×"
at 0.79. Then you can pick the configuration you'll actually use.
:::

### Sensors

Enter a name, the sensor's resolution in pixels (X across, Y down), and its
pixel size in microns. The camera maker's specification sheet has all four
numbers. Click **Save Sensor**.

### Filters

Filters only need a name, such as L-eXtreme, Ha, or OIII. You select them
when you record a session in the Imaging Log, so add them when you start
using the log.

### Changing or removing equipment

Equipment can't be edited in place. To change a telescope or sensor, save it
again under the same name with the new values, which replaces the old entry.
Click **Delete** to remove an item. Anything recorded in an Imaging Log
session can't be deleted.

::: note
Only the Viewfinder, the dust mote calculator in Utilities, and the Imaging
Log use your equipment. Every other view needs nothing but a location.
:::

## Settings

Everything in Settings has a sensible default, so you can leave it alone
until you have a reason to change it. Open the system menu (≡), choose
**Settings**, make your changes, and click **Save Settings**.

| Setting | Default | What it does |
|:------|:---|:--------------|
| DST Mode | Automatic | Automatic follows each location's time zone. **Always Active** and **Never Active** override it for every location; you shouldn't need them. |
| Min Altitude | 35° | The lowest a target can be and still count as up. It's the starting value in Daily Visibility, Yearly Observability, and the Sequence Planner, and the value the Target Optimizer, To Do List, and Visibility filter use. Changing it means recalculating Best Months; Astryx offers to. |
| Min Target Size | 4.0′ | The starting minimum size, in arcminutes, for the Target Selection filters. |
| Max Magnitude | 14.5 | The starting faintest magnitude for the Target Selection filters. |
| Automatic backups on change | On | Saves a backup a while after you change your data. |
| Minutes before backup | 60 | How long after your last change the automatic backup waits. Each new change restarts the wait. |
| Backup Folder | Downloads | Where automatic backups go. The web version always uses your browser's downloads folder; the desktop app lets you choose. |
| Backup reminder every | 7 days | How long after your last backup Astryx reminds you to make one. |

::: why
The minimum altitude is the single setting that most affects what Astryx
tells you. Near the horizon you're looking through much more air, so stars
are dimmer, blurrier, and more washed out by light pollution. A target that's
technically up at 15° is rarely worth imaging.
:::

::: tip
35° is a good starting point. If your sky is clean and dark to the south, try
30°. If you image from town, where the bottom of the sky glows, 40° or 45°
will keep Astryx from suggesting targets that sit in the murk.
:::

## Pick a Theme

The theme list at the top of the sidebar changes Astryx's colors. **Dark**
is the default. **Night** turns everything red to protect your night vision
at the telescope. **Light** is easier to read indoors, and **Matrix** and
**Flat** are there for anyone who likes them.

## Related

- [Introduction](introduction.md): what each view is for.
- [Backup and Restore](backup-restore.md): keeping your locations, equipment,
  and logs safe.
- [Viewfinder](viewfinder.md): seeing your field of view on a target.
