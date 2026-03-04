/**
 * fov-main.js
 * Field of View view controller
 */

const FOVView = {
    currentTarget: null,
    showDSS: false,
    showTarget: true,
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

        // Set page title
        document.title = 'Field of View';

        // Initialize
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
        FOVCanvas.dssImage = null;

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
        document.addEventListener('telescopes-updated', () => {
            this.populateTelescopeDropdown();
        });
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
        document.addEventListener('sensors-updated', () => {
            this.populateSensorDropdown();
        });
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

            // Calculate what percentage of FOV the target occupies (use smaller dimension)
            const fovSmaller = Math.min(fovData.fovWidthArcmin, fovData.fovHeightArcmin);
            const targetLarger = Math.max(targetSizeMax, targetSizeMin);
            fieldCoverage = (targetLarger / fovSmaller) * 100;

            // Show toast if target fills > 50% of FOV, but only once per unique combination
            if (fieldCoverage > 50) {
                const toastKey = `${telescopeName}|${sensorName}|${this.currentTarget.object}`;
                if (toastKey !== this.lastToastKey) {
                    this.lastToastKey = toastKey;
                    UIManager.showToast(`Target occupies ${fieldCoverage.toFixed(0)}% of field of view. Consider a longer focal length for more context.`, 'info', 6000);
                }
            }
        }

        // Display results
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
            await this.fetchAndRenderDSS(fovData);
        }

        // Check if target fits
        if (this.currentTarget && this.currentTarget.size_max && this.currentTarget.size_min) {
            const fitCheck = FOVCalculations.checkTargetFit(
                this.currentTarget.size_max,
                this.currentTarget.size_min,
                fovData.fovWidthArcmin,
                fovData.fovHeightArcmin
            );

            if (!fitCheck.fits) {
                // Show warning modal
                UIManager.showToast(fitCheck.recommendation, 'warning', 8000);
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
    getDSSCacheKey(ra, dec, width, height, fovDeg) {
        return `dss_${ra.toFixed(4)}_${dec.toFixed(4)}_${width}_${height}_${fovDeg.toFixed(4)}`;
    },

    /**
     * Get cached DSS image if still valid (< 24 hours old)
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

        const cacheKey = this.getDSSCacheKey(raDeg, decDeg, width, height, fovDeg);

        // Check cache first
        let dataUrl = await this.getDSSFromCache(cacheKey);

        if (!dataUrl) {
            const url = `https://alasky.u-strasbg.fr/hips-image-services/hips2fits?hips=CDS/P/DSS2/red` +
                `&ra=${raDeg.toFixed(6)}&dec=${decDeg.toFixed(6)}` +
                `&fov=${fovDeg.toFixed(6)}&width=${width}&height=${height}` +
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
            // Redraw: background first, then overlays
            FOVCanvas.clear();
            FOVCanvas.renderBackground(img);

            // Redraw target and moon overlays
            const targetForCanvas = this.currentTarget && this.showTarget ? {
                ...this.currentTarget,
                size_max: parseFloat(this.currentTarget.size_max) || 0,
                size_min: parseFloat(this.currentTarget.size_min) || 0
            } : null;

            const width = FOVCanvas.canvas.width;
            const height = FOVCanvas.canvas.height;
            const scaleX = width / fovData.fovWidthArcmin;
            const scaleY = height / fovData.fovHeightArcmin;

            FOVCanvas.drawFOVBorder(width, height);

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
        };
        img.src = dataUrl;
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
    }
};
