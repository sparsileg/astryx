# Astryx Development Plan — Multi-Platform Roadmap

**Prepared:** July 2026 **Scope:** Full code audit of `src/` and
`src-tauri/`, plus a phased plan to reach: Linux (deb/rpm), Windows,
macOS installable builds; a mobile-friendly web version; and
eventually Android.  **Constraints honored:** framework-free, single
codebase, no rewrite, incremental improvement of the existing
architecture.  **North star:** error-free UX with accurate results
that help users plan imaging sessions.

---

## Part 1 — Audit Findings

### What's in good shape (don't touch)

- **Dual-backend architecture.** The `DBManager` runtime switcher, the
  1:1 store-to-Rust-command mapping, and the `BackupManager` split are
  clean, consistent, and exactly right for a single-codebase
  multi-platform app. `lib.rs` even already carries
  `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, so the Android
  path is pre-wired.
- **SQLite migration system.** `PRAGMA user_version`-based,
  append-only migration list with clear rules in comments. Solid;
  follow it as-is for future schema changes.
- **Manager/View separation** is respected almost everywhere. The
  object-literal module pattern is consistent.
- **Config discipline.** `APP_CONFIG` is genuinely used; magic numbers
  are rare.
- **Targets-in-memory design.** Loading all ~14K targets into memory
  is fine on desktop and will be fine on mobile — do not change this.

### Deficiencies found, grouped by severity

#### A. Correctness / error-handling (highest priority given your stated goal)

1. **`db-manager-tauri.js` has zero error handling.** Every `invoke()`
   failure becomes an unhandled promise rejection: the user gets
   silence, data appears to save but didn't, no toast, nothing in the
   UI. This is the single largest "error-free UX" gap. (Issue 01)
2. **Rust commands panic on a poisoned mutex.** All 13 command files
   use `state.db.lock().expect("db lock poisoned")`. One panic while
   holding the lock poisons it, and then *every subsequent command*
   panics — the app is bricked until restart with no user-visible
   explanation. Should return an error string to JS instead. (Issue
   02)
3. **`SeqPlanTimeline.init()` leaves a stale `ctx`.** We fixed the
   router-level root cause (missing `currentView` assignments), but
   the defensive gap remains: `init()` nulls `this.canvas` on early
   return but leaves `this.ctx` truthy, so `render()`'s guard passes
   and `clear()` crashes. Any future caller ordering mistake
   re-triggers it. (Issue 03)
4. **No regression tests for the astronomy math.** `astro-core.js`,
   `astro-sun.js`, `astro-moon.js`, `astro-target.js`,
   `yearly-observability-calculations.js` are the heart of "accurate
   results" — and any refactor (like the recent rise/set
   consolidation) can silently shift values. A framework-free
   golden-value test page catches this permanently. (Issue 04)
5. **`console.log` noise (56 calls) including full-object dumps**
   (`populateTargetDetails - full data:`) ships to production. Minor,
   but it obscures real errors in the console. (Issue 05)

#### B. Security / robustness

6. **XSS surface: 141 `innerHTML` sites, 40 interpolating template
   literals.** `escapeHtml` exists but is **defined four separate
   times** (asiair-log-view, imaging-log-view, phd2-log-view,
   utilities-view) and is *not* used in several views that interpolate
   user-controlled strings (location names, project names, session
   notes, imported log fields) — e.g. `todo-view.js` interpolates
   `target.object` into HTML attributes raw. For a local single-user
   app the risk is mostly self-XSS via imported files (ASIAir/PHD2
   logs, backup restores), but it's cheap to close. (Issues 06, 07)
7. **CSP is disabled** (`"csp": null` in `tauri.conf.json`) and the
   web build has no CSP meta. The 26 inline `onclick=` handlers are
   the main blocker to enabling one. (Issues 08, 09)

#### C. Desktop packaging gaps (blockers for shipping installers)

8. **`tauri.conf.json` window config is your dev monitor:** `x:1900,
   y:100, width:1800, height:1800`. On a laptop the window opens
   off-screen and/or larger than the display. Needs centered sane
   defaults + `tauri-plugin-window-state` to remember
   size/position. (Issue 10)
9. **Packaging metadata is scaffold defaults:** `description = "A
   Tauri App"`, empty license, no repository, version `0.1.0`
   disconnected from `APP_CONFIG.APP_VERSION` (1.3.0), identifier
   `com.astryx.dev`. deb/rpm/msi/dmg all surface these to
   users. (Issue 11)
10. **No CI builds.** Linux bundling works locally; Windows toolchain
    proven via Photyx; macOS requires a GitHub Actions runner. One
    workflow can produce all three. (Issue 12)

#### D. Mobile readiness (essentially unstarted — this is expected, not a criticism)

11. **One `@media` query in the entire codebase** (base.css, two grid
    collapses). The sidebar is fixed 280px. The main content assumes
    desktop width.
12. **Hover-dependent UX:** 47 `:hover` rules and a tooltip system (73
    `data-tooltip-key` sites) triggered exclusively by `mouseover` —
    invisible on touch devices.
13. **Three touch handlers in the whole app** (seqplan sliders only).
14. **Mixed chart rendering tech** — each needs its own mobile
    treatment:
    - Daily Visibility timeline: **DOM divs** → mostly CSS-adaptable
      (easiest)
    - Yearly Observability: **SVG** → `viewBox` scaling (easy)
    - Sequence Planner timeline: **canvas** → too dense to shrink;
      needs a horizontal-scroll container at natural width
    - FOV/Viewfinder: **canvas**, currently has *no* resize handling
      at all → fit-to-width + touch drag
    - To Do charts: **canvas** bars inside cards → mostly fine, verify
15. **No PWA manifest or service worker** — adding these makes the
    mobile web version installable with an icon and offline shell for
    near-zero cost.

#### E. Code quality (low urgency, worth scheduling)

16. **Cross-module state via `window.*` globals:**
    `window.skyglowData` (written from three different files),
    `window.lastYearlyObservabilityGraphData`, `window.currentView`,
    `window._openMeteoCache`. Works, but it's the app's most fragile
    coupling. (Issue 18)
17. **`const window = targetWindows.get(...)` in `seqplan-timeline.js`
    `drawEventMarkers()`** shadows the global `window` object inside
    that function — currently harmless, definitely a future
    foot-gun. (folded into Issue 03)
18. **Accessibility floor:** exactly one ARIA attribute in the app;
    custom `astryx-dropdown`s have no keyboard navigation. Since the
    dropdown is one shared component, keyboard+ARIA support is a
    single contained fix. (Issue 19)
19. **Four native `<select>`s remain on disk right now:**
    `#search-window`, `#max-results`, `#location-bortle`,
    `#program-status` — this is the true remaining scope of Issue 163
    (fresher than the handoff doc's list).

---

## Part 2 — The Phased Plan

Phases are ordered so each one de-risks the next. Within a phase,
issues are independent unless noted. Every issue is written to be
executed cold by Sonnet 5 under your methodology (one change at a
time, BEFORE/AFTER, test each step).

### Phase 0 — Finish current stabilization (already in flight)

Complete existing GitHub issues 163 (four native selects remain), 168
Part 2 (modal dropdown clipping), 169 (`tauri-plugin-shell` links —
note: the plugin is already registered in `lib.rs` and
`shell:allow-open` is already in capabilities, so what remains is the
JS-side switch from `window.open()`).

**Gate:** Tauri/Linux build has no visibly broken controls.

### Phase 1 — Correctness & error-handling foundation

Issues 01–07. This phase directly serves "error-free UX with accurate
results" and must precede packaging — you don't want installers in
users' hands while IPC failures are silent.

Priority order within phase: 01 (IPC errors) → 02 (Rust panics) → 04
(astro golden tests) → 03, 06, 07, 05 in any order.

**Gate:** killing the SQLite file mid-session produces a visible error
toast, not silence; astro test page is green.

### Phase 2 — Desktop packaging & distribution

Issues 08–12. Ship real installers: deb/rpm (Linux), NSIS/MSI
(Windows), dmg (macOS via GitHub Actions). CSP enablement (08, 09)
sits here because installers are what strangers run.

**Gate:** a fresh VM per OS installs the bundle, opens centered,
creates its data dir, and survives a restart with data intact.

### Phase 3 — Responsive / mobile web foundation

Issues 13–17. Strategy: **CSS-responsive adaptation of the existing
DOM as the default**, with per-view exceptions only for the canvas
charts (detailed in Issue 16). Ends with a PWA manifest + service
worker (17), which makes the mobile web version installable on
Android/iOS home screens.

Order matters here: 13 (breakpoint foundation + sidebar drawer) must
land first; 14 (touch/tooltips), 15 (tables→cards), 16 (charts) build
on it; 17 (PWA) last.

**Gate:** the app is usable one-handed on a 390×844 viewport for the
core loop: pick target → check tonight's visibility → check yearly →
pin → plan.

### Phase 4 — Android decision + build

Issue 20 (spike). **Recommendation: PWA-first, native-later.**

Reasoning against jumping straight to a Tauri Android build:

- Phase 3 gives you an installable Android experience (PWA) at
  near-zero marginal cost, on the identical codebase — maximum
  maintainability.
- A native Tauri Android build adds: Android Studio/SDK/NDK toolchain,
  signing keys, Play Store or sideload distribution, a second WebView
  engine matrix (Android System WebView versions), and mobile-specific
  Tauri plugins — a permanent maintenance surface.
- What native would buy you over PWA: SQLite instead of IndexedDB on
  the phone, tighter filesystem access, and store presence. For a
  planning app whose data is small and already has backup/restore,
  none of these are compelling *yet*.

So Phase 4 is a time-boxed spike (`cargo tauri android init`, get a
debug APK running, document friction) producing a go/no-go decision —
not a commitment. The `mobile_entry_point` attribute already in
`lib.rs` means the spike is cheap.

### Phase 5 — Accessibility & polish

Issues 18, 19. Consolidate `window.*` globals; give `astryx-dropdown`
keyboard navigation and ARIA. Neither blocks anything above; both
raise the quality floor.

### Deliberately NOT proposed

- No framework, no bundler, no TypeScript migration, no index.html
  split, no rearchitecting the 69-script load order. All violate the
  no-rewrite constraint for marginal benefit.
- No change to the targets-in-memory model.
- No change to the migration system or the Rust command-per-store
  layout.

---

## Part 3 — Issue Index

| #   | File     | Title                                                              | Size | Labels              |
| --- | -------- | ------------------------------------------------------------------ | ---- | ------------------- |
| 01  | issue-01 | Centralized error handling for Tauri IPC calls                     | M    | tauri, bug, ux      |
| 02  | issue-02 | Rust commands: return errors instead of panicking on mutex lock    | S    | tauri, rust         |
| 03  | issue-03 | Defensive canvas guards in SeqPlanTimeline (+ `window` shadow fix) | S    | bug                 |
| 04  | issue-04 | Golden-value regression test page for astronomy calculations       | L    | quality, testing    |
| 05  | issue-05 | Gate console logging behind APP_CONFIG.DEBUG                       | S    | tech-debt           |
| 06  | issue-06 | Centralize escapeHtml into a shared utility                        | S    | tech-debt, security |
| 07  | issue-07 | Escape user-provided strings in innerHTML templates                | M    | security            |
| 08  | issue-08 | Replace inline onclick handlers with addEventListener              | S    | tech-debt, security |
| 09  | issue-09 | Enable Content Security Policy (Tauri + web)                       | M    | security            |
| 10  | issue-10 | Sane window defaults + remember window state                       | S    | tauri, packaging    |
| 11  | issue-11 | Production packaging metadata (Cargo.toml, tauri.conf.json)        | S    | packaging           |
| 12  | issue-12 | GitHub Actions: build installers for Linux, Windows, macOS         | M    | packaging, ci       |
| 13  | issue-13 | Responsive foundation: breakpoints + mobile sidebar drawer         | L    | mobile              |
| 14  | issue-14 | Touch-friendly tooltips and tap targets                            | M    | mobile              |
| 15  | issue-15 | Responsive tables: card layout on narrow screens                   | M    | mobile              |
| 16  | issue-16 | Chart views on small screens (per-view strategy)                   | L    | mobile              |
| 17  | issue-17 | PWA: manifest + service worker for installable mobile web          | M    | mobile              |
| 18  | issue-18 | Consolidate window.* globals into managers                         | M    | tech-debt           |
| 19  | issue-19 | Keyboard navigation + ARIA for astryx-dropdown                     | M    | a11y                |
| 20  | issue-20 | Spike: Tauri v2 Android build feasibility                          | M    | android, spike      |

Sizing: **S** = one short session, a handful of changes · **M** = one
to two sessions · **L** = multi-session, phased internally.

Suggested execution order: 163-remainder → 01 → 02 → 04 → 03 → 06 → 07
→ 05 → 10 → 11 → 08 → 09 → 12 → 13 → 14 → 15 → 16 → 17 → 20 (decision)
→ 18 → 19.
