/**
 * performance.test.js
 * Faster code paths give the same answers as the code they replaced: target
 * search (Issue #314), the Imaging Log's sessions read once per render
 * (Issue #334), Best Months progress reported at its repaints (Issue #318),
 * the night's closest moon approach and peak altitude (Issue #317), and
 * altitude with azimuth in one call and a night's visibility in one pass
 * (Issue #315). What needs a real page is in tests/ui/checks.mjs.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

const context = loadApp(['js/config.js', 'js/data-manager.js', 'js/imaging-log-manager.js', 'js/utils-csv.js']);
const { APP_CONFIG, DataManager, ImagingLogManager, CSVUtils } =
    get(context, '({ APP_CONFIG, DataManager, ImagingLogManager, CSVUtils })');

// The real catalogue, as the app loads it
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'targets-meta.json'), 'utf8'));
DataManager.targetDatabase = CSVUtils.parseTargetCSV(fs.readFileSync(path.join(DATA_DIR, meta.filename), 'utf8')).targets;

// searchTargets before Issue #314
function searchTargetsBefore(targets, query) {
    const lowerQuery = query.toLowerCase().trim();
    const match = lowerQuery.match(/^([A-Za-z]+)(\d+)$/);
    const spacedQuery = match ? `${match[1]} ${match[2]}` : null;
    return targets.filter(target => {
        const objectLower = target.object.toLowerCase();
        const commonLower = target.common ? target.common.toLowerCase() : '';
        const otherLower = target.other ? target.other.toLowerCase() : '';
        const isCatalogueQuery = !!match || /^[a-z]+\s+\d+$/i.test(lowerQuery);
        const matchesOriginal = objectLower.includes(lowerQuery) || commonLower.includes(lowerQuery) ||
              (!isCatalogueQuery && otherLower.includes(lowerQuery));
        const matchesSpaced = spacedQuery && (objectLower.includes(spacedQuery) || commonLower.includes(spacedQuery) ||
              (!isCatalogueQuery && otherLower.includes(spacedQuery)));
        return matchesOriginal || matchesSpaced;
    }).filter((target, index, arr) => arr.findIndex(t => t.object === target.object) === index);
}

// The issue's queries, the Target Search tutorial's, and some edge cases
const QUERIES = ['n', 'ng', 'ngc', 'm', 'ic 1', 'orion', 'M31', 'm 31', 'ngc 70', 'sh2', 'Sh 2-2', 'M42', 'nebula',
    '  Orion  ', 'NGC7000', 'zzz'];

test('Target search finds the same targets in the same order (Issue #314)', () => {
    assert.strictEqual(DataManager.targetDatabase.length, meta.count, 'whole catalogue loaded');
    for (const query of QUERIES) {
        const expected = searchTargetsBefore(DataManager.targetDatabase, query).map(t => t.object);
        assert.deepStrictEqual(DataManager.searchTargets(query).map(t => t.object), expected, query);
    }
});

test('Target search stops at its limit, keeping catalogue order (Issue #314)', () => {
    const limit = APP_CONFIG.PROJECT_TARGET_SEARCH_LIMIT;
    for (const query of ['ng', 'orion', 'zzz']) {
        const all = DataManager.searchTargets(query).map(t => t.object);
        assert.deepStrictEqual(DataManager.searchTargets(query, limit).map(t => t.object), all.slice(0, limit), query);
    }
});

test('Sessions grouped once give each project its own sessions and integration (Issue #334)', () => {
    const sessions = [
        { id: 1, projectId: 1, filter: 'L', subLength: 300, usedExposures: 10 },
        { id: 2, projectId: 2, filter: 'Ha', subLength: 600, usedExposures: 5 },
        { id: 3, projectId: 1, filter: 'L', subLength: 120, usedExposures: 0 },
        { id: 4, projectId: 1, filter: 'OIII', subLength: 2.5, usedExposures: '' },
        { id: 5, projectId: 1, filter: 'Ha', subLength: 180, usedExposures: 20 },
    ];
    const byProject = ImagingLogManager.groupSessionsByProject(sessions);
    for (const projectId of [1, 2]) {
        const own = sessions.filter(s => s.projectId === projectId).map(s => s.id);
        assert.deepStrictEqual([...byProject.get(projectId)].map(s => s.id), own, `project ${projectId}`);
    }
    assert.strictEqual(byProject.get(3), undefined, 'a project with no sessions');
    assert.deepStrictEqual({ ...ImagingLogManager.integrationTimeByFilter(byProject.get(1)) }, { L: 3000, OIII: 0, Ha: 3600 });
});

// Best Months over a small catalogue, every calculation stubbed: only the
// progress it reports is under test
const bestMonthsContext = loadApp(['js/config.js', 'js/best-months.js']);
const { BestMonths } = get(bestMonthsContext, '({ BestMonths })');
const BEST_MONTHS_TARGETS = 250;
Object.assign(bestMonthsContext, {
    DataManager: {
        getLocation: () => ({}),
        getLocations: () => ({ Home: {}, 'Dark Site': {}, Away: {} }),
        getTargets: () => Array.from({ length: BEST_MONTHS_TARGETS }, (_, i) => ({ object: `T ${i + 1}` })),
        bulkUpdateTargets: async () => {},
        loadTargets: async () => {},
    },
    SettingsManager: new Proxy({}, { get: () => async () => {} }),
    document: { dispatchEvent: () => {} },
    CustomEvent: class {},
    setTimeout,
});
Object.assign(BestMonths, {
    buildTwilightCache: () => ({}),
    calculateBestMonth: () => ({ bestMonth: null }),
    calculateVisibilityWindow: () => ({ visibilityStart: null }),
});

test('Best Months reports progress every so many targets and at the end (Issue #318)', async () => {
    const reported = [];
    await BestMonths.calculateBestMonths('Home', 30, 2, (processed, total, name) => reported.push([processed, total, name]));
    const every = APP_CONFIG.BEST_MONTHS_PROGRESS_EVERY;
    const counts = Array.from({ length: Math.ceil(BEST_MONTHS_TARGETS / every) }, (_, i) => Math.min((i + 1) * every, BEST_MONTHS_TARGETS));
    const expected = counts.map(n => [n, BEST_MONTHS_TARGETS, `T ${n}`]);
    assert.deepStrictEqual(reported, expected);
});

test('All Locations\' time remaining falls steadily to zero (Issue #318)', async () => {
    const MS_PER_TARGET = 4;
    const estimates = [];
    await BestMonths.calculateBestMonthsForAllLocations(30, 2, progress => {
        if (progress.phase !== 'target') return;
        // Every target takes as long, so the estimate is exact
        estimates.push(BestMonths.remainingSeconds(progress.runProcessed * MS_PER_TARGET, progress.runProcessed, progress.runTotal));
    });
    const every = APP_CONFIG.BEST_MONTHS_PROGRESS_EVERY;
    const runTotal = 3 * BEST_MONTHS_TARGETS;
    assert.strictEqual(estimates.length, 3 * Math.ceil(BEST_MONTHS_TARGETS / every));
    assert.strictEqual(estimates[0], Math.round((runTotal - every) * MS_PER_TARGET / 1000), 'first estimate');
    estimates.slice(1).forEach((e, i) => assert.ok(e <= estimates[i], `estimate rose: ${estimates}`));
    assert.strictEqual(estimates.at(-1), 0);
});

const astro = get(loadApp(['js/config.js', 'js/astro-core.js', 'js/astro-moon.js', 'js/astro-sun.js', 'js/astro-target.js']), `({
    APP_CONFIG, getLST, hoursToRadians, degreesToRadians, radiansToDegrees,
    getAltitude, getAzimuth, getAltAz, isAboveHorizon, isVisibleAt,
    getMoonPosition, getAngularSeparation, getMinMoonSeparation, getPeakAltitude,
    findTargetTransit, findAstronomicalDusk, findNextAstronomicalDawn,
    findTargetRise, findTargetSet, findVisibilityDip, scanVisibility
})`);

// getMinMoonSeparation before Issue #317: every 1-minute sample
function minMoonSeparationBefore(startJD, endJD, ra, dec, latitude, longitude, minAltitude) {
    const stepSize = astro.APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    const steps = Math.ceil((endJD - startJD) / stepSize);
    let min = null;
    for (let i = 0; i <= steps; i++) {
        const jd = Math.min(startJD + i * stepSize, endJD);
        if (astro.getAltitude(jd, ra, dec, latitude, longitude) < minAltitude) continue;
        const moon = astro.getMoonPosition(jd);
        const separation = astro.getAngularSeparation(ra, dec, moon.ra, moon.dec);
        if (min === null || separation < min) min = separation;
    }
    return min;
}

const MAX_ALTITUDE_PER_MINUTE = 15 / 60;

// The peak scan before Issue #317: every minute from dusk
function peakAltitudeBefore(startJD, endJD, ra, dec, latitude, longitude) {
    let max = -999;
    for (let jd = startJD; jd <= endJD; jd += 1 / 1440) max = Math.max(max, astro.getAltitude(jd, ra, dec, latitude, longitude));
    return max;
}

// A night every four months at every site, for targets across the sky
function* nights() {
    for (const [name, site] of Object.entries(SITES)) {
        for (const month of [0, 4, 8]) {
            const date = new Date(2026, month, 10);
            const dusk = astro.findAstronomicalDusk(date, site.latitude, site.longitude, site.timezone, false);
            const dawn = astro.findNextAstronomicalDawn(date, site.latitude, site.longitude, site.timezone, false);
            if (dusk === null || dawn === null) continue;
            for (const ra of [0, 8, 16]) {
                for (const dec of [-75, -30, 15, 45, 80]) yield { name, site, month, dusk, dawn, ra, dec };
            }
        }
    }
}

test('The closest moon approach matches every-minute sampling within 0.01° (Issue #317)', () => {
    let compared = 0;
    for (const { name, site, month, dusk, dawn, ra, dec } of nights()) {
        const { latitude, longitude } = site;
        // A threshold the target only just clears is a stretch shorter than the coarse step
        const peak = astro.getPeakAltitude(dusk, dawn, ra, dec, latitude, longitude).altitude;
        for (const minAltitude of [30, -90, peak - 0.02]) {
            const expected = minMoonSeparationBefore(dusk, dawn, ra, dec, latitude, longitude, minAltitude);
            const actual = astro.getMinMoonSeparation(dusk, dawn, ra, dec, latitude, longitude, minAltitude);
            const where = `${name} month ${month + 1}, RA ${ra} Dec ${dec}, above ${minAltitude.toFixed(2)}°`;
            if (expected === null) {
                assert.strictEqual(actual, null, where);
            } else {
                assert.ok(Math.abs(actual - expected) <= 0.01, `${where}: ${actual} vs ${expected}`);
                compared++;
            }
        }
    }
    assert.ok(compared > 0);
});

test('Peak altitude is the culmination altitude when transit is in the window, else the higher end (Issue #317)', () => {
    for (const { name, site, month, dusk, dawn, ra, dec } of nights()) {
        const { latitude, longitude } = site;
        const where = `${name} month ${month + 1}, RA ${ra} Dec ${dec}`;
        const peak = astro.getPeakAltitude(dusk, dawn, ra, dec, latitude, longitude);
        const scanned = peakAltitudeBefore(dusk, dawn, ra, dec, latitude, longitude);
        // Never below the scan, which can only miss the top
        assert.ok(peak.altitude >= scanned - 1e-9, `${where}: ${peak.altitude} below ${scanned}`);
        assert.ok(peak.jd >= dusk && peak.jd <= dawn, where);
        assert.ok(Math.abs(astro.getAltitude(peak.jd, ra, dec, latitude, longitude) - peak.altitude) < 0.001, `${where}: altitude at its time`);
        if (astro.findTargetTransit(dusk, dawn, ra, longitude) !== null) {
            assert.strictEqual(peak.altitude, 90 - Math.abs(latitude - dec), where);
            // Near the zenith altitude changes fast even at transit: at most 15° an hour
            assert.ok(peak.altitude - scanned <= MAX_ALTITUDE_PER_MINUTE, `${where}: ${peak.altitude} vs ${scanned}`);
        } else {
            const ends = Math.max(...[dusk, dawn].map(jd => astro.getAltitude(jd, ra, dec, latitude, longitude)));
            assert.strictEqual(peak.altitude, ends, where);
        }
    }
});

// getAzimuth before Issue #315
function azimuthBefore(jd, raHours, decDeg, latitude, longitude) {
    const hourAngle = ((astro.getLST(jd, longitude) - raHours + 12) % 24 + 24) % 24 - 12;
    const h = astro.hoursToRadians(hourAngle);
    const d = astro.degreesToRadians(decDeg);
    const phi = astro.degreesToRadians(latitude);
    const sinAlt = Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(phi) * Math.cos(h);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosAz = (Math.sin(d) - Math.sin(alt) * Math.sin(phi)) / (Math.cos(alt) * Math.cos(phi));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(h) > 0) azimuth = 2 * Math.PI - azimuth;
    return astro.radiansToDegrees(azimuth) % 360;
}

// Every half hour of a day, at every site, for targets across the sky, the pole and zenith included
function* instants() {
    const startJD = 2461330.5;
    for (const [name, site] of Object.entries(SITES)) {
        for (const ra of [0, 5.5, 11, 17.25]) {
            for (const dec of [-90, -60, -20, 0, 30, 60, 90, site.latitude]) {
                for (let i = 0; i < 48; i++) yield { name, site, jd: startJD + i / 48, ra, dec };
            }
        }
    }
}

test('Altitude and azimuth together are the same numbers as each on its own (Issue #315)', () => {
    for (const { name, site, jd, ra, dec } of instants()) {
        const { altitude, azimuth } = astro.getAltAz(jd, ra, dec, site.latitude, site.longitude);
        const where = `${name} JD ${jd} RA ${ra} Dec ${dec}`;
        assert.strictEqual(altitude, astro.getAltitude(jd, ra, dec, site.latitude, site.longitude), where);
        assert.strictEqual(azimuth, azimuthBefore(jd, ra, dec, site.latitude, site.longitude), where);
    }
});

test('Visible at an instant is what altitude, azimuth and the horizon check give (Issue #315)', () => {
    const profile = [{ azimuth: 0, elevation: 10 }, { azimuth: 90, elevation: 35 }, { azimuth: 200, elevation: 5 }, { azimuth: 300, elevation: 25 }];
    for (const { name, site, jd, ra, dec } of instants()) {
        const altitude = astro.getAltitude(jd, ra, dec, site.latitude, site.longitude);
        const azimuth = azimuthBefore(jd, ra, dec, site.latitude, site.longitude);
        for (const horizon of [null, [], profile]) {
            // Below 0° too: without a profile the horizon is flat at 0°
            for (const minAltitude of [-10, 0, 20, 40]) {
                assert.strictEqual(astro.isVisibleAt(jd, ra, dec, site.latitude, site.longitude, minAltitude, horizon),
                    astro.isAboveHorizon(altitude, azimuth, minAltitude, horizon),
                    `${name} JD ${jd} RA ${ra} Dec ${dec}, min ${minAltitude}°, ${horizon ? horizon.length : 'no'} horizon points`);
            }
        }
    }
});

// isTargetVisibleDuringWindow before Issue #315: the first sample the
// target is visible at, or null. Its last sample could fall after endJD.
function firstVisibleBefore(startJD, endJD, ra, dec, latitude, longitude, minAltitude, horizon) {
    const stepSize = astro.APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
    const steps = Math.ceil((endJD - startJD) / stepSize);
    for (let i = 0; i <= steps; i++) {
        const jd = startJD + i * stepSize;
        if (astro.isAboveHorizon(astro.getAltitude(jd, ra, dec, latitude, longitude),
            azimuthBefore(jd, ra, dec, latitude, longitude), minAltitude, horizon)) return jd;
    }
    return null;
}

test('One pass over a night gives the rise, set, dip and visibility of the separate searches (Issue #315)', () => {
    // A horizon that hides the east, so some targets dip behind it and come back
    const profile = [{ azimuth: 0, elevation: 5 }, { azimuth: 80, elevation: 45 }, { azimuth: 120, elevation: 45 }, { azimuth: 160, elevation: 5 }];
    let dips = 0;
    for (const { name, site, month, dusk, dawn, ra, dec } of nights()) {
        const { latitude, longitude } = site;
        for (const horizon of [null, profile]) {
            for (const minAltitude of [0, 30]) {
                const where = `${name} month ${month + 1}, RA ${ra} Dec ${dec}, min ${minAltitude}°, ${horizon ? 'a' : 'no'} horizon`;
                const scan = astro.scanVisibility(dusk, dawn, ra, dec, latitude, longitude, minAltitude, horizon);
                assert.strictEqual(scan.riseJD, astro.findTargetRise(dusk, dawn, ra, dec, latitude, longitude, minAltitude, horizon), `${where}: rise`);
                assert.strictEqual(scan.setJD, astro.findTargetSet(dusk, dawn, ra, dec, latitude, longitude, minAltitude, horizon), `${where}: set`);
                const dip = astro.findVisibilityDip(dusk, dawn, ra, dec, latitude, longitude, minAltitude, horizon);
                assert.deepStrictEqual(scan.dip && { ...scan.dip }, dip && { ...dip }, `${where}: dip`);
                if (dip) dips++;
                // Visible at some sample: up at the start, or rising
                const upAtStart = astro.isVisibleAt(dusk, ra, dec, latitude, longitude, minAltitude, horizon);
                assert.strictEqual(scan.visible, upAtStart || scan.riseJD !== null, `${where}: visible`);
                // The old search agrees, except when only its sample after dawn saw the target
                const firstBefore = firstVisibleBefore(dusk, dawn, ra, dec, latitude, longitude, minAltitude, horizon);
                if (scan.visible !== (firstBefore !== null)) {
                    assert.ok(!scan.visible && firstBefore > dawn, `${where}: visible, ${scan.visible} vs ${firstBefore}`);
                }
            }
        }
    }
    assert.ok(dips > 0, 'no night had a dip');
});
