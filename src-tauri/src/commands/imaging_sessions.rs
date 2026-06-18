// src-tauri/src/commands/imaging_sessions.rs

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_sessions(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    query_sessions(&db, None)
}

#[tauri::command]
pub fn get_sessions_for_project(project_id: i64, state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    query_sessions(&db, Some(project_id))
}

#[tauri::command]
pub fn get_session(id: i64, state: State<Arc<AstryxState>>) -> Result<Option<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let result = db.query_row(
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

#[tauri::command]
pub fn create_session(session: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
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

    let id = db.last_insert_rowid();

    db.query_row(
        "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                sub_length, num_exposures, used_exposures, notes, created
         FROM imaging_sessions WHERE id = ?1",
        rusqlite::params![id],
        row_to_session,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_session(id: i64, session: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute(
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
            session["numExposures"].as_i64().ok_or("missing numExposures")?,
            session["usedExposures"].as_i64(),
            session["notes"].as_str().unwrap_or(""),
            id,
        ],
    ).map_err(|e| e.to_string())?;

    db.query_row(
        "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                sub_length, num_exposures, used_exposures, notes, created
         FROM imaging_sessions WHERE id = ?1",
        rusqlite::params![id],
        row_to_session,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_session(id: i64, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM imaging_sessions WHERE id = ?1", rusqlite::params![id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn query_sessions(conn: &rusqlite::Connection, project_id: Option<i64>) -> Result<Vec<serde_json::Value>, String> {
    let sql = match project_id {
        Some(_) =>
            "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                    filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                    moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                    sub_length, num_exposures, used_exposures, notes, created
             FROM imaging_sessions WHERE project_id = ?1 ORDER BY date",
        None =>
            "SELECT id, project_id, target_designation, date, location, telescope, sensor,
                    filter, rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                    moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                    sub_length, num_exposures, used_exposures, notes, created
             FROM imaging_sessions ORDER BY date",
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = match project_id {
        Some(pid) => stmt.query_map(rusqlite::params![pid], row_to_session),
        None      => stmt.query_map([], row_to_session),
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

// ----------------------------------------------------------------------
