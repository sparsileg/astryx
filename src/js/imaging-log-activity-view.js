/**
 * imaging-log-activity-view.js
 * GitHub-style contribution heatmap for imaging activity (Issue #142).
 * Data comes from ImagingLogManager.getActivityByYear/getActivityYears —
 * this file only renders.
 */

const ImagingLogActivityView = {
    currentYear: null,

    /**
     * Render the Activity tab: year slider + heatmap
     */
    async render() {
        const years = await ImagingLogManager.getActivityYears(); // most recent first
        const sliderWrapper = document.getElementById('imaging-log-activity-year-control');
        const container = document.getElementById('imaging-log-activity-heatmap');
        if (!container) return;

        if (years.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No imaging sessions logged yet.</p>';
            if (sliderWrapper) sliderWrapper.style.display = 'none';
            return;
        }

        if (sliderWrapper) sliderWrapper.style.display = '';

        if (!this.currentYear || !years.includes(this.currentYear)) {
            this.currentYear = years[0]; // most recent year with data
        }

        const earliestYear = parseInt(years[years.length - 1], 10);
        const currentCalendarYear = new Date().getFullYear();

        this.renderYearSlider(earliestYear, currentCalendarYear);
        await this.renderHeatmap(this.currentYear);
    },

    /**
     * Wire the year slider — left = earliest year with data, right = the
     * actual current calendar year (may be later than the latest year with
     * data, per Issue #142 discussion: every year in range is a valid
     * slider step, including years with zero sessions). The current year
     * also floats above the thumb, tracking it as it moves.
     */
    renderYearSlider(earliestYear, currentCalendarYear) {
        const slider = document.getElementById('imaging-log-activity-year-slider');
        const minLabel = document.getElementById('imaging-log-activity-year-min-label');
        const maxLabel = document.getElementById('imaging-log-activity-year-max-label');
        if (!slider) return;

        slider.min = earliestYear;
        slider.max = currentCalendarYear;
        slider.value = this.currentYear;
        if (minLabel) minLabel.textContent = earliestYear;
        if (maxLabel) maxLabel.textContent = currentCalendarYear;
        this.updateSliderBackground(slider);
        this.positionFloatingLabel(slider);

        if (!slider._listenerAttached) {
            slider._listenerAttached = true;
            slider.addEventListener('input', () => {
                this.currentYear = slider.value;
                this.updateSliderBackground(slider);
                this.positionFloatingLabel(slider);
                this.renderHeatmap(this.currentYear);
            });
        }
    },

    /**
     * Two-tone gradient fill, matching the Sequence Planner slider pattern.
     */
    updateSliderBackground(slider) {
        const value = parseFloat(slider.value);
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const percentage = ((value - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%, var(--border-color) 100%)`;
    },

    /**
     * Position the floating current-year label directly above the slider
     * thumb. Measures actual rendered geometry (not just percentage of the
     * row width) so it stays correctly centered regardless of the bound
     * labels' widths eating into the slider's usable track.
     */
    positionFloatingLabel(slider) {
        const label = document.getElementById('imaging-log-activity-year-label');
        const row = document.querySelector('.activity-year-indicator-row');
        if (!label || !row) return;

        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 0;
        const value = parseFloat(slider.value);
        const percentage = max > min ? (value - min) / (max - min) : 0;

        const thumbWidthPx = 16; // matches input[type="range"] thumb size in base.css
        const sliderRect = slider.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();

        const thumbCenterX = (sliderRect.left - rowRect.left)
            + thumbWidthPx / 2
            + percentage * (sliderRect.width - thumbWidthPx);

        label.style.left = `${thumbCenterX}px`;
        label.textContent = this.currentYear;
    },

    /**
     * Build and render the GitHub-style day grid for one year
     */
    async renderHeatmap(year) {
        const container = document.getElementById('imaging-log-activity-heatmap');
        if (!container) return;

        const activity = await ImagingLogManager.getActivityByYear(year);

        // Quartile-based levels, relative to this year's own active nights —
        // integration time per night varies too much by equipment/target for
        // fixed absolute buckets to stay meaningful across different rigs.
        const totals = Array.from(activity.values())
            .map(d => d.totalSeconds)
            .filter(s => s > 0)
            .sort((a, b) => a - b);
        const p25 = this.percentile(totals, 25);
        const p50 = this.percentile(totals, 50);
        const p75 = this.percentile(totals, 75);

        const levelFor = (seconds) => {
            if (!seconds || seconds <= 0) return 0;
            if (seconds <= p25) return 1;
            if (seconds <= p50) return 2;
            if (seconds <= p75) return 3;
            return 4;
        };

        // Grid spans the Sunday on/before Jan 1 through the Saturday on/after Dec 31
        const yearNum = parseInt(year, 10);
        const jan1 = new Date(Date.UTC(yearNum, 0, 1));
        const dec31 = new Date(Date.UTC(yearNum, 11, 31));
        const gridStart = new Date(jan1);
        gridStart.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay());
        const gridEnd = new Date(dec31);
        gridEnd.setUTCDate(dec31.getUTCDate() + (6 - dec31.getUTCDay()));

        const totalDays = Math.round((gridEnd - gridStart) / 86400000) + 1;
        const totalWeeks = totalDays / 7;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabels = new Array(totalWeeks).fill('');
        let lastMonth = -1;

        let cellsHtml = '';
        const cursor = new Date(gridStart);
        for (let week = 0; week < totalWeeks; week++) {
            for (let dow = 0; dow < 7; dow++) {
                const dateStr = cursor.toISOString().slice(0, 10);
                const inYear = cursor.getUTCFullYear() === yearNum;

                if (inYear && cursor.getUTCMonth() !== lastMonth) {
                    lastMonth = cursor.getUTCMonth();
                    monthLabels[week] = monthNames[lastMonth];
                }

                if (!inYear) {
                    cellsHtml += `<div class="activity-cell activity-cell-empty" style="grid-column:${week + 1};grid-row:${dow + 1};"></div>`;
                } else {
                    const day = activity.get(dateStr);
                    const level = day ? levelFor(day.totalSeconds) : 0;
                    const tooltip = this.buildTooltip(dateStr, day);
                    cellsHtml += `<div class="activity-cell activity-level-${level}" style="grid-column:${week + 1};grid-row:${dow + 1};" data-tooltip="${HtmlUtils.escapeHtml(tooltip)}"></div>`;
                }

                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
        }

        let labelsHtml = '';
        monthLabels.forEach((label, week) => {
            if (label) {
                labelsHtml += `<div class="activity-month-label" style="grid-column:${week + 1};">${label}</div>`;
            }
        });

        container.innerHTML = `
            <div class="activity-month-row" style="grid-template-columns: repeat(${totalWeeks}, 1fr);">${labelsHtml}</div>
            <div class="activity-grid" style="grid-template-columns: repeat(${totalWeeks}, 1fr);">${cellsHtml}</div>
            <div class="activity-legend">
                <span>Less</span>
                <div class="activity-cell activity-level-0"></div>
                <div class="activity-cell activity-level-1"></div>
                <div class="activity-cell activity-level-2"></div>
                <div class="activity-cell activity-level-3"></div>
                <div class="activity-cell activity-level-4"></div>
                <span>More</span>
            </div>
        `;
    },

    /**
     * Multi-line tooltip text: date, then one line per project imaged that
     * night. Rendered via the app's existing global [data-tooltip] JS
     * tooltip (tooltips.js), which delegates from document and already
     * picks up any element carrying the attribute — nothing new to wire.
     */
    buildTooltip(dateStr, day) {
        if (!day || day.projects.length === 0) {
            return dateStr;
        }
        const lines = [dateStr];
        day.projects.forEach(p => {
            lines.push(`${p.name} \u2014 ${p.subs} x ${p.subLength}s`);
        });
        return lines.join('\n');
    },

    percentile(sortedArr, p) {
        if (sortedArr.length === 0) return 0;
        const idx = (p / 100) * (sortedArr.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return sortedArr[lo];
        return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
    }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
