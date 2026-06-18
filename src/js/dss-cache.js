/**
 * dss-cache.js
 * DSS image cache — routes to IndexedDB (web) or filesystem (Tauri)
 */

const DSSCache = {

    /**
     * Retrieve a cached DSS image by key.
     * Returns dataUrl string or null if not found / expired.
     */
    async get(key, duration) {
        if (window.__TAURI__) {
            return this._getFromFile(key, duration);
        } else {
            return this._getFromDB(key, duration);
        }
    },

    /**
     * Save a DSS image to cache.
     */
    async save(key, dataUrl) {
        if (window.__TAURI__) {
            return this._saveToFile(key, dataUrl);
        } else {
            return this._saveToDB(key, dataUrl);
        }
    },

    /**
     * Purge expired entries. Pass duration so each caller
     * can purge with its own expiry window.
     */
    async purge(duration) {
        if (window.__TAURI__) {
            return this._purgeFiles(duration);
        } else {
            return this._purgeDB(duration);
        }
    },

    // ─── IndexedDB backend ───────────────────────────────────────────────────

    async _getFromDB(key, duration) {
        try {
            const cached = await DBManager.get(APP_CONFIG.STORES.DSS_CACHE, key);
            if (!cached) return null;
            const age = Date.now() - (cached.lastAccessed ?? cached.timestamp);
            if (age > duration) {
                await DBManager.delete(APP_CONFIG.STORES.DSS_CACHE, key);
                return null;
            }
            await DBManager.put(APP_CONFIG.STORES.DSS_CACHE, { ...cached, lastAccessed: Date.now() });
            return cached.dataUrl;
        } catch (e) {
            return null;
        }
    },

    async _saveToDB(key, dataUrl) {
        try {
            await DBManager.put(APP_CONFIG.STORES.DSS_CACHE, {
                id: key,
                dataUrl,
                timestamp: Date.now(),
                lastAccessed: Date.now()
            });
        } catch (e) {
            console.warn('DSSCache: failed to save to IndexedDB:', e);
        }
    },

    async _purgeDB(duration) {
        try {
            const all = await DBManager.getAll(APP_CONFIG.STORES.DSS_CACHE);
            const cutoff = Date.now() - duration;
            for (const entry of all) {
                const lastAccessed = entry.lastAccessed ?? entry.timestamp;
                if (lastAccessed < cutoff) {
                    await DBManager.delete(APP_CONFIG.STORES.DSS_CACHE, entry.id);
                }
            }
        } catch (e) {
            console.warn('DSSCache: failed to purge IndexedDB:', e);
        }
    },

    // ─── Tauri filesystem backend ─────────────────────────────────────────────

    _cacheDir: null,
    _indexPath: null,
    _index: null,

    async _ensureInit() {
        if (this._cacheDir) return;
        const { appDataDir, join } = window.__TAURI__.path;
        const appData = await appDataDir();
        this._cacheDir = await join(appData, 'dss-cache');
        this._indexPath = await join(this._cacheDir, 'index.json');
        const { mkdir } = window.__TAURI__.fs;
        await mkdir(this._cacheDir, { recursive: true }).catch(() => {});
        await this._loadIndex();
    },

    async _loadIndex() {
        try {
            const { readTextFile } = window.__TAURI__.fs;
            const text = await readTextFile(this._indexPath);
            this._index = JSON.parse(text);
        } catch (e) {
            this._index = {};
        }
    },

    async _saveIndex() {
        try {
            const { writeTextFile } = window.__TAURI__.fs;
            await writeTextFile(this._indexPath, JSON.stringify(this._index));
        } catch (e) {
            console.warn('DSSCache: failed to write index:', e);
        }
    },

    async _getFromFile(key, duration) {
        try {
            await this._ensureInit();
            const entry = this._index[key];
            if (!entry) return null;
            const age = Date.now() - (entry.lastAccessed ?? entry.timestamp);
            if (age > duration) {
                await this._deleteFile(key);
                return null;
            }
            const { join } = window.__TAURI__.path;
            const { readFile } = window.__TAURI__.fs;
            const filePath = await join(this._cacheDir, key + '.jpg');
            const bytes = await readFile(filePath);
            const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
            // Update lastAccessed
            this._index[key].lastAccessed = Date.now();
            await this._saveIndex();
            return 'data:image/jpeg;base64,' + base64;
        } catch (e) {
            return null;
        }
    },

    async _saveToFile(key, dataUrl) {
        try {
            await this._ensureInit();
            const { join } = window.__TAURI__.path;
            const { writeFile } = window.__TAURI__.fs;
            // Strip data URL prefix and decode to binary
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const filePath = await join(this._cacheDir, key + '.jpg');
            await writeFile(filePath, bytes);
            const now = Date.now();
            this._index[key] = { timestamp: now, lastAccessed: now };
            await this._saveIndex();
        } catch (e) {
            console.warn('DSSCache: failed to save file:', e);
        }
    },

    async _deleteFile(key) {
        try {
            const { join } = window.__TAURI__.path;
            const { removeFile } = window.__TAURI__.fs;
            const filePath = await join(this._cacheDir, key + '.jpg');
            await removeFile(filePath).catch(() => {});
            delete this._index[key];
            await this._saveIndex();
        } catch (e) {
            console.warn('DSSCache: failed to delete file:', e);
        }
    },

    async _purgeFiles(duration) {
        try {
            await this._ensureInit();
            const cutoff = Date.now() - duration;
            for (const key of Object.keys(this._index)) {
                const entry = this._index[key];
                const lastAccessed = entry.lastAccessed ?? entry.timestamp;
                if (lastAccessed < cutoff) {
                    await this._deleteFile(key);
                }
            }
        } catch (e) {
            console.warn('DSSCache: failed to purge files:', e);
        }
    }
};
