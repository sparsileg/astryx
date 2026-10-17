// src-tauri/src/commands/backup.rs
// Reads a zipped Astryx backup file and returns the JSON contents as a string.
// The zip always contains a single JSON file.
// Writes backup files, and restores the ticked stores from backup data.

use crate::AstryxState;
use std::io::Read;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn read_zip_backup(path: String, _state: State<Arc<AstryxState>>) -> Result<String, String> {
    read_zip(&path)
}

/// Write a backup zip to `path`. Written here rather than through the fs
/// plugin so any Backup Folder the user chooses works, not only folders
/// inside the plugin's scope.
#[tauri::command]
pub fn write_backup_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, bytes).map_err(|e| format!("Couldn't write {path}: {e}"))
}

/// Replace the restored stores in one transaction, so a restore that fails
/// leaves every store as it was (Issue #299).
#[tauri::command]
pub fn restore_stores(restore: sql::Restore, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::restore_stores(&mut *state.conn()?, &restore)
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
    use crate::commands::settings::{APP_SETTINGS_ID, TARGET_VERSION_ID};
    use crate::commands::{
        filters, locations, pinned_targets, sensors, settings, targets, telescopes, todo_targets,
    };
    use rusqlite::Connection;
    use serde_json::Value;

    /// The stores a restore replaces. A store left out is untouched.
    #[derive(serde::Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    pub struct Restore {
        /// The app-settings data as JSON text. Other settings rows, such as
        /// the target version, are kept.
        pub settings: Option<String>,
        pub target_version: Option<String>,
        pub locations: Option<Vec<Value>>,
        pub telescopes: Option<Vec<Value>>,
        pub sensors: Option<Vec<Value>>,
        pub filters: Option<Vec<Value>>,
        pub pinned_targets: Option<Vec<Value>>,
        pub to_do_targets: Option<Vec<Value>>,
        pub targets: Option<Vec<Value>>,
        /// Projects and sessions are restored together, keeping their IDs so
        /// sessions still point at their projects
        pub imaging_projects: Option<Vec<Value>>,
        pub imaging_sessions: Option<Vec<Value>>,
        pub imaging_programs: Option<Vec<Value>>,
    }

    pub fn restore_stores(conn: &mut Connection, restore: &Restore) -> Result<(), String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        if let Some(data) = &restore.settings {
            settings::sql::set(&tx, APP_SETTINGS_ID, data)?;
        }
        if let Some(version) = &restore.target_version {
            settings::sql::set(&tx, TARGET_VERSION_ID, version)?;
        }
        if let Some(records) = &restore.locations {
            replace(
                &tx,
                "Locations",
                &["locations"],
                records,
                locations::sql::save_location,
            )?;
        }
        if let Some(records) = &restore.telescopes {
            replace(
                &tx,
                "Telescopes",
                &["telescopes"],
                records,
                telescopes::sql::save_telescope,
            )?;
        }
        if let Some(records) = &restore.sensors {
            replace(
                &tx,
                "Sensors",
                &["sensors"],
                records,
                sensors::sql::save_sensor,
            )?;
        }
        if let Some(records) = &restore.filters {
            replace(&tx, "Filters", &["filters"], records, |conn, filter| {
                filters::sql::save_filter(conn, filter["name"].as_str().ok_or("missing name")?)
            })?;
        }
        if let Some(records) = &restore.pinned_targets {
            replace(
                &tx,
                "Pinned Targets",
                &["pinned_targets"],
                records,
                pinned_targets::sql::save_pinned_target,
            )?;
        }
        if let Some(records) = &restore.to_do_targets {
            replace(
                &tx,
                "To Do List",
                &["todo_targets"],
                records,
                todo_targets::sql::save_todo_target,
            )?;
        }
        if let Some(records) = &restore.targets {
            replace(
                &tx,
                "Target Database",
                &["targets"],
                records,
                targets::sql::upsert_target,
            )?;
        }
        if let Some(projects) = &restore.imaging_projects {
            // Cleared in reverse FK order, then inserted with explicit IDs
            replace(
                &tx,
                "Imaging Projects",
                &["imaging_sessions", "project_targets", "imaging_projects"],
                projects,
                insert_project,
            )?;
            let sessions = restore.imaging_sessions.as_deref().unwrap_or_default();
            replace(&tx, "Imaging Sessions", &[], sessions, insert_session)?;
        }
        if let Some(programs) = &restore.imaging_programs {
            replace(
                &tx,
                "Imaging Programs",
                &["program_targets", "imaging_programs"],
                programs,
                insert_program,
            )?;
        }

        // No sqlite_sequence update needed: inserting an explicit id above the
        // current sequence raises it automatically. sqlite_sequence has no
        // unique key, so INSERT OR REPLACE there added a duplicate row per
        // table on every restore.

        tx.commit().map_err(|e| e.to_string())?;
        if restore.targets.is_some() {
            // As after a target database load: keep the WAL file small
            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Empty `tables`, then save each record. Errors name the store and the
    /// record, e.g. "Locations record 3: missing name".
    fn replace(
        conn: &Connection,
        store: &str,
        tables: &[&str],
        records: &[Value],
        save: impl Fn(&Connection, &Value) -> Result<(), String>,
    ) -> Result<(), String> {
        for table in tables {
            conn.execute(&format!("DELETE FROM {table}"), [])
                .map_err(|e| e.to_string())?;
        }
        for (i, record) in records.iter().enumerate() {
            save(conn, record).map_err(|e| format!("{store} record {}: {e}", i + 1))?;
        }
        Ok(())
    }

    fn insert_project(conn: &Connection, project: &Value) -> Result<(), String> {
        let id = project["id"].as_i64().ok_or("missing id")?;
        conn.execute(
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
        insert_project_targets(conn, id, project)
    }

    fn insert_session(conn: &Connection, session: &Value) -> Result<(), String> {
        conn.execute(
            "INSERT INTO imaging_sessions
                 (id, project_id, target_designation, date, location, telescope, sensor, filter,
                  rotation, temp_setpoint, bin, gain, offset, moon_illumination,
                  moon_set, moon_rise, angle_from_moon, clouds, smoke, seeing, transparency,
                  sub_length, num_exposures, used_exposures, notes, created)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26)",
            rusqlite::params![
                session["id"].as_i64().ok_or("missing id")?,
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
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    fn insert_program(conn: &Connection, program: &Value) -> Result<(), String> {
        let id = program["id"].as_i64().ok_or("missing id")?;
        conn.execute(
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
        )
        .map_err(|e| e.to_string())?;
        insert_program_targets(conn, id, program)
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
    use crate::commands::locations::sql::{get_all_locations, save_location};
    use crate::commands::settings::sql as settings;
    use crate::commands::settings::{APP_SETTINGS_ID, TARGET_VERSION_ID};
    use crate::commands::telescopes::sql::{get_all_telescopes, save_telescope};
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
        sql::restore_stores(conn, &imaging(log))
    }

    fn imaging(log: &ImagingLog) -> sql::Restore {
        sql::Restore {
            imaging_projects: Some(log.0.clone()),
            imaging_sessions: Some(log.1.clone()),
            imaging_programs: Some(log.2.clone()),
            ..Default::default()
        }
    }

    fn location(name: &str) -> serde_json::Value {
        json!({
            "name": name, "latitude": 39.3, "longitude": -78.2, "elevation": 233.0,
            "timezone": -5.0, "timeZone": "America/New_York", "bortle": 4, "horizon": [],
        })
    }

    fn telescope(name: &str) -> serde_json::Value {
        json!({ "name": name, "focalLength": 250.0, "aperture": 51.0, "multiplier": 1.0 })
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
        assert_eq!(
            restore(&mut conn, &broken).unwrap_err(),
            "Imaging Sessions record 1: missing date"
        );
        assert_eq!(export(&conn), before);
    }

    #[test]
    fn restore_without_programs_keeps_existing_programs() {
        let backup = export(&populated());
        let mut target = test_conn();
        create_program(&mut target, &json!({ "name": "Caldwell", "status": "Started", "catalogPrefix": "C", "maxNumber": 109, "created": "2025-01-01" })).unwrap();
        let programs_before = get_all_programs(&target).unwrap();
        let restore = sql::Restore {
            imaging_programs: None,
            ..imaging(&backup)
        };
        sql::restore_stores(&mut target, &restore).unwrap();
        let (projects, sessions, programs) = export(&target);
        assert_eq!((projects, sessions), (backup.0, backup.1));
        assert_eq!(programs, programs_before);
    }

    #[test]
    fn programs_only_restore_leaves_projects_and_sessions_untouched() {
        let backup = export(&populated());
        let mut target = test_conn();
        create_project(
            &mut target,
            &json!({ "name": "Kept", "created": "2020-01-01", "modified": "2020-01-01" }),
        )
        .unwrap();
        create_program(&mut target, &json!({ "name": "Stale", "status": "Started", "created": "2020-01-01", "targetDesignations": ["M 1"] })).unwrap();
        let projects_before = get_all_projects(&target).unwrap();
        let sessions_before = query_sessions(&target, None).unwrap();
        let restore = sql::Restore {
            imaging_programs: Some(backup.2.clone()),
            ..Default::default()
        };
        sql::restore_stores(&mut target, &restore).unwrap();
        assert_eq!(
            export(&target),
            (projects_before, sessions_before, backup.2)
        );
    }

    #[test]
    fn a_bad_program_leaves_existing_programs_untouched() {
        let mut conn = populated();
        let before = export(&conn);
        let mut programs = before.2.clone();
        programs[0].as_object_mut().unwrap().remove("created");
        let restore = sql::Restore {
            imaging_programs: Some(programs),
            ..Default::default()
        };
        assert_eq!(
            sql::restore_stores(&mut conn, &restore).unwrap_err(),
            "Imaging Programs record 1: missing created"
        );
        assert_eq!(export(&conn), before);
    }

    #[test]
    fn restore_replaces_the_given_stores_and_keeps_the_rest() {
        let mut conn = test_conn();
        save_location(&conn, &location("Old site")).unwrap();
        save_telescope(&conn, &telescope("Kept scope")).unwrap();
        settings::set(&conn, TARGET_VERSION_ID, "7").unwrap();
        let restore = sql::Restore {
            settings: Some(r#"{"theme":"night"}"#.to_string()),
            locations: Some(vec![location("Home"), location("Dark site")]),
            ..Default::default()
        };
        sql::restore_stores(&mut conn, &restore).unwrap();
        assert_eq!(
            get_all_locations(&conn).unwrap(),
            vec![location("Dark site"), location("Home")]
        );
        assert_eq!(
            get_all_telescopes(&conn).unwrap(),
            vec![telescope("Kept scope")]
        );
        assert_eq!(
            settings::get(&conn, APP_SETTINGS_ID).unwrap().as_deref(),
            Some(r#"{"theme":"night"}"#)
        );
        assert_eq!(
            settings::get(&conn, TARGET_VERSION_ID).unwrap().as_deref(),
            Some("7")
        );
    }

    #[test]
    fn a_bad_record_in_one_store_rolls_back_every_store() {
        let mut conn = populated();
        save_location(&conn, &location("Home")).unwrap();
        save_telescope(&conn, &telescope("RedCat 51")).unwrap();
        settings::set(&conn, APP_SETTINGS_ID, r#"{"theme":"dark"}"#).unwrap();
        let log_before = export(&conn);
        // Programs are written last, so every other store has been replaced
        // by the time the bad record is reached
        let mut log = export(&test_conn());
        log.2 = log_before.2.clone();
        log.2[1].as_object_mut().unwrap().remove("created");
        let restore = sql::Restore {
            settings: Some(r#"{"theme":"night"}"#.to_string()),
            locations: Some(vec![location("Other")]),
            telescopes: Some(vec![]),
            ..imaging(&log)
        };
        assert_eq!(
            sql::restore_stores(&mut conn, &restore).unwrap_err(),
            "Imaging Programs record 2: missing created"
        );
        assert_eq!(get_all_locations(&conn).unwrap(), vec![location("Home")]);
        assert_eq!(
            get_all_telescopes(&conn).unwrap(),
            vec![telescope("RedCat 51")]
        );
        assert_eq!(
            settings::get(&conn, APP_SETTINGS_ID).unwrap().as_deref(),
            Some(r#"{"theme":"dark"}"#)
        );
        assert_eq!(export(&conn), log_before);
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
