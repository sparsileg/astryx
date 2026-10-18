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
    let prevVisible = isVisibleAt(startJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

    // Search through window for crossing from not visible to visible
    while (jd <= endJD) {
        const isVisible = isVisibleAt(jd, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

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
    let prevVisible = isVisibleAt(startJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

    // Search through entire window, tracking the LAST set time
    while (jd <= endJD) {
        const isVisible = isVisibleAt(jd, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

        // Detect crossing from visible to not visible
        if (prevVisible && !isVisible) {
            lastSetJD = jd; // Update to latest set time
        }

        prevVisible = isVisible;
        jd += stepSize;
    }

    // Check if target is still visible at end of window
    const visibleAtEnd = isVisibleAt(endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

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
 * One pass over a window giving what findTargetRise, findTargetSet and
 * findVisibilityDip give, from the same samples, and whether the target is
 * visible at any of them (Issue #315)
 * @param {number} startJD - Search window start (Julian Date)
 * @param {number} endJD - Search window end (Julian Date)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} minAltitude - Minimum altitude threshold (degrees)
 * @param {Array} horizonArray - Optional horizon profile
 * @returns {{riseJD:number|null, setJD:number|null,
 *   dip:{dipStartJD:number, dipEndJD:number}|null, visible:boolean}}
 */
function scanVisibility(startJD, endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray = null) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    const isVisible = jd => isVisibleAt(jd, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

    const visibleAtStart = isVisible(startJD);
    let prevVisible = visibleAtStart;
    let visible = false;
    let riseJD = null;
    let lastSetJD = null;
    let dipStartJD = null;
    let dipEndJD = null;

    for (let jd = startJD; jd <= endJD; jd += stepSize) {
        const isVisibleNow = jd === startJD ? visibleAtStart : isVisible(jd);
        if (isVisibleNow) visible = true;

        if (!prevVisible && isVisibleNow) {
            // First rise; the first rise after the first set ends a dip
            if (riseJD === null) riseJD = jd;
            if (dipStartJD !== null && dipEndJD === null) dipEndJD = jd;
        } else if (prevVisible && !isVisibleNow) {
            lastSetJD = jd;
            if (dipStartJD === null) dipStartJD = jd;
        }
        prevVisible = isVisibleNow;
    }

    // As findTargetSet: still up at the end, an earlier set was an obstruction.
    // As findVisibilityDip: a dip only between visible start and end.
    const visibleAtEnd = isVisible(endJD);
    const hasDip = visibleAtStart && visibleAtEnd && dipStartJD !== null && dipEndJD !== null;
    return {
        riseJD,
        setJD: visibleAtEnd ? null : lastSetJD,
        dip: hasDip ? { dipStartJD, dipEndJD } : null,
        visible,
    };
}

/**
 * Rise and set of the target's stretch above minimum altitude that matters
 * for a night: the one under way at dusk, or else the first one starting
 * after dusk. Either end may fall outside dusk–dawn. A noon-to-noon search
 * splits a stretch that spans local noon, giving no set or the next day's
 * rise. See Issue #279.
 * @param {number} duskJD - Astronomical dusk (Julian Date)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} minAltitude - Minimum altitude threshold (degrees)
 * @param {Array} horizonArray - Optional horizon profile
 * @returns {{riseJD:number|null, setJD:number|null}} null where the target
 *   doesn't cross within a day (never rises, or never sets)
 */
function findNightVisibility(duskJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray = null) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    const searchDays = 1;
    const isVisible = jd => isVisibleAt(jd, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

    const upAtDusk = isVisible(duskJD);
    let riseJD = null;
    if (upAtDusk) {
        // Step back from dusk to the start of this stretch
        for (let jd = duskJD - stepSize; jd >= duskJD - searchDays; jd -= stepSize) {
            if (!isVisible(jd)) {
                riseJD = jd + stepSize;
                break;
            }
        }
    } else {
        riseJD = findTargetRise(duskJD, duskJD + searchDays, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);
    }

    // The stretch ends at the first set after it starts (or after dusk, if
    // the target was up for the whole day before)
    let setJD = null;
    const setSearchStart = riseJD ?? duskJD;
    if (riseJD !== null || upAtDusk) {
        for (let jd = setSearchStart; jd <= setSearchStart + searchDays; jd += stepSize) {
            if (!isVisible(jd)) {
                setJD = jd;
                break;
            }
        }
    }

    return { riseJD, setJD };
}

/**
 * Every rise above and set below minimum altitude within a window, for
 * marking a timeline. Rise is the first step above, set the first step
 * below, as in findTargetRise/findTargetSet. See Issue #279.
 * @param {number} startJD - Window start (Julian Date)
 * @param {number} endJD - Window end (Julian Date)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} minAltitude - Minimum altitude threshold (degrees)
 * @param {Array} horizonArray - Optional horizon profile
 * @returns {{rises:number[], sets:number[]}} JDs in time order
 */
function findAltitudeCrossings(startJD, endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray = null) {
    const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    const rises = [];
    const sets = [];
    let prevVisible = null;

    for (let jd = startJD; jd <= endJD; jd += stepSize) {
        const isVisible = isVisibleAt(jd, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);
        if (prevVisible === false && isVisible) rises.push(jd);
        if (prevVisible === true && !isVisible) sets.push(jd);
        prevVisible = isVisible;
    }

    return { rises, sets };
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

    const visibleAtStart = isVisibleAt(startJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

    const visibleAtEnd = isVisibleAt(endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

    if (!visibleAtStart || !visibleAtEnd) {
        return null;
    }

    let jd = startJD;
    let prevVisible = visibleAtStart;
    let dipStartJD = null;
    let dipEndJD = null;

    while (jd <= endJD) {
        const isVisible = isVisibleAt(jd, raHours, decDeg, latitude, longitude, minAltitude, horizonArray);

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

/**
 * A target's highest altitude in a window and when it is reached (Issue #317).
 * Altitude rises until upper transit and falls after it, so the peak is the
 * culmination altitude when transit falls in the window, otherwise the higher
 * end of the window. The window must be shorter than a sidereal day.
 * @param {number} startJD - Window start (normally astronomical dusk)
 * @param {number} endJD - Window end (normally astronomical dawn)
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @returns {Object} { altitude: degrees, jd: when }
 */
function getPeakAltitude(startJD, endJD, raHours, decDeg, latitude, longitude) {
    const transitJD = findTargetTransit(startJD, endJD, raHours, decDeg, longitude);
    if (transitJD !== null) return { altitude: 90 - Math.abs(latitude - decDeg), jd: transitJD };
    const startAltitude = getAltitude(startJD, raHours, decDeg, latitude, longitude);
    const endAltitude = getAltitude(endJD, raHours, decDeg, latitude, longitude);
    return startAltitude >= endAltitude ? { altitude: startAltitude, jd: startJD } : { altitude: endAltitude, jd: endJD };
}

/**
 * Hours after local midnight at which a target transits (0-24). Best Months
 * and Yearly Observability both score transit time with this.
 * @param {number} midnightJD - Local midnight at the start of the day
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @returns {number} Hours after midnight
 */
function getTransitHour(midnightJD, raHours, longitude) {
    // A sidereal day is shorter than a solar day, so a transit always falls within it
    return (findTargetTransit(midnightJD, midnightJD + 1, raHours, null, longitude) - midnightJD) * 24;
}

/**
 * A night sampled about every DARK_HOURS_STEP_MINUTES from dusk to dawn,
 * held as the cosine and sine of local sidereal time at each sample. Shared
 * by every target on that night, so getHoursAboveAltitude needs no trig per
 * sample.
 * @param {number|null} duskJD - Astronomical dusk, or null for no darkness
 * @param {number|null} dawnJD - Astronomical dawn, or null for no darkness
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @returns {Object} { cosLST: number[], sinLST: number[], stepHours: the
 *   hours between samples }, empty without darkness
 */
function getNightSamples(duskJD, dawnJD, longitude) {
    const cosLST = [];
    const sinLST = [];
    if (duskJD === null || dawnJD === null) return { cosLST, sinLST, stepHours: 0 };

    // The night in equal slices of about DARK_HOURS_STEP_MINUTES, sampled at
    // both ends of each, dusk and dawn included (Issue #304)
    const count = Math.max(1, Math.round((dawnJD - duskJD) * 1440 / APP_CONFIG.DARK_HOURS_STEP_MINUTES));
    const width = (dawnJD - duskJD) / count;
    for (let i = 0; i <= count; i++) {
        const lst = hoursToRadians(getLST(duskJD + i * width, longitude));
        cosLST.push(Math.cos(lst));
        sinLST.push(Math.sin(lst));
    }
    return { cosLST, sinLST, stepHours: width * 24 };
}

/**
 * Hours a target spends at or above minAltitude during a night. Every view
 * that counts "dark hours" uses this (Best Months, Yearly Observability,
 * the To-Do list), so they agree.
 * @param {Object} samples - From getNightSamples
 * @param {number} raHours - Target right ascension (hours)
 * @param {number} decDeg - Target declination (degrees)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} minAltitude - Minimum altitude (degrees)
 * @returns {Object} { totalHours, longestHours }: all time above, and the
 *   longest unbroken stretch
 */
function getHoursAboveAltitude(samples, raHours, decDeg, latitude, minAltitude) {
    // sin(alt) = sin(dec)sin(lat) + cos(dec)cos(lat)cos(LST - RA)
    const dec = degreesToRadians(decDeg);
    const lat = degreesToRadians(latitude);
    const ra = hoursToRadians(raHours);
    const a = Math.sin(dec) * Math.sin(lat);
    const b = Math.cos(dec) * Math.cos(lat);
    const cosRA = Math.cos(ra);
    const sinRA = Math.sin(ra);
    const sinMin = Math.sin(degreesToRadians(minAltitude));
    const { stepHours } = samples;

    // How far above minAltitude the target is at sample i (in sin(alt))
    const above = i => a + b * (samples.cosLST[i] * cosRA + samples.sinLST[i] * sinRA) - sinMin;

    // Each slice counts the part of it the target is up, its rise or set
    // found between the slice's two samples, so a run is measured to the
    // minute rather than to the step (Issue #304: counting whole samples
    // gave up to a step too much, and an all-night target more than the night)
    let totalHours = 0;
    let longestHours = 0;
    let currentHours = 0;
    let start = samples.cosLST.length > 0 ? above(0) : -1;
    for (let i = 1; i < samples.cosLST.length; i++) {
        const end = above(i);
        if (start >= 0 && end >= 0) {
            totalHours += stepHours;
            currentHours += stepHours;
        } else if (start >= 0) {
            // Sets in this slice: the run ends here
            const part = stepHours * start / (start - end);
            totalHours += part;
            longestHours = Math.max(longestHours, currentHours + part);
            currentHours = 0;
        } else if (end >= 0) {
            // Rises in this slice: a run starts here
            currentHours = stepHours * end / (end - start);
            totalHours += currentHours;
        }
        longestHours = Math.max(longestHours, currentHours);
        start = end;
    }
    return { totalHours, longestHours };
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
