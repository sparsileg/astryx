// src-tauri/src/commands/pinned_targets.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_pinned_targets(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let mut stmt = db.prepare(
        "SELECT name, ra, dec, common FROM pinned_targets ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "name":   row.get::<_, String>(0)?,
            "ra":     row.get::<_, f64>(1)?,
            "dec":    row.get::<_, f64>(2)?,
            "common": row.get::<_, Option<String>>(3)?,
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

#[tauri::command]
pub fn save_pinned_target(target: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT OR IGNORE INTO pinned_targets (name, ra, dec, common)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            target["name"].as_str().ok_or("missing name")?,
            target["ra"].as_f64().ok_or("missing ra")?,
            target["dec"].as_f64().ok_or("missing dec")?,
            target["common"].as_str(),
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_pinned_target(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM pinned_targets WHERE name = ?1", rusqlite::params![name])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_pinned_targets(state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM pinned_targets", [])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
