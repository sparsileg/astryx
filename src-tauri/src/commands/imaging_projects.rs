// src-tauri/src/commands/imaging_projects.rs
// Projects and their target designations (via project_targets junction table).
// targetDesignations is hydrated onto every project object returned to JS,
// so the JS layer sees the same shape as the IndexedDB version.

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_projects(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    fetch_all_projects(&db)
}

#[tauri::command]
pub fn get_project(id: i64, state: State<Arc<AstryxState>>) -> Result<Option<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    fetch_project(&db, id)
}

#[tauri::command]
pub fn create_project(project: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<serde_json::Value, String> {
    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO imaging_projects (name, status, notes, published_link, created, modified)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            project["name"].as_str().ok_or("missing name")?,
            project["status"].as_str().unwrap_or("Planning"),
            project["notes"].as_str().unwrap_or(""),
            project["publishedLink"].as_str(),
            project["created"].as_str().ok_or("missing created")?,
            project["modified"].as_str().ok_or("missing modified")?,
        ],
    ).map_err(|e| e.to_string())?;

    let id = tx.last_insert_rowid();

    insert_project_targets(&tx, id, &project)?;

    tx.commit().map_err(|e| e.to_string())?;

    fetch_project_with_conn(
        &state.db.lock().expect("db lock poisoned"),
        id
    )?.ok_or_else(|| "project not found after insert".to_string())
}

#[tauri::command]
pub fn update_project(id: i64, project: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<serde_json::Value, String> {
    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE imaging_projects SET name=?1, status=?2, notes=?3, published_link=?4, modified=?5
         WHERE id=?6",
        rusqlite::params![
            project["name"].as_str().ok_or("missing name")?,
            project["status"].as_str().unwrap_or("Planning"),
            project["notes"].as_str().unwrap_or(""),
            project["publishedLink"].as_str(),
            project["modified"].as_str().ok_or("missing modified")?,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    // Replace junction rows
    tx.execute("DELETE FROM project_targets WHERE project_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    insert_project_targets(&tx, id, &project)?;

    tx.commit().map_err(|e| e.to_string())?;

    fetch_project_with_conn(
        &state.db.lock().expect("db lock poisoned"),
        id
    )?.ok_or_else(|| "project not found after update".to_string())
}

#[tauri::command]
pub fn delete_project(id: i64, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    // ON DELETE CASCADE removes project_targets and imaging_sessions rows
    db.execute("DELETE FROM imaging_projects WHERE id = ?1", rusqlite::params![id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn insert_project_targets(tx: &rusqlite::Transaction, project_id: i64, project: &serde_json::Value) -> Result<(), String> {
    if let Some(designations) = project["targetDesignations"].as_array() {
        for designation in designations {
            if let Some(d) = designation.as_str() {
                tx.execute(
                    "INSERT OR IGNORE INTO project_targets (project_id, designation) VALUES (?1, ?2)",
                    rusqlite::params![project_id, d],
                ).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

fn fetch_all_projects(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, name, status, notes, published_link, created, modified
         FROM imaging_projects ORDER BY modified DESC"
    ).map_err(|e| e.to_string())?;

    let ids: Vec<i64> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut projects = Vec::new();
    for id in ids {
        if let Some(p) = fetch_project(conn, id)? {
            projects.push(p);
        }
    }
    Ok(projects)
}

fn fetch_project(conn: &rusqlite::Connection, id: i64) -> Result<Option<serde_json::Value>, String> {
    fetch_project_with_conn(conn, id)
}

fn fetch_project_with_conn(conn: &rusqlite::Connection, id: i64) -> Result<Option<serde_json::Value>, String> {
    let result = conn.query_row(
        "SELECT id, name, status, notes, published_link, created, modified
         FROM imaging_projects WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        },
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e.to_string()),
        Ok(_) => {}
    }

    let (pid, name, status, notes, published_link, created, modified) = result.unwrap();

    // Fetch target designations from junction table
    let mut stmt = conn.prepare(
        "SELECT designation FROM project_targets WHERE project_id = ?1 ORDER BY rowid"
    ).map_err(|e| e.to_string())?;

    let designations: Vec<serde_json::Value> = stmt.query_map(rusqlite::params![pid], |row| {
        row.get::<_, String>(0)
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .map(|d| serde_json::Value::String(d))
    .collect();

    Ok(Some(serde_json::json!({
        "id":                 pid,
        "name":               name,
        "status":             status,
        "notes":              notes.unwrap_or_default(),
        "publishedLink":      published_link,
        "created":            created,
        "modified":           modified,
        "targetDesignations": designations,
    })))
}

// ----------------------------------------------------------------------
