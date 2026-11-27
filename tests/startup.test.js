/**
 * startup.test.js
 * A malformed URL hash opens its view, a failed optional start-up step
 * leaves the app running, and the Initialization Error page has nothing
 * that deletes data (Issue #356).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, get } = require('./lib/app-context');

// app.js starts the app once the page has loaded; never here
const document = { readyState: 'loading', addEventListener: () => {} };
const window = { location: { hash: '' } };
const context = loadApp(['js/config.js', 'js/app.js'], [], { globals: { document, window } });
const App = get(context, 'App');

const toasts = [];
context.UIManager = { showToast: (message, type) => toasts.push({ message, type }) };

test('A stray % after the view name opens the view instead of stopping start-up (Issue #356)', () => {
    const loaded = [];
    App.loadView = view => loaded.push(view);
    for (const hash of ['#todo?q=50%', '#todo?flag', '#todo']) {
        window.location.hash = hash;
        App.route();
    }
    assert.deepStrictEqual(loaded, ['todo', 'todo', 'todo']);
});

test('A failed start-up step shows a toast and the next step still runs (Issue #356)', async () => {
    toasts.length = 0;
    let laterStepRan = false;
    await App.startupStep('Automatic backups', async () => { throw new Error('timer failed'); });
    await App.startupStep('The backup reminder', () => { laterStepRan = true; });
    assert.deepStrictEqual(toasts, [{ message: 'Automatic backups failed: timer failed', type: 'error' }]);
    assert.strictEqual(laterStepRan, true);
});

test('The Initialization Error page has no button that deletes data (Issue #356)', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const template = html.match(/<template id="initialization-error-template">([\s\S]*?)<\/template>/)[1];
    const actions = [...template.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
    assert.deepStrictEqual(actions, ['reload']);
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'app.js'), 'utf8'),
        /deleteDatabase|localStorage\.clear/);
});
