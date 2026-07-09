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
                bortle: loc.bortle,
                horizon: loc.horizon || APP_CONFIG.NOTIONAL_HORIZON
            };
        });
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
     * Save a location
     */
    async saveLocation(name, location) {
        // Ensure horizon exists, initialize with notional if not provided
        if (!location.horizon) {
            location.horizon = APP_CONFIG.NOTIONAL_HORIZON;
        }

        this.locations[name] = location;
        await DBManager.put(APP_CONFIG.STORES.LOCATIONS, {
            name: name,
            ...location
        });
    },

    /**
     * Delete a location
     */
    async deleteLocation(name) {
        delete this.locations[name];
        await DBManager.delete(APP_CONFIG.STORES.LOCATIONS, name);

        // Clean up best month data for this location from all targets
        await this.cleanupLocationDataFromTargets(name);
    },

    /**
     * Remove location-specific data from all targets
     * Called when a location is deleted
     */
    async cleanupLocationDataFromTargets(locationName) {
        let cleanedCount = 0;

        for (const target of this.targetDatabase) {
            let needsUpdate = false;

            // Remove location data from bestMonth object
            if (target.bestMonth && typeof target.bestMonth === 'object' && target.bestMonth[locationName] !== undefined) {
                delete target.bestMonth[locationName];
                needsUpdate = true;
            }

            // Remove location data from peakAltitude object
            if (target.peakAltitude && typeof target.peakAltitude === 'object' && target.peakAltitude[locationName] !== undefined) {
                delete target.peakAltitude[locationName];
                needsUpdate = true;
            }

            // Remove location data from visibilityStart object
            if (target.visibilityStart && typeof target.visibilityStart === 'object' && target.visibilityStart[locationName] !== undefined) {
                delete target.visibilityStart[locationName];
                needsUpdate = true;
            }

            // Remove location data from visibilityEnd object
            if (target.visibilityEnd && typeof target.visibilityEnd === 'object' && target.visibilityEnd[locationName] !== undefined) {
                delete target.visibilityEnd[locationName];
                needsUpdate = true;
            }

            // Save target if any data was removed
            if (needsUpdate) {
                await DBManager.put(APP_CONFIG.STORES.TARGETS, target);
                cleanedCount++;
            }
        }

        // Reload targets to refresh in-memory data
        await this.loadTargets();
    },

    /**
     * Import locations from JSON
     */
    async importLocations(locationsData) {
        // Clear existing locations
        await DBManager.clear(APP_CONFIG.STORES.LOCATIONS);

        // Save new locations
        const locationArray = Object.entries(locationsData).map(([name, loc]) => ({
            name: name,
            ...loc
        }));

        await DBManager.putBulk(APP_CONFIG.STORES.LOCATIONS, locationArray);
        await this.loadLocations();

        return Object.keys(this.locations).length;
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
     * Search targets by query
     */
    searchTargets(query) {
        const lowerQuery = query.toLowerCase().trim();

        // Check if query is catalog+number without space (e.g., "M31", "NGC7000")
        // Pattern: letters followed by numbers with no space
        const catalogPattern = /^([A-Za-z]+)(\d+)$/;
        const match = lowerQuery.match(catalogPattern);

        // Create spaced version if pattern matches (e.g., "m31" → "m 31")
        const spacedQuery = match ? `${match[1]} ${match[2]}` : null;

        return this.targetDatabase.filter(target => {
            const objectLower = target.object.toLowerCase();
            const commonLower = target.common ? target.common.toLowerCase() : '';
            const otherLower = target.other ? target.other.toLowerCase() : '';

            // Search with original query
            // For catalogue-style queries, skip the other field to avoid
            // returning unrelated objects that merely reference this designation
            const isCatalogueQuery = !!match || /^[a-z]+\s+\d+$/i.test(lowerQuery);

            // Search with original query
            const matchesOriginal =
                  objectLower.includes(lowerQuery) ||
                  commonLower.includes(lowerQuery) ||
                  (!isCatalogueQuery && otherLower.includes(lowerQuery));

            // Also search with spaced version if it exists
            const matchesSpaced = spacedQuery && (
                objectLower.includes(spacedQuery) ||
                    commonLower.includes(spacedQuery) ||
                    (!isCatalogueQuery && otherLower.includes(spacedQuery))
            );

            return matchesOriginal || matchesSpaced;
        }).filter((target, index, arr) =>
            arr.findIndex(t => t.object === target.object) === index
        );
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

            await DBManager.clear(APP_CONFIG.STORES.TARGETS);
            await this.importTargets(parsed.targets, String(meta.version));
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
     * Pin a target
     */
    async pinTarget(target) {
        // Check if already pinned
        const existing = this.pinnedTargets.find(t => t.object === target.name);
        if (existing) {
            return false;
        }

        this.pinnedTargets.push(target);
        await DBManager.put(APP_CONFIG.STORES.PINNED_TARGETS, target);
        return true;
    },

    /**
     * Unpin a target
     */
    async unpinTarget(name) {
        this.pinnedTargets = this.pinnedTargets.filter(t => t.name !== name);
        await DBManager.delete(APP_CONFIG.STORES.PINNED_TARGETS, name);
        await this.loadPinnedTargets();
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


    // ============================================================================
    // Export/Import
    // ============================================================================

    /**
     * Export all data as unified JSON
     */
    async exportAll() {
        return {
            version: APP_CONFIG.APP_VERSION,
            exportDate: new Date().toISOString(),
            settings: SettingsManager.getSettings(),
            locations: this.locations,
            telescopes: this.telescopes,
            sensors: this.sensors,
            filters: this.filters,
            pinnedTargets: this.pinnedTargets,
            toDoTargets: ToDoManager.getToDoList(),
            targetDatabase: this.targetDatabase
        };
    },

    /**
     * Import unified JSON data
     */
    async importAll(data) {
        try {
            // Close and reopen database to ensure clean state
            DBManager.close();
            await DBManager.init();

            if (data.locations) {
                await this.importLocations(data.locations);
            }
            if (data.targetDatabase) {
                await DBManager.clear(APP_CONFIG.STORES.TARGETS);
                await DBManager.putBulk(APP_CONFIG.STORES.TARGETS, data.targetDatabase);
                await this.loadTargets();
            }
            if (data.pinnedTargets) {
                await DBManager.clear(APP_CONFIG.STORES.PINNED_TARGETS);
                await DBManager.putBulk(APP_CONFIG.STORES.PINNED_TARGETS, data.pinnedTargets);
                await this.loadPinnedTargets();
            }
            if (data.telescopes) {
                await DBManager.clear(APP_CONFIG.STORES.TELESCOPES);
                const telescopeArray = Object.entries(data.telescopes).map(([name, tel]) => ({
                    name: name,
                    ...tel
                }));
                await DBManager.putBulk(APP_CONFIG.STORES.TELESCOPES, telescopeArray);
                await this.loadTelescopes();
            }
            if (data.sensors) {
                await DBManager.clear(APP_CONFIG.STORES.SENSORS);
                const sensorArray = Object.entries(data.sensors).map(([name, sensor]) => ({
                    name: name,
                    ...sensor
                }));
                await DBManager.putBulk(APP_CONFIG.STORES.SENSORS, sensorArray);
                await this.loadSensors();
            }
            if (data.filters) {
                await DBManager.clear(APP_CONFIG.STORES.FILTERS);
                const filterArray = Object.entries(data.filters).map(([name]) => ({
                    name: name
                }));
                await DBManager.putBulk(APP_CONFIG.STORES.FILTERS, filterArray);
                await this.loadFilters();
            }

            if (data.settings) {
                await DBManager.put(APP_CONFIG.STORES.SETTINGS, {
                    id: 'app-settings',
                    data: data.settings
                });
                await SettingsManager.reload();
            }
            if (data.toDoTargets) {
                await DBManager.clear(APP_CONFIG.STORES.TODO_TARGETS);
                await DBManager.putBulk(APP_CONFIG.STORES.TODO_TARGETS, data.toDoTargets);
                await ToDoManager.loadFromDB();
            }

            console.log('All data imported successfully');
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    },

    /**
     * Clear all data from database
     */
    async clearAll() {
        try {
            // Clear all data stores (but not settings)
            await DBManager.clear(APP_CONFIG.STORES.LOCATIONS);
            await DBManager.clear(APP_CONFIG.STORES.TARGETS);
            await DBManager.clear(APP_CONFIG.STORES.PINNED_TARGETS);
            await DBManager.clear(APP_CONFIG.STORES.TELESCOPES);
            await DBManager.clear(APP_CONFIG.STORES.SENSORS);
            await DBManager.clear(APP_CONFIG.STORES.FILTERS);

            // Reset in-memory data
            this.locations = {};
            this.targetDatabase = [];
            this.pinnedTargets = [];
            this.telescopes = {};
            this.sensors = {};
            this.filters = {};

            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    },

    /**
     * Export imaging log data (projects, sessions, programs)
     */
    async exportImagingLog() {
        const projects = await ImagingLogManager.getAllProjects();
        const sessions = await ImagingLogManager.getAllSessions();
        const programs = await ImagingLogManager.getAllPrograms();

        return {
            version: APP_CONFIG.APP_VERSION,
            exportDate: new Date().toISOString(),
            imagingLog: {
                projects: projects,
                sessions: sessions,
                programs: programs
            }
        };
    },

    /**
     * Import imaging log data
     * @param {Object} data - Imaging log data to import
     * @param {boolean} clearExisting - Whether to clear existing data first
     */
    async importImagingLog(data, clearExisting = false) {
        try {
            // Validate data structure
            if (!data.imagingLog) {
                throw new Error('Invalid imaging log export format');
            }

            const { projects, sessions, programs } = data.imagingLog;

            // Clear existing data if requested
            if (clearExisting) {
                await DBManager.clear(APP_CONFIG.STORES.IMAGING_PROJECTS);
                await DBManager.clear(APP_CONFIG.STORES.IMAGING_SESSIONS);
                await DBManager.clear(APP_CONFIG.STORES.IMAGING_PROGRAMS);
            }

            // Import projects
            if (projects && projects.length > 0) {
                for (const project of projects) {
                    await DBManager.put(APP_CONFIG.STORES.IMAGING_PROJECTS, project);
                }
            }

            // Import sessions
            if (sessions && sessions.length > 0) {
                for (const session of sessions) {
                    await DBManager.put(APP_CONFIG.STORES.IMAGING_SESSIONS, session);
                }
            }

            // Import programs
            if (programs && programs.length > 0) {
                for (const program of programs) {
                    await DBManager.put(APP_CONFIG.STORES.IMAGING_PROGRAMS, program);
                }
            }

            console.log('Imaging log data imported successfully');
            return {
                projects: projects?.length || 0,
                sessions: sessions?.length || 0,
                programs: programs?.length || 0
            };
        } catch (error) {
            console.error('Error importing imaging log:', error);
            throw error;
        }
    }

};
