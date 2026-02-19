/**
 * seqplan-optimizer.js
 * Target ordering optimization for Sequence Planner
 */

const SeqPlanOptimizer = {

    /**
     * Suggest optimal target order based on transit times
     * @param {Array} targets - Array of target plans
     * @param {Object} session - Session configuration
     * @returns {Array} Targets sorted in suggested order
     */
    optimizeTargetOrder(targets, session) {
        const scoredTargets = targets.map(target => {
            // Find transit time during session
            const transitJD = findTargetTransit(
                session.sessionStartJD,
                session.sessionEndJD,
                target.ra,
                target.dec,
                session.location.longitude
            );

            // Find when target sets below minimum altitude
            const setJD = findTargetSet(
                session.sessionStartJD,
                session.sessionEndJD,
                target.ra,
                target.dec,
                session.location.latitude,
                session.location.longitude,
                session.minAltitude,
                null
            );

            // Find when target rises above minimum altitude
            const riseJD = findTargetRise(
                session.sessionStartJD,
                session.sessionEndJD,
                target.ra,
                target.dec,
                session.location.latitude,
                session.location.longitude,
                session.minAltitude,
                null
            );

            // Score by set time (earliest setting targets first)
            // Targets that never set (visible all night) score last
            // Use riseJD as secondary to avoid scheduling before target is visible
            const setScore = setJD ? (setJD - session.sessionStartJD) : 999;

            return {
                ...target,
                transitJD: transitJD,
                riseJD: riseJD,
                setJD: setJD,
                score: setScore,
                suggestedOrder: 0,
                userOrder: 0,
                orderOverridden: false
            };
        });

        // Sort by set time (earliest setting targets imaged first)
        scoredTargets.sort((a, b) => a.score - b.score);

        // Assign suggested order
        scoredTargets.forEach((target, index) => {
            target.suggestedOrder = index + 1;
            target.userOrder = index + 1; // Initialize to suggested
        });

        return scoredTargets;
    },

    /**
     * STUB: Apply moon avoidance - placeholder for future implementation
     * @param {Array} targets - Ordered targets
     * @param {Object} session - Session configuration
     * @returns {Array} Targets (unmodified for now)
     */
    applyMoonAvoidance(targets, session) {
        // TODO: Implement moon avoidance algorithm
        // 1. Get moon position and phase for session using getMoonPosition()
        // 2. Calculate angular separation from each target using getAngularSeparation()
        // 3. Prefer targets far from moon when moon is bright
        // 4. Image near-moon targets when moon sets or is dim

        return targets; // No modification for now
    },

    /**
     * Check if target is visible above both minimum altitude and horizon profile
     * Uses isAboveHorizon() from astro-core.js
     * @param {number} jd - Julian Date
     * @param {number} raHours - Target right ascension (hours)
     * @param {number} decDeg - Target declination (degrees)
     * @param {number} latitude - Observer latitude (degrees)
     * @param {number} longitude - Observer longitude (degrees)
     * @param {number} minAltitude - Minimum altitude constraint (degrees)
     * @param {boolean} useHorizon - Whether to use horizon profile
     * @param {Array} horizonArray - Array of {azimuth, elevation} points
     * @returns {boolean} True if target is visible
     */
    isTargetVisible(jd, raHours, decDeg, latitude, longitude, minAltitude, useHorizon, horizonArray) {
        // Calculate target altitude and azimuth
        const altitude = getAltitude(jd, raHours, decDeg, latitude, longitude);
        const azimuth = getAzimuth(jd, raHours, decDeg, latitude, longitude);

        // Use isAboveHorizon() from astro-core.js
        // If not using horizon, pass empty array (acts as flat horizon)
        return isAboveHorizon(altitude, azimuth, minAltitude, useHorizon ? horizonArray : []);
    },

    /**
     * STUB: Split target imaging around horizon obstruction
     * Future: Detect when target dips below horizon temporarily
     * Future: Create separate imaging windows before/after obstruction
     * @param {Object} targetPlan - Target plan with imaging window
     * @param {Object} session - Session configuration
     * @returns {Array} Array with single window for now
     */
    splitAroundObstruction(targetPlan, session) {
        // TODO: Implement obstruction splitting
        // 1. Scan through target's imaging window
        // 2. Find periods when target is below horizon using isAboveHorizon()
        // 3. Split imaging into multiple windows if needed
        // 4. Return array of imaging windows instead of single window

        return [targetPlan]; // Single window for now
    }
};
