#!/usr/bin/env python3
import pandas as pd
import sys
import re
import csv

"""
Process raw OpenNGC astronomical object datafile.

Features:
    Takes input filename from command line
    Outputs processed data to stdout (redirect to file of your choice)
    Converts RA/Dec coordinates to decimal format with trailing zeros removed
    Handles positive/negative declinations correctly
    Creates the 12-field CSV output format with all fields quoted
    Includes error handling and informative error messages
"""

# Type field mapping dictionary
# Map from OpenNGC value to SAC value, which we use for Specula
TYPE_MAPPINGS = {
   '*': '1STAR',
   '**': '2STAR',
   '*Ass': 'ASTER',
   'OCl': 'OPNCL',
   'GCl': 'GLOCL',
   'Cl+N': 'CL+NB',
   'G': 'GALXY',
   'GPair': 'GALCL',
   'GTrpl': 'GALCL',
   'GGroup': 'GALCL',
   'PN': 'PLNNB',
   'HII': 'BRTNB',
   'DrkN': 'DRKNB',
   'EmN': 'BRTNB',
   'Neb': 'BRTNB',
   'RfN': 'REFNB',
   'SNR': 'SNREM',
   'Nova': 'NOVAS',
   'NonEx': 'NONEX',
   'Other': 'OTHER'
}

def clean_object_name(name):
   """
   Clean object name to add space and remove leading zeros from numbers.
   Example: 'NGC0323' -> 'NGC 323', 'IC0010' -> 'IC 10', 'B033' -> 'B 33'

   Handles catalogues: NGC, IC, B (Barnard), C (Caldwell), ESO, H, HCG, M (Messier),
                       Me, Mel, MWSC, PGC, UGC, Cr
   """
   if pd.isna(name) or str(name).strip() == '':
       return ''

   name_str = str(name).strip()

   # Match catalogue prefix followed directly by number with possible leading zeros
   # Try longest matches first (MWSC before M, HCG before H, Mel before Me)
   catalogues = ['NGC', 'IC', 'MWSC', 'PGC', 'UGC', 'ESO', 'HCG', 'Caldwell', 'Barnard',
                 'Mel', 'Me', 'Cr', 'H', 'C', 'B', 'M']

   for catalog in catalogues:
       # Match catalogue followed by optional zeros and digits
       pattern = rf'^({catalog})0*(\d+)(.*)$'
       match = re.match(pattern, name_str, re.IGNORECASE)
       if match:
           catalog_part = match.group(1)
           number = match.group(2)
           suffix = match.group(3)  # Any additional characters after the number

           # Handle special cases for display names
           if catalog_part == 'B':
               catalog_part = 'B'  # Keep as 'B' in object name
           elif catalog_part == 'C':
               catalog_part = 'C'  # Keep as 'C' in object name
           elif catalog_part == 'M':
               catalog_part = 'M'  # Keep as 'M' in object name

           return f"{catalog_part} {number}{suffix}"

   return name_str

def clean_other_field_catalogs(other_field):
   """
   Clean catalog designators in the Other field for M, NGC and IC.
   Example: 'M42, NGC0281, IC5070' -> 'M 42, NGC 281, IC 5070'
   """
   if not other_field or other_field.strip() == '':
       return ''

   # Split on commas and clean each part
   parts = [part.strip() for part in other_field.split(',')]
   cleaned_parts = []

   for part in parts:
       if not part:
           continue

       # Check for M, NGC or IC catalog designators
       m_match = re.match(r'(M)0*(\d+)(.*)$', part, re.IGNORECASE)
       ngc_match = re.match(r'(NGC)0*(\d+)(.*)$', part, re.IGNORECASE)
       ic_match = re.match(r'(IC)0*(\d+)(.*)$', part, re.IGNORECASE)

       if m_match:
           catalog = m_match.group(1).upper()
           number = m_match.group(2)
           suffix = m_match.group(3)
           cleaned_parts.append(f"{catalog} {number}{suffix}")
       elif ngc_match:
           catalog = ngc_match.group(1).upper()
           number = ngc_match.group(2)
           suffix = ngc_match.group(3)
           cleaned_parts.append(f"{catalog} {number}{suffix}")
       elif ic_match:
           catalog = ic_match.group(1).upper()
           number = ic_match.group(2)
           suffix = ic_match.group(3)
           cleaned_parts.append(f"{catalog} {number}{suffix}")
       else:
           # Keep other entries as-is
           cleaned_parts.append(part)

   return ', '.join(cleaned_parts)

def reformat_catalog_reference(ref_str):
   """
   Reformat catalog reference to standard format.
   Example: 'NGC0281' -> 'NGC 281', 'IC0123' -> 'IC 123'
   """
   if not ref_str:
       return ''

   ref_str = ref_str.strip()

   # Match NGC or IC followed directly by number with possible leading zeros
   match = re.match(r'(NGC|IC)0*(\d+)', ref_str, re.IGNORECASE)
   if match:
       catalog = match.group(1).upper()
       number = match.group(2)
       return f"{catalog} {number}"

   return ref_str

def extract_catalogue(object_name):
   """
   Extract catalogue name from object name.
   Returns "NGC" if object starts with "NGC", "IC" if starts with "IC", etc.

   Catalogue mappings:
   - B -> Barnard
   - C -> Caldwell
   - Cr -> Cr
   - ESO -> ESO
   - H -> H
   - HCG -> HCG
   - M -> Messier
   - Me -> Me
   - Mel -> Mel
   - MWSC -> MWSC
   - PGC -> PGC
   - UGC -> UGC
   - NGC -> NGC
   - IC -> IC
   """
   if not object_name or object_name.strip() == '':
       return ''

   object_name = str(object_name).strip()

   # Extract first word/token
   first_token = object_name.split()[0] if object_name.split() else ''

   # Map catalogue codes to full names
   catalogue_map = {
       'NGC': 'NGC',
       'IC': 'IC',
       'B': 'Barnard',
       'C': 'Caldwell',
       'Cr': 'Cr',
       'ESO': 'ESO',
       'H': 'H',
       'HCG': 'HCG',
       'M': 'Messier',
       'Me': 'Me',
       'Mel': 'Mel',
       'MWSC': 'MWSC',
       'PGC': 'PGC',
       'UGC': 'UGC'
   }

   return catalogue_map.get(first_token, first_token)

def natural_sort_key(text):
   """
   Generate a sort key for natural/human-readable sorting.
   Splits text into alternating text and numeric parts.
   """
   def convert(text):
       if text.isdigit():
           return int(text)
       else:
           return text.lower()

   return [convert(c) for c in re.split(r'(\d+)', str(text))]

def clean_numeric_field(value):
   """
   Clean numeric field to remove unwanted .0 suffixes.
   """
   if pd.isna(value) or str(value).strip() == '':
       return ''

   value_str = str(value)
   # Remove .0 from end if present
   if value_str.endswith('.0'):
       value_str = value_str[:-2]

   return value_str

def map_type_field(type_str):
   """
   Map Type field values according to the provided mapping.
   """
   if pd.isna(type_str) or str(type_str).strip() == '':
       return ''

   type_str = str(type_str).strip()
   return TYPE_MAPPINGS.get(type_str, type_str)  # Return original if not in mapping

def convert_ra_to_decimal(ra_str):
   """
   Convert RA from HH:MM:SS.ddd format to decimal hours.
   """
   if pd.isna(ra_str) or str(ra_str).strip() == '':
       return ''

   try:
       # Parse HH:MM:SS.ddd
       parts = str(ra_str).split(':')
       hours = float(parts[0])
       minutes = float(parts[1])
       seconds = float(parts[2])

       # Convert to decimal hours
       decimal_hours = hours + (minutes / 60.0) + (seconds / 3600.0)

       # Format to 3 decimal places and remove trailing zeros
       result = f"{decimal_hours:.3f}".rstrip('0')
       if result.endswith('.'):
           result += '0'
       return result

   except (ValueError, IndexError):
       return ra_str  # Return original if conversion fails

def convert_dec_to_decimal(dec_str):
   """
   Convert Dec from +/-DD:MM:SS.ddd format to decimal degrees.
   """
   if pd.isna(dec_str) or str(dec_str).strip() == '':
       return ''

   try:
       dec_str = str(dec_str).strip()

       # Check for negative sign
       is_negative = dec_str.startswith('-')

       # Remove sign for processing
       dec_str = dec_str.lstrip('+-')

       # Parse DD:MM:SS.ddd
       parts = dec_str.split(':')
       degrees = float(parts[0])
       minutes = float(parts[1])
       seconds = float(parts[2])

       # Convert to decimal degrees
       decimal_degrees = degrees + (minutes / 60.0) + (seconds / 3600.0)

       # Apply negative sign if needed
       if is_negative:
           decimal_degrees = -decimal_degrees

       # Format to 3 decimal places and remove trailing zeros
       result = f"{decimal_degrees:.3f}".rstrip('0')
       if result.endswith('.'):
           result += '0'
       return result

   except (ValueError, IndexError):
       return dec_str  # Return original if conversion fails

def convert_const_to_uppercase(const_str):
   """
   Convert constellation abbreviation to uppercase and handle special cases.
   """
   if pd.isna(const_str) or str(const_str).strip() == '':
       return ''

   const_str = str(const_str).strip().upper()

   # Handle special cases
   if const_str in ['SE1', 'SE2']:
       return 'SER'

   return const_str

def extract_field_unchanged(value):
   """
   Extract field value unchanged, return empty string if blank.
   """
   if pd.isna(value) or str(value).strip() == '':
       return ''
   return str(value).strip()

def resolve_duplicate_types(processed_rows):
    """
    Resolve duplicate types by finding the referenced object and copying its type.
    """
    # Create a lookup dictionary for quick object name to type mapping
    object_type_lookup = {}
    for row in processed_rows:
        object_name = row[0]  # Object field
        type_field = row[2]   # Type field (now at position 2 after adding Catalogue)
        if type_field != 'Dup':
            object_type_lookup[object_name] = type_field

    # Process records with 'Dup' type
    for i, row in enumerate(processed_rows):
        if row[2] == 'Dup':  # Type field (now at position 2)
            other_field = row[11]  # Other field (now at position 11)
            if other_field:
                # Take only the first object if multiple are present (comma-separated)
                first_object = other_field.split(',')[0].strip()

                # If no comma, extract only catalog + number portion to handle cases like "NGC 3058 NED02"
                if ',' not in other_field:
                    # Match catalog + number at the start and ignore everything after
                    catalog_match = re.match(r'^(NGC|IC)\s*0*(\d+)', first_object, re.IGNORECASE)
                    if catalog_match:
                        catalog = catalog_match.group(1).upper()
                        number = catalog_match.group(2)
                        first_object = f"{catalog} {number}"

                # Reformat the reference to standard format
                reformatted_ref = reformat_catalog_reference(first_object)

                # If not found, try removing any non-numeric suffix
                if reformatted_ref not in object_type_lookup:
                    # Remove any letters at the end (e.g., "NGC 423B" -> "NGC 423")
                    base_match = re.match(r'^(.*\s+\d+)[A-Za-z]+$', reformatted_ref)
                    if base_match:
                        reformatted_ref = base_match.group(1)

                # Look up the type for this object
                if reformatted_ref in object_type_lookup:
                    # Copy the type from the referenced object
                    processed_rows[i][2] = object_type_lookup[reformatted_ref]
                else:
                    print(f"Could not resolve duplicate: {row[0]} -> {reformatted_ref} (object not found)", file=sys.stderr)

    return processed_rows

def process_openngc_file(input_file_path):
   """
   Process OpenNGC file according to specifications and output to stdout.

   Name(1)              -> Object
                        -> Catalogue (extracted from Object: "NGC" or "IC")
   Type(2)              -> Type
   RA(3)                -> RA
   Dec(4)               -> Dec
   Const(5)             -> Const (uppercase, SE1/SE2 -> SER)
   V-Mag(10)            -> Mag
   SurfBr(14)           -> Subr
   MajAx(6)             -> Size_max
   MinAx(7)             -> Size_min
   "Common names"(29)   -> Common
   M(24),NGC(25),IC(26) -> Other

   """
   try:
       # Read the CSV file with semicolon delimiter
       df = pd.read_csv(input_file_path, sep=';', header=0)

       # Check for required columns. These are the columns we pull data from.
       required_cols = ['Name', 'Type', 'RA', 'Dec', 'Const', 'MajAx', 'MinAx', 'V-Mag', 'SurfBr', 'Common names', 'M', 'NGC', 'IC']
       missing_cols = [col for col in required_cols if col not in df.columns]
       if missing_cols:
           print(f"Error: Missing required columns: {missing_cols}", file=sys.stderr)
           return False

       # Process each row
       processed_rows = []

       for index, row in df.iterrows():
           # Field 1: Clean object names
           object_name = clean_object_name(row['Name'])

           # Field 2: Type (mapped according to TYPE_MAPPINGS, Dup handled later)
           type_field = map_type_field(row['Type'])

           # Skip records with NONEX type
           if type_field == 'NONEX' or type_field == 'NOVAS':
              continue

           # Field 3: RA converted to decimal hours
           ra_field = convert_ra_to_decimal(row['RA'])

           # Field 4: Dec converted to decimal degrees
           dec_field = convert_dec_to_decimal(row['Dec'])

           # Field 5: Const converted to uppercase with special case handling
           const_field = convert_const_to_uppercase(row['Const'])

           # Field 6: Size_max (MajAx) - unchanged
           size_max_field = extract_field_unchanged(row['MajAx'])

           # Field 7: Size_min (MinAx) - unchanged
           size_min_field = extract_field_unchanged(row['MinAx'])

           # Field 8: Mag (V-Mag) - unchanged
           mag_field = extract_field_unchanged(row['V-Mag'])

           # Field 9: Subr (SurfBr) - unchanged
           subr_field = extract_field_unchanged(row['SurfBr'])

           # Field 10: Common
           common_names = str(row['Common names']).strip() if pd.notna(row['Common names']) else ''

           # Field 11: Process M, NGC, IC fields and combine
           other_parts = []

           # Process M field - clean numeric values
           if pd.notna(row['M']) and str(row['M']).strip() != '':
               m_value = clean_numeric_field(row['M'])
               other_parts.append(f"M {m_value}")

           # Process NGC field - clean numeric values
           if pd.notna(row['NGC']) and str(row['NGC']).strip() != '':
               ngc_value = clean_numeric_field(row['NGC'])
               other_parts.append(f"NGC{ngc_value}")

           # Process IC field - clean numeric values
           if pd.notna(row['IC']) and str(row['IC']).strip() != '':
               ic_value = clean_numeric_field(row['IC'])
               other_parts.append(f"IC{ic_value}")

           # Join with commas, or empty string if no parts
           other_field = ', '.join(other_parts) if other_parts else ''

           # Clean catalog designators in the Other field
           other_field = clean_other_field_catalogs(other_field)

           # Extract catalogue from object name
           catalogue_field = extract_catalogue(object_name)

           # Create row with exactly 12 fields (added Catalogue as field 2)
           row_data = [
               object_name or '',      # Field 1: Object
               catalogue_field or '',  # Field 2: Catalogue
               type_field or '',       # Field 3: Type
               ra_field or '',         # Field 4: RA
               dec_field or '',        # Field 5: Dec
               const_field or '',      # Field 6: Const
               mag_field or '',        # Field 7: Mag
               subr_field or '',       # Field 8: Subr
               size_max_field or '',   # Field 9: Size_max
               size_min_field or '',   # Field 10: Size_min
               common_names or '',     # Field 11: Common
               other_field or ''       # Field 12: Other
           ]

           processed_rows.append(row_data)

       # Resolve duplicate types before sorting
       processed_rows = resolve_duplicate_types(processed_rows)

       # Sort by Object field using natural sort
       processed_rows.sort(key=lambda x: natural_sort_key(x[0]))

       # Write header with CSV format
       writer = csv.writer(sys.stdout, quoting=csv.QUOTE_ALL)
       writer.writerow(["Object", "Catalogue", "Type", "RA", "Dec", "Const", "Mag", "Subr", "Size_max", "Size_min", "Common", "Other"])

       # Write data rows with explicit field count verification
       for row in processed_rows:
           if len(row) != 12:
               print(f"ERROR: Row has {len(row)} fields instead of 12: {row}", file=sys.stderr)
               continue
           writer.writerow(row)

       print(f"Processed {len(processed_rows)} rows", file=sys.stderr)
       return True

   except Exception as e:
       print(f"Error processing file: {str(e)}", file=sys.stderr)
       return False

def main():
   if len(sys.argv) != 2:
       print("Usage: python script.py <input_file>", file=sys.stderr)
       print("Example: python script.py openngc.csv > output.csv", file=sys.stderr)
       sys.exit(1)

   input_file = sys.argv[1]

   success = process_openngc_file(input_file)

   if not success:
       sys.exit(1)

if __name__ == "__main__":
   main()
