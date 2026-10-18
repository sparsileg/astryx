/**
 * dst-nights.test.js
 * Clock times on the nights the clocks change at the location: Daily
 * Visibility's hour labels (Issue #310) and the To Do List's times
 * (Issue #335). Expected local times come from Intl in the location's zone,
 * not from the app's own conversion.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

const context = loadApp([
    'js/config.js',
    'js/settings-manager.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-sun.js',
    'js/astro-target.js',
    'js/daily-visibility-calculations.js',
    'js/todo-view.js',
]);
const { DailyVisibilityCalculations, ToDoView, SettingsManager, TimeUtils, jdToDate } =
    get(context, '({ DailyVisibilityCalculations, ToDoView, SettingsManager, TimeUtils, jdToDate })');

// The location's clock hour (0-23) at an instant, from Intl
const intlHour = (date, site) => Number(new Intl.DateTimeFormat('en-US', { timeZone: site.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date));
const intlTime = (date, site) => new Intl.DateTimeFormat('en-US', { timeZone: site.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);

// The Daily Visibility timeline for a night: 24 real hours from local noon
function timeline(dateStr, site) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const isDST = SettingsManager.isDSTOnDate(new Date(y, m - 1, d, 12), site);
    const startJD = TimeUtils.localWallClockToJD(y, m - 1, d, 12, site.timezone, isDST);
    return { startJD, endJD: startJD + 1 };
}

const labelTexts = (dateStr, site) => {
    const { startJD, endJD } = timeline(dateStr, site);
    // Spread: the array was made in the app's context
    return [...DailyVisibilityCalculations.hourLabels(startJD, endJD, site).map(l => l.text)];
};

test('Daily Visibility labels: a normal night is 12 to 12 (Issue #310)', () => {
    assert.deepStrictEqual(labelTexts('2026-10-17', SITES.home),
        ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24',
         '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
});

test('Daily Visibility labels: fall back repeats 1, spring forward skips 2 (Issue #310)', () => {
    assert.deepStrictEqual(labelTexts('2026-10-31', SITES.home).slice(12),
        ['24', '1', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    assert.deepStrictEqual(labelTexts('2027-03-13', SITES.home).slice(12),
        ['24', '1', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']);
});

test('Daily Visibility labels: each sits where its clock hour occurs, both hemispheres (Issue #310)', () => {
    // Change nights at home, and Chile's (April and September, at midnight)
    const nights = [['home', '2026-10-31'], ['home', '2027-03-13'], ['cerroTololo', '2026-04-04'], ['cerroTololo', '2026-09-05']];
    for (const [name, dateStr] of nights) {
        const site = SITES[name];
        const { startJD, endJD } = timeline(dateStr, site);
        for (const { fraction, text } of DailyVisibilityCalculations.hourLabels(startJD, endJD, site)) {
            const hour = intlHour(jdToDate(startJD + fraction * (endJD - startJD)), site);
            assert.strictEqual(text, String(hour === 0 ? 24 : hour), `${name} ${dateStr} at ${fraction.toFixed(3)}`);
        }
    }
});

// To Do's night for one target at a site, as calculateNight works it out
function toDoNight(dateStr, site, target) {
    context.ToDoManager = { getToDoTargets: () => [target] };
    context.DataManager = { getLocation: () => site };
    SettingsManager.settings.selectedLocation = 'test';
    SettingsManager.settings.globalMinAltitude = 30;
    ToDoView.selectedDate = dateStr;
    ToDoView.calculateNight();
    return ToDoView.riseTimeData;
}

test('To Do times after the clock change use the offset in force then (Issue #335)', () => {
    // Each rises above 30° at about 04:00, after the change, on the fall-back and spring-forward nights at home
    for (const [dateStr, ra] of [['2026-10-31', 11], ['2027-03-13', 19]]) {
        const data = toDoNight(dateStr, SITES.home, { object: 'Test', ra, dec: 20, type: 'G' });
        const [info] = [...data.observable, ...data.notObservable];
        const rise = jdToDate(info.riseJD);
        assert.ok(intlHour(rise, SITES.home) >= 3 && intlHour(rise, SITES.home) < 12, `${dateStr}: rise after the change`);
        assert.strictEqual(info.riseTime, intlTime(rise, SITES.home), `${dateStr} rise`);
        if (info.setTime !== 'N/A') assert.strictEqual(info.setTime, intlTime(jdToDate(info.setJD), SITES.home), `${dateStr} set`);
    }
});
