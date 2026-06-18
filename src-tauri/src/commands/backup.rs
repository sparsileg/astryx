// src-tauri/src/commands/backup.rs
// Reads a zipped Astryx backup file and returns the JSON contents as a string.
// The zip always contains a single JSON file.

use std::io::Read;
use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn read_zip_backup(path: String, _state: State<Arc<AstryxState>>) -> Result<String, String> {
    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP: {}", e))?;

    if archive.len() == 0 {
        return Err("ZIP file is empty".to_string());
    }

    let mut zip_file = archive.by_index(0)
        .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

    let mut contents = String::new();
    zip_file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read ZIP contents: {}", e))?;

    Ok(contents)
}

/// Restore imaging projects, sessions, and programs from backup data,
/// preserving original IDs so FK relationships remain intact.
/// Clears all three tables first, then bulk-inserts with explicit IDs.
#[tauri::command]
pub fn restore_imaging_log(
    projects: Vec<serde_json::Value>,
    sessions: Vec<serde_json::Value>,
    programs: Vec<serde_json::Value>,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction().map_err(|e| e.to_string())?;

    // Clear in reverse FK order
    tx.execute("DELETE FROM imaging_sessions", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM project_targets", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM program_targets", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM imaging_projects", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM imaging_programs", []).map_err(|e| e.to_string())?;

    // Insert projects with explicit IDs
    for project in &projects {
        let id = project["id"].as_i64().ok_or("project missing id")?;
        tx.execute(
            "INSERT INTO imaging_projects (id, name, status, notes, published_link, created, modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                id,
                project["name"].as_str().ok_or("missing name")?,
                project["status"].as_str().unwrap_or("Planning"),
                project["notes"].as_str().unwrap_or(""),
                project["publishedLink"].as_str(),
                project["created"].as_str().ok_or("missing created")?,
                project["modified"].as_str().ok_or("missing modified")?,
            ],
        ).map_err(|e| e.to_string())?;

        // Insert junction rows
        if let Some(designations) = project["targetDesignations"].as_array() {
            for designation in designations {
                if let Some(d) = designation.as_str() {
                    tx.execute(
                        "INSERT OR IGNORE INTO project_targets (project_id, designation) VALUES (?1, ?2)",
                        rusqlite::params![id, d],
                    ).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Insert sessions with explicit IDs
    for session in &sessions {
        let id = session["id"].as_i64().ok_or("session missing id")?;
        tx.execute(
            "INSERT INTO imaging_sessions
                 (id, project_id, target_designation, date, location, telescope, sensor, filter,
                  rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                  moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                  sub_length, num_exposures, used_exposures, notes, created)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26)",
            rusqlite::params![
                id,
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
    }

    // Insert programs with explicit IDs
    for program in &programs {
        let id = program["id"].as_i64().ok_or("program missing id")?;
        tx.execute(
            "INSERT INTO imaging_programs (id, name, status, catalog_prefix, max_number, created)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                id,
                program["name"].as_str().ok_or("missing name")?,
                program["status"].as_str().unwrap_or("Started"),
                program["catalogPrefix"].as_str(),
                program["maxNumber"].as_i64(),
                program["created"].as_str().ok_or("missing created")?,
            ],
        ).map_err(|e| e.to_string())?;

        // Insert junction rows for manual list programs
        if let Some(designations) = program["targetDesignations"].as_array() {
            for designation in designations {
                if let Some(d) = designation.as_str() {
                    tx.execute(
                        "INSERT OR IGNORE INTO program_targets (program_id, designation) VALUES (?1, ?2)",
                        rusqlite::params![id, d],
                    ).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Reset auto-increment sequences to be above the highest restored ID
    let max_project_id: i64 = projects.iter()
        .filter_map(|p| p["id"].as_i64())
        .max()
        .unwrap_or(0);
    let max_session_id: i64 = sessions.iter()
        .filter_map(|s| s["id"].as_i64())
        .max()
        .unwrap_or(0);
    let max_program_id: i64 = programs.iter()
        .filter_map(|p| p["id"].as_i64())
        .max()
        .unwrap_or(0);

    if max_project_id > 0 {
        tx.execute(
            "INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('imaging_projects', ?1)",
            rusqlite::params![max_project_id],
        ).map_err(|e| e.to_string())?;
    }
    if max_session_id > 0 {
        tx.execute(
            "INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('imaging_sessions', ?1)",
            rusqlite::params![max_session_id],
        ).map_err(|e| e.to_string())?;
    }
    if max_program_id > 0 {
        tx.execute(
            "INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('imaging_programs', ?1)",
            rusqlite::params![max_program_id],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
