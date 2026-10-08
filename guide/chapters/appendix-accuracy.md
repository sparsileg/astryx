# Accuracy

This appendix lists the approximations behind Astryx's calculations and
how much they matter. In short: every time and position Astryx shows is
far more precise than planning a night needs.

## How Astryx Is Checked

Astryx's astronomy is tested against outside sources every time it
changes:

- every astronomical dusk and dawn of 2026 at several test sites, against
  the U.S. Naval Observatory's tables,
- every new, first quarter, full, and last quarter Moon of 2026, against
  the same,
- a set of positions and times checked against other published values, and
- checks that views showing the same quantity, such as the Moon's
  illumination or dusk, agree with each other.

## The Approximations

| What | How it's done | How close |
|:----------------------|:----------------------------------------------|:------------------------------|
| Target positions | The database's J2000 coordinates, used as they are, with no correction for precession or proper motion. | By 2026, up to about 0.4° from today's position: a minute or two in rise, set, and transit times, and a fraction of a degree in altitude. |
| The Sun | The Astronomical Almanac's low-precision formula. | About 0.01°; dusk and dawn to within a few seconds. |
| The Moon | A shortened version of the standard lunar theory. | About 0.3°; moonrise and moonset within a minute or two. Illumination to about 1%. |
| Moon phase names | Taken from the illumination. | Within about a day of the exact quarter. |
| Sidereal time | The standard J2000 formula. | Under 0.1 seconds for decades either side of 2000. |
| Altitudes | No allowance for atmospheric refraction, except at the horizon for sunrise, sunset, moonrise, and moonset. | Refraction lifts objects by less than 0.1° above 30°, where you image. |
| Rise and set times | Searched minute by minute. | Within one minute. |
| Sky brightness | A model for comparing times and nights. | A ranking, not a measured sky brightness. |

## Time Zones

Each location uses its own time zone and daylight saving rules. Daylight
saving is always taken as a one-hour shift; Lord Howe Island's half-hour
shift is not modeled. Which side of a daylight saving change a night falls
on is decided at local noon.

## The Viewfinder's Coordinates

The center coordinates in the Viewfinder are J2000, like the target
database. Most capture and plate-solving software accepts J2000.
