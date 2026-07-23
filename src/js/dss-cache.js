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

    async _ensureInit() {
        if (this._cacheDir) return;
        const { appDataDir, join } = window.__TAURI__.path;
        const appData = await appDataDir();
        this._cacheDir = await join(appData, 'dss-cache');
        const { mkdir } = window.__TAURI__.fs;
        await mkdir(this._cacheDir, { recursive: true }).catch(() => {});
    },

    async _getFromFile(key, duration) {
        try {
            await this._ensureInit();
            const { join } = window.__TAURI__.path;
            const { readFile, stat } = window.__TAURI__.fs;
            const filePath = await join(this._cacheDir, key + '.jpg');
            const info = await stat(filePath);
            const age = Date.now() - info.mtime.getTime();
            if (age > duration) {
                await this._deleteFile(key);
                return null;
            }
            const bytes = await readFile(filePath);
            const base64 = this._bytesToBase64(bytes);
            return 'data:image/jpeg;base64,' + base64;
        } catch (e) {
            return null;
        }
    },

    /**
     * Convert bytes to base64 in fixed-size chunks (Issue #221).
     * btoa(String.fromCharCode(...bytes)) spreads the entire array as
     * individual call arguments — slow for larger images and a potential
     * RangeError ("Maximum call stack size exceeded") on large ones.
     * Chunking avoids both.
     */
    _bytesToBase64(bytes) {
        const CHUNK_SIZE = APP_CONFIG.DSS_BASE64_CHUNK_SIZE;
        const byteArray = new Uint8Array(bytes);
        let binary = '';
        for (let i = 0; i < byteArray.length; i += CHUNK_SIZE) {
            const chunk = byteArray.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
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
        } catch (e) {
            console.warn('DSSCache: failed to delete file:', e);
        }
    },

    async _purgeFiles(duration) {
        try {
            await this._ensureInit();
            const { join } = window.__TAURI__.path;
            const { readDir, stat, removeFile } = window.__TAURI__.fs;
            const entries = await readDir(this._cacheDir);
            const cutoff = Date.now() - duration;
            for (const entry of entries) {
                if (!entry.name || !entry.name.endsWith('.jpg')) continue;
                const filePath = await join(this._cacheDir, entry.name);
                const info = await stat(filePath);
                if (info.mtime.getTime() < cutoff) {
                    await removeFile(filePath).catch(() => {});
                }
            }
        } catch (e) {
            console.warn('DSSCache: failed to purge files:', e);
        }
    }
};
