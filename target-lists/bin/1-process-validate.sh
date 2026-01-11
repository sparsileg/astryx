#!/bin/bash

python bin/process_raw_openngc.py original/openngc.txt > openngc.csv
python bin/process_raw_openngc.py original/openngc_addendum.txt > openngc_addendum.csv
python bin/process_raw_sac.py original/SAC_DeepSky_Ver81_Fence.TXT > sac.csv

python bin/validate.py openngc.csv
python bin/validate.py openngc_addendum.csv
python bin/validate.py sac.csv
python bin/validate.py manual/ic_addendum.csv
python bin/validate.py manual/messier_addendum.csv
python bin/validate.py manual/caldwell.csv
python bin/validate.py manual/misc_addendum.csv
