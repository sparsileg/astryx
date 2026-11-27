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
    if version > migrations::CURRENT_SCHEMA_VERSION {
        return Err(newer_database_message(&db_path, version, app_data_dir));
    }
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

/// A database migrated by a newer Astryx: this version would write rows
/// without the newer columns, so it refuses to open it (Issue #348)
fn newer_database_message(db_path: &Path, version: u32, dir: &Path) -> String {
    let mut message = format!(
        "The database {} was updated by a newer Astryx (schema v{version}; this version reads up to v{}).\n\nInstall the newer version",
        db_path.display(),
        migrations::CURRENT_SCHEMA_VERSION
    );
    // The first copy past this version holds the database as it was
    // before the newer Astryx first updated it
    let copy = pre_migration_copies(dir)
        .unwrap_or_default()
        .into_iter()
        .filter(|(v, _)| *v > migrations::CURRENT_SCHEMA_VERSION)
        .min_by_key(|(v, _)| *v);
    match copy {
        Some((_, path)) => message.push_str(&format!(
            ", or replace the database with the copy saved before that update, {}. The copy won't have changes made since.",
            path.display()
        )),
        None => message.push('.'),
    }
    message
}

/// Delete all but the KEPT_BACKUPS newest pre-migration copies
fn prune_backups(dir: &Path) -> std::io::Result<()> {
    let mut backups = pre_migration_copies(dir)?;
    backups.sort_by_key(|b| std::cmp::Reverse(b.0));
    for (_, path) in backups.iter().skip(KEPT_BACKUPS) {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// The pre-migration copies in dir, with the version each was made for
fn pre_migration_copies(dir: &Path) -> std::io::Result<Vec<(u32, PathBuf)>> {
    Ok(fs::read_dir(dir)?
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
        .collect())
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

    /// A database file in dir at the given schema version
    fn database_at(dir: &Path, version: u32) {
        Connection::open(dir.join("astryx.db"))
            .unwrap()
            .execute_batch(&format!("PRAGMA user_version = {version};"))
            .unwrap();
    }

    #[test]
    fn a_database_from_a_newer_astryx_is_refused() {
        let dir = temp_dir("newer");
        let newer = migrations::CURRENT_SCHEMA_VERSION + 1;
        database_at(&dir, newer);

        let message = open_db(&dir).unwrap_err();
        assert!(message.contains(&format!("schema v{newer}")), "{message}");
        assert!(
            message.contains(&format!(
                "reads up to v{}",
                migrations::CURRENT_SCHEMA_VERSION
            )),
            "{message}"
        );
        assert!(!message.contains(".bak"), "{message}");
        // Left as the newer Astryx wrote it
        let conn = Connection::open(dir.join("astryx.db")).unwrap();
        assert_eq!(migrations::stored_version(&conn).unwrap(), newer);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_refusal_names_the_copy_this_version_can_read() {
        let dir = temp_dir("newer-copy");
        let current = migrations::CURRENT_SCHEMA_VERSION;
        database_at(&dir, current + 2);
        for version in [current, current + 1, current + 2] {
            fs::write(
                dir.join(format!("{BACKUP_PREFIX}{version}{BACKUP_SUFFIX}")),
                "",
            )
            .unwrap();
        }

        let message = open_db(&dir).unwrap_err();
        let readable = format!("{BACKUP_PREFIX}{}{BACKUP_SUFFIX}", current + 1);
        assert!(message.contains(&readable), "{message}");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_current_database_opens() {
        let dir = temp_dir("current");
        database_at(&dir, 0);
        open_db(&dir).unwrap();
        let conn = open_db(&dir).unwrap();
        assert_eq!(
            migrations::stored_version(&conn).unwrap(),
            migrations::CURRENT_SCHEMA_VERSION
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
