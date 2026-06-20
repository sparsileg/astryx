/**
 * seqplan-view.js
 * Main view controller and UI for Sequence Planner
 */

const SeqPlanView = {
    currentSession: null,
    currentTargets: [],
    calculatedResults: [],
    draggedElement: null,
    debounceTimer: null,
    isInitializing: false,
    resizeListenerAdded: false,
    _resizeObserver: null,

    /**
     * Initialize Sequence Planner view
     */
    async init() {
        console.log('Initializing Sequence Planner view');
        // Load pinned targets
        await this.loadPinnedTargets();
        // Populate dropdowns
        this.populateLocationDropdown();
        // Set default date to today (using local date, not UTC)
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        document.getElementById('seq-plan-date').value = dateStr;

        this.loadSettings();
        this.attachEventHandlers();
        this.setupCollapsibleSections();
        SeqPlanTimeline.init();

        // Add window resize listener to redraw timeline   guard against accumulation
        if (!this.resizeListenerAdded) {
            let resizeTimer;
            this._redrawTimeline = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (this.calculatedResults && this.calculatedResults.length > 0 && this.currentSession) {
                        const events = SeqPlanCalculations.generateTimelineEvents(
                            this.calculatedResults,
                            this.currentSession
                        );
                        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);
                    }
                }, 250);
            };
            window.addEventListener('resize', this._redrawTimeline);
            this.resizeListenerAdded = true;
        }

        // Re-render timeline on resize   Issue #129
        const canvasParent = document.getElementById('seq-plan-timeline')?.parentElement;
        if (canvasParent && typeof ResizeObserver !== 'undefined') {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            let resizeTimer = null;
            this._resizeObserver = new ResizeObserver(() => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (this.calculatedResults && this.calculatedResults.length > 0 && this.currentSession) {
                        const events = SeqPlanCalculations.generateTimelineEvents(
                            this.calculatedResults,
                            this.currentSession
                        );
                        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);
                    }
                }, 200);
            });
            this._resizeObserver.observe(canvasParent);
        }

        // Auto-generate plan
        this.debouncedGenerate();
        console.log('Sequence Planner initialized');
    },

    /**
     * Load pinned targets from DataManager
     */
    async loadPinnedTargets() {
        const pinned = DataManager.getPinnedTargets();

        if (pinned.length === 0) {
            UIManager.showToast('No pinned targets. Please pin targets first.', 'warning');
            return;
        }

        // Convert pinned targets to planning format
        // Exposure time will be set from input when generating plan
        this.currentTargets = pinned.map(target => ({
            targetId: target.name,
            name: target.name,
            ra: target.ra,
            dec: target.dec,
            common: target.common || '',
            exposureTime: 300, // Will be set from input
            allocatedPercent: 0, // Will be set to equal division
            userOrder: 0,
            suggestedOrder: 0,
            orderOverridden: false
        }));

        // Set equal allocation
        const equalPercent = 100 / this.currentTargets.length;
        this.currentTargets.forEach(target => {
            target.allocatedPercent = equalPercent;
        });
    },

    /**
     * Helper: get selected value from a custom dropdown menu
     */
    _getDropdownValue(menuId, fallback = '') {
        return document.getElementById(menuId)
            ?.querySelector('.target-filter-dropdown-item.selected')
            ?.dataset.value ?? fallback;
    },

    /**
     * Helper: set selected item in a custom dropdown by value, update label
     */
    _setDropdownValue(menuId, labelId, value) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        menu.querySelectorAll('.target-filter-dropdown-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.value === String(value));
        });
        const selected = menu.querySelector('.target-filter-dropdown-item.selected');
        const label = document.getElementById(labelId);
        if (label && selected) label.textContent = selected.textContent;
    },

    /**
     * Helper: wire a simple custom dropdown (trigger toggle + item selection)
     * onSelect(value) is called when an item is picked.
     */
    _wireDropdown(triggerId, dropdownId, menuId, labelId, onSelect) {
        const trigger = document.getElementById(triggerId);
        const dropdown = document.getElementById(dropdownId);
        const menu = document.getElementById(menuId);
        if (!trigger || !dropdown || !menu) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.target-filter-dropdown-item');
            if (!item) return;
            menu.querySelectorAll('.target-filter-dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const label = document.getElementById(labelId);
            if (label) label.textContent = item.textContent;
            dropdown.classList.remove('open');
            if (onSelect) onSelect(item.dataset.value);
        });
    },

    /**
     * Populate location dropdown
     */
    populateLocationDropdown() {
        const menu = document.getElementById('seq-plan-location-menu');
        const label = document.getElementById('seq-plan-location-label');
        const trigger = document.getElementById('seq-plan-location-trigger');
        const dropdown = document.getElementById('seq-plan-location-dropdown');
        if (!menu) return;

        const locations = DataManager.getLocations();
        const globalLocation = SettingsManager.getSelectedLocation();

        menu.innerHTML = '';

        const placeholder = document.createElement('div');
        placeholder.className = 'target-filter-dropdown-item';
        placeholder.dataset.value = '';
        placeholder.textContent = 'Select location...';
        menu.appendChild(placeholder);

        Object.keys(locations).forEach(name => {
            const item = document.createElement('div');
            item.className = 'target-filter-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            if (name === globalLocation) {
                item.classList.add('selected');
            }
            menu.appendChild(item);
        });

        // Set label to global location if available
        if (globalLocation && locations[globalLocation]) {
            if (label) label.textContent = globalLocation;
        } else {
            if (label) label.textContent = 'Select location...';
        }

        // Wire trigger once
        if (trigger && !trigger._listenerAttached) {
            trigger._listenerAttached = true;
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
            });

            menu.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.target-filter-dropdown-item');
                if (!item) return;
                menu.querySelectorAll('.target-filter-dropdown-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                if (label) label.textContent = item.textContent;
                dropdown.classList.remove('open');
                this.debouncedGenerate();
            });
        }

        if (!this._pinnedTargetsHandler) {
            this._pinnedTargetsHandler = () => this.loadPinnedTargets();
            this._locationsHandler = () => this.populateLocationDropdown();
            document.addEventListener('pinned-targets-updated', this._pinnedTargetsHandler);
            document.addEventListener('locations-updated', this._locationsHandler);
        }
    },

    /**
     * Load saved settings from SettingsManager
     */
    loadSettings() {
        const globalMinAlt = SettingsManager.getGlobalMinAltitude();
        this._setDropdownValue('seq-plan-min-altitude-menu', 'seq-plan-min-altitude-label', globalMinAlt);

        this._setDropdownValue('seq-plan-use-horizon-menu', 'seq-plan-use-horizon-label', 'yes');

        this._setDropdownValue(
            'seq-plan-af-interval-menu', 'seq-plan-af-interval-label',
            SettingsManager.getSetting('seqPlanAutofocusInterval', 60)
        );
        this._setDropdownValue(
            'seq-plan-af-duration-menu', 'seq-plan-af-duration-label',
            SettingsManager.getSetting('seqPlanAutofocusDuration', 2)
        );
        this._setDropdownValue(
            'seq-plan-flip-pause-menu', 'seq-plan-flip-pause-label',
            SettingsManager.getSetting('seqPlanMeridianFlipPause', 4)
        );
        this._setDropdownValue(
            'seq-plan-flip-duration-menu', 'seq-plan-flip-duration-label',
            SettingsManager.getSetting('seqPlanMeridianFlipDuration', 2)
        );
        this._setDropdownValue(
            'seq-plan-flip-offset-menu', 'seq-plan-flip-offset-label',
            SettingsManager.getSetting('seqPlanMeridianFlipOffset', 0)
        );
        this._setDropdownValue(
            'seq-plan-cal-duration-menu', 'seq-plan-cal-duration-label',
            SettingsManager.getSetting('seqPlanCalibrationDuration', 5)
        );

        const framesPerDither = SettingsManager.getFramesPerDither();
        this._setDropdownValue(
            'seq-plan-frames-per-dither-menu', 'seq-plan-frames-per-dither-label',
            framesPerDither
        );
        const ditherUnit = document.getElementById('seq-plan-dither-unit');
        if (ditherUnit) ditherUnit.textContent = framesPerDither === 0 ? 'no dither' : 'frames';

        document.getElementById('seq-plan-af-enabled').checked =
            SettingsManager.getSetting('seqPlanAutofocusEnabled', true);

        const toleranceCheck = document.getElementById('seq-plan-transition-tolerance');
        if (toleranceCheck) {
            if (!APP_CONFIG.FEATURES.TRANSITION_OPTIMIZATION) {
                toleranceCheck.checked = false;
                toleranceCheck.disabled = true;
            } else {
                toleranceCheck.checked = SettingsManager.getSetting('seqPlanTransitionTolerance', false);
                toleranceCheck.disabled = false;
            }
        }
    },

    /**
     * Save settings to SettingsManager
     */
    async saveSettings() {
        await SettingsManager.saveSetting('seqPlanMinAltitude',
            parseFloat(this._getDropdownValue('seq-plan-min-altitude-menu', '35')));

        await SettingsManager.saveSetting('seqPlanAutofocusEnabled',
            document.getElementById('seq-plan-af-enabled').checked);
        await SettingsManager.saveSetting('seqPlanAutofocusInterval',
            parseFloat(this._getDropdownValue('seq-plan-af-interval-menu', '60')));
        await SettingsManager.saveSetting('seqPlanAutofocusDuration',
            parseFloat(this._getDropdownValue('seq-plan-af-duration-menu', '2')));

        await SettingsManager.saveSetting('seqPlanMeridianFlipPause',
            parseFloat(this._getDropdownValue('seq-plan-flip-pause-menu', '4')));
        await SettingsManager.saveSetting('seqPlanMeridianFlipDuration',
            parseFloat(this._getDropdownValue('seq-plan-flip-duration-menu', '2')));
        await SettingsManager.saveSetting('seqPlanMeridianFlipOffset',
            parseFloat(this._getDropdownValue('seq-plan-flip-offset-menu', '0')));

        await SettingsManager.saveSetting('seqPlanCalibrationDuration',
            parseFloat(this._getDropdownValue('seq-plan-cal-duration-menu', '5')));
        await SettingsManager.setFramesPerDither(
            parseInt(this._getDropdownValue('seq-plan-frames-per-dither-menu', '3')));

        await SettingsManager.saveSetting('seqPlanTransitionTolerance',
            document.getElementById('seq-plan-transition-tolerance').checked);
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        // Date input triggers full regeneration
        const dateEl = document.getElementById('seq-plan-date');
        if (dateEl) {
            dateEl.addEventListener('input', () => this.debouncedGenerate());
        }

        // Start time dropdown
        const startTimeMenu = document.getElementById('seq-plan-start-time-menu');
        const startTimeDropdown = document.getElementById('seq-plan-start-time-dropdown');
        const customTimeInput = document.getElementById('seq-plan-custom-time');

        this._wireDropdown(
            'seq-plan-start-time-trigger',
            'seq-plan-start-time-dropdown',
            'seq-plan-start-time-menu',
            'seq-plan-start-time-label',
            (value) => {
                if (value === 'custom') {
                    customTimeInput.style.opacity = '1';
                    customTimeInput.style.pointerEvents = 'auto';
                } else {
                    customTimeInput.style.opacity = '0';
                    customTimeInput.style.pointerEvents = 'none';
                }
                this.debouncedGenerate();
            }
        );

        if (customTimeInput) {
            customTimeInput.addEventListener('change', () => this.debouncedGenerate());
            customTimeInput.addEventListener('input', () => this.debouncedGenerate());
        }

        // Min altitude dropdown — triggers full regeneration + override styling
        const globalMinAlt = SettingsManager.getGlobalMinAltitude();
        this._wireDropdown(
            'seq-plan-min-altitude-trigger',
            'seq-plan-min-altitude-dropdown',
            'seq-plan-min-altitude-menu',
            'seq-plan-min-altitude-label',
            (value) => {
                const trigger = document.getElementById('seq-plan-min-altitude-trigger');
                const isOverride = parseInt(value) !== globalMinAlt;
                if (trigger) {
                    trigger.classList.toggle('altitude-override-active', isOverride);
                    trigger.title = isOverride ? `Override active (global default: ${globalMinAlt}°)` : '';
                }
                this.debouncedGenerate();
            }
        );

        // Use horizon dropdown — triggers full regeneration
        this._wireDropdown(
            'seq-plan-use-horizon-trigger',
            'seq-plan-use-horizon-dropdown',
            'seq-plan-use-horizon-menu',
            'seq-plan-use-horizon-label',
            () => this.debouncedGenerate()
        );

        // Overhead dropdowns — trigger recalculation only
        this._wireDropdown(
            'seq-plan-af-interval-trigger',
            'seq-plan-af-interval-dropdown',
            'seq-plan-af-interval-menu',
            'seq-plan-af-interval-label',
            () => this.debouncedRecalculate()
        );
        this._wireDropdown(
            'seq-plan-af-duration-trigger',
            'seq-plan-af-duration-dropdown',
            'seq-plan-af-duration-menu',
            'seq-plan-af-duration-label',
            () => this.debouncedRecalculate()
        );
        this._wireDropdown(
            'seq-plan-flip-pause-trigger',
            'seq-plan-flip-pause-dropdown',
            'seq-plan-flip-pause-menu',
            'seq-plan-flip-pause-label',
            () => this.debouncedRecalculate()
        );
        this._wireDropdown(
            'seq-plan-flip-duration-trigger',
            'seq-plan-flip-duration-dropdown',
            'seq-plan-flip-duration-menu',
            'seq-plan-flip-duration-label',
            () => this.debouncedRecalculate()
        );
        this._wireDropdown(
            'seq-plan-flip-offset-trigger',
            'seq-plan-flip-offset-dropdown',
            'seq-plan-flip-offset-menu',
            'seq-plan-flip-offset-label',
            () => this.debouncedRecalculate()
        );
        this._wireDropdown(
            'seq-plan-cal-duration-trigger',
            'seq-plan-cal-duration-dropdown',
            'seq-plan-cal-duration-menu',
            'seq-plan-cal-duration-label',
            () => this.debouncedRecalculate()
        );

        // Frames per dither — updates dither unit span + recalculates
        this._wireDropdown(
            'seq-plan-frames-per-dither-trigger',
            'seq-plan-frames-per-dither-dropdown',
            'seq-plan-frames-per-dither-menu',
            'seq-plan-frames-per-dither-label',
            (value) => {
                const ditherUnit = document.getElementById('seq-plan-dither-unit');
                if (ditherUnit) ditherUnit.textContent = value === '0' ? 'no dither' : 'frames';
                this.debouncedRecalculate();
            }
        );

        // Sequence optimization checkbox requires full regeneration
        const toleranceInput = document.getElementById('seq-plan-transition-tolerance');
        if (toleranceInput) {
            toleranceInput.addEventListener('change', () => this.debouncedGenerate());
        }

        // Autofocus checkbox listener to show/hide note
        const afCheckbox = document.getElementById('seq-plan-af-enabled');
        const afNote = document.getElementById('seq-plan-af-note');
        if (afCheckbox && afNote) {
            afCheckbox.addEventListener('change', (e) => {
                afNote.style.display = e.target.checked ? 'inline' : 'none';
                this.debouncedRecalculate();
            });
            // Set initial state based on current checkbox value
            afNote.style.display = afCheckbox.checked ? 'inline' : 'none';
        }

        // Reset & Optimize button
        const resetBtn = document.getElementById('seq-plan-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetAndOptimize());
        }
    },

    /*
     * Trigger plan generation with debouncing
     */
    debouncedGenerate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.generatePlan();
        }, 1000);
    },

    /**
     * Generate imaging plan
     */
    async generatePlan() {
        this.isInitializing = true;

        // Validate inputs
        if (!this.validateInputs()) {
            return;
        }

        // Save settings
        await this.saveSettings();

        // Build session configuration
        this.currentSession = this.buildSessionConfig();

        // Calculate dusk and dawn only
        const timing = SeqPlanCalculations.calculateSessionTiming(
            this.currentSession.date,
            this.currentSession.location
        );

        if (!timing) {
            UIManager.showToast('No astronomical night at this location/date', 'error');
            return;
        }

        this.currentSession.duskJD = timing.duskJD;
        this.currentSession.dawnJD = timing.dawnJD;

        // Reset allocations to equal split before optimization   prevents manual
        // slider adjustments from polluting results on date/setting changes
        const equalPercent = 100 / this.currentTargets.length;
        this.currentTargets.forEach(target => {
            target.allocatedPercent = equalPercent;
        });

        // Optimize target order
        const optimizedTargets = SeqPlanOptimizer.optimizeTargetOrder(
            this.currentTargets,
            { ...this.currentSession,
              sessionStartJD: timing.duskJD,
              sessionEndJD: timing.dawnJD }
        );

        // Calculate session window based on first/last target altitude constraints
        const sessionWindow = SeqPlanCalculations.calculateSessionWindow(
            optimizedTargets,
            timing.duskJD,
            timing.dawnJD,
            this.currentSession.location,
            this.currentSession.minAltitude,
            this.currentSession.startTimeMode,
            this.currentSession.customStartTime,
            this.currentSession.useHorizon,
            this.currentSession.location.horizon
        );

        this.currentSession.sessionStartJD = sessionWindow.sessionStartJD;
        this.currentSession.sessionEndJD = sessionWindow.sessionEndJD;

        // Apply transition optimization (second pass, if enabled and tolerance set)
        const transitionOptimizedTargets = SeqPlanOptimizer.optimizeTransitions(
            optimizedTargets,
            this.currentSession,
            this.currentSession.transitionTolerance
        );

        // Recalculate session window in case transition optimization changed target order
        const transitionSessionWindow = SeqPlanCalculations.calculateSessionWindow(
            transitionOptimizedTargets,
            timing.duskJD,
            timing.dawnJD,
            this.currentSession.location,
            this.currentSession.minAltitude,
            this.currentSession.startTimeMode,
            this.currentSession.customStartTime,
            this.currentSession.useHorizon,
            this.currentSession.location.horizon
        );
        this.currentSession.sessionStartJD = transitionSessionWindow.sessionStartJD;
        this.currentSession.sessionEndJD = transitionSessionWindow.sessionEndJD;

        // Calculate exposure counts
        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            transitionOptimizedTargets,
            this.currentSession
        );

        // Check altitude constraints for each target
        this.calculatedResults.forEach(target => {
            const constraint = SeqPlanCalculations.checkTargetAltitudeConstraint(
                target,
                this.currentSession
            );
            target.altitudeConstraint = constraint;
            target.altitudeViolation = !constraint.isValid;

            // Find horizon violations if using horizon profile
            if (this.currentSession.useHorizon && this.currentSession.location.horizon) {
                target.horizonViolations = SeqPlanCalculations.findHorizonViolations(
                    target.imagingStartJD,
                    target.imagingEndJD,
                    target.ra,
                    target.dec,
                    this.currentSession.location.latitude,
                    this.currentSession.location.longitude,
                    this.currentSession.minAltitude,
                    this.currentSession.location.horizon
                );
            } else {
                target.horizonViolations = [];
            }
        });

        // Generate timeline events
        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );

        // Store last target's max allocation   set once per plan generation, never during slider interaction
        if (this.calculatedResults.length > 0) {
            const precedingPercent = this.calculatedResults
                .slice(0, this.calculatedResults.length - 1)
                .reduce((sum, t) => sum + t.allocatedPercent, 0);
            this._lastTargetMaxPercent = Math.ceil(100 - precedingPercent);
        }

        // Display results
        this.displayResults();
        this.renderTargetAllocation();

        // Render timeline AFTER UI layout settles
        requestAnimationFrame(() => {
            SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);
            this.isInitializing = false;
        });
    },

    /**
     * Validate user inputs
     * @returns {boolean} True if valid
     */
    validateInputs() {
        const location = this._getDropdownValue('seq-plan-location-menu');
        if (!location) {
            UIManager.showToast('Please select a location', 'error');
            return false;
        }

        if (this.currentTargets.length === 0) {
            UIManager.showToast('No pinned targets available', 'error');
            return false;
        }

        return true;
    },

    /**
     * Build session configuration from form inputs
     * @returns {Object} Session configuration
     */
    buildSessionConfig() {
        const date = document.getElementById('seq-plan-date').value;
        const locationName = this._getDropdownValue('seq-plan-location-menu');
        const location = DataManager.getLocations()[locationName];

        return {
            date: date,
            location: location,
            minAltitude: parseInt(this._getDropdownValue('seq-plan-min-altitude-menu', '35')),
            useHorizon: this._getDropdownValue('seq-plan-use-horizon-menu', 'yes') === 'yes',
            startTimeMode: this._getDropdownValue('seq-plan-start-time-menu', 'dusk'),
            customStartTime: document.getElementById('seq-plan-custom-time').value,
            autofocusEnabled: document.getElementById('seq-plan-af-enabled').checked,
            autofocusInterval: parseInt(this._getDropdownValue('seq-plan-af-interval-menu', '60')),
            autofocusDuration: parseInt(this._getDropdownValue('seq-plan-af-duration-menu', '2')),
            calibrationDuration: parseInt(this._getDropdownValue('seq-plan-cal-duration-menu', '5')),
            meridianFlipPause: parseInt(this._getDropdownValue('seq-plan-flip-pause-menu', '4')),
            meridianFlipDuration: parseInt(this._getDropdownValue('seq-plan-flip-duration-menu', '2')),
            meridianFlipOffset: parseInt(this._getDropdownValue('seq-plan-flip-offset-menu', '0')),
            interExposureTime: SettingsManager.getFramesPerDither() === 0
                ? SettingsManager.getLearnedSubGapS()
                : SettingsManager.getLearnedSubGapS() + Math.round(SettingsManager.getLearnedDitherDurationS() / SettingsManager.getFramesPerDither()),
            transitionTolerance: document.getElementById('seq-plan-transition-tolerance')?.checked ? 1 : 0
        };
    },

    showTargetDetailModal(targetId) {
        const target = this.calculatedResults.find(t => t.targetId === targetId);
        if (!target || !this.currentSession) return;

        // Generate timeline events for this target only
        const events = SeqPlanCalculations.generateTimelineEvents([target], this.currentSession);

        // Build table rows
        let rows = '';
        events.forEach(event => {
            const startTime = jdToDate(event.startJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const endTime = jdToDate(event.endJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const durationMin = ((event.endJD - event.startJD) * 24 * 60).toFixed(1);

            const typeLabel = {
                'autofocus':  'Autofocus',
                'calibration': 'Calibration',
                'imaging':    'Imaging',
                'flip-pause': 'Flip Pause',
                'flip':       'Meridian Flip'
            }[event.type] || event.type;

            rows += `
                <tr>
                    <td>${target.name}</td>
                    <td>${typeLabel}</td>
                    <td>${startTime}</td>
                    <td>${endTime}</td>
                    <td style="text-align: right;">${durationMin}m</td>
                </tr>`;
        });

        const html = `
            <table class="session-table">
                <thead>
                    <tr>
                        <th>Target</th>
                        <th>Event</th>
                        <th>Start</th>
                        <th>End</th>
                        <th style="text-align: right;">Duration</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>`;

        // Store events for PDF generation
        this._modalEvents = events;
        this._modalTargetId = target.targetId;

        // Open modal and inject content directly
        UIManager.openModal(null, `${target.name}   Session Detail`, null);
        const modalBody = document.getElementById('modal-body');
        if (modalBody) {
            modalBody.innerHTML = html + `
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary btn-sm" onclick="SeqPlanView.downloadPDF(SeqPlanView._modalTargetId, SeqPlanView._modalEvents, SeqPlanView.currentSession)">Download PDF</button>
                </div>`;
        }
    },

    /**
     * Display calculation results
     */
    displayResults() {
        const resultsDiv = document.getElementById('seq-plan-results');
        if (!resultsDiv) return;

        // Format session times
        const startTime = jdToDate(this.currentSession.sessionStartJD);
        const endTime = jdToDate(this.currentSession.sessionEndJD);
        const duration = (this.currentSession.sessionEndJD - this.currentSession.sessionStartJD) * 24;

        let html = `
    <div class="card">
        <div class="card-header">
            <h3>Imaging Plan</h3>
        </div>
        <div class="card-body">
            <p style="display: flex; gap: 2rem; flex-wrap: wrap;">
                <span><strong>Date:</strong> ${this.currentSession.date}</span>
                <span><strong>Location:</strong> ${this._getDropdownValue('seq-plan-location-menu')}</span>
                <span><strong>Session:</strong> ${startTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} - ${endTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${duration.toFixed(1)}h)</span>
            </p>
            <h4 style="margin-top: 1.5rem;">Target Sequence:</h4>
    `;

        this.calculatedResults.forEach((target, index) => {
            const targetStartTime = jdToDate(target.imagingStartJD);
            const targetEndTime = jdToDate(target.imagingEndJD);
            const flipWarning = target.meridianFlipJD ? '     Includes meridian flip' : '';

            // Main imaging entry (full window)
            html += `
            <p style="margin-bottom: 0.5rem;">
                <strong>${index + 1}. <a href="#" class="block-link" onclick="SeqPlanView.showTargetDetailModal('${target.targetId}'); return false;">${target.name}</a></strong>
                Start: ${targetStartTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})}
                End: ${targetEndTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${target.imagingMinutes.toFixed(0)}m)
                ${target.exposureCount} × ${target.exposureTime}s${flipWarning}
            </p>
            `;

            // Add altitude constraint violation warnings as indented sub-items (if any)
            if (target.altitudeConstraint && !target.altitudeConstraint.isValid) {
                const constraint = target.altitudeConstraint;

                // Check if we have horizon violations to avoid duplicates
                const horizonViolations = target.horizonViolations || [];

                // Helper function to check if a time period overlaps with any horizon violation
                const overlapsHorizonViolation = (startJD, endJD) => {
                    return horizonViolations.some(hv => {
                        return (startJD < hv.endJD && endJD > hv.startJD);
                    });
                };

                if (constraint.violationType === 'starts_early' || constraint.violationType === 'both') {
                    const violationMinutes = (constraint.validStartJD - target.imagingStartJD) * 1440;
                    if (violationMinutes >= 1 && !overlapsHorizonViolation(target.imagingStartJD, constraint.validStartJD)) {
                        const violationStart = jdToDate(target.imagingStartJD);
                        const violationEnd = jdToDate(constraint.validStartJD);

                        html += `
            <p style="margin-bottom: 0.5rem; margin-left: 0rem;">
                <span style="color: var(--error-color);">  ${target.name}   Altitude constraint</span>
                Start: ${violationStart.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})}
                End: ${violationEnd.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${violationMinutes.toFixed(0)}m)
            </p>
                        `;
                    }
                }

                if (constraint.violationType === 'ends_late' || constraint.violationType === 'both') {
                    const violationMinutes = (target.imagingEndJD - constraint.validEndJD) * 1440;
                    if (violationMinutes >= 1 && !overlapsHorizonViolation(constraint.validEndJD, target.imagingEndJD)) {
                        const violationStart = jdToDate(constraint.validEndJD);
                        const violationEnd = jdToDate(target.imagingEndJD);

                        html += `
            <p style="margin-bottom: 0.5rem; margin-left: 0rem;">
                <span style="color: var(--error-color);">  ${target.name}   Altitude constraint</span>
                Start: ${violationStart.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})}
                End: ${violationEnd.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${violationMinutes.toFixed(0)}m)
            </p>
                        `;
                    }
                }
            }

            // Add horizon violation warnings as indented sub-items (if any)
            if (target.horizonViolations && target.horizonViolations.length > 0) {
                target.horizonViolations.forEach(violation => {
                    const violationMinutes = (violation.endJD - violation.startJD) * 1440;
                    if (violationMinutes < 1) return;

                    const violationStart = jdToDate(violation.startJD);
                    const violationEnd = jdToDate(violation.endJD);

                    html += `
            <p style="margin-bottom: 0.5rem; margin-left: 0rem;">
                <span style="color: var(--error-color);">  ${target.name}   Horizon constraint</span>
                Start: ${violationStart.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})}
                End: ${violationEnd.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${violationMinutes.toFixed(0)}m)
            </p>
                    `;
                });
            }
        });

        html += `
        </div>
    </div>
    `;

        resultsDiv.innerHTML = html;
    },

    // ============================================================================
    // PHASE 2 ADDITIONS TO SEQPLAN-VIEW.JS
    // ============================================================================

    /**
     * Render target allocation UI with per-target controls
     */
    renderTargetAllocation() {
        const container = document.getElementById('seq-plan-target-list');
        if (!container || this.calculatedResults.length === 0) return;
        container.innerHTML = '';

        this.calculatedResults.forEach((target, index) => {
            const row = document.createElement('div');
            row.className = 'seq-plan-target-row';
            row.dataset.targetId = target.targetId;

            row.innerHTML = `
                <div class="seq-plan-drag-handle">&#8942;&#8942;</div>
                <div class="seq-plan-target-name">${target.name}</div>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <input type="number"
                        list="exposure-times-global"
                        class="seq-plan-exposure-input"
                        id="exposure-${target.targetId}"
                        value="${target.exposureTime}"
                        min="1"
                        style="width: 80px;">
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">sec</span>
                </div>
                <div>
                    <input type="range"
                           class="seq-plan-slider"
                           id="slider-${target.targetId}"
                           min="0"
                           max="100"
                           step="1"
                           value="${target.allocatedPercent.toFixed(0)}"
                           style="width: 200px;">
                </div>
                <div class="seq-plan-allocation-value" id="value-${target.targetId}">
                    ${target.allocatedPercent.toFixed(0)}%   ${target.exposureCount} × ${target.exposureTime}s
                </div>
            `;

            container.appendChild(row);
        });

        // Attach event listeners
        this.attachTargetAllocationListeners();

        // Update footer with total image count
        const footer = document.getElementById('seq-plan-allocation-footer');
        const totalImages = document.getElementById('seq-plan-total-images');
        if (footer && totalImages) {
            const total = this.calculatedResults.reduce((sum, t) => sum + t.exposureCount, 0);
            totalImages.textContent = `Total images: ${total}`;
            footer.style.display = 'flex';
        }
    },

    /**
     * Attach event listeners for target allocation controls
     */
    attachTargetAllocationListeners() {
        // Slider change listeners with auto-balancing
        this.calculatedResults.forEach(target => {
            const slider = document.getElementById(`slider-${target.targetId}`);
            if (slider) {
                // Initial background
                this.updateSliderBackground(slider);

                // Only trigger on actual user input, not programmatic changes
                let isUserInput = false;

                slider.addEventListener('mousedown', () => {
                    isUserInput = true;
                });

                slider.addEventListener('touchstart', () => {
                    isUserInput = true;
                }, { passive: false });

                slider.addEventListener('input', (e) => {
                    if (isUserInput) {
                        this.handleSliderChange(target.targetId, parseFloat(e.target.value));
                        this.updateSliderBackground(slider);
                    }
                });

                slider.addEventListener('mouseup', () => {
                    isUserInput = false;
                });

                slider.addEventListener('touchend', () => {
                    isUserInput = false;
                });

                // Prevent drag when interacting with slider
                slider.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });

                slider.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                }, {passive: false});
            }

            // Exposure time change listener
            const exposureInput = document.getElementById(`exposure-${target.targetId}`);
            if (exposureInput) {
                exposureInput.addEventListener('change', (e) => {
                    this.handleExposureChange(target.targetId, parseFloat(e.target.value));
                });
            }
        });

        // Drag and drop listeners - only on the drag handle
        const handles = document.querySelectorAll('.seq-plan-drag-handle');
        handles.forEach(handle => {
            const row = handle.closest('.seq-plan-target-row');
            handle.draggable = true;

            handle.addEventListener('dragstart', (e) => {
                this.draggedElement = row;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
        });

        // Dragover and drop on rows (not handles)
        const rows = document.querySelectorAll('.seq-plan-target-row');
        rows.forEach(row => {
            row.addEventListener('dragover', (e) => this.handleDragOver(e));
            row.addEventListener('drop', (e) => this.handleDrop(e));
            row.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });
    },

    /**
     * Handle slider change with left-to-right priority
     */
    handleSliderChange(targetId, newPercent) {
        const targetIndex = this.calculatedResults.findIndex(t => t.targetId === targetId);
        if (targetIndex === -1) return;

        const oldPercent = this.calculatedResults[targetIndex].allocatedPercent;
        const diff = newPercent - oldPercent;

        const targetsToRight = this.calculatedResults.slice(targetIndex + 1);

        if (targetsToRight.length === 0) {
            const lastTarget = this.calculatedResults[targetIndex];
            const maxPercent = this._lastTargetMaxPercent ?? 100;
            if (newPercent > maxPercent) {
                newPercent = maxPercent;
                const slider = document.getElementById(`slider-${lastTarget.targetId}`);
                if (slider) {
                    slider.value = maxPercent.toFixed(0);
                    this.updateSliderBackground(slider);
                }
            }
            this.calculatedResults[targetIndex].allocatedPercent = newPercent;
        } else {
            const adjustment = -diff / targetsToRight.length;
            this.calculatedResults[targetIndex].allocatedPercent = newPercent;
            targetsToRight.forEach(target => {
                target.allocatedPercent = Math.max(0, target.allocatedPercent + adjustment);
            });
        }

        const total = this.calculatedResults.reduce((sum, t) => sum + t.allocatedPercent, 0);
        if (Math.abs(total - 100) > 0.01 && targetsToRight.length > 0) {
            const scale = 100 / total;
            this.calculatedResults.forEach(t => {
                t.allocatedPercent *= scale;
            });
        }

        this.calculatedResults.forEach(target => {
            const slider = document.getElementById(`slider-${target.targetId}`);
            if (slider) {
                slider.value = target.allocatedPercent.toFixed(0);
                this.updateSliderBackground(slider);
            }
        });

        this.recalculateAndUpdate();
    },

    /**
     * Handle exposure time change
     */
    handleExposureChange(targetId, newExposure) {
        const target = this.calculatedResults.find(t => t.targetId === targetId);
        if (target && newExposure > 0) {
            target.exposureTime = newExposure;
            this.recalculateAndUpdate();
        }
    },

    /**
     * Recalculate exposure counts and update UI
     */
    recalculateAndUpdate() {
        if (this.isInitializing) return;

        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            this.calculatedResults,
            this.currentSession
        );

        this.calculatedResults.forEach(target => {
            const constraint = SeqPlanCalculations.checkTargetAltitudeConstraint(
                target,
                this.currentSession
            );
            target.altitudeConstraint = constraint;
            target.altitudeViolation = !constraint.isValid;

            if (this.currentSession.useHorizon && this.currentSession.location.horizon) {
                target.horizonViolations = SeqPlanCalculations.findHorizonViolations(
                    target.imagingStartJD,
                    target.imagingEndJD,
                    target.ra,
                    target.dec,
                    this.currentSession.location.latitude,
                    this.currentSession.location.longitude,
                    this.currentSession.minAltitude,
                    this.currentSession.location.horizon
                );
            } else {
                target.horizonViolations = [];
            }
        });

        this.calculatedResults.forEach(target => {
            const slider = document.getElementById(`slider-${target.targetId}`);
            const valueDisplay = document.getElementById(`value-${target.targetId}`);
            if (slider) {
                slider.value = target.allocatedPercent.toFixed(0);
            }
            if (valueDisplay) {
                valueDisplay.textContent = `${target.allocatedPercent.toFixed(0)}%   ${target.exposureCount} × ${target.exposureTime}s`;
            }
        });

        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );
        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);

        this.displayResults();

        const totalImages = document.getElementById('seq-plan-total-images');
        if (totalImages) {
            const total = this.calculatedResults.reduce((sum, t) => sum + t.exposureCount, 0);
            totalImages.textContent = `Total images: ${total}`;
        }
    },

    // ========================================================================
    // Drag and Drop Handlers
    // ========================================================================

    draggedElement: null,

    handleDragStart(e) {
        this.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
    },

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';

        const targetRow = e.target.closest('.seq-plan-target-row');
        if (targetRow && targetRow !== this.draggedElement) {
            const container = targetRow.parentNode;
            const targetRect = targetRow.getBoundingClientRect();

            if (e.clientY < targetRect.top + targetRect.height / 2) {
                container.insertBefore(this.draggedElement, targetRow);
            } else {
                container.insertBefore(this.draggedElement, targetRow.nextSibling);
            }
        }

        return false;
    },

    handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        return false;
    },

    handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }

        const rows = document.querySelectorAll('.seq-plan-target-row');
        const newOrder = Array.from(rows).map(row => row.dataset.targetId);

        const reordered = [];
        newOrder.forEach(targetId => {
            const target = this.calculatedResults.find(t => t.targetId === targetId);
            if (target) {
                target.orderOverridden = true;
                reordered.push(target);
            }
        });

        this.calculatedResults = reordered;

        const sessionWindow = SeqPlanCalculations.calculateSessionWindow(
            reordered,
            this.currentSession.duskJD,
            this.currentSession.dawnJD,
            this.currentSession.location,
            this.currentSession.minAltitude,
            this.currentSession.startTimeMode,
            this.currentSession.customStartTime,
            this.currentSession.useHorizon,
            this.currentSession.location.horizon
        );
        this.currentSession.sessionStartJD = sessionWindow.sessionStartJD;
        this.currentSession.sessionEndJD = sessionWindow.sessionEndJD;

        this.recalculateAndUpdate();

        this.draggedElement = null;
    },

    /**
     * Reset allocations and re-optimize target order
     */
    async resetAndOptimize() {
        if (!this.currentSession || this.calculatedResults.length === 0) return;

        this.currentSession = this.buildSessionConfig();

        const timing = SeqPlanCalculations.calculateSessionTiming(
            this.currentSession.date,
            this.currentSession.location
        );
        if (!timing) {
            UIManager.showToast('No astronomical night at this location/date', 'error');
            return;
        }
        this.currentSession.duskJD = timing.duskJD;
        this.currentSession.dawnJD = timing.dawnJD;
        this.currentSession.sessionStartJD = timing.duskJD;
        this.currentSession.sessionEndJD = timing.dawnJD;

        const equalPercent = 100 / this.currentTargets.length;
        this.currentTargets.forEach(target => {
            target.allocatedPercent = equalPercent;
        });

        const optimizedTargets = SeqPlanOptimizer.optimizeTargetOrder(
            this.currentTargets,
            this.currentSession
        );

        const sessionWindow = SeqPlanCalculations.calculateSessionWindow(
            optimizedTargets,
            timing.duskJD,
            timing.dawnJD,
            this.currentSession.location,
            this.currentSession.minAltitude,
            this.currentSession.startTimeMode,
            this.currentSession.customStartTime,
            this.currentSession.useHorizon,
            this.currentSession.location.horizon
        );
        this.currentSession.sessionStartJD = sessionWindow.sessionStartJD;
        this.currentSession.sessionEndJD = sessionWindow.sessionEndJD;

        const transitionOptimizedTargets = SeqPlanOptimizer.optimizeTransitions(
            optimizedTargets,
            this.currentSession,
            this.currentSession.transitionTolerance
        );

        const transitionSessionWindow = SeqPlanCalculations.calculateSessionWindow(
            transitionOptimizedTargets,
            timing.duskJD,
            timing.dawnJD,
            this.currentSession.location,
            this.currentSession.minAltitude,
            this.currentSession.startTimeMode,
            this.currentSession.customStartTime,
            this.currentSession.useHorizon,
            this.currentSession.location.horizon
        );
        this.currentSession.sessionStartJD = transitionSessionWindow.sessionStartJD;
        this.currentSession.sessionEndJD = transitionSessionWindow.sessionEndJD;

        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            transitionOptimizedTargets,
            this.currentSession
        );

        this.currentTargets = this.calculatedResults;

        this.calculatedResults.forEach(target => {
            const constraint = SeqPlanCalculations.checkTargetAltitudeConstraint(
                target,
                this.currentSession
            );
            target.altitudeConstraint = constraint;
            target.altitudeViolation = !constraint.isValid;

            if (this.currentSession.useHorizon && this.currentSession.location.horizon) {
                target.horizonViolations = SeqPlanCalculations.findHorizonViolations(
                    target.imagingStartJD,
                    target.imagingEndJD,
                    target.ra,
                    target.dec,
                    this.currentSession.location.latitude,
                    this.currentSession.location.longitude,
                    this.currentSession.minAltitude,
                    this.currentSession.location.horizon
                );
            } else {
                target.horizonViolations = [];
            }
        });

        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );

        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);

        this.displayResults();
        this.renderTargetAllocation();

        UIManager.showToast('Plan reset and optimized', 'success');
    },

    /**
     * Recalculate plan without re-optimizing (for overhead setting changes)
     */
    debouncedRecalculate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.recalculateWithoutOptimization();
        }, 1000);
    },

    /**
     * Recalculate plan keeping current target order
     */
    async recalculateWithoutOptimization() {
        if (!this.currentSession || this.calculatedResults.length === 0) return;

        await this.saveSettings();

        this.currentSession = this.buildSessionConfig();

        const timing = SeqPlanCalculations.calculateSessionTiming(
            this.currentSession.date,
            this.currentSession.location
        );

        if (!timing) {
            UIManager.showToast('No astronomical night at this location/date', 'error');
            return;
        }

        this.currentSession.duskJD = timing.duskJD;
        this.currentSession.dawnJD = timing.dawnJD;

        const sessionWindow = SeqPlanCalculations.calculateSessionWindow(
            this.calculatedResults,
            timing.duskJD,
            timing.dawnJD,
            this.currentSession.location,
            this.currentSession.minAltitude,
            this.currentSession.startTimeMode,
            this.currentSession.customStartTime,
            this.currentSession.useHorizon,
            this.currentSession.location.horizon
        );

        this.currentSession.sessionStartJD = sessionWindow.sessionStartJD;
        this.currentSession.sessionEndJD = sessionWindow.sessionEndJD;

        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            this.calculatedResults,
            this.currentSession
        );

        this.calculatedResults.forEach(target => {
            const constraint = SeqPlanCalculations.checkTargetAltitudeConstraint(
                target,
                this.currentSession
            );
            target.altitudeConstraint = constraint;
            target.altitudeViolation = !constraint.isValid;

            if (this.currentSession.useHorizon && this.currentSession.location.horizon) {
                target.horizonViolations = SeqPlanCalculations.findHorizonViolations(
                    target.imagingStartJD,
                    target.imagingEndJD,
                    target.ra,
                    target.dec,
                    this.currentSession.location.latitude,
                    this.currentSession.location.longitude,
                    this.currentSession.minAltitude,
                    this.currentSession.location.horizon
                );
            } else {
                target.horizonViolations = [];
            }
        });

        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );

        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);

        this.displayResults();
        this.renderTargetAllocation();
    },

    /**
     * Update slider background with two-tone gradient
     */
    updateSliderBackground(slider) {
        if (!slider) return;
        const value = slider.value;
        const min = slider.min || 0;
        const max = slider.max || 100;
        const percentage = ((value - min) / (max - min)) * 100;

        slider.style.background = `linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%, var(--border-color) 100%)`;
    },

    /**
     * Setup collapsible section handlers
     */
    setupCollapsibleSections() {
        document.querySelectorAll('.seqplan-ss-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.collapseTarget;
                const targetBody = document.getElementById(targetId);

                if (targetBody) {
                    header.classList.toggle('collapsed');

                    if (targetBody.classList.contains('collapsed')) {
                        targetBody.classList.remove('collapsed');
                    } else {
                        setTimeout(() => {
                            targetBody.classList.add('collapsed');
                        }, 10);
                    }
                }
            });
        });
    },

    /**
     * Generate and download a PDF of the sequence plan for a single target.
     */
    downloadPDF(targetId, events, session) {
        const target = this.calculatedResults.find(t => t.targetId === targetId);
        if (!target) return;

        const colors = {
            headerBg: '#2c3e50',
            headerText: '#ffffff',
            rowAlt: '#f2f4f6',
            rowWhite: '#ffffff',
        };

        const typeLabel = {
            'autofocus':   'Autofocus',
            'calibration': 'Guide Calibration',
            'imaging':     'Imaging',
            'flip-pause':  'Flip Pause',
            'flip':        'Meridian Flip'
        };

        const detailRows = events.map((e, idx) => {
            const startTime = jdToDate(e.startJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const endTime = jdToDate(e.endJD).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
            const durationMin = ((e.endJD - e.startJD) * 24 * 60).toFixed(1);
            const bg = idx % 2 === 0 ? colors.rowWhite : colors.rowAlt;

            return [
                { text: target.name, fontSize: 9, fillColor: bg },
                { text: typeLabel[e.type] || e.type, fontSize: 9, fillColor: bg },
                { text: startTime, fontSize: 9, fillColor: bg },
                { text: endTime, fontSize: 9, fillColor: bg },
                { text: durationMin + 'm', fontSize: 9, fillColor: bg, alignment: 'right' },
            ];
        });

        const docDefinition = {
            pageSize: 'LETTER',
            pageMargins: [54, 54, 54, 54],
            defaultStyle: { font: 'Roboto', fontSize: 9 },
            styles: {
                title: { fontSize: 14, bold: true, color: '#2c3e50', margin: [0, 0, 0, 2] },
                subtitle: { fontSize: 8, color: '#555555', margin: [0, 0, 0, 8] },
                tableHeader: { fontSize: 9, bold: true, color: colors.headerText, fillColor: colors.headerBg },
            },
            content: [
                { text: `${target.name}   Sequence Plan`, style: 'title' },
                { text: `${session.date}     ${session.location.name || ''}`, style: 'subtitle' },
                {
                    table: {
                        headerRows: 1,
                        widths: [80, 130, 40, 40, 50],
                        body: [
                            [
                                { text: 'Target', style: 'tableHeader' },
                                { text: 'Event', style: 'tableHeader' },
                                { text: 'Start', style: 'tableHeader' },
                                { text: 'End', style: 'tableHeader' },
                                { text: 'Duration', style: 'tableHeader', alignment: 'right' },
                            ],
                            ...detailRows,
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0,
                        hLineColor: () => '#cccccc',
                        paddingLeft: () => 5,
                        paddingRight: () => 5,
                        paddingTop: () => 3,
                        paddingBottom: () => 3,
                    }
                },
            ]
        };

        const filename = `${target.name.replace(/\s+/g, '_')}_${session.date.replace(/-/g, '')}_sequence-plan.pdf`;
        pdfMake.createPdf(docDefinition).download(filename);
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._redrawTimeline) {
            window.removeEventListener('resize', this._redrawTimeline);
            this._redrawTimeline = null;
            this.resizeListenerAdded = false;
        }
        if (this._pinnedTargetsHandler) {
            document.removeEventListener('pinned-targets-updated', this._pinnedTargetsHandler);
            this._pinnedTargetsHandler = null;
        }
        if (this._locationsHandler) {
            document.removeEventListener('locations-updated', this._locationsHandler);
            this._locationsHandler = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }
};
