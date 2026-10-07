/**
 * invariants.test.js
 * Rules the astronomy code must satisfy for any input, checked over a grid
 * of sites, dates, and sky positions. These need no reference data: a
 * failure is a bug by definition.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

const context = loadApp([
    'js/config.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
    'js/astro-target.js',
]);
const A = get(context, `({
    dateToJD, jdToDate, getLST, getAltitude, getAzimuth, getAngularSeparation,
    getHorizonElevationAtAzimuth, getSunPosition, getMoonPhase, getNightMoonPhase,
    findAstronomicalDusk, findNextAstronomicalDawn, findTargetRise, findTargetSet,
    findTargetTransit, isTargetVisibleDuringWindow, findSolarMidnight, getTransitHour, getNightSamples, getHoursAboveAltitude,
    STEP: APP_CONFIG.TARGET_SEARCH_STEP_SIZE, DARK_STEP_MINUTES: APP_CONFIG.DARK_HOURS_STEP_MINUTES
})`);

const MINUTE = 1 / 1440;
const YEAR_START_JD = A.dateToJD(new Date(Date.UTC(2026, 0, 1)));
const range = (start, end, step) => Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => start + i * step);

/** Local dates through 2026, every `stepDays` days. */
function datesOf2026(stepDays) {
    return range(0, 364, stepDays).map(d => new Date(2026, 0, 1 + d));
}

function sunAltitude(jd, site) {
    const sun = A.getSunPosition(jd);
    return A.getAltitude(jd, sun.ra, sun.dec, site.latitude, site.longitude);
}

function night(site, date) {
    return {
        dusk: A.findAstronomicalDusk(date, site.latitude, site.longitude, site.timezone, false),
        dawn: A.findNextAstronomicalDawn(date, site.latitude, site.longitude, site.timezone, false),
    };
}

// ── Coordinates ───────────────────────────────────────────────────────────────

test('altitude stays within ±90° and azimuth within [0°, 360°)', () => {
    for (const site of Object.values(SITES)) {
        for (const jd of range(YEAR_START_JD, YEAR_START_JD + 360, 15.3)) {
            for (const ra of range(0, 23.5, 2.5)) {
                for (const dec of range(-90, 90, 15)) {
                    const alt = A.getAltitude(jd, ra, dec, site.latitude, site.longitude);
                    const az = A.getAzimuth(jd, ra, dec, site.latitude, site.longitude);
                    assert.ok(alt >= -90 && alt <= 90, `altitude ${alt} for ra=${ra} dec=${dec}`);
                    assert.ok(az >= 0 && az < 360, `azimuth ${az} for ra=${ra} dec=${dec}`);
                }
            }
        }
    }
});

test('local sidereal time stays within [0h, 24h) at every longitude', () => {
    for (const longitude of [-180, -155.47, -0.0005, 0, 0.0005, 18.42, 180]) {
        for (const jd of range(YEAR_START_JD, YEAR_START_JD + 2, 0.137)) {
            const lst = A.getLST(jd, longitude);
            assert.ok(lst >= 0 && lst < 24, `LST ${lst} at longitude ${longitude}`);
        }
    }
});

test('a target transits at altitude 90° − |latitude − declination|, its highest point', () => {
    for (const [name, site] of Object.entries(SITES)) {
        for (const dec of range(-80, 80, 20)) {
            const transit = A.findTargetTransit(YEAR_START_JD, YEAR_START_JD + 1, 6, dec, site.longitude);
            const alt = A.getAltitude(transit, 6, dec, site.latitude, site.longitude);
            assert.ok(Math.abs(alt - (90 - Math.abs(site.latitude - dec))) < 0.01, `${name} dec=${dec}: ${alt}`);
            for (const offset of [-30 * MINUTE, 30 * MINUTE]) {
                assert.ok(A.getAltitude(transit + offset, 6, dec, site.latitude, site.longitude) <= alt, `${name} dec=${dec}`);
            }
        }
    }
});

test('angular separation is symmetric, within [0°, 180°], and continuous across RA 0h/24h', () => {
    for (const [ra1, dec1, ra2, dec2] of [[0, 0, 12, 0], [5.5, -60, 17.2, 45], [23.9, 10, 0.1, 10], [1, 89, 13, 89]]) {
        const ab = A.getAngularSeparation(ra1, dec1, ra2, dec2);
        assert.strictEqual(ab, A.getAngularSeparation(ra2, dec2, ra1, dec1));
        assert.ok(ab >= 0 && ab <= 180);
    }
    assert.ok(Math.abs(A.getAngularSeparation(23.95, 0, 0.05, 0) - 1.5) < 1e-9, 'RA wrap at the equator');
    assert.ok(A.getAngularSeparation(3, 90, 15, 90) < 1e-9, 'every RA is the same point at the pole');
    assert.ok(Math.abs(A.getAngularSeparation(0, 0, 12, 0) - 180) < 1e-9, 'opposite points');
});

test('Julian Date round-trips to the second, and increases with time', () => {
    let previous = -Infinity;
    for (const ms of range(Date.UTC(1999, 11, 31), Date.UTC(2031, 0, 1), 86400000 * 3.71)) {
        const date = new Date(Math.round(ms / 1000) * 1000);
        const jd = A.dateToJD(date);
        assert.ok(jd > previous);
        assert.strictEqual(A.jdToDate(jd).getTime(), date.getTime(), date.toISOString());
        previous = jd;
    }
});

// ── Twilight ──────────────────────────────────────────────────────────────────

test('every night has dusk before dawn, at the −18° crossings, with dark in between', () => {
    for (const [name, site] of Object.entries(SITES)) {
        for (const date of datesOf2026(1)) {
            const { dusk, dawn } = night(site, date);
            const label = `${name} ${date.toDateString()}`;
            assert.strictEqual(dusk === null, dawn === null, `${label}: dusk ${dusk}, dawn ${dawn}`);
            if (dusk === null) continue;
            assert.ok(dusk < dawn && dawn - dusk < 1, `${label}: dusk ${dusk} dawn ${dawn}`);
            assert.ok(sunAltitude(dusk, site) <= -18 && sunAltitude(dusk - MINUTE, site) > -18, `${label}: dusk crossing`);
            assert.ok(sunAltitude(dawn, site) >= -18 && sunAltitude(dawn - MINUTE, site) < -18, `${label}: dawn crossing`);
            assert.ok(sunAltitude((dusk + dawn) / 2, site) < -18, `${label}: midnight not dark`);
        }
    }
});

test('a night has darkness exactly when the sun gets below -18° at its lowest', () => {
    // Includes darkness shorter than the search's 10-minute coarse step
    // 66.61° N has about 4 minutes of darkness on 8 September
    const sites = { ...SITES, shortNight: { latitude: 66.61, longitude: 0, timezone: 0 } };
    for (const [name, site] of Object.entries(sites)) {
        for (const date of datesOf2026(1)) {
            const { dusk, dawn } = night(site, date);
            const noon = A.dateToJD(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) - site.timezone * 3600000));
            const lowest = sunAltitude(A.findSolarMidnight(noon, site.longitude), site);
            const label = `${name} ${date.toDateString()}: lowest ${lowest.toFixed(4)}°`;
            assert.strictEqual(dusk !== null, lowest <= -18, `${label}, dusk ${dusk}`);
            assert.strictEqual(dawn !== null, lowest < -18, `${label}, dawn ${dawn}`);
        }
    }
});

test('darkness comes and goes with latitude and season as expected', () => {
    const june21 = new Date(2026, 5, 21);
    const dec21 = new Date(2026, 11, 21);
    const isDark = (site, date) => night(SITES[site], date).dusk !== null;
    for (const date of datesOf2026(1)) {
        assert.ok(isDark('equator', date), `equator ${date.toDateString()}`);
        assert.ok(isDark('home', date), `home ${date.toDateString()}`);
        assert.ok(isDark('capeTown', date), `capeTown ${date.toDateString()}`);
    }
    for (const site of ['london', 'helsinki', 'tromso']) {
        assert.ok(!isDark(site, june21), `${site} should have no darkness on June 21`);
        assert.ok(isDark(site, dec21), `${site} should be dark on December 21`);
    }
    assert.ok(isDark('seattle', june21), 'Seattle has a short night on June 21');
});

test('dusk and dawn move smoothly from one night to the next', () => {
    for (const [name, site] of Object.entries(SITES)) {
        let previous = null;
        for (const date of datesOf2026(1)) {
            const current = night(site, date);
            // Times move fast as darkness comes and goes at high latitude (up to
            // 22 min/day at Tromsø); a discontinuity such as the old midnight
            // dawn bug jumps by hours.
            if (previous?.dusk && current.dusk && current.dawn - current.dusk > 1 / 24) {
                assert.ok(Math.abs(current.dusk - previous.dusk - 1) < 30 * MINUTE, `${name} ${date.toDateString()}: dusk jumped`);
                assert.ok(Math.abs(current.dawn - previous.dawn - 1) < 30 * MINUTE, `${name} ${date.toDateString()}: dawn jumped`);
            }
            previous = current;
        }
    }
});

// ── Targets ───────────────────────────────────────────────────────────────────

test('circumpolar targets never set and never-rising targets never rise', () => {
    for (const [name, site] of Object.entries(SITES)) {
        if (Math.abs(site.latitude) < 10) continue;
        const hemisphere = Math.sign(site.latitude);
        const circumpolar = hemisphere * (95 - Math.abs(site.latitude));
        const neverRises = -circumpolar;
        const start = YEAR_START_JD + 100;
        const end = start + 1;
        for (const ra of [0, 6, 12, 18]) {
            assert.strictEqual(A.findTargetSet(start, end, ra, circumpolar, site.latitude, site.longitude, 0), null, `${name} circumpolar ra=${ra}`);
            assert.ok(A.isTargetVisibleDuringWindow(start, end, ra, circumpolar, site.latitude, site.longitude, 0), `${name} circumpolar ra=${ra}`);
            assert.strictEqual(A.findTargetRise(start, end, ra, neverRises, site.latitude, site.longitude, 0), null, `${name} never rises ra=${ra}`);
            assert.ok(!A.isTargetVisibleDuringWindow(start, end, ra, neverRises, site.latitude, site.longitude, 0), `${name} never rises ra=${ra}`);
        }
    }
});

test('transit hour puts the target on the meridian, within a day of midnight', () => {
    for (const site of Object.values(SITES)) {
        for (const day of [0, 91, 182, 273]) {
            const midnightJD = YEAR_START_JD + day - site.timezone / 24;
            for (let ra = 0; ra < 24; ra += 1.7) {
                const hours = A.getTransitHour(midnightJD, ra, site.longitude);
                assert.ok(hours >= 0 && hours < 24, `ra=${ra}: ${hours}`);
                const hourAngle = ((A.getLST(midnightJD + hours / 24, site.longitude) - ra) % 24 + 36) % 24 - 12;
                assert.ok(Math.abs(hourAngle) < 1e-6, `ra=${ra}: hour angle ${hourAngle}`);
            }
        }
    }
});

test('hours above altitude count the night samples a direct altitude check finds', () => {
    const stepHours = A.DARK_STEP_MINUTES / 60;
    for (const [name, site] of Object.entries(SITES)) {
        for (const date of datesOf2026(61)) {
            const { dusk, dawn } = night(site, date);
            const samples = A.getNightSamples(dusk, dawn, site.longitude);
            for (const [ra, dec] of [[0.7, 41], [5.6, -5], [12.5, -60], [21, 44]]) {
                for (const minAltitude of [0, 30]) {
                    const above = [];
                    if (dusk !== null && dawn !== null) {
                        for (let jd = dusk; jd <= dawn; jd += A.DARK_STEP_MINUTES / 1440) {
                            above.push(A.getAltitude(jd, ra, dec, site.latitude, site.longitude) >= minAltitude);
                        }
                    }
                    let longest = 0;
                    let run = 0;
                    for (const up of above) {
                        run = up ? run + 1 : 0;
                        longest = Math.max(longest, run);
                    }
                    const hours = A.getHoursAboveAltitude(samples, ra, dec, site.latitude, minAltitude);
                    const label = `${name} ${date.toDateString()} ra=${ra} min=${minAltitude}`;
                    assert.ok(Math.abs(hours.totalHours - above.filter(Boolean).length * stepHours) < 1e-9, `${label} total`);
                    assert.ok(Math.abs(hours.longestHours - longest * stepHours) < 1e-9, `${label} longest`);
                }
            }
        }
    }
});

test('rise and set land on the minimum-altitude crossing', () => {
    for (const [name, site] of Object.entries(SITES)) {
        const start = YEAR_START_JD + 200;
        for (const dec of [-40, 0, 40]) {
            const rise = A.findTargetRise(start, start + 1, 3, dec, site.latitude, site.longitude, 20);
            if (rise !== null) {
                assert.ok(A.getAltitude(rise, 3, dec, site.latitude, site.longitude) >= 20, `${name} dec=${dec} rise`);
                assert.ok(A.getAltitude(rise - A.STEP, 3, dec, site.latitude, site.longitude) < 20, `${name} dec=${dec} rise`);
            }
            const set = A.findTargetSet(start, start + 1, 3, dec, site.latitude, site.longitude, 20);
            if (set !== null) {
                assert.ok(A.getAltitude(set, 3, dec, site.latitude, site.longitude) < 20, `${name} dec=${dec} set`);
                assert.ok(A.getAltitude(set - A.STEP, 3, dec, site.latitude, site.longitude) >= 20, `${name} dec=${dec} set`);
            }
        }
    }
});

test('horizon interpolation hits each profile point and wraps through north', () => {
    const profile = [{ azimuth: 10, elevation: 5 }, { azimuth: 180, elevation: 25 }, { azimuth: 350, elevation: 15 }];
    for (const point of profile) {
        assert.strictEqual(A.getHorizonElevationAtAzimuth(point.azimuth, profile), point.elevation);
    }
    assert.ok(Math.abs(A.getHorizonElevationAtAzimuth(0, profile) - 10) < 1e-9, 'midway between 350° and 10°');
    assert.ok(Math.abs(A.getHorizonElevationAtAzimuth(360, profile) - 10) < 1e-9, '360° is 0°');
    assert.ok(Math.abs(A.getHorizonElevationAtAzimuth(-10, profile) - 15) < 1e-9, '-10° is 350°');
});

// ── Moon ──────────────────────────────────────────────────────────────────────

test('moon illumination stays within 0–100% and the night value is sampled at the dusk–dawn midpoint', () => {
    for (const jd of range(YEAR_START_JD, YEAR_START_JD + 365, 0.37)) {
        const { illumination } = A.getMoonPhase(jd);
        assert.ok(illumination >= 0 && illumination <= 100, `${illumination} at ${jd}`);
    }
    const dusk = YEAR_START_JD + 40.4;
    const dawn = YEAR_START_JD + 40.8;
    assert.deepStrictEqual(A.getNightMoonPhase(dusk, dawn), A.getMoonPhase((dusk + dawn) / 2));
});
