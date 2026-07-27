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
            this.D3_unsettledStart,
            this.D4_truncatedExposure,
            this.D6_mountDisconnect,
            this.D7_cadenceIrregularity,
            this.D8_elevatedGuiding,
            this.D9_axisRatioInversion,
            this.D14_dropRate,
            this.D15_lockPositionEdge,
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

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionDetectors;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
