// src-tauri/src/commands/settings.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

const APP_SETTINGS_ID: &str = "app-settings";
const TARGET_VERSION_ID: &str = "target-version";

/// Get the app-settings JSON blob. Returns null if not yet saved.
#[tauri::command]
pub fn get_settings(state: State<Arc<AstryxState>>) -> Result<Option<String>, String> {
    sql::get(&*state.conn()?, APP_SETTINGS_ID)
}

/// Save the app-settings JSON blob.
#[tauri::command]
pub fn save_settings(data: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::set(&*state.conn()?, APP_SETTINGS_ID, &data)
}

/// Get the target database version string. Returns null if not yet set.
#[tauri::command]
pub fn get_target_version(state: State<Arc<AstryxState>>) -> Result<Option<String>, String> {
    sql::get(&*state.conn()?, TARGET_VERSION_ID)
}

/// Save the target database version string.
#[tauri::command]
pub fn set_target_version(version: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::set(&*state.conn()?, TARGET_VERSION_ID, &version)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    /// Get the data for one settings row. Returns None if the row is absent.
    pub fn get(conn: &Connection, id: &str) -> Result<Option<String>, String> {
        let result = conn.query_row(
            "SELECT data FROM settings WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(data) => Ok(Some(data)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Insert or replace the data for one settings row.
    pub fn set(conn: &Connection, id: &str, data: &str) -> Result<(), String> {
        conn.execute(
            "INSERT INTO settings (id, data) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            rusqlite::params![id, data],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_conn;

    #[test]
    fn unsaved_settings_are_none() {
        let conn = test_conn();
        assert_eq!(sql::get(&conn, APP_SETTINGS_ID).unwrap(), None);
        assert_eq!(sql::get(&conn, TARGET_VERSION_ID).unwrap(), None);
    }

    #[test]
    fn settings_round_trip_and_overwrite() {
        let conn = test_conn();
        sql::set(&conn, APP_SETTINGS_ID, r#"{"theme":"dark"}"#).unwrap();
        sql::set(&conn, APP_SETTINGS_ID, r#"{"theme":"night"}"#).unwrap();
        assert_eq!(
            sql::get(&conn, APP_SETTINGS_ID).unwrap().as_deref(),
            Some(r#"{"theme":"night"}"#)
        );
    }

    #[test]
    fn settings_and_target_version_are_separate_rows() {
        let conn = test_conn();
        sql::set(&conn, APP_SETTINGS_ID, "{}").unwrap();
        sql::set(&conn, TARGET_VERSION_ID, "42").unwrap();
        assert_eq!(
            sql::get(&conn, APP_SETTINGS_ID).unwrap().as_deref(),
            Some("{}")
        );
        assert_eq!(
            sql::get(&conn, TARGET_VERSION_ID).unwrap().as_deref(),
            Some("42")
        );
    }
}

// ----------------------------------------------------------------------
