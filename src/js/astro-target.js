/**
 * astro-target.js
 * Target visibility calculations (rise, set, visibility windows)
 *
 * Accuracy:
 * - Rise/set/visibility search functions are quantized to
 *   APP_CONFIG.TARGET_SEARCH_STEP_SIZE (1 min) — reported times can be
 *   off by up to one step from the true crossing.
 * - findTargetRise/findTargetSet track a single rise and a single set;
 *   a below-threshold dip between two visible segments is handled
 *   separately by findVisibilityDip (see Issue #251).
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

    for (let i = 0; i <= steps; i++) {
        const testJD = duskJD + i * stepSize;
        const altitude = getAltitude(testJD, raHours, decDeg, latitude, longitude);
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
        Log.debug(`  Target visible at end of window - no final set`);
        return null;
    }

    if (!lastSetJD) {
        Log.debug(`  No set found - target stays invisible throughout`);
    }
    return lastSetJD; // Return the LAST set time found
}

/**
 * Detect a below-minimum-altitude trough occurring between two
 * above-minimum-altitude segments within the window — the case
 * findTargetRise/findTargetSet cannot represent, since each tracks only
 * a single rise (first) and single set (last, discarded if still
 * visible at endJD). Only returns a result when the target is visible
 * at both startJD and endJD with an invisible dip somewhere between —
 * every other visibility pattern is already correctly represented by
 * findTargetRise/findTargetSet. See Issue #251.
 * @param {number} startJD - Search window start (Julian Date)
 * @param {number} endJD - Search window end (Julian Date)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} minAltitude - Minimum altitude threshold (degrees)
 * @param {Array} horizonArray - Optional horizon profile
 * @returns {{dipStartJD:number, dipEndJD:number}|null}
 */
function findVisibilityDip(startJD, endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray = null) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;

    const startAltitude = getAltitude(startJD, raHours, decDeg, latitude, longitude);
    const startAzimuth = getAzimuth(startJD, raHours, decDeg, latitude, longitude);
    const visibleAtStart = isAboveHorizon(startAltitude, startAzimuth, minAltitude, horizonArray);

    const endAltitude = getAltitude(endJD, raHours, decDeg, latitude, longitude);
    const endAzimuth = getAzimuth(endJD, raHours, decDeg, latitude, longitude);
    const visibleAtEnd = isAboveHorizon(endAltitude, endAzimuth, minAltitude, horizonArray);

    if (!visibleAtStart || !visibleAtEnd) {
        return null;
    }

    let jd = startJD;
    let prevVisible = visibleAtStart;
    let dipStartJD = null;
    let dipEndJD = null;

    while (jd <= endJD) {
        const altitude = getAltitude(jd, raHours, decDeg, latitude, longitude);
        const azimuth = getAzimuth(jd, raHours, decDeg, latitude, longitude);
        const isVisible = isAboveHorizon(altitude, azimuth, minAltitude, horizonArray);

        if (prevVisible && !isVisible && dipStartJD === null) {
            dipStartJD = jd;
        } else if (!prevVisible && isVisible && dipStartJD !== null && dipEndJD === null) {
            dipEndJD = jd;
        }

        prevVisible = isVisible;
        jd += stepSize;
    }

    if (dipStartJD !== null && dipEndJD !== null) {
        return { dipStartJD, dipEndJD };
    }

    return null;
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
    const noonJD = TimeUtils.localWallClockToJD(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        12, timezone, isDST
    );
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
    // Transit: LST == RA. LST advances 24 sidereal hours per sidereal day,
    // i.e. 1 solar day advances LST by 24/0.9972695663 hours. Compute the
    // first transit at/after startJD directly — no scanning.
    const SIDEREAL_DAY_RATIO = 0.9972695663; // solar days per sidereal day
    let dh = (raHours - getLST(startJD, longitude)) % 24;
    if (dh < 0) dh += 24;
    const transitJD = startJD + (dh / 24) * SIDEREAL_DAY_RATIO;
    return transitJD <= endJD ? transitJD : null;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
