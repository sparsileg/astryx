/**
 * stored-data.test.js
 * A failed read of the stored settings or data stops start-up before
 * anything is saved (Issue #347); a failed write leaves DataManager's lists
 * as the database has them (Issue #349).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

// app.js starts the app once the page has loaded; never here
const document = { readyState: 'loading', addEventListener: () => {}, dispatchEvent: () => {} };
const context = loadApp([
    'js/config.js',
    'js/utils-time.js',
    'js/settings-manager.js',
    'js/data-manager.js',
    'js/app.js',
], [], { globals: { document, window: {}, CustomEvent: class { constructor(type) { this.type = type; } } } });
const { App, SettingsManager, DataManager } = get(context, '({ App, SettingsManager, DataManager })');

// A database whose reads and writes a test can make fail
let db;
context.DBManager = {
    get: async (store, key) => { if (db.failGet) throw new Error('read failed'); return db.records[key]; },
    getAll: async store => { if (db.failGetAll) throw new Error('read failed'); return db.stores[store] ?? []; },
    put: async (store, record) => { if (db.failWrite) throw new Error('write failed'); db.writes.push(record); },
    putBulk: async (store, records) => { if (db.failWrite) throw new Error('write failed'); db.writes.push(...records); },
    delete: async (store, key) => { if (db.failWrite) throw new Error('write failed'); db.writes.push(key); },
};

function reset(options = {}) {
    db = { records: {}, stores: {}, writes: [], ...options };
}

test('A failed settings read stops start-up, names the cause and writes nothing (Issue #347)', async () => {
    reset({ failGet: true });
    await assert.rejects(App.loadStoredData(), error => {
        assert.strictEqual(error.message, "Astryx couldn't read its settings");
        assert.strictEqual(error.storedDataIntact, true);
        return true;
    });
    assert.deepStrictEqual(db.writes, []);
});

test('A failed data read stops start-up and names the cause (Issue #347)', async () => {
    reset({ failGetAll: true });
    await assert.rejects(App.loadStoredData(), { message: "Astryx couldn't read its data" });
    assert.deepStrictEqual(db.writes, []);
});

test('A first run, with nothing stored, starts (Issue #347)', async () => {
    reset();
    await App.loadStoredData();
    assert.strictEqual(SettingsManager.getSetting('selectedLocation'), null);
});

test('A failed save or delete leaves the lists as the database has them (Issue #349)', async () => {
    reset();
    DataManager.telescopes = { Esprit: { focalLength: 550 } };
    DataManager.sensors = { IMX571: { resolutionX: 6248 } };
    DataManager.filters = { L: {} };
    DataManager.locations = { Home: { latitude: 38 } };
    DataManager.pinnedTargets = [{ name: 'M 31' }];
    const before = () => JSON.stringify([DataManager.telescopes, DataManager.sensors, DataManager.filters,
        DataManager.locations, DataManager.pinnedTargets]);
    const stored = before();

    db.failWrite = true;
    const attempts = [
        () => DataManager.saveTelescope('RedCat', { focalLength: 250 }),
        () => DataManager.deleteTelescope('Esprit'),
        () => DataManager.saveSensor('IMX455', { resolutionX: 9576 }),
        () => DataManager.deleteSensor('IMX571'),
        () => DataManager.saveFilter('Ha'),
        () => DataManager.deleteFilter('L'),
        () => DataManager.saveLocation('Field', { latitude: 39, horizon: [] }),
        () => DataManager.deleteLocation('Home'),
        () => DataManager.pinTarget({ name: 'M 42' }),
        () => DataManager.unpinTarget('M 31'),
    ];
    for (const attempt of attempts) {
        await assert.rejects(attempt());
        assert.strictEqual(before(), stored, attempt.toString());
    }

    // A write that works changes the list as before
    db.failWrite = false;
    await DataManager.saveFilter('Ha');
    await DataManager.deleteTelescope('Esprit');
    assert.deepStrictEqual(Object.keys(DataManager.filters), ['L', 'Ha']);
    assert.deepStrictEqual(Object.keys(DataManager.telescopes), []);
});
