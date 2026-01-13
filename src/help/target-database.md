# Target Database

The target database was compiled from two primary sources - the Saguaro
Astronomy Club Deep Sky Database and the OpenNGC database compiled by
Mattia Verga. The OpenNGC database also contains the IC catalogue.

Additional target sources were located in various places and merged into a
single database. As I identify interesting targets that are not in the
database, or I come across additional information (such as a Common Name)
that might be useful for search purposes, I will add that to a special file
that is included when creating a new database. As part of the compilation
into a single database, a program merged duplicate entries in a smart way
such that no data was lost.

Many targets do not have a complete set of data. For example hundreds of
targets have neither a minimum nor maximum angular size. Thus, they will
not be included in the results when the size filter is used.

If a target has a maximum size but not a minumum or a minimum and not a
maximum, whichever size value exists is copied into the other field. Thus,
some objects may seem circular because they have the same value for minimum
and maximum size.

The following statistics are accurate as of 13 January 2026.

## Size statistics

    * Total Targets: 14,593
    * Targets with missing size values: 860
    * Targets with valid size values: 13,733

Note that of the 860 objects without size values, almost 92% are either
single stars or multiple star systems. An additional 13 are asteroids. Here
is the breakdown of those objects without size values

    * Stars: 791
    * Emission nebulae: 33
    * Open cluster: 19
    * Asteroids: 13
    * Dark nebulae: 3
    * Quasar: 1 (APM 08279+5255)
    * Supernova remnant: 1 (NGC 6974)

Smallest target

```
IC 5117 (IC catalog)
Size: 0.02 arcminutes (1.2 arcseconds)
Type: Planetary nebula
```

Largest target

```
Sh 2-312 (Sharpless catalog)
Size: 720 arcminutes (12 degrees!)
Type: Emission nebula
```

## Size distribution (arcminutes)

The vast majority of targets are small:

    * 0-1 arcmin: 4,775 targets (34.8%) 95.5% galaxies
    * 1-2 arcmin: 5,286 targets (38.5%) 94.7% galaxies
    * 2-3 arcmin: 1,389 targets (10.1%) 89.8% galaxies

83.4% of all targets are under 3 arcminutes. Larger targets become
increasingly rare.

    * 3-10 arcmin: 1,594 targets (11.6%) 51.9% galaxies
    * 10-30 arcmin: 438 targets (3.2%) 
    * 30-100 arcmin: 170 targets (1.2%)
    * 100+ arcmin: 80 targets (0.6%)

The distribution drops off dramatically after 10 arcminutes, with only
scattered large objects like nebulae complexes and extended structures
making up the tail end of the distribution.

## Target type distribution

Galaxies completely dominate the small object categories (under 3 arcmin),
representing over 94% of targets. Objects under 10 arcminutes in size are
90% galaxies.

As objects get larger, the percentage of galaxies drops dramatically, with
most large extended objects being nebulae or star clusters rather than
galaxies. There are only 117 galaxies or galaxy clusters that are larger
than 10 arcminutes. However, some are very large and make magnificant
imaging targets.

Here is the distribution of all types in the database:

    * Asteroid: 13
    * Emission nebulae: 303
    * Cluster with nebulosity: 77
    * Dark nebulae: 304
    * Galaxy cluster: 315
    * Galaxy: 11,441
    * Globular cluster: 273
    * Open cluster: 720
    * Planetary nebula: 231
    * Quasar: 1
    * Reflection nebulae: 48
    * Supernova remnant: 20
    * Stars: 847

## How to use this information

Unless you are looking for small galaxies, you may choose to always set a
minimum size filter to exclude them. It's helpful to always select the
type(s) of targets you wish to image to avoid being overwhelmed with
galaxies.

You can use the "Create Imaging Program" capability in the Filter Results
to save the results of a filter rather than have to repeatedly perform the
same query.
