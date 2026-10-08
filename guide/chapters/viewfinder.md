# Viewfinder

::: {.note title="At a glance"}
The **Viewfinder** shows how the Current Target fits your telescope and
camera, over a real image of the sky. Turn the camera, move it to a better
center, and note the angle and coordinates to use at the telescope.
:::

## What You'll See

Open **Viewfinder** in the sidebar. It shows the Current Target (see
[Introduction](introduction.md)). The view has three rows.

At the top:

- **Current Target**: the target's designation, with its common name in
  parentheses (**Object**), and its **Size** in arcminutes. A name too long
  for the card ends in "…"; point at it to see all of it.
- **Equipment**: the **Telescope:** and **Sensor:** lists.

In the middle is the **Field of View** card. On its left are the
**Actual** / **Wider** switch; four checkboxes: **DSS image**, **Target
size**, **Full moon**, and **Crosshair**; the **Rotate camera to:**
control; the coordinates of the frame's center; and the **Snapshot**
button. The rest of the card is the image of the sky with your frame on
it.

At the bottom is the results card: the numbers for your telescope and
sensor together.

::: {.shot id="viewfinder-overview"}
The Viewfinder for M 31 with a telescope and sensor chosen and DSS image
ticked: Current Target and Equipment at the top, the Field of View card
with its controls beside the sky image, and the results below.
:::

## Choosing Your Equipment

Choose a telescope from **Telescope:** and a camera from **Sensor:**. The
lists hold the equipment you saved in Admin Tools (see [Getting
Started](getting-started.md)). Astryx remembers your choice, so the next
time you open the Viewfinder it's already set.

Until both are chosen, the results card says "Select telescope and sensor
to calculate field of view."

## The Results

| Line | What it means |
|:----------------------|:------------------------------------------|
| Effective Focal Length | The telescope's focal length times its reducer or Barlow multiplier, in mm. |
| Field of View | How much sky the sensor covers, width × height, in degrees. |
| Resolution | How much sky each pixel covers, in arcseconds per pixel. |
| Target Size | About how many pixels the target spans on your sensor, from its catalog size. |
| Dawes Limit | The finest detail the telescope's aperture can separate, in arcseconds (116 ÷ aperture in mm). |
| Field Coverage | How much of the field's area the target fills. Shown only when the target's size is known. |

If the target is large for your field, Astryx tells you so: when it spans
more than 70% of the field's shorter side, or fills more than half its
area, a message suggests an effective focal length that would leave more
room around it. The message appears once for each combination of target,
telescope, and sensor.

::: why
Resolution compares your camera with the sky's steadiness. On a typical
night, the stars are blurred to 2 to 4 arcseconds, so 1 to 2 arcseconds per
pixel records all the detail the sky allows. Much finer than that, and you
gain nothing but larger files and fainter pixels. Much coarser, and the
stars start to look square.
:::

## The Sky Image

With **DSS image** ticked, Astryx downloads a color image of the target's
part of the sky from the Digitized Sky Survey (DSS2), through the CDS
image service in Strasbourg, and shows it in your frame. The frame has your
sensor's shape, long side across, and fills the width of the card. N marks
north: at the top until you turn the camera.

Images are kept on your computer for a while, so a target you've looked at
recently appears at once and works offline. An image you don't use again
within about two weeks is deleted, and a Wider image within two days; the
next time you need it, Astryx downloads it again. Fetching a new one needs an internet
connection; if it fails, Astryx says "Could not load DSS background image —
check your internet connection."

Without the image, the canvas is black and shows only the frame and the
**Target size**, **Full moon**, and **Crosshair** overlays. **Wider** needs
the image.

### The Overlays

| Checkbox | What it draws |
|:---------------|:--------------------------------------------|
| Target size | A yellow dashed ellipse the target's catalog size. It's always drawn tilted at 45°; only its size is meaningful, not its angle. |
| Full moon | A circle the size of the full Moon (31′), for a sense of scale. The note "Full moon outlined displayed" appears at the bottom of the image. |
| Crosshair | A small cross at the center of the frame. |

The view starts with **DSS image** ticked and the other three unticked.

## Rotating the Camera

**Rotate camera to:** turns the camera the way you'd turn it on the
focuser. In Actual, the frame stays put and the sky turns inside it, as it
would on the camera's screen; the N marker moves with the sky. Type an
angle in degrees, or click ↺ and ↻ to turn the camera one degree at a time;
hold a button down to keep turning. ↻ turns the camera clockwise, so the
sky turns counterclockwise.

Use it to fit a long target along the diagonal or the long side of the
sensor, or to keep a bright star out of a corner. The angle starts at 0°
(north up) each time you open the view.

## Moving the Center: Wider

The **Actual** / **Wider** switch at the top of the Field of View controls changes what
the canvas shows:

- **Actual** shows your field, centered on the target, or on the center you
  chose in Wider.
- **Wider** shows a sky image three times as wide, centered on the same
  center as Actual, with your field as a dashed frame you can drag. The pointer becomes a hand over the frame.
  The **Center:** coordinates beside the image follow the frame as you drag.

To move the center:

1. Click **Wider**.
2. Drag the frame to where you want it, and rotate it if you like.
3. Click **Actual**. Astryx fetches a new image centered where you left the
   frame.

To keep going, click **Wider** again: Astryx fetches a new wider image
around the new center, and you can drag on from there. Step by step, you
can walk the frame as far across the sky as you like.

Once you've moved the frame, its center is no longer the target, so the
Current Target card goes blank, **Target size** is turned off and can't be
ticked, and the results card drops **Target Size** and **Field Coverage**.
The **Center:** coordinates always show the center of what you're looking
at. Choose a target again (from the Pinned Targets, for example) to start
over from it; leaving the Viewfinder starts over too.

**Target size** and **Full moon** are turned off in Wider. **Full moon**
comes back when you return to Actual, and so does **Target size** if you
haven't moved the frame.

::: {.shot id="viewfinder-wider"}
The Viewfinder in Wider mode: the larger sky image, the dashed frame moved
off-center and rotated, and the Center coordinates beside it.
:::

## The Center Coordinates

The **Center:** coordinates beside the image, for example 05h 35m 17.3s
and -05° 23′ 28.0″, are the right ascension and declination of the frame's center. With
the rotation angle, they're everything you need to reproduce the framing at
the telescope: enter it as the target position in your capture software,
and plate solving centers the mount on it.

## Snapshot

**Snapshot** shows the framing on its own, as the camera would record it.
In Actual, it's the whole canvas. In Wider, it's just what's inside the
frame, turned upright. Click **Close**, or click outside the image, to put it away.

## Tips

::: tip
Check a target in the Viewfinder before you add it to your plan. If it
overflows the frame, or is a speck in the middle, another telescope may
suit it better, or it may need a mosaic.
:::

::: tip
A target listed with no size in the database shows "Unknown" in the
Current Target card. The sky image still shows it as it is; use that to
judge the fit.
:::

## Related

- [Getting Started](getting-started.md): adding telescopes and sensors.
- [Your First Night](first-night.md): framing a target as part of planning
  a night.
- [Finding Targets](target-selection.md): choosing the Current Target.
