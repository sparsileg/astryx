# Astryx Development Session Onboarding

**For:** Claude (next session)
**Purpose:** Get up to speed on Stan's project and working style immediately
**Project:** Astryx — a web-based astrophotography planning application
**Current version:** v1.3.0

---

## Who is Stan?

Stan is the sole developer of Astryx. He is experienced, direct, and efficient. During active development he communicates tersely:

- "proceed" = continue with next change
- "tested" = works as expected
- "done" / "working" = confirmed good
- Detailed only when describing problems

He does not need pleasantries, preamble, or lengthy explanations. Match his energy — be concise and direct.

---

## What is Astryx?

Astryx (astryx.tools, formerly Specula) is a sophisticated browser-based astrophotography planning tool. It helps astrophotographers:

- Search and filter a database of 14,000+ deep-sky objects
- Plan imaging sessions (visibility, moon conditions, sequencing)
- Analyze ASIAir and PHD2 imaging/guiding logs
- Track imaging projects and programs
- Manage equipment (telescopes, sensors, filters) and observer locations

**Tech stack:** Vanilla JavaScript, CSS custom properties, IndexedDB — no frameworks. Modular object literal pattern throughout. Hosted on Cloudflare Pages from a GitHub repo (`astryx`), source in `src/` subdirectory. Help system is MkDocs-based in a separate repo (`astryx-data`).

**Tauri desktop version:** In active development. `src-tauri/` lives at the repo root alongside `src/`. Dev workflow: run `npx serve src --listen 1420` in one terminal, `cargo tauri dev` in another. Tauri v2 (tauri-cli 2.10.1). Currently uses IndexedDB (same as web) — SQLite migration is planned but not yet started. Stan already develops Photyx (another Tauri app) so the toolchain is fully set up on his machine for both Windows and Linux.

---

## Development Methodology — Read This Carefully

Stan has a well-established working methodology. Violating it causes friction.

### The Rhythm
**Plan → Discuss → Approve → One Change → Test → Confirm → Next**

### BEFORE/AFTER Blocks
All code changes are delivered as explicit BEFORE/AFTER blocks with full code — no ellipsis, no placeholders, no `// ... existing code ...`. Every block must be complete and match disk exactly.

```
BEFORE:
[exact existing code]

AFTER:
[complete modified code]
```

### Hard Rules
- **One file change at a time.** Never batch.
- **Discuss before coding.** Propose the approach, get explicit go-ahead.
- **Never assume file state.** Ask Stan to upload the file or use the view tool before making changes to a file not recently seen.
- **BEFORE blocks must match disk exactly.** Stan has corrected mismatches multiple times — this is a hard requirement.
- **No magic numbers.** All configurable values live in `APP_CONFIG` in `config.js`.
- **No hardcoded fallbacks when config values are always set** — unless guarding against `undefined` (use `??`, never `||` for zero values).
- **CSS-first.** No inline styles unless dynamically calculated at runtime.
- **No ellipsis placeholders** in code blocks — ever.
- **No "repeat this for lines X and Y"** — provide full BEFORE/AFTER for each occurrence.

### File Upload Protocol
Stan uploads the current file before requesting changes to it. Always view the uploaded file before generating changes — never rely on earlier context.

---

## Key Architecture Details

| Concern | Pattern |
|---|---|
| All config values | `APP_CONFIG` in `config.js` |
| User preferences | `SettingsManager` |
| Persistence | `DBManager` → IndexedDB (SQLite migration planned) |
| DB version | `DB_VERSION` in `config.js` (not db-manager.js) |
| Tooltips | `data-tooltip-key` attributes → `tooltips.js` TOOLTIPS object |
| Themes | CSS custom properties; 5 themes: Dark, Light, Matrix, Night, Flat |
| Help pages | MkDocs, flat URL structure, open in new tab |
| PDF output | pdfmake |
| Tutorials | JS definition files in `js/tutorials/`; engine and registry at `js/tutorial-engine.js`, `js/tutorial-registry.js`; progress via `js/tutorial-manager.js` |
| Backup | `BackupManagerWeb` (web) / `BackupManagerTauri` stub (desktop); `BackupManager` shim selects at runtime via `window.__TAURI__` |

**Naming conventions:**
- HTML IDs: kebab-case
- CSS classes: kebab-case
- JS functions/variables: camelCase
- JS objects/classes: PascalCase
- DB stores: camelCase
- ASIAir files: `asiair-` prefix, objects `AsiairLogParser`, `AsiairLogView`
- Sequence planner: JS `seqPlan`, CSS `seq-plan`, files `seqplan`

**Canvas rendering patterns:**
- Store hit regions during draw as `this._chartHitRegions = []` — array of `{ x, y, w, h, targetId }` — for click handling
- Canvas click handlers stored as `this._canvasClickHandler` — remove before re-adding to avoid stacking listeners
- Scale mouse coords to canvas coords via `canvas.getBoundingClientRect()` + `canvas.width / rect.width` ratio
- Dark backing rectangles (`rgba(0,0,0,0.5)`) behind text labels ensure readability over complex canvas backgrounds
- Theme-aware canvas colors read via `getComputedStyle(document.documentElement).getPropertyValue('--var-name')`
- Per-theme CSS custom properties go in each theme CSS file (`dark.css`, `light.css`, `matrix.css`, `night.css`, `flat.css`)

**DBManager abstractions added (pre-migration cleanup):**
- `DBManager.close()` — closes connection and nulls `db` reference
- `DBManager.deleteDatabase()` — closes then deletes; used only from error page
- `DataManager.bulkUpdateTargets(targets)` — wraps `DBManager.putBulk` for target batch writes
- `TutorialManager.saveProgress()` / `loadProgress()` / `findInProgressTutorial()` — all tutorial DB access goes through here
- `BackupManagerWeb` / `BackupManagerTauri` / `BackupManager` shim — dual-backend backup pattern

---

## What Was Done in the Most Recent Session

### Issues 147, 148 — To Do List and Viewfinder
- To Do List chart bars now show altitude graphs (0–90° fixed scale, theme-aware color)
- Clicking a chart bar selects the target and opens detail view
- Viewfinder now always updates to current target on navigation

### Issues 149–154 — Pre-migration DB abstraction cleanup
Six issues completed to prepare for the Tauri/SQLite migration — see commit for full detail. Key outcomes: DBManager lifecycle properly abstracted, tutorial persistence moved to TutorialManager, best months batch writes go through DataManager, BackupManager split into web/Tauri implementations.

### Issue 150 — Tutorial system improvements
- `tutorial-engine.js` and `tutorial-registry.js` moved up from `js/tutorials/` to `js/`
- `js/tutorial-manager.js` created for all tutorial DB access
- **Start Tutorial** always visible in system menu (launches getting-started)
- **Resume Tutorial** appears dynamically when a tutorial is in progress; updates immediately on exit/completion without reload

### Tauri desktop version — first working build
- `src-tauri/` scaffolded at repo root using `cargo tauri init` (Tauri v2)
- Dev workflow: `npx serve src --listen 1420` + `cargo tauri dev`
- App loads, navigation works, IndexedDB persists, backup/restore confirmed working
- Next steps: SQLite migration, BackupManagerTauri implementation, native file dialogs

---

## Open Items / What's Next

- **Tutorial `nextTutorial` chain** needs to be coded across all tutorial files. Order: getting-started → settings → admin-tools → backup-restore → sidebar → target-search → target-filtering → todo → yearly-observability → daily-visibility → viewfinder → target-optimizer → sequence-planner → imaging-projects → imaging-programs-reports → utilities. Also fix `target-filtering` bug: `nextTutorial: 'tutorial-todo'` → `'todo'`.
- **Tauri SQLite migration** — next major workstream; issues 149–154 laid the groundwork
- **BackupManagerTauri** — stub exists, needs native file dialog implementation once SQLite is in place
- **Changelog page** — needs content written and committed to `astryx-data`
- **Several minor Astryx feature issues** — Stan has ~15 pending; deferred until after Tauri foundation is solid

---

## Things Claude Got Wrong (Learn From These)

- Used `// ... existing code ...` placeholder in a BEFORE/AFTER block — caused a `ReferenceError`. Explicitly banned.
- Used `||` instead of `??` for a zero config value — caused magic number fallback to fire.
- Provided a BEFORE block that didn't match disk — Stan had to correct it.
- `renderTargetAllocation` looked for wrong container ID (`seq-plan-target-allocation` instead of `seq-plan-target-list`) — sliders disappeared entirely.
- Tried to cap a slider via `max` attribute — visually rescaled the track. Correct approach: clamp the value in the change handler.
- Provided full file content instead of telling Stan to rename a file — wasted time and caused a diff problem.
- Did not read all uploaded files before completing an audit — missed 4 of 11 files. Always confirm all files are read before reporting findings.

---

## Principles Stan Cares About Most

1. **Learned over manual** — automatic/derived values always preferred over user-facing configuration.
2. **No magic numbers** — everything in `APP_CONFIG`.
3. **No stale file assumptions** — view the file before touching it.
4. **Discuss before coding** — always.
5. **One change at a time** — always.
6. **No ellipsis in code blocks** — ever.
7. **CSS-first** — no inline styles.
8. **Zero hardcoding** — catalogs, types, constellations always dynamic.
9. **Clean, simple solutions** — park complexity that isn't worth it.
10. **Full BEFORE/AFTER blocks** — no shortcuts, no placeholders.
