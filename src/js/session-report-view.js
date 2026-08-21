/**
 * session-report-view.js
 * Renders a FusedSession (session-fusion.js) as the combined ASIAir+PHD2
 * report described in session-analysis-design.md §7. Added alongside the
 * existing AsiairLogView/Phd2LogView reports for side-by-side comparison
 * (ELR.p5-1) — retiring those is its own later issue, gated on confirming
 * nothing useful was lost here first.
 *
 * Layout below reflects a synthesis pass against a real two-target night
 * (2025-11-17) comparing this report to the two originals it's meant to
 * replace — see delivery notes for the full before/after reasoning.
 *
 * Contains no thresholds and no classification logic (design doc §3) —
 * every number and tier/severity already exists on FusedSession/findings
 * by the time this file runs. Raw factual tables (per-sub RMS, time
 * accounting) read directly from FusedSession/raw parser output; only
 * diagnostic/explanatory prose is required to trace back to a Finding.
 *
 * Each §-numbered section below is a separate method, deliberately, so a
 * future change to one section doesn't require re-reading the whole file
 * — the existing single-function views were harder to maintain for
 * exactly this reason.
 */

const SessionReportView = {

    _fusedSession: null,
    _context: null,
    _showVerboseEvents: false,

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    /**
     * @param {object} fusedSession - SessionFusion.fuseNight() output.
     * @param {object} context - { asiairParsed, phd2Parsed } — several
     *   sections need raw parser data FusedSession doesn't carry forward
     *   (block boundaries, calibration/geometry detail, unmatched-line
     *   samples), matching the pattern session-detectors.js already uses.
     */
    render(fusedSession, context) {
        this._fusedSession = fusedSession;
        this._context = context || {};
        const container = document.getElementById('session-analysis-accordions');
        if (!container) return;
        const existing = document.getElementById('accordion-combined');
        if (existing) existing.remove();
        const accordion = document.createElement('div');
        accordion.id = 'accordion-combined';
        accordion.className = 'analysis-accordion';
        if (fusedSession.kind === 'calibrationOnly') {
            accordion.innerHTML = `
                <div class="analysis-accordion-header">
                    <span class="analysis-accordion-arrow">▶</span>
                    <span class="analysis-accordion-title">Combined Report — Calibration Only</span>
                </div>
                <div class="analysis-accordion-body">
                    <div class="session-report">
                        <p style="color:var(--text-secondary)">This night's ASIAir log contains no light-frame imaging — flat/dark/bias/framing runs only. Nothing to report against the flats-excluded-entirely rule.</p>
                    </div>
                </div>
            `;
            container.appendChild(accordion);
            accordion.querySelector('.analysis-accordion-header').addEventListener('click', () => {
                accordion.classList.toggle('open');
            });
            return;
        }
        const title = `Combined Report — ${fusedSession.targets.map(t => HtmlUtils.escapeHtml(t)).join(', ')} — ${this._formatNight(fusedSession)}`;
        const reportHtml = this._buildReportHtml(fusedSession, this._context);
        accordion.innerHTML = `
            <div class="analysis-accordion-header">
                <span class="analysis-accordion-arrow">▶</span>
                <span class="analysis-accordion-title">${title}</span>
            </div>
            <div class="analysis-accordion-body">
                ${reportHtml}
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary btn-sm" id="combined-csv-btn">Download Per-Sub CSV</button>
                    <button class="btn btn-primary btn-sm" id="combined-pdf-btn">Download PDF Report</button>
                </div>
            </div>
        `;
        container.appendChild(accordion);
        accordion.querySelector('.analysis-accordion-header').addEventListener('click', () => {
            accordion.classList.toggle('open');
        });
        document.getElementById('combined-csv-btn').addEventListener('click', () => {
            this._downloadCsv(fusedSession);
        });
        document.getElementById('combined-pdf-btn').addEventListener('click', () => {
            SessionReportPdf.download(fusedSession, this._context);
        });
        const toggle = document.getElementById('combined-verbose-toggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this._showVerboseEvents = e.target.checked;
                this._applyVerboseVisibility();
            });
        }
        this._applyVerboseVisibility();
    },

    // Show/hide already-rendered verbose timeline rows without a full
    // re-render — cheap toggle, and the state (_showVerboseEvents) is kept
    // on this object so a future PDF export can read the same preference
    // rather than always rendering everything.
    _applyVerboseVisibility() {
        const rows = document.querySelectorAll('.session-report-timeline-verbose');
        rows.forEach(r => { r.style.display = this._showVerboseEvents ? '' : 'none'; });
    },

    _buildReportHtml(fs, context) {
        if (fs.kind === 'calibrationOnly') {
            return `<div class="session-report"><p style="color:var(--text-secondary)">This night's ASIAir log contains no light-frame imaging — nothing to report.</p></div>`;
        }
        let html = `<div class="session-report">`;
        html += this._buildHeaderHtml(fs);
        html += this._buildVerdictHtml(fs, context);                  // §1
        html += this._buildRecommendedSettingsHtml(fs, context);       // moved directly after Verdict
        html += this._buildTimelineHtml(fs, context);                  // §2
        html += this._buildTimeAccountingHtml(context);                 // Summary — directly under the timeline, matching the original ASIAir report's layout
        html += this._buildPerSubHtml(fs);                             // §3
        html += this._buildGuidingHtml(fs, context);                    // §5 (Equipment/Overall/Guide Sessions/Calibrations)
        html += this._buildFindingsHtml(fs, context);                   // §4 — moved to directly after Calibrations
        html += this._buildFocusHtml(fs, context);                      // §6
        html += this._buildDataQualityHtml(fs, context);                // §9
        html += `</div>`;
        return html;
    },

    // -------------------------------------------------------------------------
    // Header
    // -------------------------------------------------------------------------

    _buildHeaderHtml(fs) {
        const coverageNote = fs.coverage.phd2Present
              ? ''
              : `<p class="session-report-note-small" style="color:var(--text-secondary)">No PHD2 guide log for this night — guide-derived figures below are unavailable, not zero.</p>`;
        return `
            <h3 class="session-report-title">${fs.targets.map(t => HtmlUtils.escapeHtml(t)).join(', ')} — Combined Report</h3>
            <p class="session-report-subtitle">${this._formatNight(fs)}</p>
            ${coverageNote}
        `;
    },

    _formatNight(fs) {
        if (fs.night) return fs.night;
        if (!fs.span) return '';
        const fmtLocal = (d) => {
            const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const d1 = fmtLocal(fs.span.from), d2 = fmtLocal(fs.span.to);
        return d1 === d2 ? d1 : `${d1} / ${d2}`;
    },

    // -------------------------------------------------------------------------
    // §1 — Verdict
    // -------------------------------------------------------------------------

    _buildVerdictHtml(fs, context) {
        const m = fs.metrics;
        const bySeverity = { critical: 0, warning: 0, info: 0 };
        fs.findings.forEach(f => { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
        const rms = m.guideRmsSettled != null ? Phd2LogParser.fmtArcsec(m.guideRmsSettled) : '—';
        const mismatchNote = m.ditherCountMismatch ? ' <span style="color:var(--text-secondary)">(dither count mismatch — see §9)</span>' : '';
        const rmsUnreliableNote = m.guideRmsUnreliable ? ' <span style="color:var(--text-secondary)">(frame/duration mismatch — see §9)</span>' : '';

        return `
            <h4 class="session-report-section">Verdict</h4>
            ${this._buildImagingEquipmentHtml(context)}
            <table class="session-table">
                <tbody>
                    <tr><td>Subs Captured</td><td>${m.totalSubs}</td></tr>
                    <tr><td>Clean / Marginal / Reject / Unknown</td><td>${m.cleanSubs} / ${m.marginalSubs} / ${m.rejectSubs} / ${m.unknownSubs}</td></tr>
                    <tr><td>Usable Integration</td><td>${AsiairLogParser.fmtMinutes(m.totalIntegrationS)}</td></tr>
                    <tr><td>Settled Guide RMS</td><td>${rms}${rmsUnreliableNote}${mismatchNote}</td></tr>
                    <tr><td>Findings</td><td>
                        ${this._severityBadge('critical')} ${bySeverity.critical} &nbsp;
                        ${this._severityBadge('warning')} ${bySeverity.warning} &nbsp;
                        ${this._severityBadge('info')} ${bySeverity.info}
                    </td></tr>
                </tbody>
            </table>
        `;
    },

    // Imaging telescope/sensor. Primary source: Astryx's own imaging-log
    // session matched to this night (utilities-view.js resolves
    // context.telescope/sensor/telescopeName/sensorName before this
    // renders — neither raw log describes the imaging train, only the
    // guide train). Falls back to the "exactly one registered" heuristic
    // when no imaging-log session was logged for this date, since that's
    // still better than nothing for a single-rig setup.
    _buildImagingEquipmentHtml(context) {
        if (context && context.telescopeName && context.sensorName) {
            const tel = context.telescope;
            const sen = context.sensor;
            const pixelSizeUm = (sen && sen.pixelSizeX != null && sen.pixelSizeY != null) ? (sen.pixelSizeX + sen.pixelSizeY) / 2 : null;
            const pixelScale = (tel && tel.focalLength && pixelSizeUm) ? (206.265 * pixelSizeUm / tel.focalLength) : null;
            return `<p class="session-report-note-small"><strong>${HtmlUtils.escapeHtml(context.telescopeName)}</strong> / <strong>${HtmlUtils.escapeHtml(context.sensorName)}</strong>${pixelScale != null ? ` (${pixelScale.toFixed(2)}"/px)` : ''} <span style="color:var(--text-secondary)">— from Astryx imaging-log session this night</span></p>`;
        }

        if (typeof DataManager === 'undefined' || !DataManager.getTelescopes || !DataManager.getSensors) return '';
        const telescopes = DataManager.getTelescopes();
        const sensors = DataManager.getSensors();
        const telNames = Object.keys(telescopes);
        const senNames = Object.keys(sensors);

        if (telNames.length !== 1 || senNames.length !== 1) {
            return `<p class="session-report-note-small" style="color:var(--text-secondary)">Imaging telescope/sensor: no matching Astryx imaging-log session for this date, and ${telNames.length} telescope(s)/${senNames.length} sensor(s) configured — can't infer which was used from the logs alone.</p>`;
        }

        const tel = telescopes[telNames[0]];
        const sen = sensors[senNames[0]];
        const pixelSizeUm = (sen && sen.pixelSizeX != null && sen.pixelSizeY != null) ? (sen.pixelSizeX + sen.pixelSizeY) / 2 : null;
        const pixelScale = (tel && tel.focalLength && pixelSizeUm) ? (206.265 * pixelSizeUm / tel.focalLength) : null;

        return `<p class="session-report-note-small"><strong>${HtmlUtils.escapeHtml(telNames[0])}</strong> / <strong>${HtmlUtils.escapeHtml(senNames[0])}</strong>${pixelScale != null ? ` (${pixelScale.toFixed(2)}"/px)` : ''} <span style="color:var(--text-secondary)">— no matching imaging-log session; only one rig configured</span></p>`;
        },

        _severityBadge(severity) {
            const label = severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Info';
            return `<span class="guide-flag guide-flag-${severity}">${label}</span>`;
        },

        _severityIcon(severity) {
            return severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : 'ℹ️';
        },

        // -------------------------------------------------------------------------
        // §2 — Session timeline
        // -------------------------------------------------------------------------

        // Columns: Time (start–end) | Event | Duration | Guide Quality
        // (imaging rows only) — matching the original ASIAir report's format
        // (duration to one decimal minute). Target isn't its own column —
        // instead a timeless "Target NGC 281" marker row is inserted whenever
        // the active run's target changes, since that reads more like the
        // sequence plan itself than a repeated column value would. Plate
        // Solve / Dither / routine mount start-stop are hidden by default
        // (verbose toggle) — not deleted, since some nights they're exactly
        // what you want to see; a real mount disconnect stays visible always,
        // only the routine startTracking/stopTracking pair is considered
        // verbose. Consecutive identical events collapse into one row with a
        // count, so ~100 identical guide failures in a row (as happens on a
        // bad night) show as one line, not a hundred.
        _buildTimelineHtml(fs, context) {
            let entries = this._buildTimelineEntries(fs, context);
            entries = this._collapseConsecutive(entries);
            if (entries.length === 0) return '';

            let html = `
            <h4 class="session-report-section">Session Timeline</h4>
            <p class="session-report-note-small">
                <label><input type="checkbox" id="combined-verbose-toggle" ${this._showVerboseEvents ? 'checked' : ''}>
                Show all events (dither, plate-solve, routine mount start/stop)</label>
            </p>
            <table class="session-table">
                <thead>
                    <tr><th>Time</th><th>Event</th><th>Duration</th><th>Guide Quality</th></tr>
                </thead>
                <tbody>
        `;
            for (const e of entries) {
                if (e.isTargetMarker) {
                    html += `<tr class="session-report-timeline-target"><td></td><td><strong>${HtmlUtils.escapeHtml(e.label)}</strong></td><td></td><td></td></tr>`;
                    continue;
                }
                const timeCell = this._fmtTimelineTime(e.at) + (e.end ? '–' + this._fmtTimelineTime(e.end) : '');
                const durationS = (e.end && e.at) ? (this._asDate(e.end).getTime() - this._asDate(e.at).getTime()) / 1000 : null;
                const durationCell = durationS != null && durationS > 0 ? AsiairLogParser.fmtMinutes(durationS) : '';
                const countSuffix = e.count > 1 ? ` ×${e.count}` : '';
                const label = e.finding
                      ? `${this._severityIcon(e.finding.severity)} ${HtmlUtils.escapeHtml(e.label)}`
                      : HtmlUtils.escapeHtml(e.label);
                const rowClasses = [e.finding ? 'session-report-timeline-flagged' : '', e.verbose ? 'session-report-timeline-verbose' : '']
                      .filter(Boolean).join(' ');
                const rowAttr = rowClasses ? ` class="${rowClasses}"` : '';
                const style = e.verbose && !this._showVerboseEvents ? ' style="display:none"' : '';
                html += `<tr${rowAttr}${style}><td>${timeCell}</td><td>${label}${countSuffix}</td><td>${durationCell}</td><td>${e.guideQuality || ''}</td></tr>`;
            }
            html += `</tbody></table>`;
            return html;
        },

        // Merges imaging blocks (with per-block guide quality, joined by
        // sequenceNo range rather than imageNo — imageNo resets per run,
        // sequenceNo is monotonic across the whole night per #229), run events,
        // and findings with a timeRange into one chronological list.
        _buildTimelineEntries(fs, context) {
            const entries = [];

            if (context && context.asiairParsed) {
                for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
                    for (const block of run.blocks) {
                        if (block.subs.length === 0 || !block.startedAt) continue;
                        const seqLo = block.subs[0].sequenceNo, seqHi = block.subs[block.subs.length - 1].sequenceNo;
                        const inBlock = fs.subs.filter(s => s.sequenceNo >= seqLo && s.sequenceNo <= seqHi);
                        const rmsValues = inBlock.filter(s => s.guide && s.guide.rmsTotal != null).map(s => s.guide.rmsTotal);
                        const avgRms = rmsValues.length ? rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length : null;
                        const imgRange = block.firstImageNo === block.lastImageNo
                              ? `img ${block.firstImageNo}` : `imgs ${block.firstImageNo}–${block.lastImageNo}`;
                        entries.push({
                            at: block.startedAt,
                            end: block.endedAt,
                            label: `Imaging (${imgRange})`,
                            target: run.target,
                            guideQuality: avgRms != null ? Phd2LogParser.fmtArcsec(avgRms) : '—',
                            verbose: false,
                        });
                    }

                    for (const entry of run.events) {
                        // Meridian flip is two distinct log phases (pre-flip
                        // pause, then the physical flip) — split into two
                        // timeline rows instead of one pauseStartedAt->
                        // flipEndedAt bar (Issue #255).
                        if (entry.type === 'meridian_flip') {
                            if (entry.pauseStartedAt && entry.flipStartedAt) {
                                entries.push({
                                    at: entry.pauseStartedAt, end: entry.flipStartedAt,
                                    label: 'Meridian Flip — Pause', target: run.target,
                                    guideQuality: null, verbose: this._isVerboseEvent(entry),
                                });
                            }
                            if (entry.flipStartedAt && entry.flipEndedAt) {
                                entries.push({
                                    at: entry.flipStartedAt, end: entry.flipEndedAt,
                                    label: 'Meridian Flip', target: run.target,
                                    guideQuality: null, verbose: this._isVerboseEvent(entry),
                                });
                            }
                            continue;
                        }

                        const label = this._eventTypeLabel(entry.type, entry);
                        if (!label) continue;
                        const at = entry.start || entry.at || entry.startedAt || entry.pauseStartedAt;
                        if (!at) continue;
                        const end = entry.end || entry.endedAt || entry.flipEndedAt || null;
                        entries.push({ at, end, label, target: run.target, guideQuality: null, verbose: this._isVerboseEvent(entry) });
                    }
                }
            }

            for (const gap of (context && context.asiairParsed && context.asiairParsed.gaps) || []) {
                if (!gap.startedAt) continue;
                entries.push({ at: gap.startedAt, end: gap.endedAt, label: `Log Gap`, target: null, guideQuality: null, verbose: false });
            }

            const REDUNDANT_WITH_TIMELINE = new Set(['D5_MANUAL_INTERVENTION', 'D6_MOUNT_DISCONNECT']);
            const VERBOSE_FINDINGS = new Set([
                'D15_LOCK_POSITION_EDGE',
                'D7_CADENCE_IRREGULARITY',
                'D2_CLOUD_TRANSPARENCY',
                'D1_GUIDE_STAR_SWAP',
                'D8_ELEVATED_GUIDING',
                'D9_AXIS_RATIO_INVERSION',
                'D14_DROP_RATE',
                'D10_STAR_LOST_DURING_CALIBRATION',
                'D10_ORTHOGONALITY_OUTLIER',
                'D16_GUIDE_RECOVERY',
            ]);
            for (const f of fs.findings) {
                if (!f.timeRange || !f.timeRange.from) continue;
                if (REDUNDANT_WITH_TIMELINE.has(f.code)) continue;
                const at = this._asDate(f.timeRange.from);
                if (!at) continue;
                entries.push({ at, end: this._asDate(f.timeRange.to), label: f.title, target: null, guideQuality: null, finding: f, verbose: VERBOSE_FINDINGS.has(f.code) });
            }

            entries.sort((a, b) => a.at - b.at);

            // Insert a timeless "Target X" marker row wherever the active
            // target changes, in place of a repeated Target column — reads
            // more like the sequence plan itself. Detected from run.target on
            // each entry in chronological order, not from a separate pass over
            // runs directly, so it reflects what's actually about to appear
            // next on the rendered timeline rather than the run list's own
            // ordering (which could differ if events interleave across runs).
            const withMarkers = [];
            let lastTarget = null;
            for (const e of entries) {
                if (e.target && e.target !== lastTarget) {
                    withMarkers.push({ at: e.at, label: `Target ${e.target}`, isTargetMarker: true, count: 1 });
                    lastTarget = e.target;
                }
                withMarkers.push(e);
            }
            return withMarkers;
        },

        // Only routine mount start/stop tracking is "verbose" among mount
        // events — a real disconnect stays visible regardless of the toggle.
        _isVerboseEvent(event) {
            if (event.type === 'dither' || event.type === 'plate_solve') return true;
            if (event.type === 'guide_recovery' || event.type === 'guide_failure') return true;
            if (event.type === 'mount' && (event.kind === 'startTracking' || event.kind === 'stopTracking')) return true;
            return false;
        },

        _eventTypeLabel(type, event) {
            switch (type) {
            case 'autofocus': return `Autofocus (${event.trigger || '?'}, ${event.outcome})`;
            case 'dither': return `Dither (${event.outcome})`;
            case 'guide_calibration': return 'Guide Calibration';
            case 'meridian_flip': return 'Meridian Flip';
            case 'intervention': return event.kind === 'manualStop' ? 'Manual Stop' : 'AF Cancelled';
            case 'mount': return `Mount: ${event.kind}`;
            case 'plate_solve': return `Plate Solve (${event.outcome || '?'})`;
            case 'guide_recovery': return `Guide Recovery (${event.outcome})`;
            case 'guide_failure': return `Guide Failure (${event.kind})`;
            default: return null;
            }
        },

        // Consecutive rows with the same label+target+guideQuality collapse
        // into one, spanning first.at to last.end (or last.at), with a count.
        // Findings are never collapsed into each other or into a plain event
        // row, even if a label happened to match, since each finding is a
        // distinct, individually-evidenced claim.
        _collapseConsecutive(entries) {
            const collapsed = [];
            for (const e of entries) {
                const last = collapsed[collapsed.length - 1];
                const sameKey = last && !last.finding && !e.finding && !last.isTargetMarker && !e.isTargetMarker &&
                      last.label === e.label && last.target === e.target && last.guideQuality === e.guideQuality;
                if (sameKey) {
                    last.end = e.end || e.at;
                    last.count = (last.count || 1) + 1;
                } else {
                    collapsed.push({ ...e, count: e.count || 1 });
                }
            }
            return collapsed;
        },

        // Some Finding.timeRange values come from PHD2 session.startTime/endTime
        // (strings), while everything else on the timeline (blocks, run events)
        // uses Date objects — normalizes either into a Date rather than assuming
        // one type, since this view is the first place anything actually
        // renders these values.
        _asDate(value) {
            if (!value) return null;
            if (value instanceof Date) return value;
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d;
        },

        _fmtTimelineTime(value) {
            const d = this._asDate(value);
            return d ? AsiairLogParser.fmtTime(d) : '';
        },

        // -------------------------------------------------------------------------
        // Summary / Time accounting — moved directly under the timeline,
        // matching the original ASIAir report's layout. Same table this file
        // previously rendered as "§7" further down; repositioned only.
        // -------------------------------------------------------------------------

        _buildTimeAccountingHtml(context) {
            if (!context || !context.asiairParsed || !context.asiairParsed.summary) return '';
            const summary = context.asiairParsed.summary;

            let html = `
            <h4 class="session-report-section">Summary</h4>
            <table class="session-table">
                <thead><tr><th>Event Type</th><th>Total Time</th><th>% of Session</th></tr></thead>
                <tbody>
                    <tr><td>Imaging</td><td>${AsiairLogParser.fmtMinutes(summary.imagingTotalS)}</td><td>${AsiairLogParser.fmtPct(summary.imagingPct)}</td></tr>
                    <tr><td>Autofocus (incl. guide settle)</td><td>${AsiairLogParser.fmtMinutes(summary.afTotalS)}</td><td>${AsiairLogParser.fmtPct(summary.afPct)}</td></tr>
        `;
            if (summary.calCount > 0) {
                html += `<tr><td>Guide Calibration (incl. settle)</td><td>${AsiairLogParser.fmtMinutes(summary.calTotalS)}</td><td>${AsiairLogParser.fmtPct(summary.calPct)}</td></tr>`;
            }
            if (summary.meridianTotalS > 0 && context.asiairParsed.runs) {
                // Independently computed from run events rather than a
                // single combined summary.meridianTotalS field, so the
                // Time Accounting split matches the Timeline split
                // (Issue #255) without requiring a parser change.
                let pauseTotalS = 0, flipTotalS = 0;
                for (const run of context.asiairParsed.runs.filter(r => r.kind === 'light')) {
                    for (const entry of run.events) {
                        if (entry.type !== 'meridian_flip') continue;
                        if (entry.pauseStartedAt && entry.flipStartedAt) {
                            pauseTotalS += (entry.flipStartedAt.getTime() - entry.pauseStartedAt.getTime()) / 1000;
                        }
                        if (entry.flipStartedAt && entry.flipEndedAt) {
                            flipTotalS += (entry.flipEndedAt.getTime() - entry.flipStartedAt.getTime()) / 1000;
                        }
                    }
                }
                const pausePct = summary.totalTrackedS > 0 ? (pauseTotalS / summary.totalTrackedS) * 100 : 0;
                const flipPct = summary.totalTrackedS > 0 ? (flipTotalS / summary.totalTrackedS) * 100 : 0;
                html += `<tr><td>Meridian Flip — Pause</td><td>${AsiairLogParser.fmtMinutes(pauseTotalS)}</td><td>${AsiairLogParser.fmtPct(pausePct)}</td></tr>`;
                html += `<tr><td>Meridian Flip</td><td>${AsiairLogParser.fmtMinutes(flipTotalS)}</td><td>${AsiairLogParser.fmtPct(flipPct)}</td></tr>`;
            }
            if (summary.ditherCount > 0) {
                const cleanNote = summary.ditherCleanCount < summary.ditherCount
                      ? ` <span class="session-report-note-inline">(${summary.ditherCleanCount} settled cleanly)</span>` : '';
                html += `<tr><td>Dither (${summary.ditherCount} events)${cleanNote}</td><td>${AsiairLogParser.fmtMinutes(summary.ditherTotalS)}</td><td>${AsiairLogParser.fmtPct(summary.ditherShareOfImagingPct)} of imaging</td></tr>`;
            }
            html += `<tr class="session-report-total-row"><td>Total tracked</td><td>~${AsiairLogParser.fmtMinutes(summary.totalTrackedS)}</td><td>100%</td></tr>`;
            html += `</tbody></table>`;

            if (summary.wallClockS != null) {
                const unaccountedNote = summary.unaccountedS > 0
                      ? `${AsiairLogParser.fmtMinutes(summary.unaccountedS)} unaccounted (${AsiairLogParser.fmtPct(summary.unaccountedS / summary.wallClockS * 100)} of wall clock)`
                      : 'fully accounted for';
                html += `<p class="session-report-note-small">Wall clock: ${AsiairLogParser.fmtMinutes(summary.wallClockS)} &nbsp;•&nbsp; Tracked: ${AsiairLogParser.fmtMinutes(summary.totalTrackedS)} &nbsp;•&nbsp; ${unaccountedNote}</p>`;
            }

            return html;
        },

        // -------------------------------------------------------------------------
        // §3 — Per-sub frame quality + CSV
        // -------------------------------------------------------------------------

        // Trimmed for print (target aiming for one page, portrait letter):
        // Target dropped (already in the per-target header, which now also
        // carries sub count + exposure — "NGC 281 (50 subs, 300s)" — since
        // exposure is constant within a run). Exposure column dropped for the
        // same reason. AF Star Size dropped — cross-reference §6 instead.
        // Dropped-frame count and unsettled-start both folded into the Tier
        // cell as annotations rather than their own columns — both are real
        // but different signals from tier (a clean sub can still have had a
        // guide frame drop mid-exposure, or started before its dither
        // settled), and both are uncommon enough (6.4% and 1.1% of subs
        // corpus-wide respectively) that a dedicated column would mostly show
        // "0"/"Yes" — the annotation only appears when there's something to
        // actually say.
        _perSubColumns() {
            return ['Image #', 'Start', 'RMS RA', 'RMS Dec', 'RMS Total', 'Peak', 'Temp', 'Tier'];
        },

        _perSubRow(s) {
            const g = s.guide;
            const annotations = [];
            if (g && g.droppedCount > 0) annotations.push(`${g.droppedCount} dropped`);
            if (!s.settledAtStart) annotations.push('unsettled start');
            const tierCell = annotations.length > 0 ? `${s.tier} (${annotations.join(', ')})` : s.tier;
            return [
                s.imageNo,
                s.startedAt ? AsiairLogParser.fmtTime(s.startedAt) : '',
                g && g.rmsRa != null ? Phd2LogParser.fmtArcsec(g.rmsRa) : '—',
                g && g.rmsDec != null ? Phd2LogParser.fmtArcsec(g.rmsDec) : '—',
                g && g.rmsTotal != null ? Phd2LogParser.fmtArcsec(g.rmsTotal) : '—',
                g && g.peakTotal != null ? Phd2LogParser.fmtArcsec(g.peakTotal) : '—',
                s.temperatureC != null ? s.temperatureC + '°C' : '—',
                tierCell,
            ];
        },

        _buildPerSubHtml(fs) {
            const byTarget = this._groupSubsByTarget(fs);
            const cols = this._perSubColumns();
            let html = `<h4 class="session-report-section">Per-Sub Frame Quality</h4>`;

            for (const [target, subs] of byTarget) {
                const exposureS = subs.length > 0 ? subs[0].exposureS : null;
                const header = `${target} (${subs.length} subs${exposureS != null ? ', ' + exposureS + 's' : ''})`;
                html += `<p class="session-report-note-small"><strong>${HtmlUtils.escapeHtml(header)}</strong></p>`;
                html += `<table class="session-table"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
                for (const s of subs) {
                    const tierClass = s.tier === 'reject' ? 'critical' : s.tier === 'marginal' ? 'warning' : s.tier === 'unknown' ? 'info' : '';
                    const rowAttr = tierClass ? ` class="session-report-tier-${tierClass}"` : '';
                    html += `<tr${rowAttr}>${this._perSubRow(s).map(v => `<td>${v}</td>`).join('')}</tr>`;
                }
                html += `</tbody></table>`;
            }
            return html;
        },

        _groupSubsByTarget(fs) {
            const map = new Map();
            for (const target of fs.targets) map.set(target, []);
            for (const s of fs.subs) {
                if (!map.has(s.target)) map.set(s.target, []);
                map.get(s.target).push(s);
            }
            return map;
        },

        _downloadCsv(fs) {
            const cols = this._perSubColumns();
            const rows = fs.subs.map(s => this._perSubRow(s));
            const csvEscape = (v) => {
                const str = String(v);
                return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
            };
            const lines = [cols.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))];
            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fs.targets.join('_').replace(/\s+/g, '_')}_${this._formatNight(fs).replace(/[\s/]/g, '_')}_persub.csv`;
            a.click();
            URL.revokeObjectURL(url);
        },

        // -------------------------------------------------------------------------
        // §4 — Findings (unified: FusedSession findings + PHD2's own anomaly
        // types folded in, since they cover ground detectors don't yet —
        // peak_spike, error_code, snr_jump, low_snr, no_settled_data,
        // short_session, incomplete have no Phase 4 detector equivalent today.
        // One evidence-based list rather than two overlapping ones.)
        // -------------------------------------------------------------------------

        _buildFindingsHtml(fs, context) {
            const order = { critical: 0, warning: 1, info: 2 };
            const items = [];

            for (const f of fs.findings) {
                // D15 findings are consolidated into a single note in the
                // Guide Sessions section instead of one bullet per session
                // (Issue #255) — see _buildD15ConsolidatedNote.
                if (f.code === 'D15_LOCK_POSITION_EDGE') continue;
                items.push({
                    severity: f.severity,
                    title: f.title,
                    detail: f.detail,
                    confidence: f.confidence,
                    affectedSubs: f.affectedSubs,
                    ruledOut: f.ruledOut,
                });
            }

            const phd2Anomalies = (context && context.phd2Parsed && context.phd2Parsed.anomalies) || [];
            for (const a of phd2Anomalies) {
                // short_session is now an inline annotation on its Guide
                // Sessions table row; incomplete is never informative (always
                // just means the imaging session ended) — neither belongs as
                // a standalone Finding (Issue #255).
                if (a.type === 'short_session' || a.type === 'incomplete') continue;
                items.push({
                    severity: a.severity,
                    title: `Guide session ${a.session}: ${a.message}`,
                    detail: a.timeRange ? `Time range: ${a.timeRange}` : (a.startLine ? `Line ${a.startLine}` : ''),
                    confidence: 'measured',
                    affectedSubs: [],
                    ruledOut: [],
                });
            }

            if (items.length === 0) {
                return `<h4 class="session-report-section">Findings</h4><p style="color:var(--text-secondary)">No findings raised for this night.</p>`;
            }

            items.sort((a, b) => order[a.severity] - order[b.severity]);

            let html = `<h4 class="session-report-section">Findings</h4><ul class="session-report-notes">`;
            for (const item of items) {
                html += `<li>${this._severityIcon(item.severity)} <strong>${HtmlUtils.escapeHtml(item.title)}</strong>`;
                html += ` <span style="color:var(--text-secondary)">(${item.confidence})</span>`;
                if (item.detail) html += `<br>${HtmlUtils.escapeHtml(item.detail)}`;
                if (item.affectedSubs && item.affectedSubs.length > 0) {
                    html += `<br><span style="color:var(--text-secondary)">Affected: ${item.affectedSubs.join(', ')}</span>`;
                }
                if (item.ruledOut && item.ruledOut.length > 0) {
                    html += `<br><span style="color:var(--text-secondary)">Ruled out: ${item.ruledOut.map(r => HtmlUtils.escapeHtml(r.hypothesis)).join('; ')}</span>`;
                }
                html += `</li>`;
            }
            html += `</ul>`;
            return html;
        },

        // -------------------------------------------------------------------------
        // §5 — Guiding analysis (+ PHD2 Equipment / Overall Statistics /
        // Sessions tables, carried over from the original PHD2 report — the
        // session-by-session narrative list is dropped since the Sessions
        // table already covers that information)
        // -------------------------------------------------------------------------

        _buildGuidingHtml(fs, context) {
            if (!context || !context.phd2Parsed) {
                return `<h4 class="session-report-section">Guiding Analysis</h4><p style="color:var(--text-secondary)">No PHD2 guide log for this night.</p>`;
            }
            const phd2 = context.phd2Parsed;
            const overall = phd2.overall;

            let html = `<h4 class="session-report-section">Guiding Analysis</h4>`;

            // Equipment (from the original PHD2 report)
            const eq = phd2.equipment || {};
            html += `
            <table class="session-table">
                <tbody>
                    <tr><td>Guide Camera</td><td>${HtmlUtils.escapeHtml(eq.camera || '—')}</td></tr>
                    <tr><td>Pixel Scale</td><td>${eq.pixelScale != null ? eq.pixelScale + '"/px' : '—'}</td></tr>
                    <tr><td>Focal Length</td><td>${eq.focalLength != null ? eq.focalLength + ' mm' : '—'}</td></tr>
                    <tr><td>Guide Exposure</td><td>${eq.exposureMs != null ? (eq.exposureMs / 1000).toFixed(1) + 's' : '—'}</td></tr>
                    <tr><td>Mount</td><td>${HtmlUtils.escapeHtml(eq.mount || '—')}</td></tr>
                </tbody>
            </table>
        `;

            // Overall statistics (from the original PHD2 report)
            if (overall) {
                const excludedNote = overall.excludedCriticalSessionCount > 0
                      ? ` (${overall.excludedCriticalSessionCount} session${overall.excludedCriticalSessionCount > 1 ? 's' : ''} with critical RMS excluded — see Findings)`
                      : '';
                html += `
                <p class="session-report-note-small" style="color:var(--text-secondary)">Headline RMS is settled-frame RMS (dither-settle frames excluded)${excludedNote}. All-frames figures shown for reference.</p>
                <table class="session-table">
                    <tbody>
                        <tr><td>Guide Sessions</td><td>${overall.sessionCount} total, ${overall.fullSessionCount} full</td></tr>
                        <tr><td>Total Guide Frames</td><td>${overall.totalFrames.toLocaleString()}</td></tr>
                        <tr><td>RMS RA</td><td>${overall.raRms != null ? Phd2LogParser.fmtArcsec(overall.raRms) : '—'} <span style="color:var(--text-secondary)">(all: ${Phd2LogParser.fmtArcsec(overall.raRmsAll)})</span></td></tr>
                        <tr><td>RMS Dec</td><td>${overall.decRms != null ? Phd2LogParser.fmtArcsec(overall.decRms) : '—'} <span style="color:var(--text-secondary)">(all: ${Phd2LogParser.fmtArcsec(overall.decRmsAll)})</span></td></tr>
                        <tr><td>RMS Total</td><td>${overall.totRms != null ? Phd2LogParser.fmtArcsec(overall.totRms) : '—'} <span style="color:var(--text-secondary)">(all: ${Phd2LogParser.fmtArcsec(overall.totRmsAll)})</span></td></tr>
                        <tr><td>Avg Guide Star SNR</td><td>${Phd2LogParser.fmtSnr(overall.avgSnr)}</td></tr>
                        <tr><td>Total Dither Events</td><td>${overall.totalDithers}</td></tr>
                    </tbody>
                </table>
            `;
            }

            // Pier-side breakdown (added in this report — not in either original)
            const byPier = { East: [], West: [] };
            for (const s of phd2.sessions) {
                const side = s.geometry && s.geometry.pierSide;
                if (side && byPier[side] && s.stats && s.stats.totRms != null) byPier[side].push(s.stats.totRms);
            }
            if (byPier.East.length > 0 || byPier.West.length > 0) {
                const avg = (arr) => arr.length ? Phd2LogParser.fmtArcsec(arr.reduce((a, b) => a + b, 0) / arr.length) : '—';
                html += `<p class="session-report-note-small">Pier side: East ${avg(byPier.East)} (n=${byPier.East.length}) &nbsp;•&nbsp; West ${avg(byPier.West)} (n=${byPier.West.length})</p>`;
            }

            // Dither amplitude (added in this report) — now also converted
            // to imaging-sensor pixels when a matched telescope/sensor is
            // available (Issue #255 follow-up).
            const allDithers = phd2.sessions.flatMap(s => s.ditherEvents).filter(d => d.dxPx !== null);
            if (allDithers.length > 0) {
                const pixelScale = (phd2.equipment && phd2.equipment.pixelScale) || 1;
                const mags = allDithers.map(d => Math.sqrt(d.dxPx ** 2 + d.dyPx ** 2));
                const meanPx = mags.reduce((a, b) => a + b, 0) / mags.length;
                const maxPx = Math.max(...mags);
                const meanArcsec = meanPx * pixelScale;
                const maxArcsec = maxPx * pixelScale;

                let imagingNote = '';
                const imagingScale = this._imagingPixelScale(context);
                if (imagingScale) {
                    imagingNote = ` — imaging sensor: mean ${(meanArcsec / imagingScale).toFixed(2)}px, max ${(maxArcsec / imagingScale).toFixed(2)}px`;
                }

                html += `<p class="session-report-note-small">Dither amplitude: mean ${meanPx.toFixed(2)}px (${meanArcsec.toFixed(1)}"), max ${maxPx.toFixed(2)}px (${maxArcsec.toFixed(1)}"), n=${allDithers.length} — guide camera pixels${imagingNote}</p>`;

                html += this._buildDitherBiasNote(phd2);
            }

            // #246: informational only (not a recommendation, per Stan) —
            // effective dither-settle timeout and effective frames-per-
            // dither, both inferred from this night's actual events.
            if (typeof SessionRecommendations !== 'undefined') {
                const settleInfo = SessionRecommendations.buildDitherSettleTimeoutInfo(context);
                if (settleInfo) {
                    html += `<p class="session-report-note-small">Effective dither settle timeout: ${settleInfo.text}</p>`;
                }
                const framesInfo = SessionRecommendations.buildFramesPerDitherInfo(context);
                if (framesInfo) {
                    html += `<p class="session-report-note-small">Effective frames per dither: ${framesInfo.text}</p>`;
                }
            }

            // Sessions table (from the original PHD2 report — the session-by-
            // session narrative list is dropped, this table already covers it)
            if (phd2.sessions.length > 0) {
                html += `<h5 style="margin-top:0.75rem">Guide Sessions (${phd2.sessions.length})</h5>`;
                html += `<table class="session-table"><thead><tr><th>#</th><th>Time Range</th><th>Frames</th><th>RMS RA</th><th>RMS Dec</th><th>RMS Total</th><th>Avg SNR</th></tr></thead><tbody>`;
                for (const s of phd2.sessions) {
                    if (!s.stats) {
                        html += `<tr><td>${s.num}</td><td colspan="6" style="color:var(--text-secondary)">No frames recorded</td></tr>`;
                        continue;
                    }
                    const { raRms, decRms, totRms, totRmsAll, avgSnr } = s.stats;
                    const totalCell = totRms != null
                          ? `${Phd2LogParser.fmtArcsec(totRms)} <span style="color:var(--text-secondary)">(all: ${Phd2LogParser.fmtArcsec(totRmsAll)})</span>`
                          : `— <span style="color:var(--text-secondary)">(all: ${Phd2LogParser.fmtArcsec(totRmsAll)})</span>`;
                    const timeRange = Phd2LogParser._sessionTimeRange ? Phd2LogParser._sessionTimeRange(s) : `${s.startTime}–${s.endTime || '?'}`;
                    html += `<tr>
                    <td>${s.num}${s.incomplete ? ' ⚠' : ''}</td>
                    <td>${HtmlUtils.escapeHtml(timeRange)}</td>
                    <td>${s.frames.length}</td>
                    <td>${raRms != null ? Phd2LogParser.fmtArcsec(raRms) : '—'}</td>
                    <td>${decRms != null ? Phd2LogParser.fmtArcsec(decRms) : '—'}</td>
                    <td>${totalCell}</td>
                    <td>${Phd2LogParser.fmtSnr(avgSnr)}</td>
                </tr>`;
                    // Short session (likely pre-imaging acquisition/calibration)
                    // — inline annotation, not a separate Finding (Issue #255).
                    if (s.frames.length < Phd2LogParser.THRESHOLDS.SHORT_SESSION && !s.incomplete) {
                        html += `<tr><td></td><td colspan="6" style="color:var(--text-secondary)">Short session (${s.frames.length} frames) — likely an autofocus interruption or guider restart; excluded from SNR/darkness trend below.</td></tr>`;
                    }
                }
                html += `</tbody></table>`;
                html += this._buildD15ConsolidatedNote(fs);
                html += this._buildSnrDarknessNote(context, phd2);
            }

            // Calibration summary
            if (phd2.calibrations.length > 0) {
                html += `<h5 style="margin-top:0.75rem">Calibrations (${phd2.calibrations.length})</h5>`;
                html += `<table class="session-table"><thead><tr><th>Started</th><th>West Rate</th><th>North Rate</th><th>Orthogonality</th><th>Star Lost</th></tr></thead><tbody>`;
                for (const c of phd2.calibrations) {
                    html += `<tr>
                    <td>${HtmlUtils.escapeHtml(String(c.startedAt))}</td>
                    <td>${c.west.ratePxPerSec != null ? c.west.ratePxPerSec.toFixed(3) + ' px/s' : '—'}</td>
                    <td>${c.north.ratePxPerSec != null ? c.north.ratePxPerSec.toFixed(3) + ' px/s' : '—'}</td>
                    <td>${c.orthogonalityErrorDeg != null ? c.orthogonalityErrorDeg.toFixed(2) + '°' : '—'}</td>
                    <td>${c.starLostDuringCalibration || '—'}</td>
                </tr>`;
                }
                html += `</tbody></table>`;
                html += this._buildCalibrationAnalysisNote(context, phd2);
            }

            return html;
        },

        // Guide-camera arcsec -> imaging-sensor pixels needs the imaging
        // plate scale, derived the same way FOVCalculations does
        // (pixelSize/1000/effectiveFocalLength * 206265). Uses the
        // telescope/sensor matched via the imaging-log session for this
        // night (context.telescope/context.sensor, set in
        // log-analysis-view.js's night-matching) — returns null on
        // unmatched nights rather than guessing equipment. Assumes no
        // reducer/barlow (multiplier 1) since that isn't tracked per
        // imaging-log session.
        _imagingPixelScale(context) {
            if (!context || !context.telescope || !context.sensor) return null;
            const t = context.telescope, s = context.sensor;
            if (t.focalLength == null || s.pixelSizeX == null || s.pixelSizeY == null) return null;
            const multiplier = t.multiplier || 1;
            const effectiveFocalLength = t.focalLength * multiplier;
            const avgPixelSizeUm = (s.pixelSizeX + s.pixelSizeY) / 2;
            return (avgPixelSizeUm / 1000 / effectiveFocalLength) * 206265; // arcsec/px
        },

        // Per-session dither directional bias (Issue #255 follow-up): sums
        // each session's individual signed dx/dy dither vectors (guide px)
        // to get net displacement — the same number as "how far the
        // dithers took the lock position from where it started" — then
        // projects that net vector onto the RA/Dec axis directions using
        // the session's own xAngle/yAngle (from the PHD2 header's Mount
        // line). This is a dot-product projection, not a full matrix
        // inverse — it assumes the two axes are exactly orthogonal, so its
        // error is bounded by whatever this session's orthogonality error
        // actually is (already reported in Calibrations, typically small).
        //
        // "Biased" vs. "well-mixed" is a first-pass heuristic (comparing
        // net displacement against the random-walk expectation
        // meanMag * sqrt(n)), not corpus-validated.
        _buildDitherBiasNote(phd2) {
            const rows = [];
            for (const s of phd2.sessions) {
                const dithers = (s.ditherEvents || []).filter(d => d.dxPx !== null);
                if (dithers.length < 3) continue;
                const rates = s.rates || {};
                if (rates.xAngle == null || rates.yAngle == null) continue;

                let sumDx = 0, sumDy = 0;
                const mags = [];
                for (const d of dithers) {
                    sumDx += d.dxPx;
                    sumDy += d.dyPx;
                    mags.push(Math.sqrt(d.dxPx ** 2 + d.dyPx ** 2));
                }
                const meanMag = mags.reduce((a, b) => a + b, 0) / mags.length;
                const netMag = Math.sqrt(sumDx ** 2 + sumDy ** 2);
                const randomWalkExpectation = meanMag * Math.sqrt(dithers.length);

                const xRad = rates.xAngle * Math.PI / 180;
                const yRad = rates.yAngle * Math.PI / 180;
                const netRaPx = sumDx * Math.cos(xRad) + sumDy * Math.sin(xRad);
                const netDecPx = sumDx * Math.cos(yRad) + sumDy * Math.sin(yRad);

                const BIAS_THRESHOLD_FRACTION = 0.5;
                if (randomWalkExpectation > 0 && netMag > BIAS_THRESHOLD_FRACTION * randomWalkExpectation) {
                    const axis = Math.abs(netRaPx) >= Math.abs(netDecPx) ? 'RA' : 'Dec';
                    const axisPx = axis === 'RA' ? netRaPx : netDecPx;
                    const sign = axisPx >= 0 ? '+' : '-';
                    rows.push(`session ${s.num}: biased ${sign}${axis} (net ${netMag.toFixed(1)}px over ${dithers.length} dithers)`);
                } else {
                    rows.push(`session ${s.num}: well-mixed (net ${netMag.toFixed(1)}px over ${dithers.length} dithers)`);
                }
            }
            if (rows.length === 0) return '';
            return `<p class="session-report-note-small">Dither direction (RA/Dec via this session's calibration axis angles — approximate, assumes exact axis orthogonality): ${rows.join('; ')}.</p>`;
        },

        // -------------------------------------------------------------------------
        // Guide Sessions narrative additions (Issue #255) — consolidates the
        // D15 lock-position-edge Findings into one note here instead of one
        // bullet per affected session, and adds SNR-vs-darkness analysis.
        // -------------------------------------------------------------------------

        // D15 findings carry the session number and distance embedded in
        // f.title text (no structured fields exposed to this view) — parsed
        // defensively; falls back to a plain count if the format doesn't
        // match on any item rather than showing a wrong range.
        _buildD15ConsolidatedNote(fs) {
            if (!fs || !fs.findings) return '';
            const d15 = fs.findings.filter(f => f.code === 'D15_LOCK_POSITION_EDGE');
            if (d15.length === 0) return '';

            const distances = [];
            for (const f of d15) {
                const m = /lock position (\d+)px/.exec(f.title || '');
                if (m) distances.push(parseInt(m[1], 10));
            }

            let rangeText = '';
            if (distances.length === d15.length && distances.length > 0) {
                const min = Math.min(...distances), max = Math.max(...distances);
                rangeText = min === max ? ` (${min}px)` : ` (${min}–${max}px)`;
            }

            return `<p class="session-report-note-small session-report-tier-warning">${d15.length} guide session(s) locked near the frame edge${rangeText} this night, below the corpus's typical range — a cluster like this across most of a night's sessions is worth checking against PHD2's search region / star selection settings, since edge-hugging locks are the same signature associated with guide-star-swap risk elsewhere in the corpus.</p>`;
        },

        // SNR vs. darkness: SNR should track how dark the sky is, rising
        // toward astronomical dusk, holding through the core dark hours,
        // falling toward dawn. Reuses solarBrightnessUltraSmooth (already
        // used for sky-quality scoring elsewhere) to model the sun-driven
        // brightness component from each session's sun altitude at its
        // midpoint. Deep-night sessions (sun well below the astronomical
        // threshold) have no twilight excuse for a low-brightness-model
        // reading, so a session that's notably below the deep-night SNR
        // median despite that is the interesting anomaly — likely transient
        // cloud, haze, or dew — while sessions near dusk/dawn legitimately
        // reading lower are normal darkness-driven variation, not flagged.
        //
        // First-pass thresholds (DEEP_NIGHT_SUN_ALT, THRESHOLD_FRACTION),
        // not yet corpus-validated the way threshold-calibration.md's other
        // figures are — revisit once more nights have been analyzed.
        _buildSnrDarknessNote(context, phd2) {
            if (!context || !context.location || !context.asiairParsed || !context.asiairParsed.date) return '';
            if (typeof getSunPosition === 'undefined' || typeof getAltitude === 'undefined' || typeof dateToJD === 'undefined') return '';
            const location = context.location;
            const dateParts = context.asiairParsed.date.split('-');
            if (dateParts.length !== 3) return '';

            const localNoon = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10), 12, 0, 0);
            const isDST = (typeof SettingsManager !== 'undefined') ? SettingsManager.isDSTActive(localNoon, location.timezone) : false;
            const duskJD = (typeof findAstronomicalDusk !== 'undefined') ? findAstronomicalDusk(localNoon, location.latitude, location.longitude, location.timezone, isDST) : null;
            const dawnJD = (typeof findNextAstronomicalDawn !== 'undefined') ? findNextAstronomicalDawn(localNoon, location.latitude, location.longitude, location.timezone, isDST) : null;
            if (duskJD == null || dawnJD == null) return '';

            const eligible = phd2.sessions.filter(s =>
                s.stats && s.stats.avgSnr != null &&
                s.frames.length >= Phd2LogParser.THRESHOLDS.SHORT_SESSION
            );
            if (eligible.length < 3) return '';

            const points = [];
            for (const s of eligible) {
                const start = Phd2LogParser._parsePhd2Time(s.startTime);
                if (!start) continue;
                const end = s.endTime ? Phd2LogParser._parsePhd2Time(s.endTime) : null;
                const midMs = end ? (start.getTime() + end.getTime()) / 2 : start.getTime();
                const midJD = dateToJD(new Date(midMs));
                const sunPos = getSunPosition(midJD);
                const sunAlt = getAltitude(midJD, sunPos.ra, sunPos.dec, location.latitude, location.longitude);
                points.push({ session: s, sunAlt, snr: s.stats.avgSnr });
            }
            if (points.length < 3) return '';

            const DEEP_NIGHT_SUN_ALT = -25; // comfortably below the -18° astronomical threshold
            const deepNight = points.filter(p => p.sunAlt <= DEEP_NIGHT_SUN_ALT);
            if (deepNight.length < 2) return '';

            const snrValues = deepNight.map(p => p.snr).sort((a, b) => a - b);
            const mid = Math.floor(snrValues.length / 2);
            const medianSnr = snrValues.length % 2 ? snrValues[mid] : (snrValues[mid - 1] + snrValues[mid]) / 2;

            const THRESHOLD_FRACTION = 0.75;
            const anomalous = deepNight.filter(p => p.snr < medianSnr * THRESHOLD_FRACTION);

            const twilightNote = points.length > deepNight.length
                  ? ' SNR dips near the start/end of the session (closer to dusk/dawn) are expected from residual twilight brightness and are not flagged.'
                  : '';

            if (anomalous.length === 0) {
                return `<p class="session-report-note-small">SNR tracked darkness normally across the night (deep-night median ${medianSnr.toFixed(1)}, no sessions deviating).${twilightNote}</p>`;
            }

            const list = anomalous.map(p => `session ${p.session.num} (SNR ${p.snr.toFixed(1)} vs deep-night median ${medianSnr.toFixed(1)})`).join(', ');
            return `<p class="session-report-note-small session-report-tier-warning">SNR dropped well below the deep-night median independent of dusk/dawn proximity — possible transient cloud, haze, or dew: ${list}.${twilightNote}</p>`;
        },

        // Calibration narrative: orthogonality magnitude/change, West/North
        // rate consistency (checked against an approximate declination for
        // each calibration — calibration blocks don't record target/dec
        // directly, so this is inferred from the nearest guide session in
        // time, not measured), and plain-language Star Lost context.
        //
        // First-pass thresholds (ORTHO_ELEVATED_DEG, ORTHO_CHANGE_DEG,
        // RATE_SWING_PCT, DEC_EXPLAINS_DEG), not yet corpus-validated.
        _buildCalibrationAnalysisNote(context, phd2) {
            const cals = phd2.calibrations;
            if (!cals || cals.length === 0) return '';
            const notes = [];

            const decFor = (cal) => {
                const calTime = Phd2LogParser._parsePhd2Time(cal.startedAt);
                if (!calTime) return null;
                let best = null, bestDiff = Infinity;
                for (const s of phd2.sessions) {
                    if (!s.geometry || s.geometry.decDeg == null) continue;
                    const sTime = Phd2LogParser._parsePhd2Time(s.startTime);
                    if (!sTime) continue;
                    const diff = Math.abs(sTime.getTime() - calTime.getTime());
                    if (diff < bestDiff) { bestDiff = diff; best = s.geometry.decDeg; }
                }
                return best;
            };

            const ORTHO_ELEVATED_DEG = 1.0;
            const ORTHO_CHANGE_DEG = 0.5;
            const orthoElevated = cals.filter(c => c.orthogonalityErrorDeg != null && Math.abs(c.orthogonalityErrorDeg) > ORTHO_ELEVATED_DEG);
            if (orthoElevated.length > 0) {
                notes.push(`Orthogonality error exceeded ${ORTHO_ELEVATED_DEG}° on ${orthoElevated.length} calibration(s) this session — check for cone error, polar misalignment, or looseness in the guide/OAG train.`);
            }
            for (let i = 1; i < cals.length; i++) {
                const a = cals[i - 1].orthogonalityErrorDeg, b = cals[i].orthogonalityErrorDeg;
                if (a == null || b == null) continue;
                if (Math.abs(a - b) > ORTHO_CHANGE_DEG) {
                    notes.push(`Orthogonality shifted ${Math.abs(a - b).toFixed(2)}° between calibrations ${i} and ${i + 1} — worth a look if this recurs on future nights.`);
                }
            }

            const RATE_SWING_PCT = 15;
            const DEC_EXPLAINS_DEG = 15;
            for (let i = 1; i < cals.length; i++) {
                const prev = cals[i - 1], cur = cals[i];
                if (prev.west.ratePxPerSec == null || cur.west.ratePxPerSec == null) continue;
                const westSwing = Math.abs(cur.west.ratePxPerSec - prev.west.ratePxPerSec) / prev.west.ratePxPerSec * 100;
                const northSwing = (prev.north.ratePxPerSec != null && cur.north.ratePxPerSec != null)
                      ? Math.abs(cur.north.ratePxPerSec - prev.north.ratePxPerSec) / prev.north.ratePxPerSec * 100
                      : 0;
                const maxSwing = Math.max(westSwing, northSwing);
                if (maxSwing < RATE_SWING_PCT) continue;

                const decPrev = decFor(prev), decCur = decFor(cur);
                const decDiff = (decPrev != null && decCur != null) ? Math.abs(decCur - decPrev) : null;
                if (decDiff != null && decDiff >= DEC_EXPLAINS_DEG) {
                    notes.push(`Calibration rate shifted ${maxSwing.toFixed(0)}% between calibrations ${i} and ${i + 1} — explained by a ${decDiff.toFixed(0)}° declination difference between calibrated targets (rate scales with cos(dec)).`);
                } else {
                    notes.push(`Calibration rate shifted ${maxSwing.toFixed(0)}% between calibrations ${i} and ${i + 1} with no comparable declination difference (${decDiff != null ? decDiff.toFixed(0) + '°' : 'unknown'}) — possible backlash or slippage worth checking.`);
                }
            }

            for (const c of cals) {
                if (c.starLostDuringCalibration > 0) {
                    notes.push(`${c.starLostDuringCalibration} star-lost event(s) during the calibration starting ${HtmlUtils.escapeHtml(String(c.startedAt))} — the guide star was lost and reacquired mid-calibration, which can produce a less reliable rate/orthogonality measurement.`);
                }
            }

            if (notes.length === 0) return '';
            return `<ul class="session-report-notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>`;
        },

        // -------------------------------------------------------------------------
        // §6 — Focus and environment
        // -------------------------------------------------------------------------

        // Reuses D11/D13's own computed findings rather than re-deriving the
        // regression or trend logic — this file renders, it doesn't classify.
        _buildFocusHtml(fs, context) {
            let html = `<h4 class="session-report-section">Focus and Environment</h4>`;

            if (typeof SessionDetectors !== 'undefined' && context) {
                const d13 = SessionDetectors.D13_focusDrift(fs, context);
                if (d13.length > 0) {
                    html += `<p class="session-report-note-small">${HtmlUtils.escapeHtml(d13[0].title)}</p>`;
                }
                const d11 = SessionDetectors.D11_afHealth(fs, context);
                const trend = d11.find(f => f.code === 'D11_STAR_SIZE_TREND');
                if (trend) {
                    html += `<p class="session-report-note-small">${HtmlUtils.escapeHtml(trend.title)}</p>`;
                }
            }

            if (context && context.asiairParsed) {
                const afEvents = context.asiairParsed.runs.filter(r => r.kind === 'light')
                      .flatMap(r => r.events).filter(e => e.type === 'autofocus').sort((a, b) => a.start - b.start);
                if (afEvents.length > 0) {
                    html += `<table class="session-table"><thead><tr><th>Time</th><th>Trigger</th><th>Duration</th><th>Outcome</th><th>Temp</th><th>Star Size</th></tr></thead><tbody>`;
                    for (const e of afEvents) {
                        html += `<tr>
                        <td>${AsiairLogParser.fmtTime(e.start)}</td>
                        <td>${e.trigger || '—'}</td>
                        <td>${e.durationS != null ? AsiairLogParser.fmtMinutes(e.durationS) : '—'}</td>
                        <td>${e.outcome}</td>
                        <td>${e.temperatureC != null ? e.temperatureC + '°C' : '—'}</td>
                        <td>${e.achievedStarSize != null ? e.achievedStarSize.toFixed(1) : '—'}</td>
                    </tr>`;
                    }
                    html += `</tbody></table>`;
                }
            }

            return html;
        },

        // -------------------------------------------------------------------------
        // Recommendations (design doc §8) — replaces the old "Astryx
        // Recommended Session Settings" section outright. Sourced from
        // session-recommendations.js across all four groups (Astryx settings,
        // ASIAir config, PHD2 config, Process/hardware), each entry carrying
        // observed/recommended/evidence/confidence/impact, not just the old
        // four-row observed-vs-stored table. Imaging telescope/sensor context
        // (previously in Verdict) now lives here instead, alongside the
        // recommendations it's most relevant to.
        // -------------------------------------------------------------------------

        _buildRecommendedSettingsHtml(fs, context) {
        let html = `<h4 class="session-report-section">Recommendations</h4>`;

        const flagged = fs.subs.filter(s => s.tier === 'marginal' || s.tier === 'reject');
        if (flagged.length > 0) {
            // Label the target name only where it changes, not per frame —
            // fs.subs is already sequenceNo-sorted, so same-target frames
            // are contiguous except on genuine multi-target nights, where
            // a target can recur (design doc §4.4/Q3 — per-target report
            // sections aren't built yet, so this is the minimal fix here).
            const parts = [];
            let lastTarget = null;
            for (const s of flagged) {
                if (s.target !== lastTarget) {
                    parts.push(`<strong>${HtmlUtils.escapeHtml(s.target)}:</strong> ${s.imageNo}`);
                    lastTarget = s.target;
                } else {
                    parts.push(s.imageNo);
                }
            }
            html += `<p class="session-report-note-small">Frames worth a closer look for defects (marginal/reject tier): ${parts.join(', ')}. Log analysis can't see image-level quality directly — see §Data Quality.</p>`;
        }

            if (typeof SessionRecommendations === 'undefined') return html;
            const recs = SessionRecommendations.build(fs, context);
            if (recs.length === 0) {
                html += `<p style="color:var(--text-secondary)">No recommendations available for this night.</p>`;
                return html;
            }

            const groups = [
                { key: 'behavior', title: 'Behavior', columns: ['Measurement', 'Observed', 'Moving Average', 'Confidence'],
                  note: 'These values accumulate across every analyzed session as a moving average, weighted toward recent nights but never fully reset by any single one — a single unusual session nudges the average, it doesn\'t replace it.' },
                { key: 'sequencePlanning', title: 'Sequence Planning', columns: ['Setting', 'Observed', 'Recommended', 'Confidence'] },
                { key: 'asiair', title: 'ASIAir Configuration', columns: ['Setting', 'Observed', 'Recommended', 'Confidence'] },
                { key: 'phd2', title: 'Guiding Configuration', columns: ['Setting', 'Observed', 'Recommended', 'Confidence'] },
            ];

            for (const g of groups) {
                const groupRecs = recs.filter(r => r.group === g.key);
                if (groupRecs.length === 0) continue;
                html += `<h5 style="margin-top:0.75rem">${g.title}</h5>`;
                if (g.note) html += `<p class="session-report-note-small" style="color:var(--text-secondary)">${HtmlUtils.escapeHtml(g.note)}</p>`;
                html += `<table class="session-table"><thead><tr><th>${g.columns[0]}</th><th>${g.columns[1]}</th><th>${g.columns[2]}</th><th>${g.columns[3]}</th></tr></thead><tbody>`;
                for (const r of groupRecs) {
                    const rowAttr = r.changeNeeded ? ` class="session-report-tier-warning"` : '';
                    html += `<tr${rowAttr}>
                    <td>${HtmlUtils.escapeHtml(r.setting)}</td>
                    <td>${HtmlUtils.escapeHtml(r.observed)}</td>
                    <td>${HtmlUtils.escapeHtml(r.recommended)}</td>
                    <td>${HtmlUtils.escapeHtml(r.confidence)}</td>
                </tr>`;
                    if (r.changeNeeded) {
                        html += `<tr${rowAttr}><td></td><td colspan="3" style="color:var(--text-secondary)">${HtmlUtils.escapeHtml(r.evidence)}</td></tr>`;
                    }
                }
                html += `</tbody></table>`;
            }

            return html;
        },

        // #245: Flip Pause/Offset are fixed ASIAir dial settings, not
        // conditions the logs could recommend a change to — the only
        // thing worth reporting is whether ASIAir actually executed what
        // Astryx thinks is configured, since the two can drift out of
        // sync independently. Verified against three real nights
        // (2025-11-17, 2026-02-05, 2026-05-11) that the log's Begin-line
        // timestamp is the true Stop-Tracking moment, so Observed here is
        // trustworthy. Delta only meaningful when a transit was
        // computable (needs a matched imaging-log session for location).
        _buildMeridianVerificationHtml(context) {
            if (typeof SessionRecommendations === 'undefined' || !SessionRecommendations.buildMeridianVerification) return '';
            const rows = SessionRecommendations.buildMeridianVerification(context);
            if (rows.length === 0) return '';

            let html = `<h5 style="margin-top:0.75rem">Meridian Flip Verification</h5>`;
            html += `<table class="session-table"><thead><tr><th>Setting</th><th>Observed</th><th>Astryx Setting</th><th>Delta</th></tr></thead><tbody>`;
            for (const r of rows) {
                html += `<tr>
                    <td>${HtmlUtils.escapeHtml(r.setting)}</td>
                    <td>${HtmlUtils.escapeHtml(r.observed)}</td>
                    <td>${HtmlUtils.escapeHtml(r.astryxSetting)}</td>
                    <td>${HtmlUtils.escapeHtml(r.delta)}</td>
                </tr>`;
            }
            html += `</tbody></table>`;
            return html;
        },

        // -------------------------------------------------------------------------
        // §9 — Data quality
        // -------------------------------------------------------------------------

        _buildDataQualityHtml(fs, context) {
            let html = `<h4 class="session-report-section">Data Quality</h4>`;

            const failedInvariants = fs.invariants.filter(i => !i.passed);
            html += `<p class="session-report-note-small">${fs.invariants.length} invariant(s) checked, ${failedInvariants.length} failed.</p>`;
            if (failedInvariants.length > 0) {
                html += `<ul class="session-report-notes">`;
                for (const inv of failedInvariants) {
                    html += `<li>${this._severityIcon(inv.severity)} <strong>${inv.id}</strong>: ${HtmlUtils.escapeHtml(inv.impact)}</li>`;
                }
                html += `</ul>`;
            }

            const asiairUnmatched = (context && context.asiairParsed && context.asiairParsed.source && context.asiairParsed.source.unmatchedLines) || [];
            const phd2Unmatched = (context && context.phd2Parsed && context.phd2Parsed.source && context.phd2Parsed.source.unmatchedLines) || [];
            const totalUnmatched = asiairUnmatched.length + phd2Unmatched.length;
            html += `<p class="session-report-note-small">Unmatched log lines: ${totalUnmatched}`;
            if (totalUnmatched > 0) {
                const samples = [...asiairUnmatched, ...phd2Unmatched].slice(0, 5);
                html += ` — <span style="color:var(--text-secondary)">e.g. line ${samples.map(s => s.lineNo).join(', ')}</span>`;
            }
            html += `</p>`;

            html += `<p class="session-report-note-small">Subs without guide data: ${fs.coverage.subsWithoutGuideData ?? '—'}</p>`;

            html += this._buildMeridianVerificationHtml(context);

            html += `
            <h5 style="margin-top:0.75rem">Stated Limits</h5>
            <ul class="session-report-notes">
                <li>Satellite and aircraft trails are undetectable from either log — the guide camera sees a different patch of sky than the main camera.</li>
                <li>Image-level quality (transparency within a sub, gradients, FWHM, focus at the sensor) is invisible to log analysis. Log-based rejection is not a complete keeper/reject list.</li>
                <li>Guide-star mass is not a usable transparency proxy — it stays roughly flat within a single guide-star lock even through known cloud, and isn't comparable across star re-selections.</li>
                <li>A detector finds what it was written to find. Novel failure modes surface only as invariant failures or unaccounted time, not as a named finding.</li>
                <li>All thresholds in this report are calibrated against this specific rig (AM5 / AT115EDT / ASI120MM Mini) over the validation corpus — not universal defaults.</li>
            </ul>
        `;

            return html;
        },

    };

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
