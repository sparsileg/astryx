/**
 * db-manager.js
 * Selects the appropriate database backend at runtime.
 * DBManagerTauri — desktop/SQLite, via Tauri IPC commands
 * DBManagerWeb   — browser/IndexedDB, file download/upload
 */

const DBManager = typeof window.__TAURI__ !== 'undefined'
    ? DBManagerTauri
    : DBManagerWeb;
