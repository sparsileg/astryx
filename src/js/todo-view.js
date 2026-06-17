/**
 * todo-view.js
 * View controller for To Do List
 */

const ToDoView = {
    container: null,
    currentSort: 'rise', // 'type', 'month', or 'rise'
    riseTimeViewMode: 'chart',  // 'list' or 'chart'

    /**
     * Check if a target is pinned
     */
    isTargetPinned(targetObject) {
        const pinnedTargets = DataManager.getPinnedTargets();
        return pinnedTargets.some(pinned => pinned.name === targetObject);
    },

    /**
     * Render the To Do List view
     */
    render(container, params) {
        this.container = container;

        // Load template
        const template = document.getElementById('todo-template');
        const content = template.content.cloneNode(true);

        container.innerHTML = '';
        container.appendChild(content);

        // Add sort dropdown to the header
        this.addSortDropdown();

        // Render the list
        this.renderToDoList();

        // Listen for updates
        if (!this._todoUpdatedHandler) {
            this._todoUpdatedHandler = () => this.renderToDoList();
            document.addEventListener('todo-list-updated', this._todoUpdatedHandler);
        }
    },

    /**
     * Initialize sort dropdown and toggle button from template
     */
    addSortDropdown() {
        const select = document.getElementById('todo-sort-select');
        if (select) {
            select.value = this.currentSort;
            select.addEventListener('change', (e) => {
                const newSort = e.target.value;
                if (newSort !== this.currentSort) {
                    this.currentSort = newSort;
                    this.updateToggleButton();
                    this.renderToDoList();
                }
            });
        }

        this.updateToggleButton();
        this.attachChartToggle();
    },

    /**
     * Show or hide the chart toggle button based on current sort
     */
    updateToggleButton() {
        const toggleBtn = document.getElementById('toggle-rise-chart');
        if (!toggleBtn) return;
        toggleBtn.style.visibility = 'visible';
        toggleBtn.textContent = this.riseTimeViewMode === 'list' ? '📊 Chart' : '📝 List';
    },

    /**
     * Render the To Do list (delegates to appropriate method based on sort)
     */
    async renderToDoList() {
        await this.loadImagingProjects();
        if (this.currentSort === 'month') {
            this.renderByMonth();
        } else if (this.currentSort === 'rise') {
            this.renderByRiseTime();
        } else {
            this.renderByType();
        }
    },

    /**
     * Render To Do list grouped by type
     */
    renderByType() {
        const todoContainer = document.getElementById('todo-container');
        if (!todoContainer) return;

        const toDoTargets = ToDoManager.getToDoTargets();

        if (toDoTargets.length === 0) {
            todoContainer.innerHTML = this.getEmptyMessage();
            return;
        }

        // Group targets by type
        const groupedByType = {};
        toDoTargets.forEach(target => {
            const type = target.type || 'Unknown';
            if (!groupedByType[type]) {
                groupedByType[type] = [];
            }
            groupedByType[type].push(target);
        });

        // Sort each group by bestMonth
        const selectedLocation = SettingsManager.getSelectedLocation();
        Object.keys(groupedByType).forEach(type => {
            groupedByType[type].sort((a, b) => {
                const aMonth = a.bestMonth?.[selectedLocation];
                const bMonth = b.bestMonth?.[selectedLocation];
                if (!aMonth) return 1;
                if (!bMonth) return -1;
                return aMonth - bMonth;
            });
        });

        if (this.riseTimeViewMode === 'chart') {
            // Build ordered list of label rows and target rows for chart
            const sortedTypes = Object.keys(groupedByType).sort();
            const rows = [];
            sortedTypes.forEach(type => {
                const typeDisplay = OBJECT_TYPES[type] || type;
                rows.push({ isLabel: true, label: typeDisplay });
                groupedByType[type].forEach(target => rows.push({ isLabel: false, target }));
            });
            this.renderGroupedChart(rows);
            return;
        }

        // Build HTML
        const sortedTypes = Object.keys(groupedByType).sort();
        const html = sortedTypes.map(type => {
            const typeDisplay = OBJECT_TYPES[type] || type;
            const targets = groupedByType[type];
            return this.buildCard(typeDisplay, targets, null, false);
        }).join('');

        todoContainer.innerHTML = html;
        this.attachEventListeners();
    },

    /**
     * Render To Do list grouped by best month
     */
    renderByMonth() {
        const todoContainer = document.getElementById('todo-container');
        if (!todoContainer) return;

        const toDoTargets = ToDoManager.getToDoTargets();

        if (toDoTargets.length === 0) {
            todoContainer.innerHTML = this.getEmptyMessage();
            return;
        }

        // Group targets by bestMonth
        const groupedByMonth = {};
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];

        // Initialize all months
        for (let i = 1; i <= 12; i++) {
            groupedByMonth[i] = [];
        }
        groupedByMonth['none'] = [];

        // Group targets
        const selectedLocation = SettingsManager.getSelectedLocation();
        toDoTargets.forEach(target => {
            const bestMonth = target.bestMonth?.[selectedLocation];
            if (bestMonth && bestMonth >= 1 && bestMonth <= 12) {
                groupedByMonth[bestMonth].push(target);
            } else {
                groupedByMonth['none'].push(target);
            }
        });

        // Sort each group by type
        Object.keys(groupedByMonth).forEach(month => {
            groupedByMonth[month].sort((a, b) => {
                const typeA = a.type || 'ZZZ';
                const typeB = b.type || 'ZZZ';
                return typeA.localeCompare(typeB);
            });
        });

        // Build HTML - start one month before current month, then wrap around
        let html = '';

        // Calculate starting month (one month before current)
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const startMonth = currentMonth === 1 ? 12 : currentMonth - 1;

        if (this.riseTimeViewMode === 'chart') {
            // Build ordered list of label rows and target rows for chart
            const rows = [];
            for (let offset = 0; offset < 12; offset++) {
                let monthNum = startMonth + offset;
                if (monthNum > 12) monthNum -= 12;
                const targets = groupedByMonth[monthNum];
                if (targets.length > 0) {
                    rows.push({ isLabel: true, label: monthNames[monthNum - 1] });
                    targets.forEach(target => rows.push({ isLabel: false, target }));
                }
            }
            if (groupedByMonth['none'].length > 0) {
                rows.push({ isLabel: true, label: 'No Best Month Data' });
                groupedByMonth['none'].forEach(target => rows.push({ isLabel: false, target }));
            }
            this.renderGroupedChart(rows);
            return;
        }

        // Add month cards in order starting from startMonth
        for (let offset = 0; offset < 12; offset++) {
            let monthNum = startMonth + offset;
            if (monthNum > 12) monthNum -= 12; // Wrap around

            const targets = groupedByMonth[monthNum];
            if (targets.length > 0) {
                const monthName = `${monthNames[monthNum - 1]} (${targets.length})`;
                html += this.buildCard(monthName, targets, null, true);
            }
        }

        // Add "No Best Month Data" card if needed
        if (groupedByMonth['none'].length > 0) {
            const notObsName = `No Best Month Data (${groupedByMonth['none'].length})`;
            html += this.buildCard(notObsName, groupedByMonth['none'], null, true);
        }

        todoContainer.innerHTML = html;
        this.attachEventListeners();
    },

    /**
     * Render To Do list sorted by rise time for tonight
     */
    renderByRiseTime() {
        const todoContainer = document.getElementById('todo-container');
        if (!todoContainer) return;

        const toDoTargets = ToDoManager.getToDoTargets();

        if (toDoTargets.length === 0) {
            todoContainer.innerHTML = this.getEmptyMessage();
            return;
        }

        // Get selected location
        const locationSelect = document.getElementById('sidebar-location-select');
        if (!locationSelect || !locationSelect.value) {
            todoContainer.innerHTML = `
            <div class="todo-empty-message">
                <p class="todo-empty-title">⚠️ No location selected</p>
                <p>Please select an observer location from the sidebar to calculate rise times.</p>
            </div>
        `;
            return;
        }

        const location = DataManager.getLocation(locationSelect.value);
        if (!location) {
            todoContainer.innerHTML = `
            <div class="todo-empty-message">
                <p class="todo-empty-title">⚠️ Location not found</p>
            </div>
        `;
            return;
        }

        // Get today's date and calculate dusk/dawn
        const today = new Date();
        const isDST = SettingsManager.isDSTActive(today, location.timezone);

        const duskJD = findAstronomicalDusk(today, location.latitude, location.longitude, location.timezone, isDST);
        const dawnJD = findNextAstronomicalDawn(today, location.latitude, location.longitude, location.timezone, isDST);

        if (!duskJD || !dawnJD) {
            todoContainer.innerHTML = `
            <div class="todo-empty-message">
                <p class="todo-empty-title">⚠️ No astronomical darkness tonight</p>
                <p>At this location and date, there is no astronomical darkness.</p>
            </div>
        `;
            return;
        }

        const minAltitude = 30;
        const minDarkHours = 2;
        const observable = [];
        const notObservable = [];

        // Calculate noon-to-noon window for rise/set calculations
        // Use local date, not UTC
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const noonWindow = getNoonToNoonWindow(dateStr, location.timezone, isDST);

        // Calculate rise/set times for each target
        toDoTargets.forEach(target => {
            const riseJD = findTargetRise(noonWindow.startJD, noonWindow.endJD, target.ra, target.dec,
                                          location.latitude, location.longitude, minAltitude);
            const setJD = findTargetSet(noonWindow.startJD, noonWindow.endJD, target.ra, target.dec,
                                        location.latitude, location.longitude, minAltitude);

            // Check if target is truly circumpolar (never sets below minAltitude over 24 hours)
            let isCircumpolar = false;
            let lowestAltitude = 90;

            // Sample over 24 hours to find minimum altitude
            const fullDayStart = duskJD - 0.5; // Start 12 hours before dusk
            for (let h = 0; h < 24; h += 0.5) {
                const testJD = fullDayStart + h / 24;
                const alt = getAltitude(testJD, target.ra, target.dec, location.latitude, location.longitude);
                if (alt < lowestAltitude) lowestAltitude = alt;
            }

            if (lowestAltitude >= minAltitude) {
                isCircumpolar = true;
            }

            // Calculate continuous dark hours above altitude
            let darkHours = 0;

            if (isCircumpolar) {
                // Circumpolar: entire dark period
                darkHours = (dawnJD - duskJD) * 24;
            } else if (riseJD && setJD) {
                // Normal case: target rises and sets during or around dark period
                const visibleStart = Math.max(riseJD, duskJD);
                const visibleEnd = Math.min(setJD, dawnJD);
                if (visibleEnd > visibleStart) {
                    darkHours = (visibleEnd - visibleStart) * 24;
                }
            } else if (riseJD && !setJD) {
                // Rises during dark, doesn't set before dawn
                const visibleStart = Math.max(riseJD, duskJD);
                darkHours = (dawnJD - visibleStart) * 24;
            } else if (!riseJD && setJD) {
                // Already up at dusk, sets during dark
                const visibleEnd = Math.min(setJD, dawnJD);
                darkHours = (visibleEnd - duskJD) * 24;
            } else {
                // Check if target is above altitude during entire dark period
                const duskAlt = getAltitude(duskJD, target.ra, target.dec, location.latitude, location.longitude);
                const dawnAlt = getAltitude(dawnJD, target.ra, target.dec, location.latitude, location.longitude);

                if (duskAlt >= minAltitude && dawnAlt >= minAltitude) {
                    // Likely up the whole time - sample to verify
                    let alwaysUp = true;
                    const steps = 12;
                    for (let i = 0; i <= steps; i++) {
                        const testJD = duskJD + (i / steps) * (dawnJD - duskJD);
                        const alt = getAltitude(testJD, target.ra, target.dec, location.latitude, location.longitude);
                        if (alt < minAltitude) {
                            alwaysUp = false;
                            break;
                        }
                    }
                    if (alwaysUp) {
                        darkHours = (dawnJD - duskJD) * 24;
                    }
                }
            }

            // Format rise/set times
            let riseTimeStr = 'N/A';
            let setTimeStr = 'N/A';

            if (isCircumpolar) {
                riseTimeStr = 'Circumpolar';
                setTimeStr = 'Circumpolar';
            } else {
                if (riseJD) {
                    riseTimeStr = this.formatLocalTime(riseJD, location.timezone, isDST);
                }
                if (setJD) {
                    setTimeStr = this.formatLocalTime(setJD, location.timezone, isDST);
                }
            }

            const targetInfo = {
                target: target,
                riseJD: riseJD || duskJD,
                setJD: setJD || dawnJD,
                riseTime: riseTimeStr,
                setTime: setTimeStr,
                darkHours: darkHours,
                isCircumpolar: isCircumpolar
            };

            if (darkHours >= minDarkHours || isCircumpolar) {
                observable.push(targetInfo);
            } else {
                notObservable.push(targetInfo);
            }
        });

        // Sort observable targets: circumpolar first, then by rise time
        observable.sort((a, b) => {
            if (a.isCircumpolar && !b.isCircumpolar) return -1;
            if (!a.isCircumpolar && b.isCircumpolar) return 1;
            return a.riseJD - b.riseJD;
        });

        // Sort not observable by rise time
        notObservable.sort((a, b) => a.riseJD - b.riseJD);

        // Store data for chart view
        this.riseTimeData = {
            observable: observable,
            notObservable: notObservable,
            duskJD: duskJD,
            dawnJD: dawnJD,
            location: location,
            isDST: isDST
        };

        // Render based on view mode
        if (this.riseTimeViewMode === 'chart') {
            this.renderRiseTimeChart();
        } else {
            this.renderRiseTimeList();
        }
    },

    /**
     * Render rise time data as a list
     */
    renderRiseTimeList() {
        this.updateToggleButtonText();
        const todoContainer = document.getElementById('todo-container');
        if (!todoContainer || !this.riseTimeData) return;

        const { observable, notObservable } = this.riseTimeData;

        let html = '';

        // Build observable targets
        if (observable.length > 0) {
            const targets = observable.map((info) => {
                const commonNames = this.getCommonNames(info.target.common);
                const typeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const typePart = typeDisplay ? ` ${typeDisplay}` : '';
                const displayName = commonNames ? `${info.target.object}${typePart} (${commonNames})` : `${info.target.object}${typePart}`;

                const isPinned = this.isTargetPinned(info.target.object);
                const pinIcon = isPinned ? '📌 ' : '';
                const pinnedClass = isPinned ? ' todo-target-pinned' : '';
                const status = this.getImagingStatus(info.target.object);
                const icon = this.IMAGING_STATUS_ICONS[status];

                return `
        <span class="todo-target-item">
            <a href="#" class="todo-target-link${pinnedClass}" data-target-id="${info.target.object}">
                ${icon}${pinIcon}${displayName} - Rise: ${info.riseTime}, Set: ${info.setTime}
            </a>
            <button class="btn-remove-todo" data-target-id="${info.target.object}">
                Remove
            </button>
        </span>
    `;
            });

            html += this.buildCard(`Observable Tonight (${observable.length})`, null, targets.join(''), true);
        }

        // Build not observable targets
        if (notObservable.length > 0) {
            const targets = notObservable.map((info) => {
                const commonNames = this.getCommonNames(info.target.common);
                const typeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const typePart = typeDisplay ? ` ${typeDisplay}` : '';
                const displayName = commonNames ? `${info.target.object}${typePart} (${commonNames})` : `${info.target.object}${typePart}`;

                const isPinned = this.isTargetPinned(info.target.object);
                const pinIcon = isPinned ? '📌 ' : '';
                const pinnedClass = isPinned ? ' todo-target-pinned' : '';
                const status = this.getImagingStatus(info.target.object);
                const icon = this.IMAGING_STATUS_ICONS[status];

                return `
        <span class="todo-target-item">
            <a href="#" class="todo-target-link${pinnedClass}" data-target-id="${info.target.object}">
                ${icon}${pinIcon}${displayName} - Rise: ${info.riseTime}, Set: ${info.setTime}
            </a>
            <button class="btn-remove-todo" data-target-id="${info.target.object}">
                Remove
            </button>
        </span>
    `;
            });

            html += this.buildCard(`Not Observable Tonight (${notObservable.length})`, null, targets.join(''), true);
        }

        todoContainer.innerHTML = html;
        this.attachEventListeners();
    },

    /**
     * Render rise time data as a Gantt chart
     */
   renderRiseTimeChart() {
        this.updateToggleButtonText();

        const todoContainer = document.getElementById('todo-container');
        if (!todoContainer || !this.riseTimeData) return;

        const { observable, duskJD, dawnJD } = this.riseTimeData;
        const minAltitude = SettingsManager.getGlobalMinAltitude();

        if (observable.length === 0) {
            todoContainer.innerHTML = `
            <div class="todo-empty-message">
                <p class="todo-empty-title">📋 No observable targets tonight</p>
                <p>No targets meet the 2-hour minimum darkness criteria.</p>
            </div>
        `;
            return;
        }

        // Add canvas
        todoContainer.innerHTML = `
        <div class="todo-rise-chart-container">
            <canvas id="todo-rise-chart"></canvas>
        </div>
    `;

        // Draw the chart
        const canvas = document.getElementById('todo-rise-chart');
        if (!canvas) {
            console.error('Canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');

        // Get container width and calculate responsive chart dimensions
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const maxChartWidth = 1000;
        const chartWidth = Math.min(containerWidth - 80, maxChartWidth); // 80px for padding

        // Chart dimensions
        const labelWidth = 0;
        const rowHeight = 40;
        const headerHeight = 60;
        const padding = 20;

        const totalWidth = labelWidth + chartWidth + padding * 2;
        const totalHeight = headerHeight + observable.length * rowHeight + padding * 2;

        // Set canvas size
        canvas.width = totalWidth;
        canvas.height = totalHeight;

        // Get CSS color values with fallbacks
        const styles = getComputedStyle(document.documentElement);
        const bgColor = styles.getPropertyValue('--card-bg').trim() || '#1a1a1a';
        const textColor = styles.getPropertyValue('--text-color').trim() || '#ffffff';
        const borderColor = styles.getPropertyValue('--border-color').trim() || '#444444';
        const accentColor = styles.getPropertyValue('--primary-color').trim() || '#3b82f6';

        // Clear and fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Get location for timezone
        const locationName = SettingsManager.getSelectedLocation();
        const location = DataManager.getLocation(locationName);
        const timezone = location ? location.timezone : 0;
        const isDST = location ? SettingsManager.isDSTActive(new Date(), location.timezone) : false;

        // Format dusk and dawn times
        const duskTime = this.formatLocalTime(duskJD, timezone, isDST);
        const dawnTime = this.formatLocalTime(dawnJD, timezone, isDST);

        // Draw header with two lines
        const chartLeft = padding + labelWidth;
        const chartRight = padding + labelWidth + chartWidth;
        const chartCenter = chartLeft + chartWidth / 2;

        ctx.fillStyle = textColor;

        // Line 1: Dusk/Dawn labels at edges
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Dusk', chartLeft + 5, padding + 15);
        ctx.textAlign = 'right';
        ctx.fillText('Dawn', chartRight - 5, padding + 15);

        // Format today's date
        const today = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', dateOptions);

        // Line 1 center: Date and minimum altitude
        ctx.font = '0.9rem sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${formattedDate}  •  Minimum altitude: ${minAltitude}°`, chartCenter, padding + 15);

        // Line 2: Astronomical twilight times
        ctx.font = '0.9rem sans-serif';
        ctx.fillText(`Astronomical dusk: ${duskTime}  •  Astronomical dawn: ${dawnTime}`, chartCenter, padding + 35);

        // Starting Y position for target rows
        const startY = padding + headerHeight;

        // Reset hit regions for click handling
        this._chartHitRegions = [];

        // Draw each target row (only observable targets)
        observable.forEach((info, index) => {
            const y = startY + index * rowHeight;

            // Calculate bar position
            const startJD = Math.max(info.riseJD, duskJD);
            const endJD = Math.min(info.setJD, dawnJD);

            if (endJD > startJD) {
                const barStartFraction = (startJD - duskJD) / (dawnJD - duskJD);
                const barEndFraction = (endJD - duskJD) / (dawnJD - duskJD);

                const barX = chartLeft + chartWidth * barStartFraction;
                const barWidth = chartWidth * (barEndFraction - barStartFraction);
                const barY = y + 5;
                const barHeight = 30;  // Increased from 20

                // Store hit region for click handling
                this._chartHitRegions.push({ x: barX, y: barY, w: barWidth, h: barHeight, targetId: info.target.object });

                // Draw bar - use gold for pinned targets
                const isPinned = this.isTargetPinned(info.target.object);
                const barColor = isPinned ? '#fbbf24' : accentColor; // Gold for pinned, blue for normal

                ctx.fillStyle = barColor;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.globalAlpha = 1.0;

                // Draw bar border
                ctx.strokeStyle = barColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);

                // Draw altitude graph inside bar
                this.drawAltitudeGraph(ctx, info.target, barX, barY, barWidth, barHeight, duskJD, dawnJD, location, isDST);

                // Draw rise/set times and target label INSIDE the bar
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px sans-serif';  // Increased from 10px

                let labelX = barX + 5; // Default: 5px from left edge

                // Show rise time if it's after dusk
                if (info.riseJD >= duskJD) {
                    ctx.textAlign = 'left';
                    ctx.fillText(info.riseTime, barX + 5, barY + 20);  // Adjusted Y position
                    labelX = barX + 5 + ctx.measureText(info.riseTime).width + 30; // 30px after rise time
                } else {
                    labelX = barX + 30; // 30px from left edge
                }

                // Draw target label with imaging status indicator
                // Draw imaging status indicator as canvas circle
                const status = this.getImagingStatus(info.target.object);
                const circleR = 7;
                const circleX = labelX + circleR;
                const circleY = barY + 16;

                ctx.beginPath();
                ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
                if (status === 'complete') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                } else if (status === 'active') {
                    // Outline the full circle
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    // Fill right half only
                    ctx.beginPath();
                    ctx.arc(circleX, circleY, circleR, -Math.PI * 0.5, Math.PI * 0.5);
                    ctx.lineTo(circleX, circleY);
                    ctx.closePath();
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                } else {
                    // Empty: outline only
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
                const statusWidth = circleR * 2 + 6;

                // Draw target label with dark backing for contrast
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'left';
                const chartTypeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const chartLabel = chartTypeDisplay
                    ? `${info.target.object} ${chartTypeDisplay}`
                    : info.target.object;
                const labelTextX = labelX + statusWidth;
                const labelTextY = barY + 20;
                const labelTextWidth = ctx.measureText(chartLabel).width;
                const backingPad = 3;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(labelTextX - backingPad, labelTextY - 13, labelTextWidth + backingPad * 2, 16);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(chartLabel, labelTextX, labelTextY);

                // Show set time if it's before dawn (right-aligned)
                if (info.setJD <= dawnJD) {
                    ctx.font = '12px sans-serif';  // Increased from 10px
                    ctx.textAlign = 'right';
                    ctx.fillText(info.setTime, barX + barWidth - 5, barY + 20);  // Adjusted Y position
                }
            }

            // Draw row separator
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(padding, y + rowHeight);
            ctx.lineTo(totalWidth - padding, y + rowHeight);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });

        // Attach canvas click handler
        if (this._canvasClickHandler) {
            canvas.removeEventListener('click', this._canvasClickHandler);
        }
        this._canvasClickHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;
            const hit = this._chartHitRegions.find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
            if (hit) this.selectTarget(hit.targetId);
        };
        canvas.addEventListener('click', this._canvasClickHandler);
    },

    /**
     * Render a unified Gantt chart for Type or Best Month views.
     * @param {Array} rows - Array of { isLabel, label } or { isLabel, target } objects
     */
    renderGroupedChart(rows) {
        this.updateToggleButtonText();

        const todoContainer = document.getElementById('todo-container');
        if (!todoContainer || !this.riseTimeData) {
            todoContainer.innerHTML = `
                <div class="todo-empty-message">
                    <p class="todo-empty-title">⚠️ Rise time data not available</p>
                    <p>Switch to Rise Time sort first to load tonight's data, then switch back.</p>
                </div>
            `;
            return;
        }

        const { duskJD, dawnJD, location, isDST } = this.riseTimeData;
        const minAltitude = SettingsManager.getGlobalMinAltitude();

        // Filter rows to only include label rows and observable targets
        const observableObjects = new Set(this.riseTimeData.observable.map(o => o.target.object));
        const filteredRows = rows.filter(row => row.isLabel || observableObjects.has(row.target.object));

        // Drop label rows that have no observable targets after them
        const cleanRows = [];
        for (let i = 0; i < filteredRows.length; i++) {
            const row = filteredRows[i];
            if (row.isLabel) {
                const nextTarget = filteredRows.slice(i + 1).find(r => !r.isLabel);
                const nextLabel = filteredRows.slice(i + 1).find(r => r.isLabel);
                if (nextTarget && (!nextLabel || filteredRows.indexOf(nextTarget) < filteredRows.indexOf(nextLabel))) {
                    cleanRows.push(row);
                }
            } else {
                cleanRows.push(row);
            }
        }

        if (cleanRows.filter(r => !r.isLabel).length === 0) {
            todoContainer.innerHTML = `
                <div class="todo-empty-message">
                    <p class="todo-empty-title">📋 No observable targets tonight</p>
                    <p>No targets meet the minimum altitude criteria.</p>
                </div>
            `;
            return;
        }

        // Add canvas
        todoContainer.innerHTML = `
            <div class="todo-rise-chart-container">
                <canvas id="todo-rise-chart"></canvas>
            </div>
        `;

        const canvas = document.getElementById('todo-rise-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const maxChartWidth = 1000;
        const chartWidth = Math.min(containerWidth - 80, maxChartWidth);

        const rowHeight = 40;
        const labelRowHeight = 24;
        const headerHeight = 60;
        const padding = 20;

        // Calculate total height accounting for label rows being shorter
        const totalHeight = headerHeight + padding * 2 +
              cleanRows.reduce((h, row) => h + (row.isLabel ? labelRowHeight : rowHeight), 0);
        const totalWidth = chartWidth + padding * 2;

        canvas.width = totalWidth;
        canvas.height = totalHeight;

        const styles = getComputedStyle(document.documentElement);
        const bgColor = styles.getPropertyValue('--card-bg').trim() || '#1a1a1a';
        const textColor = styles.getPropertyValue('--text-color').trim() || '#ffffff';
        const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#888888';
        const borderColor = styles.getPropertyValue('--border-color').trim() || '#444444';
        const accentColor = styles.getPropertyValue('--primary-color').trim() || '#3b82f6';

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        const timezone = location ? location.timezone : 0;
        const duskTime = this.formatLocalTime(duskJD, timezone, isDST);
        const dawnTime = this.formatLocalTime(dawnJD, timezone, isDST);

        const chartLeft = padding;
        const chartRight = padding + chartWidth;
        const chartCenter = chartLeft + chartWidth / 2;

        // Header
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Dusk', chartLeft + 5, padding + 15);
        ctx.textAlign = 'right';
        ctx.fillText('Dawn', chartRight - 5, padding + 15);

        const today = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', dateOptions);

        ctx.font = '0.9rem sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${formattedDate}  •  Minimum altitude: ${minAltitude}°`, chartCenter, padding + 15);
        ctx.fillText(`Astronomical dusk: ${duskTime}  •  Astronomical dawn: ${dawnTime}`, chartCenter, padding + 35);

        // Reset hit regions for click handling
        this._chartHitRegions = [];

        // Draw rows
        let currentY = padding + headerHeight;

        cleanRows.forEach(row => {
            if (row.isLabel) {
                // Label row — just text, no bar
                ctx.fillStyle = textSecondary;
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(row.label.toUpperCase(), chartLeft + 5, currentY + 18);
                currentY += labelRowHeight;
                return;
            }

            // Target row — find rise time data
            const info = this.riseTimeData.observable.find(o => o.target.object === row.target.object);
            if (!info) { currentY += rowHeight; return; }

            const y = currentY;
            const startJD = Math.max(info.riseJD, duskJD);
            const endJD = Math.min(info.setJD, dawnJD);

            if (endJD > startJD) {
                const barStartFraction = (startJD - duskJD) / (dawnJD - duskJD);
                const barEndFraction = (endJD - duskJD) / (dawnJD - duskJD);
                const barX = chartLeft + chartWidth * barStartFraction;
                const barWidth = chartWidth * (barEndFraction - barStartFraction);
                const barY = y + 5;
                const barHeight = 30;

                // Store hit region for click handling
                this._chartHitRegions.push({ x: barX, y: barY, w: barWidth, h: barHeight, targetId: info.target.object });

                const isPinned = this.isTargetPinned(info.target.object);
                const barColor = isPinned ? '#fbbf24' : accentColor;

                ctx.fillStyle = barColor;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.globalAlpha = 1.0;

                ctx.strokeStyle = barColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);

                // Draw altitude graph inside bar
                this.drawAltitudeGraph(ctx, info.target, barX, barY, barWidth, barHeight, duskJD, dawnJD, location, isDST);

                ctx.fillStyle = '#ffffff';
                ctx.font = '12px sans-serif';

                let labelX = barX + 5;
                if (info.riseJD >= duskJD) {
                    ctx.textAlign = 'left';
                    ctx.fillText(info.riseTime, barX + 5, barY + 20);
                    labelX = barX + 5 + ctx.measureText(info.riseTime).width + 30;
                } else {
                    labelX = barX + 30;
                }

                // Draw imaging status indicator as canvas circle
                const status = this.getImagingStatus(info.target.object);
                const circleR = 7;
                const circleX = labelX + circleR;
                const circleY = barY + 16;

                ctx.beginPath();
                ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
                if (status === 'complete') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                } else if (status === 'active') {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(circleX, circleY, circleR, -Math.PI * 0.5, Math.PI * 0.5);
                    ctx.lineTo(circleX, circleY);
                    ctx.closePath();
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                } else {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
                const statusWidth = circleR * 2 + 6;

                // Draw target label with dark backing for contrast
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'left';
                const chartTypeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const chartLabel = chartTypeDisplay
                    ? `${info.target.object} ${chartTypeDisplay}`
                    : info.target.object;
                const labelTextX = labelX + statusWidth;
                const labelTextY = barY + 20;
                const labelTextWidth = ctx.measureText(chartLabel).width;
                const backingPad = 3;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(labelTextX - backingPad, labelTextY - 13, labelTextWidth + backingPad * 2, 16);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(chartLabel, labelTextX, labelTextY);

                if (info.setJD <= dawnJD) {
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(info.setTime, barX + barWidth - 5, barY + 20);
                }
            }

            // Row separator
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(padding, y + rowHeight);
            ctx.lineTo(totalWidth - padding, y + rowHeight);
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            currentY += rowHeight;
        });

        // Attach canvas click handler
        if (this._canvasClickHandler) {
            canvas.removeEventListener('click', this._canvasClickHandler);
        }
        this._canvasClickHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;
            const hit = this._chartHitRegions.find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
            if (hit) this.selectTarget(hit.targetId);
        };
        canvas.addEventListener('click', this._canvasClickHandler);
    },

    /**
     * Draw altitude graph inside a chart bar for a target.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} target - target object with ra, dec
     * @param {number} barX - left edge of bar in canvas pixels
     * @param {number} barY - top edge of bar in canvas pixels
     * @param {number} barWidth - width of bar in canvas pixels
     * @param {number} barHeight - height of bar in canvas pixels
     * @param {number} duskJD - start of window (JD)
     * @param {number} dawnJD - end of window (JD)
     * @param {Object} location - location object with latitude, longitude
     * @param {boolean} isDST
     */
    drawAltitudeGraph(ctx, target, barX, barY, barWidth, barHeight, duskJD, dawnJD, location, isDST) {
        const samplePoints = APP_CONFIG.TODO_ALTITUDE_SAMPLE_POINTS;
        const style = APP_CONFIG.TODO_ALTITUDE_GRAPH_STYLE;
        const alpha = APP_CONFIG.TODO_ALTITUDE_GRAPH_ALPHA;
        const lineWidth = APP_CONFIG.TODO_ALTITUDE_GRAPH_LINE_WIDTH;

        const cssStyles = getComputedStyle(document.documentElement);
        const graphColor = cssStyles.getPropertyValue('--todo-altitude-graph-color').trim() || 'rgba(255,255,255,0.35)';

        // Sample altitude across dusk-dawn window
        const points = [];
        for (let i = 0; i <= samplePoints; i++) {
            const jd = duskJD + (i / samplePoints) * (dawnJD - duskJD);
            const alt = getAltitude(jd, target.ra, target.dec, location.latitude, location.longitude);
            // Map alt 0-90 to bar coordinates (bottom to top of bar)
            const clampedAlt = Math.max(0, Math.min(90, alt));
            const px = barX + (i / samplePoints) * barWidth;
            const py = barY + barHeight - (clampedAlt / 90) * barHeight;
            points.push({ px, py });
        }

        ctx.save();
        // Clip to bar bounds so graph doesn't bleed outside
        ctx.beginPath();
        ctx.rect(barX, barY, barWidth, barHeight);
        ctx.clip();

        ctx.globalAlpha = alpha;

        if (style === 'fill') {
            ctx.beginPath();
            ctx.moveTo(points[0].px, barY + barHeight);
            points.forEach(p => ctx.lineTo(p.px, p.py));
            ctx.lineTo(points[points.length - 1].px, barY + barHeight);
            ctx.closePath();
            ctx.fillStyle = graphColor;
            ctx.fill();
            // Outline — fully opaque for contrast
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            points.forEach((p, i) => i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
            ctx.strokeStyle = graphColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        } else {
            ctx.beginPath();
            points.forEach((p, i) => i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
            ctx.strokeStyle = graphColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }

        ctx.restore();
    },

    /**
     * Format JD as local time string (HH:MM)
     */
    formatLocalTime(jd, timezone, isDST) {
        const utcDate = jdToDate(jd);
        const offsetHours = isDST ? timezone + 1 : timezone;
        const localDate = new Date(utcDate.getTime() + offsetHours * 3600000);

        const hours = localDate.getUTCHours().toString().padStart(2, '0');
        const minutes = localDate.getUTCMinutes().toString().padStart(2, '0');

        return `${hours}:${minutes}`;
    },


    /**
     * Attach event listener to chart toggle button
     */
    attachChartToggle() {
        const toggleBtn = document.getElementById('toggle-rise-chart');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.riseTimeViewMode = this.riseTimeViewMode === 'list' ? 'chart' : 'list';
                this.updateToggleButton();
                this.renderToDoList();
            });
        }
    },


    /**
     * Build a card for a group of targets
     */
    buildCard(title, targets, customContent = null, showType = false) {
        let content;

        if (customContent) {
            // Use provided HTML content (for rise time view)
            content = customContent;
        } else {
            // Generate from targets array (for type/month views)
            content = targets.map((target) => {
                const commonNames = this.getCommonNames(target.common);
                const typeDisplay = showType ? (OBJECT_TYPES[target.type] || target.type || '') : '';
                const typePart = typeDisplay ? ` ${typeDisplay}` : '';
                const displayName = commonNames ? `${target.object}${typePart} (${commonNames})` : `${target.object}${typePart}`;
                const status = this.getImagingStatus(target.object);
                const icon = this.IMAGING_STATUS_ICONS[status];
                const isPinned = this.isTargetPinned(target.object);
                const pinIcon = isPinned ? '📌 ' : '';
                const pinnedClass = isPinned ? ' todo-target-pinned' : '';

                return `
                    <span class="todo-target-item">
                        <a href="#" class="todo-target-link${pinnedClass}" data-target-id="${target.object}">
                            ${icon}${pinIcon}${displayName}
                        </a>
                        <button class="btn-remove-todo" data-target-id="${target.object}">
                            Remove
                        </button>
                    </span>
                `;
            }).join('');
        }

        return `
            <div class="todo-type-card">
                <h3>${title}</h3>
                <div class="todo-targets">
                    ${content}
                </div>
            </div>
        `;
    },

    /**
     * Get empty list message
     */
    getEmptyMessage() {
        return `
            <div class="todo-empty-message">
                <p class="todo-empty-title">📋 Your To Do List is empty</p>
                <p>Add targets from the Target Selection view to start building your imaging list.</p>
            </div>
        `;
    },

    /**
     * Get first two common names
     */
    getCommonNames(commonField) {
        if (!commonField) return '';

        const names = commonField.split(',').map(n => n.trim());
        if (names.length <= 2) {
            return names.join(', ');
        }
        return names.slice(0, 2).join(', ');
    },

    /**
     * Update toggle button text based on current view mode
     */
    updateToggleButtonText() {
        const toggleBtn = document.getElementById('toggle-rise-chart');
        if (toggleBtn) {
            toggleBtn.textContent = this.riseTimeViewMode === 'list' ? '📊 Chart' : '📝 List';
        }
    },

    /**
     * Set the current target — shared by list link clicks and canvas bar clicks
     * @param {string} targetId
     */
    selectTarget(targetId) {
        const target = DataManager.getTargets().find(t => t.object === targetId);
        if (target) {
            localStorage.setItem('lastSelectedTarget', JSON.stringify(target));
            if (typeof VisibilityTargets !== 'undefined') {
                VisibilityTargets.currentTarget = target;
            }
            if (typeof DailyVisibilityCalculations !== 'undefined') {
                DailyVisibilityCalculations.currentTarget = target;
            }
            if (typeof YearlyObservabilityCalculations !== 'undefined') {
                YearlyObservabilityCalculations.currentTarget = target;
            }
            UIManager.updateSidebarCurrentTarget(target.object);
            UIManager.openObjectDetailModal(target);
        }
    },

    /**
     * Attach event listeners to target links and remove buttons
     */
    attachEventListeners() {
        // Target links
        document.querySelectorAll('.todo-target-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectTarget(link.dataset.targetId);
            });
        });

        // Remove buttons
        document.querySelectorAll('.btn-remove-todo').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetId = btn.dataset.targetId;
                await ToDoManager.removeFromToDoList(targetId);
                UIManager.showToast(`Removed ${targetId} from To Do List`, 'success');
            });
        });
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._todoUpdatedHandler) {
            document.removeEventListener('todo-list-updated', this._todoUpdatedHandler);
            this._todoUpdatedHandler = null;
        }
    },

    // -------------------------------------------------------------------------
    // Imaging status (issue #143)
    // -------------------------------------------------------------------------

    // SVG circle icons for imaging status
    IMAGING_STATUS_ICONS: {
        none:     '<svg width="16" height="16" viewBox="0 0 12 12" style="vertical-align:middle;margin-right:4px"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
        active:   '<svg width="16" height="16" viewBox="0 0 12 12" style="vertical-align:middle;margin-right:4px"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 1 A5 5 0 0 1 6 11 Z" fill="currentColor"/></svg>',
        complete: '<svg width="16" height="16" viewBox="0 0 12 12" style="vertical-align:middle;margin-right:4px"><circle cx="6" cy="6" r="5" fill="currentColor" stroke="currentColor" stroke-width="1.5"/></svg>'
    },

    /**
     * Get imaging status for a target object name.
     * Returns 'complete', 'active', or 'none'.
     * Requires _imagingProjects to be loaded via loadImagingProjects().
     */
    getImagingStatus(targetObject) {
        if (!this._imagingProjects || this._imagingProjects.length === 0) return 'none';
        const matches = this._imagingProjects.filter(p =>
            p.targetDesignations && p.targetDesignations.some(d => d === targetObject)
        );
        if (matches.length === 0) return 'none';
        if (matches.some(p => p.status === 'Completed')) return 'complete';
        return 'active';
    },

    /**
     * Load imaging projects into cache for status lookups.
     * Call once per render cycle.
     */
    async loadImagingProjects() {
        try {
            this._imagingProjects = await ImagingLogManager.getAllProjects();
        } catch (e) {
            this._imagingProjects = [];
        }
    }

};
