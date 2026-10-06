// src-tauri/src/commands/locations.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

/// Get all locations as JSON objects.
#[tauri::command]
pub fn get_all_locations(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_locations(&*state.conn()?)
}

/// Save a location (insert or replace by name).
#[tauri::command]
pub fn save_location(
    location: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_location(&*state.conn()?, &location)
}

/// Delete a location by name.
#[tauri::command]
pub fn delete_location(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_location(&*state.conn()?, &name)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_locations(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT name, latitude, longitude, elevation, timezone, bortle, horizon
             FROM locations ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
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

    pub fn save_location(conn: &Connection, location: &serde_json::Value) -> Result<(), String> {
        let horizon =
            serde_json::to_string(location.get("horizon").unwrap_or(&serde_json::json!([])))
                .map_err(|e| e.to_string())?;

        conn.execute(
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

    pub fn delete_location(conn: &Connection, name: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM locations WHERE name = ?1",
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

    fn home() -> serde_json::Value {
        json!({
            "name": "Home",
            "latitude": 39.296739,
            "longitude": -78.198136,
            "elevation": 233.0,
            "timezone": -5,
            "bortle": 4,
            "horizon": [{ "azimuth": 0.0, "elevation": 10.0 }, { "azimuth": 90.0, "elevation": 0.0 }],
        })
    }

    #[test]
    fn location_round_trips_every_field() {
        let conn = test_conn();
        save_location(&conn, &home()).unwrap();
        assert_eq!(get_all_locations(&conn).unwrap(), vec![home()]);
    }

    #[test]
    fn zero_values_survive() {
        // Equator, prime meridian, sea level, UTC: every number is a legitimate 0.
        let conn = test_conn();
        let origin = json!({
            "name": "Origin", "latitude": 0.0, "longitude": 0.0, "elevation": 0.0,
            "timezone": 0, "bortle": 1, "horizon": [],
        });
        save_location(&conn, &origin).unwrap();
        assert_eq!(get_all_locations(&conn).unwrap(), vec![origin]);
    }

    #[test]
    fn missing_horizon_is_stored_as_empty() {
        let conn = test_conn();
        let mut location = home();
        location.as_object_mut().unwrap().remove("horizon");
        save_location(&conn, &location).unwrap();
        assert_eq!(get_all_locations(&conn).unwrap()[0]["horizon"], json!([]));
    }

    #[test]
    fn save_updates_existing_location() {
        let conn = test_conn();
        save_location(&conn, &home()).unwrap();
        let mut moved = home();
        moved["bortle"] = json!(6);
        save_location(&conn, &moved).unwrap();
        assert_eq!(get_all_locations(&conn).unwrap(), vec![moved]);
    }

    #[test]
    fn missing_required_field_is_an_error() {
        let conn = test_conn();
        let mut location = home();
        location.as_object_mut().unwrap().remove("latitude");
        assert_eq!(
            save_location(&conn, &location).unwrap_err(),
            "missing latitude"
        );
        assert!(get_all_locations(&conn).unwrap().is_empty());
    }

    #[test]
    fn delete_removes_location() {
        let conn = test_conn();
        save_location(&conn, &home()).unwrap();
        delete_location(&conn, "Home").unwrap();
        assert!(get_all_locations(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
