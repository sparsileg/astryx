/**
 * daily-visibility-calculations.js
 * Daily Visibility calculations and results display
 */

const DailyVisibilityCalculations = {

    /**
     * Hour labels for a timeline from startJD to endJD: one per real hour,
     * showing the location's clock hour at that instant, so the night the
     * clocks change repeats or skips an hour instead of drifting off the
     * markers (Issue #310)
     * @param {Object} location - { timezone, timeZone }
     * @returns {Array<{fraction: number, text: string}>} fraction of the timeline, hour 1-24
     */
    hourLabels(startJD, endJD, location) {
        const labels = [];
        const hours = Math.round((endJD - startJD) * 24);
        for (let i = 0; i <= hours; i++) {
            const jd = startJD + i / 24;
            const hour = Number(TimeUtils.formatLocalTime(jdToDate(jd), location).slice(0, 2));
            labels.push({ fraction: (jd - startJD) / (endJD - startJD), text: String(hour === 0 ? 24 : hour) });
        }
        return labels;
    },

    /**
     * Calculate astronomical twilight times for a given date
     * Uses the same algorithm as the original app
     */
    calculateTwilightTimes(date, location) {
        // Parse the date string into a local-noon Date object — findAstronomicalDusk/
        // findNextAstronomicalDawn build their own timezone-independent instant
        // internally from this, via the single canonical implementation in astro-sun.js.
        const dateParts = date.split('-');
        const localDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            12, 0, 0
        );
        const isDST = SettingsManager.isDSTOnDate(localDate, location);

        const duskJD = findAstronomicalDusk(localDate, location.latitude, location.longitude, location.timezone, isDST);
        const dawnJD = findNextAstronomicalDawn(localDate, location.latitude, location.longitude, location.timezone, isDST);

        // Convert JD to local time strings
        if (duskJD && dawnJD) {
            const duskUTC = jdToDate(duskJD);
            const dawnUTC = jdToDate(dawnJD);

            return {
                duskJD: duskJD,
                dawnJD: dawnJD,
                dusk: TimeUtils.formatLocalTimeWithDate(duskUTC, location),
                dawn: TimeUtils.formatLocalTimeWithDate(dawnUTC, location)
            };
        }

        return { duskJD: null, dawnJD: null, dusk: null, dawn: null };
    },


    /**
     * Calculate results for a single day
     */
    calculateSingleDay(dateStr, duskJD, dawnJD, ra, dec, location, minAltitude, horizonArray = null) {
        const { latitude, longitude, elevation } = location;
        if (!duskJD || !dawnJD) {
            Log.debug(`No dark sky on ${dateStr}`);
            return null;
        }
        // Noon-to-noon window for moon rise/set
        const dateParts = dateStr.split('-');
        const obsDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const isDST = SettingsManager.isDSTOnDate(obsDate, location);
        const noonWindow = getNoonToNoonWindow(dateStr, location.timezone, isDST);

        // Rise and set of the stretch above min altitude under way at dusk, or
        // the next one; either may fall outside dusk–dawn (Issue #279)
        const { riseJD, setJD } = findNightVisibility(duskJD, ra, dec,
                                                      latitude, longitude, minAltitude, horizonArray);
        // No rise and no set: either always up or never up
        const neverRises = riseJD === null && setJD === null && !isAboveHorizon(
            getAltitude(duskJD, ra, dec, latitude, longitude),
            getAzimuth(duskJD, ra, dec, latitude, longitude),
            minAltitude, horizonArray);

        // Every rise and set on the noon-to-noon timeline, which can include
        // the next morning's rise as well as the night's (Issue #279)
        const timelineCrossings = findAltitudeCrossings(noonWindow.startJD, noonWindow.endJD, ra, dec,
                                                        latitude, longitude, minAltitude, horizonArray);

        // Moon rise and set for the noon-to-noon day; an event just past the
        // window is still found (the timeline skips it, the Moon Details card shows it)
        const moonRiseSet = calculateMoonRiseSetForNight(noonWindow.startJD, noonWindow.endJD, latitude, longitude, elevation);

        // Calculate blocked time if horizon is being used
        let blockedMinutes = 0;
        Log.debug('Blocked time calculation:', {
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
            Log.debug('Blocked time result:', {
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
            neverRises: neverRises,
            timelineCrossings: timelineCrossings,
            moonRiseSet: moonRiseSet,
            moonUp: isMoonUpDuring(duskJD, dawnJD, latitude, longitude, elevation),
            timezone: location.timezone,
            timeZone: location.timeZone,
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

        const twilight = this.calculateTwilightTimes(dateStr, location);
        if (!twilight.duskJD || !twilight.dawnJD) return null;

        const horizonArray = (useHorizon && location.horizon) ? location.horizon : null;

        const dayResult = this.calculateSingleDay(
            dateStr,
            twilight.duskJD,
            twilight.dawnJD,
            target.ra,
            target.dec,
            location,
            minAltitude,
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

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
