// src-tauri/src/commands/todo_targets.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_todo_targets(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let mut stmt = db.prepare(
        "SELECT target_id, added_date FROM todo_targets ORDER BY added_date"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "targetId":  row.get::<_, String>(0)?,
            "addedDate": row.get::<_, String>(1)?,
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

#[tauri::command]
pub fn save_todo_target(entry: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT OR IGNORE INTO todo_targets (target_id, added_date) VALUES (?1, ?2)",
        rusqlite::params![
            entry["targetId"].as_str().ok_or("missing targetId")?,
            entry["addedDate"].as_str().ok_or("missing addedDate")?,
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_todo_target(target_id: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM todo_targets WHERE target_id = ?1", rusqlite::params![target_id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_todo_targets(state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM todo_targets", [])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
