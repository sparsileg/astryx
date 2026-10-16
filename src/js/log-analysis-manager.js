/**
 * log-analysis-manager.js
 * The Log Analysis steps that don't touch the screen, shared by the Log
 * Analysis view and the desktop `analyze-logs` command (issue #293): which
 * kind of log a file is, whether a pair is from the same night, and the
 * fused night with its report context.
 */

const LogAnalysisManager = {
    /**
     * Parse a log, identified by its first line. Returns
     * { kind: 'session' | 'guide', parsed }, or null for a file that's
     * neither. Parsing performs no writes; learning from a Session Log is
     * the caller's deliberate AsiairLogParser.updateLearnedValues() call.
     */
    parseLog(text) {
        if (AsiairLogParser.isAutorunLog(text)) return { kind: 'session', parsed: AsiairLogParser.parse(text) };
        if (Phd2LogParser.isGuideLog(text)) return { kind: 'guide', parsed: Phd2LogParser.parse(text) };
        return null;
    },

    /**
     * When each log runs: { session: {start, end}, guide: {start, end} }
     * as Dates, or null when either log is missing or has no times to
     * compare. A guide log that's still open ends at its last session's
     * start.
     */
    logTimeRanges(asiairParsed, phd2Parsed) {
        const wallClock = asiairParsed?.wallClock;
        const sessions = phd2Parsed?.sessions ?? [];
        if (!wallClock?.start || !wallClock?.end || sessions.length === 0) return null;
        const last = sessions[sessions.length - 1];
        const guideStart = Phd2LogParser._parsePhd2Time(sessions[0].startTime);
        const guideEnd = Phd2LogParser._parsePhd2Time(last.endTime ?? last.startTime);
        if (!guideStart || !guideEnd) return null;
        return {
            session: { start: wallClock.start, end: wallClock.end },
            guide: { start: guideStart, end: guideEnd },
        };
    },

    /**
     * Whether the PHD2 log's guiding overlaps the Session Log's imaging.
     * Comparing times rather than dates catches consecutive nights, and
     * still pairs a guide log that began after midnight. True when either
     * log is missing or has no times to compare.
     */
    logsFromSameNight(asiairParsed, phd2Parsed) {
        const ranges = this.logTimeRanges(asiairParsed, phd2Parsed);
        if (!ranges) return true;
        return ranges.guide.start <= ranges.session.end && ranges.guide.end >= ranges.session.start;
    },

    /**
     * The Combined Report's data (ELR.p5-1) for a Session Log, with or
     * without the PHD2 log: { fused, context }, ready for
     * SessionReportView.render() or SessionReportPdf. learned is what
     * AsiairLogParser.updateLearnedValues() returned for this Session Log.
     *
     * Also resolves which telescope/sensor/location were actually in use,
     * by matching this log's night against Astryx's own imaging-log
     * sessions (neither log records optics/site directly — design doc
     * §4.3/§9). Assumes one rig/location per night (Stan's call). Missing
     * match just leaves context.telescope/sensor/location null —
     * consumers treat that as "unavailable," not an error.
     */
    async analyze(asiairParsed, phd2Parsed, learned) {
        // Re-detect the guide anomalies against this night's subs, so each
        // one names the subs it affects
        const phd2 = phd2Parsed
            ? { ...phd2Parsed, anomalies: Phd2LogParser._detectAnomalies(phd2Parsed.sessions, asiairParsed) }
            : null;
        const context = {
            asiairParsed,
            phd2Parsed: phd2,
            learned,
            guideStabilityArcsec: SettingsManager.getGuideStabilityArcsec(),
            guideSettleTimeS: SettingsManager.getGuideSettleTimeS(),
        };

        const night = asiairParsed.date;
        if (night) {
            const allSessions = await ImagingLogManager.getAllSessions();
            const matched = allSessions.find(s => s.date === night);
            if (matched) {
                context.matchedImagingLogSession = matched;
                context.telescopeName = matched.telescope || null;
                context.telescope = matched.telescope ? DataManager.getTelescope(matched.telescope) : null;
                context.sensorName = matched.sensor || null;
                context.sensor = matched.sensor ? DataManager.getSensor(matched.sensor) : null;
                context.locationName = matched.location || null;
                context.location = matched.location ? DataManager.getLocation(matched.location) : null;
            }
        }

        const fused = SessionFusion.fuseNight(asiairParsed, phd2);
        SessionDetectors.runAll(fused, context);
        return { fused, context };
    },
};
