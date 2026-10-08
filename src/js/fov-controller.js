/**
 * fov-main.js
 * Field of View view controller
 */

const FOVView = {
    followsCurrentTarget: true,     // redraws on current-target-changed
    currentTarget: null,
    showDSS: false,
    showTarget: true,
    largerMode: false,
    actualModeState: null,
    lastToastKey: null,
    dssRenderGeneration: 0,
    lastDSSFailureToastKey: null,
    _lastPurgeCheck: 0,

    /**
     * Render the FOV view
     */
    render() {
        const template = document.getElementById('fov-template');
        const appDiv = document.getElementById('app');

        if (!template || !appDiv) {
            console.error('FOV template or app div not found');
            return;
        }

        appDiv.innerHTML = '';
        const content = template.content.cloneNode(true);
        appDiv.appendChild(content);
        this.init();

        // Rebuild for a new current target, as on a fresh visit
        if (!this._targetChangedHandler) {
            this._targetChangedHandler = () => this.render();
            document.addEventListener('current-target-changed', this._targetChangedHandler);
        }

        // Dispatch view loaded event
        document.dispatchEvent(new CustomEvent('fov-view-loaded'));
    },

    /**
     * Initialize FOV view
     */
    init() {
        // Reset DSS state on each view load
        this.showDSS = false;
        this.showTarget = true;
        this.lastToastKey = null;
        this.largerMode = false;
        this.dssRenderGeneration = 0;
        this.actualModeState = null;
        this._offsetCenter = null;
        this._widerCenter = null;
        this._boxDragged = false;
        this.lastDSSFailureToastKey = null;
        // _lastPurgeCheck intentionally NOT reset here — purge cadence (Issue #221)
        // tracks across view loads within the app session, not per-visit.
        FOVCanvas.dssImage = null;
        FOVCanvas.dragBoxAngle = 0;

        // Initialize canvas
        FOVCanvas.init('fov-canvas');

        // Populate dropdowns
        this.populateTelescopeDropdown();
        this.populateSensorDropdown();

        // Load current target if available
        if (typeof VisibilityTargets !== 'undefined') {
            // Always load last selected target to pick up any change since last visit
            VisibilityTargets.loadLastTarget();
            if (VisibilityTargets.currentTarget) {
                this.currentTarget = VisibilityTargets.currentTarget;
                this.displayTargetInfo();
            }
        }

        // Setup event listeners
        this.setupEventListeners();

        // Refit the view to its space when the window or the card resizes
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._windowResizeHandler) window.removeEventListener('resize', this._windowResizeHandler);
        let resizeTimer = null;
        this._windowResizeHandler = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.refit(), 200);
        };
        window.addEventListener('resize', this._windowResizeHandler);
        const canvasWrap = document.querySelector('.fov-canvas-wrap');
        if (canvasWrap && typeof ResizeObserver !== 'undefined') {
            let lastWidth = canvasWrap.clientWidth;
            this._resizeObserver = new ResizeObserver(() => {
                if (canvasWrap.clientWidth === lastWidth) return;
                lastWidth = canvasWrap.clientWidth;
                this._windowResizeHandler();
            });
            this._resizeObserver.observe(canvasWrap);
        }

        // Moon defaults to off
        const showMoonCheckbox = document.getElementById('fov-show-moon');
        if (showMoonCheckbox) {
            showMoonCheckbox.checked = false;
            FOVCanvas.setShowMoon(false);
        }

        // DSS defaults to on
        const showDSSCheckbox = document.getElementById('fov-show-dss');
        if (showDSSCheckbox) {
            showDSSCheckbox.checked = true;
            this.showDSS = true;
        }

        // Target outline defaults to off
        const showTargetCheckbox = document.getElementById('fov-show-target');
        if (showTargetCheckbox) {
            showTargetCheckbox.checked = false;
            this.showTarget = false;
        }

        // Crosshair defaults to off
        const showCrosshairCheckbox = document.getElementById('fov-show-crosshair');
        if (showCrosshairCheckbox) {
            showCrosshairCheckbox.checked = false;
            FOVCanvas.showCrosshair = false;
        }

        // Restore larger mode toggle visual state
        const modeToggle = document.getElementById('fov-mode-toggle');
        if (modeToggle) {
            modeToggle.querySelectorAll('.fov-mode-option').forEach(el => {
                el.classList.toggle('active', el.dataset.mode === (this.largerMode ? 'larger' : 'actual'));
            });
        }

        const rotInput = document.getElementById('fov-rotation-input');
        if (rotInput) rotInput.value = 0;

        // Load saved selections (will trigger calculate() if equipment is selected)
        this.loadSavedSelections();
    },

    /**
     * Populate telescope dropdown
     */
    populateTelescopeDropdown() {
        const menu = document.getElementById('fov-telescope-menu');
        if (!menu) return;

        menu.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'astryx-dropdown-item';
        placeholder.dataset.value = '';
        placeholder.textContent = 'Select telescope...';
        menu.appendChild(placeholder);

        const telescopes = DataManager.getTelescopes();
        Object.keys(telescopes).forEach(name => {
            const item = document.createElement('div');
            item.className = 'astryx-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            menu.appendChild(item);
        });

        // Refresh event for when telescopes are added/deleted
        if (!this._telescopesHandler) {
            this._telescopesHandler = () => this.populateTelescopeDropdown();
            document.addEventListener('telescopes-updated', this._telescopesHandler);
        }
    },

    /**
     * Populate sensor dropdown
     */
    populateSensorDropdown() {
        const menu = document.getElementById('fov-sensor-menu');
        if (!menu) return;

        menu.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'astryx-dropdown-item';
        placeholder.dataset.value = '';
        placeholder.textContent = 'Select sensor...';
        menu.appendChild(placeholder);

        const sensors = DataManager.getSensors();
        Object.keys(sensors).forEach(name => {
            const item = document.createElement('div');
            item.className = 'astryx-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            menu.appendChild(item);
        });

        // Refresh event for when sensors are added/deleted
        if (!this._sensorsHandler) {
            this._sensorsHandler = () => this.populateSensorDropdown();
            document.addEventListener('sensors-updated', this._sensorsHandler);
        }
    },

    /**
     * Load saved telescope/sensor selections
     */
    loadSavedSelections() {
        const savedTelescope = SettingsManager.getSelectedTelescope();
        const savedSensor = SettingsManager.getSelectedSensor();

        if (savedTelescope) {
            const label = document.getElementById('fov-telescope-label');
            if (label) label.textContent = savedTelescope;
        }

        if (savedSensor) {
            const label = document.getElementById('fov-sensor-label');
            if (label) label.textContent = savedSensor;
        }

        // Calculate if both are selected
        if (savedTelescope && savedSensor) {
            this.calculate();
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Telescope selection
        const telescopeTrigger = document.getElementById('fov-telescope-trigger');
        const telescopeDropdown = document.getElementById('fov-telescope-dropdown');
        const telescopeMenu = document.getElementById('fov-telescope-menu');
        if (telescopeTrigger && telescopeDropdown && telescopeMenu) {
            telescopeTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                telescopeDropdown.classList.toggle('open');
                document.getElementById('fov-sensor-dropdown')?.classList.remove('open');
            });
            telescopeMenu.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = e.target.closest('.astryx-dropdown-item');
                if (!item) return;
                const value = item.dataset.value;
                const label = document.getElementById('fov-telescope-label');
                if (label) label.textContent = value || 'Select telescope...';
                telescopeDropdown.classList.remove('open');
                await SettingsManager.setSelectedTelescope(value || null);
                this.calculate();
            });
        }

        // Sensor selection
        const sensorTrigger = document.getElementById('fov-sensor-trigger');
        const sensorDropdown = document.getElementById('fov-sensor-dropdown');
        const sensorMenu = document.getElementById('fov-sensor-menu');
        if (sensorTrigger && sensorDropdown && sensorMenu) {
            sensorTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                sensorDropdown.classList.toggle('open');
                document.getElementById('fov-telescope-dropdown')?.classList.remove('open');
            });
            sensorMenu.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = e.target.closest('.astryx-dropdown-item');
                if (!item) return;
                const value = item.dataset.value;
                const label = document.getElementById('fov-sensor-label');
                if (label) label.textContent = value || 'Select sensor...';
                sensorDropdown.classList.remove('open');
                await SettingsManager.setSelectedSensor(value || null);
                this.calculate();
            });
        }

        // Show moon checkbox
        const showMoonCheckbox = document.getElementById('fov-show-moon');
        if (showMoonCheckbox) {
            showMoonCheckbox.addEventListener('change', (e) => {
                FOVCanvas.setShowMoon(e.target.checked);
                if (this.largerMode) this.redrawLargeMode(this.largeFOVData);
                else this.calculate();
            });
        }

        // Target outline toggle
        const showTargetCheckbox = document.getElementById('fov-show-target');
        if (showTargetCheckbox) {
            showTargetCheckbox.addEventListener('change', (e) => {
                this.showTarget = e.target.checked;
                if (this.largerMode) this.redrawLargeMode(this.largeFOVData);
                else this.calculate();
            });
        }

        // Crosshair toggle
        const showCrosshairCheckbox = document.getElementById('fov-show-crosshair');
        if (showCrosshairCheckbox) {
            showCrosshairCheckbox.addEventListener('change', (e) => {
                FOVCanvas.showCrosshair = e.target.checked;
                if (this.largerMode) this.redrawLargeMode(this.largeFOVData);
                else this.calculate();
            });
        }

        // DSS background toggle
        const showDSSCheckbox = document.getElementById('fov-show-dss');
        if (showDSSCheckbox) {
            showDSSCheckbox.addEventListener('change', async (e) => {
                this.showDSS = e.target.checked;
                if (!this.showDSS) FOVCanvas.dssImage = null;
                await this.calculate();
            });
        }

        // Wider mode toggle
        const modeToggle = document.getElementById('fov-mode-toggle');
        if (modeToggle) {
            modeToggle.addEventListener('click', (e) => {
                const option = e.target.closest('.fov-mode-option');
                if (!option) return;
                modeToggle.querySelectorAll('.fov-mode-option').forEach(el => el.classList.remove('active'));
                option.classList.add('active');
                this.largerMode = option.dataset.mode === 'larger';
                if (this.largerMode) {
                    // Wider centers on the current center, dragged-to or target — Issue #223
                    // Save current checkbox states before switching to wider
                    this.actualModeState = {
                        showTarget: document.getElementById('fov-show-target')?.checked,
                        showMoon: document.getElementById('fov-show-moon')?.checked
                    };
                    // Uncheck target and moon for wider mode
                    const showTarget = document.getElementById('fov-show-target');
                    const showMoon = document.getElementById('fov-show-moon');
                    if (showTarget) { showTarget.checked = false; this.showTarget = false; }
                    if (showMoon) { showMoon.checked = false; FOVCanvas.setShowMoon(false); }
                } else {
                    // Restore checkbox states when returning to actual
                    if (this.actualModeState) {
                        const showTarget = document.getElementById('fov-show-target');
                        const showMoon = document.getElementById('fov-show-moon');
                        if (showTarget) { showTarget.checked = this.actualModeState.showTarget; this.showTarget = this.actualModeState.showTarget; }
                        if (showMoon) { showMoon.checked = this.actualModeState.showMoon; FOVCanvas.setShowMoon(this.actualModeState.showMoon); }
                    }

                    // A dragged frame becomes the new center, and the original
                    // target stops being the reference — Issue #96
                    if (FOVCanvas.dragBox && this.largeFOVData && this._boxDragged) {
                        this._offsetCenter = this.dragBoxCenter(this.largeFOVData);
                        this.applyOffTargetState();
                    }

                    FOVCanvas.removeDragListeners();
                }
                this.calculate();
            });
        }

        // Rotation controls
        const rotInput = document.getElementById('fov-rotation-input');
        if (rotInput) {
            rotInput.addEventListener('input', () => {
                FOVCanvas.dragBoxAngle = parseFloat(rotInput.value) || 0;
                if (this.largerMode) this.redrawLargeMode(this.largeFOVData);
                else this.drawActual(this.lastFOVData);
            });
        }

        const rotateCCW = document.getElementById('fov-rotate-ccw');
        if (rotateCCW) {
            let ccwInterval = null;
            let ccwTimeout = null;
            const stepCCW = () => {
                FOVCanvas.dragBoxAngle = ((FOVCanvas.dragBoxAngle - 1) % 360);
                if (rotInput) rotInput.value = FOVCanvas.dragBoxAngle;
                if (this.largerMode) this.redrawLargeMode(this.largeFOVData);
                else this.drawActual(this.lastFOVData);
            };
            const stopCCW = () => {
                clearTimeout(ccwTimeout);
                clearInterval(ccwInterval);
                ccwTimeout = null;
                ccwInterval = null;
            };
            rotateCCW.addEventListener('mousedown', () => {
                stepCCW();
                ccwTimeout = setTimeout(() => {
                    ccwInterval = setInterval(stepCCW, 50);
                }, 500);
            });
            rotateCCW.addEventListener('mouseup', stopCCW);
            rotateCCW.addEventListener('mouseleave', stopCCW);
        }

        const rotateCW = document.getElementById('fov-rotate-cw');
        if (rotateCW) {
            let cwInterval = null;
            let cwTimeout = null;
            const stepCW = () => {
                FOVCanvas.dragBoxAngle = ((FOVCanvas.dragBoxAngle + 1) % 360);
                if (rotInput) rotInput.value = FOVCanvas.dragBoxAngle;
                if (this.largerMode) this.redrawLargeMode(this.largeFOVData);
                else this.drawActual(this.lastFOVData);
            };
            const stopCW = () => {
                clearTimeout(cwTimeout);
                clearInterval(cwInterval);
                cwTimeout = null;
                cwInterval = null;
            };
            rotateCW.addEventListener('mousedown', () => {
                stepCW();
                cwTimeout = setTimeout(() => {
                    cwInterval = setInterval(stepCW, 50);
                }, 500);
            });
            rotateCW.addEventListener('mouseup', stopCW);
            rotateCW.addEventListener('mouseleave', stopCW);
        }

        // Snapshot button
        const snapshotBtn = document.getElementById('fov-snapshot-btn');
        if (snapshotBtn) {
            snapshotBtn.addEventListener('click', () => this.takeSnapshot());
        }

        // Manage telescopes button
        const manageTelBtn = document.getElementById('fov-manage-telescopes-btn');
        if (manageTelBtn) {
            manageTelBtn.addEventListener('click', () => {
                UIManager.openManageTelescopesModal();
            });
        }

        // Manage sensors button
        const manageSensBtn = document.getElementById('fov-manage-sensors-btn');
        if (manageSensBtn) {
            manageSensBtn.addEventListener('click', () => {
                UIManager.openManageSensorsModal();
            });
        }
    },

    /**
     * Display current target info
     */
    displayTargetInfo() {
        const targetInfoDiv = document.getElementById('fov-target-info');
        if (!targetInfoDiv) return;

        if (!this.currentTarget) {
            targetInfoDiv.innerHTML = '<p class="fov-placeholder">No target selected. Please select a target from Target Selection.</p>';
            return;
        }

        // Off target: the same rows, blank, so the card keeps its height
        if (this._offsetCenter) {
            const grid = document.createElement('div');
            grid.className = 'fov-target-rows';
            for (const label of ['Object:', 'Size:']) {
                const labelEl = document.createElement('strong');
                labelEl.textContent = label;
                const valueEl = document.createElement('span');
                valueEl.className = 'fov-target-value';
                valueEl.textContent = '—';
                grid.append(labelEl, valueEl);
            }
            targetInfoDiv.replaceChildren(grid);
            return;
        }

        const commonName = this.currentTarget.common ?? '';
        const sizeMax = parseFloat(this.currentTarget.size_max) || 0;
        const sizeMin = parseFloat(this.currentTarget.size_min) || 0;

        // The common name shares the Object line, so the card is the same
        // height for every target; a name too long for it ends in an ellipsis
        const objectText = commonName
            ? `${this.currentTarget.object} (${commonName})`
            : this.currentTarget.object;
        const rows = [
            ['Object:', objectText],
            ['Size:', sizeMax > 0 ? `${sizeMax.toFixed(1)} × ${sizeMin.toFixed(1)} arcmin` : 'Unknown']
        ];
        const grid = document.createElement('div');
        grid.className = 'fov-target-rows';
        for (const [label, value] of rows) {
            const labelEl = document.createElement('strong');
            labelEl.textContent = label;
            const valueEl = document.createElement('span');
            valueEl.className = 'fov-target-value';
            valueEl.textContent = value;
            valueEl.title = value;
            grid.append(labelEl, valueEl);
        }
        targetInfoDiv.replaceChildren(grid);
    },

    /**
     * Calculate and render FOV
     */
    async calculate() {
        const telescopeName = document.getElementById('fov-telescope-label')?.textContent?.trim();
        const sensorName = document.getElementById('fov-sensor-label')?.textContent?.trim();

        // Treat placeholder text as no selection
        const telescopeSelected = telescopeName && telescopeName !== 'Select telescope...';
        const sensorSelected = sensorName && sensorName !== 'Select sensor...';

        // Clear results if either is not selected
        if (!telescopeSelected || !sensorSelected) {
            this.clearResults();
            return;
        }

        const telescope = DataManager.getTelescope(telescopeName);
        const sensor = DataManager.getSensor(sensorName);

        if (!telescope || !sensor) {
            this.clearResults();
            return;
        }

        // Add names to objects for display
        telescope.name = telescopeName;
        sensor.name = sensorName;

        // Calculate FOV
        const fovData = FOVCalculations.calculateFOV(telescope, sensor);

        // Calculate field coverage if target exists
        let fieldCoverage = null;
        if (this.currentTarget && this.currentTarget.size_max && this.currentTarget.size_min && !this._offsetCenter) {
            const targetSizeMax = parseFloat(this.currentTarget.size_max);
            const targetSizeMin = parseFloat(this.currentTarget.size_min);

            // Condition 1: linear — largest target dimension vs smallest FOV dimension
            const fovSmaller = Math.min(fovData.fovWidthArcmin, fovData.fovHeightArcmin);
            const targetLarger = Math.max(targetSizeMax, targetSizeMin);
            const linearPct = (targetLarger / fovSmaller) * 100;

            // Condition 2: area — ellipse if dimensions differ, rectangle if same
            const isEllipse = targetSizeMax !== targetSizeMin;
            const targetArea = isEllipse
                ? Math.PI * (targetSizeMax / 2) * (targetSizeMin / 2)
                : targetSizeMax * targetSizeMin;
            const fovArea = fovData.fovWidthArcmin * fovData.fovHeightArcmin;
            const areaPct = (targetArea / fovArea) * 100;

            fieldCoverage = areaPct;

            // Toast if either condition triggered — once per unique combination
            const linearTriggered = linearPct > 70;
            const areaTriggered = areaPct > 50;

            if (linearTriggered || areaTriggered) {
                const toastKey = `${telescopeName}|${sensorName}|${this.currentTarget.object}`;
                if (toastKey !== this.lastToastKey) {
                    this.lastToastKey = toastKey;
                    // Suggest a focal length that would put the target at ~70% of the smaller FOV dimension
                    const targetOccupancy = 0.7;
                    const recommendedFL = Math.round(fovData.effectiveFocalLength * (fovSmaller / targetLarger) * targetOccupancy);

                    let msg = '';
                    if (linearTriggered && areaTriggered) {
                        msg = `Target spans ${linearPct.toFixed(0)}% of field width and occupies ${areaPct.toFixed(0)}% of field area. Consider a telescope with ~${recommendedFL}mm effective focal length for more context.`;
                    } else if (linearTriggered) {
                        msg = `Target spans ${linearPct.toFixed(0)}% of field width. Consider a telescope with ~${recommendedFL}mm effective focal length for more context.`;
                    } else {
                        msg = `Target occupies ${areaPct.toFixed(0)}% of field area. Consider a telescope with ~${recommendedFL}mm effective focal length for more context.`;
                    }
                    UIManager.showToast(msg, 'info', 10000);
                }
            }
        }

        // Store for rotation redraws and display
        this.lastFOVData = fovData;
        this.displayResults(fovData, fieldCoverage);

        FOVCanvas.sizeToFrame(fovData);
        this.drawActual(fovData);

        // Fetch and render DSS background if enabled
        if (this.showDSS && this.currentTarget) {
            if (this.largerMode) {
                await this.fetchAndRenderDSSLarge(fovData);
            } else {
                await this.fetchAndRenderDSS(fovData);
            }
        }

    },

    /**
     * Resize the view to its space and redraw it
     */
    refit() {
        if (!this.lastFOVData) return;
        FOVCanvas.sizeToFrame(this.lastFOVData);
        if (this.largerMode && this.largeFOVData) this.redrawLargeMode(this.largeFOVData);
        else this.drawActual(this.lastFOVData);
    },

    /**
     * Draw the Actual view: the frame with the sky turned by the camera angle
     */
    drawActual(fovData) {
        if (!fovData) return;
        const targetForCanvas = this.currentTarget && this.showTarget ? {
            ...this.currentTarget,
            size_max: parseFloat(this.currentTarget.size_max) || 0,
            size_min: parseFloat(this.currentTarget.size_min) || 0
        } : null;
        FOVCanvas.render(fovData, targetForCanvas);

        const moonNote = document.getElementById('fov-moon-note');
        if (moonNote) {
            moonNote.style.display = FOVCanvas.showMoon ? 'block' : 'none';
        }
        this.showActualModeCoords();
    },

    /**
     * Display calculation results
     */
    displayResults(fovData, fieldCoverage) {
        const resultsDiv = document.getElementById('fov-results');
        if (!resultsDiv) return;

        // Target rows only while the frame is centered on a target with a size
        const targetRows = fieldCoverage !== null ? `
                <strong>Target Size:</strong>
                <span>${Math.round((this.currentTarget.size_max*60)/fovData.resolution)} x ${Math.round((this.currentTarget.size_min*60)/fovData.resolution)} pixels</span>
` : '';

        resultsDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; align-items: center;">
                <strong>Effective Focal Length:</strong>
                <span>${fovData.effectiveFocalLength.toFixed(0)} mm</span>

                <strong>Field of View:</strong>
                <span>${fovData.fovWidth.toFixed(3)}° × ${fovData.fovHeight.toFixed(3)}°</span>

                <strong>Resolution:</strong>
                <span>${fovData.resolution.toFixed(2)} arcsec/pixel</span>

${targetRows}
                <strong>Dawes Limit:</strong>
                <span>${fovData.dawesLimit.toFixed(2)} arcsec</span>

                ${fieldCoverage !== null ? `
                <strong>Field Coverage:</strong>
                <span>${fieldCoverage.toFixed(1)}%</span>
                ` : ''}
            </div>
        `;
    },

    /**
     * Get cache key for DSS image
     */
    getDSSCacheKey(ra, dec, fovDeg, widthPx, heightPx) {
        return `dss_${ra.toFixed(4)}_${dec.toFixed(4)}_${fovDeg.toFixed(4)}_${widthPx}x${heightPx}`;
    },

    /**
     * Get cache key for larger DSS image (3x FOV)
     */
    getDSSLargeCacheKey(ra, dec, fovDeg, widthPx, heightPx) {
        return `dss_${ra.toFixed(4)}_${dec.toFixed(4)}_${fovDeg.toFixed(4)}_${widthPx}x${heightPx}_3x`;
    },

    /**
     * Get cached larger DSS image if still valid
     */
    async getDSSLargeFromCache(key) {
        return DSSCache.get(key, APP_CONFIG.DSS_LARGE_CACHE_DURATION);
    },

    /**
     * Store larger DSS image in cache
     */
    async saveDSSLargeToCache(key, dataUrl) {
        return DSSCache.save(key, dataUrl);
    },

    /**
     * Get cached DSS image if still valid
     */
    async getDSSFromCache(key) {
        return DSSCache.get(key, APP_CONFIG.DSS_CACHE_DURATION);
    },

    /**
     * Store DSS image in cache
     */
    async saveDSSToCache(key, dataUrl) {
        return DSSCache.save(key, dataUrl);
    },

    /**
     * Purge expired DSS cache entries
     */
    async purgeDSSCache() {
        return DSSCache.purge(APP_CONFIG.DSS_CACHE_DURATION);
    },

    /**
     * Purge both DSS cache tiers, but only if DSS_PURGE_CHECK_INTERVAL has
     * elapsed since the last check (Issue #221). Previously both purges ran
     * synchronously on every single cache miss — a full cache scan on nearly
     * every telescope switch. Now purge runs at most once per that interval,
     * tracked in-memory for the current app session.
     */
    async maybePurgeDSSCache() {
        const now = Date.now();
        if (now - this._lastPurgeCheck < APP_CONFIG.DSS_PURGE_CHECK_INTERVAL) return;
        this._lastPurgeCheck = now;
        await this.purgeDSSCache();
        await DSSCache.purge(APP_CONFIG.DSS_LARGE_CACHE_DURATION);
    },

    /**
     * Show a toast when DSS rendering totally fails — cache had nothing AND
     * the network fetch also failed (Issue #221). Cache-internal read errors
     * stay as console.warn only; this is only for the case where the user
     * would otherwise see no explanation for a blank/stale canvas.
     * Deduped per cache key so rapid retries (e.g. holding rotate) don't spam toasts.
     */
    notifyDSSRenderFailure(cacheKey) {
        if (this.lastDSSFailureToastKey === cacheKey) return;
        this.lastDSSFailureToastKey = cacheKey;
        UIManager.showToast('Could not load DSS background image — check your internet connection.', 'error', 8000);
    },

    /**
     * Fetch DSS image and draw on canvas
     */
    async fetchAndRenderDSS(fovData) {
        if (!this.currentTarget || !this.currentTarget.ra || !this.currentTarget.dec) {
            console.warn('No target coordinates for DSS fetch');
            return;
        }

        // Generation guard (Issue #221): if a newer fetchAndRenderDSS/fetchAndRenderDSSLarge
        // call starts before this one finishes, this call's result is stale and must not
        // paint the canvas — prevents rapid telescope switching from racing and showing
        // the wrong telescope's image.
        const myGeneration = ++this.dssRenderGeneration;

        const { raDeg, decDeg } = this.frameCenter();
        // A square covering the frame's diagonal, so the sky can turn inside
        // the frame without bare corners
        const fovDeg = Math.hypot(fovData.fovWidth, fovData.fovHeight);
        const sizePx = Math.round(APP_CONFIG.FOV_DSS_FRAME_PIXELS * fovDeg / Math.max(fovData.fovWidth, fovData.fovHeight));
        const cacheKey = this.getDSSCacheKey(raDeg, decDeg, fovDeg, sizePx, sizePx);

        // Check cache first
        let dataUrl = await this.getDSSFromCache(cacheKey);

        if (myGeneration !== this.dssRenderGeneration) return;

        if (!dataUrl) {
            const url = `${APP_CONFIG.APIS.DSS}` +
                `&ra=${raDeg.toFixed(6)}&dec=${decDeg.toFixed(6)}` +
                `&fov=${fovDeg.toFixed(6)}&width=${sizePx}&height=${sizePx}` +
                `&projection=TAN&format=jpg`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('DSS fetch failed:', response.status);
                    this.notifyDSSRenderFailure(cacheKey);
                    return;
                }
                const blob = await response.blob();
                dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                await this.saveDSSToCache(cacheKey, dataUrl);
                await this.maybePurgeDSSCache();
            } catch (e) {
                console.warn('DSS fetch error:', e);
                this.notifyDSSRenderFailure(cacheKey);
                return;
            }
        }

        if (myGeneration !== this.dssRenderGeneration) return;

        // Draw image on canvas
        const img = new Image();
        img.onload = () => {
            if (myGeneration !== this.dssRenderGeneration) return;
            FOVCanvas.dssImage = img;
            this.drawActual(fovData);
        };
        img.src = dataUrl;
    },

    /**
     * Fetch and render larger DSS image (3x FOV) for panning mode
     */
    async fetchAndRenderDSSLarge(fovData) {
        if (!this.currentTarget || !this.currentTarget.ra || !this.currentTarget.dec) {
            console.warn('No target coordinates for large DSS fetch');
            return;
        }

        // Generation guard (Issue #221) — see fetchAndRenderDSS for rationale.
        const myGeneration = ++this.dssRenderGeneration;

        // Centered on the current center, not the target, so each Wider →
        // drag → Actual moves one step across the sky
        const { raDeg, decDeg } = this.frameCenter();

        // The sensor's shape, 3x the FOV each way; the service applies the
        // fov to the longer side
        const longSide = Math.max(fovData.fovWidth, fovData.fovHeight);
        const fovDeg = longSide * 3;
        const widthPx = Math.round(APP_CONFIG.FOV_DSS_FRAME_PIXELS * fovData.fovWidth / longSide);
        const heightPx = Math.round(APP_CONFIG.FOV_DSS_FRAME_PIXELS * fovData.fovHeight / longSide);

        const cacheKey = this.getDSSLargeCacheKey(raDeg, decDeg, fovDeg, widthPx, heightPx);

        let dataUrl = await this.getDSSLargeFromCache(cacheKey);

        if (myGeneration !== this.dssRenderGeneration) return;

        if (!dataUrl) {
            const url = `${APP_CONFIG.APIS.DSS}` +
                `&ra=${raDeg.toFixed(6)}&dec=${decDeg.toFixed(6)}` +
                `&fov=${fovDeg.toFixed(6)}&width=${widthPx}&height=${heightPx}` +
                `&projection=TAN&format=jpg`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('Large DSS fetch failed:', response.status);
                    this.notifyDSSRenderFailure(cacheKey);
                    return;
                }
                const blob = await response.blob();
                dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                await this.saveDSSLargeToCache(cacheKey, dataUrl);
            } catch (e) {
                console.warn('Large DSS fetch error:', e);
                this.notifyDSSRenderFailure(cacheKey);
                return;
            }
        }

        if (myGeneration !== this.dssRenderGeneration) return;

        // Store for use by canvas drag rendering
        this.largeDSSDataUrl = dataUrl;
        this.largeFOVData = fovData;

        const img = new Image();
        img.onload = () => {
            if (myGeneration !== this.dssRenderGeneration) return;

            FOVCanvas.largeImage = img;

            this._widerCenter = { raDeg, decDeg };
            this._boxDragged = false;
            FOVCanvas.initDragBox();
            FOVCanvas.setupDragListeners(() => {
                this._boxDragged = true;
                this.redrawLargeMode(fovData);
            });
            this.redrawLargeMode(fovData);
        };
        img.src = dataUrl;
    },

    /**
     * Redraw the large mode canvas: background + drag box
     */
    redrawLargeMode(fovData) {
        FOVCanvas.clear();
        if (FOVCanvas.largeImage) {
            FOVCanvas.renderBackground(FOVCanvas.largeImage);
        }
        FOVCanvas.drawDragBox();
        FOVCanvas.drawNorthMarker(0);
        if (FOVCanvas.dragBox && this._widerCenter) {
            this.showCenterCoords(this.dragBoxCenter(fovData));
        }
    },

    /**
     * The center of the Actual frame: the dragged-to center once the frame
     * has moved, otherwise the target
     * @returns {{raDeg: number, decDeg: number}}
     */
    frameCenter() {
        return this._offsetCenter ?? { raDeg: this.currentTarget.ra * 15, decDeg: this.currentTarget.dec };
    },

    /**
     * RA/Dec of the drag box center, from its offset from the center of the
     * Wider image (3x the FOV, so 3x the arcsec per pixel). Flat
     * approximation; each step starts from the new center, so errors don't
     * build up.
     * @returns {{raDeg: number, decDeg: number}}
     */
    dragBoxCenter(fovData) {
        const canvas = FOVCanvas.canvas;
        const box = FOVCanvas.dragBox;
        const arcSecPerPixelX = (fovData.fovWidthArcmin * 60 * 3) / canvas.width;
        const arcSecPerPixelY = (fovData.fovHeightArcmin * 60 * 3) / canvas.height;

        // Offset in arcseconds (positive X = east = increasing RA, positive Y = north = increasing Dec)
        const offsetX = (canvas.width / 2 - (box.x + box.width / 2)) * arcSecPerPixelX;
        const offsetY = (canvas.height / 2 - (box.y + box.height / 2)) * arcSecPerPixelY;

        const { raDeg, decDeg } = this._widerCenter;
        const ra = raDeg + (offsetX / 3600) / Math.cos(decDeg * Math.PI / 180);
        return {
            raDeg: ((ra % 360) + 360) % 360,
            decDeg: Math.max(-90, Math.min(90, decDeg + offsetY / 3600))
        };
    },

    /**
     * Show the Actual frame's center
     */
    showActualModeCoords() {
        if (!this.currentTarget) return;
        this.showCenterCoords(this.frameCenter());
    },

    /**
     * Show RA/Dec in the Center coordinates box
     */
    showCenterCoords({ raDeg, decDeg }) {
        const el = document.getElementById('fov-center-coords');
        if (!el) return;

        const raHours = raDeg / 15;
        const raH = Math.floor(raHours);
        const raM = Math.floor((raHours - raH) * 60);
        const raS = ((raHours - raH) * 60 - raM) * 60;

        const decSign = decDeg >= 0 ? '+' : '-';
        const decAbs = Math.abs(decDeg);
        const decD = Math.floor(decAbs);
        const decM = Math.floor((decAbs - decD) * 60);
        const decS = ((decAbs - decD) * 60 - decM) * 60;

        const raStr = `${String(raH).padStart(2,'0')}h ${String(raM).padStart(2,'0')}m ${raS.toFixed(1).padStart(4,'0')}s`;
        const decStr = `${decSign}${String(decD).padStart(2,'0')}° ${String(decM).padStart(2,'0')}′ ${decS.toFixed(1).padStart(4,'0')}″`;

        el.textContent = `Center:\nRA:  ${raStr}\nDec: ${decStr}`;
        el.style.display = 'block';
    },

    /**
     * Once the frame has moved off the target, the target no longer
     * describes what's in it: blank the Current Target card and turn off
     * Target size
     */
    applyOffTargetState() {
        this.displayTargetInfo();
        const showTarget = document.getElementById('fov-show-target');
        if (showTarget) {
            showTarget.checked = false;
            showTarget.disabled = true;
        }
        this.showTarget = false;
    },

    /**
     * Take a snapshot of the current framing and display in a modal
     */
    takeSnapshot() {
        const angle = (FOVCanvas.dragBoxAngle || 0) * Math.PI / 180;
        const srcCanvas = FOVCanvas.canvas;
        const w = srcCanvas.width;
        const h = srcCanvas.height;

        // Create offscreen canvas for the snapshot
        const snapCanvas = document.createElement('canvas');

        if (this.largerMode && FOVCanvas.dragBox) {
            const box = FOVCanvas.dragBox;
            snapCanvas.width = box.width;
            snapCanvas.height = box.height;
            const snapCtx = snapCanvas.getContext('2d');
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;

            // Fill black for areas outside image
            snapCtx.fillStyle = '#000000';
            snapCtx.fillRect(0, 0, box.width, box.height);

            // Translate to center of snap, rotate opposite to box angle, draw source
            snapCtx.save();
            snapCtx.translate(box.width / 2, box.height / 2);
            snapCtx.rotate(-angle);
            snapCtx.drawImage(srcCanvas, -cx, -cy);
            snapCtx.restore();
        } else {
            // Actual mode — the canvas is the frame, already turned
            snapCanvas.width = w;
            snapCanvas.height = h;
            snapCanvas.getContext('2d').drawImage(srcCanvas, 0, 0);
        }

        // Show in modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); z-index: 99998;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
        `;

        const img = document.createElement('img');
        img.src = snapCanvas.toDataURL('image/jpeg', 0.92);
        img.style.cssText = `max-width: 90vw; max-height: 80vh; border: 2px solid var(--border-color); border-radius: 4px;`;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn-primary';
        closeBtn.addEventListener('click', () => document.body.removeChild(overlay));

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
        document.body.appendChild(overlay);
    },

    /**
     * Clear results and canvas
     */
    clearResults() {
        const resultsDiv = document.getElementById('fov-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p class="fov-placeholder">Select telescope and sensor to calculate field of view.</p>';
        }
        FOVCanvas.clear();
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._telescopesHandler) {
            document.removeEventListener('telescopes-updated', this._telescopesHandler);
            this._telescopesHandler = null;
        }
        if (this._sensorsHandler) {
            document.removeEventListener('sensors-updated', this._sensorsHandler);
            this._sensorsHandler = null;
        }
        if (this._targetChangedHandler) {
            document.removeEventListener('current-target-changed', this._targetChangedHandler);
            this._targetChangedHandler = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._windowResizeHandler) {
            window.removeEventListener('resize', this._windowResizeHandler);
            this._windowResizeHandler = null;
        }
    }
};
