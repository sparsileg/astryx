/**
 * yearly-observability-view.js
 * Yearly Observability View - displays annual altitude graphs. The numbers
 * come from YearlyObservabilityCalculations.
 */

const YearlyObservabilityView = {
    followsCurrentTarget: true,     // redraws on current-target-changed
    _resizeObserver: null,
    currentTarget: null,
    lastGraphData: null,

    /**
     * Render the yearly observability view
     */
    render(container, params = {}) {
        const template = document.getElementById('yo-view-template');
        const content = template.content.cloneNode(true);
        container.innerHTML = '';
        container.appendChild(content);

        // Render from cache if available (pre-calculated before navigation) — no blink
        const cached = this.lastGraphData;
        if (cached) {
            this.displayYearlyObservabilityGraph(cached.altitudeData, cached.inputs);
        } else {
            // Fallback — direct navigation or page refresh
            if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
                VisibilityTargets.loadLastTarget();
            }
            if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
                const defaultTarget = DataManager.getTargets().find(t => t.object === APP_CONFIG.DEFAULT_TARGET);
                if (defaultTarget) VisibilityTargets.currentTarget = defaultTarget;
            }
            setTimeout(() => this.calculateYearly(), 0);
        }

        // Re-render graph on resize without recalculating — Issue #87
        const graphContainer = container.querySelector('#yearly-observability-graph');
        if (graphContainer && typeof ResizeObserver !== 'undefined') {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            let resizeTimer = null;
            this._resizeObserver = new ResizeObserver(() => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const cached = this.lastGraphData;
                    if (cached) {
                        this.renderYearlyObservabilityGraph(cached.altitudeData, cached.inputs);
                    }
                }, 200);
            });
            this._resizeObserver.observe(graphContainer);
        }

        if (!this._locationChangedHandler) {
            this._locationChangedHandler = () => this.calculateYearly();
            document.addEventListener('selected-location-changed', this._locationChangedHandler);
        }
        if (!this._targetChangedHandler) {
            this._targetChangedHandler = () => this.calculateYearly();
            document.addEventListener('current-target-changed', this._targetChangedHandler);
        }
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._locationChangedHandler) {
            document.removeEventListener('selected-location-changed', this._locationChangedHandler);
            this._locationChangedHandler = null;
        }
        if (this._targetChangedHandler) {
            document.removeEventListener('current-target-changed', this._targetChangedHandler);
            this._targetChangedHandler = null;
        }
    },

    /**
     * Get inputs for yearly calculation
     */
    getYearlyInputs() {
        // Get location from sidebar dropdown
        const locationName = SettingsManager.getSelectedLocation();
        const location = DataManager.getLocation(locationName);

        // Try modal element first, fall back to main view element, then default
        const yoLabel = document.getElementById('yo-min-alt-label');
        const minAltitude = yoLabel ? parseFloat(yoLabel.textContent) : APP_CONFIG.DEFAULT_YEARLY_MIN_ALTITUDE;

        return {
            targetName: this.currentTarget ? this.currentTarget.object : '',
            targetCommonName: this.currentTarget ? this.currentTarget.common : null,
            targetType: this.currentTarget ? this.currentTarget.type : null,
            ra: this.currentTarget ? this.currentTarget.ra : null,
            dec: this.currentTarget ? this.currentTarget.dec : null,
            latitude: location ? location.latitude : null,
            longitude: location ? location.longitude : null,
            timezone: location ? location.timezone : null,
            timeZone: location ? location.timeZone : null,
            minAltitude: minAltitude,
            showTargetAltitude: true,
            showMinAltitude: true,
            showSkyglow: true
        };
    },

    /**
     * Calculate and display yearly altitude
     */
    calculateYearly(providedInputs = null) {
        // Use provided inputs or get from DOM
        const inputs = providedInputs || this.getYearlyInputs();

        // Validate yearly-specific inputs (no date needed)
        if (!inputs.targetName) {
            UIManager.showToast('Please select a target', 'error');
            return;
        }

        if (isNaN(inputs.ra) || isNaN(inputs.dec)) {
            UIManager.showToast('Please select a valid target with coordinates', 'error');
            return;
        }

        if (isNaN(inputs.latitude) || inputs.latitude < -90 || inputs.latitude > 90) {
            UIManager.showToast('Latitude must be between -90 and 90 degrees', 'error');
            return;
        }

        if (isNaN(inputs.longitude) || inputs.longitude < -180 || inputs.longitude > 180) {
            UIManager.showToast('Longitude must be between -180 and 180 degrees', 'error');
            return;
        }

        if (isNaN(inputs.timezone) || inputs.timezone < -12 || inputs.timezone > 14) {
            UIManager.showToast('Timezone must be between -12 and +14 hours', 'error');
            return;
        }

        if (isNaN(inputs.minAltitude) || inputs.minAltitude < 0 || inputs.minAltitude > 90) {
            UIManager.showToast('Minimum altitude must be between 0 and 90 degrees', 'error');
            return;
        }

        // Calculate altitude data for 365 days
        const altitudeData = YearlyObservabilityCalculations.calculateYearlyAltitudeData(inputs);

        // Display the yearly observability graph
        this.displayYearlyObservabilityGraph(altitudeData, inputs);
    },

    /**
     * Display yearly observability graph overlay
     */
    displayYearlyObservabilityGraph(altitudeData, inputs) {
        const graphContainer = document.getElementById('yearly-observability-graph');
        const headerContainer = document.getElementById('yearly-observability-header');

        if (!graphContainer) {
            console.error('Yearly observability graph container not found');
            return;
        }

        // Format peak altitude
        let peakAltitudeStr = 'Never meets criteria';
        if (altitudeData.maxAltitude) {
            peakAltitudeStr = `Peak altitude of ${altitudeData.maxAltitude.toFixed(1)}°`;
        }

        // Format best month and observable range
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const selectedLocation = SettingsManager.getSelectedLocation();
        const currentTarget = this.currentTarget;
        let bestMonthStr = '';
        if (currentTarget && selectedLocation) {
            const bestMonth = currentTarget.bestMonth?.[selectedLocation];
            const visibilityStart = currentTarget.visibilityStart?.[selectedLocation];
            const visibilityEnd = currentTarget.visibilityEnd?.[selectedLocation];
            if (bestMonth) {
                bestMonthStr = `Best month: ${monthNames[bestMonth - 1]}`;
                if (visibilityStart) {
                    let endMonth = visibilityEnd > 12 ? visibilityEnd - 12 : visibilityEnd;
                    bestMonthStr += ` · Observable: ${monthNames[visibilityStart - 1]}–${monthNames[endMonth - 1]}`;
                }
            }
        }

        // Populate header elements
        const targetNameEl = document.getElementById('yo-target-name');
        if (targetNameEl) {
            targetNameEl.textContent = inputs.targetName + (inputs.targetCommonName ? ' (' + inputs.targetCommonName + ')' : '');
        }

        const subtitleEl = document.getElementById('yo-subtitle');
        if (subtitleEl) {
            subtitleEl.innerHTML = peakAltitudeStr + (bestMonthStr ? ' &nbsp;·&nbsp; ' + bestMonthStr : '');
        }

        const yoTrigger = document.getElementById('yo-min-alt-trigger');
        const yoDropdown = document.getElementById('yo-min-alt-dropdown');
        const yoMenu = document.getElementById('yo-min-alt-menu');
        const yoLabel = document.getElementById('yo-min-alt-label');

        if (yoTrigger && yoDropdown && yoMenu && yoLabel) {
            // Set initial label
            const currentVal = inputs.minAltitude ?? APP_CONFIG.DEFAULT_YEARLY_MIN_ALTITUDE;
            const initialItem = yoMenu.querySelector(`[data-value="${currentVal}"]`);
            if (initialItem) yoLabel.textContent = initialItem.textContent;

            // Only attach listeners once
            if (!yoTrigger._listenerAttached) {
                yoTrigger._listenerAttached = true;

                yoTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    yoDropdown.classList.toggle('open');
                });

                yoMenu.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = e.target.closest('.astryx-dropdown-item');
                    if (!item) return;
                    yoLabel.textContent = item.textContent;
                    yoDropdown.classList.remove('open');
                    if (typeof VisibilityTargets !== 'undefined' && VisibilityTargets.currentTarget) {
                        YearlyObservabilityView.currentTarget = VisibilityTargets.currentTarget;
                    }
                    YearlyObservabilityView.calculateYearly();
                });
            }
        }

        // Store data for theme change re-rendering
        this.lastGraphData = {
            altitudeData: altitudeData,
            inputs: inputs
        };

        // Render the graph
        this.renderYearlyObservabilityGraph(altitudeData, inputs);
    },

    /**
     * Render the yearly observability SVG graph
     */
    renderYearlyObservabilityGraph(altitudeData, inputs) {
        const container = document.getElementById('yearly-observability-graph');
        if (!container) return;

        // Get CSS variables for theme support
        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = computedStyle.getPropertyValue('--bg-color').trim();
        const textColor = computedStyle.getPropertyValue('--text-color').trim();
        const textSecondary = computedStyle.getPropertyValue('--text-secondary').trim();
        const borderColor = computedStyle.getPropertyValue('--border-color').trim();

        // Use actual container width for responsive rendering — Issue #87
        const containerWidth = container.clientWidth || 1100;
        const width = Math.max(400, containerWidth - 32); // 32 = container padding (1rem each side)
        const height = 310;
        const padding = { top: 20, right: 20, bottom: 40, left: 20 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.display = 'block';

        // Background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('width', width);
        background.setAttribute('height', height);
        background.setAttribute('fill', bgColor);
        svg.appendChild(background);

        // Create graph area with grid lines
        const graphGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graphGroup.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
        svg.appendChild(graphGroup);

        // Month labels and grid lines for rolling 12 months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        // Get starting month and year from altitudeData
        const startMonth = altitudeData.startDate.getMonth(); // 0-11
        const startYear = altitudeData.startDate.getFullYear();

        let cumulativeDays = 0;
        for (let i = 0; i < 12; i++) {
            const monthIndex = (startMonth + i) % 12;
            const x = (cumulativeDays / 365) * graphWidth;

            // Calculate current year (increments when we wrap from Dec to Jan)
            const currentYear = startYear + Math.floor((startMonth + i) / 12);

            // Draw vertical grid line at month start
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', x);
            gridLine.setAttribute('y1', 0);
            gridLine.setAttribute('x2', x);
            gridLine.setAttribute('y2', graphHeight);
            gridLine.setAttribute('stroke', borderColor);
            gridLine.setAttribute('stroke-width', '1');
            graphGroup.appendChild(gridLine);

            // Scale font size with width — Issue #87
            const fontSize = Math.max(12, Math.round(width / 60));
            const yearFontSize = Math.max(13, Math.round(width / 55));

            // Month label at bottom of graph, aligned with grid line
            const monthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            monthLabel.setAttribute('x', padding.left + x);
            monthLabel.setAttribute('y', height - 16);
            monthLabel.setAttribute('text-anchor', 'middle');
            monthLabel.setAttribute('fill', textSecondary);
            monthLabel.setAttribute('font-size', fontSize);
            monthLabel.textContent = months[monthIndex];
            svg.appendChild(monthLabel);

            // Add year label for first month or when year changes (January)
            if (i === 0 || monthIndex === 0) {
                const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                yearLabel.setAttribute('x', padding.left + x);
                yearLabel.setAttribute('y', height - 2);
                yearLabel.setAttribute('text-anchor', 'middle');
                yearLabel.setAttribute('fill', textColor);
                yearLabel.setAttribute('font-size', yearFontSize);
                yearLabel.setAttribute('font-weight', '500');
                yearLabel.textContent = currentYear;
                svg.appendChild(yearLabel);
            }

            // Month tick mark at bottom edge of graph
            const tickMark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tickMark.setAttribute('x1', padding.left + x);
            tickMark.setAttribute('y1', padding.top + graphHeight);
            tickMark.setAttribute('x2', padding.left + x);
            tickMark.setAttribute('y2', padding.top + graphHeight + 8);
            tickMark.setAttribute('stroke', textSecondary);
            tickMark.setAttribute('stroke-width', '3');
            svg.appendChild(tickMark);

            // Month tick mark at top edge of graph
            const topTickMark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            topTickMark.setAttribute('x1', padding.left + x);
            topTickMark.setAttribute('y1', padding.top - 8);
            topTickMark.setAttribute('x2', padding.left + x);
            topTickMark.setAttribute('y2', padding.top - 8);
            topTickMark.setAttribute('stroke', textSecondary);
            topTickMark.setAttribute('stroke-width', '3');
            svg.appendChild(topTickMark);

            cumulativeDays += daysInMonth[monthIndex];
        }

        // Draw observability gradient
        // Create gradient definition
        const gradientDef = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const linearGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        linearGradient.setAttribute('id', 'observabilityGradient');
        linearGradient.setAttribute('x1', '0%');
        linearGradient.setAttribute('y1', '0%');
        linearGradient.setAttribute('x2', '100%');
        linearGradient.setAttribute('y2', '0%');

        // Add gradient stops from observability scores
        altitudeData.data.forEach((point) => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            const position = (point.dayIndex / 365) * 100;
            // Force white when target is below minimum altitude — Issue #88
            let stopColor;
            if (point.targetAltitude === null || point.targetAltitude < inputs.minAltitude) {
                stopColor = 'rgb(255,255,255)';
            } else {
                // Convert score (0-1) to grayscale (0-255) where higher score = darker (better)
                const grayValue = Math.round(255 * (1 - point.observabilityScore));
                stopColor = `rgb(${grayValue},${grayValue},${grayValue})`;
            }
            stop.setAttribute('offset', `${position}%`);
            stop.setAttribute('stop-color', stopColor);
            linearGradient.appendChild(stop);
        });

        gradientDef.appendChild(linearGradient);
        graphGroup.appendChild(gradientDef);

        // Draw a rectangle with the gradient fill
        const observabilityRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        observabilityRect.setAttribute('x', 0);
        observabilityRect.setAttribute('y', 0);
        observabilityRect.setAttribute('width', graphWidth);
        observabilityRect.setAttribute('height', graphHeight);
        observabilityRect.setAttribute('fill', 'url(#observabilityGradient)');
        observabilityRect.setAttribute('opacity', '1.0');
        graphGroup.appendChild(observabilityRect);

        // Draw minimum altitude line
        const minAltY = graphHeight - (inputs.minAltitude / 90) * graphHeight;

        // Black outline — solid, no dash — Issue #87
        const minAltOutline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        minAltOutline.setAttribute('x1', 0);
        minAltOutline.setAttribute('y1', minAltY);
        minAltOutline.setAttribute('x2', graphWidth);
        minAltOutline.setAttribute('y2', minAltY);
        minAltOutline.setAttribute('stroke', '#000000');
        minAltOutline.setAttribute('stroke-width', '5');
        graphGroup.appendChild(minAltOutline);

        // Yellow dashed line on top — matches Daily Visibility style — Issue #87
        const minAltLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        minAltLine.setAttribute('x1', 0);
        minAltLine.setAttribute('y1', minAltY);
        minAltLine.setAttribute('x2', graphWidth);
        minAltLine.setAttribute('y2', minAltY);
        minAltLine.setAttribute('stroke', 'rgba(255,255,0,0.5)');
        minAltLine.setAttribute('stroke-width', '3');
        minAltLine.setAttribute('stroke-dasharray', '5,5');
        graphGroup.appendChild(minAltLine);

        // Draw full moon indicators
        // Find full moon peaks (local maxima in illumination)
        const fullMoonPeaks = [];

        for (let i = 1; i < altitudeData.data.length - 1; i++) {
            const point = altitudeData.data[i];
            const prevPoint = altitudeData.data[i - 1];
            const nextPoint = altitudeData.data[i + 1];

            if (point.imagingScore !== null &&
                prevPoint.imagingScore !== null &&
                nextPoint.imagingScore !== null &&
                point.imagingScore.moonIllum > 0.90 && // At least 90% illuminated
                point.imagingScore.moonIllum >= prevPoint.imagingScore.moonIllum &&
                point.imagingScore.moonIllum >= nextPoint.imagingScore.moonIllum) {
                // This is a local maximum - a full moon peak
                fullMoonPeaks.push(point);
            }
        }

        // Draw yellow circles for full moon peaks
        fullMoonPeaks.forEach((point) => {
            const x = (point.dayIndex / 365) * graphWidth;

            const moonCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            moonCircle.setAttribute('cx', x);
            moonCircle.setAttribute('cy', 10); // delta-y from top in pixels
            moonCircle.setAttribute('r', 7);   // radius in pixels
            moonCircle.setAttribute('fill', '#ffd700'); // Gold/yellow color
            moonCircle.setAttribute('stroke', '#000000');
            moonCircle.setAttribute('stroke-width', '0.5');
            graphGroup.appendChild(moonCircle);
        });

        // Draw target altitude curve
        // Build path segments, skipping negative altitudes (creates gaps)
        const pathSegments = [];
        let currentSegment = [];

        altitudeData.data.forEach((d, i) => {
            if (d.targetAltitude !== null && d.targetAltitude >= 0) {
                const x = (d.dayIndex / 365) * graphWidth;
                const clampedAlt = Math.min(90, d.targetAltitude);
                const y = graphHeight - (clampedAlt / 90) * graphHeight;
                currentSegment.push({ x, y });
            } else {
                // Negative or null altitude - end current segment
                if (currentSegment.length > 0) {
                    pathSegments.push(currentSegment);
                    currentSegment = [];
                }
            }
        });

        // Add final segment if any
        if (currentSegment.length > 0) {
            pathSegments.push(currentSegment);
        }

        // Draw each segment as a separate path
        pathSegments.forEach(segment => {
            if (segment.length < 2) return; // Skip single points

            const targetPath = segment.map((point, i) => {
                return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
            }).join(' ');

            // Black outline for target — Issue #87
            const targetOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            targetOutline.setAttribute('d', targetPath);
            targetOutline.setAttribute('fill', 'none');
            targetOutline.setAttribute('stroke', '#000000');
            targetOutline.setAttribute('stroke-width', '5');
            graphGroup.appendChild(targetOutline);

            // White line on top — matches Daily Visibility style — Issue #87
            const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            targetLine.setAttribute('d', targetPath);
            targetLine.setAttribute('fill', 'none');
            targetLine.setAttribute('stroke', '#FFFFFF');
            targetLine.setAttribute('stroke-width', '2');
            graphGroup.appendChild(targetLine);
        });

        // Draw current day indicator (extends full height of SVG)
        const today = new Date();
        const daysSinceStart = Math.floor((today - altitudeData.startDate) / (1000 * 60 * 60 * 24));

        if (daysSinceStart >= 0 && daysSinceStart < 365) {
            const x = padding.left + (daysSinceStart / 365) * graphWidth;

            // Draw vertical line for current day extending full height
            const todayLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            todayLine.setAttribute('x1', x);
            todayLine.setAttribute('y1', 0);
            todayLine.setAttribute('x2', x);
            todayLine.setAttribute('y2', height);
            todayLine.setAttribute('stroke', '#ffa726');
            todayLine.setAttribute('stroke-width', '3');
            todayLine.setAttribute('opacity', '0.8');
            svg.appendChild(todayLine);
        }

        // Append SVG to container
        container.innerHTML = '';
        container.appendChild(svg);
    },
};
