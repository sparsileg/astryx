/**
 * astro-target.js
 * Target visibility calculations (rise, set, visibility windows)
 */

/**
 * Check if target is visible above minimum altitude during observation window
 * @param {number} duskJD - Dusk Julian Date
 * @param {number} dawnJD - Dawn Julian Date
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @param {number} minAltitude - Minimum altitude threshold (degrees)
 * @returns {boolean} True if target is visible above minimum altitude
 */
function isTargetVisibleDuringWindow(duskJD, dawnJD, raHours, decDeg, latitude, longitude, minAltitude) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    const steps = Math.ceil((dawnJD - duskJD) / stepSize);

    let maxAlt = -90;
    for (let i = 0; i <= steps; i++) {
        const testJD = duskJD + i * stepSize;
        const altitude = getAltitude(testJD, raHours, decDeg, latitude, longitude);
        if (altitude > maxAlt) maxAlt = altitude;
        if (altitude >= minAltitude) {
            return true;
        }
    }
    return false;
}

/**
 * Find when target rises above minimum altitude (and horizon if provided) within search window
 * General-purpose version with explicit start/end times
 * @param {number} startJD - Search window start (Julian Date)
 * @param {number} endJD - Search window end (Julian Date)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} minAltitude - Minimum altitude threshold (degrees)
 * @param {Array} horizonArray - Optional array of {azimuth, elevation} points for horizon profile
 * @returns {number|null} JD when target rises, or null if not found
 */
function findTargetRise(startJD, endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray = null) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    let jd = startJD;

    // Check initial visibility
    const startAltitude = getAltitude(startJD, raHours, decDeg, latitude, longitude);
    const startAzimuth = getAzimuth(startJD, raHours, decDeg, latitude, longitude);
    let prevVisible = isAboveHorizon(startAltitude, startAzimuth, minAltitude, horizonArray);

    // Search through window for crossing from not visible to visible
    while (jd <= endJD) {
        const altitude = getAltitude(jd, raHours, decDeg, latitude, longitude);
        const azimuth = getAzimuth(jd, raHours, decDeg, latitude, longitude);
        const isVisible = isAboveHorizon(altitude, azimuth, minAltitude, horizonArray);

        // Detect crossing from not visible to visible
        if (!prevVisible && isVisible) {
            return jd;
        }

        prevVisible = isVisible;
        jd += stepSize;
    }

    return null;
}

function findTargetSet(startJD, endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray = null) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    let jd = startJD;
    let lastSetJD = null; // Track the LAST set time

    // Check initial visibility
    const startAltitude = getAltitude(startJD, raHours, decDeg, latitude, longitude);
    const startAzimuth = getAzimuth(startJD, raHours, decDeg, latitude, longitude);
    let prevVisible = isAboveHorizon(startAltitude, startAzimuth, minAltitude, horizonArray);

    // Search through entire window, tracking the LAST set time
    while (jd <= endJD) {
        const altitude = getAltitude(jd, raHours, decDeg, latitude, longitude);
        const azimuth = getAzimuth(jd, raHours, decDeg, latitude, longitude);
        const isVisible = isAboveHorizon(altitude, azimuth, minAltitude, horizonArray);

        // Detect crossing from visible to not visible
        if (prevVisible && !isVisible) {
            lastSetJD = jd; // Update to latest set time
        }

        prevVisible = isVisible;
        jd += stepSize;
    }

    // Check if target is still visible at end of window
    const endAltitude = getAltitude(endJD, raHours, decDeg, latitude, longitude);
    const endAzimuth = getAzimuth(endJD, raHours, decDeg, latitude, longitude);
    const visibleAtEnd = isAboveHorizon(endAltitude, endAzimuth, minAltitude, horizonArray);

    // If visible at end, any earlier set was temporary (obstruction) - return null
    if (visibleAtEnd) {
        console.log(`  Target visible at end of window - no final set`);
        return null;
    }

    if (!lastSetJD) {
        console.log(`  No set found - target stays invisible throughout`);
    }
    return lastSetJD; // Return the LAST set time found
}

/**
 * Calculate noon-to-noon JD window for a given date
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {number} timezone - Timezone offset in standard time (hours)
 * @param {boolean} isDST - Whether DST is active on this date
 * @returns {Object} { startJD, endJD } - Noon today to noon tomorrow in JD
 */
function getNoonToNoonWindow(dateStr, timezone, isDST) {
    const dateParts = dateStr.split('-');
    const noonDate = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        12, 0, 0
    );

    // Convert directly to JD without timezone adjustment
    // (matching how daily-visibility-view.js does it)
    const noonJD = dateToJD(noonDate);
    const noonNextDayJD = noonJD + 1;

    return { startJD: noonJD, endJD: noonNextDayJD };
}

/**
 * Find when target transits (crosses meridian, RA = LST) within search window
 * @param {number} startJD - Search window start (Julian Date)
 * @param {number} endJD - Search window end (Julian Date)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @returns {number|null} JD when target transits, or null if not found
 */
function findTargetTransit(startJD, endJD, raHours, dec, longitude) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    let jd = startJD;
    while (jd <= endJD) {
        const lst = getLST(jd, longitude);
        // Calculate hour angle
        let hourAngle = lst - raHours;
        // Normalize to [-12, 12]
        while (hourAngle > 12) hourAngle -= 24;
        while (hourAngle < -12) hourAngle += 24;
        // Transit occurs when hour angle is near 0
        if (Math.abs(hourAngle) < 0.01) { // Within ~36 seconds
            return jd;
        }
        jd += stepSize;
    }

    return null;
}
