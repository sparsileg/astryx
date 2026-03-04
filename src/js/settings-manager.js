/**
 * settings-manager.js
 * Manages application settings (DST config, theme, etc.)
 */

const SettingsManager = {
    settings: {
        dstConfig: {
            mode: 'auto', // 'auto', 'custom', 'always', 'never'
            startDate: null,
            endDate: null
        },
        theme: APP_CONFIG.DEFAULT_THEME,
        resultsCount: 'all', // Not in settings UI, but used by visibility calculator
        maxSearchResults: 8, // default if not set
        selectedLocation: null, // Currently selected observer location
        minAltitudeDaily: 35, // Minimum altitude for daily visibility
        minAltitudeYearly: 35, // Minimum altitude for yearly observability
        globalMinAltitude: 35, // Global default minimum altitude for all tools
        lastBestMonthsAltitude: null, // Last altitude used for best months calc
        lastBestMonthsDarkHours: null, // Last dark hours used for best months calc
        lastBestMonthsCalculated: null, // Timestamp of last best months calc
        lastBestMonthsLocation: null,  // Location used for last best months calc
        autoBackupEnabled: true,       // Auto-backup on data change
        lastChangeTimestamp: null      // DTG of last data change
    },

    /**
     * Initialize - load settings from IndexedDB
     */
    async init() {
        try {
            const savedSettings = await DBManager.get(APP_CONFIG.STORES.SETTINGS, 'app-settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings.data };
            }
            console.log('SettingsManager initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing SettingsManager:', error);
            return false;
        }
    },

    /**
     * Reload settings from IndexedDB (used after restore)
     */
    async reload() {
        const savedSettings = await DBManager.get(APP_CONFIG.STORES.SETTINGS, 'app-settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...savedSettings.data };
        }
    },

    /**
     * Get a specific setting by key
     */
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    },

    /**
     * Save a specific setting by key
     */
    async saveSetting(key, value) {
        this.settings[key] = value;
        await this.saveSettings();
    },

    /**
     * Save settings to IndexedDB
     */
    async saveSettings() {
        await DBManager.put(APP_CONFIG.STORES.SETTINGS, {
            id: 'app-settings',
            data: this.settings
        });
    },

    /**
     * Get all settings
     */
    getSettings() {
        return this.settings;
    },

    /**
     * Get DST configuration
     */
    getDSTConfig() {
        return this.settings.dstConfig;
    },

    /**
     * Update DST configuration
     */
    async updateDSTConfig(config) {
        this.settings.dstConfig = { ...this.settings.dstConfig, ...config };
        await this.saveSettings();
    },

    /**
     * Get current theme
     */
    getTheme() {
        return this.settings.theme;
    },

    /**
     * Update theme
     */
    async updateTheme(theme) {
        this.settings.theme = theme;
        await this.saveSettings();
        this.applyTheme(theme);
    },

    /**
     * Apply theme to DOM
     */
    applyTheme(theme) {
        const themeLink = document.getElementById('theme-css');
        if (themeLink) {
            themeLink.href = `css/themes/${theme}.css`;
        }

        // Update theme selector if it exists
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    },

    /**
     * Determine if DST is active for a given date
     */
    isDSTActive(utcDate, timezone) {
        const standardLocalTime = new Date(utcDate.getTime() + timezone * 3600000);

        switch (this.settings.dstConfig.mode) {
            case 'always':
                return true;
            case 'never':
                return false;
            case 'custom':
                if (!this.settings.dstConfig.startDate || !this.settings.dstConfig.endDate) {
                    return false;
                }
                const year = standardLocalTime.getFullYear();
                const start = new Date(year, this.settings.dstConfig.startDate.getMonth(),
                                      this.settings.dstConfig.startDate.getDate());
                const end = new Date(year, this.settings.dstConfig.endDate.getMonth(),
                                    this.settings.dstConfig.endDate.getDate());
                return standardLocalTime >= start && standardLocalTime <= end;
            case 'auto':
            default:
                const jan = new Date(standardLocalTime.getFullYear(), 0, 1).getTimezoneOffset();
                const jul = new Date(standardLocalTime.getFullYear(), 6, 1).getTimezoneOffset();
                return Math.max(jan, jul) !== standardLocalTime.getTimezoneOffset();
        }
    },

    /**
     * Get results count setting
     */
    getResultsCount() {
        return this.settings.resultsCount;
    },

    /**
     * Update results count
     */
    async updateResultsCount(count) {
        this.settings.resultsCount = count;
        await this.saveSettings();
    },

    /**
     * Get max search results setting
     */
    getMaxSearchResults() {
        return this.settings.maxSearchResults || 8;
    },

    /**
     * Update max search results
     */
    async updateMaxSearchResults(count) {
        this.settings.maxSearchResults = count;
        await this.saveSettings();
    },

    /**
     * Get selected location
     */
    getSelectedLocation() {
        return this.settings.selectedLocation;
    },

    /**
     * Set selected location
     */
    async setSelectedLocation(locationName) {
        this.settings.selectedLocation = locationName;
        await this.saveSettings();
    },

    /**
     * Get global minimum altitude
     */
    getGlobalMinAltitude() {
        return this.settings.globalMinAltitude !== undefined ? this.settings.globalMinAltitude : 35;
    },

    /**
     * Get minimum altitude for daily visibility
     */
    getMinAltitudeDaily() {
        return this.settings.minAltitudeDaily !== undefined ? this.settings.minAltitudeDaily : 35;
    },

    /**
     * Set minimum altitude for daily visibility
     */
    async setMinAltitudeDaily(altitude) {
        this.settings.minAltitudeDaily = altitude;
        await this.saveSettings();
    },

    /**
     * Get minimum altitude for yearly observability
     */
    getMinAltitudeYearly() {
        return this.settings.minAltitudeYearly !== undefined ? this.settings.minAltitudeYearly : 35;
    },

    /**
     * Set minimum altitude for yearly observability
     */
    async setMinAltitudeYearly(altitude) {
        this.settings.minAltitudeYearly = altitude;
        await this.saveSettings();
    },

    /**
     * Get last best months altitude parameter
     */
    getLastBestMonthsAltitude() {
        return this.settings.lastBestMonthsAltitude;
    },

    /**
     * Set last best months altitude parameter
     */
    async setLastBestMonthsAltitude(altitude) {
        this.settings.lastBestMonthsAltitude = altitude;
        await this.saveSettings();
    },

    /**
     * Get last best months dark hours parameter
     */
    getLastBestMonthsDarkHours() {
        return this.settings.lastBestMonthsDarkHours;
    },

    /**
     * Set last best months dark hours parameter
     */
    async setLastBestMonthsDarkHours(hours) {
        this.settings.lastBestMonthsDarkHours = hours;
        await this.saveSettings();
    },

    /**
     * Get last best months calculation timestamp
     */
    getLastBestMonthsCalculated() {
        return this.settings.lastBestMonthsCalculated;
    },

    /**
     * Set last best months calculation timestamp
     */
    async setLastBestMonthsCalculated(timestamp) {
        this.settings.lastBestMonthsCalculated = timestamp;
        await this.saveSettings();
    },

    /**
     * Get last best months calculation location
     */
    getLastBestMonthsLocation() {
        return this.settings.lastBestMonthsLocation;
    },

    /**
     * Set last best months calculation location
     */
    async setLastBestMonthsLocation(locationName) {
        this.settings.lastBestMonthsLocation = locationName;
        await this.saveSettings();
    },

/**
     * Set selected telescope
     * @param {string} name - Telescope name (or null to clear)
     */
    async setSelectedTelescope(name) {
        this.settings.selectedTelescope = name;
        await this.saveSettings();
    },

    getSelectedTelescope() {
        return this.settings.selectedTelescope;
    },

    /**
     * Set selected sensor
     * @param {string} name - Sensor name (or null to clear)
     */
    async setSelectedSensor(name) {
        this.settings.selectedSensor = name;
        await this.saveSettings();
    },

    getSelectedSensor() {
        return this.settings.selectedSensor;
    },

    /**
     * Get global minimum altitude
     */
    getGlobalMinAltitude() {
        return this.settings.globalMinAltitude !== undefined ? this.settings.globalMinAltitude : 35;
    },

    /**
     * Update global minimum altitude
     */
    async updateGlobalMinAltitude(altitude) {
        this.settings.globalMinAltitude = altitude;
        await this.saveSettings();
    },

    getOptimizerCandidateCount() {
        return this.settings.optimizerCandidateCount || 23;
    },

    async setOptimizerCandidateCount(count) {
        this.settings.optimizerCandidateCount = count;
        await this.saveSettings();
    },

    getAutoBackupEnabled() {
        return this.settings.autoBackupEnabled !== false;
    },

    async setAutoBackupEnabled(enabled) {
        this.settings.autoBackupEnabled = enabled;
        await this.saveSettings();
    },

    getLastChangeTimestamp() {
        return this.settings.lastChangeTimestamp;
    },

    async setLastChangeTimestamp(dtg) {
        this.settings.lastChangeTimestamp = dtg;
        await this.saveSettings();
    }

};
