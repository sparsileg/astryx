/**
 * best-months.js
 * Calculating best observing months
 */

// Configurable sampling parameters
const DAY_SAMPLING_STEP = 3;            // 1 = every day, 2 = every other day, etc.
const DAYS_IN_YEAR = 365;

const BestMonths = {
    isCalculating: false,
    cancelRequested: false,

    /**
     * Calculate best observing month for all targets at a location
     */
    async calculateBestMonths(locationName, minAltitude, minDarkHours, progressCallback) {
        this.isCalculating = true;
        this.cancelRequested = false;

        const location = DataManager.getLocation(locationName);
        if (!location) {
            throw new Error(`Location "${locationName}" not found`);
        }
        const twilightCache = this.buildTwilightCache(location);

        const targets = DataManager.getTargets();
        const totalTargets = targets.length;
        let processedCount = 0;
        let visibleCount = 0;
        let notVisibleCount = 0;

        Log.debug(`Calculating best months for ${totalTargets} targets...`);

        // Calculate for each target
        for (const target of targets) {
            if (this.cancelRequested) {
                this.isCalculating = false;
                return { cancelled: true };
            }

            // Calculate best month using type-specific altitude thresholds and weighted scoring
            const transitResult = this.calculateBestMonth(target, location, twilightCache);

            // Calculate visibility window based on dark hours
            const visibilityResult = this.calculateVisibilityWindow(target, location, minAltitude, minDarkHours, twilightCache);
            // Initialize objects if they don't exist or convert old single values
            if (typeof target.bestMonth !== 'object' || target.bestMonth === null) {
                target.bestMonth = {};
            }
            if (typeof target.peakAltitude !== 'object' || target.peakAltitude === null) {
                target.peakAltitude = {};
            }
            if (typeof target.visibilityStart !== 'object' || target.visibilityStart === null) {
                target.visibilityStart = {};
            }
            if (typeof target.visibilityEnd !== 'object' || target.visibilityEnd === null) {
                target.visibilityEnd = {};
            }

            // Store results keyed by location name
            target.bestMonth[locationName] = transitResult.bestMonth;
            target.peakAltitude[locationName] = transitResult.peakAltitude;
            target.visibilityStart[locationName] = visibilityResult.visibilityStart;
            target.visibilityEnd[locationName] = visibilityResult.visibilityEnd;

            // Remove old bestMonthCalculated field if it exists
            if (target.bestMonthCalculated) {
                delete target.bestMonthCalculated;
            }

            if (transitResult.bestMonth !== null && visibilityResult.visibilityStart !== null) {
                visibleCount++;
            } else {
                notVisibleCount++;
            }

            processedCount++;

            // Call progress callback
            if (progressCallback) {
                progressCallback(processedCount, totalTargets, target.object);
            }

            // Yield to event loop periodically so UI can repaint — no DB write here,
            // only the final bulk write persists results
            if (processedCount % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Write all targets in one bulk operation now that calculation is complete —
        // avoids partial data persisting if the run is interrupted mid-loop
        await DataManager.bulkUpdateTargets(targets);

        this.isCalculating = false;

        // Reload targets to pick up changes
        await DataManager.loadTargets();

        // Store calculation parameters and completion timestamp only now —
        // a cancelled or interrupted run must not claim to be done.
        const now = new Date();
        const timestamp = now.getUTCFullYear().toString() +
              (now.getUTCMonth() + 1).toString().padStart(2, '0') +
              now.getUTCDate().toString().padStart(2, '0') + '-' +
              now.getUTCHours().toString().padStart(2, '0') +
              now.getUTCMinutes().toString().padStart(2, '0') +
              now.getUTCSeconds().toString().padStart(2, '0') + 'Z';

        await SettingsManager.setBestMonthsAltitude(locationName, minAltitude);
        await SettingsManager.setLastBestMonthsDarkHours(minDarkHours);
        await SettingsManager.setLastBestMonthsCalculated(timestamp);
        await SettingsManager.setLastBestMonthsLocation(locationName);

        document.dispatchEvent(new CustomEvent('best-months-updated', { detail: { locationName } }));

        return {
            cancelled: false,
            totalTargets: totalTargets,
            visibleCount: visibleCount,
            notVisibleCount: notVisibleCount
        };
    },

    /**
     * Cancel ongoing calculation
     */
    cancelCalculation() {
        this.cancelRequested = true;
    },

    /**
     * Pre-calculate per-night data for all days of the year. Everything here
     * depends only on the location, so it is computed once and shared by all
     * targets. Returns a Map keyed by day offset (0-364).
     *   duskJD, dawnJD — astronomical darkness
     *   samples — the night sampled for getHoursAboveAltitude
     *   midnightJD — local midnight starting the day, for getTransitHour
     */
    buildTwilightCache(location) {
        Log.debug('Pre-calculating twilight times for 365 days...');
        const twilightCache = new Map();
        const startDate = new Date(new Date().getFullYear(), 0, 1);

        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);
            const isDST = SettingsManager.isDSTOnDate(date, location);
            const duskJD = findAstronomicalDusk(date, location.latitude, location.longitude, location.timezone, isDST);
            const dawnJD = findNextAstronomicalDawn(date, location.latitude, location.longitude, location.timezone, isDST);
            const samples = getNightSamples(duskJD, dawnJD, location.longitude);
            const midnightJD = TimeUtils.localWallClockToJD(date.getFullYear(), date.getMonth(), date.getDate(), 0, location.timezone, isDST);
            twilightCache.set(dayOffset, { duskJD, dawnJD, date, samples, midnightJD });
        }

        Log.debug('Twilight cache complete');
        return twilightCache;
    },


    /**
     * Calculate best months for all saved locations sequentially
     */
    async calculateBestMonthsForAllLocations(minAltitude, minDarkHours, progressCallback) {
        this.isCalculating = true;
        this.cancelRequested = false;

        const locations = Object.keys(DataManager.getLocations());
        const totalLocations = locations.length;

        if (totalLocations === 0) {
            return {
                cancelled: false,
                error: 'No locations found'
            };
        }

        const results = {
            cancelled: false,
            locationsProcessed: 0,
            locationResults: {}
        };

        for (let i = 0; i < totalLocations; i++) {
            if (this.cancelRequested) {
                results.cancelled = true;
                break;
            }

            const locationName = locations[i];

            // Location-level progress callback
            if (progressCallback) {
                progressCallback({
                    phase: 'location',
                    currentLocation: locationName,
                    locationIndex: i + 1,
                    totalLocations: totalLocations
                });
            }

            // Calculate for this location
            const locationResult = await this.calculateBestMonths(
                locationName,
                minAltitude,
                minDarkHours,
                (processed, total, targetName) => {
                    // Target-level progress callback
                    if (progressCallback) {
                        progressCallback({
                            phase: 'target',
                            currentLocation: locationName,
                            locationIndex: i + 1,
                            totalLocations: totalLocations,
                            processedTargets: processed,
                            totalTargets: total,
                            currentTarget: targetName
                        });
                    }
                }
            );

            // Store results for this location
            results.locationResults[locationName] = locationResult;
            results.locationsProcessed++;

            if (locationResult.cancelled) {
                results.cancelled = true;
                break;
            }
        }

        this.isCalculating = false;
        return results;
    },

    /**
     * Calculate best observing month for a single target using weighted scoring
     * Returns: { bestMonth: number|null, peakAltitude: number }
     */
    calculateBestMonth(target, location, twilightCache) {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), 0, 1); // January 1

        // Determine altitude threshold and weights based on target type
        const typeConfig = this.getTypeConfiguration(target.type);
        const altitudeThreshold = typeConfig.altitude;
        const transitWeight = typeConfig.transitWeight;
        const darkHoursWeight = typeConfig.darkHoursWeight;

        // Calculate peak altitude at transit (constant for this target/location)
        const peakAltitude = this.calculateTransitAltitude(target, location);

        // If peak altitude never meets threshold, return early
        if (peakAltitude < altitudeThreshold) {
            return {
                bestMonth: null,
                peakAltitude: Math.round(peakAltitude * 10) / 10
            };
        }

        // First pass: find max dark hours across the year for normalization
        let maxDarkHours = 0;
        for (let dayOffset = 0; dayOffset < 365; dayOffset += DAY_SAMPLING_STEP) {
            const darkHours = this.hoursAboveAltitude(target, location, altitudeThreshold, twilightCache, dayOffset).totalHours;
            if (darkHours > maxDarkHours) {
                maxDarkHours = darkHours;
            }
        }

        // If no dark hours ever, target never observable
        if (maxDarkHours === 0) {
            return {
                bestMonth: null,
                peakAltitude: Math.round(peakAltitude * 10) / 10
            };
        }

        // Second pass: calculate weighted scores for each day
        let bestScore = -1;
        let bestMonth = null;

        for (let dayOffset = 0; dayOffset < 365; dayOffset += DAY_SAMPLING_STEP) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);

            // Calculate transit score (how close to midnight)
            const transitHour = getTransitHour(twilightCache.get(dayOffset).midnightJD, target.ra, location.longitude);
            const distanceFromMidnight = Math.min(
                Math.abs(transitHour - 0),
                Math.abs(transitHour - 24)
            );
            const transitScore = 1 - (distanceFromMidnight / 12);

            // Calculate dark hours score (normalized)
            const darkHours = this.hoursAboveAltitude(target, location, altitudeThreshold, twilightCache, dayOffset).totalHours;
            const darkHoursScore = darkHours / maxDarkHours;

            // Calculate weighted score
            const score = (transitScore * transitWeight) + (darkHoursScore * darkHoursWeight);

            if (score > bestScore) {
                bestScore = score;
                bestMonth = date.getMonth() + 1; // 1-12
            }
        }

        return {
            bestMonth: bestMonth,
            peakAltitude: Math.round(peakAltitude * 10) / 10
        };
    },

    /**
     * Get altitude threshold and weights for target type. Best Months and
     * Yearly Observability both score with this.
     */
    getTypeConfiguration(type) {
        // Normalize type to uppercase for comparison
        const normalizedType = (type ?? '').toUpperCase();

        // Type-specific configurations
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

        // Return config for type, or default for OTHER
        return configs[normalizedType] ?? { altitude: 30, transitWeight: 0.60, darkHoursWeight: 0.40 };
    },

    /**
     * Calculate visibility window based on dark hours threshold
     * Samples every day of the year to find actual crossing dates
     * Returns: { visibilityStart: number|null, visibilityEnd: number|null }
     */
    calculateVisibilityWindow(target, location, minAltitude, minDarkHours, twilightCache) {
        const today = new Date();
        const year = today.getFullYear();
        const startDate = new Date(year, 0, 1); // January 1

        // Calculate peak altitude at transit
        const peakAltitude = this.calculateTransitAltitude(target, location);

        // If peak altitude never meets minimum, return early
        if (peakAltitude < minAltitude) {
            return {
                visibilityStart: null,
                visibilityEnd: null
            };
        }

        // Sample every day of the year to find visible days
        const visibleDays = [];

        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const darkHours = this.hoursAboveAltitude(target, location, minAltitude, twilightCache, dayOffset).longestHours;

            if (darkHours >= minDarkHours) {
                visibleDays.push(dayOffset);
            }
        }

        if (visibleDays.length === 0) {
            return {
                visibilityStart: null,
                visibilityEnd: null
            };
        }

        // Find the longest run of consecutive visible days. The year is a
        // circle, so a winter run can wrap from December into January; its
        // end is then counted past the year (e.g. day 330 to day 405).
        const isVisible = new Set(visibleDays);
        let bestStart = 0;
        let bestLength = DAYS_IN_YEAR;
        if (visibleDays.length < DAYS_IN_YEAR) {
            bestLength = 0;
            for (const day of visibleDays) {
                // Count each run once, from its first day
                if (isVisible.has((day + DAYS_IN_YEAR - 1) % DAYS_IN_YEAR)) continue;
                let length = 1;
                while (isVisible.has((day + length) % DAYS_IN_YEAR)) length++;
                if (length > bestLength) {
                    bestStart = day;
                    bestLength = length;
                }
            }
        }
        const bestEnd = bestStart + bestLength - 1;

        // Convert day offsets to dates to get months
        const startDateObj = new Date(startDate);
        startDateObj.setDate(startDate.getDate() + bestStart);

        const endDateObj = new Date(startDate);
        endDateObj.setDate(startDate.getDate() + (bestEnd % DAYS_IN_YEAR));

        let startMonth = startDateObj.getMonth() + 1;  // 1-12
        let endMonth = endDateObj.getMonth() + 1;      // 1-12

        // Handle wrap-around notation (e.g., November to February becomes 11 to 14)
        if (bestEnd >= DAYS_IN_YEAR) {
            endMonth = endMonth + 12;
        }

        return {
            visibilityStart: startMonth,
            visibilityEnd: endMonth
        };
    },

    /**
     * Hours the target is at or above minAltitude on one cached night
     * (see getHoursAboveAltitude)
     */
    hoursAboveAltitude(target, location, minAltitude, twilightCache, dayOffset) {
        return getHoursAboveAltitude(twilightCache.get(dayOffset).samples, target.ra, target.dec, location.latitude, minAltitude);
    },

    /**
     * Peak altitude, at upper culmination: 90 - |latitude - declination|.
     * Constant for a target and location; negative for a target that never
     * rises. Like the rest of Best Months, it ignores the horizon profile.
     */
    calculateTransitAltitude(target, location) {
        return 90 - Math.abs(location.latitude - target.dec);
    }
};
