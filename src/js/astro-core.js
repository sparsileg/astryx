/**
 * astro-core.js
 * Core astronomical calculation functions
 * Pure mathematical functions with no DOM dependencies
 */

// ============================================================================
// Unit Conversion Functions
// ============================================================================

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
}

/**
 * Convert hours to radians
 * @param {number} hours - Time in hours (0-24)
 * @returns {number} Angle in radians
 */
function hoursToRadians(hours) {
    return hours * Math.PI / 12;
}

/**
 * Convert radians to hours
 * @param {number} radians - Angle in radians
 * @returns {number} Time in hours
 */
function radiansToHours(radians) {
    return radians * 12 / Math.PI;
}

// ============================================================================
// Julian Date Functions
// ============================================================================

/**
 * Convert a JavaScript Date object to Julian Date
 * @param {Date} date - JavaScript Date object (UTC)
 * @returns {number} Julian Date
 */
function dateToJD(date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();
    const millisecond = date.getUTCMilliseconds();

    let a = Math.floor((14 - month) / 12);
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;

    let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
             Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

    let dayFraction = (hour + minute/60.0 + second/3600.0 + millisecond/3600000.0) / 24.0;
    return jdn + dayFraction - 0.5;
}

/**
 * Convert Julian Date to JavaScript Date object
 * @param {number} jd - Julian Date
 * @returns {Date} JavaScript Date object (UTC)
 */
function jdToDate(jd) {
    let a = Math.floor(jd + 0.5);
    let b, c;

    if (a < 2299161) {
        c = a + 1524;
    } else {
        b = Math.floor((a - 1867216.25) / 36524.25);
        c = a + b - Math.floor(b / 4) + 1525;
    }

    let d = Math.floor((c - 122.1) / 365.25);
    let e = Math.floor(365.25 * d);
    let f = Math.floor((c - e) / 30.6001);

    let day = c - e - Math.floor(30.6001 * f);
    let month = f - 1;
    let year = d - 4716;

    if (f > 13) {
        month = f - 13;
        year = d - 4715;
    }

    let dayFraction = (jd + 0.5) - a;
    let hours = dayFraction * 24;
    let minutes = (hours % 1) * 60;
    let seconds = (minutes % 1) * 60;
    let milliseconds = (seconds % 1) * 1000;

    return new Date(Date.UTC(year, month - 1, day, Math.floor(hours),
                   Math.floor(minutes), Math.floor(seconds), Math.floor(milliseconds)));
}

// ============================================================================
// Sidereal Time Functions
// ============================================================================

/**
 * Calculate Greenwich Mean Sidereal Time
 * @param {number} jd - Julian Date
 * @returns {number} GMST in hours (0-24)
 */
function getGMST(jd) {
    // Days since J2000.0
    const d = jd - 2451545.0;
    
    // GMST at 0h UT
    const gmst0 = 18.697374558 + 24.06570982441908 * d;
    
    // Normalize to 0-24 range
    let gmst = gmst0 % 24;
    if (gmst < 0) gmst += 24;
    
    return gmst;
}

/**
 * Calculate Local Sidereal Time
 * @param {number} jd - Julian Date
 * @param {number} longitude - Observer's longitude in degrees (West is negative)
 * @returns {number} LST in hours (0-24)
 */
function getLST(jd, longitude) {
    const gmst = getGMST(jd);
    let lst = gmst + longitude / 15.0;
    lst = lst % 24;
    if (lst < 0) lst += 24;
    return lst;
}

// ============================================================================
// Angular Separation
// ============================================================================

/**
 * Calculate angular separation between two celestial objects
 * @param {number} ra1 - Right ascension of first object (hours)
 * @param {number} dec1 - Declination of first object (degrees)
 * @param {number} ra2 - Right ascension of second object (hours)
 * @param {number} dec2 - Declination of second object (degrees)
 * @returns {number} Angular separation in degrees
 */
function getAngularSeparation(ra1, dec1, ra2, dec2) {
    const ra1_rad = hoursToRadians(ra1);
    const dec1_rad = degreesToRadians(dec1);
    const ra2_rad = hoursToRadians(ra2);
    const dec2_rad = degreesToRadians(dec2);

    const cos_sep = Math.sin(dec1_rad) * Math.sin(dec2_rad) +
                   Math.cos(dec1_rad) * Math.cos(dec2_rad) * Math.cos(ra1_rad - ra2_rad);

    return radiansToDegrees(Math.acos(Math.max(-1, Math.min(1, cos_sep))));
}

// ============================================================================
// Altitude Calculation
// ============================================================================

/**
 * Calculate altitude of a celestial object
 * @param {number} jd - Julian Date
 * @param {number} raHours - Right ascension in hours
 * @param {number} decDeg - Declination in degrees
 * @param {number} latitude - Observer's latitude in degrees
 * @param {number} longitude - Observer's longitude in degrees (West is negative)
 * @returns {number} Altitude in degrees
 */
function getAltitude(jd, raHours, decDeg, latitude, longitude) {
    const lst = getLST(jd, longitude);
    let hourAngle = lst - raHours;

    // Normalize hour angle to [-12, +12] range
    hourAngle = ((hourAngle + 12) % 24 + 24) % 24 - 12;

    const h = hoursToRadians(hourAngle);
    const d = degreesToRadians(decDeg);
    const phi = degreesToRadians(latitude);

    const sinAlt = Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(phi) * Math.cos(h);
    return radiansToDegrees(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

/**
 * Calculate azimuth of a celestial object
 * @param {number} jd - Julian Date
 * @param {number} raHours - Right ascension in hours
 * @param {number} decDeg - Declination in degrees
 * @param {number} latitude - Observer's latitude in degrees
 * @param {number} longitude - Observer's longitude in degrees (West is negative)
 * @returns {number} Azimuth in degrees (0° = North, 90° = East, 180° = South, 270° = West)
 */
function getAzimuth(jd, raHours, decDeg, latitude, longitude) {
    const lst = getLST(jd, longitude);
    let hourAngle = lst - raHours;

    // Normalize hour angle to [-12, +12] range
    hourAngle = ((hourAngle + 12) % 24 + 24) % 24 - 12;

    const h = hoursToRadians(hourAngle);
    const d = degreesToRadians(decDeg);
    const phi = degreesToRadians(latitude);

    const sinAlt = Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(phi) * Math.cos(h);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAz = (Math.sin(d) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));

    // Adjust azimuth based on hour angle
    if (Math.sin(h) > 0) {
        azimuth = 2 * Math.PI - azimuth;
    }

    return radiansToDegrees(azimuth);
}

/**
 * Calculate angular separation between two celestial coordinates
 * @param {number} ra1 - Right ascension of first object (degrees)
 * @param {number} dec1 - Declination of first object (degrees)
 * @param {number} ra2 - Right ascension of second object (degrees)
 * @param {number} dec2 - Declination of second object (degrees)
 * @returns {number} Angular separation in degrees
 */
function angularSeparation(ra1, dec1, ra2, dec2) {
    // Convert to radians
    const ra1Rad = degreesToRadians(ra1);
    const dec1Rad = degreesToRadians(dec1);
    const ra2Rad = degreesToRadians(ra2);
    const dec2Rad = degreesToRadians(dec2);

    // Haversine formula for angular separation
    const deltaRA = ra2Rad - ra1Rad;
    const deltaDec = dec2Rad - dec1Rad;

    const a = Math.sin(deltaDec / 2) ** 2 +
              Math.cos(dec1Rad) * Math.cos(dec2Rad) * Math.sin(deltaRA / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(a));

    return radiansToDegrees(c);
}

/**
 * Get interpolated horizon elevation at a given azimuth
 * @param {number} azimuth - Azimuth in degrees (0-360)
 * @param {Array} horizonArray - Array of {azimuth, elevation} points
 * @returns {number} Interpolated elevation in degrees
 */
function getHorizonElevationAtAzimuth(azimuth, horizonArray) {
    if (!horizonArray || horizonArray.length === 0) {
        return 0; // No horizon data = flat horizon at 0°
    }
    
    // Normalize azimuth to 0-360
    azimuth = ((azimuth % 360) + 360) % 360;
    
    // Sort horizon points by azimuth (in case they're not sorted)
    const sorted = [...horizonArray].sort((a, b) => a.azimuth - b.azimuth);
    
    // Find the two points to interpolate between
    let before = sorted[sorted.length - 1]; // Wrap around: last point
    let after = sorted[0]; // Wrap around: first point
    
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].azimuth <= azimuth) {
            before = sorted[i];
            after = sorted[(i + 1) % sorted.length];
        } else {
            break;
        }
    }
    
    // Handle wrap-around case (e.g., azimuth = 5°, points at 350° and 10°)
    let azBefore = before.azimuth;
    let azAfter = after.azimuth;
    
    if (azAfter < azBefore) {
        azAfter += 360; // Wrap around
        if (azimuth < before.azimuth) {
            azimuth += 360;
        }
    }
    
    // Linear interpolation
    const fraction = (azimuth - azBefore) / (azAfter - azBefore);
    const elevation = before.elevation + fraction * (after.elevation - before.elevation);
    
    return elevation;
}

/**
 * Check if a target is visible above both minimum altitude and horizon profile
 * @param {number} altitude - Target altitude in degrees
 * @param {number} azimuth - Target azimuth in degrees
 * @param {number} minAltitude - Minimum altitude constraint in degrees
 * @param {Array} horizonArray - Array of {azimuth, elevation} points
 * @returns {boolean} True if target is visible
 */
function isAboveHorizon(altitude, azimuth, minAltitude, horizonArray) {
    // Check minimum altitude constraint
    if (altitude < minAltitude) {
        return false;
    }
    
    // Check horizon profile
    const horizonElevation = getHorizonElevationAtAzimuth(azimuth, horizonArray);
    if (altitude < horizonElevation) {
        return false;
    }
    
    return true;
}

