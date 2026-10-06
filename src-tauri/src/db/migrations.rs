// src-tauri/src/db/migrations.rs
// Schema migration runner using PRAGMA user_version.
// To add a new migration: append a migrate_vN function to MIGRATIONS.
// CURRENT_SCHEMA_VERSION follows from its length. Never edit existing entries.

use crate::db::schema;
use rusqlite::{Connection, Result};

const MIGRATIONS: &[fn(&Connection) -> Result<()>] = &[
    migrate_v1, // version 0 → 1: create all tables
];

pub const CURRENT_SCHEMA_VERSION: u32 = MIGRATIONS.len() as u32;

pub fn run_migrations(conn: &Connection) -> Result<()> {
    let version = get_version(conn)?;
    log::info!("DB schema version on open: {}", version);

    for (i, migration) in MIGRATIONS.iter().enumerate() {
        let target = (i + 1) as u32;
        if version < target {
            log::info!("Applying DB migration to version {}", target);
            migration(conn)?;
            set_version(conn, target)?;
            log::info!("DB migration to version {} complete", target);
        }
    }

    Ok(())
}

fn get_version(conn: &Connection) -> Result<u32> {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
}

fn set_version(conn: &Connection, version: u32) -> Result<()> {
    conn.execute_batch(&format!("PRAGMA user_version = {}", version))
}

fn migrate_v1(conn: &Connection) -> Result<()> {
    conn.execute_batch(&format!(
        "{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}",
        schema::CREATE_SETTINGS,
        schema::CREATE_LOCATIONS,
        schema::CREATE_TELESCOPES,
        schema::CREATE_SENSORS,
        schema::CREATE_FILTERS,
        schema::CREATE_TARGETS,
        schema::CREATE_TARGETS_IDX_CATALOGUE,
        schema::CREATE_TARGETS_IDX_CONSTELLATION,
        schema::CREATE_PINNED_TARGETS,
        schema::CREATE_TODO_TARGETS,
        schema::CREATE_TODO_TARGETS_IDX_DATE,
        schema::CREATE_IMAGING_PROJECTS,
        schema::CREATE_PROJECT_TARGETS,
        schema::CREATE_PROJECT_TARGETS_IDX_DESIGNATION,
        schema::CREATE_IMAGING_SESSIONS,
        schema::CREATE_IMAGING_SESSIONS_IDX_PROJECT,
        schema::CREATE_IMAGING_SESSIONS_IDX_DESIGNATION,
        schema::CREATE_IMAGING_SESSIONS_IDX_DATE,
        schema::CREATE_IMAGING_PROGRAMS,
        schema::CREATE_PROGRAM_TARGETS,
        schema::CREATE_PROGRAM_TARGETS_IDX_DESIGNATION,
        schema::CREATE_TUTORIAL_PROGRESS,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_conn;

    fn names(conn: &Connection, kind: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = ?1 AND name NOT LIKE 'sqlite_%'")
            .unwrap();
        stmt.query_map([kind], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    }

    /// Names created by `CREATE <kind> IF NOT EXISTS <name>` in schema.rs.
    fn declared(kind: &str) -> Vec<String> {
        let marker = format!("CREATE {} IF NOT EXISTS ", kind);
        include_str!("schema.rs")
            .lines()
            .filter_map(|line| line.trim().strip_prefix(marker.as_str()))
            .map(|rest| rest.split([' ', '(']).next().unwrap().to_string())
            .collect()
    }

    #[test]
    fn fresh_database_reaches_current_version() {
        let conn = test_conn();
        assert_eq!(get_version(&conn).unwrap(), CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn every_table_in_schema_is_created() {
        let conn = test_conn();
        let tables = names(&conn, "table");
        let declared = declared("TABLE");
        assert!(!declared.is_empty());
        for table in &declared {
            assert!(
                tables.contains(table),
                "table {} not created by migrations",
                table
            );
        }
        assert_eq!(tables.len(), declared.len(), "tables: {:?}", tables);
    }

    #[test]
    fn every_index_in_schema_is_created() {
        let conn = test_conn();
        let indexes = names(&conn, "index");
        let declared = declared("INDEX");
        assert!(!declared.is_empty());
        for index in &declared {
            assert!(
                indexes.contains(index),
                "index {} not created by migrations",
                index
            );
        }
    }

    #[test]
    fn rerunning_migrations_changes_nothing() {
        let conn = test_conn();
        let before = names(&conn, "table");
        run_migrations(&conn).unwrap();
        assert_eq!(get_version(&conn).unwrap(), CURRENT_SCHEMA_VERSION);
        assert_eq!(names(&conn, "table"), before);
    }

    #[test]
    fn foreign_keys_are_enforced() {
        let conn = test_conn();
        let on: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(on, 1);
        let orphan = conn.execute(
            "INSERT INTO project_targets (project_id, designation) VALUES (999, 'M 42')",
            [],
        );
        assert!(
            orphan.is_err(),
            "insert referencing a missing project should fail"
        );
    }
}

// ----------------------------------------------------------------------
