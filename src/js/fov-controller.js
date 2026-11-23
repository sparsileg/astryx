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
        this._shownCenter = null;
        this._boxDragged = false;
        this._targetInView = true;
        this.lastDSSFailureToastKey = null;
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
            modeToggle.querySelectorAll('.mode-toggle-option').forEach(el => {
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
                if (!this.showDSS) {
                    FOVCanvas.dssImage = null;
                    // An image still downloading is no longer wanted
                    this.dssRenderGeneration++;
                    this.hideSkyLoading();
                }
                await this.calculate();
            });
        }

        // Wider mode toggle
        const modeToggle = document.getElementById('fov-mode-toggle');
        if (modeToggle) {
            modeToggle.addEventListener('click', (e) => {
                const option = e.target.closest('.mode-toggle-option');
                if (!option) return;
                modeToggle.querySelectorAll('.mode-toggle-option').forEach(el => el.classList.remove('active'));
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

        // Target out of the frame: the same rows, blank, so the card keeps its height
        if (!this._targetInView) {
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

        const storedTelescope = DataManager.getTelescope(telescopeName);
        const storedSensor = DataManager.getSensor(sensorName);

        if (!storedTelescope || !storedSensor) {
            this.clearResults();
            return;
        }

        // Copies with the names for display; the stored objects stay as saved (Issue #331)
        const telescope = { ...storedTelescope, name: telescopeName };
        const sensor = { ...storedSensor, name: sensorName };

        // Calculate FOV
        const fovData = FOVCalculations.calculateFOV(telescope, sensor);

        // Field coverage while the target is in the frame
        const fieldCoverage = this.getFieldCoverage(fovData);
        if (fieldCoverage !== null) {
            // Condition 1: linear — largest target dimension vs smallest FOV dimension
            const fovSmaller = Math.min(fovData.fovWidthArcmin, fovData.fovHeightArcmin);
            const targetLarger = Math.max(parseFloat(this.currentTarget.size_max), parseFloat(this.currentTarget.size_min));
            const linearPct = (targetLarger / fovSmaller) * 100;

            // Condition 2: area
            const areaPct = fieldCoverage;

            // Toast if either condition triggered — once per unique combination
            const linearTriggered = linearPct > APP_CONFIG.FOV_LARGE_TARGET_WIDTH_PCT;
            const areaTriggered = areaPct > APP_CONFIG.FOV_LARGE_TARGET_AREA_PCT;

            if (linearTriggered || areaTriggered) {
                const toastKey = `${telescopeName}|${sensorName}|${this.currentTarget.object}`;
                if (toastKey !== this.lastToastKey) {
                    this.lastToastKey = toastKey;
                    // Suggest a focal length that would put the target at FOV_SUGGESTED_TARGET_FRACTION of the smaller FOV dimension
                    const recommendedFL = Math.round(fovData.effectiveFocalLength * (fovSmaller / targetLarger) * APP_CONFIG.FOV_SUGGESTED_TARGET_FRACTION);

                    let msg = '';
                    if (linearTriggered && areaTriggered) {
                        msg = `Target spans ${linearPct.toFixed(0)}% of field width and occupies ${areaPct.toFixed(0)}% of field area. Consider a telescope with ~${recommendedFL}mm effective focal length for more context.`;
                    } else if (linearTriggered) {
                        msg = `Target spans ${linearPct.toFixed(0)}% of field width. Consider a telescope with ~${recommendedFL}mm effective focal length for more context.`;
                    } else {
                        msg = `Target occupies ${areaPct.toFixed(0)}% of field area. Consider a telescope with ~${recommendedFL}mm effective focal length for more context.`;
                    }
                    UIManager.showToast(msg, 'info', APP_CONFIG.TOAST_LONG_DURATION_MS);
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
        // Turning the camera can bring the target into the frame or take it out
        const inView = this.isTargetInView(fovData);
        if (inView !== this._targetInView) {
            this._targetInView = inView;
            this.applyTargetInViewState(fovData);
        }
        const offset = this.targetFrameOffset() ?? { skyX: 0, skyY: 0 };
        const targetForCanvas = this.currentTarget && this.showTarget && inView ? {
            ...this.currentTarget,
            size_max: parseFloat(this.currentTarget.size_max) || 0,
            size_min: parseFloat(this.currentTarget.size_min) || 0,
            skyX: offset.skyX,
            skyY: offset.skyY
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
                <strong class="tooltip-host has-tip" data-tooltip-key="fov_efl">Effective Focal Length:</strong>
                <span>${fovData.effectiveFocalLength.toFixed(0)} mm</span>

                <strong>Field of View:</strong>
                <span>${fovData.fovWidth.toFixed(3)}° × ${fovData.fovHeight.toFixed(3)}°</span>

                <strong class="tooltip-host has-tip" data-tooltip-key="fov_resolution">Resolution:</strong>
                <span>${fovData.resolution.toFixed(2)} arcsec/pixel</span>

${targetRows}
                <strong class="tooltip-host has-tip" data-tooltip-key="fov_dawes">Dawes Limit:</strong>
                <span>${fovData.dawesLimit.toFixed(2)} arcsec</span>

                ${fieldCoverage !== null ? `
                <strong class="tooltip-host has-tip" data-tooltip-key="fov_coverage">Field Coverage:</strong>
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
        return `dss_${ra.toFixed(4)}_${dec.toFixed(4)}_${fovDeg.toFixed(4)}_${widthPx}x${heightPx}${APP_CONFIG.DSS_LARGE_KEY_SUFFIX}`;
    },

    /**
     * Get cached larger DSS image if still valid
     */
    async getDSSLargeFromCache(key) {
        return DSSCache.get(key);
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
        return DSSCache.get(key);
    },

    /**
     * Store DSS image in cache
     */
    async saveDSSToCache(key, dataUrl) {
        return DSSCache.save(key, dataUrl);
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
        UIManager.showToast('Could not load the DSS sky image: no sky survey server answered. Check your internet connection, or try again later.', 'error', APP_CONFIG.TOAST_LONG_DURATION_MS);
    },

    /**
     * Show the sky image progress panel over the canvas, at no tiles yet
     */
    showSkyLoading() {
        const panel = document.getElementById('fov-sky-loading');
        if (!panel) return;
        document.getElementById('fov-sky-loading-text').textContent = 'Loading sky image…';
        document.getElementById('fov-sky-loading-bar').style.width = '0%';
        document.getElementById('fov-sky-loading-note').textContent = '';
        panel.classList.add('active');
    },

    hideSkyLoading() {
        document.getElementById('fov-sky-loading')?.classList.remove('active');
    },

    /**
     * Progress handler for one image build; ignored once a newer image is wanted
     */
    skyLoadingProgress(generation) {
        return event => {
            if (generation !== this.dssRenderGeneration) return;
            const text = document.getElementById('fov-sky-loading-text');
            const bar = document.getElementById('fov-sky-loading-bar');
            const note = document.getElementById('fov-sky-loading-note');
            if (!text || !bar || !note) return;
            if (event.building) {
                text.textContent = 'Building image…';
                bar.style.width = '100%';
                note.textContent = '';
            } else if (event.skipped) {
                note.textContent = `${event.skipped} isn't answering, trying ${event.next}…`;
            } else {
                text.textContent = `Loading sky image… ${event.loaded} of ${event.total} tiles`;
                bar.style.width = `${event.total ? 100 * event.loaded / event.total : 0}%`;
            }
        };
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
        this.hideSkyLoading();

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
            this.showSkyLoading();
            try {
                dataUrl = await FOVHips.buildImage({ raDeg, decDeg, fovDeg, width: sizePx, height: sizePx },
                    this.skyLoadingProgress(myGeneration));
                await this.saveDSSToCache(cacheKey, dataUrl);
            } catch (e) {
                console.warn('DSS image failed:', e);
                this.notifyDSSRenderFailure(cacheKey);
                return;
            } finally {
                if (myGeneration === this.dssRenderGeneration) this.hideSkyLoading();
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
        this.hideSkyLoading();

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
            this.showSkyLoading();
            try {
                dataUrl = await FOVHips.buildImage({ raDeg, decDeg, fovDeg, width: widthPx, height: heightPx },
                    this.skyLoadingProgress(myGeneration));
                await this.saveDSSLargeToCache(cacheKey, dataUrl);
            } catch (e) {
                console.warn('Wider DSS image failed:', e);
                this.notifyDSSRenderFailure(cacheKey);
                return;
            } finally {
                if (myGeneration === this.dssRenderGeneration) this.hideSkyLoading();
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
     * RA as "06h 17m 13.0s" and Dec as "+22° 31′ 05.0″", as the Center box
     * and the snapshot caption show them
     * @returns {{ra: string, dec: string}}
     */
    formatCenterCoords({ raDeg, decDeg }) {
        const raHours = raDeg / 15;
        const raH = Math.floor(raHours);
        const raM = Math.floor((raHours - raH) * 60);
        const raS = ((raHours - raH) * 60 - raM) * 60;

        const decSign = decDeg >= 0 ? '+' : '-';
        const decAbs = Math.abs(decDeg);
        const decD = Math.floor(decAbs);
        const decM = Math.floor((decAbs - decD) * 60);
        const decS = ((decAbs - decD) * 60 - decM) * 60;

        return {
            ra: `${String(raH).padStart(2,'0')}h ${String(raM).padStart(2,'0')}m ${raS.toFixed(1).padStart(4,'0')}s`,
            dec: `${decSign}${String(decD).padStart(2,'0')}° ${String(decM).padStart(2,'0')}′ ${decS.toFixed(1).padStart(4,'0')}″`
        };
    },

    /**
     * Show RA/Dec in the Center coordinates box, and keep it for the
     * snapshot caption
     */
    showCenterCoords(center) {
        const el = document.getElementById('fov-center-coords');
        if (!el) return;
        this._shownCenter = center;
        const { ra, dec } = this.formatCenterCoords(center);
        el.textContent = `Center:\nRA:  ${ra}\nDec: ${dec}`;
        el.style.display = 'block';
    },

    /**
     * The target's offset in the frame once the frame has been dragged off
     * it; null while the frame is centered on the target
     */
    targetFrameOffset() {
        if (!this._offsetCenter || !this.currentTarget) return null;
        return FOVCalculations.getTargetFrameOffset(this._offsetCenter, this.currentTarget, FOVCanvas.dragBoxAngle || 0);
    },

    /**
     * Whether the target still describes the frame: its center is inside
     * the frame, wherever the frame was dragged (Issue #96)
     */
    isTargetInView(fovData) {
        const offset = this.targetFrameOffset();
        return offset === null || FOVCalculations.isInFrame(offset, fovData);
    },

    /**
     * Percent of the field's area the target fills, as the ellipse the
     * canvas draws (a circle when both sizes are equal; Issue #331); null
     * without a target size or with the target out of the frame
     */
    getFieldCoverage(fovData) {
        if (!this.currentTarget?.size_max || !this.currentTarget?.size_min || !this.isTargetInView(fovData)) return null;
        const sizeMax = parseFloat(this.currentTarget.size_max);
        const sizeMin = parseFloat(this.currentTarget.size_min);
        const targetArea = Math.PI * (sizeMax / 2) * (sizeMin / 2);
        return (targetArea / (fovData.fovWidthArcmin * fovData.fovHeightArcmin)) * 100;
    },

    /**
     * With the target out of the frame, it no longer describes what's in
     * it: blank the Current Target card, drop the target rows from the
     * results, and turn off Target size. Back in the frame, restore them.
     */
    applyTargetInViewState(fovData) {
        this.displayTargetInfo();
        this.displayResults(fovData, this.getFieldCoverage(fovData));
        const showTarget = document.getElementById('fov-show-target');
        if (this._targetInView) {
            if (showTarget) showTarget.disabled = false;
        } else {
            if (showTarget) {
                showTarget.checked = false;
                showTarget.disabled = true;
            }
            this.showTarget = false;
        }
    },

    /**
     * The snapshot caption: target, frame center and rotation, equipment.
     * Parts that aren't known are left out (#343).
     * @returns {string[]}
     */
    snapshotCaptionLines() {
        const lines = [];
        const target = this.currentTarget;
        if (target) {
            lines.push(target.common ? `${target.object} · ${target.common}` : target.object);
        }

        const rotation = (((FOVCanvas.dragBoxAngle || 0) % 360) + 360) % 360;
        const rotationText = `Rotation ${Number(rotation.toFixed(1))}°`;
        if (this._shownCenter) {
            const { ra, dec } = this.formatCenterCoords(this._shownCenter);
            lines.push(`Center: RA ${ra}  Dec ${dec}  ·  ${rotationText}`);
        } else {
            lines.push(rotationText);
        }

        const telescope = SettingsManager.getSelectedTelescope();
        const sensor = SettingsManager.getSelectedSensor();
        const equipment = [telescope && `Telescope: ${telescope}`, sensor && `Camera: ${sensor}`].filter(Boolean);
        if (equipment.length) lines.push(equipment.join('  ·  '));
        return lines;
    },

    /**
     * Draw the caption at the bottom left of the snapshot, on a box just
     * big enough for the text, so it's part of the saved image (#343). A
     * line wider than the snapshot ends in an ellipsis.
     */
    drawSnapshotCaption(canvas, lines) {
        if (lines.length === 0) return;
        const ctx = canvas.getContext('2d');
        const fontPx = Math.max(APP_CONFIG.FOV_SNAPSHOT_CAPTION_MIN_FONT_PX,
            Math.round(canvas.width * APP_CONFIG.FOV_SNAPSHOT_CAPTION_FONT_FRACTION));
        const lineHeight = fontPx * APP_CONFIG.FOV_SNAPSHOT_CAPTION_LINE_HEIGHT;
        const padding = fontPx * APP_CONFIG.FOV_SNAPSHOT_CAPTION_PADDING_EM;
        const margin = fontPx * APP_CONFIG.FOV_SNAPSHOT_CAPTION_MARGIN_EM;
        ctx.font = `${fontPx}px ${getComputedStyle(document.body).fontFamily}`;

        const maxTextWidth = canvas.width - 2 * (margin + padding);
        const fitted = lines.map(line => this._fitText(ctx, line, maxTextWidth));
        const boxWidth = Math.max(...fitted.map(line => ctx.measureText(line).width)) + 2 * padding;
        const boxHeight = fitted.length * lineHeight + 2 * padding;
        const boxX = margin;
        const boxY = canvas.height - margin - boxHeight;

        ctx.fillStyle = APP_CONFIG.FOV_SNAPSHOT_CAPTION_BACKGROUND;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.fillStyle = APP_CONFIG.FOV_SNAPSHOT_CAPTION_TEXT;
        ctx.textBaseline = 'middle';
        fitted.forEach((line, i) => {
            ctx.fillText(line, boxX + padding, boxY + padding + (i + 0.5) * lineHeight);
        });
    },

    /** The text, shortened with an ellipsis until it fits the width */
    _fitText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let shortened = text;
        while (shortened.length > 1 && ctx.measureText(shortened + '…').width > maxWidth) {
            shortened = shortened.slice(0, -1);
        }
        return shortened.trimEnd() + '…';
    },

    /**
     * Take a snapshot of the canvas as shown, captioned, and display it in
     * a modal. In Wider that's the whole wider view with the dashed frame,
     * at the same size as an Actual snapshot rather than cropped to the
     * frame's few screen pixels.
     */
    takeSnapshot() {
        const srcCanvas = FOVCanvas.canvas;
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = srcCanvas.width;
        snapCanvas.height = srcCanvas.height;
        snapCanvas.getContext('2d').drawImage(srcCanvas, 0, 0);

        this.drawSnapshotCaption(snapCanvas, this.snapshotCaptionLines());

        // Show in modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'fov-snapshot-overlay';
        const close = () => overlay.remove();

        const img = document.createElement('img');
        img.src = snapCanvas.toDataURL('image/jpeg', APP_CONFIG.FOV_SNAPSHOT_JPEG_QUALITY);
        // The webview's own menu would save or copy the image without a
        // usable name; the Save and Copy buttons do it properly
        img.addEventListener('contextmenu', e => e.preventDefault());

        const actions = document.createElement('div');
        actions.className = 'fov-snapshot-actions';
        const button = (id, label, className, onClick) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.className = className;
            btn.addEventListener('click', onClick);
            actions.appendChild(btn);
        };
        button('fov-snapshot-save', 'Save', 'btn-secondary', () => this.saveSnapshot(snapCanvas));
        if (this.canCopySnapshot()) {
            button('fov-snapshot-copy', 'Copy', 'btn-secondary', () => this.copySnapshot(snapCanvas));
        }
        button('fov-snapshot-close', 'Close', 'btn-primary', close);

        overlay.appendChild(img);
        overlay.appendChild(actions);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        document.body.appendChild(overlay);
    },

    /** The snapshot's default file name: the target's designation */
    snapshotFileName() {
        const name = this.currentTarget?.object ?? APP_CONFIG.FOV_SNAPSHOT_DEFAULT_NAME;
        // No spaces, and none of the characters a file name can't hold on
        // Windows, macOS or Linux
        return `${name.replace(/[\s\\/:*?"<>|]/g, '_')}.jpg`;
    },

    /** The canvas as a Blob of the given image type */
    _canvasBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('the image could not be made')), type, quality);
        });
    },

    /**
     * Save the snapshot as a JPEG: through a Save dialog that starts in
     * Downloads on desktop, as a download on the web
     */
    async saveSnapshot(canvas) {
        const fileName = this.snapshotFileName();
        try {
            const blob = await this._canvasBlob(canvas, 'image/jpeg', APP_CONFIG.FOV_SNAPSHOT_JPEG_QUALITY);
            if (typeof window.__TAURI__ === 'undefined') {
                BackupManagerWeb.downloadBlob(blob, fileName);
                return;
            }
            // Start in Downloads: a bare name opens the dialog in the app's
            // working folder, the source folder under `just dev`
            const { downloadDir, join } = window.__TAURI__.path;
            const path = await window.__TAURI__.dialog.save({
                defaultPath: await join(await downloadDir(), fileName),
                filters: [{ name: 'JPEG image', extensions: ['jpg', 'jpeg'] }]
            });
            if (!path) return; // cancelled
            await window.__TAURI__.fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
            UIManager.showToast(`Snapshot saved as ${path.split(/[/\\]/).pop()}`, 'success');
        } catch (error) {
            console.error('Snapshot save failed:', error);
            UIManager.showToast('Snapshot not saved: ' + (error.message ?? error), 'error');
        }
    },

    /** Whether this browser or webview can put an image on the clipboard */
    canCopySnapshot() {
        return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
    },

    /** Copy the snapshot to the clipboard as a PNG, the image type clipboards take */
    async copySnapshot(canvas) {
        try {
            const blob = await this._canvasBlob(canvas, 'image/png');
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            UIManager.showToast('Snapshot copied', 'success');
        } catch (error) {
            console.error('Snapshot copy failed:', error);
            UIManager.showToast('Snapshot not copied: ' + (error.message ?? error), 'error');
        }
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
