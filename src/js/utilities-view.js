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

        // Listen for location updates
        document.addEventListener('locations-updated', () => {
            this.renderWeatherForecasts();
            this.renderLightPollutionInfo();
        });
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

        Object.entries(locations).forEach(([name, location]) => {
            const astrosphericUrl = `https://astrospheric.com/?Latitude=${location.latitude}&Longitude=${location.longitude}&Loc=Forecast`;
            const clearOutsideUrl = `https://clearoutside.com/forecast/${location.latitude}/${location.longitude}?view=current`;

            html += `
                <div class="weather-location-card">
                    <strong>${name}</strong>
                    <span class="location-separator">•</span>
                    <a class="block-link" href="${astrosphericUrl}" target="_blank" class="weather-link">Astrospheric</a>
                    <span class="location-separator">•</span>
                    <a class="block-link" href="${clearOutsideUrl}" target="_blank" class="weather-link">Clear Outside</a>
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
        const resultDiv = document.getElementById('dust-mote-result');

        if (!resultDiv) return;

        if (isNaN(fRatio) || isNaN(pixelSize) || isNaN(spotPixels) ||
            fRatio <= 0 || pixelSize <= 0 || spotPixels <= 0) {
            resultDiv.innerHTML = '<p style="color: var(--error-color);">Please enter valid values for all fields.</p>';
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

        resultDiv.innerHTML = `
            <table class="session-table">
                <thead>
                    <tr>
                        <th>Dust Size (mm)</th>
                        <th>Est. Distance from Sensor (mm)</th>
                    </tr>
                </thead>
                <tbody>
                    ${distances.map(d => `
                        <tr>
                            <td>${d.dustMm}</td>
                            <td>${d.distanceMm}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                Spot diameter: ${spotDiameterMm.toFixed(3)} mm &nbsp;•&nbsp; f/${fRatio}
            </p>`;
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

};
