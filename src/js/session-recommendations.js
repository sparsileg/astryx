/**
 * session-recommendations.js
 * Turns a night's FusedSession + raw parser data into Recommendation[]
 * (design doc §8): four groups (Astryx settings, ASIAir config, PHD2
 * config, Process/hardware), each entry carrying observed, recommended,
 * evidence, confidence, and expected impact — including "no change
 * needed" recommendations, which are still produced, not omitted.
 *
 * Two groups' example items are deliberately NOT implemented here, per
 * direct instruction: cable routing and flat exposure. A few other items
 * (AF Interval, Frames per Dither) are skipped for a different reason —
 * neither the ASIAir log nor the PHD2 log records the *configured* value
 * anywhere, only trigger/outcome per event, so there's nothing to copy
 * without fabricating it. Flip Pause is a partial implementation — see
 * that section's own comment for why the full geometric derivation
 * wasn't attempted blind.
 */

const SessionRecommendations = {

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    build(fs, context) {
        if (!fs || fs.kind !== 'science') return [];
        const recs = [];
        recs.push(...this._buildAstryxSettings(fs, context));
        recs.push(...this._buildAsiairConfig(fs, context));
        recs.push(...this._buildPhd2Config(fs, context));
        recs.push(...this._buildProcessHardware(fs, context));
        return recs;
    },

    _makeRec({ group, setting, observed, recommended, changeNeeded, evidence, confidence, expectedImpact }) {
        return { group, setting, observed, recommended, changeNeeded, evidence, confidence, expectedImpact };
    },

    // -------------------------------------------------------------------------
    // Group 1 — Astryx settings (measured performance, or copied for the
    // one hybrid item)
    // -------------------------------------------------------------------------

    // Sub Gap, Dither Duration: computed from CLEAN BLOCKS ONLY, per the
    // design doc's own rule — a sample is only used if every sub involved
    // has tier === 'clean' (fusion's own tiering already encodes "not
    // aborted, settled, no guide failures, RMS within normal band," so
    // it's the right existing signal to gate on rather than re-deriving a
    // separate cleanliness check). AF/Cal/Flip Duration are direct event-
    // duration measurements, gated by their own outcome === success
    // already, not by surrounding sub tier — those aren't "from a block"
    // the way sub-gap/dither timing is.
    _buildAstryxSettings(fs, context) {
        const recs = [];
        if (!context || !context.asiairParsed) return recs;
        const asiairParsed = context.asiairParsed;

        recs.push(this._subGapRec(fs, asiairParsed));
        recs.push(this._ditherDurationRec(fs, asiairParsed));
        recs.push(this._afDurationRec(asiairParsed));
        recs.push(this._calDurationRec(asiairParsed));
        recs.push(this._flipDurationRec(asiairParsed));
        recs.push(this._flipPauseRec(asiairParsed));

        return recs.filter(Boolean);
    },

    // Excludes any consecutive-sub pair with a dither between them — a
    // dithered gap includes the dither's own settle time, and blending
    // that into "sub gap" inflates the figure (caught in validation: an
    // earlier version mixed both together and produced ~22s, close to
    // config.js's SUB_CYCLE_OVERHEAD_S baseline which is itself a dither-
    // inclusive figure, not pure sub gap — the wrong thing to compare
    // against the stored per-sub value). Mirrors the legacy pipeline's own
    // cleanGaps/ditheredGaps separation (asiair-log-parser.js
    // _computeRecommendations), including its dither-every-frame fallback
    // (subtract mean dither duration from the dithered-gap samples) — also
    // caught in validation: without the fallback, a rig configured to
    // dither on every sub (this one, most nights) produces zero non-
    // dithered samples and the recommendation goes empty, while legacy
    // still produces a figure via exactly this subtraction.
    _subGapRec(fs, asiairParsed) {
        const cleanGaps = [];
        const ditheredGaps = [];
        const ditherDurations = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            const dithers = run.events.filter(e => e.type === 'dither' && e.start && e.end);
            for (const block of run.blocks) {
                for (let i = 0; i < block.subs.length - 1; i++) {
                    const a = block.subs[i], b = block.subs[i + 1];
                    if (!a.startedAt || !a.exposureS || !b.startedAt) continue;
                    const aClean = this._subTierByImageNo(fs, a.imageNo) === 'clean';
                    const bClean = this._subTierByImageNo(fs, b.imageNo) === 'clean';
                    if (!aClean || !bClean) continue;

                    const windowStart = new Date(a.startedAt.getTime() + a.exposureS * 1000);
                    const windowEnd = b.startedAt;
                    const gapS = (windowEnd.getTime() - windowStart.getTime()) / 1000;
                    if (gapS < 0 || gapS >= 90) continue;

                    const ditherInWindow = dithers.find(d => d.start >= windowStart && d.start < windowEnd && d.outcome === 'done');
                    if (ditherInWindow) {
                        ditheredGaps.push(gapS);
                        ditherDurations.push(ditherInWindow.durationS);
                    } else if (!dithers.some(d => d.start >= windowStart && d.start < windowEnd)) {
                        // no dither at all in this window (clean or otherwise)
                        cleanGaps.push(gapS);
                    }
                    // a non-'done' dither in this window is excluded from both buckets
                }
            }
        }

        const stored = (typeof SettingsManager !== 'undefined') ? SettingsManager.getLearnedSubGapS() : null;
        let mean, n, note;
        if (cleanGaps.length > 0) {
            mean = cleanGaps.reduce((s, v) => s + v, 0) / cleanGaps.length;
            n = cleanGaps.length;
            note = 'clean blocks, no dither between';
        } else if (ditheredGaps.length > 0) {
            const avgDitheredGap = ditheredGaps.reduce((s, v) => s + v, 0) / ditheredGaps.length;
            const avgDither = ditherDurations.reduce((s, v) => s + v, 0) / ditherDurations.length;
            mean = Math.max(0, avgDitheredGap - avgDither);
            n = ditheredGaps.length;
            note = 'clean blocks, dither-every-sub — isolated by subtracting mean dither duration';
        } else {
            return this._makeRec({
                group: 'astryx', setting: 'Sub Gap',
                observed: 'no clean-block samples this session', recommended: 'no change', changeNeeded: false,
                evidence: 'Every consecutive sub pair this session involved at least one non-clean sub.',
                confidence: 'measured', expectedImpact: 'none',
            });
        }

        const changeNeeded = stored != null && Math.abs(mean - stored) > 1;
        return this._makeRec({
            group: 'astryx', setting: 'Sub Gap',
            observed: `${mean.toFixed(1)}s (n=${n}, ${note})`,
            recommended: stored != null ? `${stored}s stored` : `${mean.toFixed(1)}s`,
            changeNeeded,
            evidence: `Mean sub-to-sub gap from clean blocks only, ${n} sample(s) (${note}).`,
            confidence: 'measured',
            expectedImpact: changeNeeded ? 'Sequence-plan time estimates for this rig drift by roughly the difference per sub, compounding over a full night.' : 'none — stored value already tracks this session\'s behavior',
        });
    },

    _ditherDurationRec(fs, asiairParsed) {
        const samples = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            const dithers = run.events.filter(e => e.type === 'dither' && e.outcome === 'done' && e.durationS != null);
            const runSubs = fs.subs.filter(s => s.target === run.target).sort((a, b) => a.sequenceNo - b.sequenceNo);
            for (const d of dithers) {
                // affectedImg is only populated for non-'done' outcomes
                // (asiair-log-parser.js) — for a clean dither, identify the
                // following sub by time proximity instead: the earliest sub
                // starting at or after the dither's settle end.
                const next = runSubs.find(s => s.startedAt && s.startedAt.getTime() >= d.end.getTime());
                if (next && next.tier === 'clean') samples.push(d.durationS);
            }
        }
        if (samples.length === 0) {
            return this._makeRec({
                group: 'astryx', setting: 'Dither Duration',
                observed: 'no clean-block samples this session', recommended: 'no change', changeNeeded: false,
                evidence: 'No dither this session both settled cleanly and was immediately followed by a clean sub.',
                confidence: 'measured', expectedImpact: 'none',
            });
        }
        const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
        const stored = (typeof SettingsManager !== 'undefined') ? SettingsManager.getLearnedDitherDurationS() : null;
        const changeNeeded = stored != null && Math.abs(mean - stored) > 3;
        return this._makeRec({
            group: 'astryx', setting: 'Dither Duration',
            observed: `${mean.toFixed(1)}s (n=${samples.length}, clean blocks only)`,
            recommended: stored != null ? `${stored}s stored` : `${mean.toFixed(1)}s`,
            changeNeeded,
            evidence: `Mean settle duration of dithers that both completed 'done' and were followed by a clean sub, ${samples.length} sample(s).`,
            confidence: 'measured',
            expectedImpact: changeNeeded ? 'Sequence-plan time estimates drift by roughly the difference per dither.' : 'none — stored value already tracks this session\'s behavior',
        });
    },

    _afDurationRec(asiairParsed) {
        const afEvents = asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'autofocus' && e.outcome === 'success' && e.durationS != null);
        if (afEvents.length === 0) return null;
        const mean = afEvents.reduce((s, e) => s + e.durationS, 0) / afEvents.length;
        return this._makeRec({
            group: 'astryx', setting: 'AF Duration',
            observed: `${(mean / 60).toFixed(2)}m avg (n=${afEvents.length})`,
            recommended: `${Math.ceil(mean / 60)}m`,
            changeNeeded: false,
            evidence: `Mean duration of ${afEvents.length} successful AF event(s) this session, including guide re-select and settle.`,
            confidence: 'measured',
            expectedImpact: 'Sequence-plan AF time budget for this session.',
        });
    },

    _calDurationRec(asiairParsed) {
        const calEvents = asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'guide_calibration' && e.outcome === 'done' && e.durationS != null);
        if (calEvents.length === 0) return null;
        const mean = calEvents.reduce((s, e) => s + e.durationS, 0) / calEvents.length;
        return this._makeRec({
            group: 'astryx', setting: 'Guide Calibration Duration',
            observed: `${(mean / 60).toFixed(2)}m avg (n=${calEvents.length})`,
            recommended: `${Math.ceil(mean / 60)}m`,
            changeNeeded: false,
            evidence: `Mean duration of ${calEvents.length} successful calibration(s) this session, including settle.`,
            confidence: 'measured',
            expectedImpact: 'Sequence-plan calibration time budget for this session.',
        });
    },

    _flipDurationRec(asiairParsed) {
        const flips = asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'meridian_flip' && e.outcome === 'succeeded' && e.flipStartedAt && e.flipEndedAt);
        if (flips.length === 0) return null;
        const durations = flips.map(f => (f.flipEndedAt.getTime() - f.flipStartedAt.getTime()) / 1000);
        const mean = durations.reduce((s, v) => s + v, 0) / durations.length;
        return this._makeRec({
            group: 'astryx', setting: 'Flip Duration',
            observed: `${(mean / 60).toFixed(2)}m avg (n=${flips.length})`,
            recommended: `${Math.ceil(mean / 60)}m`,
            changeNeeded: false,
            evidence: `Mean duration of ${flips.length} successful meridian flip(s) this session (flip start to end, not including the pre-flip pause).`,
            confidence: 'measured',
            expectedImpact: 'Sequence-plan flip time budget for this session.',
        });
    },

    // Flip Pause — the one Astryx setting the design doc calls a hybrid:
    // "derived, not stored at all — computed from transit time, target
    // coordinates, flip offset and sub cycle." That's a real astronomical
    // calculation (local sidereal time at flip, target RA/Dec, hour angle
    // at meridian crossing) that Astryx's own astro-core.js/astro-target.js
    // almost certainly already do correctly — reimplementing sidereal-time
    // math blind, overnight, with no way to cross-check the result against
    // those existing utilities or get it reviewed, risks landing a subtly
    // wrong number that actively misleads sequence planning. That's worse
    // than not having it. What ships here instead: the configured wait
    // copied straight from the log (same value ASIAir Config's Flip Offset
    // shows), confidence 'copied' rather than 'derived', with the gap to
    // the real 6.4 spelled out explicitly rather than silently glossed
    // over. Finishing this needs either the existing transit-time utility
    // functions to build on, or a chance to verify the derivation directly
    // — flagged for follow-up, not fabricated.
    _flipPauseRec(asiairParsed) {
        const flips = asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'meridian_flip' && e.configuredWaitS != null);
        if (flips.length === 0) return null;
        const wait = flips[0].configuredWaitS;
        return this._makeRec({
            group: 'astryx', setting: 'Flip Pause',
            observed: `${Math.floor(wait / 60)}m${wait % 60}s configured`,
            recommended: 'not derived this pass — see evidence',
            changeNeeded: false,
            evidence: 'Design doc §8 calls for this to be DERIVED from transit time, target RA/Dec, flip offset, and sub cycle — a real sidereal-time calculation. Not attempted here: doing it blind, without Astryx\'s existing transit-time utilities to build on or a chance to verify the result, risks a subtly wrong number. What\'s shown is the configured value copied from the log, not an independent derivation. Needs a follow-up pass with access to astro-core.js/astro-target.js or direct verification.',
            confidence: 'copied',
            expectedImpact: 'unknown until the real derivation exists',
        });
    },

    _subTierByImageNo(fs, imageNo) {
        const sub = fs.subs.find(s => s.imageNo === imageNo);
        return sub ? sub.tier : null;
    },

    // -------------------------------------------------------------------------
    // Group 2 — ASIAir config (copied, not learned — these are settings
    // ASIAir itself is configured with, echoed here so they're visible
    // alongside everything else rather than needing a separate lookup).
    // -------------------------------------------------------------------------

    // AF Interval and Frames per Dither are NOT implemented — neither log
    // records the configured interval/count anywhere, only per-event
    // trigger type and outcome. Copying a value that was never actually
    // observed would be fabrication, not a copy. Same category of gap as
    // cable routing and flat exposure (Process/Hardware), just for a
    // different underlying reason (no signal at all, vs. deliberately
    // skipped).
    _buildAsiairConfig(fs, context) {
        if (!context || !context.asiairParsed) return [];
        const flips = context.asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'meridian_flip' && e.configuredWaitS != null);
        if (flips.length === 0) return [];
        const wait = flips[0].configuredWaitS;
        return [this._makeRec({
            group: 'asiair', setting: 'Flip Offset',
            observed: `${Math.floor(wait / 60)}m${wait % 60}s`,
            recommended: `${Math.floor(wait / 60)}m${wait % 60}s (as configured)`,
            changeNeeded: false,
            evidence: 'Read directly from the log\'s "Wait Xmin Ys to Meridian Flip" line — this is ASIAir\'s own configuration, not a learned value.',
            confidence: 'copied',
            expectedImpact: 'none — informational',
        })];
    },

    // -------------------------------------------------------------------------
    // Group 3 — PHD2 config (copied, with a recommended delta where a
    // Finding gives a concrete reason to suggest one)
    // -------------------------------------------------------------------------

    // Reads from the FIRST SESSION's own equipment object, not
    // phd2Parsed.equipment (top-level) — found during validation that
    // searchRegionPx/starMassTolerancePct/aggression/minMove are only
    // ever captured by _extractSessionHeader (per-session), never by
    // _extractEquipment (the whole-log scan that builds the top-level
    // object) — its own eq literal never declares these fields at all.
    // Confirmed the raw data is genuinely in the log ("Search region = 50
    // px, Star mass tolerance = 50.0%") and genuinely reaches each
    // session's own equipment, just not the top-level summary. Working
    // around it here by reading the first session with a populated value,
    // rather than editing phd2-log-parser.js — an already-shipped,
    // already-validated file — overnight with no chance for the diff to
    // be reviewed. Worth a small follow-up fix later (same shape as
    // #237's starMass addition) to promote these onto the top-level
    // object directly, since other future code will reasonably expect
    // them there too.
    _buildPhd2Config(fs, context) {
        if (!context || !context.phd2Parsed || !context.phd2Parsed.sessions) return [];
        const eq = context.phd2Parsed.sessions.map(s => s.equipment).find(e => e && e.searchRegionPx != null) || {};
        const recs = [];

        if (eq.searchRegionPx != null) {
            const d1 = fs.findings.filter(f => f.code === 'D1_GUIDE_STAR_SWAP');
            const d15 = fs.findings.filter(f => f.code === 'D15_LOCK_POSITION_EDGE');
            const changeNeeded = d1.length > 0 || d15.length > 0;
            const parts = [];
            if (d1.length > 0) parts.push(`${d1.length} guide-star-swap`);
            if (d15.length > 0) parts.push(`${d15.length} near-edge-lock`);
            recs.push(this._makeRec({
                group: 'phd2', setting: 'Search Region',
                observed: `${eq.searchRegionPx}px`,
                recommended: changeNeeded ? `smaller than ${eq.searchRegionPx}px` : `${eq.searchRegionPx}px (as configured)`,
                changeNeeded,
                evidence: changeNeeded
                    ? `${parts.join(', ')} finding(s) this session — points at the search region being large enough to catch a second star or crowd the sensor edge.`
                    : 'No guide-star-swap or near-edge-lock findings this session at this search region.',
                confidence: changeNeeded ? 'inferred' : 'copied',
                expectedImpact: changeNeeded ? 'Fewer accidental guide-star swaps and edge-lock risk.' : 'none',
            }));
        }

        if (eq.starMassTolerancePct != null) {
            recs.push(this._makeRec({
                group: 'phd2', setting: 'Star Mass Tolerance',
                observed: `${eq.starMassTolerancePct}%`,
                recommended: `${eq.starMassTolerancePct}% (as configured)`,
                changeNeeded: false,
                evidence: 'Read directly from the PHD2 log header.',
                confidence: 'copied',
                expectedImpact: 'none — informational',
            }));
        }

        if (eq.raMinMove != null || eq.decMinMove != null) {
            recs.push(this._makeRec({
                group: 'phd2', setting: 'RA / Dec Minimum Move',
                observed: `RA ${eq.raMinMove ?? '—'} / Dec ${eq.decMinMove ?? '—'}`,
                recommended: 'as configured',
                changeNeeded: false,
                evidence: 'Read directly from the PHD2 log header.',
                confidence: 'copied',
                expectedImpact: 'none — informational',
            }));
        }

        if (eq.raAggression != null || eq.decAggression != null) {
            recs.push(this._makeRec({
                group: 'phd2', setting: 'RA / Dec Aggression',
                observed: `RA ${eq.raAggression ?? '—'} / Dec ${eq.decAggression ?? '—'}`,
                recommended: 'as configured',
                changeNeeded: false,
                evidence: 'Read directly from the PHD2 log header.',
                confidence: 'copied',
                expectedImpact: 'none — informational',
            }));
        }

        return recs;
    },

    // -------------------------------------------------------------------------
    // Group 4 — Process / hardware (inferred from Findings; cable routing
    // and flat exposure deliberately not implemented per direct
    // instruction)
    // -------------------------------------------------------------------------

    _buildProcessHardware(fs, context) {
        const recs = [];

        // Guide star selection — ties to D1 (guide-star swap) and D15
        // (lock position near frame edge).
        const d1 = fs.findings.filter(f => f.code === 'D1_GUIDE_STAR_SWAP');
        const d15 = fs.findings.filter(f => f.code === 'D15_LOCK_POSITION_EDGE');
        if (d1.length > 0 || d15.length > 0) {
            const parts = [];
            if (d1.length > 0) parts.push(`${d1.length} guide-star-swap`);
            if (d15.length > 0) parts.push(`${d15.length} near-edge-lock`);
            recs.push(this._makeRec({
                group: 'process', setting: 'Guide Star Selection',
                observed: `${parts.join(', ')} finding(s) this session`,
                recommended: 'Prefer a brighter, more isolated guide star further from the sensor edge on future nights with this target/field.',
                changeNeeded: true,
                evidence: d1.map(f => f.title).concat(d15.map(f => f.title)).join('; '),
                confidence: 'inferred',
                expectedImpact: 'Fewer guide-star-swap and edge-lock incidents on similar fields.',
            }));
        }

        // Calibration timing — ties to D10 (star lost during calibration,
        // or an orthogonality outlier).
        const d10 = fs.findings.filter(f => f.code === 'D10_STAR_LOST_DURING_CALIBRATION' || f.code === 'D10_ORTHOGONALITY_OUTLIER');
        if (d10.length > 0) {
            recs.push(this._makeRec({
                group: 'process', setting: 'Calibration Timing',
                observed: `${d10.length} calibration finding(s) this session`,
                recommended: 'Calibrate nearer the target\'s declination and away from twilight/low-altitude conditions.',
                changeNeeded: true,
                evidence: d10.map(f => f.title).join('; '),
                confidence: 'inferred',
                expectedImpact: 'More reliable calibration rates and orthogonality on future nights.',
            }));
        }

        return recs;
    },

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionRecommendations;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
