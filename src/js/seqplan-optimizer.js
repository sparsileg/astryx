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
     * Optimize target sequence to maximize total exposure count
     * Runs as a second pass after optimizeTargetOrder()
     * Tries all permutations and picks the one with the most total subs
     * Uses conflict count as tiebreaker when permutations are within tolerance
     * @param {Array} targets - Ordered targets (output of optimizeTargetOrder)
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Minimum imaging time improvement to accept reorder (0 = disabled)
     * @returns {Array} Targets in optimal order
     */
    /**
     * Optimize target sequence to maximize total exposure count
     * Runs as a second pass after optimizeTargetOrder()
     * Tries all permutations with flip boundary optimization per permutation
     * Only accepts result if it improves on baseline by at least TRANSITION_OPTIMIZATION_THRESHOLD
     * @param {Array} targets - Ordered targets (output of optimizeTargetOrder)
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Minimum imaging time to enable optimization (0 = disabled)
     * @returns {Array} Targets in optimal order
     */
    optimizeTransitions(targets, session, toleranceMinutes) {
        if (!APP_CONFIG.FEATURES.TRANSITION_OPTIMIZATION) return targets;
        if (targets.length < 2 || toleranceMinutes <= 0) return targets;

        // Calculate baseline sub count with input order
        const baselineWindow = SeqPlanCalculations.calculateSessionWindow(
            targets,
            session.duskJD,
            session.dawnJD,
            session.location,
            session.minAltitude,
            session.startTimeMode,
            session.customStartTime,
            session.useHorizon,
            session.useHorizon ? session.location.horizon : null
        );
        const baselineSession = {
            ...session,
            sessionStartJD: baselineWindow.sessionStartJD,
            sessionEndJD: baselineWindow.sessionEndJD
        };
        const baselineCalculated = SeqPlanCalculations.calculateExposureCounts(targets, baselineSession);
        const baselineSubs = baselineCalculated.reduce((sum, t) => sum + t.exposureCount, 0);
        console.log(`Transition optimization: baseline ${baselineSubs} subs`);

        // Find best permutation + flip boundary combination
        const best = this.tryReorder(targets, session, toleranceMinutes);

        if (!best) {
            console.log(`Transition optimization: no improvement found, keeping original`);
            return targets;
        }

        // Only accept if improvement exceeds configured threshold
        const threshold = APP_CONFIG.TRANSITION_OPTIMIZATION_THRESHOLD || 0.05;
        const minAcceptableSubs = Math.ceil(baselineSubs * (1 + threshold));
        if (best.totalSubs >= minAcceptableSubs) {
            console.log(`Transition optimization: accepted — ${baselineSubs} → ${best.totalSubs} subs (≥${threshold * 100}% improvement)`);
            return best.targets;
        }

        console.log(`Transition optimization: improvement insufficient (${baselineSubs} → ${best.totalSubs} subs, threshold ${minAcceptableSubs}), keeping original`);
        return targets;
    },

    /**
     * Try all permutations of target order, applying flip boundary optimization to each
     * Recalculates session window per permutation since last target determines session end
     * Returns the best permutation+flip combination found
     * Only practical for small numbers of targets (2-4)
     * @param {Array} targets - Current target order
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Tolerance window in minutes
     * @returns {Object|null} { targets, totalSubs, conflicts } or null if no improvement
     */
    tryReorder(targets, session, toleranceMinutes) {

        // Helper: score a permutation by recalculating session window, then applying
        // flip boundary optimization, returning the best achievable sub count
        const scorePerm = (perm) => {
            const sessionWindow = SeqPlanCalculations.calculateSessionWindow(
                perm,
                session.duskJD,
                session.dawnJD,
                session.location,
                session.minAltitude,
                session.startTimeMode,
                session.customStartTime,
                session.useHorizon,
                session.useHorizon ? session.location.horizon : null
            );
            const permSession = {
                ...session,
                sessionStartJD: sessionWindow.sessionStartJD,
                sessionEndJD: sessionWindow.sessionEndJD
            };

            // Try flip boundary optimization on this permutation
            const flipped = this.optimizeFlipBoundaries(perm, permSession, toleranceMinutes);
            const finalPerm = flipped || perm;

            // Recalculate with flip-optimized allocations
            const finalWindow = flipped ? SeqPlanCalculations.calculateSessionWindow(
                finalPerm,
                session.duskJD,
                session.dawnJD,
                session.location,
                session.minAltitude,
                session.startTimeMode,
                session.customStartTime,
                session.useHorizon,
                session.useHorizon ? session.location.horizon : null
            ) : sessionWindow;
            const finalSession = flipped ? {
                ...session,
                sessionStartJD: finalWindow.sessionStartJD,
                sessionEndJD: finalWindow.sessionEndJD
            } : permSession;

            const calculated = SeqPlanCalculations.calculateExposureCounts(finalPerm, finalSession);
            const totalSubs = calculated.reduce((sum, t) => sum + t.exposureCount, 0);
            const conflicts = SeqPlanCalculations.findTransitionConflicts(
                calculated, finalSession, toleranceMinutes
            ).length;
            return { totalSubs, conflicts, targets: finalPerm, permSession: finalSession };
        };

        // Score current order
        const currentScore = scorePerm(targets);

        // Generate and score all permutations
        const permutations = this.getPermutations(targets);
        let bestScore = null;
        let bestSubs = currentScore.totalSubs;
        let bestConflicts = currentScore.conflicts;

        for (const perm of permutations) {
            const score = scorePerm(perm);
            const subImprovement = score.totalSubs - currentScore.totalSubs;

            if (score.totalSubs > bestSubs) {
                bestSubs = score.totalSubs;
                bestConflicts = score.conflicts;
                bestScore = score;
            // Tiebreaker: same subs, prefer fewer conflicts
            } else if (score.totalSubs === bestSubs && score.conflicts < bestConflicts) {
                bestConflicts = score.conflicts;
                bestScore = score;
            }
        }
        if (bestScore) {
            return bestScore;
        }
        return null;
    },

    /**
     * Optimize target boundary positions around meridian flips
     * For each target with a meridian flip, tries two boundary positions:
     *   1. Exclude flip - end target just before flip pause begins
     *   2. Include flip - keep current boundary (flip happens in this target's time)
     * Picks the boundary combination that maximizes total exposure count
     * @param {Array} targets - Ordered targets (output of tryReorder)
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Tolerance window in minutes
     * @returns {Array|null} Targets with adjusted allocations, or null if no improvement
     */
    optimizeFlipBoundaries(targets, session, toleranceMinutes) {
        // First calculate baseline with current allocations
        const sessionWindow = SeqPlanCalculations.calculateSessionWindow(
            targets,
            session.duskJD,
            session.dawnJD,
            session.location,
            session.minAltitude,
            session.startTimeMode,
            session.customStartTime,
            session.useHorizon,
            session.useHorizon ? session.location.horizon : null
        );
        const baseSession = {
            ...session,
            sessionStartJD: sessionWindow.sessionStartJD,
            sessionEndJD: sessionWindow.sessionEndJD
        };
        const baseCalculated = SeqPlanCalculations.calculateExposureCounts(targets, baseSession);
        const baseSubs = baseCalculated.reduce((sum, t) => sum + t.exposureCount, 0);

        // Find targets that have meridian flips
        const flipTargetIndices = baseCalculated
              .map((t, i) => ({ t, i }))
              .filter(({ t }) => t.meridianFlipJD)
              .map(({ i }) => i);

        if (flipTargetIndices.length === 0) {
            return null;
        }

        const totalMinutes = (baseSession.sessionEndJD - baseSession.sessionStartJD) * 24 * 60;
        let bestAllocations = targets.map(t => t.allocatedPercent);
        let bestSubs = baseSubs;

        // For each target with a flip, try excluding vs including the flip
        for (const flipIdx of flipTargetIndices) {
            const flipTarget = baseCalculated[flipIdx];

            // Calculate minutes to end of target from flip pause start
            const pauseBeforeJD = flipTarget.meridianFlipJD -
                  (session.meridianFlipPause / 1440);
            const minutesToFlip = (pauseBeforeJD - flipTarget.imagingStartJD) * 1440;
            const minutesAfterFlip = (flipTarget.imagingEndJD - flipTarget.meridianFlipJD -
                                      (session.meridianFlipPause / 1440) -
                                      (session.meridianFlipDuration / 1440)) * 1440;

            // Option A: Exclude flip — end target just before flip pause
            const excludeMinutes = minutesToFlip;
            const excludePercent = excludeMinutes / totalMinutes * 100;
            const currentPercent = flipTarget.allocatedPercent;
            const percentDiff = currentPercent - excludePercent;

            if (flipIdx + 1 < targets.length && percentDiff > 0) {
                // Try exclude: shrink flip target, give time to next target
                const testAllocations = [...bestAllocations];
                testAllocations[flipIdx] = excludePercent;
                testAllocations[flipIdx + 1] += percentDiff;

                const testTargets = targets.map((t, i) => ({
                    ...t,
                    allocatedPercent: testAllocations[i]
                }));
                const testCalculated = SeqPlanCalculations.calculateExposureCounts(
                    testTargets, baseSession
                );

                const testSubs = testCalculated.reduce((sum, t) => sum + t.exposureCount, 0);
                if (testSubs > bestSubs) {
                    bestSubs = testSubs;
                    bestAllocations = testAllocations;
                }
            }

            // Option B: Include flip — already the current state, but try extending
            // to get more post-flip imaging time at the expense of next target
            const flipOverhead = (session.meridianFlipPause * 2) + session.meridianFlipDuration;
            const postFlipMinutes = minutesAfterFlip;

            if (flipIdx + 1 < targets.length && postFlipMinutes > 0) {
                // Try include with extension: give flip target enough time to image after flip
                const exposureSeconds = flipTarget.exposureTime + session.interExposureTime;
                const postFlipSubs = Math.floor((postFlipMinutes * 60) / exposureSeconds);
                const extendMinutes = flipOverhead + (postFlipSubs * exposureSeconds / 60);
                const extendPercent = extendMinutes / totalMinutes * 100;

                if (bestAllocations[flipIdx] + extendPercent <= 100 &&
                    bestAllocations[flipIdx + 1] - extendPercent > 0) {
                    const testAllocations = [...bestAllocations];
                    testAllocations[flipIdx] += extendPercent;
                    testAllocations[flipIdx + 1] -= extendPercent;

                    const testTargets = targets.map((t, i) => ({
                        ...t,
                        allocatedPercent: testAllocations[i]
                    }));
                    const testCalculated = SeqPlanCalculations.calculateExposureCounts(
                        testTargets, baseSession
                    );

                    const testSubs = testCalculated.reduce((sum, t) => sum + t.exposureCount, 0);
                    if (testSubs > bestSubs) {
                        bestSubs = testSubs;
                        bestAllocations = testAllocations;
                    }
                }
            }

            // Option C: Extend past next target's flip — absorb next target's flip
            // into current target's time, so next target starts clean post-flip
            if (flipIdx + 1 < targets.length) {
                const nextTarget = baseCalculated[flipIdx + 1];
                if (nextTarget.meridianFlipJD) {
                    // Boundary needs to move past next target's full flip sequence
                    const nextFlipEnd = nextTarget.meridianFlipJD +
                          (session.meridianFlipPause / 1440) +
                          (session.meridianFlipDuration / 1440);

                    // Current target extended to just after next target's flip completes
                    const extendToMinutes = (nextFlipEnd - flipTarget.imagingStartJD) * 1440;
                    const extendToPercent = extendToMinutes / totalMinutes * 100;
                    const currentFlipPercent = bestAllocations[flipIdx];
                    const absorbDiff = extendToPercent - currentFlipPercent;

                    if (absorbDiff > 0 &&
                        bestAllocations[flipIdx + 1] - absorbDiff > 0) {
                        const testAllocations = [...bestAllocations];
                        testAllocations[flipIdx] = extendToPercent;
                        testAllocations[flipIdx + 1] -= absorbDiff;

                        const testTargets = targets.map((t, i) => ({
                            ...t,
                            allocatedPercent: testAllocations[i]
                        }));
                        const testCalculated = SeqPlanCalculations.calculateExposureCounts(
                            testTargets, baseSession
                        );

                        const testSubs = testCalculated.reduce((sum, t) => sum + t.exposureCount, 0);
                        if (testSubs > bestSubs) {
                            bestSubs = testSubs;
                            bestAllocations = testAllocations;
                        }
                    }
                }
            }
        }

        if (bestSubs > baseSubs) {
            return targets.map((t, i) => ({ ...t, allocatedPercent: bestAllocations[i] }));
        }

        return null;
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
