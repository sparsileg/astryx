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
        fontSizePx: APP_CONFIG.FONT_SIZE_DEFAULT_PX, // Base text size, chosen beside the theme (issue #272)
        dateFormat: null, // 'mdy', 'dmy' or 'ymd' for numeric dates shown; null follows the computer's region (issue #274)
        selectedLocation: null, // Currently selected observer location
        globalMinAltitude: 35, // Global default minimum altitude for all tools
        bestMonthsAltitudes: {},      // Min altitude each location's best months were calculated with
        bestMonthsVersions: {},       // APP_CONFIG.BEST_MONTHS_VERSION each location's best months were calculated with (issue #304)
        lastBestMonthsAltitude: null, // Altitude of every best months calc before per-location tracking
        lastBestMonthsDarkHours: null, // Last dark hours used for best months calc
        lastBestMonthsCalculated: null, // Timestamp of last best months calc
        lastBestMonthsLocation: null,  // Location used for last best months calc
        autoBackupEnabled: true,       // Auto-backup on data change
        lastChangeTimestamp: null,     // DTG of last data change
        learnedSubGapS: APP_CONFIG.DEFAULT_SUB_GAP_S,             // Learned camera download + overhead (issue #145)
        learnedDitherDurationS: APP_CONFIG.DEFAULT_DITHER_DURATION_S, // Learned dither + settle duration (issue #145)
        framesPerDither: APP_CONFIG.DEFAULT_FRAMES_PER_DITHER,    // User-settable frames between dithers (issue #145)
        seqPlanExposures: {}           // Last exposure (s) typed for each target in Sequence Planner (issue #264)
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

            // Sequence Planner's own Min Alt was saved but never read; the planner
            // always starts from the global Min Altitude (issue #265)
            if ('seqPlanMinAltitude' in this.settings) {
                delete this.settings.seqPlanMinAltitude;
                await this.saveSettings();
            }

            if (this._rekeyLearnedNights()) await this.saveSettings();

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
        this._rekeyLearnedNights();
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

    getFontSize() {
        return this.settings.fontSizePx;
    },

    /**
     * Save and apply the base text size. Like the theme, not a data change (#249)
     */
    async updateFontSize(px) {
        this.settings.fontSizePx = px;
        await this.saveSettings();
        this.applyFontSize(px);
    },

    /**
     * Set the root font size, which every rem in the app follows (issue #272)
     */
    applyFontSize(px) {
        document.documentElement.style.fontSize = `${px}px`;
        const label = document.getElementById('font-size-dropdown-label');
        if (label) label.textContent = `${px} px`;
    },

    /**
     * How numeric dates are shown and typed: 'mdy' (mm/dd/yyyy), 'dmy'
     * (dd/mm/yyyy) or 'ymd' (yyyy-mm-dd). Until one is chosen, the computer's
     * region decides. Dates are always stored as YYYY-MM-DD (issue #274).
     */
    getDateFormat() {
        return this.settings.dateFormat ?? this._regionDateFormat();
    },

    _regionDateFormat() {
        const first = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(new Date())
            .find(part => part.type !== 'literal').type;
        return { month: 'mdy', day: 'dmy' }[first] ?? 'ymd';
    },

    /**
     * Save the date format. Like the theme, not a data change (#249)
     */
    async updateDateFormat(format) {
        this.settings.dateFormat = format;
        await this.saveSettings();
    },

    /**
     * Scale a canvas text size drawn for the default base size to the chosen one
     */
    scaledPx(px) {
        return Math.round(px * this.settings.fontSizePx / APP_CONFIG.FONT_SIZE_DEFAULT_PX);
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

    /**
     * Every location Best Months have been calculated for, including one
     * calculated before per-location tracking
     */
    getBestMonthsLocations() {
        const names = Object.keys(this.settings.bestMonthsAltitudes);
        const last = this.settings.lastBestMonthsLocation;
        return last && !names.includes(last) ? [...names, last] : names;
    },

    /**
     * Record a location's finished Best Months: the min altitude, and the
     * calculation's version
     */
    async setBestMonthsAltitude(locationName, altitude) {
        this.settings.bestMonthsAltitudes = { ...this.settings.bestMonthsAltitudes, [locationName]: altitude };
        this.settings.bestMonthsVersions = { ...this.settings.bestMonthsVersions, [locationName]: APP_CONFIG.BEST_MONTHS_VERSION };
        await this.saveSettings();
    },

    /**
     * True when a location's Best Months were calculated the current way;
     * none recorded means before versions were kept (Issue #304)
     */
    bestMonthsCurrent(locationName) {
        return this.settings.bestMonthsVersions[locationName] === APP_CONFIG.BEST_MONTHS_VERSION;
    },

    async clearBestMonthsAltitudes() {
        this.settings.bestMonthsAltitudes = {};
        this.settings.bestMonthsVersions = {};
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

    getSeqPlanExposure(targetName) {
        return this.settings.seqPlanExposures[targetName] ?? APP_CONFIG.SEQ_PLAN_DEFAULT_EXPOSURE_S;
    },

    async setSeqPlanExposure(targetName, seconds) {
        this.settings.seqPlanExposures = { ...this.settings.seqPlanExposures, [targetName]: seconds };
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

    // The nights learned from (issue #295): { start, subGapS, ditherS } for
    // each Session Log, by its start time as the log writes it, with null for a figure the night
    // had too few clean samples for. The learned values are the average of
    // the newest of them (AsiairLogParser.updateLearnedValues).
    getLearnedNights() {
        return this.settings.learnedNights ?? [];
    },

    // Nights were keyed by an ISO instant read in the computer's time zone,
    // so another computer gave the same log another key. They're now keyed
    // by the log's own clock text (Issue #303). Returns whether any changed.
    _rekeyLearnedNights() {
        let changed = false;
        const nights = this.getLearnedNights().map(n => {
            if (!n.start?.includes('T')) return n;
            changed = true;
            const local = new Date(n.start);
            const wallClock = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(),
                local.getHours(), local.getMinutes(), local.getSeconds()));
            return { ...n, start: TimeUtils.formatWallClock(wallClock) };
        });
        if (changed) this.settings.learnedNights = nights;
        return changed;
    },

    hasLearnedFromLog(logStart) {
        return this.getLearnedNights().some(n => n.start === logStart);
    },

    async addLearnedNight(night, { subGapS, ditherS }) {
        this.settings.learnedNights = [...this.getLearnedNights(), night];
        if (subGapS != null) this.settings.learnedSubGapS = subGapS;
        if (ditherS != null) this.settings.learnedDitherDurationS = ditherS;
        this._deleteLearnedBefore295();
        await this.saveSettings();
    },

    // Fields from before issue #295: start times without figures, and the
    // last night's sample counts, which nothing read
    _deleteLearnedBefore295() {
        delete this.settings.learnedFromLogs;
        delete this.settings.learnedSubGapSampleCount;
        delete this.settings.learnedSubGapDate;
        delete this.settings.learnedDitherDurationSampleCount;
        delete this.settings.learnedDitherDurationDate;
    },

    getLearnedDitherDurationS() {
        return this.settings.learnedDitherDurationS ?? APP_CONFIG.DEFAULT_DITHER_DURATION_S;
    },

    // Back to the defaults, forgetting which logs they were learned from, so
    // loading those logs again relearns them (`astryx reset-learned`, issue #292)
    async resetLearnedValues() {
        this.settings.learnedSubGapS = APP_CONFIG.DEFAULT_SUB_GAP_S;
        this.settings.learnedDitherDurationS = APP_CONFIG.DEFAULT_DITHER_DURATION_S;
        delete this.settings.learnedNights;
        this._deleteLearnedBefore295();
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
