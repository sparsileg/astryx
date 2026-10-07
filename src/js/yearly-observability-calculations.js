/**
 * yearly-observability-calculations.js
 * Yearly Observability calculations: a target's altitude and scores for each
 * night of the year. The graph is drawn by yearly-observability-view.js.
 */

const YearlyObservabilityCalculations = {

    /**
     * Calculate altitude at midnight for each day starting from the 1st of the current month
     */
    calculateYearlyAltitudeData(inputs) {
        const data = [];
        const today = new Date();

        // Start from the 1st of the current month
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get type-specific configuration
        const typeConfig = BestMonths.getTypeConfiguration(inputs.targetType);
        const typeAltitudeThreshold = typeConfig.altitude;
        const transitWeight = typeConfig.transitWeight;
        const darkHoursWeight = typeConfig.darkHoursWeight;

        // Per-day twilight cache (perf): dusk/dawn depend only on date/location,
        // so compute each night once here and reuse it for both dark-hours
        // passes, the transit time, calculateImagingScore, and the
        // peak-altitude scan below. Keyed by dayOffset.
        const twilightCache = new Map();

        // First pass: find max dark hours for normalization
        let maxDarkHours = 0;
        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);

            const isDST = SettingsManager.isDSTOnDate(date, inputs);
            const duskJD = findAstronomicalDusk(date, inputs.latitude, inputs.longitude, inputs.timezone, isDST);
            const dawnJD = findNextAstronomicalDawn(date, inputs.latitude, inputs.longitude, inputs.timezone, isDST);
            const samples = getNightSamples(duskJD, dawnJD, inputs.longitude);
            const midnightJD = TimeUtils.localWallClockToJD(date.getFullYear(), date.getMonth(), date.getDate(), 0, inputs.timezone, isDST);
            twilightCache.set(dayOffset, { duskJD, dawnJD, samples, midnightJD });

            const darkHours = getHoursAboveAltitude(samples, inputs.ra, inputs.dec, inputs.latitude, typeAltitudeThreshold).totalHours;
            if (darkHours > maxDarkHours) {
                maxDarkHours = darkHours;
            }
        }

        // Second pass: calculate scores and altitudes for each day
        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);

            // Reuse the dusk/dawn computed in the first pass instead of
            // recomputing (perf: this was the second of four recomputations
            // per day before caching).
            const { duskJD, dawnJD, samples, midnightJD } = twilightCache.get(dayOffset);

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
                    const transitHour = getTransitHour(midnightJD, inputs.ra, inputs.longitude);
                    const distanceFromMidnight = Math.min(
                        Math.abs(transitHour - 0),
                        Math.abs(transitHour - 24)
                    );
                    const transitScore = 1 - (distanceFromMidnight / 12);

                    // 2. Dark hours score
                    const darkHours = getHoursAboveAltitude(samples, inputs.ra, inputs.dec, inputs.latitude, typeAltitudeThreshold).totalHours;
                    const darkHoursScore = maxDarkHours > 0 ? (darkHours / maxDarkHours) : 0;

                    // 3. Base score (weighted)
                    const baseScore = (transitScore * transitWeight) + (darkHoursScore * darkHoursWeight);

                    // 4. Moon factor — sampled over this night's dusk→dawn, the
                    // same way as Daily Visibility and the Imaging Log
                    const moonIllum = getNightMoonPhase(duskJD, dawnJD).illumination / 100; // Convert to 0-1

                    // Closest moon approach while the target is above threshold;
                    // if it never gets that high, closest approach all night
                    const separation =
                        getMinMoonSeparation(duskJD, dawnJD, inputs.ra, inputs.dec, inputs.latitude, inputs.longitude, typeAltitudeThreshold) ??
                        getMinMoonSeparation(duskJD, dawnJD, inputs.ra, inputs.dec, inputs.latitude, inputs.longitude, -90);

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
                targetAltitude = getAltitude(midnightJD, inputs.ra, inputs.dec, inputs.latitude, inputs.longitude);
                observabilityScore = 0;
            }

            // Calculate imaging quality score (always computed — consumed by full-moon
            // peak markers, which read imagingScore.moonIllum; not conditional/legacy)
            // Reuses this day's cached dusk/dawn instead of recomputing.
            let imagingScore = null;
            imagingScore = this.calculateImagingScore(date, inputs, duskJD, dawnJD);

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
     * @param {number} [duskJD] - Pre-computed dusk JD (perf: see calculateYearlyAltitudeData's
     *     per-day twilight cache). Falls back to computing it when omitted, so this
     *     function remains usable standalone.
     * @param {number} [dawnJD] - Pre-computed dawn JD, same as above.
     */
    calculateImagingScore(date, inputs, duskJD = null, dawnJD = null) {
        if (duskJD === null || dawnJD === null) {
            // Find astronomical dusk and dawn (sun at -18°) via the single
            // canonical implementation in astro-sun.js, which builds its own
            // timezone-independent noon/midnight instant internally — no
            // manual noon/offset construction needed here anymore.
            const isDST = SettingsManager.isDSTOnDate(date, inputs);
            duskJD = findAstronomicalDusk(date, inputs.latitude, inputs.longitude, inputs.timezone, isDST);
            dawnJD = findNextAstronomicalDawn(date, inputs.latitude, inputs.longitude, inputs.timezone, isDST);
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
        const moonIllumination = getNightMoonPhase(duskJD, dawnJD).illumination / 100; // Convert to 0-1

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
    }
};
