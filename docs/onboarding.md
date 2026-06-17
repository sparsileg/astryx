# Astryx Development Session Onboarding

**For:** Claude (next session)
**Purpose:** Get up to speed on Stan's project and working style immediately
**Project:** Astryx — a web-based astrophotography planning application
**Current version:** Approaching v1.2.0 / public release

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
| Themes | CSS custom properties; 4 themes: Dark, Light, Matrix, Night |
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

---

## What Was Done in the Most Recent Session

This was a long, productive session. Here is a summary of completed work:

### Tutorial Chain (not yet coded)
Proposed tutorial order established:
1. getting-started → 2. settings → 3. admin-tools → 4. backup-restore → 5. sidebar → 6. target-search → 7. target-filtering → 8. todo → 9. yearly-observability → 10. daily-visibility → 11. viewfinder → 12. target-optimizer → 13. sequence-planner → 14. imaging-projects → 15. imaging-programs-reports → 16. utilities

Note: `target-filtering` had a bug — `nextTutorial: 'tutorial-todo'` should be `'todo'`. This was identified but not yet coded.

### Changelog (Issues resolved)
- **System menu:** Added "Change Log" menu item (📝 icon) between Help and About in `index.html` and `ui-manager.js`. Opens `help/changelog.html` in new tab via `openHelpPage()`.

### Issue 130 — Wind forecast too high
- Fixed Open-Meteo URL: added `&wind_speed_unit=mph` to `APP_CONFIG.OPEN_METEO` in `config.js`.
- Added mid-scale dashed reference line to wind SVG strip (black outline + yellow dashed on top, matching min-altitude line style).
- Removed polyline border from wind area chart (was inflating apparent wind speed visually).
- Added tooltips to all three weather strips (Clouds, Wind, Dew) via `data-tooltip-key` in `daily-visibility-view.js` and new keys `dv_clouds`, `dv_wind`, `dv_dew` in `tooltips.js`.

### Issue 129 — Resize/sidebar collapse problems
**Daily Visibility wind band:** Added `ResizeObserver` with 200ms debounce on `#timeline-container`. Stores wind values in `_lastWindValues` on the view. Rebuilds wind SVG on resize without re-fetching. Added `_resizeObserver` and `_lastWindValues` properties; cleanup in `destroy()`.

**Sequence Planner chart:** Replaced MutationObserver + 300ms timeout (too short for 1.0s sidebar CSS transition) with `ResizeObserver` on canvas parent element, same pattern as Yearly Observability. Added `_resizeObserver` property; cleanup in `destroy()`.

### Issue 133 — Sequence Planner canvas background wrong on theme switch
Added theme change handler in `ui-manager.js` to re-render the sequence planner timeline when a theme CSS loads, alongside the existing Yearly Observability re-render.

### Sequence Planner canvas sizing
- `containerWidth` subtraction changed from `32` to `0` — canvas now fills the full card body width.
- `TIMELINE_MARGIN` changed from `60` to `25` by Stan directly.

### Issues 134/135 — Sequence Planner optimizer improvements

**Issue 134 — Optimizer enhancements (seqplan-optimizer.js):**

1. `tryReorder` now initializes `bestScore` to `currentScore` (not null) so flip-boundary-optimized allocations for the current order are always applied.

2. Three-level priority added to `tryReorder`:
   - Primary: maximize total subs
   - Tiebreaker 1: minimize meridian flips (`flipCount` added to `scorePerm` return)
   - Tiebreaker 2: minimize conflicts

3. `optimizeFlipBoundaries` now includes a **simultaneous rebalancing sweep**: after finding the sub-maximizing allocation, moves all target allocations toward equal split in 1% steps simultaneously. Allows up to `targets - 2` sub loss for better balance (0 loss for 2 targets, 1 for 3, 2 for 4). Runs even when no flips are present.

4. New helper method `calcSubVariance(subCounts)` added after `optimizeFlipBoundaries`.

5. `TRANSITION_OPTIMIZATION_THRESHOLD` changed to `0.00` in `config.js` (was 0.05). The `||` fallback in optimizer changed to `??` to prevent zero being treated as falsy.

6. Date changes reset `allocatedPercent` to equal split before optimization in `generatePlan` — prevents manual slider adjustments from polluting subsequent date changes.

7. `_lastTargetMaxPercent` stored in `generatePlan` after `calculatedResults` populated — never recalculated during slider interactions.

**Issue 135 — Last slider cap (seqplan-view.js):**
Last target slider is capped at its natural end time. `handleSliderChange` clamps `newPercent` to `_lastTargetMaxPercent` (stored once at plan generation) rather than rejecting it, so the slider snaps to max when dragged past it.

**Sequence Optimization checkbox moved:**
Moved from Session Settings overhead row 4 to a footer row at the bottom of the Target Allocation card (`seq-plan-allocation-footer`) in `index.html`. Footer also shows total image count (`seq-plan-total-images`), updated in both `renderTargetAllocation` and `recalculateAndUpdate` in `seqplan-view.js`.

**Tutorial and help file updated:**
- `tutorial-sequence-planner.js`: version bumped to 2, Optimization step updated to modal with three-level priority description, Sliders step updated to mention last slider cap and total image count.
- `sequence-planner.md`: Target Allocation section updated, Sequence Optimization section updated with three-level priority, Pass 2 updated with rebalancing sweep description, Acceptance Threshold updated to reflect 0% threshold.

---

## Open Items / What's Next

- **Tutorial `nextTutorial` chain** needs to be coded across all tutorial files per the order listed above. Also fix `target-filtering` bug: `nextTutorial: 'tutorial-todo'` → `'todo'`.
- **Version bump** — Stan deferred this; session closed before bumping. Likely v1.2.0 given the volume of work.
- **Changelog page** — needs content written and committed to `astryx-data`.
- Stan mentioned a bug he spotted but didn't log — it may come up at session start.

---

## Things Claude Got Wrong This Session (Learn From These)

- Used `// ... existing code ...` placeholder in a BEFORE/AFTER block — caused a `ReferenceError: finalPerm is not defined`. Stan explicitly banned this pattern.
- Used `||` instead of `??` for a zero config value — caused a magic number fallback to fire.
- Provided a BEFORE block that didn't match disk, requiring Stan to correct it.
- Suggested `openHelpPage` icon using wrong emoji initially.
- `renderTargetAllocation` was looking for `seq-plan-target-allocation` but the correct container ID is `seq-plan-target-list` — caused sliders to disappear entirely.
- Tried to set slider `max` attribute to cap the last slider — this visually rescaled the track. Correct approach was to clamp `newPercent` in the change handler instead.

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
