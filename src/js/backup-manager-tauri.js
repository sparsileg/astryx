/**
 * backup-manager-tauri.js
 * Tauri/desktop implementation of backup and restore operations.
 * Uses native file dialogs and SQLite via Tauri commands.
 * Selected automatically by backup-manager.js shim when running in Tauri.
 *
 * File I/O uses tauri-plugin-dialog and tauri-plugin-fs.
 * All modal, counting, store mapping, and restore logic is shared with
 * BackupManagerWeb — only file selection and file save differ.
 */

const BackupManagerTauri = {
    restoreFile: null,      // { name, path, size } — set when user picks a file
    _restoreData: null,     // Parsed JSON backup data

    // ── Utilities ─────────────────────────────────────────────────────────────

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // ── Counts (identical logic to BackupManagerWeb) ──────────────────────────

    async countDataStoreItems() {
        const counts = {
            settings: 1,
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
            counts.locations      = (await DBManager.getAll(APP_CONFIG.STORES.LOCATIONS)).length;
            counts.telescopes     = (await DBManager.getAll(APP_CONFIG.STORES.TELESCOPES)).length;
            counts.sensors        = (await DBManager.getAll(APP_CONFIG.STORES.SENSORS)).length;
            counts.filters        = (await DBManager.getAll(APP_CONFIG.STORES.FILTERS)).length;
            counts.pinnedTargets  = (await DBManager.getAll(APP_CONFIG.STORES.PINNED_TARGETS)).length;
            counts.toDoTargets    = (await DBManager.getAll(APP_CONFIG.STORES.TODO_TARGETS)).length;
            counts.imagingProjects = (await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROJECTS)).length;
            counts.imagingSessions = (await DBManager.getAll(APP_CONFIG.STORES.IMAGING_SESSIONS)).length;
            counts.imagingPrograms = (await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROGRAMS)).length;
            counts.targets        = (await DBManager.getAll(APP_CONFIG.STORES.TARGETS)).length;
        } catch (error) {
            console.error('Error counting data store items:', error);
        }

        return counts;
    },

    updateBackupCounts(counts) {
        document.getElementById('backup-count-settings')?.textContent && (document.getElementById('backup-count-settings').textContent = `(${counts.settings})`);
        document.getElementById('backup-count-locations') && (document.getElementById('backup-count-locations').textContent = `(${counts.locations})`);
        document.getElementById('backup-count-telescopes') && (document.getElementById('backup-count-telescopes').textContent = `(${counts.telescopes})`);
        document.getElementById('backup-count-sensors') && (document.getElementById('backup-count-sensors').textContent = `(${counts.sensors})`);
        document.getElementById('backup-count-filters') && (document.getElementById('backup-count-filters').textContent = `(${counts.filters})`);
        document.getElementById('backup-count-pinned') && (document.getElementById('backup-count-pinned').textContent = `(${counts.pinnedTargets})`);
        document.getElementById('backup-count-todo') && (document.getElementById('backup-count-todo').textContent = `(${counts.toDoTargets})`);
        document.getElementById('backup-count-imaging') && (document.getElementById('backup-count-imaging').textContent = `(${counts.imagingProjects} / ${counts.imagingSessions})`);
        document.getElementById('backup-count-programs') && (document.getElementById('backup-count-programs').textContent = `(${counts.imagingPrograms})`);
        document.getElementById('backup-count-targets') && (document.getElementById('backup-count-targets').textContent = `(${counts.targets})`);
    },

    // ── Backup store selection (identical to BackupManagerWeb) ────────────────

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

    backupSelectAll(checked) {
        document.querySelectorAll('#modal-body input[type="checkbox"]').forEach(cb => {
            cb.checked = checked;
        });
    },

    async calculateBackupSize(selectedStores) {
        return BackupManagerWeb.calculateBackupSize.call(this, selectedStores);
    },

    async updateBackupSizeEstimates() {
        const selectedStores = this.getSelectedBackupStores();
        const uncompressedSize = await this.calculateBackupSize(selectedStores);
        const hasTargets = selectedStores.includes('targets');
        const compressionRatio = hasTargets ? 0.09 : 0.26;
        const compressedSize = Math.floor(uncompressedSize * compressionRatio);
        document.getElementById('backup-size-uncompressed').textContent = this.formatBytes(uncompressedSize);
        document.getElementById('backup-size-compressed').textContent = '~' + this.formatBytes(compressedSize);
    },

    // ── Generate backup data (identical to BackupManagerWeb) ─────────────────

    async generateBackupData(selectedStores) {
        return BackupManagerWeb.generateBackupData.call(this, selectedStores);
    },

    // ── Backup — native save dialog ───────────────────────────────────────────

    async handleNewBackup(modalBody) {
        const selectedStores = this.getSelectedBackupStores();
        if (selectedStores.length === 0) {
            UIManager.showToast('Please select at least one data store to backup', 'warning');
            return;
        }

        try {
            const backupData = await this.generateBackupData(selectedStores);
            const dtg = TimeUtils.nowDTG();
            const defaultFilename = `${APP_CONFIG.APP_NAME}-v${APP_CONFIG.APP_VERSION}-d${APP_CONFIG.DB_VERSION}-userdata-${dtg}.json`;

            const savePath = await window.__TAURI__.dialog.save({
                defaultPath: defaultFilename,
                filters: [{ name: 'JSON Backup', extensions: ['json'] }]
            });

            if (!savePath) return; // User cancelled

            const jsonString = JSON.stringify(backupData, null, 2);
            await window.__TAURI__.fs.writeTextFile(savePath, jsonString);

            await SettingsManager.saveSetting('lastBackupTimestamp', TimeUtils.nowDTG());
            BackupReminder.onBackupComplete();

            const fileSize = this.formatBytes(new TextEncoder().encode(jsonString).length);
            this.showBackupSuccessModal(savePath.split(/[/\\]/).pop(), fileSize, selectedStores, backupData);

        } catch (error) {
            console.error('Backup failed:', error);
            UIManager.showToast('Backup failed: ' + error.message, 'error');
        }
    },

    showBackupSuccessModal(filename, fileSize, stores, backupData) {
        BackupManagerWeb.showBackupSuccessModal.call(this, filename, fileSize, stores, backupData);
    },

    // ── Auto-backup ───────────────────────────────────────────────────────────

    scheduleAutoBackup() {
        // No-op in Tauri — auto-backup requires a user-chosen path
        // which we don't have until the user runs a manual backup.
    },

    async initAutoBackup() {
        // No-op in Tauri for now
    },

    async executeAutoBackup() {
        // No-op in Tauri for now
    },

    // ── Restore — native open dialog ──────────────────────────────────────────

    async handleRestoreFileSelected(modalBody) {
        try {
            const selectedPath = await window.__TAURI__.dialog.open({
                multiple: false,
                filters: [
                    { name: 'Astryx Backup', extensions: ['json', 'zip'] }
                ]
            });

            if (!selectedPath) return; // User cancelled

            const path = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
            const filename = path.split(/[/\\]/).pop();

            // Parse — handle both zip and json
            let backupData;
            if (filename.toLowerCase().endsWith('.zip')) {
                const jsonString = await invoke('read_zip_backup', { path });
                backupData = JSON.parse(jsonString);
            } else {
                const contents = await window.__TAURI__.fs.readTextFile(path);
                backupData = JSON.parse(contents);
            }

            // Store file metadata for display
            this.restoreFile = {
                name: filename,
                path: path,
                size: new TextEncoder().encode(JSON.stringify(backupData)).length
            };
            this._restoreData = backupData;

            // Check version compatibility
            if (backupData.dbVersion !== APP_CONFIG.DB_VERSION) {
                this.showVersionMismatchModal(backupData.dbVersion, APP_CONFIG.DB_VERSION);
                return;
            }

            // Show confirmation modal
            this.showRestoreConfirmModal(backupData);

        } catch (error) {
            console.error('Failed to read backup file:', error);
            UIManager.showToast('Failed to read backup file: ' + error.message, 'error');
        }
    },

    showVersionMismatchModal(backupVersion, currentVersion) {
        BackupManagerWeb.showVersionMismatchModal.call(this, backupVersion, currentVersion);
    },

    showRestoreConfirmModal(backupData) {
        BackupManagerWeb.showRestoreConfirmModal.call(this, backupData);
    },

    populateRestoreFileInfo(backupData) {
        BackupManagerWeb.populateRestoreFileInfo.call(this, backupData);
    },

    async populateRestoreStoresList(backupData) {
        return BackupManagerWeb.populateRestoreStoresList.call(this, backupData);
    },

    restoreSelectAll(checked) {
        BackupManagerWeb.restoreSelectAll.call(this, checked);
    },

    getSelectedRestoreStores() {
        return BackupManagerWeb.getSelectedRestoreStores.call(this);
    },

    async handleRestoreExecute(modalBody, backupData) {
        return BackupManagerWeb.handleRestoreExecute.call(this, modalBody, backupData);
    },

    async restoreDataStore(storeKey, backupData) {
        console.log('BackupManagerTauri.restoreDataStore:', storeKey);
        // Imaging log stores must be restored together to preserve FK relationships
        if (storeKey === 'imagingProjects') {
            await invoke('restore_imaging_log', {
                projects: backupData.imagingProjects || [],
                sessions: backupData.imagingSessions || [],
                programs: backupData.imagingPrograms || [],
            });
            return;
        }
        // Sessions and programs are handled by restore_imaging_log above
        if (storeKey === 'imagingSessions' || storeKey === 'imagingPrograms') {
            return;
        }
        return BackupManagerWeb.restoreDataStore.call(this, storeKey, backupData);
    },

    // ── Not used in Tauri (web-only file input pattern) ───────────────────────

    async readRestoreFile(file) {
        // Not used — Tauri reads via fs plugin directly
    },
};
