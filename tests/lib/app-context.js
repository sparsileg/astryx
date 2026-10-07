/**
 * app-context.js
 * Loads app source files into one shared vm context, the way the browser
 * does. The app has no modules: every file defines globals, so files load
 * in the order index.html lists them. Used by every *.test.js file.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

/**
 * @param {string[]} appFiles - paths as index.html writes them, e.g. 'js/astro-core.js'
 * @param {string[]} testScripts - scripts under tests/ to run in the same context afterwards
 * @param {Object} [options]
 * @param {string} [options.now] - ISO instant that `new Date()` and `Date.now()`
 *     return, for code that works from "today" (Best Months, Yearly Observability)
 * @returns {vm.Context}
 */
function loadApp(appFiles, testScripts = [], { now } = {}) {
    const indexHtml = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
    const scriptOrder = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    const wanted = new Set(appFiles);
    const files = scriptOrder.filter(src => wanted.has(src));
    const missing = appFiles.filter(src => !files.includes(src));
    if (missing.length > 0) {
        throw new Error(`Not loaded by index.html: ${missing.join(', ')}`);
    }

    const context = vm.createContext({ console });
    if (now) {
        vm.runInContext(`
            const FIXED_NOW = ${Date.parse(now)};
            globalThis.Date = class extends Date {
                constructor(...args) { args.length === 0 ? super(FIXED_NOW) : super(...args); }
                static now() { return FIXED_NOW; }
            };`, context);
    }
    const run = fullPath => vm.runInContext(fs.readFileSync(fullPath, 'utf8'), context, { filename: fullPath });
    files.forEach(file => run(path.join(SRC_DIR, file)));
    testScripts.forEach(script => run(path.join(__dirname, '..', script)));
    return context;
}

/** Evaluate an expression in the context, e.g. a global's name. */
function get(context, expression) {
    return vm.runInContext(expression, context);
}

module.exports = { loadApp, get };
