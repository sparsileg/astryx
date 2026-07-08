/**
 * daily-visibility-calculations.js
 * Daily Visibility calculations and results display
 */

const DailyVisibilityCalculations = {

    /**
     * Calculate astronomical twilight times for a given date
     * Uses the same algorithm as the original app
     */
    calculateTwilightTimes(date, latitude, longitude, timezone, dstConfig) {
        // Create a local noon date for this observation date
        const dateParts = date.split('-');
        const localNoon = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            12, 0, 0
        );

        // Adjust for timezone offset before converting to JD
        const isDST = SettingsManager.isDSTActive(localNoon, timezone);
        const offsetHours = isDST ? timezone + 1 : timezone;
        const utcNoon = new Date(localNoon.getTime() - offsetHours * 3600000);
        const noonJD = TimeUtils.dateToJD(utcNoon);

        // Find astronomical dusk (sun at -18°)
        const duskJD = this.findSunAltitudeJD(noonJD, latitude, longitude, -18, true);

        // Find astronomical dawn (sun at -18°): start one minute past dusk,
        // where the sun is still just below -18, so the first-sample-at-or-above
        // -18 scan finds true dawn even on short summer nights. (The old
        // dusk+6h start overshot true dawn whenever the night was under 6h.)
        let dawnJD = null;
        if (duskJD) {
            const searchStartJD = duskJD + 1/1440;
            dawnJD = this.findSunAltitudeJD(searchStartJD, latitude, longitude, -18, false);
        }

        // Convert JD to local time strings
        if (duskJD && dawnJD) {
            // Convert JD to UTC date
            const duskUTC = TimeUtils.jdToDate(duskJD);
            const dawnUTC = TimeUtils.jdToDate(dawnJD);

            // Determine DST status
            const isDST = SettingsManager.isDSTActive(localNoon, timezone);

            // Format as local time strings
            return {
                duskJD: duskJD,
                dawnJD: dawnJD,
                dusk: TimeUtils.formatLocalTimeWithDate(duskUTC, timezone, isDST),
                dawn: TimeUtils.formatLocalTimeWithDate(dawnUTC, timezone, isDST)
            };
        }

        return { duskJD: null, dawnJD: null, dusk: null, dawn: null };
    },

    /**
     * Find JD when sun reaches target altitude
     */
    findSunAltitudeJD(startJD, latitude, longitude, targetAltitude, searchUp) {
        let jd = startJD;
        const step = 1 / 1440; // 1 minute
        const maxIterations = 1440 * 2; // Up to 2 days

        for (let i = 0; i < maxIterations; i++) {
            const sunPos = getSunPosition(jd);
            const altitude = getAltitude(jd, sunPos.ra, sunPos.dec, latitude, longitude);

            if (searchUp && altitude <= targetAltitude) {
                return jd;
            }
            if (!searchUp && altitude >= targetAltitude) {
                return jd;
            }

            jd += step;
        }

        return null;
    },

    /**
     * Calculate results for a single day
     */
    calculateSingleDay(dateStr, duskJD, dawnJD, targetName, ra, dec, latitude, longitude, elevation, timezone, minAltitude, dstConfig, horizonArray = null) {
        if (!duskJD || !dawnJD) {
            console.log(`No dark sky on ${dateStr}`);
            return null;
        }
        // Calculate noon-to-noon search window for rise/set times
        const dateParts = dateStr.split('-');
        const obsDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const isDST = SettingsManager.isDSTActive(obsDate, timezone);
        const noonWindow = getNoonToNoonWindow(dateStr, timezone, isDST);

        // Find rise/set times within noon-to-noon window (not just dusk-to-dawn)
        const riseJD = findTargetRise(noonWindow.startJD, noonWindow.endJD, ra, dec,
                                      latitude, longitude, minAltitude, horizonArray);
        const setJD = findTargetSet(noonWindow.startJD, noonWindow.endJD, ra, dec,
                                    latitude, longitude, minAltitude, horizonArray);

        // Extend search for set time if still up at dawn
        let actualSetJD = setJD;
        if (!setJD) {
            const dawnAltitude = getAltitude(dawnJD, ra, dec, latitude, longitude);
            const dawnAzimuth = getAzimuth(dawnJD, ra, dec, latitude, longitude);
            if (isAboveHorizon(dawnAltitude, dawnAzimuth, minAltitude, horizonArray)) {
                // Search forward from dawn for up to 12 hours
                for (let step = 1; step < 720; step++) {
                    const testJD = dawnJD + step * APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
                    const altitude = getAltitude(testJD, ra, dec, latitude, longitude);
                    const azimuth = getAzimuth(testJD, ra, dec, latitude, longitude);
                    if (!isAboveHorizon(altitude, azimuth, minAltitude, horizonArray)) {
                        actualSetJD = testJD;
                        break;
                    }
                }
            }
        }

        // Calculate moon rise and set times - use full day bounds
        const moonRiseSet = calculateMoonRiseSet(noonWindow.startJD, noonWindow.endJD, latitude, longitude, elevation);

        // Calculate blocked time if horizon is being used
        let blockedMinutes = 0;
        console.log('Blocked time calculation:', {
            horizonArray: horizonArray,
            riseJD: riseJD,
            setJD: setJD,
            hasHorizon: !!horizonArray,
            hasRise: !!riseJD,
            hasSet: !!setJD
        });

        if (horizonArray && riseJD && setJD) {
            const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
            let jd = riseJD;
            let blockedSteps = 0;

            while (jd <= setJD) {
                const altitude = getAltitude(jd, ra, dec, latitude, longitude);
                const azimuth = getAzimuth(jd, ra, dec, latitude, longitude);

                // Check if blocked: above min altitude but below horizon
                const horizonElevation = getHorizonElevationAtAzimuth(azimuth, horizonArray);
                if (altitude >= minAltitude && altitude < horizonElevation) {
                    blockedSteps++;
                }

                jd += stepSize;
            }

            // Convert steps to minutes
            blockedMinutes = Math.round(blockedSteps * stepSize * 1440); // 1440 minutes per day
            console.log('Blocked time result:', {
                blockedSteps: blockedSteps,
                stepSize: stepSize,
                blockedMinutes: blockedMinutes
            });
        }

        return {
            date: dateStr,
            duskJD: duskJD,
            dawnJD: dawnJD,
            riseJD: riseJD,
            setJD: setJD,
            actualSetJD: actualSetJD,
            moonRiseSet: moonRiseSet,
            timezone: timezone,
            locationName: this.currentLocationName,
            blockedMinutes: blockedMinutes
        };
    },


    /**
     * Assemble skyglowData object for a single date/target/location.
     * Called directly when navigating to Daily Visibility.
     */
    assembleSkyglowData(target, dateStr, locationName, minAltitude, useHorizon) {
        const location = DataManager.getLocation(locationName);
        if (!location) return null;

        const dstConfig = SettingsManager.getDSTConfig();
        const twilight = this.calculateTwilightTimes(
            dateStr,
            location.latitude,
            location.longitude,
            location.timezone,
            dstConfig
        );
        if (!twilight.duskJD || !twilight.dawnJD) return null;

        const horizonArray = (useHorizon && location.horizon) ? location.horizon : null;

        const dayResult = this.calculateSingleDay(
            dateStr,
            twilight.duskJD,
            twilight.dawnJD,
            target.object,
            target.ra,
            target.dec,
            location.latitude,
            location.longitude,
            location.elevation,
            location.timezone,
            minAltitude,
            dstConfig,
            horizonArray
        );
        if (!dayResult) return null;

        return {
            ...dayResult,
            targetName: target.object,
            commonName: target.common || '',
            ra: target.ra,
            dec: target.dec,
            latitude: location.latitude,
            longitude: location.longitude,
            locationName: locationName,
            minAltitude: minAltitude,
            useHorizon: useHorizon
        };
    }


};
