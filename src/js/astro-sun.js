/**
 * astro-sun.js
 * Sun position and sky brightness calculations
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
 * Enhanced solar brightness with atmospheric and seasonal effects
 * @param {number} altitudeDeg - Sun altitude in degrees
 * @param {Object} options - Configuration options
 * @returns {number} Sky brightness in magnitudes per square arcsecond
 */
function solarBrightnessAdvanced(altitudeDeg, options = {}) {
    const {
        atmosphericExtinction = 0.2,
        scatteringFactor = 1.0,
        humidity = 0.5,
        aerosolOpticalDepth = 0.1,
        season = 'spring'
    } = options;

    let brightness = solarBrightnessUltraSmooth(altitudeDeg);

    // Seasonal adjustments
    const seasonalFactors = {
        'winter': -0.3,
        'spring': 0.0,
        'summer': 0.2,
        'autumn': -0.1
    };
    brightness += seasonalFactors[season] || 0;

    // Humidity effects
    if (altitudeDeg > -6) {
        brightness += humidity * 0.5;
    }

    // Aerosol/pollution effects
    brightness += aerosolOpticalDepth * 2.0;

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

    const sunBrightness = solarBrightnessAdvanced(sunAltitude);
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
 * Find astronomical dusk for a given date
 * @param {Date} localDate - Date at local noon
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} timezone - Timezone offset (hours, e.g., -5 for EST)
 * @returns {number|null} Dusk JD when sun goes below -18�, or null if no dusk
 */
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
        return null; // No astronomical dusk found (e.g., polar regions in summer)
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
 * @returns {number|null} Dawn JD when sun comes above -18°, or null if no dawn
 */
function findNextAstronomicalDawn(localDate, latitude, longitude, timezone, isDST) {
    // Start from midnight of the NEXT day. Built via Date.UTC so the
    // browser's local timezone never enters the calculation — otherwise
    // localMidnight.getTime() already carries the browser's offset, and
    // subtracting offsetHours applies the location's offset a second time.
    const nextDay = new Date(localDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const offsetHours = isDST ? timezone + 1 : timezone;
    const utcMidnight = new Date(Date.UTC(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 0, 0, 0) - offsetHours * 3600000);
    const midnightJD = dateToJD(utcMidnight);

    const targetAlt = -18;

    // Coarse-then-refine search (perf): scan at 10-minute steps to bracket
    // the -18 crossing, then binary-search within that bracket down to
    // 1-minute precision — same result as the old 1-minute linear scan
    // (to the minute), ~10x fewer getSunPosition/getAltitude evaluations.
    const coarseStep = 10/1440;
    const maxCoarseIterations = 144; // 24 hours / 10 min

    let jd = midnightJD;
    let sunPos = getSunPosition(jd);
    let altitude = getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);

    if (altitude >= targetAlt) {
        return jd; // Already above threshold at midnight (edge case, e.g. polar)
    }

    let bracketStartJD = null;
    let bracketEndJD = null;

    for (let i = 1; i <= maxCoarseIterations; i++) {
        jd = midnightJD + i * coarseStep;
        sunPos = getSunPosition(jd);
        altitude = getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);

        if (altitude >= targetAlt) {
            bracketStartJD = jd - coarseStep;
            bracketEndJD = jd;
            break;
        }
    }

    if (bracketStartJD === null) {
        return null; // No astronomical dawn found (e.g., polar regions in winter)
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
