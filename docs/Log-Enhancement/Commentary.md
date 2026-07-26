Design document and phased plan attached. Both cite the survey and calibration docs rather than restating numbers.

**Design doc** — eight principles, module split, full data model, the fifteen invariants, fifteen detector specs with validation status, the nine-section report layout, recommendations engine, and an explicit limits section. Two things I'd draw your attention to:

The **stated limits** section (§9) is the part I'd defend hardest. The 2025-12-20 validation showed log-based detection finding 17 of your 26 rejections, and the satellite trails being completely invisible. A report that implied its reject list was complete would have had you keeping nine bad subs. Reporting what it can't see is what makes the rest trustworthy.

**Detector D2 records a rejected approach** — guide-star mass as a gradual transparency proxy — with the evidence for why it fails. Worth keeping in the document so nobody re-proposes it in six months.

**Implementation plan** — seven phases, ~55 issues. Phase 1 is ten small correctness fixes that ship value alone and don't touch architecture. Phase 2 is full extraction, and issue 2.1 (the multi-run model) is the largest single change in the plan; it reshapes the parser's return contract and should be tested against 2026-06-05 before anything else in that phase proceeds.

**Three decisions block work:**

- **Q1** — does the combined report replace both existing reports, or sit alongside them as a summary?
- **Q3** — multi-target nights: one report per night with per-target sections, or one report per target? This gates issue 2.1, so it needs deciding before that work starts.
- **Q4** — should recommendations compare against your own trailing median, or ship fixed defaults? Storing per-session metrics means a schema change and a `DB_VERSION` bump. Your guiding improved from 1.20" to 0.97" across the corpus, so fixed thresholds will drift.

My recommendations are in §10 of the design doc, but these are yours to call.

If you want to start while thinking about those, **Phase 1 issues 1.3 → 1.4 → 1.5 → 1.6** are four small single-file changes that between them kill the NaN cascade and every wrong error-code description — the most visible defects — and none of them depend on Q1, Q3 or Q4.
