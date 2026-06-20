/**
 * optimizer-view.js
 * Target Optimizer view controller and UI
 */

const OptimizerView = {

    // In-memory pool from Filter Targets "Send to Optimizer"
    filterTargetsPool: null,

    // Current display mode: 'individual' or 'combinations'
    displayMode: 'individual',

    // Stored combinations
    currentCombos: null,

    // Session parameters for coverage calculation
    currentSession: null,

    // Stored results for persistence across navigation
    currentResults: null,
    totalEvaluated: 0,

    /**
     * Initialize Target Optimizer view
     */
    init() {
        console.log('Initializing Target Optimizer view');

        // Set default date to today
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        document.getElementById('optimizer-date').value = `${year}-${month}-${day}`;

        this.updateFilterSourceOption();
        this.attachEventHandlers();

        // Re-render results if we have them from a previous run
        if (this.currentResults && this.currentResults.length > 0) {
            if (this.displayMode === 'combinations' && this.currentCombos) {
                this.renderCombinations(this.currentCombos);
            } else {
                this.renderResults(this.currentResults, this.totalEvaluated);
            }
        }

        console.log('Target Optimizer initialized');
    },

    /**
     * Update the Filter Targets source option based on whether a pool is loaded
     */
    updateFilterSourceOption() {
        const filterItem = document.getElementById('optimizer-source-filter');
        if (!filterItem) return;

        if (this.filterTargetsPool && this.filterTargetsPool.length > 0) {
            filterItem.style.opacity = '1';
            filterItem.style.pointerEvents = 'auto';
            filterItem.textContent = `Filter Targets (${this.filterTargetsPool.length} targets)`;
        } else {
            filterItem.style.opacity = '0.4';
            filterItem.style.pointerEvents = 'none';
            filterItem.textContent = 'Filter Targets (none loaded)';
        }
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        // Start time dropdown
        const startTrigger = document.getElementById('optimizer-start-trigger');
        const startDropdown = document.getElementById('optimizer-start-dropdown');
        const startMenu = document.getElementById('optimizer-start-menu');
        const customTimeInput = document.getElementById('optimizer-custom-time');

        if (startTrigger && startDropdown && startMenu) {
            startTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                startDropdown.classList.toggle('open');
                document.getElementById('optimizer-source-dropdown')?.classList.remove('open');
            });
            startMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.target-filter-dropdown-item');
                if (!item) return;
                const value = item.dataset.value;
                const label = document.getElementById('optimizer-start-label');
                if (label) label.textContent = item.textContent;
                startDropdown.classList.remove('open');
                if (customTimeInput) {
                    if (value === 'custom') {
                        customTimeInput.style.opacity = '1';
                        customTimeInput.style.pointerEvents = 'auto';
                    } else {
                        customTimeInput.style.opacity = '0';
                        customTimeInput.style.pointerEvents = 'none';
                    }
                }
            });
        }

        // Source dropdown
        const sourceTrigger = document.getElementById('optimizer-source-trigger');
        const sourceDropdown = document.getElementById('optimizer-source-dropdown');
        const sourceMenu = document.getElementById('optimizer-source-menu');

        if (sourceTrigger && sourceDropdown && sourceMenu) {
            sourceTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                sourceDropdown.classList.toggle('open');
                document.getElementById('optimizer-start-dropdown')?.classList.remove('open');
            });
            sourceMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.target-filter-dropdown-item');
                if (!item || item.style.pointerEvents === 'none') return;
                const label = document.getElementById('optimizer-source-label');
                if (label) label.textContent = item.textContent;
                sourceDropdown.classList.remove('open');
            });
        }

        // Execute button
        const executeBtn = document.getElementById('optimizer-execute-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                this.execute();
            });
        }
    },

    /**
     * Execute optimization
     */
    execute() {
        const date = document.getElementById('optimizer-date').value;
        const sourceLabel = document.getElementById('optimizer-source-label')?.textContent;
        const source = sourceLabel === 'Filter Targets' || sourceLabel?.startsWith('Filter Targets') ? 'filter' : 'todo';
        const startLabel = document.getElementById('optimizer-start-label')?.textContent;
        const startTimeMode = startLabel === 'Custom' ? 'custom' : 'dusk';
        const customStartTime = document.getElementById('optimizer-custom-time').value;

        if (!date) {
            UIManager.showToast('Please select a date', 'error');
            return;
        }

        const locationName = SettingsManager.getSelectedLocation();
        if (!locationName) {
            UIManager.showToast('No location selected. Please set a location in settings.', 'error');
            return;
        }

        const location = DataManager.getLocations()[locationName];
        if (!location) {
            UIManager.showToast('Location data not found.', 'error');
            return;
        }

        // Calculate dusk/dawn for the session
        const timing = SeqPlanCalculations.calculateSessionTiming(date, location);
        if (!timing) {
            UIManager.showToast('No astronomical night at this location/date', 'error');
            return;
        }

        // Determine session start JD
        let sessionStartJD = timing.duskJD;
        if (startTimeMode === 'custom' && customStartTime) {
            const dateParts = date.split('-');
            const customDate = new Date(
                parseInt(dateParts[0]),
                parseInt(dateParts[1]) - 1,
                parseInt(dateParts[2]),
                parseInt(customStartTime.split(':')[0]),
                parseInt(customStartTime.split(':')[1]),
                0
            );
            sessionStartJD = dateToJD(customDate);
        }

        const session = {
            date,
            location,
            minAltitude: SettingsManager.getGlobalMinAltitude(),
            sessionStartJD,
            sessionEndJD: timing.dawnJD
        };

        // Assemble candidate pool
        const candidates = OptimizerCalculations.assembleCandidatePool(source);
        if (candidates.length === 0) {
            UIManager.showToast('No candidates found in selected source', 'warning');
            return;
        }

        // Score candidates
        const results = OptimizerCalculations.scoreCandidates(candidates, session);
        if (results.length === 0) {
            UIManager.showToast('No targets meet minimum visibility requirements', 'warning');
            return;
        }

        // Store total evaluated count for display
        this.totalEvaluated = candidates.length;

        // Store session for combination coverage calculation
        this.currentSession = session;

        // Render results
        this.renderResults(results, this.totalEvaluated);
    },

    /**
     * Render scored results into #optimizer-results
     * @param {Array} results - Scored candidate array from scoreCandidates
     * @param {number} totalEvaluated - Total candidates evaluated
     */
    renderResults(results, totalEvaluated) {
        const container = document.getElementById('optimizer-results');
        if (!container) return;

        // Store results for pruning
        this.currentResults = results.slice();

        // elimination counts now tracked in results._eliminationCounts

        const showToggle = APP_CONFIG.FEATURES.OPTIMIZER_COMBINATIONS;

        let html = `
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>Suggested Targets</h3>
                    ${showToggle ? `
                    <div class="optimizer-mode-toggle">
                        <button class="btn-sm optimizer-mode-btn ${this.displayMode !== 'combinations' ? 'btn-primary' : 'btn-secondary'}" data-mode="individual">Individual Targets</button>
                        <button class="btn-sm optimizer-mode-btn ${this.displayMode === 'combinations' ? 'btn-primary' : 'btn-secondary'}" data-mode="combinations">Best Combinations</button>
                    </div>` : ''}
                </div>
                <div class="card-body">
                    <div class="optimizer-results-summary">
                        <span>Showing ${results.length} of ${totalEvaluated} evaluated</span>
                        ${(() => {
                            const counts = results._eliminationCounts || {};
                            const parts = Object.entries(counts).map(([reason, count]) => `${count} ${reason.toLowerCase()}`);
                            return parts.length > 0
                                ? `<span style="color: var(--text-secondary); font-size: 0.85rem;">${parts.join(' &bull; ')}</span>`
                                : '';
                        })()}
                    </div>
                    <div id="optimizer-candidate-list">
        `;

        results.forEach((target, index) => {
            const windowStart = jdToDate(target.windowStartJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const windowEnd   = jdToDate(target.windowEndJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const peakTime    = jdToDate(target.peakJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const typeDisplay = OBJECT_TYPES?.[target.type] || target.type || 'Unknown';
            const sizeDisplay = target.sizeMax ? `${target.sizeMax}'` : '—';
            const commonDisplay = target.common ? target.common.split(',')[0].trim() : '';

            html += `
                <div class="optimizer-candidate-card" id="optimizer-card-${index}" data-index="${index}">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; min-width: 2rem;">
                        <div class="optimizer-candidate-rank">${index + 1}</div>
                        <button class="optimizer-remove-btn" data-index="${index}" title="Remove from list" style="margin-left: 0.35rem;">✕</button>
                    </div>
                    <div class="optimizer-candidate-body">
                        <div class="optimizer-candidate-line1" style="justify-content: space-between;">
                            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: baseline;">
                                <span class="opt-name">${target.name}</span>
                                ${commonDisplay ? `<span class="opt-sep">·</span><span class="opt-meta">${commonDisplay}</span>` : ''}
                                <span class="opt-sep">·</span><span class="opt-meta">${typeDisplay}</span>
                                <span class="opt-sep">·</span><span class="opt-meta">Min/Max Size: ${target.sizeMin ? target.sizeMin + "'" : '—'}/${target.sizeMax ? target.sizeMax + "'" : '—'}</span>
                            </div>
                            <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
                                <button class="btn-primary btn-sm optimizer-dv-btn" data-index="${index}" title="View Daily Visibility">Daily Visibility</button>
                                <button class="btn-primary btn-sm optimizer-pin-card-btn" data-index="${index}" title="Add to Pinned Targets">📌 Pin</button>
                            </div>
                        </div>
                        <div class="optimizer-candidate-line1">
                            <span class="opt-meta">Window: ${windowStart} – ${windowEnd} (${target.windowHours.toFixed(1)}h)</span>
                            <span class="opt-sep">·</span><span class="opt-meta">Peak: ${target.peakAltitude.toFixed(1)}° at ${peakTime}</span>
                            <span class="opt-sep">·</span><span class="opt-meta">Moon: ${target.moonSeparation.toFixed(0)}°</span>
                        </div>
                        <div class="optimizer-score-area">
                            <div class="optimizer-score-left">
                                <div class="optimizer-score-values">
                                    <span>${target.scores.window}</span>
                                    <span>${target.scores.altitude}</span>
                                    <span>${target.scores.centering}</span>
                                    <span>${target.scores.moon}</span>
                                </div>
                                <div class="optimizer-score-labels">
                                    <span>Window</span>
                                    <span>Altitude</span>
                                    <span>Centering</span>
                                    <span>Moon</span>
                                </div>
                                <div class="optimizer-composite-line">Composite Score: <strong>${target.scores.composite}</strong></div>
                            </div>
                            <!-- STUB: thumbnail image placeholder - future implementation -->
                            <div class="optimizer-thumbnail-stub" style="display:none;">IMG<br>future</div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Attach remove button listeners
        container.querySelectorAll('.optimizer-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.removeCandidate(index);
            });
        });

        // Attach daily visibility button listeners
        container.querySelectorAll('.optimizer-dv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.viewDailyVisibility(index);
            });
        });

        // Attach per-card pin button listeners
        container.querySelectorAll('.optimizer-pin-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.pinCandidate(index);
            });
        });

        // Attach mode toggle listeners
        container.querySelectorAll('.optimizer-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.displayMode = mode;
                if (mode === 'combinations') {
                    const combos = OptimizerCalculations.generateCombinations(this.currentResults);
                    this.currentCombos = combos;
                    this.renderCombinations(combos);
                } else {
                    this.renderResults(this.currentResults, this.totalEvaluated);
                }
            });
        });
    },

    /**
     * Render combination results into #optimizer-results
     * @param {Object} combos - { singles, pairs, triplets } from generateCombinations()
     */
    renderCombinations(combos) {
        const container = document.getElementById('optimizer-results');
        if (!container) return;

        const allCombos = [
            ...combos.singles,
            ...combos.pairs,
            ...combos.triplets
        ];

        const nightHours = ((this.currentSession.sessionEndJD - this.currentSession.sessionStartJD) * 24).toFixed(1);

        let html = `
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>Best Combinations</h3>
                    <div class="optimizer-mode-toggle">
                        <button class="btn-sm optimizer-mode-btn btn-secondary" data-mode="individual">Individual Targets</button>
                        <button class="btn-sm optimizer-mode-btn btn-primary" data-mode="combinations">Best Combinations</button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="optimizer-combo-list">
        `;

        const sections = [
            { label: 'Solo Targets', items: combos.singles },
            { label: 'Pairs',        items: combos.pairs },
            { label: 'Triplets',     items: combos.triplets }
        ];

        sections.forEach(section => {
            html += `<div class="optimizer-combo-section-header">${section.label}</div>`;

            section.items.forEach((combo, index) => {
                const globalIndex = allCombos.indexOf(combo);

                // Union of windows: span from earliest start to latest end
                const unionStartJD = Math.min(...combo.targets.map(t => t.windowStartJD));
                const unionEndJD   = Math.max(...combo.targets.map(t => t.windowEndJD));
                const unionHours   = ((unionEndJD - unionStartJD) * 24).toFixed(1);

                let targetsHtml = '';
                combo.targets.forEach(t => {
                    const windowStart = jdToDate(t.windowStartJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
                    const windowEnd   = jdToDate(t.windowEndJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
                    const commonDisplay = t.common ? t.common.split(',')[0].trim() : '';
                    targetsHtml += `
                        <div class="optimizer-combo-target">
                            <span class="opt-name">${t.name}</span>
                            ${commonDisplay ? `<span class="opt-sep">·</span><span class="opt-meta">${commonDisplay}</span>` : ''}
                            <span class="opt-sep">·</span><span class="opt-meta">Window: ${windowStart} – ${windowEnd} (${t.windowHours.toFixed(1)}h)</span>
                            <span class="opt-sep">·</span><span class="opt-meta">Peak: ${t.peakAltitude.toFixed(1)}°</span>
                            <span class="opt-sep">·</span><span class="opt-meta">Score: ${t.scores.composite}</span>
                        </div>
                    `;
                });

                html += `
                    <div class="optimizer-candidate-card" id="optimizer-combo-${globalIndex}" data-index="${globalIndex}">
                        <div class="optimizer-candidate-rank">${index + 1}</div>
                        <div class="optimizer-candidate-body">
                            <div class="optimizer-candidate-line1" style="justify-content: space-between;">
                                <div style="display: flex; gap: 0.5rem; align-items: baseline;">
                                    <span class="opt-meta">Coverage: ${unionHours}h / ${nightHours}h</span>
                                    <span class="opt-sep">·</span>
                                    <span class="opt-meta">Avg score: ${combo.comboScore.toFixed(0)}</span>
                                </div>
                                <button class="btn-primary btn-sm optimizer-replace-btn" data-index="${globalIndex}" style="flex-shrink: 0;">Replace Pinned Targets</button>
                            </div>
                            <div class="optimizer-combo-targets">
                                ${targetsHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Attach mode toggle listeners
        container.querySelectorAll('.optimizer-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.displayMode = mode;
                if (mode === 'individual') {
                    this.renderResults(this.currentResults, this.totalEvaluated);
                }
            });
        });

        // Attach replace pinned targets listeners
        container.querySelectorAll('.optimizer-replace-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.replacePinnedTargets(index);
            });
        });
    },

    /**
     * Placeholder for combinations view - Phase 2/3
     */
    renderCombinationsPlaceholder() {
        const container = document.getElementById('optimizer-results');
        if (!container) return;

        container.innerHTML = `
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>Suggested Targets</h3>
                    <div class="optimizer-mode-toggle">
                        <button class="btn-sm optimizer-mode-btn btn-secondary" data-mode="individual">Individual Targets</button>
                        <button class="btn-sm optimizer-mode-btn btn-primary" data-mode="combinations">Best Combinations</button>
                    </div>
                </div>
                <div class="card-body">
                    <p style="color: var(--text-secondary); text-align: center; padding: 2rem;">
                        Best Combinations coming in next phase.
                    </p>
                </div>
            </div>
        `;

        container.querySelectorAll('.optimizer-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.displayMode = mode;
                if (mode === 'individual') {
                    this.renderResults(this.currentResults, this.totalEvaluated);
                }
            });
        });
    },

    /**
     * Replace all pinned targets with the targets from a combo
     * @param {number} index - Index in this.currentCombos
     */
    async replacePinnedTargets(index) {
        const allCombos = [
            ...this.currentCombos.singles,
            ...this.currentCombos.pairs,
            ...this.currentCombos.triplets
        ];
        const combo = allCombos[index];
        if (!combo) return;

        const targetNames = combo.targets.map(t => t.name).join(', ');
        if (!confirm(`Replace all pinned targets with:\n${targetNames}?`)) return;

        // Unpin all current pinned targets
        const pinned = DataManager.getPinnedTargets().slice();
        for (const p of pinned) {
            await DataManager.unpinTarget(p.name);
        }

        // Pin combo targets
        let pinned_count = 0;
        for (const candidate of combo.targets) {
            const target = DataManager.getTargets().find(t => t.object === candidate.id);
            if (!target) continue;
            await DataManager.pinTarget({ ...target, name: target.object });
            pinned_count++;
        }

        UIManager.showToast(`Pinned targets replaced with ${pinned_count} target${pinned_count !== 1 ? 's' : ''}`, 'success');
    },

    /**
     * Remove a candidate from the displayed list
     * @param {number} index - Index in currentResults
     */
    removeCandidate(index) {
        this.currentResults.splice(index, 1);
        this.renderResults(this.currentResults, this.totalEvaluated);
    },

    /**
     * Pin a single candidate to pinned targets
     * @param {number} index - Index in currentResults
     */
    async pinCandidate(index) {
        const candidate = this.currentResults[index];
        if (!candidate) return;

        const target = DataManager.getTargets().find(t => t.object === candidate.id);
        if (!target) {
            UIManager.showToast('Target not found', 'error');
            return;
        }

        const alreadyPinned = DataManager.getPinnedTargets().some(p => p.name === candidate.id);
        if (alreadyPinned) {
            UIManager.showToast(`${candidate.name} is already pinned`, 'warning');
            return;
        }

        await DataManager.pinTarget({ ...target, name: target.object });
        UIManager.showToast(`${candidate.name} pinned`, 'success');
    },

    /**
     * Open Daily Visibility chart for a candidate directly
     * @param {number} index - Index in currentResults
     */
    viewDailyVisibility(index) {
        const candidate = this.currentResults[index];
        if (!candidate) return;

        // Find full target object from DataManager
        const target = DataManager.getTargets().find(t => t.object === candidate.id);
        if (!target) {
            UIManager.showToast('Target not found', 'error');
            return;
        }

        // Set current target for visibility system
        VisibilityTargets.select(target);

        // Get location
        const locationName = SettingsManager.getSelectedLocation();
        const loc = DataManager.getLocations()[locationName];

        // Build skyglowData directly using assembleSkyglowData
        const dateStr = document.getElementById('optimizer-date').value;
        const minAltitude = SettingsManager.getGlobalMinAltitude();
        const useHorizon = true;

        const skyglowData = DailyVisibilityCalculations.assembleSkyglowData(
            target, dateStr, locationName, minAltitude, useHorizon
        );

        if (!skyglowData) {
            UIManager.showToast('No visibility data for this target on this date', 'warning');
            return;
        }

        window.skyglowData = skyglowData;
        window.location.hash = '#daily-visibility';
    },

    /**
     * Receive filter targets pool from Target Filter
     * Called by TargetFilter "Send to Optimizer" button (Phase 5)
     * @param {Array} targets - Filtered target array
     */
    receiveFilterPool(targets) {
        this.filterTargetsPool = targets;
        this.updateFilterSourceOption();
    }

};
