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
ring, a "dust donut". The farther the speck is from the sensor, the larger
the ring. Knowing the distance tells you which surface to clean.

1. In **Dust Mote Distance Estimator**, choose your **Telescope** and
   **Sensor**. Astryx fills in **Focal Ratio
   (f/)** and **Pixel Size (µm)**; you can also type them.
2. Measure the ring's diameter in pixels in your imaging software, and type
   it in **Spot Diameter (px)**.

The table shows the estimated **Distance from Sensor (mm)** for two sizes
of dust, 0.5 mm and 1.5 mm. The line below it gives the ring's diameter in
millimeters and the focal ratio used.

Compare the distance with your imaging train: a few millimeters usually
means the sensor window, and farther away a filter or the flattener.

## Related

- [Getting Started](getting-started.md): adding locations, telescopes, and
  sensors.
- [Daily Visibility](daily-visibility.md): the forecast built into Astryx.
- [Log Analysis](log-analysis.md): analyzing a night's logs.
