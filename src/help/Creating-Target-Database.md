# Create the target database

These scripts are found in the DSO folder. You will also need the Source
folder with the original source files.


## Change History

**v1**
Initial version. Final database content was defined by the header:

```
Object	Type	RA	Dec	Const	Common	Other
```

**v2**
Added additional information to the database, defined by the header:

```
Object	Type	RA	Dec	Const	Mag	Subr	Size_max	Size_min	Common	Other
```

**v3**
Added new field to the database, "Catalogue". New header:

```
Object	Catalogue	Type	RA	Dec	Const	Mag	Subr	Size_max	Size_min	Common	Other
```

    * Object: Designator (M 31, NGC 5323, etc.)
    * Catalogue: Messier, NGC, IC, etc.)
    * Type: Type of object
    * RA: Right Ascension
    * Dec: Declination
    * Const: Constellation
    * Mag: Brightness magnitude
    * Subr: Surface brightness (only for galaxies)
    * Size_max: Major axis (arc minutes)
    * Size_min: Minor axis (arc minutes)
    * Common: Common name(s), if any (Crab Nebula, etc.)
    * Other: Other name(s), if any

The scripts *process_raw_openngc.py*, *process_raw_sac.py*, *validate.py*
were updated to automatically add the new 'catalogue' field and contents
when converting from the original TXT format into CSV file. The remaining
existing files containing other catalogs or updated information were
updated with the new field and contents.

Changed mapping of some objects and annotated docs that some types never
show up because we're using OpenNGC as the baseline. The other databases
add information only if it is missing from the OpenNGC database.

**v4**

Added multiple command-line options in **scrubber.py** to provide more
flexibility in defining which catalogs to keep in the database and which to
not keep.

Fixed bug where the --fill option was not doing reciprocal copies to the
object in different catalogs


**v5**

Added --to-extra <catalog-list> command line option to
**scrubber.py**. This option condenses the specified catalogs into a
virtual catalog named "Extra". This reduces the number of catalogs with a
small number of objects to make it easier to select the desired catalogs
for filtering.


## Summary

There are two foundation data sources (openngc & SAC). Other catalogues or
miscellaneous additions or modifications are manually created in CSV.


**Steps**

    * Convert the two base files (openngc & SAC) in "txt" format to CSV (comma
      separated value) files.
    * Convert the openngc_addendum to CSV.
    * Validate all CSV files.
    * Merge by using one database (openngc) as the original and then
      adding, or updating, with the other databases.
    * Validate the final output (final_targets.csv)
    * Import into Specula

## Detailed Instruction

We use the merge.py script, which requires a target file to be designated
the primary file and other input files to be designated as secondary
files. The primary file is used as the baseline and the secondary files add
only those things that the primary file does not have.

But first, we have to create the initial primary and secondary files. The
two initial target sets that we use come from the OpenNGC project and the
SAC project. The OpenNGC data seems to be more current than the SAC
database.

The baseline is openngc.csv. All others are merged into the final database
using that as the foundation. This means that the secondary databases
contribute to the final database only if openngc.csv is missing
information.

We use the SAC type mappings, but some of the SAC types are not to be found
in the final database because OpenNGC classified them
differently. misc_addendum.csv can be used to add new information to the
existing baseline as it becomes available. Put misc_addendum.csv as the
last file to be merged.

The interim working files are tab-separated. The final output is a comma
separated file with double quote delimiters.

To clean up the database, reduce duplication, and populate the data fields
as much as possible, there is another utility called **scrubber.py**.


## Running the scripts

Note that these scripts run in the linux environment and require
Python. However, creating a Windows script is trivial if Python is
installed.

```
./1-process-validate.sh*
./2-do-merge.sh*
./3-do-scrubber.sh*
```

## Example Scripts

**bin/1-process-validate.sh**

```
#!/bin/bash

python bin/process_raw_openngc.py ../Source/openngc.txt > openngc.csv
python bin/process_raw_openngc.py ../Source/openngc_addendum.txt > openngc_addendum.csv
python bin/process_raw_sac.py ../Source/SAC_DeepSky_Ver81_Fence.TXT > sac.csv

python bin/validate.py openngc.csv
python bin/validate.py openngc_addendum.csv
python bin/validate.py sac.csv
python bin/validate.py manual/ic_addendum.csv
python bin/validate.py manual/messier_addendum.csv
python bin/validate.py manual/caldwell.csv
python bin/validate.py manual/misc_addendum.csv
```


**bin/2-do-merge.sh**


```
#!/bin/bash


# merge all csv files and then scrub to produce the final CSV for import
# into Specula

python bin/merge.py  \
    -p openngc.csv \
    -s openngc_addendum.csv sac.csv manual/ic_addendum.csv manual/messier_addendum.csv manual/caldwell.csv manual/misc_addendum.csv \
    > temp_dso.csv

rm -f openngc.csv openngc_addendum.csv sac.csv
```


**bin/3-do-scrubber.sh**

```
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



python bin/scrubber.py \
       --in temp_dso.csv \
       --out final_targets.csv \
       --log scrubber.log \
       --create-missing \
       --fill \
       --prefer "NGC,IC,PK,UGC,Pal,Sharpless,RCW,vdB,Abell,Arp,Caldwell,Barnard,Messier" \
       --dupe-size \
       --to-extra "Pal,RCW,vdB" \
       --keep "Abell,Arp,Barnard,Caldwell,Extra,IC,Messier,NGC,Sharpless"


rm temp_dso.csv

echo
echo "Import final_targets.csv into Specula after deleting existing targets"
echo
```
