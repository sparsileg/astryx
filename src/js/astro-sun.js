/**
 * astro-sun.js
 * Sun position and sky brightness calculations
 *
 * Accuracy:
 * - getSunPosition uses the low-precision solar position formula from
 *   the Astronomical Almanac (~0.01 deg) — twilight times are good to a
 *   few seconds.
 * - solarBrightnessUltraSmooth and calculateSkyLight are heuristic
 *   quality models, not photometric predictions. The output is a
 *   ranking aid for comparing sessions/times against each other, not a
 *   measured or calibrated mag/arcsec^2 sky brightness value.
 */

/**
 * Calculate sun position
 * @param {number} jd - Julian Date
 * @returns {Object} { ra: hours, dec: degrees }
 */
function getSunPosition(jd) {
    const n = jd - 2451545.0;
    const L = (280.460 + 0.9856474 * n) % 360;
    const g = degreesToRadians((357.528 + 0.9856003 * n) % 360);

    const lambda = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
    const lambdaRad = degreesToRadians(lambda);

    const epsilon = degreesToRadians(23.439 - 0.0000004 * n);
    const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambdaRad), Math.cos(lambdaRad));
    const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambdaRad));

    let ra = radiansToDegrees(alpha) / 15.0; // Convert to hours
    if (ra < 0) ra += 24;

    return {
        ra: ra,
        dec: radiansToDegrees(delta),
        // True ecliptic longitude, normalized to [0, 360). Added for Issue #207
        // (accurate waxing/waning determination in getMoonPhase).
        lambda: ((lambda % 360) + 360) % 360
    };
}


/**
 * Combine two brightness magnitudes
 * @param {number} mag1 - First magnitude
 * @param {number} mag2 - Second magnitude
 * @returns {number} Combined magnitude
 */
function combineMagnitudes(mag1, mag2) {
    const flux1 = Math.pow(10, -0.4 * mag1);
    const flux2 = Math.pow(10, -0.4 * mag2);
    const totalFlux = flux1 + flux2;
    return -2.5 * Math.log10(totalFlux);
}

/**
 * Ultra-smooth solar brightness function
 * @param {number} altitudeDeg - Sun altitude in degrees (-90 to 90)
 * @returns {number} Sky brightness in magnitudes per square arcsecond
 */
function solarBrightnessUltraSmooth(altitudeDeg) {
    const sunAlt = Math.max(-90, Math.min(90, altitudeDeg));

    const darkSkyBrightness = 21.5;
    const brightSkyBrightness = 11.5;
    const transitionWidth = 12.0;
    const transitionCenter = -6.0;

    const normalizedInput = (sunAlt - transitionCenter) / transitionWidth;
    const tanhValue = Math.tanh(normalizedInput);

    const brightness = darkSkyBrightness + (brightSkyBrightness - darkSkyBrightness) * (tanhValue + 1) / 2;

    return brightness;
}

/**
 * Calculate combined sky brightness from sun and moon
 * @param {number} moonAltitude - Moon altitude in degrees
 * @param {number} targetAltitude - Target altitude in degrees
 * @param {number} separation - Angular separation between moon and target (degrees)
 * @param {number} moonIllumination - Moon illumination percentage (0-100)
 * @param {number} baseSkyBrightness - Base sky brightness (mag/arcsec�)
 * @param {number} sunAltitude - Sun altitude in degrees
 * @returns {number} Sky quality score (0-1, where 1 is best)
 */
function calculateSkyLight(moonAltitude, targetAltitude, separation, moonIllumination, baseSkyBrightness, sunAltitude) {
    const moonPhase = moonIllumination / 100;
    let lunarBrightness = baseSkyBrightness;

    // Smooth transition from -15� to +15� instead of hard cutoff at 0�
    const moonFactor = Math.max(0, Math.min(1, (moonAltitude + 15) / 30));

    if (moonFactor > 0) {
        lunarBrightness = lunarBrightness - (moonPhase * 4 * moonFactor);
        const altitudeRadians = moonAltitude * Math.PI / 180;
        lunarBrightness = lunarBrightness - (Math.sin(altitudeRadians) * 2 * moonFactor);
        lunarBrightness = lunarBrightness + (separation / 180) * 2 * moonFactor;
    }

    const sunBrightness = solarBrightnessUltraSmooth(sunAltitude);
    const skyBrightness = combineMagnitudes(sunBrightness, lunarBrightness);

    const excellentThreshold = 20.5;
    const goodThreshold = 19.0;
    const fairThreshold = 17.5;
    const poorThreshold = 16.0;
    const bottomRung = 14.0;

    let quality;
    if (skyBrightness >= excellentThreshold) {
        quality = 1.0;
    } else if (skyBrightness >= goodThreshold) {
        quality = 0.7 + 0.3 * (skyBrightness - goodThreshold) / (excellentThreshold - goodThreshold);
    } else if (skyBrightness >= fairThreshold) {
        quality = 0.4 + 0.3 * (skyBrightness - fairThreshold) / (goodThreshold - fairThreshold);
    } else if (skyBrightness >= poorThreshold) {
        quality = 0.15 + 0.25 * (skyBrightness - poorThreshold) / (fairThreshold - poorThreshold);
    } else {
        quality = Math.max(0.0, 0.15 * (skyBrightness - bottomRung) / (poorThreshold - bottomRung));
    }

    return Math.max(0.00, Math.min(1.0, quality));
}

/**
 * The sun's lowest point after a local noon: lower culmination, when its
 * hour angle reaches 12h. Its declination drifts too little in a night to
 * move the lowest altitude off this moment by more than seconds.
 * @param {number} noonJD - Local noon
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @returns {number} JD of solar midnight
 */
function findSolarMidnight(noonJD, longitude) {
    const SIDEREAL_DAY_RATIO = 0.9972695663; // solar days per sidereal day
    // Start half a day on, then correct twice for the sun's motion in RA
    let jd = noonJD + 0.5;
    for (let pass = 0; pass < 2; pass++) {
        const hoursToGo = ((getSunPosition(jd).ra + 12 - getLST(jd, longitude)) % 24 + 36) % 24 - 12;
        jd += (hoursToGo / 24) * SIDEREAL_DAY_RATIO;
    }
    return jd;
}

function sunAltitudeAt(jd, latitude, longitude) {
    const sunPos = getSunPosition(jd);
    return getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);
}

/**
 * Find astronomical dusk for a given date
 * @param {Date} localDate - Date at local noon
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} timezone - Timezone offset in standard time (hours, e.g., -5 for EST)
 * @param {boolean} isDST - Whether DST is active on this date
 * @returns {number|null} Dusk JD when sun goes below -18°, or null if no dusk
 */
function findAstronomicalDusk(localDate, latitude, longitude, timezone, isDST) {
    // Start from noon of the specified date. Built via Date.UTC so the
    // browser's local timezone never enters the calculation — otherwise
    // localNoon.getTime() already carries the browser's offset, and
    // subtracting offsetHours applies the location's offset a second time.
    const offsetHours = isDST ? timezone + 1 : timezone;
    const utcNoon = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12, 0, 0) - offsetHours * 3600000);
    const noonJD = dateToJD(utcNoon);

    const targetAlt = -18;

    // Coarse-then-refine search (perf): scan at 10-minute steps to bracket
    // the -18 crossing, then binary-search within that bracket down to
    // 1-minute precision — same result as the old 1-minute linear scan
    // (to the minute), ~10x fewer getSunPosition/getAltitude evaluations.
    const coarseStep = 10/1440;
    const maxCoarseIterations = 144; // 24 hours / 10 min

    let jd = noonJD;
    let sunPos = getSunPosition(jd);
    let altitude = getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);

    if (altitude <= targetAlt) {
        return jd; // Already below threshold at noon (edge case, e.g. polar)
    }

    let bracketStartJD = null;
    let bracketEndJD = null;

    for (let i = 1; i <= maxCoarseIterations; i++) {
        jd = noonJD + i * coarseStep;
        sunPos = getSunPosition(jd);
        altitude = getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);

        if (altitude <= targetAlt) {
            bracketStartJD = jd - coarseStep;
            bracketEndJD = jd;
            break;
        }
    }

    if (bracketStartJD === null) {
        // Darkness shorter than one coarse step can fall between samples
        // (the first or last dark nights near the poles): check the sun's
        // lowest point. Dusk then lies between the last sample and it.
        const midnightJD = findSolarMidnight(noonJD, longitude);
        if (sunAltitudeAt(midnightJD, latitude, longitude) > targetAlt) {
            return null; // No astronomical dusk (e.g., polar regions in summer)
        }
        bracketStartJD = noonJD + Math.floor((midnightJD - noonJD) / coarseStep) * coarseStep;
        bracketEndJD = midnightJD;
    }

    // Refine within the 10-minute bracket to 1-minute precision
    let lowJD = bracketStartJD;  // altitude > targetAlt here
    let highJD = bracketEndJD;   // altitude <= targetAlt here
    const refineTolerance = 1/1440;

    while ((highJD - lowJD) > refineTolerance) {
        const midJD = (lowJD + highJD) / 2;
        const midSunPos = getSunPosition(midJD);
        const midAltitude = getAltitude(midJD, midSunPos.ra, midSunPos.dec, latitude, longitude);
        if (midAltitude <= targetAlt) {
            highJD = midJD;
        } else {
            lowJD = midJD;
        }
    }

    return highJD;
}


/**
 * Find astronomical dawn for the morning after a given date
 * @param {Date} localDate - Reference date (dawn will be on the next morning)
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} timezone - Timezone offset in standard time (hours, e.g., -5 for EST)
 * @param {boolean} isDST - Whether DST is active on this date
 * @returns {number|null} Dawn JD when sun comes above -18°, or null if the
 *     sun never gets below -18° that night (or never rises above it)
 */
function findNextAstronomicalDawn(localDate, latitude, longitude, timezone, isDST) {
    // Start from noon of the given date, as findAstronomicalDusk does, and
    // find the first rise above -18 after the sun has been below it. Starting
    // at the next local midnight instead returned 00:00 as "dawn" whenever
    // darkness began after midnight — short nights where solar midnight falls
    // after clock midnight (e.g. Seattle or western France in June) — putting
    // dawn before dusk. Built via Date.UTC so the browser's local timezone
    // never enters the calculation.
    const offsetHours = isDST ? timezone + 1 : timezone;
    const utcNoon = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12, 0, 0) - offsetHours * 3600000);
    const noonJD = dateToJD(utcNoon);

    const targetAlt = -18;

    // Coarse-then-refine search (perf): scan at 10-minute steps to bracket
    // the -18 crossing, then binary-search within that bracket down to
    // 1-minute precision — same result as the old 1-minute linear scan
    // (to the minute), ~10x fewer getSunPosition/getAltitude evaluations.
    const coarseStep = 10/1440;
    const maxCoarseIterations = 144; // 24 hours / 10 min

    let bracketStartJD = null;
    let bracketEndJD = null;
    let darkSeen = false;

    for (let i = 0; i <= maxCoarseIterations; i++) {
        const jd = noonJD + i * coarseStep;
        const sunPos = getSunPosition(jd);
        const altitude = getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);

        if (altitude < targetAlt) {
            darkSeen = true;
        } else if (darkSeen) {
            bracketStartJD = jd - coarseStep;
            bracketEndJD = jd;
            break;
        }
    }

    if (bracketStartJD === null && !darkSeen) {
        // Darkness shorter than one coarse step can fall between samples:
        // check the sun's lowest point. Dawn then lies between it and the
        // next sample.
        const midnightJD = findSolarMidnight(noonJD, longitude);
        if (sunAltitudeAt(midnightJD, latitude, longitude) < targetAlt) {
            bracketStartJD = midnightJD;
            bracketEndJD = noonJD + Math.ceil((midnightJD - noonJD) / coarseStep) * coarseStep;
        }
    }

    if (bracketStartJD === null) {
        return null; // No darkness this night (high-latitude summer), or no end to it (polar winter)
    }

    // Refine within the 10-minute bracket to 1-minute precision
    let lowJD = bracketStartJD;  // altitude < targetAlt here
    let highJD = bracketEndJD;   // altitude >= targetAlt here
    const refineTolerance = 1/1440;

    while ((highJD - lowJD) > refineTolerance) {
        const midJD = (lowJD + highJD) / 2;
        const midSunPos = getSunPosition(midJD);
        const midAltitude = getAltitude(midJD, midSunPos.ra, midSunPos.dec, latitude, longitude);
        if (midAltitude >= targetAlt) {
            highJD = midJD;
        } else {
            lowJD = midJD;
        }
    }

    return highJD;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
