/**
 * db-manager-tauri.js
 * SQLite database backend for Tauri desktop build.
 * Exposes the same interface as DBManager (IndexedDB) so all managers
 * (DataManager, SettingsManager, ImagingLogManager, etc.) work unchanged.
 *
 * Uses window.__TAURI__.core.invoke() to call Rust commands defined in
 * src-tauri/src/commands/.
 */

const DBManagerTauri = {

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * No-op init — SQLite is opened in Rust at startup.
     * Matches DBManager.init() signature.
     */
    async init() {
        console.log('DBManagerTauri: SQLite backend ready');
        return true;
    },

    close() {
        // No-op — connection managed by Rust
    },

    deleteDatabase() {
        // Not supported in Tauri build
        console.warn('DBManagerTauri: deleteDatabase() not supported');
    },

    // ── Generic interface ─────────────────────────────────────────────────────
    // These map the generic DBManager calls (get, getAll, put, delete, clear,
    // putBulk) to the appropriate named Tauri commands per store.

    async get(storeName, key) {
        const handler = this._getHandler(storeName);
        return handler.get(key);
    },

    async getAll(storeName) {
        const handler = this._getHandler(storeName);
        return handler.getAll();
    },

    async put(storeName, data) {
        const handler = this._getHandler(storeName);
        return handler.put(data);
    },

    async delete(storeName, key) {
        const handler = this._getHandler(storeName);
        return handler.delete(key);
    },

    async clear(storeName) {
        const handler = this._getHandler(storeName);
        return handler.clear();
    },

    async putBulk(storeName, items) {
        const handler = this._getHandler(storeName);
        return handler.putBulk(items);
    },

    // ── Store handler registry ────────────────────────────────────────────────

    _getHandler(storeName) {
        const handlers = {
            [APP_CONFIG.STORES.SETTINGS]:         this._settingsHandler,
            [APP_CONFIG.STORES.LOCATIONS]:         this._locationsHandler,
            [APP_CONFIG.STORES.TELESCOPES]:        this._telescopesHandler,
            [APP_CONFIG.STORES.SENSORS]:           this._sensorsHandler,
            [APP_CONFIG.STORES.FILTERS]:           this._filtersHandler,
            [APP_CONFIG.STORES.TARGETS]:           this._targetsHandler,
            [APP_CONFIG.STORES.PINNED_TARGETS]:    this._pinnedTargetsHandler,
            [APP_CONFIG.STORES.TODO_TARGETS]:      this._todoTargetsHandler,
            [APP_CONFIG.STORES.IMAGING_PROJECTS]:  this._imagingProjectsHandler,
            [APP_CONFIG.STORES.IMAGING_SESSIONS]:  this._imagingSessionsHandler,
            [APP_CONFIG.STORES.IMAGING_PROGRAMS]:  this._imagingProgramsHandler,
            [APP_CONFIG.STORES.TUTORIAL_PROGRESS]: this._tutorialProgressHandler,
        };

        const handler = handlers[storeName];
        if (!handler) {
            if (storeName === APP_CONFIG.STORES.DSS_CACHE) {
                return this._noopHandler;
            }
            throw new Error(`DBManagerTauri: no handler for store "${storeName}"`);
        }
        return handler;
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    // Settings are stored as {id, data} objects matching the IndexedDB pattern.
    // 'app-settings' stores data as a JSON blob; 'target-version' stores a string.

    _settingsHandler: {
        async get(key) {
            if (key === 'app-settings') {
                const json = await invoke('get_settings');
                if (!json) return undefined;
                return { id: 'app-settings', data: JSON.parse(json) };
            }
            if (key === 'target-version') {
                const val = await invoke('get_target_version');
                if (!val) return undefined;
                return { id: 'target-version', value: val };
            }
            return undefined;
        },

        async getAll() {
            const results = [];
            const settings = await this.get('app-settings');
            if (settings) results.push(settings);
            const tv = await this.get('target-version');
            if (tv) results.push(tv);
            return results;
        },

        async put(data) {
            if (data.id === 'app-settings') {
                await invoke('save_settings', { data: JSON.stringify(data.data) });
                return data.id;
            }
            if (data.id === 'target-version') {
                await invoke('set_target_version', { version: String(data.value) });
                return data.id;
            }
        },

        async delete(key) {
            // Settings rows are not individually deleted
        },

        async clear() {
            // Settings are not bulk-cleared
        },

        async putBulk(items) {
            for (const item of items) {
                await this.put(item);
            }
        },
    },

    // ── Locations ─────────────────────────────────────────────────────────────

    _locationsHandler: {
        async get(name) {
            const all = await invoke('get_all_locations');
            return all.find(l => l.name === name);
        },

        async getAll() {
            return invoke('get_all_locations');
        },

        async put(data) {
            await invoke('save_location', { location: data });
            return data.name;
        },

        async delete(name) {
            await invoke('delete_location', { name });
        },

        async clear() {
            const all = await invoke('get_all_locations');
            for (const loc of all) {
                await invoke('delete_location', { name: loc.name });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await invoke('save_location', { location: item });
            }
        },
    },

    // ── Telescopes ────────────────────────────────────────────────────────────

    _telescopesHandler: {
        async get(name) {
            const all = await invoke('get_all_telescopes');
            return all.find(t => t.name === name);
        },

        async getAll() {
            return invoke('get_all_telescopes');
        },

        async put(data) {
            await invoke('save_telescope', { telescope: data });
            return data.name;
        },

        async delete(name) {
            await invoke('delete_telescope', { name });
        },

        async clear() {
            const all = await invoke('get_all_telescopes');
            for (const t of all) {
                await invoke('delete_telescope', { name: t.name });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await invoke('save_telescope', { telescope: item });
            }
        },
    },

    // ── Sensors ───────────────────────────────────────────────────────────────

    _sensorsHandler: {
        async get(name) {
            const all = await invoke('get_all_sensors');
            return all.find(s => s.name === name);
        },

        async getAll() {
            return invoke('get_all_sensors');
        },

        async put(data) {
            await invoke('save_sensor', { sensor: data });
            return data.name;
        },

        async delete(name) {
            await invoke('delete_sensor', { name });
        },

        async clear() {
            const all = await invoke('get_all_sensors');
            for (const s of all) {
                await invoke('delete_sensor', { name: s.name });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await invoke('save_sensor', { sensor: item });
            }
        },
    },

    // ── Filters ───────────────────────────────────────────────────────────────

    _filtersHandler: {
        async get(name) {
            const all = await invoke('get_all_filters');
            return all.find(f => f.name === name);
        },

        async getAll() {
            return invoke('get_all_filters');
        },

        async put(data) {
            await invoke('save_filter', { name: data.name });
            return data.name;
        },

        async delete(name) {
            await invoke('delete_filter', { name });
        },

        async clear() {
            const all = await invoke('get_all_filters');
            for (const f of all) {
                await invoke('delete_filter', { name: f.name });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await invoke('save_filter', { name: item.name });
            }
        },
    },

    // ── Targets ───────────────────────────────────────────────────────────────

    _targetsHandler: {
        async get(object) {
            const all = await invoke('get_all_targets');
            return all.find(t => t.object === object);
        },

        async getAll() {
            return invoke('get_all_targets');
        },

        async put(data) {
            await invoke('save_target', { target: data });
            return data.object;
        },

        async delete(object) {
            // Individual target deletion not needed in current app flow
            console.warn('DBManagerTauri: individual target delete not implemented');
        },

        async clear() {
            await invoke('delete_all_targets');
        },

        async putBulk(items) {
            await invoke('save_targets_bulk', { targets: items });
        },
    },

    // ── Pinned Targets ────────────────────────────────────────────────────────

    _pinnedTargetsHandler: {
        async get(name) {
            const all = await invoke('get_all_pinned_targets');
            return all.find(t => t.name === name);
        },

        async getAll() {
            return invoke('get_all_pinned_targets');
        },

        async put(data) {
            await invoke('save_pinned_target', { target: data });
            return data.name;
        },

        async delete(name) {
            await invoke('delete_pinned_target', { name });
        },

        async clear() {
            await invoke('clear_pinned_targets');
        },

        async putBulk(items) {
            for (const item of items) {
                await invoke('save_pinned_target', { target: item });
            }
        },
    },

    // ── To Do Targets ─────────────────────────────────────────────────────────

    _todoTargetsHandler: {
        async get(targetId) {
            const all = await invoke('get_all_todo_targets');
            return all.find(t => t.targetId === targetId);
        },

        async getAll() {
            return invoke('get_all_todo_targets');
        },

        async put(data) {
            await invoke('save_todo_target', { entry: data });
            return data.targetId;
        },

        async delete(targetId) {
            await invoke('delete_todo_target', { targetId });
        },

        async clear() {
            await invoke('clear_todo_targets');
        },

        async putBulk(items) {
            for (const item of items) {
                await invoke('save_todo_target', { entry: item });
            }
        },
    },

    // ── Imaging Projects ──────────────────────────────────────────────────────
    // create_project and update_project return the saved project with its id.
    // put() detects create vs update by presence of data.id.

    _imagingProjectsHandler: {
        async get(id) {
            return invoke('get_project', { id });
        },

        async getAll() {
            return invoke('get_all_projects');
        },

        async put(data) {
            if (data.id) {
                const saved = await invoke('update_project', { id: data.id, project: data });
                return saved.id;
            } else {
                const saved = await invoke('create_project', { project: data });
                return saved.id;
            }
        },

        async delete(id) {
            await invoke('delete_project', { id });
        },

        async clear() {
            const all = await invoke('get_all_projects');
            for (const p of all) {
                await invoke('delete_project', { id: p.id });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await this.put(item);
            }
        },
    },

    // ── Imaging Sessions ──────────────────────────────────────────────────────

    _imagingSessionsHandler: {
        async get(id) {
            return invoke('get_session', { id });
        },

        async getAll() {
            return invoke('get_all_sessions');
        },

        async put(data) {
            if (data.id) {
                const saved = await invoke('update_session', { id: data.id, session: data });
                return saved.id;
            } else {
                const saved = await invoke('create_session', { session: data });
                return saved.id;
            }
        },

        async delete(id) {
            await invoke('delete_session', { id });
        },

        async clear() {
            const all = await invoke('get_all_sessions');
            for (const s of all) {
                await invoke('delete_session', { id: s.id });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await this.put(item);
            }
        },
    },

    // ── Imaging Programs ──────────────────────────────────────────────────────

    _imagingProgramsHandler: {
        async get(id) {
            return invoke('get_program', { id });
        },

        async getAll() {
            return invoke('get_all_programs');
        },

        async put(data) {
            if (data.id) {
                const saved = await invoke('update_program', { id: data.id, program: data });
                return saved.id;
            } else {
                const saved = await invoke('create_program', { program: data });
                return saved.id;
            }
        },

        async delete(id) {
            await invoke('delete_program', { id });
        },

        async clear() {
            const all = await invoke('get_all_programs');
            for (const p of all) {
                await invoke('delete_program', { id: p.id });
            }
        },

        async putBulk(items) {
            for (const item of items) {
                await this.put(item);
            }
        },
    },

    // ── Tutorial Progress ─────────────────────────────────────────────────────

    _tutorialProgressHandler: {
        async get(id) {
            const result = await invoke('get_tutorial_progress', { id });
            if (!result) return undefined;
            return result.data ?? result;
        },

        async getAll() {
            // Not needed in current app flow
            return [];
        },

        async put(data) {
            await invoke('save_tutorial_progress', {
                id: data.id,
                data: JSON.stringify(data)
            });
            return data.id;
        },

        async delete(id) {
            await invoke('delete_tutorial_progress', { id });
        },

        async clear() {
            // Not needed in current app flow
        },

        async putBulk(items) {
            for (const item of items) {
                await this.put(item);
            }
        },
    },

    // ── No-op handler (dssCache — filesystem in Tauri) ────────────────────────

    _noopHandler: {
        async get(key) { return undefined; },
        async getAll() { return []; },
        async put(data) { return; },
        async delete(key) { return; },
        async clear() { return; },
        async putBulk(items) { return; },
    },

};

// ── invoke helper ─────────────────────────────────────────────────────────────
// Thin wrapper so handlers can call invoke() without the full Tauri path.
// All ~40 store handler methods route through this single function, so
// centralizing error handling here covers every Rust command call site —
// no per-handler try/catch needed (see Issue #173).

async function invoke(command, args = {}) {
    try {
        return await window.__TAURI__.core.invoke(command, args);
    } catch (e) {
        console.error(`DBManagerTauri: ${command} failed:`, e);
        if (typeof UIManager !== 'undefined' && UIManager.showToast) {
            UIManager.showToast(`Database error: ${command} failed`, 'error');
        }
        throw e; // re-throw so callers' existing logic still sees the failure
    }
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
