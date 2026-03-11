/**
 * visibility-calculations.js
 * Visibility calculations and results display
 */

const VisibilityCalculations = {

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

        // Find astronomical dawn (sun at -18°, search starting 6 hours after dusk)
        let dawnJD = null;
        if (duskJD) {
            const searchStartJD = duskJD + 6/24;
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
        const moonRiseSet = this.calculateMoonRiseSet(noonWindow.startJD, noonWindow.endJD, latitude, longitude);

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
     * Calculate moon rise and set times within the noon-to-noon window
     * Uses same search window as target rise/set for consistency
     */
    calculateMoonRiseSet(searchStart, searchEnd, latitude, longitude) {
        let moonrise = null;
        let moonset = null;
        let lastAltitude = null;

        const step = 1 / 1440; // 1 minute
        let jd = searchStart;

        while (jd <= searchEnd) {
            const moonPos = getMoonPosition(jd);
            const altitude = getAltitude(jd, moonPos.ra, moonPos.dec, latitude, longitude);

            if (lastAltitude !== null) {
                // Detect rising (crossing 0° upward)
                if (lastAltitude < 0 && altitude >= 0 && !moonrise) {
                    moonrise = jd;
                }
                // Detect setting (crossing 0° downward)
                if (lastAltitude >= 0 && altitude < 0 && !moonset) {
                    moonset = jd;
                }
            }

            lastAltitude = altitude;
            jd += step;
        }

        return { moonrise, moonset };
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
    },



    /**
     * Get inputs for yearly calculation
     */
    getYearlyInputs() {
        // Get location from sidebar dropdown
        const locationName = SettingsManager.getSelectedLocation();
        const location = DataManager.getLocation(locationName);

        // Try modal element first, fall back to main view element, then default
        const minAltitudeInput = document.getElementById('yearly-min-altitude') || document.getElementById('min-altitude');
        const minAltitude = minAltitudeInput ? parseFloat(minAltitudeInput.value) : 35;

        // Safely get checkbox values if they exist, otherwise use defaults
        const showTargetAltitudeCheck = document.getElementById('yearly-show-target-altitude');
        const showMinAltitudeCheck = document.getElementById('yearly-show-min-altitude');
        const showSkyglowCheck = document.getElementById('yearly-show-skyglow');

        return {
            targetName: this.currentTarget ? this.currentTarget.object : '',
            targetCommonName: this.currentTarget ? this.currentTarget.common : null,
            targetType: this.currentTarget ? this.currentTarget.type : null,
            ra: this.currentTarget ? this.currentTarget.ra : null,
            dec: this.currentTarget ? this.currentTarget.dec : null,
            latitude: location ? location.latitude : null,
            longitude: location ? location.longitude : null,
            timezone: location ? location.timezone : null,
            minAltitude: minAltitude,
            showTargetAltitude: showTargetAltitudeCheck ? showTargetAltitudeCheck.checked : true,
            showMinAltitude: showMinAltitudeCheck ? showMinAltitudeCheck.checked : true,
            showSkyglow: showSkyglowCheck ? showSkyglowCheck.checked : true
        };
    },

    /**
     * Calculate and display yearly altitude
     */
    calculateYearly(providedInputs = null) {
        // Use provided inputs or get from DOM
        const inputs = providedInputs || this.getYearlyInputs();

        // Validate yearly-specific inputs (no date needed)
        if (!inputs.targetName) {
            UIManager.showToast('Please select a target', 'error');
            return;
        }

        if (isNaN(inputs.ra) || isNaN(inputs.dec)) {
            UIManager.showToast('Please select a valid target with coordinates', 'error');
            return;
        }

        if (isNaN(inputs.latitude) || inputs.latitude < -90 || inputs.latitude > 90) {
            UIManager.showToast('Latitude must be between -90 and 90 degrees', 'error');
            return;
        }

        if (isNaN(inputs.longitude) || inputs.longitude < -180 || inputs.longitude > 180) {
            UIManager.showToast('Longitude must be between -180 and 180 degrees', 'error');
            return;
        }

        if (isNaN(inputs.timezone) || inputs.timezone < -12 || inputs.timezone > 14) {
            UIManager.showToast('Timezone must be between -12 and +14 hours', 'error');
            return;
        }

        if (isNaN(inputs.minAltitude) || inputs.minAltitude < 0 || inputs.minAltitude > 90) {
            UIManager.showToast('Minimum altitude must be between 0 and 90 degrees', 'error');
            return;
        }

        // Calculate altitude data for 365 days
        const altitudeData = this.calculateYearlyAltitudeData(inputs);

        // Display the yearly observability graph
        this.displayYearlyObservabilityGraph(altitudeData, inputs);
    },

    /**
     * Get type-specific configuration for observability scoring
     */
    getTypeConfiguration(type) {
        const normalizedType = (type || '').toUpperCase();
        const configs = {
            '1STAR': { altitude: 40, transitWeight: 0.75, darkHoursWeight: 0.25 },
            '2STAR': { altitude: 40, transitWeight: 0.75, darkHoursWeight: 0.25 },
            'ASTER': { altitude: 40, transitWeight: 0.75, darkHoursWeight: 0.25 },
            'BRTNB': { altitude: 30, transitWeight: 0.55, darkHoursWeight: 0.45 },
            'CL+NB': { altitude: 30, transitWeight: 0.60, darkHoursWeight: 0.40 },
            'DRKNB': { altitude: 40, transitWeight: 0.70, darkHoursWeight: 0.30 },
            'GALCL': { altitude: 40, transitWeight: 0.65, darkHoursWeight: 0.35 },
            'GALXY': { altitude: 40, transitWeight: 0.70, darkHoursWeight: 0.30 },
            'GLOCL': { altitude: 40, transitWeight: 0.65, darkHoursWeight: 0.35 },
            'OPNCL': { altitude: 40, transitWeight: 0.65, darkHoursWeight: 0.35 },
            'PLNNB': { altitude: 30, transitWeight: 0.60, darkHoursWeight: 0.40 },
            'REFNB': { altitude: 40, transitWeight: 0.70, darkHoursWeight: 0.30 },
            'SNREM': { altitude: 30, transitWeight: 0.55, darkHoursWeight: 0.45 }
        };
        return configs[normalizedType] || { altitude: 30, transitWeight: 0.60, darkHoursWeight: 0.40 };
    },

    /**
     * Calculate local hour when target transits (crosses meridian)
     */
    calculateTransitHour(date, ra, dec, latitude, longitude, timezone) {
        // Calculate local sidereal time at midnight
        const midnightLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        const jd = TimeUtils.dateToJD(midnightLocal);
        const lst0 = getLST(jd, longitude);

        // Target transits when LST = RA
        // Hour angle H = LST - RA
        // When H = 0, target transits
        let transitLST = ra;

        // Calculate hours from midnight to transit
        let hoursSinceMidnight = transitLST - lst0;

        // Normalize to 0-24 range
        while (hoursSinceMidnight < 0) hoursSinceMidnight += 24;
        while (hoursSinceMidnight >= 24) hoursSinceMidnight -= 24;

        return hoursSinceMidnight;
    },

    /**
     * Calculate total accumulated dark hours above threshold
     */
    calculateTotalDarkHours(date, ra, dec, latitude, longitude, timezone, minAltitude) {
        const isDST = SettingsManager.isDSTActive(date, timezone);
        const duskJD = findAstronomicalDusk(date, latitude, longitude, timezone, isDST);
        const dawnJD = findNextAstronomicalDawn(date, latitude, longitude, timezone, isDST);

        if (!duskJD || !dawnJD) {
            return 0;
        }

        const step = 10 / 1440; // 10 minutes in JD
        let totalHours = 0;

        for (let jd = duskJD; jd <= dawnJD; jd += step) {
            const altitude = getAltitude(jd, ra, dec, latitude, longitude);
            if (altitude >= minAltitude) {
                totalHours += (step * 24);
            }
        }

        return totalHours;
    },

    /**
     * Calculate altitude at midnight for each day starting from January 1st
     */
    calculateYearlyAltitudeData(inputs) {
        const data = [];
        const today = new Date();

        // Start from the 1st of the current month
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get type-specific configuration
        const typeConfig = this.getTypeConfiguration(inputs.targetType);
        const typeAltitudeThreshold = typeConfig.altitude;
        const transitWeight = typeConfig.transitWeight;
        const darkHoursWeight = typeConfig.darkHoursWeight;

        // First pass: find max dark hours for normalization
        let maxDarkHours = 0;
        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);

            const darkHours = this.calculateTotalDarkHours(
                date, inputs.ra, inputs.dec,
                inputs.latitude, inputs.longitude, inputs.timezone,
                typeAltitudeThreshold
            );
            if (darkHours > maxDarkHours) {
                maxDarkHours = darkHours;
            }
        }

        // Second pass: calculate scores and altitudes for each day
        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);

            // Find astronomical dusk and dawn for this date
            const isDST = SettingsManager.isDSTActive(date, inputs.timezone);
            const duskJD = findAstronomicalDusk(date, inputs.latitude, inputs.longitude, inputs.timezone, isDST);
            const dawnJD = findNextAstronomicalDawn(date, inputs.latitude, inputs.longitude, inputs.timezone, isDST);

            let targetAltitude = null;
            let observabilityScore = 0;

            if (duskJD && dawnJD) {
                // Calculate peak altitude during darkness
                const step = 1 / 1440; // 1 minute in JD
                let maxAltitude = -999;

                for (let jd = duskJD; jd <= dawnJD; jd += step) {
                    const altitude = getAltitude(jd, inputs.ra, inputs.dec, inputs.latitude, inputs.longitude);
                    if (altitude > maxAltitude) {
                        maxAltitude = altitude;
                    }
                }

                targetAltitude = maxAltitude;

                // If target never rises above horizon, score is 0
                if (maxAltitude < 0) {
                    observabilityScore = 0;
                } else {
                    // Calculate observability score
                    // 1. Transit score
                    const transitHour = this.calculateTransitHour(
                        date, inputs.ra, inputs.dec,
                        inputs.latitude, inputs.longitude, inputs.timezone
                    );
                    const distanceFromMidnight = Math.min(
                        Math.abs(transitHour - 0),
                        Math.abs(transitHour - 24)
                    );
                    const transitScore = 1 - (distanceFromMidnight / 12);

                    // 2. Dark hours score
                    const darkHours = this.calculateTotalDarkHours(
                        date, inputs.ra, inputs.dec,
                        inputs.latitude, inputs.longitude, inputs.timezone,
                        typeAltitudeThreshold
                    );
                    const darkHoursScore = maxDarkHours > 0 ? (darkHours / maxDarkHours) : 0;

                    // 3. Base score (weighted)
                    const baseScore = (transitScore * transitWeight) + (darkHoursScore * darkHoursWeight);

                    // 4. Moon factor
                    const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
                    const noonJD = TimeUtils.dateToJD(localNoon);
                    const moonPhase = getMoonPhase(noonJD);
                    const moonIllum = moonPhase.illumination / 100; // Convert to 0-1

                    // Calculate moon-target separation at midnight
                    const midnightJD = TimeUtils.dateToJD(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
                    const moonPos = getMoonPosition(midnightJD);

                    // Angular separation between target and moon (in degrees)
                    const separation = getAngularSeparation(inputs.ra, inputs.dec, moonPos.ra, moonPos.dec);

                    // Exponential moon separation factor
                    const separationFactor = 1 - Math.exp(-separation / 30);
                    const moonFactor = (1 - moonIllum) * separationFactor;

                    // 5. Final adjusted score
                    const adjustedScore = baseScore * moonFactor;

                    // 6. Contrast enhancement
                    observabilityScore = Math.pow(adjustedScore, 0.7);
                }

            } else {
                // No astronomical darkness - use midnight altitude
                const midnightLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
                const jd = TimeUtils.dateToJD(midnightLocal);
                targetAltitude = getAltitude(jd, inputs.ra, inputs.dec, inputs.latitude, inputs.longitude);
                observabilityScore = 0;
            }

            // Calculate imaging quality score if requested (legacy)
            let imagingScore = null;
            if (inputs.showSkyglow) {
                imagingScore = this.calculateImagingScore(date, inputs);
            }

            data.push({
                dayIndex: dayOffset,
                date: date,
                targetAltitude: targetAltitude,
                imagingScore: imagingScore,
                observabilityScore: observabilityScore
            });
        }

        // Find day with maximum altitude for reference (skip null values)
        let maxAltitude = -999;
        let maxAltitudeDate = null;

        data.forEach((d) => {
            if (d.targetAltitude !== null) {
                if (d.targetAltitude > maxAltitude) {
                    maxAltitude = d.targetAltitude;
                    maxAltitudeDate = d.date;
                }
            }
        });

        return {
            data: data,
            maxAltitude: maxAltitude,
            maxAltitudeDate: maxAltitudeDate,
            startDate: startDate
        };
    },

    /**
     * Calculate imaging quality score for a given night
     * Score = (observable_hours / 12) × (1 - moon_illum) × min(1, separation_deg / 90) × 100
     */
    calculateImagingScore(date, inputs) {
        // Get local noon for this date
        const localNoon = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            12, 0, 0
        );

        // Convert to UTC
        const isDST = SettingsManager.isDSTActive(localNoon, inputs.timezone);
        const offsetHours = isDST ? inputs.timezone + 1 : inputs.timezone;
        const utcNoon = new Date(localNoon.getTime() - offsetHours * 3600000);
        const noonJD = TimeUtils.dateToJD(utcNoon);

        // Find astronomical dusk and dawn (sun at -18°)
        const duskJD = this.findSunAltitudeJD(noonJD, inputs.latitude, inputs.longitude, -18, true);
        let dawnJD = null;
        if (duskJD) {
            const searchStartJD = duskJD + 6/24;
            dawnJD = this.findSunAltitudeJD(searchStartJD, inputs.latitude, inputs.longitude, -18, false);
        }

        if (!duskJD || !dawnJD) {
            // No astronomical darkness on this night
            return {
                score: 0,
                observableHours: 0,
                moonIllum: 0,
                minSeparation: 0
            };
        }

        // Calculate moon illumination (always, regardless of observable hours)
        const midnightJD = (duskJD + dawnJD) / 2; // Sample at middle of night
        const moonPhase = getMoonPhase(midnightJD);
        const moonIllumination = moonPhase.illumination / 100; // Convert to 0-1

        // Sample every 15 minutes during the night to find observable hours and minimum separation
        const sampleInterval = 15 / 1440; // 15 minutes in JD
        let observableHours = 0;
        let minSeparation = 180; // Start with maximum possible

        let currentJD = duskJD;
        while (currentJD <= dawnJD) {
            // Check if target is above minimum altitude
            const targetAlt = getAltitude(currentJD, inputs.ra, inputs.dec, inputs.latitude, inputs.longitude);

            if (targetAlt >= inputs.minAltitude) {
                // This time counts as observable
                observableHours += 0.25; // 15 minutes = 0.25 hours

                // Get moon position and calculate separation
                const moonPos = getMoonPosition(currentJD);
                const separation = getAngularSeparation(inputs.ra, inputs.dec, moonPos.ra, moonPos.dec);

                if (separation < minSeparation) {
                    minSeparation = separation;
                }
            }

            currentJD += sampleInterval;
        }

        // If no observable time, return early but keep moon illumination
        if (observableHours === 0) {
            return {
                score: 0,
                observableHours: 0,
                moonIllum: moonIllumination,
                minSeparation: 0
            };
        }

        // Calculate score: (observable_hours / 12) × (1 - moon_illum) × min(1, separation_deg / 90) × 100
        const obsScore = observableHours / 12;
        const moonScore = 1 - moonIllumination;
        const separationScore = Math.min(1, minSeparation / 90);
        const finalScore = obsScore * moonScore * separationScore * 100;

        return {
            score: finalScore,
            observableHours: observableHours,
            moonIllum: moonIllumination,
            minSeparation: minSeparation
        };
    },

    /**
     * Display yearly observability graph overlay
     */
    displayYearlyObservabilityGraph(altitudeData, inputs) {
        const graphContainer = document.getElementById('yearly-observability-graph');
        const headerContainer = document.getElementById('yearly-observability-header');

        if (!graphContainer) {
            console.error('Yearly observability graph container not found');
            return;
        }

        // Format peak altitude
        let peakAltitudeStr = 'Never meets criteria';
        if (altitudeData.maxAltitude) {
            peakAltitudeStr = `Peak altitude of ${altitudeData.maxAltitude.toFixed(1)}°`;
        }

        // Format best month and observable range
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const selectedLocation = SettingsManager.getSelectedLocation();
        const currentTarget = this.currentTarget;
        let bestMonthStr = '';
        if (currentTarget && selectedLocation) {
            const bestMonth = currentTarget.bestMonth?.[selectedLocation];
            const visibilityStart = currentTarget.visibilityStart?.[selectedLocation];
            const visibilityEnd = currentTarget.visibilityEnd?.[selectedLocation];
            if (bestMonth) {
                bestMonthStr = `Best month: ${monthNames[bestMonth - 1]}`;
                if (visibilityStart) {
                    let endMonth = visibilityEnd > 12 ? visibilityEnd - 12 : visibilityEnd;
                    bestMonthStr += ` · Observable: ${monthNames[visibilityStart - 1]}–${monthNames[endMonth - 1]}`;
                }
            }
        }

        // Populate header if container exists
        if (headerContainer) {
            const currentMinAlt = inputs.minAltitude || 35;
            const altOptions = [5,10,15,20,25,30,35,40,45,50,55,60]
                .map(v => `<option value="${v}"${v === currentMinAlt ? ' selected' : ''}>${v}°</option>`)
                .join('');

            headerContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h2 style="margin: 0; color: var(--text-primary);">${inputs.targetName}${inputs.targetCommonName ? ' (' + inputs.targetCommonName + ')' : ''}</h2>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
                        ${peakAltitudeStr}${bestMonthStr ? ' &nbsp;·&nbsp; ' + bestMonthStr : ''}
                    </p>
                    <div class="form-inline" style="margin-top: 0.5rem;">
                        <label for="yearly-min-altitude" style="font-size: 0.9rem; color: var(--text-secondary); margin-right: 0.5rem;">Minimum Altitude:</label>
                        <select id="yearly-min-altitude">${altOptions}</select>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button id="yearly-observability-help-btn" class="btn-secondary">Help</button>
                </div>
            </div>
        `;

            const helpBtn = document.getElementById('yearly-observability-help-btn');

            if (helpBtn) {
                helpBtn.addEventListener('click', () => {
                    UIManager.showMarkdownHelp('yearly-observability');
                });
            }

            const minAltSelect = document.getElementById('yearly-min-altitude');
            if (minAltSelect) {
                minAltSelect.addEventListener('change', () => {
                    // Re-sync current target before recalculating
                    if (typeof VisibilityTargets !== 'undefined' && VisibilityTargets.currentTarget) {
                        VisibilityCalculations.currentTarget = VisibilityTargets.currentTarget;
                    }
                    VisibilityCalculations.calculateYearly();
                });
            }
        }

        // Store data for theme change re-rendering
        window.lastYearlyObservabilityGraphData = {
            altitudeData: altitudeData,
            inputs: inputs
        };

        // Render the graph
        this.renderYearlyObservabilityGraph(altitudeData, inputs);
    },

    /**
     * Hide yearly observability graph and restore visibility view
     */
    hideYearlyObservabilityGraph() {
        const yearlyObservabilityContainer = document.getElementById('yearly-observability-container');
        if (yearlyObservabilityContainer) {
            yearlyObservabilityContainer.remove();  // Changed from style.display = 'none' to .remove()
        }

        const twoColGrid = document.querySelector('.ts-two-col-grid');
        if (twoColGrid) {
            twoColGrid.style.display = 'grid';
        }

        // Reset page title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = '🔭 Visibility';
        }
    },

    /**
     * Render the yearly observability SVG graph
     */
    renderYearlyObservabilityGraph(altitudeData, inputs) {
        const container = document.getElementById('yearly-observability-graph');
        if (!container) return;

        // Get CSS variables for theme support
        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = computedStyle.getPropertyValue('--bg-color').trim();
        const textColor = computedStyle.getPropertyValue('--text-color').trim();
        const textSecondary = computedStyle.getPropertyValue('--text-secondary').trim();
        const borderColor = computedStyle.getPropertyValue('--border-color').trim();

        const width = 1100;
        const height = 310;
        const padding = { top: 20, right: 20, bottom: 40, left: 20 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.display = 'block';

        // Background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('width', width);
        background.setAttribute('height', height);
        background.setAttribute('fill', bgColor);
        svg.appendChild(background);

        // Create graph area with grid lines
        const graphGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graphGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
        svg.appendChild(graphGroup);

        // Month labels and grid lines for rolling 12 months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        // Get starting month and year from altitudeData
        const startMonth = altitudeData.startDate.getMonth(); // 0-11
        const startYear = altitudeData.startDate.getFullYear();

        let cumulativeDays = 0;
        for (let i = 0; i < 12; i++) {
            const monthIndex = (startMonth + i) % 12;
            const x = (cumulativeDays / 365) * graphWidth;

            // Calculate current year (increments when we wrap from Dec to Jan)
            const currentYear = startYear + Math.floor((startMonth + i) / 12);

            // Draw vertical grid line at month start
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', x);
            gridLine.setAttribute('y1', 0);
            gridLine.setAttribute('x2', x);
            gridLine.setAttribute('y2', graphHeight);
            gridLine.setAttribute('stroke', borderColor);
            gridLine.setAttribute('stroke-width', '1');
            graphGroup.appendChild(gridLine);

            // Month label at bottom of graph, aligned with grid line
            const monthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            monthLabel.setAttribute('x', padding.left + x);
            monthLabel.setAttribute('y', height - 15);
            monthLabel.setAttribute('text-anchor', 'middle');
            monthLabel.setAttribute('fill', textSecondary);
            monthLabel.setAttribute('font-size', '18');
            monthLabel.textContent = months[monthIndex];
            svg.appendChild(monthLabel);

            // Add year label for first month or when year changes (January)
            if (i === 0 || monthIndex === 0) {
                const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                yearLabel.setAttribute('x', padding.left + x);
                yearLabel.setAttribute('y', height + 10);
                yearLabel.setAttribute('text-anchor', 'middle');
                yearLabel.setAttribute('fill', textColor);
                yearLabel.setAttribute('font-size', '20');
                yearLabel.setAttribute('font-weight', '500');
                yearLabel.textContent = currentYear;
                svg.appendChild(yearLabel);
            }

            // Month tick mark at bottom edge of graph
            const tickMark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickMark.setAttribute('x1', padding.left + x);
            tickMark.setAttribute('y1', padding.top + graphHeight);
            tickMark.setAttribute('x2', padding.left + x);
            tickMark.setAttribute('y2', padding.top + graphHeight + 8);
            tickMark.setAttribute('stroke', textSecondary);
            tickMark.setAttribute('stroke-width', '3');
            svg.appendChild(tickMark);

            // Month tick mark at top edge of graph
            const topTickMark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            topTickMark.setAttribute('x1', padding.left + x);
            topTickMark.setAttribute('y1', padding.top);
            topTickMark.setAttribute('x2', padding.left + x);
            topTickMark.setAttribute('y2', padding.top - 8);
            topTickMark.setAttribute('stroke', textSecondary);
            topTickMark.setAttribute('stroke-width', '3');
            svg.appendChild(topTickMark);

            cumulativeDays += daysInMonth[monthIndex];
        }

        // Draw imaging quality gradient if requested
        // Draw observability gradient (if showSkyglow enabled)
        if (inputs.showSkyglow) {
            // Create gradient definition
            const gradientDef = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const linearGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            linearGradient.setAttribute('id', 'observabilityGradient');
            linearGradient.setAttribute('x1', '0%');
            linearGradient.setAttribute('y1', '0%');
            linearGradient.setAttribute('x2', '100%');
            linearGradient.setAttribute('y2', '0%');

            // Add gradient stops from observability scores
            altitudeData.data.forEach((point) => {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                const position = (point.dayIndex / 365) * 100;
                // Convert score (0-1) to grayscale (0-255) where higher score = darker (better)
                const grayValue = Math.round(255 * (1 - point.observabilityScore));
                stop.setAttribute('offset', `${position}%`);
                stop.setAttribute('stop-color', `rgb(${grayValue}, ${grayValue}, ${grayValue})`);
                linearGradient.appendChild(stop);
            });

            gradientDef.appendChild(linearGradient);
            graphGroup.appendChild(gradientDef);

            // Draw a rectangle with the gradient fill
            const observabilityRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            observabilityRect.setAttribute('x', 0);
            observabilityRect.setAttribute('y', 0);
            observabilityRect.setAttribute('width', graphWidth);
            observabilityRect.setAttribute('height', graphHeight);
            observabilityRect.setAttribute('fill', 'url(#observabilityGradient)');
            observabilityRect.setAttribute('opacity', '1.0');
            graphGroup.appendChild(observabilityRect);
        }

        // Draw minimum altitude line if requested (after gradient so it's visible)
        if (inputs.showMinAltitude) {
            const minAltY = graphHeight - (inputs.minAltitude / 90) * graphHeight;
            const minAltLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            minAltLine.setAttribute('x1', 0);
            minAltLine.setAttribute('y1', minAltY);
            minAltLine.setAttribute('x2', graphWidth);
            minAltLine.setAttribute('y2', minAltY);
            minAltLine.setAttribute('stroke', '#ef5350');
            minAltLine.setAttribute('stroke-width', '2');
            minAltLine.setAttribute('stroke-dasharray', '5,5');
            graphGroup.appendChild(minAltLine);
        }

        // Draw full moon indicators if showing imaging quality
        if (inputs.showSkyglow) {
            // Find full moon peaks (local maxima in illumination)
            const fullMoonPeaks = [];

            for (let i = 1; i < altitudeData.data.length - 1; i++) {
                const point = altitudeData.data[i];
                const prevPoint = altitudeData.data[i - 1];
                const nextPoint = altitudeData.data[i + 1];

                if (point.imagingScore !== null &&
                    prevPoint.imagingScore !== null &&
                    nextPoint.imagingScore !== null &&
                    point.imagingScore.moonIllum > 0.90 && // At least 90% illuminated
                    point.imagingScore.moonIllum >= prevPoint.imagingScore.moonIllum &&
                    point.imagingScore.moonIllum >= nextPoint.imagingScore.moonIllum) {
                    // This is a local maximum - a full moon peak
                    fullMoonPeaks.push(point);
                }
            }

            // Draw yellow circles for full moon peaks
            fullMoonPeaks.forEach((point) => {
                const x = (point.dayIndex / 365) * graphWidth;

                const moonCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                moonCircle.setAttribute('cx', x);
                moonCircle.setAttribute('cy', 10); // 10px from top
                moonCircle.setAttribute('r', 4); // 4px radius
                moonCircle.setAttribute('fill', '#ffd700'); // Gold/yellow color
                moonCircle.setAttribute('stroke', '#000000');
                moonCircle.setAttribute('stroke-width', '0.5');
                graphGroup.appendChild(moonCircle);
            });
        }

        // Draw target altitude curve if requested
        if (inputs.showTargetAltitude !== false) {
            // Build path segments, skipping negative altitudes (creates gaps)
            const pathSegments = [];
            let currentSegment = [];

            altitudeData.data.forEach((d, i) => {
                if (d.targetAltitude !== null && d.targetAltitude >= 0) {
                    const x = (d.dayIndex / 365) * graphWidth;
                    const clampedAlt = Math.min(90, d.targetAltitude);
                    const y = graphHeight - (clampedAlt / 90) * graphHeight;
                    currentSegment.push({ x, y });
                } else {
                    // Negative or null altitude - end current segment
                    if (currentSegment.length > 0) {
                        pathSegments.push(currentSegment);
                        currentSegment = [];
                    }
                }
            });

            // Add final segment if any
            if (currentSegment.length > 0) {
                pathSegments.push(currentSegment);
            }

            // Draw each segment as a separate path
            pathSegments.forEach(segment => {
                if (segment.length < 2) return; // Skip single points

                const targetPath = segment.map((point, i) => {
                    return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
                }).join(' ');

                // Black outline for target
                const targetOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                targetOutline.setAttribute('d', targetPath);
                targetOutline.setAttribute('fill', 'none');
                targetOutline.setAttribute('stroke', '#000000');
                targetOutline.setAttribute('stroke-width', '3');
                graphGroup.appendChild(targetOutline);

                // Orange/coral line on top
                const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                targetLine.setAttribute('d', targetPath);
                targetLine.setAttribute('fill', 'none');
                targetLine.setAttribute('stroke', '#ff6b6b');
                targetLine.setAttribute('stroke-width', '2');
                graphGroup.appendChild(targetLine);
            });
        }

        // Draw current day indicator (extends full height of SVG)
        const today = new Date();
        const daysSinceStart = Math.floor((today - altitudeData.startDate) / (1000 * 60 * 60 * 24));

        if (daysSinceStart >= 0 && daysSinceStart < 365) {
            const x = padding.left + (daysSinceStart / 365) * graphWidth;

            // Draw vertical line for current day extending full height
            const todayLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            todayLine.setAttribute('x1', x);
            todayLine.setAttribute('y1', 0);
            todayLine.setAttribute('x2', x);
            todayLine.setAttribute('y2', height);
            todayLine.setAttribute('stroke', '#ffa726');
            todayLine.setAttribute('stroke-width', '3');
            todayLine.setAttribute('opacity', '0.8');
            svg.appendChild(todayLine);
        }

        // Append SVG to container
        container.innerHTML = '';
        container.appendChild(svg);

        // Render legend below the graph in the legend container
        this.renderLegend(inputs, altitudeData);
    },

    /**
     * Render the legend below the graph
     */
    renderLegend(inputs, altitudeData) {
        const legendContainer = document.getElementById('yearly-observability-legend');
        if (!legendContainer) return;

        // Get CSS variables for theme support
        const computedStyle = getComputedStyle(document.documentElement);
        const textColor = computedStyle.getPropertyValue('--text-color').trim();
        const borderColor = computedStyle.getPropertyValue('--border-color').trim();

        legendContainer.innerHTML = '';

        // Target altitude legend item
        if (inputs.showTargetAltitude !== false) {
            const targetItem = document.createElement('div');
            targetItem.style.display = 'flex';
            targetItem.style.alignItems = 'center';
            targetItem.style.gap = '0.5rem';

            const targetLine = document.createElement('div');
            targetLine.style.width = '30px';
            targetLine.style.height = '2px';
            targetLine.style.background = '#ff6b6b';
            targetItem.appendChild(targetLine);

            const targetLabel = document.createElement('span');
            targetLabel.style.color = textColor;
            targetLabel.style.fontSize = '12px';
            targetLabel.textContent = 'Target Altitude';
            targetItem.appendChild(targetLabel);

            legendContainer.appendChild(targetItem);
        }

        // Minimum altitude legend item
        if (inputs.showMinAltitude) {
            const minAltItem = document.createElement('div');
            minAltItem.style.display = 'flex';
            minAltItem.style.alignItems = 'center';
            minAltItem.style.gap = '0.5rem';

            const minAltLine = document.createElement('div');
            minAltLine.style.width = '30px';
            minAltLine.style.height = '2px';
            minAltLine.style.borderTop = '2px dashed #ef5350';
            minAltLine.style.background = 'none';
            minAltItem.appendChild(minAltLine);

            const minAltLabel = document.createElement('span');
            minAltLabel.style.color = textColor;
            minAltLabel.style.fontSize = '12px';
            minAltLabel.textContent = `Minimum Altitude`;
            minAltItem.appendChild(minAltLabel);

            legendContainer.appendChild(minAltItem);
        }

        // Imaging quality gradient legend item
        if (inputs.showSkyglow) {
            const imagingItem = document.createElement('div');
            imagingItem.style.display = 'flex';
            imagingItem.style.alignItems = 'center';
            imagingItem.style.gap = '0.5rem';

            const imagingBox = document.createElement('div');
            imagingBox.style.width = '30px';
            imagingBox.style.height = '12px';
            imagingBox.style.background = 'linear-gradient(to right, #000000, #888888, #ffffff)';
            imagingBox.style.border = `1px solid ${borderColor}`;
            imagingItem.appendChild(imagingBox);

            const imagingLabel = document.createElement('span');
            imagingLabel.style.color = textColor;
            imagingLabel.style.fontSize = '12px';
            imagingLabel.textContent = 'Observability (darker = better)';
            imagingItem.appendChild(imagingLabel);

            legendContainer.appendChild(imagingItem);

            // Full moon legend item (only show when skyglow is enabled)
            const fullMoonItem = document.createElement('div');
            fullMoonItem.style.display = 'flex';
            fullMoonItem.style.alignItems = 'center';
            fullMoonItem.style.gap = '0.5rem';

            const moonCircle = document.createElement('div');
            moonCircle.style.width = '8px';
            moonCircle.style.height = '8px';
            moonCircle.style.borderRadius = '50%';
            moonCircle.style.background = '#ffd700';
            moonCircle.style.border = '1px solid #000';
            fullMoonItem.appendChild(moonCircle);

            const moonLabel = document.createElement('span');
            moonLabel.style.color = textColor;
            moonLabel.style.fontSize = '12px';
            moonLabel.textContent = 'Full Moon';
            fullMoonItem.appendChild(moonLabel);  // FIXED: was moonItem, now fullMoonItem

            legendContainer.appendChild(fullMoonItem);
        }

        // Current day legend item (ALWAYS show, moved outside skyglow block)
        const currentDayItem = document.createElement('div');
        currentDayItem.style.display = 'flex';
        currentDayItem.style.alignItems = 'center';
        currentDayItem.style.gap = '0.5rem';

        const currentDayLine = document.createElement('div');
        currentDayLine.style.width = '3px';
        currentDayLine.style.height = '20px';
        currentDayLine.style.background = '#ffa726';
        currentDayLine.style.opacity = '0.8';
        currentDayItem.appendChild(currentDayLine);

        const currentDayLabel = document.createElement('span');
        currentDayLabel.style.color = textColor;
        currentDayLabel.style.fontSize = '12px';
        currentDayLabel.textContent = 'Current Day';
        currentDayItem.appendChild(currentDayLabel);

        legendContainer.appendChild(currentDayItem);
    }
};
