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

        // --- Legacy single-target pipeline — unchanged, kept for the
        // existing report view, which isn't updated to consume runs[] yet
        // (that's the report-rework phase, not this issue's scope).
        const lines = this._extractLightFrameLines(allLines);
        const target = this._extractTarget(lines);
        const date = this._extractDate(lines);
        const exposure = this._extractExposure(lines);
        const totalSubs = this._extractTotalSubs(lines);
        const { events, parseFailures } = this._extractEvents(lines);
        const wallClock = this._extractWallClock(lines);
        const summary = this._computeSummary(events, wallClock.wallClockS);
        const recommendations = this._computeRecommendations(events, summary, exposure, parseFailures);

        // --- Multi-run structure (#229) — additive. Correctly delimits
        // every [Autorun|Begin]->[Autorun|End] segment instead of merging
        // them into one blob, which is the multi-target/multi-run bug this
        // issue fixes. Not yet consumed by the report view (see above) —
        // that migration and events/RunEvent population are separate work.
        this._blockSeqCounter = 0;
        const runs = this._extractRunSegments(allLines)
            .map((segment, index) => this._buildAutorunRun(segment, index));

        // --- Top-level, log-wide structures (#230) — siblings of runs[],
        // not per-run: a Log disabled/enabled gap and a Plan Tonight group
        // both span the space *between* or *across* runs, not within one.
        const gaps = this._extractLogGaps(allLines);
        const plans = this._extractPlanRuns(allLines, runs);

        // #233 item 2 / design doc I13: the only mechanism that surfaces a
        // future firmware/log-format change before it silently corrupts a
        // number. Uses the raw, untrimmed line split (not allLines above,
        // which already filters blanks and loses the file's real line
        // numbers) so lineNo matches what a person would see in an editor.
        const rawLines = text.split('\n');
        const source = {
            lineCount: rawLines.length,
            unmatchedLines: this._findUnmatchedLines(rawLines),
        };

        return { target, date, exposure, totalSubs, events, parseFailures, wallClock, summary, recommendations, runs, gaps, plans, source };
    },

    // -------------------------------------------------------------------------
    // Unmatched-line collection (#233 item 2)
    // -------------------------------------------------------------------------

    // Every line pattern catalogued in log-format-survey.md §2 for ASIAir
    // Autorun logs. Deliberately sourced from that survey document (design
    // principle P2 — prefer the log's self-description) rather than
    // reverse-engineered from this file's own extraction branches. Not
    // anchored to line start with `^` — lines carry a variable-width
    // leading timestamp ("2026/07/24 02:39:34 ...") that some marker lines
    // omit, matching how the rest of this file already tests lines via
    // .includes()/.match() without anchoring.
    _KNOWN_ASIAIR_LINE_PATTERNS: [
        // 2.1 Structural / lifecycle
        /Log enabled at \d/,
        /Log disabled at \d/,
        /Log closed at \d/,
        /\[Autorun\|Begin\] .+ Start/,
        /\[Autorun\|End\] Finish Autorun/,
        /\[Autorun\|End\] Pause Autorun/,
        /Stop Autorun Manually/,
        /Plan Tonight Start/,
        /Plan Tonight Finish/,
        /Pause Plan Tonight/,
        /Shutdown ASIAIR/,
        /First delay \d+s Start/,
        // 2.2 Target and framing
        /Target RA:/,
        /Mount slews to target position:/,
        /Solve succeeded:/,
        /Plate Solve/,
        /\[AutoCenter\|Begin\] Auto-Center \d+#/,
        /\[AutoCenter\|End\] The target is centered/,
        /\[AutoCenter\|End\] Too far from center/,
        /\[AutoCenter\|End\] Mount slews failed/,
        /\[AutoCenter\|End\] Plate Solve failed/,
        /Exposure \d+\.?\d*m?s$/, // plate-solve frame — no "image N#" suffix
        // 2.3 Imaging
        /Shooting \d+ light frames/,
        /Shooting \d+ flat frames/,
        /Shooting \d+ dark frames/,
        /Shooting \d+ bias frames/,
        /Exposure \d+\.?\d*m?s image \d+#/,
        /Download failed/,
        // 2.4 Autofocus
        /\[AutoFocus\|Begin\] Run AF/,
        /\[AutoFocus\|End\] Auto focus succeeded/,
        /\[AutoFocus\|End\] Auto focus failed/,
        /Auto focus succeeded, the focused position is/,
        /Auto focus failed, EAF returns to the position/,
        /Cancel AF Manually/,
        /Find Focus Star/,
        /Find Focus Star: detect and calculate star size/,
        /Find Focus Star: finding appropriate stars/,
        /Find Focus Star: not found Focus Star/,
        /Calculate V-Curve/,
        /Calculate V-Curve\s*:\s*detect and calculate star size/,
        /Calculate V-Curve\s*:\s*detect star failed/,
        /Find Focus Point/,
        /Calculate Focus Point: detect and calculate star size/,
        /Find Focus Point: Upper limit of data point/,
        // 2.5 Guiding
        /\[Guide\] Settle Done/,
        /\[Guide\] Dither Settle/,
        /\[Guide\] Dither(?! Settle)/,
        /\[Guide\] ReSelect Guide star/,
        /\[Guide\] Start Guiding/,
        /\[Guide\] Stop Guiding/,
        /\[Guide\] Guide Settle/,
        /\[Guide\] Select Guide Star failed/,
        /\[Guide\] Guide star lost/,
        /\[Guide\] Settle Timeout/,
        /\[Guide\] Settle failed/,
        /\[Guide\] Start Calibrating/,
        /\[Guide\] Calibrate Success/,
        /\[Guide\] Stop Looping and Guiding/,
        /\[Guide\] Stop Looping(?! and Guiding)/,
        /\[Guide\] Start Tracking failed/,
        // 2.6 Mount and meridian
        /Start Tracking/,
        /Stop Tracking/,
        /Wait for Mount Settle/,
        /Mount GoTo Home POS/,
        /\[Meridian Flip\|Begin\] Wait/,
        /Meridian Flip \d+# Start/,
        /\[Meridian Flip\|End\] Meridian Flip succeeded/,
        /"ZWO\d+" is Disconnected/,
    ],

    // Single pass over the raw (untrimmed) line array — classification
    // only, read-only relative to every extraction pass elsewhere in this
    // file. Blank lines are structural separators, not content, and are
    // skipped rather than flagged. A nonzero result isn't necessarily a
    // defect in this corpus's logs; per the standing delivery note, a
    // clean 0 corpus-wide isn't expected until all of Phase 2 has landed —
    // this is the mechanism that will catch a *future* firmware change,
    // not a claim that today's coverage is already complete.
    _findUnmatchedLines(lines) {
        const unmatched = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue;
            const matched = this._KNOWN_ASIAIR_LINE_PATTERNS.some(p => p.test(line));
            if (!matched) unmatched.push({ lineNo: i + 1, text: line });
        }
        return unmatched;
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

    // ms-aware variant (#230 item 3) — used only by the new run/block/event
    // extractors below, which cover all frame kinds, not just light. The
    // legacy _extractExposureFromLine above is left untouched since it
    // still feeds the byte-identical legacy pipeline in parse().
    _extractExposureFromLineMs(line) {
        const m = line.match(/Exposure ([\d.]+)(m?s)\b/);
        if (!m) return 300;
        const value = parseFloat(m[1]);
        return m[2] === 'ms' ? value / 1000 : value;
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
    // Multi-run extraction (#229)
    // -------------------------------------------------------------------------

    // Splits the full (unfiltered) line list into one segment per
    // [Autorun|Begin] -> [Autorun|End] lifecycle, regardless of frame kind.
    // Unlike _extractLightFrameLines (which discards non-light sessions and
    // concatenates the survivors into one blob), this preserves every
    // session as its own segment — the fix for the multi-target/multi-run
    // bug (9 of 25 corpus logs, worst case 2026-06-05: 8 light runs across
    // 4 targets merged into a single reported target today).
    _extractRunSegments(allLines) {
        const segments = [];
        let current = null;

        for (const line of allLines) {
            if (line.includes('[Autorun|Begin]')) {
                if (current) {
                    // Unclosed run before the next Begin — truncated
                    const lastTs = [...current.lines].reverse()
                        .map(l => this._parseTimestamp(l)).find(Boolean);
                    current.endedAt = lastTs || current.startedAt;
                    current.endReason = 'truncated';
                    segments.push(current);
                }
                // Non-greedy capture, not \S+ — #229 used \S+ here, which
                // truncates multi-word targets like "DQ Piscium" and
                // "NGC 1333" at the first space (log-format-survey.md §2.2).
                // Fixed here as part of #230 item 1, since normalization
                // downstream can't recover a name that was already cut off
                // at capture time.
                const m = line.match(/\[Autorun\|Begin\]\s+(.+?)\s+Start/);
                current = {
                    lines: [line],
                    startedAt: this._parseTimestamp(line),
                    rawTarget: m ? m[1] : 'Unknown',
                    endedAt: null,
                    endReason: null,
                };
                continue;
            }

            if (current) {
                current.lines.push(line);

                if (line.includes('[Autorun|End]')) {
                    current.endedAt = this._parseTimestamp(line);
                    current.endReason = line.includes('Pause Autorun') ? 'pause' : 'finish';
                    if (current.lines.some(l => l.includes('Stop Autorun Manually'))) {
                        current.endReason = 'manualStop';
                    }
                    segments.push(current);
                    current = null;
                }
            }
        }

        // Unclosed run at end of file
        if (current) {
            const lastTs = [...current.lines].reverse()
                .map(l => this._parseTimestamp(l)).find(Boolean);
            current.endedAt = lastTs || current.startedAt;
            current.endReason = 'truncated';
            segments.push(current);
        }

        return segments;
    },

    // rawTarget is checked first: FOV/test runs are non-science regardless
    // of what frame type they happen to shoot (2026-07-23's FOV run shoots
    // "flat frames" but is a framing run, not a calibration run) — #230
    // item 1.
    _extractRunKind(lines, rawTarget) {
        const t = (rawTarget || '').trim().toLowerCase();
        if (t === 'fov' || t === 'test') return 'framing';

        for (const line of lines) {
            if (line.match(/Shooting \d+ light frames/)) return 'light';
            if (line.match(/Shooting \d+ flat frames/)) return 'flat';
            if (line.match(/Shooting \d+ dark frames/)) return 'dark';
            if (line.match(/Shooting \d+ bias frames/)) return 'bias';
        }
        return 'unknown';
    },

    // Collapses the inconsistent-spacing catalog forms observed in the
    // corpus (M 1/M1, C 49/C49, NGC 4565/NGC4565) to a single canonical
    // form. Deliberately a whitelist of known prefixes rather than a
    // generic letter+digit rule — a generic rule would incorrectly split
    // "Sh2-101" into "Sh2 -101". Multi-word names (DQ Piscium, NGC 1333)
    // and anything else pass through unchanged beyond whitespace collapse.
    // #230 item 1.
    _normalizeTarget(rawTarget) {
        if (!rawTarget) return 'Unknown';
        const collapsed = rawTarget.replace(/\s+/g, ' ').trim();
        const m = collapsed.match(/^(M|NGC|IC|C)\s?(\d+)$/i);
        if (m) return `${m[1].toUpperCase()} ${m[2]}`;
        return collapsed;
    },

    _extractRunPlannedFrames(lines) {
        for (const line of lines) {
            const m = line.match(/Shooting (\d+) (?:light|flat|dark|bias) frames/);
            if (m) return parseInt(m[1]);
        }
        return null;
    },

    _extractBinning(lines) {
        for (const line of lines) {
            const m = line.match(/Shooting \d+ \S+ frames,.*Bin(\d+)/);
            if (m) return parseInt(m[1]);
        }
        return null;
    },

    // Run-scoped exposure value, generalized beyond #229's light-frame-only
    // version: handles flat runs (not just light), ms units, and
    // "auto-exposure" (no numeric value at all) — #230 item 3.
    _extractRunExposure(lines) {
        for (const line of lines) {
            const m = line.match(/Shooting \d+ \S+ frames, (?:exposure ([\d.]+)(m?s)|(auto-exposure))/);
            if (m) {
                if (m[3]) return { exposureS: null, exposureIsAuto: true };
                const value = parseFloat(m[1]);
                const exposureS = m[2] === 'ms' ? value / 1000 : value;
                return { exposureS, exposureIsAuto: false };
            }
        }
        return { exposureS: null, exposureIsAuto: false };
    },

    // RA/DEC capture with two sources, tried in order: the "Target RA:"
    // line (preferred — the originally commanded target), falling back to
    // "Mount slews to target position:" when no Target RA line exists in
    // this run's segment. The fallback matters in practice: on
    // multi-target Plan Tonight nights, ASIAir only logs "Target RA:" once
    // near the first slew of the night and never restates it on later
    // target switches within the same session — the only place several
    // corpus runs' coordinates appear at all is the slew line. This is
    // also where the corpus's only negative-DEC occurrences actually live
    // (2026-06-05's M12/M10 runs) — #230 item 3.
    _extractCoords(lines) {
        const patterns = [
            /Target RA:(\d+)h(\d+)m(\d+)s\s+DEC:([+-]?\d+)°(\d+)'(\d+)"/,
            /Mount slews to target position:\s*RA:(\d+)h(\d+)m(\d+)s\s*DEC:([+-]?\d+)°(\d+)'(\d+)"/,
        ];
        for (const line of lines) {
            for (const pattern of patterns) {
                const m = line.match(pattern);
                if (m) {
                    const raHours = parseInt(m[1]) + parseInt(m[2]) / 60 + parseInt(m[3]) / 3600;
                    const degWhole = parseInt(m[4]);
                    const sign = degWhole < 0 ? -1 : 1;
                    const decDeg = sign * (Math.abs(degWhole) + parseInt(m[5]) / 60 + parseInt(m[6]) / 3600);
                    return { raHours, decDeg };
                }
            }
        }
        return null;
    },

    // Builds ImagingBlock[] (with nested Sub[]) for a single light-kind run.
    // sequenceNo is monotonic across the whole log (this._blockSeqCounter is
    // reset once in parse(), not per run) per design doc §4.1. Sub fields
    // that depend on dither/settle events (aborted, duplicateOf,
    // settledAtStart, precedingDither) are neutral placeholders here —
    // populating them from real event data is issue 230's job.
    _extractImagingBlocks(lines) {
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (line.match(/Exposure \d+\.?\d*m?s image \d+#/)) {
                const subs = [];
                let j = i;

                while (j < lines.length) {
                    const nextLine = lines[j];

                    if (nextLine.includes('[Guide] Dither') && !nextLine.includes('Settle')) {
                        const ditherStart = this._parseTimestamp(nextLine);
                        const result = this._scanForwardBounded(lines, j + 1, ditherStart, {
                            matchFn: (l) => this._matchSettleTerminator(l),
                            stopSet: this.SETTLE_SCAN_STOP_SET,
                            timeLimitS: APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S,
                        });
                        j = result.found ? result.line + 1 : result.line;
                        continue;
                    }

                    const imgMatch = nextLine.match(/Exposure \d+\.?\d*m?s image (\d+)#/);
                    if (imgMatch) {
                        subs.push({
                            imageNo: parseInt(imgMatch[1]),
                            sequenceNo: this._blockSeqCounter++,
                            startedAt: this._parseTimestamp(nextLine),
                            exposureS: this._extractExposureFromLineMs(nextLine),
                            aborted: false,
                            duplicateOf: null,
                            settledAtStart: true,
                            precedingDither: null,
                        });
                        j++;
                        continue;
                    }

                    if (nextLine.includes('[AutoFocus|Begin]') ||
                        nextLine.includes('[Meridian Flip|Begin]') ||
                        nextLine.includes('[Autorun|End]')) {
                        break;
                    }

                    j++;
                }

                if (subs.length > 0) {
                    const lastSub = subs[subs.length - 1];
                    blocks.push({
                        firstImageNo: subs[0].imageNo,
                        lastImageNo: lastSub.imageNo,
                        startedAt: subs[0].startedAt,
                        endedAt: new Date(lastSub.startedAt.getTime() + lastSub.exposureS * 1000),
                        subs,
                    });
                }

                i = j;
                continue;
            }

            i++;
        }

        return blocks;
    },

    // D4 (design doc, corrected — #230 item 10): truncation is the primary
    // signal, not duplicate image numbering. A sub is flagged when the gap
    // to whatever comes next (the following sub, or the run's own end for
    // the last sub in the run) is measurably shorter than its configured
    // exposure — the log never states completion explicitly, only start
    // times, so truncation has to be inferred from that gap. duplicateOf
    // is corroborating evidence only, and is scoped within this run's own
    // image numbering (ASIAir restarts numbering per run, so a retry that
    // lands in a *different* AutorunRun — as happened on 2026-07-23's
    // image 43 — isn't linked here; see delivery notes).
    _flagTruncatedSubs(blocks, runEndedAt) {
        const allSubs = [];
        blocks.forEach(b => allSubs.push(...b.subs));

        for (let i = 0; i < allSubs.length; i++) {
            const sub = allSubs[i];
            const nextStart = (i + 1 < allSubs.length) ? allSubs[i + 1].startedAt : runEndedAt;
            if (!nextStart || !sub.startedAt || !sub.exposureS) continue;
            const elapsedS = (nextStart - sub.startedAt) / 1000;
            if (elapsedS < sub.exposureS * 0.9) {
                sub.aborted = true;
            }
        }

        const firstTruncatedByImageNo = new Map();
        for (const sub of allSubs) {
            if (sub.aborted && !firstTruncatedByImageNo.has(sub.imageNo)) {
                firstTruncatedByImageNo.set(sub.imageNo, sub);
            } else if (firstTruncatedByImageNo.has(sub.imageNo) && sub !== firstTruncatedByImageNo.get(sub.imageNo)) {
                sub.duplicateOf = firstTruncatedByImageNo.get(sub.imageNo).sequenceNo;
            }
        }
    },

    // Assembles one AutorunRun from a raw segment.
    _buildAutorunRun(segment, index) {
        const lines = segment.lines;
        const kind = this._extractRunKind(lines, segment.rawTarget);
        const { exposureS, exposureIsAuto } = this._extractRunExposure(lines);
        const blocks = kind === 'light' ? this._extractImagingBlocks(lines) : [];
        if (kind === 'light') this._flagTruncatedSubs(blocks, segment.endedAt);

        const events = [...this._extractRunEvents(lines), ...this._extractGuideFailureEvents(lines)]
            .sort((a, b) => (a.start || a.at || a.startedAt) - (b.start || b.at || b.startedAt));

        return {
            index,
            rawTarget: segment.rawTarget,
            target: this._normalizeTarget(segment.rawTarget),
            kind,
            plannedFrames: this._extractRunPlannedFrames(lines),
            exposureS,
            exposureIsAuto,
            binning: this._extractBinning(lines),
            coords: this._extractCoords(lines),
            startedAt: segment.startedAt,
            endedAt: segment.endedAt,
            endReason: segment.endReason,
            blocks,
            events,
        };
    },

    // -------------------------------------------------------------------------
    // Per-run event extraction (#230)
    // -------------------------------------------------------------------------

    _parseAfTrigger(line) {
        if (line.includes('Run AF before Autorun start')) return 'preRun';
        if (line.includes('Run AF after Auto Meridian filpped')) return 'postFlip'; // sic — ASIAir's own typo
        if (line.includes('Run AF when temperature changed')) return 'temperature';
        if (line.includes('Run AF ') && line.includes('hours later')) return 'interval';
        return 'manual';
    },

    // Either "temperature 14.8℃" (interval/preRun/postFlip triggers) or
    // "2.4℃ changed to 14.8℃" (temperature trigger) — either way the LAST
    // °C value on the line is the temperature at trigger time.
    _parseAfTemperature(line) {
        const matches = [...line.matchAll(/([\d.]+)℃/g)];
        if (matches.length === 0) return null;
        return parseFloat(matches[matches.length - 1][1]);
    },

    // Rich per-run event extraction: autofocus (item 4), guide calibration
    // (carried through unchanged for completeness, not a named #230 item),
    // meridian flip with configuredWaitS/flipNumber (item 9), dither,
    // manual-stop/cancel-AF interventions (item 7), plate-solve/AutoCenter
    // (item 8), mount events (item 9), and guide recovery (item 6). Imaging
    // exposure lines are traversed (to still catch embedded dithers) but
    // never emit an event of their own — that data lives in blocks[]
    // instead, built separately by _extractImagingBlocks.
    _extractRunEvents(lines) {
        const events = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // --- Autofocus ---
            if (line.includes('[AutoFocus|Begin]')) {
                const afStart = this._parseTimestamp(line);
                const trigger = this._parseAfTrigger(line);
                const temperatureC = this._parseAfTemperature(line);
                let afEnd = null;
                let settleEnd = null;
                let settleOutcome = null;
                let calLine = -1;
                let outcome = null;
                let focuserPosition = null;
                let achievedStarSize = null;
                const vCurve = [];
                const fineSweep = [];
                let j = i + 1;

                while (j < lines.length) {
                    const vMatch = lines[j].match(/Calculate V-Curve\s*:?\s*detect and calculate star size ([\d.]+)\s*,\s*EAF position (\d+)/);
                    if (vMatch) {
                        vCurve.push({ position: parseInt(vMatch[2]), starSize: parseFloat(vMatch[1]) });
                    }
                    const fMatch = lines[j].match(/Calculate Focus Point: detect and calculate star size ([\d.]+)\s*,\s*EAF position (\d+)/);
                    if (fMatch) {
                        fineSweep.push({ position: parseInt(fMatch[2]), starSize: parseFloat(fMatch[1]) });
                    }
                    const succeededMatch = lines[j].match(/Auto focus succeeded, the focused position is (\d+)/);
                    if (succeededMatch) {
                        focuserPosition = parseInt(succeededMatch[1]);
                        achievedStarSize = fineSweep.length > 0 ? fineSweep[fineSweep.length - 1].starSize : null;
                    }
                    if (lines[j].includes('Auto focus failed')) {
                        outcome = 'failed';
                        const fallbackMatch = lines[j].match(/returns to the position (\d+)/);
                        if (fallbackMatch) focuserPosition = parseInt(fallbackMatch[1]);
                    }
                    if (lines[j].includes('Cancel AF Manually')) {
                        outcome = 'cancelled';
                        events.push({ type: 'intervention', at: this._parseTimestamp(lines[j]), kind: 'cancelAf' });
                    }
                    if (lines[j].includes('[AutoFocus|End]')) {
                        afEnd = this._parseTimestamp(lines[j]);
                        if (!outcome) outcome = lines[j].includes('succeeded') ? 'success' : 'failed';
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
                            if (elapsedS === null || elapsedS <= APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S) {
                                settleEnd = t;
                                settleOutcome = terminator;
                            }
                            break;
                        }
                    }
                    if (j > i + 1 && (
                        lines[j].includes('[AutoFocus|Begin]') ||
                        lines[j].match(/Exposure \d+\.?\d*m?s image \d+#/) ||
                        lines[j].includes('[Meridian Flip|Begin]')
                    )) break;
                    j++;
                }

                const end = settleEnd || afEnd;
                if (afStart && end) {
                    events.push({
                        type: 'autofocus',
                        start: afStart,
                        end,
                        durationS: (end - afStart) / 1000,
                        trigger,
                        temperatureC,
                        outcome: outcome || 'success',
                        focuserPosition,
                        achievedStarSize,
                        settleOutcome,
                        vCurve,
                        fineSweep,
                    });
                }
                i = calLine >= 0 ? calLine : j + 1;
                continue;
            }

            // --- Guide Calibration (unchanged shape — not a named #230
            // item, carried through so events[] is complete) ---
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
                    i = result.line;
                }
                continue;
            }

            // --- Meridian flip (merged pause+flip, configuredWaitS/flipNumber — item 9) ---
            if (line.includes('[Meridian Flip|Begin]')) {
                const pauseStart = this._parseTimestamp(line);
                const waitMatch = line.match(/Wait (\d+)min(\d+)s to Meridian Flip/);
                const configuredWaitS = waitMatch ? parseInt(waitMatch[1]) * 60 + parseInt(waitMatch[2]) : null;
                let flipStart = null;
                let flipEnd = null;
                let flipNumber = null;
                let j = i + 1;

                // The post-flip AutoCenter/plate-solve sequence consistently
                // falls *between* "Meridian Flip N# Start" and
                // "[Meridian Flip|End]" in the corpus (all 4 validation
                // logs) — without this check it was being silently
                // swallowed by this loop's own j++ fallthrough, the same
                // class of bug the guide-recovery fix addressed.
                while (j < lines.length) {
                    const flipMatch = lines[j].match(/Meridian Flip (\d+)# Start/);
                    if (flipMatch) {
                        flipStart = this._parseTimestamp(lines[j]);
                        flipNumber = parseInt(flipMatch[1]);
                    }
                    if (lines[j].includes('[Meridian Flip|End]')) {
                        flipEnd = this._parseTimestamp(lines[j]);
                        break;
                    }
                    if (lines[j].match(/\[AutoCenter\|Begin\] Auto-Center \d+#/)) {
                        const { event, nextIndex } = this._scanPlateSolve(lines, j);
                        if (event) events.push(event);
                        j = nextIndex;
                        continue;
                    }
                    j++;
                }

                events.push({
                    type: 'meridian_flip',
                    pauseStartedAt: pauseStart,
                    configuredWaitS,
                    flipStartedAt: flipStart,
                    flipEndedAt: flipEnd,
                    flipNumber,
                    outcome: flipEnd ? 'succeeded' : null, // no failure string observed in corpus (log-format-survey §2.6)
                });
                i = j + 1;
                continue;
            }

            // --- Standalone dither ---
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
                    i = result.line;
                }
                continue;
            }

            // --- Intervention: manual stop (item 7) ---
            if (line.includes('Stop Autorun Manually')) {
                events.push({ type: 'intervention', at: this._parseTimestamp(line), kind: 'manualStop' });
                i++;
                continue;
            }
            if (line.includes('Cancel AF Manually')) {
                // Normally consumed inside the AF loop above; only reached
                // here if it appears outside any AF block.
                events.push({ type: 'intervention', at: this._parseTimestamp(line), kind: 'cancelAf' });
                i++;
                continue;
            }

            // --- Plate-solve / AutoCenter (item 8, top-level occurrence) —
            // see _scanPlateSolve below; also invoked from inside the
            // meridian-flip and imaging-block traversals, since that's
            // where almost every occurrence in the corpus actually lives. ---
            if (line.match(/\[AutoCenter\|Begin\] Auto-Center \d+#/)) {
                const { event, nextIndex } = this._scanPlateSolve(lines, i);
                if (event) events.push(event);
                i = nextIndex;
                continue;
            }

            // --- Mount events (item 9) ---
            if (line.match(/"ZWO\d+" is Disconnected/)) {
                events.push({ type: 'mount', at: this._parseTimestamp(line), kind: 'disconnected' });
                i++;
                continue;
            }
            if (line.includes('Mount GoTo Home POS')) {
                events.push({ type: 'mount', at: this._parseTimestamp(line), kind: 'gotoHome' });
                i++;
                continue;
            }
            if (line.includes('Start Tracking')) {
                events.push({ type: 'mount', at: this._parseTimestamp(line), kind: 'startTracking' });
                i++;
                continue;
            }
            if (line.includes('Stop Tracking')) {
                events.push({ type: 'mount', at: this._parseTimestamp(line), kind: 'stopTracking' });
                i++;
                continue;
            }

            // --- Guide recovery (item 6, top-level occurrence) — see
            // _scanGuideRecovery below; this same scan is also invoked from
            // inside the imaging-block traversal, since that's actually
            // where almost every occurrence in the corpus lives. ---
            if (line.includes('[Guide] Guide star lost')) {
                const { event, nextIndex } = this._scanGuideRecovery(lines, i);
                if (event) events.push(event);
                i = nextIndex;
                continue;
            }

            // --- Imaging block — skip; blocks[] already captures this via
            // _extractImagingBlocks, but embedded dithers AND guide-recovery
            // cycles must still be captured as events here (same
            // traversal as legacy _extractEvents uses internally). This
            // matters: in the M64 2026-05-11 log almost every "Guide star
            // lost" occurs *between* two exposure lines within a block, not
            // at the top level — an earlier version of this scan only
            // checked for it outside imaging blocks and silently swallowed
            // all of them via this branch's own j++ fallthrough. ---
            if (line.match(/Exposure \d+\.?\d*m?s image \d+#/)) {
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];

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
                            j = result.line;
                        }
                        continue;
                    }

                    if (nextLine.includes('[Guide] Guide star lost')) {
                        const { event, nextIndex } = this._scanGuideRecovery(lines, j);
                        if (event) events.push(event);
                        j = nextIndex;
                        continue;
                    }

                    if (nextLine.match(/\[AutoCenter\|Begin\] Auto-Center \d+#/)) {
                        const { event, nextIndex } = this._scanPlateSolve(lines, j);
                        if (event) events.push(event);
                        j = nextIndex;
                        continue;
                    }

                    if (nextLine.includes('Stop Autorun Manually')) {
                        events.push({ type: 'intervention', at: this._parseTimestamp(nextLine), kind: 'manualStop' });
                        j++;
                        continue;
                    }
                    if (nextLine.includes('Cancel AF Manually')) {
                        events.push({ type: 'intervention', at: this._parseTimestamp(nextLine), kind: 'cancelAf' });
                        j++;
                        continue;
                    }

                    if (nextLine.match(/Exposure \d+\.?\d*m?s image \d+#/)) {
                        j++;
                        continue;
                    }

                    if (nextLine.includes('[AutoFocus|Begin]') ||
                        nextLine.includes('[Meridian Flip|Begin]') ||
                        nextLine.includes('[Autorun|End]')) {
                        break;
                    }

                    j++;
                }
                i = j;
                continue;
            }

            i++;
        }

        return events;
    },

    // Shared by both the top-level scan and the imaging-block traversal
    // above — item 6, the M64 2026-05-11 pattern from the p1-3 handoff.
    // Reuses the same bounded-scan/terminator helpers as dither. A "Guide
    // Settle" line partway through is recorded as settleStartedAt when
    // present, but isn't required — ASIAir doesn't always log one before
    // silently resuming via ReSelect/Start Guiding.
    _scanGuideRecovery(lines, i) {
        const line = lines[i];
        const recoveryStart = this._parseTimestamp(line);
        const result = this._scanForwardBounded(lines, i + 1, recoveryStart, {
            matchFn: (l) => this._matchSettleTerminator(l),
            stopSet: this.SETTLE_SCAN_STOP_SET,
            timeLimitS: APP_CONFIG.ASIAIR_SETTLE_SCAN_TIMEOUT_S,
        });

        const scanEnd = Math.min(result.line, lines.length);
        let settleStartedAt = null;
        for (let k = i + 1; k < scanEnd; k++) {
            if (lines[k].includes('[Guide] Guide Settle')) {
                settleStartedAt = this._parseTimestamp(lines[k]);
                break;
            }
        }

        if (result.found) {
            const endedAt = this._parseTimestamp(lines[result.line]);
            return {
                event: {
                    type: 'guide_recovery',
                    startedAt: recoveryStart,
                    settleStartedAt,
                    endedAt,
                    outcome: result.matched,
                    durationS: (endedAt - recoveryStart) / 1000,
                    affectedImg: result.matched !== 'done'
                        ? this._affectedImgAfterLine(lines, result.line)
                        : null,
                },
                nextIndex: result.line + 1,
            };
        }

        // No settle terminator followed — fall back to the ReSelect/Start
        // Guiding point, since ASIAir doesn't always log an explicit settle
        // before resuming.
        let resumedAt = null;
        let k = i + 1;
        while (k < Math.min(i + 10, lines.length)) {
            if (lines[k].includes('[Guide] Start Guiding')) {
                resumedAt = this._parseTimestamp(lines[k]);
                k++;
                break;
            }
            if (lines[k].includes('[Guide] Guide star lost') ||
                lines[k].match(/Exposure \d+\.?\d*m?s image \d+#/)) break;
            k++;
        }

        if (resumedAt) {
            return {
                event: {
                    type: 'guide_recovery',
                    startedAt: recoveryStart,
                    settleStartedAt: null,
                    endedAt: resumedAt,
                    outcome: 'done',
                    durationS: (resumedAt - recoveryStart) / 1000,
                    affectedImg: null,
                },
                nextIndex: k,
            };
        }

        return { event: null, nextIndex: i + 1 };
    },

    // Shared by the top-level scan, the meridian-flip traversal, and the
    // imaging-block traversal — item 8. AutoCenter consistently occurs
    // right after "Meridian Flip N# Start" in this corpus (post-flip
    // recenter), so the meridian-flip and imaging-block call sites matter
    // as much as the top-level one.
    _scanPlateSolve(lines, i) {
        const line = lines[i];
        const attemptMatch = line.match(/Auto-Center (\d+)#/);
        const attemptNo = attemptMatch ? parseInt(attemptMatch[1]) : null;
        const at = this._parseTimestamp(line);
        let solved = null;
        let outcome = null;
        let offCentrePct = null;
        let offCentreDeg = null;
        let j = i + 1;

        while (j < lines.length) {
            const solveMatch = lines[j].match(/Solve succeeded: RA:(\d+)h(\d+)m(\d+)s\s*DEC:([+-]?\d+)°(\d+)'(\d+)"\s*Angle = ([\d.]+), Star number = (\d+)/);
            if (solveMatch) {
                const degWhole = parseInt(solveMatch[4]);
                const sign = degWhole < 0 ? -1 : 1;
                solved = {
                    solvedRa: parseInt(solveMatch[1]) + parseInt(solveMatch[2]) / 60 + parseInt(solveMatch[3]) / 3600,
                    solvedDec: sign * (Math.abs(degWhole) + parseInt(solveMatch[5]) / 60 + parseInt(solveMatch[6]) / 3600),
                    angleDeg: parseFloat(solveMatch[7]),
                    starNumber: parseInt(solveMatch[8]),
                };
            }
            if (lines[j].includes('[AutoCenter|End] The target is centered')) {
                outcome = 'centered';
                break;
            }
            const tooFar = lines[j].match(/\[AutoCenter\|End\] Too far from center, distance = (\d+)%\(([\d.]+)°\)/);
            if (tooFar) {
                outcome = 'tooFar';
                offCentrePct = parseInt(tooFar[1]);
                offCentreDeg = parseFloat(tooFar[2]);
                break;
            }
            if (lines[j].includes('[AutoCenter|End] Mount slews failed')) {
                outcome = 'mountSlewFailed';
                break;
            }
            const solveFailed = lines[j].match(/\[AutoCenter\|End\] Plate Solve failed, Star number = (\d+)/);
            if (solveFailed) {
                outcome = 'solveFailed';
                solved = solved || {};
                solved.starNumber = parseInt(solveFailed[1]);
                break;
            }
            if (lines[j].includes('[AutoCenter|Begin]') ||
                lines[j].match(/Exposure \d+\.?\d*m?s image \d+#/) ||
                lines[j].includes('[Autorun|End]')) break;
            j++;
        }

        return {
            event: {
                type: 'plate_solve',
                at,
                attemptNo,
                outcome,
                offCentrePct,
                offCentreDeg,
                solvedRa: solved ? solved.solvedRa : null,
                solvedDec: solved ? solved.solvedDec : null,
                angleDeg: solved ? solved.angleDeg : null,
                starNumber: solved ? solved.starNumber : null,
            },
            nextIndex: j + 1,
        };
    },

    // Simple, complete pass — every occurrence counts (design's P4:
    // complete evidence, not a sample), regardless of whether it also got
    // absorbed as noise inside a dither/AF/calibration/guide-recovery scan
    // above. #230 item 5.
    _extractGuideFailureEvents(lines) {
        const events = [];
        for (const line of lines) {
            if (line.includes('[Guide] Guide star lost')) {
                events.push({ type: 'guide_failure', at: this._parseTimestamp(line), kind: 'starLost' });
            } else if (line.includes('[Guide] Select Guide Star failed, no star found')) {
                events.push({ type: 'guide_failure', at: this._parseTimestamp(line), kind: 'selectFailed' });
            } else if (line.includes('[Guide] Start Tracking failed')) {
                events.push({ type: 'guide_failure', at: this._parseTimestamp(line), kind: 'trackingFailed' });
            }
        }
        return events;
    },

    // Top-level (not per-run): a Log disabled -> Log enabled gap normally
    // falls between two runs, not within one — #230 item 7.
    _extractLogGaps(allLines) {
        const gaps = [];
        let disabledAt = null;
        for (const line of allLines) {
            const disabledMatch = line.match(/^Log disabled at (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
            if (disabledMatch) {
                disabledAt = new Date(disabledMatch[1].replace(/\//g, '-').replace(' ', 'T'));
                continue;
            }
            const enabledMatch = line.match(/^Log enabled at (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
            if (enabledMatch && disabledAt) {
                const enabledAt = new Date(enabledMatch[1].replace(/\//g, '-').replace(' ', 'T'));
                gaps.push({ startedAt: disabledAt, endedAt: enabledAt, durationS: (enabledAt - disabledAt) / 1000 });
                disabledAt = null;
            }
        }
        return gaps;
    },

    // Top-level (not per-run): groups runs by the Plan Tonight window their
    // startedAt falls within, if any — #230 item 2. "Pause Plan Tonight"
    // isn't also emitted as a per-run InterventionEvent since it occurs
    // between runs, not within one; its outcome is captured here instead.
    _extractPlanRuns(allLines, runs) {
        const plans = [];
        let current = null;

        for (const line of allLines) {
            if (line.includes('Plan Tonight Start')) {
                current = { startedAt: this._parseTimestamp(line), endedAt: null, outcome: null, runIndexes: [] };
                continue;
            }
            if (current && (line.includes('Plan Tonight Finish') || line.includes('Pause Plan Tonight'))) {
                current.endedAt = this._parseTimestamp(line);
                current.outcome = line.includes('Pause Plan Tonight') ? 'paused' : 'finished';
                plans.push(current);
                current = null;
            }
        }
        if (current) plans.push(current);

        plans.forEach(plan => {
            plan.runIndexes = runs
                .filter(r => r.startedAt && plan.startedAt && r.startedAt >= plan.startedAt &&
                             (!plan.endedAt || r.startedAt <= plan.endedAt))
                .map(r => r.index);
        });

        return plans;
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
