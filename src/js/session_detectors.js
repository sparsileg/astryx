/**
 * session-detectors.js
 * D3, D4, D6, D7, D8, D9, D14, D15 — the eight detectors with an existing
 * corpus baseline in threshold-calibration.md. The two detectors needing
 * genuine validation depth (D1 guide-star swap, D2 cloud/transparency) and
 * the one with real exclusion logic (D5 manual intervention) are deliberately
 * split into ELR.p4-2, so this file stays comparison-only.
 *
 * Each detector is (fusedSession, context) => Finding[], reusing the
 * Finding model/factory from session-invariants.js rather than duplicating
 * it. context carries the raw parser outputs some detectors need beyond
 * what fusion retains: { asiairParsed, phd2Parsed }.
 */

const SessionDetectors = {

    // -------------------------------------------------------------------------
    // Orchestration
    // -------------------------------------------------------------------------

    // Appends to fusedSession.findings — additive to whatever invariants
    // already put there (#235), never removes or overwrites them.
    runAll(fusedSession, context) {
        if (fusedSession.kind !== 'science') return [];

        const detectors = [
            this.D1_guideStarSwap,
            this.D2_cloudTransparency,
            this.D3_unsettledStart,
            this.D4_truncatedExposure,
            this.D5_manualIntervention,
            this.D6_mountDisconnect,
            this.D7_cadenceIrregularity,
            this.D8_elevatedGuiding,
            this.D9_axisRatioInversion,
            this.D10_calibrationOutlier,
            this.D11_afHealth,
            this.D12_plateSolveDegradation,
            this.D13_focusDrift,
            this.D14_dropRate,
            this.D15_lockPositionEdge,
            this.D16_guideRecovery,
        ];

        const findings = detectors.flatMap(fn => fn.call(this, fusedSession, context));
        fusedSession.findings.push(...findings);
        return findings;
    },

    // -------------------------------------------------------------------------
    // D3 — Unsettled exposure start
    // -------------------------------------------------------------------------

    // FusedSub.settledAtStart is already resolved by fusion (#234, joining
    // each sub against its run's preceding dither outcome) — this detector
    // is a rate comparison, not new computation. Reuses the settle-failure
    // bands from LOG_ANALYSIS rather than adding D3-specific ones, since
    // "sub started before its dither settled" and "dither failed to
    // terminate cleanly" are the same underlying event viewed from two
    // angles — the design doc's own D3 baseline (1.5% corpus-wide, 8.3% on
    // 2026-07-23) is literally the settle-failure rate reused.
    D3_unsettledStart(fusedSession) {
        const total = fusedSession.subs.length;
        if (total === 0) return [];
        const unsettled = fusedSession.subs.filter(s => !s.settledAtStart);
        const rate = unsettled.length / total;
        const normal = APP_CONFIG.LOG_ANALYSIS.SETTLE_FAILURE_NORMAL_FRACTION;
        const anomalous = APP_CONFIG.LOG_ANALYSIS.SETTLE_FAILURE_ANOMALOUS_FRACTION;

        if (rate <= normal) return [];

        return [SessionInvariants.createFinding({
            code: 'D3_UNSETTLED_START',
            severity: rate > anomalous ? 'warning' : 'info',
            confidence: 'measured',
            title: `${(rate * 100).toFixed(1)}% of subs started before their dither settled`,
            detail: `${unsettled.length} of ${total} subs (corpus baseline: 1.5%, elevated ${(normal * 100).toFixed(0)}%, anomalous ${(anomalous * 100).toFixed(0)}%).`,
            evidence: unsettled.map(s => ({ source: 'computed', value: s.imageNo })),
            affectedSubs: unsettled.map(s => s.imageNo),
        })];
    },

    // -------------------------------------------------------------------------
    // D4 — Truncated exposure
    // -------------------------------------------------------------------------

    // FusedSub.aborted is already resolved by fusion (#234's
    // _flagTruncatedSubs, duration-based per the design doc's D4
    // correction). One finding per truncated sub, carrying duplicateOf as
    // corroborating evidence when present — not the detection criterion.
    D4_truncatedExposure(fusedSession) {
        const truncated = fusedSession.subs.filter(s => s.aborted);
        if (truncated.length === 0) return [];

        return truncated.map(sub => SessionInvariants.createFinding({
            code: 'D4_TRUNCATED_EXPOSURE',
            severity: 'warning',
            confidence: 'measured',
            title: `Image ${sub.imageNo} truncated before its configured exposure elapsed`,
            detail: sub.duplicateOf !== null
                ? `Reissued later in the run as sequence ${sub.duplicateOf} (corroborating, not the detection basis).`
                : 'No later reissue of this image number found in the same run.',
            evidence: [{ source: 'computed', value: sub.imageNo }],
            affectedSubs: [sub.imageNo],
        }));
    },

    // -------------------------------------------------------------------------
    // D6 — Mount disconnect
    // -------------------------------------------------------------------------

    // Reports co-occurrence only — design doc's own constraint: on
    // 2026-07-23 two disconnects fall inside the anomalous block but PHD2
    // continues uninterrupted through both, so attributing causation here
    // would be an unsupported claim.
    D6_mountDisconnect(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const findings = [];

        for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const event of run.events.filter(e => e.type === 'mount' && e.kind === 'disconnected')) {
                if (!event.at) continue;
                const atMs = event.at.getTime();
                const overlapping = fusedSession.subs.filter(s => {
                    if (!s.startedAt || !s.exposureS) return false;
                    const startMs = s.startedAt.getTime();
                    return atMs >= startMs && atMs < startMs + s.exposureS * 1000;
                });

                findings.push(SessionInvariants.createFinding({
                    code: 'D6_MOUNT_DISCONNECT',
                    severity: 'info',
                    confidence: 'measured',
                    title: 'Mount disconnect event',
                    detail: overlapping.length > 0
                        ? `Co-occurred with ${overlapping.length} sub(s) in progress. This is a co-occurrence, not a causal claim — check guiding continuity directly rather than inferring an effect from this alone.`
                        : 'No sub was in progress at this timestamp.',
                    evidence: [{ source: 'asiair', timestamp: event.at }],
                    affectedSubs: overlapping.map(s => s.imageNo),
                    timeRange: { from: event.at, to: event.at },
                }));
            }
        }
        return findings;
    },

    // -------------------------------------------------------------------------
    // D7 — Frame cadence irregularity
    // -------------------------------------------------------------------------

    // Needs raw PHD2 frame intervals per session — not retained by fusion.
    D7_cadenceIrregularity(fusedSession, context) {
        if (!context || !context.phd2Parsed) return [];
        const findings = [];
        const anomalousCount = APP_CONFIG.LOG_ANALYSIS.CADENCE_IRREGULARITY_ANOMALOUS_COUNT;

        for (const session of context.phd2Parsed.sessions) {
            const exposureS = session.equipment.guideExposureMs ? session.equipment.guideExposureMs / 1000 : null;
            if (!exposureS || session.frames.length < 2) continue;

            let irregularCount = 0;
            for (let i = 1; i < session.frames.length; i++) {
                const interval = session.frames[i].t - session.frames[i - 1].t;
                if (interval > exposureS * 1.5) irregularCount++;
            }

            if (irregularCount > anomalousCount) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D7_CADENCE_IRREGULARITY',
                    severity: 'warning',
                    confidence: 'measured',
                    title: `Guide session ${session.num}: ${irregularCount} irregular frame intervals`,
                    detail: `Intervals exceeding 1.5x guide exposure (corpus baseline: 0-6 clean, 59/33 on known-bad sessions). Anomalous threshold: ${anomalousCount}.`,
                    evidence: [{ source: 'phd2', value: irregularCount }],
                    timeRange: { from: session.startTime, to: session.endTime },
                }));
            }
        }
        return findings;
    },

    // -------------------------------------------------------------------------
    // D8 — Elevated guiding
    // -------------------------------------------------------------------------

    D8_elevatedGuiding(fusedSession) {
        const rms = fusedSession.metrics && fusedSession.metrics.guideRmsSettled;
        if (rms === null || rms === undefined) return [];

        const elevated = APP_CONFIG.LOG_ANALYSIS.RMS_ELEVATED_ARCSEC;
        const high = APP_CONFIG.LOG_ANALYSIS.RMS_HIGH_ARCSEC;
        const critical = (APP_CONFIG.PHD2_GUIDE_THRESHOLDS && APP_CONFIG.PHD2_GUIDE_THRESHOLDS.RMS_CRITICAL) || 4.0;

        if (rms <= elevated) return [];

        let severity, band;
        if (rms >= critical) { severity = 'critical'; band = 'critical'; }
        else if (rms >= high) { severity = 'warning'; band = 'high'; }
        else { severity = 'info'; band = 'elevated'; }

        return [SessionInvariants.createFinding({
            code: 'D8_ELEVATED_GUIDING',
            severity,
            confidence: 'measured',
            title: `Settled guide RMS ${rms.toFixed(2)}" (${band})`,
            detail: `Corpus baseline: median 1.12", range 0.89-1.39". Bands: elevated >= ${elevated}", high >= ${high}", critical >= ${critical}".`,
            evidence: [{ source: 'computed', value: rms }],
        })];
    },

    // -------------------------------------------------------------------------
    // D9 — Axis-ratio inversion
    // -------------------------------------------------------------------------

    // Frame-weighted RA/Dec RMS aggregated the same way metrics.
    // guideRmsDuringExposures was in #234: excludes subs whose own RMS
    // clears the critical threshold, so one bad sub doesn't dominate the
    // ratio. Corpus median RA/Dec is 1.38 (RA typically worse, consistent
    // with harmonic-drive periodic error) — a Dec-worse-than-RA night
    // (ratio < 1.0) is itself the anomaly this detector exists to catch.
    D9_axisRatioInversion(fusedSession) {
        const critical = (APP_CONFIG.PHD2_GUIDE_THRESHOLDS && APP_CONFIG.PHD2_GUIDE_THRESHOLDS.RMS_CRITICAL) || 4.0;
        let raSum = 0, decSum = 0, frameCount = 0;

        for (const sub of fusedSession.subs) {
            if (!sub.guide || sub.guide.rmsTotal === null || sub.guide.frameCount === 0) continue;
            if (sub.guide.rmsTotal > critical) continue;
            raSum += sub.guide.rmsRa * sub.guide.frameCount;
            decSum += sub.guide.rmsDec * sub.guide.frameCount;
            frameCount += sub.guide.frameCount;
        }
        if (frameCount === 0 || decSum === 0) return [];

        const raRms = raSum / frameCount;
        const decRms = decSum / frameCount;
        const ratio = raRms / decRms;

        // Fires on ratio < 1.0 — a genuine Dec-worse-than-RA inversion,
        // the specific signal the design doc names as anomalous. The
        // corpus's RA_DEC_RATIO_NORMAL_MIN (1.2) marks the lower edge of
        // the *typical* band, not the firing threshold — a ratio of 1.16
        // or 1.18 (RA only slightly worse than Dec) isn't an inversion and
        // shouldn't fire the same way a true ratio-below-1.0 night does.
        // Caught during validation: an earlier version fired on 2025-11-23
        // (1.16) and 2025-12-20 (1.18), neither of which is Dec-worse-
        // than-RA.
        if (ratio >= 1.0) return [];

        return [SessionInvariants.createFinding({
            code: 'D9_AXIS_RATIO_INVERSION',
            severity: 'info',
            confidence: 'measured',
            title: `Dec RMS (${decRms.toFixed(2)}") exceeds RA RMS (${raRms.toFixed(2)}") — ratio ${ratio.toFixed(2)}`,
            detail: `Corpus median RA/Dec ratio is 1.38 (RA typically worse, consistent with harmonic-drive periodic error). A ratio below 1.0 is unusual for this rig.`,
            evidence: [{ source: 'computed', value: ratio }],
        })];
    },

    // -------------------------------------------------------------------------
    // D14 — Dropped-frame rate
    // -------------------------------------------------------------------------

    D14_dropRate(fusedSession, context) {
        if (!context || !context.phd2Parsed) return [];
        let totalFrames = 0, totalDrops = 0;
        for (const session of context.phd2Parsed.sessions) {
            totalFrames += session.frames.length + session.drops.length;
            totalDrops += session.drops.length;
        }
        if (totalFrames === 0) return [];

        const rate = totalDrops / totalFrames;
        const elevated = APP_CONFIG.LOG_ANALYSIS.PHD2_DROP_RATE_ELEVATED_FRACTION;
        const anomalous = APP_CONFIG.LOG_ANALYSIS.PHD2_DROP_RATE_ANOMALOUS_FRACTION;
        if (rate <= elevated) return [];

        return [SessionInvariants.createFinding({
            code: 'D14_DROP_RATE',
            severity: rate > anomalous ? 'warning' : 'info',
            confidence: 'measured',
            title: `PHD2 drop rate ${(rate * 100).toFixed(2)}% (${totalDrops}/${totalFrames} frames)`,
            detail: `Corpus baseline: 1.18% overall, 0-17.7% per night. Elevated >= ${(elevated * 100).toFixed(1)}%, anomalous >= ${(anomalous * 100).toFixed(0)}%.`,
            evidence: [{ source: 'phd2', value: rate }],
        })];
    },

    // -------------------------------------------------------------------------
    // D15 — Guide star near frame edge
    // -------------------------------------------------------------------------

    // The corpus-wide edge-distance distribution the design doc calls for
    // before this can graduate beyond a bare stub — gathered here, not
    // deferred further: 511 sessions, min 17px, p5 54px, p10 64px, p25
    // 92px, median 155px. 100px (between the corpus p5 and p10, close to
    // the design doc's own reference point of 105px — where both D1
    // guide-star-swap sessions locked) is used as the flag distance. Still
    // ships at info severity unconditionally per the design doc's explicit
    // instruction — this is a first real threshold with evidence behind
    // it, not a claim the distribution work is finished.
    EDGE_DISTANCE_FLAG_PX: 100,

    D15_lockPositionEdge(fusedSession, context) {
        if (!context || !context.phd2Parsed) return [];
        const findings = [];

        for (const session of context.phd2Parsed.sessions) {
            const geo = session.geometry;
            if (!geo || !geo.lockPosition || !geo.frameSize) continue;
            const { x, y } = geo.lockPosition;
            const { w, h } = geo.frameSize;
            const edgeDistance = Math.min(x, y, w - x, h - y);

            if (edgeDistance < this.EDGE_DISTANCE_FLAG_PX) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D15_LOCK_POSITION_EDGE',
                    severity: 'info',
                    confidence: 'measured',
                    title: `Guide session ${session.num}: lock position ${edgeDistance.toFixed(0)}px from frame edge`,
                    detail: `Corpus distribution (511 sessions): p5 54px, p10 64px, p25 92px, median 155px. Flagged below ${this.EDGE_DISTANCE_FLAG_PX}px.`,
                    evidence: [{ source: 'phd2', value: edgeDistance }],
                    timeRange: { from: session.startTime, to: session.endTime },
                }));
            }
        }
        return findings;
    },

    // -------------------------------------------------------------------------
    // D2 — Cloud / transparency loss (ELR.p4-2)
    // -------------------------------------------------------------------------

    // Primary signature: guide-failure event density >= 3 per 300s window,
    // excluding the acquisition phase before the first successful settle
    // in each run. Corroborating signature: a focuser cooling-rate
    // reversal between consecutive AF events overlapping the flagged
    // window. Explicitly does NOT use guide-star mass as a gradual
    // transparency signal anywhere — tested and confirmed not to work
    // (mass stays flat at 91-97% of a lock's peak straight through known
    // cloud, and is incomparable across re-selections). Cloud is binary in
    // the guide log, not gradual.
    D2_cloudTransparency(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const findings = [];
        const windowMs = 300 * 1000;
        const minCount = 3;

        for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
            // Acquisition-phase cutoff: first successfully settled dither
            // in this run. Failures before it are normal acquisition
            // noise, not a transparency signal.
            const firstGoodDither = run.events
                .filter(e => e.type === 'dither' && e.outcome === 'done')
                .sort((a, b) => a.start - b.start)[0];
            const cutoff = firstGoodDither ? firstGoodDither.start : run.startedAt;

            const failures = run.events
                .filter(e => e.type === 'guide_failure' && e.at && (!cutoff || e.at >= cutoff))
                .map(e => e.at)
                .sort((a, b) => a - b);

            const intervals = this._findDensityWindows(failures, windowMs, minCount);
            if (intervals.length === 0) continue;

            const allSubs = run.blocks.flatMap(b => b.subs);
            const afEvents = run.events.filter(e => e.type === 'autofocus' && e.temperatureC !== null)
                .sort((a, b) => a.start - b.start);

            for (const [from, to] of intervals) {
                const affectedSubs = allSubs.filter(s => {
                    if (!s.startedAt || !s.exposureS) return false;
                    const subEnd = new Date(s.startedAt.getTime() + s.exposureS * 1000);
                    return s.startedAt <= to && subEnd >= from;
                });

                const corroboration = this._findCoolingReversal(afEvents, from, to);

                findings.push(SessionInvariants.createFinding({
                    code: 'D2_CLOUD_TRANSPARENCY',
                    severity: corroboration ? 'warning' : 'info',
                    confidence: corroboration ? 'derived' : 'inferred',
                    title: `Guide-failure density spike, images ${affectedSubs.length ? affectedSubs[0].imageNo : '?'}-${affectedSubs.length ? affectedSubs[affectedSubs.length - 1].imageNo : '?'}`,
                    detail: corroboration
                        ? `Guide-failure density >= 3 per 5min window, corroborated by a focuser temperature rise (${corroboration}) — backwards for clear-sky cooling.`
                        : `Guide-failure density >= 3 per 5min window. No corroborating temperature reversal found nearby — consistent with cloud, but not independently confirmed.`,
                    evidence: [{ source: 'asiair', timestamp: from }, { source: 'asiair', timestamp: to }],
                    affectedSubs: affectedSubs.map(s => s.imageNo),
                    timeRange: { from, to },
                    ruledOut: [{
                        hypothesis: 'gradual transparency loss via guide-star mass',
                        discriminator: 'guide-star mass tracked through known cloud in validation',
                        observed: 'mass stays flat at 91-97% of lock peak through cloud — not used as a signal here',
                    }],
                }));
            }
        }
        return findings;
    },

    // Sliding window over sorted timestamps; merges intervals separated by
    // less than one window width into a single contiguous band (this is
    // what produces two separate bands on a night with two distinct
    // disturbances, e.g. 2025-12-20's 12-17 and 51-58, rather than one
    // band spanning the whole night).
    _findDensityWindows(timestamps, windowMs, minCount) {
        if (timestamps.length < minCount) return [];
        const flagged = [];
        let windowStart = 0;
        for (let i = 0; i < timestamps.length; i++) {
            while (timestamps[i] - timestamps[windowStart] > windowMs) windowStart++;
            if (i - windowStart + 1 >= minCount) {
                flagged.push([timestamps[windowStart], timestamps[i]]);
            }
        }
        if (flagged.length === 0) return [];

        const merged = [flagged[0]];
        for (let i = 1; i < flagged.length; i++) {
            const last = merged[merged.length - 1];
            if (flagged[i][0] - last[1] <= windowMs) {
                last[1] = flagged[i][1] > last[1] ? flagged[i][1] : last[1];
            } else {
                merged.push(flagged[i]);
            }
        }
        return merged;
    },

    // Looks for two consecutive AF events near the flagged window where
    // temperatureC rises rather than falls — backwards for typical
    // overnight clear-sky cooling, and corroborates (doesn't require) the
    // density signal.
    _findCoolingReversal(afEvents, from, to) {
        const bufferMs = 30 * 60 * 1000; // AF cadence is roughly hourly; look a bit either side
        const nearby = afEvents.filter(e => e.start >= from.getTime() - bufferMs && e.start <= to.getTime() + bufferMs);
        for (let i = 1; i < nearby.length; i++) {
            const delta = nearby[i].temperatureC - nearby[i - 1].temperatureC;
            if (delta > 0) {
                return `${nearby[i - 1].temperatureC}°C → ${nearby[i].temperatureC}°C`;
            }
        }
        return null;
    },

    // -------------------------------------------------------------------------
    // D5 — Manual intervention (ELR.p4-2)
    // -------------------------------------------------------------------------

    // Manual autorun stops, cancelled AF, paused Plan Tonight groups, and
    // Log disabled/enabled gaps. Required exclusion: a manual stop on a
    // flat-kind run immediately followed by another flat-kind run at a
    // different exposure is exposure tuning, not an incident — verified
    // against 2026-06-15's raw structure (3 flat runs ending in
    // manualStop, each followed by another flat run at a different
    // exposureS, before the sequence finishes normally).
    D5_manualIntervention(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const findings = [];
        const runs = context.asiairParsed.runs;

        for (let i = 0; i < runs.length; i++) {
            const run = runs[i];
            for (const event of run.events.filter(e => e.type === 'intervention')) {
                if (event.kind === 'manualStop') {
                    const nextRun = runs[i + 1];
                    const isFlatTuning = run.kind === 'flat' && nextRun && nextRun.kind === 'flat' &&
                        nextRun.exposureS !== run.exposureS;
                    if (isFlatTuning) continue;
                }

                findings.push(SessionInvariants.createFinding({
                    code: 'D5_MANUAL_INTERVENTION',
                    severity: 'info',
                    confidence: 'measured',
                    title: `${event.kind === 'manualStop' ? 'Manual autorun stop' : 'Autofocus cancelled manually'} — run ${run.index} (${run.target})`,
                    detail: `At ${event.at ? event.at.toISOString() : 'unknown time'}.`,
                    evidence: [{ source: 'asiair', timestamp: event.at }],
                    timeRange: event.at ? { from: event.at, to: event.at } : null,
                }));
            }
        }

        for (const plan of context.asiairParsed.plans || []) {
            if (plan.outcome === 'paused') {
                findings.push(SessionInvariants.createFinding({
                    code: 'D5_MANUAL_INTERVENTION',
                    severity: 'info',
                    confidence: 'measured',
                    title: 'Plan Tonight paused',
                    detail: `Paused at ${plan.endedAt ? plan.endedAt.toISOString() : 'unknown time'}.`,
                    evidence: [{ source: 'asiair', timestamp: plan.endedAt }],
                    timeRange: { from: plan.startedAt, to: plan.endedAt },
                }));
            }
        }

        for (const gap of context.asiairParsed.gaps || []) {
            findings.push(SessionInvariants.createFinding({
                code: 'D5_MANUAL_INTERVENTION',
                severity: 'info',
                confidence: 'measured',
                title: `Log gap (${gap.durationS.toFixed(0)}s)`,
                detail: `Log disabled ${gap.startedAt.toISOString()} to ${gap.endedAt.toISOString()}.`,
                evidence: [{ source: 'asiair', value: gap.durationS }],
                timeRange: { from: gap.startedAt, to: gap.endedAt },
            }));
        }

        return findings;
    },

    // -------------------------------------------------------------------------
    // D1 — Guide-star swap (ELR.p4-2)
    // -------------------------------------------------------------------------

    // Signature (design doc §6): >=5 frames with star mass < 85% of session
    // median AND displacement > 8px, where the coefficient of variation of
    // those displacements is < 0.15. Already proven across all 511 guide
    // sessions in the corpus at 0 false positives — this issue reproduces
    // that formula exactly, not a new derivation.
    //
    // Operates on raw PHD2 frame data (context.phd2Parsed) — star mass and
    // displacement are per-frame fields fusion doesn't carry into FusedSub.
    // frame.total (raw px displacement) was already computed by the parser
    // for RMS purposes; starMass needed adding to Mount-row frames (#237 —
    // it was only captured on DROP rows before this issue).
    D1_guideStarSwap(fusedSession, context) {
        if (!context || !context.phd2Parsed) return [];
        const findings = [];
        const cvMax = APP_CONFIG.LOG_ANALYSIS.STAR_SWAP_DISPLACEMENT_CV_MAX;

        for (const session of context.phd2Parsed.sessions) {
            const validFrames = session.frames.filter(f => Number.isFinite(f.starMass) && f.starMass > 0);
            if (validFrames.length === 0) continue;

            const masses = validFrames.map(f => f.starMass).sort((a, b) => a - b);
            const mid = Math.floor(masses.length / 2);
            const median = masses.length % 2 ? masses[mid] : (masses[mid - 1] + masses[mid]) / 2;

            const flagged = validFrames.filter(f => f.starMass < median * 0.85 && f.total > 8);
            if (flagged.length < 5) continue;

            const displacements = flagged.map(f => f.total);
            const mean = displacements.reduce((s, v) => s + v, 0) / displacements.length;
            const variance = displacements.reduce((s, v) => s + (v - mean) ** 2, 0) / displacements.length;
            const cv = mean > 0 ? Math.sqrt(variance) / mean : Infinity;

            if (cv < cvMax) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D1_GUIDE_STAR_SWAP',
                    severity: 'warning',
                    confidence: 'derived',
                    title: `Guide session ${session.num}: likely guide-star swap (${flagged.length} frames)`,
                    detail: `Mean displacement ${mean.toFixed(1)}px, CV ${cv.toFixed(3)} (threshold < ${cvMax}). A fixed/repeated displacement indicates an alternating reference star; a genuine mechanical excursion produces scattered displacements instead.`,
                    evidence: flagged.map(f => ({ source: 'phd2', value: f.total })),
                    ruledOut: [{
                        hypothesis: 'mechanical excursion (drag, calibration error, wind, comms fault)',
                        discriminator: 'coefficient of variation of displacement',
                        observed: `CV ${cv.toFixed(3)} — too consistent for a scattered mechanical cause`,
                    }],
                    timeRange: { from: session.startTime, to: session.endTime },
                }));
            }
        }
        return findings;
    },

    // -------------------------------------------------------------------------
    // D11 — Autofocus health (ELR.p4-3)
    // -------------------------------------------------------------------------

    // Failure rate, duration outliers, and a within-night star-size trend.
    // Corpus baseline: 95.6% success, median 109s (n=225, threshold-
    // calibration.md §5).
    D11_afHealth(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const afEvents = context.asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'autofocus');
        if (afEvents.length === 0) return [];
        const findings = [];

        const failed = afEvents.filter(e => e.outcome === 'failed');
        const failureRate = failed.length / afEvents.length;
        const failureElevated = APP_CONFIG.LOG_ANALYSIS.AF_FAILURE_ELEVATED_FRACTION;
        if (failureRate > failureElevated) {
            findings.push(SessionInvariants.createFinding({
                code: 'D11_AF_FAILURE_RATE',
                severity: 'warning',
                confidence: 'measured',
                title: `AF failure rate ${(failureRate * 100).toFixed(0)}% (${failed.length}/${afEvents.length}) — above the corpus baseline`,
                detail: `Corpus baseline: 95.6% success across 225 events. A rate this high on one night is usually the focuser struggling to find a usable star (too faint, dew, or field crowding) rather than random chance — worth a look at what conditions coincided with these attempts.`,
                evidence: failed.map(e => ({ source: 'asiair', timestamp: e.start })),
            }));
        }

        const typical = APP_CONFIG.LOG_ANALYSIS.AF_DURATION_TYPICAL_S;
        const outliers = afEvents.filter(e => e.outcome === 'success' && e.durationS && e.durationS > typical * 1.5);
        if (outliers.length > 0) {
            findings.push(SessionInvariants.createFinding({
                code: 'D11_AF_DURATION_OUTLIER',
                severity: 'info',
                confidence: 'measured',
                title: `${outliers.length} AF cycle(s) took over 1.5x the typical ${typical}s`,
                detail: `Corpus median is ${typical}s. Slower cycles usually trace back to the AF star itself (faint, or a rough V-curve) rather than the focuser mechanism.`,
                evidence: outliers.map(e => ({ source: 'asiair', value: e.durationS })),
            }));
        }

        const successful = afEvents.filter(e => e.outcome === 'success' && e.achievedStarSize !== null)
            .sort((a, b) => a.start - b.start);
        if (successful.length >= 3) {
            const sizes = successful.map(e => e.achievedStarSize);
            const third = Math.max(1, Math.floor(sizes.length / 3));
            const firstAvg = sizes.slice(0, third).reduce((s, v) => s + v, 0) / third;
            const lastAvg = sizes.slice(-third).reduce((s, v) => s + v, 0) / third;
            if (lastAvg > firstAvg * 1.3) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D11_STAR_SIZE_TREND',
                    severity: 'info',
                    confidence: 'inferred',
                    title: `Achieved AF star size grew from ${firstAvg.toFixed(1)} to ${lastAvg.toFixed(1)} across the night`,
                    detail: `A worsening trend across successive AF cycles, despite each one refocusing, usually points at temperature-compensation lagging the real slope (see D13 for tonight's figure) or dew forming — worth checking together.`,
                    evidence: successful.map(e => ({ source: 'asiair', value: e.achievedStarSize })),
                }));
            }
        }

        return findings;
    },

    // -------------------------------------------------------------------------
    // D13 — Focus drift regression (ELR.p4-3)
    // -------------------------------------------------------------------------

    // Per-night linear regression of focuser position on temperature —
    // reported per night, not baked in as a fixed corpus constant, since a
    // coefficient *change* across nights would itself indicate a
    // mechanical shift in the focuser train worth checking physically.
    // Corpus reference (one night, thin evidence): -20.2 steps/°C,
    // r²=0.975 (2026-07-23).
    D13_focusDrift(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const afEvents = context.asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events)
            .filter(e => e.type === 'autofocus' && e.outcome === 'success' && e.temperatureC !== null && e.focuserPosition !== null);

        const minPoints = 5;
        if (afEvents.length < minPoints) {
            return [SessionInvariants.createFinding({
                code: 'D13_FOCUS_DRIFT_INSUFFICIENT_DATA',
                severity: 'info',
                confidence: 'measured',
                title: `Only ${afEvents.length} usable AF event(s) tonight — not enough to regress a focus/temperature trend`,
                detail: `Need at least ${minPoints} successful AF cycles with temperature readings for a meaningful fit. No coefficient reported rather than one derived from too little data.`,
                evidence: [],
            })];
        }

        const temps = afEvents.map(e => e.temperatureC);
        const positions = afEvents.map(e => e.focuserPosition);
        const n = temps.length;
        const meanT = temps.reduce((s, v) => s + v, 0) / n;
        const meanP = positions.reduce((s, v) => s + v, 0) / n;
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
            num += (temps[i] - meanT) * (positions[i] - meanP);
            den += (temps[i] - meanT) ** 2;
        }
        if (den === 0) return [];
        const coefficient = num / den;
        const intercept = meanP - coefficient * meanT;

        let ssTot = 0, ssRes = 0;
        const residuals = [];
        for (let i = 0; i < n; i++) {
            const predicted = coefficient * temps[i] + intercept;
            const residual = positions[i] - predicted;
            residuals.push(residual);
            ssRes += residual ** 2;
            ssTot += (positions[i] - meanP) ** 2;
        }
        const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : null;
        const maxResidual = Math.max(...residuals.map(Math.abs));
        const meanAbsResidual = residuals.reduce((s, v) => s + Math.abs(v), 0) / n;

        return [SessionInvariants.createFinding({
            code: 'D13_FOCUS_DRIFT',
            severity: 'info',
            confidence: (r2 !== null && r2 > 0.8) ? 'derived' : 'inferred',
            title: `Focus/temperature coefficient tonight: ${coefficient.toFixed(1)} steps/°C (r²=${r2 !== null ? r2.toFixed(3) : 'n/a'}, n=${n})`,
            detail: `Corpus reference (2026-07-23, one night): -20.2 steps/°C, r²=0.975, max residual ±6.4 steps. Tonight's fit: mean |residual| ${meanAbsResidual.toFixed(1)} steps, max ${maxResidual.toFixed(1)} steps — how far any single AF cycle sat from what the line predicts, a rough read on how tightly focus is actually tracking temperature versus other noise (seeing, star selection) that night. Comparing the coefficient itself night to night over time (not something a single night's detector can do on its own) is what would actually reveal a mechanical shift in the focuser train — a change worth a physical look, not a software adjustment.`,
            evidence: afEvents.map((e, i) => ({ source: 'asiair', value: e.focuserPosition, residual: residuals[i] })),
        })];
    },

    // -------------------------------------------------------------------------
    // D10 — Calibration outlier (ELR.p4-3, unvalidated — ships info-only)
    // -------------------------------------------------------------------------

    // Reports each night's calibrations relative to each other — rate
    // spread and orthogonality error — as descriptive context rather than
    // a fixed pass/fail threshold. Same-night rate deviation varies
    // enormously across the corpus (0.4% to 63%) and a lot of that spread
    // is legitimate: a multi-target Plan Tonight night recalibrating at
    // very different declinations is expected to show bigger swings than
    // repeated calibrations on the same target. Distinguishing "expected
    // because the target changed" from "suspicious for the same target"
    // isn't attempted here — flagged as unvalidated per the design doc,
    // reported at info so the person can apply their own knowledge of
    // what happened that night.
    D10_calibrationOutlier(fusedSession, context) {
        if (!context || !context.phd2Parsed || context.phd2Parsed.calibrations.length === 0) return [];
        const cals = context.phd2Parsed.calibrations.filter(c => c.west.ratePxPerSec !== null);
        const findings = [];

        if (cals.length > 1) {
            const rates = cals.map(c => c.west.ratePxPerSec);
            const sorted = [...rates].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            const maxDev = Math.max(...rates.map(r => Math.abs(r - median) / median));

            findings.push(SessionInvariants.createFinding({
                code: 'D10_CALIBRATION_RATE_SPREAD',
                severity: 'info',
                confidence: 'measured',
                title: `${cals.length} calibrations tonight, rate ${sorted[0].toFixed(3)}-${sorted[sorted.length - 1].toFixed(3)} px/sec (${(maxDev * 100).toFixed(0)}% max spread from median)`,
                detail: `Context, not a verdict: a wide spread across calibrations aimed at different targets/declinations is often just the mount's real rate at each pointing. A wide spread between calibrations on the *same* target is the more worth checking case — cable snag, clutch slip, or balance shift — but this detector doesn't yet distinguish the two.`,
                evidence: cals.map(c => ({ source: 'phd2', timestamp: c.startedAt, value: c.west.ratePxPerSec })),
            }));
        }

        for (const cal of context.phd2Parsed.calibrations) {
            if (cal.starLostDuringCalibration > 0) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D10_STAR_LOST_DURING_CALIBRATION',
                    severity: 'info',
                    confidence: 'measured',
                    title: `Calibration starting ${cal.startedAt}: ${cal.starLostDuringCalibration} star-lost event(s) during the calibration itself`,
                    detail: `Rare in this corpus (one prior occurrence, 86 events on 2026-05-11). Usually means the calibration star was too faint or low, or conditions were already poor before imaging even began that night.`,
                    evidence: [{ source: 'phd2', value: cal.starLostDuringCalibration }],
                }));
            }
            if (cal.orthogonalityErrorDeg !== null && Math.abs(cal.orthogonalityErrorDeg) > 3.5) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D10_ORTHOGONALITY_OUTLIER',
                    severity: 'info',
                    confidence: 'measured',
                    title: `Calibration starting ${cal.startedAt}: orthogonality error ${cal.orthogonalityErrorDeg.toFixed(2)}°`,
                    detail: `Corpus range across 44 calibrations: -3.40° to 2.40°. A value clearly outside that range is worth a second look at polar alignment or cone error if it persists across nights.`,
                    evidence: [{ source: 'phd2', value: cal.orthogonalityErrorDeg }],
                }));
            }
        }

        return findings;
    },

    // -------------------------------------------------------------------------
    // D12 — Plate-solve degradation (ELR.p4-3, unvalidated — ships info-only)
    // -------------------------------------------------------------------------

    // Repeated non-centered/failed solve outcomes, plus a starNumber trend
    // across the night — the design doc's own note that starNumber is the
    // only genuine transparency measurement in either log, but written
    // only a handful of times per night, so this is a coarse sanity check,
    // not a per-sub metric.
    D12_plateSolveDegradation(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const findings = [];
        const solves = context.asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'plate_solve')
            .sort((a, b) => a.at - b.at);
        if (solves.length === 0) return [];

        const degraded = solves.filter(e => e.outcome === 'tooFar' || e.outcome === 'mountSlewFailed' || e.outcome === 'solveFailed');
        if (degraded.length >= 3) {
            findings.push(SessionInvariants.createFinding({
                code: 'D12_PLATE_SOLVE_DEGRADED',
                severity: 'info',
                confidence: 'measured',
                title: `${degraded.length} of ${solves.length} plate-solve attempts tonight were not a clean center (${degraded.map(e => e.outcome).join(', ')})`,
                detail: `Repeated pointing/solve trouble in one night is worth a look at the pointing model, or the target's field density if it's a sparse-star area — not necessarily an equipment fault on its own.`,
                evidence: degraded.map(e => ({ source: 'asiair', timestamp: e.at, value: e.outcome })),
            }));
        }

        const withStarNumber = solves.filter(e => e.starNumber !== null);
        if (withStarNumber.length >= 3) {
            const first = withStarNumber[0].starNumber;
            const last = withStarNumber[withStarNumber.length - 1].starNumber;
            if (last < first * 0.6) {
                findings.push(SessionInvariants.createFinding({
                    code: 'D12_STAR_NUMBER_DECLINE',
                    severity: 'info',
                    confidence: 'inferred',
                    title: `Plate-solve star count fell from ${first} to ${last} across the night`,
                    detail: `Star number is the only real transparency signal in either log, but it's only written a handful of times a night — a coarse read, not a per-sub metric. If this doesn't coincide with a D2 cloud finding, focus drift is worth checking instead, since a soft solve frame also detects fewer stars.`,
                    evidence: withStarNumber.map(e => ({ source: 'asiair', timestamp: e.at, value: e.starNumber })),
                }));
            }
        }

        return findings;
    },

    // -------------------------------------------------------------------------
    // D16 — Mid-imaging guide recovery (ELR.p4-3, candidate)
    // -------------------------------------------------------------------------

    // Own Finding, not folded into D2 or D7 — see design doc's D16 entry
    // for the reasoning (recurring star-lost-and-reselect cycling points
    // at guide-star selection/search-region sizing, a different root
    // cause than transparency or hardware cadence gaps).
    D16_guideRecovery(fusedSession, context) {
        if (!context || !context.asiairParsed) return [];
        const findings = [];

        for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
            const recoveries = run.events.filter(e => e.type === 'guide_recovery');
            if (recoveries.length === 0) continue;

            const totalS = recoveries.reduce((s, e) => s + (e.durationS || 0), 0);
            const affectedImg = [...new Set(recoveries.map(e => e.affectedImg).filter(Boolean))];

            findings.push(SessionInvariants.createFinding({
                code: 'D16_GUIDE_RECOVERY',
                severity: 'info', // candidate/unvalidated per design doc — info regardless of frequency
                confidence: 'inferred',
                title: `${recoveries.length} mid-imaging guide-recovery cycle(s), run ${run.index} (${run.target}), ${(totalS / 60).toFixed(1)} min total`,
                detail: `A recurring lost-star/reselect/resume pattern during imaging, distinct from dither/AF/calibration settling. Frequent recovery cycling is usually about the guide star itself (faint, or near the search-region edge) rather than the mount or transparency — worth a look at search region and star-mass-tolerance settings if this recurs on future nights, independent of weather.`,
                evidence: recoveries.map(e => ({ source: 'asiair', timestamp: e.startedAt, value: e.outcome })),
                affectedSubs: affectedImg,
            }));
        }

        return findings;
    },

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionDetectors;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
