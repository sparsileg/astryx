/**
 * session-invariants.js
 * I1-I15 cross-checks (design doc §5) plus the Finding model (design doc
 * §4.4) that invariant failures raise. Each invariant is an independent
 * function operating on a FusedSession and the raw parser outputs it was
 * built from — fusion discards some raw data (e.g. per-parser dither
 * counts) that a cross-check needs independently of the fused view.
 *
 * Design principle P3: every derived number is cross-checked against an
 * independent path. Design principle P4: findings carry evidence; nothing
 * reaches the person without a log line, timestamp, or computed metric
 * behind it.
 */

const SessionInvariants = {

    // -------------------------------------------------------------------------
    // Finding model (design doc §4.4)
    // -------------------------------------------------------------------------

    // Factory, not a class — a Finding is a plain data object. Sensible
    // defaults on the optional fields so every call site doesn't have to
    // spell out an empty ruledOut/recommendationIds/affectedSubs array.
    createFinding({
        code, severity, confidence, title, detail,
        evidence = [], affectedSubs = [], timeRange = null,
        ruledOut = [], recommendationIds = [],
    }) {
        return {
            id: `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            code, severity, confidence, title, detail,
            evidence, affectedSubs, timeRange, ruledOut, recommendationIds,
        };
    },

    // -------------------------------------------------------------------------
    // Orchestration
    // -------------------------------------------------------------------------

    /**
     * Runs all 15 invariants and returns { invariants, findings }.
     * Does NOT mutate fusedSession — session-fusion.js's caller is
     * responsible for merging the results in and applying suppression
     * (design principle: this file computes, it doesn't own the model).
     */
    checkAll(fusedSession, asiairParsed, phd2Parsed) {
        const invariants = [
            this._checkI1(fusedSession, asiairParsed),
            this._checkI2(fusedSession, asiairParsed),
            this._checkI3(fusedSession, asiairParsed, phd2Parsed),
            this._checkI4(fusedSession, asiairParsed),
            this._checkI5(fusedSession, asiairParsed, phd2Parsed),
            this._checkI6(fusedSession, phd2Parsed),
            this._checkI7(fusedSession, asiairParsed),
            this._checkI8(fusedSession, asiairParsed),
            this._checkI9(fusedSession, phd2Parsed),
            this._checkI10(fusedSession, asiairParsed),
            this._checkI11(fusedSession, asiairParsed),
            this._checkI12(fusedSession, asiairParsed),
            this._checkI13(fusedSession, asiairParsed, phd2Parsed),
            this._checkI14(fusedSession, phd2Parsed),
            this._checkI15(fusedSession, asiairParsed),
        ].filter(Boolean); // some invariants return null when not applicable (e.g. I3/I5/I6/I9/I14 with no PHD2 log)

        const findings = [];
        for (const result of invariants) {
            if (!result.passed) {
                findings.push(this._findingForInvariant(result));
            }
        }

        return { invariants, findings };
    },

    _findingForInvariant(result) {
        return this.createFinding({
            code: `INVARIANT_${result.id}_FAILED`,
            severity: result.severity,
            confidence: 'derived',
            title: `${result.id} failed: ${result.impact}`,
            detail: `Expected ${JSON.stringify(result.expected)}, got ${JSON.stringify(result.actual)} (tolerance ${JSON.stringify(result.tolerance)}).`,
            evidence: [{ source: 'computed', value: result.actual }],
            affectedSubs: result.affectedSubs || [],
        });
    },

    _result({ id, expected, actual, tolerance, passed, severity, impact, affectedSubs }) {
        return { id, expected, actual, tolerance, passed, severity, impact, affectedSubs: affectedSubs || [] };
    },

    // -------------------------------------------------------------------------
    // I1 — Imaging block duration ≈ Σ(exposure + measured overhead)
    // -------------------------------------------------------------------------

    // Per-sub overhead budget uses SUB_CYCLE_OVERHEAD_S from
    // APP_CONFIG.LOG_ANALYSIS (threshold-calibration.md §4's one-night
    // measurement, 23s) with a 2x safety margin — this is a corpus-derived
    // single-night measurement, not a hard limit, so the tolerance is
    // generous by design.
    _checkI1(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const overheadBudget = (APP_CONFIG.LOG_ANALYSIS && APP_CONFIG.LOG_ANALYSIS.SUB_CYCLE_OVERHEAD_S) || 23;
        let worstBlock = null;
        let worstDeltaS = 0;

        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const block of run.blocks) {
                if (!block.startedAt || !block.endedAt || block.subs.length === 0) continue;
                const actualS = (block.endedAt.getTime() - block.startedAt.getTime()) / 1000;
                const expectedS = block.subs.reduce((s, sub) => s + (sub.exposureS || 0), 0);
                const tolerance = block.subs.length * overheadBudget * 2;
                const deltaS = actualS - expectedS;
                if (Math.abs(deltaS) > tolerance && Math.abs(deltaS) > worstDeltaS) {
                    worstDeltaS = Math.abs(deltaS);
                    worstBlock = { block, actualS, expectedS, tolerance };
                }
            }
        }

        return this._result({
            id: 'I1',
            expected: worstBlock ? worstBlock.expectedS : 'block duration ≈ Σ exposures + overhead',
            actual: worstBlock ? worstBlock.actualS : 'within tolerance on all blocks',
            tolerance: worstBlock ? worstBlock.tolerance : null,
            passed: !worstBlock,
            severity: 'warning',
            impact: 'Imaging block duration does not reconcile with its subs — a swallowed or fabricated gap (the original settle-scan bug class, #227).',
        });
    },

    // -------------------------------------------------------------------------
    // I2 — Wall clock = Σ tracked events + unaccounted remainder
    // -------------------------------------------------------------------------

    // #230's wallClock reconciliation already computes unaccountedS; this
    // invariant checks it's small relative to the night, not re-deriving
    // it. Originally motivated by the phantom 25-minute gap, already fixed
    // — this is regression protection for that fix, not new detection.
    _checkI2(fusedSession, asiairParsed) {
        // #235: same fix as session-fusion.js's coverage.unaccountedSeconds
        // — unaccountedS/wallClockS live on parsed.summary, not
        // parsed.wallClock.
        if (!asiairParsed.summary || asiairParsed.summary.wallClockS === 0) return null;
        const { wallClockS, unaccountedS } = asiairParsed.summary;
        const pct = Math.abs(unaccountedS) / wallClockS;
        const toleranceFraction = (APP_CONFIG.LOG_ANALYSIS && APP_CONFIG.LOG_ANALYSIS.WALL_CLOCK_UNACCOUNTED_FRACTION) || 0.05;

        return this._result({
            id: 'I2',
            expected: `unaccounted ≤ ${(toleranceFraction * 100).toFixed(0)}% of wall clock`,
            actual: `${unaccountedS.toFixed(0)}s unaccounted of ${wallClockS.toFixed(0)}s (${(pct * 100).toFixed(1)}%)`,
            tolerance: toleranceFraction,
            passed: pct <= toleranceFraction,
            severity: 'critical',
            impact: 'A gap in wall-clock reconciliation this large means something happened that no event category captured — the phantom-gap bug class (#227).',
        });
    },

    // -------------------------------------------------------------------------
    // I3 — ASIAir dither count == PHD2 dither count over the same window
    // -------------------------------------------------------------------------

    _checkI3(fusedSession, asiairParsed, phd2Parsed) {
        if (!phd2Parsed) return null;
        const asiairCount = asiairParsed.runs
            .filter(r => r.kind === 'light')
            .flatMap(r => r.events)
            .filter(e => e.type === 'dither').length;
        const phd2Count = phd2Parsed.sessions.reduce((s, ses) => s + ses.ditherEvents.length, 0);

        return this._result({
            id: 'I3',
            expected: asiairCount,
            actual: phd2Count,
            tolerance: 0,
            passed: asiairCount === phd2Count,
            severity: 'warning',
            impact: 'ASIAir and PHD2 disagree on how many dithers occurred — one side is swallowing or fabricating dither events (the 56-vs-60 bug class, #227).',
        });
    },

    // -------------------------------------------------------------------------
    // I4 — Sub numbering contiguous; duplicates explicitly accounted
    // -------------------------------------------------------------------------

    _checkI4(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const unexplainedGaps = [];
        const unexplainedDuplicates = [];

        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            const allSubs = run.blocks.flatMap(b => b.subs).sort((a, b) => a.sequenceNo - b.sequenceNo);
            const seenImageNos = new Map();

            for (let i = 0; i < allSubs.length; i++) {
                const sub = allSubs[i];
                if (seenImageNos.has(sub.imageNo)) {
                    if (sub.duplicateOf === null && !sub.aborted) {
                        unexplainedDuplicates.push(sub.imageNo);
                    }
                } else {
                    seenImageNos.set(sub.imageNo, sub);
                }
                if (i > 0) {
                    const prev = allSubs[i - 1];
                    const numGap = sub.imageNo - prev.imageNo;
                    // A gap of exactly 1 is normal sequential numbering; a
                    // gap of 0 is the same/duplicate image; anything else
                    // needs an explanation (an aborted sub on either side).
                    if (numGap > 1 && !prev.aborted && !sub.aborted) {
                        unexplainedGaps.push(`${prev.imageNo}->${sub.imageNo}`);
                    }
                }
            }
        }

        const passed = unexplainedGaps.length === 0 && unexplainedDuplicates.length === 0;
        return this._result({
            id: 'I4',
            expected: 'contiguous numbering, or gaps/duplicates explained by aborted/duplicateOf',
            actual: `${unexplainedGaps.length} unexplained gap(s): [${unexplainedGaps.join(', ')}]; ${unexplainedDuplicates.length} unexplained duplicate(s): [${unexplainedDuplicates.join(', ')}]`,
            tolerance: 0,
            passed,
            severity: 'critical',
            impact: 'Subs vanished or were duplicated without a recorded cause — the images-41-42-vanish / image-43-duplicated bug class (#229/#230).',
        });
    },

    // -------------------------------------------------------------------------
    // I5 — Guide-session boundaries ≈ imaging-block boundaries
    // -------------------------------------------------------------------------

    _checkI5(fusedSession, asiairParsed, phd2Parsed) {
        if (!phd2Parsed || fusedSession.kind !== 'science') return null;
        const sessionRanges = phd2Parsed.sessions
            .filter(s => s.startTime)
            .map(s => {
                const from = new Date(s.startTime).getTime();
                // A session with no endTime means the log ended mid-session
                // (no "Guiding Ends" line) rather than that it never
                // overlaps anything — use its last frame's timestamp as an
                // effective end instead of excluding it from coverage.
                let to;
                if (s.endTime) {
                    to = new Date(s.endTime).getTime();
                } else if (s.frames.length > 0) {
                    to = from + s.frames[s.frames.length - 1].t * 1000;
                } else {
                    to = from;
                }
                return { from, to };
            });

        const uncoveredBlocks = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const block of run.blocks) {
                if (!block.startedAt || !block.endedAt) continue;
                const bFrom = block.startedAt.getTime();
                const bTo = block.endedAt.getTime();
                const covered = sessionRanges.some(r => r.from <= bTo && r.to >= bFrom);
                if (!covered) uncoveredBlocks.push(`${block.firstImageNo}-${block.lastImageNo}`);
            }
        }

        return this._result({
            id: 'I5',
            expected: 'every imaging block overlaps at least one guide session',
            actual: uncoveredBlocks.length === 0 ? 'all blocks covered' : `uncovered: ${uncoveredBlocks.join(', ')}`,
            tolerance: 0,
            passed: uncoveredBlocks.length === 0,
            severity: 'warning',
            impact: 'An imaging block with no overlapping guide session usually means a swallowed AF or calibration event ate the guide-session boundary.',
        });
    },

    // -------------------------------------------------------------------------
    // I6 — PHD2 frame count × guide exposure ≈ session duration
    // -------------------------------------------------------------------------

    _checkI6(fusedSession, phd2Parsed) {
        if (!phd2Parsed) return null;
        const toleranceFraction = (APP_CONFIG.LOG_ANALYSIS && APP_CONFIG.LOG_ANALYSIS.FRAME_DURATION_TOLERANCE_FRACTION) || 0.15;
        // Short sessions (below the already-established SHORT_SESSION
        // frame count) are excluded — caught during validation on
        // 2025-12-21 session 28 (54 frames, 128s actual vs 108s expected,
        // 15.6% vs a 15% tolerance): the end-of-session gap before
        // "Guiding Ends" is logged is a roughly fixed number of seconds,
        // which is a much larger fraction of a short session's total
        // duration than a long one's. Not a bug in the reconciliation
        // itself, just not a meaningful check at this scale.
        const shortSessionFrames = (APP_CONFIG.PHD2_GUIDE_THRESHOLDS && APP_CONFIG.PHD2_GUIDE_THRESHOLDS.SHORT_SESSION) || 100;
        let worst = null;

        for (const session of phd2Parsed.sessions) {
            if (!session.startTime || !session.endTime || !session.equipment.guideExposureMs) continue;
            if (session.frames.length < shortSessionFrames) continue;
            const durationS = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000;
            if (durationS <= 0) continue;
            const expectedS = session.frames.length * (session.equipment.guideExposureMs / 1000);
            const deltaFraction = Math.abs(durationS - expectedS) / durationS;
            if (deltaFraction > toleranceFraction && (!worst || deltaFraction > worst.deltaFraction)) {
                worst = { session, durationS, expectedS, deltaFraction };
            }
        }

        return this._result({
            id: 'I6',
            expected: worst ? `~${worst.durationS.toFixed(0)}s (session duration)` : 'frame count × exposure ≈ session duration',
            actual: worst ? `${worst.expectedS.toFixed(0)}s from ${worst.session.frames.length} frames (session ${worst.session.num})` : 'within tolerance on all sessions',
            tolerance: toleranceFraction,
            passed: !worst,
            severity: 'warning',
            impact: 'Frame count implies a different session duration than the timestamps do — dropped or delayed frames PHD2 itself did not account for.',
        });
    },

    // -------------------------------------------------------------------------
    // I7 — Every AF has Begin, End, and a settle terminator
    // -------------------------------------------------------------------------

    _checkI7(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const incomplete = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const event of run.events.filter(e => e.type === 'autofocus')) {
                if (!event.end) incomplete.push(`start=${event.start}`);
            }
        }
        return this._result({
            id: 'I7',
            expected: 'every AF event has an end timestamp',
            actual: incomplete.length === 0 ? 'all AF events complete' : `${incomplete.length} incomplete: ${incomplete.join('; ')}`,
            tolerance: 0,
            passed: incomplete.length === 0,
            severity: 'warning',
            impact: 'A truncated AF block — the settle-scan bug class that #227 fixed.',
        });
    },

    // -------------------------------------------------------------------------
    // I8 — Every dither has a terminator within the timeout
    // -------------------------------------------------------------------------

    _checkI8(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const missing = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const event of run.events.filter(e => e.type === 'dither')) {
                if (!event.outcome) missing.push(`start=${event.start}`);
            }
        }
        return this._result({
            id: 'I8',
            expected: 'every dither event has an outcome (done/timeout/failed)',
            actual: missing.length === 0 ? 'all dithers terminated' : `${missing.length} without outcome: ${missing.join('; ')}`,
            tolerance: 0,
            passed: missing.length === 0,
            severity: 'critical',
            impact: 'An unbounded dither scan swallowing exposures — the original settle-scan bug (#227).',
        });
    },

    // -------------------------------------------------------------------------
    // I9 — Pixel scale and binning constant within one guide session
    // -------------------------------------------------------------------------

    // Frames don't carry a per-frame pixel scale, so this can't compare
    // frame-to-frame directly — it checks that every session with frames
    // resolved a complete, non-null equipment reading (the structural
    // guarantee #231's per-session bounded header scan is supposed to
    // provide). A session with frames but no resolved scale/binning means
    // the header scan failed to find one, which is the failure mode this
    // invariant exists to catch.
    _checkI9(fusedSession, phd2Parsed) {
        if (!phd2Parsed) return null;
        const incomplete = phd2Parsed.sessions
            .filter(s => s.frames.length > 0 && (s.equipment.pixelScaleArcsec === null || s.equipment.binning === null))
            .map(s => s.num);

        return this._result({
            id: 'I9',
            expected: 'every session with frames has a resolved pixel scale and binning',
            actual: incomplete.length === 0 ? 'all sessions resolved' : `unresolved sessions: ${incomplete.join(', ')}`,
            tolerance: 0,
            passed: incomplete.length === 0,
            severity: 'critical',
            impact: 'A session with frames but no resolved equipment means RMS for those frames used a fallback/wrong pixel scale — the mixed-binning bug class (#231).',
        });
    },

    // -------------------------------------------------------------------------
    // I10 — Captured frames ≤ planned frames per run
    // -------------------------------------------------------------------------

    _checkI10(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const overages = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            if (run.plannedFrames === null) continue;
            const captured = run.blocks.reduce((s, b) => s + b.subs.length, 0);
            if (captured > run.plannedFrames) overages.push(`run ${run.index} (${run.target}): ${captured}/${run.plannedFrames}`);
        }
        return this._result({
            id: 'I10',
            expected: 'captured ≤ planned per run',
            actual: overages.length === 0 ? 'no overages' : overages.join('; '),
            tolerance: 0,
            passed: overages.length === 0,
            severity: 'warning',
            impact: 'More frames captured than planned usually means two autoruns merged into one reported run — the multi-run merge bug class (#229).',
        });
    },

    // -------------------------------------------------------------------------
    // I11 — Every autorun has a Begin and an End
    // -------------------------------------------------------------------------

    _checkI11(fusedSession, asiairParsed) {
        const missing = asiairParsed.runs.filter(r => !r.endReason).map(r => r.index);
        return this._result({
            id: 'I11',
            expected: 'every run has an endReason',
            actual: missing.length === 0 ? 'all runs closed' : `runs without endReason: ${missing.join(', ')}`,
            tolerance: 0,
            passed: missing.length === 0,
            severity: 'critical',
            impact: 'A run with no recorded end means #229\'s segmentation itself failed — this should be structurally impossible given how _extractRunSegments always assigns truncated/finish/pause/manualStop.',
        });
    },

    // -------------------------------------------------------------------------
    // I12 — Exposure length constant within one run
    // -------------------------------------------------------------------------

    _checkI12(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const inconsistent = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            const allSubs = run.blocks.flatMap(b => b.subs);
            const distinctExposures = [...new Set(allSubs.map(s => s.exposureS))];
            if (distinctExposures.length > 1) {
                inconsistent.push(`run ${run.index} (${run.target}): [${distinctExposures.join(', ')}]`);
            }
        }
        return this._result({
            id: 'I12',
            expected: 'one exposure length per run',
            actual: inconsistent.length === 0 ? 'consistent within every run' : inconsistent.join('; '),
            tolerance: 0,
            passed: inconsistent.length === 0,
            severity: 'warning',
            impact: 'A run mixing exposure lengths means the multi-exposure-length night (2026-06-05 class) wasn\'t split into separate runs correctly.',
        });
    },

    // -------------------------------------------------------------------------
    // I13 — Unmatched line count == 0
    // -------------------------------------------------------------------------

    // The only mechanism that will surface a future firmware/log-format
    // change before it silently corrupts a number (#233).
    _checkI13(fusedSession, asiairParsed, phd2Parsed) {
        const asiairCount = (asiairParsed.source && asiairParsed.source.unmatchedLines.length) || 0;
        const phd2Count = (phd2Parsed && phd2Parsed.source && phd2Parsed.source.unmatchedLines.length) || 0;
        const total = asiairCount + phd2Count;
        return this._result({
            id: 'I13',
            expected: 0,
            actual: total,
            tolerance: 0,
            passed: total === 0,
            severity: 'info',
            impact: 'Unrecognized log lines usually mean a firmware update introduced a new format this parser has never seen.',
        });
    },

    // -------------------------------------------------------------------------
    // I14 — Every settle window has a terminator
    // -------------------------------------------------------------------------

    // 'unclosed' (a session ending mid-settle-attempt) counts as a valid
    // terminal outcome, per #231 — only a genuinely null outcome fails.
    _checkI14(fusedSession, phd2Parsed) {
        if (!phd2Parsed) return null;
        const missing = [];
        for (const session of phd2Parsed.sessions) {
            for (const window of session.settleWindows) {
                if (!window.outcome) missing.push(`session ${session.num} @ line ${window.startedAt}`);
            }
        }
        return this._result({
            id: 'I14',
            expected: 'every settle window has a non-null outcome',
            actual: missing.length === 0 ? 'all windows terminated' : `${missing.length} without outcome: ${missing.join('; ')}`,
            tolerance: 0,
            passed: missing.length === 0,
            severity: 'critical',
            impact: 'An unterminated settle window means #231\'s state machine itself failed to close it.',
        });
    },

    // -------------------------------------------------------------------------
    // I15 — Learned values derived only from blocks with no findings
    // -------------------------------------------------------------------------

    // The least precisely checkable of the 15: nothing in this codebase
    // persists which specific blocks contributed to a stored learned
    // value, so this can't reach into SettingsManager's history and
    // confirm it directly. What it *can* check is self-consistency: every
    // sub this run's own findings mark as dirty (aborted, or an
    // unsettled/failed dither immediately preceding it) must also be
    // excluded from 'clean' tier — since ELR.p3-1's tiering and #227's
    // learned-value gating are meant to agree on what "clean" means, and
    // if they silently diverged, a dirty block could still feed a learned
    // value through the tier path without either side's exclusion logic
    // catching it directly. This is real coverage, but it's a proxy, not
    // a direct verification against persisted state.
    _checkI15(fusedSession, asiairParsed) {
        if (fusedSession.kind !== 'science') return null;
        const wronglyClean = fusedSession.subs.filter(s =>
            s.tier === 'clean' && (s.aborted || !s.settledAtStart)
        );
        return this._result({
            id: 'I15',
            expected: 'no aborted/unsettled sub tiered as clean',
            actual: wronglyClean.length === 0 ? 'consistent' : `${wronglyClean.length} sub(s): [${wronglyClean.map(s => s.imageNo).join(', ')}]`,
            tolerance: 0,
            passed: wronglyClean.length === 0,
            severity: 'warning',
            impact: 'A dirty sub tiered as clean could feed a learned value undetected — this is a proxy check, not a direct audit of what actually contributed to a stored learned value (see code comment).',
            affectedSubs: wronglyClean.map(s => s.imageNo),
        });
    },

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionInvariants;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
