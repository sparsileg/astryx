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

        // Find best permutation + flip boundary combination
        const best = this.tryReorder(targets, session, toleranceMinutes);

        if (!best) {
            return targets;
        }

        // Only accept if improvement exceeds configured threshold
        const threshold = APP_CONFIG.TRANSITION_OPTIMIZATION_THRESHOLD ?? 0;
        const minAcceptableSubs = Math.ceil(baselineSubs * (1 + threshold));
        if (best.totalSubs >= minAcceptableSubs) {
            return best.targets;
        }

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
            const flipCount = calculated.filter(t => t.meridianFlipJD).length;
            const conflicts = SeqPlanCalculations.findTransitionConflicts(
                calculated, finalSession, toleranceMinutes
            ).length;
            return { totalSubs, flipCount, conflicts, targets: finalPerm, permSession: finalSession };
        };

        // Score current order with flip boundary optimization applied
        const currentScore = scorePerm(targets);

        // Generate and score all permutations
        const permutations = this.getPermutations(targets);
        let bestScore = currentScore;
        let bestSubs = currentScore.totalSubs;
        let bestFlipCount = currentScore.flipCount;
        let bestConflicts = currentScore.conflicts;

        for (const perm of permutations) {
            const score = scorePerm(perm);

            if (score.totalSubs > bestSubs) {
                // Primary: more subs always wins
                bestSubs = score.totalSubs;
                bestFlipCount = score.flipCount;
                bestConflicts = score.conflicts;
                bestScore = score;
            } else if (score.totalSubs === bestSubs && score.flipCount < bestFlipCount) {
                // Tiebreaker 1: same subs, prefer fewer meridian flips
                bestFlipCount = score.flipCount;
                bestConflicts = score.conflicts;
                bestScore = score;
            } else if (score.totalSubs === bestSubs && score.flipCount === bestFlipCount && score.conflicts < bestConflicts) {
                // Tiebreaker 2: same subs and flips, prefer fewer conflicts
                bestConflicts = score.conflicts;
                bestScore = score;
            }
        }

        // Return best score if it differs from the unoptimized input targets
        // This ensures flip boundary optimized allocations are always applied
        if (bestScore.totalSubs > targets.reduce((sum, t) => sum + (t.exposureCount || 0), 0) ||
            bestScore.targets !== targets) {
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
        const baseVariance = this.calcSubVariance(baseCalculated.map(t => t.exposureCount));

        // Find targets that have meridian flips
        const flipTargetIndices = baseCalculated
              .map((t, i) => ({ t, i }))
              .filter(({ t }) => t.meridianFlipJD)
              .map(({ i }) => i);

        const totalMinutes = (baseSession.sessionEndJD - baseSession.sessionStartJD) * 24 * 60;
        let bestAllocations = targets.map(t => t.allocatedPercent);
        let bestSubs = baseSubs;
        let bestVariance = baseVariance;

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
                const testVariance = this.calcSubVariance(testCalculated.map(t => t.exposureCount));

                if (testSubs > bestSubs || (testSubs === bestSubs && testVariance < bestVariance)) {
                    bestSubs = testSubs;
                    bestVariance = testVariance;
                    bestAllocations = testAllocations;
                }
            }

            // Option B: Include flip — try extending to get more post-flip imaging time
            const flipOverhead = (session.meridianFlipPause * 2) + session.meridianFlipDuration;
            const postFlipMinutes = minutesAfterFlip;

            if (flipIdx + 1 < targets.length && postFlipMinutes > 0) {
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
                    const testVariance = this.calcSubVariance(testCalculated.map(t => t.exposureCount));

                    if (testSubs > bestSubs || (testSubs === bestSubs && testVariance < bestVariance)) {
                        bestSubs = testSubs;
                        bestVariance = testVariance;
                        bestAllocations = testAllocations;
                    }
                }
            }

            // Option C: Extend past next target's flip — absorb next target's flip
            if (flipIdx + 1 < targets.length) {
                const nextTarget = baseCalculated[flipIdx + 1];
                if (nextTarget.meridianFlipJD) {
                    const nextFlipEnd = nextTarget.meridianFlipJD +
                          (session.meridianFlipPause / 1440) +
                          (session.meridianFlipDuration / 1440);

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
                        const testVariance = this.calcSubVariance(testCalculated.map(t => t.exposureCount));

                        if (testSubs > bestSubs || (testSubs === bestSubs && testVariance < bestVariance)) {
                            bestSubs = testSubs;
                            bestVariance = testVariance;
                            bestAllocations = testAllocations;
                        }
                    }
                }
            }
        }

        // Rebalancing sweep: move all allocations simultaneously toward equal split
        // in 1% steps, allowing up to (targets - 2) sub loss for better balance — Issue #134
        const equalPercent = 100 / targets.length;
        let sweepAllocations = [...bestAllocations];
        let sweepVariance = bestVariance;
        let sweepSubs = bestSubs;
        const minAcceptableSubs = bestSubs - Math.max(0, targets.length - 2);
        const MAX_STEPS = 100;

        for (let step = 0; step < MAX_STEPS; step++) {
            // Check if all targets are already at equal split
            const allEqual = sweepAllocations.every(a => Math.abs(a - equalPercent) < 0.5);
            if (allEqual) break;

            // Move each allocation one step toward equal split
            const testAllocations = sweepAllocations.map(a => {
                if (Math.abs(a - equalPercent) < 0.5) return a;
                return a > equalPercent ? a - 1 : a + 1;
            });

            // Normalize to ensure allocations sum to 100
            const total = testAllocations.reduce((sum, a) => sum + a, 0);
            const normalized = testAllocations.map(a => a * (100 / total));

            const testTargets = targets.map((t, i) => ({
                ...t,
                allocatedPercent: normalized[i]
            }));
            const testCalculated = SeqPlanCalculations.calculateExposureCounts(
                testTargets, baseSession
            );
            const testSubs = testCalculated.reduce((sum, t) => sum + t.exposureCount, 0);
            const testVariance = this.calcSubVariance(testCalculated.map(t => t.exposureCount));

            if (testSubs < minAcceptableSubs) {
                // Subs dropped below acceptable threshold — stop sweep
                break;
            }

            if (testVariance < sweepVariance) {
                sweepVariance = testVariance;
                sweepSubs = testSubs;
                sweepAllocations = normalized;
            } else {
                // Keep moving toward equal even if no variance improvement yet
                sweepAllocations = normalized;
            }
        }

        // Apply sweep result if it improved variance
        if (sweepVariance < bestVariance) {
            bestAllocations = sweepAllocations;
            bestVariance = sweepVariance;
        }

        // Return if subs improved or variance improved over baseline
        if (bestSubs > baseSubs || bestVariance < baseVariance) {
            return targets.map((t, i) => ({ ...t, allocatedPercent: bestAllocations[i] }));
        }

        return null;
    },

    /**
     * Calculate variance of sub counts across targets
     * Lower variance = more balanced distribution
     * @param {Array} subCounts - Array of sub counts per target
     * @returns {number} Variance
     */
    calcSubVariance(subCounts) {
        if (subCounts.length <= 1) return 0;
        const mean = subCounts.reduce((sum, s) => sum + s, 0) / subCounts.length;
        return subCounts.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / subCounts.length;
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
