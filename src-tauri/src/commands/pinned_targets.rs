// src-tauri/src/commands/pinned_targets.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_pinned_targets(
    state: State<Arc<AstryxState>>,
) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_pinned_targets(&*state.conn()?)
}

#[tauri::command]
pub fn save_pinned_target(
    target: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_pinned_target(&*state.conn()?, &target)
}

#[tauri::command]
pub fn delete_pinned_target(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_pinned_target(&*state.conn()?, &name)
}

#[tauri::command]
pub fn clear_pinned_targets(state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::clear_pinned_targets(&*state.conn()?)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_pinned_targets(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare("SELECT name, ra, dec, common FROM pinned_targets ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "name":   row.get::<_, String>(0)?,
                    "ra":     row.get::<_, f64>(1)?,
                    "dec":    row.get::<_, f64>(2)?,
                    "common": row.get::<_, Option<String>>(3)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?;

        Ok(rows)
    }

    /// Saving a pinned name again replaces it, as the web store does (#338).
    pub fn save_pinned_target(conn: &Connection, target: &serde_json::Value) -> Result<(), String> {
        conn.execute(
            "INSERT INTO pinned_targets (name, ra, dec, common)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(name) DO UPDATE SET ra = excluded.ra, dec = excluded.dec, common = excluded.common",
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

    pub fn delete_pinned_target(conn: &Connection, name: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM pinned_targets WHERE name = ?1",
            rusqlite::params![name],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn clear_pinned_targets(conn: &Connection) -> Result<(), String> {
        conn.execute("DELETE FROM pinned_targets", [])
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
    fn pinned_target_round_trips_with_and_without_common_name() {
        let conn = test_conn();
        let m42 = json!({ "name": "M 42", "ra": 5.588, "dec": -5.391, "common": "Orion Nebula" });
        let ngc = json!({ "name": "NGC 7000", "ra": 0.0, "dec": 0.0, "common": null });
        save_pinned_target(&conn, &m42).unwrap();
        save_pinned_target(&conn, &ngc).unwrap();
        assert_eq!(get_all_pinned_targets(&conn).unwrap(), vec![m42, ngc]);
    }

    #[test]
    fn pinning_twice_keeps_the_last() {
        let conn = test_conn();
        save_pinned_target(
            &conn,
            &json!({ "name": "M 42", "ra": 5.588, "dec": -5.391 }),
        )
        .unwrap();
        save_pinned_target(&conn, &json!({ "name": "M 42", "ra": 1.0, "dec": 1.0 })).unwrap();
        let pinned = get_all_pinned_targets(&conn).unwrap();
        assert_eq!(pinned.len(), 1);
        assert_eq!(pinned[0]["ra"], json!(1.0));
        assert_eq!(pinned[0]["common"], json!(null));
    }

    #[test]
    fn a_row_that_cannot_be_read_is_an_error_not_dropped() {
        let conn = test_conn();
        save_pinned_target(&conn, &json!({ "name": "M 42", "ra": 5.588, "dec": -5.391 })).unwrap();
        // SQLite keeps a value of any type; a text ra can't be read as f64
        conn.execute("INSERT INTO pinned_targets (name, ra, dec) VALUES ('M 31', 'bad', 0.0)", []).unwrap();
        assert!(get_all_pinned_targets(&conn).is_err());
    }

    #[test]
    fn delete_and_clear() {
        let conn = test_conn();
        for name in ["M 31", "M 42", "M 45"] {
            save_pinned_target(&conn, &json!({ "name": name, "ra": 1.0, "dec": 1.0 })).unwrap();
        }
        delete_pinned_target(&conn, "M 42").unwrap();
        assert_eq!(get_all_pinned_targets(&conn).unwrap().len(), 2);
        clear_pinned_targets(&conn).unwrap();
        assert!(get_all_pinned_targets(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
