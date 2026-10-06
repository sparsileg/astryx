// src-tauri/src/commands/filters.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_filters(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_filters(&*state.conn()?)
}

#[tauri::command]
pub fn save_filter(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::save_filter(&*state.conn()?, &name)
}

#[tauri::command]
pub fn delete_filter(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_filter(&*state.conn()?, &name)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_filters(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare("SELECT name FROM filters ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({ "name": row.get::<_, String>(0)? }))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(rows)
    }

    pub fn save_filter(conn: &Connection, name: &str) -> Result<(), String> {
        conn.execute(
            "INSERT OR IGNORE INTO filters (name) VALUES (?1)",
            rusqlite::params![name],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn delete_filter(conn: &Connection, name: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM filters WHERE name = ?1",
            rusqlite::params![name],
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
    fn filters_round_trip_in_name_order() {
        let conn = test_conn();
        save_filter(&conn, "L-eXtreme").unwrap();
        save_filter(&conn, "Ha 7nm").unwrap();
        assert_eq!(
            get_all_filters(&conn).unwrap(),
            vec![json!({ "name": "Ha 7nm" }), json!({ "name": "L-eXtreme" })]
        );
    }

    #[test]
    fn saving_a_duplicate_is_ignored() {
        let conn = test_conn();
        save_filter(&conn, "UV/IR Cut").unwrap();
        save_filter(&conn, "UV/IR Cut").unwrap();
        assert_eq!(get_all_filters(&conn).unwrap().len(), 1);
    }

    #[test]
    fn delete_removes_filter() {
        let conn = test_conn();
        save_filter(&conn, "UV/IR Cut").unwrap();
        delete_filter(&conn, "UV/IR Cut").unwrap();
        assert!(get_all_filters(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
