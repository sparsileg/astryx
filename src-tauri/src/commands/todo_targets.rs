// src-tauri/src/commands/todo_targets.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_todo_targets(
    state: State<Arc<AstryxState>>,
) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_todo_targets(&*state.conn()?)
}

#[tauri::command]
pub fn save_todo_target(
    entry: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_todo_target(&*state.conn()?, &entry)
}

#[tauri::command]
pub fn delete_todo_target(target_id: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_todo_target(&*state.conn()?, &target_id)
}

#[tauri::command]
pub fn clear_todo_targets(state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::clear_todo_targets(&*state.conn()?)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_todo_targets(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare("SELECT target_id, added_date FROM todo_targets ORDER BY added_date")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
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

    pub fn save_todo_target(conn: &Connection, entry: &serde_json::Value) -> Result<(), String> {
        conn.execute(
            "INSERT OR IGNORE INTO todo_targets (target_id, added_date) VALUES (?1, ?2)",
            rusqlite::params![
                entry["targetId"].as_str().ok_or("missing targetId")?,
                entry["addedDate"].as_str().ok_or("missing addedDate")?,
            ],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn delete_todo_target(conn: &Connection, target_id: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM todo_targets WHERE target_id = ?1",
            rusqlite::params![target_id],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn clear_todo_targets(conn: &Connection) -> Result<(), String> {
        conn.execute("DELETE FROM todo_targets", [])
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
    fn todo_entries_round_trip_oldest_first() {
        let conn = test_conn();
        let later = json!({ "targetId": "M 31", "addedDate": "20261005" });
        let earlier = json!({ "targetId": "M 42", "addedDate": "20260901" });
        save_todo_target(&conn, &later).unwrap();
        save_todo_target(&conn, &earlier).unwrap();
        assert_eq!(get_all_todo_targets(&conn).unwrap(), vec![earlier, later]);
    }

    #[test]
    fn adding_twice_keeps_the_original_date() {
        let conn = test_conn();
        save_todo_target(
            &conn,
            &json!({ "targetId": "M 42", "addedDate": "20260901" }),
        )
        .unwrap();
        save_todo_target(
            &conn,
            &json!({ "targetId": "M 42", "addedDate": "20261005" }),
        )
        .unwrap();
        assert_eq!(
            get_all_todo_targets(&conn).unwrap(),
            vec![json!({ "targetId": "M 42", "addedDate": "20260901" })]
        );
    }

    #[test]
    fn delete_and_clear() {
        let conn = test_conn();
        for id in ["M 31", "M 42", "M 45"] {
            save_todo_target(&conn, &json!({ "targetId": id, "addedDate": "20261005" })).unwrap();
        }
        delete_todo_target(&conn, "M 42").unwrap();
        assert_eq!(get_all_todo_targets(&conn).unwrap().len(), 2);
        clear_todo_targets(&conn).unwrap();
        assert!(get_all_todo_targets(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
