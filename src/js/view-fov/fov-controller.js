/**
 * fov-main.js
 * Field of View view controller
 */

const FOVView = {
    currentTarget: null,

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
        document.title = 'Specula - Field of View';

        // Initialize
        this.init();

        // Dispatch view loaded event
        document.dispatchEvent(new CustomEvent('fov-view-loaded'));
    },

    /**
     * Initialize FOV view
     */
    init() {
        // Initialize canvas
        FOVCanvas.init('fov-canvas');

        // Populate dropdowns
        this.populateTelescopeDropdown();
        this.populateSensorDropdown();

        // Load current target if available
        if (typeof VisibilityTargets !== 'undefined' && VisibilityTargets.currentTarget) {
            this.currentTarget = VisibilityTargets.currentTarget;
            this.displayTargetInfo();
        }

        // Setup event listeners
        this.setupEventListeners();

        // Restore moon checkbox state
        const showMoonCheckbox = document.getElementById('fov-show-moon');
        if (showMoonCheckbox) {
            showMoonCheckbox.checked = FOVCanvas.showMoon;
        }

        // Load saved selections
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
    calculate() {
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

            // Show toast if target fills > 50% of FOV
            if (fieldCoverage > 50) {
                UIManager.showToast(`Target occupies ${fieldCoverage.toFixed(0)}% of field of view. Consider a longer focal length for more context.`, 'info', 6000);
            }
        }

        // Display results
        this.displayResults(fovData, fieldCoverage);

        // Prepare target data with numeric sizes for canvas rendering
        const targetForCanvas = this.currentTarget ? {
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

        resultsDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; align-items: center;">
                <strong>Effective Focal Length:</strong>
                <span>${fovData.effectiveFocalLength.toFixed(0)} mm</span>

                <strong>Field of View:</strong>
                <span>${fovData.fovWidth.toFixed(3)}° × ${fovData.fovHeight.toFixed(3)}°</span>
                <!-- ${fovData.fovWidthArcmin.toFixed(1)} × ${fovData.fovHeightArcmin.toFixed(1)} arcmin -->

                <strong>Resolution:</strong>
                <span>${fovData.resolution.toFixed(2)} arcsec/pixel</span>

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
