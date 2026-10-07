/**
 * usno-twilight.test.js
 * Astronomical dusk and dawn for every night of 2026 at every test site,
 * checked against the U.S. Naval Observatory's tables.
 *
 * The tables in fixtures/usno-twilight/ are saved verbatim from
 * https://aa.usno.navy.mil/data/RS_OneYear ("Astronomical Twilight", the
 * site's latitude, longitude, and standard-time zone; no DST). Each row is a
 * calendar day and lists the twilight that begins or ends on that day, so a
 * dusk after midnight sits on the next day's row and a night with none is
 * "////". The test therefore compares sets of events, not day-by-day pairs:
 * every USNO event must have an app event within tolerance, and vice versa.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

const context = loadApp([
    'js/config.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
], []);
const { findAstronomicalDusk, findNextAstronomicalDawn, jdToDate } = get(context,
    '({ findAstronomicalDusk, findNextAstronomicalDawn, jdToDate: TimeUtils.jdToDate })');

const YEAR = 2026;
const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
// USNO rounds to the minute and the app's search stops at 1-minute precision
const TOLERANCE_MINUTES = 2;

// Fixed-width table: the day, then per month "hhmm hhmm" (begin, end) every 11 columns
const DAY_ROW = /^\d\d  /;
const MONTH_COLUMN = 4;
const MONTH_WIDTH = 11;
const END_OFFSET = 5;
const TIME_FIELD = /^\d{4}$/;

// USNO puts the sun 5 minutes below -18° on this night; the app's sun model
// (good to ~0.01°, see astro-sun.js) bottoms out at -17.996°, so no darkness
const KNOWN_DIFFERENCES = [
    'tromso: USNO dusk 2026-09-16 23:37 missing from app',
    'tromso: USNO dawn 2026-09-16 23:42 missing from app',
];

/** The USNO table for a site as { dawns, dusks }, in UTC milliseconds. */
function readUsnoTable(name, timezone) {
    const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'usno-twilight', `${name}.txt`), 'utf8');
    const dawns = [];
    const dusks = [];
    for (const line of text.split('\n').filter(row => DAY_ROW.test(row))) {
        const day = Number(line.slice(0, 2));
        for (let month = 0; month < 12; month++) {
            const start = MONTH_COLUMN + month * MONTH_WIDTH;
            for (const [offset, events] of [[0, dawns], [END_OFFSET, dusks]]) {
                const field = line.slice(start + offset, start + offset + 4);
                if (TIME_FIELD.test(field)) {
                    const local = Date.UTC(YEAR, month, day, Number(field.slice(0, 2)), Number(field.slice(2)));
                    events.push(local - timezone * HOUR_MS);
                }
            }
        }
    }
    return { dawns, dusks };
}

/** The app's dusks and dawns for every night touching the table's year, in UTC milliseconds. */
function appEvents(site) {
    const yearStart = Date.UTC(YEAR, 0, 1) - site.timezone * HOUR_MS;
    const yearEnd = Date.UTC(YEAR + 1, 0, 1) - site.timezone * HOUR_MS;
    const inYear = ms => ms >= yearStart && ms < yearEnd;
    const toMs = jd => (jd === null ? null : jdToDate(jd).getTime());
    const dawns = [];
    const dusks = [];
    // Start the day before so the night of Dec 31 supplies the Jan 1 dawn
    for (let date = new Date(YEAR - 1, 11, 31); date.getFullYear() <= YEAR; date.setDate(date.getDate() + 1)) {
        const dusk = toMs(findAstronomicalDusk(date, site.latitude, site.longitude, site.timezone, false));
        const dawn = toMs(findNextAstronomicalDawn(date, site.latitude, site.longitude, site.timezone, false));
        if (dusk !== null && inYear(dusk)) dusks.push(dusk);
        if (dawn !== null && inYear(dawn)) dawns.push(dawn);
    }
    return { dawns, dusks };
}

const formatLocal = (ms, timezone) => new Date(ms + timezone * HOUR_MS).toISOString().slice(0, 16).replace('T', ' ');

/** Events in `events` with nothing in `others` within tolerance. */
function unmatched(events, others) {
    return events.filter(ms => !others.some(other => Math.abs(other - ms) <= TOLERANCE_MINUTES * MINUTE_MS));
}

for (const [name, site] of Object.entries(SITES)) {
    test(`astronomical twilight matches USNO all year at ${name}`, () => {
        const usno = readUsnoTable(name, site.timezone);
        const app = appEvents(site);
        const failures = [];
        for (const kind of ['dusks', 'dawns']) {
            for (const ms of unmatched(usno[kind], app[kind])) failures.push(`${name}: USNO ${kind.slice(0, -1)} ${formatLocal(ms, site.timezone)} missing from app`);
            for (const ms of unmatched(app[kind], usno[kind])) failures.push(`${name}: app ${kind.slice(0, -1)} ${formatLocal(ms, site.timezone)} not in USNO`);
        }
        const unexpected = failures.filter(failure => !KNOWN_DIFFERENCES.includes(failure));
        assert.deepStrictEqual(unexpected, [], `${unexpected.length} mismatches (local standard time)`);
    });
}
