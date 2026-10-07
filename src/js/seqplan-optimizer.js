/**
 * seqplan-optimizer.js
 * Target ordering optimization for Sequence Planner
 */

const SeqPlanOptimizer = {

    /**
     * Starting target order: targets that set during the session go first,
     * earliest set first; targets still up at the end follow, earliest rise
     * first (one already up at the start counts as rising then). Ties go to
     * the earlier transit, imaging each target nearer its highest, and then
     * to the name, so the order targets were pinned in never affects the plan
     * @param {Array} targets - Array of target plans
     * @param {Object} session - Session configuration
     * @returns {Array} Targets sorted in suggested order
     */
    optimizeTargetOrder(targets, session) {
        const { latitude, longitude } = session.location;
        const horizonArray = session.useHorizon ? session.location.horizon : null;
        const midJD = (session.sessionStartJD + session.sessionEndJD) / 2;

        const scoredTargets = targets.map(target => {
            // Find transit time during session
            const transitJD = findTargetTransit(
                session.sessionStartJD,
                session.sessionEndJD,
                target.ra,
                target.dec,
                longitude
            );

            // The transit nearest the middle of the session, even outside it
            const nearestTransitJD = findTargetTransit(midJD - 0.5, midJD + 0.5, target.ra, target.dec, longitude);

            // A target dipping behind an obstruction and back still counts as
            // up at the end, so only a target down at the end has set
            const endAltitude = getAltitude(session.sessionEndJD, target.ra, target.dec, latitude, longitude);
            const endAzimuth = getAzimuth(session.sessionEndJD, target.ra, target.dec, latitude, longitude);
            const upAtEnd = isAboveHorizon(endAltitude, endAzimuth, session.minAltitude, horizonArray);

            // Find when target sets below minimum altitude
            const setJD = upAtEnd ? null : findTargetSet(
                session.sessionStartJD,
                session.sessionEndJD,
                target.ra,
                target.dec,
                latitude,
                longitude,
                session.minAltitude,
                horizonArray
            );

            // Find when target rises above minimum altitude
            const riseJD = findTargetRise(
                session.sessionStartJD,
                session.sessionEndJD,
                target.ra,
                target.dec,
                latitude,
                longitude,
                session.minAltitude,
                horizonArray
            );

            return {
                ...target,
                transitJD: transitJD,
                riseJD: riseJD,
                setJD: setJD,
                nearestTransitJD: nearestTransitJD,
                suggestedOrder: 0,
                userOrder: 0,
                orderOverridden: false
            };
        });

        scoredTargets.sort((a, b) =>
            (a.setJD ?? Infinity) - (b.setJD ?? Infinity) ||
            (a.riseJD ?? session.sessionStartJD) - (b.riseJD ?? session.sessionStartJD) ||
            a.nearestTransitJD - b.nearestTransitJD ||
            a.name.localeCompare(b.name));

        // Assign suggested order
        scoredTargets.forEach((target, index) => {
            target.suggestedOrder = index + 1;
            target.userOrder = index + 1; // Initialize to suggested
        });

        return scoredTargets;
    },

    /**
     * Find the best plan for the night. Tries every target order, and for
     * each one the meridian flip boundaries and then the handover positions,
     * keeping the plan that ranks highest under comparePlans(). On a tie the
     * earlier order wins, so the set-time order is kept unless beaten. For
     * up to SEQ_PLAN_MAX_REORDER_TARGETS targets; scheduleTargets() plans more
     * @param {Array} targets - Ordered targets (output of optimizeTargetOrder)
     * @param {Object} session - Session configuration with duskJD/dawnJD
     * @returns {Array} Targets in the best order with the best allocations
     */
    optimizePlan(targets, session) {
        if (targets.length < 2) return targets;

        const visibility = SeqPlanCalculations.buildVisibility(targets, session);
        let best = null;

        for (const perm of this.getPermutations(targets)) {
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
     * Plan more than SEQ_PLAN_MAX_REORDER_TARGETS targets, as for a Messier
     * marathon. Targets not visible for an equal share of the night, or for
     * SEQ_PLAN_MIN_INTEGRATION_MINUTES if that's less, are skipped. The rest
     * are imaged earliest deadline first: whenever one finishes, the next is
     * the visible target that sets soonest. A binary
     * search finds the most imaging time every target can get that way, and
     * the handover search then hands out the time left over
     * @param {Array} targets - Ordered targets (output of optimizeTargetOrder)
     * @param {Object} session - Session configuration with duskJD/dawnJD
     * @returns {Object} { ordered, planned, skipped }: the imaged targets in
     *     order with an equal split, then with their allocations, and the
     *     skipped targets
     */
    scheduleTargets(targets, session) {
        const visibility = SeqPlanCalculations.buildVisibility(targets, session);
        const toIndex = jd => Math.min(visibility.steps + 1,
            Math.max(0, Math.round((jd - visibility.startJD) / visibility.step)));
        const startIndex = toIndex(this.withSessionWindow([], session).sessionStartJD);
        const endIndex = visibility.steps + 1;

        const windows = new Map(targets.map(target => {
            const prefix = visibility.visibleBefore.get(target.targetId);
            const visibleAt = i => prefix[i + 1] > prefix[i];
            let release = startIndex;
            while (release < endIndex && !visibleAt(release)) release++;
            let deadline = endIndex;
            while (deadline > release && !visibleAt(deadline - 1)) deadline--;
            const flipIndex = toIndex(target.nearestTransitJD + session.meridianFlipOffset / 1440);
            return [target.targetId, { prefix, release, deadline, flipIndex }];
        }));
        const visibleMinutes = target => {
            const { prefix } = windows.get(target.targetId);
            return prefix[endIndex] - prefix[startIndex];
        };

        // Skip targets not visible for an equal share (capped at the floor);
        // skipping some raises the share, so repeat until none drop out
        let imaged = targets.filter(target => visibleMinutes(target) > 0);
        for (;;) {
            const share = Math.min(APP_CONFIG.SEQ_PLAN_MIN_INTEGRATION_MINUTES,
                (endIndex - startIndex) / imaged.length);
            const keep = imaged.filter(target => visibleMinutes(target) >= share);
            if (keep.length === 0 || keep.length === imaged.length) break;
            imaged = keep;
        }

        // Find the largest imaging time every target gets; a target that
        // can't be caught even briefly is skipped too
        let slots = this.scheduleSlots(imaged, windows, startIndex, session, 1);
        while (slots.missed) {
            imaged = imaged.filter(target => target !== slots.missed);
            slots = this.scheduleSlots(imaged, windows, startIndex, session, 1);
        }
        let low = 1;
        let high = endIndex - startIndex;
        while (low < high) {
            const minutes = Math.ceil((low + high) / 2);
            const attempt = this.scheduleSlots(imaged, windows, startIndex, session, minutes);
            if (attempt.missed) {
                high = minutes - 1;
            } else {
                low = minutes;
                slots = attempt;
            }
        }

        // Each target images until the next one starts, the last until the
        // session ends, so gaps go to the target before them
        const order = slots.slots.map(slot => slot.target);
        const planSession = this.withSessionWindow(order, session);
        const toJD = index => visibility.startJD + index * visibility.step;
        const boundaries = [planSession.sessionStartJD,
            ...slots.slots.slice(1).map(slot => toJD(slot.start)), planSession.sessionEndJD]
            .map(jd => Math.min(planSession.sessionEndJD, Math.max(planSession.sessionStartJD, jd)));
        const totalJD = planSession.sessionEndJD - planSession.sessionStartJD;
        const scheduled = order.map((target, i) => ({
            ...target,
            allocatedPercent: Math.max(0, boundaries[i + 1] - boundaries[i]) / totalJD * 100
        }));

        // Hand out the time left over without taking any target below the
        // floor: the usual one, or what the weakest target got if less
        const seconds = this.usableSeconds(scheduled, planSession, visibility);
        const floorSeconds = Math.min(APP_CONFIG.SEQ_PLAN_MIN_INTEGRATION_MINUTES * 60, ...seconds);
        const planned = this.optimizeHandovers(scheduled, planSession, visibility, floorSeconds) ?? scheduled;

        const equalPercent = 100 / order.length;
        return {
            ordered: order.map(target => ({ ...target, allocatedPercent: equalPercent })),
            planned,
            skipped: targets.filter(target => !order.includes(target))
        };
    },

    /**
     * Lay out one slot per target, earliest deadline first, each long enough
     * for its overhead and the given visible imaging minutes. A slot that
     * would hold the target's meridian flip starts after the flip instead,
     * the target before it imaging on meanwhile. The flip is paid for only
     * when waiting would run past the target's deadline, or for the first
     * target if paying ends sooner, since nothing images while it waits
     * @param {Array} targets - Targets to image, in tie-break order
     * @param {Map} windows - Per target: visibility prefix sums, first
     *     visible index (release), end of last visible index (deadline), and
     *     flip index, all in minutes from dusk
     * @param {number} startIndex - Session start, in minutes from dusk
     * @param {Object} session - Session configuration
     * @param {number} minutes - Visible imaging minutes each target needs
     * @returns {Object} { slots: [{ target, start, end }] }, or { missed }
     *     with the first target that couldn't be fitted in
     */
    scheduleSlots(targets, windows, startIndex, session, minutes) {
        const autofocus = session.autofocusEnabled ? session.autofocusDuration : 0;
        const overhead = session.calibrationDuration + autofocus;
        const flipOverhead = session.meridianFlipPause + session.meridianFlipDuration +
            session.calibrationDuration + autofocus;

        // End of a slot starting at start: past the overhead, then on until
        // the target has been visible for the needed minutes
        const slotEnd = (window, start) => {
            let end = start + overhead;
            const from = window.prefix[Math.min(end, window.deadline)];
            while (end < window.deadline && window.prefix[end] - from < minutes) end++;
            return window.prefix[end] - from >= minutes ? end : null;
        };

        const slots = [];
        const todo = [...targets];
        let time = startIndex;
        while (todo.length > 0) {
            const released = todo.filter(target => windows.get(target.targetId).release <= time);
            if (released.length === 0) {
                time = Math.min(...todo.map(target => windows.get(target.targetId).release));
                continue;
            }
            // Earliest deadline first; on a tie, the earlier target in the given order
            const target = released.reduce((best, t) =>
                windows.get(t.targetId).deadline < windows.get(best.targetId).deadline ? t : best);
            const window = windows.get(target.targetId);

            let start = time;
            let end = slotEnd(window, start);
            if (end !== null && window.flipIndex > start && window.flipIndex < end) {
                // Wait until the flip is over, or pay for it
                const withFlip = end + flipOverhead <= window.deadline ? end + flipOverhead : null;
                const afterStart = window.flipIndex + session.meridianFlipDuration;
                const afterEnd = slotEnd(window, afterStart);
                const first = slots.length === 0;
                if (afterEnd !== null && (!first || withFlip === null || afterEnd <= withFlip)) {
                    start = afterStart;
                    end = afterEnd;
                } else {
                    end = withFlip;
                }
            }
            if (end === null) {
                return { missed: target };
            }

            slots.push({ target, start, end });
            todo.splice(todo.indexOf(target), 1);
            time = end;
        }
        return { slots };
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
     * @param {number} floorSeconds - Usable integration each target should get
     * @returns {Array|null} Targets with adjusted allocations, or null if no improvement
     */
    optimizeHandovers(targets, session, visibility, floorSeconds = APP_CONFIG.SEQ_PLAN_MIN_INTEGRATION_MINUTES * 60) {
        const step = APP_CONFIG.SEQ_PLAN_HANDOVER_STEP_PERCENT;
        let bestAllocations = targets.map(t => t.allocatedPercent);
        const baseScore = this.scoreAllocations(targets, bestAllocations, session, visibility, floorSeconds);
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
                    const testScore = this.scoreAllocations(targets, testAllocations, session, visibility, floorSeconds);

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
     * @param {number} floorSeconds - Usable integration each target should get
     * @returns {Object} { floorMet, weakest, total, variance } for comparePlans()
     */
    scoreAllocations(targets, allocations, session, visibility, floorSeconds = APP_CONFIG.SEQ_PLAN_MIN_INTEGRATION_MINUTES * 60) {
        const seconds = this.usableSeconds(
            targets.map((t, i) => ({ ...t, allocatedPercent: allocations[i] })), session, visibility);

        return {
            floorMet: seconds.filter(s => s >= floorSeconds).length,
            weakest: Math.min(...seconds.map(s => Math.min(s, floorSeconds))),
            total: seconds.reduce((sum, s) => sum + s, 0),
            variance: this.calcVariance(seconds)
        };
    },

    /**
     * Usable integration time per target, in whole seconds
     * @param {Array} targets - Ordered targets with allocations
     * @param {Object} session - Session configuration with session window
     * @param {Object} visibility - Output of SeqPlanCalculations.buildVisibility()
     * @returns {Array} Seconds per target
     */
    usableSeconds(targets, session, visibility) {
        const calculated = SeqPlanCalculations.calculateExposureCounts(targets, session);
        return this.usableSubCounts(calculated, visibility)
            .map((subs, i) => subs * calculated[i].exposureTime);
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
    }
};
