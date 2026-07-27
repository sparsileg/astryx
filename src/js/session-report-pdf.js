/**
 * session-report-pdf.js
 * PDF export for the combined ASIAir+PHD2 report (session-report-view.js).
 * #240 / ELR.p5-2 — deliberately a separate file from session-report-view.js:
 * different rendering target (pdfmake document-definition objects, not DOM),
 * different failure mode (does the PDF reflect the screen, not does the
 * screen compute the right numbers). Reuses SessionReportView's own data-
 * shaping helpers directly (_formatNight, _buildTimelineEntries,
 * _collapseConsecutive, _asDate, _fmtTimelineTime, _perSubColumns,
 * _perSubRow, _groupSubsByTarget) rather than re-deriving that logic here,
 * since none of them have any DOM dependency.
 *
 * Style matches the existing AsiairLogView/Phd2LogView downloadPDF
 * precedent exactly (headerBg #2c3e50, zebra rows, 0.5pt gray hairlines,
 * Roboto 9pt), extended with a page footer (page numbers) since this
 * report can run much longer than either original. Severity/tier is
 * marked via colored text, matching that precedent — not colored row
 * backgrounds, which is how the on-screen HTML report does it.
 *
 * Scope vs. the interactive report (agreed with Stan): Session Timeline is
 * condensed to flagged/finding rows + target-change markers only (the full
 * timeline can be 50+ routine rows with the verbose toggle off); every
 * other section is full parity, including the complete Guide Sessions
 * table (kept in full per Stan's explicit call, not condensed).
 *
 * Page breaks: Header+Verdict+Recommendations share page 1; a break before
 * Session Timeline (+Summary); a break before each target's Per-Sub table;
 * a break before Guiding Analysis (+Findings+Focus/Environment, which
 * don't force their own break); a break before Data Quality.
 */

const SessionReportPdf = {

    // -------------------------------------------------------------------------
    // Shared style
    // -------------------------------------------------------------------------

    _colors() {
        return {
            headerBg: '#2c3e50',
            headerText: '#ffffff',
            rowAlt: '#f2f4f6',
            rowWhite: '#ffffff',
            totalRowBg: '#dde3ea',
            critical: '#c0392b',
            warning: '#e67e22',
            info: '#2980b9',
            sectionText: '#2c3e50',
            subtitleText: '#555555',
            noteText: '#444444',
        };
    },

    _tableLayout() {
        return {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#cccccc',
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 3,
            paddingBottom: () => 3,
        };
    },

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    download(fs, context) {
        if (!fs || fs.kind === 'calibrationOnly') return;
        const colors = this._colors();
        const tableLayout = this._tableLayout();

        const content = [];
        content.push(...this._headerVerdictRecommendations(fs, context, colors, tableLayout));
        content.push(...this._timelineSummary(fs, context, colors, tableLayout));
        content.push(...this._perSub(fs, colors, tableLayout));
        content.push(...this._guidingFindingsFocus(fs, context, colors, tableLayout));
        content.push(...this._dataQuality(fs, context, colors, tableLayout));

        const docDefinition = {
            pageSize: 'LETTER',
            pageMargins: [54, 54, 54, 54],
            defaultStyle: { font: 'Roboto', fontSize: 9 },
            styles: {
                title: { fontSize: 14, bold: true, color: colors.sectionText, margin: [0, 0, 0, 2] },
                subtitle: { fontSize: 8, color: colors.subtitleText, margin: [0, 0, 0, 8] },
                sectionHeading: { fontSize: 11, bold: true, color: colors.sectionText, margin: [0, 12, 0, 2] },
                subHeading: { fontSize: 9.5, bold: true, color: colors.sectionText, margin: [0, 8, 0, 2] },
                sectionNote: { fontSize: 8, color: colors.subtitleText, margin: [0, 0, 0, 4] },
                tableHeader: { fontSize: 8, bold: true, color: colors.headerText, fillColor: colors.headerBg },
            },
            footer: (currentPage, pageCount) => ({
                text: `Page ${currentPage} of ${pageCount}`,
                alignment: 'center',
                fontSize: 7,
                color: colors.subtitleText,
                margin: [0, 10, 0, 0],
            }),
            content,
        };

        const night = SessionReportView._formatNight(fs).replace(/[\s/]/g, '_');
        const filename = `${fs.targets.join('_').replace(/\s+/g, '_')}_${night}_combined-report.pdf`;
        pdfMake.createPdf(docDefinition).download(filename);
    },

    // -------------------------------------------------------------------------
    // Equipment line (mirrors SessionReportView._buildImagingEquipmentHtml,
    // plain text instead of HTML)
    // -------------------------------------------------------------------------

    _equipmentText(context) {
        if (context && context.telescopeName && context.sensorName) {
            const tel = context.telescope, sen = context.sensor;
            const pixelSizeUm = (sen && sen.pixelSizeX != null && sen.pixelSizeY != null) ? (sen.pixelSizeX + sen.pixelSizeY) / 2 : null;
            const pixelScale = (tel && tel.focalLength && pixelSizeUm) ? (206.265 * pixelSizeUm / tel.focalLength) : null;
            return `${context.telescopeName} / ${context.sensorName}${pixelScale != null ? ` (${pixelScale.toFixed(2)}"/px)` : ''} — from Astryx imaging-log session this night`;
        }
        if (typeof DataManager === 'undefined' || !DataManager.getTelescopes || !DataManager.getSensors) return '';
        const telescopes = DataManager.getTelescopes();
        const sensors = DataManager.getSensors();
        const telNames = Object.keys(telescopes);
        const senNames = Object.keys(sensors);
        if (telNames.length !== 1 || senNames.length !== 1) return '';
        const tel = telescopes[telNames[0]], sen = sensors[senNames[0]];
        const pixelSizeUm = (sen && sen.pixelSizeX != null && sen.pixelSizeY != null) ? (sen.pixelSizeX + sen.pixelSizeY) / 2 : null;
        const pixelScale = (tel && tel.focalLength && pixelSizeUm) ? (206.265 * pixelSizeUm / tel.focalLength) : null;
        return `${telNames[0]} / ${senNames[0]}${pixelScale != null ? ` (${pixelScale.toFixed(2)}"/px)` : ''} — no matching imaging-log session; only one rig configured`;
    },

    // -------------------------------------------------------------------------
    // Page 1 — Header + Verdict + Recommendations
    // -------------------------------------------------------------------------

    _headerVerdictRecommendations(fs, context, colors, tableLayout) {
        const content = [];
        const m = fs.metrics;
        const bySeverity = { critical: 0, warning: 0, info: 0 };
        fs.findings.forEach(f => { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
        const rms = m.guideRmsSettled != null ? Phd2LogParser.fmtArcsec(m.guideRmsSettled) : '—';
        const mismatchNote = m.ditherCountMismatch ? ' (dither count mismatch — see Data Quality)' : '';
        const rmsUnreliableNote = m.guideRmsUnreliable ? ' (frame/duration mismatch — see Data Quality)' : '';

        content.push({ text: `${fs.targets.join(', ')} — Combined Report`, style: 'title' });
        content.push({ text: SessionReportView._formatNight(fs), style: 'subtitle' });
        if (!fs.coverage.phd2Present) {
            content.push({ text: 'No PHD2 guide log for this night — guide-derived figures below are unavailable, not zero.', style: 'sectionNote', italics: true });
        }

        const equipText = this._equipmentText(context);
        if (equipText) content.push({ text: equipText, style: 'sectionNote' });

        content.push({ text: 'Verdict', style: 'sectionHeading' });
        content.push({
            table: {
                widths: [180, '*'],
                body: [
                    ['Subs Captured', String(m.totalSubs)],
                    ['Clean / Marginal / Reject / Unknown', `${m.cleanSubs} / ${m.marginalSubs} / ${m.rejectSubs} / ${m.unknownSubs}`],
                    ['Usable Integration', AsiairLogParser.fmtMinutes(m.totalIntegrationS)],
                    ['Settled Guide RMS', `${rms}${rmsUnreliableNote}${mismatchNote}`],
                    ['Findings', {
                        text: [
                            { text: 'Critical ', color: colors.critical, bold: true }, { text: `${bySeverity.critical}   ` },
                            { text: 'Warning ', color: colors.warning, bold: true }, { text: `${bySeverity.warning}   ` },
                            { text: 'Info ', color: colors.info, bold: true }, { text: `${bySeverity.info}` },
                        ],
                    }],
                ],
            },
            layout: tableLayout,
            margin: [0, 0, 0, 8],
        });

        content.push({ text: 'Recommendations', style: 'sectionHeading' });
        const flagged = fs.subs.filter(s => s.tier === 'marginal' || s.tier === 'reject');
        if (flagged.length > 0) {
            const parts = [];
            let lastTarget = null;
            for (const s of flagged) {
                if (s.target !== lastTarget) {
                    parts.push(`${s.target}: ${s.imageNo}`);
                    lastTarget = s.target;
                } else {
                    parts[parts.length - 1] += `, ${s.imageNo}`;
                }
            }
            content.push({ text: `Frames worth a closer look for defects (marginal/reject tier): ${parts.join('; ')}. Log analysis can't see image-level quality directly — see Data Quality.`, style: 'sectionNote' });
        }

        if (typeof SessionRecommendations !== 'undefined') {
            const recs = SessionRecommendations.build(fs, context);
            if (recs.length === 0) {
                content.push({ text: 'No recommendations available for this night.', style: 'sectionNote' });
            } else {
                const groups = [
                    { key: 'astryx', title: 'Astryx Settings' },
                    { key: 'asiair', title: 'ASIAir Configuration' },
                    { key: 'phd2', title: 'PHD2 Configuration' },
                    { key: 'process', title: 'Process / Hardware' },
                ];
                for (const g of groups) {
                    const groupRecs = recs.filter(r => r.group === g.key);
                    if (groupRecs.length === 0) continue;
                    content.push({ text: g.title, style: 'subHeading' });
                    const body = [[
                        { text: 'Setting', style: 'tableHeader' }, { text: 'Observed', style: 'tableHeader' },
                        { text: 'Recommended', style: 'tableHeader' }, { text: 'Confidence', style: 'tableHeader' },
                    ]];
                    for (const r of groupRecs) {
                        const textColor = r.changeNeeded ? colors.warning : undefined;
                        body.push([
                            { text: r.setting, color: textColor },
                            { text: r.observed, color: textColor },
                            { text: r.recommended, color: textColor },
                            { text: r.confidence, color: textColor },
                        ]);
                        if (r.changeNeeded) {
                            body.push([{ text: '' }, { text: r.evidence, colSpan: 3, italics: true, fontSize: 7, color: colors.subtitleText }, {}, {}]);
                        }
                    }
                    content.push({ table: { headerRows: 1, widths: [130, 110, 110, 70], body }, layout: tableLayout, margin: [0, 0, 0, 6] });
                }
            }
        }

        return content;
    },

    // -------------------------------------------------------------------------
    // Session Timeline (condensed) + Summary
    // -------------------------------------------------------------------------

    _timelineSummary(fs, context, colors, tableLayout) {
        const content = [];
        let entries = SessionReportView._buildTimelineEntries(fs, context);
        entries = SessionReportView._collapseConsecutive(entries);
        const condensed = entries.filter(e => !e.verbose);

        content.push({ text: 'Session Timeline', style: 'sectionHeading', pageBreak: 'before' });
        content.push({ text: 'Matches the on-screen default view (verbose events — dither, plate-solve, routine mount start/stop — omitted; full detail available on screen via "Show all events").', style: 'sectionNote' });

        if (condensed.length > 0) {
            const body = [[
                { text: 'Time', style: 'tableHeader' }, { text: 'Event', style: 'tableHeader' },
                { text: 'Duration', style: 'tableHeader' }, { text: 'Guide Quality', style: 'tableHeader' },
            ]];
            for (const e of condensed) {
                if (e.isTargetMarker) {
                    body.push([{ text: e.label, colSpan: 4, bold: true, fillColor: colors.rowAlt }, {}, {}, {}]);
                    continue;
                }
                const timeCell = SessionReportView._fmtTimelineTime(e.at) + (e.end ? '–' + SessionReportView._fmtTimelineTime(e.end) : '');
                const durationS = (e.end && e.at) ? (SessionReportView._asDate(e.end).getTime() - SessionReportView._asDate(e.at).getTime()) / 1000 : null;
                const durationCell = durationS != null && durationS > 0 ? AsiairLogParser.fmtMinutes(durationS) : '';
                const eventCell = e.finding
                    ? { text: e.label, color: e.finding.severity === 'critical' ? colors.critical : e.finding.severity === 'warning' ? colors.warning : colors.info }
                    : e.label;
                body.push([timeCell, eventCell, durationCell, e.guideQuality || '']);
            }
            content.push({ table: { headerRows: 1, widths: [80, '*', 55, 70], body }, layout: tableLayout, margin: [0, 0, 0, 8] });
        } else {
            content.push({ text: 'No flagged events this night.', style: 'sectionNote' });
        }

        if (context && context.asiairParsed && context.asiairParsed.summary) {
            const summary = context.asiairParsed.summary;
            content.push({ text: 'Summary', style: 'sectionHeading' });
            const body = [[
                { text: 'Event Type', style: 'tableHeader' }, { text: 'Total Time', style: 'tableHeader' }, { text: '% of Session', style: 'tableHeader' },
            ]];
            body.push(['Imaging', AsiairLogParser.fmtMinutes(summary.imagingTotalS), AsiairLogParser.fmtPct(summary.imagingPct)]);
            body.push(['Autofocus (incl. guide settle)', AsiairLogParser.fmtMinutes(summary.afTotalS), AsiairLogParser.fmtPct(summary.afPct)]);
            if (summary.calCount > 0) body.push(['Guide Calibration (incl. settle)', AsiairLogParser.fmtMinutes(summary.calTotalS), AsiairLogParser.fmtPct(summary.calPct)]);
            if (summary.meridianTotalS > 0) body.push(['Meridian Flip (pause + flip)', AsiairLogParser.fmtMinutes(summary.meridianTotalS), AsiairLogParser.fmtPct(summary.meridianPct)]);
            if (summary.ditherCount > 0) {
                const cleanNote = summary.ditherCleanCount < summary.ditherCount ? ` (${summary.ditherCleanCount} settled cleanly)` : '';
                body.push([`Dither (${summary.ditherCount} events)${cleanNote}`, AsiairLogParser.fmtMinutes(summary.ditherTotalS), `${AsiairLogParser.fmtPct(summary.ditherShareOfImagingPct)} of imaging`]);
            }
            body.push([
                { text: 'Total tracked', bold: true, fillColor: colors.totalRowBg },
                { text: `~${AsiairLogParser.fmtMinutes(summary.totalTrackedS)}`, fillColor: colors.totalRowBg },
                { text: '100%', fillColor: colors.totalRowBg },
            ]);
            content.push({ table: { headerRows: 1, widths: [220, 90, 90], body }, layout: tableLayout, margin: [0, 0, 0, 4] });

            if (summary.wallClockS != null) {
                const unaccountedNote = summary.unaccountedS > 0
                    ? `${AsiairLogParser.fmtMinutes(summary.unaccountedS)} unaccounted (${AsiairLogParser.fmtPct(summary.unaccountedS / summary.wallClockS * 100)} of wall clock)`
                    : 'fully accounted for';
                content.push({ text: `Wall clock: ${AsiairLogParser.fmtMinutes(summary.wallClockS)}   •   Tracked: ${AsiairLogParser.fmtMinutes(summary.totalTrackedS)}   •   ${unaccountedNote}`, style: 'sectionNote' });
            }
        }

        return content;
    },

    // -------------------------------------------------------------------------
    // Per-Sub Frame Quality — one table per target, page break before each
    // -------------------------------------------------------------------------

    _perSub(fs, colors, tableLayout) {
        const content = [];
        const byTarget = SessionReportView._groupSubsByTarget(fs);
        const cols = SessionReportView._perSubColumns();

        for (const [target, subs] of byTarget) {
            const exposureS = subs.length > 0 ? subs[0].exposureS : null;
            const header = `${target} (${subs.length} subs${exposureS != null ? ', ' + exposureS + 's' : ''})`;
            content.push({ text: 'Per-Sub Frame Quality', style: 'sectionHeading', pageBreak: 'before' });
            content.push({ text: header, style: 'subHeading' });

            const body = [cols.map(c => ({ text: c, style: 'tableHeader' }))];
            for (const s of subs) {
                const tierColor = s.tier === 'reject' ? colors.critical : s.tier === 'marginal' ? colors.warning : s.tier === 'unknown' ? colors.info : undefined;
                const row = SessionReportView._perSubRow(s).map(v => String(v));
                body.push(row.map((v, i) => i === row.length - 1 ? { text: v, color: tierColor } : v));
            }
            content.push({ table: { headerRows: 1, widths: [45, 50, 45, 45, 50, 45, 35, '*'], body }, layout: tableLayout, margin: [0, 0, 0, 8] });
        }

        return content;
    },

    // -------------------------------------------------------------------------
    // Guiding Analysis (full, incl. Guide Sessions table) + Findings +
    // Focus and Environment — only Guiding Analysis forces a page break
    // -------------------------------------------------------------------------

    _guidingFindingsFocus(fs, context, colors, tableLayout) {
        const content = [];
        content.push({ text: 'Guiding Analysis', style: 'sectionHeading', pageBreak: 'before' });

        if (!context || !context.phd2Parsed) {
            content.push({ text: 'No PHD2 guide log for this night.', style: 'sectionNote' });
        } else {
            const phd2 = context.phd2Parsed;
            const overall = phd2.overall;
            const eq = phd2.equipment || {};

            content.push({
                table: {
                    widths: [150, '*'],
                    body: [
                        ['Guide Camera', eq.camera || '—'],
                        ['Pixel Scale', eq.pixelScale != null ? eq.pixelScale + '"/px' : '—'],
                        ['Focal Length', eq.focalLength != null ? eq.focalLength + ' mm' : '—'],
                        ['Guide Exposure', eq.exposureMs != null ? (eq.exposureMs / 1000).toFixed(1) + 's' : '—'],
                        ['Mount', eq.mount || '—'],
                    ],
                },
                layout: tableLayout,
                margin: [0, 0, 0, 8],
            });

            if (overall) {
                const excludedNote = overall.excludedCriticalSessionCount > 0
                    ? ` (${overall.excludedCriticalSessionCount} session${overall.excludedCriticalSessionCount > 1 ? 's' : ''} with critical RMS excluded — see Findings)`
                    : '';
                content.push({ text: `Headline RMS is settled-frame RMS (dither-settle frames excluded)${excludedNote}. All-frames figures shown for reference.`, style: 'sectionNote' });
                content.push({
                    table: {
                        widths: [150, '*'],
                        body: [
                            ['Guide Sessions', `${overall.sessionCount} total, ${overall.fullSessionCount} full`],
                            ['Total Guide Frames', overall.totalFrames.toLocaleString()],
                            ['RMS RA', `${overall.raRms != null ? Phd2LogParser.fmtArcsec(overall.raRms) : '—'} (all: ${Phd2LogParser.fmtArcsec(overall.raRmsAll)})`],
                            ['RMS Dec', `${overall.decRms != null ? Phd2LogParser.fmtArcsec(overall.decRms) : '—'} (all: ${Phd2LogParser.fmtArcsec(overall.decRmsAll)})`],
                            ['RMS Total', `${overall.totRms != null ? Phd2LogParser.fmtArcsec(overall.totRms) : '—'} (all: ${Phd2LogParser.fmtArcsec(overall.totRmsAll)})`],
                            ['Avg Guide Star SNR', Phd2LogParser.fmtSnr(overall.avgSnr)],
                            ['Total Dither Events', String(overall.totalDithers)],
                        ],
                    },
                    layout: tableLayout,
                    margin: [0, 0, 0, 8],
                });
            }

            const byPier = { East: [], West: [] };
            for (const s of phd2.sessions) {
                const side = s.geometry && s.geometry.pierSide;
                if (side && byPier[side] && s.stats && s.stats.totRms != null) byPier[side].push(s.stats.totRms);
            }
            if (byPier.East.length > 0 || byPier.West.length > 0) {
                const avg = (arr) => arr.length ? Phd2LogParser.fmtArcsec(arr.reduce((a, b) => a + b, 0) / arr.length) : '—';
                content.push({ text: `Pier side: East ${avg(byPier.East)} (n=${byPier.East.length})   •   West ${avg(byPier.West)} (n=${byPier.West.length})`, style: 'sectionNote' });
            }

            const allDithers = phd2.sessions.flatMap(s => s.ditherEvents).filter(d => d.dxPx !== null);
            if (allDithers.length > 0) {
                const pixelScale = (phd2.equipment && phd2.equipment.pixelScale) || 1;
                const mags = allDithers.map(d => Math.sqrt(d.dxPx ** 2 + d.dyPx ** 2));
                const meanPx = mags.reduce((a, b) => a + b, 0) / mags.length;
                const maxPx = Math.max(...mags);
                content.push({ text: `Dither amplitude: mean ${meanPx.toFixed(2)}px (${(meanPx * pixelScale).toFixed(1)}"), max ${maxPx.toFixed(2)}px (${(maxPx * pixelScale).toFixed(1)}"), n=${allDithers.length}`, style: 'sectionNote' });
            }

            if (typeof SessionRecommendations !== 'undefined') {
                const settleInfo = SessionRecommendations.buildDitherSettleTimeoutInfo(context);
                if (settleInfo) content.push({ text: `Effective dither settle timeout: ${settleInfo.text}`, style: 'sectionNote' });
                const framesInfo = SessionRecommendations.buildFramesPerDitherInfo(context);
                if (framesInfo) content.push({ text: `Effective frames per dither: ${framesInfo.text}`, style: 'sectionNote' });
            }

            if (phd2.sessions.length > 0) {
                content.push({ text: `Guide Sessions (${phd2.sessions.length})`, style: 'subHeading' });
                const body = [[
                    { text: '#', style: 'tableHeader' }, { text: 'Time Range', style: 'tableHeader' }, { text: 'Frames', style: 'tableHeader' },
                    { text: 'RMS RA', style: 'tableHeader' }, { text: 'RMS Dec', style: 'tableHeader' }, { text: 'RMS Total', style: 'tableHeader' }, { text: 'Avg SNR', style: 'tableHeader' },
                ]];
                for (const s of phd2.sessions) {
                    if (!s.stats) {
                        body.push([String(s.num), { text: 'No frames recorded', colSpan: 6, color: colors.subtitleText }, {}, {}, {}, {}, {}]);
                        continue;
                    }
                    const { raRms, decRms, totRms, totRmsAll, avgSnr } = s.stats;
                    const totalCell = totRms != null
                        ? `${Phd2LogParser.fmtArcsec(totRms)} (all: ${Phd2LogParser.fmtArcsec(totRmsAll)})`
                        : `— (all: ${Phd2LogParser.fmtArcsec(totRmsAll)})`;
                    const timeRange = Phd2LogParser._sessionTimeRange ? Phd2LogParser._sessionTimeRange(s) : `${s.startTime}–${s.endTime || '?'}`;
                    body.push([
                        `${s.num}${s.incomplete ? ' ⚠' : ''}`,
                        timeRange,
                        String(s.frames.length),
                        raRms != null ? Phd2LogParser.fmtArcsec(raRms) : '—',
                        decRms != null ? Phd2LogParser.fmtArcsec(decRms) : '—',
                        totalCell,
                        Phd2LogParser.fmtSnr(avgSnr),
                    ]);
                }
                content.push({ table: { headerRows: 1, widths: [20, 130, 45, 50, 50, 95, 45], body }, layout: tableLayout, margin: [0, 0, 0, 8] });
            }

            if (phd2.calibrations.length > 0) {
                content.push({ text: `Calibrations (${phd2.calibrations.length})`, style: 'subHeading' });
                const body = [[
                    { text: 'Started', style: 'tableHeader' }, { text: 'West Rate', style: 'tableHeader' }, { text: 'North Rate', style: 'tableHeader' },
                    { text: 'Orthogonality', style: 'tableHeader' }, { text: 'Star Lost', style: 'tableHeader' },
                ]];
                for (const c of phd2.calibrations) {
                    body.push([
                        String(c.startedAt),
                        c.west.ratePxPerSec != null ? c.west.ratePxPerSec.toFixed(3) + ' px/s' : '—',
                        c.north.ratePxPerSec != null ? c.north.ratePxPerSec.toFixed(3) + ' px/s' : '—',
                        c.orthogonalityErrorDeg != null ? c.orthogonalityErrorDeg.toFixed(2) + '°' : '—',
                        String(c.starLostDuringCalibration || '—'),
                    ]);
                }
                content.push({ table: { headerRows: 1, widths: [100, 80, 80, 80, 60], body }, layout: tableLayout, margin: [0, 0, 0, 8] });
            }
        }

        // Findings — no forced break, stays with Guiding Analysis unless it overflows
        content.push({ text: 'Findings', style: 'sectionHeading' });
        const order = { critical: 0, warning: 1, info: 2 };
        const items = [];
        for (const f of fs.findings) {
            items.push({ severity: f.severity, title: f.title, detail: f.detail, confidence: f.confidence, affectedSubs: f.affectedSubs, ruledOut: f.ruledOut });
        }
        const phd2Anomalies = (context && context.phd2Parsed && context.phd2Parsed.anomalies) || [];
        for (const a of phd2Anomalies) {
            items.push({
                severity: a.severity,
                title: `Guide session ${a.session}: ${a.message}`,
                detail: a.timeRange ? `Time range: ${a.timeRange}` : (a.startLine ? `Line ${a.startLine}` : ''),
                confidence: 'measured', affectedSubs: [], ruledOut: [],
            });
        }
        if (items.length === 0) {
            content.push({ text: 'No findings raised for this night.', style: 'sectionNote' });
        } else {
            items.sort((a, b) => order[a.severity] - order[b.severity]);
            const ul = [];
            for (const item of items) {
                const severityColor = item.severity === 'critical' ? colors.critical : item.severity === 'warning' ? colors.warning : colors.info;
                const lines = [{ text: [{ text: item.title, bold: true, color: severityColor }, { text: `  (${item.confidence})`, color: colors.subtitleText, fontSize: 7 }] }];
                if (item.detail) lines.push({ text: item.detail, fontSize: 7.5, color: colors.noteText });
                if (item.affectedSubs && item.affectedSubs.length > 0) lines.push({ text: `Affected: ${item.affectedSubs.join(', ')}`, fontSize: 7.5, color: colors.subtitleText });
                if (item.ruledOut && item.ruledOut.length > 0) lines.push({ text: `Ruled out: ${item.ruledOut.map(r => r.hypothesis).join('; ')}`, fontSize: 7.5, color: colors.subtitleText });
                ul.push({ stack: lines, margin: [0, 0, 0, 5] });
            }
            content.push({ ul, margin: [0, 0, 0, 4] });
        }

        // Focus and Environment — no forced break
        content.push({ text: 'Focus and Environment', style: 'sectionHeading' });
        if (typeof SessionDetectors !== 'undefined' && context) {
            const d13 = SessionDetectors.D13_focusDrift(fs, context);
            if (d13.length > 0) content.push({ text: d13[0].title, style: 'sectionNote' });
            const d11 = SessionDetectors.D11_afHealth(fs, context);
            const trend = d11.find(f => f.code === 'D11_STAR_SIZE_TREND');
            if (trend) content.push({ text: trend.title, style: 'sectionNote' });
        }
        if (context && context.asiairParsed) {
            const afEvents = context.asiairParsed.runs.filter(r => r.kind === 'light')
                .flatMap(r => r.events).filter(e => e.type === 'autofocus').sort((a, b) => a.start - b.start);
            if (afEvents.length > 0) {
                const body = [[
                    { text: 'Time', style: 'tableHeader' }, { text: 'Trigger', style: 'tableHeader' }, { text: 'Duration', style: 'tableHeader' },
                    { text: 'Outcome', style: 'tableHeader' }, { text: 'Temp', style: 'tableHeader' }, { text: 'Star Size', style: 'tableHeader' },
                ]];
                for (const e of afEvents) {
                    body.push([
                        AsiairLogParser.fmtTime(e.start),
                        e.trigger || '—',
                        e.durationS != null ? AsiairLogParser.fmtMinutes(e.durationS) : '—',
                        e.outcome,
                        e.temperatureC != null ? e.temperatureC + '°C' : '—',
                        e.achievedStarSize != null ? e.achievedStarSize.toFixed(1) : '—',
                    ]);
                }
                content.push({ table: { headerRows: 1, widths: [55, 65, 55, 55, 45, '*'], body }, layout: tableLayout, margin: [0, 0, 0, 8] });
            }
        }

        return content;
    },

    // -------------------------------------------------------------------------
    // Data Quality (incl. Meridian Flip Verification, #245)
    // -------------------------------------------------------------------------

    _dataQuality(fs, context, colors, tableLayout) {
        const content = [];
        content.push({ text: 'Data Quality', style: 'sectionHeading', pageBreak: 'before' });

        const failedInvariants = fs.invariants.filter(i => !i.passed);
        content.push({ text: `${fs.invariants.length} invariant(s) checked, ${failedInvariants.length} failed.`, style: 'sectionNote' });
        if (failedInvariants.length > 0) {
            content.push({
                ul: failedInvariants.map(inv => ({ text: [{ text: `${inv.id}: `, bold: true }, { text: inv.impact }], fontSize: 8 })),
                margin: [0, 0, 0, 4],
            });
        }

        const asiairUnmatched = (context && context.asiairParsed && context.asiairParsed.source && context.asiairParsed.source.unmatchedLines) || [];
        const phd2Unmatched = (context && context.phd2Parsed && context.phd2Parsed.source && context.phd2Parsed.source.unmatchedLines) || [];
        const totalUnmatched = asiairUnmatched.length + phd2Unmatched.length;
        let unmatchedText = `Unmatched log lines: ${totalUnmatched}`;
        if (totalUnmatched > 0) {
            const samples = [...asiairUnmatched, ...phd2Unmatched].slice(0, 5);
            unmatchedText += ` — e.g. line ${samples.map(s => s.lineNo).join(', ')}`;
        }
        content.push({ text: unmatchedText, style: 'sectionNote' });
        content.push({ text: `Subs without guide data: ${fs.coverage.subsWithoutGuideData ?? '—'}`, style: 'sectionNote' });

        if (typeof SessionRecommendations !== 'undefined' && SessionRecommendations.buildMeridianVerification) {
            const rows = SessionRecommendations.buildMeridianVerification(context);
            if (rows.length > 0) {
                content.push({ text: 'Meridian Flip Verification', style: 'subHeading' });
                const body = [[
                    { text: 'Setting', style: 'tableHeader' }, { text: 'Observed', style: 'tableHeader' },
                    { text: 'Astryx Setting', style: 'tableHeader' }, { text: 'Delta', style: 'tableHeader' },
                ]];
                for (const r of rows) body.push([r.setting, r.observed, r.astryxSetting, r.delta]);
                content.push({ table: { headerRows: 1, widths: [90, 110, 110, 90], body }, layout: tableLayout, margin: [0, 0, 0, 8] });
            }
        }

        content.push({ text: 'Stated Limits', style: 'subHeading' });
        content.push({
            ul: [
                'Satellite and aircraft trails are undetectable from either log — the guide camera sees a different patch of sky than the main camera.',
                'Image-level quality (transparency within a sub, gradients, FWHM, focus at the sensor) is invisible to log analysis. Log-based rejection is not a complete keeper/reject list.',
                'Guide-star mass is not a usable transparency proxy — it stays roughly flat within a single guide-star lock even through known cloud, and isn\'t comparable across star re-selections.',
                'A detector finds what it was written to find. Novel failure modes surface only as invariant failures or unaccounted time, not as a named finding.',
                'All thresholds in this report are calibrated against this specific rig (AM5 / AT115EDT / ASI120MM Mini) over the validation corpus — not universal defaults.',
            ],
            fontSize: 8,
            color: colors.noteText,
        });

        return content;
    },

};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
