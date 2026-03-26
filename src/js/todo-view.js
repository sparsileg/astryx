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
                    this.riseTimeViewMode = 'list';
                    this.updateToggleButton();
                    this.renderToDoList();
                }
            });
        }

        this.updateToggleButton();

        if (this.currentSort === 'rise') {
            this.attachChartToggle();
        }
    },

    /**
     * Show or hide the chart toggle button based on current sort
     */
    updateToggleButton() {
        const toggleBtn = document.getElementById('toggle-rise-chart');
        if (!toggleBtn) return;
        toggleBtn.style.visibility = this.currentSort === 'rise' ? 'visible' : 'hidden';
        toggleBtn.textContent = this.riseTimeViewMode === 'list' ? '📊 Chart' : '📝 List';
    },

    /**
     * Render the To Do list (delegates to appropriate method based on sort)
     */
    renderToDoList() {
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

        // Add "Not observable" card if needed
        if (groupedByMonth['none'].length > 0) {
            const notObsName = `Not Observable (${groupedByMonth['none'].length})`;
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
            const targets = observable.map((info, index) => {
                const commonNames = this.getCommonNames(info.target.common);
                const typeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const typePart = typeDisplay ? ` ${typeDisplay}` : '';
                const displayName = commonNames ? `${info.target.object}${typePart} (${commonNames})` : `${info.target.object}${typePart}`;

                // Check if pinned
                const isPinned = this.isTargetPinned(info.target.object);
                const pinIcon = isPinned ? '📌 ' : '';
                const pinnedClass = isPinned ? ' todo-target-pinned' : '';

                return `
        <span class="todo-target-item">
            <a href="#" class="todo-target-link${pinnedClass}" data-target-id="${info.target.object}">
                ${pinIcon}${displayName} - Rise: ${info.riseTime}, Set: ${info.setTime}
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
            const targets = notObservable.map((info, index) => {
                const commonNames = this.getCommonNames(info.target.common);
                const typeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const typePart = typeDisplay ? ` ${typeDisplay}` : '';
                const displayName = commonNames ? `${info.target.object}${typePart} (${commonNames})` : `${info.target.object}${typePart}`;

                // Check if pinned
                const isPinned = this.isTargetPinned(info.target.object);
                const pinIcon = isPinned ? '📌 ' : '';
                const pinnedClass = isPinned ? ' todo-target-pinned' : '';

                return `
        <span class="todo-target-item">
            <a href="#" class="todo-target-link${pinnedClass}" data-target-id="${info.target.object}">
                ${pinIcon}${displayName} - Rise: ${info.riseTime}, Set: ${info.setTime}
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

                // Draw target label
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'left';
                const chartTypeDisplay = OBJECT_TYPES[info.target.type] || info.target.type || '';
                const chartLabel = chartTypeDisplay ? `${info.target.object} ${chartTypeDisplay}` : info.target.object;
                ctx.fillText(chartLabel, labelX, barY + 20);

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
                this.renderByRiseTime();
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
            content = targets.map((target, index) => {
                const commonNames = this.getCommonNames(target.common);
                const typeDisplay = showType ? (OBJECT_TYPES[target.type] || target.type || '') : '';
                const typePart = typeDisplay ? ` ${typeDisplay}` : '';
                const displayName = commonNames ? `${target.object}${typePart} (${commonNames})` : `${target.object}${typePart}`;
                const comma = index < targets.length - 1 ? ',' : '';

                return `
                    <span class="todo-target-item">
                        <a href="#" class="todo-target-link" data-target-id="${target.object}">
                            ${displayName}
                        </a>
                        <button class="btn-remove-todo" data-target-id="${target.object}">
                            Remove
                        </button>${comma}
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
     * Attach event listeners to target links and remove buttons
     */
    attachEventListeners() {
        // Target links
        document.querySelectorAll('.todo-target-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.dataset.targetId;
                const target = DataManager.getTargets().find(t => t.object === targetId);
                if (target) {
                    // Save as last selected target (for when user navigates to Target Selection)
                    localStorage.setItem('lastSelectedTarget', JSON.stringify(target));
                    // Update current target for all analysis tools — Issue #79
                    if (typeof VisibilityTargets !== 'undefined') {
                        VisibilityTargets.currentTarget = target;
                    }
                    if (typeof DailyVisibilityCalculations !== 'undefined') {
                        DailyVisibilityCalculations.currentTarget = target;
                    }
                    if (typeof YearlyObservabilityCalculations !== 'undefined') {
                        YearlyObservabilityCalculations.currentTarget = target;
                    }
                    if (typeof YearlyObservabilityCalculations !== 'undefined') {
                        YearlyObservabilityCalculations.currentTarget = target;
                    }
                    // Update sidebar current target display — Issue #79
                    UIManager.updateSidebarCurrentTarget(target.object);
                    UIManager.openObjectDetailModal(target);
                }
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
    }
};
