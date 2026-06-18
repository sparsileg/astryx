// src-tauri/src/commands/tutorial_progress.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

/// Get tutorial progress for a given id. Returns null if not found.
#[tauri::command]
pub fn get_tutorial_progress(id: String, state: State<Arc<AstryxState>>) -> Result<Option<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let result = db.query_row(
        "SELECT id, data FROM tutorial_progress WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        },
    );
    match result {
        Ok((rid, data)) => {
            let parsed: serde_json::Value = serde_json::from_str(&data)
                .unwrap_or(serde_json::Value::Null);
            Ok(Some(serde_json::json!({ "id": rid, "data": parsed })))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Save tutorial progress (insert or replace).
#[tauri::command]
pub fn save_tutorial_progress(id: String, data: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "INSERT INTO tutorial_progress (id, data) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        rusqlite::params![id, data],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

/// Delete tutorial progress for a given id.
#[tauri::command]
pub fn delete_tutorial_progress(id: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
        "DELETE FROM tutorial_progress WHERE id = ?1",
        rusqlite::params![id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
