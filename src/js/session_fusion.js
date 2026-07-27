/**
 * session-fusion.js
 * Joins one night's AsiairLog and (optionally) GuideLog into a single
 * FusedSession. Neither parser knows the other exists (design doc §3) —
 * this is the only place that reads both.
 *
 * Scope note (ELR.p3-1): invariants[], findings[], and recommendations[]
 * are present on FusedSession but always empty here — populating them is
 * ELR.p3-2 (invariants/findings) and Phase 6 (recommendations).
 */

const SessionFusion = {

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    /**
     * @param {object} asiairParsed - AsiairLogParser.parse() output. Required.
     * @param {object|null} phd2Parsed - Phd2LogParser.parse() output, or null
     *   when no guide log is available for this night.
     * @returns {object} FusedSession
     */
    fuseNight(asiairParsed, phd2Parsed = null) {
        const lightRuns = (asiairParsed.runs || []).filter(r => r.kind === 'light');

        if (lightRuns.length === 0) {
            // Flats-excluded-entirely rule (design doc §3 architecture):
            // a flat/dark/bias/framing-only night gets a minimal session,
            // not run through tiering, invariants, or detectors.
            return this._buildCalibrationOnlySession(asiairParsed);
        }

        const targets = [...new Set(lightRuns.map(r => r.target))];

        // Flatten PHD2 frames/drops to absolute time once, rather than
        // re-scanning every session per sub — a bad night can have 100+
        // guide sessions and thousands of frames.
        const guideIndex = phd2Parsed ? this._buildGuideIndex(phd2Parsed) : null;

        const subs = [];
        for (const run of lightRuns) {
            for (const block of run.blocks) {
                for (const sub of block.subs) {
                    subs.push(this._buildFusedSub(sub, run, guideIndex));
                }
            }
        }
        subs.sort((a, b) => a.sequenceNo - b.sequenceNo);

        const span = this._computeSpan(subs);
        const coverage = this._computeCoverage(asiairParsed, phd2Parsed, subs);
        const equipment = this._buildEquipment(phd2Parsed);
        const metrics = this._computeMetrics(subs, phd2Parsed);

        const fusedSession = {
            night: asiairParsed.date || null,
            kind: 'science',
            targets,
            span,
            subs,
            timeline: this._buildTimeline(lightRuns, asiairParsed.gaps || []),
            metrics,
            invariants: [],
            findings: [],
            recommendations: [],  // Phase 6
            coverage,
            equipment,
        };

        // ELR.p3-2 item 3.5: run invariants, then suppress the specific
        // fields each failure backs — not the whole session — rather than
        // printing a number that's already known to be untrustworthy.
        if (typeof SessionInvariants !== 'undefined') {
            const { invariants, findings } = SessionInvariants.checkAll(fusedSession, asiairParsed, phd2Parsed);
            fusedSession.invariants = invariants;
            fusedSession.findings = findings;
            this._applySuppression(fusedSession, invariants);
        }

        return fusedSession;
    },

    // Only the invariants whose failure backs a specific, nameable
    // FusedSession field are suppressed here. Several of the 15 (I1, I7,
    // I8, I11, I12, I14) are structural regression checks on the parsers
    // themselves — when they fail it means a parser bug reappeared, not
    // that one fusion-level number needs hiding, so they raise a Finding
    // (via checkAll above) without nulling anything.
    _applySuppression(fusedSession, invariants) {
        const byId = Object.fromEntries(invariants.map(inv => [inv.id, inv]));

        // I2: wall-clock reconciliation doesn't hold — the unaccounted
        // figure itself is what's suspect, so null it rather than show a
        // number known not to add up.
        if (byId.I2 && !byId.I2.passed) {
            fusedSession.coverage.unaccountedSeconds = null;
        }

        // I3: ASIAir/PHD2 dither counts disagree — the fused dither-linked
        // fields (settledAtStart, guideFailureCount) were computed against
        // ASIAir's own event list, which this invariant says may not be
        // trustworthy on this night.
        if (byId.I3 && !byId.I3.passed) {
            fusedSession.metrics.ditherCountMismatch = true;
        }

        // I6: PHD2 frame count doesn't reconcile with session duration —
        // the night's guideRmsSettled/guideRmsDuringExposures figures rest
        // on those same frames, so flag rather than silently trust them.
        if (byId.I6 && !byId.I6.passed) {
            fusedSession.metrics.guideRmsUnreliable = true;
        }

        // I9: a session's equipment (pixel scale/binning) never resolved —
        // any sub whose guide join drew frames from that session has an
        // RMS computed against a fallback/wrong scale. No direct
        // session-num reference on FusedSub by design (it's a join
        // result, not a session pointer), so suppression here is
        // necessarily coarse: flagged on the session as a whole rather
        // than per-sub, since pinpointing which specific subs drew from
        // the unresolved session would require re-running part of the
        // join. Flagged as a known limitation, not solved silently.
        if (byId.I9 && !byId.I9.passed) {
            const unresolvedSessionNums = [...new Set((byId.I9.actual.match(/\d+/g) || []).map(Number))];
            fusedSession.coverage.equipmentUnresolvedSessions = unresolvedSessionNums;
        }
    },

    _buildCalibrationOnlySession(asiairParsed) {
        return {
            night: asiairParsed.date || null,
            kind: 'calibrationOnly',
            targets: [],
            span: null,
            subs: [],
            timeline: [],
            metrics: null,
            invariants: [],
            findings: [],
            recommendations: [],
            coverage: {
                asiairPresent: true,
                phd2Present: false,
                unmatchedLineCount: (asiairParsed.source && asiairParsed.source.unmatchedLines.length) || 0,
                unaccountedSeconds: null,
                subsWithoutGuideData: null,
            },
            equipment: null,
        };
    },

    // -------------------------------------------------------------------------
    // Guide index — flattened, absolute-time PHD2 frames/drops
    // -------------------------------------------------------------------------

    // Resolves each session's frame.t (seconds since that session's own
    // start) to an absolute epoch-ms timestamp, since there's no absolute
    // timestamp on the frame row itself — only on the session header
    // ("Guiding Begins at ..."). Both parsers' timestamp strings parse
    // consistently via the native Date constructor (verified against real
    // corpus data — ASIAir's "YYYY/MM/DD HH:MM:SS" and PHD2's
    // "YYYY-MM-DD HH:MM:SS" both resolve the same way), so absolute-time
    // comparison across the two logs is valid.
    _buildGuideIndex(phd2Parsed) {
        const frames = [];
        const drops = [];

        for (const session of phd2Parsed.sessions) {
            const sessionStartMs = new Date(session.startTime).getTime();
            if (Number.isNaN(sessionStartMs)) continue;
            const pixelScale = session.equipment && session.equipment.pixelScaleArcsec;

            for (const frame of session.frames) {
                frames.push({
                    atMs: sessionStartMs + frame.t * 1000,
                    pixelScale,
                    ...frame,
                });
            }
            for (const drop of session.drops) {
                drops.push({
                    atMs: sessionStartMs + drop.t * 1000,
                    ...drop,
                });
            }
        }

        frames.sort((a, b) => a.atMs - b.atMs);
        drops.sort((a, b) => a.atMs - b.atMs);
        return { frames, drops };
    },

    // -------------------------------------------------------------------------
    // Per-sub join
    // -------------------------------------------------------------------------

    _buildFusedSub(sub, run, guideIndex) {
        const startMs = sub.startedAt ? sub.startedAt.getTime() : null;
        const endMs = (startMs !== null && sub.exposureS) ? startMs + sub.exposureS * 1000 : null;

        const guide = (guideIndex && startMs !== null && endMs !== null)
            ? this._joinGuideWindow(guideIndex, startMs, endMs)
            : null;

        const settledAtStart = this._resolveSettledAtStart(sub, run);
        const guideFailureCount = this._countGuideFailures(run, startMs, endMs);
        const { blockAchievedStarSize, temperatureC } = this._resolvePrecedingAf(run, startMs);

        const fusedSub = {
            imageNo: sub.imageNo,
            sequenceNo: sub.sequenceNo,
            target: run.target,
            startedAt: sub.startedAt,
            exposureS: sub.exposureS,
            guide,
            settledAtStart,
            guideFailureCount,
            blockAchievedStarSize,
            temperatureC,
            aborted: sub.aborted,
            duplicateOf: sub.duplicateOf,
        };
        fusedSub.tier = null;
        fusedSub.tierReasons = [];
        return fusedSub;
    },

    // Settled frames only, per threshold-calibration.md — all-frames RMS
    // measures the dither setting as much as guiding, not guiding alone.
    // droppedCount/frameCount both count only settled Mount-row frames
    // within the window for the same reason; DROP rows are counted
    // separately from the drops index.
    _joinGuideWindow(guideIndex, startMs, endMs) {
        const framesInWindow = this._binarySearchRange(guideIndex.frames, startMs, endMs)
            .filter(f => f.settled);
        const dropsInWindow = this._binarySearchRange(guideIndex.drops, startMs, endMs);

        if (framesInWindow.length === 0) {
            return {
                rmsRa: null, rmsDec: null, rmsTotal: null, peakTotal: null,
                frameCount: 0, droppedCount: dropsInWindow.length, medianSnr: null,
            };
        }

        const scale = framesInWindow[0].pixelScale || 1;
        const raArcsec = framesInWindow.map(f => f.raRaw * scale);
        const decArcsec = framesInWindow.map(f => f.decRaw * scale);
        const totalArcsec = framesInWindow.map((f, i) => Math.sqrt(raArcsec[i] ** 2 + decArcsec[i] ** 2));

        const rms = (arr) => Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
        const snrs = framesInWindow.map(f => f.snr).filter(Number.isFinite).sort((a, b) => a - b);
        const medianSnr = snrs.length
            ? (snrs.length % 2 ? snrs[(snrs.length - 1) / 2]
                : (snrs[snrs.length / 2 - 1] + snrs[snrs.length / 2]) / 2)
            : null;

        return {
            rmsRa: rms(raArcsec),
            rmsDec: rms(decArcsec),
            rmsTotal: rms(totalArcsec),
            peakTotal: Math.max(...totalArcsec),
            frameCount: framesInWindow.length,
            droppedCount: dropsInWindow.length,
            medianSnr,
        };
    },

    // Frames/drops arrays are pre-sorted by atMs (_buildGuideIndex); binary
    // search for the window bounds rather than a linear scan per sub, since
    // a bad night can mean thousands of frames across hundreds of subs.
    _binarySearchRange(sortedArr, startMs, endMs) {
        const lo = this._lowerBound(sortedArr, startMs);
        const hi = this._lowerBound(sortedArr, endMs);
        return sortedArr.slice(lo, hi);
    },

    _lowerBound(sortedArr, targetMs) {
        let lo = 0, hi = sortedArr.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (sortedArr[mid].atMs < targetMs) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    },

    // D3 (design doc §6): a sub is unsettled-at-start when the dither
    // immediately preceding it (within the same run) ended in 'timeout' or
    // 'failed'. This was left as a neutral `true` placeholder by #230
    // ("populating from real event data is a later issue") — resolved here
    // at fusion time rather than by re-touching the parser, since
    // correlating a sub against its run's own event list is a join, which
    // is what this file is for.
    _resolveSettledAtStart(sub, run) {
        if (!sub.startedAt) return true;
        const dithers = run.events.filter(e => e.type === 'dither' && e.end && e.end <= sub.startedAt);
        if (dithers.length === 0) return true;
        const preceding = dithers.reduce((latest, d) => (d.end > latest.end ? d : latest));
        return preceding.outcome === 'done';
    },

    _countGuideFailures(run, startMs, endMs) {
        if (startMs === null || endMs === null) return 0;
        return run.events.filter(e => {
            if (e.type !== 'guide_failure' || !e.at) return false;
            const t = e.at.getTime();
            return t >= startMs && t < endMs;
        }).length;
    },

    // Most recent AF event (by end time) before this sub's start, within
    // the same run — describes the focus/environment state in effect for
    // this sub until the next AF cycle supersedes it.
    _resolvePrecedingAf(run, startMs) {
        if (startMs === null) return { blockAchievedStarSize: null, temperatureC: null };
        const afEvents = run.events.filter(e => e.type === 'autofocus' && e.end && e.end.getTime() <= startMs);
        if (afEvents.length === 0) return { blockAchievedStarSize: null, temperatureC: null };
        const latest = afEvents.reduce((a, b) => (b.end > a.end ? b : a));
        return { blockAchievedStarSize: latest.achievedStarSize, temperatureC: latest.temperatureC };
    },

    // -------------------------------------------------------------------------
    // Tiering
    // -------------------------------------------------------------------------

    // Three tiers, not two (design doc §4.3) — a binary verdict understated
    // real damage on 2025-12-20 (17 of 26 actual rejects caught cleanly,
    // marginal band 1.35-2.22" against a ~1.1" night median accounted for
    // most of the gap). Design doc §10 Q5 leaves "absolute vs. relative to
    // night median" as an explicitly open question; this implementation
    // resolves it as relative-to-night-median, since that's what the
    // design doc's own worked example used to characterize the marginal
    // band in the first place. Multipliers below are tuned to reproduce
    // that specific validated band, not picked arbitrarily — see delivery
    // notes for the actual reproduction check.
    // ELR.p3-2: re-pointed at APP_CONFIG.LOG_ANALYSIS. Falls back to the
    // original p3-1 local defaults if the config block isn't present
    // (e.g. this file loaded standalone without config.js), rather than
    // throwing on a missing APP_CONFIG.
    get MARGINAL_MULTIPLIER() {
        return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.LOG_ANALYSIS)
            ? APP_CONFIG.LOG_ANALYSIS.TIER_MARGINAL_MULTIPLIER : 1.2;
    },
    get REJECT_MULTIPLIER() {
        return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.LOG_ANALYSIS)
            ? APP_CONFIG.LOG_ANALYSIS.TIER_REJECT_MULTIPLIER : 2.0;
    },

    _applyTiering(subs) {
        const settledRms = subs
            .filter(s => s.guide && s.guide.rmsTotal !== null)
            .map(s => s.guide.rmsTotal);
        const nightMedian = this._median(settledRms);

        for (const sub of subs) {
            const reasons = [];

            if (sub.aborted) {
                reasons.push('truncated exposure');
            }
            if (!sub.settledAtStart) {
                reasons.push('started before dither settled');
            }
            if (sub.guideFailureCount > 0) {
                reasons.push(`${sub.guideFailureCount} guide failure event(s) during exposure`);
            }

            if (!sub.guide || sub.guide.rmsTotal === null) {
                sub.tier = 'unknown';
                sub.tierReasons = ['no guide data for this exposure window', ...reasons];
                continue;
            }

            if (nightMedian === null) {
                sub.tier = 'unknown';
                sub.tierReasons = ['no night-median guide RMS available for comparison', ...reasons];
                continue;
            }

            const rms = sub.guide.rmsTotal;
            if (sub.aborted || rms > nightMedian * this.REJECT_MULTIPLIER) {
                sub.tier = 'reject';
                if (rms > nightMedian * this.REJECT_MULTIPLIER) {
                    reasons.push(`RMS ${rms.toFixed(2)}" exceeds ${this.REJECT_MULTIPLIER}x night median (${nightMedian.toFixed(2)}")`);
                }
            } else if (!sub.settledAtStart || sub.guideFailureCount > 0 || rms > nightMedian * this.MARGINAL_MULTIPLIER) {
                sub.tier = 'marginal';
                if (rms > nightMedian * this.MARGINAL_MULTIPLIER) {
                    reasons.push(`RMS ${rms.toFixed(2)}" exceeds ${this.MARGINAL_MULTIPLIER}x night median (${nightMedian.toFixed(2)}")`);
                }
            } else {
                sub.tier = 'clean';
            }
            sub.tierReasons = reasons;
        }
    },

    _median(arr) {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },

    // -------------------------------------------------------------------------
    // Span / metrics / coverage / equipment / timeline
    // -------------------------------------------------------------------------

    _computeSpan(subs) {
        const starts = subs.map(s => s.startedAt).filter(Boolean);
        const ends = subs
            .filter(s => s.startedAt && s.exposureS)
            .map(s => new Date(s.startedAt.getTime() + s.exposureS * 1000));
        if (starts.length === 0) return null;
        return {
            from: new Date(Math.min(...starts.map(d => d.getTime()))),
            to: new Date(Math.max(...ends.map(d => d.getTime()))),
        };
    },

    _computeMetrics(subs, phd2Parsed) {
        // Tiering needs the full sub set (for the night-median calc) before
        // it can run — done here, once, rather than per-sub during the join.
        this._applyTiering(subs);

        const byTier = { clean: 0, marginal: 0, reject: 0, unknown: 0 };
        let totalIntegrationS = 0;

        // guideRmsDuringExposures: frame-weighted RMS pooled only across
        // this night's actual exposure windows (unlike phd2Parsed.overall,
        // which spans every guide session including dead time between
        // subs). Excludes subs whose own RMS clears the critical threshold
        // for the same reason phd2-log-parser.js's overall computation
        // excludes whole critical sessions (#231) — without this, a single
        // guide-star-swap sub dominates the pooled figure. Caught during
        // validation: an earlier version without this exclusion produced
        // 2.80" for 2026-07-23 against the already-validated 0.97" figure.
        let weightedRmsSum = 0;
        let weightedFrameCount = 0;
        const criticalRms = (APP_CONFIG.PHD2_GUIDE_THRESHOLDS && APP_CONFIG.PHD2_GUIDE_THRESHOLDS.RMS_CRITICAL) || 4.0;

        for (const sub of subs) {
            byTier[sub.tier] = (byTier[sub.tier] || 0) + 1;
            if (!sub.aborted && sub.exposureS) totalIntegrationS += sub.exposureS;
            if (sub.guide && sub.guide.rmsTotal !== null && sub.guide.frameCount > 0 &&
                sub.guide.rmsTotal <= criticalRms) {
                weightedRmsSum += sub.guide.rmsTotal * sub.guide.frameCount;
                weightedFrameCount += sub.guide.frameCount;
            }
        }

        return {
            totalSubs: subs.length,
            cleanSubs: byTier.clean,
            marginalSubs: byTier.marginal,
            rejectSubs: byTier.reject,
            unknownSubs: byTier.unknown,
            totalIntegrationS,
            // Headline figure — passthrough of the already-validated,
            // critical-session-excluded PHD2-level computation, not
            // re-derived here. Keeps this number consistent with every
            // other place it's already been validated (threshold-
            // calibration.md, prior issue deliveries) rather than
            // introducing a second, subtly different "night RMS".
            guideRmsSettled: (phd2Parsed && phd2Parsed.overall) ? phd2Parsed.overall.totRms : null,
            guideRmsDuringExposures: weightedFrameCount > 0 ? weightedRmsSum / weightedFrameCount : null,
        };
    },

    _computeCoverage(asiairParsed, phd2Parsed, subs) {
        return {
            asiairPresent: true,
            phd2Present: !!phd2Parsed,
            unmatchedLineCount:
                ((asiairParsed.source && asiairParsed.source.unmatchedLines.length) || 0) +
                ((phd2Parsed && phd2Parsed.source && phd2Parsed.source.unmatchedLines.length) || 0),
            // #235: fixes a latent #234 bug — unaccountedS/wallClockS live
            // on parsed.summary (from _computeSummary), not parsed.wallClock
            // (which only has raw start/end/wallClockS). Optional chaining
            // silently returned null the whole time in #234's delivery;
            // never thrown, never specifically checked.
            unaccountedSeconds: (asiairParsed.summary && asiairParsed.summary.unaccountedS) ?? null,
            subsWithoutGuideData: subs.filter(s => !s.guide || s.guide.frameCount === 0).length,
        };
    },

    // Equipment linkage against Astryx's own telescope/sensor records
    // (design doc §4.3/§9) is deliberately not implemented here — it needs
    // DataManager, an app-integration dependency beyond log parsing, and
    // there's no §9 view yet to show the result. Ships structurally with
    // matchConfidence always 'unmatched' so the shape is stable when real
    // matching lands later. Flagged explicitly, not a silent stub.
    _buildEquipment(phd2Parsed) {
        if (!phd2Parsed || phd2Parsed.sessions.length === 0) return null;
        const eq = phd2Parsed.equipment || {};
        return {
            phd2Camera: eq.cameraModel || null,
            phd2FocalLengthMm: eq.focalLengthMm || null,
            phd2PixelScaleArcsec: eq.pixelScale || null,
            matchedProfile: null,
            matchConfidence: 'unmatched',
        };
    },

    // Lightweight chronological event list — the full "interleaved
    // anomalies" rendering described in design doc §7 is Phase 5's report
    // view; this just exposes something walkable for it to consume rather
    // than re-deriving event ordering itself.
    _buildTimeline(lightRuns, gaps) {
        const entries = [];
        for (const run of lightRuns) {
            for (const event of run.events) {
                const at = event.start || event.at || event.startedAt || event.pauseStartedAt;
                if (at) entries.push({ at, type: event.type, event });
            }
        }
        for (const gap of gaps) {
            if (gap.startedAt) entries.push({ at: gap.startedAt, type: 'log_gap', event: gap });
        }
        entries.sort((a, b) => a.at - b.at);
        return entries;
    },

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionFusion;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
