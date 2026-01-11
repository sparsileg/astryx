/**
 * visibility-ui.js
 * UI helpers and validation for Visibility Calculator
 */

const VisibilityUI = {
    currentMode: 'daily', // 'daily' or 'yearly'

    /**
     * Initialize UI elements
     */
    init() {
        // No UI setup needed - controls are hidden and managed by modals
    },

    /**
     * Set the current mode (daily or yearly)
     */
    setMode(mode) {
        this.currentMode = mode;

        const dailyBtn = document.getElementById('mode-daily-btn');
        const yearlyBtn = document.getElementById('mode-yearly-btn');
        const dailyOptions = document.getElementById('daily-options');
        const yearlyOptions = document.getElementById('yearly-options');

        if (mode === 'daily') {
            dailyBtn.classList.add('active');
            yearlyBtn.classList.remove('active');
            dailyBtn.style.background = 'var(--primary-color)';
            dailyBtn.style.color = 'var(--primary-text)';
            yearlyBtn.style.background = 'transparent';
            yearlyBtn.style.color = 'var(--text-color)';

            dailyOptions.style.display = 'block';
            yearlyOptions.style.display = 'none';
        } else {
            yearlyBtn.classList.add('active');
            dailyBtn.classList.remove('active');
            yearlyBtn.style.background = 'var(--primary-color)';
            yearlyBtn.style.color = 'var(--primary-text)';
            dailyBtn.style.background = 'transparent';
            dailyBtn.style.color = 'var(--text-color)';

            dailyOptions.style.display = 'none';
            yearlyOptions.style.display = 'block';
        }
    },

    /**
     * Get current mode
     */
    getMode() {
        return this.currentMode;
    },

    /**
     * Validate location inputs
     */
    validateLocation(name, lat, lng, elev, tz) {
        if (!name) {
            return { valid: false, error: 'Please enter a location name' };
        }

        if (isNaN(lat) || lat < -90 || lat > 90) {
            return { valid: false, error: 'Latitude must be between -90 and 90 degrees' };
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            return { valid: false, error: 'Longitude must be between -180 and 180 degrees' };
        }

        if (isNaN(elev) || elev < -500 || elev > 10000) {
            return { valid: false, error: 'Elevation must be between -500 and 10,000 meters' };
        }

        if (isNaN(tz) || tz < -12 || tz > 14) {
            return { valid: false, error: 'Timezone offset must be between -12 and +14 hours' };
        }

        return { valid: true };
    },

    /**
     * Validate target inputs
     */
    validateTarget(name, ra, dec) {
        if (!name) {
            return { valid: false, error: 'Please enter a target name' };
        }

        if (isNaN(ra) || isNaN(dec)) {
            return { valid: false, error: 'Please enter valid RA and DEC coordinates' };
        }

        if (ra < 0 || ra >= 24) {
            return { valid: false, error: 'RA must be between 0 and 24 hours' };
        }

        if (dec < -90 || dec > 90) {
            return { valid: false, error: 'DEC must be between -90 and +90 degrees' };
        }

        return { valid: true };
    },

    /**
     * Validate calculation inputs
     */
    validateCalculationInputs(inputs) {
        if (!inputs.obsDate) {
            return { valid: false, error: 'Please select an observation date' };
        }

        if (!inputs.targetName) {
            return { valid: false, error: 'Please select a target' };
        }

        if (isNaN(inputs.ra) || isNaN(inputs.dec)) {
            return { valid: false, error: 'Please select a valid target with coordinates' };
        }

        if (isNaN(inputs.latitude) || inputs.latitude < -90 || inputs.latitude > 90) {
            return { valid: false, error: 'Latitude must be between -90 and 90 degrees' };
        }

        if (isNaN(inputs.longitude) || inputs.longitude < -180 || inputs.longitude > 180) {
            return { valid: false, error: 'Longitude must be between -180 and 180 degrees' };
        }

        if (isNaN(inputs.elevation) || inputs.elevation < -500 || inputs.elevation > 10000) {
            return { valid: false, error: 'Elevation must be between -500 and 10,000 meters' };
        }

        if (isNaN(inputs.timezone) || inputs.timezone < -12 || inputs.timezone > 14) {
            return { valid: false, error: 'Timezone must be between -12 and +14 hours' };
        }

        if (isNaN(inputs.minAltitude) || inputs.minAltitude < 0 || inputs.minAltitude > 90) {
            return { valid: false, error: 'Minimum altitude must be between 0 and 90 degrees' };
        }

        return { valid: true };
    }
};
