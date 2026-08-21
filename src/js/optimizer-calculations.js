/**
 * optimizer-calculations.js
 * Core algorithms for Target Optimizer
 *
 * Two-stage pipeline:
 *   1. scoreCandidates() scores each target independently for the night —
 *      window duration, peak altitude, transit centering, and moon
 *      separation combine into one composite score (0-100).
 *   2. generateCombinations() ranks single/pair/triplet groupings so
 *      Stan can pick a full night's targets at once. Since Astryx images
 *      one target at a time (Sequence Planner schedules back-to-back, no
 *      simultaneous imaging), a combo's real planning value depends on
 *      how much of each member's window is exclusive to it versus shared
 *      with the others — two targets with fully overlapping windows can't
 *      both get their full window's worth of imaging time in one night.
 *      _computeUsableHours() (Issue #216) allocates each combo member a
 *      "usable hours" figure — its exclusive time in full, plus an equal
 *      share of any time slice it shares with other members — and combo
 *      scores are weighted by that instead of raw windowHours. Solo scores
 *      are unaffected, since there's nothing to split against.
 */

// Scoring weights - adjust here to tune optimizer behavior
const OPTIMIZER_WEIGHTS = {
    windowDuration:   0.30,
    peakAltitude:     0.25,
    transitCentering: 0.15,
    moonSeparation:   0.30
};

const OptimizerCalculations = {

    /**
     * Score candidate targets for a given night
     * @param {Array} candidates - Normalized candidate array from assembleCandidatePool
     * @param {Object} session - { date, location, minAltitude, sessionStartJD, sessionEndJD }
     * @returns {Array} Top N scored candidates sorted by composite score descending
     */
    scoreCandidates(candidates, session) {
        const { location, minAltitude, sessionStartJD, sessionEndJD } = session;
        const sessionMidJD = (sessionStartJD + sessionEndJD) / 2;
        const sessionDurationJD = sessionEndJD - sessionStartJD;

        // Get moon illumination at session midpoint (phase doesn't change significantly across one night)
        const moonIllum = getMoonPhase(sessionMidJD).illumination / 100;

        const scored = [];
        const eliminated = [];

        for (const candidate of candidates) {
            // Find rise/set times above minimum altitude within session window
            const riseJD = findTargetRise(
                sessionStartJD, sessionEndJD,
                candidate.ra, candidate.dec,
                location.latitude, location.longitude,
                minAltitude, null
            );
            const setJD = findTargetSet(
                sessionStartJD, sessionEndJD,
                candidate.ra, candidate.dec,
                location.latitude, location.longitude,
                minAltitude, null
            );

            // Hard elimination: check if target is visible at all during session
            const isVisible = isTargetVisibleDuringWindow(
                sessionStartJD, sessionEndJD,
                candidate.ra, candidate.dec,
                location.latitude, location.longitude,
                minAltitude
            );

            if (!isVisible) {
                eliminated.push({ ...candidate, eliminationReason: 'Never rises above minimum altitude' });
                continue;
            }

            // Determine effective window start/end
            // null riseJD = already above minimum at session start
            // null setJD = stays above minimum through session end
            const windowStartJD = riseJD !== null ? riseJD : sessionStartJD;
            const windowEndJD   = setJD  !== null ? setJD  : sessionEndJD;
            const windowHours   = (windowEndJD - windowStartJD) * 24;

            // Hard elimination: less than 60 minutes of qualifying window
            if (windowHours < 1.0) {
                eliminated.push({ ...candidate, eliminationReason: 'Window too short' });
                continue;
            }

            // Transit time (used for centering score only)
            const transitJD = findTargetTransit(
                sessionStartJD, sessionEndJD,
                candidate.ra, candidate.dec,
                location.longitude
            );

            // Below-min-alt dip between two visible segments (Issue #251) —
            // riseJD/setJD above only represent a single window and silently
            // drop the earlier segment in this case. Flag-only: display note,
            // do not fold into windowHours or scoring (see #251 discussion).
            const visibilityDip = findVisibilityDip(
                sessionStartJD, sessionEndJD,
                candidate.ra, candidate.dec,
                location.latitude, location.longitude,
                minAltitude, null
            );

            // Find true peak altitude by scanning the visible window
            let peakAltitude = -90;
            let peakJD = transitJD || sessionMidJD;
            const scanStep = 1 / 144; // 10-minute steps
            for (let scanJD = windowStartJD; scanJD <= windowEndJD; scanJD += scanStep) {
                const alt = getAltitude(scanJD, candidate.ra, candidate.dec,
                    location.latitude, location.longitude);
                if (alt > peakAltitude) {
                    peakAltitude = alt;
                    peakJD = scanJD;
                }
            }

            // Time-weighted moon score across target's visible window
            // Moon-down periods contribute 1.0, moon-up periods contribute illumination × separation factor
            const sampleInterval = 15 / 1440; // 15 minutes in JD
            let moonScoreSamples = 0;
            let moonScoreSum = 0;
            // Calculate actual moon separation at window midpoint for display purposes
            const windowMidJD = (windowStartJD + windowEndJD) / 2;
            const moonPosAtMid = getMoonPosition(windowMidJD);
            let moonSeparation = getAngularSeparation(
                candidate.ra, candidate.dec,
                moonPosAtMid.ra, moonPosAtMid.dec
            );

            let sampleJD = windowStartJD;
            while (sampleJD <= windowEndJD) {
                const moonPos = getMoonPosition(sampleJD);
                const moonAlt = getAltitude(sampleJD, moonPos.ra, moonPos.dec,
                    location.latitude, location.longitude);

                const sep = getAngularSeparation(
                    candidate.ra, candidate.dec,
                    moonPos.ra, moonPos.dec
                );

                if (moonAlt <= 0) {
                    // Moon below horizon - full score for this sample
                    moonScoreSum += 1.0;
                } else {
                    // Moon above horizon - apply illumination and separation penalty
                    const sepFactor = Math.min(1, sep / 90);
                    moonScoreSum += (1 - moonIllum) * sepFactor;
                    // Track minimum separation for display purposes
                    if (sep < moonSeparation) moonSeparation = sep;
                }

                moonScoreSamples++;
                sampleJD += sampleInterval;
            }

            const moonScore = (moonScoreSamples > 0 ? moonScoreSum / moonScoreSamples : 1.0) * 100;

            // --- Score each component 0-100 ---

            // Window duration: 1h = 0, 8h+ = 100
            const windowScore = Math.min(100, ((windowHours - 1) / 7) * 100);

            // Peak altitude: minAltitude = 0, 90° = 100
            const altitudeScore = Math.max(0, Math.min(100,
                ((peakAltitude - minAltitude) / (90 - minAltitude)) * 100
            ));

            // Transit centering: transit at session midpoint = 100, at edge = 0
            let centeringScore = 0;
            if (transitJD) {
                const distFromMid = Math.abs(transitJD - sessionMidJD);
                const maxDist = sessionDurationJD / 2;
                centeringScore = Math.max(0, (1 - distFromMid / maxDist) * 100);
            }

            // Composite weighted score
            const compositeScore = (
                windowScore      * OPTIMIZER_WEIGHTS.windowDuration   +
                    altitudeScore    * OPTIMIZER_WEIGHTS.peakAltitude      +
                    centeringScore   * OPTIMIZER_WEIGHTS.transitCentering  +
                    moonScore        * OPTIMIZER_WEIGHTS.moonSeparation
            );

            scored.push({
                ...candidate,
                windowStartJD,
                windowEndJD,
                windowHours,
                peakAltitude,
                peakJD,
                transitJD,
                visibilityDip,
                moonSeparation,
                scores: {
                    window:    Math.round(windowScore),
                    altitude:  Math.round(altitudeScore),
                    centering: Math.round(centeringScore),
                    moon:      Math.round(moonScore),
                    composite: Math.round(compositeScore)
                }
            });
        }

        // Sort by composite score descending
        scored.sort((a, b) => b.scores.composite - a.scores.composite);

        // Tally elimination reasons
        const eliminationCounts = {};
        for (const e of eliminated) {
            eliminationCounts[e.eliminationReason] = (eliminationCounts[e.eliminationReason] || 0) + 1;
        }

        // Return top N candidates for combination generation
        const topN = APP_CONFIG.TOP_RANKED_TARGETS;
        const topScored = scored.slice(0, topN);
        const belowCutoff = scored.length - topScored.length;
        if (belowCutoff > 0) {
            eliminationCounts['below top ' + topN] = belowCutoff;
        }
        topScored._eliminationCounts = eliminationCounts;
        topScored._totalEvaluated = candidates.length;
        return topScored;
    },

    /**
     * Allocate "usable hours" across a combo's members (Issue #216).
     * Sweeps the sorted window breakpoints of all members and, for each
     * resulting sub-interval, splits that interval's duration equally
     * among whichever members' windows cover it. A member's total usable
     * hours is its exclusive time in full plus an equal share of any
     * time shared with others — this generalizes the pairwise 50/50
     * overlap split to triplets, where two-of-three and three-of-three
     * overlap segments are handled correctly rather than assumed equal.
     * @param {Array} targets - combo members (each with windowStartJD/windowEndJD)
     * @returns {Array} usable hours, same order/length as targets
     */
    _computeUsableHours(targets) {
        const points = new Set();
        targets.forEach(t => {
            points.add(t.windowStartJD);
            points.add(t.windowEndJD);
        });
        const sorted = Array.from(points).sort((x, y) => x - y);

        const usable = targets.map(() => 0);

        for (let i = 0; i < sorted.length - 1; i++) {
            const segStart = sorted[i];
            const segEnd = sorted[i + 1];
            const segHours = (segEnd - segStart) * 24;
            if (segHours <= 0) continue;

            const activeIndices = [];
            targets.forEach((t, idx) => {
                if (t.windowStartJD <= segStart && t.windowEndJD >= segEnd) {
                    activeIndices.push(idx);
                }
            });
            if (activeIndices.length === 0) continue;

            const share = segHours / activeIndices.length;
            activeIndices.forEach(idx => { usable[idx] += share; });
        }

        return usable;
    },

    /**
     * Generate best target combinations for a night
     * @param {Array} scoredCandidates - Already scored candidates from scoreCandidates()
     * @returns {Array} Top 10 combinations sorted by quality-weighted score descending
     */
    generateCombinations(scoredCandidates) {
        if (!scoredCandidates || scoredCandidates.length === 0) return [];

        const combos = [];

        // Size 1: each target as a solo combination — full windowHours,
        // nothing to split against.
        for (let i = 0; i < scoredCandidates.length; i++) {
            const a = scoredCandidates[i];
            combos.push({
                targets: [a],
                comboScore: a.scores.composite * a.windowHours
            });
        }

        // Size 2: all pairs
        for (let i = 0; i < scoredCandidates.length; i++) {
            for (let j = i + 1; j < scoredCandidates.length; j++) {
                const a = scoredCandidates[i];
                const b = scoredCandidates[j];
                const [usableA, usableB] = this._computeUsableHours([a, b]);
                combos.push({
                    targets: [a, b],
                    comboScore: ((a.scores.composite * usableA) +
                                 (b.scores.composite * usableB)) / 2
                });
            }
        }

        // Size 3: all triplets
        for (let i = 0; i < scoredCandidates.length; i++) {
            for (let j = i + 1; j < scoredCandidates.length; j++) {
                for (let k = j + 1; k < scoredCandidates.length; k++) {
                    const a = scoredCandidates[i];
                    const b = scoredCandidates[j];
                    const c = scoredCandidates[k];
                    const [usableA, usableB, usableC] = this._computeUsableHours([a, b, c]);
                    combos.push({
                        targets: [a, b, c],
                        comboScore: ((a.scores.composite * usableA) +
                                     (b.scores.composite * usableB) +
                                     (c.scores.composite * usableC)) / 3
                    });
                }
            }
        }

        // Split by size, sort each group, return top results per group
        const singles = combos.filter(c => c.targets.length === 1)
            .sort((a, b) => b.comboScore - a.comboScore).slice(0, 5);
        const pairs = combos.filter(c => c.targets.length === 2)
            .sort((a, b) => b.comboScore - a.comboScore).slice(0, 5);
        const triplets = combos.filter(c => c.targets.length === 3)
            .sort((a, b) => b.comboScore - a.comboScore).slice(0, 5);

        return { singles, pairs, triplets };
    },

    /**
     * Assemble candidate pool from selected source
     * @param {string} source - 'todo' or 'filter'
     * @returns {Array} Normalized candidate array
     */
    assembleCandidatePool(source) {
        let rawTargets = [];

        if (source === 'todo') {
            rawTargets = ToDoManager.getToDoTargets();
        } else if (source === 'filter') {
            rawTargets = OptimizerView.filterTargetsPool || [];
        }

        // Normalize to consistent candidate format
        return rawTargets.map(target => ({
            id:         target.object,
            name:       target.object,
            common:     target.common || '',
            type:       target.type || '',
            ra:         target.ra,
            dec:        target.dec,
            sizeMin:    target.size_min ?? null,  // arcmin
            sizeMax:    target.size_max ?? null,  // arcmin
            // STUB: telescope/sensor + size compatibility scoring
            // Future: compare sizeMax against FOV to flag targets too large or too small
            //         for the current equipment profile
        }));
    }

};
