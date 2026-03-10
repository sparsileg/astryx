/**
 * db-manager.js
 * IndexedDB database operations
 */

const DBManager = {
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

            request.onsuccess = () => {
                this.db = request.result;
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

                // Version 8: Add tutorial progress store
                if (oldVersion < 8) {
                    console.log('Upgrading database to version 8...');
                    if (!db.objectStoreNames.contains(APP_CONFIG.STORES.TUTORIAL_PROGRESS)) {
                        db.createObjectStore(APP_CONFIG.STORES.TUTORIAL_PROGRESS, { keyPath: 'id' });
                        console.log('Created tutorialProgress store');
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

                console.log('Database setup complete');
            };
        });
    },

    /**
     * Generic get operation
     */
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Generic getAll operation
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Generic put operation
     */
    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Generic delete operation
     */
    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Clear all data from a store
     */
    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Bulk put operation for multiple items. Can greatly speed writes up
     * to the IndexedDB store for large numbers of items.
     */
    async putBulk(storeName, items) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            let completed = 0;
            const total = items.length;

            if (total === 0) {
                resolve();
                return;
            }

            items.forEach(item => {
                const request = store.put(item);

                request.onsuccess = () => {
                    completed++;
                    if (completed === total) {
                        resolve();
                    }
                };

                request.onerror = () => reject(request.error);
            });
        });
    },

};
