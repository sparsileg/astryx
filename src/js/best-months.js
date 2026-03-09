/**
 * best-months.js
 * Calculating best observing months
 */

// Configurable sampling parameters
const SAMPLING_INTERVAL_MINUTES = 10;   // Minutes between altitude samples
const DAY_SAMPLING_STEP = 3;            // 1 = every day, 2 = every other day, etc.

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

        // Generate timestamp at start of calculation (YYYYMMDD-HHMMSSZ format)
        const now = new Date();
        const timestamp = now.getUTCFullYear().toString() +
              (now.getUTCMonth() + 1).toString().padStart(2, '0') +
              now.getUTCDate().toString().padStart(2, '0') + '-' +
              now.getUTCHours().toString().padStart(2, '0') +
              now.getUTCMinutes().toString().padStart(2, '0') +
              now.getUTCSeconds().toString().padStart(2, '0') + 'Z';

        // Store calculation parameters in settings
        await SettingsManager.setLastBestMonthsAltitude(minAltitude);
        await SettingsManager.setLastBestMonthsDarkHours(minDarkHours);
        await SettingsManager.setLastBestMonthsCalculated(timestamp);
        await SettingsManager.setLastBestMonthsLocation(locationName);

        const targets = DataManager.getTargets();
        const totalTargets = targets.length;
        let processedCount = 0;
        let visibleCount = 0;
        let notVisibleCount = 0;

        console.log(`Calculating best months for ${totalTargets} targets...`);

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

            // Write in batches of 100 to avoid blocking
            if (processedCount % 100 === 0) {
                await DBManager.putBulk(APP_CONFIG.STORES.TARGETS, targets.slice(processedCount - 100, processedCount));
            }
        }

        // Write any remaining targets (less than 100)
        const remainder = processedCount % 100;
        if (remainder > 0) {
            await DBManager.putBulk(APP_CONFIG.STORES.TARGETS, targets.slice(processedCount - remainder, processedCount));
        }

        this.isCalculating = false;

        // Reload targets to pick up changes
        await DataManager.loadTargets();

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
     * Pre-calculate twilight times for all days of the year
     * Returns a Map keyed by day offset (0-364)
     */
    buildTwilightCache(location) {
        console.log('Pre-calculating twilight times for 365 days...');
        const twilightCache = new Map();
        const startDate = new Date(new Date().getFullYear(), 0, 1);

        for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);
            const isDST = SettingsManager.isDSTActive(date, location.timezone);

            twilightCache.set(dayOffset, {
                duskJD: findAstronomicalDusk(date, location.latitude, location.longitude, location.timezone, isDST),
                dawnJD: findNextAstronomicalDawn(date, location.latitude, location.longitude, location.timezone, isDST),
                date: date
            });
        }

        console.log('Twilight cache complete');
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
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);
            const darkHours = this.calculateTotalDarkHours(date, target, location, altitudeThreshold, twilightCache, dayOffset);
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
            const transitHour = this.calculateTransitHour(date, target, location, twilightCache, dayOffset);
            let transitScore = 0;
            if (transitHour !== null) {
                const distanceFromMidnight = Math.min(
                    Math.abs(transitHour - 0),
                    Math.abs(transitHour - 24)
                );
                transitScore = 1 - (distanceFromMidnight / 12);
            }

            // Calculate dark hours score (normalized)
            const darkHours = this.calculateTotalDarkHours(date, target, location, altitudeThreshold, twilightCache, dayOffset);
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
     * Get altitude threshold and weights for target type
     */
    getTypeConfiguration(type) {
        // Normalize type to uppercase for comparison
        const normalizedType = (type || '').toUpperCase();

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
        return configs[normalizedType] || { altitude: 30, transitWeight: 0.60, darkHoursWeight: 0.40 };
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
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + dayOffset);

            const darkHours = this.calculateDarkHoursAboveAltitude(date, target, location, minAltitude, twilightCache, dayOffset);

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

        // Find the longest continuous sequence of visible days
        // Handle wrap-around for winter targets (e.g., day 350-364, 0-60)
        let bestStart = visibleDays[0];
        let bestEnd = visibleDays[0];
        let bestLength = 1;

        // Check for continuous sequence without wrap
        let currentStart = visibleDays[0];
        let currentEnd = visibleDays[0];

        for (let i = 1; i < visibleDays.length; i++) {
            if (visibleDays[i] === visibleDays[i-1] + 1) {
                // Continuous
                currentEnd = visibleDays[i];
            } else {
                // Gap found
                const length = currentEnd - currentStart + 1;
                if (length > bestLength) {
                    bestStart = currentStart;
                    bestEnd = currentEnd;
                    bestLength = length;
                }
                currentStart = visibleDays[i];
                currentEnd = visibleDays[i];
            }
        }

        // Check final sequence
        const finalLength = currentEnd - currentStart + 1;
        if (finalLength > bestLength) {
            bestStart = currentStart;
            bestEnd = currentEnd;
            bestLength = finalLength;
        }

        // Check for wrap-around sequence (connects end of year to beginning)
        if (visibleDays[0] < 31 && visibleDays[visibleDays.length - 1] > 334) {
            // Might wrap around - find where the gap is
            let gapStart = -1;
            for (let i = 1; i < visibleDays.length; i++) {
                if (visibleDays[i] !== visibleDays[i-1] + 1) {
                    gapStart = i;
                    break;
                }
            }

            if (gapStart > 0) {
                // Wrap-around sequence exists
                const wrapLength = (visibleDays.length - gapStart) + gapStart;
                if (wrapLength > bestLength) {
                    // Use wrap-around sequence
                    bestStart = visibleDays[gapStart];  // First day after gap
                    bestEnd = visibleDays[gapStart - 1] + 365;  // Last day before gap, extended
                }
            }
        }

        // Convert day offsets to dates to get months
        const startDateObj = new Date(startDate);
        startDateObj.setDate(startDate.getDate() + (bestStart % 365));

        const endDateObj = new Date(startDate);
        endDateObj.setDate(startDate.getDate() + (bestEnd % 365));

        let startMonth = startDateObj.getMonth() + 1;  // 1-12
        let endMonth = endDateObj.getMonth() + 1;      // 1-12

        // Handle wrap-around notation (e.g., November to February becomes 11 to 14)
        if (bestEnd >= 365) {
            endMonth = endMonth + 12;
        }

        return {
            visibilityStart: startMonth,
            visibilityEnd: endMonth
        };
    },

    /**
     * Calculate longest continuous session target is above minAltitude during astronomical darkness
     * Returns: hours (decimal) of the longest continuous session
     */
    calculateDarkHoursAboveAltitude(date, target, location, minAltitude, twilightCache, dayOffset) {
        // Get twilight times from cache
        const twilight = twilightCache.get(dayOffset);
        const duskJD = twilight.duskJD;
        const dawnJD = twilight.dawnJD;

        if (!duskJD || !dawnJD) {
            return 0; // No astronomical darkness on this date
        }
        // Sample every N minutes during dark period
        const step = SAMPLING_INTERVAL_MINUTES / 1440;

        let longestSession = 0;
        let currentSession = 0;

        for (let jd = duskJD; jd <= dawnJD; jd += step) {
            const altitude = getAltitude(jd, target.ra, target.dec, location.latitude, location.longitude);

            if (altitude >= minAltitude) {
                // Target is above altitude - extend current session
                currentSession += (step * 24); // Convert JD step to hours
            } else {
                // Target dropped below altitude - check if this was the longest session
                if (currentSession > longestSession) {
                    longestSession = currentSession;
                }
                // Reset for next potential session
                currentSession = 0;
            }
        }

        // Check final session in case it extended to dawn
        if (currentSession > longestSession) {
            longestSession = currentSession;
        }

        return longestSession;
    },

    /**
     * Calculate total accumulated dark hours target is above minAltitude during astronomical darkness
     * Used for best month scoring - sums all time above altitude (not just continuous)
     * Returns: hours (decimal) of total accumulated time
     */
    calculateTotalDarkHours(date, target, location, minAltitude, twilightCache, dayOffset) {
        // Get twilight times from cache
        const twilight = twilightCache.get(dayOffset);
        const duskJD = twilight.duskJD;
        const dawnJD = twilight.dawnJD;

        if (!duskJD || !dawnJD) {
            return 0; // No astronomical darkness on this date
        }
        // Sample every N minutes during dark period
        const step = SAMPLING_INTERVAL_MINUTES / 1440;
        let totalHours = 0;

        for (let jd = duskJD; jd <= dawnJD; jd += step) {
            const altitude = getAltitude(jd, target.ra, target.dec, location.latitude, location.longitude);

            if (altitude >= minAltitude) {
                totalHours += (step * 24); // Convert JD step to hours
            }
        }

        return totalHours;
    },

    /**
     * Calculate the local hour when target transits on a given date
     * Returns: hour (0-24) or null if transit not found
     */
    calculateTransitHour(date, target, location, twilightCache, dayOffset) {
        // Start searching from noon on the given date
        const noon = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            12, 0, 0
        );

        // Convert to UTC
        const isDST = SettingsManager.isDSTActive(noon, location.timezone);
        const offsetHours = isDST ? location.timezone + 1 : location.timezone;
        const utcNoon = new Date(noon.getTime() - offsetHours * 3600000);
        const noonJD = dateToJD(utcNoon);

        // Transit occurs when LST = target RA
        // Search from noon-12h to noon+12h to find transit
        const oneHour = 1/24;

        for (let hourOffset = -12; hourOffset <= 12; hourOffset += 0.1) {
            const testJD = noonJD + hourOffset * oneHour;
            const lst = getLST(testJD, location.longitude);

            // Check if LST is close to target RA (within 0.1 hours)
            let diff = Math.abs(lst - target.ra);
            // Handle wrap-around (23.9 hours and 0.1 hours are close)
            if (diff > 12) diff = 24 - diff;

            if (diff < 0.05) { // Within ~3 minutes
                // Convert JD back to local time
                const utcDate = jdToDate(testJD);
                const localDate = new Date(utcDate.getTime() + offsetHours * 3600000);
                return localDate.getUTCHours() + localDate.getUTCMinutes() / 60;
            }
        }

        return null;
    },

    /**
     * Calculate peak altitude when target transits
     * This is constant for a given target/location (depends only on declination and latitude)
     */
    calculateTransitAltitude(target, location) {
        // Transit altitude = 90 - |latitude - declination| for upper culmination
        const transitAlt = 90 - Math.abs(location.latitude - target.dec);

        // Check artificial horizon at meridian (azimuth = 180 for south, 0 for north)
        const meridianAzimuth = location.latitude > target.dec ? 180 : 0;
        const horizonElevation = this.getHorizonElevation(meridianAzimuth, location.horizon);

        // Return the minimum of transit altitude and horizon-adjusted altitude
        return Math.max(transitAlt, horizonElevation);
    },

    /**
     * Get horizon elevation at a given azimuth by interpolating between points
     */
    getHorizonElevation(azimuth, horizon) {
        // Normalize azimuth to 0-360
        azimuth = ((azimuth % 360) + 360) % 360;

        // Find surrounding horizon points
        const sortedHorizon = [...horizon].sort((a, b) => a.azimuth - b.azimuth);

        // Find the two points that surround the azimuth
        let before = sortedHorizon[sortedHorizon.length - 1];
        let after = sortedHorizon[0];

        for (let i = 0; i < sortedHorizon.length; i++) {
            if (sortedHorizon[i].azimuth <= azimuth) {
                before = sortedHorizon[i];
                after = sortedHorizon[(i + 1) % sortedHorizon.length];
            } else {
                break;
            }
        }

        // Handle wrap-around at 0/360
        let az1 = before.azimuth;
        let az2 = after.azimuth;
        if (az2 < az1) az2 += 360;
        if (azimuth < az1) azimuth += 360;

        // Linear interpolation
        const fraction = (azimuth - az1) / (az2 - az1);
        return before.elevation + fraction * (after.elevation - before.elevation);
    }
};
