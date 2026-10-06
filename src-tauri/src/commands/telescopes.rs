// src-tauri/src/commands/telescopes.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_telescopes(
    state: State<Arc<AstryxState>>,
) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_telescopes(&*state.conn()?)
}

/// Save a telescope (insert or replace by name).
#[tauri::command]
pub fn save_telescope(
    telescope: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_telescope(&*state.conn()?, &telescope)
}

#[tauri::command]
pub fn delete_telescope(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_telescope(&*state.conn()?, &name)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_telescopes(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT name, focal_length, aperture, multiplier FROM telescopes ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
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

    pub fn save_telescope(conn: &Connection, telescope: &serde_json::Value) -> Result<(), String> {
        conn.execute(
            "INSERT INTO telescopes (name, focal_length, aperture, multiplier)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(name) DO UPDATE SET
                 focal_length = excluded.focal_length,
                 aperture     = excluded.aperture,
                 multiplier   = excluded.multiplier",
            rusqlite::params![
                telescope["name"].as_str().ok_or("missing name")?,
                telescope["focalLength"]
                    .as_f64()
                    .ok_or("missing focalLength")?,
                telescope["aperture"].as_f64().ok_or("missing aperture")?,
                telescope["multiplier"]
                    .as_f64()
                    .ok_or("missing multiplier")?,
            ],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn delete_telescope(conn: &Connection, name: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM telescopes WHERE name = ?1",
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

    fn redcat() -> serde_json::Value {
        json!({ "name": "RedCat 51", "focalLength": 250.0, "aperture": 51.0, "multiplier": 1.0 })
    }

    #[test]
    fn telescope_round_trips_every_field() {
        let conn = test_conn();
        save_telescope(&conn, &redcat()).unwrap();
        assert_eq!(get_all_telescopes(&conn).unwrap(), vec![redcat()]);
    }

    #[test]
    fn save_updates_existing_telescope() {
        let conn = test_conn();
        save_telescope(&conn, &redcat()).unwrap();
        let mut reduced = redcat();
        reduced["multiplier"] = json!(0.8);
        save_telescope(&conn, &reduced).unwrap();
        assert_eq!(get_all_telescopes(&conn).unwrap(), vec![reduced]);
    }

    #[test]
    fn returned_in_name_order() {
        let conn = test_conn();
        for name in ["Zeta", "Alpha"] {
            let mut t = redcat();
            t["name"] = json!(name);
            save_telescope(&conn, &t).unwrap();
        }
        let names: Vec<_> = get_all_telescopes(&conn)
            .unwrap()
            .iter()
            .map(|t| t["name"].clone())
            .collect();
        assert_eq!(names, vec![json!("Alpha"), json!("Zeta")]);
    }

    #[test]
    fn delete_removes_telescope() {
        let conn = test_conn();
        save_telescope(&conn, &redcat()).unwrap();
        delete_telescope(&conn, "RedCat 51").unwrap();
        assert!(get_all_telescopes(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
