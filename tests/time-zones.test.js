/**
 * time-zones.test.js
 * Daylight saving follows each location's own time zone, not the time zone
 * of the computer running the app, and every view decides it for a night at
 * the same moment. just test-js runs this under four computer time zones.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

const context = loadApp([
    'js/config.js',
    'js/settings-manager.js',
    'js/utils-time.js',
]);
const { SettingsManager, TimeUtils } = get(context, '({ SettingsManager, TimeUtils })');

test('standard offsets come from the IANA zone, half-hour zones included', () => {
    const cases = {
        'America/New_York': -5, 'Europe/London': 0, 'Europe/Dublin': 0, 'Asia/Kolkata': 5.5,
        'America/St_Johns': -3.5, 'Australia/Adelaide': 9.5, 'America/Santiago': -4,
        'Pacific/Honolulu': -10, 'UTC': 0,
    };
    for (const [zone, offset] of Object.entries(cases)) {
        assert.strictEqual(TimeUtils.standardOffsetHours(zone, 2026), offset, zone);
    }
});

test('daylight saving follows the location, in either hemisphere', () => {
    const night = (y, m, d) => new Date(y, m - 1, d);
    const cases = [
        ['home', night(2026, 1, 15), false], ['home', night(2026, 7, 15), true],
        ['london', night(2026, 7, 15), true], ['helsinki', night(2026, 12, 15), false],
        // Southern summer is northern winter
        ['cerroTololo', night(2026, 1, 15), true], ['cerroTololo', night(2026, 7, 15), false],
        // No daylight saving at all
        ['capeTown', night(2026, 1, 15), false], ['maunaKea', night(2026, 7, 15), false],
        ['equator', night(2026, 7, 15), false],
    ];
    for (const [site, date, expected] of cases) {
        assert.strictEqual(SettingsManager.isDSTOnDate(date, SITES[site]), expected, `${site} ${date.toDateString()}`);
    }
});

test('the night of a clock change takes the evening\'s clock', () => {
    // US clocks change at 02:00 on 2026-03-08 and 2026-11-01
    const cases = [['2026-03-07', false], ['2026-03-08', true], ['2026-10-31', true], ['2026-11-01', false]];
    for (const [date, expected] of cases) {
        const [y, m, d] = date.split('-').map(Number);
        assert.strictEqual(SettingsManager.isDSTOnDate(new Date(y, m - 1, d), SITES.home), expected, date);
    }
    // At an instant, the change lands at 02:00 local (07:00 UTC)
    assert.strictEqual(SettingsManager.isDSTActive(new Date(Date.UTC(2026, 2, 8, 6, 59)), SITES.home), false);
    assert.strictEqual(SettingsManager.isDSTActive(new Date(Date.UTC(2026, 2, 8, 7, 1)), SITES.home), true);
});

test('a location without a time zone gets no daylight saving', () => {
    const { timeZone, ...noZone } = SITES.home;
    assert.strictEqual(SettingsManager.isDSTOnDate(new Date(2026, 6, 15), noZone), false);
});
