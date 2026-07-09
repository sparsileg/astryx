# Design, Planning, and Implementation Practices for Tauri + Svelte + Rust Desktop Applications

**Version:** 1.0  
**Date:** May 2026  
**Context:** Derived from production experience building a high-performance desktop astrophotography application. Applicable to any complex desktop application ported from or replacing an HTML/CSS/JS codebase.

---

## 1. Architecture Principles

### 1.1 Single Source of Truth for Application State

All mutable application state lives in one place: a central `AppContext` struct in the Rust backend, protected by a `Mutex`. The frontend is a view — it never owns authoritative state.

```rust
pub struct AppContext {
    pub active_directory:     Option<String>,
    pub file_list:            Vec<String>,
    pub current_frame_index:  usize,
    pub analysis_results:     HashMap<String, AnalysisResult>,
    pub analysis_thresholds:  AnalysisThresholds,
    // ... all other session state
}
```

The frontend fetches state via Tauri `invoke()` calls and renders it. It never caches state locally beyond what is needed for a single render cycle. When the backend state changes, the frontend re-fetches via a dedicated session command.

**Why this matters during a port:** HTML/JS apps tend to scatter state across global variables, localStorage, and DOM element values. Centralizing it in AppContext forces you to make the state model explicit and eliminates an entire class of synchronization bugs.

### 1.2 Plugin Registry Architecture

Instead of a monolithic command handler, implement a plugin registry where every operation is a named plugin implementing a common trait:

```rust
pub trait PhotonPlugin: Send + Sync {
    fn name(&self)        -> &str;
    fn version(&self)     -> &str;
    fn description(&self) -> &str;
    fn parameters(&self)  -> Vec<ParamSpec>;
    fn execute(&self, ctx: &mut AppContext, args: &ArgMap) -> Result<PluginOutput, PluginError>;
}
```

Plugins are registered at startup and dispatched by name. This makes the system extensible, testable in isolation, and self-documenting (the registry can enumerate all plugins with their parameters). It also maps naturally to a scripting layer — a script is just a sequence of plugin dispatches.

### 1.3 Separation of Display State from Data State

Raw data (pixel buffers, analysis results, keywords) lives in AppContext and is never modified after initial load. Display representations (JPEG previews, stretched images, cached thumbnails) are derived on demand and cached separately. This separation means:

- Raw data is always available for reprocessing
- Display cache can be invalidated and rebuilt without touching source data
- Multiple display representations of the same data can coexist

---

## 2. Rust Backend Patterns

### 2.1 AppState Wrapper

Wrap all shared state in a single struct held behind an `Arc`:

```rust
pub struct AppState {
    pub registry: Arc<PluginRegistry>,
    pub context:  Mutex<AppContext>,
    pub db:       Mutex<rusqlite::Connection>,
    pub settings: Mutex<AppSettings>,
}
```

Pass it to every Tauri command via `State<'_, Arc<AppState>>`. Use `Arc::clone` to hand it into `spawn_blocking` for long-running operations.

### 2.2 Long-Running Operations in spawn_blocking

Tauri commands run on an async runtime. Any blocking operation (image processing, file I/O, analysis) must be wrapped in `tokio::task::spawn_blocking` to avoid blocking the runtime:

```rust
#[tauri::command]
async fn run_analysis(state: State<'_, Arc<AppState>>) -> Result<..., String> {
    let state = Arc::clone(&state);
    tokio::task::spawn_blocking(move || {
        let mut ctx = state.context.lock().expect("context lock poisoned");
        // ... blocking work
    }).await.map_err(|e| format!("Task panicked: {:?}", e))?
}
```

### 2.3 Parallelism with Rayon

For CPU-bound work that can be parallelized (per-frame analysis, image processing), use Rayon's parallel iterators. The key constraint: data must be snapshotted out of the Mutex before parallelism begins, then results written back after.

```rust
// Snapshot data out of the lock
let snapshots: Vec<FrameSnapshot> = {
    let ctx = state.context.lock().unwrap();
    ctx.file_list.iter().filter_map(|path| {
        // extract what's needed without holding the lock
    }).collect()
};

// Process in parallel — no lock held
let results: Vec<Result<AnalysisResult, _>> = snapshots
    .par_iter()
    .map(|snap| compute_metrics(snap))
    .collect();

// Write results back under the lock
let mut ctx = state.context.lock().unwrap();
for result in results { ctx.analysis_results.insert(...); }
```

### 2.4 Error Handling

Define a `PluginError` type with a code and message. Never use `unwrap()` in plugin code — always propagate errors. Tauri commands return `Result<T, String>` where the String is the user-facing error message.

```rust
pub struct PluginError {
    pub code:    String,
    pub message: String,
}

impl PluginError {
    pub fn new(code: &str, message: &str) -> Self { ... }
    pub fn invalid_arg(name: &str, reason: &str) -> Self { ... }
}
```

### 2.5 Tracing Instead of println

Use the `tracing` crate with `tracing-appender` for structured logging to a rolling file. Never use `println!` in production code. Log at `info` for normal operations, `warn` for recoverable problems, `error` for failures.

---

## 3. SQLite Persistence Pattern

### 3.1 Schema Versioning with PRAGMA user_version

Maintain a schema version in the database and run migrations on startup:

```rust
pub const CURRENT_SCHEMA_VERSION: u32 = 2;

pub fn run_migrations(conn: &Connection) -> Result<()> {
    let version = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let migrations: Vec<fn(&Connection) -> Result<()>> = vec![
        migrate_v1,   // 0 → 1: create all tables
        migrate_v2,   // 1 → 2: rename snr column
    ];
    for (i, migration) in migrations.iter().enumerate() {
        let target = (i + 1) as u32;
        if version < target {
            migration(conn)?;
            conn.execute_batch(&format!("PRAGMA user_version = {}", target))?;
        }
    }
    Ok(())
}
```

Never edit existing migration functions. Always add a new one. This rule is non-negotiable — it's the only way to safely upgrade existing installations.

### 3.2 Schema in a Separate Module

Put all `CREATE TABLE` statements in `schema.rs` as constants. The migration runner and the seed function both import from there. This means a new install and a migrated install end up with identical schemas.

### 3.3 Settings Pattern

Maintain an `AppSettings` struct that is:

- Populated from defaults at startup
- Overlaid with values from the `preferences` table
- Written back via `save_preference(key, value, db)` on change
- Never derived from the frontend — the frontend reads settings, it doesn't own them

```rust
pub fn load_from_db(&mut self, db: &Connection) {
    // Read all key/value pairs; apply known keys, silently ignore unknown ones
    // (forward-compatible: newer DB schemas won't break older code)
}
```

### 3.4 Seed Defaults Idempotently

Seed all required initial rows using `INSERT OR IGNORE`. This means `seed_defaults()` can be called on every startup without side effects on an existing database.

### 3.5 WAL Mode

Always enable WAL mode for SQLite in desktop applications:

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;
```

WAL gives significantly better read concurrency and is safe for single-process desktop use.

---

## 4. Frontend Architecture Patterns

### 4.1 Svelte Stores for Shared State

Use Svelte stores (writable, derived) for any state shared across components. Each store should own one logical domain: session state, analysis results, threshold profiles, UI state. Never share state via prop drilling more than two levels deep — put it in a store.

```typescript
// stores/session.ts
export const session = writable<SessionState>({ ... });

// Hydrate from backend
export async function refreshSession() {
    const s = await invoke<SessionState>('get_session');
    session.set(s);
}
```

### 4.2 View Registry Pattern

For applications with a viewer region that can show different content (image viewer, analysis graph, histogram, help), use a view registry rather than boolean flags:

```typescript
// ui.ts
export const VIEWS = {
    IMAGE_VIEWER:    'image_viewer',
    ANALYSIS_GRAPH:  'analysis_graph',
    HISTOGRAM:       'histogram',
} as const;

export function showView(view: string | null) {
    currentView.set(view);
}
```

Every component that occupies the viewer region checks `$currentView === VIEWS.MY_VIEW`. Close buttons always call `showView(null)`. This pattern scales cleanly as new views are added and prevents the boolean-flag proliferation that plagues HTML/JS codebases.

### 4.3 Component Responsibility Boundaries

- **Page component** (`+page.svelte`): lifecycle management (onMount hydration), top-level layout, global keyboard shortcuts
- **Panel components**: own their data fetching and local UI state
- **Viewer components**: render data passed from parent; emit events upward
- **Store modules**: own backend communication; components call store methods, not `invoke()` directly

### 4.4 CSS Architecture

All CSS lives in external `.css` files, never inline. One CSS file per major module. Use CSS custom properties (variables) for all colors and spacing that participate in theming:

```css
/* theme-matrix.css */
:root {
    --bg-color:      #000;
    --text-color:    #00ff41;
    --primary-color: #00cc33;
    --border-color:  #1a4a1a;
    --card-bg:       #0a1a0a;
}
```

Components reference only the variables — never hardcoded colors. This makes theme switching a single CSS file swap with no JavaScript involved.

### 4.5 Notifications Pattern

Use a consistent three-state notification system:

- `notifications.running(message)` — for operations in progress (triggers a pulse/spinner animation)
- `notifications.success(message)` — on completion
- `notifications.error(message)` — on failure

Any action initiated outside the console (menu items, panel buttons, keyboard shortcuts) that produces output should write to both notifications and a console pipe.

---

## 5. Tauri-Specific Patterns

### 5.1 Command Granularity

Err on the side of more, smaller commands rather than fewer, larger ones. A command that returns the session state should return only session state. A command that runs analysis should return only the analysis result. Don't bundle unrelated data into a single command response — it creates unnecessary coupling and makes caching harder.

### 5.2 invoke() Error Handling

Always handle errors from `invoke()` at the call site. Never let a failed invoke silently do nothing:

```typescript
try {
    const result = await invoke<AnalysisResult>('run_analysis');
    // handle result
} catch (e) {
    notifications.error(`Analysis failed: ${e}`);
}
```

### 5.3 File Paths

Standardize on forward slashes throughout the application. The Rust backend translates to OS-native separators before any filesystem call. This eliminates an entire class of path bugs when targeting both Windows and macOS/Linux.

### 5.4 Hot Reload Awareness

Tauri's dev mode hot-reloads Svelte/TS changes instantly but requires a full recompile for Rust changes. CSS changes in `static/` require a manual browser refresh. Understanding this during development saves significant time. Put CSS in the right place from the start.

---

## 6. The Scripting Layer: Console, Macros, and Menu-Driven Commands

One of the highest-value architectural decisions in a complex desktop application is building a lightweight scripting layer on top of the plugin registry. The investment pays dividends throughout the entire lifetime of the application.  

### 6.1 The Core Idea

If every operation in the application is a named plugin, then a script is simply a sequence of plugin dispatches with a thin interpreter in front of them. The same operations that run when a user clicks a menu item can also be invoked by typing a command in a console, recorded in a saved macro, or triggered by a Quick Launch button — all using the same execution path. 

This unification has a profound effect on development velocity and testability. New features added as plugins are immediately available in the console, in macros, and as menu items with no additional wiring. Ensuring that the execution path is the same for all possible instantiation methods is critical to minimizing complexity and increasing maintainability.

### 6.2 The Three Surfaces

A well-designed scripting layer exposes the same underlying operations through three surfaces:

**The Interactive Console** is a command-line interface embedded in the application. The user types individual commands, sees output immediately, and can iterate quickly without writing a full script. It is invaluable for debugging, for exploring unfamiliar data, and for power users who prefer keyboard-driven workflows. Implement command history (up/down arrows), a Trace/No Trace toggle for verbosity control, and clear, structured output per command.

**Macros (saved scripts)** are sequences of commands saved to files and run as a unit. A macro can accept parameters declared at the top of the script file, which are resolved at run time — either from the command line when calling the macro, or via a parameter prompt dialog when launched from the UI. Macros enable automation of repetitive workflows: batch processing, quality analysis pipelines, format conversion sequences. They can call other macros, making them composable.

**Menu and Button Integration** means that any macro or command can be surfaced in the application's UI — as a menu item, a toolbar button, or a Quick Launch panel button — without writing any special UI code. The button stores a command string (e.g. `RunMacro ProcessLights`) and the application executes it through the same interpreter. Parameters are resolved at run time. This means power users can extend the application's UI to match their workflows by writing macros, not by modifying code.

### 6.3 Script Interpreter Design

The interpreter does not need to be sophisticated. A line-by-line executor with variables, conditionals, and loops is sufficient for most automation needs. Key design decisions:

**Variables** are stored in a simple `HashMap<String, String>` on the AppContext. Commands can read and write variables. Certain commands auto-populate variables by convention (e.g. `GetKeyword name=FILTER` stores the result in `$FILTER`).

**Command parsing** tokenizes each line into a command name and a set of named arguments (`key=value`). String values with spaces are quoted. The tokenizer handles this before dispatch. Keep the grammar simple and consistent — complexity in the grammar creates friction for users writing macros.

**Trace mode** controls output verbosity. In Trace mode, every command echo, variable assignment, and plugin output is printed. In No Trace mode, only plugin output appears. This makes it practical to run long macros without drowning in noise, while still giving full visibility when debugging.

**Error handling** should halt execution on any error by default, with an optional continue-on-error mode. Every error should identify the line number and command that failed. Silent failures are unacceptable in a scripting context — the user needs to know exactly what went wrong.

**Assert** is a first-class command that halts execution with an error if a condition is false, and is silent on success. It enables self-validating scripts and serves as the foundation for integration testing.

### 6.4 The @param System

Macros that accept parameters declare them at the top of the file using a structured comment syntax:

```
@param INPUT_DIR  "Source directory containing light frames"  required
@param OUTPUT_DIR "Destination for processed files"           required
@param FILTER     "Filter name for keyword tagging"           optional  default="Lum"
```

This declaration serves three purposes simultaneously: it documents the macro's interface, it drives the parameter prompt dialog in the UI, and it validates that required parameters were supplied before execution begins. When a macro is launched from a button or menu item, the application reads the declarations and presents a form — no additional UI code required.

### 6.5 Macro Library Integration

Store macros as plain text files (`.phs` or similar extension) in a designated directory. The application scans this directory at startup and presents the macros in a library panel with name, description (parsed from file comments), and run count. Users can create, edit, rename, and delete macros from within the application.

Plain text files are the right choice for macros because they are human-readable, diffable, version-controllable, and shareable. They can be edited in any text editor. A dedicated in-app editor with syntax highlighting is a quality-of-life addition but not a prerequisite.

### 6.6 Quick Launch Panel

The Quick Launch panel is a configurable grid of buttons, each storing a command string. Buttons are assigned by the user — they can invoke any macro, any built-in command, or any sequence of commands. The assignment is persisted in SQLite.

One critical rule: buttons store only the command string, never embedded parameter values. Parameters are always resolved at run time. This means the same button works correctly even as the user's working directory or session state changes.

### 6.7 Why This Architecture Pays Off

The scripting layer provides compounding returns:

- **During development**, the console eliminates the need for a separate REPL or debug build. You can test any backend operation by typing it.
- **For testing**, macros with `Assert` statements serve as integration tests that run in the live application against real data.
- **For users**, macros enable automation of complex multi-step workflows without requiring programming knowledge.
- **For extensibility**, new operations added as plugins are immediately scriptable with no additional work.
- **For support**, when a user reports a problem, you can ask them to run a diagnostic macro and send you the output — a complete, structured log of exactly what the application did.

The investment in the scripting layer is essentially the investment in a clean plugin registry (which you want anyway) plus a tokenizer and a line-by-line executor. The returns on that investment extend throughout the entire life of the application.

---

## 7. Porting from HTML/CSS/JS

### 7.1 Port the Data Model First

Before touching the UI, model all application data in Rust. What are the entities? What relationships exist between them? What operations does the application support? This exercise usually reveals hidden state in the JS codebase that was never made explicit.

### 7.2 Identify State That Belongs in the Backend

In HTML/JS apps, state often lives in:

- Global variables
- DOM element values (input fields, checkboxes)
- localStorage
- Module-level variables

Each of these needs a home in the new architecture. Most belong in AppContext or AppSettings. Some (transient UI state like "is this panel open?") legitimately belong in Svelte stores. Almost nothing should go in localStorage during development — use SQLite from the start.

### 7.3 Port Operations as Plugins

For each operation in the JS app (load files, process image, export result), create a corresponding plugin in the Rust registry. This gives you a clean API surface that both the UI and any scripting layer can use.

### 7.4 Keep the JS App Running During the Port

Don't take the JS app offline while porting. Port one feature area at a time, validate it against the original, then move on. This keeps you honest about functional equivalence and gives you a reference for edge cases.

### 7.5 Validate Numerical Results Against the Original

If the JS app computes metrics or analysis results, validate the Rust implementation produces equivalent output before considering the port complete. Floating-point behavior differences between JS and Rust can produce subtle discrepancies. Document any intentional deviations.

---

## 8. Development Process Practices

### 8.1 Spec First

Maintain an authoritative requirements document. Before implementing any feature, the spec should describe what it does, what its inputs and outputs are, and how it behaves at the edges. Code that deviates from the spec is a bug, not a feature.

### 8.2 Commit at Clean Rollback Points

Commit when the application compiles cleanly, passes its tests, and the feature being implemented is in a coherent (if incomplete) state. Never commit broken code. Commits should be small enough that reverting one doesn't undo more than a few hours of work.

### 8.3 No Dead Code

Unused fields, functions, and modules should be removed immediately, not annotated with `#[allow(dead_code)]`. If a field will be used in a future phase, add it when that phase begins. Dead code annotations accumulate into maintenance debt and obscure the actual state of the codebase.

### 8.4 Constants in One Place

All hard-coded values (defaults, bounds, thresholds) live in a single `defaults.rs` (Rust) and `constants.ts` (TypeScript). No magic numbers anywhere else. The two files should mirror each other for any value that crosses the Tauri boundary.

### 8.5 Document Reference Tables

Maintain a reference document that lists every command, every setting, every keyword, and their current implementation status. This document is updated as part of the same commit that implements the feature — never after. It serves as both documentation and a progress tracker.

### 8.6 One Change at a Time

When making changes across multiple files, make and verify one file at a time. This makes it easier to isolate the source of compiler errors and prevents the compounding confusion of multiple partial changes.

---

## 9. Performance Patterns

### 9.1 Normalize Pixel Data Once

When loading image files, normalize pixel data to a canonical representation (e.g. f32 normalized 0.0–1.0) once at load time. All downstream processing works on this canonical form. This avoids repeated conversion and makes algorithm code format-agnostic.

### 9.2 Zero-Copy Where Possible

For large data structures (pixel buffers), prefer zero-copy operations. The `bytemuck` crate enables safe reinterpretation of byte slices as typed slices with no copying:

```rust
let pixels: &[u16] = bytemuck::cast_slice(&raw_bytes);
```

This can reduce image load times by an order of magnitude for large files.

### 9.3 Separate Display Cache from Source Data

Never modify source pixel buffers for display purposes. Keep a separate display cache of JPEG-encoded frames at one or two resolutions. This allows instant display switching (zoom levels, blink preview) without reprocessing source data.

### 9.4 Background Cache Building

For operations that build caches (thumbnail generation, blink pre-caching), spawn a background task and provide progress feedback to the UI. Never block the UI thread waiting for cache completion.

---

## 10. Testing Strategy

### 10.1 Unit Tests in Rust Modules

Each analysis module should have `#[cfg(test)]` unit tests that verify correct behavior on synthetic data. Tests should cover:

- Normal inputs (expected output within tolerance)
- Edge cases (empty input, single element, all identical values)
- Boundary conditions (saturation threshold, zero standard deviation)

### 10.2 Synthetic Data for Algorithm Tests

Generate synthetic test data programmatically rather than depending on test image files. For image analysis algorithms, construct pixel arrays with known statistical properties and verify the algorithm produces the expected result.

### 10.3 Integration Tests via the Scripting Layer

The scripting layer provides a convenient integration test harness. A macro that loads known test data, runs operations, and uses `Assert` to verify expected values serves as a regression test that can be run from within the live application against real data. This is especially valuable for numerical algorithms where correctness against a reference implementation needs to be verified.

---

*This document should be updated as new patterns are established or existing ones are refined.*
