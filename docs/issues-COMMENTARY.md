# Commentary — Sequencing, Decisions, and What's Next

**Companion to:** the 43 issue files in `issues/` (full-app audit batch + calculation-review batch, merged).
Issues are referred to by title throughout; filenames match titles closely.

---

## 1. How the two batches fit together

The first batch (full-app audit) is organized around the multi-platform roadmap: correctness foundation → desktop packaging → mobile web → Android decision → polish. The second batch (calculation review) slots almost entirely into that first "correctness" phase — it *is* the "accurate results" half of your north star, and several of its items are straight-up wrong-answer bugs that should jump the queue.

The updated phase picture:

- **Phase 0 — finish what's in flight:** GitHub issues 163 (four native selects remain on disk: `search-window`, `max-results`, `location-bortle`, `program-status`), 168 Part 2, 169.
- **Phase 1a — accuracy bugs (new, highest priority):** the twilight/moon fixes below. These produce wrong numbers in the exact quantities users plan around, right now, in season.
- **Phase 1b — error-handling foundation:** Tauri IPC error handling, Rust mutex no-panic, astro golden tests, escapeHtml pair, debug logging, defensive canvas guards.
- **Phase 2 — desktop packaging:** window defaults, packaging metadata, inline-onclick removal, CSP, GitHub Actions installers.
- **Phase 3 — mobile web:** responsive foundation → touch → tables → charts → PWA.
- **Phase 4 — Android spike** (go/no-go decision, PWA-first recommendation stands).
- **Phase 5 — polish:** window.* globals, dropdown keyboard/ARIA, plus the calc-cleanup stragglers.

## 2. The twilight bug chain — do these in exactly this order

Three independent bugs corrupt summer twilight, and they interact. The order below makes each step's test expectations unambiguous:

1. **"Fix timezone double-offset in twilight calculations"** — fixes three copies of the same construction bug. After this: To Do, Best Months, Yearly get correct summer dawn; Daily Visibility does NOT yet (its dawn is dominated by the next bug); Seqplan does NOT yet (next-next bug).
2. **"Dawn search starts at dusk+6h"** — after this, Daily Visibility's June dawn is correct.
3. **"Sequence Planner passes nonexistent location.isDST"** — after this, Seqplan matches To Do exactly for the same date/location. That cross-view equality is the cheap, powerful final test.
4. **"Consolidate three twilight implementations"** — only after 1–3; restructuring must be value-neutral, which is only checkable once values are right.
5. **"Yearly Observability performance"** — only after 4; the caching insertion point is the consolidated implementation.

**Verify-before-fixing option:** all three bugs have observable signatures today, checkable in five minutes against timeanddate.com set to your location: (a) around the June solstice, To Do/Yearly dawn pinned at exactly 4:00:00 AM for weeks; (b) Daily Visibility dawn = dusk + exactly 6:00:00 in the same period; (c) Seqplan session end ~5:00 AM in June, ~75 min after true astronomical dawn. Confirming even one of these before touching code is worth doing — it validates the analysis and gives you a before/after.

Similarly for the moon pair ("Moon rise/set: apply topocentric parallax" + "Fix dimensional error in horizon dip formula" — same session, joint validation): tonight's moonrise in Astryx should read ~5–8 minutes *earlier* than Stellarium/USNO. Check first, then fix, then check again.

## 3. Recommended overall order (first ~15 work sessions)

1. Twilight chain steps 1–3 (three sessions, one bug each)
2. Moon parallax + horizon dip (one session)
3. **"Golden-value regression test page for astronomy calculations"** — deliberately *after* the wrong-answer fixes so you snapshot correct values, and *before* everything else so all later astro work is guarded. This is the single highest-leverage issue in the set: six of the ten wrong-result bugs found trace to twilight logic being copy-pasted and diverging — golden tests catch the next divergence automatically.
4. "Tauri IPC error handling" then "Rust commands: return errors instead of panicking" (the silent-data-loss pair)
5. Twilight consolidation, then yearly perf
6. Quick wins in any order: direct-transit computation, delete dead `findSunAltitudeJD`, delete dead `angularSeparation`, dead-code-astro, FOV dead `checkTargetFit`, defensive canvas guards, sun-RA normalization
7. Then Phase 2 packaging (window defaults + metadata are two short sessions; the CI workflow is the long pole)

Mobile (Phase 3) is big and independent — start it whenever you want a change of pace; nothing in Phases 1–2 blocks it except that CSP should precede the PWA service worker.

## 4. Issues that need YOUR decision before Sonnet can execute

These are flagged inside the files, but collected here so you can pre-decide:

- **"solarBrightnessAdvanced: inverted signs"** — flip the signs (a) or strip the unused humidity/aerosol/seasonal machinery (b). My recommendation: (b).
- **"Production packaging metadata"** — the bundle identifier is permanent once shipped (it keys users' data directories). Decide it deliberately.
- **"Optimizer combinations ignore window overlap"** — pick the scoring model after the investigation step (overlap penalty vs usable-hours).
- **"Delete dead checkTargetFit"** — delete (recommended) vs fix-and-adopt.
- **"Investigate: split visibility windows"** — accept-as-limitation vs display flag vs interval model, after the investigation quantifies it.
- **"Spike: Tauri v2 Android build feasibility"** — a "no" is a legitimate outcome; the PWA may be enough.
- **"Yearly Observability performance"** — the optional 10-minute peak-scan coarsening changes displayed altitudes slightly; opt-in only.

## 5. Watch-outs for the Sonnet sessions

- **File contention:** `astro-sun.js`, `astro-target.js`, `astro-moon.js`, `daily-visibility-calculations.js`, and `yearly-observability-calculations.js` are each touched by several issues. Every issue says "fresh upload first" — enforce it ruthlessly; these files will drift fast across sessions.
- **Cross-references by title:** issue bodies reference each other by quoted title (per your preference). When you rename an issue in GitHub, the references in other bodies won't auto-update — keep titles close to the file's H1.
- **Batch-loading:** the `gh` script pattern from earlier still works — first line (`# Title`) becomes the issue title, rest is the body. The `**Size** / **Labels**` line stays in the body as plain text unless you later want frontmatter for real GitHub labels.
- **Expect value changes and communicate them to yourself:** the twilight and moon fixes will visibly change displayed times, and the brightness fix shifts quality scores. Each issue notes this, but when you see numbers move mid-testing, that's the fix, not a regression — the golden tests are what tell the difference from then on.

## 6. Files reviewed vs. not yet reviewed

**Reviewed in depth:** astro-core, astro-sun, astro-moon, astro-target, daily-visibility-calculations, yearly-observability-calculations, optimizer-calculations, fov-calculations, seqplan-timeline, seqplan-view (partially), app.js, db-manager trio, the Rust command layer, migrations, tauri.conf, capabilities, all CSS (structurally).

**Worth a future review pass, in rough priority order:**

1. **`seqplan-calculations.js` + `seqplan-optimizer.js`** — scheduling and transition-optimization math; only the twilight call site has been examined. Same class of risk as the files that yielded the calc batch.
2. **`best-months.js`** — consumes the (buggy, soon fixed) twilight functions across 365 days; verify its own math and whether its cached results need invalidation after the twilight fixes land (**likely yes — best-months data computed before the fixes embeds wrong summer windows; a recalc prompt or cache version bump may be needed. Worth checking before the twilight fixes ship.**)
3. **`asiair-log-parser.js` + `phd2-log-parser.js`** — parsing untrusted input files; robustness and the escaping story (ties to the escape-user-strings issue).
4. **`utils-time.js`** — DST determination (`isDSTActive`) underpins everything; unreviewed.
5. **`imaging-log-manager.js` + `data-manager.js`** — CRUD integrity, cascade deletes, the Tauri/web parity of both.
6. **`ui-manager.js`** (2,521 lines) — the largest file; likely harbors more of the window.*-global and duplication patterns.
7. **`best-months` → target DB writes** — bulk-write paths and their failure modes under the new IPC error handling.

## 7. One structural suggestion

As the twilight saga shows, the calculation layer is where correctness lives and where copy-paste hurts most. After the consolidation issues land, consider a lightweight rule for future work: **no astronomy math outside `astro-*.js`** — views and feature modules call in, never re-implement. It costs nothing to adopt as a review habit and would have prevented six of the ten bugs in this review. The accuracy-documentation issue ("Document intrinsic accuracy limits") is a good place to write that rule down.
