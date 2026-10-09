# Utilities

::: {.note title="At a glance"}
**Utilities** collects quick links and small tools: weather forecasts and a
light pollution map for each of your locations, and a calculator that
estimates how far a dust speck is from your sensor.
:::

## What You'll See

Open **Utilities** in the sidebar. It has three cards: **Weather
Forecasts**, **Light Pollution**, and **Dust Mote Distance Estimator**.
Hold the pointer over a card's **?** for a reminder of what it does.

The two link cards list every location you've saved. With none saved, they
say "No locations configured. Add locations in Admin Tools → Manage
Locations." The links open in your web browser and need an internet
connection.

## Weather Forecasts

Each location has three links, each opened at the location's coordinates:

| Link | What it opens |
|:---------------|:--------------------------------------------------------|
| Astrospheric | An astronomy forecast with cloud cover, transparency, and seeing, hour by hour. |
| Clear Outside | A forecast of low, medium, and high cloud, with the Moon and darkness. |
| Clouds | A live satellite map of the clouds around the location, from Zoom Earth. |

::: tip
Daily Visibility already shows cloud, wind, and dew for the next few days.
Use these sites for a second opinion, and for seeing and transparency,
which Daily Visibility doesn't forecast.
:::

## Light Pollution

Each location's name links to the Light Pollution Map, zoomed in on the
location. Use it to see how dark your site is, or to find a darker one
within driving distance.

## Dust Mote Distance Estimator

Dust on a filter or sensor window shows in your flats and lights as a soft
disc, or a ring (a "dust donut") on a telescope with a central obstruction.
The farther the speck is from the sensor, the larger the spot. Knowing the distance tells you which surface to clean.

1. In **Dust Mote Distance Estimator**, choose your **Telescope** and
   **Sensor**. Astryx fills in **Focal Ratio
   (f/)**, including the telescope's reducer or Barlow, and **Pixel Size
   (µm)**; you can also type them.
2. Measure the spot's diameter in pixels in your imaging software, and type
   it in **Spot Diameter (px)**. The edge is soft: measure across the spot
   where the edge has faded halfway.

The result is the estimated **Distance from Sensor (mm)**: the spot's
diameter in millimeters times the focal ratio. The line below it gives the
spot's diameter in millimeters and the focal ratio used. If you imaged with
binning, enter the binned pixel size, or measure on an unbinned frame.

The distance is approximate. Glass makes things look closer than they are,
so dust seen through a filter or window is a little farther away than the
estimate.

Compare the distance with your imaging train: a few millimeters usually
means the sensor window, and farther away a filter or the rear lens of the
flattener or reducer. Dust further up the train is too far out of focus to
show as a spot.

## Related

- [Getting Started](getting-started.md): adding locations, telescopes, and
  sensors.
- [Daily Visibility](daily-visibility.md): the forecast built into Astryx.
- [Log Analysis](log-analysis.md): analyzing a night's logs.
