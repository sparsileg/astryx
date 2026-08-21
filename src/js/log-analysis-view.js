/**
 * log-analysis-view.js
 * Session Log Analysis view — ASIAir Autorun + PHD2 guide log parsing, the
 * two per-log reports, and the combined report. Extracted from
 * utilities-view.js into its own sidebar view (Issue #254).
 */

const LogAnalysisView = {
    /**
     * Initialize the view
     */
    init() {
        this.initAsiairLogAnalyzer();
        this.initPhd2LogAnalyzer();
    },

    /**
     * Initialize ASIAir session log analyzer
     */
    initAsiairLogAnalyzer() {
        const fileInput = document.getElementById('session-log-file');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const parsed = AsiairLogParser.parse(ev.target.result);
                AsiairLogView.renderAccordion(parsed);
                // If PHD2 data already loaded, rerender it with new ASIAir context
                if (Phd2LogView._parsed) {
                    Phd2LogView.renderAccordion(Phd2LogView._parsed, parsed);
                }
                // Deliberate, explicit update — parse() itself performs no
                // writes (ELR.p1-4). Opening a log via this picker is treated
                // as a deliberate refresh of planning values, not a pure read.
                await AsiairLogParser.updateLearnedValues(parsed);
                this._tryRenderCombinedReport();
            };
            reader.readAsText(file);
        });
    },

    /**
     * Initialize PHD2 guide log analyzer
     */
    initPhd2LogAnalyzer() {
        const fileInput = document.getElementById('phd2-log-file');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const parsed = Phd2LogParser.parse(ev.target.result);
                Phd2LogView.renderAccordion(parsed, AsiairLogView._parsed || null);
                this._tryRenderCombinedReport();
            };
            reader.readAsText(file);
        });
    },

    /**
     * Renders the combined ASIAir+PHD2 report (ELR.p5-1) alongside the two
     * existing single-purpose reports, once both logs are loaded. Added
     * for side-by-side comparison — deliberately does not replace either
     * existing accordion; retiring those is a separate, later, sign-off-
     * gated issue (ELR.p5-3). PHD2 alone can't fuse (fuseNight requires
     * the ASIAir side), so this only fires once both pickers have run.
     *
     * Also resolves which telescope/sensor/location were actually in use,
     * by matching this log's night against Astryx's own imaging-log
     * sessions (neither log records optics/site directly — design doc
     * §4.3/§9). Assumes one rig/location per night (Stan's call). Missing
     * match just leaves context.telescope/sensor/location null —
     * consumers treat that as "unavailable," not an error.
     */
    async _tryRenderCombinedReport() {
        if (!AsiairLogView._parsed || !Phd2LogView._parsed) return;
        const context = { asiairParsed: AsiairLogView._parsed, phd2Parsed: Phd2LogView._parsed };

        const night = context.asiairParsed.date;
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

        const fused = SessionFusion.fuseNight(context.asiairParsed, context.phd2Parsed);
        SessionDetectors.runAll(fused, context);
        SessionReportView.render(fused, context);
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        // No listeners registered by this view — present for consistency
        // with app.js's `if (this.currentView.destroy)` check.
    }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
