# Scrubber.py Documentation

## Overview

`scrubber.py` is a CSV-based astronomical target database utility that processes deep sky object catalogs with cross-referencing capabilities. It manages relationships between objects through the "Other" field, fills missing data from related records, handles deduplication, and maintains bidirectional references.

## Command-Line Options

### Input/Output

**`--in <filepath>`** (optional)
- Input CSV file path
- If not specified, reads from **stdin**
- Allows piping between scrubber instances

**`--out <filepath>`** (optional)
- Output CSV file path
- If not specified, writes to **stdout**
- Allows piping between scrubber instances

**`--log <filepath>`** (optional)
- Log file for operational details
- Operational output written to log file (overwrite mode)
- Statistics written to stdout
- Without --log, operations run silently

### Operations

**`--create-missing`**
- Creates records for objects referenced in "Other" fields but not present in database
- Establishes **bidirectional references** automatically
- If A references B, ensures B references A back
- Essential for proper cross-referencing before --fill

**`--fill`**
- Fills empty fields via cross-referencing through "Other" field
- Uses --prefer list to resolve conflicts when both records have values
- Merges common names from all referenced objects
- Merges Other fields to maintain complete cross-references

**`--dupe-size`**
- Copies non-empty size value to empty size field
- If `Size_min` is empty and `Size_max` is 13.8, copies 13.8 to `Size_min`
- If `Size_max` is empty and `Size_min` is 5.7, copies 5.7 to `Size_max`
- Only fills empty fields; leaves existing values unchanged

**`--prefer <catalog_list>`**
- Comma-separated list of catalogs in accuracy priority order
- Example: `"NGC,IC,PK,UGC,Messier"`
- **Only applies when BOTH records have values for the same field**
- Empty fields are filled from any source regardless of priority
- Higher priority (earlier in list) = more trusted data source
- Required when using --dedupe-from

**`--dedupe-from <catalog_list>`**
- Comma-separated list of catalogs from which duplicate target records CAN be deleted during deduplication
- Will not delete records from catalogs not in the list
- The <catalog list> itself defines the priority order. Of the catalogs in
  the list, put the most trusted first to allow targets to be deleted first
  from catalogs near the end of the list
- Example: `--dedupe-from "UGC,PGC"` will not delete target records from
  NGC/IC/Messier but can remove duplicate records from the UGC/PGC catalogs.
  

**`--keep <catalog_list>`**
- Comma-separated list of catalogs to keep
- Deletes all catalogs not in the list
- Runs after all other processing

**`--statistics`**
- Generates statistics report
- Can be combined with other operations
- Does not require --out

### Requirements

At least one operation must be specified: `--create-missing`, `--fill`, `--dupe-size`, `--dedupe-from`, `--statistics`, or `--keep`

## CSV File Format

### Fields

- **Object**: Unique identifier (e.g., "NGC 1952", "M 1", "Abell 21")
- **Catalogue**: Catalog name (e.g., "NGC", "Messier", "Abell", "PK")
- **Type**: Object type code (e.g., "PLNNB", "GALXY", "OPNCL")
- **RA**: Right Ascension (decimal hours)
- **Dec**: Declination (decimal degrees)
- **Const**: Constellation (3-letter IAU code)
- **Mag**: Visual magnitude
- **Subr**: Surface brightness
- **Size_max**: Maximum angular size (arc minutes)
- **Size_min**: Minimum angular size (arc minutes)
- **Common**: Common name(s), comma-separated
- **Other**: Comma-separated list of alternate designations

### CSV Format Details

- All fields quoted (QUOTE_ALL)
- Empty fields represented as empty strings `""`
- UTF-8 encoding
- Standard CSV with comma delimiter

## Operation Order

Operations execute in this fixed order when multiple options are specified:

1. **--create-missing**: Create records and establish bidirectional references
2. **--fill**: Fill empty fields via cross-referencing
3. **--dupe-size**: Duplicate size values
4. **--dedupe-from**: Remove duplicate records
5. **--keep**: Delete catalogs not in the list

This order ensures:
- Missing records exist before filling
- Bidirectional references exist before filling
- Data is complete before deduplication
- Catalog deletion happens last

## How Operations Work

### Create Missing Records

When A references B in its "Other" field but B doesn't exist:

1. Creates new record for B with Object and Catalogue fields populated
2. Sets B's Other field to reference A
3. After all missing records created, establishes bidirectional references:
   - If A→B, ensures B→A
   - If B→C, ensures C→B
   - Results in fully connected reference graph

**Example:**

Input:
```csv
"Abell 21","Abell","","","","","","","","","Medusa Nebula","Sh 2-274"
"PK 205+14.1","PK","PLNNB","7.483","13.25","GEM","11.3","16.4","10","6","","Abell 21"
```

After --create-missing:
```csv
"Abell 21","Abell","","","","","","","","","Medusa Nebula","Sh 2-274, PK 205+14.1"
"PK 205+14.1","PK","PLNNB","7.483","13.25","GEM","11.3","16.4","10","6","","Abell21,Sh 2-274"
"Sh 2-274","Sh","","","","","","","","","","Abell 21,PK 205+14.1"
```

Note: All records now reference each other

### Fill Empty Fields

For each target, examines all objects referenced in its "Other" field:

1. **For empty target fields**: Fills from any source (--prefer not consulted)
2. **For non-empty target fields**: Only overwrites if source has higher priority (per --prefer list)
3. **Common names**: Merges all unique common names from target and all sources
4. **Other fields**: Merges all unique designators to maintain complete cross-reference graph

**Priority Rules:**
- Empty field + any source = **FILL** (ignore priority)
- Non-empty field + lower priority source = **KEEP** existing
- Non-empty field + higher priority source = **OVERWRITE** with source

**Example:**

After --fill with --prefer "NGC,PK,IC,Messier,Abell":
```csv
"Abell 21","Abell","PLNNB","7.483","13.25","GEM","11.3","16.4","10","6","Medusa Nebula","Sh 2-274, PK 205+14.1"
"PK 205+14.1","PK","PLNNB","7.483","13.25","GEM","11.3","16.4","10","6","Medusa Nebula","Abell 21, Sh 2-274"
"Sh 2-274","Sh","PLNNB","7.483","13.25","GEM","11.3","16.4","10","6","Medusa Nebula","Abell 21, PK 205+14.1"
```

All three records now have:
- Complete astronomical data (from PK, highest priority with data)
- Merged common name "Medusa Nebula"
- Complete bidirectional cross-references

### Duplicate Size Fields

Simple operation that ensures size consistency:

```
If Size_min = "" and Size_max = "13.8" → Size_min = "13.8"
If Size_max = "" and Size_min = "13.8" → Size_max = "13.8"
If both have values → no change
If both empty → no change
```

### Deduplicate Records

Removes duplicate records based on cross-references and catalog priority:

**Process:**
1. Identifies groups of objects that reference each other
2. Within each group:
   - Keeps all records from catalogs NOT in --dedupe-from list
   - Will delete duplicate records in catalogs in --dedupe-from list based
     on the order of catalogs in the list. Records are first to be deleted
     from catalogs near the end of the list.


**Example:**

```
--dedupe-from "IC,Messier"

Group: NGC 1952 ↔ M 1 ↔ IC 1234
Result: Keeps NGC 1952 only (not in dedupe-from list)

Group: IC 2000 ↔ M 42
Result: Keeps IC 2000 (IC is first in dedupe-from, M comes later in prefer
list so records are deleted from M first)
```

### Keep Catalogs

Simple filter applied last:
```
--keep "NGC,IC,Messier"
Keeps only: NGC, IC, and Messier catalogs and their records
Discards: All other catalogs and records
```

## Usage Examples

### Basic Examples


**Fill empty fields with priority:**
```bash
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --fill \
  --prefer "NGC,IC,Messier"
```

**Create missing records and fill:**
```bash
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --create-missing \
  --fill \
  --prefer "NGC,IC,PK,Messier,Abell"
```

**Deduplicate records from specified catalogs:**
```bash
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --dedupe-from "IC,UGC,PGC"
```

### Piping Examples

**Chain multiple operations:**
```bash
python scrubber.py \
  --in raw_data.csv \
  --create-missing \
  --fill \
  --prefer "NGC,IC,Messier" \
| python scrubber.py \
  --out final.csv \
  --keep "NGC,IC,Messier,Caldwell"
```


**Delete catalogs then fill:**
```bash
cat large_catalog.csv \
| python scrubber.py \
  --keep "NGC,IC" \
| python scrubber.py \
  --out filtered_filled.csv \
  --fill \
  --prefer "NGC,IC"
```

### Complete Workflow Example

**Full processing pipeline with logging:**

```bash
# Step 1: Create missing records and fill data
python scrubber.py \
  --in raw_catalog.csv \
  --log step1.log \
  --create-missing \
  --fill \
  --dupe-size \
  --prefer "NGC,IC,PK,UGC,Pal,Sharpless,RCW,vdB,Abell,Arp,Caldwell,Barnard,Messier" \
| \
# Step 2: Deduplicate and delete catalogs
python scrubber.py \
  --out final_catalog.csv \
  --log step2.log \
  --dedupe-from "UGC,PGC,ESO" \
  --keep "NGC,IC,Messier,Caldwell,Abell,Barnard,Sharpless"

# Step 3: Generate statistics
python scrubber.py \
  --in final_catalog.csv \
  --statistics
```

## Best Practices

### Catalog Priority Order

Recommended priority order based on data quality:

```
--prefer "NGC,IC,PK,UGC,Pal,Sharpless,RCW,vdB,Abell,Arp,Caldwell,Barnard,Messier"
```

**Rationale:**
- NGC/IC: Professional catalogs with accurate coordinates
- PK (Planetary Nebula Catalog): Specialized, highly accurate
- Messier: Historical catalog, less precise coordinates

### Operation Sequence

**For best results, run operations in this order:**

1. **--create-missing** first to establish complete reference graph
2. **--fill** to populate data from cross-references
3. **--dupe-size** to ensure size field consistency
4. **--dedupe-from** to remove duplicates
5. **--keep** last to filter final output

### Logging Strategy

**Use --log for complex operations:**
```bash
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --log operation.log \
  --create-missing \
  --fill \
  --prefer "NGC,IC,Messier"
```

**Review log files for:**
- Number of missing records created
- Number of bidirectional references added
- Number of target-source pairs modified
- Data overwrite reports (when higher priority sources overwrite existing data)
- Number of records deduplicated

### Incremental Processing

**For large datasets, use piping to separate concerns:**

```bash
# First: Prepare data
python scrubber.py \
  --in huge_catalog.csv \
  --create-missing \
  --fill \
  --prefer "NGC,IC,Messier" \
> prepared.csv

# Then: Filter and deduplicate
python scrubber.py \
  --in prepared.csv \
  --out final.csv \
  --dedupe-from "UGC,PGC" \
  --keep "NGC,IC,Messier"
```

## Common Issues and Solutions

### Issue: Data Not Filling

**Symptom:** Fields remain empty after --fill

**Causes:**
1. Missing bidirectional references
2. Referenced objects don't have data either
3. Prefer list preventing overwrite

**Solutions:**
```bash
# Always run --create-missing before --fill
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --create-missing \
  --fill \
  --prefer "NGC,IC,Messier"

# Check log to verify references were created
python scrubber.py \
  --in input.csv \
  --log debug.log \
  --create-missing
```

### Issue: Unexpected Deduplication

**Symptom:** Wrong records deleted

**Cause:** Incorrect --dedupe-from or --prefer order

**Solution:**
```bash
# List catalogs you want DELETED in --dedupe-from
# List catalogs in accuracy order in --prefer
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --prefer "NGC,IC,Messier" \
  --dedupe-from "UGC,PGC"  # Only UGC and PGC can be deleted
```

### Issue: Broken Pipe When Piping

**Symptom:** `BrokenPipeError` when piping to commands like `head`

**Cause:** Downstream command closes pipe early

**Solution:** This is normal and handled internally. The error is caught and suppressed.

```bash
# This is fine - broken pipe handled gracefully
python scrubber.py --in data.csv | head -20
```

## Advanced Usage

### Multi-Stage Processing

**Process different catalog groups separately:**

```bash
# Process NGC/IC group
cat all_data.csv \
| python scrubber.py --keep "NGC,IC" \
| python scrubber.py \
    --create-missing \
    --fill \
    --prefer "NGC,IC" \
> ngc_ic_processed.csv

# Process Messier group
cat all_data.csv \
| python scrubber.py --keep "Messier" \
| python scrubber.py \
    --create-missing \
    --fill \
> messier_processed.csv

# Merge and deduplicate
# see merge.py to do this an easier way
cat ngc_ic_processed.csv messier_processed.csv \
| python scrubber.py \
    --out final.csv \
    --dedupe-from "Messier" \
    --prefer "NGC,IC,Messier"
```

### Validation Workflow

**Validate data before and after processing:**

```bash
# Before processing
python scrubber.py --in input.csv --statistics > before_stats.txt

# Process
python scrubber.py \
  --in input.csv \
  --out output.csv \
  --create-missing \
  --fill \
  --prefer "NGC,IC,Messier"

# After processing
python scrubber.py --in output.csv --statistics > after_stats.txt

# Compare
diff before_stats.txt after_stats.txt
```

### Data Quality Enhancement

**Comprehensive data enhancement pipeline:**

```bash
python scrubber.py \
  --in raw_data.csv \
  --log enhance.log \
  --create-missing \
  --fill \
  --dupe-size \
  --prefer "NGC,IC,PK,UGC,Pal,Sharpless,RCW,vdB,Abell,Arp,Caldwell,Barnard,Messier" \
| python scrubber.py \
  --out enhanced_data.csv \
  --dedupe-from "UGC,PGC,ESO,CGCG" \
  --keep "NGC,IC,Messier,Caldwell,Abell,Barnard,Sharpless,PK"
```

## Technical Notes

### Catalog Name Consistency

Catalog names must be consistent throughout:
- Database field: "Sharpless"
- --prefer list: "Sharpless"
- --keep list: "Sharpless"
- --dedupe-from list: "Sharpless"

### Field Name Case Sensitivity

Field names are case-sensitive:
- "Object" (not "object")
- "Catalogue" (not "catalog")
- "Other" (not "other")
- "Size_min" (not "size_min")
- "Size_max" (not "size_max")

### Performance Considerations

**For very large catalogs (100,000+ records):**
- Use --log to track progress
- Consider splitting into smaller batches
- Use piping to break into stages
- Filter early with --keep to reduce data volume

### Memory Usage

The script loads entire CSV into memory. For catalogs with:
- <50,000 records: No issues
- 50,000-200,000 records: Moderate memory usage (1-2 GB)
- >200,000 records: Consider batch processing

## Version History

- **Current**: Added stdin/stdout support, --dupe-size, bidirectional references in --create-missing
- **Previous**: TSV to CSV migration, improved deduplication logic

## Support

For issues or questions about scrubber.py, refer to:
- Log files for operational details
- Statistics output for data quality metrics
- This documentation for usage examples
