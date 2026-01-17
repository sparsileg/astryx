#!/bin/bash


# merge all csv files and then scrub to produce the final CSV for import
# into Specula

python bin/merge.py -p openngc.csv \
    -s openngc_addendum.csv sac.csv manual/ic_addendum.csv manual/messier_addendum.csv manual/caldwell.csv manual/misc_addendum.csv manual/minor_planets.csv manual/exotic.csv manual/sharpless.csv \
    > temp_dso.csv

rm -f openngc.csv openngc_addendum.csv sac.csv
