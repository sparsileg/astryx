// src-tauri/src/commands/sensors.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_sensors(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let mut stmt = db.prepare(
        "SELECT name, resolution_x, resolution_y, pixel_size_x, pixel_size_y
         FROM sensors ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "name":        row.get::<_, String>(0)?,
            "resolutionX": row.get::<_, i64>(1)?,
            "resolutionY": row.get::<_, i64>(2)?,
            "pixelSizeX":  row.get::<_, f64>(3)?,
            "pixelSizeY":  row.get::<_, f64>(4)?,
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

#[tauri::command]
pub fn save_sensor(sensor: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT INTO sensors (name, resolution_x, resolution_y, pixel_size_x, pixel_size_y)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(name) DO UPDATE SET
             resolution_x = excluded.resolution_x,
             resolution_y = excluded.resolution_y,
             pixel_size_x = excluded.pixel_size_x,
             pixel_size_y = excluded.pixel_size_y",
        rusqlite::params![
            sensor["name"].as_str().ok_or("missing name")?,
            sensor["resolutionX"].as_i64().ok_or("missing resolutionX")?,
            sensor["resolutionY"].as_i64().ok_or("missing resolutionY")?,
            sensor["pixelSizeX"].as_f64().ok_or("missing pixelSizeX")?,
            sensor["pixelSizeY"].as_f64().ok_or("missing pixelSizeY")?,
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_sensor(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM sensors WHERE name = ?1", rusqlite::params![name])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
