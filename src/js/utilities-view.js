/**
 * utilities-view.js
 * Utilities view for sky-condition links and other tools
 */

const UtilitiesView = {
    // Sky Conditions links: each site takes the location's coordinates in
    // its own URL format
    SKY_LINKS: [
        { label: 'Astrospheric', url: (lat, lon) => `https://astrospheric.com/?Latitude=${lat}&Longitude=${lon}&Loc=Forecast` },
        { label: 'Clear Outside', url: (lat, lon) => `https://clearoutside.com/forecast/${lat}/${lon}?view=current` },
        { label: 'Clouds', url: (lat, lon) => `https://zoom.earth/maps/satellite/#view=${lat},${lon},8z` },
        { label: 'Light Pollution', url: (lat, lon) => `https://www.lightpollutionmap.info/#zoom=16.0&lat=${lat}&lon=${lon}` }
    ],

    // Location chosen in the Sky Conditions dropdown
    _skyLocation: null,

    /**
     * Initialize the view
     */
    init() {
        this.initSkyConditions();
        this.renderDustMoteCalculator();

        // Listen for location updates
        this._locationsHandler = () => this.renderSkyConditions();
        document.addEventListener('locations-updated', this._locationsHandler);
        // A new current location becomes the Sky Conditions location
        this._selectedLocationHandler = (e) => {
            this._skyLocation = e.detail.locationName;
            this.renderSkyConditions();
        };
        document.addEventListener('selected-location-changed', this._selectedLocationHandler);
    },

    /**
     * Wire the Sky Conditions location dropdown and render the card
     */
    initSkyConditions() {
        const dropdown = document.getElementById('sky-location-dropdown');
        const trigger = document.getElementById('sky-location-trigger');
        const menu = document.getElementById('sky-location-menu');
        if (!dropdown || !trigger || !menu) return;

        this._skyLocation = SettingsManager.getSelectedLocation();

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.astryx-dropdown-item');
            if (!item) return;
            dropdown.classList.remove('open');
            this._skyLocation = item.dataset.value;
            this.renderSkyConditions();
        });

        this.renderSkyConditions();
    },

    /**
     * Fill the location menu and point the links at the chosen location,
     * the current location to start with (Issue #286)
     */
    renderSkyConditions() {
        const row = document.getElementById('sky-conditions-row');
        const empty = document.getElementById('sky-conditions-empty');
        const menu = document.getElementById('sky-location-menu');
        const label = document.getElementById('sky-location-label');
        const links = document.getElementById('sky-conditions-links');
        if (!row || !empty || !menu || !label || !links) return;

        const locations = DataManager.getLocations();
        const names = Object.keys(locations);
        row.hidden = names.length === 0;
        empty.hidden = names.length > 0;
        if (names.length === 0) return;

        if (!locations[this._skyLocation]) this._skyLocation = names[0];
        const location = locations[this._skyLocation];

        menu.innerHTML = '';
        names.forEach(name => {
            const item = document.createElement('div');
            item.className = 'astryx-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            if (name === this._skyLocation) item.classList.add('selected');
            menu.appendChild(item);
        });
        label.textContent = this._skyLocation;

        links.innerHTML = '';
        this.SKY_LINKS.forEach((link, i) => {
            if (i > 0) {
                const separator = document.createElement('span');
                separator.className = 'sky-link-separator';
                separator.textContent = '•';
                links.appendChild(separator);
            }
            const a = document.createElement('a');
            a.className = 'block-link';
            a.href = link.url(location.latitude, location.longitude);
            a.target = '_blank';
            a.textContent = link.label;
            links.appendChild(a);
        });
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
                // The filters and sensor window sit in the reduced (or Barlowed) beam
                const effectiveFocalLength = FOVCalculations.getEffectiveFocalLength(tel.focalLength, tel.multiplier);
                focalRatioInput.value = (effectiveFocalLength / tel.aperture).toFixed(1);
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
            const result = document.getElementById('dust-result');
            const sum = document.getElementById('dust-mote-summary');
            if (result) result.textContent = '—';
            if (sum)  sum.textContent = '—';
            return;
        }

        // Convert spot diameter from pixels to mm
        const spotDiameterMm = (spotPixels * pixelSize) / 1000;

        // The beam from an f/N telescope narrows by 1 mm of width per N mm of
        // travel, so a speck d mm from the sensor casts a shadow whose edge
        // fades from d/N - s to d/N + s across (s = speck size). Measured
        // where the edge has faded halfway, the diameter is d/N.
        // Hence distance = spot_diameter_mm * f_ratio.
        const distanceMm = spotDiameterMm * fRatio;

        const result  = document.getElementById('dust-result');
        const summary = document.getElementById('dust-mote-summary');
        if (result)  result.textContent  = `${distanceMm.toFixed(1)} mm`;
        if (summary)  summary.textContent  = `${spotDiameterMm.toFixed(3)} mm`;
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._locationsHandler) {
            document.removeEventListener('locations-updated', this._locationsHandler);
            this._locationsHandler = null;
        }
        if (this._selectedLocationHandler) {
            document.removeEventListener('selected-location-changed', this._selectedLocationHandler);
            this._selectedLocationHandler = null;
        }
    }

};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
