/**
 * data-manager.js
 * Manages locations, target database, and pinned targets
 */

const DataManager = {
    locations: {},
    targetDatabase: [],
    pinnedTargets: [],
    telescopes: {},
    sensors: {},
    filters: {},

    /**
     * Initialize - load all data from IndexedDB
     */
    async init() {
        try {
            await this.loadLocations();
            await this.loadTargets();
            await this.loadPinnedTargets();
            await this.loadTelescopes();
            await this.loadSensors();
            await this.loadFilters();
            console.log('DataManager initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing DataManager:', error);
            return false;
        }
    },

// ============================================================================
    // Locations
    // ============================================================================

    /**
     * Sort a horizon array by azimuth ascending. Single source of truth for
     * horizon ordering (Issue #206) — getHorizonElevationAtAzimuth relies on
     * this invariant and does not sort internally.
     */
    sortHorizonByAzimuth(horizon) {
        return [...horizon].sort((a, b) => a.azimuth - b.azimuth);
    },

    /**
     * Check whether a horizon array is already sorted by azimuth, so the
     * startup migration can skip writing back locations that don't need it
     * (Issue #206).
     */
    isHorizonSorted(horizon) {
        for (let i = 1; i < horizon.length; i++) {
            if (horizon[i].azimuth < horizon[i - 1].azimuth) return false;
        }
        return true;
    },

    /**
     * Load all locations from IndexedDB
     */
    async loadLocations() {
        const locationArray = await DBManager.getAll(APP_CONFIG.STORES.LOCATIONS);
        this.locations = {};
        locationArray.forEach(loc => {
            this.locations[loc.name] = {
                latitude: loc.latitude,
                longitude: loc.longitude,
                elevation: loc.elevation,
                timezone: loc.timezone,
                timeZone: loc.timeZone ?? null,
                bortle: loc.bortle,
                horizon: loc.horizon || APP_CONFIG.NOTIONAL_HORIZON
            };
        });

        // One-time migration: locations saved before time zones were stored
        // take this computer's zone when its standard offset matches theirs.
        // Others are left for the user to set; until then they get no DST.
        const computerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const computerOffset = TimeUtils.standardOffsetHours(computerZone, new Date().getFullYear());
        for (const name of Object.keys(this.locations)) {
            const location = this.locations[name];
            if (location.timeZone === null && location.timezone === computerOffset) {
                location.timeZone = computerZone;
                await DBManager.put(APP_CONFIG.STORES.LOCATIONS, { name, ...location });
            }
        }

        // One-time migration guard: fix any horizon that predates the
        // sorted-on-save invariant (Issue #206). Check-then-write so an
        // already-sorted fleet of locations costs zero DB writes.
        for (const name of Object.keys(this.locations)) {
            const horizon = this.locations[name].horizon;
            if (!this.isHorizonSorted(horizon)) {
                Log.debug(`Sorting out-of-order horizon for location "${name}" (Issue #206 migration)`);
                this.locations[name].horizon = this.sortHorizonByAzimuth(horizon);
                await DBManager.put(APP_CONFIG.STORES.LOCATIONS, {
                    name: name,
                    ...this.locations[name]
                });
            }
        }
    },

    /**
     * Get all locations
     */
    getLocations() {
        return this.locations;
    },

    /**
     * Get a specific location
     */
    getLocation(name) {
        return this.locations[name];
    },

    /**
     * The name in records (keyed by name) that matches name, ignoring case
     * and surrounding spaces, or undefined, so a save never silently
     * replaces a record (Issue #326)
     */
    existingName(records, name) {
        const wanted = name.trim().toLowerCase();
        return Object.keys(records).find(key => key.trim().toLowerCase() === wanted);
    },

    /**
     * Save a location
     */
    async saveLocation(name, location) {
        // Ensure horizon exists, initialize with notional if not provided
        if (!location.horizon) {
            location.horizon = APP_CONFIG.NOTIONAL_HORIZON;
        }

        // Guarantee sorted-by-azimuth invariant on every save (Issue #206)
        location.horizon = this.sortHorizonByAzimuth(location.horizon);

        // The standard offset follows from the time zone
        if (location.timeZone) {
            location.timezone = TimeUtils.standardOffsetHours(location.timeZone, new Date().getFullYear());
        }

        this.locations[name] = location;
        await DBManager.put(APP_CONFIG.STORES.LOCATIONS, {
            name: name,
            ...location
        });
    },

    /**
     * Target fields holding one value per location, keyed by location name
     */
    PER_LOCATION_FIELDS: ['bestMonth', 'peakAltitude', 'visibilityStart', 'visibilityEnd'],

    /**
     * Delete a location. Its Best Months data is removed from the targets
     * first, in one bulk write, so a failure leaves the location in place
     * (Issue #316).
     */
    async deleteLocation(name) {
        await this.cleanupLocationDataFromTargets(name);
        delete this.locations[name];
        await DBManager.delete(APP_CONFIG.STORES.LOCATIONS, name);
    },

    /**
     * Remove a location's per-location data from every target that has it.
     * Memory changes only once the write has succeeded (Issue #316).
     */
    async cleanupLocationDataFromTargets(locationName) {
        const holds = target => this.PER_LOCATION_FIELDS.some(field =>
            target[field] && typeof target[field] === 'object' && target[field][locationName] !== undefined);
        const changed = this.targetDatabase.filter(holds);
        if (changed.length === 0) return;

        const cleaned = changed.map(target => {
            const copy = { ...target };
            for (const field of this.PER_LOCATION_FIELDS) {
                if (copy[field] && typeof copy[field] === 'object') {
                    const { [locationName]: _removed, ...rest } = copy[field];
                    copy[field] = rest;
                }
            }
            return copy;
        });
        await this.bulkUpdateTargets(cleaned);

        changed.forEach((target, i) => {
            for (const field of this.PER_LOCATION_FIELDS) target[field] = cleaned[i][field];
        });
    },

    // ============================================================================
    // Target Database
    // ============================================================================

    /**
     * Load all targets from IndexedDB
     */
    async loadTargets() {
        this.targetDatabase = await DBManager.getAll(APP_CONFIG.STORES.TARGETS);

        // In Tauri, if targets table is empty, force a fresh load from CSV
        // regardless of stored target version. This handles the case where
        // a userdata restore sets target-version but targets aren't in SQLite.
        if (typeof window.__TAURI__ !== 'undefined' && this.targetDatabase.length === 0) {
            const meta = await this.fetchTargetMeta();
            if (meta) {
                await this.fetchAndLoadTargets(meta);
            }
        }
    },

    /**
     * Bulk update targets in storage.
     * Callers are responsible for batching if needed.
     * @param {Array} targets - Array of target objects to write
     */
    async bulkUpdateTargets(targets) {
        await DBManager.putBulk(APP_CONFIG.STORES.TARGETS, targets);
    },

    /**
     * Get all targets
     */
    getTargets() {
        return this.targetDatabase;
    },

    /**
     * Search targets by query, in catalogue order, stopping at `limit` matches
     */
    searchTargets(query, limit = Infinity) {
        const lowerQuery = query.toLowerCase().trim();

        // Catalogue + number without a space ("m31", "ngc7000") also matches the spaced form ("m 31")
        const match = lowerQuery.match(/^([a-z]+)(\d+)$/);
        const spacedQuery = match ? `${match[1]} ${match[2]}` : null;

        // For catalogue-style queries, skip the other field to avoid
        // returning unrelated objects that merely reference this designation
        const isCatalogueQuery = !!match || /^[a-z]+\s+\d+$/.test(lowerQuery);
        const matches = text => text.includes(lowerQuery) || (spacedQuery !== null && text.includes(spacedQuery));

        // Issue #314: one pass, no de-duplication (object is the primary key in both backends)
        const results = [];
        for (const target of this.targetDatabase) {
            if (matches(target.object.toLowerCase()) ||
                (target.common && matches(target.common.toLowerCase())) ||
                (!isCatalogueQuery && target.other && matches(target.other.toLowerCase()))) {
                results.push(target);
                if (results.length >= limit) break;
            }
        }
        return results;
    },

    /**
     * Get a specific target by object name
     */
    getTarget(objectName) {
        return this.targetDatabase.find(t => t.object === objectName);
    },

    /**
     * Import target database from CSV/parsed data
     */
    async importTargets(targetsArray, targetVersion) {
        // Merge new targets with existing (no clear)
        await DBManager.putBulk(APP_CONFIG.STORES.TARGETS, targetsArray);
        if (targetVersion) {
            await this.setTargetVersion(targetVersion);
        }
        await this.loadTargets();
        return this.targetDatabase.length;
    },

    async getTargetVersion() {
        const record = await DBManager.get(APP_CONFIG.STORES.SETTINGS, 'target-version');
        return record ? record.value : null;
    },

    async setTargetVersion(version) {
        await DBManager.put(APP_CONFIG.STORES.SETTINGS, {
            id: 'target-version',
            value: version
        });
    },

    async fetchAndLoadTargets(meta) {
        try {
            const response = await fetch(APP_CONFIG.TARGET_DATA_PATH + meta.filename);
            if (!response.ok) {
                console.warn('Target CSV file not found or unavailable');
                return false;
            }
            const text = await response.text();
            const parsed = CSVUtils.parseTargetCSV(text);

            if (parsed.errors.length > 0) {
                console.warn('Target CSV parse errors:', parsed.errors);
            }

            if (parsed.targets.length === 0) {
                console.warn('No targets parsed from CSV');
                return false;
            }

            await DBManager.replaceTargets(parsed.targets, String(meta.version));
            await this.loadTargets();
            Log.debug(`Target database loaded: ${parsed.targets.length} targets (version ${meta.version})`);

            if (parsed.targets.length !== meta.count) {
                console.warn(`Count mismatch: expected ${meta.count}, loaded ${parsed.targets.length}`);
            }

            return true;
        } catch (error) {
            console.warn('Failed to fetch and load targets:', error.message);
            return false;
        }
    },

    async fetchTargetMeta() {
        try {
            const response = await fetch(APP_CONFIG.TARGET_DATA_PATH + 'targets-meta.json?v=' + Date.now());
            if (!response.ok) {
                console.warn('targets-meta.json not found or unavailable');
                return null;
            }
            const meta = await response.json();
            return meta;
        } catch (error) {
            console.warn('Failed to fetch targets-meta.json:', error.message);
            return null;
        }
    },

    // ============================================================================
    // Pinned Targets
    // ============================================================================

    /**
     * Load pinned targets from IndexedDB
     */
    async loadPinnedTargets() {
        this.pinnedTargets = await DBManager.getAll(APP_CONFIG.STORES.PINNED_TARGETS);
    },

    /**
     * Get all pinned targets
     */
    getPinnedTargets() {
        return this.pinnedTargets;
    },

    /**
     * The fields a pin keeps for a catalogue target: its name and position,
     * never a copy of the whole record (Issue #332)
     */
    pinnedRecord(target) {
        return { name: target.object, ra: target.ra, dec: target.dec, common: target.common ?? '' };
    },

    /**
     * Pin a target
     */
    async pinTarget(target) {
        // Check if already pinned
        const existing = this.pinnedTargets.find(t => t.name === target.name);
        if (existing) {
            return false;
        }

        this.pinnedTargets.push(target);
        await DBManager.put(APP_CONFIG.STORES.PINNED_TARGETS, target);
        document.dispatchEvent(new CustomEvent('pinned-targets-updated'));
        return true;
    },

    /**
     * Unpin a target
     */
    async unpinTarget(name) {
        this.pinnedTargets = this.pinnedTargets.filter(t => t.name !== name);
        await DBManager.delete(APP_CONFIG.STORES.PINNED_TARGETS, name);
        await this.loadPinnedTargets();
        document.dispatchEvent(new CustomEvent('pinned-targets-updated'));
        return true;
    },

    // ============================================================================
    // Telescopes
    // ============================================================================

    /**
     * Load all telescopes from IndexedDB
     */
    async loadTelescopes() {
        const telescopeArray = await DBManager.getAll(APP_CONFIG.STORES.TELESCOPES);
        this.telescopes = {};
        telescopeArray.forEach(tel => {
            this.telescopes[tel.name] = {
                focalLength: tel.focalLength,
                aperture: tel.aperture,
                multiplier: tel.multiplier
            };
        });
    },

    /**
     * Get all telescopes
     */
    getTelescopes() {
        return this.telescopes;
    },

    /**
     * Get a specific telescope
     */
    getTelescope(name) {
        return this.telescopes[name];
    },

    /**
     * Save a telescope
     */
    async saveTelescope(name, telescope) {
        this.telescopes[name] = telescope;
        await DBManager.put(APP_CONFIG.STORES.TELESCOPES, {
            name: name,
            ...telescope
        });
    },

    /**
     * Delete a telescope
     */
    async deleteTelescope(name) {
        delete this.telescopes[name];
        await DBManager.delete(APP_CONFIG.STORES.TELESCOPES, name);
    },

    // ============================================================================
    // Sensors
    // ============================================================================

    /**
     * Load all sensors from IndexedDB
     */
    async loadSensors() {
        const sensorArray = await DBManager.getAll(APP_CONFIG.STORES.SENSORS);
        this.sensors = {};
        sensorArray.forEach(sensor => {
            this.sensors[sensor.name] = {
                resolutionX: sensor.resolutionX,
                resolutionY: sensor.resolutionY,
                pixelSizeX: sensor.pixelSizeX,
                pixelSizeY: sensor.pixelSizeY
            };
        });
    },

    /**
     * Get all sensors
     */
    getSensors() {
        return this.sensors;
    },

    /**
     * Get a specific sensor
     */
    getSensor(name) {
        return this.sensors[name];
    },

    /**
     * Save a sensor
     */
    async saveSensor(name, sensor) {
        this.sensors[name] = sensor;
        await DBManager.put(APP_CONFIG.STORES.SENSORS, {
            name: name,
            ...sensor
        });
    },

    /**
     * Delete a sensor
     */
    async deleteSensor(name) {
        delete this.sensors[name];
        await DBManager.delete(APP_CONFIG.STORES.SENSORS, name);
    },

    // ============================================================================
    // Filters
    // ============================================================================

    /**
     * Load all filters from IndexedDB
     */
    async loadFilters() {
        const filterArray = await DBManager.getAll(APP_CONFIG.STORES.FILTERS);
        this.filters = {};
        filterArray.forEach(filter => {
            this.filters[filter.name] = {};
        });
    },

    /**
     * Get all filters
     */
    getFilters() {
        return this.filters;
    },

    /**
     * Get a specific filter
     */
    getFilter(name) {
        return this.filters[name];
    },

    /**
     * Save a filter
     */
    async saveFilter(name) {
        this.filters[name] = {};
        await DBManager.put(APP_CONFIG.STORES.FILTERS, { name: name });
    },

    /**
     * Delete a filter
     */
    async deleteFilter(name) {
        delete this.filters[name];
        await DBManager.delete(APP_CONFIG.STORES.FILTERS, name);
    },
};
