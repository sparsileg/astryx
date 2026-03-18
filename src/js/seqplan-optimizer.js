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
     * Optimize target sequence to minimize overhead events near target transitions
     * Runs as a second pass after optimizeTargetOrder()
     * Attempts shift first, then reorder if shift doesn't resolve conflicts
     * @param {Array} targets - Ordered targets (output of optimizeTargetOrder)
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Tolerance window in minutes (0 = disabled)
     * @returns {Array} Targets with adjusted allocations and/or reordered
     */
    optimizeTransitions(targets, session, toleranceMinutes) {
        if (!APP_CONFIG.FEATURES.TRANSITION_OPTIMIZATION) return targets;
        if (targets.length < 2 || toleranceMinutes <= 0) return targets;

        const MAX_ITERATIONS = 3;
        let current = targets.map(t => ({ ...t }));

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            // Recalculate with current allocations
            const calculated = SeqPlanCalculations.calculateExposureCounts(current, session);

            // Find conflicts
            const conflicts = SeqPlanCalculations.findTransitionConflicts(
                calculated, session, toleranceMinutes
            );

            if (conflicts.length === 0) {
                console.log(`Transition optimization: no conflicts after ${iteration} iteration(s)`);
                break;
            }

            console.log(`Transition optimization iteration ${iteration + 1}: ${conflicts.length} conflict(s) found`);

            let improved = false;

            for (const conflict of conflicts) {
                const i = conflict.targetIndex;

                if (conflict.type === 'flip_near_end') {
                    // Shift boundary earlier to skip the flip entirely
                    // Reduce current target allocation by (overheadMinutes + minutesFromBoundary)
                    const shiftMinutes = conflict.overheadMinutes + conflict.minutesFromBoundary;
                    const totalMinutes = (session.sessionEndJD - session.sessionStartJD) * 24 * 60;
                    const shiftPercent = shiftMinutes / totalMinutes * 100;

                    if (current[i].allocatedPercent - shiftPercent > 0 &&
                        current[i + 1] &&
                        current[i + 1].allocatedPercent + shiftPercent > 0) {
                        current[i].allocatedPercent -= shiftPercent;
                        current[i + 1].allocatedPercent += shiftPercent;
                        console.log(`  flip_near_end: shifted ${shiftMinutes.toFixed(1)} min from target ${i} to ${i + 1}`);
                        improved = true;
                    }

                } else if (conflict.type === 'flip_near_start') {
                    // Shift boundary later so flip happens on current target's time
                    // Extend current target allocation by (overheadMinutes - minutesFromBoundary)
                    const shiftMinutes = conflict.overheadMinutes - conflict.minutesFromBoundary;
                    if (shiftMinutes > 0) {
                        const totalMinutes = (session.sessionEndJD - session.sessionStartJD) * 24 * 60;
                        const shiftPercent = shiftMinutes / totalMinutes * 100;

                        if (current[i] &&
                            current[i + 1].allocatedPercent - shiftPercent > 0) {
                            current[i].allocatedPercent += shiftPercent;
                            current[i + 1].allocatedPercent -= shiftPercent;
                            console.log(`  flip_near_start: shifted ${shiftMinutes.toFixed(1)} min from target ${i + 1} to ${i}`);
                            improved = true;
                        }
                    }

                } else if (conflict.type === 'af_near_end') {
                    // Shift boundary earlier by just enough to drop the last AF run
                    // before transition, landing boundary between previous and last AF event
                    // Shift = minutesFromBoundary + small buffer to clear the AF event
                    const shiftMinutes = conflict.minutesFromBoundary + conflict.overheadMinutes + 1;
                    const totalMinutes = (session.sessionEndJD - session.sessionStartJD) * 24 * 60;
                    const shiftPercent = shiftMinutes / totalMinutes * 100;

                    if (current[i].allocatedPercent - shiftPercent > 0 &&
                        current[i + 1] &&
                        current[i + 1].allocatedPercent + shiftPercent > 0) {
                        current[i].allocatedPercent -= shiftPercent;
                        current[i + 1].allocatedPercent += shiftPercent;
                        console.log(`  af_near_end: shifted ${shiftMinutes.toFixed(1)} min from target ${i} to ${i + 1} (gap was ${conflict.gapToNextAF.toFixed(1)} min, interval ${session.autofocusInterval} min)`);
                        improved = true;
                    }
                }
            }
            if (!improved) {
                // Shifts didn't help — try reordering
                console.log(`  No improvement from shifts, attempting reorder`);
                const reordered = this.tryReorder(current, session, toleranceMinutes);
                if (reordered) {
                    current = reordered;
                    improved = true;
                } else {
                    console.log(`  Reorder did not improve conflicts, stopping`);
                    break;
                }
            }
        }

        return current;
    },

    /**
     * Try all permutations of target order to find one with fewer conflicts
     * Only practical for small numbers of targets (2-4)
     * @param {Array} targets - Current target order
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Tolerance window in minutes
     * @returns {Array|null} Better ordered targets, or null if no improvement found
     */
    tryReorder(targets, session, toleranceMinutes) {
        const currentCalculated = SeqPlanCalculations.calculateExposureCounts(targets, session);
        const currentConflicts = SeqPlanCalculations.findTransitionConflicts(
            currentCalculated, session, toleranceMinutes
        ).length;

        // Generate all permutations
        const permutations = this.getPermutations(targets);
        let bestOrder = null;
        let bestConflicts = currentConflicts;

        for (const perm of permutations) {
            const calculated = SeqPlanCalculations.calculateExposureCounts(perm, session);
            const conflicts = SeqPlanCalculations.findTransitionConflicts(
                calculated, session, toleranceMinutes
            ).length;

            if (conflicts < bestConflicts) {
                bestConflicts = conflicts;
                bestOrder = perm;
                console.log(`  Reorder found better order with ${conflicts} conflict(s)`);
            }
        }

        return bestOrder;
    },

    /**
     * Generate all permutations of an array
     * @param {Array} arr - Input array
     * @returns {Array} Array of all permutations
     */
    getPermutations(arr) {
        if (arr.length <= 1) return [arr];
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const perms = this.getPermutations(rest);
            perms.forEach(perm => result.push([arr[i], ...perm]));
        }
        return result;
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
