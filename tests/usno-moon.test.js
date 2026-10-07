/**
 * usno-moon.test.js
 * Every primary moon phase of 2026 (new, first quarter, full, last quarter)
 * checked against the U.S. Naval Observatory. fixtures/usno-moon/ holds the
 * response of https://aa.usno.navy.mil/api/moon/phases/year?year=2026,
 * times in UTC.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const usno = require('./fixtures/usno-moon/phases-2026.json');

const context = loadApp([
    'js/config.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
], []);
const { getMoonPosition, getSunPosition, getMoonPhase } = get(context, '({ getMoonPosition, getSunPosition, getMoonPhase })');

// astro-moon.js documents the moon's position to ~0.3° and illumination to ~1%
const LONGITUDE_TOLERANCE_DEG = 0.5;
const ILLUMINATION_TOLERANCE_PERCENT = 1;

// Each phase is the moment the moon's ecliptic longitude leads the sun's by this much
const PHASES = {
    'New Moon': { longitudeLead: 0, illumination: 0 },
    'First Quarter': { longitudeLead: 90, illumination: 50 },
    'Full Moon': { longitudeLead: 180, illumination: 100 },
    'Last Quarter': { longitudeLead: 270, illumination: 50 },
};

const toJD = ({ year, month, day, time }) => {
    const [hours, minutes] = time.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hours, minutes) / 86400000 + 2440587.5;
};

for (const event of usno.phasedata) {
    test(`${event.phase} ${event.year}-${String(event.month).padStart(2, '0')}-${String(event.day).padStart(2, '0')} ${event.time} UTC`, () => {
        const jd = toJD(event);
        const expected = PHASES[event.phase];
        const lead = getMoonPosition(jd).lambda - getSunPosition(jd).lambda;
        const longitudeError = ((lead - expected.longitudeLead) % 360 + 540) % 360 - 180;
        assert.ok(Math.abs(longitudeError) <= LONGITUDE_TOLERANCE_DEG, `moon–sun longitude off by ${longitudeError.toFixed(3)}°`);

        const phase = getMoonPhase(jd);
        assert.ok(Math.abs(phase.illumination - expected.illumination) <= ILLUMINATION_TOLERANCE_PERCENT,
            `illumination ${phase.illumination.toFixed(2)}%, expected ${expected.illumination}%`);
        assert.strictEqual(phase.phaseName, event.phase);
    });
}
