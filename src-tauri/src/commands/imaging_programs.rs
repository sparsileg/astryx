// src-tauri/src/commands/imaging_programs.rs
// Pattern-based programs use catalog_prefix + max_number on the program row.
// Manual list programs use the program_targets junction table.
// targetDesignations is hydrated onto manual programs returned to JS.

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_programs(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    fetch_all_programs(&db)
}

#[tauri::command]
pub fn get_program(id: i64, state: State<Arc<AstryxState>>) -> Result<Option<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    fetch_program(&db, id)
}

#[tauri::command]
pub fn create_program(program: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<serde_json::Value, String> {
    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction().map_err(|e| e.to_string())?;

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
    ).map_err(|e| e.to_string())?;

    let id = tx.last_insert_rowid();
    insert_program_targets(&tx, id, &program)?;
    tx.commit().map_err(|e| e.to_string())?;
    fetch_program(&db, id)?.ok_or_else(|| "program not found after insert".to_string())
}

#[tauri::command]
pub fn update_program(id: i64, program: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<serde_json::Value, String> {
    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction().map_err(|e| e.to_string())?;

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
    ).map_err(|e| e.to_string())?;

    // Replace junction rows
    tx.execute("DELETE FROM program_targets WHERE program_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    insert_program_targets(&tx, id, &program)?;
    tx.commit().map_err(|e| e.to_string())?;
    fetch_program(&db, id)?.ok_or_else(|| "program not found after update".to_string())
}

#[tauri::command]
pub fn delete_program(id: i64, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    // ON DELETE CASCADE removes program_targets rows
    db.execute("DELETE FROM imaging_programs WHERE id = ?1", rusqlite::params![id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn insert_program_targets(tx: &rusqlite::Transaction, program_id: i64, program: &serde_json::Value) -> Result<(), String> {
    if let Some(designations) = program["targetDesignations"].as_array() {
        for designation in designations {
            if let Some(d) = designation.as_str() {
                tx.execute(
                    "INSERT OR IGNORE INTO program_targets (program_id, designation) VALUES (?1, ?2)",
                    rusqlite::params![program_id, d],
                ).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

fn fetch_all_programs(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, String> {
    let mut stmt = conn.prepare(
        "SELECT id FROM imaging_programs ORDER BY created"
    ).map_err(|e| e.to_string())?;

    let ids: Vec<i64> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut programs = Vec::new();
    for id in ids {
        if let Some(p) = fetch_program(conn, id)? {
            programs.push(p);
        }
    }
    Ok(programs)
}

fn fetch_program(conn: &rusqlite::Connection, id: i64) -> Result<Option<serde_json::Value>, String> {
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

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e.to_string()),
        Ok(_) => {}
    }

    let (pid, name, status, catalog_prefix, max_number, created) = result.unwrap();

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
    let mut stmt = conn.prepare(
        "SELECT designation FROM program_targets WHERE program_id = ?1 ORDER BY rowid"
    ).map_err(|e| e.to_string())?;

    let designations: Vec<serde_json::Value> = stmt.query_map(rusqlite::params![pid], |row| {
        row.get::<_, String>(0)
    })
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

// ----------------------------------------------------------------------
