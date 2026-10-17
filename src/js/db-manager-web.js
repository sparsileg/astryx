/**
 * db-manager-web.js
 * IndexedDB database operations
 */

const DBManagerWeb = {
    db: null,

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(APP_CONFIG.DB_NAME, APP_CONFIG.DB_VERSION);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            // Another tab still has the old version open (Issue #300)
            request.onblocked = () => {
                if (typeof UIManager !== 'undefined' && UIManager.showToast) {
                    UIManager.showToast('Close other Astryx tabs to finish updating the database', 'warning', APP_CONFIG.TOAST_LONG_DURATION_MS);
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                // A newer version is opening in another tab: let it upgrade,
                // and reload to run the new version here too
                db.onversionchange = () => {
                    db.close();
                    location.reload();
                };
                this.db = db;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const oldVersion = e.oldVersion;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.SETTINGS)) {
                    db.createObjectStore(APP_CONFIG.STORES.SETTINGS, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.LOCATIONS)) {
                    db.createObjectStore(APP_CONFIG.STORES.LOCATIONS, { keyPath: 'name' });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.TELESCOPES)) {
                    db.createObjectStore(APP_CONFIG.STORES.TELESCOPES, { keyPath: 'name' });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.SENSORS)) {
                    db.createObjectStore(APP_CONFIG.STORES.SENSORS, { keyPath: 'name' });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.PINNED_TARGETS)) {
                    db.createObjectStore(APP_CONFIG.STORES.PINNED_TARGETS, { keyPath: 'name' });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.TODO_TARGETS)) {
                    const toDoStore = db.createObjectStore(APP_CONFIG.STORES.TODO_TARGETS, { keyPath: 'targetId' });
                    toDoStore.createIndex('addedDate', 'addedDate', { unique: false });
                }

                if (!db.objectStoreNames.contains(APP_CONFIG.STORES.TARGETS)) {
                    db.createObjectStore(APP_CONFIG.STORES.TARGETS, { keyPath: 'object' });
                }

                // Version 6: Add Imaging Log stores
                if (oldVersion < 6) {
                    console.log('Upgrading database to version 6...');

                    // Create filters store
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.FILTERS)) {
                        db.createObjectStore(APP_CONFIG.STORES.FILTERS, { keyPath: 'name' });
                        console.log('Created filters store');
                    }

                    // Create imaging projects store
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.IMAGING_PROJECTS)) {
                        db.createObjectStore(APP_CONFIG.STORES.IMAGING_PROJECTS, { keyPath: 'id', autoIncrement: true });
                        console.log('Created imagingProjects store');
                    }

                    // Create imaging sessions store with indices
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.IMAGING_SESSIONS)) {
                        const sessionsStore = db.createObjectStore(APP_CONFIG.STORES.IMAGING_SESSIONS, { keyPath: 'id', autoIncrement: true });
                        sessionsStore.createIndex('projectId', 'projectId', { unique: false });
                        sessionsStore.createIndex('targetDesignation', 'targetDesignation', { unique: false });
                        sessionsStore.createIndex('date', 'date', { unique: false });
                        console.log('Created imagingSessions store with indices');
                    }

                    // Create imaging programs store
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.IMAGING_PROGRAMS)) {
                        db.createObjectStore(APP_CONFIG.STORES.IMAGING_PROGRAMS, { keyPath: 'id', autoIncrement: true });
                        console.log('Created imagingPrograms store');
                    }
                }

                // Version 7: Add DSS image cache store
                if (oldVersion < 7) {
                    console.log('Upgrading database to version 7...');
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.DSS_CACHE)) {
                        db.createObjectStore(APP_CONFIG.STORES.DSS_CACHE, { keyPath: 'id' });
                        console.log('Created dssCache store');
                    }
                }

                // Version 8: Add tutorial progress store
                if (oldVersion < 8) {
                    console.log('Upgrading database to version 8...');
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.TUTORIAL_PROGRESS)) {
                        db.createObjectStore(APP_CONFIG.STORES.TUTORIAL_PROGRESS, { keyPath: 'id' });
                        console.log('Created tutorialProgress store');
                    }
                }

                console.log('Database setup complete');
            };
        });
    },

    /**
     * Run one transaction over storeNames. Resolves with the value passed to done() only once
     * the transaction commits, and rejects with an error toast when it aborts:
     * a request's success alone doesn't mean the data was written, and quota
     * errors arrive as an abort at commit time (Issue #300).
     */
    _run(storeNames, mode, work) {
        return new Promise((resolve, reject) => {
            const fail = (error) => {
                console.error(`DBManagerWeb: ${mode} on ${storeNames} failed:`, error);
                if (typeof UIManager !== 'undefined' && UIManager.showToast) {
                    UIManager.showToast(`Database error: ${error.name}`, 'error');
                }
                reject(error);
            };
            let transaction;
            try {
                transaction = this.db.transaction(storeNames, mode);
                let result;
                transaction.oncomplete = () => resolve(result);
                transaction.onabort = () => fail(transaction.error ?? new Error('Transaction aborted'));
                work(transaction, value => { result = value; });
            } catch (error) {
                // A request that throws (e.g. a record without its key) doesn't
                // abort the transaction, so writes before it would still commit
                if (transaction) {
                    transaction.onabort = null;
                    transaction.abort();
                }
                fail(error);
            }
        });
    },

    /**
     * Generic get operation
     */
    async get(storeName, key) {
        return this._run([storeName], 'readonly', (tx, done) => {
            const request = tx.objectStore(storeName).get(key);
            request.onsuccess = () => done(request.result);
        });
    },

    /**
     * Generic getAll operation
     */
    async getAll(storeName) {
        return this._run([storeName], 'readonly', (tx, done) => {
            const request = tx.objectStore(storeName).getAll();
            request.onsuccess = () => done(request.result);
        });
    },

    /**
     * Generic put operation. Resolves with the record's key, which callers
     * use for autoIncrement ids.
     */
    async put(storeName, data) {
        return this._run([storeName], 'readwrite', (tx, done) => {
            const request = tx.objectStore(storeName).put(data);
            request.onsuccess = () => done(request.result);
        });
    },

    /**
     * Generic delete operation
     */
    async delete(storeName, key) {
        return this._run([storeName], 'readwrite', tx => tx.objectStore(storeName).delete(key));
    },

    /**
     * Clear all data from a store
     */
    async clear(storeName) {
        return this._run([storeName], 'readwrite', tx => tx.objectStore(storeName).clear());
    },

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    },

    /**
     * Delete the database entirely.
     * Used only as a last resort from the initialization error page.
     */
    deleteDatabase() {
        this.close();
        indexedDB.deleteDatabase(APP_CONFIG.DB_NAME);
    },

    /**
     * Bulk put operation for multiple items. Can greatly speed writes up
     * to the IndexedDB store for large numbers of items.
     */
    async putBulk(storeName, items) {
        return this._run([storeName], 'readwrite', tx => {
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
        });
    },

    /**
     * The key every record of a store must hold, or null when the store
     * assigns its own keys
     */
    requiredKey(storeName) {
        const store = this.db.transaction([storeName], 'readonly').objectStore(storeName);
        return store.autoIncrement ? null : store.keyPath;
    },

    /**
     * Apply writes to several stores in one transaction, so either all of
     * them land or none do (Issue #299). writes: [{ storeName, clear, records }],
     * applied in order; a store may appear more than once.
     */
    async writeStores(writes) {
        const storeNames = [...new Set(writes.map(w => w.storeName))];
        return this._run(storeNames, 'readwrite', tx => {
            writes.forEach(({ storeName, clear, records }) => {
                const store = tx.objectStore(storeName);
                if (clear) store.clear();
                records.forEach(record => store.put(record));
            });
        });
    },

};
