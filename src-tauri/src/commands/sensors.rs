// src-tauri/src/commands/sensors.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_sensors(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_sensors(&*state.conn()?)
}

#[tauri::command]
pub fn save_sensor(
    sensor: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_sensor(&*state.conn()?, &sensor)
}

#[tauri::command]
pub fn delete_sensor(name: String, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_sensor(&*state.conn()?, &name)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_sensors(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT name, resolution_x, resolution_y, pixel_size_x, pixel_size_y
             FROM sensors ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
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

    pub fn save_sensor(conn: &Connection, sensor: &serde_json::Value) -> Result<(), String> {
        conn.execute(
            "INSERT INTO sensors (name, resolution_x, resolution_y, pixel_size_x, pixel_size_y)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(name) DO UPDATE SET
                 resolution_x = excluded.resolution_x,
                 resolution_y = excluded.resolution_y,
                 pixel_size_x = excluded.pixel_size_x,
                 pixel_size_y = excluded.pixel_size_y",
            rusqlite::params![
                sensor["name"].as_str().ok_or("missing name")?,
                sensor["resolutionX"]
                    .as_i64()
                    .ok_or("missing resolutionX")?,
                sensor["resolutionY"]
                    .as_i64()
                    .ok_or("missing resolutionY")?,
                sensor["pixelSizeX"].as_f64().ok_or("missing pixelSizeX")?,
                sensor["pixelSizeY"].as_f64().ok_or("missing pixelSizeY")?,
            ],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn delete_sensor(conn: &Connection, name: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM sensors WHERE name = ?1",
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

    fn asi2600() -> serde_json::Value {
        json!({
            "name": "ASI2600MC Pro", "resolutionX": 6248, "resolutionY": 4176,
            "pixelSizeX": 3.76, "pixelSizeY": 3.76,
        })
    }

    #[test]
    fn sensor_round_trips_every_field() {
        let conn = test_conn();
        save_sensor(&conn, &asi2600()).unwrap();
        assert_eq!(get_all_sensors(&conn).unwrap(), vec![asi2600()]);
    }

    #[test]
    fn save_updates_existing_sensor() {
        let conn = test_conn();
        save_sensor(&conn, &asi2600()).unwrap();
        let mut binned = asi2600();
        binned["pixelSizeX"] = json!(7.52);
        binned["pixelSizeY"] = json!(7.52);
        save_sensor(&conn, &binned).unwrap();
        assert_eq!(get_all_sensors(&conn).unwrap(), vec![binned]);
    }

    #[test]
    fn fractional_resolution_is_rejected() {
        let conn = test_conn();
        let mut sensor = asi2600();
        sensor["resolutionX"] = json!(6248.5);
        assert_eq!(
            save_sensor(&conn, &sensor).unwrap_err(),
            "missing resolutionX"
        );
    }

    #[test]
    fn delete_removes_sensor() {
        let conn = test_conn();
        save_sensor(&conn, &asi2600()).unwrap();
        delete_sensor(&conn, "ASI2600MC Pro").unwrap();
        assert!(get_all_sensors(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
