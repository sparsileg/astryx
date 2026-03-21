/**
 * asiair-log-parser.js
 * Parses ASIAir Autorun log files into structured session data.
 */

const AsiairLogParser = {

    /**
     * Parse an ASIAir Autorun log text into structured session data.
     * @param {string} text - Raw log file contents
     * @returns {object} Parsed session data
     */
    parse(text) {
        const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);

        const target = this._extractTarget(lines);
        const date = this._extractDate(lines);
        const exposure = this._extractExposure(lines);
        const totalSubs = this._extractTotalSubs(lines);
        const events = this._extractEvents(lines);
        const summary = this._computeSummary(events);
        const recommendations = this._computeRecommendations(events, summary, exposure);

        return { target, date, exposure, totalSubs, events, summary, recommendations };
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

    // -------------------------------------------------------------------------
    // Event extraction
    // -------------------------------------------------------------------------

    _extractEvents(lines) {
        const events = [];
        this._subTimes = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // --- Autofocus ---
            if (line.includes('[AutoFocus|Begin]')) {
                const afStart = this._parseTimestamp(line);
                let afEnd = null;
                let settleEnd = null;
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
                    if (lines[j].includes('[Guide] Settle Done') && afEnd) {
                        settleEnd = this._parseTimestamp(lines[j]);
                        break;
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
                        durationS: (end - afStart) / 1000
                    });
                }
                i = calLine >= 0 ? calLine : j + 1;
                continue;
            }

            // --- Guide Calibration (after meridian flip) ---
            if (line.includes('[Guide] Start Calibrating')) {
                const calStart = this._parseTimestamp(line);
                let settleEnd = null;
                let j = i + 1;

                while (j < lines.length) {
                    if (lines[j].includes('[Guide] Settle Done')) {
                        settleEnd = this._parseTimestamp(lines[j]);
                        break;
                    }
                    if (lines[j].includes('Exposure')) break;
                    j++;
                }

                if (calStart && settleEnd) {
                    events.push({
                        type: 'guide_calibration',
                        start: calStart,
                        end: settleEnd,
                        durationS: (settleEnd - calStart) / 1000
                    });
                }
                i = j + 1;
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
                let settleEnd = null;
                let j = i + 1;

                while (j < lines.length) {
                    if (lines[j].includes('[Guide] Settle Done')) {
                        settleEnd = this._parseTimestamp(lines[j]);
                        break;
                    }
                    j++;
                }

                if (ditherStart && settleEnd) {
                    events.push({
                        type: 'dither',
                        start: ditherStart,
                        end: settleEnd,
                        durationS: (settleEnd - ditherStart) / 1000
                    });
                }
                i = j + 1;
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
                        let k = j + 1;
                        while (k < lines.length) {
                            if (lines[k].includes('[Guide] Settle Done')) {
                                const ditherEnd = this._parseTimestamp(lines[k]);
                                events.push({
                                    type: 'dither',
                                    start: ditherStart,
                                    end: ditherEnd,
                                    durationS: (ditherEnd - ditherStart) / 1000
                                });
                                break;
                            }
                            k++;
                        }
                        j = k + 1;
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

        return events;
    },

    _extractExposureFromLine(line) {
        const m = line.match(/Exposure ([\d.]+)s/);
        return m ? parseFloat(m[1]) : 300;
    },

    // -------------------------------------------------------------------------
    // Summary computation
    // -------------------------------------------------------------------------

    _computeSummary(events) {
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
        const totalTrackedS = imagingTotalS + afTotalS + calTotalS + meridianTotalS + ditherTotalS;

        const totalSubs = imaging.reduce((s, e) => s + e.subCount, 0);

        const afAvgS = afs.length > 0 ? afTotalS / afs.length : 0;
        const calAvgS = cals.length > 0 ? calTotalS / cals.length : 0;
        const ditherAvgS = allDithers.length > 0 ? ditherTotalS / allDithers.length : 0;
        const ditherAmortizedS = totalSubs > 0 ? ditherTotalS / totalSubs : 0;


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
            ditherAmortizedS,
            totalTrackedS,
            totalSubs,
            imagingPct: totalTrackedS > 0 ? (imagingTotalS / totalTrackedS) * 100 : 0,
            afPct: totalTrackedS > 0 ? (afTotalS / totalTrackedS) * 100 : 0,
            calPct: totalTrackedS > 0 ? (calTotalS / totalTrackedS) * 100 : 0,
            meridianPct: totalTrackedS > 0 ? (meridianTotalS / totalTrackedS) * 100 : 0,
            ditherPct: totalTrackedS > 0 ? (ditherTotalS / totalTrackedS) * 100 : 0,
        };
    },

    // -------------------------------------------------------------------------
    // Recommendations
    // -------------------------------------------------------------------------

    _computeRecommendations(events, summary, exposure) {
        const exp = exposure || 300;

        // Extract all sub timestamps in order from imaging events
        // We need raw sub times — collect from events as {imgNum, start}
        const subTimes = [];
        events.filter(e => e.type === 'imaging').forEach(block => {
            // Reconstruct individual sub start times from block start + index * (exp + ~gap)
            // Instead, use the raw lines approach via the event timestamps we have.
            // block.start = first sub start, block.end = last sub start + exp
            // We only have block boundaries, not individual sub times here.
            // So we mark the block boundaries for gap detection.
        });

        // Build a sorted list of all non-imaging event time ranges for interruption detection
        const interruptions = events
            .filter(e => e.type !== 'imaging')
            .map(e => ({ start: e.start, end: e.end }));

        const isInterrupted = (t1, t2) => {
            return interruptions.some(iv => iv.start >= t1 && iv.start < t2);
        };

        // We need individual sub start times — store them during parse via _subTimes
        // Since we don't have them here, compute from imaging blocks:
        // For each block, consecutive subs are separated by (blockDuration / (subCount-1))
        // but that averages in dithers. Instead, pass _subTimes from _extractEvents.
        const subTimesRaw = this._subTimes || [];
        const cleanGaps = [];

        for (let i = 1; i < subTimesRaw.length; i++) {
            const prev = subTimesRaw[i - 1];
            const curr = subTimesRaw[i];
            if (!isInterrupted(prev, curr)) {
                const delta = (curr - prev) / 1000; // seconds
                cleanGaps.push(delta - exp);
            }
        }

        const interSubGapS = cleanGaps.length > 0
            ? cleanGaps.reduce((s, g) => s + g, 0) / cleanGaps.length
            : 0;

        // Subs per dither (integer, 0 if no dithers)
        const subsPerDither = summary.ditherCount > 0
            ? Math.floor(summary.totalSubs / summary.ditherCount)
            : 0;

        // Between-subs setting = amortized dither + inter-sub gap, rounded
        const betweenSubsS = summary.ditherCount > 0
            ? Math.round(summary.ditherAmortizedS + interSubGapS)
            : Math.round(interSubGapS);

        return {
            afDurationS: summary.afAvgS,
            calDurationS: summary.calAvgS,
            interSubGapS,
            subsPerDither,
            betweenSubsS,
        };
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
