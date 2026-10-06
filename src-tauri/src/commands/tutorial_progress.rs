// src-tauri/src/commands/tutorial_progress.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

/// Get tutorial progress for a given id. Returns null if not found.
#[tauri::command]
pub fn get_tutorial_progress(
    id: String,
    state: State<Arc<AstryxState>>,
) -> Result<Option<serde_json::Value>, String> {
    sql::get_tutorial_progress(&*state.conn()?, &id)
}

/// Save tutorial progress (insert or replace).
#[tauri::command]
pub fn save_tutorial_progress(
    id: String,
    data: String,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_tutorial_progress(&*state.conn()?, &id, &data)
}

/// Delete tutorial progress for a given id.
#[tauri::command]
pub fn delete_tutorial_progress(id: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_tutorial_progress(&*state.conn()?, &id)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_tutorial_progress(
        conn: &Connection,
        id: &str,
    ) -> Result<Option<serde_json::Value>, String> {
        let result = conn.query_row(
            "SELECT id, data FROM tutorial_progress WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        );
        match result {
            Ok((rid, data)) => {
                let parsed: serde_json::Value =
                    serde_json::from_str(&data).unwrap_or(serde_json::Value::Null);
                Ok(Some(serde_json::json!({ "id": rid, "data": parsed })))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn save_tutorial_progress(conn: &Connection, id: &str, data: &str) -> Result<(), String> {
        conn.execute(
            "INSERT INTO tutorial_progress (id, data) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            rusqlite::params![id, data],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn delete_tutorial_progress(conn: &Connection, id: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM tutorial_progress WHERE id = ?1",
            rusqlite::params![id],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::sql::*;
    use crate::db::test_conn;
    use serde_json::json;

    #[test]
    fn missing_progress_is_none() {
        let conn = test_conn();
        assert_eq!(
            get_tutorial_progress(&conn, "getting-started").unwrap(),
            None
        );
    }

    #[test]
    fn progress_round_trips_as_parsed_json() {
        let conn = test_conn();
        save_tutorial_progress(&conn, "getting-started", r#"{"step":0,"done":false}"#).unwrap();
        save_tutorial_progress(&conn, "getting-started", r#"{"step":3,"done":true}"#).unwrap();
        assert_eq!(
            get_tutorial_progress(&conn, "getting-started").unwrap(),
            Some(json!({ "id": "getting-started", "data": { "step": 3, "done": true } }))
        );
    }

    #[test]
    fn delete_removes_only_that_tutorial() {
        let conn = test_conn();
        save_tutorial_progress(&conn, "a", "1").unwrap();
        save_tutorial_progress(&conn, "b", "2").unwrap();
        delete_tutorial_progress(&conn, "a").unwrap();
        assert_eq!(get_tutorial_progress(&conn, "a").unwrap(), None);
        assert!(get_tutorial_progress(&conn, "b").unwrap().is_some());
    }
}

// ----------------------------------------------------------------------
