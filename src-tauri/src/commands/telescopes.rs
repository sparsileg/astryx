// src-tauri/src/commands/telescopes.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_telescopes(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let mut stmt = db.prepare(
        "SELECT name, focal_length, aperture, multiplier FROM telescopes ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "name":        row.get::<_, String>(0)?,
            "focalLength": row.get::<_, f64>(1)?,
            "aperture":    row.get::<_, f64>(2)?,
            "multiplier":  row.get::<_, f64>(3)?,
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

/// Save a telescope (insert or replace by name).
#[tauri::command]
pub fn save_telescope(telescope: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT INTO telescopes (name, focal_length, aperture, multiplier)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(name) DO UPDATE SET
             focal_length = excluded.focal_length,
             aperture     = excluded.aperture,
             multiplier   = excluded.multiplier",
        rusqlite::params![
            telescope["name"].as_str().ok_or("missing name")?,
            telescope["focalLength"].as_f64().ok_or("missing focalLength")?,
            telescope["aperture"].as_f64().ok_or("missing aperture")?,
            telescope["multiplier"].as_f64().ok_or("missing multiplier")?,
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_telescope(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM telescopes WHERE name = ?1", rusqlite::params![name])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
