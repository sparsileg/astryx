/**
 * backup-manager-tauri.js
 * Tauri/desktop implementation of backup and restore operations.
 * Uses native file dialogs and SQLite via Tauri commands.
 * Selected automatically by backup-manager.js shim when running in Tauri.
 */

const BackupManagerTauri = {
    restoreFile: null,

    async countDataStoreItems() {
        throw new Error('BackupManagerTauri.countDataStoreItems: not implemented');
    },

    updateBackupCounts(counts) {
        throw new Error('BackupManagerTauri.updateBackupCounts: not implemented');
    },

    async calculateBackupSize(selectedStores) {
        throw new Error('BackupManagerTauri.calculateBackupSize: not implemented');
    },

    formatBytes(bytes) {
        // Shared utility — safe to implement here
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    async updateBackupSizeEstimates() {
        throw new Error('BackupManagerTauri.updateBackupSizeEstimates: not implemented');
    },

    getSelectedBackupStores() {
        throw new Error('BackupManagerTauri.getSelectedBackupStores: not implemented');
    },

    backupSelectAll(checked) {
        throw new Error('BackupManagerTauri.backupSelectAll: not implemented');
    },

    scheduleAutoBackup() {
        // No-op for now — Tauri will use native OS scheduling or a different mechanism
    },

    async initAutoBackup() {
        // No-op for now — Tauri implementation pending
    },

    async executeAutoBackup() {
        throw new Error('BackupManagerTauri.executeAutoBackup: not implemented');
    },

    async handleNewBackup(modalBody) {
        throw new Error('BackupManagerTauri.handleNewBackup: not implemented');
    },

    async generateBackupData(selectedStores) {
        throw new Error('BackupManagerTauri.generateBackupData: not implemented');
    },

    async downloadBackup(backupData, filename) {
        throw new Error('BackupManagerTauri.downloadBackup: not implemented');
    },

    showBackupSuccessModal(filename, fileSize, stores, backupData) {
        throw new Error('BackupManagerTauri.showBackupSuccessModal: not implemented');
    },

    async handleRestoreFileSelected(modalBody) {
        throw new Error('BackupManagerTauri.handleRestoreFileSelected: not implemented');
    },

    async readRestoreFile(file) {
        throw new Error('BackupManagerTauri.readRestoreFile: not implemented');
    },

    showVersionMismatchModal(backupVersion, currentVersion) {
        throw new Error('BackupManagerTauri.showVersionMismatchModal: not implemented');
    },

    showRestoreConfirmModal(backupData) {
        throw new Error('BackupManagerTauri.showRestoreConfirmModal: not implemented');
    },

    populateRestoreFileInfo(backupData) {
        throw new Error('BackupManagerTauri.populateRestoreFileInfo: not implemented');
    },

    async populateRestoreStoresList(backupData) {
        throw new Error('BackupManagerTauri.populateRestoreStoresList: not implemented');
    },

    restoreSelectAll(checked) {
        throw new Error('BackupManagerTauri.restoreSelectAll: not implemented');
    },

    async handleRestoreExecute(modalBody, backupData) {
        throw new Error('BackupManagerTauri.handleRestoreExecute: not implemented');
    },

    getSelectedRestoreStores() {
        throw new Error('BackupManagerTauri.getSelectedRestoreStores: not implemented');
    },

    async restoreDataStore(storeKey, backupData) {
        throw new Error('BackupManagerTauri.restoreDataStore: not implemented');
    }

};
