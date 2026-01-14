== Messier Issues ==

M 40 and M 73 weren't included in the MESSIER catalog and I had to do some
detective work to find out why. Eventually, we had to do some tweaking to
make sure the Messier catalog was complete.

M 40 is a double star, so we can't use the --no-sparse-stars option for
scrubber.

M 73 is listed as an MSTAR. However, the NGC designation for it, NGC 6994,
lists OTHER in its type, which overwrote ASTER because NGC has higher
accuracy than Messier. scrubber then deleted the M 73 record because the
OTHER category is assumed to be unknown, which we normally remove with
scrubber. The resolution was to edit the original Source document
(openngc.txt) and change the type of NGC6994 from OTHER to Ocl (Open
Cluster). I don't like to edit original data, but I definitely wanted a
complete Messier catalog. This edit fixed the problem.

== Asteroid Issues ==

I added 13 asteroid targets, primarily so I could log Ceres. The catalog
abbreviation is 'Ast' and the catalog is 'Asteroid'.

== Star Issues ==

Redo the --no-sparse-stars, which I can't use anyway, to --to-stars,
similar to the --to-extra option. This assigns the 1STAR, 2STAR, and ASTER
types to the new Stars type in an attempt to reduce non-useful types but
still keep the necessary objects in the database. The Common field will be
updated to be "Single Star", "Doublle Star", "Asterism" for the current
1STAR, 2STAR, and ASTER types.

== Exotic ==

For things like quasars and black holes, I created an exotic.csv input file
and a catalog named Exotic.
