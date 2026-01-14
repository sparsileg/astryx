#!/bin/bash


# scrubber.py - perform various operations to distribute accurate data and
# to delete duplicate records.

# --in read from the specified input file
# --out output to the specified output file
# --log log to file
# --create-missing create missing records that are cross-referenced from other targets
# --fill fill empty fields from cross-referenced targets in other catalogs
# --prefer use the preferred catalogs, in specified order, for --fill
# --dupe-size if only one size field is filled, copy the value to the other
# --to-extra send the specified catalogs to the virtual Extra list
# --keep keep only the specified catalogs
# --dedupe-from delete records that are duplicates of each other from the specified catalogs
#      --dedupe-from "NGC,IC,UGC,RCW,vdB,Pal"
# --to-stars converts types 1STAR, 2STAR, or ASTER to the Stars catalog



python bin/scrubber.py \
       --in temp_dso.csv \
       --out final_targets.csv \
       --log scrubber.log \
       --create-missing \
       --fill \
       --prefer "NGC,IC,PK,UGC,Pal,Sharpless,RCW,vdB,LDN,Abell,Arp,Caldwell,Barnard,Messier" \
       --dupe-size \
       --to-extra "Pal,RCW,vdB" \
       --rm-unknown \
       --to-stars \
       --keep "Abell,Arp,Barnard,Caldwell,Extra,Exotic,IC,LDN,Messier,Minor Planet,NGC,Sharpless"


rm temp_dso.csv

echo
echo "Import final_targets.csv into Specula after deleting existing targets"
echo
