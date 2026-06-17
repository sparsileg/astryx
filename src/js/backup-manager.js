/**
 * backup-manager.js
 * Selects the appropriate backup manager implementation at runtime.
 * BackupManagerWeb  — browser/IndexedDB, file download/upload
 * BackupManagerTauri — desktop/SQLite, native file dialogs
 */

const BackupManager = typeof window.__TAURI__ !== 'undefined'
      ? BackupManagerTauri
      : BackupManagerWeb;

// ---------------------------------------------------------------------------
