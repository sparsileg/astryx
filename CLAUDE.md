# Astryx — Development Guide

Astryx is an astrophotography planning app: a ~14,600-object target database,
visibility/observability planning, a sequence planner, an imaging log, and
ASIAir/PHD2 session-log analysis. One plain-JS frontend runs two ways:

- **Web** — `src/` served as static files from Cloudflare (`wrangler.jsonc`),
  persisting to IndexedDB.
- **Desktop** — Tauri v2 (`src-tauri/`) loading the same `src/`, persisting to
  SQLite through Rust commands.

The project is in maintenance mode: bug fixes, UI tweaks, tutorial updates.

## Running it

No `package.json`, no bundler, no build step.

```bash
just serve    # web build: npx serve src --listen 1420
just dev      # desktop: cargo tauri dev (starts the server itself)
just test     # JS validation cases (Node) + Rust tests
just check    # fmt-check, clippy, then all tests
```

`just` lists every recipe (`justfile` at the repo root).

Builds, installers, and the GitHub Actions release workflow:
`docs/astryx-build-release.md`.

## Deploying and versioning

- **A push to `main` deploys the web app** (Cloudflare, no review step).
  Pushing is publishing.
- Version numbers live in two places, kept in step:
  `APP_CONFIG.APP_VERSION` in `src/js/config.js` and `[package] version` in
  `src-tauri/Cargo.toml`. `tauri.conf.json` has no version field.
  - x — complete redesigns or schema breaks requiring migration
  - y — new features
  - z — bug fixes, UI tweaks, tutorial updates
- The bundle identifier `tools.astryx.astryx` is **permanent**. It keys OS app
  identity and the app-data directory; changing it orphans users' data.
- `APP_CONFIG.DB_VERSION` is the IndexedDB version (web). The SQLite schema
  version is separate (`PRAGMA user_version`, see below).

## Architecture

- **No framework, no modules.** Every file defines globals as object
  literals (`const DataManager = { ... }`), loaded by ~80 `<script>` tags in
  `src/index.html`. **Load order matters**; a new file goes in the right
  place in that list.
- **Views** use `<template id="...-view-template">` blocks in `index.html`,
  cloned in by `UIManager`. Avoid reusing a template's IDs in two DOM
  locations at once (this has caused bugs).
- **Manager / View split.** `*-manager.js` / `*-calculations.js` hold data and
  logic; `*-view.js` holds DOM. Keep the DOM out of managers and
  calculations.
- **Dual backend, chosen at runtime by `window.__TAURI__`:**
  - `db-manager.js` → `DBManagerWeb` (IndexedDB) or `DBManagerTauri`
    (`invoke()` → `src-tauri/src/commands/*.rs`, one command file per store).
  - `backup-manager.js` → `BackupManagerWeb` or `BackupManagerTauri`.
  - Both sides of each pair expose the same interface. A data change touches
    both, plus the Rust command and the schema.
- **Targets are held in memory** (all ~14.6K). That's deliberate; keep it.
- **Help pages** in `src/help/` are built MkDocs output. Their source is the
  `astryx-data` repo; don't hand-edit the HTML here.
- **Tutorials:** definitions in `src/js/tutorials/`, registered in
  `tutorial-registry.js`, run by `tutorial-engine.js`, progress through
  `tutorial-manager.js`. Steps target elements by CSS selector. When a
  control's ID changes, grep the tutorials for the old one.
  `TutorialEngine.validate(id)` warns about missing targets.

| Concern | Where |
|---|---|
| All configurable values | `APP_CONFIG` in `config.js` |
| User preferences | `SettingsManager` |
| Debug logging | `Log.debug(...)`, gated by `APP_CONFIG.FEATURES.DEBUG_LOGGING` |
| User-facing messages | `UIManager.showToast(msg, 'success' \| 'error')` |
| HTML escaping | `HtmlUtils.escapeHtml` (text content only, does not escape quotes) |
| Time / JD / timezone / DST | `TimeUtils`, `SettingsManager.isDSTActive` |
| Tooltips | `data-tooltip-key` → `TOOLTIPS` in `tooltips.js` |
| Dropdowns | custom `.astryx-dropdown` (`-dropdown` / `-trigger` / `-label` / `-menu` IDs), not native `<select>` |
| Themes | CSS custom properties, one file per theme in `src/css/themes/` (Dark, Light, Matrix, Night, Flat) |
| PDF output | pdfmake (`src/include/`) |

### Astronomy calculations

- **All astronomy math lives in `astro-*.js`** (`astro-core`, `astro-sun`,
  `astro-moon`, `astro-target`). Views and feature modules call these and
  never re-implement them. Copy-pasted, diverging twilight code once caused
  six of ten wrong-result bugs found in a review.
- When several views show the same quantity for the same night (moon
  illumination, moon separation, dusk/dawn), they must sample it the same way.
- Accuracy limits are documented at the top of each `astro-*.js` file.
  There's no precession; J2000 coordinates are used as-is.
- RA is in **hours** throughout; Dec, altitude, and azimuth are in degrees.
  Longitude is negative west. Timezone is the standard-time offset in hours,
  with DST applied separately.
- **Regression checks:** the in-app *Algorithm Validation* view
  (`algorithm-validation-view.js`) holds golden values checked against
  external references. Run it after any change to the astronomy code.
  Displayed values that move after a deliberate fix are expected; update the
  snapshots on purpose, not to make a failure go away.
- Changes to twilight or visibility math can invalidate cached Best Month
  values. Check whether a recalculation is needed.
- `regression-tests/` re-runs the session-log analysis pipeline against a log
  corpus (Python + mini-racer; see `regression-tests/venv-howto.md`).

### Canvas charts

- Store hit regions during draw (`this._chartHitRegions = [{x, y, w, h, targetId}]`).
- Keep click handlers in `this._canvasClickHandler` and remove them before
  re-adding, so listeners don't stack.
- Scale mouse to canvas coordinates using `getBoundingClientRect()` and
  `canvas.width / rect.width`.
- Read theme colors via `getComputedStyle(document.documentElement).getPropertyValue('--var')`.
  Per-theme variables go in every theme file.

### Rust / SQLite (`src-tauri/`)

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
- JS calls go through `DBManagerTauri`, which surfaces failures as a toast.
  Never let a failed `invoke()` pass silently.

## Coding rules

- **No magic numbers.** Configurable values go in `APP_CONFIG`.
- **Use `??`, not `||`,** for defaults. `||` swallows a legitimate `0`.
  Don't add fallbacks for config values that are always set.
- **CSS-first.** No inline styles unless computed at runtime. CSS goes in the
  module's file in `src/css/`, and colors come from theme variables.
- **Zero hardcoding of data.** Catalogs, object types, and constellations are
  always derived from the data.
- **Derived over configured.** Prefer values the app can work out over new
  user settings.
- **No dead code.** Delete unused functions and fields rather than leaving or
  annotating them.
- **Naming:** HTML IDs and CSS classes kebab-case; JS camelCase; objects
  PascalCase; DB stores camelCase. Sequence planner: JS `seqPlan`, CSS
  `seq-plan`, files `seqplan-*`. ASIAir: `asiair-*` files, `Asiair*` objects.
- Match the surrounding code's comment density and idiom. Reference issue
  numbers in comments where the code exists because of one (`// Issue #207`).

## Working with Stan

- **Discuss before coding.** Propose the approach and get a go-ahead before
  editing.
- **One change at a time.** Small, separately testable steps. Stan tests
  each one in the app before moving on.
- **Read the current file before changing it.** Never work from memory of
  an earlier version.
- Be concise and direct. "proceed" = continue, "tested" / "done" = confirmed
  working.
- **"Commit" means commit and push**, and a push to `main` deploys.
- Past mistakes to avoid: wrong container IDs that made UI silently
  disappear; capping a slider with its `max` attribute (rescales the track;
  clamp in the handler instead); reporting an audit before reading every
  file in scope.

## Docs

- `docs/astryx-build-release.md` — building, installers, releases, CI.
- `docs/Log-Enhancement/session-analysis-design.md` — design of the session
  log analysis (`session-*.js`, parsers, report).
- `docs/Log-Project-Memory/` — log format survey, threshold calibration data,
  and corpus index behind the analysis detectors.
