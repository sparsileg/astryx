/**
 * phd2-log-view.js
 * Renders parsed PHD2 guide log data as an on-screen report with accordion.
 */

const Phd2LogView = {

    _parsed: null,

    /**
     * Render the parsed PHD2 data into the session analysis accordion.
     * @param {object} parsed - Output from Phd2LogParser.parse()
     * @param {object|null} asiairParsed - Optional ASIAir parsed data for sub correlation
     */
    renderAccordion(parsed, asiairParsed = null) {
        this._parsed = parsed;

        // Re-parse with ASIAir context if provided
        if (asiairParsed) {
            parsed = { ...parsed };
            parsed.anomalies = Phd2LogParser._detectAnomalies(parsed.sessions, asiairParsed);
            parsed.recommendations = Phd2LogParser._buildRecommendations(
                parsed.sessions, parsed.anomalies, parsed.equipment, parsed.overall
            );
            this._parsed = parsed;
        }

        const container = document.getElementById('session-analysis-accordions');
        if (!container) return;

        // Remove existing PHD2 accordion if present
        const existing = document.getElementById('accordion-phd2');
        if (existing) existing.remove();

        const title = `PHD2 Guide Report — ${parsed.date}`;
        const reportHtml = this._buildReportHtml(parsed);

        const accordion = document.createElement('div');
        accordion.id = 'accordion-phd2';
        accordion.className = 'analysis-accordion';
        accordion.innerHTML = `
            <div class="analysis-accordion-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="analysis-accordion-arrow">▶</span>
                <span class="analysis-accordion-title">${HtmlUtils.escapeHtml(title)}</span>
            </div>
            <div class="analysis-accordion-body">
                ${reportHtml}
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary btn-sm" id="phd2-pdf-btn">Download PDF</button>
                </div>
            </div>
        `;
        container.appendChild(accordion);

        document.getElementById('phd2-pdf-btn').addEventListener('click', () => {
            this.downloadPDF(this._parsed);
        });
    },

    /**
     * Build the report HTML string from parsed PHD2 data.
     * @param {object} parsed
     * @returns {string} HTML string
     */
    _buildReportHtml(parsed) {
        const { equipment, sessions, overall, anomalies, recommendations, date } = parsed;

        let html = `<div class="session-report">`;

        // --- Header ---
        html += `
            <h3 class="session-report-title">PHD2 Guide Report — ${HtmlUtils.escapeHtml(date)}</h3>
        `;

        // --- Equipment ---
        html += `
            <h4 class="session-report-section">Equipment</h4>
            <table class="session-table">
                <tbody>
                    <tr><td>Camera</td><td>${HtmlUtils.escapeHtml(equipment.camera || '—')}</td></tr>
                    <tr><td>Pixel Scale</td><td>${equipment.pixelScale != null ? equipment.pixelScale + '"/px' : '—'}</td></tr>
                    <tr><td>Focal Length</td><td>${equipment.focalLength != null ? equipment.focalLength + ' mm' : '—'}</td></tr>
                    <tr><td>Guide Exposure</td><td>${equipment.exposureMs != null ? (equipment.exposureMs / 1000).toFixed(1) + 's' : '—'}</td></tr>
                    <tr><td>Mount</td><td>${HtmlUtils.escapeHtml(equipment.mount || '—')}</td></tr>
                </tbody>
            </table>
        `;

        // --- Overall Statistics ---
        if (overall) {
            html += `
                <h4 class="session-report-section">Overall Statistics</h4>
                <table class="session-table">
                    <tbody>
                        <tr><td>Guide Sessions</td><td>${overall.sessionCount} total, ${overall.fullSessionCount} full</td></tr>
                        <tr><td>Total Guide Frames</td><td>${overall.totalFrames.toLocaleString()}</td></tr>
                        <tr><td>RMS RA</td><td>${Phd2LogParser.fmtArcsec(overall.raRms)}</td></tr>
                        <tr><td>RMS Dec</td><td>${Phd2LogParser.fmtArcsec(overall.decRms)}</td></tr>
                        <tr><td>RMS Total</td><td>${Phd2LogParser.fmtArcsec(overall.totRms)}</td></tr>
                        <tr><td>Avg Guide Star SNR</td><td>${Phd2LogParser.fmtSnr(overall.avgSnr)}</td></tr>
                        <tr><td>Total Dither Events</td><td>${overall.totalDithers}</td></tr>
                    </tbody>
                </table>
            `;
        }

        // --- Session Table ---
        html += `
            <h4 class="session-report-section">Sessions</h4>
            <table class="session-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Time Range</th>
                        <th>Line</th>
                        <th>Frames</th>
                        <th>RMS RA</th>
                        <th>RMS Dec</th>
                        <th>RMS Total</th>
                        <th>Peak RA</th>
                        <th>Peak Dec</th>
                        <th>Avg SNR</th>
                        <th>Flags</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sessions.forEach((s, idx) => {
            const bg = '';
            if (!s.stats) {
                html += `<tr ${bg}><td>${s.num}</td><td colspan="10" style="color:var(--text-secondary)">No frames recorded</td></tr>`;
                return;
            }
            const { raRms, decRms, totRms, raPeak, decPeak, avgSnr } = s.stats;
            const flags = this._sessionFlags(s, anomalies);
            const flagHtml = flags.length > 0
                ? flags.map(f => `<span class="guide-flag guide-flag-${f.cls}">${f.label}</span>`).join(' ')
                : '—';
            const incomplete = s.incomplete ? ' ⚠' : '';
            html += `
                <tr ${bg}>
                    <td>${s.num}</td>
                    <td style="white-space:nowrap">${Phd2LogParser._sessionTimeRange(s)}${incomplete}</td>
                    <td>${s.startLine}</td>
                    <td>${s.frames.length}</td>
                    <td>${Phd2LogParser.fmtArcsec(raRms)}</td>
                    <td>${Phd2LogParser.fmtArcsec(decRms)}</td>
                    <td>${Phd2LogParser.fmtArcsec(totRms)}</td>
                    <td>${Phd2LogParser.fmtArcsec(raPeak)}</td>
                    <td>${Phd2LogParser.fmtArcsec(decPeak)}</td>
                    <td>${Phd2LogParser.fmtSnr(avgSnr)}</td>
                    <td>${flagHtml}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;

        // --- Anomalies ---
        const notableAnomalies = anomalies.filter(a => a.type !== 'short_session' && a.type !== 'incomplete');
        if (notableAnomalies.length > 0) {
            html += `<h4 class="session-report-section">Anomalies & Events</h4><ul class="session-report-notes">`;
            for (const a of anomalies) {
                const icon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : 'ℹ️';
                html += `<li>${icon} <strong>Session ${a.session}</strong> (${a.timeRange}, line ${a.startLine}): ${HtmlUtils.escapeHtml(a.message)}</li>`;
            }
            html += `</ul>`;
        } else {
            html += `<h4 class="session-report-section">Anomalies & Events</h4><p style="color:var(--text-secondary)">No significant anomalies detected.</p>`;
        }

        // --- Recommendations ---
        if (recommendations.length > 0) {
            html += `<h4 class="session-report-section">Recommendations</h4><ul class="session-report-notes">`;
            for (const r of recommendations) {
                const icon = r.priority === 'high' ? '🔴' : r.priority === 'medium' ? '🟡' : '🔵';
                html += `<li>${icon} ${HtmlUtils.escapeHtml(r.message)}</li>`;
            }
            html += `</ul>`;
        }

        html += this._buildNarrativeHtml(parsed);

        html += `</div>`;
        return html;
    },

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    _sessionFlags(session, anomalies) {
        const flags = [];
        const T = Phd2LogParser.THRESHOLDS;
        const sessionAnomalies = anomalies.filter(a => a.session === session.num);

        if (session.frames.length < T.shortSession && !session.incomplete) {
            flags.push({ label: 'Short', cls: 'info' });
        }
        if (sessionAnomalies.some(a => a.type === 'high_rms')) {
            flags.push({ label: 'High RMS', cls: 'critical' });
        } else if (sessionAnomalies.some(a => a.type === 'elevated_rms')) {
            flags.push({ label: 'Elevated RMS', cls: 'warning' });
        }
        if (sessionAnomalies.some(a => a.type === 'peak_spike')) {
            flags.push({ label: 'Spike', cls: 'warning' });
        }
        if (sessionAnomalies.some(a => a.type === 'error_code')) {
            flags.push({ label: 'Err', cls: 'warning' });
        }
        if (sessionAnomalies.some(a => a.type === 'snr_jump')) {
            flags.push({ label: 'SNR↑', cls: 'info' });
        }
        if (sessionAnomalies.some(a => a.type === 'low_snr')) {
            flags.push({ label: 'Low SNR', cls: 'warning' });
        }
        if (session.incomplete) {
            flags.push({ label: 'Incomplete', cls: 'info' });
        }
        return flags;
    },

/**
     * Build narrative analysis HTML. Replace this method body with an async
     * AI-generated version when an API key is available.
     * @param {object} parsed
     * @returns {string} HTML string
     */
    _buildNarrativeHtml(parsed) {
        const { sessions, overall, anomalies, equipment } = parsed;
        const T = Phd2LogParser.THRESHOLDS;

        if (!overall) return '';

        const lines = [];

        // --- Opening summary ---
        const typicalRms = overall.totRms.toFixed(2);
        const quality = overall.totRms < 1.5 ? 'excellent' : overall.totRms < 2.5 ? 'good' : overall.totRms < 4.0 ? 'fair' : 'poor';
        lines.push(`Overall guiding quality was <strong>${quality}</strong> with a session-wide RMS of ${typicalRms}" total (${overall.raRms.toFixed(2)}" RA, ${overall.decRms.toFixed(2)}" Dec) across ${overall.fullSessionCount} full guide sessions.`);

        // --- RA vs Dec balance ---
        const raBias = overall.raRms / overall.decRms;
        if (raBias > 1.5) {
            lines.push(`RA error was notably larger than Dec throughout the night, suggesting possible periodic error or aggressiveness settings that could be tuned.`);
        } else if (raBias < 0.67) {
            lines.push(`Dec error was notably larger than RA throughout the night, which may indicate backlash or Dec guide settings worth reviewing.`);
        } else {
            lines.push(`RA and Dec errors were well balanced.`);
        }

        // --- Per-session narrative ---
        lines.push(`<br><strong>Session by session:</strong>`);

        // Track SNR baseline for jump detection
        const fullSessions = sessions.filter(s => s.stats && s.frames.length >= T.shortSession);
        const baselineSnr = fullSessions.slice(0, 5).reduce((sum, s) => sum + s.stats.avgSnr, 0) /
            Math.min(5, fullSessions.length);

        for (const s of sessions) {
            const sAnomalies = anomalies.filter(a => a.session === s.num);

            if (!s.stats) {
                lines.push(`Session ${s.num} — no frames recorded.`);
                continue;
            }

            const { raRms, decRms, totRms, raPeak, decPeak, avgSnr } = s.stats;
            const timeRange = Phd2LogParser._sessionTimeRange(s);

            // Short session
            if (s.frames.length < T.shortSession && !s.incomplete) {
                lines.push(`Session ${s.num} (${timeRange}, line ${s.startLine}) — brief session of ${s.frames.length} frames, likely an autofocus interruption or guider restart.`);
                continue;
            }

            // Incomplete
            if (s.incomplete) {
                lines.push(`Session ${s.num} (${timeRange}, line ${s.startLine}) — session was active when the log ended, likely the end of the night. RMS was ${totRms.toFixed(2)}" with avg SNR ${avgSnr.toFixed(1)}.`);
                continue;
            }

            // Build sentence parts
            const parts = [];

            // RMS assessment
            if (totRms >= T.rmsHigh) {
                parts.push(`<strong style="color:var(--error-color)">Major guiding problem</strong> — RMS spiked to ${totRms.toFixed(2)}" total (${raRms.toFixed(2)}" RA, ${decRms.toFixed(2)}" Dec), approximately ${(totRms / overall.totRms).toFixed(1)}× the night average`);
            } else if (totRms >= T.rmsElevated) {
                parts.push(`Elevated RMS of ${totRms.toFixed(2)}" total (${raRms.toFixed(2)}" RA, ${decRms.toFixed(2)}" Dec)`);
            } else {
                parts.push(`Good guiding, RMS ${totRms.toFixed(2)}" total`);
            }

            // Peak spikes
            if (raPeak >= T.peakSpike || decPeak >= T.peakSpike) {
                const spikeParts = [];
                if (raPeak >= T.peakSpike) spikeParts.push(`RA peak ${raPeak.toFixed(1)}"`);
                if (decPeak >= T.peakSpike) spikeParts.push(`Dec peak ${decPeak.toFixed(1)}"`);
                if (totRms >= T.rmsHigh) {
                    parts.push(`with extreme spikes (${spikeParts.join(', ')}) — consistent with a mount overcorrection or periodic error event the guider struggled to recover from`);
                } else {
                    parts.push(`with isolated spike (${spikeParts.join(', ')})`);
                }
            }

            // Sub correlation
            const subMatch = sAnomalies.find(a => a.message.includes('subs'));
            if (subMatch) {
                const m = subMatch.message.match(/subs (\d+)–(\d+)/);
                if (m) parts.push(`Subs ${m[1]}–${m[2]} should be carefully inspected`);
            }

            // Error codes
            const errAnomalies = sAnomalies.filter(a => a.type === 'error_code');
            for (const ea of errAnomalies) {
                const countMatch = ea.message.match(/(\d+) frame/);
                const count = countMatch ? parseInt(countMatch[1]) : 1;
                if (count === 1) {
                    parts.push(`one frame had a star mass change (code 7) — likely a satellite or aircraft pass, no impact`);
                } else {
                    parts.push(`${count} frames had error code(s) — ${ea.message}`);
                }
            }

            // SNR jump
            if (avgSnr >= baselineSnr * T.snrJumpFactor) {
                parts.push(`SNR jumped to ${avgSnr.toFixed(1)} (vs baseline ~${baselineSnr.toFixed(1)}) — PHD2 likely selected a much brighter guide star`);
            }

            lines.push(`Session ${s.num} (${timeRange}, line ${s.startLine}) — ${parts.join('; ')}.`);
        }

        return `
            <h4 class="session-report-section">Narrative Analysis</h4>
            <div class="guide-narrative">
                ${lines.map(l => `<p>${l}</p>`).join('')}
            </div>
        `;
    },

    // -------------------------------------------------------------------------
    // PDF generation
    // -------------------------------------------------------------------------

    downloadPDF(parsed) {
        const { equipment, sessions, overall, anomalies, recommendations, date } = parsed;

        const colors = {
            headerBg:   '#2c3e50',
            headerText: '#ffffff',
            rowAlt:     '#f2f4f6',
            rowWhite:   '#ffffff',
            critical:   '#c0392b',
            warning:    '#e67e22',
            info:       '#2980b9',
            sectionText:'#2c3e50',
            subtitleText:'#555555',
            noteText:   '#444444',
        };

        const tableLayout = {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#cccccc',
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
        };

        const th = (text) => ({ text, style: 'tableHeader' });

        // Equipment table
        const eqRows = [
            [{ text: 'Camera', fontSize: 9 }, { text: equipment.camera || '—', fontSize: 9 }],
            [{ text: 'Pixel Scale', fontSize: 9 }, { text: equipment.pixelScale != null ? equipment.pixelScale + '"/px' : '—', fontSize: 9 }],
            [{ text: 'Focal Length', fontSize: 9 }, { text: equipment.focalLength != null ? equipment.focalLength + ' mm' : '—', fontSize: 9 }],
            [{ text: 'Guide Exposure', fontSize: 9 }, { text: equipment.exposureMs != null ? (equipment.exposureMs / 1000).toFixed(1) + 's' : '—', fontSize: 9 }],
            [{ text: 'Mount', fontSize: 9 }, { text: equipment.mount || '—', fontSize: 9 }],
        ];

        // Session table rows
        const sessionHeaderRow = [
            th('#'), th('Time Range'), th('Line'), th('Frames'),
            th('RMS RA'), th('RMS Dec'), th('RMS Total'),
            th('Peak RA'), th('Peak Dec'), th('Avg SNR'), th('Flags'),
        ];

        const sessionRows = sessions.map((s, idx) => {
            const bg = idx % 2 === 0 ? colors.rowWhite : colors.rowAlt;
            if (!s.stats) {
                return [
                    { text: String(s.num), fontSize: 8, fillColor: bg },
                    { text: Phd2LogParser._sessionTimeRange(s), fontSize: 8, fillColor: bg },
                    { text: String(s.startLine), fontSize: 8, fillColor: bg },
                    { text: 'No frames', fontSize: 8, fillColor: bg, colSpan: 8 },
                    {}, {}, {}, {}, {}, {}, {},
                ];
            }
            const { raRms, decRms, totRms, raPeak, decPeak, avgSnr } = s.stats;
            const flags = this._sessionFlags(s, anomalies).map(f => f.label).join(', ') || '—';
            return [
                { text: String(s.num), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser._sessionTimeRange(s) + (s.incomplete ? ' ⚠' : ''), fontSize: 8, fillColor: bg },
                { text: String(s.startLine), fontSize: 8, fillColor: bg },
                { text: String(s.frames.length), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser.fmtArcsec(raRms), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser.fmtArcsec(decRms), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser.fmtArcsec(totRms), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser.fmtArcsec(raPeak), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser.fmtArcsec(decPeak), fontSize: 8, fillColor: bg },
                { text: Phd2LogParser.fmtSnr(avgSnr), fontSize: 8, fillColor: bg },
                { text: flags, fontSize: 8, fillColor: bg },
            ];
        });

        // Anomaly list
        const anomalyItems = anomalies.map(a => {
            const prefix = a.severity === 'critical' ? '[CRITICAL]' : a.severity === 'warning' ? '[WARNING]' : '[INFO]';
            const color = a.severity === 'critical' ? colors.critical : a.severity === 'warning' ? colors.warning : colors.info;
            return {
                text: [
                    { text: `${prefix} `, color, bold: true, fontSize: 8 },
                    { text: `Session ${a.session} (${a.timeRange}, line ${a.startLine}): ${a.message}`, fontSize: 8 }
                ],
                margin: [0, 1, 0, 1]
            };
        });

        // Recommendation list
        const recItems = recommendations.map(r => {
            const prefix = r.priority === 'high' ? '[HIGH]' : r.priority === 'medium' ? '[MEDIUM]' : '[LOW]';
            const color = r.priority === 'high' ? colors.critical : r.priority === 'medium' ? colors.warning : colors.info;
            return {
                text: [
                    { text: `${prefix} `, color, bold: true, fontSize: 8 },
                    { text: r.message, fontSize: 8 }
                ],
                margin: [0, 1, 0, 1]
            };
        });

        const content = [
            { text: `PHD2 Guide Report — ${date}`, style: 'title' },
            { text: 'Equipment', style: 'sectionHeading' },
            { table: { widths: [100, 300], body: eqRows }, layout: tableLayout },
        ];

        if (overall) {
            content.push(
                { text: 'Overall Statistics', style: 'sectionHeading' },
                { table: { widths: [150, 250], body: [
                    [{ text: 'Guide Sessions', fontSize: 9 }, { text: `${overall.sessionCount} total, ${overall.fullSessionCount} full`, fontSize: 9 }],
                    [{ text: 'Total Guide Frames', fontSize: 9 }, { text: overall.totalFrames.toLocaleString(), fontSize: 9 }],
                    [{ text: 'RMS RA', fontSize: 9 }, { text: Phd2LogParser.fmtArcsec(overall.raRms), fontSize: 9 }],
                    [{ text: 'RMS Dec', fontSize: 9 }, { text: Phd2LogParser.fmtArcsec(overall.decRms), fontSize: 9 }],
                    [{ text: 'RMS Total', fontSize: 9 }, { text: Phd2LogParser.fmtArcsec(overall.totRms), fontSize: 9 }],
                    [{ text: 'Avg Guide Star SNR', fontSize: 9 }, { text: Phd2LogParser.fmtSnr(overall.avgSnr), fontSize: 9 }],
                    [{ text: 'Total Dither Events', fontSize: 9 }, { text: String(overall.totalDithers), fontSize: 9 }],
                ]}, layout: tableLayout }
            );
        }

        content.push(
            { text: 'Sessions', style: 'sectionHeading' },
            { table: { headerRows: 1, widths: [12, 88, 30, 28, 28, 28, 32, 28, 28, 24, 48], body: [sessionHeaderRow, ...sessionRows] }, layout: tableLayout }
        );

        if (anomalies.length > 0) {
            content.push(
                { text: 'Anomalies & Events', style: 'sectionHeading' },
                ...anomalyItems
            );
        }

        if (recommendations.length > 0) {
            content.push(
                { text: 'Recommendations', style: 'sectionHeading' },
                ...recItems
            );
        }

        const docDefinition = {
            pageSize: 'LETTER',
            pageOrientation: 'portrait',
            pageMargins: [36, 36, 36, 36],
            defaultStyle: { font: 'Roboto', fontSize: 9 },
            styles: {
                title: { fontSize: 14, bold: true, color: colors.sectionText, margin: [0, 0, 0, 4] },
                sectionHeading: { fontSize: 11, bold: true, color: colors.sectionText, margin: [0, 10, 0, 2] },
                tableHeader: { fontSize: 8, bold: true, color: colors.headerText, fillColor: colors.headerBg },
            },
            content,
        };

        // Narrative section
        const narrativeHtml = this._buildNarrativeHtml(parsed);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = narrativeHtml;
        const narrativeParagraphs = Array.from(tempDiv.querySelectorAll('p')).map(p => ({
            text: p.innerText || p.textContent,
            fontSize: 8,
            margin: [0, 2, 0, 2],
            color: colors.noteText,
        }));

        if (narrativeParagraphs.length > 0) {
            content.push(
                { text: 'Narrative Analysis', style: 'sectionHeading' },
                ...narrativeParagraphs
            );
        }

        const filename = `PHD2_Guide_Report_${date.replace(/-/g, '')}.pdf`;
        pdfMake.createPdf(docDefinition).download(filename);
    },

};
