// src-tauri/src/commands/database.rs
// What the app shows about its own database: the schema version and the
// folder it lives in (About, the sidebar and backups; Issues #361, #363).

use crate::db::migrations;
use crate::AstryxState;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    schema_version: u32,
    folder: String,
}

#[tauri::command]
pub fn get_database_info(state: State<Arc<AstryxState>>) -> Result<DatabaseInfo, String> {
    Ok(DatabaseInfo {
        schema_version: sql::schema_version(&*state.conn()?)?,
        folder: state.data_dir.display().to_string(),
    })
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use super::migrations;
    use rusqlite::Connection;

    /// The schema version stored in the open database
    pub fn schema_version(conn: &Connection) -> Result<u32, String> {
        migrations::stored_version(conn).map_err(|e| e.to_string())
    }
}

// ----------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_conn;

    #[test]
    fn the_schema_version_is_the_migrated_one() {
        assert_eq!(
            sql::schema_version(&test_conn()).unwrap(),
            migrations::CURRENT_SCHEMA_VERSION
        );
    }
}
