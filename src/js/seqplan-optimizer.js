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
     * Find the best plan for the night. Tries every target order, and for
     * each one the meridian flip boundaries and then the handover positions,
     * keeping the plan that ranks highest under comparePlans(). On a tie the
     * earlier order wins, so the set-time order is kept unless beaten.
     * Above SEQ_PLAN_MAX_REORDER_TARGETS only the given order is tried
     * @param {Array} targets - Ordered targets (output of optimizeTargetOrder)
     * @param {Object} session - Session configuration with duskJD/dawnJD
     * @returns {Array} Targets in the best order with the best allocations
     */
    optimizePlan(targets, session) {
        if (targets.length < 2) return targets;

        const visibility = SeqPlanCalculations.buildVisibility(targets, session);
        const orders = targets.length > APP_CONFIG.SEQ_PLAN_MAX_REORDER_TARGETS
            ? [targets]
            : this.getPermutations(targets);
        let best = null;

        for (const perm of orders) {
            // The session window depends only on the first and last target
            const permSession = this.withSessionWindow(perm, session);
            const flipped = this.optimizeFlipBoundaries(perm, permSession, visibility) ?? perm;
            const handedOver = this.optimizeHandovers(flipped, permSession, visibility) ?? flipped;
            const score = this.scoreAllocations(
                handedOver, handedOver.map(t => t.allocatedPercent), permSession, visibility);

            if (!best || this.comparePlans(score, best.score) > 0) {
                best = { targets: handedOver, score };
            }
        }

        return best.targets;
    },

    /**
     * Session configuration with the session window for this target order
     * @param {Array} targets - Ordered targets
     * @param {Object} session - Session configuration with duskJD/dawnJD
     * @returns {Object} Session with sessionStartJD/sessionEndJD set
     */
    withSessionWindow(targets, session) {
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
        return {
            ...session,
            sessionStartJD: sessionWindow.sessionStartJD,
            sessionEndJD: sessionWindow.sessionEndJD
        };
    },

    /**
     * Optimize target boundary positions around meridian flips
     * For each target with a meridian flip, tries ending the target just
     * before the flip pause, extending it to get more post-flip imaging, and
     * extending it past the next target's flip, keeping whichever ranks
     * highest under comparePlans()
     * @param {Array} targets - Ordered targets with allocations
     * @param {Object} session - Session configuration with session window
     * @param {Object} visibility - Output of SeqPlanCalculations.buildVisibility()
     * @returns {Array|null} Targets with adjusted allocations, or null if no improvement
     */
    optimizeFlipBoundaries(targets, session, visibility) {
        const baseCalculated = SeqPlanCalculations.calculateExposureCounts(targets, session);

        // Find targets that have meridian flips
        const flipTargetIndices = baseCalculated
              .map((t, i) => ({ t, i }))
              .filter(({ t }) => t.meridianFlipJD)
              .map(({ i }) => i);

        const totalMinutes = (session.sessionEndJD - session.sessionStartJD) * 24 * 60;
        let bestAllocations = targets.map(t => t.allocatedPercent);
        const baseScore = this.scoreAllocations(targets, bestAllocations, session, visibility);
        let bestScore = baseScore;

        const tryAllocations = testAllocations => {
            const testScore = this.scoreAllocations(targets, testAllocations, session, visibility);
            if (this.comparePlans(testScore, bestScore) > 0) {
                bestScore = testScore;
                bestAllocations = testAllocations;
            }
        };

        // For each target with a flip, try excluding vs including the flip
        for (const flipIdx of flipTargetIndices) {
            if (flipIdx + 1 >= targets.length) continue;
            const flipTarget = baseCalculated[flipIdx];

            // Calculate minutes to end of target from flip pause start
            const pauseBeforeJD = flipTarget.meridianFlipJD -
                  (session.meridianFlipPause / 1440);
            const minutesToFlip = (pauseBeforeJD - flipTarget.imagingStartJD) * 1440;
            const minutesAfterFlip = (flipTarget.imagingEndJD - flipTarget.meridianFlipJD -
                                      (session.meridianFlipPause / 1440) -
                                      (session.meridianFlipDuration / 1440)) * 1440;

            // Option A: Exclude flip — end target just before flip pause
            const excludePercent = minutesToFlip / totalMinutes * 100;
            // Measured from the current best allocation, not the starting one:
            // an earlier flip target may already have moved this one, and the
            // allocations must keep summing to 100
            const percentDiff = bestAllocations[flipIdx] - excludePercent;

            if (excludePercent > 0 && percentDiff > 0) {
                const testAllocations = [...bestAllocations];
                testAllocations[flipIdx] = excludePercent;
                testAllocations[flipIdx + 1] += percentDiff;
                tryAllocations(testAllocations);
            }

            // Option B: Include flip — try extending to get more post-flip imaging time
            const flipOverhead = (session.meridianFlipPause * 2) + session.meridianFlipDuration;

            if (minutesAfterFlip > 0) {
                const exposureSeconds = flipTarget.exposureTime + session.interExposureTime;
                const postFlipSubs = Math.floor((minutesAfterFlip * 60) / exposureSeconds);
                const extendMinutes = flipOverhead + (postFlipSubs * exposureSeconds / 60);
                const extendPercent = extendMinutes / totalMinutes * 100;

                if (bestAllocations[flipIdx] + extendPercent <= 100 &&
                    bestAllocations[flipIdx + 1] - extendPercent > 0) {
                    const testAllocations = [...bestAllocations];
                    testAllocations[flipIdx] += extendPercent;
                    testAllocations[flipIdx + 1] -= extendPercent;
                    tryAllocations(testAllocations);
                }
            }

            // Option C: Extend past next target's flip — absorb next target's flip
            const nextTarget = baseCalculated[flipIdx + 1];
            if (nextTarget.meridianFlipJD) {
                const nextFlipEnd = nextTarget.meridianFlipJD +
                      (session.meridianFlipPause / 1440) +
                      (session.meridianFlipDuration / 1440);

                const extendToMinutes = (nextFlipEnd - flipTarget.imagingStartJD) * 1440;
                const extendToPercent = extendToMinutes / totalMinutes * 100;
                const absorbDiff = extendToPercent - bestAllocations[flipIdx];

                if (absorbDiff > 0 && bestAllocations[flipIdx + 1] - absorbDiff > 0) {
                    const testAllocations = [...bestAllocations];
                    testAllocations[flipIdx] = extendToPercent;
                    testAllocations[flipIdx + 1] -= absorbDiff;
                    tryAllocations(testAllocations);
                }
            }
        }

        if (this.comparePlans(bestScore, baseScore) > 0) {
            return targets.map((t, i) => ({ ...t, allocatedPercent: bestAllocations[i] }));
        }
        return null;
    },

    /**
     * Move each handover between consecutive targets, in steps of
     * SEQ_PLAN_HANDOVER_STEP_PERCENT, to the position that ranks highest
     * under comparePlans(), so a target keeps imaging until the next one has
     * risen above the minimum altitude and horizon, or hands over early when
     * it sets. Repeats until no handover moves, since moving one can change
     * the best spot for another.
     * @param {Array} targets - Ordered targets with allocations
     * @param {Object} session - Session configuration with session window
     * @param {Object} visibility - Output of SeqPlanCalculations.buildVisibility()
     * @returns {Array|null} Targets with adjusted allocations, or null if no improvement
     */
    optimizeHandovers(targets, session, visibility) {
        const step = APP_CONFIG.SEQ_PLAN_HANDOVER_STEP_PERCENT;
        let bestAllocations = targets.map(t => t.allocatedPercent);
        const baseScore = this.scoreAllocations(targets, bestAllocations, session, visibility);
        let bestScore = baseScore;
        let improved = true;

        while (improved) {
            improved = false;
            for (let i = 0; i < targets.length - 1; i++) {
                // Keep the pair's combined share; each target keeps at least one step
                const pairPercent = bestAllocations[i] + bestAllocations[i + 1];
                for (let percent = step; percent <= pairPercent - step; percent += step) {
                    const testAllocations = [...bestAllocations];
                    testAllocations[i] = percent;
                    testAllocations[i + 1] = pairPercent - percent;
                    const testScore = this.scoreAllocations(targets, testAllocations, session, visibility);

                    if (this.comparePlans(testScore, bestScore) > 0) {
                        bestScore = testScore;
                        bestAllocations = testAllocations;
                        improved = true;
                    }
                }
            }
        }

        if (this.comparePlans(bestScore, baseScore) > 0) {
            return targets.map((t, i) => ({ ...t, allocatedPercent: bestAllocations[i] }));
        }
        return null;
    },

    /**
     * Score a set of allocations by each target's usable integration time:
     * time spent on subs while the target is above the minimum altitude and
     * horizon. Counted in whole seconds so equal plans compare exactly equal
     * @param {Array} targets - Ordered targets
     * @param {Array} allocations - Allocated percent per target
     * @param {Object} session - Session configuration with session window
     * @param {Object} visibility - Output of SeqPlanCalculations.buildVisibility()
     * @returns {Object} { floorMet, weakest, total, variance } for comparePlans()
     */
    scoreAllocations(targets, allocations, session, visibility) {
        const calculated = SeqPlanCalculations.calculateExposureCounts(
            targets.map((t, i) => ({ ...t, allocatedPercent: allocations[i] })), session);
        const floorSeconds = APP_CONFIG.SEQ_PLAN_MIN_INTEGRATION_MINUTES * 60;
        const seconds = this.usableSubCounts(calculated, visibility)
            .map((subs, i) => subs * calculated[i].exposureTime);

        return {
            floorMet: seconds.filter(s => s >= floorSeconds).length,
            weakest: Math.min(...seconds.map(s => Math.min(s, floorSeconds))),
            total: seconds.reduce((sum, s) => sum + s, 0),
            variance: this.calcVariance(seconds)
        };
    },

    /**
     * Rank two plan scores. In order: more targets reaching the minimum
     * integration time; then the weakest target closest to it; then the most
     * total integration time; then the most even spread across targets
     * @param {Object} a - Output of scoreAllocations()
     * @param {Object} b - Output of scoreAllocations()
     * @returns {number} Positive if a is better, negative if b is, 0 if equal
     */
    comparePlans(a, b) {
        return (a.floorMet - b.floorMet) ||
               (a.weakest - b.weakest) ||
               (a.total - b.total) ||
               (b.variance - a.variance);
    },

    /**
     * Usable sub counts: each target's subs reduced to the share of its
     * window in which it is visible
     * @param {Array} calculated - Output of calculateExposureCounts()
     * @param {Object} visibility - Output of SeqPlanCalculations.buildVisibility()
     * @returns {Array} Usable sub count per target
     */
    usableSubCounts(calculated, visibility) {
        return calculated.map(t => {
            const { visible, total } = this.windowVisibility(t, visibility);
            return total > 0 ? Math.floor(t.exposureCount * visible / total) : 0;
        });
    },

    /**
     * Visible and total visibility samples within a target's imaging window
     */
    windowVisibility(target, visibility) {
        const toIndex = jd => Math.min(visibility.steps + 1,
            Math.max(0, Math.round((jd - visibility.startJD) / visibility.step)));
        const prefix = visibility.visibleBefore.get(target.targetId);
        const startIndex = toIndex(target.imagingStartJD);
        const endIndex = toIndex(target.imagingEndJD);
        if (endIndex <= startIndex) return { visible: 0, total: 0 };
        return { visible: prefix[endIndex] - prefix[startIndex], total: endIndex - startIndex };
    },

    /**
     * Calculate variance of values across targets
     * Lower variance = more balanced distribution
     * @param {Array} values - One value per target
     * @returns {number} Variance
     */
    calcVariance(values) {
        if (values.length <= 1) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
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
