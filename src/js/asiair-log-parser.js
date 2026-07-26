/**
 * asiair-log-parser.js
 * Parses ASIAir Autorun log files into structured session data.
 */

const AsiairLogParser = {

    /**
     * Parse an ASIAir Autorun log text into structured session data.
     * Performs no writes — see updateLearnedValues() for the deliberate,
     * explicitly-invoked counterpart (ELR.p1-4).
     * @param {string} text - Raw log file contents
     * @returns {object} Parsed session data
     */
    parse(text) {
        const allLines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
        const lines = this._extractLightFrameLines(allLines);

        const target = this._extractTarget(lines);
        const date = this._extractDate(lines);
        const exposure = this._extractExposure(lines);
        const totalSubs = this._extractTotalSubs(lines);
        const { events, parseFailures } = this._extractEvents(lines);
        const wallClock = this._extractWallClock(lines);
        const summary = this._computeSummary(events, wallClock.wallClockS);
        const recommendations = this._computeRecommendations(events, summary, exposure, parseFailures);

        return { target, date, exposure, totalSubs, events, parseFailures, wallClock, summary, recommendations };
    },

    /**
     * Extract only lines belonging to light frame autorun sessions.
     * Skips any autorun session that shoots flat, dark, or bias frames.
     */
    _extractLightFrameLines(lines) {
        const result = [];
        let inSession = false;
        let sessionIsLight = false;
        let sessionLines = [];

        for (const line of lines) {
            if (line.includes('[Autorun|Begin]')) {
                inSession = true;
                sessionIsLight = false;
                sessionLines = [line];
                continue;
            }

            if (inSession) {
                sessionLines.push(line);

                if (line.match(/Shooting \d+ light frames/)) {
                    sessionIsLight = true;
                }

                if (line.includes('[Autorun|End]')) {
                    if (sessionIsLight) {
                        result.push(...sessionLines);
                    }
                    inSession = false;
                    sessionLines = [];
                }
            } else {
                // Lines outside any autorun session (log header etc.)
                result.push(line);
            }
        }

        // Handle unclosed session at end of file
        if (inSession && sessionIsLight) {
            result.push(...sessionLines);
        }

        return result;
    },

    // -------------------------------------------------------------------------
    // Extraction helpers
    // -------------------------------------------------------------------------

    _extractTarget(lines) {
        for (const line of lines) {
            const m = line.match(/\[Autorun\|Begin\]\s+(\S+)\s+Start/);
            if (m) return m[1].replace(/([A-Z]+)(\d)/, '$1 $2');
        }
        return 'Unknown';
    },

    _extractDate(lines) {
        for (const line of lines) {
            const m = line.match(/^(\d{4}\/\d{2}\/\d{2})/);
            if (m) return m[1].replace(/\//g, '-');
        }
        return '';
    },

    // Actual wall-clock span of the session — from [Autorun|Begin] to
    // [Autorun|End] (or, for a manually-stopped run, the last line in the
    // log with a parseable timestamp). Needed for Change 2's reconciliation
    // since totalTrackedS is a sum of individually-measured event
    // durations and can't be assumed to equal the real elapsed time.
    _extractWallClock(lines) {
        let start = null;
        let end = null;

        for (const line of lines) {
            if (line.includes('[Autorun|Begin]')) {
                start = this._parseTimestamp(line);
                break;
            }
        }

        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('[Autorun|End]') || lines[i].includes('Stop Autorun Manually')) {
                end = this._parseTimestamp(lines[i]);
                break;
            }
        }
        if (!end) {
            for (let i = lines.length - 1; i >= 0; i--) {
                const t = this._parseTimestamp(lines[i]);
                if (t) { end = t; break; }
            }
        }

        return {
            start,
            end,
            wallClockS: (start && end) ? (end - start) / 1000 : null,
        };
    },

    _extractExposure(lines) {
        for (const line of lines) {
            const m = line.match(/Shooting \d+ light frames, exposure ([\d.]+)s/);
            if (m) return parseFloat(m[1]);
        }
        return null;
    },

    _extractTotalSubs(lines) {
        for (const line of lines) {
            const m = line.match(/Shooting (\d+) light frames/);
            if (m) return parseInt(m[1]);
        }
        return null;
    },

    _parseTimestamp(line) {
        const m = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
        if (!m) return null;
        return new Date(m[1].replace(/\//g, '-').replace(' ', 'T'));
    },

    // Single source of truth for recognizing a settle terminator line.
    // Returns 'done' | 'timeout' | 'failed', or null if the line isn't one.
    _matchSettleTerminator(line) {
        if (line.includes('[Guide] Settle Done')) return 'done';
        if (line.includes('[Guide] Settle Timeout')) return 'timeout';
        if (line.includes('[Guide] Settle failed')) return 'failed';
        return null;
    },

    // Scans forward from startIdx for the first line matchFn recognizes as a
    // terminator. Aborts as a parse failure — never absorbed silently — if a
    // stopSet line is hit first, or if elapsed time since baselineTime
    // exceeds timeLimitS. Lines that match neither are ignored as noise
    // (e.g. an unrelated mid-imaging "Guide star lost" inside a dither's own
    // settle window is common in the corpus and must not abort the scan).
    _scanForwardBounded(lines, startIdx, baselineTime, { matchFn, stopSet, timeLimitS }) {
        for (let j = startIdx; j < lines.length; j++) {
            const line = lines[j];
            const matched = matchFn(line);
            if (matched) {
                const t = this._parseTimestamp(line);
                const elapsedS = baselineTime && t ? (t - baselineTime) / 1000 : null;
                if (elapsedS !== null && elapsedS > timeLimitS) {
                    return { found: false, reason: 'timeout_exceeded', line: j, elapsedS };
                }
                return { found: true, matched, line: j, elapsedS };
            }
            if (stopSet.some(p => line.includes(p))) {
                return { found: false, reason: 'stopped', line: j };
            }
            const t = this._parseTimestamp(line);
            if (baselineTime && t && (t - baselineTime) / 1000 > timeLimitS) {
                return { found: false, reason: 'timeout_exceeded', line: j };
            }
        }
        return { found: false, reason: 'eof', line: lines.length };
    },

    // Stop set shared by all bounded settle scans — if any of these appear
    // before a terminator, the scan aborts rather than absorbing whatever
    // it happens to find later.
    SETTLE_SCAN_STOP_SET: ['Exposure', '[AutoFocus|Begin]', '[Autorun|', 'Log disabled'],

    // -------------------------------------------------------------------------
    // Event extraction
    // -------------------------------------------------------------------------

    _extractEvents(lines) {
        const events = [];
        const parseFailures = [];
        this._subTimes = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // --- Autofocus ---
            if (line.includes('[AutoFocus|Begin]')) {
                const afStart = this._parseTimestamp(line);
                let afEnd = null;
                let settleEnd = null;
                let settleOutcome = null;
                let calLine = -1;
                let j = i + 1;

                while (j < lines.length) {
                    if (lines[j].includes('[AutoFocus|End]')) {
                        afEnd = this._parseTimestamp(lines[j]);
                    }
                    if (lines[j].includes('[Guide] Start Calibrating')) {
                        calLine = j;
                        break;
                    }
                    if (afEnd) {
                        const terminator = this._matchSettleTerminator(lines[j]);
                        if (terminator) {
                            const t = this._parseTimestamp(lines[j]);
                            const elapsedS = t ? (t - afEnd) / 1000 : null;
                            if (elapsedS !== null && elapsedS > APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S) {
                                parseFailures.push({
                                    type: 'af_settle', reason: 'timeout_exceeded',
                                    start: afStart, startLine: i + 1, atLine: j + 1, elapsedS,
                                });
                                // Fall back to afEnd rather than absorb an inflated duration
                            } else {
                                settleEnd = t;
                                settleOutcome = terminator;
                            }
                            break;
                        }
                    }
                    if (j > i + 1 && (
                        lines[j].includes('[AutoFocus|Begin]') ||
                        lines[j].match(/Exposure \d+\.?\d*s image \d+#/) ||
                        lines[j].includes('[Meridian Flip|Begin]')
                    )) break;
                    j++;
                }

                const end = settleEnd || afEnd;
                if (afStart && end) {
                    events.push({
                        type: 'autofocus',
                        start: afStart,
                        end: end,
                        durationS: (end - afStart) / 1000,
                        settleOutcome: settleOutcome, // 'done' | 'timeout' | 'failed' | null (no settle attempted or unresolved)
                    });
                }
                i = calLine >= 0 ? calLine : j + 1;
                continue;
            }

            // --- Guide Calibration (after meridian flip) ---
            if (line.includes('[Guide] Start Calibrating')) {
                const calStart = this._parseTimestamp(line);
                const result = this._scanForwardBounded(lines, i + 1, calStart, {
                    matchFn: (l) => this._matchSettleTerminator(l),
                    stopSet: this.SETTLE_SCAN_STOP_SET,
                    timeLimitS: APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S,
                });

                if (result.found) {
                    const settleEnd = this._parseTimestamp(lines[result.line]);
                    if (calStart && settleEnd) {
                        events.push({
                            type: 'guide_calibration',
                            start: calStart,
                            end: settleEnd,
                            durationS: (settleEnd - calStart) / 1000,
                            outcome: result.matched,
                        });
                    }
                    i = result.line + 1;
                } else {
                    parseFailures.push({
                        type: 'guide_calibration_settle', reason: result.reason,
                        start: calStart, startLine: i + 1, atLine: result.line + 1,
                    });
                    i = result.line;
                }
                continue;
            }

            // --- Pre-flip pause ---
            if (line.includes('[Meridian Flip|Begin]')) {
                const pauseStart = this._parseTimestamp(line);
                let flipStart = null;
                let flipEnd = null;
                let j = i + 1;

                while (j < lines.length) {
                    if (lines[j].includes('Meridian Flip 1# Start')) {
                        flipStart = this._parseTimestamp(lines[j]);
                    }
                    if (lines[j].includes('[Meridian Flip|End]')) {
                        flipEnd = this._parseTimestamp(lines[j]);
                        break;
                    }
                    j++;
                }

                if (pauseStart && flipStart) {
                    events.push({
                        type: 'preflight_pause',
                        start: pauseStart,
                        end: flipStart,
                        durationS: (flipStart - pauseStart) / 1000
                    });
                }
                if (flipStart && flipEnd) {
                    events.push({
                        type: 'meridian_flip',
                        start: flipStart,
                        end: flipEnd,
                        durationS: (flipEnd - flipStart) / 1000
                    });
                }
                i = j + 1;
                continue;
            }

            // --- Dither ---
            if (line.includes('[Guide] Dither') && !line.includes('Settle')) {
                const ditherStart = this._parseTimestamp(line);
                const result = this._scanForwardBounded(lines, i + 1, ditherStart, {
                    matchFn: (l) => this._matchSettleTerminator(l),
                    stopSet: this.SETTLE_SCAN_STOP_SET,
                    timeLimitS: APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S,
                });

                if (result.found) {
                    const settleEnd = this._parseTimestamp(lines[result.line]);
                    if (ditherStart && settleEnd) {
                        events.push({
                            type: 'dither',
                            start: ditherStart,
                            end: settleEnd,
                            durationS: (settleEnd - ditherStart) / 1000,
                            outcome: result.matched,
                            affectedImg: result.matched !== 'done'
                                ? this._affectedImgAfterLine(lines, result.line)
                                : null,
                        });
                    }
                    i = result.line + 1;
                } else {
                    parseFailures.push({
                        type: 'dither_settle', reason: result.reason,
                        start: ditherStart, startLine: i + 1, atLine: result.line + 1,
                    });
                    i = result.line;
                }
                continue;
            }

            // --- Imaging blocks ---
            if (line.match(/Exposure \d+\.?\d*s image \d+#/)) {
                const blockStart = this._parseTimestamp(line);
                const firstImgNum = parseInt(line.match(/image (\d+)#/)[1]);
                this._subTimes.push(blockStart);
                let lastImgNum = firstImgNum;
                let blockEnd = null;
                let j = i + 1;

                while (j < lines.length) {
                    const nextLine = lines[j];

                    // Dither — capture as top-level event
                    if (nextLine.includes('[Guide] Dither') && !nextLine.includes('Settle')) {
                        const ditherStart = this._parseTimestamp(nextLine);
                        const result = this._scanForwardBounded(lines, j + 1, ditherStart, {
                            matchFn: (l) => this._matchSettleTerminator(l),
                            stopSet: this.SETTLE_SCAN_STOP_SET,
                            timeLimitS: APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S,
                        });

                        if (result.found) {
                            const ditherEnd = this._parseTimestamp(lines[result.line]);
                            if (ditherStart && ditherEnd) {
                                events.push({
                                    type: 'dither',
                                    start: ditherStart,
                                    end: ditherEnd,
                                    durationS: (ditherEnd - ditherStart) / 1000,
                                    outcome: result.matched,
                                    affectedImg: result.matched !== 'done'
                                        ? this._affectedImgAfterLine(lines, result.line)
                                        : null,
                                });
                            }
                            j = result.line + 1;
                        } else {
                            parseFailures.push({
                                type: 'dither_settle', reason: result.reason,
                                start: ditherStart, startLine: j + 1, atLine: result.line + 1,
                            });
                            j = result.line;
                        }
                        continue;
                    }

                    // Another exposure in this block
                    const imgMatch = nextLine.match(/Exposure \d+\.?\d*s image (\d+)#/);
                    if (imgMatch) {
                        lastImgNum = parseInt(imgMatch[1]);
                        blockEnd = this._parseTimestamp(nextLine);
                        this._subTimes.push(blockEnd);
                        j++;
                        continue;
                    }

                    // Block ends at next AF, flip pause, or end of log
                    if (nextLine.includes('[AutoFocus|Begin]') ||
                        nextLine.includes('[Meridian Flip|Begin]') ||
                        nextLine.includes('[Autorun|End]')) {
                        break;
                    }

                    j++;
                }

                const exposure = this._extractExposureFromLine(line);
                const trueBlockEnd = blockEnd
                      ? new Date(blockEnd.getTime() + exposure * 1000)
                      : new Date(blockStart.getTime() + exposure * 1000);

                events.push({
                    type: 'imaging',
                    start: blockStart,
                    end: trueBlockEnd,
                    firstImg: firstImgNum,
                    lastImg: lastImgNum,
                    subCount: lastImgNum - firstImgNum + 1,
                    durationS: (trueBlockEnd - blockStart) / 1000
                });

                i = j;
                continue;
            }

            i++;
        }

        return { events, parseFailures };
    },

    _extractExposureFromLine(line) {
        const m = line.match(/Exposure ([\d.]+)s/);
        return m ? parseFloat(m[1]) : 300;
    },

    // ELR.p1-3 Change 4: a settle timeout/failed dither means the next
    // exposure began before the guider actually settled. The affected image
    // number is read directly from the log line immediately after the
    // terminator — imaging blocks span multiple dithers internally (a
    // dither doesn't end the enclosing block), so there's no separate
    // 'imaging' event to correlate to; the raw line is the only place this
    // specific image number is recorded.
    _affectedImgAfterLine(lines, terminatorLineIdx) {
        const next = lines[terminatorLineIdx + 1];
        if (!next) return null;
        const m = next.match(/Exposure \d+\.?\d*s image (\d+)#/);
        return m ? parseInt(m[1]) : null;
    },

    // -------------------------------------------------------------------------
    // Summary computation
    // -------------------------------------------------------------------------

    _computeSummary(events, wallClockS) {
        const imaging = events.filter(e => e.type === 'imaging');
        const afs = events.filter(e => e.type === 'autofocus');
        const cals = events.filter(e => e.type === 'guide_calibration');
        const flips = events.filter(e => e.type === 'meridian_flip');
        const pauses = events.filter(e => e.type === 'preflight_pause');

        const allDithers = events.filter(e => e.type === 'dither');

        const imagingTotalS = imaging.reduce((s, e) => s + e.durationS, 0);
        const afTotalS = afs.reduce((s, e) => s + e.durationS, 0);
        const calTotalS = cals.reduce((s, e) => s + e.durationS, 0);
        const flipTotalS = flips.reduce((s, e) => s + e.durationS, 0);
        const pauseTotalS = pauses.reduce((s, e) => s + e.durationS, 0);
        const ditherTotalS = allDithers.reduce((s, d) => s + d.durationS, 0);

        const meridianTotalS = pauseTotalS + flipTotalS;

        // Dither is embedded within imaging blocks — an imaging block's
        // start/end already spans any dithers inside it (see the imaging
        // block extraction) — not a sibling category. Including ditherTotalS
        // here double-counted the same seconds twice and inflated the
        // denominator for every percentage below (ELR.p1-3 Change 2).
        const totalTrackedS = imagingTotalS + afTotalS + calTotalS + meridianTotalS;

        const totalSubs = imaging.reduce((s, e) => s + e.subCount, 0);

        // Clean dithers only — this feeds the learned value that propagates
        // into the sequence planner, so a timeout/failed dither (which
        // doesn't represent a normal settle) must not pull the average off
        // (ELR.p1-3 Change 3). ditherTotalS/ditherAmortizedS above stay
        // all-outcomes since they describe what actually happened tonight,
        // not what should be learned from it.
        const cleanDithers = allDithers.filter(d => d.outcome === 'done');
        const ditherCleanCount = cleanDithers.length;
        const afAvgS = afs.length > 0 ? afTotalS / afs.length : 0;
        const calAvgS = cals.length > 0 ? calTotalS / cals.length : 0;
        const ditherAvgS = cleanDithers.length > 0
            ? cleanDithers.reduce((s, d) => s + d.durationS, 0) / cleanDithers.length
            : 0;
        const ditherAmortizedS = totalSubs > 0 ? ditherTotalS / totalSubs : 0;

        const unaccountedS = wallClockS != null ? Math.max(0, wallClockS - totalTrackedS) : null;

        return {
            imagingTotalS,
            afTotalS,
            afAvgS,
            afCount: afs.length,
            calTotalS,
            calAvgS,
            calCount: cals.length,
            flipTotalS,
            pauseTotalS,
            meridianTotalS,
            ditherTotalS,
            ditherAvgS,
            ditherCount: allDithers.length,
            ditherCleanCount,
            ditherAmortizedS,
            // Dither's share of imaging time (nested within it), replacing
            // the old ditherPct which treated dither as a sibling category
            // of totalTrackedS — that framing no longer applies now that
            // dither isn't part of totalTrackedS at all.
            ditherShareOfImagingPct: imagingTotalS > 0 ? (ditherTotalS / imagingTotalS) * 100 : 0,
            totalTrackedS,
            totalSubs,
            wallClockS,
            unaccountedS,
            imagingPct: totalTrackedS > 0 ? (imagingTotalS / totalTrackedS) * 100 : 0,
            afPct: totalTrackedS > 0 ? (afTotalS / totalTrackedS) * 100 : 0,
            calPct: totalTrackedS > 0 ? (calTotalS / totalTrackedS) * 100 : 0,
            meridianPct: totalTrackedS > 0 ? (meridianTotalS / totalTrackedS) * 100 : 0,
        };
    },

    // -------------------------------------------------------------------------
    // Recommendations
    // -------------------------------------------------------------------------

    _computeRecommendations(events, summary, exposure, parseFailures = []) {
        const exp = exposure || 300;

        // Build interruption list — all non-imaging, non-dither events
        // Dithers are excluded here so we can detect un-dithered gaps separately
        const interruptions = events
            .filter(e => e.type !== 'imaging' && e.type !== 'dither')
            .map(e => ({ start: e.start, end: e.end }));

        const isInterrupted = (t1, t2) => {
            return interruptions.some(iv => iv.start >= t1 && iv.start < t2);
        };

        const dithersInWindow = (t1, t2) => {
            return events.filter(e => e.type === 'dither' && e.start >= t1 && e.start < t2);
        };

        // A gap containing a parse failure (settle timeout/failed that
        // couldn't be terminator-matched, or any other scan that had to
        // abort) is a log gap in the sense Change 3 means — exclude it
        // from clean-sample consideration rather than risk polluting the
        // sub-cadence measurement with an unmeasured stretch.
        const hasParseFailureInWindow = (t1, t2) => {
            return parseFailures.some(f => f.start && f.start >= t1 && f.start < t2);
        };

        const subTimesRaw = this._subTimes || [];

        // Separate gaps into dithered and un-dithered — clean samples only
        // (ELR.p1-3 Change 3): a dithered gap whose dither didn't settle
        // cleanly, or any gap containing a parse failure, is excluded
        // entirely rather than folded into either bucket.
        const ditheredGaps = [];   // gap includes a cleanly-settled dither
        const cleanGaps = [];      // gap with no dither and no interruption — pure sub gap

        for (let i = 1; i < subTimesRaw.length; i++) {
            const prev = subTimesRaw[i - 1];
            const curr = subTimesRaw[i];

            if (isInterrupted(prev, curr)) continue; // skip AF, flip, cal boundaries
            if (hasParseFailureInWindow(prev, curr)) continue; // settle timeout/failed/log gap

            const delta = (curr - prev) / 1000; // seconds between sub starts
            const overhead = delta - exp;        // overhead above exposure time

            const dithersHere = dithersInWindow(prev, curr);
            if (dithersHere.length > 0) {
                if (dithersHere.every(d => d.outcome === 'done')) {
                    ditheredGaps.push(overhead); // overhead = dither duration + sub gap
                }
                // a timeout/failed dither in this window — not a clean sample, excluded
            } else {
                cleanGaps.push(overhead);        // overhead = sub gap only
            }
        }

        // Pure sub gap: average of un-dithered gaps
        // Fall back to ditheredGap - ditherAvg if no clean gaps exist (dither-every-frame)
        let observedSubGapS;
        if (cleanGaps.length > 0) {
            observedSubGapS = cleanGaps.reduce((s, g) => s + g, 0) / cleanGaps.length;
        } else if (ditheredGaps.length > 0) {
            // All gaps are dithered — subtract average dither duration to isolate sub gap
            const avgDitheredOverhead = ditheredGaps.reduce((s, g) => s + g, 0) / ditheredGaps.length;
            observedSubGapS = Math.max(0, avgDitheredOverhead - summary.ditherAvgS);
        } else {
            observedSubGapS = SettingsManager.getLearnedSubGapS();
        }

        // Observed dither duration: from dithered gaps, subtract the sub gap
        const observedDitherDurationS = summary.ditherAvgS > 0
            ? summary.ditherAvgS
            : SettingsManager.getLearnedDitherDurationS();

        const subGapSampleCount = cleanGaps.length + ditheredGaps.length;
        const minSamples = APP_CONFIG.ASIAIR_MIN_CLEAN_SAMPLES;
        const derivationDate = new Date().toISOString().slice(0, 10);

        return {
            afDurationS: summary.afAvgS,
            calDurationS: summary.calAvgS,
            observedSubGapS: Math.round(observedSubGapS),
            observedDitherDurationS: Math.round(observedDitherDurationS),

            // Sample counts + derivation date travel with the learned
            // values so updateLearnedValues() and SettingsManager can
            // record provenance and gate on a minimum sample count instead
            // of updating from too little/noisy data.
            ditherSampleCount: summary.ditherCleanCount,
            subGapSampleCount,
            derivationDate,
            ditherMeetsMinSamples: summary.ditherCleanCount >= minSamples,
            subGapMeetsMinSamples: subGapSampleCount >= minSamples,
        };
    },

    /**
     * Update learned sub gap and dither duration via EMA (issue #145).
     * Public and explicit (ELR.p1-4) — parse() no longer calls this itself;
     * callers must invoke it deliberately after a parse succeeds and await
     * it, so viewing a log is a pure read unless the caller specifically
     * asks to also refresh planning values. See utilities-view.js's
     * initAsiairLogAnalyzer for the one existing call site.
     *
     * ELR.p1-3 Change 3: skips the update entirely when a night doesn't have
     * enough clean samples, rather than let noise or a single dirty night
     * pull the stored value around. Calling this twice on the same parsed
     * result applies the EMA twice — that's the caller's responsibility to
     * avoid, not guarded here (see ELR.p1-4 Problem #2).
     *
     * @param {object} parsed - Full result from parse()
     */
    async updateLearnedValues(parsed) {
        const { recommendations } = parsed;
        const EMA_WEIGHT = 0.2; // weight given to new observation

        if (recommendations.subGapMeetsMinSamples) {
            const storedSubGap = SettingsManager.getLearnedSubGapS();
            const newSubGap = Math.round(
                (1 - EMA_WEIGHT) * storedSubGap + EMA_WEIGHT * recommendations.observedSubGapS
            );
            await SettingsManager.setLearnedSubGapS(newSubGap, {
                sampleCount: recommendations.subGapSampleCount,
                derivedDate: recommendations.derivationDate,
            });
        }

        if (recommendations.ditherMeetsMinSamples) {
            const storedDitherDuration = SettingsManager.getLearnedDitherDurationS();
            const newDitherDuration = Math.round(
                (1 - EMA_WEIGHT) * storedDitherDuration + EMA_WEIGHT * recommendations.observedDitherDurationS
            );
            await SettingsManager.setLearnedDitherDurationS(newDitherDuration, {
                sampleCount: recommendations.ditherSampleCount,
                derivedDate: recommendations.derivationDate,
            });
        }
    },


    // -------------------------------------------------------------------------
    // Formatting helpers (used by view)
    // -------------------------------------------------------------------------

    fmtTime(date) {
        if (!date) return '';
        return date.toTimeString().slice(0, 5);
    },

    fmtMinutes(seconds) {
        return (seconds / 60).toFixed(1) + 'm';
    },

    fmtPct(pct) {
        return pct.toFixed(1) + '%';
    }

};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
