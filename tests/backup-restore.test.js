/**
 * backup-restore.test.js
 * Which backup files restore: same and older backup formats, not newer
 * ones (Issue #352); a file whose version fields or records aren't what
 * restore expects is refused before the restore dialog, and text from a
 * backup reaches the page escaped (Issue #362). Backups and their file
 * names carry the schema version of the database that made them, with its
 * platform (Issue #363).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp([
    'js/config.js',
    'js/utils-html.js',
    'js/utils-time.js',
    'js/settings-manager.js',
    'js/imaging-log-manager.js',
    'js/imaging-log-view.js',
    'js/backup-manager-web.js',
]);
const { APP_CONFIG, BackupManagerWeb, ImagingLogView } =
    get(context, '({ APP_CONFIG, BackupManagerWeb, ImagingLogView })');

// The web database's stores: imaging records get their ids from the store,
// the others are keyed by a name or designation
const AUTO_INCREMENT = ['imagingProjects', 'imagingSessions', 'imagingPrograms'];
const KEY_PATHS = { settings: 'id', toDoTargets: 'targetId', targets: 'object' };
// The desktop database, unless a test says otherwise
const DESKTOP = { platform: 'desktop', letter: 's', schemaVersion: 2, folder: '/home/user/.local/share/Astryx' };
context.DBManager = {
    databaseInfo: () => DESKTOP,
    storeKey: storeName => {
        const store = BackupManagerWeb.RESTORE_STORES.find(s => APP_CONFIG.STORES[s.storesKey] === storeName);
        return AUTO_INCREMENT.includes(store.key)
            ? { keyPath: 'id', autoIncrement: true }
            : { keyPath: KEY_PATHS[store.key] ?? 'name', autoIncrement: false };
    },
};

const CANARY = '<b class="canary">"\'&</b>';

// A backup as generateBackupData writes it, before this change (no backupFormat)
function backup(overrides = {}) {
    return {
        version: '1.101.0',
        dbVersion: APP_CONFIG.DB_VERSION,
        targetVersion: '1795404695',
        exportDate: '2026-11-20T12:00:00.000Z',
        settings: { id: 'app-settings', data: { theme: 'dark' } },
        locations: [{ name: 'Home', latitude: 38.9, longitude: -77.9 }],
        toDoTargets: [{ targetId: 'M 31' }],
        imagingProjects: [{ id: 1, name: 'M 31', status: 'Acquiring', targetDesignations: ['M 31'] }],
        imagingSessions: [{ id: 3, projectId: 1, filter: 'L' }],
        ...overrides,
    };
}

test('A backup from this or an older database version restores (Issue #352)', () => {
    for (const dbVersion of [APP_CONFIG.DB_VERSION, APP_CONFIG.DB_VERSION - 1, 6]) {
        const file = backup({ dbVersion });
        assert.strictEqual(BackupManagerWeb.backupFileProblem(file, true), null);
        assert.strictEqual(BackupManagerWeb.isFromNewerAstryx(file), false);
    }
});

test('Raising DB_VERSION alone does not change which backups restore (Issue #352)', () => {
    // A newer Astryx with a new IndexedDB store but the same backup format
    const file = backup({ dbVersion: APP_CONFIG.DB_VERSION + 1, backupFormat: APP_CONFIG.BACKUP_FORMAT });
    assert.strictEqual(BackupManagerWeb.backupFileProblem(file, true), null);
    assert.strictEqual(BackupManagerWeb.isFromNewerAstryx(file), false);
});

test('A backup without backupFormat is format 1; a newer format is refused (Issue #352)', () => {
    assert.strictEqual(BackupManagerWeb.backupFormatOf(backup()), 1);
    assert.strictEqual(BackupManagerWeb.isFromNewerAstryx(backup({ backupFormat: APP_CONFIG.BACKUP_FORMAT + 1 })), true);
});

test('Backups record their format, and their database\'s schema version and platform (Issues #352, #363)', async () => {
    context.DBManager.get = async () => ({ id: 'target-version', value: '1795404695' });
    const file = await BackupManagerWeb.generateBackupData([]);
    assert.strictEqual(file.backupFormat, APP_CONFIG.BACKUP_FORMAT);
    assert.strictEqual(file.dbVersion, 2);
    assert.strictEqual(file.platform, 'desktop');
    assert.strictEqual(BackupManagerWeb.backupFileProblem(file, false), null);
});

test('Backup file names say which database made them: d on the web, s on desktop (Issue #363)', () => {
    assert.strictEqual(BackupManagerWeb.fileNameBase(), `Astryx-v${APP_CONFIG.APP_VERSION}-s2`);
    const web = { platform: 'web', letter: 'd', schemaVersion: APP_CONFIG.DB_VERSION, folder: null };
    context.DBManager.databaseInfo = () => web;
    try {
        assert.strictEqual(BackupManagerWeb.fileNameBase(), `Astryx-v${APP_CONFIG.APP_VERSION}-d${APP_CONFIG.DB_VERSION}`);
    } finally {
        context.DBManager.databaseInfo = () => DESKTOP;
    }
});

test('A schema version is shown with its platform, when the backup says (Issue #363)', () => {
    assert.strictEqual(BackupManagerWeb.describeSchemaVersion(8, 'web'), '8 (web)');
    assert.strictEqual(BackupManagerWeb.describeSchemaVersion(2, 'desktop'), '2 (desktop)');
    assert.strictEqual(BackupManagerWeb.describeSchemaVersion(8, undefined), '8');
});

test('A backup whose platform is not web or desktop is refused; one without it restores (Issue #363)', () => {
    for (const platform of ['phone', CANARY, 2, null, { web: true }]) {
        assert.match(BackupManagerWeb.backupFileProblem(backup({ platform }), false), /platform/);
    }
    for (const platform of ['web', 'desktop']) {
        assert.strictEqual(BackupManagerWeb.backupFileProblem(backup({ platform }), true), null);
    }
    assert.strictEqual(BackupManagerWeb.backupFileProblem(backup(), true), null);
});

test('A file whose version fields are not short strings or numbers is refused (Issue #362)', () => {
    for (const field of ['version', 'dbVersion', 'targetVersion']) {
        for (const value of [{ html: CANARY }, ['8'], 'x'.repeat(APP_CONFIG.BACKUP_VERSION_FIELD_MAX_LENGTH + 1)]) {
            assert.match(BackupManagerWeb.backupFileProblem(backup({ [field]: value }), false), new RegExp(field));
        }
    }
    assert.match(BackupManagerWeb.backupFileProblem(backup({ backupFormat: '2' }), false), /backup format/);
    assert.match(BackupManagerWeb.backupFileProblem([], false), /not an Astryx backup/);
    assert.match(BackupManagerWeb.backupFileProblem(null, false), /not an Astryx backup/);
});

test('A store that is not a list of records is refused (Issue #362)', () => {
    assert.match(BackupManagerWeb.backupFileProblem(backup({ locations: { name: 'Home' } }), false), /Locations/);
    assert.match(BackupManagerWeb.backupFileProblem(backup({ locations: ['Home'] }), false), /Locations record 1/);
});

test('On the web, a record whose key has the wrong type is refused (Issue #362)', () => {
    const projectWithTextId = backup({ imagingProjects: [{ id: 1 }, { id: CANARY }] });
    assert.match(BackupManagerWeb.backupFileProblem(projectWithTextId, true), /Imaging Projects record 2: its id is not a whole number/);
    assert.match(BackupManagerWeb.backupFileProblem(backup({ imagingSessions: [{ id: 1.5 }] }), true), /Imaging Sessions record 1/);
    assert.match(BackupManagerWeb.backupFileProblem(backup({ locations: [{ name: 7 }] }), true), /Locations record 1: its name is not text/);
    assert.match(BackupManagerWeb.backupFileProblem(backup({ toDoTargets: [{}] }), true), /To Do List record 1: its targetId/);
    // A record the store will number itself
    assert.strictEqual(BackupManagerWeb.backupFileProblem(backup({ imagingPrograms: [{ name: 'Messier' }] }), true), null);
    // Desktop checks key types in Rust at restore time
    assert.strictEqual(BackupManagerWeb.backupFileProblem(projectWithTextId, false), null);
});

test('A project card shows a backup\'s filter, status and ids as text (Issue #362)', () => {
    const project = { id: CANARY, name: CANARY, status: CANARY, targetDesignations: ['M 31'], modified: '2026-11-20T12:00:00Z' };
    const sessions = [{ id: CANARY, projectId: CANARY, date: '2026-11-19', filter: CANARY, location: CANARY, subLength: 300, usedExposures: 10 }];
    const html = ImagingLogView.renderProjectCard(project, sessions);
    assert.ok(!html.includes('<b class="canary">'), 'markup from the backup reached the page');
    assert.ok(!html.includes(`"'&`), 'a quote from the backup reached the page unescaped');
});

test('escapeHtml needs no DOM (Issue #362)', () => {
    assert.strictEqual(context.document, undefined);
    assert.strictEqual(get(context, 'HtmlUtils').escapeHtml(CANARY),
        '&lt;b class=&quot;canary&quot;&gt;&quot;&#39;&amp;&lt;/b&gt;');
});

test('The newer-backup message works when desktop calls it with its own this (Issue #352)', () => {
    const message = {};
    context.document = { getElementById: id => (id === 'newer-backup-message' ? message : null) };
    context.UIManager = { openModal: () => {} };
    context.setTimeout = callback => callback();
    BackupManagerWeb.showNewerBackupModal.call({}, backup({ version: '9.0.0', backupFormat: 2 }));
    delete context.document;
    assert.match(message.innerHTML, /Astryx 9\.0\.0, in backup format\s+<strong>2<\/strong>/);
});
