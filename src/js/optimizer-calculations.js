/**
 * optimizer-calculations.js
 * Core algorithms for Target Optimizer
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
     * Generate best target combinations for a night
     * @param {Array} scoredCandidates - Already scored candidates from scoreCandidates()
     * @returns {Array} Top 10 combinations sorted by quality-weighted score descending
     */
    generateCombinations(scoredCandidates) {
        if (!scoredCandidates || scoredCandidates.length === 0) return [];

        const combos = [];

        // Size 1: each target as a solo combination
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
                combos.push({
                    targets: [a, b],
                    comboScore: ((a.scores.composite * a.windowHours) +
                                 (b.scores.composite * b.windowHours)) / 2
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
                    combos.push({
                        targets: [a, b, c],
                        comboScore: ((a.scores.composite * a.windowHours) +
                                     (b.scores.composite * b.windowHours) +
                                     (c.scores.composite * c.windowHours)) / 3
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
