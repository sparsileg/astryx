# Astryx Development Session Onboarding

**For:** Claude (next session)
**Purpose:** Get up to speed on Stan's project and working style immediately
**Project:** Astryx — a web-based astrophotography planning application
**Current version:** v1.2.0

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
| Persistence | `DBManager` → IndexedDB |
| DB version | `DB_VERSION` in `config.js` (not db-manager.js) |
| Tooltips | `data-tooltip-key` attributes → `tooltips.js` TOOLTIPS object |
| Themes | CSS custom properties; 5 themes: Dark, Light, Matrix, Night, Flat |
| Help pages | MkDocs, flat URL structure, open in new tab |
| PDF output | pdfmake |
| Tutorials | JS definition files, `TutorialEngine.start(id)` |

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

---

## What Was Done in the Most Recent Session

### Issue 147 — To Do List chart enhancements (todo-view.js, config.js, theme CSS files)

1. **Canvas click to select target:** Clicking a bar in any chart mode (Rise Time, Type, Best Month) now opens the object detail modal, same as clicking a link in list mode. Implemented via hit regions stored during draw, single canvas click listener per render.

2. **Altitude graph inside bars:** Each observable target's bar shows an altitude curve across the dusk→dawn window. Scale is fixed 0°–90° so graphs are comparable across targets. Drawn as filled polygon with fully-opaque outline stroke on top. Dark backing rectangle behind target label text for contrast.

3. **`selectTarget(targetId)` helper** extracted from `attachEventListeners()` — shared by both DOM list clicks and canvas bar clicks. Avoids duplication.

4. **`drawAltitudeGraph()` method** — self-contained, parameterized via `APP_CONFIG`:
   - `TODO_ALTITUDE_SAMPLE_POINTS: 24` — samples across dusk-dawn window
   - `TODO_ALTITUDE_GRAPH_STYLE: 'fill'` — `'fill'` or `'line'`
   - `TODO_ALTITUDE_GRAPH_ALPHA: 0.65` — fill/line opacity
   - `TODO_ALTITUDE_GRAPH_LINE_WIDTH: 4.0` — outline stroke width
   - Color via `--todo-altitude-graph-color` CSS variable per theme (white tones for dark themes, dark for light theme, green for Matrix, red for Night, warm white for Flat)

---

## Open Items / What's Next

- **Tutorial `nextTutorial` chain** needs to be coded across all tutorial files. Order: getting-started → settings → admin-tools → backup-restore → sidebar → target-search → target-filtering → todo → yearly-observability → daily-visibility → viewfinder → target-optimizer → sequence-planner → imaging-projects → imaging-programs-reports → utilities. Also fix `target-filtering` bug: `nextTutorial: 'tutorial-todo'` → `'todo'`.
- **Changelog page** — needs content written and committed to `astryx-data`.

---

## Things Claude Got Wrong (Learn From These)

- Used `// ... existing code ...` placeholder in a BEFORE/AFTER block — caused a `ReferenceError`. Explicitly banned.
- Used `||` instead of `??` for a zero config value — caused magic number fallback to fire.
- Provided a BEFORE block that didn't match disk — Stan had to correct it.
- `renderTargetAllocation` looked for wrong container ID (`seq-plan-target-allocation` instead of `seq-plan-target-list`) — sliders disappeared entirely.
- Tried to cap a slider via `max` attribute — visually rescaled the track. Correct approach: clamp the value in the change handler.

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
