# -*- coding: utf-8 -*-
"""
CSV Target Database Utility
Processes astronomical target database CSV files with cross-referencing capabilities.
"""

import argparse
import csv
import sys
import re
from collections import defaultdict, deque
from datetime import datetime


# Global log file handle
log_file = None


def log(message):
    """Write message to log file if logging is enabled."""
    if log_file:
        log_file.write(message + '\n')
        log_file.flush()


def normalize_whitespace(value):
    """Normalize whitespace and return None if effectively empty."""
    if value is None:
        return None
    normalized = value.strip()
    return normalized if normalized else None


def normalize_designator(name):
    """Normalize object designator to have single space between catalog and number."""
    if not name:
        return name

    name = name.strip()

    # First, collapse multiple spaces to single space
    name = re.sub(r'\s+', ' ', name)

    # Then, insert space between letters and numbers if directly adjacent
    # This changes "NGC1952" to "NGC 1952" but leaves "NGC 1952" unchanged
    name = re.sub(r'([A-Za-z])(\d)', r'\1 \2', name)

    return name


def parse_other_field(other_value):
    """Parse comma-separated Other field into list of designators."""
    if not other_value:
        return []
    return [entry.strip() for entry in other_value.split(',') if entry.strip()]


def deduplicate_other_entries(entries):
    """Remove duplicates while preserving order."""
    seen = set()
    result = []
    for entry in entries:
        normalized = entry.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def normalize_other_field(target):
    """Normalize all entries in the Other field."""
    other_value = target.get('Other')
    if not other_value:
        return

    entries = parse_other_field(other_value)
    normalized_entries = [normalize_designator(entry) for entry in entries]
    deduplicated = deduplicate_other_entries(normalized_entries)

    target['Other'] = ', '.join(deduplicated) if deduplicated else ''


def merge_other_fields(target_object, target_other, source_other):
    """Merge two Other fields, excluding self-reference and deduplicating."""
    target_entries = parse_other_field(target_other)
    source_entries = parse_other_field(source_other)

    # Combine both lists
    combined = target_entries + source_entries

    # Remove self-reference and deduplicate
    filtered = [entry for entry in combined if entry != target_object]
    deduplicated = deduplicate_other_entries(filtered)

    return ', '.join(deduplicated) if deduplicated else ''


def merge_common_names(*names):
    """Merge multiple common name fields, removing duplicates while preserving order."""
    all_names = []

    for name_field in names:
        if name_field:
            names_list = [n.strip() for n in name_field.split(',') if n.strip()]
            all_names.extend(names_list)

    deduplicated = deduplicate_other_entries(all_names)

    return ', '.join(deduplicated) if deduplicated else ''


def extract_catalogue_from_object(object_name):
    """Extract catalogue name from object designation (first word)."""
    if not object_name:
        return None
    parts = object_name.split()
    return parts[0] if parts else None


def build_index(targets):
    """Build object name index from targets."""
    index = {}
    for target in targets:
        object_name = target.get('Object')
        if object_name:
            index[object_name] = target
    return index


def create_missing_records(targets, index, fieldnames):
    """Create records for objects referenced in Other fields but not in database."""
    # Track missing objects and what references them
    missing_refs = defaultdict(list)

    # First pass: find all missing references
    for target in targets:
        target_object = target.get('Object')
        other_value = target.get('Other')

        if not other_value:
            continue

        other_entries = parse_other_field(other_value)

        for other_object in other_entries:
            if other_object not in index:
                missing_refs[other_object].append(target_object)

    if not missing_refs:
        log("No missing records to create")
        return 0

    # Create new records for missing objects
    new_targets = []
    for missing_object, sources in missing_refs.items():
        # Create new record with all fields empty except Object, Catalogue, Other
        new_target = {field: None for field in fieldnames}
        new_target['Object'] = missing_object
        new_target['Catalogue'] = extract_catalogue_from_object(missing_object)
        new_target['Other'] = ', '.join(sources)
        new_targets.append(new_target)

    log(f"Created {len(new_targets)} missing records")

    # Add new targets to the list
    targets.extend(new_targets)

    # Rebuild index with all targets (including newly created ones)
    index.clear()
    for target in targets:
        obj = target.get('Object')
        if obj:
            index[obj] = target

    # Add bidirectional references: if A references B, make sure B references A
    log("Adding bidirectional references...")
    bidirectional_count = 0
    for target in targets:
        target_object = target.get('Object')
        other_value = target.get('Other')

        if not other_value:
            continue

        other_entries = parse_other_field(other_value)

        for other_object in other_entries:
            if other_object not in index:
                continue

            # Check if the referenced object references us back
            referenced_target = index[other_object]
            referenced_other = referenced_target.get('Other', '')
            referenced_entries = parse_other_field(referenced_other) if referenced_other else []

            # If we're not in their Other field, add us
            if target_object not in referenced_entries:
                if referenced_other:
                    referenced_target['Other'] = referenced_other + ', ' + target_object
                else:
                    referenced_target['Other'] = target_object
                bidirectional_count += 1

    log(f"Added {bidirectional_count} bidirectional references")

    return len(new_targets)


def get_catalogue_priority(catalogue, prefer_list):
    """Get priority index for a catalogue (lower is higher priority)."""
    try:
        return prefer_list.index(catalogue)
    except ValueError:
        return len(prefer_list)  # Not in list = lowest priority


def fill_empty_fields(targets, index, prefer_catalogues=None):
    """Fill empty fields by cross-referencing via Other field."""
    filled_count = 0
    overwrite_report = []

    # Parse prefer list if provided
    prefer_list = []
    if prefer_catalogues:
        prefer_list = [cat.strip() for cat in prefer_catalogues.split(',')]

    for target in targets:
        target_object = target.get('Object')
        target_catalogue = target.get('Catalogue')
        other_value = target.get('Other')

        if not other_value:
            continue

        other_entries = parse_other_field(other_value)

        # Collect all common names for merging
        all_common_names = [target.get('Common', '')]

        # For each field, track best source
        field_sources = {}  # field -> (value, source_catalogue, priority)

        for other_object in other_entries:
            if other_object not in index:
                continue

            source_target = index[other_object]
            source_catalogue = source_target.get('Catalogue')

            # Collect common names
            source_common = source_target.get('Common')
            if source_common:
                all_common_names.append(source_common)

            # For each field, decide if we should use this source
            for field in target.keys():
                if field in ['Object', 'Catalogue']:  # Never overwrite these
                    continue

                if field == 'Other':  # Handle Other separately
                    continue

                source_value = source_target.get(field)

                # Skip if source has no value
                if not source_value:
                    continue

                target_value = target.get(field)

                # Determine if we should use this source
                should_use = False

                if not target_value:
                    # Target field is empty - always fill
                    should_use = True
                elif prefer_list and source_catalogue:
                    # Both have values - check priority
                    target_priority = get_catalogue_priority(target_catalogue, prefer_list)
                    source_priority = get_catalogue_priority(source_catalogue, prefer_list)

                    # Use source if it has higher priority (lower index)
                    if source_priority < target_priority:
                        # Check if we already found a better source for this field
                        if field in field_sources:
                            existing_priority = field_sources[field][2]
                            if source_priority < existing_priority:
                                should_use = True
                        else:
                            should_use = True

                if should_use:
                    source_priority = get_catalogue_priority(source_catalogue, prefer_list) if prefer_list else 999
                    field_sources[field] = (source_value, source_catalogue, source_priority)

        # Apply the best sources
        modified = False
        for field, (new_value, source_catalogue, priority) in field_sources.items():
            old_value = target.get(field)

            if old_value != new_value:
                if old_value and new_value:
                    # Overwriting existing data
                    overwrite_report.append({
                        'target': target_object,
                        'target_catalogue': target_catalogue,
                        'field': field,
                        'old_value': old_value,
                        'new_value': new_value,
                        'source': source_catalogue
                    })

                target[field] = new_value
                modified = True

        # Merge common names
        merged_common = merge_common_names(*all_common_names)
        if merged_common != target.get('Common', ''):
            target['Common'] = merged_common
            modified = True

        # Merge Other fields
        for other_object in other_entries:
            if other_object not in index:
                continue

            source_target = index[other_object]
            merged_other = merge_other_fields(
                target_object,
                target.get('Other', ''),
                source_target.get('Other', '')
            )
            if merged_other != target.get('Other', ''):
                target['Other'] = merged_other
                modified = True
                break  # Only need to do this once

        if modified:
            filled_count += 1

    # Print overwrite report
    if overwrite_report:
        log("\nData Overwrite Report (higher-priority sources):")
        log("-" * 70)
        for entry in overwrite_report:
            log(f"  {entry['target']}: {entry['field']} overwritten")
            log(f"    Old ({entry['target_catalogue']}): {entry['old_value']}")
            log(f"    New ({entry['source']}): {entry['new_value']}")

    return filled_count


def find_connected_components(targets, index):
    """Find groups of mutually-referenced objects using graph traversal."""
    # Build adjacency list
    graph = defaultdict(set)

    for target in targets:
        target_object = target.get('Object')
        other_value = target.get('Other')

        if not other_value or not target_object:
            continue

        other_entries = parse_other_field(other_value)

        for other_object in other_entries:
            if other_object in index:
                # Add bidirectional edge
                graph[target_object].add(other_object)
                graph[other_object].add(target_object)

    # Find connected components using BFS
    visited = set()
    components = []

    for node in graph.keys():
        if node in visited:
            continue

        # BFS to find all connected nodes
        component = []
        queue = deque([node])
        visited.add(node)

        while queue:
            current = queue.popleft()
            component.append(current)

            for neighbor in graph[current]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        if len(component) > 1:  # Only care about groups with duplicates
            components.append(component)

    return components


def deduplicate_records(targets, index, dedupe_from_catalogues):
    """Remove duplicate records, keeping non-deletable catalogues and first deletable in list."""

    # Parse dedupe-from list (catalogues that CAN be deleted)
    deletable_list = [cat.strip() for cat in dedupe_from_catalogues.split(',')]
    deletable_set = set(deletable_list)

    # Find connected components
    components = find_connected_components(targets, index)

    if not components:
        log("No duplicate groups found")
        return targets, []

    log(f"\nFound {len(components)} duplicate groups")

    # For each component, determine which to delete
    to_delete = set()
    deletion_report = []

    for component in components:
        # Separate into deletable and non-deletable
        non_deletable = []
        deletable = []

        for obj in component:
            target = index[obj]
            catalogue = target.get('Catalogue')

            if catalogue in deletable_set:
                deletable.append((obj, catalogue))
            else:
                non_deletable.append((obj, catalogue))

        # Keep all non-deletable
        kept_objects = [obj for obj, cat in non_deletable]

        # Among deletable, keep first in priority list
        if deletable:
            # Sort deletable by priority (position in deletable_list)
            deletable_sorted = sorted(deletable, key=lambda x: get_catalogue_priority(x[1], deletable_list))

            # Keep first (highest priority), delete rest
            kept_deletable = deletable_sorted[0]
            kept_objects.append(kept_deletable[0])

            for obj, cat in deletable_sorted[1:]:
                to_delete.add(obj)
                deletion_report.append({
                    'deleted': obj,
                    'deleted_catalogue': cat,
                    'kept': kept_objects,
                    'kept_catalogues': [index[k].get('Catalogue') for k in kept_objects]
                })
        elif len(non_deletable) > 1:
            # All non-deletable - keep all
            pass

    # Filter targets
    filtered_targets = [t for t in targets if t.get('Object') not in to_delete]

    # Print deletion report
    if deletion_report:
        log("\nDeduplication Deletion Report:")
        log("-" * 70)
        for entry in deletion_report:
            kept_str = ', '.join([f"{obj} ({cat})" for obj, cat in zip(entry['kept'], entry['kept_catalogues'])])
            log(f"  Deleted: {entry['deleted']} ({entry['deleted_catalogue']})")
            log(f"    Kept: {kept_str}")

    log(f"\nDeleted {len(to_delete)} duplicate records")

    return filtered_targets, deletion_report


def read_csv_with_index(filepath):
    """Read CSV file or stdin, normalize Other fields, and build object name index."""
    targets = []
    fieldnames = None

    if filepath:
        f = open(filepath, 'r', newline='', encoding='utf-8')
    else:
        f = sys.stdin

    try:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        # Check if we got valid fieldnames
        if fieldnames is None:
            print(f"Error: No data to read from {'stdin' if not filepath else filepath}", file=sys.stderr)
            sys.exit(1)

        # Find Other field
        if 'Other' not in fieldnames:
            print(f"Error: No 'Other' field found in CSV header", file=sys.stderr)
            sys.exit(1)

        # Find Object field
        if 'Object' not in fieldnames:
            print(f"Error: No 'Object' field found in CSV header", file=sys.stderr)
            sys.exit(1)

        for row in reader:
            # Normalize all fields
            normalized_row = {k: normalize_whitespace(v) for k, v in row.items()}
            targets.append(normalized_row)
    finally:
        if filepath:
            f.close()

    # Normalize Other fields for all targets
    log("Normalizing Other field entries...")
    for target in targets:
        normalize_other_field(target)

    # Build index by Object field
    index = build_index(targets)

    return targets, index, fieldnames



def filter_by_catalogue(targets, keep_catalogues):
    """Filter targets to keep only specified catalogues."""
    keep_set = set(cat.strip() for cat in keep_catalogues.split(','))
    filtered = []

    for target in targets:
        catalogue = target.get('Catalogue', '')
        if catalogue and catalogue in keep_set:
            filtered.append(target)

    discarded = len(targets) - len(filtered)
    log(f"Kept {len(filtered)} targets, discarded {discarded}")
    return filtered

def convert_to_extra(targets, to_extra_catalogs):
    """Convert specified catalogs to 'Extra' virtual catalog."""
    to_extra_set = set(cat.strip() for cat in to_extra_catalogs.split(','))
    converted = 0

    for target in targets:
        if target.get('Catalogue') in to_extra_set:
            target['Catalogue'] = 'Extra'
            converted += 1

    return converted

def remove_unknown_types(targets):
    """Remove all targets with type OTHER."""
    filtered = [t for t in targets if t.get('Type') != 'OTHER']
    removed = len(targets) - len(filtered)
    log(f"Removed {removed} unknown OTHER type targets")
    return filtered

def convert_to_stars(targets):
    """Convert 1STAR, 2STAR, and ASTER types to Stars with appropriate Common names."""
    star_type_map = {
        '1STAR': 'Single Star',
        '2STAR': 'Double Star',
        'ASTER': 'Asterism'
    }

    converted = 0
    for target in targets:
        target_type = target.get('Type')
        if target_type in star_type_map:
            # Change type to Stars
            target['Type'] = 'Stars'

            # Append to Common field (handle None values)
            common = target.get('Common') or ''
            common = common.strip()
            star_designation = star_type_map[target_type]

            if common:
                target['Common'] = f"{common} ({star_designation})"
            else:
                target['Common'] = f"({star_designation})"

            converted += 1

    log(f"Converted {converted} star targets (1STAR→Stars, 2STAR→Stars, ASTER→Stars)")
    return targets


def analyze_near_duplicates(targets, index):
    """Analyze cross-referenced objects for duplicate/near-duplicate detection."""

    # Find reciprocal references (A references B and B references A)
    reciprocal_pairs = set()

    for target in targets:
        target_object = target.get('Object')
        other_value = target.get('Other')

        if not other_value or not target_object:
            continue

        other_entries = parse_other_field(other_value)

        for other_object in other_entries:
            if other_object not in index:
                continue

            # Check if other_object also references this target
            other_target = index[other_object]
            other_refs = parse_other_field(other_target.get('Other', ''))

            if target_object in other_refs:
                # Create canonical pair (alphabetically sorted to avoid duplicates)
                pair = tuple(sorted([target_object, other_object]))
                reciprocal_pairs.add(pair)

    if not reciprocal_pairs:
        print("\nNo reciprocal references found")
        return

    # Analyze each pair
    perfect_duplicates = []
    near_duplicates = []

    for obj1, obj2 in sorted(reciprocal_pairs):
        target1 = index[obj1]
        target2 = index[obj2]

        differences = []

        # Compare all fields except Object, Catalogue, Other
        for field in target1.keys():
            if field in ['Object', 'Catalogue', 'Other']:
                continue

            val1 = target1.get(field)
            val2 = target2.get(field)

            # Treat None and empty string as equivalent
            val1_empty = not val1
            val2_empty = not val2

            # If both empty, they match
            if val1_empty and val2_empty:
                continue

            # If values differ
            if val1 != val2:
                differences.append((field, val1 or '""', val2 or '""'))

        if differences:
            near_duplicates.append((obj1, obj2, differences))
        else:
            perfect_duplicates.append((obj1, obj2))

    # Print report
    print("\n" + "=" * 70)
    print("Near Duplicate Analysis")
    print("=" * 70)
    print(f"\nTotal reciprocal reference pairs: {len(reciprocal_pairs)}")
    print(f"Perfect duplicates (no differences): {len(perfect_duplicates)}")
    print(f"Near duplicates (with differences): {len(near_duplicates)}")

    if near_duplicates:
        print("\nDifferences found:")
        print("-" * 70)

        for obj1, obj2, differences in near_duplicates:
            print(f"\n{obj1} ↔ {obj2}:")
            for field, val1, val2 in differences:
                print(f"  {field}: {val1} vs {val2}")

    print("=" * 70)


def generate_statistics(targets):
    """Generate statistics report about the database."""
    catalogue_counts = defaultdict(int)
    catalogue_with_other = defaultdict(int)

    for target in targets:
        catalogue = target.get('Catalogue', 'Unknown')
        if not catalogue:
            catalogue = 'Unknown'

        catalogue_counts[catalogue] += 1

        other_value = target.get('Other')
        if other_value and parse_other_field(other_value):
            catalogue_with_other[catalogue] += 1

    # Build index for duplicate analysis
    index = build_index(targets)

    # Print report
    print("\nDatabase Statistics")
    print("=" * 70)
    print(f"\nTotal targets: {len(targets)}")
    print(f"\nTargets per catalogue:")
    print("-" * 70)

    for catalogue in sorted(catalogue_counts.keys()):
        count = catalogue_counts[catalogue]
        with_other = catalogue_with_other[catalogue]
        pct = (with_other / count * 100) if count > 0 else 0
        print(f"  {catalogue:20s}: {count:5d} targets ({with_other:5d} with Other field, {pct:5.1f}%)")

    print("=" * 70)

    # Analyze near duplicates
    analyze_near_duplicates(targets, index)


def write_csv(filepath, targets, fieldnames):
    """Write targets to CSV file or stdout."""
    if filepath:
        f = open(filepath, 'w', encoding='utf-8', newline='')
    else:
        f = sys.stdout

    try:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()

        for target in targets:
            # Convert None back to empty string for CSV output
            output_row = {k: (v if v is not None else '') for k, v in target.items()}
            writer.writerow(output_row)
    except BrokenPipeError:
        # Ignore broken pipe (e.g., when piping to head)
        pass
    finally:
        if filepath:
            f.close()


def dupe_size_fields(targets):
    """Copy non-empty size value to empty size field."""
    modified_count = 0

    for target in targets:
        size_min = (target.get('Size_min') or '').strip()
        size_max = (target.get('Size_max') or '').strip()

        # If one is empty and the other is not, copy the non-empty to the empty
        if size_min and not size_max:
            target['Size_max'] = size_min
            modified_count += 1
            log(f"  Copied Size_min → Size_max for {target.get('Object')}: {size_min}")
        elif size_max and not size_min:
            target['Size_min'] = size_max
            modified_count += 1
            log(f"  Copied Size_max → Size_min for {target.get('Object')}: {size_max}")

    log(f"Duplicated size values for {modified_count} targets")
    return modified_count


def fix_size_order(targets):
    """Swap Size_min and Size_max if min > max (values are reversed)."""
    swapped_count = 0

    for target in targets:
        size_min_str = (target.get('Size_min') or '').strip()
        size_max_str = (target.get('Size_max') or '').strip()

        if not size_min_str or not size_max_str:
            continue  # Skip if either value is missing

        try:
            size_min = float(size_min_str)
            size_max = float(size_max_str)
        except ValueError:
            continue  # Skip if either value is not numeric

        if size_min > size_max:
            target['Size_min'] = size_max_str
            target['Size_max'] = size_min_str
            swapped_count += 1
            log(f"  Swapped Size_min/Size_max for {target.get('Object')}: {size_min_str} ↔ {size_max_str}")

    log(f"Fixed size order for {swapped_count} targets")
    return swapped_count


def remove_no_size(targets):
    """Remove targets where both Size_min and Size_max are blank."""
    before = len(targets)
    targets = [
        t for t in targets
        if (t.get('Size_min') or '').strip() or (t.get('Size_max') or '').strip()
    ]
    removed = before - len(targets)
    log(f"Removed {removed} targets with no size data")
    return targets


def null_sentinel_magnitudes(targets):
    """Null out sentinel magnitude values (79.9 and 99.9)."""
    SENTINELS = {79.9, 99.9}
    nulled_count = 0
    for target in targets:
        for field in ('Mag', 'Subr'):
            val_str = (target.get(field) or '').strip()
            if val_str:
                try:
                    if float(val_str) in SENTINELS:
                        target[field] = ''
                        nulled_count += 1
                except ValueError:
                    pass
    log(f"Nulled sentinel magnitudes for {nulled_count} targets")
    return nulled_count


def main():
    global log_file

    parser = argparse.ArgumentParser(
        description='Process astronomical target database CSV files'
    )
    parser.add_argument('--in', dest='input_file',
                        help='Input CSV file')
    parser.add_argument('--out', dest='output_file',
                        help='Output CSV file (required for --fill, --create-missing, --dedupe-from, or --keep)')
    parser.add_argument('--log', dest='log_file',
                        help='Log file for operational output (overwritten each run)')
    parser.add_argument('--create-missing', action='store_true',
                        help='Create records for objects referenced in Other but not in database')
    parser.add_argument('--fill', action='store_true',
                        help='Fill empty fields via cross-referencing')
    parser.add_argument('--prefer', dest='prefer_catalogues',
                        help='Comma-separated list of catalogues in accuracy priority order (e.g., "NGC,IC,Messier")')
    parser.add_argument('--dedupe-from', dest='dedupe_from_catalogues',
                        help='Comma-separated list of catalogues that can be deleted (e.g., "NGC,IC,UGC")')
    parser.add_argument('--dupe-size', action='store_true',
                        help='Copy non-empty size value to empty size field (size_min ↔ size_max)')
    parser.add_argument('--to-extra', type=str,
                        help='Comma-separated list of catalogs to convert to "Extra" virtual catalog (e.g., "Pal,RCW,vdB")')
    parser.add_argument('--keep', dest='keep_catalogues',
                        help='Comma-separated list of catalogues to keep (e.g., "Messier,NGC,IC")')
    parser.add_argument('--null-sentinels', action='store_true',
                        help='Null out sentinel magnitude values (79.9 and 99.9)')
    parser.add_argument('--rm-unknown', action='store_true',
                        help='Remove targets with UNKNOWN type')
    parser.add_argument('--rm-no-size', action='store_true',
                        help='Remove targets where both Size_min and Size_max are blank')
    parser.add_argument('--to-stars', action='store_true',
                        help='Convert 1STAR, 2STAR, and ASTER types to Stars with appropriate Common names')
    parser.add_argument('--statistics', action='store_true',
                        help='Generate statistics report')

    args = parser.parse_args()

    # Open log file if specified
    if args.log_file:
        try:
            log_file = open(args.log_file, 'w', encoding='utf-8')
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            log(f"=== Scrubber.py execution started at {timestamp} ===\n")
        except IOError as e:
            print(f"Error: Cannot open log file '{args.log_file}': {e}", file=sys.stderr)
            sys.exit(1)

    try:
        # Validate arguments
        if not args.create_missing and not args.fill and not args.dupe_size and not args.statistics \
           and not args.keep_catalogues and not args.dedupe_from_catalogues and not args.null_sentinels:
            print("Error: Must specify at least one operation (--create-missing, --fill, --dupe-size, --dedupe-from, --statistics, or --keep)",
                  file=sys.stderr)
            sys.exit(1)


        if args.dedupe_from_catalogues and not args.prefer_catalogues:
            print("Error: --dedupe-from requires --prefer to be specified (to ensure best data before deduplication)", file=sys.stderr)
            sys.exit(1)

        # Read input file (includes normalization of Other fields)
        input_source = args.input_file if args.input_file else "stdin"
        log(f"Reading {input_source}...")
        targets, index, fieldnames = read_csv_with_index(args.input_file)
        log(f"Loaded {len(targets)} targets")

        # Execute operations in order
        # 1. Create missing records (before fill so they can participate)
        if args.create_missing:
            log("\nCreating missing records...")
            created_count = create_missing_records(targets, index, fieldnames)
            if created_count > 0:
                # Rebuild index with new records
                index = build_index(targets)

        # 2. Fill empty fields (with preference if specified)
        if args.fill:
            log("\nFilling empty fields via cross-referencing...")
            filled_count = fill_empty_fields(targets, index, args.prefer_catalogues)
            log(f"Modified {filled_count} target-source pairs")

        # 2.5. Duplicate size fields (copy non-empty to empty)
        if args.dupe_size:
            log("\nDuplicating size fields...")
            dupe_count = dupe_size_fields(targets)

        # 2.75. Fix size field order (swap if min > max)
        log("\nChecking size field order...")
        fix_size_order(targets)

        # 3. Deduplicate records (requires prefer to have been run first)
        if args.dedupe_from_catalogues:
            log("\nDeduplicating records...")
            targets, deletion_report = deduplicate_records(targets, index, args.dedupe_from_catalogues)
            # Rebuild index after deletion
            index = build_index(targets)

        # 3.5. Convert specified catalogs to "Extra" virtual catalog
        if args.to_extra:
            log(f"\nConverting catalogs to Extra: {args.to_extra}")
            converted_count = convert_to_extra(targets, args.to_extra)
            log(f"Converted {converted_count} records")

        # 3.75. Remove UNKNOWN type targets
        if args.rm_unknown:
            log("\nRemoving UNKNOWN type targets...")
            targets = remove_unknown_types(targets)

        # 3.8. Remove targets with no size data
        if args.rm_no_size:
            log("\nRemoving targets with no size data...")
            targets = remove_no_size(targets)

        # 4. Filter catalogues after all processing
        if args.keep_catalogues:
            log(f"\nFiltering to keep only: {args.keep_catalogues}")
            targets = filter_by_catalogue(targets, args.keep_catalogues)

        # 5. Convert star types to Stars (after all other processing)
        if args.to_stars:
            log("\nConverting star types to Stars...")
            targets = convert_to_stars(targets)

        # 6. Null sentinel magnitude values (after all fill/cross-reference operations)
        if args.null_sentinels:
            log("\nNulling sentinel magnitude values...")
            null_sentinel_magnitudes(targets)

        # Write output if we did any modification operations
        if args.create_missing or args.fill or args.dupe_size or \
           args.dedupe_from_catalogues or args.to_extra or \
           args.null_sentinels or args.rm_unknown or args.rm_no_size or args.to_stars or args.keep_catalogues:
            output_dest = args.output_file if args.output_file else "stdout"
            log(f"\nWriting to {output_dest}...")
            write_csv(args.output_file, targets, fieldnames)
            log("Done")

        if args.statistics:
            generate_statistics(targets)

    finally:
        # Close log file if it was opened
        if log_file:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            log(f"\n=== Scrubber.py execution completed at {timestamp} ===")
            log_file.close()


if __name__ == '__main__':
    main()
