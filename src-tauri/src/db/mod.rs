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

    // Performance and correctness pragmas — must run before any queries
    conn.execute_batch("
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        PRAGMA synchronous=NORMAL;
    ")?;

    migrations::run_migrations(&conn)?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;

    log::info!("Database ready (schema v{})", migrations::CURRENT_SCHEMA_VERSION);
    Ok(conn)
}

/// Current Unix timestamp in seconds.
#[allow(dead_code)]
pub fn now_unix() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// ----------------------------------------------------------------------
