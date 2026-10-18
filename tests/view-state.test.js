/**
 * view-state.test.js
 * Stale or inconsistent view state: the Daily Visibility forecast request
 * (Issue #308), the Optimizer's reuse of its last run and its pins
 * (Issue #332), the Sequence Planner after a failed plan and in its PDF
 * (Issue #330), the saved current target (Issue #333), and attribute
 * escaping (Issue #337). What needs a real page is in tests/ui/checks.mjs.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp([
    'js/config.js',
    'js/utils-html.js',
    'js/settings-manager.js',
    'js/data-manager.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/target-search.js',
    'js/daily-visibility-view.js',
    'js/seqplan-view.js',
    'js/optimizer-view.js',
], [], { now: '2026-10-17T16:00:00Z' });
const { HtmlUtils, DataManager, SettingsManager, VisibilityTargets, DailyVisibilityView, SeqPlanView, OptimizerView } =
    get(context, '({ HtmlUtils, DataManager, SettingsManager, VisibilityTargets, DailyVisibilityView, SeqPlanView, OptimizerView })');

// A page with none of the view's elements, and a localStorage
context.document = { getElementById: () => null };
const storage = new Map();
context.localStorage = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
};
context.UIManager = { showToast: () => {}, updateSidebarCurrentTarget: () => {} };

test('escapeAttr escapes every character that can end or change an attribute (Issue #337)', () => {
    assert.strictEqual(HtmlUtils.escapeAttr(`Bob's "Back" <Yard> & Co`), 'Bob&#39;s &quot;Back&quot; &lt;Yard&gt; &amp; Co');
    assert.strictEqual(HtmlUtils.escapeAttr(null), '');
    assert.strictEqual(HtmlUtils.escapeAttr(0), '0');
});

test('Quick date steps share one forecast request per location (Issue #308)', async () => {
    const urls = [];
    let respond;
    context.fetch = url => {
        urls.push(url);
        return new Promise(resolve => { respond = resolve; });
    };
    DailyVisibilityView._openMeteoCache = null;
    const days = ['2026-10-17', '2026-10-18', '2026-10-19'].map(d => DailyVisibilityView.fetchCloudData(39.3, -78.2, d));
    assert.strictEqual(urls.length, 1, 'one request while it is in flight');
    respond({ ok: true, json: async () => ({ hourly: { time: [] } }) });
    await Promise.all(days);
    await DailyVisibilityView.fetchCloudData(39.3, -78.2, '2026-10-20');
    assert.strictEqual(urls.length, 1, 'the next step reads the cache');

    // Another location makes its own request
    const other = DailyVisibilityView.fetchCloudData(-30.17, -70.81, '2026-10-17');
    assert.strictEqual(urls.length, 2);
    respond({ ok: false });
    assert.strictEqual(await other, null);
});

test('The Optimizer reuses its last run only for the same location and Min Altitude (Issue #332)', () => {
    SettingsManager.settings.selectedLocation = 'Home';
    SettingsManager.settings.globalMinAltitude = 30;
    OptimizerView.resultsInputs = { date: '2026-10-17', locationName: 'Home', minAltitude: 30 };
    assert.strictEqual(OptimizerView.resultsCurrent(), true);
    SettingsManager.settings.selectedLocation = 'Dark Site';
    assert.strictEqual(OptimizerView.resultsCurrent(), false, 'another location');
    SettingsManager.settings.selectedLocation = 'Home';
    SettingsManager.settings.globalMinAltitude = 40;
    assert.strictEqual(OptimizerView.resultsCurrent(), false, 'another Min Altitude');
    OptimizerView.resultsInputs = null;
    assert.strictEqual(OptimizerView.resultsCurrent(), false, 'no run yet');
});

test('A pin keeps the name and position, as the detail modal pins (Issue #332)', () => {
    const m31 = { object: 'M 31', ra: 0.71, dec: 41.27, common: 'Andromeda Galaxy', bestMonth: { Home: 10 } };
    assert.deepStrictEqual({ ...DataManager.pinnedRecord(m31) }, { name: 'M 31', ra: 0.71, dec: 41.27, common: 'Andromeda Galaxy' });
    assert.strictEqual(DataManager.pinnedRecord({ object: 'X', ra: 1, dec: 2 }).common, '');
});

test('A failed plan leaves the Sequence Planner responsive and clears the old plan (Issue #330)', async () => {
    context.SeqPlanTimeline = { ctx: null };
    SeqPlanView.saveSettings = async () => {};
    SeqPlanView.buildSessionConfig = () => ({});

    SeqPlanView.calculatedResults = [{ targetId: 'old' }];
    SeqPlanView.validateInputs = () => false;
    await SeqPlanView.generatePlan();
    assert.strictEqual(SeqPlanView.isInitializing, false, 'invalid inputs');
    assert.strictEqual(SeqPlanView.calculatedResults.length, 0, 'old plan cleared');

    SeqPlanView.validateInputs = () => true;
    for (const [why, plan] of [['no astronomical night', null], ['no target high enough', { results: [], skipped: [], events: [] }]]) {
        SeqPlanView.calculatedResults = [{ targetId: 'old' }];
        context.SeqPlanCalculations = { buildPlan: () => plan };
        await SeqPlanView.generatePlan();
        assert.strictEqual(SeqPlanView.isInitializing, false, why);
        assert.strictEqual(SeqPlanView.calculatedResults.length, 0, `${why}: old plan cleared`);
    }
});

test('The Sequence Planner PDF subtitle names the location (Issue #330)', () => {
    let doc;
    context.pdfMake = { createPdf: d => { doc = d; return { download: () => {} }; } };
    SeqPlanView.calculatedResults = [{ targetId: 'M 31', name: 'M 31' }];
    const location = { latitude: 39.3, longitude: -78.2, timezone: -5, timeZone: 'America/New_York' };
    SeqPlanView.downloadPDF('M 31', [], { date: '2026-10-17', location, locationName: 'Home' });
    assert.match(doc.content[1].text, /•  Home$/);
});

test('The current target is saved by name and read back from the catalogue (Issue #333)', () => {
    const fresh = { object: 'M 31', ra: 0.71, dec: 41.27, common: 'Andromeda Galaxy', bestMonth: { Home: 11 } };
    DataManager.targetDatabase = [fresh];

    // The old key held the whole record, with the Best Month of its day
    storage.clear();
    storage.set('lastSelectedTarget', JSON.stringify({ ...fresh, bestMonth: { Home: 9 } }));
    VisibilityTargets.currentTarget = null;
    VisibilityTargets.loadLastTarget();
    assert.strictEqual(VisibilityTargets.currentTarget, fresh, 'the catalogue record, not the saved copy');
    assert.strictEqual(storage.has('lastSelectedTarget'), false, 'old key removed');
    assert.deepStrictEqual(JSON.parse(storage.get(VisibilityTargets.LAST_TARGET_KEY)),
        { name: 'M 31', ra: 0.71, dec: 41.27, common: 'Andromeda Galaxy' });

    // Targets reloaded (a Best Months run): the current target follows
    const reloaded = { ...fresh, bestMonth: { Home: 12 } };
    DataManager.targetDatabase = [reloaded];
    VisibilityTargets.refreshCurrentTarget();
    assert.strictEqual(VisibilityTargets.currentTarget, reloaded);

    // Gone from the catalogue: its name and position are kept
    DataManager.targetDatabase = [];
    VisibilityTargets.loadLastTarget();
    assert.deepStrictEqual({ ...VisibilityTargets.currentTarget }, { object: 'M 31', ra: 0.71, dec: 41.27, common: 'Andromeda Galaxy' });
});
