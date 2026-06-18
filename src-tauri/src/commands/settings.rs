// src-tauri/src/commands/settings.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

/// Get the app-settings JSON blob. Returns null if not yet saved.
#[tauri::command]
pub fn get_settings(state: State<Arc<AstryxState>>) -> Result<Option<String>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let result = db.query_row(
        "SELECT data FROM settings WHERE id = 'app-settings'",
        [],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(data) => Ok(Some(data)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Save the app-settings JSON blob.
#[tauri::command]
pub fn save_settings(data: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT INTO settings (id, data) VALUES ('app-settings', ?1)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        rusqlite::params![data],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

/// Get the target database version string. Returns null if not yet set.
#[tauri::command]
pub fn get_target_version(state: State<Arc<AstryxState>>) -> Result<Option<String>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let result = db.query_row(
        "SELECT data FROM settings WHERE id = 'target-version'",
        [],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(data) => Ok(Some(data)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Save the target database version string.
#[tauri::command]
pub fn set_target_version(version: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT INTO settings (id, data) VALUES ('target-version', ?1)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        rusqlite::params![version],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
