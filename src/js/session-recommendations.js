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

    // #244: derived properly. configuredWaitS (the log's "Wait Xmin Ys to
    // Meridian Flip") spans Begin-line-to-GOTO, i.e. Flip Pause + Flip
    // Offset COMBINED (confirmed against Stan's own ASIAir timeline
    // writeup — pauseStartedAt is the Stop-Tracking moment T−X,
    // flipStartedAt is the GOTO moment T+Y). Real transit time T, computed
    // via astro-core/astro-target against the night's matched imaging-log
    // location (utilities-view.js), lets X and Y fall out independently:
    //   X (Flip Pause)  = T − pauseStartedAt
    //   Y (Flip Offset) = flipStartedAt − T
    // Falls back to the old copied-and-labeled-as-combined behavior when
    // no location is available for the night (context.location null).
    _meridianFlipsWithRuns(asiairParsed) {
        const results = [];
        for (const run of asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const event of run.events) {
                if (event.type === 'meridian_flip' && event.configuredWaitS != null) {
                    results.push({ event, run });
                }
            }
        }
        return results;
    },

    // Returns { transitMs, xS, yS } or null if the transit can't be
    // computed (missing location/coords/timestamps, or astro-core/
    // astro-target not loaded). Search window is ±6h around the
    // stop-tracking event — RA doesn't move enough in a night to need
    // wider, and this keeps findTargetTransit's scan cheap.
    _deriveMeridianTiming(event, run, location) {
        if (!location || location.longitude == null) return null;
        if (!run.coords || run.coords.raHours == null) return null;
        if (!event.pauseStartedAt || !event.flipStartedAt) return null;
        if (typeof findTargetTransit !== 'function' || typeof dateToJD !== 'function' || typeof jdToDate !== 'function') return null;

        const centerJD = dateToJD(event.pauseStartedAt);
        const windowDays = 6 / 24;
        const transitJD = findTargetTransit(centerJD - windowDays, centerJD + windowDays,
            run.coords.raHours, run.coords.decDeg, location.longitude);
        if (transitJD == null) return null;

        const transitMs = jdToDate(transitJD).getTime();
        return {
            transitMs,
            xS: (transitMs - event.pauseStartedAt.getTime()) / 1000,
            yS: (event.flipStartedAt.getTime() - transitMs) / 1000,
        };
    },

    _fmtMinSec(s) {
        const sign = s < 0 ? '-' : '';
        const abs = Math.round(Math.abs(s));
        return `${sign}${Math.floor(abs / 60)}m${abs % 60}s`;
    },

    // #245: Flip Pause/Offset are fixed ASIAir dial settings, not
    // conditions that vary night to night — there's nothing to
    // "recommend" (Stan: these can't really be derived/changed based on
    // logs, only verified). Moved out of Recommendations into a plain
    // verification table for Data Quality — see buildMeridianVerification
    // below. Kept as a public method (not prefixed _) since
    // session-report-view.js calls it directly, bypassing build()'s
    // four-group Recommendation shape entirely.
    //
    // Verified 2025-11-17 raw log: pauseStartedAt lands the same second as
    // the "Stop Tracking" line, immediately after the prior exposure ends
    // — confirms it's the true Stop-Tracking moment (T−X), not an earlier
    // exposure-fit decision point, and that flipStartedAt − pauseStartedAt
    // reproduces configuredWaitS exactly (353s both ways).
    buildMeridianVerification(context) {
        if (!context || !context.asiairParsed) return [];
        const flips = this._meridianFlipsWithRuns(context.asiairParsed);
        if (flips.length === 0) return [];
        const { event, run } = flips[0];
        const derived = this._deriveMeridianTiming(event, run, context.location);
        if (!derived) return [];

        const rows = [];
        const pauseSettingS = (SettingsManager.getSetting('seqPlanMeridianFlipPause', 4)) * 60;
        const offsetSettingS = (SettingsManager.getSetting('seqPlanMeridianFlipOffset', 0)) * 60;

        if (Number.isFinite(derived.xS)) {
            rows.push({
                setting: 'Flip Pause',
                observed: this._fmtMinSec(derived.xS),
                astryxSetting: this._fmtMinSec(pauseSettingS),
                delta: this._fmtMinSec(derived.xS - pauseSettingS),
            });
        }
        if (Number.isFinite(derived.yS)) {
            rows.push({
                setting: 'Flip Offset',
                observed: this._fmtMinSec(derived.yS),
                astryxSetting: this._fmtMinSec(offsetSettingS),
                delta: this._fmtMinSec(derived.yS - offsetSettingS),
            });
        }
        return rows;
    },

    // #246: informational only, not a Recommendation — Stan's explicit
    // call ("not ready to use as a recommendation, but good information to
    // know"). Every observed `Settle Timeout` in the corpus landed at
    // exactly the same duration per night (threshold-calibration.md §2:
    // 63s = 60s configured timeout + ~3s reporting overhead), so this
    // just surfaces that consistency check for the night in hand — it
    // doesn't compare against anything stored in Astryx, since there's no
    // Astryx setting for ASIAir's own dither-settle-timeout dial.
    buildDitherSettleTimeoutInfo(context) {
        if (!context || !context.asiairParsed) return null;
        const timeouts = [];
        for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
            for (const event of run.events) {
                if (event.type === 'dither' && event.outcome === 'timeout' && event.durationS != null) {
                    timeouts.push(Math.round(event.durationS));
                }
            }
        }
        if (timeouts.length === 0) return null;
        const unique = [...new Set(timeouts)].sort((a, b) => a - b);
        return {
            count: timeouts.length,
            consistent: unique.length === 1,
            text: unique.length === 1
                ? `~${unique[0]}s, consistent across ${timeouts.length} timeout event${timeouts.length > 1 ? 's' : ''} this night`
                : `varies (${unique.join('s, ')}s) across ${timeouts.length} timeout events this night`,
        };
    },

    // #246: informational only, same reasoning as the settle-timeout note
    // above. ASIAir never logs the *configured* frames-per-dither value
    // directly (only per-dither trigger events), but the *effective*
    // spacing is countable: subs whose startedAt falls between one dither
    // and the next. Dithers don't split ImagingBlocks (asiair-log-parser.js
    // _extractImagingBlocks continues collecting subs straight through a
    // dither), so this counts against raw sub timestamps per run, not
    // block boundaries. The very first interval (subs before the run's
    // first dither) is included, which can understate/overstate cadence
    // slightly if the run starts mid-sequence — acceptable for an
    // informational figure, not precise enough to recommend a change from.
    buildFramesPerDitherInfo(context) {
        if (!context || !context.asiairParsed) return null;
        const counts = [];
        for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
            const subs = run.blocks.flatMap(b => b.subs).filter(s => !s.aborted).sort((a, b) => a.startedAt - b.startedAt);
            const dithers = run.events.filter(e => e.type === 'dither' && e.startedAt).sort((a, b) => a.startedAt - b.startedAt);
            if (subs.length === 0 || dithers.length === 0) continue;

            let cursor = 0;
            for (const dither of dithers) {
                let n = 0;
                while (cursor < subs.length && subs[cursor].startedAt < dither.startedAt) {
                    n++;
                    cursor++;
                }
                if (n > 0) counts.push(n);
            }
        }
        if (counts.length === 0) return null;
        const unique = [...new Set(counts)].sort((a, b) => a - b);
        return {
            count: counts.length,
            consistent: unique.length === 1,
            text: unique.length === 1
                ? `${unique[0]} sub(s) between dithers, consistent across ${counts.length} interval${counts.length > 1 ? 's' : ''} this night`
                : `varies (${unique.join(', ')} subs) across ${counts.length} intervals this night`,
        };
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

    // #245: Flip Offset moved to Data Quality (buildMeridianVerification)
    // — see that method's comment. Nothing else populates this group yet
    // (AF Interval/Frames per Dither have no log signal at all — see file
    // header), so it returns empty for now.
    _buildAsiairConfig(fs, context) {
        return [];
    },

    // -------------------------------------------------------------------------
    // Group 3 — PHD2 config (copied, with a recommended delta where a
    // Finding gives a concrete reason to suggest one)
    // -------------------------------------------------------------------------

    // #244: reads phd2Parsed.equipment directly now that _extractEquipment
    // captures searchRegionPx/starMassTolerancePct/aggression/minMove at
    // the top level — the sessions[0] workaround is no longer needed.
    _buildPhd2Config(fs, context) {
        if (!context || !context.phd2Parsed) return [];
        const eq = context.phd2Parsed.equipment || {};
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
                observed: `RA ${eq.raAggression != null ? eq.raAggression + '%' : '—'} / Dec ${eq.decAggression != null ? eq.decAggression + '%' : '—'}`,
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
                evidence: 'See Session Timeline (enable "Show all events" on screen) for the individual guide-star-swap/near-edge-lock findings and their positions.',
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
