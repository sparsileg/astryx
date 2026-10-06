// src-tauri/src/commands/imaging_sessions.rs

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_sessions(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::query_sessions(&*state.conn()?, None)
}

#[tauri::command]
pub fn get_sessions_for_project(
    project_id: i64,
    state: State<Arc<AstryxState>>,
) -> Result<Vec<serde_json::Value>, String> {
    sql::query_sessions(&*state.conn()?, Some(project_id))
}

#[tauri::command]
pub fn get_session(
    id: i64,
    state: State<Arc<AstryxState>>,
) -> Result<Option<serde_json::Value>, String> {
    sql::get_session(&*state.conn()?, id)
}

#[tauri::command]
pub fn create_session(
    session: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<serde_json::Value, String> {
    sql::create_session(&*state.conn()?, &session)
}

#[tauri::command]
pub fn update_session(
    id: i64,
    session: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<serde_json::Value, String> {
    sql::update_session(&*state.conn()?, id, &session)
}

#[tauri::command]
pub fn delete_session(id: i64, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_session(&*state.conn()?, id)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_session(conn: &Connection, id: i64) -> Result<Option<serde_json::Value>, String> {
        let result = conn.query_row(
            "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                    filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                    moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                    sub_length, num_exposures, used_exposures, notes, created
             FROM imaging_sessions WHERE id = ?1",
            rusqlite::params![id],
            row_to_session,
        );
        match result {
            Ok(s) => Ok(Some(s)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn create_session(
        conn: &Connection,
        session: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        conn.execute(
            "INSERT INTO imaging_sessions
                 (project_id, target_designation, date, location, telescope, sensor, filter,
                  rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                  moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                  sub_length, num_exposures, used_exposures, notes, created)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
            rusqlite::params![
                session["projectId"].as_i64().ok_or("missing projectId")?,
                session["targetDesignation"].as_str(),
                session["date"].as_str().ok_or("missing date")?,
                session["location"].as_str(),
                session["telescope"].as_str(),
                session["sensor"].as_str(),
                session["filter"].as_str(),
                session["rotation"].as_f64(),
                session["tempSetpoint"].as_f64(),
                session["bin"].as_str(),
                session["gain"].as_f64(),
                session["offset"].as_f64(),
                session["moonIllumination"].as_f64(),
                session["moonSet"].as_str(),
                session["moonRise"].as_str(),
                session["angleFromMoon"].as_f64(),
                session["clouds"].as_str(),
                session["smoke"].as_str(),
                session["seeing"].as_str(),
                session["transparency"].as_str(),
                session["subLength"].as_f64().ok_or("missing subLength")?,
                session["numExposures"].as_i64().ok_or("missing numExposures")?,
                session["usedExposures"].as_i64(),
                session["notes"].as_str().unwrap_or(""),
                session["created"].as_str().ok_or("missing created")?,
            ],
        ).map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();
        get_session(conn, id)?.ok_or_else(|| "session not found after insert".to_string())
    }

    pub fn update_session(
        conn: &Connection,
        id: i64,
        session: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        conn.execute(
            "UPDATE imaging_sessions SET
                 project_id=?1, target_designation=?2, date=?3, location=?4, telescope=?5,
                 sensor=?6, filter=?7, rotation=?8, temp_setpoint=?9, bin=?10, gain=?11,
                 offset=?12, moon_illumination=?13, moon_set=?14, moon_rise=?15,
                 angle_from_moon=?16, clouds=?17, smoke=?18, seeing=?19, transparency=?20,
                 sub_length=?21, num_exposures=?22, used_exposures=?23, notes=?24
             WHERE id=?25",
            rusqlite::params![
                session["projectId"].as_i64().ok_or("missing projectId")?,
                session["targetDesignation"].as_str(),
                session["date"].as_str().ok_or("missing date")?,
                session["location"].as_str(),
                session["telescope"].as_str(),
                session["sensor"].as_str(),
                session["filter"].as_str(),
                session["rotation"].as_f64(),
                session["tempSetpoint"].as_f64(),
                session["bin"].as_str(),
                session["gain"].as_f64(),
                session["offset"].as_f64(),
                session["moonIllumination"].as_f64(),
                session["moonSet"].as_str(),
                session["moonRise"].as_str(),
                session["angleFromMoon"].as_f64(),
                session["clouds"].as_str(),
                session["smoke"].as_str(),
                session["seeing"].as_str(),
                session["transparency"].as_str(),
                session["subLength"].as_f64().ok_or("missing subLength")?,
                session["numExposures"]
                    .as_i64()
                    .ok_or("missing numExposures")?,
                session["usedExposures"].as_i64(),
                session["notes"].as_str().unwrap_or(""),
                id,
            ],
        )
        .map_err(|e| e.to_string())?;

        get_session(conn, id)?.ok_or_else(|| "session not found after update".to_string())
    }

    pub fn delete_session(conn: &Connection, id: i64) -> Result<(), String> {
        conn.execute(
            "DELETE FROM imaging_sessions WHERE id = ?1",
            rusqlite::params![id],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    pub fn query_sessions(
        conn: &Connection,
        project_id: Option<i64>,
    ) -> Result<Vec<serde_json::Value>, String> {
        let sql = match project_id {
            Some(_) => {
                "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                        filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                        moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                        sub_length, num_exposures, used_exposures, notes, created
                 FROM imaging_sessions WHERE project_id = ?1 ORDER BY date"
            }
            None => {
                "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                        filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                        moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                        sub_length, num_exposures, used_exposures, notes, created
                 FROM imaging_sessions ORDER BY date"
            }
        };

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

        let rows: Vec<serde_json::Value> = match project_id {
            Some(pid) => stmt.query_map(rusqlite::params![pid], row_to_session),
            None => stmt.query_map([], row_to_session),
        }
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        Ok(rows)
    }

    fn row_to_session(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
        Ok(serde_json::json!({
            "id":                row.get::<_, i64>(0)?,
            "projectId":         row.get::<_, i64>(1)?,
            "targetDesignation": row.get::<_, Option<String>>(2)?,
            "date":              row.get::<_, String>(3)?,
            "location":          row.get::<_, Option<String>>(4)?,
            "telescope":         row.get::<_, Option<String>>(5)?,
            "sensor":            row.get::<_, Option<String>>(6)?,
            "filter":            row.get::<_, Option<String>>(7)?,
            "rotation":          row.get::<_, Option<f64>>(8)?,
            "tempSetpoint":      row.get::<_, Option<f64>>(9)?,
            "bin":               row.get::<_, Option<String>>(10)?,
            "gain":              row.get::<_, Option<f64>>(11)?,
            "offset":            row.get::<_, Option<f64>>(12)?,
            "moonIllumination":  row.get::<_, Option<f64>>(13)?,
            "moonSet":           row.get::<_, Option<String>>(14)?,
            "moonRise":          row.get::<_, Option<String>>(15)?,
            "angleFromMoon":     row.get::<_, Option<f64>>(16)?,
            "clouds":            row.get::<_, Option<String>>(17)?,
            "smoke":             row.get::<_, Option<String>>(18)?,
            "seeing":            row.get::<_, Option<String>>(19)?,
            "transparency":      row.get::<_, Option<String>>(20)?,
            "subLength":         row.get::<_, f64>(21)?,
            "numExposures":      row.get::<_, i64>(22)?,
            "usedExposures":     row.get::<_, Option<i64>>(23)?,
            "notes":             row.get::<_, Option<String>>(24)?,
            "created":           row.get::<_, String>(25)?,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::sql::*;
    use crate::commands::imaging_projects::sql::create_project;
    use crate::db::test_conn;
    use rusqlite::Connection;
    use serde_json::json;

    fn new_project(conn: &mut Connection) -> i64 {
        create_project(
            conn,
            &json!({ "name": "Orion", "created": "2026-09-01", "modified": "2026-09-01" }),
        )
        .unwrap()["id"]
            .as_i64()
            .unwrap()
    }

    /// A session as handleSaveSession builds it, every field filled in.
    fn session(project_id: i64, date: &str) -> serde_json::Value {
        json!({
            "projectId": project_id, "targetDesignation": "M 42", "date": date,
            "location": "Home", "telescope": "RedCat 51", "sensor": "ASI2600MC Pro", "filter": "L-eXtreme",
            "rotation": 92.5, "tempSetpoint": -10.0, "bin": "1x1", "gain": 100.0, "offset": 50.0,
            "moonIllumination": 23.0, "moonSet": "22:15", "moonRise": "11:40", "angleFromMoon": 87.0,
            "clouds": "None", "smoke": "Light", "seeing": "Good", "transparency": "Average",
            "subLength": 300.0, "numExposures": 48, "usedExposures": 45, "notes": "Wind after 2am",
            "created": "2026-09-02T08:00:00Z",
        })
    }

    #[test]
    fn create_returns_every_field() {
        let mut conn = test_conn();
        let project_id = new_project(&mut conn);
        let created = create_session(&conn, &session(project_id, "2026-09-01")).unwrap();
        let mut expected = session(project_id, "2026-09-01");
        expected["id"] = created["id"].clone();
        assert_eq!(created, expected);
        assert_eq!(
            get_session(&conn, created["id"].as_i64().unwrap()).unwrap(),
            Some(expected)
        );
    }

    #[test]
    fn zero_values_survive() {
        // handleSaveSession sends 0 for rotation, moon and used-exposure fields left blank.
        let mut conn = test_conn();
        let project_id = new_project(&mut conn);
        let mut zeros = session(project_id, "2026-09-01");
        for field in [
            "rotation",
            "tempSetpoint",
            "gain",
            "offset",
            "moonIllumination",
            "angleFromMoon",
        ] {
            zeros[field] = json!(0.0);
        }
        zeros["usedExposures"] = json!(0);
        let created = create_session(&conn, &zeros).unwrap();
        for field in [
            "rotation",
            "tempSetpoint",
            "gain",
            "offset",
            "moonIllumination",
            "angleFromMoon",
        ] {
            assert_eq!(created[field], json!(0.0), "{} should stay 0", field);
        }
        assert_eq!(created["usedExposures"], json!(0));
    }

    #[test]
    fn blank_numbers_and_times_come_back_null() {
        // handleSaveSession sends '' for blank gain/offset/temperature and null for blank moon times.
        let mut conn = test_conn();
        let project_id = new_project(&mut conn);
        let mut blanks = session(project_id, "2026-09-01");
        for field in ["tempSetpoint", "gain", "offset"] {
            blanks[field] = json!("");
        }
        blanks["moonSet"] = json!(null);
        blanks["moonRise"] = json!(null);
        let created = create_session(&conn, &blanks).unwrap();
        for field in ["tempSetpoint", "gain", "offset", "moonSet", "moonRise"] {
            assert_eq!(created[field], json!(null), "{} should be null", field);
        }
    }

    #[test]
    fn sessions_are_filtered_by_project_and_sorted_by_date() {
        let mut conn = test_conn();
        let orion = new_project(&mut conn);
        let other = new_project(&mut conn);
        create_session(&conn, &session(orion, "2026-09-03")).unwrap();
        create_session(&conn, &session(orion, "2026-09-01")).unwrap();
        create_session(&conn, &session(other, "2026-09-02")).unwrap();

        let dates = |rows: Vec<serde_json::Value>| {
            rows.iter().map(|s| s["date"].clone()).collect::<Vec<_>>()
        };
        assert_eq!(
            dates(query_sessions(&conn, None).unwrap()),
            vec![
                json!("2026-09-01"),
                json!("2026-09-02"),
                json!("2026-09-03")
            ]
        );
        assert_eq!(
            dates(query_sessions(&conn, Some(orion)).unwrap()),
            vec![json!("2026-09-01"), json!("2026-09-03")]
        );
    }

    #[test]
    fn update_changes_fields_but_not_created() {
        let mut conn = test_conn();
        let project_id = new_project(&mut conn);
        let id = create_session(&conn, &session(project_id, "2026-09-01")).unwrap()["id"]
            .as_i64()
            .unwrap();
        let mut changed = session(project_id, "2026-09-01");
        changed["usedExposures"] = json!(40);
        changed["created"] = json!("1999-01-01");
        let updated = update_session(&conn, id, &changed).unwrap();
        assert_eq!(updated["usedExposures"], json!(40));
        assert_eq!(updated["created"], json!("2026-09-02T08:00:00Z"));
    }

    #[test]
    fn session_for_missing_project_is_rejected() {
        let conn = test_conn();
        assert!(create_session(&conn, &session(999, "2026-09-01")).is_err());
        assert!(query_sessions(&conn, None).unwrap().is_empty());
    }

    #[test]
    fn deleting_a_project_deletes_its_sessions() {
        let mut conn = test_conn();
        let project_id = new_project(&mut conn);
        create_session(&conn, &session(project_id, "2026-09-01")).unwrap();
        crate::commands::imaging_projects::sql::delete_project(&conn, project_id).unwrap();
        assert!(query_sessions(&conn, None).unwrap().is_empty());
    }

    #[test]
    fn delete_removes_session() {
        let mut conn = test_conn();
        let project_id = new_project(&mut conn);
        let id = create_session(&conn, &session(project_id, "2026-09-01")).unwrap()["id"]
            .as_i64()
            .unwrap();
        delete_session(&conn, id).unwrap();
        assert_eq!(get_session(&conn, id).unwrap(), None);
    }
}

// ----------------------------------------------------------------------
