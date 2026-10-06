// src-tauri/src/commands/imaging_projects.rs
// Projects and their target designations (via project_targets junction table).
// targetDesignations is hydrated onto every project object returned to JS,
// so the JS layer sees the same shape as the IndexedDB version.

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_projects(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_projects(&*state.conn()?)
}

#[tauri::command]
pub fn get_project(
    id: i64,
    state: State<Arc<AstryxState>>,
) -> Result<Option<serde_json::Value>, String> {
    sql::get_project(&*state.conn()?, id)
}

#[tauri::command]
pub fn create_project(
    project: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<serde_json::Value, String> {
    sql::create_project(&mut *state.conn()?, &project)
}

#[tauri::command]
pub fn update_project(
    id: i64,
    project: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<serde_json::Value, String> {
    sql::update_project(&mut *state.conn()?, id, &project)
}

#[tauri::command]
pub fn delete_project(id: i64, state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_project(&*state.conn()?, id)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_projects(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare("SELECT id FROM imaging_projects ORDER BY modified DESC")
            .map_err(|e| e.to_string())?;

        let ids: Vec<i64> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut projects = Vec::new();
        for id in ids {
            if let Some(p) = get_project(conn, id)? {
                projects.push(p);
            }
        }
        Ok(projects)
    }

    pub fn get_project(conn: &Connection, id: i64) -> Result<Option<serde_json::Value>, String> {
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

        let (pid, name, status, notes, published_link, created, modified) = match result {
            Ok(row) => row,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e.to_string()),
        };

        // Fetch target designations from junction table
        let mut stmt = conn
            .prepare("SELECT designation FROM project_targets WHERE project_id = ?1 ORDER BY rowid")
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
            "notes":              notes.unwrap_or_default(),
            "publishedLink":      published_link,
            "created":            created,
            "modified":           modified,
            "targetDesignations": designations,
        })))
    }

    pub fn create_project(
        conn: &mut Connection,
        project: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

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
        )
        .map_err(|e| e.to_string())?;

        let id = tx.last_insert_rowid();

        insert_project_targets(&tx, id, project)?;

        tx.commit().map_err(|e| e.to_string())?;

        get_project(conn, id)?.ok_or_else(|| "project not found after insert".to_string())
    }

    pub fn update_project(
        conn: &mut Connection,
        id: i64,
        project: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

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
        tx.execute(
            "DELETE FROM project_targets WHERE project_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
        insert_project_targets(&tx, id, project)?;

        tx.commit().map_err(|e| e.to_string())?;

        get_project(conn, id)?.ok_or_else(|| "project not found after update".to_string())
    }

    pub fn delete_project(conn: &Connection, id: i64) -> Result<(), String> {
        // ON DELETE CASCADE removes project_targets and imaging_sessions rows
        conn.execute(
            "DELETE FROM imaging_projects WHERE id = ?1",
            rusqlite::params![id],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }

    /// Insert one junction row per target designation. Also used by backup restore.
    pub fn insert_project_targets(
        conn: &Connection,
        project_id: i64,
        project: &serde_json::Value,
    ) -> Result<(), String> {
        if let Some(designations) = project["targetDesignations"].as_array() {
            for designation in designations {
                if let Some(d) = designation.as_str() {
                    conn.execute(
                        "INSERT OR IGNORE INTO project_targets (project_id, designation) VALUES (?1, ?2)",
                        rusqlite::params![project_id, d],
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

    fn project(name: &str, modified: &str) -> serde_json::Value {
        json!({
            "name": name, "status": "Imaging", "notes": "Needs more Ha",
            "publishedLink": "https://astrobin.com/abc", "created": "2026-09-01T20:00:00Z",
            "modified": modified, "targetDesignations": ["M 42", "M 43", "NGC 1977"],
        })
    }

    #[test]
    fn create_returns_the_stored_project() {
        let mut conn = test_conn();
        let created = create_project(&mut conn, &project("Orion", "2026-09-02")).unwrap();
        let mut expected = project("Orion", "2026-09-02");
        expected["id"] = created["id"].clone();
        assert_eq!(created, expected);
        assert_eq!(
            get_project(&conn, created["id"].as_i64().unwrap()).unwrap(),
            Some(expected)
        );
    }

    #[test]
    fn optional_fields_default() {
        let mut conn = test_conn();
        let created = create_project(
            &mut conn,
            &json!({
                "name": "Bare", "created": "2026-09-01", "modified": "2026-09-01",
            }),
        )
        .unwrap();
        assert_eq!(created["status"], "Planning");
        assert_eq!(created["notes"], "");
        assert_eq!(created["publishedLink"], json!(null));
        assert_eq!(created["targetDesignations"], json!([]));
    }

    #[test]
    fn get_all_is_most_recently_modified_first() {
        let mut conn = test_conn();
        create_project(&mut conn, &project("Older", "2026-09-01")).unwrap();
        create_project(&mut conn, &project("Newer", "2026-10-01")).unwrap();
        let names: Vec<_> = get_all_projects(&conn)
            .unwrap()
            .iter()
            .map(|p| p["name"].clone())
            .collect();
        assert_eq!(names, vec![json!("Newer"), json!("Older")]);
    }

    #[test]
    fn update_replaces_fields_and_designations() {
        let mut conn = test_conn();
        let id = create_project(&mut conn, &project("Orion", "2026-09-02")).unwrap()["id"]
            .as_i64()
            .unwrap();
        let mut changed = project("Orion Mosaic", "2026-10-05");
        changed["status"] = json!("Complete");
        changed["publishedLink"] = json!(null);
        changed["targetDesignations"] = json!(["M 42"]);
        let updated = update_project(&mut conn, id, &changed).unwrap();
        assert_eq!(updated["name"], "Orion Mosaic");
        assert_eq!(updated["status"], "Complete");
        assert_eq!(updated["publishedLink"], json!(null));
        assert_eq!(updated["targetDesignations"], json!(["M 42"]));
        assert_eq!(
            updated["created"], "2026-09-01T20:00:00Z",
            "update must not touch created"
        );
    }

    #[test]
    fn updating_a_missing_project_is_an_error() {
        let mut conn = test_conn();
        let mut missing = project("Ghost", "2026-10-05");
        missing["targetDesignations"] = json!([]);
        assert!(update_project(&mut conn, 999, &missing).is_err());
    }

    #[test]
    fn missing_project_is_none() {
        let conn = test_conn();
        assert_eq!(get_project(&conn, 999).unwrap(), None);
    }

    #[test]
    fn delete_removes_project_and_its_designations() {
        let mut conn = test_conn();
        let id = create_project(&mut conn, &project("Orion", "2026-09-02")).unwrap()["id"]
            .as_i64()
            .unwrap();
        delete_project(&conn, id).unwrap();
        assert_eq!(get_project(&conn, id).unwrap(), None);
        let junction: i64 = conn
            .query_row("SELECT COUNT(*) FROM project_targets", [], |r| r.get(0))
            .unwrap();
        assert_eq!(junction, 0);
    }
}

// ----------------------------------------------------------------------
