#!/usr/bin/env python3
"""
Analyze Best Month differences across multiple location database files.

Usage:
    python analyze_best_months.py file1.json file2.json file3.json

Each file should contain a Specula database export with targetDatabase array.
"""

import json
import sys
from collections import defaultdict
from typing import Dict, List, Optional, Tuple


def load_database(filepath: str) -> Tuple[str, Dict[str, dict]]:
    """
    Load a database file and extract targets indexed by object name.

    Returns:
        Tuple of (location_name, dict of targets by object name)
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Try to get location name from lastBestMonthsLocation setting
    location_name = None
    settings = data.get('settings', {})
    if isinstance(settings, list) and len(settings) > 0:
        # Settings stored as array with single object
        location_name = settings[0].get('data', {}).get('lastBestMonthsLocation')
    elif isinstance(settings, dict):
        # Settings stored as object
        location_name = settings.get('lastBestMonthsLocation')

    # Fallback to filename if not found in settings
    if not location_name:
        import os
        location_name = os.path.basename(filepath).replace('.json', '')

    # Index targets by object name
    targets = {}
    for target in data.get('targetDatabase', []):
        targets[target['object']] = target

    return location_name, targets


def calculate_month_difference(month1: Optional[int], month2: Optional[int]) -> Optional[int]:
    """
    Calculate the shortest distance between two months (1-12).
    Accounts for wrap-around (e.g., Dec to Jan = 1 month, not 11).

    Returns:
        Minimum month difference, or None if either month is None
    """
    if month1 is None or month2 is None:
        return None

    # Calculate both forward and backward differences
    forward_diff = (month2 - month1) % 12
    backward_diff = (month1 - month2) % 12

    # Return the smaller difference
    return min(forward_diff, backward_diff)


def analyze_databases(filepaths: List[str]) -> None:
    """
    Analyze best month differences across multiple database files.
    """
    # Load all databases
    print("Loading databases...")
    databases = {}
    for filepath in filepaths:
        try:
            location_name, targets = load_database(filepath)
            databases[location_name] = targets
            print(f"  Loaded {location_name}: {len(targets)} targets")
        except Exception as e:
            print(f"  Error loading {filepath}: {e}")
            sys.exit(1)

    print()

    # Get all unique target names across all databases
    all_targets = set()
    for targets in databases.values():
        all_targets.update(targets.keys())

    print(f"Total unique targets across all databases: {len(all_targets)}")
    print()

    # Statistics per location
    print("=" * 80)
    print("STATISTICS PER LOCATION")
    print("=" * 80)

    for location_name, targets in databases.items():
        total = len(targets)
        valid = sum(1 for t in targets.values() if t.get('bestMonth') is not None)
        null_count = total - valid

        print(f"\n{location_name}:")
        print(f"  Total targets: {total}")
        print(f"  Valid bestMonth: {valid} ({valid/total*100:.1f}%)")
        print(f"  Null bestMonth: {null_count} ({null_count/total*100:.1f}%)")

    print()

    # Pairwise comparisons
    location_names = list(databases.keys())

    if len(location_names) < 2:
        print("Need at least 2 databases to compare.")
        return

    print("=" * 80)
    print("PAIRWISE COMPARISONS")
    print("=" * 80)

    for i in range(len(location_names)):
        for j in range(i + 1, len(location_names)):
            loc1 = location_names[i]
            loc2 = location_names[j]

            print(f"\n{loc1} vs {loc2}")
            print("-" * 80)

            compare_two_locations(databases[loc1], databases[loc2], loc1, loc2)

    # Overall difference analysis across all locations
    if len(location_names) > 2:
        print()
        print("=" * 80)
        print("OVERALL ANALYSIS (ALL LOCATIONS)")
        print("=" * 80)
        analyze_all_locations(databases, all_targets)


def compare_two_locations(targets1: Dict[str, dict], targets2: Dict[str, dict],
                         loc1: str, loc2: str) -> None:
    """
    Compare best months between two locations.
    """
    # Find common targets
    common_targets = set(targets1.keys()) & set(targets2.keys())

    if not common_targets:
        print("  No common targets found.")
        return

    # Analyze differences
    differences = []
    same_count = 0
    both_null = 0
    one_null = 0

    for target_name in common_targets:
        month1 = targets1[target_name].get('bestMonth')
        month2 = targets2[target_name].get('bestMonth')

        if month1 is None and month2 is None:
            both_null += 1
        elif month1 is None or month2 is None:
            one_null += 1
        else:
            diff = calculate_month_difference(month1, month2)
            if diff == 0:
                same_count += 1
            else:
                differences.append((target_name, month1, month2, diff))

    # Statistics
    comparable = same_count + len(differences)

    print(f"  Common targets: {len(common_targets)}")
    print(f"  Both have valid bestMonth: {comparable} ({comparable/len(common_targets)*100:.1f}%)")
    print(f"  Both null: {both_null}")
    print(f"  One null: {one_null}")
    print()

    if comparable > 0:
        print(f"  Same bestMonth: {same_count} ({same_count/comparable*100:.1f}%)")
        print(f"  Different bestMonth: {len(differences)} ({len(differences)/comparable*100:.1f}%)")

        if differences:
            # Sort by difference magnitude
            differences.sort(key=lambda x: x[3], reverse=True)

            # Difference distribution
            diff_counts = defaultdict(int)
            for _, _, _, diff in differences:
                diff_counts[diff] += 1

            print()
            print("  Difference distribution:")
            for diff in sorted(diff_counts.keys()):
                count = diff_counts[diff]
                month_label = "month" if diff == 1 else "months"
                print(f"    {diff} {month_label}: {count} targets ({count/len(differences)*100:.1f}%)")

            # Show examples of largest differences
            print()
            print(f"  Top 10 largest differences:")
            for target_name, month1, month2, diff in differences[:10]:
                print(f"    {target_name}: {loc1}={month1}, {loc2}={month2} (diff={diff})")


def analyze_all_locations(databases: Dict[str, Dict[str, dict]],
                          all_targets: set) -> None:
    """
    Analyze variance across all locations for each target.
    """
    # For each target, collect all bestMonth values across locations
    target_variance = []

    for target_name in all_targets:
        months = []
        locations_with_data = []

        for location_name, targets in databases.items():
            if target_name in targets:
                month = targets[target_name].get('bestMonth')
                if month is not None:
                    months.append(month)
                    locations_with_data.append(location_name)

        # If we have data from multiple locations, calculate variance
        if len(months) >= 2:
            # Calculate max difference (circular distance)
            max_diff = 0
            for i in range(len(months)):
                for j in range(i + 1, len(months)):
                    diff = calculate_month_difference(months[i], months[j])
                    if diff > max_diff:
                        max_diff = diff

            if max_diff > 0:
                target_variance.append((target_name, months, locations_with_data, max_diff))

    if not target_variance:
        print("\nNo targets with varying bestMonth across locations.")
        return

    # Sort by max difference
    target_variance.sort(key=lambda x: x[3], reverse=True)

    print(f"\nTargets with bestMonth variance: {len(target_variance)}")
    print(f"\nTop 20 targets with most variance:")
    print()

    for target_name, months, locations, max_diff in target_variance[:20]:
        print(f"  {target_name} (max diff: {max_diff} months)")
        for i, location in enumerate(locations):
            print(f"    {location}: {months[i]}")
        print()

    # Variance distribution
    variance_counts = defaultdict(int)
    for _, _, _, max_diff in target_variance:
        variance_counts[max_diff] += 1

    print("Variance distribution (max difference):")
    for diff in sorted(variance_counts.keys()):
        count = variance_counts[diff]
        month_label = "month" if diff == 1 else "months"
        print(f"  {diff} {month_label}: {count} targets ({count/len(target_variance)*100:.1f}%)")


def main():
    if len(sys.argv) < 3:
        print("Usage: python analyze_best_months.py file1.json file2.json [file3.json ...]")
        print()
        print("Analyzes bestMonth differences across multiple Specula database exports.")
        sys.exit(1)

    filepaths = sys.argv[1:]
    analyze_databases(filepaths)


if __name__ == '__main__':
    main()
