// src-tauri/src/commands/locations.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

/// Get all locations as JSON objects.
#[tauri::command]
pub fn get_all_locations(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let mut stmt = db.prepare(
        "SELECT name, latitude, longitude, elevation, timezone, bortle, horizon
         FROM locations ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "name":      row.get::<_, String>(0)?,
            "latitude":  row.get::<_, f64>(1)?,
            "longitude": row.get::<_, f64>(2)?,
            "elevation": row.get::<_, f64>(3)?,
            "timezone":  row.get::<_, i64>(4)?,
            "bortle":    row.get::<_, i64>(5)?,
            "horizon":   serde_json::from_str::<serde_json::Value>(
                             &row.get::<_, String>(6)?
                         ).unwrap_or(serde_json::json!([])),
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

/// Save a location (insert or replace by name).
#[tauri::command]
pub fn save_location(location: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    let horizon = serde_json::to_string(location.get("horizon").unwrap_or(&serde_json::json!([])))
        .map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO locations (name, latitude, longitude, elevation, timezone, bortle, horizon)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(name) DO UPDATE SET
             latitude  = excluded.latitude,
             longitude = excluded.longitude,
             elevation = excluded.elevation,
             timezone  = excluded.timezone,
             bortle    = excluded.bortle,
             horizon   = excluded.horizon",
        rusqlite::params![
            location["name"].as_str().ok_or("missing name")?,
            location["latitude"].as_f64().ok_or("missing latitude")?,
            location["longitude"].as_f64().ok_or("missing longitude")?,
            location["elevation"].as_f64().ok_or("missing elevation")?,
            location["timezone"].as_i64().ok_or("missing timezone")?,
            location["bortle"].as_i64().ok_or("missing bortle")?,
            horizon,
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

/// Delete a location by name.
#[tauri::command]
pub fn delete_location(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM locations WHERE name = ?1", rusqlite::params![name])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
