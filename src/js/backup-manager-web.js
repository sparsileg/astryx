/**
 * backup-manager-web.js
 * Manages backup and restore operations for Astryx database for web-based tool (not desktop)
 */

const BackupManagerWeb = {
    restoreFile: null, // Holds selected restore file

    // ============================================================================
    // BACKUP METHODS
    // ============================================================================

    /**
     * Count items in all data stores
     */
    async countDataStoreItems() {
        const counts = {
            settings: 1, // Always 1 settings object
            locations: 0,
            telescopes: 0,
            sensors: 0,
            filters: 0,
            pinnedTargets: 0,
            toDoTargets: 0,
            imagingProjects: 0,
            imagingSessions: 0,
            imagingPrograms: 0,
            targets: 0
        };

        try {
            // Get all data from stores
            const locations = await DBManager.getAll(APP_CONFIG.STORES.LOCATIONS);
            const telescopes = await DBManager.getAll(APP_CONFIG.STORES.TELESCOPES);
            const sensors = await DBManager.getAll(APP_CONFIG.STORES.SENSORS);
            const filters = await DBManager.getAll(APP_CONFIG.STORES.FILTERS);
            const pinnedTargets = await DBManager.getAll(APP_CONFIG.STORES.PINNED_TARGETS);
            const toDoTargets = await DBManager.getAll(APP_CONFIG.STORES.TODO_TARGETS);
            const imagingProjects = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROJECTS);
            const imagingSessions = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_SESSIONS);
            const imagingPrograms = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROGRAMS);
            const targets = await DBManager.getAll(APP_CONFIG.STORES.TARGETS);

            counts.locations = locations.length;
            counts.telescopes = telescopes.length;
            counts.sensors = sensors.length;
            counts.filters = filters.length;
            counts.pinnedTargets = pinnedTargets.length;
            counts.toDoTargets = toDoTargets.length;
            counts.imagingProjects = imagingProjects.length;
            counts.imagingSessions = imagingSessions.length;
            counts.imagingPrograms = imagingPrograms.length;
            counts.targets = targets.length;

        } catch (error) {
            console.error('Error counting data store items:', error);
        }

        return counts;
    },

    /**
     * Update backup modal with actual counts
     */
    updateBackupCounts(counts) {
        document.getElementById('backup-count-settings').textContent = `(${counts.settings})`;
        document.getElementById('backup-count-locations').textContent = `(${counts.locations})`;
        document.getElementById('backup-count-telescopes').textContent = `(${counts.telescopes})`;
        document.getElementById('backup-count-sensors').textContent = `(${counts.sensors})`;
        document.getElementById('backup-count-filters').textContent = `(${counts.filters})`;
        document.getElementById('backup-count-pinned').textContent = `(${counts.pinnedTargets})`;
        document.getElementById('backup-count-todo').textContent = `(${counts.toDoTargets})`;
        document.getElementById('backup-count-imaging').textContent = `(${counts.imagingProjects} / ${counts.imagingSessions})`;
        document.getElementById('backup-count-programs').textContent = `(${counts.imagingPrograms})`;
        document.getElementById('backup-count-targets').textContent = `(${counts.targets})`;
    },

    /**
     * Estimated backup size of the selected stores, from the record counts
     * and typical bytes per record. Backups leave out Best Months, so a
     * location's estimate holds none (Issue #354).
     */
    async calculateBackupSize(selectedStores) {
        const counts = await this.countDataStoreItems();
        const perRecord = APP_CONFIG.BACKUP_SIZE_BYTES_PER_RECORD;
        return selectedStores.reduce((total, store) => total + counts[store] * perRecord[store],
            APP_CONFIG.BACKUP_SIZE_OVERHEAD_BYTES);
    },

    /**
     * Format bytes to human-readable size
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Update size estimates based on currently selected checkboxes
     */
    async updateBackupSizeEstimates() {
        const selectedStores = this.getSelectedBackupStores();
        const uncompressedSize = await this.calculateBackupSize(selectedStores);
        const ratio = APP_CONFIG.BACKUP_COMPRESSION_RATIO[selectedStores.includes('targets') ? 'targets' : 'userData'];
        const compressedSize = Math.floor(uncompressedSize * ratio);

        document.getElementById('backup-size-uncompressed').textContent = this.formatBytes(uncompressedSize);
        document.getElementById('backup-size-compressed').textContent = '~' + this.formatBytes(compressedSize);
    },

    /**
     * Get list of currently selected backup stores
     */
    getSelectedBackupStores() {
        const selectedStores = [];
        if (document.getElementById('backup-settings')?.checked) selectedStores.push('settings');
        if (document.getElementById('backup-locations')?.checked) selectedStores.push('locations');
        if (document.getElementById('backup-telescopes')?.checked) selectedStores.push('telescopes');
        if (document.getElementById('backup-sensors')?.checked) selectedStores.push('sensors');
        if (document.getElementById('backup-filters')?.checked) selectedStores.push('filters');
        if (document.getElementById('backup-pinned')?.checked) selectedStores.push('pinnedTargets');
        if (document.getElementById('backup-todo')?.checked) selectedStores.push('toDoTargets');
        if (document.getElementById('backup-imaging')?.checked) {
            selectedStores.push('imagingProjects');
            selectedStores.push('imagingSessions');
        }
        if (document.getElementById('backup-programs')?.checked) selectedStores.push('imagingPrograms');
        if (document.getElementById('backup-targets')?.checked) selectedStores.push('targets');

        return selectedStores;
    },

    /**
     * Handle NEW Backup save action
     */
    scheduleAutoBackup() {
        // Clear any existing timer
        if (this._autoBackupTimer) {
            clearTimeout(this._autoBackupTimer);
        }

        // Schedule backup after the configured delay
        const delayMs = SettingsManager.getBackupDelayMinutes() * 60000;
        this._autoBackupTimer = setTimeout(() => {
            this.executeAutoBackup();
        }, delayMs);
    },

    /**
     * Called on app init — check if a backup was pending when app last closed
     */
    async initAutoBackup() {
        if (!SettingsManager.getAutoBackupEnabled()) return;

        const lastChange = SettingsManager.getLastChangeTimestamp();
        if (!lastChange) return;

        // Don't fire if a backup has already been made after the last change.
        // Both are epoch ms; a lastBackup saved before Issue #346 is a DTG.
        const lastBackup = SettingsManager.getSetting('lastBackupTimestamp');
        if (lastBackup && TimeUtils.dtgToMs(lastBackup) >= Number(lastChange)) return;

        const delayMs = SettingsManager.getBackupDelayMinutes() * 60000;
        const elapsed = Date.now() - Number(lastChange);
        const remaining = delayMs - elapsed;

        if (remaining <= 0) {
            // The wait ran out while Astryx was closed, so those changes
            // were never backed up: back them up now
            await this.executeAutoBackup(true);
        } else {
            // Resume the countdown from where it left off
            this._autoBackupTimer = setTimeout(() => {
                this.executeAutoBackup();
            }, remaining);
        }
    },

    /**
     * Start a browser download of blob. The URL is revoked later, not at
     * once: some browsers cancel a download whose URL is revoked before it
     * starts (Issue #312).
     */
    downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), APP_CONFIG.DOWNLOAD_URL_REVOKE_DELAY_MS);
    },

    async executeAutoBackup(fromLastSession = false) {
        if (!SettingsManager.getAutoBackupEnabled()) return;

        try {
            const dtg = TimeUtils.nowDTG();
            const filename = `${this.fileNameBase()}-userdata-${dtg}`;

            const selectedStores = [
                'settings', 'locations', 'telescopes', 'sensors', 'filters',
                'pinnedTargets', 'toDoTargets', 'imagingProjects', 'imagingSessions', 'imagingPrograms'
            ];

            const backupData = await this.generateBackupData(selectedStores);
            const jsonString = JSON.stringify(backupData, null, 2);

            const zip = new JSZip();
            zip.file(filename + '.json', jsonString);
            const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

            this.downloadBlob(zipBlob, filename + '.zip');

            await SettingsManager.saveSetting('lastBackupTimestamp', Date.now());
            BackupReminder.onBackupComplete();
            // A page can't tell whether the browser saved a download it
            // started, so the message doesn't claim it did (Issue #312)
            const what = fromLastSession ? 'Auto-backup of changes from your last session' : 'Auto-backup';
            UIManager.showToast(`${what} downloaded: check your Downloads folder`, 'success', APP_CONFIG.TOAST_LONG_DURATION_MS);
        } catch (error) {
            console.error('Auto-backup failed:', error);
            UIManager.showToast('Auto-backup failed: ' + error.message, 'error');
        }
    },

    async handleNewBackup(modalBody) {
        const selectedStores = this.getSelectedBackupStores();

        if (selectedStores.length === 0) {
            UIManager.showToast('Please select at least one data store to backup', 'warning');
            return;
        }

        try {
            // Generate backup data
            const backupData = await this.generateBackupData(selectedStores);

            // Get filename
            const filename = document.getElementById('backup-filename')?.value || 'Astryx-database';

            // Download the backup file
            await this.downloadBackup(backupData, filename);

        } catch (error) {
            console.error('Backup failed:', error);
            UIManager.showToast('Backup failed: ' + (error.message ?? error), 'error');
        }
    },

    /**
     * Generate backup data object from selected stores
     */
    async generateBackupData(selectedStores) {
        const targetVersionRecord = await DBManager.get(APP_CONFIG.STORES.SETTINGS, 'target-version');
        const backup = {
            version: APP_CONFIG.APP_VERSION,
            backupFormat: APP_CONFIG.BACKUP_FORMAT,
            // The schema version of the database that made it, and which
            // kind: web and desktop count separately (Issue #363)
            dbVersion: DBManager.databaseInfo().schemaVersion,
            platform: DBManager.databaseInfo().platform,
            targetVersion: targetVersionRecord ? targetVersionRecord.value : null,
            exportDate: new Date().toISOString()
        };

        // The app-settings record, never another record in that store such
        // as target-version; none saved yet, no settings (Issue #354)
        if (selectedStores.includes('settings')) {
            const settings = await DBManager.get(APP_CONFIG.STORES.SETTINGS, 'app-settings');
            if (settings) backup.settings = settings;
        }

        // Add locations if selected
        if (selectedStores.includes('locations')) {
            const locations = await DBManager.getAll(APP_CONFIG.STORES.LOCATIONS);
            backup.locations = locations;
        }

        // Add telescopes if selected
        if (selectedStores.includes('telescopes')) {
            const telescopes = await DBManager.getAll(APP_CONFIG.STORES.TELESCOPES);
            backup.telescopes = telescopes;
        }

        // Add sensors if selected
        if (selectedStores.includes('sensors')) {
            const sensors = await DBManager.getAll(APP_CONFIG.STORES.SENSORS);
            backup.sensors = sensors;
        }

        // Add filters if selected
        if (selectedStores.includes('filters')) {
            const filters = await DBManager.getAll(APP_CONFIG.STORES.FILTERS);
            backup.filters = filters;
        }

        // Add pinned targets if selected
        if (selectedStores.includes('pinnedTargets')) {
            const pinnedTargets = await DBManager.getAll(APP_CONFIG.STORES.PINNED_TARGETS);
            backup.pinnedTargets = pinnedTargets;
        }

        // Add todo targets if selected
        if (selectedStores.includes('toDoTargets')) {
            const toDoTargets = await DBManager.getAll(APP_CONFIG.STORES.TODO_TARGETS);
            backup.toDoTargets = toDoTargets;
        }

        // Add imaging projects if selected
        if (selectedStores.includes('imagingProjects')) {
            const imagingProjects = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROJECTS);
            backup.imagingProjects = imagingProjects;
        }

        // Add imaging sessions if selected
        if (selectedStores.includes('imagingSessions')) {
            const imagingSessions = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_SESSIONS);
            backup.imagingSessions = imagingSessions;
        }

        // Add imaging programs if selected
        if (selectedStores.includes('imagingPrograms')) {
            const imagingPrograms = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROGRAMS);
            backup.imagingPrograms = imagingPrograms;
        }

        // Add target database if selected — strip regenerable Best Months data
        if (selectedStores.includes('targets')) {
            const targets = await DBManager.getAll(APP_CONFIG.STORES.TARGETS);
            backup.targetDatabase = targets.map(({ bestMonth, peakAltitude, visibilityStart, visibilityEnd, ...rest }) => rest);
        }

        return backup;
    },

    /**
     * Download backup data as JSON file (no ZIP for now)
     */
    async downloadBackup(backupData, filename) {
        // Convert to JSON
        const jsonString = JSON.stringify(backupData, null, 2);

        // Create ZIP file
        const zip = new JSZip();
        zip.file(filename + '.json', jsonString);

        // Generate ZIP blob
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

        // Calculate actual file size
        const fileSizeBytes = zipBlob.size;
        const fileSize = this.formatBytes(fileSizeBytes);

        this.downloadBlob(zipBlob, filename + '.zip');

        // Epoch ms, which a change of time zone can't shift (Issue #346)
        await SettingsManager.saveSetting('lastBackupTimestamp', Date.now());
        BackupReminder.onBackupComplete();

        // Show success modal
        const selectedStores = this.getSelectedBackupStores();
        this.showBackupSuccessModal(filename + '.zip', fileSize, selectedStores, backupData);
    },

    /**
     * Show backup success modal
     */
    showBackupSuccessModal(filename, fileSize, stores, backupData) {
        UIManager.openModal('backup-success-template', 'Data Saved', null);

        setTimeout(() => {
            // Update filename
            const filenameEl = document.getElementById('backup-success-filename');
            if (filenameEl) {
                filenameEl.textContent = filename;
            }

            // Update file size
            const sizeEl = document.getElementById('backup-success-size');
            if (sizeEl) {
                sizeEl.textContent = fileSize;
            }

            // Update items list with actual counts
            const itemsContainer = document.getElementById('backup-success-items');
            if (itemsContainer) {
                const storeNames = {
                    'settings': 'Settings',
                    'locations': 'Locations',
                    'telescopes': 'Telescopes',
                    'sensors': 'Sensors',
                    'filters': 'Filters',
                    'pinnedTargets': 'Pinned Targets',
                    'toDoTargets': 'To Do List',
                    'imagingProjects': 'Imaging Projects',
                    'imagingSessions': 'Imaging Sessions',
                    'imagingPrograms': 'Imaging Programs',
                    'targets': 'Target Database'
                };

                let html = '';
                let totalRecords = 0;

                stores.forEach(store => {
                    const name = storeNames[store] || store;
                    let count = 0;

                    // Get actual count from backup data
                    if (store === 'settings') {
                        count = 1;
                    } else if (store === 'targets') {
                        count = backupData.targetDatabase ? backupData.targetDatabase.length : 0;
                    } else {
                        const data = backupData[store];
                        count = data ? data.length : 0;
                    }

                    totalRecords += count;
                    html += `<div class="backup-success-stat-item">• ${name}: ${count} items</div>`;
                });

                itemsContainer.innerHTML = html;

                // Update total
                const totalEl = document.getElementById('backup-success-total');
                if (totalEl) {
                    totalEl.textContent = `Total: ${totalRecords} records`;
                }
            }
        }, 0);
    },

    // ============================================================================
    // RESTORE METHODS
    // ============================================================================

    /**
     * Handle restore file selected - parse and show confirmation
     */
    async handleRestoreFileSelected(modalBody) {
        if (!this.restoreFile) {
            UIManager.showToast('No file selected', 'error');
            return;
        }

        try {
            // Read and parse the backup file
            const backupData = await this.readRestoreFile(this.restoreFile);

            const problem = this.backupFileProblem(backupData, true);
            if (problem) throw new Error(problem);

            if (this.isFromNewerAstryx(backupData)) {
                this.showNewerBackupModal(backupData);
                return;
            }

            // Show confirmation modal
            this.showRestoreConfirmModal(backupData);

        } catch (error) {
            console.error('Failed to read backup file:', error);
            UIManager.showToast('Failed to read backup file: ' + error.message, 'error', APP_CONFIG.TOAST_LONG_DURATION_MS);
        }
    },

    /**
     * Read and parse restore file (ZIP or JSON)
     */
    async readRestoreFile(file) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.zip')) {
            // Handle ZIP file
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);

            const jsonFileName = this.backupEntryName(Object.values(zipContent.files)
                .filter(entry => !entry.dir).map(entry => entry.name));
            if (!jsonFileName) throw new Error('this zip holds no backup (.json) file.');
            const jsonContent = await zipContent.files[jsonFileName].async('string');
            return JSON.parse(jsonContent);

        } else if (fileName.endsWith('.json')) {
            // Handle plain JSON file
            const text = await file.text();
            return JSON.parse(text);

        } else {
            throw new Error('Unsupported file format. Please select a .zip or .json backup file.');
        }
    },

    /**
     * The backup in a zip: its first .json file, skipping what macOS adds
     * when it zips a folder (__MACOSX/, ._ copies), so a backup zipped
     * again by hand still restores (Issue #354). Desktop: read_zip in
     * commands/backup.rs does the same.
     */
    backupEntryName(names) {
        return names.find(name => {
            const base = name.split('/').pop();
            return base.toLowerCase().endsWith('.json') && !base.startsWith('._') && !name.startsWith('__MACOSX/');
        });
    },

    /**
     * Start of a backup's file name: app, version, and the database schema
     * version after its letter, d (web) or s (desktop) (Issue #363)
     */
    fileNameBase() {
        const { letter, schemaVersion } = DBManager.databaseInfo();
        return `${APP_CONFIG.APP_NAME}-v${APP_CONFIG.APP_VERSION}-${letter}${schemaVersion}`;
    },

    // A backup's platform field: the database that made it (Issue #363)
    BACKUP_PLATFORMS: ['web', 'desktop'],

    /**
     * A database schema version with its platform, "8 (web)", or the plain
     * version for a backup that doesn't say (Issue #363)
     */
    describeSchemaVersion(schemaVersion, platform) {
        return platform ? `${schemaVersion} (${platform})` : String(schemaVersion);
    },

    /**
     * Backup format of a file: older files have no backupFormat and are
     * format 1 (Issue #352)
     */
    backupFormatOf(backupData) {
        return backupData.backupFormat ?? 1;
    },

    /**
     * Whether a backup was made in a format this version can't read. Same
     * and older formats restore; their data goes through the load-time
     * migrations after the reload (Issue #352).
     */
    isFromNewerAstryx(backupData) {
        return this.backupFormatOf(backupData) > APP_CONFIG.BACKUP_FORMAT;
    },

    /**
     * Why a backup file can't be restored, or null when it can. Checked
     * before the restore dialog shows any of it (Issue #362).
     * - The version fields are short strings or numbers.
     * - Each store the file holds has the shape restore expects.
     * - checkKeys (web): each record's key has the type its store uses. A
     *   store with its own keys takes whole numbers; the others take
     *   strings (names, designations, ids). IndexedDB keeps a restored
     *   record's key as it is in the file. On desktop the Rust restore
     *   command checks them, and rolls the restore back on a bad one.
     */
    backupFileProblem(backupData, checkKeys) {
        if (backupData === null || typeof backupData !== 'object' || Array.isArray(backupData)) {
            return 'this file is not an Astryx backup.';
        }
        const format = this.backupFormatOf(backupData);
        if (!Number.isInteger(format) || format < 1) {
            return 'its backup format is not a version number.';
        }
        for (const field of ['version', 'dbVersion', 'targetVersion']) {
            const value = backupData[field];
            if (value === undefined || value === null) continue;
            const ok = (typeof value === 'number' && Number.isFinite(value))
                || (typeof value === 'string' && value.length <= APP_CONFIG.BACKUP_VERSION_FIELD_MAX_LENGTH);
            if (!ok) return `its ${field} is not a version number.`;
        }
        if (backupData.platform !== undefined && !this.BACKUP_PLATFORMS.includes(backupData.platform)) {
            return 'its platform is not web or desktop.';
        }
        for (const store of this.RESTORE_STORES) {
            if (!this.storeInBackup(store, backupData)) continue;
            const data = backupData[store.backupKey];
            const records = store.isArray ? data : [data];
            if (!Array.isArray(records)) return `its ${store.name} are not a list of records.`;
            const bad = records.findIndex(record => record === null || typeof record !== 'object' || Array.isArray(record));
            if (bad !== -1) return `${store.name} record ${bad + 1} is not a record.`;
            if (!checkKeys) continue;
            const { keyPath, autoIncrement } = DBManager.storeKey(APP_CONFIG.STORES[store.storesKey]);
            const badKey = records.findIndex(record => {
                const key = record[keyPath];
                return autoIncrement
                    ? key !== undefined && !(Number.isSafeInteger(key) && key > 0)
                    : typeof key !== 'string' || key === '';
            });
            if (badKey !== -1) {
                return `${store.name} record ${badKey + 1}: its ${keyPath} is not ${autoIncrement ? 'a whole number' : 'text'}.`;
            }
        }
        return null;
    },

    /**
     * Tell the user a backup comes from a newer Astryx
     */
    showNewerBackupModal(backupData) {
        UIManager.openModal('newer-backup-template', 'Backup From a Newer Astryx', null);

        setTimeout(() => {
            const messageDiv = document.getElementById('newer-backup-message');
            if (messageDiv) {
                const madeBy = backupData.version ? ` ${HtmlUtils.escapeHtml(backupData.version)}` : '';
                messageDiv.innerHTML = `
                    <p>This backup was made by Astryx${madeBy}, in backup format
                    <strong>${HtmlUtils.escapeHtml(BackupManagerWeb.backupFormatOf(backupData))}</strong>. This version of Astryx
                    (${HtmlUtils.escapeHtml(APP_CONFIG.APP_VERSION)}) reads backup formats up to
                    <strong>${APP_CONFIG.BACKUP_FORMAT}</strong>.</p>
                `;
            }
        }, 0);
    },

    // ============================================================================
    // RESTORE COMPARISON (issue #249)
    // ============================================================================

    // Stores a backup can hold: key as used by generateBackupData and the
    // restore checkboxes, backupKey as written in the backup file, storesKey
    // naming the database store in APP_CONFIG.STORES (looked up when used:
    // config.js loads after this file)
    RESTORE_STORES: [
        { key: 'settings', backupKey: 'settings', storesKey: 'SETTINGS', name: 'Settings', isArray: false },
        { key: 'locations', backupKey: 'locations', storesKey: 'LOCATIONS', name: 'Locations', isArray: true },
        { key: 'telescopes', backupKey: 'telescopes', storesKey: 'TELESCOPES', name: 'Telescopes', isArray: true },
        { key: 'sensors', backupKey: 'sensors', storesKey: 'SENSORS', name: 'Sensors', isArray: true },
        { key: 'filters', backupKey: 'filters', storesKey: 'FILTERS', name: 'Filters', isArray: true },
        { key: 'pinnedTargets', backupKey: 'pinnedTargets', storesKey: 'PINNED_TARGETS', name: 'Pinned Targets', isArray: true },
        { key: 'toDoTargets', backupKey: 'toDoTargets', storesKey: 'TODO_TARGETS', name: 'To Do List', isArray: true },
        { key: 'imagingProjects', backupKey: 'imagingProjects', storesKey: 'IMAGING_PROJECTS', name: 'Imaging Projects', isArray: true },
        { key: 'imagingSessions', backupKey: 'imagingSessions', storesKey: 'IMAGING_SESSIONS', name: 'Imaging Sessions', isArray: true },
        { key: 'imagingPrograms', backupKey: 'imagingPrograms', storesKey: 'IMAGING_PROGRAMS', name: 'Imaging Programs', isArray: true },
        { key: 'targets', backupKey: 'targetDatabase', storesKey: 'TARGETS', name: 'Target Database', isArray: true }
    ],

    /**
     * Whether a backup holds this store. A settings record without its id
     * (a backup made with no settings saved) can't be restored, so it isn't
     * offered, and restoring never clears the settings for it (Issue #299).
     */
    storeInBackup(store, backupData) {
        const data = backupData[store.backupKey];
        if (store.key === 'settings') return data?.id !== undefined;
        return data !== undefined;
    },

    /**
     * Compare each store in a backup with the current data, and decide whether
     * the backup as a whole is identical to, newer or older than current data.
     * Both backends call this on BackupManagerWeb; it reads through DBManager.
     * @returns {{identical: Object<string, boolean>, verdict: string, backupChange: number, currentChange: number}}
     */
    async compareBackupToCurrent(backupData) {
        const stores = this.RESTORE_STORES.filter(s => this.storeInBackup(s, backupData));
        const current = await this.generateBackupData(stores.map(s => s.key));

        const identical = {};
        stores.forEach(store => {
            identical[store.key] = this.canonicalStore(store, backupData) === this.canonicalStore(store, current);
        });

        // When the backup and current data differ, the newer one is the one
        // whose data changed last. A backup without settings has only its export date.
        const backupChange = Number(backupData.settings?.data?.lastChangeTimestamp ?? Date.parse(backupData.exportDate));
        const currentChange = Number(SettingsManager.getLastChangeTimestamp() ?? 0);
        let verdict = 'identical';
        if (Object.values(identical).includes(false)) {
            verdict = backupChange > currentChange ? 'newer' : 'older';
        }
        return { identical, verdict, backupChange, currentChange };
    },

    /**
     * One store's data as text that is equal exactly when the data is: record
     * order, key order, and null, empty or missing fields don't matter, so
     * web and desktop data compare equal (Issues #249, #353).
     */
    canonicalStore(store, data) {
        if (store.key === 'settings') {
            const kept = Object.entries(data.settings?.data ?? {})
                .filter(([key]) => !APP_CONFIG.BACKUP_COMPARE_IGNORED_SETTINGS.includes(key));
            return this.canonicalJson(Object.fromEntries(kept));
        }
        const records = data[store.backupKey].map(record => this.canonicalJson(record)).sort().join('\n');
        // The target catalog version is part of the target database's state
        return store.key === 'targets' ? `${data.targetVersion ?? ''}\n${records}` : records;
    },

    /**
     * JSON with object keys sorted and null, undefined and '' values
     * dropped. SQLite stores an empty number field as NULL, IndexedDB as
     * it was saved (Issue #353).
     */
    canonicalJson(value) {
        if (Array.isArray(value)) {
            return `[${value.map(v => this.canonicalJson(v)).join(',')}]`;
        }
        if (value !== null && typeof value === 'object') {
            const entries = Object.keys(value).sort()
                .filter(key => value[key] !== null && value[key] !== undefined && value[key] !== '')
                .map(key => `${JSON.stringify(key)}:${this.canonicalJson(value[key])}`);
            return `{${entries.join(',')}}`;
        }
        return JSON.stringify(value);
    },

    /**
     * Show restore confirmation modal
     */
    showRestoreConfirmModal(backupData) {
        UIManager.openModal('restore-confirm-template', 'Restore Backup?', (action, modalBody) => {
            if (action === 'restore') {
                this.handleRestoreExecute(modalBody, backupData);
            }
        });

        setTimeout(async () => {
            // Restoring must still work if the comparison can't be made
            let comparison = null;
            try {
                comparison = await BackupManagerWeb.compareBackupToCurrent(backupData);
            } catch (error) {
                console.error('Failed to compare backup with current data:', error);
            }

            // Populate file metadata
            this.populateRestoreFileInfo(backupData, comparison);

            // Populate data stores list with checkboxes
            await this.populateRestoreStoresList(backupData, comparison);

            // Setup Select All/None buttons
            const selectAllBtn = document.getElementById('restore-select-all');
            const selectNoneBtn = document.getElementById('restore-select-none');

            if (selectAllBtn) {
                selectAllBtn.addEventListener('click', () => this.restoreSelectAll(true));
            }
            if (selectNoneBtn) {
                selectNoneBtn.addEventListener('click', () => this.restoreSelectAll(false));
            }

            // Setup confirmation checkbox to enable/disable Restore button
            const confirmCheckbox = document.getElementById('restore-confirm-checkbox');
            const restoreBtn = document.getElementById('modal-save-btn');

            if (confirmCheckbox && restoreBtn) {
                confirmCheckbox.addEventListener('change', () => {
                    restoreBtn.disabled = !confirmCheckbox.checked;
                });
            }
        }, 0);
    },

    /**
     * Populate restore file metadata display
     */
    populateRestoreFileInfo(backupData, comparison) {
        const fileInfoDiv = document.getElementById('restore-file-info');
        if (!fileInfoDiv) return;

        const exportDate = new Date(backupData.exportDate);
        const now = new Date();
        const ageInDays = Math.floor((now - exportDate) / (1000 * 60 * 60 * 24));

        // Determine warning level based on age
        const [noticeDays, warningDays, criticalDays] = APP_CONFIG.BACKUP_RESTORE_AGE_WARNING_DAYS;
        let warningClass = '';
        let warningIcon = '';
        if (ageInDays > criticalDays) {
            warningClass = 'age-180';
            warningIcon = '🔴';
        } else if (ageInDays > warningDays) {
            warningClass = 'age-90';
            warningIcon = '🟠';
        } else if (ageInDays > noticeDays) {
            warningClass = 'age-30';
            warningIcon = '🟡';
        }

        let html = `
            <div class="restore-file-card">
                <div class="restore-file-details">
                    <span class="restore-file-label">File:</span>
                    <span class="restore-file-name">${HtmlUtils.escapeHtml(this.restoreFile.name)}</span>

                    <span class="restore-file-label">Created:</span>
                    <span>${exportDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${exportDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>

                    <span class="restore-file-label">Version:</span>
                    <span>${HtmlUtils.escapeHtml(backupData.version ?? 'Unknown')}</span>

                    <span class="restore-file-label">Database:</span>
                    <span>${HtmlUtils.escapeHtml(backupData.dbVersion === undefined || backupData.dbVersion === null
                        ? 'Unknown'
                        : BackupManagerWeb.describeSchemaVersion(backupData.dbVersion, backupData.platform))}</span>

                    <span class="restore-file-label">Target:</span>
                    <span>${HtmlUtils.escapeHtml(backupData.targetVersion ?? '—')}</span>

                    <span class="restore-file-label">Size:</span>
                    <span>${this.formatBytes(this.restoreFile.size)}</span>
                </div>
        `;

        // How the backup relates to current data (issue #249)
        if (!comparison) {
            html += `
                <div class="backup-restore-warning backup-restore-verdict">
                    <div class="backup-restore-warning-title">Couldn't compare this backup with current data</div>
                </div>
            `;
        } else if (comparison.verdict === 'identical') {
            html += `
                <div class="backup-restore-warning backup-restore-verdict identical">
                    <div class="backup-restore-warning-title">Identical to current data — restore not needed</div>
                </div>
            `;
        } else {
            // Both change times, so the verdict can be checked at a glance
            const formatChange = ms => {
                if (!ms) return 'unknown';
                const date = new Date(ms);
                return `${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
            };
            const backupChanged = formatChange(comparison.backupChange);
            const changes = `
                Backup data last changed: ${backupChanged}<br>
                Current data last changed: ${formatChange(comparison.currentChange)}
            `;

            if (comparison.verdict === 'older') {
                const age = ageInDays > noticeDays ? ` This backup is ${ageInDays} days old.` : '';
                html += `
                    <div class="backup-restore-warning backup-restore-verdict older ${warningClass}">
                        <div class="backup-restore-warning-title">
                            ${warningIcon} Backup data is older than current data
                        </div>
                        <div class="backup-restore-warning-content">
                            ${changes}<br>
                            Restoring will overwrite changes made since ${backupChanged}.${age}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="backup-restore-warning backup-restore-verdict newer">
                        <div class="backup-restore-warning-title">Backup data is newer than current data — restore recommended</div>
                        <div class="backup-restore-warning-content">${changes}</div>
                    </div>
                `;
            }
        }

        html += `</div>`;
        fileInfoDiv.innerHTML = html;
    },

    /**
     * Populate data stores list with checkboxes and counts
     */
    async populateRestoreStoresList(backupData, comparison) {
        const storesListDiv = document.getElementById('restore-stores-list');
        if (!storesListDiv) return;

        // Get current counts
        const currentCounts = await this.countDataStoreItems();

        let html = '<div class="backup-restore-checkboxes">';

        BackupManagerWeb.RESTORE_STORES.forEach(store => {
            // Check if this store exists in the backup
            if (BackupManagerWeb.storeInBackup(store, backupData)) {
                const backupCount = store.isArray ? backupData[store.backupKey].length : 1;
                const currentCount = store.key === 'settings' ? 1 : currentCounts[store.key];
                let rowClass = 'backup-restore-checkbox-item';
                let status = '';
                if (comparison) {
                    const identical = comparison.identical[store.key];
                    if (!identical) rowClass += ' differs';
                    status = `<span class="backup-restore-store-status">${identical ? 'identical' : 'differs'}</span>`;
                }

                // Sessions are restored with projects: shown, not tickable
                const linked = store.key === 'imagingSessions';
                if (linked) rowClass += ' linked';
                html += `
                    <div class="${rowClass}">
                        <input type="checkbox" id="restore-${store.key}" checked${linked ? ' disabled' : ''} data-store="${store.key}">
                        <label for="restore-${store.key}" class="backup-restore-checkbox-label">${store.name}</label>
                        <span class="backup-restore-count-compare">
                            ${currentCount}
                            <span class="backup-restore-count-arrow">→</span>
                            ${backupCount}
                        </span>
                        ${status}
                    </div>
                `;
            }
        });

        html += '</div>';
        storesListDiv.innerHTML = html;

        // Link imagingProjects and imagingSessions checkboxes
        const projectsCheckbox = document.getElementById('restore-imagingProjects');
        const sessionsCheckbox = document.getElementById('restore-imagingSessions');

        if (projectsCheckbox && sessionsCheckbox) {
            projectsCheckbox.addEventListener('change', (e) => {
                sessionsCheckbox.checked = e.target.checked;
            });
        }
    },

    /**
     * Select/deselect all restore checkboxes
     */
    restoreSelectAll(checked) {
        const checkboxes = document.querySelectorAll('#restore-stores-list input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = checked;
        });
    },

    /**
     * Execute restore operation
     */
    async handleRestoreExecute(modalBody, backupData) {
        // Get selected stores from checkboxes
        const selectedStores = this.getSelectedRestoreStores();

        if (selectedStores.length === 0) {
            UIManager.showToast('Please select at least one data store to restore', 'warning');
            return;
        }

        // Until the reload, the app still holds the old data in memory, and
        // anything that saved it would write it over the restore: stop the
        // auto-backup timer and a Best Months run first (Issue #354)
        clearTimeout(BackupManager._autoBackupTimer);
        BestMonths.cancelCalculation();

        try {
            UIManager.showToast('Restoring data...', 'info');

            await this.restoreStores(selectedStores, backupData);

            // Restored settings bring back the backup's own change time. Without
            // them the restore is a change made now, so it gets backed up.
            // (Not with settings: marking saves the in-memory settings over them.)
            if (!selectedStores.includes('settings')) {
                await UIManager.markDataChanged();
                clearTimeout(BackupManager._autoBackupTimer);
            }
        } catch (error) {
            console.error('Restore failed:', error);
            // Every restore runs in one transaction, so a failure changes nothing (Issue #299)
            UIManager.showToast('Restore failed, nothing was changed: ' + (error.message ?? error), 'error', APP_CONFIG.TOAST_LONG_DURATION_MS);
            await BackupManager.initAutoBackup();
            return;
        }

        // Reload at once; the success message shows after it (App.init)
        const activeTutorial = TutorialEngine._currentTutorial?.id;
        if (activeTutorial) {
            localStorage.setItem('resumeTutorialAfterReload', activeTutorial);
        }
        localStorage.setItem(this.RESTORED_MESSAGE_KEY, `Successfully restored ${selectedStores.length} data stores`);
        location.reload();
    },

    // The success message a restore leaves for the page after its reload
    RESTORED_MESSAGE_KEY: 'restoredMessageAfterReload',

    /**
     * Get list of currently selected restore stores
     */
    getSelectedRestoreStores() {
        const selectedStores = [];
        const checkboxes = document.querySelectorAll('#restore-stores-list input[type="checkbox"]:checked');

        checkboxes.forEach(cb => {
            const store = cb.dataset.store;
            if (store) {
                selectedStores.push(store);
            }
        });

        return selectedStores;
    },

    /**
     * Replace the ticked stores with the backup's data in one transaction, so
     * a restore that fails leaves every store as it was (Issue #299)
     */
    async restoreStores(selectedStores, backupData) {
        const settingsStore = APP_CONFIG.STORES.SETTINGS;
        const writes = [];
        for (const key of selectedStores) {
            const store = this.RESTORE_STORES.find(s => s.key === key);
            const data = backupData[store.backupKey];
            if (!data) {
                console.warn(`No data found for store: ${key}`);
                continue;
            }
            if (key === 'settings') {
                // The SETTINGS store also holds the separate target-version record.
                // Clearing it for a settings-only restore must not lose that value.
                const targetVersionRecord = await DBManager.get(settingsStore, 'target-version');
                const records = [{ ...data, data: this.restoredSettingsData(data) }];
                if (targetVersionRecord) records.push(targetVersionRecord);
                writes.push({ storeName: settingsStore, clear: true, records });
            } else {
                // Each record's key was checked before the restore dialog (backupFileProblem)
                writes.push({ storeName: APP_CONFIG.STORES[store.storesKey], clear: true, records: data });
            }
            // Restored targets bring back their own target version
            if (key === 'targets' && backupData.targetVersion) {
                writes.push({
                    storeName: settingsStore,
                    clear: false,
                    records: [{ id: 'target-version', value: backupData.targetVersion }]
                });
            }
        }
        await DBManager.writeStores(writes);
    },

    /**
     * A backup's settings data as restored: settings that belong to this
     * machine are kept, even when unset here, so e.g. a Windows backup folder
     * never reaches a Linux machine
     */
    restoredSettingsData(settingsRecord) {
        const kept = {};
        APP_CONFIG.BACKUP_RESTORE_KEPT_SETTINGS.forEach(setting => {
            kept[setting] = SettingsManager.getSetting(setting);
        });
        return { ...settingsRecord.data, ...kept };
    },

};
