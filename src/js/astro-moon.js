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

    return { ra: ra, dec: dec };
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

    // Calculate phase angle (angle at the Moon between Earth and Sun)
    // This requires the distances

    // Get Moon's distance (in Earth radii) using approximation
    const T = (jd - 2451545.0) / 36525.0;
    const D = 297.8501921 + 445267.1114034 * T; // Mean elongation
    const M = 357.5291092 + 35999.0502909 * T;  // Sun's mean anomaly
    const M1 = 134.9633964 + 477198.8675055 * T; // Moon's mean anomaly

    // Moon's distance in Earth radii (approximate)
    const moonDistance = 60.2666 - 3.5169 * Math.cos(degreesToRadians(M1))
                         - 0.1126 * Math.cos(degreesToRadians(2 * D - M1));

    // Sun's distance in AU
    const sunDistance = 1.00014 - 0.01671 * Math.cos(degreesToRadians(M))
                        - 0.00014 * Math.cos(degreesToRadians(2 * M));

    // Convert sun distance to Earth radii (1 AU ≈ 23454.78 Earth radii)
    const sunDistanceER = sunDistance * 23454.78;

    // Phase angle at the moon (angle Earth-Moon-Sun)
    // This is the supplement of the elongation
    const phaseAngle = Math.PI - elongation;

    // Calculate illuminated fraction using Meeus formula
    // k = (1 + cos(i)) / 2
    const illuminatedFraction = (1 + Math.cos(phaseAngle)) / 2;

    // Determine waxing or waning using ecliptic longitudes
    // Sun's ecliptic longitude
    const sunL = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;

    // Moon's ecliptic longitude
    const moonL = (218.3164477 + 481267.88123421 * T - 0.0015786 * T * T) % 360;

    // Calculate phase angle (0-360 degrees)
    // When moon is ahead of sun (greater longitude), it's waxing
    const longitudeDiff = (moonL - sunL + 360) % 360;
    const isWaxing = longitudeDiff > 0 && longitudeDiff < 180;

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
    // Standard atmospheric refraction
    const standardRefraction = -0.833;

    // Geometric horizon depression due to elevation
    const elevationKm = elevationMeters / 1000;
    const geometricDepression = -Math.sqrt(2 * elevationKm);

    // Combined effect
    return standardRefraction + geometricDepression;
}


/**
 * Find moonrise and moonset times within the noon-to-noon observation window
 * Searches every minute to ensure no events are missed
 * @param {number} duskJD - Dusk Julian Date
 * @param {number} dawnJD - Dawn Julian Date
 * @param {number} latitude - Observer latitude (degrees)
 * @param {number} longitude - Observer longitude (degrees, West is negative)
 * @param {number} elevation - Observer elevation (meters)
 * @param {string} obsDate - Observation date string (YYYY-MM-DD)
 * @param {number} timezone - Timezone offset from UTC
 * @returns {Object} { moonrise: JD, moonset: JD }
 */
function findMoonRiseSet(duskJD, dawnJD, latitude, longitude, elevation, obsDate, timezone) {
    const horizonDepression = calculateHorizonDepression(elevation);

    // Calculate noon-to-noon window using the SAME method as daily visibility timeline
    const dateParts = obsDate.split('-');
    const localNoonDate = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        12, 0, 0
    );

    // Convert to JD treating it as UTC (matching daily visibility timeline approach)
    const noonStartJD = TimeUtils.dateToJD(localNoonDate);
    const noonEndJD = noonStartJD + 1;

    console.log('=== MOON RISE/SET SEARCH ===');
    console.log('Observation date:', obsDate);
    console.log('Dusk JD:', duskJD, 'Time:', TimeUtils.jdToDate(duskJD).toISOString());
    console.log('Noon start JD:', noonStartJD, 'Time:', TimeUtils.jdToDate(noonStartJD).toISOString());
    console.log('Noon end JD:', noonEndJD, 'Time:', TimeUtils.jdToDate(noonEndJD).toISOString());
    console.log('Horizon depression:', horizonDepression);

    const oneMinute = 1 / 1440; // 1 minute in JD units

    let moonrise = null;
    let moonset = null;

    // Get starting altitude
    const moonPosStart = getMoonPosition(noonStartJD);
    let prevAltitude = getAltitude(noonStartJD, moonPosStart.ra, moonPosStart.dec, latitude, longitude);
    console.log('Starting moon altitude at noon:', prevAltitude.toFixed(2));

    // Search every minute through the entire noon-to-noon window
    let currentJD = noonStartJD + oneMinute;
    let checkCount = 0;

    while (currentJD <= noonEndJD) {
        const moonPos = getMoonPosition(currentJD);
        const moonAltitude = getAltitude(currentJD, moonPos.ra, moonPos.dec, latitude, longitude);

        // Check for rise (going from below to above horizon)
        if (prevAltitude < horizonDepression && moonAltitude >= horizonDepression) {
            if (!moonrise) {
                moonrise = currentJD;
                console.log('MOONRISE found at JD:', currentJD, 'Time:', TimeUtils.jdToDate(currentJD).toISOString());
            }
        }

        // Check for set (going from above to below horizon)
        if (prevAltitude >= horizonDepression && moonAltitude < horizonDepression) {
            if (!moonset) {
                moonset = currentJD;
                console.log('MOONSET found at JD:', currentJD, 'Time:', TimeUtils.jdToDate(currentJD).toISOString());
            }
        }

        // Stop if we've found both events
        if (moonrise && moonset) {
            break;
        }

        prevAltitude = moonAltitude;
        currentJD += oneMinute;
        checkCount++;
    }

    console.log('Checked', checkCount, 'minutes');
    console.log('Final results - Moonrise:', moonrise ? TimeUtils.jdToDate(moonrise).toISOString() : 'none');
    console.log('Final results - Moonset:', moonset ? TimeUtils.jdToDate(moonset).toISOString() : 'none');

    return {
        moonrise,
        moonset
    };
}
