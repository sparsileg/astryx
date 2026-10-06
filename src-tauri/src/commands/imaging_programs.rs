// src-tauri/src/commands/imaging_programs.rs
// Pattern-based programs use catalog_prefix + max_number on the program row.
// Manual list programs use the program_targets junction table.
// targetDesignations is hydrated onto manual programs returned to JS.

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_programs(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_programs(&*state.conn()?)
}

#[tauri::command]
pub fn get_program(
    id: i64,
    state: State<Arc<AstryxState>>,
) -> Result<Option<serde_json::Value>, String> {
    sql::get_program(&*state.conn()?, id)
}

#[tauri::command]
pub fn create_program(
    program: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<serde_json::Value, String> {
    sql::create_program(&mut *state.conn()?, &program)
}

#[tauri::command]
pub fn update_program(
    id: i64,
    program: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<serde_json::Value, String> {
    sql::update_program(&mut *state.conn()?, id, &program)
}

#[tauri::command]
pub fn delete_program(id: i64, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_program(&*state.conn()?, id)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_programs(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare("SELECT id FROM imaging_programs ORDER BY created")
            .map_err(|e| e.to_string())?;

        let ids: Vec<i64> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut programs = Vec::new();
        for id in ids {
            if let Some(p) = get_program(conn, id)? {
                programs.push(p);
            }
        }
        Ok(programs)
    }

    pub fn get_program(conn: &Connection, id: i64) -> Result<Option<serde_json::Value>, String> {
        let result = conn.query_row(
            "SELECT id, name, status, catalog_prefix, max_number, created
             FROM imaging_programs WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        );

        let (pid, name, status, catalog_prefix, max_number, created) = match result {
            Ok(row) => row,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e.to_string()),
        };

        // Pattern-based: no junction rows needed
        if catalog_prefix.is_some() {
            return Ok(Some(serde_json::json!({
                "id":            pid,
                "name":          name,
                "status":        status,
                "catalogPrefix": catalog_prefix,
                "maxNumber":     max_number,
                "created":       created,
            })));
        }

        // Manual list: hydrate targetDesignations from junction table
        let mut stmt = conn
            .prepare("SELECT designation FROM program_targets WHERE program_id = ?1 ORDER BY rowid")
            .map_err(|e| e.to_string())?;

        let designations: Vec<serde_json::Value> = stmt
            .query_map(rusqlite::params![pid], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .map(serde_json::Value::String)
            .collect();

        Ok(Some(serde_json::json!({
            "id":                 pid,
            "name":               name,
            "status":             status,
            "created":            created,
            "targetDesignations": designations,
        })))
    }

    pub fn create_program(
        conn: &mut Connection,
        program: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO imaging_programs (name, status, catalog_prefix, max_number, created)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                program["name"].as_str().ok_or("missing name")?,
                program["status"].as_str().unwrap_or("Started"),
                program["catalogPrefix"].as_str(),
                program["maxNumber"].as_i64(),
                program["created"].as_str().ok_or("missing created")?,
            ],
        )
        .map_err(|e| e.to_string())?;

        let id = tx.last_insert_rowid();
        insert_program_targets(&tx, id, program)?;
        tx.commit().map_err(|e| e.to_string())?;
        get_program(conn, id)?.ok_or_else(|| "program not found after insert".to_string())
    }

    pub fn update_program(
        conn: &mut Connection,
        id: i64,
        program: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE imaging_programs SET name=?1, status=?2, catalog_prefix=?3, max_number=?4
             WHERE id=?5",
            rusqlite::params![
                program["name"].as_str().ok_or("missing name")?,
                program["status"].as_str().unwrap_or("Started"),
                program["catalogPrefix"].as_str(),
                program["maxNumber"].as_i64(),
                id,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Replace junction rows
        tx.execute(
            "DELETE FROM program_targets WHERE program_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
        insert_program_targets(&tx, id, program)?;
        tx.commit().map_err(|e| e.to_string())?;
        get_program(conn, id)?.ok_or_else(|| "program not found after update".to_string())
    }

    pub fn delete_program(conn: &Connection, id: i64) -> Result<(), String> {
        // ON DELETE CASCADE removes program_targets rows
        conn.execute(
            "DELETE FROM imaging_programs WHERE id = ?1",
            rusqlite::params![id],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    /// Insert one junction row per target designation. Also used by backup restore.
    pub fn insert_program_targets(
        conn: &Connection,
        program_id: i64,
        program: &serde_json::Value,
    ) -> Result<(), String> {
        if let Some(designations) = program["targetDesignations"].as_array() {
            for designation in designations {
                if let Some(d) = designation.as_str() {
                    conn.execute(
                        "INSERT OR IGNORE INTO program_targets (program_id, designation) VALUES (?1, ?2)",
                        rusqlite::params![program_id, d],
                    ).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::sql::*;
    use crate::db::test_conn;
    use serde_json::json;

    fn messier() -> serde_json::Value {
        json!({ "name": "Messier", "status": "Started", "catalogPrefix": "M", "maxNumber": 110, "created": "2026-01-01" })
    }

    fn favourites() -> serde_json::Value {
        json!({ "name": "Favourites", "status": "Started", "created": "2026-02-01",
                "targetDesignations": ["NGC 7000", "IC 1396", "Sh2-129"] })
    }

    fn with_id(mut program: serde_json::Value, created: &serde_json::Value) -> serde_json::Value {
        program["id"] = created["id"].clone();
        program
    }

    #[test]
    fn pattern_program_round_trips() {
        let mut conn = test_conn();
        let created = create_program(&mut conn, &messier()).unwrap();
        assert_eq!(created, with_id(messier(), &created));
    }

    #[test]
    fn manual_program_round_trips_in_order() {
        let mut conn = test_conn();
        let created = create_program(&mut conn, &favourites()).unwrap();
        assert_eq!(created, with_id(favourites(), &created));
    }

    #[test]
    fn get_all_is_oldest_first() {
        let mut conn = test_conn();
        create_program(&mut conn, &favourites()).unwrap();
        create_program(&mut conn, &messier()).unwrap();
        let names: Vec<_> = get_all_programs(&conn)
            .unwrap()
            .iter()
            .map(|p| p["name"].clone())
            .collect();
        assert_eq!(names, vec![json!("Messier"), json!("Favourites")]);
    }

    #[test]
    fn update_replaces_designations() {
        let mut conn = test_conn();
        let id = create_program(&mut conn, &favourites()).unwrap()["id"]
            .as_i64()
            .unwrap();
        let mut changed = favourites();
        changed["status"] = json!("Complete");
        changed["targetDesignations"] = json!(["IC 1396"]);
        let updated = update_program(&mut conn, id, &changed).unwrap();
        assert_eq!(updated["status"], "Complete");
        assert_eq!(updated["targetDesignations"], json!(["IC 1396"]));
    }

    #[test]
    fn delete_removes_program_and_its_designations() {
        let mut conn = test_conn();
        let id = create_program(&mut conn, &favourites()).unwrap()["id"]
            .as_i64()
            .unwrap();
        delete_program(&conn, id).unwrap();
        assert_eq!(get_program(&conn, id).unwrap(), None);
        let junction: i64 = conn
            .query_row("SELECT COUNT(*) FROM program_targets", [], |r| r.get(0))
            .unwrap();
        assert_eq!(junction, 0);
    }
}

// ----------------------------------------------------------------------
