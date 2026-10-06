// src-tauri/src/db/mod.rs
// Database initialisation. Call open_db() once in lib.rs run() and store
// the returned Connection in AstryxState as Mutex<Connection>.

pub mod migrations;
pub mod schema;

use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn open_db(app_data_dir: PathBuf) -> Result<Connection> {
    let db_path = app_data_dir.join("astryx.db");
    log::info!("Opening database at {:?}", db_path);

    let conn = Connection::open(&db_path)?;
    init(&conn)?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;

    log::info!(
        "Database ready (schema v{})",
        migrations::CURRENT_SCHEMA_VERSION
    );
    Ok(conn)
}

/// Current Unix timestamp in seconds.
#[allow(dead_code)]
/// Apply the connection pragmas and bring the schema up to date.
/// Shared by open_db and the tests, so both see the same database.
pub fn init(conn: &Connection) -> Result<()> {
    // Performance and correctness pragmas — must run before any queries
    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        PRAGMA synchronous=NORMAL;
    ",
    )?;

    migrations::run_migrations(conn)
}

/// A fresh, fully migrated in-memory database for tests.
#[cfg(test)]
pub fn test_conn() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    init(&conn).expect("initialise test database");
    conn
}

// ----------------------------------------------------------------------
