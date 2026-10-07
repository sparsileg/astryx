/**
 * planners.test.js
 * The Sequence Planner, Target Optimizer, Best Months, and Yearly
 * Observability, run on fixed nights. Each scenario checks rules the plan
 * must keep (allocations sum to 100%, events in order, the optimizer never
 * does worse than an equal split), then compares the whole output with a
 * snapshot, so any change to a plan shows up for review.
 *
 * DST is off throughout, so every snapshot is in standard time.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');
const { snapshots } = require('./lib/snapshot');

const matchSnapshot = snapshots(__filename);

// Best Months and Yearly Observability work from "today"
const context = loadApp([
    'js/config.js',
    'js/settings-manager.js',
    'js/best-months.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
    'js/astro-target.js',
    'js/yearly-observability-calculations.js',
    'js/seqplan-calculations.js',
    'js/seqplan-optimizer.js',
    'js/optimizer-calculations.js',
], [], { now: '2026-01-01T12:00:00Z' });
get(context, `SettingsManager.settings.dstConfig.mode = 'never'`);
const { SeqPlan, SeqPlanOptimizer, Optimizer, BestMonths, Yearly, SettingsManager, NOTIONAL_HORIZON } = get(context, `({
    SeqPlan: SeqPlanCalculations, SeqPlanOptimizer, Optimizer: OptimizerCalculations,
    BestMonths, Yearly: YearlyObservabilityCalculations, SettingsManager,
    NOTIONAL_HORIZON: APP_CONFIG.NOTIONAL_HORIZON
})`);

const TARGETS = {
    M31: { ra: 0.712, dec: 41.27, type: 'GALXY' },
    M33: { ra: 1.564, dec: 30.66, type: 'GALXY' },
    M42: { ra: 5.588, dec: -5.39, type: 'BRTNB' },
    M45: { ra: 3.79, dec: 24.12, type: 'OPNCL' },
    NGC7000: { ra: 20.98, dec: 44.33, type: 'BRTNB' },
    IC1396: { ra: 21.65, dec: 57.5, type: 'CL+NB' },
    M27: { ra: 19.993, dec: 22.72, type: 'PLNNB' },
    NGC2070: { ra: 5.643, dec: -69.1, type: 'BRTNB' },
    NGC3372: { ra: 10.75, dec: -59.87, type: 'BRTNB' },
    NGC104: { ra: 0.402, dec: -72.08, type: 'GLOCL' },
    NGC253: { ra: 0.793, dec: -25.29, type: 'GALXY' },
};

/** Messier objects for a marathon-sized plan, kept apart from TARGETS so the
 * Target Optimizer's candidates don't change. */
const MARATHON = {
    M74: { ra: 1.61, dec: 15.78 }, M77: { ra: 2.71, dec: -0.01 }, M33: { ra: 1.56, dec: 30.66 },
    M31: { ra: 0.71, dec: 41.27 }, M52: { ra: 23.41, dec: 61.59 }, M103: { ra: 1.56, dec: 60.66 },
    M76: { ra: 1.70, dec: 51.58 }, M34: { ra: 2.70, dec: 42.78 }, M45: { ra: 3.79, dec: 24.12 },
    M79: { ra: 5.41, dec: -24.52 }, M42: { ra: 5.59, dec: -5.39 }, M78: { ra: 5.78, dec: 0.05 },
    M1: { ra: 5.58, dec: 22.01 }, M35: { ra: 6.15, dec: 24.33 }, M37: { ra: 5.87, dec: 32.55 },
    M41: { ra: 6.78, dec: -20.76 }, M93: { ra: 7.74, dec: -23.85 }, M47: { ra: 7.61, dec: -14.48 },
    M46: { ra: 7.70, dec: -14.82 }, M50: { ra: 7.05, dec: -8.34 }, M48: { ra: 8.23, dec: -5.75 },
    M44: { ra: 8.67, dec: 19.62 }, M67: { ra: 8.86, dec: 11.81 }, M95: { ra: 10.73, dec: 11.70 },
    M65: { ra: 11.32, dec: 13.09 },
};

/** A horizon with trees to the east and a house to the north-west. */
const BLOCKED_HORIZON = [
    { azimuth: 0, elevation: 10 }, { azimuth: 60, elevation: 30 }, { azimuth: 120, elevation: 25 },
    { azimuth: 180, elevation: 5 }, { azimuth: 270, elevation: 8 }, { azimuth: 315, elevation: 40 },
];

const location = (site, horizon = NOTIONAL_HORIZON) => ({ ...SITES[site], horizon });

/** Pinned targets as SeqPlanView.loadPinnedTargets builds them. */
function planTargets(names, exposureTime = 300, catalog = TARGETS) {
    return names.map(name => ({
        targetId: name, name, ra: catalog[name].ra, dec: catalog[name].dec, common: '',
        exposureTime, allocatedPercent: 100 / names.length,
        userOrder: 0, suggestedOrder: 0, orderOverridden: false,
    }));
}

/** SeqPlanView.buildSessionConfig with the form's default values. */
function sessionConfig(date, loc, overrides = {}) {
    const framesPerDither = SettingsManager.getFramesPerDither();
    return {
        date, location: loc, minAltitude: 35, useHorizon: true, startTimeMode: 'dusk', customStartTime: '',
        autofocusEnabled: false, autofocusInterval: 60, autofocusDuration: 2, calibrationDuration: 5,
        meridianFlipPause: 4, meridianFlipDuration: 2, meridianFlipOffset: 0,
        interExposureTime: framesPerDither === 0
            ? SettingsManager.getLearnedSubGapS()
            : SettingsManager.getLearnedSubGapS() + Math.round(SettingsManager.getLearnedDitherDurationS() / framesPerDither),
        ...overrides,
    };
}

/** The plan SeqPlanView shows, and the session it was planned for. */
function generatePlan(targets, session) {
    const plan = SeqPlan.buildPlan(targets, session);
    assert.ok(plan, `no night on ${session.date}`);
    return { session, ...plan };
}

function checkPlanRules(name, targets, { session, ordered, results, skipped, events }) {
    const total = results.reduce((sum, t) => sum + t.allocatedPercent, 0);
    assert.ok(Math.abs(total - 100) < 1e-9, `${name}: allocations sum to ${total}`);
    assert.strictEqual([...results, ...skipped].map(t => t.targetId).sort().join(), targets.map(t => t.targetId).sort().join(), `${name}: same targets`);

    assert.ok(session.duskJD <= session.sessionStartJD && session.sessionStartJD < session.sessionEndJD
        && session.sessionEndJD <= session.dawnJD, `${name}: session window inside the night`);
    let previousEnd = session.sessionStartJD;
    for (const t of results) {
        assert.ok(Math.abs(t.imagingStartJD - previousEnd) < 1e-9, `${name}: ${t.targetId} starts where the last ended`);
        assert.ok(t.exposureCount >= 0 && Number.isInteger(t.exposureCount), `${name}: ${t.targetId} exposure count`);
        if (t.meridianFlipJD) {
            assert.ok(t.meridianFlipJD >= t.imagingStartJD && t.meridianFlipJD <= t.imagingEndJD, `${name}: ${t.targetId} flip`);
        }
        previousEnd = t.imagingEndJD;
    }
    assert.ok(Math.abs(previousEnd - session.sessionEndJD) < 1e-9, `${name}: last target ends the session`);

    for (let i = 0; i < events.length; i++) {
        assert.ok(events[i].endJD >= events[i].startJD, `${name}: event ${i} ends before it starts`);
        if (i > 0 && events[i].targetId === events[i - 1].targetId) {
            assert.ok(events[i].startJD >= events[i - 1].startJD - 1e-9, `${name}: event ${i} out of order`);
        }
    }

    // The optimizer must do at least as well as the set-time order with an equal split
    const visibility = SeqPlan.buildVisibility(ordered, session);
    const baseSession = SeqPlanOptimizer.withSessionWindow(ordered, session);
    const baseScore = SeqPlanOptimizer.scoreAllocations(ordered, ordered.map(t => t.allocatedPercent), baseSession, visibility);
    const planScore = SeqPlanOptimizer.scoreAllocations(results, results.map(t => t.allocatedPercent), session, visibility);
    assert.ok(SeqPlanOptimizer.comparePlans(planScore, baseScore) >= 0, `${name}: plan scores worse than an equal split`);
}

/** The parts of a plan worth comparing: dates and target records trimmed away. */
function planSummary({ session, results, events }) {
    return {
        dusk: session.duskJD, dawn: session.dawnJD, start: session.sessionStartJD, end: session.sessionEndJD,
        targets: results.map(t => ({
            id: t.targetId, percent: t.allocatedPercent, subs: t.exposureCount, overhead: t.targetOverhead,
            start: t.imagingStartJD, end: t.imagingEndJD, flip: t.meridianFlipJD, transit: t.transitJD,
            constraint: t.altitudeConstraint, horizonViolations: t.horizonViolations,
        })),
        events: events.map(e => [e.type, e.targetId, e.startJD, e.endJD]),
    };
}

const PLANS = {
    'home, two galaxies': ['2026-10-15', location('home'), ['M31', 'M33']],
    'home, autumn trio': ['2026-10-15', location('home'), ['NGC7000', 'M31', 'M45']],
    'home, four targets, over the reorder limit': ['2026-11-10', location('home'), ['M27', 'NGC7000', 'M31', 'M42']],
    'home, blocked horizon': ['2026-10-15', location('home', BLOCKED_HORIZON), ['IC1396', 'M31', 'M45']],
    'home, custom start after midnight': ['2026-12-01', location('home'), ['M45', 'M42'],
        { startTimeMode: 'custom', customStartTime: '01:30' }],
    'home, autofocus and flip offset': ['2026-10-15', location('home'), ['NGC7000', 'M31'],
        { autofocusEnabled: true, meridianFlipOffset: 10 }],
    'cerro tololo, southern trio': ['2026-03-01', location('cerroTololo'), ['NGC104', 'NGC2070', 'NGC3372']],
    'tromso, winter': ['2026-12-21', location('tromso'), ['IC1396', 'M31', 'M45']],
    'seattle, short summer night': ['2026-06-21', location('seattle'), ['NGC7000', 'IC1396']],
};

for (const [name, [date, loc, names, overrides]] of Object.entries(PLANS)) {
    test(`Sequence Planner: ${name}`, () => {
        const targets = planTargets(names);
        const plan = generatePlan(targets, sessionConfig(date, loc, overrides));
        checkPlanRules(name, targets, plan);
        matchSnapshot(`seqplan ${name}`, planSummary(plan));
    });
}

// More than SEQ_PLAN_MAX_REORDER_TARGETS targets: targets that are too low
// are skipped, and no slot pays for a meridian flip it could avoid
const MARATHON_PLAN = ['2026-03-20', location('home'), Object.keys(MARATHON), { minAltitude: 20 }];

test('Sequence Planner: home, Messier marathon', () => {
    const [date, loc, names, overrides] = MARATHON_PLAN;
    const targets = planTargets(names, 60, MARATHON);
    const plan = generatePlan(targets, sessionConfig(date, loc, overrides));
    checkPlanRules('marathon', targets, plan);
    assert.ok(plan.skipped.length > 0 && plan.results.length > plan.skipped.length, 'marathon: some targets skipped, most planned');
    for (const t of plan.results) {
        assert.ok(t.exposureCount > 0, `marathon: ${t.targetId} gets subs`);
        assert.strictEqual(t.meridianFlipJD, null, `marathon: ${t.targetId} avoids its flip`);
    }
    matchSnapshot('seqplan home, Messier marathon', planSummary(plan));
});

test('Sequence Planner: the order targets were pinned in does not change the plan', () => {
    const cases = [
        [PLANS['home, autumn trio'], TARGETS, 300],
        [PLANS['seattle, short summer night'], TARGETS, 300],
        [MARATHON_PLAN, MARATHON, 60],
    ];
    for (const [[date, loc, names, overrides], catalog, exposureTime] of cases) {
        const forward = generatePlan(planTargets(names, exposureTime, catalog), sessionConfig(date, loc, overrides));
        const reversed = generatePlan(planTargets([...names].reverse(), exposureTime, catalog), sessionConfig(date, loc, overrides));
        assert.deepStrictEqual(planSummary(reversed), planSummary(forward), `${names.join(', ')}`);
    }
});

// ── Target Optimizer ──────────────────────────────────────────────────────────

const candidates = Object.entries(TARGETS).map(([name, t]) => ({ id: name, name, common: '', type: t.type, ra: t.ra, dec: t.dec }));

for (const [name, date, site] of [['home', '2026-10-15', 'home'], ['cerro tololo', '2026-03-01', 'cerroTololo']]) {
    test(`Target Optimizer: ${name}`, () => {
        const loc = location(site);
        const timing = SeqPlan.calculateSessionTiming(date, loc);
        const session = { date, location: loc, minAltitude: 35, duskJD: timing.duskJD, sessionStartJD: timing.duskJD, sessionEndJD: timing.dawnJD };
        const scored = Optimizer.scoreCandidates(candidates, session);
        const combos = Optimizer.generateCombinations(scored);

        for (const c of scored) {
            assert.ok(c.windowStartJD >= session.sessionStartJD && c.windowEndJD <= session.sessionEndJD, `${c.id} window`);
            assert.ok(c.windowHours >= 1, `${c.id} window under an hour`);
            for (const score of Object.values(c.scores)) assert.ok(score >= 0 && score <= 100, `${c.id} score ${score}`);
        }
        for (const group of Object.values(combos)) {
            for (const combo of group) {
                const usable = Optimizer._computeUsableHours(combo.targets).reduce((sum, h) => sum + h, 0);
                const union = combo.targets.length === 1 ? combo.targets[0].windowHours : usable;
                assert.ok(usable <= union + 1e-9, 'usable hours never exceed the windows');
            }
        }

        matchSnapshot(`optimizer ${name}`, {
            scored: scored.map(c => ({ id: c.id, window: [c.windowStartJD, c.windowEndJD], peak: c.peakAltitude,
                transit: c.transitJD, moonSeparation: c.moonSeparation, dip: c.visibilityDip, scores: c.scores })),
            eliminated: scored._eliminationCounts,
            combos: Object.fromEntries(Object.entries(combos).map(([size, group]) =>
                [size, group.map(c => [c.targets.map(t => t.id), c.comboScore])])),
        });
    });
}

test('usable hours: exclusive time in full, shared time split equally', () => {
    const hours = h => h / 24;
    const window = (start, end) => ({ windowStartJD: hours(start), windowEndJD: hours(end) });
    const close = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9, `${actual} vs ${expected}`));
    close(Optimizer._computeUsableHours([window(0, 4), window(6, 8)]), [4, 2]);
    close(Optimizer._computeUsableHours([window(0, 4), window(2, 6)]), [3, 3]);
    close(Optimizer._computeUsableHours([window(0, 6), window(0, 6), window(0, 6)]), [2, 2, 2]);
    close(Optimizer._computeUsableHours([window(0, 6), window(2, 4), window(3, 8)]), [2 + 0.5 + 1 / 3 + 1, 0.5 + 1 / 3, 1 / 3 + 1 + 2]);
});

test('custom start time is the first time after dusk the local clock reads it', () => {
    const jd = (...utc) => Date.UTC(...utc) / 86400000 + 2440587.5;
    const cases = [
        ['home', '2026-10-15', '22:00', jd(2026, 9, 16, 3, 0)],
        ['home', '2026-10-15', '01:30', jd(2026, 9, 16, 6, 30)],
        ['home', '2026-10-15', '17:00', null],          // before dusk, and the next 17:00 is after dawn
        ['maunaKea', '2026-06-21', '23:00', jd(2026, 5, 22, 9, 0)],
        ['maunaKea', '2026-06-21', '03:00', jd(2026, 5, 22, 13, 0)],
        ['capeTown', '2026-06-21', '02:00', jd(2026, 5, 22, 0, 0)],
    ];
    for (const [site, date, time, expected] of cases) {
        const loc = location(site);
        const { duskJD, dawnJD } = SeqPlan.calculateSessionTiming(date, loc);
        const actual = SeqPlan.resolveCustomStartJD(time, duskJD, dawnJD, loc);
        const label = `${site} ${date} ${time}`;
        if (expected === null) {
            assert.strictEqual(actual, null, label);
        } else {
            assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);
        }
    }
});

// ── Best Months and Yearly Observability ──────────────────────────────────────

test('Best Months: visibility window is the longest run of visible days, wrapping at New Year', () => {
    const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const cases = [
        [range(100, 200), [4, 7]],
        // Three runs: the one spanning New Year is longest (Nov 27 to Feb 10)
        [[...range(0, 40), ...range(100, 150), ...range(330, 364)], [11, 14]],
        // Spanning New Year but shorter than the summer run
        [[...range(0, 40), ...range(100, 200), ...range(360, 364)], [4, 7]],
        [range(0, 364), [1, 12]],
        [[], [null, null]],
    ];
    // A night is visible when its samples hold the target on the meridian
    // (4 hours of LST = RA), and not visible when it has no darkness at all
    const target = TARGETS.M31;
    const meridian = { cosLST: Array(24).fill(Math.cos(target.ra * Math.PI / 12)), sinLST: Array(24).fill(Math.sin(target.ra * Math.PI / 12)) };
    const dark = { cosLST: [], sinLST: [] };
    const loc = location('home');
    for (const [visibleDays, [start, end]] of cases) {
        const visible = new Set(visibleDays);
        const cache = new Map(range(0, 364).map(day => [day, { samples: visible.has(day) ? meridian : dark }]));
        const window = BestMonths.calculateVisibilityWindow(target, loc, 30, 3, cache);
        assert.deepStrictEqual([window.visibilityStart, window.visibilityEnd], [start, end], `${visibleDays.length} days`);
    }
});

test('Best Months: best month, peak altitude, and visibility window', () => {
    const results = {};
    for (const site of ['home', 'capeTown', 'helsinki', 'maunaKea']) {
        const loc = location(site);
        const cache = BestMonths.buildTwilightCache(loc);
        for (const [name, target] of Object.entries(TARGETS)) {
            const best = BestMonths.calculateBestMonth(target, loc, cache);
            const window = BestMonths.calculateVisibilityWindow(target, loc, 30, 3, cache);
            if (best.bestMonth !== null) assert.ok(best.bestMonth >= 1 && best.bestMonth <= 12, `${site} ${name}`);
            if (window.visibilityStart !== null) {
                assert.ok(window.visibilityStart >= 1 && window.visibilityStart <= 12, `${site} ${name} start`);
                assert.ok(window.visibilityEnd >= window.visibilityStart && window.visibilityEnd <= 24, `${site} ${name} end`);
            }
            results[`${site} ${name}`] = { ...best, ...window };
        }
    }
    matchSnapshot('best months', results);
});

test('Yearly Observability: altitude and scores through the year', () => {
    const results = {};
    for (const [site, name] of [['home', 'M31'], ['cerroTololo', 'NGC3372'], ['helsinki', 'IC1396']]) {
        const loc = location(site);
        const target = TARGETS[name];
        const yearly = Yearly.calculateYearlyAltitudeData({
            ra: target.ra, dec: target.dec, targetType: target.type,
            latitude: loc.latitude, longitude: loc.longitude, timezone: loc.timezone, minAltitude: 30,
        });
        assert.strictEqual(yearly.data.length, 365);
        for (const day of yearly.data) {
            assert.ok(day.observabilityScore >= 0 && day.observabilityScore <= 1, `${site} ${name} day ${day.dayIndex}`);
        }
        results[`${site} ${name}`] = {
            maxAltitude: yearly.maxAltitude,
            weekly: yearly.data.filter(d => d.dayIndex % 7 === 0)
                .map(d => [d.dayIndex, d.targetAltitude, d.observabilityScore, d.imagingScore?.score ?? null]),
        };
    }
    matchSnapshot('yearly', results);
});
