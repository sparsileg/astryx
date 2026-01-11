#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SAC Data File Processor
Process raw SAC datafile.

Converts SAC astronomical data file to simplified 12-field CSV format.
Outputs to stdout for redirection.
"""

import sys
import re
import csv

# Recognized astronomical catalogs
RECOGNIZED_CATALOGS = ['NGC', 'IC', 'MWSC', 'PGC', 'UGC', 'UGCA', 'ESO', 'HCG', 'NPM1G',
              'Caldwell', 'Barnard', 'Hav-Moffat', 'Harvard', 'Haffner', 'Hogg',
              'Waterloo', 'Winnecke', 'Tombaugh', 'Czernik', 'Blanco', 'Bochum',
              'Antalova', 'Roslund', 'Pismis', 'Kemble', 'Upgren', 'vdB-Ha', 'vdBH',
              'Basel', 'Stock', 'Steph', 'Loden', 'Lynga', 'Abell', 'Frolov',
              'MCG', 'Mrk', 'Mel', 'Me', 'M1', 'M2', 'M3', 'M4', 'M',
              'CGCG', 'Berk', 'Biur', 'Fein', 'King', 'Bark', 'DoDz', 'vdB', 'LBN',
              'LDN', 'RCW', 'Ced', 'Gum', 'ADS', 'ZwG', 'UKS', 'Isk', 'Lac', 'Dun',
              'Sher', 'Ter', 'Ton', 'Pal', 'New', 'Arp', 'DDO', 'Ru', 'Sa', 'Sh', 'SL',
              'Cr', 'Tr', 'Vy', 'V V', 'HP', 'Hu', 'He', 'Ho', 'H', 'PK', 'PB', 'PC',
              'AM', 'Ap', 'BD', 'Be', 'Do', 'C', 'B', 'J', 'K', '3C']

normalized_catalogs = {cat.replace('-', '').replace(' ', '').upper(): cat for cat in RECOGNIZED_CATALOGS}
sorted_norm_keys = sorted(normalized_catalogs.keys(), key=len, reverse=True)

def is_recognized_catalog(object_name):
    """Check if object name uses a recognized catalog."""
    if not object_name:
        return False

    object_name = object_name.strip()

    for catalog in RECOGNIZED_CATALOGS:
        if catalog == 'V V':
            pattern = rf'^V\s+V\s+'
        elif catalog == 'MCG':
            pattern = rf'^MCG\s+'
        elif '-' in catalog:
            escaped_catalog = re.escape(catalog)
            pattern = rf'^{escaped_catalog}\s+'
        else:
            pattern = rf'^{re.escape(catalog)}\s+'

        if re.match(pattern, object_name, re.IGNORECASE):
            return True

    return False

def extract_catalogue(object_name):
    """
    Extract catalogue name from object name.
    Returns the first word, with special cases: 'B' becomes 'Barnard', 'Sh' becomes 'Sharpless'.
    """
    if not object_name or object_name.strip() == '':
        return ''

    object_name = str(object_name).strip()

    # Handle special two-word catalogs first
    if object_name.startswith('V V '):
        return 'V V'

    # Extract first word
    first_word = object_name.split()[0] if object_name.split() else ''

    # Special case: 'B' becomes 'Barnard'
    if first_word == 'B':
        return 'Barnard'

    # Special case: 'Sh' becomes 'Sharpless'
    if first_word == 'Sh':
        return 'Sharpless'

    return first_word

def clean_object_name(name):
  """
  Standardize object name to have single space between catalog and designator.
  Example: 'NGC      1' -> 'NGC 1', 'M    42' -> 'M 42'
  Also handles special case: 'Sh2- 71' -> 'Sh 2-71'
  """
  name = name.strip()

  # Handle special case for Sharpless 2 catalog (Sh2-)
  sh2_match = re.match(r'^Sh2-\s*(\d+)$', name, re.IGNORECASE)
  if sh2_match:
      number = sh2_match.group(1).lstrip('0') or '0'  # Remove leading zeros
      return f"Sh 2-{number}"

  # Split on whitespace and rejoin with single space
  parts = name.split()
  if len(parts) >= 2:
      return ' '.join(parts)
  return name

def format_catalog_entry(entry):
    entry = entry.strip()
    if not entry:
        return ''

    # Only process uppercase catalog codes followed immediately by numbers
    # This catches: NGC2244, IC1234, M31, SH2155, etc.
    # But leaves alone: Hyades, Hydra A, Cr 147, Hercules Galaxy Cl, etc.

    # Special for SH2 (all uppercase, no space)
    sh2_match = re.match(r'^SH2(\d+)$', entry, re.IGNORECASE)
    if sh2_match:
        number = sh2_match.group(1).lstrip('0') or '0'
        return f"Sh 2-{number}"

    # Special for M catalog (M followed immediately by digits)
    m_match = re.match(r'^M(\d+),*$', entry, re.IGNORECASE)
    if m_match:
        number = m_match.group(1).lstrip('0') or '0'
        return f"M {number}"

    # For NGC/IC catalogs (uppercase + digits with no space)
    ngc_match = re.match(r'^(NGC|IC)(\d+)$', entry, re.IGNORECASE)
    if ngc_match:
        cat = ngc_match.group(1).upper()
        number = ngc_match.group(2).lstrip('0') or '0'
        return f"{cat} {number}"

    # If no match, return as-is (preserves everything else)
    return entry

def convert_type_field(type_str):
  """
  Convert type field values. Maps 3STAR, 4STAR, 8STAR to MSTAR.
  """
  if not type_str:
      return ''

  type_str = type_str.strip()
  if type_str in ['3STAR', '4STAR', '8STAR']:
      return 'MSTAR'

  return type_str

def convert_size_field(size_str):
  """
  Convert size field with unit conversion.
  'd' suffix: multiply by 60, format as integer
  'm' suffix: remove suffix, keep number unchanged
  's' suffix: divide by 60, format with 2 decimal places
  """
  if not size_str or size_str.strip() == '':
      return ''

  size_str = size_str.strip()

  # Match number followed by optional space and single letter
  match = re.match(r'^([\d.]+)\s*([dms])$', size_str, re.IGNORECASE)
  if not match:
      # If no unit letter, return as-is
      return size_str

  try:
      value = float(match.group(1))
      unit = match.group(2).lower()

      if unit == 'd':
          # Multiply by 60, format as integer
          result = int(value * 60)
          return str(result)
      elif unit == 'm':
          # Keep unchanged, remove 'm' - return just the number part
          return match.group(1)
      elif unit == 's':
          # Divide by 60, format with 2 decimal places
          result = value / 60.0
          return f"{result:.2f}"
      else:
          return size_str
  except ValueError:
      return size_str

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

  return [convert(c) for c in re.split(r'(\d+)', text)]

def convert_ra_to_decimal(ra_str):
  """
  Convert RA from 'HH MM.ddd' format to decimal hours.
  Example: '00 07.3' -> '0.122'
  """
  if not ra_str or ra_str.strip() == '':
      return ''

  ra_str = ra_str.strip()
  parts = ra_str.split()

  if len(parts) != 2:
      return ra_str  # Return original if format is unexpected

  try:
      hours = float(parts[0])
      minutes = float(parts[1])
      decimal_hours = hours + (minutes / 60.0)

      # Format to 3 decimal places, remove trailing zeros but keep at least one decimal
      result = f"{decimal_hours:.3f}".rstrip('0')
      if result.endswith('.'):
          result += '0'
      return result
  except ValueError:
      return ra_str  # Return original if conversion fails

def convert_dec_to_decimal(dec_str):
  """
  Convert Dec from '+/-DD MM' format to decimal degrees.
  Example: '+32 37' -> '32.617', '-15 42' -> '-15.7'
  """
  if not dec_str or dec_str.strip() == '':
      return ''

  dec_str = dec_str.strip()

  # Extract sign, degrees, and minutes
  match = re.match(r'([+-])(\d+)\s+(\d+)', dec_str)
  if not match:
      return dec_str  # Return original if format is unexpected

  try:
      sign = match.group(1)
      degrees = float(match.group(2))
      minutes = float(match.group(3))

      decimal_degrees = degrees + (minutes / 60.0)

      # Apply sign
      if sign == '-':
          decimal_degrees = -decimal_degrees

      # Format to 3 decimal places, remove trailing zeros but keep at least one decimal
      result = f"{decimal_degrees:.3f}".rstrip('0')
      if result.endswith('.'):
          result += '0'

      return result
  except ValueError:
      return dec_str  # Return original if conversion fails

def process_sac_file(input_file):
  """
  Process SAC data file and convert to tab-separated format.
  Output to stdout.

  Mapping:
  Input Field 1 (OBJECT) -> Output Field 1 (Object) - standardize spacing
                         -> Output Field 2 (Catalogue) - extracted from Object (first word, 'B' -> 'Barnard')
  Input Field 3 (TYPE) -> Output Field 3 (Type) - with type conversions
  Input Field 5 (RA) -> Output Field 4 (RA) - converted to decimal hours
  Input Field 6 (DEC) -> Output Field 5 (Dec) - converted to decimal degrees
  Input Field 4 (CON) -> Output Field 6 (Const)
  Input Field 7 (MAG) -> Output Field 7 (Mag)
  Input Field 8 (SUBR) -> Output Field 8 (Subr)
  Input Field 11 (SIZE_MAX) -> Output Field 9 (Size_max) - with unit conversion
  Input Field 12 (SIZE_MIN) -> Output Field 10 (Size_min) - with unit conversion
  Empty -> Output Field 11 (Common)
  Input Field 2 (OTHER) -> Output Field 12 (Other)
  """

  # Read the input file
  with open(input_file, 'r', encoding='utf-8') as f:
      lines = f.readlines()

  # Skip empty lines and find header
  data_lines = [line.strip() for line in lines if line.strip()]

  if not data_lines:
      print("No data found in file", file=sys.stderr)
      return

  # Parse pipe-delimited data
  rows = []
  for line in data_lines:
      # Split by pipe and clean up fields
      fields = [field.strip() for field in line.split('|')]

      # Only remove empty fields at the very beginning and end (leading/trailing pipes)
      if len(fields) > 0 and fields[0] == '':
          fields = fields[1:]
      if len(fields) > 0 and fields[-1] == '':
          fields = fields[:-1]

      rows.append(fields)

  # Skip header row (first row contains column names)
  if len(rows) < 2:
      print("No data rows found", file=sys.stderr)
      return

  data_rows = rows[1:]  # Skip header

  # Process each data row
  processed_rows = []
  for row in data_rows:
      if len(row) >= 6:  # Ensure we have enough fields
          # Map fields according to specification - handle empty fields gracefully
          object_name = clean_object_name(row[0]) if len(row) > 0 and row[0] else ''

          # Skip records with unrecognized catalogs
          if not is_recognized_catalog(object_name):
            continue

          type_field = convert_type_field(row[2]) if len(row) > 2 and row[2] else ''

          # Skip records with NONEX type
          if type_field == 'NONEX':
            continue

          ra_field = convert_ra_to_decimal(row[4]) if len(row) > 4 and row[4] else ''
          dec_field = convert_dec_to_decimal(row[5]) if len(row) > 5 and row[5] else ''
          const_field = row[3] if len(row) > 3 and row[3] else ''

          # Extract new fields
          mag_field = row[6].strip() if len(row) > 6 and row[6] else ''
          subr_field = row[7].strip() if len(row) > 7 and row[7] else ''

          # Apply MAG/SUBR logic based on type
          # If empty, fill with 99.9 for non-DRKNB, 79.9 for DRKNB
          if not mag_field:
              mag_field = '79.9' if type_field == 'DRKNB' else '99.9'
          if not subr_field:
              subr_field = '79.9' if type_field == 'DRKNB' else '99.9'

          # If one has a value and other doesn't (before default assignment), copy
          # This is already handled by the default assignment above

          size_max_field = convert_size_field(row[10]) if len(row) > 10 and row[10] else ''
          size_min_field = convert_size_field(row[11]) if len(row) > 11 and row[11] else ''

          common_names = ""
          other_field = row[1] if len(row) > 1 and row[1] else ''

          # Reformat other_field
          if other_field:
              entries = [e.strip() for e in other_field.split(';')]
              formatted_entries = []
              for e in entries:
                  if e:
                      formatted = format_catalog_entry(e)
                      if formatted:
                          formatted_entries.append(formatted)
              other_field = ', '.join(formatted_entries)

          # Extract catalogue from object name
          catalogue_field = extract_catalogue(object_name)

          # Ensure exactly 12 fields (added Catalogue as field 2)
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

          # Verify we have exactly 12 fields
          if len(row_data) != 12:
              print(f"ERROR: Row doesn't have 12 fields: {row_data}", file=sys.stderr)
              continue

          processed_rows.append(row_data)

  # Sort by first field (Object) using natural sort
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

def main():
  if len(sys.argv) != 2:
      print("Usage: python sac_processor.py <input_file>", file=sys.stderr)
      print("Example: python sac_processor.py sample_sac.txt > output.csv", file=sys.stderr)
      sys.exit(1)

  input_file = sys.argv[1]

  try:
      process_sac_file(input_file)
  except FileNotFoundError:
      print(f"Error: Input file '{input_file}' not found", file=sys.stderr)
      sys.exit(1)
  except Exception as e:
      print(f"Error processing file: {e}", file=sys.stderr)
      sys.exit(1)

if __name__ == "__main__":
  main()
