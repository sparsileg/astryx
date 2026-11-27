/**
 * backup-cleanup.test.js
 * Backup and restore robustness: auto-backup times that a time-zone change
 * can't shift (Issue #346), web and desktop data comparing identical
 * (Issue #353), the settings record a backup takes, the size estimate,
 * Best Months left behind by a dropped location, the reminder's colors and
 * the backup inside a zip (Issue #354).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp([
    'js/config.js',
    'js/utils-time.js',
    'js/settings-manager.js',
    'js/data-manager.js',
    'js/backup-manager-web.js',
    'js/backup-reminder.js',
]);
const { APP_CONFIG, SettingsManager, DataManager, BackupManagerWeb, BackupReminder } =
    get(context, '({ APP_CONFIG, SettingsManager, DataManager, BackupManagerWeb, BackupReminder })');

// A settings store holding the target version, and whatever a test saves
let settingsStore;
let putBulk;
context.DBManager = {
    databaseInfo: () => ({ platform: 'web', letter: 'd', schemaVersion: APP_CONFIG.DB_VERSION, folder: null }),
    get: async (store, key) => settingsStore[key],
    getAll: async () => [],
    put: async (store, record) => { settingsStore[record.id] = record; },
    putBulk: async (store, records) => putBulk.push(...records),
};
context.UIManager = { showToast: () => {} };
context.BackupManager = BackupManagerWeb;
context.BackupReminder = BackupReminder;

function reset() {
    settingsStore = { 'target-version': { id: 'target-version', value: '1795404695' } };
    putBulk = [];
}

test('A backup made with no settings saved holds no settings, not the target version (Issue #354)', async () => {
    reset();
    const none = await BackupManagerWeb.generateBackupData(['settings']);
    assert.strictEqual(none.settings, undefined);
    assert.strictEqual(none.targetVersion, '1795404695');

    settingsStore['app-settings'] = { id: 'app-settings', data: { theme: 'night' } };
    const saved = await BackupManagerWeb.generateBackupData(['settings']);
    assert.deepStrictEqual(saved.settings, settingsStore['app-settings']);
});

test('A session whose empty numbers are blank on the web and null on desktop compares identical (Issue #353)', () => {
    const store = BackupManagerWeb.RESTORE_STORES.find(s => s.key === 'imagingSessions');
    const session = { id: 3, projectId: 1, date: '2026-11-20', filter: 'L', notes: '' };
    const web = { imagingSessions: [{ ...session, tempSetpoint: '', gain: '', offset: '' }] };
    const desktop = { imagingSessions: [{ ...session, tempSetpoint: null, gain: null, offset: null }] };
    assert.strictEqual(BackupManagerWeb.canonicalStore(store, web), BackupManagerWeb.canonicalStore(store, desktop));
    // A value that is there still counts
    const withGain = { imagingSessions: [{ ...session, gain: 120 }] };
    assert.notStrictEqual(BackupManagerWeb.canonicalStore(store, withGain), BackupManagerWeb.canonicalStore(store, desktop));
});

test('The backup in a zip is its first .json file, not a folder or a macOS copy (Issue #354)', () => {
    assert.strictEqual(BackupManagerWeb.backupEntryName([
        '__MACOSX/backups/._Astryx-userdata.json',
        'backups/._Astryx-userdata.json',
        'backups/notes.txt',
        'backups/Astryx-userdata.JSON',
        'backups/second.json',
    ]), 'backups/Astryx-userdata.JSON');
    assert.strictEqual(BackupManagerWeb.backupEntryName(['readme.txt']), undefined);
});

test('The size estimate counts each selected store\'s records, with no Best Months (Issue #354)', async () => {
    const counts = { settings: 1, locations: 3, imagingProjects: 2, imagingSessions: 10, targets: 14027 };
    const original = BackupManagerWeb.countDataStoreItems;
    BackupManagerWeb.countDataStoreItems = async () => counts;
    try {
        const per = APP_CONFIG.BACKUP_SIZE_BYTES_PER_RECORD;
        assert.strictEqual(await BackupManagerWeb.calculateBackupSize(['settings', 'locations', 'imagingProjects', 'imagingSessions']),
            APP_CONFIG.BACKUP_SIZE_OVERHEAD_BYTES + per.settings + 3 * per.locations + 2 * per.imagingProjects + 10 * per.imagingSessions);
        assert.strictEqual(await BackupManagerWeb.calculateBackupSize(['targets']),
            APP_CONFIG.BACKUP_SIZE_OVERHEAD_BYTES + 14027 * per.targets);
    } finally {
        BackupManagerWeb.countDataStoreItems = original;
    }
});

test('A location a restore dropped loses its Best Months, in targets and settings (Issue #354)', async () => {
    reset();
    DataManager.locations = { Home: {} };
    DataManager.targetDatabase = [
        { object: 'M 31', bestMonth: { Home: 10, Gone: 11 }, peakAltitude: { Home: 80, Gone: 70 } },
        { object: 'M 42', bestMonth: { Home: 1 } },
    ];
    SettingsManager.settings.bestMonthsAltitudes = { Home: 30, Gone: 30 };
    SettingsManager.settings.bestMonthsVersions = { Home: 2, Gone: 2 };

    await DataManager.pruneDroppedLocations();

    assert.deepStrictEqual(JSON.parse(JSON.stringify(DataManager.targetDatabase[0])),
        { object: 'M 31', bestMonth: { Home: 10 }, peakAltitude: { Home: 80 } });
    assert.deepStrictEqual(putBulk.map(t => t.object), ['M 31'], 'only the target that held it is written');
    assert.deepStrictEqual({ ...SettingsManager.settings.bestMonthsAltitudes }, { Home: 30 });
    assert.deepStrictEqual({ ...SettingsManager.settings.bestMonthsVersions }, { Home: 2 });

    // Nothing to prune: nothing written
    settingsStore = {};
    putBulk = [];
    await DataManager.pruneDroppedLocations();
    assert.deepStrictEqual(putBulk, []);
    assert.deepStrictEqual(settingsStore, {}, 'settings not saved');
});

test('Auto-backup times are epoch ms, so a time-zone change after a backup can\'t skip the next one (Issue #346)', async () => {
    reset();
    const originals = { downloadBlob: BackupManagerWeb.downloadBlob, JSZip: context.JSZip, setTimeout: context.setTimeout };
    BackupManagerWeb.downloadBlob = () => {};
    context.JSZip = class { file() {} async generateAsync() { return {}; } };
    context.document = { getElementById: () => null };
    try {
        SettingsManager.settings.autoBackupEnabled = true;
        const before = Date.now();
        await BackupManagerWeb.executeAutoBackup();
        const lastBackup = SettingsManager.getSetting('lastBackupTimestamp');
        assert.strictEqual(typeof lastBackup, 'number');
        assert.ok(lastBackup >= before && lastBackup <= Date.now());

        // An edit two hours later gets backed up, whatever zone the computer is in now
        let scheduled = null;
        context.setTimeout = (fn, ms) => { scheduled = ms; };
        SettingsManager.settings.lastChangeTimestamp = lastBackup + 2 * 3600000;
        await BackupManagerWeb.initAutoBackup();
        assert.notStrictEqual(scheduled, null, 'the backup is scheduled');

        // A DTG saved before the change still reads
        assert.strictEqual(TimeUtilsDtg('20260715-100000'), new Date(2026, 6, 15, 10, 0, 0).getTime());
    } finally {
        BackupManagerWeb.downloadBlob = originals.downloadBlob;
        context.JSZip = originals.JSZip;
        context.setTimeout = originals.setTimeout;
        delete context.document;
    }
});

function TimeUtilsDtg(dtg) {
    return get(context, 'TimeUtils').dtgToMs(dtg);
}

test('The backup reminder colors come from the theme, through classes (Issue #354)', () => {
    const classes = new Set();
    const indicator = {
        classList: { add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c)) },
        style: {},
    };
    const text = {};
    context.document = { getElementById: id => ({ 'backup-reminder-indicator': indicator, 'backup-reminder-text': text })[id] ?? null };
    try {
        const shown = days => {
            SettingsManager.settings.lastBackupTimestamp = days === null ? undefined : Date.now() - days * 86400000;
            BackupReminder.updateIndicator();
            return [...classes].join(' ');
        };
        assert.strictEqual(shown(null), 'due');
        assert.strictEqual(shown(1), '');
        assert.strictEqual(shown(APP_CONFIG.BACKUP_REMINDER_AMBER_DAYS), 'due');
        assert.strictEqual(shown(APP_CONFIG.BACKUP_REMINDER_RED_DAYS), 'overdue');
        assert.deepStrictEqual(indicator.style, {}, 'no inline color');
    } finally {
        delete context.document;
    }
});
