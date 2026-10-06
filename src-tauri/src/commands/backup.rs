// src-tauri/src/commands/backup.rs
// Reads a zipped Astryx backup file and returns the JSON contents as a string.
// The zip always contains a single JSON file.

use crate::AstryxState;
use std::io::Read;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn read_zip_backup(path: String, _state: State<Arc<AstryxState>>) -> Result<String, String> {
    read_zip(&path)
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
    sql::restore_imaging_log(&mut *state.conn()?, &projects, &sessions, &programs)
}

/// Return the contents of the first file in the zip at `path`.
fn read_zip(path: &str) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;

    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP: {}", e))?;

    if archive.is_empty() {
        return Err("ZIP file is empty".to_string());
    }

    let mut zip_file = archive
        .by_index(0)
        .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

    let mut contents = String::new();
    zip_file
        .read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read ZIP contents: {}", e))?;

    Ok(contents)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use crate::commands::imaging_programs::sql::insert_program_targets;
    use crate::commands::imaging_projects::sql::insert_project_targets;
    use rusqlite::Connection;

    pub fn restore_imaging_log(
        conn: &mut Connection,
        projects: &[serde_json::Value],
        sessions: &[serde_json::Value],
        programs: &[serde_json::Value],
    ) -> Result<(), String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Clear in reverse FK order
        tx.execute("DELETE FROM imaging_sessions", [])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM project_targets", [])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM program_targets", [])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM imaging_projects", [])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM imaging_programs", [])
            .map_err(|e| e.to_string())?;

        // Insert projects with explicit IDs
        for project in projects {
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

            insert_project_targets(&tx, id, project)?;
        }

        // Insert sessions with explicit IDs
        for session in sessions {
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
        for program in programs {
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

            insert_program_targets(&tx, id, program)?;
        }

        // No sqlite_sequence update needed: inserting an explicit id above the
        // current sequence raises it automatically. sqlite_sequence has no
        // unique key, so INSERT OR REPLACE there added a duplicate row per
        // table on every restore.

        tx.commit().map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::imaging_programs::sql::{create_program, get_all_programs};
    use crate::commands::imaging_projects::sql::{
        create_project, delete_project, get_all_projects,
    };
    use crate::commands::imaging_sessions::sql::{create_session, query_sessions};
    use crate::db::test_conn;
    use rusqlite::Connection;
    use serde_json::json;
    use std::io::Write;

    type ImagingLog = (
        Vec<serde_json::Value>,
        Vec<serde_json::Value>,
        Vec<serde_json::Value>,
    );

    fn export(conn: &Connection) -> ImagingLog {
        (
            get_all_projects(conn).unwrap(),
            query_sessions(conn, None).unwrap(),
            get_all_programs(conn).unwrap(),
        )
    }

    fn restore(conn: &mut Connection, log: &ImagingLog) -> Result<(), String> {
        sql::restore_imaging_log(conn, &log.0, &log.1, &log.2)
    }

    /// An imaging log with a gap in its project IDs, as left by a deletion.
    fn populated() -> Connection {
        let mut conn = test_conn();
        let mut project_ids = Vec::new();
        for (name, modified) in [
            ("Orion", "2026-09-01"),
            ("Deleted", "2026-09-02"),
            ("Veil", "2026-09-03"),
        ] {
            let project = json!({
                "name": name, "status": "Imaging", "notes": "", "publishedLink": null,
                "created": modified, "modified": modified, "targetDesignations": [format!("{} target", name)],
            });
            project_ids.push(
                create_project(&mut conn, &project).unwrap()["id"]
                    .as_i64()
                    .unwrap(),
            );
        }
        for (project_id, date) in [
            (project_ids[0], "2026-09-01"),
            (project_ids[2], "2026-09-04"),
        ] {
            create_session(&conn, &json!({
                "projectId": project_id, "targetDesignation": null, "date": date,
                "location": "Home", "telescope": null, "sensor": null, "filter": null,
                "rotation": 0.0, "tempSetpoint": null, "bin": "1x1", "gain": 0.0, "offset": null,
                "moonIllumination": 0.0, "moonSet": null, "moonRise": null, "angleFromMoon": 0.0,
                "clouds": null, "smoke": null, "seeing": null, "transparency": null,
                "subLength": 300.0, "numExposures": 10, "usedExposures": 0, "notes": "", "created": date,
            })).unwrap();
        }
        delete_project(&conn, project_ids[1]).unwrap();
        create_program(&mut conn, &json!({ "name": "Messier", "status": "Started", "catalogPrefix": "M", "maxNumber": 110, "created": "2026-01-01" })).unwrap();
        create_program(&mut conn, &json!({ "name": "Favourites", "status": "Started", "created": "2026-02-01", "targetDesignations": ["NGC 7000"] })).unwrap();
        conn
    }

    #[test]
    fn restore_reproduces_the_exported_log_exactly() {
        let source = populated();
        let backup = export(&source);
        let mut fresh = test_conn();
        restore(&mut fresh, &backup).unwrap();
        assert_eq!(export(&fresh), backup);
    }

    #[test]
    fn restore_replaces_existing_data() {
        let backup = export(&populated());
        let mut target = test_conn();
        create_project(
            &mut target,
            &json!({ "name": "Stale", "created": "2020-01-01", "modified": "2020-01-01" }),
        )
        .unwrap();
        restore(&mut target, &backup).unwrap();
        assert_eq!(export(&target), backup);
    }

    #[test]
    fn new_records_after_restore_get_fresh_ids() {
        let backup = export(&populated());
        let mut fresh = test_conn();
        restore(&mut fresh, &backup).unwrap();
        let max_id = backup
            .0
            .iter()
            .map(|p| p["id"].as_i64().unwrap())
            .max()
            .unwrap();
        let new = create_project(
            &mut fresh,
            &json!({ "name": "New", "created": "2026-10-01", "modified": "2026-10-01" }),
        )
        .unwrap();
        assert!(new["id"].as_i64().unwrap() > max_id);
    }

    #[test]
    fn restoring_twice_leaves_one_sequence_row_per_table() {
        let backup = export(&populated());
        let mut fresh = test_conn();
        restore(&mut fresh, &backup).unwrap();
        restore(&mut fresh, &backup).unwrap();
        let mut stmt = fresh
            .prepare("SELECT name, COUNT(*) FROM sqlite_sequence GROUP BY name")
            .unwrap();
        let counts: Vec<(String, i64)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        for (table, count) in counts {
            assert_eq!(count, 1, "sqlite_sequence has {} rows for {}", count, table);
        }
    }

    #[test]
    fn a_bad_record_leaves_existing_data_untouched() {
        let mut conn = populated();
        let before = export(&conn);
        let mut broken = before.clone();
        broken.1[0].as_object_mut().unwrap().remove("date");
        assert_eq!(restore(&mut conn, &broken).unwrap_err(), "missing date");
        assert_eq!(export(&conn), before);
    }

    fn temp_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("astryx-test-{}-{}", std::process::id(), name))
    }

    #[test]
    fn read_zip_returns_the_json_inside() {
        let path = temp_path("backup.zip");
        let mut writer = zip::ZipWriter::new(std::fs::File::create(&path).unwrap());
        writer
            .start_file(
                "astryx-backup.json",
                zip::write::SimpleFileOptions::default(),
            )
            .unwrap();
        writer.write_all(br#"{"version":1}"#).unwrap();
        writer.finish().unwrap();
        let result = read_zip(path.to_str().unwrap());
        std::fs::remove_file(&path).unwrap();
        assert_eq!(result.unwrap(), r#"{"version":1}"#);
    }

    #[test]
    fn read_zip_rejects_an_empty_archive() {
        let path = temp_path("empty.zip");
        zip::ZipWriter::new(std::fs::File::create(&path).unwrap())
            .finish()
            .unwrap();
        let result = read_zip(path.to_str().unwrap());
        std::fs::remove_file(&path).unwrap();
        assert_eq!(result.unwrap_err(), "ZIP file is empty");
    }

    #[test]
    fn read_zip_rejects_a_file_that_is_not_a_zip() {
        let path = temp_path("not-a-zip.json");
        std::fs::write(&path, "{}").unwrap();
        let result = read_zip(path.to_str().unwrap());
        std::fs::remove_file(&path).unwrap();
        assert!(result.unwrap_err().starts_with("Failed to read ZIP"));
    }
}

// ----------------------------------------------------------------------
