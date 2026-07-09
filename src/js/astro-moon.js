/**
 * astro-moon.js
 * Moon position, phase, and rise/set calculations
 */

/**
 * Calculate enhanced moon position with nutation
 * @param {number} jd - Julian Date
 * @returns {Object} { ra: hours, dec: degrees }
 */
function getMoonPosition(jd) {
    const T = (jd - 2451545.0) / 36525.0;

    // Mean longitude of the Moon
    const L0 = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841.0 - T * T * T * T / 65194000.0;

    // Mean elongation of the Moon
    const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868.0 - T * T * T * T / 113065000.0;

    // Sun's mean anomaly
    const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000.0;

    // Moon's mean anomaly
    const M1 = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699.0 - T * T * T * T / 14712000.0;

    // Moon's argument of latitude
    const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000.0 + T * T * T * T / 863310000.0;

    // Convert to radians
    const L0_rad = degreesToRadians(L0 % 360);
    const D_rad = degreesToRadians(D % 360);
    const M_rad = degreesToRadians(M % 360);
    const M1_rad = degreesToRadians(M1 % 360);
    const F_rad = degreesToRadians(F % 360);

    // Enhanced longitude corrections
    let deltaL = 6.289 * Math.sin(M1_rad);
    deltaL += 1.274 * Math.sin(2 * D_rad - M1_rad);
    deltaL += 0.658 * Math.sin(2 * D_rad);
    deltaL -= 0.186 * Math.sin(M_rad);
    deltaL -= 0.059 * Math.sin(2 * M1_rad - 2 * D_rad);
    deltaL -= 0.057 * Math.sin(M1_rad - 2 * D_rad + M_rad);
    deltaL += 0.053 * Math.sin(M1_rad + 2 * D_rad);
    deltaL += 0.046 * Math.sin(2 * D_rad - M_rad);
    deltaL += 0.041 * Math.sin(M1_rad - M_rad);
    deltaL -= 0.035 * Math.sin(D_rad);
    deltaL -= 0.031 * Math.sin(M1_rad + M_rad);
    deltaL -= 0.015 * Math.sin(2 * F_rad - 2 * D_rad);
    deltaL += 0.011 * Math.sin(M1_rad - 4 * D_rad);

    // Enhanced latitude corrections
    let deltaB = 5.128 * Math.sin(F_rad);
    deltaB += 0.281 * Math.sin(M1_rad + F_rad);
    deltaB += 0.278 * Math.sin(M1_rad - F_rad);
    deltaB += 0.173 * Math.sin(2 * D_rad - F_rad);
    deltaB += 0.055 * Math.sin(2 * D_rad - M1_rad + F_rad);
    deltaB += 0.046 * Math.sin(2 * D_rad - M1_rad - F_rad);
    deltaB += 0.033 * Math.sin(M1_rad + 2 * D_rad + F_rad);
    deltaB += 0.017 * Math.sin(2 * M1_rad + F_rad);

    const lambda = (L0 + deltaL) % 360;
    const beta = deltaB;

    // Convert to equatorial coordinates with nutation
    const epsilon = 23.4393 - 0.0000004 * (jd - 2451545.0);

    // Simple nutation correction
    const omega = 125.045 - 1934.136 * T;
    const deltaPsi = -17.20 * Math.sin(degreesToRadians(omega));
    const deltaEps = 9.20 * Math.cos(degreesToRadians(omega));

    const epsilon_rad = degreesToRadians(epsilon + deltaEps / 3600);
    const lambda_rad = degreesToRadians(lambda + deltaPsi / 3600);
    const beta_rad = degreesToRadians(beta);

    const alpha = Math.atan2(
        Math.sin(lambda_rad) * Math.cos(epsilon_rad) - Math.tan(beta_rad) * Math.sin(epsilon_rad),
        Math.cos(lambda_rad)
    );

    const delta = Math.asin(
        Math.sin(beta_rad) * Math.cos(epsilon_rad) + Math.cos(beta_rad) * Math.sin(epsilon_rad) * Math.sin(lambda_rad)
    );

    let ra = radiansToDegrees(alpha) / 15.0; // Convert to hours
    if (ra < 0) ra += 24;

    const dec = radiansToDegrees(delta);

    return {
        ra: ra,
        dec: dec,
        // True ecliptic longitude, normalized to [0, 360). Added for Issue #207
        // (accurate waxing/waning determination in getMoonPhase). `lambda` above
        // is already L0 + deltaL before the % 360 truncation, so this reuses it
        // rather than recomputing.
        lambda: ((lambda % 360) + 360) % 360
    };
}

/**
 * Calculate moon phase and illumination using Meeus algorithm
 * @param {number} jd - Julian Date
 * @returns {Object} { phase: degrees, illumination: percent, phaseName: string, phaseEmoji: string }
 */
function getMoonPhase(jd) {
    // Get accurate positions for Moon and Sun
    const moonPos = getMoonPosition(jd);
    const sunPos = getSunPosition(jd);

    // Convert to radians
    const moonRA = hoursToRadians(moonPos.ra);
    const moonDec = degreesToRadians(moonPos.dec);
    const sunRA = hoursToRadians(sunPos.ra);
    const sunDec = degreesToRadians(sunPos.dec);

    // Calculate geocentric elongation (angle between Sun and Moon as seen from Earth)
    // Using spherical trigonometry
    const cosElongation = Math.sin(sunDec) * Math.sin(moonDec) +
                          Math.cos(sunDec) * Math.cos(moonDec) * Math.cos(sunRA - moonRA);
    const elongation = Math.acos(Math.max(-1, Math.min(1, cosElongation)));

    // Phase angle at the moon (Earth–Moon–Sun angle), using the distance-free
    // approximation: phaseAngle ≈ π − elongation (error < 0.2°, negligible for illumination)
    const phaseAngle = Math.PI - elongation;

    // Calculate illuminated fraction using Meeus formula
    // k = (1 + cos(i)) / 2
    const illuminatedFraction = (1 + Math.cos(phaseAngle)) / 2;

    // Determine waxing or waning using TRUE ecliptic longitudes (Issue #207).
    // Mean longitudes can differ from true by up to ~8° combined (moon ±6.3°,
    // sun ±1.9°); with elongation changing ~12.2°/day, that mean-vs-true gap
    // was enough to flip waxing/waning within ~±16h of true new/full moon.
    // moonPos.lambda / sunPos.lambda are already true longitudes, normalized
    // to [0, 360), from getMoonPosition/getSunPosition — no extra computation.
    const longitudeDiff = (moonPos.lambda - sunPos.lambda + 360) % 360;
    const isWaxing = longitudeDiff < 180;

    // Use elongation for phase value
    let phase = radiansToDegrees(elongation);
    if (!isWaxing) {
        phase = 360 - phase;
    }

    // Phase name and emoji based on illumination and waxing/waning
    let phaseName;
    let phaseEmoji;

    const illuminationPercent = illuminatedFraction * 100;

    if (illuminationPercent < 1) {
        phaseName = "New Moon";
        phaseEmoji = "🌑";
    } else if (isWaxing && illuminationPercent < 48) {
        phaseName = "Waxing Crescent";
        phaseEmoji = "🌒";
    } else if (isWaxing && illuminationPercent < 52) {
        phaseName = "First Quarter";
        phaseEmoji = "🌓";
    } else if (isWaxing && illuminationPercent < 99) {
        phaseName = "Waxing Gibbous";
        phaseEmoji = "🌔";
    } else if (illuminationPercent >= 99) {
        phaseName = "Full Moon";
        phaseEmoji = "🌕";
    } else if (!isWaxing && illuminationPercent > 52) {
        phaseName = "Waning Gibbous";
        phaseEmoji = "🌖";
    } else if (!isWaxing && illuminationPercent > 48) {
        phaseName = "Last Quarter";
        phaseEmoji = "🌗";
    } else {
        phaseName = "Waning Crescent";
        phaseEmoji = "🌘";
    }

    return {
        phase: phase,
        illumination: illuminationPercent,
        phaseName: phaseName,
        phaseEmoji: phaseEmoji
    };
}

/**
 * Calculate horizon depression due to elevation
 * @param {number} elevationMeters - Observer elevation in meters
 * @returns {number} Horizon depression in degrees
 */
function calculateHorizonDepression(elevationMeters) {
    // Moon rise/set threshold for GEOCENTRIC altitude: refraction + semidiameter
    // + topocentric parallax folded in per Meeus ch.15: h0 = 0.7275*parallax - 0.5667
    // ≈ +0.125 deg for mean lunar parallax 0.9507 deg (replaces the solar-style
    // -0.833 deg threshold, which omitted the moon's parallax entirely).
    const moonRiseSetThreshold = 0.125;

    // Geometric horizon dip: sqrt(2h/R) RADIANS, converted to degrees.
    // (Previous code took sqrt(2h) with h in km and treated the raw result
    // as degrees — dimensionally wrong, ~40-50% too large at typical elevations.)
    const EARTH_RADIUS_M = 6371000;
    const h = elevationMeters ?? 0; // guard: some locations may have no elevation set
    const geometricDepression = -radiansToDegrees(Math.sqrt(2 * h / EARTH_RADIUS_M));

    // Combined effect
    return moonRiseSetThreshold + geometricDepression;
}


/**
 * Calculate moon rise and set times within a search window
 * Uses horizon depression due to observer elevation
 * @param {number} searchStart - Start Julian Date
 * @param {number} searchEnd - End Julian Date
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees)
 * @param {number} elevation - Observer elevation (meters)
 * @returns {Object} { moonrise: JD|null, moonset: JD|null }
 */
function calculateMoonRiseSet(searchStart, searchEnd, latitude, longitude, elevation) {
    const horizonDepression = calculateHorizonDepression(elevation);
    const step = 1 / 1440; // 1 minute
    let moonrise = null;
    let moonset = null;
    let lastAltitude = null;
    let jd = searchStart;

    while (jd <= searchEnd) {
        const moonPos = getMoonPosition(jd);
        const altitude = getAltitude(jd, moonPos.ra, moonPos.dec, latitude, longitude);

        if (lastAltitude !== null) {
            if (lastAltitude < horizonDepression && altitude >= horizonDepression && !moonrise) {
                moonrise = jd;
            }
            if (lastAltitude >= horizonDepression && altitude < horizonDepression && !moonset) {
                moonset = jd;
            }
        }

        lastAltitude = altitude;
        jd += step;
    }

    return { moonrise, moonset };
}
