// src-tauri/src/db/migrations.rs
// Schema migration runner using PRAGMA user_version.
// To add a new migration: push a new closure onto the `migrations` vec
// and bump CURRENT_SCHEMA_VERSION by one. Never edit existing entries.

use rusqlite::{Connection, Result};
use crate::db::schema;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

pub fn run_migrations(conn: &Connection) -> Result<()> {
    let version = get_version(conn)?;
    log::info!("DB schema version on open: {}", version);

    let migrations: Vec<fn(&Connection) -> Result<()>> = vec![
        migrate_v1,  // version 0 → 1: create all tables
    ];

    for (i, migration) in migrations.iter().enumerate() {
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

// ----------------------------------------------------------------------
