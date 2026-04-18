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

        // Add window resize listener to redraw timeline — guard against accumulation
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

        // Re-render timeline on resize — Issue #129
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
     * Populate location dropdown
     */
    populateLocationDropdown() {
        const select = document.getElementById('seq-plan-location');
        if (!select) return;

        select.innerHTML = '<option value="">Select location...</option>';

        const locations = DataManager.getLocations();
        Object.keys(locations).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });

        // Sync to global location on populate
        const globalLocation = SettingsManager.getSelectedLocation();
        if (globalLocation && select.querySelector(`option[value="${globalLocation}"]`)) {
            select.value = globalLocation;
        }

        if (!this._pinnedTargetsHandler) {
            this._pinnedTargetsHandler = () => this.loadPinnedTargets();
            this._locationsHandler = () => this.populateLocationDropdown();
            document.addEventListener('pinned-targets-updated', this._pinnedTargetsHandler);
            document.addEventListener('locations-updated', this._locationsHandler);
        }

        // Sync seq-plan location when sidebar location changes
        const sidebarSelect = document.getElementById('sidebar-location-select');
        if (sidebarSelect) {
            sidebarSelect.addEventListener('change', (e) => {
                const locationName = e.target.value;
                if (locationName && select.querySelector(`option[value="${locationName}"]`)) {
                    select.value = locationName;
                    select.dispatchEvent(new Event('input'));
                }
            });
        }
    },

    /**
     * Load saved settings from SettingsManager
     */
    loadSettings() {
        // Min altitude - always use global default on load
        const globalMinAlt = SettingsManager.getGlobalMinAltitude();

        const minAltSelect = document.getElementById('seq-plan-min-altitude');

        if (minAltSelect) {
            minAltSelect.value = globalMinAlt;

            // Remove override styling since we're starting with global default
            minAltSelect.classList.remove('altitude-override-active');
            minAltSelect.title = '';
        }

        document.getElementById('seq-plan-use-horizon').value = 'yes';
        document.getElementById('seq-plan-af-enabled').checked =
            SettingsManager.getSetting('seqPlanAutofocusEnabled', true);
        document.getElementById('seq-plan-af-interval').value =
            SettingsManager.getSetting('seqPlanAutofocusInterval', 60);
        document.getElementById('seq-plan-af-duration').value =
            SettingsManager.getSetting('seqPlanAutofocusDuration', 2);
        document.getElementById('seq-plan-flip-pause').value =
            SettingsManager.getSetting('seqPlanMeridianFlipPause', 4);
        document.getElementById('seq-plan-flip-duration').value =
            SettingsManager.getSetting('seqPlanMeridianFlipDuration', 2);
        document.getElementById('seq-plan-flip-offset').value =
            SettingsManager.getSetting('seqPlanMeridianFlipOffset', 0);
        document.getElementById('seq-plan-cal-duration').value =
            SettingsManager.getSetting('seqPlanCalibrationDuration', 5);
        document.getElementById('seq-plan-frames-per-dither').value =
            SettingsManager.getFramesPerDither();

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
                                          parseFloat(document.getElementById('seq-plan-min-altitude').value));

        await SettingsManager.saveSetting('seqPlanAutofocusEnabled',
                                          document.getElementById('seq-plan-af-enabled').checked);
        await SettingsManager.saveSetting('seqPlanAutofocusInterval',
                                          parseFloat(document.getElementById('seq-plan-af-interval').value));
        await SettingsManager.saveSetting('seqPlanAutofocusDuration',
                                          parseFloat(document.getElementById('seq-plan-af-duration').value));

        await SettingsManager.saveSetting('seqPlanMeridianFlipPause',
                                          parseFloat(document.getElementById('seq-plan-flip-pause').value));
        await SettingsManager.saveSetting('seqPlanMeridianFlipDuration',
                                          parseFloat(document.getElementById('seq-plan-flip-duration').value));
        await SettingsManager.saveSetting('seqPlanMeridianFlipOffset',
                                          parseFloat(document.getElementById('seq-plan-flip-offset').value));

        await SettingsManager.saveSetting('seqPlanCalibrationDuration',
                                          parseFloat(document.getElementById('seq-plan-cal-duration').value));
        await SettingsManager.setFramesPerDither(
            parseInt(document.getElementById('seq-plan-frames-per-dither').value));

        await SettingsManager.saveSetting('seqPlanTransitionTolerance',
                                          document.getElementById('seq-plan-transition-tolerance').checked);
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        // Session settings that require full regeneration with optimization
        const sessionInputs = [
            'seq-plan-date',
            'seq-plan-location',
            'seq-plan-min-altitude'
        ];

        sessionInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.debouncedGenerate(); // Full regeneration with optimization
                });
            }
        });

        // Overhead settings that only need recalculation (no optimization)
        const overheadInputs = [
            'seq-plan-af-enabled',
            'seq-plan-af-interval',
            'seq-plan-af-duration',
            'seq-plan-flip-pause',
            'seq-plan-flip-duration',
            'seq-plan-flip-offset',
            'seq-plan-cal-duration',
            'seq-plan-frames-per-dither'
        ];

        // Update the frames/no-dither label when dropdown changes
        const framesPerDitherSelect = document.getElementById('seq-plan-frames-per-dither');
        const framesPerDitherSpan = framesPerDitherSelect?.nextElementSibling;
        if (framesPerDitherSelect && framesPerDitherSpan) {
            const updateDitherLabel = () => {
                framesPerDitherSpan.textContent = framesPerDitherSelect.value === '0' ? 'no dither' : 'frames';
            };
            framesPerDitherSelect.addEventListener('change', updateDitherLabel);
            updateDitherLabel(); // Set correct label on initial load
        }

        // Sequence optimization checkbox requires full regeneration
        const toleranceInput = document.getElementById('seq-plan-transition-tolerance');
        if (toleranceInput) {
            toleranceInput.addEventListener('change', () => {
                this.debouncedGenerate();
            });
        }

        overheadInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.debouncedRecalculate(); // Recalculate without optimization
                });
            }
        });

        // Min altitude dropdown override styling
        const minAltSelect = document.getElementById('seq-plan-min-altitude');
        const globalMinAlt = SettingsManager.getGlobalMinAltitude();

        if (minAltSelect) {
            // Update styling on change
            minAltSelect.addEventListener('change', () => {
                const currentValue = parseInt(minAltSelect.value);
                const isOverride = currentValue !== globalMinAlt;

                if (isOverride) {
                    minAltSelect.classList.add('altitude-override-active');
                    minAltSelect.title = `Override active (global default: ${globalMinAlt}°)`;
                } else {
                    minAltSelect.classList.remove('altitude-override-active');
                    minAltSelect.title = '';
                }
            });
        }

        // Use Horizon toggle
        document.getElementById('seq-plan-use-horizon').addEventListener('change', () => {
            this.debouncedGenerate();
        });

        // Autofocus checkbox listener to show/hide note
        const afCheckbox = document.getElementById('seq-plan-af-enabled');
        const afNote = document.getElementById('seq-plan-af-note');
        if (afCheckbox && afNote) {
            afCheckbox.addEventListener('change', (e) => {
                afNote.style.display = e.target.checked ? 'inline' : 'none';

                // Rebuild session config and recalculate to include/exclude autofocus events
                if (this.currentSession && this.calculatedResults.length > 0) {
                    this.currentSession = this.buildSessionConfig();
                    this.recalculateAndUpdate();
                }
            });
            // Set initial state based on current checkbox value
            afNote.style.display = afCheckbox.checked ? 'inline' : 'none';
        }

        // Reset & Optimize button
        const resetBtn = document.getElementById('seq-plan-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAndOptimize();
            });
        }

        // Start time selector - show/hide custom time input
        const startTimeSelect = document.getElementById('seq-plan-start-time');
        const customTimeInput = document.getElementById('seq-plan-custom-time');

        if (startTimeSelect && customTimeInput) {
            startTimeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customTimeInput.style.opacity = '1';
                    customTimeInput.style.pointerEvents = 'auto';
                } else {
                    customTimeInput.style.opacity = '0';
                    customTimeInput.style.pointerEvents = 'none';
                }
                this.debouncedGenerate();
            });

            customTimeInput.addEventListener('change', () => {
                this.debouncedGenerate();
            });
        }
    },

    /*
     * Trigger plan generation with debouncing
     */
    debouncedGenerate() {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.generatePlan();
        }, 1000); // Wait 1000ms after last change
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

        // Reset allocations to equal split before optimization — prevents manual
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

        // Store last target's max allocation — set once per plan generation, never during slider interaction
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
        const location = document.getElementById('seq-plan-location').value;
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
        const locationName = document.getElementById('seq-plan-location').value;
        const location = DataManager.getLocations()[locationName];
        const minAlt = parseInt(document.getElementById('seq-plan-min-altitude').value);

        return {
            date: date,
            location: location,
            minAltitude: parseInt(document.getElementById('seq-plan-min-altitude').value),
            useHorizon: document.getElementById('seq-plan-use-horizon').value === 'yes',
            startTimeMode: document.getElementById('seq-plan-start-time').value,
            customStartTime: document.getElementById('seq-plan-custom-time').value, // HH:MM format
            autofocusEnabled: document.getElementById('seq-plan-af-enabled').checked,
            autofocusInterval: parseInt(document.getElementById('seq-plan-af-interval').value),
            autofocusDuration: parseInt(document.getElementById('seq-plan-af-duration').value),
            calibrationDuration: parseInt(document.getElementById('seq-plan-cal-duration').value),
            meridianFlipPause: parseInt(document.getElementById('seq-plan-flip-pause').value),
            meridianFlipDuration: parseInt(document.getElementById('seq-plan-flip-duration').value),
            meridianFlipOffset: parseInt(document.getElementById('seq-plan-flip-offset').value),
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
        UIManager.openModal(null, `${target.name} — Session Detail`, null);
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
                <span><strong>Location:</strong> ${document.getElementById('seq-plan-location').value}</span>
                <span><strong>Session:</strong> ${startTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} - ${endTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${duration.toFixed(1)}h)</span>
            </p>
            <h4 style="margin-top: 1.5rem;">Target Sequence:</h4>
    `;

        this.calculatedResults.forEach((target, index) => {
            const targetStartTime = jdToDate(target.imagingStartJD);
            const targetEndTime = jdToDate(target.imagingEndJD);
            const flipWarning = target.meridianFlipJD ? ' • ⚠ Includes meridian flip' : '';

            // Main imaging entry (full window)
            html += `
            <p style="margin-bottom: 0.5rem;">
                <strong>${index + 1}. <a href="#" class="block-link" onclick="SeqPlanView.showTargetDetailModal('${target.targetId}'); return false;">${target.name}</a></strong> •
                Start: ${targetStartTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} •
                End: ${targetEndTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${target.imagingMinutes.toFixed(0)}m) •
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
                        // Check if periods overlap
                        return (startJD < hv.endJD && endJD > hv.startJD);
                    });
                };

                // Show violation for "starts early" case (only if not covered by horizon violation and >= 1 minute duration)
                if (constraint.violationType === 'starts_early' || constraint.violationType === 'both') {
                    const violationMinutes = (constraint.validStartJD - target.imagingStartJD) * 1440;
                    if (violationMinutes >= 1 && !overlapsHorizonViolation(target.imagingStartJD, constraint.validStartJD)) {
                        const violationStart = jdToDate(target.imagingStartJD);
                        const violationEnd = jdToDate(constraint.validStartJD);

                        html += `
            <p style="margin-bottom: 0.5rem; margin-left: 0rem;">
                <span style="color: var(--error-color);">⚠ ${target.name} • Altitude constraint</span> •
                Start: ${violationStart.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} •
                End: ${violationEnd.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} (${violationMinutes.toFixed(0)}m)
            </p>
                        `;
                    }
                }

                // Show violation for "ends late" case (only if not covered by horizon violation and >= 1 minute duration)
                if (constraint.violationType === 'ends_late' || constraint.violationType === 'both') {
                    const violationMinutes = (target.imagingEndJD - constraint.validEndJD) * 1440;
                    if (violationMinutes >= 1 && !overlapsHorizonViolation(constraint.validEndJD, target.imagingEndJD)) {
                        const violationStart = jdToDate(constraint.validEndJD);
                        const violationEnd = jdToDate(target.imagingEndJD);

                        html += `
            <p style="margin-bottom: 0.5rem; margin-left: 0rem;">
                <span style="color: var(--error-color);">⚠ ${target.name} • Altitude constraint</span> •
                Start: ${violationStart.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} •
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
                    // Skip violations less than 1 minute
                    if (violationMinutes < 1) return;

                    const violationStart = jdToDate(violation.startJD);
                    const violationEnd = jdToDate(violation.endJD);

                    html += `
            <p style="margin-bottom: 0.5rem; margin-left: 0rem;">
                <span style="color: var(--error-color);">⚠ ${target.name} • Horizon constraint</span> •
                Start: ${violationStart.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false})} •
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
    // Add these methods to the SeqPlanView object
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
                    ${target.allocatedPercent.toFixed(0)}% • ${target.exposureCount} × ${target.exposureTime}s
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
     * Targets to the left are locked, targets to the right absorb changes
     * Last target can only be reduced (shortens session duration)
     */
    handleSliderChange(targetId, newPercent) {
        const targetIndex = this.calculatedResults.findIndex(t => t.targetId === targetId);
        if (targetIndex === -1) return;

        const oldPercent = this.calculatedResults[targetIndex].allocatedPercent;
        const diff = newPercent - oldPercent;

        // Distribute the difference only among targets to the RIGHT
        const targetsToRight = this.calculatedResults.slice(targetIndex + 1);

        // If last target, cap at stored max — cannot extend past original end time
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
            // Normal case: distribute among targets to the right
            const adjustment = -diff / targetsToRight.length;
            this.calculatedResults[targetIndex].allocatedPercent = newPercent;
            targetsToRight.forEach(target => {
                target.allocatedPercent = Math.max(0, target.allocatedPercent + adjustment);
            });
        }

        // Normalize to ensure total is 100% (or less if last target was reduced)
        const total = this.calculatedResults.reduce((sum, t) => sum + t.allocatedPercent, 0);
        if (Math.abs(total - 100) > 0.01 && targetsToRight.length > 0) {
            // Only normalize if NOT the last target
            const scale = 100 / total;
            this.calculatedResults.forEach(t => {
                t.allocatedPercent *= scale;
            });
        }

        // Update slider positions for all affected targets
        this.calculatedResults.forEach(target => {
            const slider = document.getElementById(`slider-${target.targetId}`);
            if (slider) {
                slider.value = target.allocatedPercent.toFixed(0);
                this.updateSliderBackground(slider);
            }
        });

        // Recalculate and update
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

        // Recalculate with current allocations
        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            this.calculatedResults,
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

        // Update slider values display
        this.calculatedResults.forEach(target => {
            const slider = document.getElementById(`slider-${target.targetId}`);
            const valueDisplay = document.getElementById(`value-${target.targetId}`);
            if (slider) {
                slider.value = target.allocatedPercent.toFixed(0);
            }
            if (valueDisplay) {
                valueDisplay.textContent = `${target.allocatedPercent.toFixed(0)}% • ${target.exposureCount} × ${target.exposureTime}s`;
            }
        });

        // Regenerate timeline
        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );
        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);

        // Update results display
        this.displayResults();

        // Update total images count in footer
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
            const draggingRect = this.draggedElement.getBoundingClientRect();
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
        // Remove dragging class from the row (not the handle)
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }

        // Get new order from DOM
        const rows = document.querySelectorAll('.seq-plan-target-row');
        const newOrder = Array.from(rows).map(row => row.dataset.targetId);

        // Reorder calculatedResults array
        const reordered = [];
        newOrder.forEach(targetId => {
            const target = this.calculatedResults.find(t => t.targetId === targetId);
            if (target) {
                target.orderOverridden = true;
                reordered.push(target);
            }
        });

        this.calculatedResults = reordered;

        this.calculatedResults = reordered;

        // Recalculate session window based on new first/last target order
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

        // Recalculate and update
        this.recalculateAndUpdate();

        this.draggedElement = null;
    },


    /**
     * Reset allocations and re-optimize target order
     */
    async resetAndOptimize() {
        if (!this.currentSession || this.calculatedResults.length === 0) return;

        // Rebuild session config to pick up any changed settings (like autofocus)
        this.currentSession = this.buildSessionConfig();

        // Recalculate dusk/dawn timing
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

        // Reset to equal allocation
        const equalPercent = 100 / this.currentTargets.length;
        this.currentTargets.forEach(target => {
            target.allocatedPercent = equalPercent;
        });

        // Re-optimize target order
        const optimizedTargets = SeqPlanOptimizer.optimizeTargetOrder(
            this.currentTargets,
            this.currentSession
        );

        // Recalculate session window based on optimized target order
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

        // Recalculate with new order and equal allocations
        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            transitionOptimizedTargets,
            this.currentSession
        );

        // Update target list reference
        this.currentTargets = this.calculatedResults;

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

        // Regenerate timeline
        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );

        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);

        // Update displays
        this.displayResults();
        this.renderTargetAllocation();

        UIManager.showToast('Plan reset and optimized', 'success');
    },

    /**
     * Recalculate plan without re-optimizing (for overhead setting changes)
     */
    debouncedRecalculate() {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.recalculateWithoutOptimization();
        }, 1000);
    },

    /**
     * Recalculate plan keeping current target order
     */
    async recalculateWithoutOptimization() {
        if (!this.currentSession || this.calculatedResults.length === 0) return;

        // Save settings
        await this.saveSettings();

        // Rebuild session config with new overhead settings
        this.currentSession = this.buildSessionConfig();

        // Recalculate dusk and dawn
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

        // Calculate session window based on first/last target altitude constraints
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

        // Recalculate with CURRENT order (no optimization)
        this.calculatedResults = SeqPlanCalculations.calculateExposureCounts(
            this.calculatedResults,
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

        // Regenerate timeline
        const events = SeqPlanCalculations.generateTimelineEvents(
            this.calculatedResults,
            this.currentSession
        );

        SeqPlanTimeline.render(events, this.currentSession.sessionStartJD, this.currentSession.sessionEndJD, this.currentSession);

        // Update displays
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

                    // Add tiny delay before collapsing body to prevent rendering glitches
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
                { text: `${target.name} — Sequence Plan`, style: 'title' },
                { text: `${session.date}  •  ${session.location.name || ''}`, style: 'subtitle' },
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
