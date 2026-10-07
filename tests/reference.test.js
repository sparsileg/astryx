/**
 * reference.test.js
 * Runs every case in reference-cases.js, one test per case.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp([
    'js/config.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
    'js/astro-target.js',
    'js/asiair-log-parser.js',
    'js/phd2-log-parser.js',
], ['reference-cases.js']);

for (const c of get(context, 'REFERENCE_CASES')) {
    test(c.name, () => {
        const actual = c.actual();
        const pass = typeof c.expected === 'boolean'
            ? actual === c.expected
            : typeof actual === 'number' && Math.abs(actual - c.expected) <= c.tolerance;
        assert.ok(pass, `expected ${c.expected} ±${c.tolerance}, got ${actual}\n  source: ${c.source}`);
    });
}
