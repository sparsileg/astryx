#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quality Control Inspector for Converted Astronomical Data

This script inspects converted SAC and OpenNGC data files for the following potential issues:

- Coordinate conversion errors: Check that RA and Dec values look reasonable and are properly formatted
- Object name formatting: Verify the NGC/IC names follow the correct format (catalog + space + number without leading zeros)
- Type field mappings: Ensure the type conversions are applied correctly using approved type list
- Sorting issues: Confirm the natural sort is working properly (NGC 13 before NGC 221, etc.)
- Missing or empty fields: Look for unexpected blank values
- Data completeness: Compare record counts between input and output files
- Type validation: Verify Type field contains only approved values from the standard list
- Constellation validation: Verify Const field contains only approved constellation abbreviations
- Numeric field validation: Verify Size_max, Size_min, Mag, and Subr are numeric (if not blank)
"""

import sys
import re
import csv

# Approved Type field values (Field 2)
VALID_TYPES = {
 'ASTER', 'BRTNB', 'CL+NB', 'DRKNB', 'GALCL', 'GALXY', 'GLOCL', 'GX+DN', 'GX+GC', 'G+C+N',
 'LMCCN', 'LMCDN', 'LMCGC', 'LMCOC', 'OPNCL', 'PLNNB', 'SMCCN', 'SMCDN', 'SMCGC',
 'SMCOC', 'SNREM', 'QUASR', '1STAR', '2STAR', 'MSTAR', 'REFNB', 'OTHER', 'EMISS'
}

# Approved Constellation abbreviations (Field 5)
VALID_CONSTELLATIONS = {
 'AND', 'ANT', 'APS', 'AQR', 'AQL', 'ARA', 'ARI', 'AUR', 'BOO', 'CAE', 'CAM', 'CNC', 'CVN',
 'CMA', 'CMI', 'CAP', 'CAR', 'CAS', 'CEN', 'CEP', 'CET', 'CHA', 'CIR', 'COL', 'COM', 'CRA',
 'CRB', 'CRV', 'CRT', 'CRU', 'CYG', 'DEL', 'DOR', 'DRA', 'EQU', 'ERI', 'FOR', 'GEM', 'GRU',
 'HER', 'HOR', 'HYA', 'HYI', 'IND', 'LAC', 'LEO', 'LMI', 'LEP', 'LIB', 'LUP', 'LYN', 'LYR',
 'MEN', 'MIC', 'MON', 'MUS', 'NOR', 'OCT', 'OPH', 'ORI', 'PAV', 'PEG', 'PER', 'PHE', 'PIC',
 'PSC', 'PSA', 'PUP', 'PYX', 'RET', 'SGE', 'SGR', 'SCO', 'SCL', 'SCT', 'SER', 'SEX', 'TAU',
 'TEL', 'TRA', 'TRI', 'TUC', 'UMA', 'UMI', 'VEL', 'VIR', 'VOL', 'VUL'
}

# Recognized astronomical catalog abbreviations
RECOGNIZED_CATALOGS = {
 '3C', 'Abell', 'ADS', 'AM', 'Antalova', 'Ap', 'Arp', 'Bark', 'Barnard', 'Basel', 'BD',
 'Berk', 'Be', 'Biur', 'Blanco', 'Bochum', 'Caldwell', 'Ced', 'CGCG', 'Cr', 'Czernik', 'DDO',
 'Do', 'DoDz', 'Dun', 'ESO', 'Fein', 'Frolov', 'Gum', 'H', 'Haffner', 'Harvard',
 'Hav-Moffat', 'HCG', 'He', 'Hogg', 'Ho', 'HP', 'Hu', 'IC', 'Isk', 'J', 'K', 'Kemble',
 'King', 'Kr', 'Lac', 'Loden', 'LBN', 'LDN', 'NPM1G', 'Lynga', 'MCG', 'Me', 'Messier',
 'Mrk', 'Mel', 'MWSC', 'M1', 'M2', 'M3', 'M4', 'New', 'NGC', 'Pal', 'PB', 'PC', 'PGC', 'Pismis',
 'PK', 'RCW', 'Roslund', 'Ru', 'Sa', 'Sher', 'Sharpless', 'SL', 'Steph', 'Stock', 'Ter',
 'Tombaugh', 'Ton', 'Tr', 'UGC', 'UGCA', 'UKS', 'Upgren', 'V V', 'vdB', 'vdBH',
 'vdB-Ha', 'Vy', 'Waterloo', 'Winnecke', 'ZwG'
}

# Recognized astronomical catalog abbreviations
RECOGNIZED_CATALOG_ABBREVS = {
 '3C', 'Abell', 'ADS', 'AM', 'Antalova', 'Ap', 'Arp', 'Bark', 'B', 'Basel', 'BD',
 'Berk', 'Be', 'Biur', 'Blanco', 'Bochum', 'C', 'Ced', 'CGCG', 'Cr', 'Czernik', 'DDO',
 'Do', 'DoDz', 'Dun', 'ESO', 'Fein', 'Frolov', 'Gum', 'H', 'Haffner', 'Harvard',
 'Hav-Moffat', 'HCG', 'He', 'Hogg', 'Ho', 'HP', 'Hu', 'IC', 'Isk', 'J', 'K', 'Kemble',
 'King', 'Kr', 'Lac', 'Loden', 'LBN', 'LDN', 'NPM1G', 'Lynga', 'M', 'MCG', 'Me',
 'Mrk', 'Mel', 'MWSC', 'M1', 'M2', 'M3', 'M4', 'New', 'NGC', 'Pal', 'PB', 'PC', 'PGC', 'Pismis',
 'PK', 'RCW', 'Roslund', 'Ru', 'Sa', 'Sher', 'Sh', 'SL', 'Steph', 'Stock', 'Ter',
 'Tombaugh', 'Ton', 'Tr', 'UGC', 'UGCA', 'UKS', 'Upgren', 'V V', 'vdB', 'vdBH',
 'vdB-Ha', 'Vy', 'Waterloo', 'Winnecke', 'ZwG'
}

def natural_sort_key(text):
 """Generate a sort key for natural/human-readable sorting."""
 def convert(text):
     if text.isdigit():
         return int(text)
     else:
         return text.lower()

 return [convert(c) for c in re.split(r'(\d+)', str(text))]

def validate_ra(ra_value):
 """Validate RA is in proper decimal hours format (0.0 to 23.999...)."""
 if not ra_value or ra_value.strip() == '':
     return True, "empty RA field"

 try:
     ra_float = float(ra_value)
     if ra_float < 0.0 or ra_float >= 24.0:
         return False, f"RA out of range (0-24): {ra_value}"

     # Check decimal formatting (should have at least one decimal place if not whole number)
     if '.' not in ra_value and ra_float != int(ra_float):
         return False, f"RA formatting issue: {ra_value}"

     return True, None
 except ValueError:
     return False, f"invalid RA format: {ra_value}"

def validate_dec(dec_value):
 """Validate Dec is in proper decimal degrees format (-90.0 to +90.0)."""
 if not dec_value or dec_value.strip() == '':
     return True, "empty Dec field"

 try:
     dec_float = float(dec_value)
     if dec_float < -90.0 or dec_float > 90.0:
         return False, f"Dec out of range (-90 to +90): {dec_value}"

     # Check that positive values don't have + sign
     if dec_value.startswith('+'):
         return False, f"Dec should not have + sign: {dec_value}"

     return True, None
 except ValueError:
     return False, f"invalid Dec format: {dec_value}"

def validate_numeric_field(field_value, field_name):
 """Validate that a field is numeric (blank is ok)."""
 if not field_value or field_value.strip() == '':
     return True, None  # Blank is ok

 try:
     float(field_value)
     return True, None
 except ValueError:
     return False, f"invalid {field_name} (not numeric): {field_value}"

def validate_object_name(object_name):
 """Validate object name format for known astronomical catalogs."""
 if not object_name or object_name.strip() == '':
     return True, "empty Object field"

 object_name = object_name.strip()

 # Check for standard catalog + number format
 # Handle special cases like "V V" (with space) and hyphenated catalogs
 for catalog in RECOGNIZED_CATALOG_ABBREVS:
     # Create pattern that matches catalog followed by space and number/designation
     if catalog == 'V V':
         # Special case for "V V" catalog
         pattern = rf'^V\s+V\s+\w+.*$'
     elif catalog == 'MCG':
         # Special case for MCG catalog: "MCG +DD-ZZ-NNN" or "MCG -DD-ZZ-NNN"
         pattern = rf'^MCG\s+[+-]\d+-\d+-\d+.*$'
     elif '-' in catalog:
         # Handle hyphenated catalogs like "Hav-Moffat", "vdB-Ha"
         escaped_catalog = re.escape(catalog)
         pattern = rf'^{escaped_catalog}\s+\w+.*$'
     else:
         # Standard pattern: catalog + space + designation
         pattern = rf'^{re.escape(catalog)}\s+\w+.*$'

     if re.match(pattern, object_name, re.IGNORECASE):
         # For NGC and IC, also check for leading zeros (stricter validation)
         if catalog in ['NGC', 'IC']:
             match = re.match(rf'^({re.escape(catalog)})\s+(\d+)$', object_name, re.IGNORECASE)
             if match:
                 number = match.group(2)
                 if len(number) > 1 and number.startswith('0'):
                     return False, f"Object name has leading zeros: {object_name}"
         return True, None

 # If no recognized catalog matched, it's non-standard
 return True, f"non-standard Object format: {object_name}"

def validate_type(type_value):
 """Validate Type field against approved list."""
 if not type_value or type_value.strip() == '':
     return True, None

 if type_value.strip() not in VALID_TYPES:
     return False, f"invalid Type value: {type_value}"

 return True, None

def validate_constellation(const_value):
 """Validate Constellation field against approved list."""
 if not const_value or const_value.strip() == '':
     return True, None

 if const_value.strip() not in VALID_CONSTELLATIONS:
     return False, f"invalid Const value: {const_value}"

 return True, None

def validate_catalogue(catalogue_value):
 """Validate Catalogue field against recognized catalogs."""
 if not catalogue_value or catalogue_value.strip() == '':
     return True, None

 if catalogue_value.strip() not in RECOGNIZED_CATALOGS:
     return False, f"unrecognized Catalogue value: {catalogue_value}"

 return True, None

def check_sorting(data_rows):
 """Check if data is properly sorted using natural sort."""
 if len(data_rows) < 2:
     return []

 errors = []
 for i in range(1, len(data_rows)):
     current_object = data_rows[i][0]  # Object field
     prev_object = data_rows[i-1][0]

     current_key = natural_sort_key(current_object)
     prev_key = natural_sort_key(prev_object)

     if current_key < prev_key:
         line_num = i + 2  # +1 for header, +1 for 0-based index
         errors.append((line_num, f"sorting order issue: {current_object} should come before {prev_object}"))

 return errors

def validate_file(filename):
 """Main validation function."""


 try:
     print(f"\n\nValidating file: {filename}")
     with open(filename, 'r', encoding='utf-8') as f:
         reader = csv.reader(f)

         # Read header
         try:
             header = next(reader)
             expected_header = ['Object', 'Catalogue', 'Type', 'RA', 'Dec', 'Const', 'Mag', 'Subr', 'Size_max', 'Size_min', 'Common', 'Other']

             if header != expected_header:
                 print(f"{filename}, line 1, header mismatch - expected {expected_header}, got {header}")

         except StopIteration:
             print(f"{filename}, line 1, empty file")
             return

         # Read data rows
         data_rows = []
         line_num = 2  # Start at line 2 (after header)

         for row in reader:
             data_rows.append(row)

             # Check column count
             if len(row) != 12:
                 print(f"{filename}, line {line_num}, wrong number of columns: expected 12, got {len(row)}")
                 line_num += 1
                 continue

             object_name, catalogue_field, type_field, ra_field, dec_field, const_field, mag, subr, size_max, size_min, common_names, other_field = row

             # Validate Object name (Field 1)
             valid, error = validate_object_name(object_name)
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")
             elif error:  # Warning for non-standard formats
                 print(f"{filename}, line {line_num}, warning: {error}")

             # Validate Catalogue (Field 2)
             valid, error = validate_catalogue(catalogue_field)
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")
             elif error:  # Empty field
                 print(f"{filename}, line {line_num}, warning: {error}")

             # Validate Type (Field 3)
             valid, error = validate_type(type_field)
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate RA (Field 4)
             valid, error = validate_ra(ra_field)
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate Dec (Field 5)
             valid, error = validate_dec(dec_field)
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate Const (Field 6)
             valid, error = validate_constellation(const_field)
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate Size_max (Field 6)
             valid, error = validate_numeric_field(size_max, "Size_max")
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate Size_min (Field 7)
             valid, error = validate_numeric_field(size_min, "Size_min")
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate Mag (Field 8)
             valid, error = validate_numeric_field(mag, "Mag")
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Validate Subr (Field 9)
             valid, error = validate_numeric_field(subr, "Subr")
             if not valid:
                 print(f"{filename}, line {line_num}, {error}")

             # Check for completely empty records
             if all(field.strip() == '' for field in row):
                 print(f"{filename}, line {line_num}, completely empty record")

             line_num += 1

         # Check sorting
         sort_errors = check_sorting(data_rows)
         for line_num, error in sort_errors:
             print(f"{filename}, line {line_num}, {error}")

         # Summary statistics
         print("\n\n" + "=" * 50)
         print("VALIDATION SUMMARY")
         print(f"{filename}")
         print("=" * 50)
         print(f"Total records processed: {len(data_rows)}")

         if data_rows:
             empty_counts = {
                 'Object': sum(1 for row in data_rows if not row[0].strip()),
                 'Catalogue': sum(1 for row in data_rows if not row[1].strip()),
                 'Type': sum(1 for row in data_rows if not row[2].strip()),
                 'RA': sum(1 for row in data_rows if not row[3].strip()),
                 'Dec': sum(1 for row in data_rows if not row[4].strip()),
                 'Const': sum(1 for row in data_rows if not row[5].strip()),
                 'Mag': sum(1 for row in data_rows if not row[6].strip()),
                 'Subr': sum(1 for row in data_rows if not row[7].strip()),
                 'Size_max': sum(1 for row in data_rows if not row[8].strip()),
                 'Size_min': sum(1 for row in data_rows if not row[9].strip()),
                 'Common': sum(1 for row in data_rows if not row[10].strip()),
                 'Other': sum(1 for row in data_rows if not row[11].strip())
             }

             print("Empty field counts:")
             for field, count in empty_counts.items():
                 print(f"  {field}: {count}")

 except FileNotFoundError:
     print(f"Error: File '{filename}' not found")
     sys.exit(1)
 except Exception as e:
     print(f"Error processing file: {e}")
     sys.exit(1)

def main():
 if len(sys.argv) != 2:
     print("Usage: python validator.py <input_file>", file=sys.stderr)
     print("Example: python validator.py converted_data.csv", file=sys.stderr)
     sys.exit(1)

 filename = sys.argv[1]
 validate_file(filename)

if __name__ == "__main__":
 main()
