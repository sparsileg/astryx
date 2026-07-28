#!/usr/bin/env python3
"""
run_regression.py
Astryx combined log-report regression harness (Issue #243/#244 corpus re-run).

Runs the REAL, unmodified JS pipeline —
    AsiairLogParser.parse -> Phd2LogParser.parse -> SessionFusion.fuseNight
    -> SessionDetectors.runAll -> SessionRecommendations.build
against the corpus, via an embedded V8 engine (mini-racer). No Node.js
subprocess involved — Python drives V8 directly.

Usage:
    python3 run_regression.py \
        --src-dir /path/to/astryx/src/js \
        --corpus-dir /path/to/corpus/logs \
        --manifest corpus_manifest.json

Requires: pip install mini-racer   (see venv-howto.md — activate the venv first)
"""

import argparse
import json
import math
import sys
from pathlib import Path

from py_mini_racer import MiniRacer


# ---------------------------------------------------------------------------
# JS source files loaded into the V8 context, in dependency order.
# session-invariants.js must load before session-detectors.js (which calls
# SessionInvariants.createFinding unconditionally, no typeof guard).
# config.js must load first — it defines APP_CONFIG and Log, both referenced
# elsewhere.
#
# NOT included: astro-core.js / astro-target.js. session-recommendations.js
# guards every reference to findTargetTransit/dateToJD/jdToDate with a
# typeof check, so without them Meridian Flip Verification just returns an
# empty array rather than throwing — a real, disclosed gap in this harness's
# coverage, not a crash. Add both files to this list (before
# session-recommendations.js) to close that gap; nothing else needs to
# change.
# ---------------------------------------------------------------------------
JS_FILES_IN_ORDER = [
    "config.js",
    "asiair-log-parser.js",
    "phd2-log-parser.js",
    "session-fusion.js",
    "session-invariants.js",
    "session-detectors.js",
    "session-recommendations.js",
]

# Minimal stub environment. Verified by grep against the uploaded copies of
# all seven files above — DataManager, document, and window are NOT
# referenced by any of them and are deliberately left undefined rather than
# stubbed. If a future edit to any of the seven adds a reference to one of
# those, this harness will throw a clear ReferenceError pointing at exactly
# what's missing, rather than silently returning wrong data.
STUB_ENV_JS = r"""
var console = { log: function(){}, warn: function(){}, error: function(){} };

var SettingsManager = {
    // Only getters are exercised meaningfully — setLearnedSubGapS/
    // setLearnedDitherDurationS are settings-persistence side effects
    // this harness deliberately doesn't test (see AsiairLogParser.
    // updateLearnedValues, which this harness never calls at all).
    getLearnedSubGapS: function() { return APP_CONFIG.DEFAULT_SUB_GAP_S; },
    getLearnedDitherDurationS: function() { return APP_CONFIG.DEFAULT_DITHER_DURATION_S; },
    setLearnedSubGapS: function() {},
    setLearnedDitherDurationS: function() {},
    getSetting: function(key, defaultValue) { return defaultValue; },
};
"""

# Runs inside V8. Takes the two already-parsed log objects (stashed on
# __ctx by run_night below) and drives the real pipeline exactly like
# utilities-view.js's _tryRenderCombinedReport does — minus the
# DataManager/ImagingLogManager equipment lookup, since there's no browser
# DB here. Scans for NaN BEFORE JSON.stringify, because JSON.stringify
# silently turns NaN into the literal `null` — indistinguishable from a
# legitimately-absent value on the Python side if left until after.
RUNNER_JS = r"""
(function() {
    function findNaN(obj, path, out) {
        if (obj === null || obj === undefined) return;
        if (typeof obj === 'number') {
            if (isNaN(obj)) out.push(path);
            return;
        }
        if (Array.isArray(obj)) {
            for (var i = 0; i < obj.length; i++) findNaN(obj[i], path + '[' + i + ']', out);
            return;
        }
        if (typeof obj === 'object') {
            for (var k in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) {
                    findNaN(obj[k], path ? path + '.' + k : k, out);
                }
            }
        }
    }

    var fused = SessionFusion.fuseNight(__ctx.asiairParsed, __ctx.phd2Parsed);
    var context = { asiairParsed: __ctx.asiairParsed, phd2Parsed: __ctx.phd2Parsed };

    var detectorError = null;
    try {
        SessionDetectors.runAll(fused, context);
    } catch (e) {
        detectorError = String((e && e.stack) || e);
    }

    var recs = [];
    var recError = null;
    try {
        recs = SessionRecommendations.build(fused, context);
    } catch (e) {
        recError = String((e && e.stack) || e);
    }

    var nanPaths = [];
    findNaN(fused, 'fused', nanPaths);

    var phd2DropsTotal = null;
    if (__ctx.phd2Parsed && __ctx.phd2Parsed.sessions) {
        phd2DropsTotal = __ctx.phd2Parsed.sessions.reduce(function(sum, s) {
            return sum + (s.dropCount || 0);
        }, 0);
    }

    return JSON.stringify({
        fused: fused,
        recommendations: recs,
        detectorError: detectorError,
        recError: recError,
        nanPaths: nanPaths,
        phd2DropsTotal: phd2DropsTotal,
    });
})()
"""


def build_context(src_dir: Path) -> MiniRacer:
    """One V8 context, real unmodified Astryx source loaded in order."""
    ctx = MiniRacer()
    ctx.eval(STUB_ENV_JS)
    for filename in JS_FILES_IN_ORDER:
        path = src_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Expected source file not found: {path}")
        ctx.eval(path.read_text(encoding="utf-8"))
    return ctx


def run_night(ctx: MiniRacer, asiair_text: str, phd2_text: str | None) -> dict:
    """Run one night through the real pipeline. Returns the parsed JSON result."""
    asiair_fn = ctx.eval("AsiairLogParser.parse.bind(AsiairLogParser)")
    asiair_parsed_ref = asiair_fn(asiair_text)

    phd2_parsed_ref = None
    if phd2_text is not None:
        phd2_fn = ctx.eval("Phd2LogParser.parse.bind(Phd2LogParser)")
        phd2_parsed_ref = phd2_fn(phd2_text, asiair_parsed_ref)

    ctx.eval("var __ctx = {};")
    stash = ctx.eval("(function(a, p) { __ctx.asiairParsed = a; __ctx.phd2Parsed = p; })")
    stash(asiair_parsed_ref, phd2_parsed_ref)

    result_json = ctx.eval(RUNNER_JS)
    return json.loads(result_json)


def evaluate_night(result: dict, expected: dict) -> list[str]:
    """Compare one night's actual output against its manifest entry.
    Returns a list of human-readable problems; empty list = pass."""
    problems = []

    if result.get("detectorError"):
        problems.append(f"SessionDetectors.runAll threw: {result['detectorError']}")
    if result.get("recError"):
        problems.append(f"SessionRecommendations.build threw: {result['recError']}")
    if result.get("nanPaths"):
        problems.append(f"NaN found at: {', '.join(result['nanPaths'])}")

    fused = result.get("fused") or {}
    metrics = fused.get("metrics") or {}

    invariants = fused.get("invariants") or []
    failed = {i["id"] for i in invariants if not i.get("passed")}
    expected_failed = set(expected.get("expected_failed_invariants", []))
    unexpected = failed - expected_failed
    missing = expected_failed - failed
    if unexpected:
        problems.append(f"Unexpected invariant failures: {sorted(unexpected)}")
    if missing:
        problems.append(f"Expected invariant failures that didn't occur: {sorted(missing)}")

    if "subs_light_only" in expected:
        actual = metrics.get("totalSubs")
        if actual != expected["subs_light_only"]:
            problems.append(f"totalSubs {actual} vs expected {expected['subs_light_only']}")

    if "settled_guide_rms" in expected:
        actual = metrics.get("guideRmsSettled")
        exp = expected["settled_guide_rms"]
        tol = expected.get("rms_tolerance", 0.02)
        if actual is None:
            problems.append(f"guideRmsSettled is null, expected ~{exp}")
        elif abs(actual - exp) > tol:
            problems.append(f"guideRmsSettled {actual:.3f} vs expected {exp} (tol {tol})")

    if "drops" in expected:
        actual = result.get("phd2DropsTotal")
        if actual != expected["drops"]:
            problems.append(f"PHD2 drop total {actual} vs expected {expected['drops']}")

    return problems


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--src-dir", required=True, type=Path,
                    help="Path to the folder containing the 7 source .js files")
    p.add_argument("--corpus-dir", required=True, type=Path,
                    help="Path to the folder containing raw ASIAir/PHD2 log files")
    p.add_argument("--manifest", default="corpus_manifest.json", type=Path,
                    help="JSON manifest mapping night -> filenames + expected values")
    p.add_argument("--dump-night", default=None,
                    help="Print raw AsiairLogParser.parse() run/block structure for one manifest key, then exit")
    args = p.parse_args()

    if args.dump_night:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        entry = manifest[args.dump_night]
        ctx = build_context(args.src_dir)
        text = (args.corpus_dir / entry["asiair_file"]).read_text(encoding="utf-8", errors="replace")
        parse_fn = ctx.eval("AsiairLogParser.parse.bind(AsiairLogParser)")
        dump_fn = ctx.eval("""(function(parsed) {
            return JSON.stringify(parsed.runs.map(function(r) {
                return {
                    target: r.target, kind: r.kind,
                    blocks: r.blocks.map(function(b) { return b.subs.length; }),
                };
            }));
        })""")
        print(dump_fn(parse_fn(text)))

        gaps_fn = ctx.eval("""(function(parsed) {
            var lightRuns = parsed.runs.filter(function(r) { return r.kind === 'light'; });
            var out = [];
            for (var i = 0; i < lightRuns.length; i++) {
                var r = lightRuns[i];
                out.push({ target: r.target, startedAt: r.startedAt, endedAt: r.endedAt });
            }
            var gaps = [];
            for (var i = 1; i < out.length; i++) {
                var prevEnd = new Date(out[i-1].endedAt).getTime();
                var thisStart = new Date(out[i].startedAt).getTime();
                gaps.push({ betweenRuns: out[i-1].target + ' -> ' + out[i].target, gapS: (thisStart - prevEnd) / 1000 });
            }
            return JSON.stringify({ runs: out, gaps: gaps });
        })""")
        print(gaps_fn(parse_fn(text)))

        if entry.get("phd2_file"):
            phd2_text = (args.corpus_dir / entry["phd2_file"]).read_text(encoding="utf-8", errors="replace")
            phd2_fn = ctx.eval("Phd2LogParser.parse.bind(Phd2LogParser)")
            phd2_parsed = phd2_fn(phd2_text, parse_fn(text))
            equip_dump = ctx.eval("""(function(p) {
                return JSON.stringify({
                    topLevelEquipment: p.equipment,
                    overall: p.overall,
                    sessions: p.sessions.map(function(s) {
                        return {
                            num: s.num, dropCount: s.dropCount,
                            equipment: s.equipment,
                            stats: s.stats,
                        };
                    }),
                });
            })""")
            print(equip_dump(phd2_parsed))

            fused = ctx.eval("SessionFusion.fuseNight.bind(SessionFusion)")(parse_fn(text), phd2_parsed)
            inv_dump = ctx.eval("""(function(f) {
                return JSON.stringify(f.invariants.filter(function(i) { return !i.passed; }));
            })""")
            print(inv_dump(fused))
        return

    args = p.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    ctx = build_context(args.src_dir)

    total = 0
    passed = 0
    failures: dict[str, list[str]] = {}

    for night_key, entry in manifest.items():
        if night_key.startswith("_"):
            continue  # e.g. "_instructions" — metadata, not a night entry
        if not entry.get("asiair_file"):
            failures[night_key] = ["manifest entry has no asiair_file set — skipped"]
            continue

        asiair_path = args.corpus_dir / entry["asiair_file"]
        if not asiair_path.exists():
            failures[night_key] = [f"ASIAir log not found: {asiair_path}"]
            continue
        asiair_text = asiair_path.read_text(encoding="utf-8", errors="replace")

        phd2_text = None
        if entry.get("phd2_file"):
            phd2_path = args.corpus_dir / entry["phd2_file"]
            if not phd2_path.exists():
                failures[night_key] = [f"PHD2 log not found: {phd2_path}"]
                continue
            phd2_text = phd2_path.read_text(encoding="utf-8", errors="replace")

        total += 1
        try:
            result = run_night(ctx, asiair_text, phd2_text)
        except Exception as e:
            failures[night_key] = [f"Pipeline threw: {e}"]
            continue

        problems = evaluate_night(result, entry.get("expected", {}))
        if problems:
            failures[night_key] = problems
        else:
            passed += 1

    print(f"\n{'=' * 60}")
    print(f"Corpus regression: {passed}/{total} nights passed")
    print(f"{'=' * 60}\n")
    for night_key, problems in failures.items():
        print(f"FAIL  {night_key}")
        for prob in problems:
            print(f"      - {prob}")
    if not failures:
        print("All nights passed.")

    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
