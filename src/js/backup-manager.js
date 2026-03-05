/**
 * backup-manager.js
 * Manages backup and restore operations for Astryx database
 */

const BackupManager = {
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
     * Calculate estimated backup size based on selected stores
     */
    async calculateBackupSize(selectedStores) {
        let totalSize = 0;

        // Get actual counts
        const counts = await this.countDataStoreItems();

        // Check if Best Months calculations have been run (stored in targets, not locations)
        let locationsWithBestMonths = 0;
        if (selectedStores.includes('targets')) {
            // Check a sample target to see if it has Best Months data
            const targets = await DBManager.getAll(APP_CONFIG.STORES.TARGETS);
            if (targets.length > 0) {
                const sampleTarget = targets[0];
                if (sampleTarget.bestMonth && typeof sampleTarget.bestMonth === 'object') {
                    // Count how many locations have calculations (keys in bestMonth object)
                    locationsWithBestMonths = Object.keys(sampleTarget.bestMonth).length;
                }
            }
        }

        // Refined estimates based on real data
        const estimates = {
            settings: 500,            // ~500 bytes (negligible)
            locationsBase: 1000,      // ~1 KB per location without Best Months
            bestMonthsPerTarget: 214, // ~214 bytes per target in Best Months data
            telescopes: 500,          // ~500 bytes per telescope
            sensors: 500,             // ~500 bytes per sensor
            filters: 150,             // ~150 bytes per filter
            pinnedTargets: 100,       // Conservative estimate
            toDoTargets: 100,         // Conservative estimate
            imagingProjects: 2000,    // ~2 KB per project
            imagingSessions: 1200,    // ~1.2 KB per session
            imagingPrograms: 300,     // ~300 bytes per program
            targets: 292              // 4265KB / 14593 = 292 bytes per target
        };

        selectedStores.forEach(store => {
            if (store === 'locations') {
                // Base location size
                totalSize += counts.locations * estimates.locationsBase;
                // Add Best Months data (214 bytes per target per location with calculations)
                if (locationsWithBestMonths > 0) {
                    totalSize += locationsWithBestMonths * counts.targets * estimates.bestMonthsPerTarget;
                }
            } else if (store === 'imagingProjects') {
                totalSize += counts.imagingProjects * estimates.imagingProjects;
            } else if (store === 'imagingSessions') {
                totalSize += counts.imagingSessions * estimates.imagingSessions;
            } else if (store === 'settings') {
                totalSize += estimates.settings;
            } else {
                const count = counts[store] || 0;
                const estimate = estimates[store] || 100;
                totalSize += count * estimate;
            }
        });

        // Add overhead for JSON structure (version, exportDate, etc.)
        totalSize += 2000; // ~2KB overhead

        return totalSize;
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

        // Compression ratio based on real data: ~9% with targets, ~26% without
        const hasTargets = selectedStores.includes('targets');
        const compressionRatio = hasTargets ? 0.09 : 0.26;
        const compressedSize = Math.floor(uncompressedSize * compressionRatio);

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
     * Select/deselect all backup checkboxes
     */
    backupSelectAll(checked) {
        const checkboxes = document.querySelectorAll('#modal-body input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = checked;
        });
    },

    /**
     * Handle NEW Backup save action
     */
    scheduleAutoBackup() {
        // Clear any existing timer
        if (this._autoBackupTimer) {
            clearTimeout(this._autoBackupTimer);
        }
        // Schedule backup after 60 seconds
        this._autoBackupTimer = setTimeout(() => {
            this.executeAutoBackup();
        }, 60000);
    },

    async executeAutoBackup() {
        if (!SettingsManager.getAutoBackupEnabled()) return;

        try {
            const dtg = SettingsManager.getLastChangeTimestamp() || TimeUtils.nowDTG();
            const filename = `${APP_CONFIG.APP_NAME}-v${APP_CONFIG.APP_VERSION}-d${APP_CONFIG.DB_VERSION}-${dtg}`;

            // removed 'pinnedTargets'
            const selectedStores = [
                'settings', 'locations', 'telescopes', 'sensors', 'filters',
                'toDoTargets', 'imagingProjects', 'imagingSessions', 'imagingPrograms'
            ];

            const backupData = await this.generateBackupData(selectedStores);
            const jsonString = JSON.stringify(backupData, null, 2);

            const zip = new JSZip();
            zip.file(filename + '.json', jsonString);
            const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            UIManager.showToast('Auto-backup saved', 'success');
        } catch (error) {
            console.error('Auto-backup failed:', error);
            UIManager.showToast('Auto-backup failed: ' + error.message, 'error');
        }
    },

    async handleNewBackup(modalBody) {
        const selectedStores = this.getSelectedBackupStores();

        if (selectedStores.length === 0) {
            this.showToast('Please select at least one data store to backup', 'warning');
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
            this.showToast('Backup failed: ' + error.message, 'error');
        }
    },

    /**
     * Generate backup data object from selected stores
     */
    async generateBackupData(selectedStores) {
        const backup = {
            version: APP_CONFIG.APP_VERSION,
            dbVersion: APP_CONFIG.DB_VERSION,
            exportDate: new Date().toISOString()
        };

        // Add settings if selected
        if (selectedStores.includes('settings')) {
            const settings = await DBManager.getAll(APP_CONFIG.STORES.SETTINGS);
            backup.settings = settings.length > 0 ? settings[0] : {};
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

        // Add target database if selected
        if (selectedStores.includes('targets')) {
            const targets = await DBManager.getAll(APP_CONFIG.STORES.TARGETS);
            backup.targetDatabase = targets;
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

        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

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
            this.showToast('No file selected', 'error');
            return;
        }

        try {
            // Read and parse the backup file
            const backupData = await this.readRestoreFile(this.restoreFile);

            // Check version compatibility
            if (backupData.dbVersion !== APP_CONFIG.DB_VERSION) {
                this.showVersionMismatchModal(backupData.dbVersion, APP_CONFIG.DB_VERSION);
                return;
            }

            // Show confirmation modal
            this.showRestoreConfirmModal(backupData);

        } catch (error) {
            console.error('Failed to read backup file:', error);
            this.showToast('Failed to read backup file: ' + error.message, 'error');
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

            // Find the JSON file inside the ZIP
            const jsonFileName = Object.keys(zipContent.files)[0];
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
     * Show version mismatch modal
     */
    showVersionMismatchModal(backupVersion, currentVersion) {
        UIManager.openModal('version-mismatch-template', 'Version Mismatch', null);

        setTimeout(() => {
            const messageDiv = document.getElementById('version-mismatch-message');
            if (messageDiv) {
                messageDiv.innerHTML = `
                    <p>This backup file (database version <strong>${backupVersion}</strong>) is incompatible
                    with your current Astryx version (database version <strong>${currentVersion}</strong>).</p>
                `;
            }
        }, 0);
    },

    /**
     * Show restore confirmation modal (placeholder for now)
     */
    showRestoreConfirmModal(backupData) {
        UIManager.openModal('restore-confirm-template', 'Restore Backup?', (action, modalBody) => {
            if (action === 'restore') {
                this.handleRestoreExecute(modalBody, backupData);
            }
        });

        setTimeout(async () => {
            // Populate file metadata
            this.populateRestoreFileInfo(backupData);

            // Populate data stores list with checkboxes
            await this.populateRestoreStoresList(backupData);

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
                    restoreBtn.style.opacity = confirmCheckbox.checked ? '1' : '0.5';
                });
            }
        }, 0);
    },

    /**
     * Populate restore file metadata display
     */
    populateRestoreFileInfo(backupData) {
        const fileInfoDiv = document.getElementById('restore-file-info');
        if (!fileInfoDiv) return;

        const exportDate = new Date(backupData.exportDate);
        const now = new Date();
        const ageInDays = Math.floor((now - exportDate) / (1000 * 60 * 60 * 24));

        // Determine warning level based on age
        let warningClass = '';
        let warningIcon = '';
        if (ageInDays > 180) {
            warningClass = 'age-180';
            warningIcon = '🔴';
        } else if (ageInDays > 90) {
            warningClass = 'age-90';
            warningIcon = '🟠';
        } else if (ageInDays > 30) {
            warningClass = 'age-30';
            warningIcon = '🟡';
        }

        let html = `
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: 1rem;">
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">File:</span>
                    <span style="font-weight: 500;">${this.restoreFile.name}</span>

                    <span style="color: var(--text-secondary);">Created:</span>
                    <span>${exportDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${exportDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>

                    <span style="color: var(--text-secondary);">Version:</span>
                    <span>${backupData.version || 'Unknown'} (DB v${backupData.dbVersion})</span>

                    <span style="color: var(--text-secondary);">Size:</span>
                    <span>${this.formatBytes(this.restoreFile.size)}</span>
                </div>
        `;

        // Add age warning if applicable
        if (ageInDays > 30) {
            html += `
                <div class="backup-restore-warning ${warningClass}" style="margin-top: 1rem; margin-bottom: 0;">
                    <div class="backup-restore-warning-title">
                        ${warningIcon} Warning: This backup is ${ageInDays} days old
                    </div>
                    <div class="backup-restore-warning-content">
                        Created on ${exportDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                        Restoring old data may overwrite recent changes.
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        fileInfoDiv.innerHTML = html;
    },

    /**
     * Populate data stores list with checkboxes and counts
     */
    async populateRestoreStoresList(backupData) {
        const storesListDiv = document.getElementById('restore-stores-list');
        if (!storesListDiv) return;

        // Get current counts
        const currentCounts = await this.countDataStoreItems();

        // Define store display names and their keys in backup data
        const storeInfo = [
            { key: 'settings', backupKey: 'settings', name: 'Settings', isArray: false },
            { key: 'locations', backupKey: 'locations', name: 'Locations', isArray: true },
            { key: 'telescopes', backupKey: 'telescopes', name: 'Telescopes', isArray: true },
            { key: 'sensors', backupKey: 'sensors', name: 'Sensors', isArray: true },
            { key: 'filters', backupKey: 'filters', name: 'Filters', isArray: true },
            { key: 'pinnedTargets', backupKey: 'pinnedTargets', name: 'Pinned Targets', isArray: true },
            { key: 'toDoTargets', backupKey: 'toDoTargets', name: 'To Do List', isArray: true },
            { key: 'imagingProjects', backupKey: 'imagingProjects', name: 'Imaging Projects', isArray: true },
            { key: 'imagingSessions', backupKey: 'imagingSessions', name: 'Imaging Sessions', isArray: true },
            { key: 'imagingPrograms', backupKey: 'imagingPrograms', name: 'Imaging Programs', isArray: true },
            { key: 'targets', backupKey: 'targetDatabase', name: 'Target Database', isArray: true }
        ];

        let html = '<div class="backup-restore-checkboxes">';

        storeInfo.forEach(store => {
            // Check if this store exists in the backup
            if (backupData[store.backupKey] !== undefined) {
                const backupCount = store.isArray ? backupData[store.backupKey].length : 1;
                const currentCount = store.key === 'settings' ? 1 : currentCounts[store.key];

                // Special handling for imagingSessions - make it disabled and linked to projects
                if (store.key === 'imagingSessions') {
                    html += `
                        <div class="backup-restore-checkbox-item">
                            <input type="checkbox" id="restore-${store.key}" checked disabled data-store="${store.key}">
                            <label for="restore-${store.key}" class="backup-restore-checkbox-label" style="opacity: 0.6;">${store.name}</label>
                            <span class="backup-restore-count-compare" style="opacity: 0.6;">
                                ${currentCount}
                                <span class="backup-restore-count-arrow">→</span>
                                ${backupCount}
                            </span>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="backup-restore-checkbox-item">
                            <input type="checkbox" id="restore-${store.key}" checked data-store="${store.key}">
                            <label for="restore-${store.key}" class="backup-restore-checkbox-label">${store.name}</label>
                            <span class="backup-restore-count-compare">
                                ${currentCount}
                                <span class="backup-restore-count-arrow">→</span>
                                ${backupCount}
                            </span>
                        </div>
                    `;
                }
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

        try {
            UIManager.showToast('Restoring data...', 'info');

            // Execute restore for each selected store
            for (const store of selectedStores) {
                await this.restoreDataStore(store, backupData);
            }

            // Close modal and show success
            UIManager.closeModal();
            UIManager.showToast(`Successfully restored ${selectedStores.length} data stores`, 'success');

            // Reload the page to reflect changes
            setTimeout(() => {
                location.reload();
            }, 1500);

        } catch (error) {
            console.error('Restore failed:', error);
            UIManager.showToast('Restore failed: ' + error.message, 'error');
        }
    },

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
     * Restore a single data store from backup
     */
    async restoreDataStore(storeKey, backupData) {
        // Map store keys to actual store names and backup data keys
        const storeMapping = {
            'settings': { storeName: APP_CONFIG.STORES.SETTINGS, backupKey: 'settings', isArray: false },
            'locations': { storeName: APP_CONFIG.STORES.LOCATIONS, backupKey: 'locations', isArray: true },
            'telescopes': { storeName: APP_CONFIG.STORES.TELESCOPES, backupKey: 'telescopes', isArray: true },
            'sensors': { storeName: APP_CONFIG.STORES.SENSORS, backupKey: 'sensors', isArray: true },
            'filters': { storeName: APP_CONFIG.STORES.FILTERS, backupKey: 'filters', isArray: true },
            'pinnedTargets': { storeName: APP_CONFIG.STORES.PINNED_TARGETS, backupKey: 'pinnedTargets', isArray: true },
            'toDoTargets': { storeName: APP_CONFIG.STORES.TODO_TARGETS, backupKey: 'toDoTargets', isArray: true },
            'imagingProjects': { storeName: APP_CONFIG.STORES.IMAGING_PROJECTS, backupKey: 'imagingProjects', isArray: true },
            'imagingSessions': { storeName: APP_CONFIG.STORES.IMAGING_SESSIONS, backupKey: 'imagingSessions', isArray: true },
            'imagingPrograms': { storeName: APP_CONFIG.STORES.IMAGING_PROGRAMS, backupKey: 'imagingPrograms', isArray: true },
            'targets': { storeName: APP_CONFIG.STORES.TARGETS, backupKey: 'targetDatabase', isArray: true }
        };

        const mapping = storeMapping[storeKey];
        if (!mapping) {
            throw new Error(`Unknown store: ${storeKey}`);
        }

        const data = backupData[mapping.backupKey];
        if (!data) {
            console.warn(`No data found for store: ${storeKey}`);
            return;
        }

        // Clear the store
        await DBManager.clear(mapping.storeName);

        // Restore data
        if (mapping.isArray) {
            // Restore array of items (bulk operation for speed)
            await DBManager.putBulk(mapping.storeName, data);
        } else {
            // Restore single item (settings)
            await DBManager.put(mapping.storeName, data);
        }

        console.log(`Restored ${storeKey}: ${mapping.isArray ? data.length : 1} items`);
    }

};
