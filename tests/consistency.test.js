/**
 * consistency.test.js
 * Views that show the same quantity for the same night must agree. Daily
 * Visibility, the Sequence Planner, and Best Months each look up the night's
 * twilight their own way; these tests hold them to each other across every
 * site and every night of the year.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

// Best Months works from "today"
const context = loadApp([
    'js/config.js',
    'js/settings-manager.js',
    'js/best-months.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
    'js/astro-target.js',
    'js/daily-visibility-calculations.js',
    'js/seqplan-calculations.js',
], [], { now: '2026-01-01T12:00:00Z' });
const { BestMonths, Daily, SeqPlan } = get(context, `({
    BestMonths, Daily: DailyVisibilityCalculations, SeqPlan: SeqPlanCalculations
})`);

const MINUTE = 1 / 1440;

/** Each site as a location record, with the flat horizon DataManager supplies by default. */
function location(site) {
    return { ...site, horizon: get(context, 'APP_CONFIG.NOTIONAL_HORIZON') };
}

const twilightCaches = new Map(Object.entries(SITES).map(([name, site]) => [name, BestMonths.buildTwilightCache(location(site))]));

/** Every night of the year at every site. */
function eachNight(callback) {
    for (const [name, site] of Object.entries(SITES)) {
        for (const [dayOffset, night] of twilightCaches.get(name)) {
            callback(name, site, dayOffset, night);
        }
    }
}

const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Same JD to the twilight search's 1-minute precision, or both null. */
function assertSameTime(actual, expected, label) {
    if (actual === null || expected === null) {
        assert.strictEqual(actual, expected, label);
    } else {
        assert.ok(Math.abs(actual - expected) <= MINUTE, `${label}: ${actual} vs ${expected}`);
    }
}

test('Daily Visibility, Sequence Planner, and Best Months use the same dusk and dawn', () => {
    eachNight((name, site, dayOffset, night) => {
        const dateStr = isoDate(night.date);
        const daily = Daily.calculateTwilightTimes(dateStr, site);
        const seqPlan = SeqPlan.calculateSessionTiming(dateStr, site);
        assertSameTime(daily.duskJD, night.duskJD, `${name} ${dateStr} dusk`);
        assertSameTime(daily.dawnJD, night.dawnJD, `${name} ${dateStr} dawn`);
        assertSameTime(seqPlan?.duskJD ?? null, daily.duskJD, `${name} ${dateStr} session dusk`);
        assertSameTime(seqPlan?.dawnJD ?? null, daily.dawnJD, `${name} ${dateStr} session dawn`);
    });
});
