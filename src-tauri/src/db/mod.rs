// src-tauri/src/db/mod.rs
// Database initialisation. Call open_db() once in lib.rs run() and store
// the returned Connection in AstryxState as Mutex<Connection>.

pub mod migrations;
pub mod schema;

use rusqlite::{Connection, Result};
use std::fs;
use std::path::{Path, PathBuf};

/// Pre-migration copies kept beside the database (Issue #301)
const KEPT_BACKUPS: usize = 3;

const BACKUP_PREFIX: &str = "astryx.db.pre-v";
const BACKUP_SUFFIX: &str = ".bak";

/// Errors are messages for the user, naming the database and any
/// pre-migration copy (Issue #301)
pub fn open_db(app_data_dir: &Path) -> Result<Connection, String> {
    let db_path = app_data_dir.join("astryx.db");
    log::info!("Opening database at {:?}", db_path);
    let failed =
        |e: rusqlite::Error| format!("Couldn't open the database {}: {e}", db_path.display());

    let conn = Connection::open(&db_path).map_err(failed)?;
    // Also where a file that isn't a database fails
    let version = migrations::stored_version(&conn).map_err(failed)?;
    let backup = back_up_before_migrating(&conn, version, app_data_dir)?;
    init(&conn).map_err(|e| match &backup {
        Some(path) => format!(
            "Couldn't update the database {}: {e}\n\nThe database from before the update was saved as {}.",
            db_path.display(),
            path.display()
        ),
        None => failed(e),
    })?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(failed)?;

    log::info!(
        "Database ready (schema v{})",
        migrations::CURRENT_SCHEMA_VERSION
    );
    Ok(conn)
}

/// Copy the database before migrations change it, keeping the newest
/// KEPT_BACKUPS copies. Returns the copy, or None when no migration is
/// pending or the database is new.
fn back_up_before_migrating(
    conn: &Connection,
    version: u32,
    dir: &Path,
) -> Result<Option<PathBuf>, String> {
    let failed = |e: String| format!("Couldn't copy the database before updating it: {e}");
    if version == 0 || version >= migrations::CURRENT_SCHEMA_VERSION {
        return Ok(None);
    }

    let path = dir.join(format!(
        "{BACKUP_PREFIX}{}{BACKUP_SUFFIX}",
        migrations::CURRENT_SCHEMA_VERSION
    ));
    // VACUUM INTO won't overwrite a file; it copies a consistent database
    // whatever is still in the WAL
    if path.exists() {
        fs::remove_file(&path).map_err(|e| failed(e.to_string()))?;
    }
    conn.execute("VACUUM INTO ?1", [path.to_string_lossy()])
        .map_err(|e| failed(e.to_string()))?;
    log::info!("Database copied to {:?} before migrating", path);

    prune_backups(dir).map_err(|e| failed(e.to_string()))?;
    Ok(Some(path))
}

/// Delete all but the KEPT_BACKUPS newest pre-migration copies
fn prune_backups(dir: &Path) -> std::io::Result<()> {
    let mut backups: Vec<(u32, PathBuf)> = fs::read_dir(dir)?
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            let version = path
                .file_name()?
                .to_str()?
                .strip_prefix(BACKUP_PREFIX)?
                .strip_suffix(BACKUP_SUFFIX)?
                .parse()
                .ok()?;
            Some((version, path))
        })
        .collect();
    backups.sort_by_key(|b| std::cmp::Reverse(b.0));
    for (_, path) in backups.iter().skip(KEPT_BACKUPS) {
        fs::remove_file(path)?;
    }
    Ok(())
}

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

#[cfg(test)]
mod tests {
    use super::*;

    /// An empty folder of its own under the system temp folder
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("astryx-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_pending_migration_copies_the_database_first() {
        let dir = temp_dir("backup");
        let conn = Connection::open(dir.join("astryx.db")).unwrap();
        conn.execute_batch("CREATE TABLE marker (x); PRAGMA user_version = 1;")
            .unwrap();

        let path = back_up_before_migrating(&conn, 1, &dir).unwrap().unwrap();
        let copy = Connection::open(&path).unwrap();
        let version: u32 = copy
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
        assert!(copy.prepare("SELECT x FROM marker").is_ok());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_new_or_current_database_is_not_copied() {
        let dir = temp_dir("no-backup");
        let new = Connection::open_in_memory().unwrap();
        assert_eq!(back_up_before_migrating(&new, 0, &dir), Ok(None));
        assert_eq!(
            back_up_before_migrating(&test_conn(), migrations::CURRENT_SCHEMA_VERSION, &dir),
            Ok(None)
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn only_the_newest_copies_are_kept() {
        let dir = temp_dir("prune");
        for version in [2, 10, 3, 9, 4] {
            fs::write(
                dir.join(format!("{BACKUP_PREFIX}{version}{BACKUP_SUFFIX}")),
                "",
            )
            .unwrap();
        }
        fs::write(dir.join("astryx.db"), "").unwrap();
        prune_backups(&dir).unwrap();
        let mut left: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        left.sort();
        assert_eq!(
            left,
            [
                "astryx.db",
                "astryx.db.pre-v10.bak",
                "astryx.db.pre-v4.bak",
                "astryx.db.pre-v9.bak"
            ]
        );
        fs::remove_dir_all(&dir).unwrap();
    }
}
