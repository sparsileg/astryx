// src-tauri/src/db/schema.rs
// All CREATE TABLE statements. Each is idempotent (IF NOT EXISTS).

// ── Settings ──────────────────────────────────────────────────────────────────
// Single-row store keyed by id. The 'app-settings' row holds all app settings
// as a JSON blob. The 'target-version' row holds the target database version.

pub const CREATE_SETTINGS: &str = "
CREATE TABLE IF NOT EXISTS settings (
    id          TEXT PRIMARY KEY,
    data        TEXT NOT NULL
);";

// ── Locations ─────────────────────────────────────────────────────────────────
// horizon is a JSON array of {azimuth, elevation} points.

pub const CREATE_LOCATIONS: &str = "
CREATE TABLE IF NOT EXISTS locations (
    name        TEXT PRIMARY KEY,
    latitude    REAL NOT NULL,
    longitude   REAL NOT NULL,
    elevation   REAL NOT NULL,
    timezone    INTEGER NOT NULL,
    bortle      INTEGER NOT NULL,
    horizon     TEXT NOT NULL
);";

// ── Equipment ─────────────────────────────────────────────────────────────────
// All equipment stores use name as PK. Names are immutable; update-in-place
// via INSERT OR REPLACE. Sessions store equipment names as snapshot strings,
// so no FK relationships are needed.

pub const CREATE_TELESCOPES: &str = "
CREATE TABLE IF NOT EXISTS telescopes (
    name            TEXT PRIMARY KEY,
    focal_length    REAL NOT NULL,
    aperture        REAL NOT NULL,
    multiplier      REAL NOT NULL
);";

pub const CREATE_SENSORS: &str = "
CREATE TABLE IF NOT EXISTS sensors (
    name            TEXT PRIMARY KEY,
    resolution_x    INTEGER NOT NULL,
    resolution_y    INTEGER NOT NULL,
    pixel_size_x    REAL NOT NULL,
    pixel_size_y    REAL NOT NULL
);";

pub const CREATE_FILTERS: &str = "
CREATE TABLE IF NOT EXISTS filters (
    name    TEXT PRIMARY KEY
);";

// ── Targets ───────────────────────────────────────────────────────────────────
// object is the primary designator (e.g. "M 42", "NGC 7000").
// best_month, peak_altitude, visibility_start, visibility_end are JSON objects
// keyed by location name, populated by the Best Months calculation.
// mag, subr, size_max, size_min stored as TEXT to match source CSV format.

pub const CREATE_TARGETS: &str = "
CREATE TABLE IF NOT EXISTS targets (
    object          TEXT PRIMARY KEY,
    catalogue       TEXT NOT NULL,
    type            TEXT NOT NULL,
    ra              REAL NOT NULL,
    dec             REAL NOT NULL,
    mag             TEXT,
    subr            TEXT,
    size_max        TEXT,
    size_min        TEXT,
    common          TEXT,
    other           TEXT,
    constellation   TEXT NOT NULL,
    best_month      TEXT,
    peak_altitude   TEXT,
    visibility_start TEXT,
    visibility_end  TEXT
);";

pub const CREATE_TARGETS_IDX_CATALOGUE: &str = "
CREATE INDEX IF NOT EXISTS idx_targets_catalogue ON targets(catalogue);";

pub const CREATE_TARGETS_IDX_CONSTELLATION: &str = "
CREATE INDEX IF NOT EXISTS idx_targets_constellation ON targets(constellation);";

// ── Pinned Targets ────────────────────────────────────────────────────────────
// Stores a lightweight snapshot of target fields needed for display.
// Not a FK to targets — pinned targets persist independently.

pub const CREATE_PINNED_TARGETS: &str = "
CREATE TABLE IF NOT EXISTS pinned_targets (
    name    TEXT PRIMARY KEY,
    ra      REAL NOT NULL,
    dec     REAL NOT NULL,
    common  TEXT
);";

// ── To Do Targets ─────────────────────────────────────────────────────────────
// added_date is YYYYMMDD string, matching existing JS format.

pub const CREATE_TODO_TARGETS: &str = "
CREATE TABLE IF NOT EXISTS todo_targets (
    target_id   TEXT PRIMARY KEY,
    added_date  TEXT NOT NULL
);";

pub const CREATE_TODO_TARGETS_IDX_DATE: &str = "
CREATE INDEX IF NOT EXISTS idx_todo_added_date ON todo_targets(added_date);";

// ── Imaging Projects ──────────────────────────────────────────────────────────

pub const CREATE_IMAGING_PROJECTS: &str = "
CREATE TABLE IF NOT EXISTS imaging_projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Planning',
    notes           TEXT,
    published_link  TEXT,
    created         TEXT NOT NULL,
    modified        TEXT NOT NULL
);";

// Junction table: one row per target per project.
// designation references targets(object) but no FK enforced — targets may be
// updated independently of imaging log data.

pub const CREATE_PROJECT_TARGETS: &str = "
CREATE TABLE IF NOT EXISTS project_targets (
    project_id  INTEGER NOT NULL REFERENCES imaging_projects(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    PRIMARY KEY (project_id, designation)
);";

pub const CREATE_PROJECT_TARGETS_IDX_DESIGNATION: &str = "
CREATE INDEX IF NOT EXISTS idx_project_targets_designation ON project_targets(designation);";

// ── Imaging Sessions ──────────────────────────────────────────────────────────
// Equipment fields (location, telescope, sensor, filter) are stored as snapshot
// strings — they record what was used, independent of equipment store records.
// target_designation denormalizes the project's primary target for query convenience.

pub const CREATE_IMAGING_SESSIONS: &str = "
CREATE TABLE IF NOT EXISTS imaging_sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id          INTEGER NOT NULL REFERENCES imaging_projects(id) ON DELETE CASCADE,
    target_designation  TEXT,
    date                TEXT NOT NULL,
    location            TEXT,
    telescope           TEXT,
    sensor              TEXT,
    filter              TEXT,
    rotation            REAL,
    temp_setpoint       REAL,
    bin                 TEXT,
    gain                REAL,
    offset              REAL,
    moon_illumination   REAL,
    moon_set            TEXT,
    moon_rise           TEXT,
    angle_from_moon     REAL,
    clouds              TEXT,
    smoke               TEXT,
    seeing              TEXT,
    transparency        TEXT,
    sub_length          REAL NOT NULL,
    num_exposures       INTEGER NOT NULL,
    used_exposures      INTEGER,
    notes               TEXT,
    created             TEXT NOT NULL
);";

pub const CREATE_IMAGING_SESSIONS_IDX_PROJECT: &str = "
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON imaging_sessions(project_id);";

pub const CREATE_IMAGING_SESSIONS_IDX_DESIGNATION: &str = "
CREATE INDEX IF NOT EXISTS idx_sessions_designation ON imaging_sessions(target_designation);";

pub const CREATE_IMAGING_SESSIONS_IDX_DATE: &str = "
CREATE INDEX IF NOT EXISTS idx_sessions_date ON imaging_sessions(date);";

// ── Imaging Programs ──────────────────────────────────────────────────────────
// Pattern-based programs use catalog_prefix + max_number; manual list programs
// use the program_targets junction table. The two modes are mutually exclusive:
// catalog_prefix/max_number are NULL for manual programs, program_targets rows
// are absent for pattern-based programs.

pub const CREATE_IMAGING_PROGRAMS: &str = "
CREATE TABLE IF NOT EXISTS imaging_programs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Started',
    catalog_prefix  TEXT,
    max_number      INTEGER,
    created         TEXT NOT NULL
);";

pub const CREATE_PROGRAM_TARGETS: &str = "
CREATE TABLE IF NOT EXISTS program_targets (
    program_id  INTEGER NOT NULL REFERENCES imaging_programs(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    PRIMARY KEY (program_id, designation)
);";

pub const CREATE_PROGRAM_TARGETS_IDX_DESIGNATION: &str = "
CREATE INDEX IF NOT EXISTS idx_program_targets_designation ON program_targets(designation);";

// ── Tutorial Progress ─────────────────────────────────────────────────────────
// Mirrors the IndexedDB tutorialProgress store exactly.
// data is a JSON blob holding progress state for each tutorial.

pub const CREATE_TUTORIAL_PROGRESS: &str = "
CREATE TABLE IF NOT EXISTS tutorial_progress (
    id      TEXT PRIMARY KEY,
    data    TEXT NOT NULL
);";

// ── DSS Cache ─────────────────────────────────────────────────────────────────
// Not migrated to SQLite. In Tauri, DSS images are cached to the filesystem
// under the app data directory.

// ----------------------------------------------------------------------
