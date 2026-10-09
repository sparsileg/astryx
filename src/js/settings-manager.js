/**
 * settings-manager.js
 * Manages application settings (DST config, theme, etc.)
 */

const SettingsManager = {
    settings: {
        dstConfig: {
            mode: 'auto' // 'auto', 'always', 'never'
        },
        theme: APP_CONFIG.DEFAULT_THEME,
        resultsCount: 'all', // Not in settings UI, but used by visibility calculator
        selectedLocation: null, // Currently selected observer location
        globalMinAltitude: 35, // Global default minimum altitude for all tools
        bestMonthsAltitudes: {},      // Min altitude each location's best months were calculated with
        lastBestMonthsAltitude: null, // Altitude of every best months calc before per-location tracking
        lastBestMonthsDarkHours: null, // Last dark hours used for best months calc
        lastBestMonthsCalculated: null, // Timestamp of last best months calc
        lastBestMonthsLocation: null,  // Location used for last best months calc
        autoBackupEnabled: true,       // Auto-backup on data change
        lastChangeTimestamp: null,     // DTG of last data change
        learnedSubGapS: APP_CONFIG.DEFAULT_SUB_GAP_S,             // Learned camera download + overhead (issue #145)
        learnedDitherDurationS: APP_CONFIG.DEFAULT_DITHER_DURATION_S, // Learned dither + settle duration (issue #145)
        framesPerDither: APP_CONFIG.DEFAULT_FRAMES_PER_DITHER     // User-settable frames between dithers (issue #145)
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

            // Normalize a stale capitalized theme value (legacy data predating
            // the lowercase filename convention) so it doesn't keep 404ing.
            if (this.settings.theme && this.settings.theme !== this.settings.theme.toLowerCase()) {
                this.settings.theme = this.settings.theme.toLowerCase();
                await this.saveSettings();
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
            const themeFile = (theme || APP_CONFIG.DEFAULT_THEME).toLowerCase();
            themeLink.href = `css/themes/${themeFile}.css`;
        }

        // Update theme dropdown label if it exists
        const themeMenu = document.getElementById('theme-dropdown-menu');
        const themeLabel = document.getElementById('theme-dropdown-label');
        if (themeMenu && themeLabel) {
            const item = themeMenu.querySelector(`[data-value="${theme}"]`);
            if (item) themeLabel.textContent = item.textContent;
        }
    },

    /**
     * Whether daylight saving time is in effect at a location at an instant.
     * In 'auto' mode this follows the location's own time zone rules; a
     * location without a time zone gets none.
     * @param {Date} instant
     * @param {Object} location - { timezone: standard-time offset in hours,
     *     timeZone: IANA name (optional) }
     * @returns {boolean}
     */
    isDSTActive(instant, location) {
        switch (this.settings.dstConfig.mode) {
            case 'always':
                return true;
            case 'never':
                return false;
            case 'auto':
            default:
                if (!location.timeZone) {
                    return false;
                }
                return TimeUtils.zoneOffsetHours(location.timeZone, instant) > location.timezone;
        }
    },

    /**
     * Whether daylight saving applies to the night starting on a calendar
     * date. Decided at local noon, so every view agrees on the days the
     * clocks change (they change in the small hours).
     * @param {Date} date - Its local year, month, and day give the calendar date
     * @param {Object} location - As for isDSTActive
     * @returns {boolean}
     */
    isDSTOnDate(date, location) {
        const noon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) - location.timezone * 3600000;
        return this.isDSTActive(new Date(noon), location);
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
        document.dispatchEvent(new CustomEvent('selected-location-changed', { detail: { locationName } }));
    },

    /**
     * Get global minimum altitude
     */
    getGlobalMinAltitude() {
        return this.settings.globalMinAltitude;
    },

    /**
     * Min altitude a location's best months were calculated with. Locations
     * calculated before per-location tracking all used lastBestMonthsAltitude.
     */
    getBestMonthsAltitude(locationName) {
        return this.settings.bestMonthsAltitudes[locationName] ?? this.settings.lastBestMonthsAltitude;
    },

    async setBestMonthsAltitude(locationName, altitude) {
        this.settings.bestMonthsAltitudes = { ...this.settings.bestMonthsAltitudes, [locationName]: altitude };
        await this.saveSettings();
    },

    async clearBestMonthsAltitudes() {
        this.settings.bestMonthsAltitudes = {};
        this.settings.lastBestMonthsAltitude = null;
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
     * Update global minimum altitude
     */
    async updateGlobalMinAltitude(altitude) {
        if (altitude === this.settings.globalMinAltitude) return;
        this.settings.globalMinAltitude = altitude;
        await this.saveSettings();
        document.dispatchEvent(new CustomEvent('min-altitude-changed', { detail: { altitude } }));
    },

    getOptimizerCandidateCount() {
        return this.settings.optimizerCandidateCount || 23;
    },

    async setOptimizerCandidateCount(count) {
        this.settings.optimizerCandidateCount = count;
        await this.saveSettings();
    },

    getFilterMinSize() {
        return this.settings.filterMinSize !== undefined ? this.settings.filterMinSize : APP_CONFIG.DEFAULT_MIN_SIZE;
    },

    async setFilterMinSize(value) {
        this.settings.filterMinSize = value;
        await this.saveSettings();
    },

    getFilterMaxMag() {
        return this.settings.filterMaxMag !== undefined ? this.settings.filterMaxMag : APP_CONFIG.DEFAULT_MAX_MAG;
    },

    async setFilterMaxMag(value) {
        this.settings.filterMaxMag = value;
        await this.saveSettings();
    },

    getBackupDelayMinutes() {
        return this.settings.backupDelayMinutes !== undefined ? this.settings.backupDelayMinutes : 60;
    },

    async setBackupDelayMinutes(minutes) {
        this.settings.backupDelayMinutes = minutes;
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
    },

    getBackupFolder() {
        return this.settings.backupFolder || '';
    },

    async setBackupFolder(path) {
        this.settings.backupFolder = path;
        await this.saveSettings();
    },

    getBackupReminderDays() {
        return this.settings.backupReminderDays !== undefined
            ? this.settings.backupReminderDays
            : APP_CONFIG.BACKUP_REMINDER_INTERVAL_DAYS;
    },

async setBackupReminderDays(days) {
        this.settings.backupReminderDays = days;
        await this.saveSettings();
    },

    // Learned session analysis values (issue #145)
    getLearnedSubGapS() {
        return this.settings.learnedSubGapS ?? APP_CONFIG.DEFAULT_SUB_GAP_S;
    },

    // Provenance for the learned sub gap (ELR.p1-3 Change 3) — null until a
    // log analysis has actually set them.
    getLearnedSubGapMeta() {
        return {
            sampleCount: this.settings.learnedSubGapSampleCount ?? null,
            derivedDate: this.settings.learnedSubGapDate ?? null,
        };
    },

    async setLearnedSubGapS(value, { sampleCount, derivedDate } = {}) {
        this.settings.learnedSubGapS = value;
        if (sampleCount !== undefined) this.settings.learnedSubGapSampleCount = sampleCount;
        if (derivedDate !== undefined) this.settings.learnedSubGapDate = derivedDate;
        await this.saveSettings();
    },

    // Start times of the Session Logs already used to update the learned
    // values, so loading a log again doesn't apply its figures a second time
    hasLearnedFromLog(logStart) {
        return (this.settings.learnedFromLogs ?? []).includes(logStart);
    },

    async addLearnedFromLog(logStart) {
        this.settings.learnedFromLogs = [...(this.settings.learnedFromLogs ?? []), logStart];
        await this.saveSettings();
    },

    getLearnedDitherDurationS() {
        return this.settings.learnedDitherDurationS ?? APP_CONFIG.DEFAULT_DITHER_DURATION_S;
    },

    // Provenance for the learned dither duration (ELR.p1-3 Change 3) — null
    // until a log analysis has actually set them.
    getLearnedDitherDurationMeta() {
        return {
            sampleCount: this.settings.learnedDitherDurationSampleCount ?? null,
            derivedDate: this.settings.learnedDitherDurationDate ?? null,
        };
    },

    async setLearnedDitherDurationS(value, { sampleCount, derivedDate } = {}) {
        this.settings.learnedDitherDurationS = value;
        if (sampleCount !== undefined) this.settings.learnedDitherDurationSampleCount = sampleCount;
        if (derivedDate !== undefined) this.settings.learnedDitherDurationDate = derivedDate;
        await this.saveSettings();
    },

    // ASIAir's Guide Stability and settle time aren't in either log, so the
    // Log Analysis screen asks for them and remembers the last values.
    getGuideStabilityArcsec() {
        return this.settings.guideStabilityArcsec ?? APP_CONFIG.DEFAULT_GUIDE_STABILITY_ARCSEC;
    },

    async setGuideStabilityArcsec(value) {
        this.settings.guideStabilityArcsec = value;
        await this.saveSettings();
    },

    getGuideSettleTimeS() {
        return this.settings.guideSettleTimeS ?? APP_CONFIG.DEFAULT_GUIDE_SETTLE_TIME_S;
    },

    async setGuideSettleTimeS(value) {
        this.settings.guideSettleTimeS = value;
        await this.saveSettings();
    },

    getFramesPerDither() {
        return this.settings.framesPerDither ?? APP_CONFIG.DEFAULT_FRAMES_PER_DITHER;
    },

    async setFramesPerDither(value) {
        this.settings.framesPerDither = value;
        await this.saveSettings();
    }

};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
