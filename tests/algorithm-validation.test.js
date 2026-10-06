/**
 * algorithm-validation.test.js
 * Runs the in-app Algorithm Validation cases (src/js/algorithm-validation-cases.js)
 * under Node, one test per case. Run with `just test-js`.
 *
 * The app has no modules: every file defines globals. This loads the files
 * the cases need into one shared vm context, in the order index.html loads
 * them, the same way the browser does.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_DIR = path.join(__dirname, '..', 'src');

// Files the cases call into, plus the cases file itself. Order comes from index.html.
const REQUIRED_FILES = new Set([
    'js/config.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-moon.js',
    'js/astro-sun.js',
    'js/astro-target.js',
    'js/asiair-log-parser.js',
    'js/phd2-log-parser.js',
    'js/algorithm-validation-cases.js',
]);

function loadContext() {
    const indexHtml = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
    const scriptOrder = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    const files = scriptOrder.filter(src => REQUIRED_FILES.has(src));
    const missing = [...REQUIRED_FILES].filter(src => !files.includes(src));
    if (missing.length > 0) {
        throw new Error(`Not loaded by index.html: ${missing.join(', ')}`);
    }

    const context = vm.createContext({ console });
    for (const file of files) {
        const fullPath = path.join(SRC_DIR, file);
        vm.runInContext(fs.readFileSync(fullPath, 'utf8'), context, { filename: fullPath });
    }
    return context;
}

const context = loadContext();
const results = vm.runInContext('AlgorithmValidation.runAll()', context);

for (const result of results) {
    test(result.name, () => {
        assert.ok(result.pass,
            `expected ${result.expected}, got ${result.actual}\n  source: ${result.source}`);
    });
}
