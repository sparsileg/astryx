/**
 * session-recommendations.js
 * Turns a night's FusedSession + raw parser data into Recommendation[]
 * (design doc §8): four groups (Astryx settings, ASIAir config, PHD2
 * config, Process/hardware), each entry carrying observed, recommended,
 * evidence, confidence, and expected impact — including "no change
 * needed" recommendations, which are still produced, not omitted.
 *
 * Two groups' example items are deliberately NOT implemented here, per
 * direct instruction: cable routing and flat exposure. AF Interval and
 * Frames per Dither have no *configured* value in either log, only
 * trigger/outcome per event — buildDitherSettleTimeoutInfo and
 * buildFramesPerDitherInfo below infer effective (not configured) values
 * for the same underlying settings, shown as information rather than a
 * recommendation. Flip Pause and Flip Offset are handled outside this
 * file's Recommendation model entirely — see buildMeridianVerification.
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
                group: 'behavior', setting: 'Sub Gap',
                observed: 'no clean-block samples this session', recommended: this._learnedValueText(asiairParsed, 'subGap'), changeNeeded: false,
                evidence: 'Every consecutive sub pair this session involved at least one non-clean sub.',
                confidence: 'measured', expectedImpact: 'none',
            });
        }

        const changeNeeded = stored != null && Math.abs(mean - stored) > 1;
        return this._makeRec({
            group: 'behavior', setting: 'Sub Gap',
            observed: `${mean.toFixed(1)}s (n=${n}, ${note})`,
            recommended: this._learnedValueText(asiairParsed, 'subGap'),
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
                group: 'behavior', setting: 'Dither Duration',
                observed: 'no clean-block samples this session', recommended: this._learnedValueText(asiairParsed, 'dither'), changeNeeded: false,
                evidence: 'No dither this session both settled cleanly and was immediately followed by a clean sub.',
                confidence: 'measured', expectedImpact: 'none',
            });
        }
        const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
        const stored = (typeof SettingsManager !== 'undefined') ? SettingsManager.getLearnedDitherDurationS() : null;
        const changeNeeded = stored != null && Math.abs(mean - stored) > 3;
        return this._makeRec({
            group: 'behavior', setting: 'Dither Duration',
            observed: `${mean.toFixed(1)}s (n=${samples.length}, clean blocks only)`,
            recommended: this._learnedValueText(asiairParsed, 'dither'),
            changeNeeded,
            evidence: `Mean settle duration of dithers that both completed 'done' and were followed by a clean sub, ${samples.length} sample(s).`,
            confidence: 'measured',
            expectedImpact: changeNeeded ? 'Sequence-plan time estimates drift by roughly the difference per dither.' : 'none — stored value already tracks this session\'s behavior',
        });
    },

    // The stored moving average, and what this log fed into it. The value
    // averaged in comes from AsiairLogParser._computeRecommendations (what
    // updateLearnedValues applies), which can differ slightly from the
    // clean-block figure in the Observed column.
    _learnedValueText(asiairParsed, which) {
        const r = asiairParsed.recommendations;
        const subGap = which === 'subGap';
        const stored = subGap ? SettingsManager.getLearnedSubGapS() : SettingsManager.getLearnedDitherDurationS();
        const applied = subGap ? r.observedSubGapS : r.observedDitherDurationS;
        const count = subGap ? r.subGapSampleCount : r.ditherSampleCount;
        const met = subGap ? r.subGapMeetsMinSamples : r.ditherMeetsMinSamples;
        return met
            ? `${stored}s (this log added ${applied}s, n=${count})`
            : `${stored}s (not updated: ${count} clean sample${count === 1 ? '' : 's'}, minimum ${APP_CONFIG.ASIAIR_MIN_CLEAN_SAMPLES})`;
    },

    _afDurationRec(asiairParsed) {
        const afEvents = asiairParsed.runs.filter(r => r.kind === 'light')
            .flatMap(r => r.events).filter(e => e.type === 'autofocus' && e.outcome === 'success' && e.durationS != null);
        if (afEvents.length === 0) return null;
        const mean = afEvents.reduce((s, e) => s + e.durationS, 0) / afEvents.length;
        return this._makeRec({
            group: 'sequencePlanning', setting: 'AF Duration',
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
            group: 'sequencePlanning', setting: 'Guide Calibration Duration',
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
            group: 'sequencePlanning', setting: 'Flip Duration',
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

    // Why a night with a flip has no verification table, or '' when the
    // table is shown or there was no flip.
    meridianVerificationMissingText(context) {
        if (!context || !context.asiairParsed) return '';
        if (this._meridianFlipsWithRuns(context.asiairParsed).length === 0) return '';
        if (this.buildMeridianVerification(context).length > 0) return '';
        return context.location
            ? 'Meridian Flip Verification: the target\'s transit time could not be worked out for this flip.'
            : 'Meridian Flip Verification needs the night\'s location: add this night to the Imaging Log with its location.';
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

    // -------------------------------------------------------------------------
    // Guiding Settings — each guide setting judged against what one night's
    // logs show. Rendered as its own section, not through build()'s groups,
    // because each row carries "what tonight showed" alongside the setting.
    // Guide Stability and settle time come from context (entered on the Log
    // Analysis screen); neither log records them.
    // -------------------------------------------------------------------------

    buildGuidingSettings(context) {
        if (!context || !context.phd2Parsed) return null;
        const phd2 = context.phd2Parsed;
        const eq = phd2.equipment || {};
        const C = APP_CONFIG.GUIDE_SETTINGS_ANALYSIS;
        const stats = this._guideFrameStats(phd2);
        const rows = [];
        const summary = [];

        const calRow = this._calibrationStepRow(phd2.calibrations || [], C);
        if (calRow) rows.push(calRow);
        if (stats) {
            rows.push(this._maxDurationRow(stats, C));
            rows.push(this._minMoveRow(eq, stats, C));
            rows.push(this._aggressionRow('RA Aggression', eq.raAggression, stats.persistRa, C));
            rows.push(this._aggressionRow('Dec Aggression', eq.decAggression, stats.persistDec, C));
        }
        const balance = this._balanceRow(phd2.overall, C);
        if (balance) rows.push(balance.row);
        const stabilityRow = this._guideStabilityRow(context, phd2.overall, C);
        if (stabilityRow) rows.push(stabilityRow);
        if (eq.exposureMs != null) {
            rows.push({ setting: 'Guide Exposure', yours: `${(eq.exposureMs / 1000).toFixed(1)} s`,
                tonight: '—', assessment: '—', changeNeeded: false, confidence: 'copied' });
        }
        const valid = rows.filter(Boolean);
        if (valid.length === 0) return null;

        if (balance) summary.push(balance.sentence);
        if (stats && stats.resolutionLimited) {
            summary.push('Most of tonight\'s guide error was smaller than the correction threshold, so the guide camera\'s resolution, not the settings, is the main limit on guiding.');
        }
        const changes = valid.filter(r => r.changeNeeded);
        summary.push(changes.length > 0
            ? `Worth a look: ${changes.map(r => r.setting).join(', ')}.`
            : 'No setting changes suggested for tonight.');
        if (changes.some(r => r.confidence === 'inferred')) {
            summary.push('Inferred suggestions are tests: try one for a few nights and compare the reports.');
        }

        return { rows: valid, summary };
    },

    // Settled, error-free frames of every full guide session, per axis:
    // persistence (lag-1 correlation of the error), seeing jitter (frame-to-
    // frame change ÷ √2, in px), share of frames with no pulse, and pulses at
    // the Max RA/Dec duration cap (counted over all frames).
    _guideFrameStats(phd2) {
        const T = APP_CONFIG.PHD2_GUIDE_THRESHOLDS;
        const C = APP_CONFIG.GUIDE_SETTINGS_ANALYSIS;
        const acc = { n: 0, persistRa: 0, persistDec: 0, jitterRa: 0, jitterDec: 0, zeroRa: 0, zeroDec: 0, capHits: 0, allFrames: 0 };
        let maxRaMs = null, maxDecMs = null;

        for (const s of phd2.sessions || []) {
            if (s.frames.length < T.SHORT_SESSION) continue;
            const sEq = s.equipment || {};
            maxRaMs = maxRaMs ?? sEq.maxRaDurationMs;
            maxDecMs = maxDecMs ?? sEq.maxDecDurationMs;
            for (const f of s.frames) {
                acc.allFrames++;
                if ((sEq.maxRaDurationMs != null && f.raDurationMs >= sEq.maxRaDurationMs) ||
                    (sEq.maxDecDurationMs != null && f.decDurationMs >= sEq.maxDecDurationMs)) acc.capHits++;
            }
            const fr = s.frames.filter(f => f.settled && f.error === 0 && Number.isFinite(f.raRaw) && Number.isFinite(f.decRaw));
            if (fr.length < T.SHORT_SESSION) continue;
            const pRa = this._lag1(fr.map(f => f.raRaw));
            const pDec = this._lag1(fr.map(f => f.decRaw));
            if (pRa == null || pDec == null) continue;
            const n = fr.length;
            acc.n += n;
            acc.persistRa += pRa * n;
            acc.persistDec += pDec * n;
            acc.jitterRa += this._jitter(fr.map(f => f.raRaw)) * n;
            acc.jitterDec += this._jitter(fr.map(f => f.decRaw)) * n;
            acc.zeroRa += fr.filter(f => !f.raDurationMs).length;
            acc.zeroDec += fr.filter(f => !f.decDurationMs).length;
        }
        if (acc.n === 0) return null;

        const jitterPx = (acc.jitterRa + acc.jitterDec) / (2 * acc.n);
        const minMove = phd2.equipment && phd2.equipment.raMinMove;
        return {
            frames: acc.n,
            allFrames: acc.allFrames,
            persistRa: acc.persistRa / acc.n,
            persistDec: acc.persistDec / acc.n,
            jitterPx,
            zeroRaPct: 100 * acc.zeroRa / acc.n,
            zeroDecPct: 100 * acc.zeroDec / acc.n,
            capHits: acc.capHits,
            maxRaMs,
            maxDecMs,
            resolutionLimited: minMove != null && jitterPx < minMove && minMove <= Math.min(...C.MIN_MOVE_OPTIONS_PX),
        };
    },

    _lag1(values) {
        if (values.length < 3) return null;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        let num = 0, den = 0;
        for (let i = 0; i < values.length; i++) {
            const d = values[i] - mean;
            den += d * d;
            if (i < values.length - 1) num += d * (values[i + 1] - mean);
        }
        return den > 0 ? num / den : null;
    },

    _jitter(values) {
        let sum = 0;
        for (let i = 1; i < values.length; i++) sum += (values[i] - values[i - 1]) ** 2;
        return Math.sqrt(sum / (values.length - 1) / 2);
    },

    _calibrationStepRow(calibrations, C) {
        const cals = calibrations
            .filter(c => c.outcome === 'complete' && c.stepMs != null)
            .map(c => ({
                stepMs: c.stepMs,
                decDeg: c.decDeg,
                raSteps: Math.max(0, ...c.steps.filter(s => s.direction === 'West').map(s => s.step)),
            }))
            .filter(c => c.raSteps > 0);
        if (cals.length === 0) return null;

        const stepMs = cals[0].stepMs;
        const decText = (c) => c.decDeg != null ? ` at Dec ${Math.round(c.decDeg)}°` : '';
        const nearPole = (c) => c.decDeg != null && Math.abs(c.decDeg) >= C.CAL_HIGH_DEC_DEG;
        const suggest = (c) => Math.round(c.stepMs * C.CAL_TARGET_STEPS / c.raSteps / C.CAL_STEP_ROUND_MS) * C.CAL_STEP_ROUND_MS;
        const tooFew = cals.find(c => c.raSteps < C.CAL_MIN_STEPS && !nearPole(c));
        const tooMany = cals.find(c => c.raSteps > C.CAL_MAX_STEPS && !nearPole(c));
        const poleExtra = cals.find(c => c.raSteps > C.CAL_MAX_STEPS && nearPole(c));

        let assessment, changeNeeded = false;
        if (tooFew) {
            assessment = `Too few steps for an accurate calibration; try about ${suggest(tooFew)} ms`;
            changeNeeded = true;
        } else if (tooMany) {
            assessment = `More steps than needed; about ${suggest(tooMany)} ms would calibrate faster`;
            changeNeeded = true;
        } else if (poleExtra) {
            assessment = `Good: the extra steps${decText(poleExtra)} are normal near the pole`;
        } else {
            assessment = `Good: close to PHD2's ~${C.CAL_TARGET_STEPS}-step target`;
        }
        return {
            setting: 'Calibration Step',
            yours: [...new Set(cals.map(c => `${c.stepMs} ms`))].join(', '),
            tonight: `RA steps: ${cals.map(c => `${c.raSteps}${decText(c)}`).join(', ')}`,
            assessment, changeNeeded, confidence: 'measured',
        };
    },

    _maxDurationRow(stats, C) {
        if (stats.maxRaMs == null && stats.maxDecMs == null) return null;
        const yours = stats.maxRaMs === stats.maxDecMs
            ? `${stats.maxRaMs} ms`
            : `RA ${stats.maxRaMs ?? '—'} / Dec ${stats.maxDecMs ?? '—'} ms`;
        const hitPct = 100 * stats.capHits / stats.allFrames;
        const changeNeeded = hitPct > C.MAX_DURATION_HIT_PCT;
        return {
            setting: 'Max RA / Dec Duration', yours,
            tonight: `${stats.capHits} of ${stats.allFrames.toLocaleString()} pulses hit the limit`,
            assessment: changeNeeded
                ? 'Corrections are being cut short; raise it, or check the mount if the hits come in bursts'
                : 'Good: not limiting corrections',
            changeNeeded, confidence: 'measured',
        };
    },

    _minMoveRow(eq, stats, C) {
        const minMove = eq.raMinMove;
        if (minMove == null) return null;
        const lowest = Math.min(...C.MIN_MOVE_OPTIONS_PX);
        const highest = Math.max(...C.MIN_MOVE_OPTIONS_PX);
        const scaleText = eq.pixelScale != null ? ` (${(minMove * eq.pixelScale).toFixed(2)}")` : '';
        const yours = eq.decMinMove != null && eq.decMinMove !== minMove
            ? `RA ${minMove} / Dec ${eq.decMinMove} px`
            : `${minMove} px${scaleText}`;

        let assessment, changeNeeded = false, confidence = 'measured';
        if (stats.jitterPx < minMove && minMove > lowest) {
            assessment = `Small errors go uncorrected; try ${lowest} px`;
            changeNeeded = true;
            confidence = 'inferred';
        } else if (stats.jitterPx < minMove) {
            assessment = 'Good: already ASIAir\'s lowest setting';
        } else if (stats.jitterPx > C.SEEING_CHASE_FACTOR * minMove && minMove < highest) {
            assessment = `Guiding is chasing seeing; try ${highest} px`;
            changeNeeded = true;
            confidence = 'inferred';
        } else {
            assessment = 'Good';
        }
        return {
            setting: 'Corrected Trigger Accuracy', yours,
            tonight: `${Math.round(stats.zeroRaPct)}% of RA and ${Math.round(stats.zeroDecPct)}% of Dec frames needed no correction; seeing jitter ${stats.jitterPx.toFixed(2)} px`,
            assessment, changeNeeded, confidence,
        };
    },

    _aggressionRow(setting, aggressionPct, persistence, C) {
        if (aggressionPct == null) return null;
        let assessment, changeNeeded = false;
        if (persistence > C.PERSISTENCE_HIGH) {
            assessment = `Errors linger from frame to frame, so corrections may lag; try ${Math.min(100, aggressionPct + C.AGGRESSION_STEP_PCT)}%`;
            changeNeeded = true;
        } else if (persistence < C.PERSISTENCE_LOW) {
            assessment = `Errors flip from frame to frame, so corrections overshoot; try ${Math.max(0, aggressionPct - C.AGGRESSION_STEP_PCT)}%`;
            changeNeeded = true;
        } else {
            assessment = 'Good';
        }
        return {
            setting, yours: `${Math.round(aggressionPct)}%`,
            tonight: `Error persistence ${persistence.toFixed(2)}`,
            assessment, changeNeeded, confidence: 'inferred',
        };
    },

    // Settled RA vs Dec RMS for the night. Returns the row plus the summary
    // sentence, so the two can't disagree.
    _balanceRow(overall, C) {
        if (!overall || overall.raRms == null || !overall.decRms) return null;
        const ratio = overall.raRms / overall.decRms;
        const tonight = `RA ${overall.raRms.toFixed(2)}", Dec ${overall.decRms.toFixed(2)}"`;
        const row = { setting: 'RA / Dec Balance', yours: '—', tonight, changeNeeded: false, confidence: 'measured' };
        let sentence;
        if (ratio > C.RA_DEC_BIAS_RATIO) {
            row.assessment = 'RA error is notably larger; check periodic error and RA balance, and see the RA Aggression row';
            row.changeNeeded = true;
            row.confidence = 'inferred';
            sentence = 'RA error was notably larger than Dec, which points to periodic error, RA balance or RA aggression.';
        } else if (ratio < 1 / C.RA_DEC_BIAS_RATIO) {
            row.assessment = 'Dec error is notably larger; check Dec backlash and Dec balance';
            row.changeNeeded = true;
            row.confidence = 'inferred';
            sentence = 'Dec error was notably larger than RA, which usually means Dec backlash or Dec balance.';
        } else {
            row.assessment = 'Good: well balanced';
            sentence = 'RA and Dec errors were well balanced.';
        }
        return { row, sentence };
    },

    _guideStabilityRow(context, overall, C) {
        const arcsec = context.guideStabilityArcsec;
        const holdS = context.guideSettleTimeS;
        if (arcsec == null || !context.asiairParsed) return null;
        const dithers = context.asiairParsed.runs
            .filter(r => r.kind === 'light')
            .flatMap(r => r.events)
            .filter(e => e.type === 'dither' && e.durationS != null);
        const yours = `${arcsec}" for ${holdS} s`;
        if (dithers.length === 0) {
            return { setting: 'Guide Stability', yours, tonight: 'No dithers this session', assessment: '—', changeNeeded: false, confidence: 'measured' };
        }
        const settled = dithers.filter(e => e.outcome === 'done').map(e => e.durationS).sort((a, b) => a - b);
        const timeouts = dithers.filter(e => e.outcome === 'timeout').length;
        const pick = (q) => settled[Math.max(0, Math.ceil(q * settled.length) - 1)];
        const timesText = settled.length > 0
            ? `Dither settle ${Math.round(pick(0.5))} s median, ${Math.round(pick(0.9))} s for 90%; `
            : '';
        const rms = overall && overall.totRms;

        let assessment, changeNeeded = false;
        if (timeouts > 0) {
            assessment = `Settling timed out ${timeouts} time${timeouts > 1 ? 's' : ''}; ${arcsec}" may be too tight${rms != null ? ` for tonight's ${rms.toFixed(2)}" guiding` : ''}`;
            changeNeeded = true;
        } else if (rms != null && arcsec < C.STABILITY_RMS_RATIO_MIN * rms) {
            assessment = `Tight for tonight's ${rms.toFixed(2)}" guiding; settles may run long`;
        } else {
            assessment = 'Good';
        }
        return {
            setting: 'Guide Stability', yours,
            tonight: `${timesText}${timeouts} of ${dithers.length} timed out`,
            assessment, changeNeeded, confidence: 'measured',
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
    // Minimum move and aggression are judged in buildGuidingSettings
    // rather than echoed here.
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
            // Star lost because its mass changed (PHD2 error code 6), counted
            // per guide session.
            const massSessions = new Set((context.phd2Parsed.anomalies || [])
                .filter(a => a.type === 'error_code' && a.code === 6)
                .map(a => a.session)).size;
            const changeNeeded = massSessions >= APP_CONFIG.GUIDE_SETTINGS_ANALYSIS.STAR_MASS_CHANGE_SESSIONS;
            recs.push(this._makeRec({
                group: 'phd2', setting: 'Star Mass Tolerance',
                observed: massSessions > 0
                    ? `${eq.starMassTolerancePct}%; star lost to a mass change in ${massSessions} session(s)`
                    : `${eq.starMassTolerancePct}%`,
                recommended: changeNeeded ? `higher than ${eq.starMassTolerancePct}%` : `${eq.starMassTolerancePct}% (as configured)`,
                changeNeeded,
                evidence: changeNeeded
                    ? `PHD2 dropped the guide star because its brightness changed (code 6) in ${massSessions} sessions; a higher tolerance lets it ride through thin cloud or seeing swings.`
                    : 'Read directly from the PHD2 log header.',
                confidence: changeNeeded ? 'inferred' : 'copied',
                expectedImpact: changeNeeded ? 'Fewer lost-star interruptions.' : 'none — informational',
            }));
        }

        return recs;
    },

    // -------------------------------------------------------------------------
    // Group 4 — Process / hardware (inferred from Findings; cable routing
    // and flat exposure deliberately not implemented per direct
    // instruction). Merged into the Guiding Configuration section at
    // render time (Issue #255) — tagged group: 'phd2' below, not a
    // separate group, so it renders in the same table.
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
                group: 'phd2', setting: 'Guide Star Selection',
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
                group: 'phd2', setting: 'Calibration Timing',
                observed: `${d10.length} calibration finding(s) this session`,
                recommended: 'Calibrate nearer the target\'s declination and away from twilight/low-altitude conditions.',
                changeNeeded: true,
                evidence: 'See Session Timeline (enable "Show all events" on screen) for the individual calibration findings.',
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
