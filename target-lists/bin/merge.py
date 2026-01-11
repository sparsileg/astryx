#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Merge multiple astronomical datasets.
Primary (-p) is base; augment Common and Other from secondary (-s) files.
For numeric fields (Size_max, Size_min, Mag, Subr), preserve non-empty primary values.
Outputs comma-separated values with double-quote delimiters.
"""

import sys
import csv
import argparse
import re

def natural_sort_key(text):
    def convert(text):
        return int(text) if text.isdigit() else text.lower()
    return [convert(c) for c in re.split(r'(\d+)', text)]

def merge_lists(p_str, s_str, sep=', '):
    if not s_str:
        return p_str

    # Handle both comma-space and comma-only separators
    p_items = []
    if p_str:
        if ', ' in p_str:
            p_items = [item.strip() for item in p_str.split(', ')]
        else:
            p_items = [item.strip() for item in p_str.split(',')]

    s_items = []
    if s_str:
        if ', ' in s_str:
            s_items = [item.strip() for item in s_str.split(', ')]
        else:
            s_items = [item.strip() for item in s_str.split(',')]

    # Create lowercase versions for comparison
    p_items_lower = [item.lower() for item in p_items]

    # Only add secondary items that don't already exist (case-insensitive)
    new_items = []
    for item in s_items:
        if item and item.lower() not in p_items_lower:
            new_items.append(item)

    return ', '.join(p_items + new_items)

def merge_numeric_field(p_value, s_value):
    """
    Merge numeric field: keep primary if non-empty, otherwise use secondary.
    """
    if p_value and p_value.strip():
        return p_value
    return s_value if s_value else ''

def read_as_dict(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        result = {}
        for row in reader:
            if row['Object'] in result:
                print(f"Warning: Duplicate Object '{row['Object']}' found in {filename}", file=sys.stderr)
            result[row['Object']] = row
        return result

def main():
    parser = argparse.ArgumentParser(description="Merge primary and multiple secondary datasets.")
    parser.add_argument('-p', required=True, help="Primary dataset file")
    parser.add_argument('-s', nargs='+', required=True, help="Secondary dataset file(s)")
    args = parser.parse_args()

    try:
        primary_dict = read_as_dict(args.p)

        # Process each secondary file in order
        for secondary_file in args.s:
            print(f"Processing secondary file: {secondary_file}", file=sys.stderr)
            secondary_dict = read_as_dict(secondary_file)

            # Merge this secondary file into primary
            for obj in primary_dict.keys():
                if obj in secondary_dict:
                    s_row = secondary_dict[obj]

                    # Merge list fields (Common, Other)
                    primary_dict[obj]['Common'] = merge_lists(primary_dict[obj]['Common'], s_row['Common'])
                    primary_dict[obj]['Other'] = merge_lists(primary_dict[obj]['Other'], s_row['Other'])

                    # Merge numeric fields - preserve non-empty primary values
                    primary_dict[obj]['Size_max'] = merge_numeric_field(
                        primary_dict[obj].get('Size_max', ''),
                        s_row.get('Size_max', '')
                    )
                    primary_dict[obj]['Size_min'] = merge_numeric_field(
                        primary_dict[obj].get('Size_min', ''),
                        s_row.get('Size_min', '')
                    )
                    primary_dict[obj]['Mag'] = merge_numeric_field(
                        primary_dict[obj].get('Mag', ''),
                        s_row.get('Mag', '')
                    )
                    primary_dict[obj]['Subr'] = merge_numeric_field(
                        primary_dict[obj].get('Subr', ''),
                        s_row.get('Subr', '')
                    )

            # Add any new objects from this secondary file
            for obj in secondary_dict.keys():
                if obj not in primary_dict:
                    primary_dict[obj] = secondary_dict[obj].copy()

    except FileNotFoundError as e:
        print(f"Error: File not found - {e}", file=sys.stderr)
        sys.exit(1)
    except KeyError as e:
        print(f"Error: Missing required column - {e}", file=sys.stderr)
        sys.exit(1)

    # Updated fields list with all 12 fields (added Catalogue)
    fields = ['Object', 'Catalogue', 'Type', 'RA', 'Dec', 'Const', 'Mag', 'Subr', 'Size_max', 'Size_min', 'Common', 'Other']

    # Create merged rows from the final primary_dict
    merged_rows = []
    for obj in primary_dict.keys():
        merged_rows.append(primary_dict[obj])

    # Sort all merged rows by Object field using natural sort
    merged_rows.sort(key=lambda row: natural_sort_key(row['Object']))

    # Output as CSV with double quotes around each field
    writer = csv.writer(sys.stdout, quoting=csv.QUOTE_ALL)

    # Write header
    writer.writerow(fields)

    # Write data rows
    for row in merged_rows:
        # Use .get() with default empty string to handle missing fields gracefully
        writer.writerow([row.get(field, '') for field in fields])

if __name__ == "__main__":
    main()
