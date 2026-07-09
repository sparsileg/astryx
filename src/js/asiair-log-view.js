/**
 * asiair-log-view.js
 * Renders parsed ASIAir session log data as an on-screen report.
 */

const AsiairLogView = {

    _parsed: null,

    /**
     * Render the parsed session data into the session analysis accordion.
     * @param {object} parsed - Output from AsiairLogParser.parse()
     */
    renderAccordion(parsed) {
        this._parsed = parsed;
        const container = document.getElementById('session-analysis-accordions');
        if (!container) return;

        // Remove existing ASIAir accordion if present
        const existing = document.getElementById('accordion-asiair');
        if (existing) existing.remove();

        const sessionDate = this._formatSessionDate(parsed.events);
        const title = `Session Report — ${HtmlUtils.escapeHtml(parsed.target)} — ${sessionDate}`;
        const reportHtml = this._buildReportHtml(parsed);

        const accordion = document.createElement('div');
        accordion.id = 'accordion-asiair';
        accordion.className = 'analysis-accordion';
        accordion.innerHTML = `
            <div class="analysis-accordion-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="analysis-accordion-arrow">▶</span>
                <span class="analysis-accordion-title">${title}</span>
            </div>
            <div class="analysis-accordion-body">
                ${reportHtml}
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary btn-sm" id="asiair-pdf-btn">Download PDF</button>
                </div>
            </div>
        `;
        container.appendChild(accordion);

        document.getElementById('asiair-pdf-btn').addEventListener('click', () => {
            this.downloadPDF(this._parsed);
        });
    },

    /**
     * Build the report HTML string from parsed data.
     * @param {object} parsed - Output from AsiairLogParser.parse()
     * @returns {string} HTML string
     */
    _buildReportHtml(parsed) {
        const { target, summary, recommendations, events } = parsed;

        const sessionDate = this._formatSessionDate(events);

        let html = `<div class="session-report">`;

        // --- Header ---
        html += `
            <h3 class="session-report-title">${HtmlUtils.escapeHtml(target)} — Session Detail</h3>
            <p class="session-report-subtitle">${sessionDate}</p>
            <p class="session-report-note-small">AF duration includes guide settle &nbsp;•&nbsp; Guide Calibration duration includes guide settle</p>
        `;

        // --- Detail table ---
        html += `
            <table class="session-table session-report-detail">
                <thead>
                    <tr>
                        <th>Target</th>
                        <th>Event</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
        `;

        events.forEach(e => {
            const label = this._eventLabel(e);
            if (!label) return;
            html += `
                <tr>
                    <td>${HtmlUtils.escapeHtml(target)}</td>
                    <td>${label}</td>
                    <td>${AsiairLogParser.fmtTime(e.start)}</td>
                    <td>${AsiairLogParser.fmtTime(e.end)}</td>
                    <td>${AsiairLogParser.fmtMinutes(e.durationS)}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;

        // --- Summary table ---
        html += `
            <h4 class="session-report-section">Summary</h4>
            <table class="session-table session-report-summary">
                <thead>
                    <tr>
                        <th>Event Type</th>
                        <th>Total Time</th>
                        <th>% of Session</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Imaging</td>
                        <td>${this.fmtDuration(summary.imagingTotalS)}</td>
                        <td>${AsiairLogParser.fmtPct(summary.imagingPct)}</td>
                    </tr>
                    <tr>
                        <td>Autofocus (incl. guide settle)</td>
                        <td>${this.fmtDuration(summary.afTotalS)}</td>
                        <td>${AsiairLogParser.fmtPct(summary.afPct)}</td>
                    </tr>
        `;

        if (summary.calCount > 0) {
            html += `
                    <tr>
                        <td>Guide Calibration (incl. settle)</td>
                        <td>${this.fmtDuration(summary.calTotalS)}</td>
                        <td>${AsiairLogParser.fmtPct(summary.calPct)}</td>
                    </tr>
            `;
        }

        if (summary.meridianTotalS > 0) {
            html += `
                    <tr>
                        <td>Meridian Flip (pause + flip)</td>
                        <td>${this.fmtDuration(summary.meridianTotalS)}</td>
                        <td>${AsiairLogParser.fmtPct(summary.meridianPct)}</td>
                    </tr>
            `;
        }

        if (summary.ditherCount > 0) {
            html += `
                    <tr>
                        <td>Dither (${summary.ditherCount} events)</td>
                        <td>${this.fmtDuration(summary.ditherTotalS)}</td>
                        <td>${AsiairLogParser.fmtPct(summary.ditherPct)}</td>
                    </tr>
            `;
        }

        html += `
                    <tr class="session-report-total-row">
                        <td>Total tracked</td>
                        <td>~${this.fmtDuration(summary.totalTrackedS)}</td>
                        <td>100%</td>
                    </tr>
                </tbody>
            </table>
        `;

        // --- Recommended Settings table ---
        html += `
            <h4 class="session-report-section">Recommended Session Settings</h4>
            <p class="session-report-note-small">Based on analysis of this session log:</p>
            <table class="session-table session-report-recommendations">
                <thead>
                    <tr>
                        <th>Setting</th>
                        <th>Observed</th>
                        <th>Recommended</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Autofocus Duration</td>
                        <td>${AsiairLogParser.fmtMinutes(recommendations.afDurationS)} avg (incl. settle)</td>
                        <td>${Math.ceil(recommendations.afDurationS / 60)}m</td>
                    </tr>
        `;

        if (summary.calCount > 0) {
            html += `
                    <tr>
                        <td>Guide Calibration Duration</td>
                        <td>${AsiairLogParser.fmtMinutes(recommendations.calDurationS)} (incl. settle)</td>
                        <td>${Math.ceil(recommendations.calDurationS / 60)}m</td>
                    </tr>
            `;
        }

        const learnedSubGapS = SettingsManager.getLearnedSubGapS();
        const learnedDitherDurationS = SettingsManager.getLearnedDitherDurationS();

        html += `
                    <tr>
                        <td>Sub Gap</td>
                        <td>Observed: ${recommendations.observedSubGapS}s</td>
                        <td>Stored: ${learnedSubGapS}s</td>
                    </tr>
                    <tr>
                        <td>Dither Duration</td>
                        <td>Observed: ${recommendations.observedDitherDurationS}s</td>
                        <td>Stored: ${learnedDitherDurationS}s</td>
                    </tr>
                </tbody>
            </table>
        `;

        // --- Notes ---
        html += `
            <h4 class="session-report-section">Notes</h4>
            <ul class="session-report-notes">
                <li>AF duration: includes autofocus process + guide re-select + guide settle; excludes guide calibration</li>
                ${summary.calCount > 0 ? '<li>Guide Calibration: includes calibration process + guide settle</li>' : ''}
                ${summary.ditherCount > 0 ? `<li>Dither: ${summary.ditherCount} events, avg ${summary.ditherAvgS.toFixed(0)}s each, total ${AsiairLogParser.fmtMinutes(summary.ditherTotalS)}</li>` : ''}
                ${summary.meridianTotalS > 0 ? '<li>Pre-flip pause and Meridian Flip are listed as separate events in the detail table</li>' : ''}
                <li>Dither total is included in the summary but is embedded within imaging segments in the detail table</li>
                <li>Sub gap and dither duration are learned values updated automatically each time a log is analyzed</li>
            </ul>
        `;

        html += `</div>`;

        return html;
    },

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    _formatSessionDate(events) {
        const starts = events.map(e => e.start).filter(Boolean);
        const ends = events.map(e => e.end).filter(Boolean);
        if (!starts.length) return '';
        const first = starts.reduce((a, b) => a < b ? a : b);
        const last = ends.reduce((a, b) => a > b ? a : b);
        const fmtLocal = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const d1 = fmtLocal(first);
        const d2 = fmtLocal(last);
        return d1 === d2 ? d1 : `${d1} / ${d2}`;
    },

    _eventLabel(e) {
        switch (e.type) {
            case 'autofocus':         return 'Autofocus';
            case 'guide_calibration': return 'Guide Calibration';
            case 'preflight_pause':   return 'Pre-flip Pause';
            case 'meridian_flip':     return 'Meridian Flip';
            case 'imaging':
                if (e.firstImg === e.lastImg) return `Imaging (img ${e.firstImg})`;
                return `Imaging (imgs ${e.firstImg}–${e.lastImg})`;
            default: return null;
        }
    },

    fmtDuration(seconds) {
        const minutes = seconds / 60;
        if (minutes >= 100) return Math.round(minutes) + 'm';
        return minutes.toFixed(1) + 'm';
    },


    downloadPDF(parsed) {
        const { target, summary, recommendations, events } = parsed;
        const sessionDate = this._formatSessionDate(events);

        const colors = {
            headerBg: '#2c3e50',
            headerText: '#ffffff',
            rowAlt: '#f2f4f6',
            rowWhite: '#ffffff',
            totalRowBg: '#dde3ea',
            sectionText: '#2c3e50',
            noteText: '#444444',
            subtitleText: '#555555',
        };

        const detailHeaders = [
            { text: 'Target', style: 'tableHeader' },
            { text: 'Event', style: 'tableHeader' },
            { text: 'Start', style: 'tableHeader' },
            { text: 'End', style: 'tableHeader' },
            { text: 'Duration', style: 'tableHeader' },
        ];

        const detailRows = events
            .filter(e => this._eventLabel(e))
            .map((e, idx) => [
                { text: target, fontSize: 9, fillColor: idx % 2 === 0 ? colors.rowWhite : colors.rowAlt },
                { text: this._eventLabel(e), fontSize: 9, fillColor: idx % 2 === 0 ? colors.rowWhite : colors.rowAlt },
                { text: AsiairLogParser.fmtTime(e.start), fontSize: 9, fillColor: idx % 2 === 0 ? colors.rowWhite : colors.rowAlt },
                { text: AsiairLogParser.fmtTime(e.end), fontSize: 9, fillColor: idx % 2 === 0 ? colors.rowWhite : colors.rowAlt },
                { text: AsiairLogParser.fmtMinutes(e.durationS), fontSize: 9, fillColor: idx % 2 === 0 ? colors.rowWhite : colors.rowAlt },
            ]);

        const summaryRows = [];
        const addSummaryRow = (label, total, pct, isTotal = false) => {
            const bg = isTotal ? colors.totalRowBg : (summaryRows.length % 2 === 0 ? colors.rowWhite : colors.rowAlt);
            summaryRows.push([
                { text: label, fontSize: 9, bold: isTotal, fillColor: bg },
                { text: total, fontSize: 9, bold: isTotal, fillColor: bg },
                { text: pct, fontSize: 9, bold: isTotal, fillColor: bg },
            ]);
        };

        addSummaryRow('Imaging', this.fmtDuration(summary.imagingTotalS), AsiairLogParser.fmtPct(summary.imagingPct));
        addSummaryRow('Autofocus (incl. guide settle)', this.fmtDuration(summary.afTotalS), AsiairLogParser.fmtPct(summary.afPct));
        if (summary.calCount > 0) addSummaryRow('Guide Calibration (incl. settle)', this.fmtDuration(summary.calTotalS), AsiairLogParser.fmtPct(summary.calPct));
        if (summary.meridianTotalS > 0) addSummaryRow('Meridian Flip (pause + flip)', this.fmtDuration(summary.meridianTotalS), AsiairLogParser.fmtPct(summary.meridianPct));
        if (summary.ditherCount > 0) addSummaryRow(`Dither (${summary.ditherCount} events)`, this.fmtDuration(summary.ditherTotalS), AsiairLogParser.fmtPct(summary.ditherPct));
        addSummaryRow('Total tracked', '~' + this.fmtDuration(summary.totalTrackedS), '100%', true);

        const recRows = [];
        const addRecRow = (setting, observed, recommended) => {
            const bg = recRows.length % 2 === 0 ? colors.rowWhite : colors.rowAlt;
            recRows.push([
                { text: setting, fontSize: 9, fillColor: bg },
                { text: observed, fontSize: 9, fillColor: bg },
                { text: recommended, fontSize: 9, fillColor: bg },
            ]);
        };

        addRecRow(
            'Autofocus Duration',
            AsiairLogParser.fmtMinutes(recommendations.afDurationS) + ' avg (incl. settle)',
            Math.ceil(recommendations.afDurationS / 60) + 'm'
        );
        if (summary.calCount > 0) {
            addRecRow(
                'Guide Calibration Duration',
                AsiairLogParser.fmtMinutes(recommendations.calDurationS) + ' (incl. settle)',
                Math.ceil(recommendations.calDurationS / 60) + 'm'
            );
        }
        const learnedSubGapS = SettingsManager.getLearnedSubGapS();
        const learnedDitherDurationS = SettingsManager.getLearnedDitherDurationS();

        addRecRow(
            'Sub Gap',
            `Observed: ${recommendations.observedSubGapS}s`,
            `Stored: ${learnedSubGapS}s`
        );
        addRecRow(
            'Dither Duration',
            `Observed: ${recommendations.observedDitherDurationS}s`,
            `Stored: ${learnedDitherDurationS}s`
        );


        const noteItems = [
            'AF duration: includes autofocus process + guide re-select + guide settle; excludes guide calibration',
        ];
        if (summary.calCount > 0) noteItems.push('Guide Calibration: includes calibration process + guide settle');
        if (summary.ditherCount > 0) noteItems.push(`Dither: ${summary.ditherCount} events, avg ${summary.ditherAvgS.toFixed(0)}s each, total ${AsiairLogParser.fmtMinutes(summary.ditherTotalS)}`);
        if (summary.meridianTotalS > 0) noteItems.push('Pre-flip pause and Meridian Flip are listed as separate events in the detail table');
        noteItems.push('Dither total is included in the summary but is embedded within imaging segments in the detail table');
        noteItems.push('Sub gap and dither duration are learned values updated automatically each time a log is analyzed');

        const tableLayout = {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#cccccc',
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 3,
            paddingBottom: () => 3,
        };

        const docDefinition = {
            pageSize: 'LETTER',
            pageMargins: [54, 54, 54, 54],
            defaultStyle: { font: 'Roboto', fontSize: 9 },
            styles: {
                title: { fontSize: 14, bold: true, color: colors.sectionText, margin: [0, 0, 0, 2] },
                subtitle: { fontSize: 8, color: colors.subtitleText, margin: [0, 0, 0, 8] },
                sectionHeading: { fontSize: 11, bold: true, color: colors.sectionText, margin: [0, 12, 0, 2] },
                sectionNote: { fontSize: 8, color: colors.subtitleText, margin: [0, 0, 0, 4] },
                tableHeader: { fontSize: 9, bold: true, color: colors.headerText, fillColor: colors.headerBg },
                noteItem: { fontSize: 8, color: colors.noteText, margin: [0, 1, 0, 1] },
            },
            content: [
                { text: `${target} — Session Detail`, style: 'title' },
                { text: `${sessionDate}  •  AF duration includes guide settle  •  Guide Calibration duration includes guide settle`, style: 'subtitle' },
                { table: { headerRows: 1, widths: [80, 130, 40, 40, 50], body: [detailHeaders, ...detailRows] }, layout: tableLayout },
                { text: 'Summary', style: 'sectionHeading' },
                { table: { headerRows: 1, widths: [200, 80, 80], body: [[{ text: 'Event Type', style: 'tableHeader' }, { text: 'Total Time', style: 'tableHeader' }, { text: '% of Session', style: 'tableHeader' }], ...summaryRows] }, layout: tableLayout },
                { text: 'Recommended Session Settings', style: 'sectionHeading' },
                { text: 'Based on analysis of this session log:', style: 'sectionNote' },
                { table: { headerRows: 1, widths: [180, 160, 80], body: [[{ text: 'Setting', style: 'tableHeader' }, { text: 'Observed', style: 'tableHeader' }, { text: 'Recommended', style: 'tableHeader' }], ...recRows] }, layout: tableLayout },
                { text: 'Notes', style: 'sectionHeading' },
                ...noteItems.map(note => ({ text: `• ${note}`, style: 'noteItem' })),
            ]
        };

        const filename = `${target.replace(/\s+/g, '_')}_${sessionDate.slice(0, 10).replace(/-/g, '')}_session-report.pdf`;
        pdfMake.createPdf(docDefinition).download(filename);
    },

};
