/**
 * fov-main.js
 * Field of View view controller
 */

const FOVView = {
    currentTarget: null,
    showDSS: false,
    showTarget: true,
    largerMode: false,
    actualModeState: null,
    dssLockedSize: null,
    lastToastKey: null,

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
        this.dssLockedSize = null;
        this.lastToastKey = null;
        this.largerMode = false;
        this.actualModeState = null;
        FOVCanvas.dssImage = null;
        FOVCanvas.dragBoxAngle = 0;

        // Initialize canvas
        FOVCanvas.init('fov-canvas');

        // Populate dropdowns
        this.populateTelescopeDropdown();
        this.populateSensorDropdown();

        // Load current target if available
        if (typeof VisibilityTargets !== 'undefined') {
            // Load last selected target if not already loaded
            if (!VisibilityTargets.currentTarget) {
                VisibilityTargets.loadLastTarget();
            }
            if (VisibilityTargets.currentTarget) {
                this.currentTarget = VisibilityTargets.currentTarget;
                this.displayTargetInfo();
            }
        }

        // Setup event listeners
        this.setupEventListeners();

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

        // Always show rotation control
        const rc = document.getElementById('fov-rotation-control');
        if (rc) rc.style.display = 'block';
        const rotInput = document.getElementById('fov-rotation-input');
        if (rotInput) rotInput.value = 0;

        // Load saved selections (will trigger calculate() if equipment is selected)
        this.loadSavedSelections();
    },

    /**
     * Populate telescope dropdown
     */
    populateTelescopeDropdown() {
        const dropdown = document.getElementById('fov-telescope-select');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select telescope...</option>';

        const telescopes = DataManager.getTelescopes();
        Object.keys(telescopes).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            dropdown.appendChild(option);
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
        const dropdown = document.getElementById('fov-sensor-select');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select sensor...</option>';

        const sensors = DataManager.getSensors();
        Object.keys(sensors).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            dropdown.appendChild(option);
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
            const dropdown = document.getElementById('fov-telescope-select');
            if (dropdown) dropdown.value = savedTelescope;
        }

        if (savedSensor) {
            const dropdown = document.getElementById('fov-sensor-select');
            if (dropdown) dropdown.value = savedSensor;
        }

        // Calculate if both are selected
        if (savedTelescope && savedSensor) {
            if (this.showDSS) {
                this.lockCanvasSize();
            }
            this.calculate();
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Telescope selection
        const telescopeSelect = document.getElementById('fov-telescope-select');
        if (telescopeSelect) {
            telescopeSelect.addEventListener('change', async (e) => {
                await SettingsManager.setSelectedTelescope(e.target.value || null);
                this.calculate();
            });
        }

        // Sensor selection
        const sensorSelect = document.getElementById('fov-sensor-select');
        if (sensorSelect) {
            sensorSelect.addEventListener('change', async (e) => {
                await SettingsManager.setSelectedSensor(e.target.value || null);
                this.calculate();
            });
        }

        // Show moon checkbox
        const showMoonCheckbox = document.getElementById('fov-show-moon');
        if (showMoonCheckbox) {
            showMoonCheckbox.addEventListener('change', (e) => {
                FOVCanvas.setShowMoon(e.target.checked);
                this.calculate();
            });
        }

        // Target outline toggle
        const showTargetCheckbox = document.getElementById('fov-show-target');
        if (showTargetCheckbox) {
            showTargetCheckbox.addEventListener('change', (e) => {
                this.showTarget = e.target.checked;
                this.calculate();
            });
        }

        // Crosshair toggle
        const showCrosshairCheckbox = document.getElementById('fov-show-crosshair');
        if (showCrosshairCheckbox) {
            showCrosshairCheckbox.addEventListener('change', (e) => {
                FOVCanvas.showCrosshair = e.target.checked;
                this.calculate();
            });
        }

        // DSS background toggle
        const showDSSCheckbox = document.getElementById('fov-show-dss');
        if (showDSSCheckbox) {
            showDSSCheckbox.addEventListener('change', async (e) => {
                this.showDSS = e.target.checked;
                if (this.showDSS) {
                    this.lockCanvasSize();
                    await this.calculate();
                } else {
                    FOVCanvas.dssImage = null;
                    this.unlockCanvasSize();
                    this.calculate();
                }
            });
        }

        // Larger mode toggle
        const modeToggle = document.getElementById('fov-mode-toggle');
        if (modeToggle) {
            modeToggle.addEventListener('click', (e) => {
                const option = e.target.closest('.fov-mode-option');
                if (!option) return;
                modeToggle.querySelectorAll('.fov-mode-option').forEach(el => el.classList.remove('active'));
                option.classList.add('active');
                this.largerMode = option.dataset.mode === 'larger';
                if (this.largerMode) {
                    // Save current checkbox states before switching to larger
                    this.actualModeState = {
                        showTarget: document.getElementById('fov-show-target')?.checked,
                        showMoon: document.getElementById('fov-show-moon')?.checked
                    };
                    // Uncheck target and moon for larger mode
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
                    const el = document.getElementById('fov-center-coords');
                    if (el) el.style.display = 'none';
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
                else if (this.showDSS && this.currentTarget) this.fetchAndRenderDSS(this.lastFOVData);
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
                else if (this.showDSS && this.currentTarget) this.fetchAndRenderDSS(this.lastFOVData);
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
                else if (this.showDSS && this.currentTarget) this.fetchAndRenderDSS(this.lastFOVData);
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
            targetInfoDiv.innerHTML = '<p style="color: var(--text-secondary);">No target selected. Please select a target from Target Selection.</p>';
            return;
        }

        const commonName = this.currentTarget.common || '';
        const sizeMax = parseFloat(this.currentTarget.size_max) || 0;
        const sizeMin = parseFloat(this.currentTarget.size_min) || 0;

        targetInfoDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; align-items: center;">
                <strong>Object:</strong>
                <span>${this.currentTarget.object}</span>

                ${commonName ? `
                    <strong>Name:</strong>
                    <span>${commonName}</span>
                ` : ''}

                <strong>Size:</strong>
                <span>${sizeMax > 0 ? `${sizeMax.toFixed(1)} × ${sizeMin.toFixed(1)} arcmin` : 'Unknown'}</span>
            </div>
        `;
    },

    /**
     * Calculate and render FOV
     */
    async calculate() {
        const telescopeName = document.getElementById('fov-telescope-select')?.value;
        const sensorName = document.getElementById('fov-sensor-select')?.value;

        // Clear results if either is not selected
        if (!telescopeName || !sensorName) {
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

        // Store effective focal length for target fit check
        FOVCalculations.effectiveFocalLength = fovData.effectiveFocalLength;

        // Calculate field coverage if target exists
        let fieldCoverage = null;
        if (this.currentTarget && this.currentTarget.size_max && this.currentTarget.size_min) {
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

        // Prepare target data with numeric sizes for canvas rendering
        const targetForCanvas = this.currentTarget && this.showTarget ? {
            ...this.currentTarget,
            size_max: parseFloat(this.currentTarget.size_max) || 0,
            size_min: parseFloat(this.currentTarget.size_min) || 0
        } : null;

        // Render canvas
        FOVCanvas.render(fovData, targetForCanvas);

        // Render canvas
        const moonNote = document.getElementById('fov-moon-note');
        if (moonNote) {
            moonNote.style.display = FOVCanvas.showMoon ? 'block' : 'none';
        }

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
     * Display calculation results
     */
    displayResults(fovData, fieldCoverage) {
        const resultsDiv = document.getElementById('fov-results');
        if (!resultsDiv) return;

        const tgtHeight = Math.round((this.currentTarget.size_max*60)/fovData.resolution);
        const tgtWidth = Math.round((this.currentTarget.size_min*60)/fovData.resolution);

        resultsDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; align-items: center;">
                <strong>Effective Focal Length:</strong>
                <span>${fovData.effectiveFocalLength.toFixed(0)} mm</span>

                <strong>Field of View:</strong>
                <span>${fovData.fovWidth.toFixed(3)}° × ${fovData.fovHeight.toFixed(3)}°</span>

                <strong>Resolution:</strong>
                <span>${fovData.resolution.toFixed(2)} arcsec/pixel</span>

                <strong>Target Size:</strong>
                <span>${tgtHeight} x ${tgtWidth} pixels</span>

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
    getDSSCacheKey(ra, dec, fovDeg) {
        return `dss_${ra.toFixed(4)}_${dec.toFixed(4)}_${fovDeg.toFixed(4)}`;
    },

    /**
     * Get cache key for larger DSS image (3x FOV)
     */
    getDSSLargeCacheKey(ra, dec, fovDeg) {
        return `dss_${ra.toFixed(4)}_${dec.toFixed(4)}_${fovDeg.toFixed(4)}_3x`;
    },

    /**
     * Get cached larger DSS image if still valid (1 day expiry)
     */
    async getDSSLargeFromCache(key) {
        try {
            const cached = await DBManager.get('dssCache', key);
            if (!cached) return null;
            const age = Date.now() - cached.lastAccessed;
            if (age > 24 * 60 * 60 * 1000) { // 1 day
                await DBManager.delete('dssCache', key);
                return null;
            }
            await DBManager.put('dssCache', { ...cached, lastAccessed: Date.now() });
            return cached.dataUrl;
        } catch (e) {
            return null;
        }
    },

    /**
     * Store larger DSS image in cache (1 day expiry)
     */
    async saveDSSLargeToCache(key, dataUrl) {
        try {
            await DBManager.put('dssCache', {
                id: key,
                dataUrl: dataUrl,
                timestamp: Date.now(),
                lastAccessed: Date.now()
            });
        } catch (e) {
            console.warn('Failed to cache large DSS image:', e);
        }
    },

    /**
     * Get cached DSS image if still valid
     */
    async getDSSFromCache(key) {
        try {
            const cached = await DBManager.get('dssCache', key);
            if (!cached) return null;
            const age = Date.now() - cached.lastAccessed;
            if (age > APP_CONFIG.DSS_CACHE_DURATION) {
                await DBManager.delete('dssCache', key);
                return null;
            }
            // Reset lastAccessed on every view
            await DBManager.put('dssCache', { ...cached, lastAccessed: Date.now() });
            return cached.dataUrl;
        } catch (e) {
            return null;
        }
    },

    /**
     * Store DSS image in cache
     */
    async saveDSSToCache(key, dataUrl) {
        try {
            await DBManager.put('dssCache', {
                id: key,
                dataUrl: dataUrl,
                timestamp: Date.now(),
                lastAccessed: Date.now()
            });
        } catch (e) {
            console.warn('Failed to cache DSS image:', e);
        }
    },

    /**
     * Purge DSS cache entries not accessed in 15 days
     */
    async purgeDSSCache() {
        try {
            const all = await DBManager.getAll('dssCache');
            const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
            for (const entry of all) {
                const lastAccessed = entry.lastAccessed || entry.timestamp;
                if (lastAccessed < cutoff) {
                    await DBManager.delete('dssCache', entry.id);
                }
            }
        } catch (e) {
            console.warn('Failed to purge DSS cache:', e);
        }
    },

    /**
     * Fetch DSS image and draw on canvas
     */
    async fetchAndRenderDSS(fovData) {
        if (!this.currentTarget || !this.currentTarget.ra || !this.currentTarget.dec) {
            console.warn('No target coordinates for DSS fetch');
            return;
        }

        // Convert RA from hours to degrees
        const raDeg = this.currentTarget.ra * 15;
        const decDeg = this.currentTarget.dec;

        const canvas = FOVCanvas.canvas;
        const width = canvas.width;
        const height = canvas.height;

        // Use the larger FOV dimension for the query
        const fovDeg = Math.max(fovData.fovWidth, fovData.fovHeight);

        const cacheKey = this.getDSSCacheKey(raDeg, decDeg, fovDeg);

        // Check cache first
        let dataUrl = await this.getDSSFromCache(cacheKey);

        if (!dataUrl) {
            const url = `${APP_CONFIG.APIS.DSS}` +
                `&ra=${raDeg.toFixed(6)}&dec=${decDeg.toFixed(6)}` +
                `&fov=${fovDeg.toFixed(6)}&width=600&height=600` +
                `&projection=TAN&format=jpg`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('DSS fetch failed:', response.status);
                    return;
                }
                const blob = await response.blob();
                dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                await this.saveDSSToCache(cacheKey, dataUrl);
                await this.purgeDSSCache();
            } catch (e) {
                console.warn('DSS fetch error:', e);
                return;
            }
        }

        // Draw image on canvas
        const img = new Image();
        img.onload = () => {
            FOVCanvas.clear();

            const width = FOVCanvas.canvas.width;
            const height = FOVCanvas.canvas.height;
            const angle = (FOVCanvas.dragBoxAngle || 0) * Math.PI / 180;
            const scaleX = width / fovData.fovWidthArcmin;
            const scaleY = height / fovData.fovHeightArcmin;

            // Draw image unrotated (north always up)
            FOVCanvas.renderBackground(img);

            // Rotate overlays around center to show camera orientation
            FOVCanvas.ctx.save();
            FOVCanvas.ctx.translate(width / 2, height / 2);
            FOVCanvas.ctx.rotate(angle);
            FOVCanvas.ctx.translate(-width / 2, -height / 2);

            FOVCanvas.drawFOVBorder(width, height);

            const targetForCanvas = this.currentTarget && this.showTarget ? {
                ...this.currentTarget,
                size_max: parseFloat(this.currentTarget.size_max) || 0,
                size_min: parseFloat(this.currentTarget.size_min) || 0
            } : null;

            if (targetForCanvas && targetForCanvas.size_max && targetForCanvas.size_min) {
                FOVCanvas.drawTarget(
                    width / 2, height / 2,
                    targetForCanvas.size_max * scaleX,
                    targetForCanvas.size_min * scaleY
                );
            }

            if (FOVCanvas.showMoon) {
                const moonDiameter = FOVCalculations.getFullMoonDiameter();
                FOVCanvas.drawMoon(width / 2, height / 2,
                    (moonDiameter * scaleX) / 2,
                    (moonDiameter * scaleY) / 2);
            }

            if (FOVCanvas.showCrosshair) FOVCanvas.drawCenterCrosshair();
            FOVCanvas.ctx.restore();

            // Draw fixed N marker always pointing up
            FOVCanvas.drawFixedNorthMarker();

            this.showActualModeCoords();
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

        const raDeg = this.currentTarget.ra * 15;
        const decDeg = this.currentTarget.dec;

        // 3x the FOV
        const fovDeg = Math.max(fovData.fovWidth, fovData.fovHeight) * 3;

        const cacheKey = this.getDSSLargeCacheKey(raDeg, decDeg, fovDeg);

        let dataUrl = await this.getDSSLargeFromCache(cacheKey);

        if (!dataUrl) {
            const url = `${APP_CONFIG.APIS.DSS}` +
                `&ra=${raDeg.toFixed(6)}&dec=${decDeg.toFixed(6)}` +
                `&fov=${fovDeg.toFixed(6)}&width=600&height=600` +
                `&projection=TAN&format=jpg`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('Large DSS fetch failed:', response.status);
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
                return;
            }
        }

        // Store for use by canvas drag rendering
        this.largeDSSDataUrl = dataUrl;
        this.largeFOVData = fovData;

        const img = new Image();
        img.onload = () => {
            FOVCanvas.clear();
            FOVCanvas.renderBackground(img);
            FOVCanvas.drawFOVBorder(FOVCanvas.canvas.width, FOVCanvas.canvas.height);
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

        const raDeg = this.currentTarget.ra * 15;
        const decDeg = this.currentTarget.dec;

        // 3x the FOV
        const fovDeg = Math.max(fovData.fovWidth, fovData.fovHeight) * 3;

        const cacheKey = this.getDSSLargeCacheKey(raDeg, decDeg, fovDeg);

        let dataUrl = await this.getDSSLargeFromCache(cacheKey);

        if (!dataUrl) {
            const url = `${APP_CONFIG.APIS.DSS}` +
                `&ra=${raDeg.toFixed(6)}&dec=${decDeg.toFixed(6)}` +
                `&fov=${fovDeg.toFixed(6)}&width=600&height=600` +
                `&projection=TAN&format=jpg`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('Large DSS fetch failed:', response.status);
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
                return;
            }
        }

        // Store for use by canvas drag rendering
        this.largeDSSDataUrl = dataUrl;
        this.largeFOVData = fovData;

        const img = new Image();
        img.onload = () => {
            FOVCanvas.largeImage = img;
            FOVCanvas.initDragBox(fovData.fovWidthArcmin, fovData.fovHeightArcmin);
            FOVCanvas.setupDragListeners(() => {
                this.redrawLargeMode(fovData);
            });
            const rc = document.getElementById('fov-rotation-control');
            if (rc) rc.style.display = 'block';
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
        FOVCanvas.drawFixedNorthMarker();
        if (typeof this.updateCenterCoords === 'function') {
            this.updateCenterCoords(fovData);
        }
    },

    /**
     * Calculate and display RA/Dec of drag box center
     */
    updateCenterCoords(fovData) {
        const el = document.getElementById('fov-center-coords');
        if (!el || !FOVCanvas.dragBox) return;

        // Pixel offset of box center from canvas center
        const canvasCX = FOVCanvas.canvas.width / 2;
        const canvasCY = FOVCanvas.canvas.height / 2;
        const boxCX = FOVCanvas.dragBox.x + FOVCanvas.dragBox.width / 2;
        const boxCY = FOVCanvas.dragBox.y + FOVCanvas.dragBox.height / 2;

        // The large image is 3x the FOV, so arcsec per pixel = 3x normal
        const arcSecPerPixelX = (fovData.fovWidthArcmin * 60 * 3) / FOVCanvas.canvas.width;
        const arcSecPerPixelY = (fovData.fovHeightArcmin * 60 * 3) / FOVCanvas.canvas.height;

        // Offset in arcseconds (positive X = east = increasing RA, positive Y = north = increasing Dec)
        const offsetX = (boxCX - canvasCX) * arcSecPerPixelX;
        const offsetY = (canvasCY - boxCY) * arcSecPerPixelY; // Y flipped

        // Target RA/Dec in degrees
        const targetRA = this.currentTarget.ra * 15; // hours to degrees
        const targetDec = this.currentTarget.dec;

        // Apply offset (convert arcsec to degrees)
        const centerRA = targetRA + (offsetX / 3600) / Math.cos(targetDec * Math.PI / 180);
        const centerDec = targetDec + (offsetY / 3600);

        // Format RA as HH:MM:SS
        const raNorm = ((centerRA % 360) + 360) % 360;
        const raHours = raNorm / 15;
        const raH = Math.floor(raHours);
        const raM = Math.floor((raHours - raH) * 60);
        const raS = ((raHours - raH) * 60 - raM) * 60;

        // Format Dec as +DD:MM:SS
        const decSign = centerDec >= 0 ? '+' : '-';
        const decAbs = Math.abs(centerDec);
        const decD = Math.floor(decAbs);
        const decM = Math.floor((decAbs - decD) * 60);
        const decS = ((decAbs - decD) * 60 - decM) * 60;

        const raStr = `${String(raH).padStart(2,'0')}h ${String(raM).padStart(2,'0')}m ${raS.toFixed(1).padStart(4,'0')}s`;
        const decStr = `${decSign}${String(decD).padStart(2,'0')}° ${String(decM).padStart(2,'0')}′ ${decS.toFixed(1).padStart(4,'0')}″`;

        el.textContent = `Center: ${raStr}  /  ${decStr}`;
        el.style.display = 'block';
    },

    /**
     * Display target RA/Dec below canvas in Actual mode
     */
    showActualModeCoords() {
        const el = document.getElementById('fov-center-coords');
        if (!el || !this.currentTarget) return;

        const raHours = this.currentTarget.ra;
        const decDeg = this.currentTarget.dec;

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

        el.textContent = `Center: ${raStr}  /  ${decStr}`;
        el.style.display = 'block';
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
            // Actual mode — extract content inside rotated FOV border
            snapCanvas.width = w;
            snapCanvas.height = h;
            const snapCtx = snapCanvas.getContext('2d');

            snapCtx.fillStyle = '#000000';
            snapCtx.fillRect(0, 0, w, h);

            snapCtx.save();
            snapCtx.translate(w / 2, h / 2);
            snapCtx.rotate(-angle);
            snapCtx.drawImage(srcCanvas, -w / 2, -h / 2);
            snapCtx.restore();
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
     * Lock canvas to current pixel size
     */
    lockCanvasSize() {
        const canvas = FOVCanvas.canvas;
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.style.maxWidth = w + 'px';
        this.dssLockedSize = { width: w, height: h };
    },

    /**
     * Unlock canvas size
     */
    unlockCanvasSize() {
        const canvas = FOVCanvas.canvas;
        canvas.style.width = '';
        canvas.style.height = '';
        canvas.style.maxWidth = '100%';
        this.dssLockedSize = null;
    },

/**
     * Clear results and canvas
     */
    clearResults() {
        const resultsDiv = document.getElementById('fov-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p style="color: var(--text-secondary);">Select telescope and sensor to calculate field of view.</p>';
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
    }
};
