/**
 * phd2-log-parser.js
 * Parses PHD2 guide log files into structured session data with anomaly detection.
 */

const Phd2LogParser = {

    // Anomaly thresholds
    THRESHOLDS: {
        rmsElevated:     2.0,   // arcsec — worth noting
        rmsHigh:         4.0,   // arcsec — major concern
        peakSpike:      20.0,   // arcsec — spike
        snrLow:         15.0,   // SNR units
        snrJumpFactor:   2.0,   // ratio vs previous session avg
        shortSession:   100,    // frames — likely an AF interruption
    },

    // PHD2 error code descriptions
    ERROR_CODES: {
        1: 'Star lost',
        2: 'Saturated star',
        3: 'Low SNR',
        4: 'Low mass',
        5: 'High mass',
        6: 'Star too close to edge',
        7: 'Star mass change',
        8: 'No star found',
    },

    /**
     * Parse a PHD2 guide log text into structured data.
     * @param {string} text - Raw log file contents
     * @param {object|null} asiairParsed - Optional parsed ASIAir data for sub correlation
     * @returns {object} Parsed guide data
     */
    parse(text, asiairParsed = null) {
        const lines = text.split('\n');

        const equipment = this._extractEquipment(lines);
        const sessions = this._extractSessions(lines, equipment.pixelScale);
        const overall = this._computeOverall(sessions, equipment);
        const anomalies = this._detectAnomalies(sessions, asiairParsed);
        const recommendations = this._buildRecommendations(sessions, anomalies, equipment, overall);
        const date = this._extractDate(lines);

        return { equipment, sessions, overall, anomalies, recommendations, date };
    },

    // -------------------------------------------------------------------------
    // Equipment extraction
    // -------------------------------------------------------------------------

    _extractEquipment(lines) {
        const eq = {
            pixelScale: null,
            focalLength: null,
            camera: null,
            exposureMs: null,
            mount: null,
            raAlgorithm: null,
            decAlgorithm: null,
        };

        for (const line of lines) {
            if (eq.pixelScale === null) {
                const m = line.match(/Pixel scale = ([\d.]+)/);
                if (m) eq.pixelScale = parseFloat(m[1]);
            }
            if (eq.focalLength === null) {
                const m = line.match(/Focal length = (\d+)/);
                if (m) eq.focalLength = parseInt(m[1]);
            }
            if (eq.camera === null) {
                const m = line.match(/Camera = ([^,]+)/);
                if (m) eq.camera = m[1].trim();
            }
            if (eq.exposureMs === null) {
                const m = line.match(/^Exposure = (\d+)/);
                if (m) eq.exposureMs = parseInt(m[1]);
            }
            if (eq.mount === null) {
                const m = line.match(/^Mount = ([^,]+)/);
                if (m) eq.mount = m[1].trim();
            }
            if (eq.raAlgorithm === null) {
                const m = line.match(/^RA Guide algorithm = ([^,]+)/);
                if (m) eq.raAlgorithm = m[1].trim();
            }
            if (eq.decAlgorithm === null) {
                const m = line.match(/^Dec Guide algorithm = ([^,]+)/);
                if (m) eq.decAlgorithm = m[1].trim();
            }
            // Stop once we have all equipment info (before first Guiding Begins)
            if (line.startsWith('Guiding Begins') && eq.pixelScale !== null) break;
        }

        return eq;
    },

    // -------------------------------------------------------------------------
    // Session extraction
    // -------------------------------------------------------------------------

    _extractSessions(lines, pixelScale) {
        const sessions = [];
        let current = null;
        let sessionNum = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('Guiding Begins')) {
                const m = line.match(/Guiding Begins at (.+)/);
                if (m) {
                    sessionNum++;
                    current = {
                        num: sessionNum,
                        startTime: m[1].trim(),
                        startLine: i + 1,
                        endTime: null,
                        endLine: null,
                        frames: [],
                        ditherEvents: [],
                        errorFrames: [],
                        incomplete: false,
                    };
                }
            }

            else if (line.startsWith('Guiding Ends') && current) {
                const m = line.match(/Guiding Ends at (.+)/);
                if (m) {
                    current.endTime = m[1].trim();
                    current.endLine = i + 1;
                }
                sessions.push(this._finalizeSession(current, pixelScale));
                current = null;
            }

            else if (current && line.startsWith('INFO:')) {
                if (line.includes('DITHER')) {
                    current.ditherEvents.push({ line: i + 1, text: line });
                }
            }

            else if (current) {
                const parts = line.split(',');
                if (parts.length >= 17 && /^\d+$/.test(parts[0].trim())) {
                    try {
                        const errorCode = parts.length > 17 && /^\d+$/.test(parts[17].trim())
                            ? parseInt(parts[17].trim()) : 0;
                        const frame = {
                            n:        parseInt(parts[0]),
                            t:        parseFloat(parts[1]),
                            raRaw:    parseFloat(parts[5]),
                            decRaw:   parseFloat(parts[6]),
                            snr:      parseFloat(parts[16]),
                            error:    errorCode,
                        };
                        frame.total = Math.sqrt(frame.raRaw ** 2 + frame.decRaw ** 2);
                        current.frames.push(frame);
                        if (errorCode !== 0) {
                            current.errorFrames.push({ ...frame, line: i + 1 });
                        }
                    } catch (e) {
                        // skip malformed lines
                    }
                }
            }
        }

        // Handle log ending without Guiding Ends
        if (current && current.frames.length > 0) {
            current.endTime = null;
            current.endLine = lines.length;
            current.incomplete = true;
            sessions.push(this._finalizeSession(current, pixelScale));
        }

        return sessions;
    },

    _finalizeSession(s, pixelScale) {
        const frames = s.frames;
        if (frames.length === 0) {
            return { ...s, stats: null };
        }

        const ps = pixelScale || 1;

        const raRms  = Math.sqrt(frames.reduce((sum, f) => sum + f.raRaw  ** 2, 0) / frames.length) * ps;
        const decRms = Math.sqrt(frames.reduce((sum, f) => sum + f.decRaw ** 2, 0) / frames.length) * ps;
        const totRms = Math.sqrt(frames.reduce((sum, f) => sum + f.total  ** 2, 0) / frames.length) * ps;
        const raPeak  = Math.max(...frames.map(f => Math.abs(f.raRaw)))  * ps;
        const decPeak = Math.max(...frames.map(f => Math.abs(f.decRaw))) * ps;
        const avgSnr  = frames.reduce((sum, f) => sum + f.snr, 0) / frames.length;

        // Unique error codes
        const errorCodes = [...new Set(s.errorFrames.map(f => f.error))];

        return {
            ...s,
            stats: { raRms, decRms, totRms, raPeak, decPeak, avgSnr, errorCodes },
        };
    },

    // -------------------------------------------------------------------------
    // Overall statistics
    // -------------------------------------------------------------------------

    _computeOverall(sessions, equipment) {
        const fullSessions = sessions.filter(s => s.stats && !s.incomplete &&
            s.frames.length >= this.THRESHOLDS.shortSession);

        if (fullSessions.length === 0) return null;

        const allFrames = fullSessions.flatMap(s => s.frames);
        const ps = equipment.pixelScale || 1;

        const raRms  = Math.sqrt(allFrames.reduce((sum, f) => sum + f.raRaw  ** 2, 0) / allFrames.length) * ps;
        const decRms = Math.sqrt(allFrames.reduce((sum, f) => sum + f.decRaw ** 2, 0) / allFrames.length) * ps;
        const totRms = Math.sqrt(allFrames.reduce((sum, f) => sum + f.total  ** 2, 0) / allFrames.length) * ps;
        const avgSnr  = allFrames.reduce((sum, f) => sum + f.snr, 0) / allFrames.length;
        const totalFrames = sessions.reduce((sum, s) => sum + s.frames.length, 0);
        const totalDithers = sessions.reduce((sum, s) => sum + s.ditherEvents.length, 0);

        return { raRms, decRms, totRms, avgSnr, totalFrames, totalDithers,
                 sessionCount: sessions.length, fullSessionCount: fullSessions.length };
    },

    // -------------------------------------------------------------------------
    // Anomaly detection
    // -------------------------------------------------------------------------

    _detectAnomalies(sessions, asiairParsed) {
        const anomalies = [];
        const T = this.THRESHOLDS;

        // Build SNR baseline from first few full sessions for jump detection
        const snrBaseline = sessions
            .filter(s => s.stats && s.frames.length >= T.shortSession)
            .slice(0, 5)
            .map(s => s.stats.avgSnr);
        const baselineSnr = snrBaseline.length > 0
            ? snrBaseline.reduce((a, b) => a + b, 0) / snrBaseline.length : null;

        for (const s of sessions) {
            if (!s.stats) continue;
            const { raRms, decRms, totRms, raPeak, decPeak, avgSnr, errorCodes } = s.stats;
            const timeRange = this._sessionTimeRange(s);
            const subs = asiairParsed ? this._correlateSubsToSession(s, asiairParsed) : null;
            const subNote = subs && subs.length > 0
                ? ` — affects subs ${subs[0]}–${subs[subs.length - 1]}`
                : '';

            // Short session
            if (s.frames.length < T.shortSession && !s.incomplete) {
                anomalies.push({
                    session: s.num,
                    severity: 'info',
                    type: 'short_session',
                    timeRange,
                    startLine: s.startLine,
                    message: `Short session (${s.frames.length} frames) — likely an autofocus interruption or guider restart`,
                });
            }

            // High RMS
            if (totRms >= T.rmsHigh) {
                anomalies.push({
                    session: s.num,
                    severity: 'critical',
                    type: 'high_rms',
                    timeRange,
                    startLine: s.startLine,
                    message: `High RMS: ${totRms.toFixed(2)}" total (RA ${raRms.toFixed(2)}", Dec ${decRms.toFixed(2)}")${subNote} — inspect carefully`,
                });
            } else if (totRms >= T.rmsElevated && s.frames.length >= T.shortSession) {
                anomalies.push({
                    session: s.num,
                    severity: 'warning',
                    type: 'elevated_rms',
                    timeRange,
                    startLine: s.startLine,
                    message: `Elevated RMS: ${totRms.toFixed(2)}" total (RA ${raRms.toFixed(2)}", Dec ${decRms.toFixed(2)}")${subNote}`,
                });
            }

            // Peak spikes
            if (raPeak >= T.peakSpike || decPeak >= T.peakSpike) {
                const axes = [];
                if (raPeak >= T.peakSpike) axes.push(`RA ${raPeak.toFixed(1)}"`);
                if (decPeak >= T.peakSpike) axes.push(`Dec ${decPeak.toFixed(1)}"`);
                anomalies.push({
                    session: s.num,
                    severity: totRms >= T.rmsHigh ? 'critical' : 'warning',
                    type: 'peak_spike',
                    timeRange,
                    startLine: s.startLine,
                    message: `Peak error spike: ${axes.join(', ')}${subNote}`,
                });
            }

            // Error codes
            for (const code of errorCodes) {
                const desc = this.ERROR_CODES[code] || `Unknown error ${code}`;
                const count = s.errorFrames.filter(f => f.error === code).length;
                anomalies.push({
                    session: s.num,
                    severity: count > 5 ? 'warning' : 'info',
                    type: 'error_code',
                    timeRange,
                    startLine: s.startLine,
                    message: `Error code ${code} (${desc}) — ${count} frame${count > 1 ? 's' : ''}`,
                });
            }

            // SNR drop
            if (avgSnr < T.snrLow && s.frames.length >= T.shortSession) {
                anomalies.push({
                    session: s.num,
                    severity: 'warning',
                    type: 'low_snr',
                    timeRange,
                    startLine: s.startLine,
                    message: `Low guide star SNR: avg ${avgSnr.toFixed(1)} — guide star may be too faint`,
                });
            }

            // SNR jump (guide star reselected)
            if (baselineSnr && avgSnr >= baselineSnr * T.snrJumpFactor &&
                s.frames.length >= T.shortSession) {
                anomalies.push({
                    session: s.num,
                    severity: 'info',
                    type: 'snr_jump',
                    timeRange,
                    startLine: s.startLine,
                    message: `Guide star SNR jumped to ${avgSnr.toFixed(1)} (baseline ~${baselineSnr.toFixed(1)}) — PHD2 likely reselected a brighter star`,
                });
            }

            // Incomplete session (log ended mid-session)
            if (s.incomplete) {
                anomalies.push({
                    session: s.num,
                    severity: 'info',
                    type: 'incomplete',
                    timeRange,
                    startLine: s.startLine,
                    message: `Session incomplete — log ended while guiding was active (likely end of night)`,
                });
            }
        }

        return anomalies;
    },

    // -------------------------------------------------------------------------
    // Sub correlation
    // -------------------------------------------------------------------------

    _correlateSubsToSession(guidingSession, asiairParsed) {
        if (!asiairParsed || !asiairParsed.events) return [];

        const gStart = this._parsePhd2Time(guidingSession.startTime);
        const gEnd   = guidingSession.endTime ? this._parsePhd2Time(guidingSession.endTime) : null;
        if (!gStart) return [];

        const matchedSubs = [];
        for (const event of asiairParsed.events) {
            if (event.type !== 'imaging') continue;
            if (!event.start) continue;
            const eStart = event.start;
            const eEnd   = event.end;
            // Check if imaging block overlaps with this guide session
            if (gEnd) {
                if (eStart < gEnd && eEnd > gStart) {
                    for (let n = event.firstImg; n <= event.lastImg; n++) {
                        matchedSubs.push(n);
                    }
                }
            } else {
                if (eStart >= gStart) {
                    for (let n = event.firstImg; n <= event.lastImg; n++) {
                        matchedSubs.push(n);
                    }
                }
            }
        }

        return [...new Set(matchedSubs)].sort((a, b) => a - b);
    },

    // -------------------------------------------------------------------------
    // Recommendations
    // -------------------------------------------------------------------------

    _buildRecommendations(sessions, anomalies, equipment, overall) {
        const recs = [];
        const T = this.THRESHOLDS;

        // Subs to inspect — from critical anomalies with sub correlation
        const subsToInspect = [];
        for (const a of anomalies) {
            if (a.severity === 'critical') {
                const m = a.message.match(/subs (\d+)–(\d+)/);
                if (m) {
                    for (let n = parseInt(m[1]); n <= parseInt(m[2]); n++) {
                        subsToInspect.push(n);
                    }
                }
            }
        }
        if (subsToInspect.length > 0) {
            const unique = [...new Set(subsToInspect)].sort((a, b) => a - b);
            recs.push({
                priority: 'high',
                message: `Carefully inspect subs ${unique[0]}–${unique[unique.length - 1]} for star trailing or elongation due to guiding anomalies`,
            });
        }

        // High RMS sessions without sub correlation
        const highRmsSessions = anomalies.filter(a => a.type === 'high_rms' && !a.message.includes('subs'));
        for (const a of highRmsSessions) {
            recs.push({
                priority: 'high',
                message: `Session ${a.session} (${a.timeRange}) had high RMS — inspect subs taken during this period`,
            });
        }

        // RA bias
        if (overall) {
            const raBias = overall.raRms / overall.decRms;
            if (raBias > 1.5) {
                recs.push({
                    priority: 'medium',
                    message: `RA error (${overall.raRms.toFixed(2)}") is consistently larger than Dec (${overall.decRms.toFixed(2)}") — consider reducing RA aggressiveness or checking for periodic error`,
                });
            } else if (raBias < 0.67) {
                recs.push({
                    priority: 'medium',
                    message: `Dec error (${overall.decRms.toFixed(2)}") is consistently larger than RA (${overall.raRms.toFixed(2)}") — check Dec backlash compensation settings`,
                });
            }
        }

        // Pixel scale
        if (equipment.pixelScale && equipment.pixelScale > 5.0) {
            recs.push({
                priority: 'low',
                message: `Pixel scale of ${equipment.pixelScale}"/px is coarse — a longer focal length guidescope would improve guiding resolution`,
            });
        }

        // Short sessions indicating frequent restarts
        const shortCount = anomalies.filter(a => a.type === 'short_session').length;
        if (shortCount > 3) {
            recs.push({
                priority: 'low',
                message: `${shortCount} short guide sessions detected — these are expected from autofocus interruptions`,
            });
        }

        // Error code 7 repeated
        const starMassErrors = anomalies.filter(a => a.type === 'error_code' && a.message.includes('code 7'));
        if (starMassErrors.length > 1) {
            recs.push({
                priority: 'medium',
                message: `Star mass change errors (code 7) occurred in ${starMassErrors.length} sessions — consider increasing star mass tolerance in PHD2`,
            });
        }

        return recs;
    },

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    _extractDate(lines) {
        for (const line of lines) {
            const m = line.match(/(\d{4}-\d{2}-\d{2})/);
            if (m) return m[1];
        }
        return '';
    },

    _sessionTimeRange(s) {
        const start = s.startTime ? s.startTime.slice(-8) : '?';
        const end   = s.endTime   ? s.endTime.slice(-8)   : '?';
        return `${start} – ${end}`;
    },

    _parsePhd2Time(timeStr) {
        if (!timeStr) return null;
        try {
            return new Date(timeStr.replace(' ', 'T'));
        } catch (e) {
            return null;
        }
    },

    // -------------------------------------------------------------------------
    // Formatting helpers (used by view)
    // -------------------------------------------------------------------------

    fmtArcsec(val) {
        return val.toFixed(2) + '"';
    },

    fmtSnr(val) {
        return val.toFixed(1);
    },

};
