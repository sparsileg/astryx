# The Target Database {.appendix}

This appendix describes where Astryx's targets come from and what the
database holds. The figures are for the database dated July 3, 2026, which
holds 14,009 targets.

## Sources

The database was compiled from two main sources: the Saguaro Astronomy Club
Deep Sky Database, and the OpenNGC database compiled by Mattia Verga, which
also covers the IC catalog. Targets from other sources were merged in, and
a supplementary file adds targets the main sources lack and extra details,
such as common names, that make targets easier to find.

When the sources were merged, duplicate entries were combined so that no
data was lost. An object that appears in several catalogs, such as M 42 and
NGC 1976, still has one entry per catalog, and each entry lists the others
in its Other Info field.

Some targets have only one of the two sizes. Where a target had a maximum
size but no minimum, or the reverse, the value it had was copied to the
other. Those targets look circular, with the same minimum and maximum size.

## Catalogs

| Catalog | Targets |
|:-------------|-------:|
| NGC | 8,228 |
| IC | 4,746 |
| Sharpless | 313 |
| Barnard | 169 |
| LDN (Lynds Dark Nebulae) | 134 |
| Caldwell | 109 |
| Messier | 109 |
| Abell | 108 |
| Extra | 72 |
| Arp | 19 |
| Exotic | 2 |

## Types

| Type | Targets |
|:-------------|-------:|
| Galaxy | 11,441 |
| Open cluster | 702 |
| Emission nebula | 533 |
| Galaxy cluster | 315 |
| Dark nebula | 304 |
| Globular cluster | 273 |
| Planetary nebula | 230 |
| Cluster with nebulosity | 79 |
| Stars | 57 |
| Reflection nebula | 53 |
| Supernova remnant | 22 |

## Sizes

Every target has a size. The smallest is the planetary nebula IC 5117, at
0.02′ (about 1 arcsecond). The largest is the emission nebula Sh 2-109, at
1,080′ (18°).

Most targets are small, and most small targets are galaxies:

| Size (arcminutes) | Targets | Share | Galaxies |
|:-----------|-------:|-------:|-------:|
| Under 1 | 4,777 | 34.1% | 93.5% |
| 1 to 2 | 5,307 | 37.9% | 91.2% |
| 2 to 3 | 1,414 | 10.1% | 87.1% |
| 3 to 4 | 600 | 4.3% | 72.5% |
| 4 to 10 | 1,034 | 7.4% | 36.8% |
| 10 to 30 | 512 | 3.7% | 16.0% |
| 30 to 100 | 253 | 1.8% | 0.8% |
| 100 and over | 112 | 0.8% | 2.7% |

82% of targets are under 3′. At the default Min Size of 4′, 1,911 targets
remain. Above 10′, most targets are nebulae and star clusters, but 117
galaxies and galaxy clusters are larger than that, and some of them are
superb imaging targets.

## Magnitudes

4,862 targets, about a third, have no magnitude. They include 3,762
galaxies, 442 of the 533 emission nebulae, and all of the dark nebulae. The
Limiting Mag filter always keeps targets that have no magnitude.

## Using This

Unless you're hunting small galaxies, set a minimum size, and tick only the
types you want to image. Otherwise galaxies fill the list. To come back to
the same set of targets without filtering again, save it with **Create
Imaging Program** (see [Finding Targets](target-selection.md)).
