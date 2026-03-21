/**
 * utilities-view.js
 * Utilities view for weather forecasts and other tools
 */

const UtilitiesView = {
    /**
     * Initialize the view
     */
    init() {
        this.renderWeatherForecasts();
        this.renderLightPollutionInfo();
        this.renderDustMoteCalculator();
        this.initAsiairLogAnalyzer();

        // Listen for location updates
        this._locationsHandler = () => {
            this.renderWeatherForecasts();
            this.renderLightPollutionInfo();
        };
        document.addEventListener('locations-updated', this._locationsHandler);
    },

    /**
     * Render weather forecast links for all locations
     */
    renderWeatherForecasts() {
        const container = document.getElementById('utilities-weather-list');
        if (!container) return;
        console.log('In renderWeatherForecasts()');

        const locations = DataManager.getLocations();

        if (Object.keys(locations).length === 0) {
            container.innerHTML = '<p class="empty-message">No locations configured. Add locations in Admin Tools → Manage Locations.</p>';
            return;
        }

        let html = '<div class="weather-forecast-grid">';

        /*const zoomUrl = `https://zoom.earth/maps/satellite/#place=${location.latitude},-${location.longitude}/date=2026-03-18,15:00,-4`;*/

        Object.entries(locations).forEach(([name, location]) => {
            const astrosphericUrl = `https://astrospheric.com/?Latitude=${location.latitude}&Longitude=${location.longitude}&Loc=Forecast`;
            const clearOutsideUrl = `https://clearoutside.com/forecast/${location.latitude}/${location.longitude}?view=current`;
            const cloudsUrl = `https://zoom.earth/maps/satellite/#view=${location.latitude},${location.longitude},8z`;

            html += `
                <div class="weather-location-card">
                    <strong>${name}</strong>
                    <span class="location-separator">•</span>
                    <a class="block-link" href="${astrosphericUrl}" target="_blank" class="weather-link">Astrospheric</a>
                    <span class="location-separator">•</span>
                    <a class="block-link" href="${clearOutsideUrl}" target="_blank" class="weather-link">Clear Outside</a>
                    <span class="location-separator">•</span>
                    <a class="block-link" href="${cloudsUrl}" target="_blank" class="weather-link">Clouds</a>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Render light pollution info maps
     */
    renderLightPollutionInfo() {
        const container = document.getElementById('utilities-light-pollution-info');
        if (!container) return;
        console.log('In renderLightPollutionInfo()');

        const locations = DataManager.getLocations();

        if (Object.keys(locations).length === 0) {
            container.innerHTML = '<p class="empty-message">No locations configured. Add locations in Admin Tools → Manage Locations.</p>';
            return;
        }

        let html = '<div class="weather-forecast-grid">';

        Object.entries(locations).forEach(([name, location]) => {
            const lightPollutionUrl = `https://www.lightpollutionmap.info/#zoom=16.0&lat=${location.latitude}&lon=${location.longitude}`;

            html += `
                <div class="weather-location-card">
                    <a class="block-link" href="${lightPollutionUrl}" target="_blank" class="weather-link"><strong>${name}</strong></a>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    },

    /**
     * Populate dust mote calculator dropdowns
     */
    renderDustMoteCalculator() {
        const telescopeSelect = document.getElementById('dust-telescope-select');
        const sensorSelect = document.getElementById('dust-sensor-select');
        if (!telescopeSelect || !sensorSelect) return;

        // Populate telescopes
        const telescopes = DataManager.getTelescopes();
        telescopeSelect.innerHTML = '<option value="">Select telescope...</option>';
        Object.keys(telescopes).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            telescopeSelect.appendChild(option);
        });

        // Populate sensors
        const sensors = DataManager.getSensors();
        sensorSelect.innerHTML = '<option value="">Select sensor...</option>';
        Object.keys(sensors).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            sensorSelect.appendChild(option);
        });

        // Auto-fill focal ratio when telescope selected
        telescopeSelect.addEventListener('change', () => {
            const tel = telescopes[telescopeSelect.value];
            const focalRatioInput = document.getElementById('dust-focal-ratio');
            if (tel && focalRatioInput) {
                const fRatio = (tel.focalLength / tel.aperture).toFixed(1);
                focalRatioInput.value = fRatio;
            } else if (focalRatioInput) {
                focalRatioInput.value = '';
            }
        });

        // Auto-fill pixel size when sensor selected
        sensorSelect.addEventListener('change', () => {
            const sensor = sensors[sensorSelect.value];
            const pixelSizeInput = document.getElementById('dust-pixel-size');
            if (sensor && pixelSizeInput) {
                // Use average of X and Y pixel size
                const avgPixelSize = ((sensor.pixelSizeX + sensor.pixelSizeY) / 2).toFixed(2);
                pixelSizeInput.value = avgPixelSize;
            } else if (pixelSizeInput) {
                pixelSizeInput.value = '';
            }
            this.calculateDustMote();
        });

        // Dynamically recalculate when telescope or sensor dropdowns change
        telescopeSelect.addEventListener('change', () => this.calculateDustMote());

        // Dynamically recalculate when manual inputs change
        ['dust-focal-ratio', 'dust-pixel-size', 'dust-spot-pixels'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.calculateDustMote());
        });
    },

    /**
     * Calculate dust mote distance and display results
     */
    calculateDustMote() {
        const fRatio = parseFloat(document.getElementById('dust-focal-ratio').value);
        const pixelSize = parseFloat(document.getElementById('dust-pixel-size').value);
        const spotPixels = parseFloat(document.getElementById('dust-spot-pixels').value);

        if (isNaN(fRatio) || isNaN(pixelSize) || isNaN(spotPixels) ||
            fRatio <= 0 || pixelSize <= 0 || spotPixels <= 0) {
            const r05 = document.getElementById('dust-result-05');
            const r15 = document.getElementById('dust-result-15');
            const sum = document.getElementById('dust-mote-summary');
            if (r05) r05.textContent = '—';
            if (r15) r15.textContent = '—';
            if (sum)  sum.textContent = '—';
            return;
        }

        // Convert spot diameter from pixels to mm
        const spotDiameterMm = (spotPixels * pixelSize) / 1000;

        // Calculate distance for dust sizes (mm)
        // Formula: distance = spot_diameter_mm * f_ratio / dust_diameter_mm
        const dustSizes = [0.5, 1.5];
        const distances = dustSizes.map(dust => ({
            dustMm: dust,
            distanceMm: (spotDiameterMm * fRatio / dust).toFixed(1)
        }));

        const result05 = document.getElementById('dust-result-05');
        const result15 = document.getElementById('dust-result-15');
        const summary  = document.getElementById('dust-mote-summary');
        if (result05) result05.textContent = distances[0].distanceMm;
        if (result15) result15.textContent = distances[1].distanceMm;
        if (summary)  summary.textContent  = `Spot diameter: ${spotDiameterMm.toFixed(3)} mm  •  f/${fRatio}`;
    },

    /**
     * Initialize ASIAir session log analyzer
     */
    initAsiairLogAnalyzer() {
        const fileInput = document.getElementById('session-log-file');
        const pdfBtn = document.getElementById('session-log-pdf-btn');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const parsed = AsiairLogParser.parse(ev.target.result);
                AsiairLogView.renderReport(parsed);
            };
            reader.readAsText(file);
        });

        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                if (AsiairLogView._parsed) {
                    AsiairLogView.downloadPDF(AsiairLogView._parsed);
                }
            });
        }
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._locationsHandler) {
            document.removeEventListener('locations-updated', this._locationsHandler);
            this._locationsHandler = null;
        }
    }

};
