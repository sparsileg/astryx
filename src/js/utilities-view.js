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
        this.initSessionAnalysis();

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
        Log.debug('In renderWeatherForecasts()');

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
        Log.debug('In renderLightPollutionInfo()');

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
        const telescopeMenu = document.getElementById('dust-telescope-menu');
        const telescopeTrigger = document.getElementById('dust-telescope-trigger');
        const telescopeDropdown = document.getElementById('dust-telescope-dropdown');
        const telescopeLabel = document.getElementById('dust-telescope-label');
        const sensorMenu = document.getElementById('dust-sensor-menu');
        const sensorTrigger = document.getElementById('dust-sensor-trigger');
        const sensorDropdown = document.getElementById('dust-sensor-dropdown');
        const sensorLabel = document.getElementById('dust-sensor-label');
        if (!telescopeMenu || !sensorMenu) return;

        const telescopes = DataManager.getTelescopes();
        const sensors = DataManager.getSensors();

        // Populate telescope dropdown
        telescopeMenu.innerHTML = '';
        const telPlaceholder = document.createElement('div');
        telPlaceholder.className = 'astryx-dropdown-item';
        telPlaceholder.dataset.value = '';
        telPlaceholder.textContent = 'Select telescope...';
        telescopeMenu.appendChild(telPlaceholder);
        Object.keys(telescopes).forEach(name => {
            const item = document.createElement('div');
            item.className = 'astryx-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            telescopeMenu.appendChild(item);
        });

        // Populate sensor dropdown
        sensorMenu.innerHTML = '';
        const senPlaceholder = document.createElement('div');
        senPlaceholder.className = 'astryx-dropdown-item';
        senPlaceholder.dataset.value = '';
        senPlaceholder.textContent = 'Select sensor...';
        sensorMenu.appendChild(senPlaceholder);
        Object.keys(sensors).forEach(name => {
            const item = document.createElement('div');
            item.className = 'astryx-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            sensorMenu.appendChild(item);
        });

        // Wire telescope trigger
        telescopeTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            telescopeDropdown.classList.toggle('open');
        });

        // Wire telescope menu selection
        telescopeMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.astryx-dropdown-item');
            if (!item) return;
            telescopeMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            telescopeLabel.textContent = item.textContent;
            telescopeDropdown.classList.remove('open');

            const tel = telescopes[item.dataset.value];
            const focalRatioInput = document.getElementById('dust-focal-ratio');
            if (tel && focalRatioInput) {
                focalRatioInput.value = (tel.focalLength / tel.aperture).toFixed(1);
            } else if (focalRatioInput) {
                focalRatioInput.value = '';
            }
            this.calculateDustMote();
        });

        // Wire sensor trigger
        sensorTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            sensorDropdown.classList.toggle('open');
        });

        // Wire sensor menu selection
        sensorMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.astryx-dropdown-item');
            if (!item) return;
            sensorMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            sensorLabel.textContent = item.textContent;
            sensorDropdown.classList.remove('open');

            const sensor = sensors[item.dataset.value];
            const pixelSizeInput = document.getElementById('dust-pixel-size');
            if (sensor && pixelSizeInput) {
                pixelSizeInput.value = ((sensor.pixelSizeX + sensor.pixelSizeY) / 2).toFixed(2);
            } else if (pixelSizeInput) {
                pixelSizeInput.value = '';
            }
            this.calculateDustMote();
        });

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
     * Initialize Session Analysis card — coordinates all log analyzers
     */
    initSessionAnalysis() {
        this.initAsiairLogAnalyzer();
        this.initPhd2LogAnalyzer();
    },

    /**
     * Initialize ASIAir session log analyzer
     */
    initAsiairLogAnalyzer() {
        const fileInput = document.getElementById('session-log-file');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const parsed = AsiairLogParser.parse(ev.target.result);
                AsiairLogView.renderAccordion(parsed);
                // If PHD2 data already loaded, rerender it with new ASIAir context
                if (Phd2LogView._parsed) {
                    Phd2LogView.renderAccordion(Phd2LogView._parsed, parsed);
                }
            };
            reader.readAsText(file);
        });
    },

    /**
     * Initialize PHD2 guide log analyzer
     */
    initPhd2LogAnalyzer() {
        const fileInput = document.getElementById('phd2-log-file');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const parsed = Phd2LogParser.parse(ev.target.result);
                Phd2LogView.renderAccordion(parsed, AsiairLogView._parsed || null);
            };
            reader.readAsText(file);
        });
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
