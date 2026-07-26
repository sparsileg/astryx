/**
 * phd2-log-parser.js
 * Parses PHD2 guide log files into structured session data with anomaly detection.
 */

const Phd2LogParser = {

    // Anomaly thresholds — sourced from APP_CONFIG, not literals here.
    // Kept as Phd2LogParser.THRESHOLDS so existing consumers (e.g.
    // phd2-log-view.js) don't need to know about APP_CONFIG directly.
    // A getter, not a plain property — APP_CONFIG.PHD2_GUIDE_THRESHOLDS must
    // only be read once config.js has actually loaded, and this file's own
    // script-tag order relative to config.js isn't guaranteed. A plain
    // property reference is evaluated the instant this object literal is
    // built, so if it ran first it would throw and leave Phd2LogParser
    // permanently uninitialized (JS's temporal-dead-zone behavior for a
    // const whose initializer throws) — a getter defers the read until
    // something actually asks for .THRESHOLDS, by which point every script
    // has loaded regardless of tag order.
    get THRESHOLDS() {
        return APP_CONFIG.PHD2_GUIDE_THRESHOLDS;
    },

    // PHD2 error code descriptions.
    // Fallback only — used when a Mount row carries a nonzero error code but no
    // reason string (28 such rows in the 19-log corpus, all code 6... wait code 7).
    // Corrected against the log's own column-18 reason text (see ELR.p1-1).
    // Codes 1, 5, 8 have never been observed in the corpus and are intentionally
    // omitted rather than guessed; unmapped codes fall through to "Unknown error N".
    ERROR_CODES: {
        2: 'Star lost - low SNR',
        3: 'Star lost - low mass',
        4: 'Star lost - low HFD',
        6: 'Star lost - mass changed',
        7: 'No star found',
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

        // Flag when sessions don't share one pixel scale (e.g. a night that
        // mixes Bin1 and Bin2), since the report header shows a single
        // equipment summary that would otherwise silently misrepresent it.
        const sessionScales = sessions
            .map(s => s.equipment && s.equipment.pixelScaleArcsec)
            .filter(v => v != null);
        equipment.sessionPixelScales = [...new Set(sessionScales)];
        equipment.variesAcrossSessions = equipment.sessionPixelScales.length > 1;

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

    // Header scan bound — PHD2's header block is ~13 lines; 30 gives headroom
    // without risking an unbounded scan (Principle 1).
    HEADER_SCAN_LIMIT: 30,

    // Bounded scan for the equipment header PHD2 writes immediately after a
    // Guiding Begins line. Stops at the first guide-data row, the CSV header,
    // or any Begins/Ends marker — never scans past the block that belongs to
    // this session. Only called for Guiding Begins, never Calibration Begins,
    // so calibration headers (46 of 557 in the corpus) never leak into a
    // session's equipment by construction.
    _extractSessionHeader(lines, startIdx) {
        const eq = {
            pixelScaleArcsec: null,
            binning: null,
            focalLengthMm: null,
            cameraModel: null,
            guideExposureMs: null,
            mount: null,
            searchRegionPx: null,
            starMassTolerancePct: null,
        };

        const limit = Math.min(startIdx + this.HEADER_SCAN_LIMIT, lines.length);
        for (let j = startIdx; j < limit; j++) {
            const line = lines[j].trim();

            if (line.startsWith('Guiding Begins') || line.startsWith('Guiding Ends') ||
                line.startsWith('Calibration Begins') || line.startsWith('Frame,Time,mount') ||
                /^\d+,/.test(line)) {
                break;
            }

            if (eq.pixelScaleArcsec === null) {
                const m = line.match(/Pixel scale = ([\d.]+)/);
                if (m) eq.pixelScaleArcsec = parseFloat(m[1]);
            }
            if (eq.binning === null) {
                const m = line.match(/Binning = (\d+)/);
                if (m) eq.binning = parseInt(m[1]);
            }
            if (eq.focalLengthMm === null) {
                const m = line.match(/Focal length = (\d+)/);
                if (m) eq.focalLengthMm = parseInt(m[1]);
            }
            if (eq.searchRegionPx === null) {
                const m = line.match(/Search region = (\d+)/);
                if (m) eq.searchRegionPx = parseInt(m[1]);
            }
            if (eq.starMassTolerancePct === null) {
                const m = line.match(/Star mass tolerance = ([\d.]+)%/);
                if (m) eq.starMassTolerancePct = parseFloat(m[1]);
            }
            if (eq.cameraModel === null) {
                const m = line.match(/^Camera = ([^,]+)/);
                if (m) eq.cameraModel = m[1].trim();
            }
            if (eq.guideExposureMs === null) {
                const m = line.match(/^Exposure = (\d+)/);
                if (m) eq.guideExposureMs = parseInt(m[1]);
            }
            if (eq.mount === null) {
                const m = line.match(/^Mount = ([^,]+)/);
                if (m) eq.mount = m[1].trim();
            }
        }

        return eq;
    },

    _extractSessions(lines, fallbackPixelScale) {
        const sessions = [];
        let current = null;
        let sessionNum = 0;
        // Tracks the currently-open settle window, if any. Only a 'started'
        // marker opens one; the first terminator (complete or failed) closes
        // it. Repeated terminators, or a terminator with nothing open, are
        // ignored — see the corpus sequence table in ELR.p1-2.
        let openSettleWindow = null;

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
                        equipment: this._extractSessionHeader(lines, i + 1),
                        frames: [],
                        drops: [],
                        ditherEvents: [],
                        errorFrames: [],
                        settled: true,
                        settleWindows: [],
                        incomplete: false,
                    };
                    openSettleWindow = null;
                }
            }

            else if (line.startsWith('Guiding Ends') && current) {
                const m = line.match(/Guiding Ends at (.+)/);
                if (m) {
                    current.endTime = m[1].trim();
                    current.endLine = i + 1;
                }
                if (openSettleWindow) {
                    openSettleWindow.endedAt = i + 1;
                    openSettleWindow.outcome = 'unclosed';
                    current.settleWindows.push(openSettleWindow);
                    openSettleWindow = null;
                }
                sessions.push(this._finalizeSession(current, fallbackPixelScale));
                current = null;
            }

            else if (current && line.startsWith('INFO:')) {
                if (line.includes('DITHER')) {
                    current.ditherEvents.push({ line: i + 1, text: line });
                } else if (line.includes('SETTLING STATE CHANGE')) {
                    if (line.includes('Settling started')) {
                        current.settled = false;
                        openSettleWindow = { startedAt: i + 1, endedAt: null, outcome: null };
                    } else if (line.includes('Settling complete') || line.includes('Settling failed')) {
                        if (openSettleWindow) {
                            openSettleWindow.endedAt = i + 1;
                            openSettleWindow.outcome = line.includes('Settling complete') ? 'complete' : 'failed';
                            current.settleWindows.push(openSettleWindow);
                            openSettleWindow = null;
                            current.settled = true;
                        }
                        // No open window (repeated/stray terminator, e.g. failed
                        // after complete) — nothing to close, ignore per spec.
                    }
                }
            }

            else if (current) {
                const parts = line.split(',');
                if (parts.length >= 17 && /^\d+$/.test(parts[0].trim())) {
                    const rowType = parts[2].trim().replace(/^"|"$/g, '');
                    try {
                        if (rowType === 'Mount') {
                            const errorCode = parts.length > 17 && /^\d+$/.test(parts[17].trim())
                                ? parseInt(parts[17].trim()) : 0;
                            const frame = {
                                n:        parseInt(parts[0]),
                                t:        parseFloat(parts[1]),
                                raRaw:    parseFloat(parts[5]),
                                decRaw:   parseFloat(parts[6]),
                                snr:      parseFloat(parts[16]),
                                error:    errorCode,
                                settled:  current.settled,
                            };
                            frame.total = Math.sqrt(frame.raRaw ** 2 + frame.decRaw ** 2);
                            current.frames.push(frame);
                            if (errorCode !== 0) {
                                current.errorFrames.push({ ...frame, line: i + 1 });
                            }
                        } else if (rowType === 'DROP') {
                            const errorCode = parts.length > 17 && /^\d+$/.test(parts[17].trim())
                                ? parseInt(parts[17].trim()) : 0;
                            const reason = parts.length > 18
                                ? parts[18].trim().replace(/^"|"$/g, '')
                                : '';
                            current.drops.push({
                                n:        parseInt(parts[0]),
                                t:        parseFloat(parts[1]),
                                starMass: parseFloat(parts[15]),
                                snr:      parseFloat(parts[16]),
                                errorCode,
                                reason,
                                line: i + 1,
                            });
                        }
                        // Any other row type in column 3 is ignored (not currently observed
                        // in the corpus; safer to skip than to misclassify).
                    } catch (e) {
                        // skip malformed lines
                    }
                }
            }
        }

        // Handle log ending without Guiding Ends
        if (current && (current.frames.length > 0 || current.drops.length > 0)) {
            current.endTime = null;
            current.endLine = lines.length;
            current.incomplete = true;
            sessions.push(this._finalizeSession(current, fallbackPixelScale));
        }

        return sessions;
    },

    // Frames with valid, finite RA/Dec guide error values. Mount rows should
    // always satisfy this after the row-type split above; this filter is
    // retained as a defense-in-depth guard against any other malformed row
    // slipping past the column-3 check, not as the primary fix.
    _finiteFrames(frames) {
        return frames.filter(f => Number.isFinite(f.raRaw) && Number.isFinite(f.decRaw));
    },

    // Computes RMS/peak stats for one frame set at one pixel scale.
    // Returns null for an empty set rather than dividing by zero.
    _rmsStats(frames, ps) {
        if (frames.length === 0) return null;
        const raRms  = Math.sqrt(frames.reduce((sum, f) => sum + f.raRaw  ** 2, 0) / frames.length) * ps;
        const decRms = Math.sqrt(frames.reduce((sum, f) => sum + f.decRaw ** 2, 0) / frames.length) * ps;
        const totRms = Math.sqrt(frames.reduce((sum, f) => sum + f.total  ** 2, 0) / frames.length) * ps;
        const raPeak  = Math.max(...frames.map(f => Math.abs(f.raRaw)))  * ps;
        const decPeak = Math.max(...frames.map(f => Math.abs(f.decRaw))) * ps;
        return { raRms, decRms, totRms, raPeak, decPeak };
    },

    _finalizeSession(s, fallbackPixelScale) {
        const allFinite = this._finiteFrames(s.frames);
        const dropCount = s.drops.length;

        if (allFinite.length === 0) {
            return { ...s, stats: null, dropCount };
        }

        const ps = (s.equipment && s.equipment.pixelScaleArcsec) || fallbackPixelScale || 1;
        const settledFinite = allFinite.filter(f => f.settled);

        const settled = this._rmsStats(settledFinite, ps);
        const all = this._rmsStats(allFinite, ps);
        const avgSnr = allFinite.reduce((sum, f) => sum + f.snr, 0) / allFinite.length;

        // Unique error codes (Mount-row errors only; DROP-row errors are
        // handled separately in _detectAnomalies via s.drops)
        const errorCodes = [...new Set(s.errorFrames.map(f => f.error))];

        return {
            ...s,
            dropCount,
            stats: {
                // Settled-only — the primary, headline metric. null if every
                // frame in this session fell inside a dither-settle window.
                raRms:  settled ? settled.raRms  : null,
                decRms: settled ? settled.decRms : null,
                totRms: settled ? settled.totRms : null,
                raPeak: settled ? settled.raPeak : null,
                decPeak: settled ? settled.decPeak : null,
                // All-frames — retained as secondary figures (ELR.p1-2 Change 3).
                raRmsAll:  all.raRms,
                decRmsAll: all.decRms,
                totRmsAll: all.totRms,
                raPeakAll: all.raPeak,
                decPeakAll: all.decPeak,
                settledFrameCount: settledFinite.length,
                totalFiniteFrameCount: allFinite.length,
                avgSnr,
                errorCodes,
            },
        };
    },

    // -------------------------------------------------------------------------
    // Overall statistics
    // -------------------------------------------------------------------------

    // Converts a session's raw-pixel frames to arcseconds using one scale.
    // Used when combining frames across sessions that may have different
    // pixel scales (mixed binning nights) — conversion must happen per
    // session, before frames from different sessions are ever combined.
    _toArcsecFrames(frames, ps) {
        return frames.map(f => ({
            raArc:  f.raRaw * ps,
            decArc: f.decRaw * ps,
            totArc: f.total * ps,
            snr:    f.snr,
        }));
    },

    _computeOverall(sessions, equipment) {
        const fullSessions = sessions.filter(s => s.stats && !s.incomplete &&
            s.frames.length >= this.THRESHOLDS.SHORT_SESSION);

        if (fullSessions.length === 0) return null;

        const fallbackPs = equipment.pixelScale || 1;
        const T = this.THRESHOLDS;

        // Sessions whose own settled RMS already clears the critical
        // threshold (e.g. a guide-star swap) are excluded from the pooled
        // headline number — they're already called out individually in
        // Anomalies & Recommendations, and pooling them in would let one
        // catastrophic session dominate the whole night's reported quality.
        // A session with null settled RMS (no settled frames at all) can't
        // be judged critical or not, so it's included by default rather
        // than silently dropped.
        const pooledSessions = fullSessions.filter(s =>
            s.stats.totRms === null || s.stats.totRms < T.RMS_CRITICAL
        );
        const excludedCount = fullSessions.length - pooledSessions.length;

        const allArc = [];
        const settledArc = [];
        for (const s of pooledSessions) {
            const ps = (s.equipment && s.equipment.pixelScaleArcsec) || fallbackPs;
            const finite = this._finiteFrames(s.frames);
            const arc = this._toArcsecFrames(finite, ps);
            allArc.push(...arc);
            settledArc.push(...arc.filter((_, idx) => finite[idx].settled));
        }
        if (allArc.length === 0) return null;

        const rmsOf = (arr, key) => Math.sqrt(arr.reduce((sum, f) => sum + f[key] ** 2, 0) / arr.length);

        const avgSnr = allArc.reduce((sum, f) => sum + f.snr, 0) / allArc.length;
        const totalFrames = sessions.reduce((sum, s) => sum + s.frames.length, 0);
        const totalDithers = sessions.reduce((sum, s) => sum + s.ditherEvents.length, 0);

        return {
            // Settled-only — primary, headline metric. null if the whole
            // night's finite frames all fell inside settle windows.
            raRms:  settledArc.length ? rmsOf(settledArc, 'raArc')  : null,
            decRms: settledArc.length ? rmsOf(settledArc, 'decArc') : null,
            totRms: settledArc.length ? rmsOf(settledArc, 'totArc') : null,
            // All-frames — secondary (ELR.p1-2 Change 3).
            raRmsAll:  rmsOf(allArc, 'raArc'),
            decRmsAll: rmsOf(allArc, 'decArc'),
            totRmsAll: rmsOf(allArc, 'totArc'),
            avgSnr, totalFrames, totalDithers,
            sessionCount: sessions.length, fullSessionCount: fullSessions.length,
            excludedCriticalSessionCount: excludedCount,
        };
    },

    // -------------------------------------------------------------------------
    // Anomaly detection
    // -------------------------------------------------------------------------

    _detectAnomalies(sessions, asiairParsed) {
        const anomalies = [];
        const T = this.THRESHOLDS;

        // Build SNR baseline from first few full sessions for jump detection
        const snrBaseline = sessions
            .filter(s => s.stats && s.frames.length >= T.SHORT_SESSION)
            .slice(0, 5)
            .map(s => s.stats.avgSnr);
        const baselineSnr = snrBaseline.length > 0
            ? snrBaseline.reduce((a, b) => a + b, 0) / snrBaseline.length : null;

        for (const s of sessions) {
            if (!s.stats) continue;
            const { raRms, decRms, totRms, raPeak, decPeak, avgSnr } = s.stats;
            const timeRange = this._sessionTimeRange(s);
            const subs = asiairParsed ? this._correlateSubsToSession(s, asiairParsed) : null;
            const subNote = subs && subs.length > 0
                ? ` — affects subs ${subs[0]}–${subs[subs.length - 1]}`
                : '';

            // Short session
            if (s.frames.length < T.SHORT_SESSION && !s.incomplete) {
                anomalies.push({
                    session: s.num,
                    severity: 'info',
                    type: 'short_session',
                    timeRange,
                    startLine: s.startLine,
                    message: `Short session (${s.frames.length} frames) — likely an autofocus interruption or guider restart`,
                });
            }

            // RMS tiers — evaluated against settled RMS (the headline metric).
            // totRms is null only when every finite frame in the session fell
            // inside a dither-settle window; skip RMS-based checks rather than
            // guess at a number that doesn't exist.
            if (totRms !== null) {
                if (totRms >= T.RMS_CRITICAL) {
                    anomalies.push({
                        session: s.num,
                        severity: 'critical',
                        type: 'critical_rms',
                        timeRange,
                        startLine: s.startLine,
                        message: `Critical RMS: ${totRms.toFixed(2)}" total (RA ${raRms.toFixed(2)}", Dec ${decRms.toFixed(2)}")${subNote} — inspect carefully`,
                    });
                } else if (totRms >= T.RMS_HIGH) {
                    anomalies.push({
                        session: s.num,
                        severity: 'warning',
                        type: 'high_rms',
                        timeRange,
                        startLine: s.startLine,
                        message: `High RMS: ${totRms.toFixed(2)}" total (RA ${raRms.toFixed(2)}", Dec ${decRms.toFixed(2)}")${subNote}`,
                    });
                } else if (totRms >= T.RMS_ELEVATED && s.frames.length >= T.SHORT_SESSION) {
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
                if (raPeak >= T.PEAK_SPIKE || decPeak >= T.PEAK_SPIKE) {
                    const axes = [];
                    if (raPeak >= T.PEAK_SPIKE) axes.push(`RA ${raPeak.toFixed(1)}"`);
                    if (decPeak >= T.PEAK_SPIKE) axes.push(`Dec ${decPeak.toFixed(1)}"`);
                    anomalies.push({
                        session: s.num,
                        severity: totRms >= T.RMS_CRITICAL ? 'critical' : 'warning',
                        type: 'peak_spike',
                        timeRange,
                        startLine: s.startLine,
                        message: `Peak error spike: ${axes.join(', ')}${subNote}`,
                    });
                }
            } else {
                anomalies.push({
                    session: s.num,
                    severity: 'info',
                    type: 'no_settled_data',
                    timeRange,
                    startLine: s.startLine,
                    message: `No settled frames — every frame in this session fell inside a dither-settle window (all-frames RMS ${s.stats.totRmsAll.toFixed(2)}" shown for reference only)`,
                });
            }

            // Error codes — grouped from DROP-row reason strings (authoritative,
            // straight from the log) plus any Mount-row error codes, which have
            // no reason string and fall back to the corrected ERROR_CODES table.
            const errorGroups = new Map();
            for (const d of s.drops) {
                const key = d.reason ? `reason:${d.reason}` : `code:${d.errorCode}`;
                if (!errorGroups.has(key)) {
                    errorGroups.set(key, {
                        code: d.errorCode,
                        desc: d.reason || `Unknown error ${d.errorCode}`,
                        inferred: false,
                        count: 0,
                    });
                }
                errorGroups.get(key).count++;
            }
            for (const f of s.errorFrames) {
                const key = `mount:${f.error}`;
                if (!errorGroups.has(key)) {
                    errorGroups.set(key, {
                        code: f.error,
                        desc: this.ERROR_CODES[f.error] || `Unknown error ${f.error}`,
                        inferred: true,
                        count: 0,
                    });
                }
                errorGroups.get(key).count++;
            }
            for (const [, g] of errorGroups) {
                const inferredNote = g.inferred ? ' (inferred)' : '';
                anomalies.push({
                    session: s.num,
                    severity: g.count > 5 ? 'warning' : 'info',
                    type: 'error_code',
                    code: g.code,
                    timeRange,
                    startLine: s.startLine,
                    message: `${g.desc}${inferredNote} (code ${g.code}) — ${g.count} frame${g.count > 1 ? 's' : ''}`,
                });
            }

            // SNR drop
            if (avgSnr < T.SNR_LOW && s.frames.length >= T.SHORT_SESSION) {
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
            if (baselineSnr && avgSnr >= baselineSnr * T.SNR_JUMP_FACTOR &&
                s.frames.length >= T.SHORT_SESSION) {
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

        // Critical RMS sessions without sub correlation (this used to check
        // type === 'high_rms', but that name now means the new, less severe
        // 2.0"–4.0" band — the >=4.0" tier this recommendation always meant
        // is now named critical_rms)
        const criticalRmsSessions = anomalies.filter(a => a.type === 'critical_rms' && !a.message.includes('subs'));
        for (const a of criticalRmsSessions) {
            recs.push({
                priority: 'high',
                message: `Session ${a.session} (${a.timeRange}) had critical RMS — inspect subs taken during this period`,
            });
        }

        // RA bias
        if (overall && overall.raRms !== null) {
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

        // Star mass change (code 6) repeated — this used to key on code 7, which
        // under the corrected ERROR_CODES map is "No star found", not a mass
        // change; also switched from message substring matching to the
        // structured anomaly.code field so this can't drift out of sync again.
        const starMassErrors = anomalies.filter(a => a.type === 'error_code' && a.code === 6);
        if (starMassErrors.length > 1) {
            recs.push({
                priority: 'medium',
                message: `Star mass change errors (code 6) occurred in ${starMassErrors.length} sessions — consider increasing star mass tolerance in PHD2`,
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

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
