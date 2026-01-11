/**
 * utils-csv.js
 * CSV parsing utilities for target database import
 */

const CSVUtils = {
    /**
     * Parse a single CSV line handling quotes and delimiters
     */
    parseCSVLine(line, delimiter = ',') {
        const fields = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                fields.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        fields.push(current.trim().replace(/^"|"$/g, ''));
        return fields;
    },
    
    /**
     * Parse target database CSV with dynamic headers
     * Expected format: Header row with field names, then data rows
     * Required fields: Object, Type, RA, DEC, Const (or Constellation)
     * Additional fields will be preserved as-is
     * Returns: { targets: [], errors: [] }
     */
    parseTargetCSV(csvText) {
        const lines = csvText.split('\n');
        const targets = [];
        const errors = [];
        
        if (lines.length === 0) {
            errors.push('Empty CSV file');
            return { targets, errors };
        }
        
        // Detect delimiter (comma or tab)
        const sampleLine = lines[1] || lines[0];
        const hasTab = sampleLine.includes('\t');
        const delimiter = hasTab ? '\t' : ',';
        
        // Parse header row to get field names
        const headerLine = lines[0].trim();
        if (!headerLine) {
            errors.push('Empty CSV file');
            return { targets, errors };
        }
        
        const headers = this.parseCSVLine(headerLine, delimiter).map(h => h.toLowerCase().trim());
        
        // Validate required headers
        const requiredHeaders = ['object', 'type', 'ra', 'dec'];
        const hasConstellation = headers.includes('const') || headers.includes('constellation');
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
            errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
            return { targets, errors };
        }
        
        if (!hasConstellation) {
            errors.push('Missing required header: Const or Constellation');
            return { targets, errors };
        }
        
        // Process data rows (skip header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;
            
            if (!line) {
                continue; // Skip empty lines
            }
            
            const fields = this.parseCSVLine(line, delimiter);
            
            if (fields.length !== headers.length) {
                errors.push(`Line ${lineNumber}: Field count mismatch (expected ${headers.length}, got ${fields.length})`);
                continue;
            }
            
            // Build target object dynamically from headers
            const target = {};
            headers.forEach((header, index) => {
                target[header] = fields[index].trim();
            });
            
            // Normalize field names (const -> constellation)
            if (target.const && !target.constellation) {
                target.constellation = target.const;
                delete target.const;
            }
            
            // Validate required fields are not empty
            if (!target.object) {
                errors.push(`Line ${lineNumber}: Missing Object name`);
                continue;
            }
            
            if (!target.type) {
                errors.push(`Line ${lineNumber}: Missing Type`);
                continue;
            }
            
            if (!target.ra) {
                errors.push(`Line ${lineNumber}: Missing RA coordinate`);
                continue;
            }
            
            if (!target.dec) {
                errors.push(`Line ${lineNumber}: Missing DEC coordinate`);
                continue;
            }
            
            // if (!target.constellation) {
            //     errors.push(`Line ${lineNumber}: Missing Constellation`);
            //     continue;
            // }
            
            // Validate and convert RA value
            const raValue = parseFloat(target.ra);
            if (isNaN(raValue)) {
                errors.push(`Line ${lineNumber}: Invalid RA value '${target.ra}' - must be numeric`);
                continue;
            }
            
            if (raValue < 0 || raValue >= 24) {
                errors.push(`Line ${lineNumber}: Invalid RA value '${target.ra}' - must be between 0 and 24 hours`);
                continue;
            }
            
            // Validate and convert DEC value
            const decValue = parseFloat(target.dec);
            if (isNaN(decValue)) {
                errors.push(`Line ${lineNumber}: Invalid DEC value '${target.dec}' - must be numeric`);
                continue;
            }
            
            if (decValue < -90 || decValue > 90) {
                errors.push(`Line ${lineNumber}: Invalid DEC value '${target.dec}' - must be between -90 and +90 degrees`);
                continue;
            }
            
            // Convert RA and DEC to numbers, keep all other fields as strings
            target.ra = raValue;
            target.dec = decValue;
            
            // Add valid target (with all fields, including any additional ones)
            targets.push(target);
        }
        
        return { targets, errors };
    }
};

