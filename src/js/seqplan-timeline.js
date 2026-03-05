/**
 * seqplan-timeline.js
 * Timeline visualization for Sequence Planner
 */

const SeqPlanTimeline = {
    canvas: null,
    ctx: null,

    // Rendering constants
    CANVAS_HEIGHT: 210,
    TIMELINE_MARGIN: 60,
    LEGEND_MARGIN: 80,
    BLOCK_HEIGHT: 100,
    LABEL_AREA_HEIGHT: 50,  // Space above blocks for event labels
    AXIS_AREA_HEIGHT: 30,   // Space below blocks for axis and legend

    // Color scheme (kept for backward compatibility, but not sole discriminator)
    COLORS: {
        imaging1: '#4444ff',      // Blue for odd targets
        imaging2: '#9999cc',      // Lighter blue for even targets
        eventMarker: '#ffff00'    // Bright yellow for event lines
    },

    /**
     * Initialize timeline canvas
     */
    init() {
        this.canvas = document.getElementById('seq-plan-timeline');
        if (!this.canvas) return;

        // Force complete canvas reset by changing dimensions
        const containerWidth = this.canvas.parentElement.clientWidth - 32;

        // Completely reset the canvas by setting width (this clears it)
        this.canvas.width = containerWidth;
        this.canvas.height = this.CANVAS_HEIGHT;

        // Recreate context after reset
        this.ctx = this.canvas.getContext('2d');

        // Set CSS size to match
        this.canvas.style.width = containerWidth + 'px';
        this.canvas.style.height = this.CANVAS_HEIGHT + 'px';
    },

    /**
     * Draw autofocus marker icon
     */
    drawAutofocusMarker(x, y, color = "#ffff00") {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2; // Thicker for visibility
        this.ctx.lineCap = "square";

        // Top chevron (downward)
        this.ctx.beginPath();
        this.ctx.moveTo(1, 3);
        this.ctx.lineTo(3.5, 6);
        this.ctx.lineTo(6, 3);
        this.ctx.stroke();

        // Middle vertical stem
        this.ctx.beginPath();
        this.ctx.moveTo(3.5, 7);
        this.ctx.lineTo(3.5, 13);
        this.ctx.stroke();

        // Bottom chevron (upward)
        this.ctx.beginPath();
        this.ctx.moveTo(1, 16);
        this.ctx.lineTo(3.5, 13);
        this.ctx.lineTo(6, 16);
        this.ctx.stroke();

        this.ctx.restore();
    },

    /**
     * Draw meridian transit marker icon
     */
    drawTransitMarker(x, y, color = "#ff8800") {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = "round";

        // Vertical line with circle at top (meridian crossing symbol)
        this.ctx.beginPath();
        this.ctx.moveTo(3.5, 5);
        this.ctx.lineTo(3.5, 18);
        this.ctx.stroke();

        // Circle at top
        this.ctx.beginPath();
        this.ctx.arc(3.5, 3, 2.5, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.restore();
    },

    /**
     * Render complete timeline
     * @param {Array} events - Timeline events
     * @param {number} sessionStartJD - Session start (Julian Date)
     * @param {number} sessionEndJD - Session end (Julian Date)
     */
    render(events, sessionStartJD, sessionEndJD, currentSession) {
        if (!this.canvas || !this.ctx) return;

        // Reinitialize to recalculate canvas width on resize
        this.init();

        this.clear();

        // Draw imaging blocks first (background layer)
        this.drawImagingBlocks(events, sessionStartJD, sessionEndJD);

        // Draw altitude curves within imaging blocks
        if (currentSession) {
            this.drawAltitudeCurves(events, sessionStartJD, sessionEndJD, currentSession);
        }

        // Draw target labels spanning entire target duration
        this.drawTargetLabels(events, sessionStartJD, sessionEndJD);

        // Draw event markers on top
        this.drawEventMarkers(events, sessionStartJD, sessionEndJD);

        // Draw altitude violation overlays (continuous across all segments)
        this.drawAltitudeViolations(events, sessionStartJD, sessionEndJD);

        // Draw horizon violation overlays
        this.drawHorizonViolations(events, sessionStartJD, sessionEndJD);

        // Draw time axis and labels
        this.drawTimeAxis(sessionStartJD, sessionEndJD);

        // Draw legend
        this.drawLegend();
    },


    /**
     * Clear canvas with theme background
     */
    clear() {
        // Clear a huge area to make absolutely sure we get everything
        this.ctx.clearRect(-100, -100, this.canvas.width + 200, this.canvas.height + 200);

        // Then fill with background color
        const bgColor = getComputedStyle(document.documentElement)
              .getPropertyValue('--bg-color').trim();
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },


    /**
     * Draw imaging blocks only
     */
    drawImagingBlocks(events, sessionStartJD, sessionEndJD) {
        const yOffset = this.LABEL_AREA_HEIGHT;
        let colorIndex = 0;
        let currentTarget = null;

        events.filter(e => e.type === 'imaging').forEach(event => {
            if (event.targetId !== currentTarget) {
                colorIndex++;
                currentTarget = event.targetId;
            }

            const color = colorIndex % 2 === 1 ? '#4444ff' : '#9999cc';
            const x1 = this.jdToX(event.startJD, sessionStartJD, sessionEndJD);
            const x2 = this.jdToX(event.endJD, sessionStartJD, sessionEndJD);
            const width = x2 - x1;

            // Draw main imaging block
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x1, yOffset, width, this.BLOCK_HEIGHT);
        });
    },

    /**
     * Draw altitude curves within imaging blocks
     */
    drawAltitudeCurves(events, sessionStartJD, sessionEndJD, currentSession) {
        const yOffset = this.LABEL_AREA_HEIGHT;
        const blockHeight = this.BLOCK_HEIGHT;

        // Get target data for altitude calculations
        const targets = new Map();
        events.filter(e => e.type === 'imaging').forEach(event => {
            if (!targets.has(event.targetId)) {
                // Get target from DataManager - use targetId which contains the name
                const target = DataManager.getTarget(event.targetId);
                if (target) {
                    targets.set(event.targetId, {
                        ra: target.ra,
                        dec: target.dec,
                        startJD: event.startJD,
                        endJD: event.endJD
                    });
                }
            } else {
                // Expand time range
                const t = targets.get(event.targetId);
                t.startJD = Math.min(t.startJD, event.startJD);
                t.endJD = Math.max(t.endJD, event.endJD);
            }
        });

        // Draw altitude curve for each target
        targets.forEach((targetData, targetId) => {
            const x1 = this.jdToX(targetData.startJD, sessionStartJD, sessionEndJD);
            const x2 = this.jdToX(targetData.endJD, sessionStartJD, sessionEndJD);
            const width = x2 - x1;

            // Calculate altitude points
            const numPoints = Math.max(20, Math.floor(width / 5));
            const points = [];

            for (let i = 0; i <= numPoints; i++) {
                const jd = targetData.startJD + (targetData.endJD - targetData.startJD) * (i / numPoints);
                const altitude = getAltitude(jd, targetData.ra, targetData.dec,
                                             currentSession.location.latitude,
                                             currentSession.location.longitude);
                const x = this.jdToX(jd, sessionStartJD, sessionEndJD);

                // Scale altitude to fit within block (0° at bottom, 90° at top)
                const y = yOffset + blockHeight - (altitude / 90) * (blockHeight - 10) - 5;
                points.push({ x, y });
            }

            // Draw black outline
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            points.forEach((p, i) => {
                if (i === 0) this.ctx.moveTo(p.x, p.y);
                else this.ctx.lineTo(p.x, p.y);
            });
            this.ctx.stroke();

            // Draw white fill
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            points.forEach((p, i) => {
                if (i === 0) this.ctx.moveTo(p.x, p.y);
                else this.ctx.lineTo(p.x, p.y);
            });
            this.ctx.stroke();
        });
    },

    /**
     * Draw event markers (autofocus, calibration, flips)
     */
    /**
     * Draw event markers (autofocus, calibration, flips)
     */
    drawEventMarkers(events, sessionStartJD, sessionEndJD) {
        const blockTop = this.LABEL_AREA_HEIGHT;
        const blockBottom = this.LABEL_AREA_HEIGHT + this.BLOCK_HEIGHT;

        // First, draw transit markers for each target
        // Get unique targets and their transit times AND imaging windows
        const targetTransits = new Map();
        const targetWindows = new Map(); // Track imaging windows

        events.filter(e => e.type === 'imaging').forEach(event => {
            if (event.transitJD && !targetTransits.has(event.targetId)) {
                targetTransits.set(event.targetId, event.transitJD);
                // Store the imaging window for this target
                targetWindows.set(event.targetId, { start: event.startJD, end: event.endJD });
            } else if (event.transitJD && targetWindows.has(event.targetId)) {
                // Expand window if we have multiple blocks (before/after flip)
                const window = targetWindows.get(event.targetId);
                window.start = Math.min(window.start, event.startJD);
                window.end = Math.max(window.end, event.endJD);
            }
        });

        let markerCount = 0;
        // Draw transit markers - only if transit occurs during imaging window
        targetTransits.forEach((transitJD, targetId) => {
            const window = targetWindows.get(targetId);

            // Only draw if transit occurs DURING this target's imaging window
            if (transitJD >= window.start && transitJD <= window.end &&
                transitJD >= sessionStartJD && transitJD <= sessionEndJD) {
                const transitX = this.jdToX(transitJD, sessionStartJD, sessionEndJD);
                const markerX = transitX - 3.5;
                const markerY = this.LABEL_AREA_HEIGHT + 0;
                this.drawTransitMarker(markerX, markerY);
            } else {
                console.log('Transit outside imaging window - skipping marker for', targetId);
            }
        });

        // Filter to only overhead events
        const overheadEvents = events.filter(e =>
            e.type === 'autofocus' || e.type === 'calibration' || e.type === 'flip'
        );

        // Calculate positions and detect overlaps for non-AF events
        const MIN_SPACING = 40; // Minimum pixels between labels
        const positions = [];

        for (const event of overheadEvents) {
            const eventX = this.jdToX(event.startJD, sessionStartJD, sessionEndJD);

            // Handle autofocus differently - just draw marker
            if (event.type === 'autofocus') {
                // Draw AF marker inside the timeline block at the top
                const markerX = eventX - 3.5; // Center the 7px wide marker
                const markerY = this.LABEL_AREA_HEIGHT + 0; // 0px padding from top of block
                this.drawAutofocusMarker(markerX, markerY);
                continue;
            }

            // Determine label text for cal/flip
            let label = '';
            if (event.type === 'calibration') label = 'Cal';
            else if (event.type === 'flip') label = 'Flip+Cal';

            // Determine label row (0 = top row, 1 = bottom row)
            let row = 0;

            // Check if this position overlaps with any previous labels in row 0
            for (const pos of positions) {
                if (pos.row === 0 && Math.abs(pos.x - eventX) < MIN_SPACING) {
                    row = 1; // Use bottom row
                    break;
                }
            }

            // If row 1 also has overlap, go back to row 0 (will overlap, but unavoidable)
            if (row === 1) {
                for (const pos of positions) {
                    if (pos.row === 1 && Math.abs(pos.x - eventX) < MIN_SPACING) {
                        row = 0; // Fall back to row 0
                        break;
                    }
                }
            }

            positions.push({ x: eventX, row: row, label: label, event: event });
        }

        // Now draw calibration and flip markers with staggered labels
        for (const pos of positions) {
            const eventX = pos.x;
            const label = pos.label;
            const labelY = pos.row === 0
                  ? this.LABEL_AREA_HEIGHT - 30  // Top row
                  : this.LABEL_AREA_HEIGHT - 10; // Bottom row

            // Draw label just above timeline block
            this.ctx.fillStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--text-color').trim();
            this.ctx.font = 'bold 13px sans-serif';
            this.ctx.textAlign = 'center';
            // Position text just above the timeline block (5-10px above)
            const textY = blockTop - 5;
            this.ctx.fillText(label, eventX, textY);
        }
    },

    /**
     * Draw time axis with labels
     * @param {number} startJD - Start Julian Date
     * @param {number} endJD - End Julian Date
     */
    drawTimeAxis(startJD, endJD) {
        const axisY = this.LABEL_AREA_HEIGHT + this.BLOCK_HEIGHT + 5;

        // Draw axis line
        const axisColor = getComputedStyle(document.documentElement)
              .getPropertyValue('--border-color').trim();
        this.ctx.strokeStyle = axisColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.TIMELINE_MARGIN, axisY);
        this.ctx.lineTo(this.canvas.width - this.TIMELINE_MARGIN, axisY);
        this.ctx.stroke();

        // Draw time labels at whole hours
        const textColor = getComputedStyle(document.documentElement)
              .getPropertyValue('--text-color').trim();
        this.ctx.fillStyle = textColor;
        this.ctx.font = '13px monospace';
        this.ctx.textAlign = 'center';

        // Calculate first whole hour after start
        const startDate = jdToDate(startJD);
        let firstHour = new Date(startDate);
        firstHour.setMinutes(0, 0, 0);
        if (firstHour <= startDate) {
            firstHour.setHours(firstHour.getHours() + 1);
        }

        // Draw tick marks and labels at each whole hour
        let currentTime = firstHour;
        const endDate = jdToDate(endJD);

        while (currentTime <= endDate) {
            const currentJD = dateToJD(currentTime);
            const x = this.jdToX(currentJD, startJD, endJD);

            // Draw tick mark
            this.ctx.beginPath();
            this.ctx.moveTo(x, axisY);
            this.ctx.lineTo(x, axisY + 8);
            this.ctx.stroke();

            // Draw label
            const hours = currentTime.getHours().toString().padStart(2, '0');
            this.ctx.fillText(`${hours}:00`, x, axisY + 23);

            // Move to next hour
            currentTime = new Date(currentTime.getTime() + 3600000);
        }
    },


    /**
     * Draw legend
     */
    drawLegend() {
        const legendY = this.LABEL_AREA_HEIGHT + this.BLOCK_HEIGHT + 35;
        const legendX = this.LEGEND_MARGIN;

        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'left';

        const textColor = getComputedStyle(document.documentElement)
              .getPropertyValue('--text-color').trim();

        const items = [
            { color: this.COLORS.imaging1, label: 'Target (odd)' },
            { color: this.COLORS.imaging2, label: 'Target (even)' }
        ];

        let x = legendX;
        items.forEach(item => {
            // Draw color box
            this.ctx.fillStyle = item.color;
            this.ctx.fillRect(x, legendY, 14, 14);

            // Draw label
            this.ctx.fillStyle = textColor;
            this.ctx.fillText(item.label, x + 20, legendY + 11);
            x += 120;
        });

        // Draw altitude violation sample in legend
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x, legendY, 14, 14);
        this.ctx.clip();

        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        this.ctx.fillRect(x, legendY, 14, 14);

        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        this.ctx.lineWidth = 1.5;
        const spacing = 6;
        for (let offset = -14; offset < 28; offset += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, legendY + 14);
            this.ctx.lineTo(x + offset + 14, legendY);
            this.ctx.stroke();
        }
        for (let offset = 0; offset < 28; offset += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, legendY);
            this.ctx.lineTo(x + offset - 14, legendY + 14);
            this.ctx.stroke();
        }

        this.ctx.restore();

        this.ctx.fillStyle = textColor;
        this.ctx.fillText('Altitude violation', x + 20, legendY + 11);
        x += 140;

        // Draw horizon violation sample in legend
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x, legendY, 14, 14);
        this.ctx.clip();

        this.ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        this.ctx.fillRect(x, legendY, 14, 14);

        this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
        this.ctx.lineWidth = 1.5;

        // Draw diagonal lines (single direction)
        for (let offset = -14; offset < 28; offset += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, legendY + 14);
            this.ctx.lineTo(x + offset + 14, legendY);
            this.ctx.stroke();
        }

        this.ctx.restore();

        this.ctx.fillStyle = textColor;
        this.ctx.fillText('Horizon violation', x + 20, legendY + 11);
        x += 140;

        // Draw AF marker in legend
        this.drawAutofocusMarker(x, legendY - 3);
        this.ctx.fillStyle = textColor;
        this.ctx.fillText('Autofocus', x + 12, legendY + 11);
        x += 100;

        // Draw transit marker in legend
        this.drawTransitMarker(x, legendY - 3);
        this.ctx.fillStyle = textColor;
        this.ctx.fillText('Transit', x + 12, legendY + 11);
    },

    /**
     * Convert Julian Date to canvas X coordinate
     * @param {number} jd - Julian Date
     * @param {number} startJD - Session start
     * @param {number} endJD - Session end
     * @returns {number} X coordinate
     */
    jdToX(jd, startJD, endJD) {
        const fraction = (jd - startJD) / (endJD - startJD);
        const availableWidth = this.canvas.width - (2 * this.TIMELINE_MARGIN);
        return this.TIMELINE_MARGIN + (fraction * availableWidth);
    },

    /**
     * Draw target name labels at the start of each target's imaging session
     */
    drawTargetLabels(events, sessionStartJD, sessionEndJD) {
        const yOffset = this.LABEL_AREA_HEIGHT;

        // Group imaging events by target to find start position
        const targetSpans = new Map();

        events.filter(e => e.type === 'imaging').forEach(event => {
            if (!targetSpans.has(event.targetId)) {
                targetSpans.set(event.targetId, {
                    name: event.description,
                    startJD: event.startJD,
                    endJD: event.endJD
                });
            } else {
                const span = targetSpans.get(event.targetId);
                span.startJD = Math.min(span.startJD, event.startJD);
                span.endJD = Math.max(span.endJD, event.endJD);
            }
        });

        // Draw labels at the start of each target's session
        targetSpans.forEach((span, targetId) => {
            const x = this.jdToX(span.startJD, sessionStartJD, sessionEndJD);

            // Measure text to get background size
            this.ctx.font = '20px sans-serif';
            const textMetrics = this.ctx.measureText(span.name);
            const textWidth = textMetrics.width;
            const textHeight = 24; // Approximate height for 20px font

            const padding = 6;
            const bgX = x + 10 - padding;
            const bgY = yOffset + this.BLOCK_HEIGHT - 22 - textHeight + padding;
            const bgWidth = textWidth + (padding * 2);
            const bgHeight = textHeight + (padding * 2);

            // Draw semi-transparent dark background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // 30% opaque black
            this.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

            // Draw text on top
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // 70% opaque white
            this.ctx.textAlign = 'left';
            this.ctx.fillText(span.name, x + 10, yOffset + this.BLOCK_HEIGHT - 15);
        });
    },

    /**
     * Draw continuous altitude violation overlays
     */
    drawAltitudeViolations(events, sessionStartJD, sessionEndJD) {
        const yOffset = this.LABEL_AREA_HEIGHT;

        // Group imaging events by target to find full spans
        const targetSpans = new Map();

        events.filter(e => e.type === 'imaging').forEach(event => {
            if (!targetSpans.has(event.targetId)) {
                targetSpans.set(event.targetId, {
                    startJD: event.startJD,
                    endJD: event.endJD,
                    altitudeConstraint: event.altitudeConstraint
                });
            } else {
                const span = targetSpans.get(event.targetId);
                span.startJD = Math.min(span.startJD, event.startJD);
                span.endJD = Math.max(span.endJD, event.endJD);
            }
        });

        // Draw continuous violation overlays with crosshatch pattern
        targetSpans.forEach((span, targetId) => {
            if (!span.altitudeConstraint || span.altitudeConstraint.isValid) return;

            const constraint = span.altitudeConstraint;

            // Shade portion before valid start (if starts too early)
            if (span.startJD < constraint.validStartJD) {
                const violationX1 = this.jdToX(span.startJD, sessionStartJD, sessionEndJD);
                const violationX2 = this.jdToX(Math.min(constraint.validStartJD, span.endJD), sessionStartJD, sessionEndJD);
                const violationWidth = violationX2 - violationX1;

                this.drawCrosshatch(violationX1, yOffset, violationWidth, this.BLOCK_HEIGHT);
            }

            // Shade portion after valid end (if ends too late)
            if (span.endJD > constraint.validEndJD) {
                const violationX1 = this.jdToX(Math.max(constraint.validEndJD, span.startJD), sessionStartJD, sessionEndJD);
                const violationX2 = this.jdToX(span.endJD, sessionStartJD, sessionEndJD);
                const violationWidth = violationX2 - violationX1;

                this.drawCrosshatch(violationX1, yOffset, violationWidth, this.BLOCK_HEIGHT);
            }
        });
    },

    /**
     * Draw crosshatch pattern for altitude violations (with proper clipping)
     */
    drawCrosshatch(x, y, width, height) {
        // Save context state
        this.ctx.save();

        // Clip to the violation rectangle ONLY
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        this.ctx.clip();

        // Semi-transparent red background
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        this.ctx.fillRect(x, y, width, height);

        // Red diagonal lines for crosshatch
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        this.ctx.lineWidth = 1.5;

        const spacing = 6; // Space between diagonal lines

        // Draw diagonal lines going one direction (/)
        for (let offset = -height; offset < width + height; offset += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, y + height);
            this.ctx.lineTo(x + offset + height, y);
            this.ctx.stroke();
        }

        // Draw diagonal lines going other direction (\)
        for (let offset = 0; offset < width + height; offset += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, y);
            this.ctx.lineTo(x + offset - height, y + height);
            this.ctx.stroke();
        }

        // Restore context (removes clipping)
        this.ctx.restore();
    },

    /**
     * Draw horizon violation overlays with diagonal lines
     */
    drawHorizonViolations(events, sessionStartJD, sessionEndJD) {
        const yOffset = this.LABEL_AREA_HEIGHT;

        // Draw horizon violations for each imaging event
        events.filter(e => e.type === 'imaging' && e.horizonViolations && e.horizonViolations.length > 0).forEach(event => {
            event.horizonViolations.forEach(violation => {
                const violationX1 = this.jdToX(violation.startJD, sessionStartJD, sessionEndJD);
                const violationX2 = this.jdToX(violation.endJD, sessionStartJD, sessionEndJD);
                const violationWidth = violationX2 - violationX1;

                if (violationWidth > 0) {
                    this.drawDiagonalLines(violationX1, yOffset, violationWidth, this.BLOCK_HEIGHT);
                }
            });
        });
    },

    /**
     * Draw diagonal line pattern for horizon violations
     */
    drawDiagonalLines(x, y, width, height) {
        // Save context state
        this.ctx.save();

        // Clip to the violation rectangle ONLY
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        this.ctx.clip();

        // Semi-transparent orange background
        this.ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        this.ctx.fillRect(x, y, width, height);

        // Orange diagonal lines (single direction for distinction from crosshatch)
        this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
        this.ctx.lineWidth = 1.5;

        const spacing = 6; // Space between diagonal lines

        // Draw diagonal lines from bottom-left to top-right (/)
        for (let offset = -height; offset < width + height; offset += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, y + height);
            this.ctx.lineTo(x + offset + height, y);
            this.ctx.stroke();
        }

        // Restore context (removes clipping)
        this.ctx.restore();
    }

};
