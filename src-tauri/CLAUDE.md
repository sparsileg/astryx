# Rust / SQLite (`src-tauri/`)

- One crate, no workspace. Shared state is `AstryxState` holding
  `Mutex<Connection>`.
- Pragmas on open: WAL, `foreign_keys=ON`, `synchronous=NORMAL`.
- **Migrations** (`db/migrations.rs`) are keyed on `PRAGMA user_version` and
  append-only. Never edit an existing migration; add `migrate_vN` to
  `MIGRATIONS` (the schema version follows from its length). Table
  definitions live in `db/schema.rs`.
- Each command file has thin `#[tauri::command]` wrappers that lock with
  `state.conn()?` and call the store's `sql::` functions, which take a
  `&Connection` and hold the SQL. Tests live beside them and use
  `db::test_conn()` (in-memory, fully migrated). New database code goes in
  `sql::` with a test.
- Commands return `Result<T, String>`. Propagate with
  `.map_err(|e| e.to_string())?`; no `unwrap()` / `println!` (use `log::`).
